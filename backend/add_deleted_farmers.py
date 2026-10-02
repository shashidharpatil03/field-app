# One-off, safe to run more than once:
#  1. creates the table that archives deleted farmers
#  2. fixes demo farmers that were both "registered this season" and
#     "dropped out" (new farmers can only be deleted, not dropped), by
#     moving their registration date to an earlier, made-up date.
import random
import sqlite3
from datetime import date, timedelta

from deleted_table import DELETED_FARMERS_SQL
from demo_data import season_start

connection = sqlite3.connect("field.db")
connection.execute(DELETED_FARMERS_SQL)

start = season_start(date.today())
rng = random.Random(7)
rows = connection.execute(
    "SELECT id FROM farmers WHERE participation = 'dropped_out' AND registered_on >= ?",
    (start.isoformat(),),
).fetchall()
for (farmer_id,) in rows:
    earlier = start - timedelta(days=rng.randint(30, 400))
    connection.execute(
        "UPDATE farmers SET registered_on = ? WHERE id = ?",
        (earlier.isoformat(), farmer_id),
    )
    # a drop entry dated before the farmer joined would be odd, so move it too
    connection.execute(
        "UPDATE farmer_change_log SET changed_on = ? WHERE farmer_id = ? "
        "AND field = 'Participation' AND changed_on < ?",
        (
            (start + timedelta(days=rng.randint(0, max((date.today() - start).days, 1)))).isoformat(),
            farmer_id,
            earlier.isoformat(),
        ),
    )
connection.commit()
connection.close()
print(f"Done. Fixed {len(rows)} farmer(s).")
