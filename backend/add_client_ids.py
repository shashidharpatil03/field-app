# One-off, safe to run more than once: adds the column and indexes that let
# the server recognise a registration the phone sends again after a lost
# reply. Run it with the backend stopped.
import sqlite3

connection = sqlite3.connect("field.db")
for table in ("farmers", "farmer_drafts"):
    columns = [row[1] for row in connection.execute(f"PRAGMA table_info({table})")]
    if "client_id" not in columns:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN client_id TEXT")
connection.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS farmers_client_id_unique "
    "ON farmers(client_id) WHERE client_id IS NOT NULL"
)
connection.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS drafts_client_id_unique "
    "ON farmer_drafts(client_id) WHERE client_id IS NOT NULL"
)
connection.commit()
connection.close()
print("Ready")
