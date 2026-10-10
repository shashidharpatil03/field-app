import re
import sqlite3
import unicodedata
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from land_rules import check_draft_land, check_land, show_acres
from name_parts import build_name, clean, part_errors, parts_from

WATER_CHOICES = ["Rainfed", "Partially irrigated", "Fully irrigated"]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    # 5173 is the development copy of the app (npm run dev); 4173 is the
    # built copy (npm run preview) used to test offline.
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    # Also allow the app to be opened from a phone on the same home or office
    # Wi-Fi (private addresses only), for testing on a real device.
    allow_origin_regex=r"http://(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):(5173|4173)",
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


# The facilitator code, for example INMH01FF5: PU code, "FF", number.
FF_CODE_SQL = (
    "((SELECT pus.code FROM pus WHERE pus.id = facilitators.pu_id)"
    " || 'FF' || facilitators.ff_number)"
)


def require_manager(user):
    if user["role"] != "pu_manager":
        fail(None, 403, "Only the PU manager can do this")


def log_activity(connection, user, action, detail=""):
    """The audit trail: every change to the data records who made it and
    when. Called just before the change is committed."""
    connection.execute(
        "INSERT INTO activity_log (at, user_id, user_name, action, detail) "
        "VALUES (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), ?, ?, ?, ?)",
        (user["id"], user["name"], action, detail),
    )


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


def require_active_lg(connection, lg_id, form=False):
    row = connection.execute(
        "SELECT dropped_on FROM learning_groups WHERE id = ?", (lg_id,)
    ).fetchone()
    if row is not None and row[0] is not None:
        fail(connection, 400, "This learning group has been dropped", form)


def require_draft(connection, user, draft_id):
    row = connection.execute(
        "SELECT lg_id FROM farmer_drafts WHERE id = ?", (draft_id,)
    ).fetchone()
    if row is None:
        fail(connection, 404, "Draft not found", True)
    require_lg(connection, user, row[0], True)
    return row[0]


def season_start(today):
    """The cotton season starts on 1 May every year."""
    this_year = date(today.year, 5, 1)
    return this_year if today >= this_year else date(today.year - 1, 5, 1)


def season_label(start):
    """'2026-27' for the season that starts on 1 May 2026."""
    return f"{start.year}-{(start.year + 1) % 100:02d}"


LG_RESTORE_TAG = "Learning group brought back"


def season_sql(start):
    """SQL pieces describing where each farmer stands in this season.

    Each entry is (sql, values) and is written to be used inside a query
    that has the `farmers` table:
      new        registered since the season began (still participating)
      continued  registered earlier, still participating, and confirmed or
                 edited since the season began
      dropped    registered earlier and dropped out since the season began
      to_update  registered earlier, still participating, not yet updated
      cohort     all farmers registered earlier who were still in the
                 programme when the season began
                 (continued + dropped + to_update)
      this_year  the farmers whose details are up to date for this season
                 (continued + new)

    A farmer whose learning group was dropped and brought back must be
    confirmed or edited again, so earlier updates (before the bring-back)
    are ignored. That includes farmers added this season: after a
    bring-back they count like last year's farmers and show as still to
    update until someone confirms them.
    """
    last_restore = (
        "(SELECT MAX(r.id) FROM farmer_change_log r "
        "WHERE r.farmer_id = farmers.id AND r.field = 'Participation' "
        f"AND r.reason = '{LG_RESTORE_TAG}')"
    )
    restored = (
        "EXISTS (SELECT 1 FROM farmer_change_log b "
        "WHERE b.farmer_id = farmers.id AND b.field = 'Participation' "
        f"AND b.reason = '{LG_RESTORE_TAG}' AND b.changed_on >= ?)"
    )
    dropped_since = (
        "EXISTS (SELECT 1 FROM farmer_change_log d "
        "WHERE d.farmer_id = farmers.id AND d.field = 'Participation' "
        "AND d.new_value = 'Dropped out' AND d.changed_on >= ?)"
    )
    changed_since = (
        "EXISTS (SELECT 1 FROM farmer_change_log e "
        "WHERE e.farmer_id = farmers.id AND e.field != 'Participation' "
        f"AND e.changed_on >= ? AND e.id > COALESCE({last_restore}, 0))"
    )
    earlier = f"(farmers.registered_on < ? OR {restored})"
    new_sql = (
        f"(farmers.registered_on >= ? AND NOT {restored} "
        "AND farmers.participation = 'continuing')"
    )
    continued_sql = (
        f"({earlier} AND farmers.participation = 'continuing' "
        f"AND {changed_since})"
    )
    pieces = {
        "new": new_sql,
        "continued": continued_sql,
        "dropped": (
            f"({earlier} AND farmers.participation = 'dropped_out' "
            f"AND {dropped_since})"
        ),
        "to_update": (
            f"({earlier} AND farmers.participation = 'continuing' "
            f"AND NOT {changed_since})"
        ),
        "cohort": (
            f"({earlier} AND (farmers.participation = 'continuing' "
            f"OR {dropped_since}))"
        ),
        "this_year": f"({continued_sql} OR {new_sql})",
    }
    # Every placeholder is the season start, so count them instead of
    # keeping a separate list in step by hand.
    return {key: (sql, [start] * sql.count("?")) for key, sql in pieces.items()}


@app.get("/ping")
def ping():
    """So the phone can tell 'the server is reachable' from 'no signal'."""
    return {"ok": True}


def deletable_lg_ids(connection):
    """Groups created this season. Every farmer in them was registered this
    season too, so nothing from an earlier season depends on them. Only
    these can be deleted; older groups can only be dropped."""
    start = season_start(date.today()).isoformat()
    rows = connection.execute(
        "SELECT id FROM learning_groups WHERE created_on >= ? "
        "AND dropped_on IS NULL",
        (start,),
    ).fetchall()
    return {row[0] for row in rows}


@app.get("/lgs")
def list_lgs(user: dict = Depends(current_user)):
    parts = season_sql(season_start(date.today()).isoformat())
    cohort_sql, cohort_values = parts["cohort"]
    continued_sql, continued_values = parts["continued"]
    dropped_sql, dropped_values = parts["dropped"]
    new_sql, new_values = parts["new"]
    todo_sql, todo_values = parts["to_update"]
    this_sql, this_values = parts["this_year"]
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    rows = connection.execute(f"""
        SELECT
            learning_groups.id,
            learning_groups.pu_id,
            learning_groups.created_on,
            learning_groups.dropped_on,
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
            (SELECT COUNT(*) FROM farmers
             WHERE farmers.lg_id = learning_groups.id
             AND {cohort_sql}) AS season_total,
            (SELECT COUNT(*) FROM farmers
             WHERE farmers.lg_id = learning_groups.id
             AND ({continued_sql} OR {dropped_sql})) AS season_done,
            (SELECT COUNT(*) FROM farmers
             WHERE farmers.lg_id = learning_groups.id
             AND {continued_sql}) AS season_continued,
            (SELECT COUNT(*) FROM farmers
             WHERE farmers.lg_id = learning_groups.id
             AND {dropped_sql}) AS season_dropped,
            (SELECT COUNT(*) FROM farmers
             WHERE farmers.lg_id = learning_groups.id
             AND {new_sql}) AS new_count,
            (SELECT COUNT(*) FROM farmers
             WHERE farmers.lg_id = learning_groups.id
             AND {todo_sql}) AS to_update_count,
            (SELECT COUNT(*) FROM farmers
             WHERE farmers.lg_id = learning_groups.id
             AND {this_sql}) AS season_farmers,
            facilitators.id AS ff_id,
            facilitators.name AS ff_name,
            {FF_CODE_SQL} AS ff_code
        FROM learning_groups
        JOIN pus ON pus.id = learning_groups.pu_id
        JOIN villages ON villages.id = learning_groups.village_id
        LEFT JOIN assignments
            ON assignments.lg_id = learning_groups.id
            AND assignments.end_date IS NULL
        LEFT JOIN facilitators
            ON facilitators.id = assignments.ff_id
        WHERE ((? = 'pu_manager' AND learning_groups.pu_id = ?)
           OR (? = 'facilitator' AND assignments.ff_id = ?))
        ORDER BY pus.code, learning_groups.lg_number
    """, cohort_values + continued_values + dropped_values
        + continued_values + dropped_values + new_values
        + todo_values + this_values
        + [user["role"], user["pu_id"], user["role"], user["ff_id"]]).fetchall()
    deletable = deletable_lg_ids(connection)
    connection.close()
    start = season_start(date.today()).isoformat()
    result = []
    for row in rows:
        lg = dict(row)
        lg["can_delete"] = lg["id"] in deletable
        # Made this season (no farmers from last year), so it is flagged as
        # new. A dropped group is still listed, so its farmers can be seen
        # under "Dropped out" in last year's view.
        lg["is_new"] = bool(lg["created_on"] and lg["created_on"] >= start)
        result.append(lg)
    return result

@app.get("/users")
def list_users():
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        f"""
        SELECT app_users.id, app_users.name, app_users.role, pus.name AS pu_name,
               CASE WHEN app_users.ff_id IS NULL THEN NULL
                    ELSE {FF_CODE_SQL} END AS ff_code
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
        f"""
        SELECT id, name, pu_id, {FF_CODE_SQL} AS ff_code FROM facilitators
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
    require_active_lg(connection, lg_id)
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
    log_activity(connection, user, "Group moved", f"Group {lg_id} to facilitator {body.new_ff_id}")
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


def deleted_farmer_list(lg_id, q, limit, offset, user):
    """Farmers deleted because they were added by mistake. Read-only: they
    have no profile. A manager sees the whole PU, a facilitator only the
    groups still assigned to them."""
    conditions = []
    values = []
    if user["role"] == "pu_manager":
        conditions.append(
            "deleted_farmers.farmer_code LIKE "
            "(SELECT code FROM pus WHERE id = ?) || '-%'"
        )
        values.append(user["pu_id"])
    else:
        conditions.append(
            "deleted_farmers.lg_id IN (SELECT lg_id FROM assignments "
            "WHERE ff_id = ? AND end_date IS NULL)"
        )
        values.append(user["ff_id"])
    if lg_id is not None:
        conditions.append("deleted_farmers.lg_id = ?")
        values.append(lg_id)
    text = q.strip()
    if text != "":
        pattern = like_pattern(text)
        conditions.append(
            "(deleted_farmers.name LIKE ? ESCAPE '\\' "
            "OR deleted_farmers.mobile LIKE ? ESCAPE '\\' "
            "OR deleted_farmers.farmer_code LIKE ? ESCAPE '\\')"
        )
        values.extend([pattern, pattern, pattern])
    where = " AND ".join(conditions)
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    total = connection.execute(
        f"SELECT COUNT(*) FROM deleted_farmers WHERE {where}", values
    ).fetchone()[0]
    rows = connection.execute(
        f"""
        SELECT -deleted_farmers.id AS id, deleted_farmers.farmer_code,
               deleted_farmers.name, deleted_farmers.gender,
               deleted_farmers.growing_cotton,
               'deleted' AS participation, deleted_farmers.mobile,
               deleted_farmers.lg_id,
               substr(deleted_farmers.farmer_code, 1,
                      length(deleted_farmers.farmer_code) - 3) AS lg_code,
               '' AS village, 'deleted' AS season_status,
               deleted_farmers.deleted_on, deleted_farmers.reason
        FROM deleted_farmers WHERE {where}
        ORDER BY deleted_farmers.deleted_on DESC, deleted_farmers.farmer_code
        LIMIT ? OFFSET ?
        """,
        values + [limit, offset],
    ).fetchall()
    connection.close()
    return {"total": total, "items": [dict(row) for row in rows]}


@app.get("/farmers")
def search_farmers(
    lg_id: Optional[int] = None,
    village_id: Optional[int] = None,
    ff_id: Optional[int] = None,
    q: str = "",
    status: str = "continuing",
    gender: Optional[str] = None,
    growing: Optional[str] = None,
    water: Optional[str] = None,
    season: Optional[str] = None,
    limit: int = 40,
    offset: int = 0,
    user: dict = Depends(current_user),
):
    """The farmer list. Always limited to what this person may see, then
    narrowed by the filters. Returns one page at a time, so a slow phone
    never has to download hundreds of farmers at once."""
    if status not in ("continuing", "dropped_out", "all", "deleted"):
        fail(None, 400, "Unknown status")
    if gender is not None and gender not in ALLOWED_GENDERS:
        fail(None, 400, "Unknown gender")
    if growing not in (None, "yes", "no"):
        fail(None, 400, "Unknown value for growing")
    if water is not None and water not in WATER_CHOICES + ["none"]:
        fail(None, 400, "Unknown water regime")
    # One or several continuity values, e.g. "continued,to_update".
    season_keys = [part for part in (season or "").split(",") if part != ""]
    for key in season_keys:
        if key not in ("new", "continued", "dropped", "to_update", "this_year"):
            fail(None, 400, "Unknown season filter")
    if season_keys:
        season = ",".join(season_keys)
    else:
        season = None
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    if status == "deleted" and season is None:
        return deleted_farmer_list(lg_id, q, limit, offset, user)

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
    if gender is not None:
        conditions.append("farmers.gender = ?")
        values.append(gender)
    if growing is not None:
        conditions.append("farmers.growing_cotton = ?")
        values.append(1 if growing == "yes" else 0)
    if water == "none":
        conditions.append("farmers.water_regime IS NULL")
    elif water is not None:
        conditions.append("farmers.water_regime = ?")
        values.append(water)
    if season is not None:
        # The season filters already say who is still in or out.
        parts = season_sql(season_start(date.today()).isoformat())
        pieces = []
        for key in season_keys:
            pieces.append(f"({parts[key][0]})")
            values.extend(parts[key][1])
        conditions.append("(" + " OR ".join(pieces) + ")")
    elif status != "all":
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

    status_sql = season_sql(season_start(date.today()).isoformat())
    status_values = []
    for key in ("new", "continued", "dropped", "to_update"):
        status_values.extend(status_sql[key][1])

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
            villages.name AS village,
            CASE
                WHEN {status_sql["new"][0]} THEN 'new'
                WHEN {status_sql["continued"][0]} THEN 'continued'
                WHEN {status_sql["dropped"][0]} THEN 'dropped'
                WHEN {status_sql["to_update"][0]} THEN 'to_update'
                ELSE 'none'
            END AS season_status
        {source}
        WHERE {where}
        ORDER BY learning_groups.lg_number, farmers.farmer_number
        LIMIT ? OFFSET ?
        """,
        status_values + values + [limit, offset],
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


def weekly_progress(connection, from_sql, scope, parts, first_day, cohort):
    """Week by week since the season began: how many farmers were updated
    that week (continued + new + dropped out, added into one number) and how
    many of last season's farmers were still to update at the end of it.
    A farmer counts in the week of their first update this season (a new
    farmer: the week they were registered)."""
    start = first_day.isoformat()
    today = date.today()
    week_count = (today - first_day).days // 7 + 1
    updated = [0] * week_count
    cleared = [0] * week_count  # last season's farmers done that week
    restore_part = (
        "COALESCE((SELECT MAX(r.id) FROM farmer_change_log r "
        "WHERE r.farmer_id = farmers.id AND r.field = 'Participation' "
        "AND r.reason = ?), 0)"
    )
    kinds = {
        "new": ("farmers.registered_on", [], False),
        "continued": (
            "(SELECT MIN(e.changed_on) FROM farmer_change_log e "
            "WHERE e.farmer_id = farmers.id AND e.field != 'Participation' "
            f"AND e.changed_on >= ? AND e.id > {restore_part})",
            [start, LG_RESTORE_TAG],
            True,
        ),
        "dropped": (
            "(SELECT MIN(d.changed_on) FROM farmer_change_log d "
            "WHERE d.farmer_id = farmers.id AND d.field = 'Participation' "
            "AND d.new_value = 'Dropped out' AND d.changed_on >= ?)",
            [start],
            True,
        ),
    }
    for key, (date_sql, date_values, from_last_season) in kinds.items():
        sql, values = parts[key]
        rows = connection.execute(
            "SELECT " + date_sql + " " + from_sql + " AND " + sql,
            date_values + scope + values,
        ).fetchall()
        for (day,) in rows:
            # No date on record (should not happen): count it as today.
            when = date.fromisoformat(day[:10]) if day else today
            week = min(max((when - first_day).days // 7, 0), week_count - 1)
            updated[week] += 1
            if from_last_season:
                cleared[week] += 1
    weeks = []
    still = cohort
    for week in range(week_count):
        still -= cleared[week]
        weeks.append(
            {
                "from": (first_day + timedelta(days=7 * week)).isoformat(),
                "updated": updated[week],
                "still_to_update": still,
            }
        )
    return weeks


def progress_by_facilitator(connection, from_sql, scope, parts):
    """For each facilitator now looking after groups: farmers updated this
    season (continued + new + dropped out) and farmers still to update.
    Farmers count under whoever has their group now, so when a group moves
    to another facilitator its farmers move with it."""
    people = {}
    for key, field in (
        ("new", "updated"),
        ("continued", "updated"),
        ("dropped", "updated"),
        ("to_update", "still_to_update"),
    ):
        sql, values = parts[key]
        rows = connection.execute(
            "SELECT assignments.ff_id, COUNT(*) "
            + from_sql
            + " AND assignments.ff_id IS NOT NULL AND "
            + sql
            + " GROUP BY assignments.ff_id",
            scope + values,
        ).fetchall()
        for ff_id, number in rows:
            row = people.setdefault(
                ff_id, {"ff_id": ff_id, "updated": 0, "still_to_update": 0}
            )
            row[field] += number
    for ff_id, row in people.items():
        row["name"] = connection.execute(
            "SELECT name FROM facilitators WHERE id = ?", (ff_id,)
        ).fetchone()[0]
    return sorted(people.values(), key=lambda row: row["name"])


@app.get("/farmers/dashboard")
def farmers_dashboard(
    lg_id: Optional[int] = None,
    village_id: Optional[int] = None,
    ff_id: Optional[int] = None,
    user: dict = Depends(current_user),
):
    """The figures for everything this person can see, or only for one
    learning group, village or facilitator when those are given."""
    scope = [user["role"], user["pu_id"], user["role"], user["ff_id"]]
    from_sql = DASHBOARD_FROM
    if lg_id is not None:
        from_sql += " AND farmers.lg_id = ?"
        scope.append(lg_id)
    if village_id is not None:
        from_sql += " AND learning_groups.village_id = ?"
        scope.append(village_id)
    if ff_id is not None:
        from_sql += " AND assignments.ff_id = ?"
        scope.append(ff_id)
    first_day = season_start(date.today())
    start = first_day.isoformat()
    parts = season_sql(start)
    connection = sqlite3.connect("field.db")

    def count(key):
        sql, values = parts[key]
        return connection.execute(
            "SELECT COUNT(*) " + from_sql + " AND " + sql,
            scope + values,
        ).fetchone()[0]

    # The figures about this season's farmers (continued + new). Farmers
    # who still have last season's details are not counted in them yet.
    sql, values = parts["this_year"]
    total, growing, women, men, area, land, rainfed, partial, full, unknown = (
        connection.execute(
        """
        SELECT COUNT(*),
               COALESCE(SUM(farmers.growing_cotton), 0),
               COALESCE(SUM(farmers.gender = 'Female'), 0),
               COALESCE(SUM(farmers.gender = 'Male'), 0),
               COALESCE(SUM(farmers.area_under_cotton), 0),
               COALESCE(SUM(farmers.total_landholding), 0),
               COALESCE(SUM(farmers.water_regime = 'Rainfed'), 0),
               COALESCE(SUM(farmers.water_regime = 'Partially irrigated'), 0),
               COALESCE(SUM(farmers.water_regime = 'Fully irrigated'), 0),
               COALESCE(SUM(farmers.water_regime IS NULL), 0)
        """
        + from_sql
        + " AND "
        + sql,
        scope + values,
    ).fetchone())

    result = {
        "season": {"start": start, "label": season_label(first_day)},
        "this_year": {
            "total": total,
            "continued": count("continued"),
            "new": count("new"),
            "growing_cotton": growing,
            "women": women,
            "men": men,
            "other_gender": total - women - men,
            "not_growing": total - growing,
            "water": {
                "Rainfed": rainfed,
                "Partially irrigated": partial,
                "Fully irrigated": full,
                "none": unknown,
            },
            "area_under_cotton": round(area, 1),
            "total_landholding": round(land, 1),
        },
        "last_year": {
            "total": count("cohort"),
            "continued": count("continued"),
            "dropped": count("dropped"),
            "to_update": count("to_update"),
        },
        "weekly": weekly_progress(
            connection, from_sql, scope, parts, first_day, count("cohort")
        ),
    }
    # Only the manager sees the facilitator chart, and it makes no sense
    # for a single facilitator.
    if user["role"] == "pu_manager" and ff_id is None:
        result["by_ff"] = progress_by_facilitator(
            connection, from_sql, scope, parts
        )
    connection.close()
    return result


def registered_this_season(connection, farmer_id):
    row = connection.execute(
        "SELECT registered_on FROM farmers WHERE id = ?", (farmer_id,)
    ).fetchone()
    start = season_start(date.today()).isoformat()
    if row is None or row[0] is None or row[0] < start:
        return False
    # After its group is brought back, a farmer added this season is treated
    # like last year's farmers: confirmed or dropped, no longer deleted.
    restored = connection.execute(
        "SELECT 1 FROM farmer_change_log WHERE farmer_id = ? "
        "AND field = 'Participation' AND reason = ? LIMIT 1",
        (farmer_id, LG_RESTORE_TAG),
    ).fetchone()
    return restored is None


def season_status(connection, farmer_id):
    """'new', 'continued', 'dropped', 'to_update', or 'none' (not part of this
    season's update, for example dropped out in an earlier season)."""
    parts = season_sql(season_start(date.today()).isoformat())
    keys = ["new", "continued", "dropped", "to_update"]
    sql = ", ".join(parts[key][0] for key in keys)
    values = []
    for key in keys:
        values.extend(parts[key][1])
    row = connection.execute(
        f"SELECT {sql} FROM farmers WHERE farmers.id = ?", values + [farmer_id]
    ).fetchone()
    for key, flag in zip(keys, row):
        if flag:
            return key
    return "none"


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
            farmers.first_name,
            farmers.middle_name,
            farmers.last_name,
            farmers.gender,
            farmers.growing_cotton,
            farmers.mobile,
            farmers.participation,
            farmers.total_landholding,
            farmers.area_under_cotton,
            farmers.water_regime,
            farmers.registered_on,
            (SELECT app_users.name FROM app_users
              WHERE app_users.id = farmers.registered_by)
                AS registered_by_name,
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
    if row is None:
        connection.close()
        raise HTTPException(status_code=404, detail="Farmer not found")
    farmer = dict(row)
    farmer["season_status"] = season_status(connection, farmer_id)
    connection.close()
    return farmer

ALLOWED_GENDERS = ["Female", "Male", "Other"]


class DraftBody(BaseModel):
    first_name: str = ""
    middle_name: str = ""
    last_name: str = ""
    name: str = ""  # only from older requests; the parts are used when given
    gender: str = ""
    growing_cotton: Optional[bool] = None
    mobile: str = ""
    total_landholding: Optional[float] = None
    area_under_cotton: Optional[float] = None
    water_regime: str = ""
    confirmed_large: bool = False
    # Made by the phone once per registration, so a resend can be recognised.
    client_id: str = ""


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


def check_farmer(first, middle, last, gender, growing_cotton, mobile=""):
    """Checks the personal answers. The land answers use check_land()."""
    errors = part_errors(first, middle, last)

    if gender not in ALLOWED_GENDERS:
        errors["gender"] = "Please choose a gender"

    if growing_cotton is None:
        errors["growing_cotton"] = "Please choose Yes or No"

    # Mobile is optional: empty is fine, but if given it must be 10 digits.
    if mobile != "" and not re.fullmatch(r"[0-9]{10}", mobile):
        errors["mobile"] = "Mobile number must be exactly 10 digits"

    return errors


def check_draft(first, middle, last, gender, mobile="", total=None,
                cotton=None, water=""):
    errors = check_draft_land(total, cotton, water)
    if mobile != "" and not re.fullmatch(r"[0-9]{1,10}", mobile):
        errors["mobile"] = "Mobile number can only have digits (up to 10)"
    errors.update(part_errors(first, middle, last, strict=False))
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


@app.get("/drafts")
def all_my_drafts(user: dict = Depends(current_user)):
    """Every unfinished form this person can see, newest first."""
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        """
        SELECT farmer_drafts.id, farmer_drafts.lg_id, farmer_drafts.name,
               farmer_drafts.first_name, farmer_drafts.middle_name,
               farmer_drafts.last_name, farmer_drafts.gender, farmer_drafts.growing_cotton,
               farmer_drafts.mobile, farmer_drafts.total_landholding,
               farmer_drafts.area_under_cotton, farmer_drafts.water_regime,
               farmer_drafts.confirmed_large, farmer_drafts.client_id,
               farmer_drafts.updated_at,
               pus.code || '-' || printf('%03d', learning_groups.lg_number)
                   AS lg_code,
               villages.name AS village
        FROM farmer_drafts
        JOIN learning_groups ON learning_groups.id = farmer_drafts.lg_id
        JOIN pus ON pus.id = learning_groups.pu_id
        JOIN villages ON villages.id = learning_groups.village_id
        LEFT JOIN assignments
            ON assignments.lg_id = farmer_drafts.lg_id
            AND assignments.end_date IS NULL
        WHERE ((? = 'pu_manager' AND learning_groups.pu_id = ?)
            OR (? = 'facilitator' AND assignments.ff_id = ?))
        ORDER BY farmer_drafts.updated_at DESC, farmer_drafts.id DESC
        """,
        [user["role"], user["pu_id"], user["role"], user["ff_id"]],
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


@app.get("/sent")
def sent_updates(user: dict = Depends(current_user)):
    """The forms submitted this season, newest first: one entry per farmer
    per day (an update or a registration), with who did it and when. A
    manager sees the whole PU, a facilitator only their own."""
    start = season_start(date.today()).isoformat()
    status_sql = season_sql(start)
    status_values = []
    for key in ("new", "continued", "dropped", "to_update"):
        status_values.extend(status_sql[key][1])
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        f"""
        WITH events AS (
            SELECT l.farmer_id, l.changed_on AS day, l.changed_at AS at,
                   l.changed_by AS by_id
            FROM farmer_change_log l
            WHERE l.id IN (
                SELECT MAX(r.id) FROM farmer_change_log r
                WHERE r.changed_on >= ?
                  AND r.reason NOT LIKE 'Learning group%'
                GROUP BY r.farmer_id, r.changed_on)
            UNION ALL
            SELECT f.id, f.registered_on, f.registered_at, f.registered_by
            FROM farmers f
            WHERE f.registered_on >= ?
              AND NOT EXISTS (
                  SELECT 1 FROM farmer_change_log r
                  WHERE r.farmer_id = f.id AND r.changed_on = f.registered_on
                    AND r.reason NOT LIKE 'Learning group%')
        )
        SELECT
            farmers.id,
            {FARMER_CODE_SQL} AS farmer_code,
            farmers.name,
            villages.name AS village,
            events.day AS sent_on,
            events.at AS sent_at,
            (SELECT app_users.name FROM app_users
              WHERE app_users.id = events.by_id) AS by_name,
            CASE
                WHEN {status_sql["new"][0]} THEN 'new'
                WHEN {status_sql["continued"][0]} THEN 'continued'
                WHEN {status_sql["dropped"][0]} THEN 'dropped'
                WHEN {status_sql["to_update"][0]} THEN 'to_update'
                ELSE 'none'
            END AS season_status
        FROM events
        JOIN farmers ON farmers.id = events.farmer_id
        JOIN learning_groups ON learning_groups.id = farmers.lg_id
        JOIN pus ON pus.id = learning_groups.pu_id
        JOIN villages ON villages.id = learning_groups.village_id
        LEFT JOIN assignments
            ON assignments.lg_id = farmers.lg_id
            AND assignments.end_date IS NULL
        WHERE ((? = 'pu_manager' AND learning_groups.pu_id = ?)
            OR (? = 'facilitator' AND assignments.ff_id = ?
                AND (events.by_id IS NULL OR events.by_id = ?)))
        ORDER BY events.day DESC, COALESCE(events.at, '') DESC, farmers.id DESC
        LIMIT 500
        """,
        [start, start]
        + status_values
        + [user["role"], user["pu_id"], user["role"], user["ff_id"], user["id"]],
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


@app.get("/sync/snapshot")
def sync_snapshot(user: dict = Depends(current_user)):
    """Everything one person needs to keep working without signal: their
    groups, farmers (with each farmer's change history), unfinished forms
    and the list of what was sent. The phone keeps this copy and answers
    the app's questions from it. One call, so a slow connection only has
    to be good once."""
    first_day = season_start(date.today())
    status_sql = season_sql(first_day.isoformat())
    status_values = []
    for key in ("new", "continued", "dropped", "to_update"):
        status_values.extend(status_sql[key][1])
    scope = """((? = 'pu_manager' AND learning_groups.pu_id = ?)
        OR (? = 'facilitator' AND assignments.ff_id = ?))"""
    scope_values = [user["role"], user["pu_id"], user["role"], user["ff_id"]]
    joins = """
        FROM farmers
        JOIN learning_groups ON learning_groups.id = farmers.lg_id
        JOIN pus ON pus.id = learning_groups.pu_id
        JOIN villages ON villages.id = learning_groups.village_id
        LEFT JOIN assignments
            ON assignments.lg_id = farmers.lg_id
            AND assignments.end_date IS NULL
        LEFT JOIN facilitators ON facilitators.id = assignments.ff_id
    """
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    farmers = connection.execute(
        f"""
        SELECT
            farmers.id,
            {FARMER_CODE_SQL} AS farmer_code,
            pus.code || '-' || printf('%03d', learning_groups.lg_number)
                AS lg_code,
            learning_groups.lg_number,
            farmers.farmer_number,
            farmers.lg_id,
            farmers.name,
            farmers.first_name,
            farmers.middle_name,
            farmers.last_name,
            farmers.gender,
            farmers.growing_cotton,
            farmers.mobile,
            farmers.participation,
            farmers.total_landholding,
            farmers.area_under_cotton,
            farmers.water_regime,
            farmers.registered_on,
            (SELECT app_users.name FROM app_users
              WHERE app_users.id = farmers.registered_by)
                AS registered_by_name,
            villages.id AS village_id,
            villages.name AS village,
            pus.name AS pu_name,
            facilitators.name AS ff_name,
            CASE
                WHEN {status_sql["new"][0]} THEN 'new'
                WHEN {status_sql["continued"][0]} THEN 'continued'
                WHEN {status_sql["dropped"][0]} THEN 'dropped'
                WHEN {status_sql["to_update"][0]} THEN 'to_update'
                ELSE 'none'
            END AS season_status
        {joins}
        WHERE {scope}
        ORDER BY learning_groups.lg_number, farmers.farmer_number
        """,
        status_values + scope_values,
    ).fetchall()
    change_rows = connection.execute(
        f"""
        SELECT farmer_id, id, field, old_value, new_value, changed_on,
               changed_at, reason,
               (SELECT app_users.name FROM app_users
                 WHERE app_users.id = farmer_change_log.changed_by)
                   AS changed_by_name
        FROM farmer_change_log
        WHERE farmer_id IN (SELECT farmers.id {joins} WHERE {scope})
        ORDER BY id DESC
        """,
        scope_values,
    ).fetchall()
    connection.close()

    changes = {}
    for row in change_rows:
        entry = dict(row)
        farmer_id = entry.pop("farmer_id")
        changes.setdefault(str(farmer_id), []).append(entry)

    return {
        "server_time": datetime.now().isoformat(timespec="seconds"),
        "role": user["role"],
        "season": {
            "start": first_day.isoformat(),
            "label": season_label(first_day),
        },
        "lgs": list_lgs(user),
        "farmers": [dict(row) for row in farmers],
        "changes": changes,
        "drafts": all_my_drafts(user),
        "sent": sent_updates(user),
    }


@app.get("/lgs/{lg_id}/drafts")
def list_drafts(lg_id: int, user: dict = Depends(current_user)):
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    require_lg(connection, user, lg_id)
    rows = connection.execute(
        """
        SELECT id, name, first_name, middle_name, last_name, gender,
               growing_cotton, mobile, total_landholding,
               area_under_cotton, water_regime, confirmed_large, client_id,
               updated_at
        FROM farmer_drafts
        WHERE lg_id = ?
        ORDER BY updated_at DESC, id DESC
        """,
        (lg_id,),
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


def clean_client_id(text):
    """The phone's number for one registration: 16 to 64 letters and digits,
    or None when it is missing or does not look right."""
    text = (text or "").strip()
    if 16 <= len(text) <= 64 and text.isalnum():
        return text
    return None


@app.post("/lgs/{lg_id}/drafts")
def create_draft(lg_id: int, body: DraftBody, user: dict = Depends(current_user)):
    first, middle, last = parts_from(
        body.first_name, body.middle_name, body.last_name, body.name
    )
    mobile = body.mobile.strip()
    errors = check_draft(
        first, middle, last, body.gender, mobile,
        body.total_landholding, body.area_under_cotton, body.water_regime,
    )
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    connection = sqlite3.connect("field.db")
    require_lg(connection, user, lg_id, True)
    require_active_lg(connection, lg_id, True)

    client_id = clean_client_id(body.client_id)
    if client_id is not None:
        # The phone is sending this form again (the reply was lost): keep
        # the draft it already made, with the newest answers.
        earlier = connection.execute(
            "SELECT id FROM farmer_drafts WHERE client_id = ?", (client_id,)
        ).fetchone()
        if earlier is not None:
            connection.close()
            return update_draft(earlier[0], body, user)
        done = connection.execute(
            "SELECT 1 FROM farmers WHERE client_id = ?", (client_id,)
        ).fetchone()
        if done is not None:
            connection.close()
            raise HTTPException(
                status_code=409,
                detail={"form": "This farmer was already registered."},
            )

    growing = None if body.growing_cotton is None else int(body.growing_cotton)
    cursor = connection.execute(
        """
        INSERT INTO farmer_drafts
            (lg_id, name, first_name, middle_name, last_name, gender,
             growing_cotton, mobile, total_landholding,
             area_under_cotton, water_regime, confirmed_large, client_id,
             updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (lg_id, build_name(first, middle, last), first, middle, last,
         body.gender, growing, mobile,
         body.total_landholding, body.area_under_cotton, body.water_regime,
         int(body.confirmed_large), client_id,
         datetime.now().isoformat(timespec="seconds")),
    )
    new_id = cursor.lastrowid
    log_activity(connection, user, "Draft saved", f"Group {lg_id}")
    connection.commit()
    connection.close()
    return {"id": new_id}


@app.put("/drafts/{draft_id}")
def update_draft(draft_id: int, body: DraftBody, user: dict = Depends(current_user)):
    first, middle, last = parts_from(
        body.first_name, body.middle_name, body.last_name, body.name
    )
    mobile = body.mobile.strip()
    errors = check_draft(
        first, middle, last, body.gender, mobile,
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
        SET name = ?, first_name = ?, middle_name = ?, last_name = ?,
            gender = ?, growing_cotton = ?, mobile = ?,
            total_landholding = ?, area_under_cotton = ?, water_regime = ?,
            confirmed_large = ?, updated_at = ?,
            client_id = COALESCE(client_id, ?)
        WHERE id = ?
        """,
        (build_name(first, middle, last), first, middle, last,
         body.gender, growing, mobile,
         body.total_landholding, body.area_under_cotton, body.water_regime,
         int(body.confirmed_large),
         datetime.now().isoformat(timespec="seconds"),
         clean_client_id(body.client_id), draft_id),
    )
    log_activity(connection, user, "Draft changed", f"Draft {draft_id}")
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
    log_activity(connection, user, "Draft deleted", f"Draft {draft_id}")
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
        "SELECT lg_id, first_name, middle_name, last_name, name, gender, "
        "growing_cotton, mobile, total_landholding, area_under_cotton, "
        "water_regime, confirmed_large, client_id "
        "FROM farmer_drafts WHERE id = ?",
        (draft_id,),
    ).fetchone()
    if draft is None:
        connection.close()
        raise HTTPException(status_code=404, detail={"form": "Draft not found"})

    (lg_id, first, middle, last, old_name, gender, growing, mobile,
     total, cotton, water, confirmed, client_id) = draft
    first, middle, last = parts_from(first, middle, last, old_name)
    name = build_name(first, middle, last)
    require_active_lg(connection, lg_id, True)
    growing_cotton = None if growing is None else bool(growing)

    errors = check_farmer(first, middle, last, gender, growing_cotton, mobile)
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
                (lg_id, farmer_number, name, first_name, middle_name,
                 last_name, gender, growing_cotton, mobile,
                 total_landholding, area_under_cotton, water_regime,
                 registered_on, registered_by, registered_at, client_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            # The time is when the server received it, which for a form
            # kept on a phone without signal is the moment it was sent.
            (lg_id, number, name, first, middle, last, gender, growing,
             mobile or None,
             round(total, 2), cotton, water, date.today().isoformat(),
             user["id"],
             datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
             client_id),
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
    log_activity(connection, user, "Farmer registered", f"Farmer {new_id}, group {lg_id}")
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


@app.get("/submissions/{client_id}")
def submission_status(client_id: str, user: dict = Depends(current_user)):
    """Was the registration with this number already saved? The phone asks
    when a reply was lost, to find out instead of guessing."""
    key = clean_client_id(client_id)
    connection = sqlite3.connect("field.db")
    row = None
    if key is not None:
        row = connection.execute(
            """
            SELECT farmers.id,
                   pus.code
                       || '-' || printf('%03d', learning_groups.lg_number)
                       || '-' || printf('%02d', farmers.farmer_number)
            FROM farmers
            JOIN learning_groups ON learning_groups.id = farmers.lg_id
            JOIN pus ON pus.id = learning_groups.pu_id
            WHERE farmers.client_id = ? AND farmers.registered_by = ?
            """,
            (key, user["id"]),
        ).fetchone()
    connection.close()
    if row is None:
        raise HTTPException(status_code=404, detail={"form": "Not found"})
    return {"id": row[0], "farmer_code": row[1]}


class FarmerEdit(BaseModel):
    first_name: str = ""
    middle_name: str = ""
    last_name: str = ""
    name: str = ""  # only from older requests; the parts are used when given
    gender: str = ""
    growing_cotton: Optional[bool] = None
    mobile: str = ""
    total_landholding: Optional[float] = None
    area_under_cotton: Optional[float] = None
    water_regime: str = ""
    confirmed_large: bool = False
    reason: str = ""
    # "" keeps the current status; "dropped_out" or "continuing" changes it
    participation: str = ""
    drop_reason: str = ""


@app.put("/farmers/{farmer_id}")
def edit_farmer(
    farmer_id: int, body: FarmerEdit, user: dict = Depends(current_user)
):
    first, middle, last = parts_from(
        body.first_name, body.middle_name, body.last_name, body.name
    )
    name = build_name(first, middle, last)
    reason = " ".join(body.reason.split())
    mobile = body.mobile.strip()

    errors = check_farmer(first, middle, last, body.gender, body.growing_cotton, mobile)
    if len(reason) > 200:
        errors["reason"] = "Reason is too long (at most 200 characters)"

    connection = sqlite3.connect("field.db")
    require_farmer(connection, user, farmer_id, True)
    old = connection.execute(
        "SELECT name, gender, growing_cotton, mobile, total_landholding, "
        "area_under_cotton, water_regime, participation, first_name, "
        "middle_name, last_name FROM farmers WHERE id = ?",
        (farmer_id,),
    ).fetchone()
    if old is None:
        connection.close()
        raise HTTPException(status_code=404, detail={"form": "Farmer not found"})

    # Dropping or bringing back a farmer happens here, in Edit details.
    new_status = body.participation or old[7]
    if new_status not in PARTICIPATION_LABELS:
        errors["participation"] = "Unknown participation status"
    elif new_status != old[7]:
        if registered_this_season(connection, farmer_id):
            errors["participation"] = NEW_FARMER_MESSAGE
        elif new_status == "dropped_out" and body.drop_reason not in DROP_REASONS:
            errors["participation"] = "Please choose a reason for dropping"

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
    elif (old[8], old[9], old[10]) != (first, middle, last):
        # Same full name, but a word moved between first, middle and last.
        changes.append(
            ("Name parts", f"{old[8]} | {old[9]} | {old[10]}",
             f"{first} | {middle} | {last}")
        )
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

    status_changed = new_status != old[7]
    # A farmer still to be updated can be saved with the same answers: the
    # facilitator has just checked them, so that counts as an update.
    was_to_update = season_status(connection, farmer_id) == "to_update"
    if not changes and not status_changed and not was_to_update:
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
            "UPDATE farmers SET name = ?, first_name = ?, middle_name = ?, "
            "last_name = ?, gender = ?, growing_cotton = ?, "
            "mobile = ?, total_landholding = ?, area_under_cotton = ?, "
            "water_regime = ? WHERE id = ?",
            (name, first, middle, last, body.gender, new_cotton,
             mobile or None, new_total,
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
                (farmer_id, field, old_value, new_value, changed_on, reason,
                 changed_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (farmer_id, field, old_value, new_value, today, reason,
             user["id"]),
        )
    if status_changed:
        connection.execute(
            "UPDATE farmers SET participation = ? WHERE id = ?",
            (new_status, farmer_id),
        )
        connection.execute(
            """
            INSERT INTO farmer_change_log
                (farmer_id, field, old_value, new_value, changed_on, reason,
                 changed_by)
            VALUES (?, 'Participation', ?, ?, ?, ?, ?)
            """,
            (farmer_id, PARTICIPATION_LABELS[old[7]],
             PARTICIPATION_LABELS[new_status], today,
             build_reason(new_status, body.drop_reason, reason), user["id"]),
        )
        if new_status == "continuing" and not changes:
            # Bringing a farmer back with details unchanged still counts as
            # an update: the facilitator has just checked them.
            connection.execute(
                """
                INSERT INTO farmer_change_log
                    (farmer_id, field, old_value, new_value, changed_on, reason,
                     changed_by)
                VALUES (?, 'Confirmed', '', 'Details confirmed', ?, '', ?)
                """,
                (farmer_id, today, user["id"]),
            )
    if was_to_update and not changes and not status_changed:
        connection.execute(
            """
            INSERT INTO farmer_change_log
                (farmer_id, field, old_value, new_value, changed_on, reason,
                 changed_by)
            VALUES (?, 'Confirmed', '', 'Details confirmed', ?, '', ?)
            """,
            (farmer_id, today, user["id"]),
        )
    log_activity(connection, user, "Farmer edited", f"Farmer {farmer_id}")
    connection.commit()
    connection.close()
    return {"message": "Saved"}


@app.post("/farmers/{farmer_id}/confirm")
def confirm_farmer(farmer_id: int, user: dict = Depends(current_user)):
    """'These details are still right this season.' Counts as an update."""
    connection = sqlite3.connect("field.db")
    require_farmer(connection, user, farmer_id, True)
    status = season_status(connection, farmer_id)
    if status == "continued":
        connection.close()
        return {"message": "Already up to date this season"}
    if status == "new":
        connection.close()
        raise HTTPException(
            status_code=400,
            detail={"form": "Registered this season, so nothing to confirm"},
        )
    if status != "to_update":
        connection.close()
        raise HTTPException(
            status_code=400,
            detail={"form": "Only farmers who are still participating can be confirmed"},
        )
    connection.execute(
        """
        INSERT INTO farmer_change_log
            (farmer_id, field, old_value, new_value, changed_on, reason,
             changed_by)
        VALUES (?, 'Confirmed', '', 'Details confirmed', ?, '', ?)
        """,
        (farmer_id, date.today().isoformat(), user["id"]),
    )
    log_activity(connection, user, "Farmer confirmed", f"Farmer {farmer_id}")
    connection.commit()
    connection.close()
    return {"message": "Confirmed"}


@app.get("/farmers/{farmer_id}/changes")
def farmer_changes(farmer_id: int, user: dict = Depends(current_user)):
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    require_farmer(connection, user, farmer_id)
    rows = connection.execute(
        """
        SELECT id, field, old_value, new_value, changed_on, changed_at, reason,
               (SELECT app_users.name FROM app_users
                 WHERE app_users.id = farmer_change_log.changed_by)
                   AS changed_by_name
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


NEW_FARMER_MESSAGE = (
    "Farmers registered this season cannot be marked as dropped out. "
    "If one was added by mistake, delete the farmer instead."
)

PARTICIPATION_LABELS = {"continuing": "Continuing", "dropped_out": "Dropped out"}


def build_reason(participation, reason, note):
    text = reason if participation == "dropped_out" else ""
    if note:
        text = f"{text} - {note}" if text else note
    return text


DELETE_REASONS = [
    "Added by mistake",
    "Duplicate of another farmer",
    "Left the programme",
    "Other",
]


class DeleteFarmer(BaseModel):
    reason: str = ""
    note: str = ""


@app.post("/farmers/{farmer_id}/delete")
def delete_farmer(
    farmer_id: int, body: DeleteFarmer, user: dict = Depends(current_user)
):
    """Removes a farmer who was registered this season (added by mistake).
    The details are copied to an archive table first. Older farmers are
    marked as dropped out instead, so last year's records stay complete."""
    note = " ".join(body.note.split())
    errors = {}
    if body.reason not in DELETE_REASONS:
        errors["reason"] = "Please choose a reason"
    if len(note) > 200:
        errors["note"] = "Note is too long (at most 200 characters)"
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    connection = sqlite3.connect("field.db")
    require_farmer(connection, user, farmer_id, True)
    if not registered_this_season(connection, farmer_id):
        connection.close()
        raise HTTPException(
            status_code=400,
            detail={
                "form": "Only farmers registered this season can be deleted. "
                "Mark older farmers as dropped out instead."
            },
        )
    row = connection.execute(
        f"""
        SELECT {FARMER_CODE_SQL}, farmers.lg_id, farmers.farmer_number,
               farmers.name, farmers.gender, farmers.growing_cotton,
               farmers.mobile, farmers.total_landholding,
               farmers.area_under_cotton, farmers.water_regime,
               farmers.registered_on
        FROM farmers
        JOIN learning_groups ON learning_groups.id = farmers.lg_id
        JOIN pus ON pus.id = learning_groups.pu_id
        WHERE farmers.id = ?
        """,
        (farmer_id,),
    ).fetchone()
    reason = f"{body.reason} - {note}" if note else body.reason
    connection.execute(
        """
        INSERT INTO deleted_farmers
            (farmer_id, farmer_code, lg_id, farmer_number, name, gender,
             growing_cotton, mobile, total_landholding, area_under_cotton,
             water_regime, registered_on, deleted_on, deleted_by, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (farmer_id, *row, date.today().isoformat(), user["name"], reason),
    )
    connection.execute(
        "DELETE FROM farmer_change_log WHERE farmer_id = ?", (farmer_id,)
    )
    connection.execute("DELETE FROM farmers WHERE id = ?", (farmer_id,))
    log_activity(connection, user, "Farmer deleted", f"Farmer {farmer_id}, {row[0]}")
    connection.commit()
    connection.close()
    return {"message": "Deleted", "farmer_code": row[0]}



# ---------------------------------------------------------------------------
# Learning groups: add, drop, bring back, delete. Only the PU manager.
# ---------------------------------------------------------------------------

LG_DROP_REASONS = [
    "Group dissolved",
    "Village no longer in the programme",
    "Merged with another group",
    "Other",
]
LG_DROP_TAG = "Learning group dropped"


def clean_note(note):
    return " ".join(note.split())


@app.get("/pu/villages")
def pu_villages(user: dict = Depends(current_user)):
    require_manager(user)
    connection = sqlite3.connect("field.db")
    rows = connection.execute(
        "SELECT id, name FROM villages WHERE pu_id = ? ORDER BY name",
        (user["pu_id"],),
    ).fetchall()
    connection.close()
    return [{"id": row[0], "name": row[1]} for row in rows]


class NewLg(BaseModel):
    village_id: Optional[int] = None
    new_village: str = ""
    ff_id: Optional[int] = None


@app.post("/pu/lgs")
def add_lg(body: NewLg, user: dict = Depends(current_user)):
    """Creates a learning group in the manager's PU. It takes the lowest
    number not in use, so the number of a deleted new group is used again."""
    require_manager(user)
    village_name = clean_note(body.new_village)
    errors = {}
    if body.village_id is None and village_name == "":
        errors["village"] = "Choose a village or type a new one"
    if village_name != "":
        message = name_error(village_name, "village")
        if message:
            errors["village"] = message.replace("full name", "name")

    connection = sqlite3.connect("field.db")
    village_id = body.village_id
    if village_name != "" and "village" not in errors:
        existing = connection.execute(
            "SELECT id FROM villages WHERE pu_id = ? AND lower(name) = lower(?)",
            (user["pu_id"], village_name),
        ).fetchone()
        village_id = existing[0] if existing else None
    elif village_id is not None:
        row = connection.execute(
            "SELECT id FROM villages WHERE id = ? AND pu_id = ?",
            (village_id, user["pu_id"]),
        ).fetchone()
        if row is None:
            errors["village"] = "Village not found in your PU"

    ff = None
    if body.ff_id is not None:
        ff = connection.execute(
            "SELECT id, pu_id, active FROM facilitators WHERE id = ?",
            (body.ff_id,),
        ).fetchone()
        if ff is None or ff[1] != user["pu_id"]:
            errors["ff"] = "Facilitator not found in your PU"
        elif not ff[2]:
            errors["ff"] = "That facilitator has left"

    if errors:
        connection.close()
        raise HTTPException(status_code=400, detail=errors)

    if village_id is None:
        village_id = connection.execute(
            "INSERT INTO villages (name, pu_id) VALUES (?, ?)",
            (village_name, user["pu_id"]),
        ).lastrowid

    # Numbers only go up. A deleted or dropped group keeps its number
    # reserved, so a group code is never given out twice.
    highest = connection.execute(
        "SELECT MAX(pus.last_lg_number, "
        "COALESCE((SELECT MAX(lg_number) FROM learning_groups "
        "WHERE pu_id = pus.id), 0)) FROM pus WHERE pus.id = ?",
        (user["pu_id"],),
    ).fetchone()[0]
    number = highest + 1

    today = date.today().isoformat()
    lg_id = connection.execute(
        "INSERT INTO learning_groups (pu_id, village_id, lg_number, created_on) "
        "VALUES (?, ?, ?, ?)",
        (user["pu_id"], village_id, number, today),
    ).lastrowid
    connection.execute(
        "UPDATE pus SET last_lg_number = MAX(last_lg_number, ?) WHERE id = ?",
        (number, user["pu_id"]),
    )
    if ff is not None:
        connection.execute(
            "INSERT INTO assignments (lg_id, ff_id, start_date) VALUES (?, ?, ?)",
            (lg_id, ff[0], today),
        )
    code = connection.execute(
        "SELECT pus.code || '-' || printf('%03d', ?) FROM pus WHERE id = ?",
        (number, user["pu_id"]),
    ).fetchone()[0]
    log_activity(connection, user, "Group created", f"Group {code}")
    connection.commit()
    connection.close()
    return {"id": lg_id, "lg_code": code}


class LgReason(BaseModel):
    reason: str = ""
    note: str = ""


def manager_lg(connection, user, lg_id):
    """The group's row, after checking it exists and is in the manager's PU."""
    require_manager(user)
    row = connection.execute(
        "SELECT pu_id, dropped_on, created_on FROM learning_groups WHERE id = ?",
        (lg_id,),
    ).fetchone()
    if row is None:
        fail(connection, 404, "Group not found", True)
    if row[0] != user["pu_id"]:
        fail(connection, 403, "You do not have access to this group", True)
    return row


@app.post("/lgs/{lg_id}/drop")
def drop_lg(lg_id: int, body: LgReason, user: dict = Depends(current_user)):
    """Drops a whole group (one that existed before this season). Every
    farmer still in it, including farmers added this season, is marked as
    dropped out with the same reason. Bringing the group back reverses it."""
    note = clean_note(body.note)
    errors = {}
    if body.reason not in LG_DROP_REASONS:
        errors["reason"] = "Please choose a reason"
    if len(note) > 200:
        errors["note"] = "Note is too long (at most 200 characters)"
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    connection = sqlite3.connect("field.db")
    row = manager_lg(connection, user, lg_id)
    if row[1] is not None:
        fail(connection, 400, "This learning group is already dropped", True)
    if lg_id in deletable_lg_ids(connection):
        fail(
            connection, 400,
            "This group was created this season. Delete it instead of "
            "dropping it.",
            True,
        )

    reason = f"{LG_DROP_TAG} - {body.reason}" + (f" - {note}" if note else "")
    today = date.today().isoformat()
    farmers = connection.execute(
        "SELECT id FROM farmers WHERE lg_id = ? AND participation = 'continuing'",
        (lg_id,),
    ).fetchall()
    for (farmer_id,) in farmers:
        connection.execute(
            "UPDATE farmers SET participation = 'dropped_out' WHERE id = ?",
            (farmer_id,),
        )
        connection.execute(
            """
            INSERT INTO farmer_change_log
                (farmer_id, field, old_value, new_value, changed_on, reason,
                 changed_by)
            VALUES (?, 'Participation', 'Continuing', 'Dropped out', ?, ?, ?)
            """,
            (farmer_id, today, reason, user["id"]),
        )
    connection.execute(
        "UPDATE learning_groups SET dropped_on = ?, drop_reason = ? WHERE id = ?",
        (today, f"{body.reason}" + (f" - {note}" if note else ""), lg_id),
    )
    log_activity(connection, user, "Group dropped", f"Group {lg_id}, {len(farmers)} farmers dropped")
    connection.commit()
    connection.close()
    return {"message": "Dropped", "farmers_dropped": len(farmers)}


@app.get("/pu/lgs/dropped")
def dropped_lgs(user: dict = Depends(current_user)):
    require_manager(user)
    connection = sqlite3.connect("field.db")
    rows = connection.execute(
        """
        SELECT learning_groups.id,
               pus.code || '-' || printf('%03d', learning_groups.lg_number),
               villages.name, learning_groups.dropped_on,
               learning_groups.drop_reason,
               (SELECT COUNT(*) FROM farmers
                WHERE farmers.lg_id = learning_groups.id)
        FROM learning_groups
        JOIN pus ON pus.id = learning_groups.pu_id
        JOIN villages ON villages.id = learning_groups.village_id
        WHERE learning_groups.pu_id = ? AND learning_groups.dropped_on IS NOT NULL
        ORDER BY learning_groups.dropped_on DESC, learning_groups.lg_number
        """,
        (user["pu_id"],),
    ).fetchall()
    connection.close()
    return [
        {
            "id": r[0], "lg_code": r[1], "village": r[2], "dropped_on": r[3],
            "drop_reason": r[4], "farmer_count": r[5],
        }
        for r in rows
    ]


@app.post("/lgs/{lg_id}/restore")
def restore_lg(lg_id: int, user: dict = Depends(current_user)):
    """Brings a dropped group back, together with the farmers who were
    dropped when the group was. They all go back to 'still to update': the
    facilitator has to confirm or edit each one again. Farmers who had
    dropped out earlier stay dropped out."""
    connection = sqlite3.connect("field.db")
    row = manager_lg(connection, user, lg_id)
    if row[1] is None:
        fail(connection, 400, "This learning group is not dropped", True)

    today = date.today().isoformat()
    farmers = connection.execute(
        """
        SELECT farmers.id FROM farmers
        WHERE farmers.lg_id = ? AND farmers.participation = 'dropped_out'
        AND EXISTS (
            SELECT 1 FROM farmer_change_log
            WHERE farmer_change_log.farmer_id = farmers.id
            AND farmer_change_log.field = 'Participation'
            AND farmer_change_log.new_value = 'Dropped out'
            AND farmer_change_log.changed_on = ?
            AND farmer_change_log.reason LIKE ?
        )
        """,
        (lg_id, row[1], f"{LG_DROP_TAG}%"),
    ).fetchall()
    for (farmer_id,) in farmers:
        connection.execute(
            "UPDATE farmers SET participation = 'continuing' WHERE id = ?",
            (farmer_id,),
        )
        connection.execute(
            """
            INSERT INTO farmer_change_log
                (farmer_id, field, old_value, new_value, changed_on, reason,
                 changed_by)
            VALUES (?, 'Participation', 'Dropped out', 'Continuing', ?,
                    'Learning group brought back', ?)
            """,
            (farmer_id, today, user["id"]),
        )
    connection.execute(
        "UPDATE learning_groups SET dropped_on = NULL, drop_reason = NULL "
        "WHERE id = ?",
        (lg_id,),
    )
    log_activity(connection, user, "Group brought back", f"Group {lg_id}, {len(farmers)} farmers restored")
    connection.commit()
    connection.close()
    return {"message": "Brought back", "farmers_restored": len(farmers)}


@app.post("/lgs/{lg_id}/delete")
def delete_lg(lg_id: int, user: dict = Depends(current_user)):
    """Deletes a group created this season. Its farmers (all added this
    season) are copied to the archive first. The group number is not
    given out again."""
    connection = sqlite3.connect("field.db")
    row = manager_lg(connection, user, lg_id)
    if row[1] is not None or lg_id not in deletable_lg_ids(connection):
        fail(
            connection, 400,
            "Only a group created this season can be deleted. Drop older "
            "groups instead.",
            True,
        )

    code = connection.execute(
        "SELECT pus.code || '-' || printf('%03d', learning_groups.lg_number) "
        "FROM learning_groups JOIN pus ON pus.id = learning_groups.pu_id "
        "WHERE learning_groups.id = ?",
        (lg_id,),
    ).fetchone()[0]
    connection.execute(
        f"""
        INSERT INTO deleted_farmers
            (farmer_id, farmer_code, lg_id, farmer_number, name, gender,
             growing_cotton, mobile, total_landholding, area_under_cotton,
             water_regime, registered_on, deleted_on, deleted_by, reason)
        SELECT farmers.id, {FARMER_CODE_SQL}, farmers.lg_id,
               farmers.farmer_number, farmers.name, farmers.gender,
               farmers.growing_cotton, farmers.mobile,
               farmers.total_landholding, farmers.area_under_cotton,
               farmers.water_regime, farmers.registered_on, ?, ?,
               'Learning group deleted'
        FROM farmers
        JOIN learning_groups ON learning_groups.id = farmers.lg_id
        JOIN pus ON pus.id = learning_groups.pu_id
        WHERE farmers.lg_id = ?
        """,
        (date.today().isoformat(), user["name"], lg_id),
    )
    connection.execute(
        "DELETE FROM farmer_change_log WHERE farmer_id IN "
        "(SELECT id FROM farmers WHERE lg_id = ?)",
        (lg_id,),
    )
    connection.execute("DELETE FROM farmers WHERE lg_id = ?", (lg_id,))
    connection.execute("DELETE FROM farmer_drafts WHERE lg_id = ?", (lg_id,))
    connection.execute("DELETE FROM assignments WHERE lg_id = ?", (lg_id,))
    connection.execute("DELETE FROM learning_groups WHERE id = ?", (lg_id,))
    log_activity(connection, user, "Group deleted", f"Group {code}")
    connection.commit()
    connection.close()
    return {"message": "Deleted", "lg_code": code}


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
    log_activity(connection, user, "Groups moved", f"{len(to_move)} groups to facilitator {ff[0]}")
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
    # Only groups that are still running count (a dropped group is not
    # something the facilitator looks after any more).
    rows = connection.execute(
        f"""
        SELECT
            facilitators.id,
            facilitators.name,
            facilitators.active,
            facilitators.left_on,
            facilitators.mobile,
            {FF_CODE_SQL} AS ff_code,
            (SELECT COUNT(*) FROM assignments
             JOIN learning_groups ON learning_groups.id = assignments.lg_id
             WHERE assignments.ff_id = facilitators.id
             AND assignments.end_date IS NULL
             AND learning_groups.dropped_on IS NULL) AS lg_count,
            (SELECT COUNT(*) FROM farmers
             JOIN assignments ON assignments.lg_id = farmers.lg_id
                 AND assignments.end_date IS NULL
             JOIN learning_groups ON learning_groups.id = farmers.lg_id
             WHERE assignments.ff_id = facilitators.id
             AND learning_groups.dropped_on IS NULL
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
    mobile: str = ""


def clean_mobile(text):
    """Digits only: spaces typed or pasted into the number are ignored."""
    return "".join(text.split())


def ff_mobile_error(connection, mobile, except_ff_id=0):
    """Returns a message if this is not an acceptable facilitator mobile."""
    if mobile == "":
        return "Please enter the facilitator's mobile number"
    if not re.fullmatch(r"[0-9]{10}", mobile):
        return "Mobile number must be exactly 10 digits"
    other = connection.execute(
        "SELECT id FROM facilitators WHERE mobile = ? AND id != ?",
        (mobile, except_ff_id),
    ).fetchone()
    if other is not None:
        return "This mobile number is already used by another facilitator"
    return None


@app.post("/pu/facilitators")
def add_facilitator(body: NewFacilitator, user: dict = Depends(current_user)):
    require_manager(user)
    name = " ".join(body.name.split())
    mobile = clean_mobile(body.mobile)

    connection = sqlite3.connect("field.db")
    errors = {}
    message = name_error(name, "facilitator")
    if message:
        errors["name"] = message
    else:
        same = connection.execute(
            "SELECT id FROM facilitators WHERE pu_id = ? AND lower(name) = lower(?)",
            (user["pu_id"], name),
        ).fetchone()
        if same is not None:
            errors["name"] = "A facilitator with this name already exists in your PU"
    message = ff_mobile_error(connection, mobile)
    if message:
        errors["mobile"] = message
    if errors:
        connection.close()
        raise HTTPException(status_code=400, detail=errors)

    # The next number in this PU. Facilitators are never deleted, only marked
    # as left, so a number is never given out twice.
    ff_number = connection.execute(
        "SELECT COALESCE(MAX(ff_number), 0) + 1 FROM facilitators WHERE pu_id = ?",
        (user["pu_id"],),
    ).fetchone()[0]
    cursor = connection.execute(
        "INSERT INTO facilitators (name, pu_id, ff_number, mobile) "
        "VALUES (?, ?, ?, ?)",
        (name, user["pu_id"], ff_number, mobile),
    )
    ff_id = cursor.lastrowid
    ff_code = connection.execute(
        "SELECT code || 'FF' || ? FROM pus WHERE id = ?",
        (ff_number, user["pu_id"]),
    ).fetchone()[0]
    # The new facilitator also gets a demo sign-in.
    connection.execute(
        "INSERT INTO app_users (name, role, pu_id, ff_id) "
        "VALUES (?, 'facilitator', ?, ?)",
        (name, user["pu_id"], ff_id),
    )
    log_activity(connection, user, "Facilitator added", f"Facilitator {ff_id}, {name}")
    connection.commit()
    connection.close()
    return {"id": ff_id, "ff_code": ff_code}


class FacilitatorMobile(BaseModel):
    mobile: str = ""


@app.post("/pu/facilitators/{ff_id}/mobile")
def change_facilitator_mobile(
    ff_id: int, body: FacilitatorMobile, user: dict = Depends(current_user)
):
    """The PU manager gives a facilitator a new mobile number."""
    require_manager(user)
    mobile = clean_mobile(body.mobile)
    connection = sqlite3.connect("field.db")

    ff = connection.execute(
        "SELECT id, name, pu_id, active FROM facilitators WHERE id = ?", (ff_id,)
    ).fetchone()
    if ff is None:
        fail(connection, 404, "Facilitator not found", True)
    if ff[2] != user["pu_id"]:
        fail(connection, 403, "You do not have access to this facilitator", True)
    if not ff[3]:
        fail(connection, 400, "This facilitator has left", True)

    message = ff_mobile_error(connection, mobile, ff_id)
    if message:
        connection.close()
        raise HTTPException(status_code=400, detail={"mobile": message})

    connection.execute(
        "UPDATE facilitators SET mobile = ? WHERE id = ?", (mobile, ff_id)
    )
    log_activity(
        connection, user, "Facilitator mobile changed", f"Facilitator {ff_id}, {ff[1]}"
    )
    connection.commit()
    connection.close()
    return {"ok": True, "mobile": mobile}


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

    # Only groups that are still running need a new facilitator. A dropped
    # group keeps its history; if it is brought back later, the manager gives
    # it a facilitator then.
    current = connection.execute(
        """
        SELECT assignments.id, assignments.lg_id FROM assignments
        JOIN learning_groups ON learning_groups.id = assignments.lg_id
        WHERE assignments.ff_id = ? AND assignments.end_date IS NULL
        AND learning_groups.dropped_on IS NULL
        """,
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
    log_activity(connection, user, "Facilitator left", f"Facilitator {ff_id}, {len(chosen)} groups moved")
    connection.commit()
    connection.close()
    return {"moved": len(chosen)}
