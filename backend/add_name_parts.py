# One-off, safe to run more than once: adds first / middle / last name to
# farmers and drafts, and fills them in from the existing full names.
import sqlite3

from name_parts import build_name, split_name

connection = sqlite3.connect("field.db")


def add_column(table, column):
    columns = [row[1] for row in connection.execute(f"PRAGMA table_info({table})")]
    if column not in columns:
        connection.execute(
            f"ALTER TABLE {table} ADD COLUMN {column} TEXT NOT NULL DEFAULT ''"
        )


for table in ("farmers", "farmer_drafts"):
    for column in ("first_name", "middle_name", "last_name"):
        add_column(table, column)
    rows = connection.execute(
        f"SELECT id, name FROM {table} "
        "WHERE first_name = '' AND last_name = '' AND name != ''"
    ).fetchall()
    for row_id, name in rows:
        first, middle, last = split_name(name)
        connection.execute(
            f"UPDATE {table} SET first_name = ?, middle_name = ?, last_name = ?, "
            "name = ? WHERE id = ?",
            (first, middle, last, build_name(first, middle, last), row_id),
        )
connection.commit()
connection.close()
print("Name parts ready")
