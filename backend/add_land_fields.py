# Adds the land fields and registration date to an existing database, and
# fills in made-up values for farmers that do not have them yet.
# Safe to run more than once.
import random
import sqlite3
from datetime import date

from demo_data import demo_land, demo_registered_on

connection = sqlite3.connect("field.db")


def has_column(table, column):
    rows = connection.execute(f"PRAGMA table_info({table})").fetchall()
    return any(row[1] == column for row in rows)


def add_column(table, column, definition):
    if not has_column(table, column):
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


for table in ("farmers", "farmer_drafts"):
    add_column(table, "total_landholding", "REAL")
    add_column(table, "area_under_cotton", "REAL")
add_column("farmers", "water_regime", "TEXT")
add_column("farmers", "registered_on", "TEXT")
add_column("farmer_drafts", "water_regime", "TEXT NOT NULL DEFAULT ''")
add_column("farmer_drafts", "confirmed_large", "INTEGER NOT NULL DEFAULT 0")

rng = random.Random(7)
today = date.today()
rows = connection.execute(
    "SELECT id, growing_cotton, total_landholding, registered_on "
    "FROM farmers ORDER BY id"
).fetchall()
for farmer_id, growing, total, registered_on in rows:
    # Draw both every time so the numbers stay the same on a second run.
    land = demo_land(rng, growing == 1)
    joined = demo_registered_on(rng, today)
    if total is None:
        connection.execute(
            "UPDATE farmers SET total_landholding = ?, area_under_cotton = ?, "
            "water_regime = ? WHERE id = ?",
            (land[0], land[1], land[2], farmer_id),
        )
    if registered_on is None:
        connection.execute(
            "UPDATE farmers SET registered_on = ? WHERE id = ?",
            (joined, farmer_id),
        )

connection.commit()
connection.close()
print("Land fields and registration dates ready")
