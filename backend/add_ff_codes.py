# One-off, safe to run more than once: gives every facilitator a number
# inside their PU. The facilitator code is the PU code, "FF" and that number,
# for example INMH01FF5. Numbers are never reused.
import sqlite3

connection = sqlite3.connect("field.db")

columns = [row[1] for row in connection.execute("PRAGMA table_info(facilitators)")]
if "ff_number" not in columns:
    connection.execute("ALTER TABLE facilitators ADD COLUMN ff_number INTEGER")

for (pu_id,) in connection.execute("SELECT id FROM pus").fetchall():
    highest = connection.execute(
        "SELECT COALESCE(MAX(ff_number), 0) FROM facilitators WHERE pu_id = ?",
        (pu_id,),
    ).fetchone()[0]
    waiting = connection.execute(
        "SELECT id FROM facilitators WHERE pu_id = ? AND ff_number IS NULL "
        "ORDER BY id",
        (pu_id,),
    ).fetchall()
    for (ff_id,) in waiting:
        highest += 1
        connection.execute(
            "UPDATE facilitators SET ff_number = ? WHERE id = ?", (highest, ff_id)
        )

connection.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS facilitators_number_unique "
    "ON facilitators(pu_id, ff_number)"
)
connection.commit()
connection.close()
print("Facilitator codes ready")
