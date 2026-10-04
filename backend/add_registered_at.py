# One-off, safe to run more than once: adds the time a farmer was registered
# (registered_at) to an existing field.db. Farmers registered before this
# keep an empty time, so the Sent screen shows only the date for them.
import sqlite3

connection = sqlite3.connect("field.db")
columns = [row[1] for row in connection.execute("PRAGMA table_info(farmers)")]
if "registered_at" not in columns:
    connection.execute("ALTER TABLE farmers ADD COLUMN registered_at TEXT")
connection.commit()
connection.close()
print("Registration time ready")
