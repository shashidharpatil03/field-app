import re
import sqlite3
import unicodedata
from datetime import date, datetime
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from land_rules import check_draft_land, check_land, show_acres

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    # Also allow the app to be opened from a phone on the same home or office
    # Wi-Fi (private addresses only), for testing on a real device.
    allow_origin_regex=r"http://(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):5173",
    allow_methods=["*"],
    allow_headers=["*"],
)


def current_user(x_user_id: Optional[int] = Header(default=None)):
    """Finds out who is asking, from the X-User-Id header the app sends."""
    if x_user_id is None:
        raise HTTPException(status_code=401, detail="Please sign in")
    connection = sqlite3.connect("field.db")
    row = connection.execute(
        """
        SELECT app_users.id, app_users.name, app_users.role, app_users.pu_id,
               app_users.ff_id, facilitators.active
        FROM app_users
        LEFT JOIN facilitators ON facilitators.id = app_users.ff_id
        WHERE app_users.id = ?
        """,
        (x_user_id,),
    ).fetchone()
    connection.close()
    if row is None:
        raise HTTPException(status_code=401, detail="Unknown user")
    if row[2] == "facilitator" and row[5] == 0:
        raise HTTPException(status_code=401, detail="This account is no longer active")
    return {
        "id": row[0],
        "name": row[1],
        "role": row[2],
        "pu_id": row[3],
        "ff_id": row[4],
    }


def fail(connection, status_code, message, form=False):
    """Closes the connection and stops the request with an error."""
    if connection is not None:
        connection.close()
    raise HTTPException(
        status_code=status_code, detail={"form": message} if form else message
    )


def require_manager(user):
    if user["role"] != "pu_manager":
        fail(None, 403, "Only the PU manager can do this")


def lg_access(connection, user, lg_id):
    """None if the group does not exist, otherwise True or False."""
    row = connection.execute(
        "SELECT pu_id FROM learning_groups WHERE id = ?", (lg_id,)
    ).fetchone()
    if row is None:
        return None
    if user["role"] == "pu_manager":
        return row[0] == user["pu_id"]
    current = connection.execute(
        "SELECT ff_id FROM assignments WHERE lg_id = ? AND end_date IS NULL",
        (lg_id,),
    ).fetchone()
    return current is not None and current[0] == user["ff_id"]


def require_lg(connection, user, lg_id, form=False):
    allowed = lg_access(connection, user, lg_id)
    if allowed is None:
        fail(connection, 404, "Group not found", form)
    if not allowed:
        fail(connection, 403, "You do not have access to this group", form)


def require_farmer(connection, user, farmer_id, form=False):
    row = connection.execute(
        "SELECT lg_id FROM farmers WHERE id = ?", (farmer_id,)
    ).fetchone()
    if row is None:
        fail(connection, 404, "Farmer not found", form)
    if not lg_access(connection, user, row[0]):
        fail(connection, 403, "You do not have access to this farmer", form)


def require_draft(connection, user, draft_id):
    row = connection.execute(
        "SELECT lg_id FROM farmer_drafts WHERE id = ?", (draft_id,)
    ).fetchone()
    if row is None:
        fail(connection, 404, "Draft not found", True)
    require_lg(connection, user, row[0], True)
    return row[0]


@app.get("/lgs")
def list_lgs(user: dict = Depends(current_user)):
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    rows = connection.execute("""
        SELECT
            learning_groups.id,
            learning_groups.pu_id,
            pus.name AS pu_name,
            pus.code || '-' || printf('%03d', learning_groups.lg_number)
                AS lg_code,
            villages.id AS village_id,
            villages.name AS village,
            (SELECT COUNT(*) FROM farmers
             WHERE farmers.lg_id = learning_groups.id
             AND farmers.participation = 'continuing') AS farmer_count,
            (SELECT COUNT(*) FROM farmer_drafts
             WHERE farmer_drafts.lg_id = learning_groups.id) AS draft_count,
            facilitators.id AS ff_id,
            facilitators.name AS ff_name
        FROM learning_groups
        JOIN pus ON pus.id = learning_groups.pu_id
        JOIN villages ON villages.id = learning_groups.village_id
        LEFT JOIN assignments
            ON assignments.lg_id = learning_groups.id
            AND assignments.end_date IS NULL
        LEFT JOIN facilitators
            ON facilitators.id = assignments.ff_id
        WHERE (? = 'pu_manager' AND learning_groups.pu_id = ?)
           OR (? = 'facilitator' AND assignments.ff_id = ?)
        ORDER BY pus.code, learning_groups.lg_number
    """, (user["role"], user["pu_id"], user["role"], user["ff_id"])).fetchall()
    connection.close()
    return [dict(row) for row in rows]

@app.get("/users")
def list_users():
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        """
        SELECT app_users.id, app_users.name, app_users.role, pus.name AS pu_name
        FROM app_users
        JOIN pus ON pus.id = app_users.pu_id
        LEFT JOIN facilitators ON facilitators.id = app_users.ff_id
        WHERE app_users.ff_id IS NULL OR facilitators.active = 1
        ORDER BY app_users.role DESC, app_users.name
        """
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


@app.get("/ffs")
def list_ffs(user: dict = Depends(current_user)):
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        """
        SELECT id, name, pu_id FROM facilitators
        WHERE active = 1
        AND ((? = 'pu_manager' AND pu_id = ?)
          OR (? = 'facilitator' AND id = ?))
        ORDER BY name
        """,
        (user["role"], user["pu_id"], user["role"], user["ff_id"]),
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


class ReassignRequest(BaseModel):
    new_ff_id: int


@app.post("/lgs/{lg_id}/reassign")
def reassign_lg(
    lg_id: int, body: ReassignRequest, user: dict = Depends(current_user)
):
    require_manager(user)
    connection = sqlite3.connect("field.db")

    lg = connection.execute(
        "SELECT id, pu_id FROM learning_groups WHERE id = ?", (lg_id,)
    ).fetchone()
    ff = connection.execute(
        "SELECT id, pu_id, active FROM facilitators WHERE id = ?", (body.new_ff_id,)
    ).fetchone()
    if lg is None or ff is None:
        connection.close()
        raise HTTPException(status_code=404, detail="Group or facilitator not found")

    if lg[1] != user["pu_id"]:
        fail(connection, 403, "You do not have access to this group")
    if not ff[2]:
        fail(connection, 400, "That facilitator has left")
    if lg[1] != ff[1]:
        connection.close()
        raise HTTPException(
            status_code=400, detail="That facilitator belongs to a different PU"
        )

    current = connection.execute(
        "SELECT id, ff_id FROM assignments WHERE lg_id = ? AND end_date IS NULL",
        (lg_id,),
    ).fetchone()
    if current is not None and current[1] == body.new_ff_id:
        connection.close()
        raise HTTPException(
            status_code=400, detail="This group is already with that facilitator"
        )

    today = date.today().isoformat()
    if current is not None:
        connection.execute(
            "UPDATE assignments SET end_date = ? WHERE id = ?", (today, current[0])
        )
    connection.execute(
        "INSERT INTO assignments (lg_id, ff_id, start_date) VALUES (?, ?, ?)",
        (lg_id, body.new_ff_id, today),
    )
    connection.commit()
    connection.close()
    return {"message": "Moved"}

@app.get("/lgs/{lg_id}/assignments")
def assignment_history(lg_id: int, user: dict = Depends(current_user)):
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    require_lg(connection, user, lg_id)
    rows = connection.execute(
        """
        SELECT
            assignments.id,
            facilitators.name AS ff_name,
            assignments.start_date,
            assignments.end_date
        FROM assignments
        JOIN facilitators ON facilitators.id = assignments.ff_id
        WHERE assignments.lg_id = ?
        ORDER BY assignments.id DESC
        """,
        (lg_id,),
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


@app.get("/lgs/{lg_id}/farmers")
def list_farmers(
    lg_id: int, include_dropped: bool = False, user: dict = Depends(current_user)
):
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    require_lg(connection, user, lg_id)
    rows = connection.execute(
        """
        SELECT
            farmers.id,
            pus.code
                || '-' || printf('%03d', learning_groups.lg_number)
                || '-' || printf('%02d', farmers.farmer_number)
                AS farmer_code,
            farmers.name,
            farmers.gender,
            farmers.growing_cotton,
            farmers.participation
        FROM farmers
        JOIN learning_groups ON learning_groups.id = farmers.lg_id
        JOIN pus ON pus.id = learning_groups.pu_id
        WHERE farmers.lg_id = ?
        AND (farmers.participation = 'continuing' OR ? = 1)
        ORDER BY farmers.farmer_number
        """,
        (lg_id, 1 if include_dropped else 0),
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


FARMER_CODE_SQL = """pus.code
    || '-' || printf('%03d', learning_groups.lg_number)
    || '-' || printf('%02d', farmers.farmer_number)"""


def like_pattern(text):
    """Turns what the person typed into a safe 'contains' pattern."""
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


@app.get("/farmers")
def search_farmers(
    lg_id: Optional[int] = None,
    village_id: Optional[int] = None,
    ff_id: Optional[int] = None,
    q: str = "",
    status: str = "continuing",
    limit: int = 40,
    offset: int = 0,
    user: dict = Depends(current_user),
):
    """The farmer list. Always limited to what this person may see, then
    narrowed by the filters. Returns one page at a time, so a slow phone
    never has to download hundreds of farmers at once."""
    if status not in ("continuing", "dropped_out", "all"):
        fail(None, 400, "Unknown status")
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    conditions = [
        """((? = 'pu_manager' AND learning_groups.pu_id = ?)
            OR (? = 'facilitator' AND assignments.ff_id = ?))"""
    ]
    values = [user["role"], user["pu_id"], user["role"], user["ff_id"]]

    if lg_id is not None:
        conditions.append("farmers.lg_id = ?")
        values.append(lg_id)
    if village_id is not None:
        conditions.append("learning_groups.village_id = ?")
        values.append(village_id)
    if ff_id is not None:
        conditions.append("assignments.ff_id = ?")
        values.append(ff_id)
    if status != "all":
        conditions.append("farmers.participation = ?")
        values.append(status)

    text = q.strip()
    if text != "":
        pattern = like_pattern(text)
        conditions.append(
            f"""(farmers.name LIKE ? ESCAPE '\\'
                 OR farmers.mobile LIKE ? ESCAPE '\\'
                 OR {FARMER_CODE_SQL} LIKE ? ESCAPE '\\')"""
        )
        values.extend([pattern, pattern, pattern])

    where = " AND ".join(conditions)
    source = """
        FROM farmers
        JOIN learning_groups ON learning_groups.id = farmers.lg_id
        JOIN pus ON pus.id = learning_groups.pu_id
        JOIN villages ON villages.id = learning_groups.village_id
        LEFT JOIN assignments
            ON assignments.lg_id = farmers.lg_id
            AND assignments.end_date IS NULL
    """

    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    total = connection.execute(
        f"SELECT COUNT(*) {source} WHERE {where}", values
    ).fetchone()[0]
    rows = connection.execute(
        f"""
        SELECT
            farmers.id,
            {FARMER_CODE_SQL} AS farmer_code,
            farmers.name,
            farmers.gender,
            farmers.growing_cotton,
            farmers.participation,
            farmers.mobile,
            farmers.lg_id,
            pus.code || '-' || printf('%03d', learning_groups.lg_number)
                AS lg_code,
            villages.name AS village
        {source}
        WHERE {where}
        ORDER BY learning_groups.lg_number, farmers.farmer_number
        LIMIT ? OFFSET ?
        """,
        values + [limit, offset],
    ).fetchall()
    connection.close()
    return {"total": total, "items": [dict(row) for row in rows]}


# Which farmers this user may count: a manager sees the whole production
# unit, a facilitator only the groups assigned to them.
DASHBOARD_FROM = """
    FROM farmers
    JOIN learning_groups ON learning_groups.id = farmers.lg_id
    LEFT JOIN assignments
        ON assignments.lg_id = farmers.lg_id
        AND assignments.end_date IS NULL
    WHERE ((? = 'pu_manager' AND learning_groups.pu_id = ?)
        OR (? = 'facilitator' AND assignments.ff_id = ?))
"""


def season_start(today):
    """The cotton season starts on 1 May every year."""
    this_year = date(today.year, 5, 1)
    return this_year if today >= this_year else date(today.year - 1, 5, 1)


@app.get("/farmers/dashboard")
def farmers_dashboard(user: dict = Depends(current_user)):
    scope = (user["role"], user["pu_id"], user["role"], user["ff_id"])
    start = season_start(date.today()).isoformat()
    connection = sqlite3.connect("field.db")

    total, growing, women, area = connection.execute(
        """
        SELECT COUNT(*),
               COALESCE(SUM(farmers.growing_cotton), 0),
               COALESCE(SUM(farmers.gender = 'Female'), 0),
               COALESCE(SUM(farmers.area_under_cotton), 0)
        """
        + DASHBOARD_FROM
        + " AND farmers.participation = 'continuing'",
        scope,
    ).fetchone()

    added = connection.execute(
        "SELECT COUNT(*) " + DASHBOARD_FROM + " AND farmers.registered_on >= ?",
        scope + (start,),
    ).fetchone()[0]

    # Dropped out this season: now dropped out, and the drop-out was recorded
    # on or after the season start.
    dropped = connection.execute(
        "SELECT COUNT(*) "
        + DASHBOARD_FROM
        + """
        AND farmers.participation = 'dropped_out'
        AND EXISTS (
            SELECT 1 FROM farmer_change_log log
            WHERE log.farmer_id = farmers.id
            AND log.field = 'Participation'
            AND log.new_value = 'Dropped out'
            AND log.changed_on >= ?)
        """,
        scope + (start,),
    ).fetchone()[0]

    # Updated: registered before this season, and had profile details
    # (anything except participation) changed since it began.
    updated = connection.execute(
        "SELECT COUNT(*) "
        + DASHBOARD_FROM
        + """
        AND farmers.registered_on < ?
        AND EXISTS (
            SELECT 1 FROM farmer_change_log log
            WHERE log.farmer_id = farmers.id
            AND log.field != 'Participation'
            AND log.changed_on >= ?)
        """,
        scope + (start, start),
    ).fetchone()[0]
    connection.close()

    return {
        "participating": total,
        "growing_cotton": growing,
        "women": women,
        "women_percent": round(100 * women / total) if total else 0,
        "area_under_cotton": round(area, 1),
        "season": {
            "start": start,
            "updated": updated,
            "added": added,
            "dropped_out": dropped,
        },
    }


@app.get("/farmers/{farmer_id}")
def get_farmer(farmer_id: int, user: dict = Depends(current_user)):
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    require_farmer(connection, user, farmer_id)
    row = connection.execute(
        """
        SELECT
            farmers.id,
            pus.code
                || '-' || printf('%03d', learning_groups.lg_number)
                || '-' || printf('%02d', farmers.farmer_number)
                AS farmer_code,
            pus.code
                || '-' || printf('%03d', learning_groups.lg_number)
                AS lg_code,
            farmers.name,
            farmers.gender,
            farmers.growing_cotton,
            farmers.mobile,
            farmers.participation,
            farmers.total_landholding,
            farmers.area_under_cotton,
            farmers.water_regime,
            farmers.registered_on,
            villages.name AS village,
            pus.name AS pu_name,
            facilitators.name AS ff_name
        FROM farmers
        JOIN learning_groups ON learning_groups.id = farmers.lg_id
        JOIN pus ON pus.id = learning_groups.pu_id
        JOIN villages ON villages.id = learning_groups.village_id
        LEFT JOIN assignments
            ON assignments.lg_id = learning_groups.id
            AND assignments.end_date IS NULL
        LEFT JOIN facilitators
            ON facilitators.id = assignments.ff_id
        WHERE farmers.id = ?
        """,
        (farmer_id,),
    ).fetchone()
    connection.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Farmer not found")
    return dict(row)

ALLOWED_GENDERS = ["Female", "Male", "Other"]


class DraftBody(BaseModel):
    name: str = ""
    gender: str = ""
    growing_cotton: Optional[bool] = None
    mobile: str = ""
    total_landholding: Optional[float] = None
    area_under_cotton: Optional[float] = None
    water_regime: str = ""
    confirmed_large: bool = False


def name_error(name, who):
    """Returns a message if the name is not acceptable, otherwise None."""
    if name == "":
        return f"Please enter the {who}'s full name"
    if len(name) < 3:
        return "Name is too short (at least 3 letters)"
    if len(name) > 60:
        return "Name is too long (at most 60 letters)"
    if not all(unicodedata.category(ch)[0] in "LM" or ch in " .'-" for ch in name):
        return "Name can only have letters and spaces"
    return None


def check_farmer(name, gender, growing_cotton, mobile=""):
    """Checks the personal answers. The land answers use check_land()."""
    errors = {}

    message = name_error(name, "farmer")
    if message:
        errors["name"] = message

    if gender not in ALLOWED_GENDERS:
        errors["gender"] = "Please choose a gender"

    if growing_cotton is None:
        errors["growing_cotton"] = "Please choose Yes or No"

    # Mobile is optional: empty is fine, but if given it must be 10 digits.
    if mobile != "" and not re.fullmatch(r"[0-9]{10}", mobile):
        errors["mobile"] = "Mobile number must be exactly 10 digits"

    return errors


def check_draft(name, gender, mobile="", total=None, cotton=None, water=""):
    errors = check_draft_land(total, cotton, water)
    if mobile != "" and not re.fullmatch(r"[0-9]{1,10}", mobile):
        errors["mobile"] = "Mobile number can only have digits (up to 10)"
    if len(name) > 60:
        errors["name"] = "Name is too long (at most 60 letters)"
    if gender != "" and gender not in ALLOWED_GENDERS:
        errors["gender"] = "Please choose a gender"
    return errors


def mobile_owner(connection, user, mobile, except_farmer_id=0):
    """Returns an error message if another farmer already uses this mobile.

    The other farmer's code is only shown if this user may see that farmer.
    """
    row = connection.execute(
        """
        SELECT pus.code
            || '-' || printf('%03d', learning_groups.lg_number)
            || '-' || printf('%02d', farmers.farmer_number),
            farmers.lg_id
        FROM farmers
        JOIN learning_groups ON learning_groups.id = farmers.lg_id
        JOIN pus ON pus.id = learning_groups.pu_id
        WHERE farmers.mobile = ? AND farmers.id != ?
        """,
        (mobile, except_farmer_id),
    ).fetchone()
    if row is None:
        return None
    if lg_access(connection, user, row[1]):
        return f"This mobile number is already used by farmer {row[0]}"
    return "This mobile number is already used by another farmer"


@app.get("/lgs/{lg_id}/drafts")
def list_drafts(lg_id: int, user: dict = Depends(current_user)):
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    require_lg(connection, user, lg_id)
    rows = connection.execute(
        """
        SELECT id, name, gender, growing_cotton, mobile, total_landholding,
               area_under_cotton, water_regime, confirmed_large, updated_at
        FROM farmer_drafts
        WHERE lg_id = ?
        ORDER BY updated_at DESC, id DESC
        """,
        (lg_id,),
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


@app.post("/lgs/{lg_id}/drafts")
def create_draft(lg_id: int, body: DraftBody, user: dict = Depends(current_user)):
    name = " ".join(body.name.split())
    mobile = body.mobile.strip()
    errors = check_draft(
        name, body.gender, mobile,
        body.total_landholding, body.area_under_cotton, body.water_regime,
    )
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    connection = sqlite3.connect("field.db")
    require_lg(connection, user, lg_id, True)

    growing = None if body.growing_cotton is None else int(body.growing_cotton)
    cursor = connection.execute(
        """
        INSERT INTO farmer_drafts
            (lg_id, name, gender, growing_cotton, mobile, total_landholding,
             area_under_cotton, water_regime, confirmed_large, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (lg_id, name, body.gender, growing, mobile,
         body.total_landholding, body.area_under_cotton, body.water_regime,
         int(body.confirmed_large),
         datetime.now().isoformat(timespec="seconds")),
    )
    new_id = cursor.lastrowid
    connection.commit()
    connection.close()
    return {"id": new_id}


@app.put("/drafts/{draft_id}")
def update_draft(draft_id: int, body: DraftBody, user: dict = Depends(current_user)):
    name = " ".join(body.name.split())
    mobile = body.mobile.strip()
    errors = check_draft(
        name, body.gender, mobile,
        body.total_landholding, body.area_under_cotton, body.water_regime,
    )
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    connection = sqlite3.connect("field.db")
    require_draft(connection, user, draft_id)
    growing = None if body.growing_cotton is None else int(body.growing_cotton)
    cursor = connection.execute(
        """
        UPDATE farmer_drafts
        SET name = ?, gender = ?, growing_cotton = ?, mobile = ?,
            total_landholding = ?, area_under_cotton = ?, water_regime = ?,
            confirmed_large = ?, updated_at = ?
        WHERE id = ?
        """,
        (name, body.gender, growing, mobile,
         body.total_landholding, body.area_under_cotton, body.water_regime,
         int(body.confirmed_large),
         datetime.now().isoformat(timespec="seconds"), draft_id),
    )
    connection.commit()
    changed = cursor.rowcount
    connection.close()
    if changed == 0:
        raise HTTPException(status_code=404, detail={"form": "Draft not found"})
    return {"id": draft_id}


@app.delete("/drafts/{draft_id}")
def delete_draft(draft_id: int, user: dict = Depends(current_user)):
    connection = sqlite3.connect("field.db")
    require_draft(connection, user, draft_id)
    cursor = connection.execute(
        "DELETE FROM farmer_drafts WHERE id = ?", (draft_id,)
    )
    connection.commit()
    changed = cursor.rowcount
    connection.close()
    if changed == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"message": "Deleted"}


@app.post("/drafts/{draft_id}/submit")
def submit_draft(draft_id: int, user: dict = Depends(current_user)):
    connection = sqlite3.connect("field.db")
    require_draft(connection, user, draft_id)

    draft = connection.execute(
        "SELECT lg_id, name, gender, growing_cotton, mobile, "
        "total_landholding, area_under_cotton, water_regime, confirmed_large "
        "FROM farmer_drafts WHERE id = ?",
        (draft_id,),
    ).fetchone()
    if draft is None:
        connection.close()
        raise HTTPException(status_code=404, detail={"form": "Draft not found"})

    (lg_id, name, gender, growing, mobile,
     total, cotton, water, confirmed) = draft
    growing_cotton = None if growing is None else bool(growing)

    errors = check_farmer(name, gender, growing_cotton, mobile)
    land_errors, cotton = check_land(
        total, cotton, water, growing_cotton, bool(confirmed)
    )
    errors.update(land_errors)
    if errors:
        connection.close()
        raise HTTPException(status_code=400, detail=errors)

    if mobile != "":
        owner = mobile_owner(connection, user, mobile)
        if owner is not None:
            connection.close()
            raise HTTPException(status_code=400, detail={"mobile": owner})

    try:
        connection.execute(
            "UPDATE learning_groups SET last_farmer_number = last_farmer_number + 1 "
            "WHERE id = ?",
            (lg_id,),
        )
        number = connection.execute(
            "SELECT last_farmer_number FROM learning_groups WHERE id = ?", (lg_id,)
        ).fetchone()[0]

        cursor = connection.execute(
            """
            INSERT INTO farmers
                (lg_id, farmer_number, name, gender, growing_cotton, mobile,
                 total_landholding, area_under_cotton, water_regime,
                 registered_on)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (lg_id, number, name, gender, growing, mobile or None,
             round(total, 2), cotton, water, date.today().isoformat()),
        )
    except sqlite3.IntegrityError:
        # Two people saved the same mobile at the same moment: undo everything.
        connection.rollback()
        connection.close()
        raise HTTPException(
            status_code=400,
            detail={"mobile": "This mobile number is already used by another farmer"},
        )
    new_id = cursor.lastrowid
    connection.execute("DELETE FROM farmer_drafts WHERE id = ?", (draft_id,))
    connection.commit()

    code = connection.execute(
        """
        SELECT pus.code
            || '-' || printf('%03d', learning_groups.lg_number)
            || '-' || printf('%02d', farmers.farmer_number)
        FROM farmers
        JOIN learning_groups ON learning_groups.id = farmers.lg_id
        JOIN pus ON pus.id = learning_groups.pu_id
        WHERE farmers.id = ?
        """,
        (new_id,),
    ).fetchone()[0]
    connection.close()
    return {"id": new_id, "farmer_code": code}


class FarmerEdit(BaseModel):
    name: str = ""
    gender: str = ""
    growing_cotton: Optional[bool] = None
    mobile: str = ""
    total_landholding: Optional[float] = None
    area_under_cotton: Optional[float] = None
    water_regime: str = ""
    confirmed_large: bool = False
    reason: str = ""


@app.put("/farmers/{farmer_id}")
def edit_farmer(
    farmer_id: int, body: FarmerEdit, user: dict = Depends(current_user)
):
    name = " ".join(body.name.split())
    reason = " ".join(body.reason.split())
    mobile = body.mobile.strip()

    errors = check_farmer(name, body.gender, body.growing_cotton, mobile)
    if len(reason) > 200:
        errors["reason"] = "Reason is too long (at most 200 characters)"

    connection = sqlite3.connect("field.db")
    require_farmer(connection, user, farmer_id, True)
    old = connection.execute(
        "SELECT name, gender, growing_cotton, mobile, total_landholding, "
        "area_under_cotton, water_regime FROM farmers WHERE id = ?",
        (farmer_id,),
    ).fetchone()
    if old is None:
        connection.close()
        raise HTTPException(status_code=404, detail={"form": "Farmer not found"})

    land_errors, new_cotton_area = check_land(
        body.total_landholding, body.area_under_cotton, body.water_regime,
        body.growing_cotton, body.confirmed_large,
        old_total=old[4], old_cotton=old[5],
    )
    errors.update(land_errors)
    if errors:
        connection.close()
        raise HTTPException(status_code=400, detail=errors)
    new_total = round(body.total_landholding, 2)

    new_cotton = 1 if body.growing_cotton else 0
    changes = []
    if old[0] != name:
        changes.append(("Name", old[0], name))
    if old[1] != body.gender:
        changes.append(("Gender", old[1], body.gender))
    if old[2] != new_cotton:
        changes.append(
            ("Growing cotton", "Yes" if old[2] else "No", "Yes" if new_cotton else "No")
        )

    if (old[3] or "") != mobile:
        changes.append(("Mobile number", old[3] or "(none)", mobile or "(none)"))
    if old[4] is None or abs(old[4] - new_total) > 1e-9:
        changes.append(
            ("Total landholding (acres)", show_acres(old[4]), show_acres(new_total))
        )
    if old[5] is None or abs(old[5] - new_cotton_area) > 1e-9:
        changes.append(
            ("Area under cotton (acres)", show_acres(old[5]),
             show_acres(new_cotton_area))
        )
    if old[6] != body.water_regime:
        changes.append(("Water regime", old[6] or "(not recorded)", body.water_regime))

    if not changes:
        connection.close()
        raise HTTPException(status_code=400, detail={"form": "Nothing was changed"})

    if mobile != "" and (old[3] or "") != mobile:
        owner = mobile_owner(connection, user, mobile, farmer_id)
        if owner is not None:
            connection.close()
            raise HTTPException(status_code=400, detail={"mobile": owner})

    today = date.today().isoformat()
    try:
        connection.execute(
            "UPDATE farmers SET name = ?, gender = ?, growing_cotton = ?, "
            "mobile = ?, total_landholding = ?, area_under_cotton = ?, "
            "water_regime = ? WHERE id = ?",
            (name, body.gender, new_cotton, mobile or None, new_total,
             new_cotton_area, body.water_regime, farmer_id),
        )
    except sqlite3.IntegrityError:
        connection.rollback()
        connection.close()
        raise HTTPException(
            status_code=400,
            detail={"mobile": "This mobile number is already used by another farmer"},
        )
    for field, old_value, new_value in changes:
        connection.execute(
            """
            INSERT INTO farmer_change_log
                (farmer_id, field, old_value, new_value, changed_on, reason)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (farmer_id, field, old_value, new_value, today, reason),
        )
    connection.commit()
    connection.close()
    return {"message": "Saved"}


@app.get("/farmers/{farmer_id}/changes")
def farmer_changes(farmer_id: int, user: dict = Depends(current_user)):
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    require_farmer(connection, user, farmer_id)
    rows = connection.execute(
        """
        SELECT id, field, old_value, new_value, changed_on, reason
        FROM farmer_change_log
        WHERE farmer_id = ?
        ORDER BY id DESC
        """,
        (farmer_id,),
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


DROP_REASONS = [
    "Moved away",
    "No longer growing cotton",
    "Lost interest",
    "Health or family reasons",
    "Other",
]


class ParticipationChange(BaseModel):
    participation: str = ""
    reason: str = ""
    note: str = ""


PARTICIPATION_LABELS = {"continuing": "Continuing", "dropped_out": "Dropped out"}


def check_participation(participation, reason, note):
    errors = {}
    if participation not in PARTICIPATION_LABELS:
        errors["form"] = "Unknown participation status"
    if participation == "dropped_out" and reason not in DROP_REASONS:
        errors["reason"] = "Please choose a reason"
    if len(note) > 200:
        errors["note"] = "Note is too long (at most 200 characters)"
    return errors


def build_reason(participation, reason, note):
    text = reason if participation == "dropped_out" else ""
    if note:
        text = f"{text} - {note}" if text else note
    return text


@app.post("/farmers/{farmer_id}/participation")
def change_participation(
    farmer_id: int, body: ParticipationChange, user: dict = Depends(current_user)
):
    note = " ".join(body.note.split())
    errors = check_participation(body.participation, body.reason, note)
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    connection = sqlite3.connect("field.db")
    require_farmer(connection, user, farmer_id, True)
    row = connection.execute(
        "SELECT participation FROM farmers WHERE id = ?", (farmer_id,)
    ).fetchone()
    if row is None:
        connection.close()
        raise HTTPException(status_code=404, detail={"form": "Farmer not found"})
    if row[0] == body.participation:
        connection.close()
        raise HTTPException(
            status_code=400, detail={"form": "The farmer already has this status"}
        )

    reason = build_reason(body.participation, body.reason, note)

    connection.execute(
        "UPDATE farmers SET participation = ? WHERE id = ?",
        (body.participation, farmer_id),
    )
    connection.execute(
        """
        INSERT INTO farmer_change_log
            (farmer_id, field, old_value, new_value, changed_on, reason)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (farmer_id, "Participation", PARTICIPATION_LABELS[row[0]],
         PARTICIPATION_LABELS[body.participation], date.today().isoformat(), reason),
    )
    connection.commit()
    connection.close()
    return {"message": "Saved"}


class BulkParticipation(BaseModel):
    farmer_ids: List[int] = []
    participation: str = ""
    reason: str = ""
    note: str = ""


@app.post("/farmers/bulk-participation")
def bulk_participation(
    body: BulkParticipation, user: dict = Depends(current_user)
):
    note = " ".join(body.note.split())
    errors = check_participation(body.participation, body.reason, note)

    ids = list(set(body.farmer_ids))
    if len(ids) == 0:
        errors["form"] = "Select at least one farmer"
    elif len(ids) > 500:
        errors["form"] = "Too many farmers at once (at most 500)"
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    connection = sqlite3.connect("field.db")
    marks = ",".join("?" * len(ids))
    rows = connection.execute(
        f"SELECT id, participation FROM farmers WHERE id IN ({marks})", ids
    ).fetchall()
    if len(rows) != len(ids):
        connection.close()
        raise HTTPException(
            status_code=404, detail={"form": "Some of these farmers were not found"}
        )
    for farmer_id in ids:
        require_farmer(connection, user, farmer_id, True)

    to_change = [row for row in rows if row[1] != body.participation]
    if len(to_change) == 0:
        connection.close()
        raise HTTPException(
            status_code=400,
            detail={"form": "All selected farmers already have this status"},
        )

    reason = build_reason(body.participation, body.reason, note)
    today = date.today().isoformat()
    for farmer_id, old_status in to_change:
        connection.execute(
            "UPDATE farmers SET participation = ? WHERE id = ?",
            (body.participation, farmer_id),
        )
        connection.execute(
            """
            INSERT INTO farmer_change_log
                (farmer_id, field, old_value, new_value, changed_on, reason)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (farmer_id, "Participation", PARTICIPATION_LABELS[old_status],
             PARTICIPATION_LABELS[body.participation], today, reason),
        )
    connection.commit()
    connection.close()
    return {"changed": len(to_change), "skipped": len(rows) - len(to_change)}


class BulkReassign(BaseModel):
    lg_ids: List[int] = []
    new_ff_id: int = 0


@app.post("/lgs/bulk-reassign")
def bulk_reassign(body: BulkReassign, user: dict = Depends(current_user)):
    require_manager(user)
    ids = list(set(body.lg_ids))
    if len(ids) == 0:
        raise HTTPException(status_code=400, detail="Select at least one group")
    if len(ids) > 200:
        raise HTTPException(status_code=400, detail="Too many groups at once")

    connection = sqlite3.connect("field.db")
    ff = connection.execute(
        "SELECT id, pu_id, active FROM facilitators WHERE id = ?", (body.new_ff_id,)
    ).fetchone()
    if ff is None:
        connection.close()
        raise HTTPException(status_code=404, detail="Facilitator not found")
    if not ff[2]:
        fail(connection, 400, "That facilitator has left")

    marks = ",".join("?" * len(ids))
    groups = connection.execute(
        f"SELECT id, pu_id FROM learning_groups WHERE id IN ({marks})", ids
    ).fetchall()
    if len(groups) != len(ids):
        connection.close()
        raise HTTPException(status_code=404, detail="Some groups were not found")
    if ff[1] != user["pu_id"] or any(group[1] != user["pu_id"] for group in groups):
        fail(connection, 403, "You can only move groups inside your own PU")
    if any(group[1] != ff[1] for group in groups):
        connection.close()
        raise HTTPException(
            status_code=400,
            detail="That facilitator belongs to a different PU than some of the groups",
        )

    current = {}
    for assignment_id, lg_id, ff_id in connection.execute(
        f"""
        SELECT id, lg_id, ff_id FROM assignments
        WHERE end_date IS NULL AND lg_id IN ({marks})
        """,
        ids,
    ).fetchall():
        current[lg_id] = (assignment_id, ff_id)

    to_move = [lg_id for lg_id in ids if current.get(lg_id, (None, None))[1] != ff[0]]
    if len(to_move) == 0:
        connection.close()
        raise HTTPException(
            status_code=400,
            detail="All selected groups are already with that facilitator",
        )

    today = date.today().isoformat()
    for lg_id in to_move:
        if lg_id in current:
            connection.execute(
                "UPDATE assignments SET end_date = ? WHERE id = ?",
                (today, current[lg_id][0]),
            )
        connection.execute(
            "INSERT INTO assignments (lg_id, ff_id, start_date) VALUES (?, ?, ?)",
            (lg_id, ff[0], today),
        )
    connection.commit()
    connection.close()
    return {"moved": len(to_move), "skipped": len(ids) - len(to_move)}


@app.get("/ffs/summary")
def ff_summary(user: dict = Depends(current_user)):
    require_manager(user)
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        """
        SELECT
            facilitators.id,
            facilitators.name,
            pus.name AS pu_name,
            (SELECT COUNT(*) FROM assignments
             WHERE assignments.ff_id = facilitators.id
             AND assignments.end_date IS NULL) AS lg_count,
            (SELECT COUNT(*) FROM farmers
             JOIN assignments ON assignments.lg_id = farmers.lg_id
                 AND assignments.end_date IS NULL
             WHERE assignments.ff_id = facilitators.id
             AND farmers.participation = 'continuing') AS farmer_count
        FROM facilitators
        JOIN pus ON pus.id = facilitators.pu_id
        WHERE facilitators.pu_id = ? AND facilitators.active = 1
        ORDER BY pus.code, facilitators.name
        """,
        (user["pu_id"],),
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


@app.get("/ffs/{ff_id}/farmers")
def ff_farmers(ff_id: int, user: dict = Depends(current_user)):
    require_manager(user)
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row

    ff = connection.execute(
        "SELECT id, pu_id FROM facilitators WHERE id = ?", (ff_id,)
    ).fetchone()
    if ff is None:
        connection.close()
        raise HTTPException(status_code=404, detail="Facilitator not found")
    if ff[1] != user["pu_id"]:
        fail(connection, 403, "You do not have access to this facilitator")

    rows = connection.execute(
        """
        SELECT
            farmers.id,
            pus.code
                || '-' || printf('%03d', learning_groups.lg_number)
                || '-' || printf('%02d', farmers.farmer_number)
                AS farmer_code,
            pus.code
                || '-' || printf('%03d', learning_groups.lg_number)
                AS lg_code,
            villages.name AS village,
            farmers.name,
            farmers.gender,
            farmers.growing_cotton
        FROM farmers
        JOIN learning_groups ON learning_groups.id = farmers.lg_id
        JOIN pus ON pus.id = learning_groups.pu_id
        JOIN villages ON villages.id = learning_groups.village_id
        JOIN assignments ON assignments.lg_id = learning_groups.id
            AND assignments.end_date IS NULL
        WHERE assignments.ff_id = ?
        AND farmers.participation = 'continuing'
        ORDER BY pus.code, learning_groups.lg_number, farmers.farmer_number
        """,
        (ff_id,),
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


@app.get("/pu/facilitators")
def pu_facilitators(user: dict = Depends(current_user)):
    require_manager(user)
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        """
        SELECT
            facilitators.id,
            facilitators.name,
            facilitators.active,
            facilitators.left_on,
            (SELECT COUNT(*) FROM assignments
             WHERE assignments.ff_id = facilitators.id
             AND assignments.end_date IS NULL) AS lg_count,
            (SELECT COUNT(*) FROM farmers
             JOIN assignments ON assignments.lg_id = farmers.lg_id
                 AND assignments.end_date IS NULL
             WHERE assignments.ff_id = facilitators.id
             AND farmers.participation = 'continuing') AS farmer_count
        FROM facilitators
        WHERE facilitators.pu_id = ?
        ORDER BY facilitators.active DESC, facilitators.name
        """,
        (user["pu_id"],),
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


class NewFacilitator(BaseModel):
    name: str = ""


@app.post("/pu/facilitators")
def add_facilitator(body: NewFacilitator, user: dict = Depends(current_user)):
    require_manager(user)
    name = " ".join(body.name.split())

    message = name_error(name, "facilitator")
    if message:
        raise HTTPException(status_code=400, detail={"name": message})

    connection = sqlite3.connect("field.db")
    same = connection.execute(
        "SELECT id FROM facilitators WHERE pu_id = ? AND lower(name) = lower(?)",
        (user["pu_id"], name),
    ).fetchone()
    if same is not None:
        connection.close()
        raise HTTPException(
            status_code=400,
            detail={"name": "A facilitator with this name already exists in your PU"},
        )

    cursor = connection.execute(
        "INSERT INTO facilitators (name, pu_id) VALUES (?, ?)",
        (name, user["pu_id"]),
    )
    ff_id = cursor.lastrowid
    # The new facilitator also gets a demo sign-in.
    connection.execute(
        "INSERT INTO app_users (name, role, pu_id, ff_id) "
        "VALUES (?, 'facilitator', ?, ?)",
        (name, user["pu_id"], ff_id),
    )
    connection.commit()
    connection.close()
    return {"id": ff_id}


class LeaveAssignment(BaseModel):
    lg_id: int = 0
    new_ff_id: int = 0


class LeaveRequest(BaseModel):
    assignments: List[LeaveAssignment] = []


@app.post("/pu/facilitators/{ff_id}/leave")
def facilitator_leaves(
    ff_id: int, body: LeaveRequest, user: dict = Depends(current_user)
):
    require_manager(user)
    connection = sqlite3.connect("field.db")

    ff = connection.execute(
        "SELECT id, pu_id, active FROM facilitators WHERE id = ?", (ff_id,)
    ).fetchone()
    if ff is None:
        fail(connection, 404, "Facilitator not found", True)
    if ff[1] != user["pu_id"]:
        fail(connection, 403, "You do not have access to this facilitator", True)
    if not ff[2]:
        fail(connection, 400, "This facilitator is already marked as left", True)

    current = connection.execute(
        "SELECT id, lg_id FROM assignments WHERE ff_id = ? AND end_date IS NULL",
        (ff_id,),
    ).fetchall()
    current_by_lg = {lg_id: assignment_id for assignment_id, lg_id in current}

    chosen = {}
    for item in body.assignments:
        if item.lg_id in chosen:
            fail(connection, 400, "A group was listed twice", True)
        chosen[item.lg_id] = item.new_ff_id

    # Every group of this facilitator needs a new facilitator, no more, no less.
    if set(chosen) != set(current_by_lg):
        fail(
            connection,
            400,
            "Every learning group of this facilitator needs a new facilitator",
            True,
        )

    destinations = set(chosen.values())
    if ff_id in destinations:
        fail(connection, 400, "A group cannot stay with the facilitator who is leaving", True)
    if len(destinations) > 0:
        marks = ",".join("?" * len(destinations))
        found = connection.execute(
            f"""
            SELECT COUNT(*) FROM facilitators
            WHERE id IN ({marks}) AND pu_id = ? AND active = 1
            """,
            list(destinations) + [user["pu_id"]],
        ).fetchone()[0]
        if found != len(destinations):
            fail(
                connection,
                400,
                "Choose active facilitators from your own PU",
                True,
            )

    today = date.today().isoformat()
    for lg_id, new_ff_id in chosen.items():
        connection.execute(
            "UPDATE assignments SET end_date = ? WHERE id = ?",
            (today, current_by_lg[lg_id]),
        )
        connection.execute(
            "INSERT INTO assignments (lg_id, ff_id, start_date) VALUES (?, ?, ?)",
            (lg_id, new_ff_id, today),
        )
    connection.execute(
        "UPDATE facilitators SET active = 0, left_on = ? WHERE id = ?",
        (today, ff_id),
    )
    connection.commit()
    connection.close()
    return {"moved": len(chosen)}
