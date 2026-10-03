# One-off, safe to run more than once: gives the made-up farmers a middle
# name and a made-up 10 digit mobile number, where they do not have one yet.
# Real farmers are never touched: this app only holds made-up data.
import random
import sqlite3

from name_parts import build_name

middle_names = ["Dnyaneshwar", "Bhaskar", "Raghunath", "Shivaji", "Namdev",
                "Balu", "Sambhaji", "Dattatray", "Eknath", "Tukaram",
                "Madhav", "Vitthal"]

connection = sqlite3.connect("field.db")
used = {
    row[0]
    for row in connection.execute("SELECT mobile FROM farmers WHERE mobile IS NOT NULL")
}


def random_mobile():
    while True:
        number = random.choice("6789") + "".join(
            random.choice("0123456789") for _ in range(9)
        )
        if number not in used:
            used.add(number)
            return number


rows = connection.execute(
    "SELECT id, first_name, middle_name, last_name, mobile FROM farmers"
).fetchall()
for farmer_id, first, middle, last, mobile in rows:
    if middle == "":
        middle = random.choice(middle_names)
    # About 1 farmer in 20 is left without a phone number.
    if mobile is None and random.random() < 0.95:
        mobile = random_mobile()
    connection.execute(
        "UPDATE farmers SET middle_name = ?, name = ?, mobile = ? WHERE id = ?",
        (middle, build_name(first, middle, last), mobile, farmer_id),
    )
connection.commit()
connection.close()
print("Middle names and mobile numbers added")
