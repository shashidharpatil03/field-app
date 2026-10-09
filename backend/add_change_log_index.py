# One-off, safe to run more than once: adds the index that makes the
# dashboard and the weekly chart fast. Run it with the backend stopped.
import sqlite3

connection = sqlite3.connect("field.db")
connection.execute(
    "CREATE INDEX IF NOT EXISTS farmer_change_log_lookup "
    "ON farmer_change_log(farmer_id, field, changed_on)"
)
connection.commit()
connection.close()
print("Index ready")
