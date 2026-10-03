# One-off, safe to run more than once: adds the time column and trigger to
# the change log of an existing field.db. Old rows keep an empty time.
import sqlite3

from change_time import CHANGE_TIME_TRIGGER_SQL

connection = sqlite3.connect("field.db")
columns = [row[1] for row in connection.execute("PRAGMA table_info(farmer_change_log)")]
if "changed_at" not in columns:
    connection.execute("ALTER TABLE farmer_change_log ADD COLUMN changed_at TEXT")
connection.execute(CHANGE_TIME_TRIGGER_SQL)
connection.commit()
connection.close()
print("Change log time ready")
