# Made-up demo users for the sign-in screen. No passwords are stored anywhere.


def create_users_table(connection):
    connection.execute("""
        CREATE TABLE IF NOT EXISTS app_users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('pu_manager', 'facilitator')),
            pu_id INTEGER NOT NULL REFERENCES pus(id),
            ff_id INTEGER REFERENCES facilitators(id)
        )
    """)


def seed_users(connection):
    already = connection.execute("SELECT COUNT(*) FROM app_users").fetchone()[0]
    if already > 0:
        return

    managers = [
        ("Kavita Deshmukh", "INMH01"),
        ("Sandeep Bhosale", "INMH02"),
    ]
    for name, pu_code in managers:
        pu = connection.execute(
            "SELECT id FROM pus WHERE code = ?", (pu_code,)
        ).fetchone()
        if pu is not None:
            connection.execute(
                "INSERT INTO app_users (name, role, pu_id) VALUES (?, 'pu_manager', ?)",
                (name, pu[0]),
            )

    # Every facilitator in the database can also sign in as themselves.
    for ff_id, name, pu_id in connection.execute(
        "SELECT id, name, pu_id FROM facilitators ORDER BY id"
    ).fetchall():
        connection.execute(
            "INSERT INTO app_users (name, role, pu_id, ff_id) "
            "VALUES (?, 'facilitator', ?, ?)",
            (name, pu_id, ff_id),
        )
