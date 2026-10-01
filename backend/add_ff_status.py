import sqlite3

connection = sqlite3.connect("field.db")


def has_column(table, column):
    rows = connection.execute(f"PRAGMA table_info({table})").fetchall()
    return any(row[1] == column for row in rows)


if not has_column("facilitators", "active"):
    connection.execute("""
        ALTER TABLE facilitators
        ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    """)

if not has_column("facilitators", "left_on"):
    connection.execute("ALTER TABLE facilitators ADD COLUMN left_on TEXT")

connection.commit()
connection.close()
print("Facilitator status columns ready")
