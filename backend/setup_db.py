import random
import sqlite3

random.seed(42)

connection = sqlite3.connect("field.db")
cursor = connection.cursor()

cursor.execute("DROP TABLE IF EXISTS farmers")
cursor.execute("DROP TABLE IF EXISTS assignments")
cursor.execute("DROP TABLE IF EXISTS facilitators")
cursor.execute("DROP TABLE IF EXISTS learning_groups")

cursor.execute("""
    CREATE TABLE learning_groups (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        village TEXT NOT NULL
    )
""")

cursor.execute("""
    CREATE TABLE facilitators (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
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
        name TEXT NOT NULL
    )
""")

groups = [
    ("LG-01", "Rampur"),
    ("LG-02", "Shivapur"),
    ("LG-03", "Lakhanwadi"),
    ("LG-04", "Nimgaon"),
]
facilitators = [
    ("Ravi Kumar",),
    ("Sunita Devi",),
    ("Arjun Rao",),
]
assignments = [
    (1, 1, "2026-01-01"),
    (2, 1, "2026-01-01"),
    (3, 2, "2026-01-01"),
    (4, 3, "2026-01-01"),
]

first_names = ["Ramesh", "Suresh", "Lakshmi", "Sunita", "Mahesh", "Anita",
               "Ganesh", "Kavita", "Prakash", "Meena", "Vijay", "Shobha"]
last_names = ["Patil", "Jadhav", "Shinde", "Pawar", "Kale", "More", "Gaikwad"]

farmers = []
for lg_id in range(1, len(groups) + 1):
    for _ in range(35):
        name = random.choice(first_names) + " " + random.choice(last_names)
        farmers.append((lg_id, name))

cursor.executemany(
    "INSERT INTO learning_groups (name, village) VALUES (?, ?)", groups
)
cursor.executemany("INSERT INTO facilitators (name) VALUES (?)", facilitators)
cursor.executemany(
    "INSERT INTO assignments (lg_id, ff_id, start_date) VALUES (?, ?, ?)",
    assignments,
)
cursor.executemany("INSERT INTO farmers (lg_id, name) VALUES (?, ?)", farmers)

connection.commit()
connection.close()
print("Database ready")