import random
import sqlite3

random.seed(42)

connection = sqlite3.connect("field.db")
cursor = connection.cursor()

cursor.execute("DROP TABLE IF EXISTS farmer_change_log")
cursor.execute("DROP TABLE IF EXISTS farmer_drafts")
cursor.execute("DROP TABLE IF EXISTS farmers")
cursor.execute("DROP TABLE IF EXISTS assignments")
cursor.execute("DROP TABLE IF EXISTS learning_groups")
cursor.execute("DROP TABLE IF EXISTS facilitators")
cursor.execute("DROP TABLE IF EXISTS villages")
cursor.execute("DROP TABLE IF EXISTS pus")

cursor.execute("""
    CREATE TABLE pus (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        last_lg_number INTEGER NOT NULL DEFAULT 0
    )
""")

cursor.execute("""
    CREATE TABLE villages (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        pu_id INTEGER NOT NULL REFERENCES pus(id)
    )
""")

cursor.execute("""
    CREATE TABLE facilitators (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        pu_id INTEGER NOT NULL REFERENCES pus(id)
    )
""")

cursor.execute("""
    CREATE TABLE learning_groups (
        id INTEGER PRIMARY KEY,
        pu_id INTEGER NOT NULL REFERENCES pus(id),
        village_id INTEGER NOT NULL REFERENCES villages(id),
        lg_number INTEGER NOT NULL,
        last_farmer_number INTEGER NOT NULL DEFAULT 0,
        UNIQUE (pu_id, lg_number)
    )
""")

cursor.execute("""
    CREATE TABLE assignments (
        id INTEGER PRIMARY KEY,
        lg_id INTEGER NOT NULL REFERENCES learning_groups(id),
        ff_id INTEGER NOT NULL REFERENCES facilitators(id),
        start_date TEXT NOT NULL,
        end_date TEXT
    )
""")

cursor.execute("""
    CREATE TABLE farmers (
        id INTEGER PRIMARY KEY,
        lg_id INTEGER NOT NULL REFERENCES learning_groups(id),
        farmer_number INTEGER NOT NULL,
        name TEXT NOT NULL,
        gender TEXT NOT NULL CHECK (gender IN ('Female', 'Male', 'Other')),
        growing_cotton INTEGER NOT NULL CHECK (growing_cotton IN (0, 1)),
        mobile TEXT CHECK (
            mobile IS NULL
            OR (length(mobile) = 10 AND mobile NOT GLOB '*[^0-9]*')
        ),
        participation TEXT NOT NULL DEFAULT 'continuing'
            CHECK (participation IN ('continuing', 'dropped_out')),
        UNIQUE (lg_id, farmer_number)
    )
""")

cursor.execute("""
    CREATE TABLE farmer_drafts (
        id INTEGER PRIMARY KEY,
        lg_id INTEGER NOT NULL REFERENCES learning_groups(id),
        name TEXT NOT NULL DEFAULT '',
        gender TEXT NOT NULL DEFAULT '',
        growing_cotton INTEGER,
        mobile TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
    )
""")

cursor.execute("""
    CREATE TABLE farmer_change_log (
        id INTEGER PRIMARY KEY,
        farmer_id INTEGER NOT NULL REFERENCES farmers(id),
        field TEXT NOT NULL,
        old_value TEXT NOT NULL,
        new_value TEXT NOT NULL,
        changed_on TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT ''
    )
""")

cursor.execute("CREATE UNIQUE INDEX farmers_mobile_unique ON farmers(mobile)")

pus = [
    ("INMH01", "Demo PU One"),
    ("INMH02", "Demo PU Two"),
]
villages = [
    ("Rampur", 1),
    ("Shivapur", 1),
    ("Lakhanwadi", 1),
    ("Nimgaon", 2),
    ("Kherwadi", 2),
]
facilitators = [
    ("Ravi Kumar", 1),
    ("Sunita Devi", 1),
    ("Arjun Rao", 2),
    ("Meena Joshi", 2),
]
groups = [
    (1, 1, 1),
    (1, 1, 2),
    (1, 2, 3),
    (1, 3, 4),
    (2, 4, 1),
    (2, 5, 2),
]
assignments = [
    (1, 1, "2026-01-01"),
    (2, 2, "2026-01-01"),
    (3, 1, "2026-01-01"),
    (4, 2, "2026-01-01"),
    (5, 3, "2026-01-01"),
    (6, 4, "2026-01-01"),
]

first_names = ["Ramesh", "Suresh", "Lakshmi", "Sunita", "Mahesh", "Anita",
               "Ganesh", "Kavita", "Prakash", "Meena", "Vijay", "Shobha"]
last_names = ["Patil", "Jadhav", "Shinde", "Pawar", "Kale", "More", "Gaikwad"]

farmers = []
for lg_id in range(1, len(groups) + 1):
    for number in range(1, 36):
        name = random.choice(first_names) + " " + random.choice(last_names)
        gender = random.choice(["Female", "Male"])
        growing_cotton = 1 if random.random() < 0.9 else 0
        participation = "dropped_out" if number % 8 == 0 else "continuing"
        farmers.append((lg_id, number, name, gender, growing_cotton, participation))

cursor.executemany("INSERT INTO pus (code, name) VALUES (?, ?)", pus)
cursor.executemany("INSERT INTO villages (name, pu_id) VALUES (?, ?)", villages)
cursor.executemany(
    "INSERT INTO facilitators (name, pu_id) VALUES (?, ?)", facilitators
)
cursor.executemany(
    "INSERT INTO learning_groups (pu_id, village_id, lg_number) VALUES (?, ?, ?)",
    groups,
)
cursor.executemany(
    "INSERT INTO assignments (lg_id, ff_id, start_date) VALUES (?, ?, ?)",
    assignments,
)
cursor.executemany(
    """
    INSERT INTO farmers
        (lg_id, farmer_number, name, gender, growing_cotton, participation)
    VALUES (?, ?, ?, ?, ?, ?)
    """,
    farmers,
)

cursor.execute("""
    UPDATE pus SET last_lg_number = (
        SELECT MAX(lg_number) FROM learning_groups
        WHERE learning_groups.pu_id = pus.id
    )
""")

cursor.execute("""
    UPDATE learning_groups SET last_farmer_number = (
        SELECT COALESCE(MAX(farmer_number), 0) FROM farmers
        WHERE farmers.lg_id = learning_groups.id
    )
""")

connection.commit()
connection.close()
print("Database ready")