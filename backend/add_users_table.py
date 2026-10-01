import sqlite3

from users_seed import create_users_table, seed_users

connection = sqlite3.connect("field.db")
create_users_table(connection)
seed_users(connection)
connection.commit()
connection.close()
print("Demo users ready")
