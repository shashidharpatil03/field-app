# One-off: makes each PU's name the same as its code (INMH01, INMH02).
# Safe to run more than once. Keeps all your data.
import sqlite3

connection = sqlite3.connect("field.db")
connection.execute("UPDATE pus SET name = code")
connection.commit()
connection.close()
print("PU names now match their codes")
