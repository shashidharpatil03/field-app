# One-off, safe to run more than once: adds the columns a learning group
# needs to be created, dropped and brought back.
#   created_on   empty for the groups that existed before this feature
#   dropped_on   empty while the group is active
#   drop_reason  why it was dropped
import sqlite3

connection = sqlite3.connect("field.db")


def has_column(table, column):
    rows = connection.execute(f"PRAGMA table_info({table})").fetchall()
    return any(row[1] == column for row in rows)


for column in ("created_on", "dropped_on", "drop_reason"):
    if not has_column("learning_groups", column):
        connection.execute(f"ALTER TABLE learning_groups ADD COLUMN {column} TEXT")

connection.commit()
connection.close()
print("Learning group status columns ready")
