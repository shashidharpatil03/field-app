import sqlite3
import unicodedata
from datetime import date, datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/lgs")
def list_lgs():
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    rows = connection.execute("""
        SELECT
            learning_groups.id,
            learning_groups.pu_id,
            pus.code || '-' || printf('%03d', learning_groups.lg_number)
                AS lg_code,
            villages.name AS village,
            (SELECT COUNT(*) FROM farmers
             WHERE farmers.lg_id = learning_groups.id
             AND farmers.participation = 'continuing') AS farmer_count,
            (SELECT COUNT(*) FROM farmer_drafts
             WHERE farmer_drafts.lg_id = learning_groups.id) AS draft_count,
            facilitators.name AS ff_name
        FROM learning_groups
        JOIN pus ON pus.id = learning_groups.pu_id
        JOIN villages ON villages.id = learning_groups.village_id
        LEFT JOIN assignments
            ON assignments.lg_id = learning_groups.id
            AND assignments.end_date IS NULL
        LEFT JOIN facilitators
            ON facilitators.id = assignments.ff_id
        ORDER BY pus.code, learning_groups.lg_number
    """).fetchall()
    connection.close()
    return [dict(row) for row in rows]

@app.get("/ffs")
def list_ffs():
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        "SELECT id, name, pu_id FROM facilitators ORDER BY name"
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


class ReassignRequest(BaseModel):
    new_ff_id: int


@app.post("/lgs/{lg_id}/reassign")
def reassign_lg(lg_id: int, body: ReassignRequest):
    connection = sqlite3.connect("field.db")

    lg = connection.execute(
        "SELECT id, pu_id FROM learning_groups WHERE id = ?", (lg_id,)
    ).fetchone()
    ff = connection.execute(
        "SELECT id, pu_id FROM facilitators WHERE id = ?", (body.new_ff_id,)
    ).fetchone()
    if lg is None or ff is None:
        connection.close()
        raise HTTPException(status_code=404, detail="Group or facilitator not found")

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
def assignment_history(lg_id: int):
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
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
def list_farmers(lg_id: int):
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
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
        AND farmers.participation = 'continuing'
        ORDER BY farmers.farmer_number
        """,
        (lg_id,),
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


@app.get("/farmers/{farmer_id}")
def get_farmer(farmer_id: int):
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
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
            farmers.participation,
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


def check_farmer(name, gender, growing_cotton):
    errors = {}

    if name == "":
        errors["name"] = "Please enter the farmer's full name"
    elif len(name) < 3:
        errors["name"] = "Name is too short (at least 3 letters)"
    elif len(name) > 60:
        errors["name"] = "Name is too long (at most 60 letters)"
    elif not all(unicodedata.category(ch)[0] in "LM" or ch in " .'-" for ch in name):
        errors["name"] = "Name can only have letters and spaces"

    if gender not in ALLOWED_GENDERS:
        errors["gender"] = "Please choose a gender"

    if growing_cotton is None:
        errors["growing_cotton"] = "Please choose Yes or No"

    return errors


def check_draft(name, gender):
    errors = {}
    if len(name) > 60:
        errors["name"] = "Name is too long (at most 60 letters)"
    if gender != "" and gender not in ALLOWED_GENDERS:
        errors["gender"] = "Please choose a gender"
    return errors


@app.get("/lgs/{lg_id}/drafts")
def list_drafts(lg_id: int):
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        """
        SELECT id, name, gender, growing_cotton, updated_at
        FROM farmer_drafts
        WHERE lg_id = ?
        ORDER BY updated_at DESC, id DESC
        """,
        (lg_id,),
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


@app.post("/lgs/{lg_id}/drafts")
def create_draft(lg_id: int, body: DraftBody):
    name = " ".join(body.name.split())
    errors = check_draft(name, body.gender)
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    connection = sqlite3.connect("field.db")
    lg = connection.execute(
        "SELECT id FROM learning_groups WHERE id = ?", (lg_id,)
    ).fetchone()
    if lg is None:
        connection.close()
        raise HTTPException(status_code=404, detail={"form": "Group not found"})

    growing = None if body.growing_cotton is None else int(body.growing_cotton)
    cursor = connection.execute(
        """
        INSERT INTO farmer_drafts (lg_id, name, gender, growing_cotton, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (lg_id, name, body.gender, growing, datetime.now().isoformat(timespec="seconds")),
    )
    new_id = cursor.lastrowid
    connection.commit()
    connection.close()
    return {"id": new_id}


@app.put("/drafts/{draft_id}")
def update_draft(draft_id: int, body: DraftBody):
    name = " ".join(body.name.split())
    errors = check_draft(name, body.gender)
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    connection = sqlite3.connect("field.db")
    growing = None if body.growing_cotton is None else int(body.growing_cotton)
    cursor = connection.execute(
        """
        UPDATE farmer_drafts
        SET name = ?, gender = ?, growing_cotton = ?, updated_at = ?
        WHERE id = ?
        """,
        (name, body.gender, growing, datetime.now().isoformat(timespec="seconds"), draft_id),
    )
    connection.commit()
    changed = cursor.rowcount
    connection.close()
    if changed == 0:
        raise HTTPException(status_code=404, detail={"form": "Draft not found"})
    return {"id": draft_id}


@app.delete("/drafts/{draft_id}")
def delete_draft(draft_id: int):
    connection = sqlite3.connect("field.db")
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
def submit_draft(draft_id: int):
    connection = sqlite3.connect("field.db")

    draft = connection.execute(
        "SELECT lg_id, name, gender, growing_cotton FROM farmer_drafts WHERE id = ?",
        (draft_id,),
    ).fetchone()
    if draft is None:
        connection.close()
        raise HTTPException(status_code=404, detail={"form": "Draft not found"})

    lg_id, name, gender, growing = draft
    growing_cotton = None if growing is None else bool(growing)

    errors = check_farmer(name, gender, growing_cotton)
    if errors:
        connection.close()
        raise HTTPException(status_code=400, detail=errors)

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
        INSERT INTO farmers (lg_id, farmer_number, name, gender, growing_cotton)
        VALUES (?, ?, ?, ?, ?)
        """,
        (lg_id, number, name, gender, growing),
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
    reason: str = ""


@app.put("/farmers/{farmer_id}")
def edit_farmer(farmer_id: int, body: FarmerEdit):
    name = " ".join(body.name.split())
    reason = " ".join(body.reason.split())

    errors = check_farmer(name, body.gender, body.growing_cotton)
    if len(reason) > 200:
        errors["reason"] = "Reason is too long (at most 200 characters)"
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    connection = sqlite3.connect("field.db")
    old = connection.execute(
        "SELECT name, gender, growing_cotton FROM farmers WHERE id = ?",
        (farmer_id,),
    ).fetchone()
    if old is None:
        connection.close()
        raise HTTPException(status_code=404, detail={"form": "Farmer not found"})

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

    if not changes:
        connection.close()
        raise HTTPException(status_code=400, detail={"form": "Nothing was changed"})

    today = date.today().isoformat()
    connection.execute(
        "UPDATE farmers SET name = ?, gender = ?, growing_cotton = ? WHERE id = ?",
        (name, body.gender, new_cotton, farmer_id),
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
def farmer_changes(farmer_id: int):
    connection = sqlite3.connect("field.db")
    connection.row_factory = sqlite3.Row
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
