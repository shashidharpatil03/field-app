import sqlite3

connection = sqlite3.connect("field.db")

connection.execute("""
    CREATE TABLE IF NOT EXISTS farmer_drafts (
        id INTEGER PRIMARY KEY,
        lg_id INTEGER NOT NULL REFERENCES learning_groups(id),
        name TEXT NOT NULL DEFAULT '',
        gender TEXT NOT NULL DEFAULT '',
        growing_cotton INTEGER,
        updated_at TEXT NOT NULL
    )
""")

connection.commit()
connection.close()
print("Drafts table ready")
