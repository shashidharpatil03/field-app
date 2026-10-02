# Adds made-up "details confirmed" entries so the dashboard's progress
# tracker has some farmers already done. Safe to run more than once.
import random
import sqlite3
from datetime import date

from demo_data import add_demo_confirmations

connection = sqlite3.connect("field.db")
add_demo_confirmations(connection, random.Random(13), date.today())
connection.commit()
connection.close()
print("Demo confirmations ready")
