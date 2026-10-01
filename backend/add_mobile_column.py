import sqlite3

connection = sqlite3.connect("field.db")


def has_column(table, column):
    rows = connection.execute(f"PRAGMA table_info({table})").fetchall()
    return any(row[1] == column for row in rows)


if not has_column("farmers", "mobile"):
    connection.execute("""
        ALTER TABLE farmers ADD COLUMN mobile TEXT CHECK (
            mobile IS NULL
            OR (length(mobile) = 10 AND mobile NOT GLOB '*[^0-9]*')
        )
    """)

if not has_column("farmer_drafts", "mobile"):
    connection.execute(
        "ALTER TABLE farmer_drafts ADD COLUMN mobile TEXT NOT NULL DEFAULT ''"
    )

connection.commit()
connection.close()
print("Mobile column ready")
