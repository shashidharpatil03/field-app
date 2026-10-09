# One-off, safe to run more than once: gives every facilitator a made-up
# 10 digit mobile number, where they do not have one yet. The numbers are
# different from each other and from every farmer's number. Real people are
# never touched: this app only holds made-up data.
import random
import sqlite3

connection = sqlite3.connect("field.db")

columns = [row[1] for row in connection.execute("PRAGMA table_info(facilitators)")]
if "mobile" not in columns:
    connection.execute(
        """
        ALTER TABLE facilitators ADD COLUMN mobile TEXT CHECK (
            mobile IS NULL
            OR (length(mobile) = 10 AND mobile NOT GLOB '*[^0-9]*')
        )
        """
    )

used = {
    row[0]
    for row in connection.execute(
        "SELECT mobile FROM farmers WHERE mobile IS NOT NULL "
        "UNION SELECT mobile FROM facilitators WHERE mobile IS NOT NULL"
    )
}


def random_mobile():
    while True:
        number = random.choice("6789") + "".join(
            random.choice("0123456789") for _ in range(9)
        )
        if number not in used:
            used.add(number)
            return number


waiting = connection.execute(
    "SELECT id FROM facilitators WHERE mobile IS NULL ORDER BY id"
).fetchall()
for (ff_id,) in waiting:
    connection.execute(
        "UPDATE facilitators SET mobile = ? WHERE id = ?", (random_mobile(), ff_id)
    )

connection.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS facilitators_mobile_unique "
    "ON facilitators(mobile)"
)
connection.commit()
connection.close()
print("Facilitator mobile numbers ready")
