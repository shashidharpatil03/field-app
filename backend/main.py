import sqlite3
from datetime import date

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