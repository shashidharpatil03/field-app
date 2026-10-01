import sqlite3

connection = sqlite3.connect("field.db")

connection.execute("""
    CREATE TABLE IF NOT EXISTS farmer_change_log (
        id INTEGER PRIMARY KEY,
        farmer_id INTEGER NOT NULL REFERENCES farmers(id),
        field TEXT NOT NULL,
        old_value TEXT NOT NULL,
        new_value TEXT NOT NULL,
        changed_on TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT ''
    )
""")

connection.commit()
connection.close()
print("Change log table ready")
