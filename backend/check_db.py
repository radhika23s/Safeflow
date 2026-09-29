import os
import sqlite3
from dotenv import load_dotenv

load_dotenv()

conn = sqlite3.connect("horizon.db")
c = conn.cursor()
c.execute("SELECT transaction_id, type, amount, old_balance_orig, new_balance_orig, old_balance_dest, new_balance_dest, scenario_type, severity, is_fraud FROM transactions LIMIT 10")
rows = c.fetchall()
print("Sample transactions:")
for r in rows:
    print(r)

c.execute("SELECT DISTINCT scenario_type, COUNT(*) FROM transactions GROUP BY scenario_type")
scenarios = c.fetchall()
print("\nScenarios in DB:")
for s in scenarios:
    print(s)

conn.close()
