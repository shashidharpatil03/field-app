# Adds made-up change history (drop-outs and edits) so the dashboard's
# "This season" box has numbers. Safe to run more than once.
import random
import sqlite3
from datetime import date

from demo_data import add_demo_history

connection = sqlite3.connect("field.db")
add_demo_history(connection, random.Random(11), date.today())
connection.commit()
connection.close()
print("Demo history ready")
