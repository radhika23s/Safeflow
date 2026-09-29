"""
Reset and seed horizon.db cleanly with demo clusters and initial cases.
Purges the 300 Paysim test cases and restores the clean demo state.
"""
import os
import sqlite3
from database import init_db, DB_PATH
from seed_graph_clusters import seed

def reset():
    print(f"Target DB: {DB_PATH}")
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print("Removed old horizon.db")
    for ext in ["-wal", "-shm"]:
        if os.path.exists(DB_PATH + ext):
            os.remove(DB_PATH + ext)

    print("Initializing clean schema, default users, and regulations...")
    init_db()

    print("Seeding demo clusters, customers, and cases...")
    seed()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    cust_count = conn.execute("SELECT count(*) FROM customers").fetchone()[0]
    txn_count = conn.execute("SELECT count(*) FROM transactions").fetchone()[0]
    case_count = conn.execute("SELECT count(*) FROM cases").fetchone()[0]
    user_count = conn.execute("SELECT count(*) FROM users").fetchone()[0]
    reg_count = conn.execute("SELECT count(*) FROM regulations").fetchone()[0]

    print(f"\n--- DATABASE VERIFICATION ---")
    print(f"Customers:    {cust_count}")
    print(f"Transactions: {txn_count}")
    print(f"Cases:        {case_count}")
    print(f"Users:        {user_count}")
    print(f"Regulations:  {reg_count}")

    print("\nSeeded Cases:")
    for row in conn.execute("SELECT case_id, transaction_id, risk_score, risk_band, recommended_action FROM cases").fetchall():
        print(f"  {row['case_id']}: Txn={row['transaction_id']}, Score={row['risk_score']}, Band={row['risk_band']}, Action={row['recommended_action']}")

    conn.close()

if __name__ == "__main__":
    reset()
