import sqlite3
import unicodedata
from datetime import date
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


class NewFarmer(BaseModel):
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


@app.post("/lgs/{lg_id}/farmers")
def register_farmer(lg_id: int, body: NewFarmer):
    name = " ".join(body.name.split())

    errors = check_farmer(name, body.gender, body.growing_cotton)
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    connection = sqlite3.connect("field.db")

    lg = connection.execute(
        "SELECT id FROM learning_groups WHERE id = ?", (lg_id,)
    ).fetchone()
    if lg is None:
        connection.close()
        raise HTTPException(status_code=404, detail={"form": "Group not found"})

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
        (lg_id, number, name, body.gender, 1 if body.growing_cotton else 0),
    )
    new_id = cursor.lastrowid
    connection.commit()
    connection.close()
    return {"id": new_id, "farmer_number": number}
