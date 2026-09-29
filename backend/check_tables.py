import sqlite3

conn = sqlite3.connect('horizon.db')
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("=== Tables ===")
for (t,) in tables:
    count = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(f"  {t}: {count} rows")

# Sample a case
print("\n=== Sample case ===")
case = conn.execute("SELECT * FROM cases LIMIT 1").fetchone()
if case:
    desc = conn.execute("SELECT * FROM cases LIMIT 1").description
    cols = [d[0] for d in conn.execute("SELECT * FROM cases LIMIT 1").description] if desc else []
    row = conn.execute("SELECT * FROM cases LIMIT 1").fetchone()
    for k, v in zip(cols, row):
        print(f"  {k}: {v}")
else:
    print("  No cases found!")

conn.close()
