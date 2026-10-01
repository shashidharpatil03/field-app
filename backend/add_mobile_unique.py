import sqlite3

connection = sqlite3.connect("field.db")

# An index cannot be created if two farmers already share a number,
# so look for those first.
duplicates = connection.execute(
    """
    SELECT mobile, COUNT(*) FROM farmers
    WHERE mobile IS NOT NULL
    GROUP BY mobile
    HAVING COUNT(*) > 1
    """
).fetchall()

if duplicates:
    print("Cannot continue. These mobile numbers are used more than once:")
    for mobile, count in duplicates:
        print(f"  {mobile} is used by {count} farmers")
    print("Change them in the app (Edit details) and run this script again.")
else:
    connection.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS farmers_mobile_unique ON farmers(mobile)"
    )
    connection.commit()
    print("Mobile numbers are now unique")

connection.close()
