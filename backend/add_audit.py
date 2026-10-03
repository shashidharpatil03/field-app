# One-off, safe to run more than once: adds the audit trail to an existing
# field.db. Old rows keep an empty "by" (they were made before the audit
# trail existed).
import sqlite3

from audit_table import ACTIVITY_LOG_SQL
from change_time import CHANGE_TIME_TRIGGER_SQL

connection = sqlite3.connect("field.db")


def add_column(table, column, kind):
    columns = [row[1] for row in connection.execute(f"PRAGMA table_info({table})")]
    if column not in columns:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {kind}")


add_column("farmer_change_log", "changed_at", "TEXT")
add_column("farmer_change_log", "changed_by", "INTEGER")
add_column("farmers", "registered_by", "INTEGER")
connection.execute(CHANGE_TIME_TRIGGER_SQL)
connection.execute(ACTIVITY_LOG_SQL)
connection.commit()
connection.close()
print("Audit trail ready")
