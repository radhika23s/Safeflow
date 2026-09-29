"""
Horizon -- Data Loader
=======================
Seeds the SQLite database from the drive_material CSV files.
Loads paysim_base_128k + synthetic S01-S10 scenarios as demo cases.

Run: python load_data.py
"""

import sqlite3
import csv
import uuid
import os
import json
from datetime import datetime, timedelta
import random

DB_PATH   = "horizon.db"
DATA_PATH = "drivematerial/drive_material/Data"

random.seed(42)

# -- Fake Indian names for account display --------------------------------
NAMES = [
    "Aarav Sharma","Vivaan Singh","Priya Patel","Anjali Verma","Rohan Kumar",
    "Neha Gupta","Arjun Reddy","Sneha Joshi","Kiran Mishra","Dev Nair",
    "Riya Shah","Yash Agarwal","Pooja Iyer","Harsh Mehta","Divya Pillai",
    "Raj Bansal","Meera Yadav","Sumit Pandey","Kavya Desai","Amit Kulkarni",
]
CITIES = ["Mumbai","Delhi","Bangalore","Hyderabad","Chennai","Pune","Kolkata","Ahmedabad"]
BANKS  = ["SBI","HDFC","ICICI","Axis","PNB","Kotak","BOB","Canara"]
KYC    = ["FULL_KYC","FULL_KYC","FULL_KYC","E_KYC","SIMPLIFIED"]


def random_ts(days_ago_max=90):
    delta = timedelta(minutes=random.randint(0, days_ago_max * 24 * 60))
    return (datetime.utcnow() - delta).isoformat()


def make_account_id(paysim_id, bank=None):
    bank = bank or random.choice(BANKS)
    return f"{bank}-{abs(hash(paysim_id)) % 100000000:08d}"


def init_db():
    from database import init_db as _init
    _init()


def load_customers(conn):
    """Create synthetic Indian customer profiles."""
    print("[CUST] Creating customer profiles...")
    seen = set()

    # Load unique account IDs from paysim_base sample
    with open(f"{DATA_PATH}/paysim_base_128k.csv", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= 500:
                break
            for pid in [row["nameOrig"], row["nameDest"]]:
                if pid not in seen:
                    seen.add(pid)

    customers = []
    for i, pid in enumerate(list(seen)[:300]):
        name = NAMES[i % len(NAMES)] + (f" {i}" if i >= len(NAMES) else "")
        bank = random.choice(BANKS)
        customers.append({
            "customer_id":       pid,
            "name":              name,
            "account_id":        make_account_id(pid, bank),
            "bank":              bank,
            "kyc_status":        random.choice(KYC),
            "risk_category":     random.choice(["LOW","LOW","MEDIUM","HIGH"]),
            "city":              random.choice(CITIES),
            "phone":             f"+91-{random.randint(7000000000,9999999999)}",
            "is_mule_suspected": 0,
            "is_pep":            0,
            "created_at":        random_ts(1800),
        })

    conn.executemany("""
        INSERT OR IGNORE INTO customers
          (customer_id,name,account_id,bank,kyc_status,risk_category,city,phone,
           is_mule_suspected,is_pep,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, [(
        c["customer_id"],c["name"],c["account_id"],c["bank"],
        c["kyc_status"],c["risk_category"],c["city"],c["phone"],
        c["is_mule_suspected"],c["is_pep"],c["created_at"]
    ) for c in customers])
    conn.commit()
    print(f"   Inserted {len(customers)} customers")


def load_transactions_base(conn, limit=300):
    """Load legit transactions from paysim_base_128k for background data."""
    print("[TXN ] Loading base transactions (legitimate)...")
    loaded = 0
    with open(f"{DATA_PATH}/paysim_base_128k.csv", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            if row["isFraud"] == "0":   # legit only
                rows.append(row)
            if len(rows) >= limit:
                break

    for row in rows:
        tid = f"TXN-{row['record_id']}"
        conn.execute("""
            INSERT OR IGNORE INTO transactions
              (transaction_id, case_id, sender_id, sender_account,
               receiver_id, receiver_account, amount, channel, step, type,
               old_balance_orig, new_balance_orig, old_balance_dest, new_balance_dest,
               timestamp, is_new_payee, is_vpn, is_fraud, alert_triggered,
               scenario_type, fraud_reason, severity)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            tid, None,
            row["nameOrig"], make_account_id(row["nameOrig"]),
            row["nameDest"], make_account_id(row["nameDest"]),
            float(row["amount"]), "UPI",
            int(row["step"]), row["type"],
            float(row["oldbalanceOrg"]), float(row["newbalanceOrig"]),
            float(row["oldbalanceDest"]), float(row["newbalanceDest"]),
            random_ts(90),
            0, 0, 0, 0,
            "LEGITIMATE", "Normal transaction", "NONE"
        ))
        loaded += 1

    conn.commit()
    print(f"   Inserted {loaded} legitimate transactions")


def load_scenario_transactions(conn):
    """Load all S01-S10 fraud scenario files as demo investigation cases."""
    print("[SCEN] Loading fraud scenario transactions...")

    # Map scenario files to friendly names
    scenarios = {
        "synthetic_S01_rapid_transfers.csv":         ("RAPID_REPEATED_TRANSFER",   "HIGH"),
        "synthetic_S02_high_value.csv":              ("HIGH_VALUE_TRANSFER",        "HIGH"),
        "synthetic_S03_account_draining.csv":        ("ACCOUNT_DRAINING",           "CRITICAL"),
        "synthetic_S04_new_beneficiary.csv":         ("NEW_BENEFICIARY_FRAUD",      "HIGH"),
        "synthetic_S05_multiple_small_transactions.csv": ("STRUCTURING",            "MEDIUM"),
        "synthetic_S06_transfer_cashout.csv":        ("TRANSFER_THEN_CASH_OUT",     "CRITICAL"),
        "synthetic_S07_dormant_account.csv":         ("DORMANT_ACCOUNT_ACTIVATED",  "HIGH"),
        "synthetic_S08_destination_concentration.csv":("DESTINATION_CONCENTRATION","HIGH"),
        "synthetic_S09_circular_transactions.csv":   ("CIRCULAR_TRANSACTIONS",      "CRITICAL"),
        "synthetic_S10_fund_dispersion.csv":         ("FUND_DISPERSION_MULE",       "CRITICAL"),
    }

    total_loaded = 0
    for filename, (scenario_type, severity) in scenarios.items():
        filepath = f"{DATA_PATH}/{filename}"
        if not os.path.exists(filepath):
            print(f"   Skipping {filename} (not found)")
            continue

        with open(filepath, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            count  = 0
            for row in reader:
                if count >= 5:   # take 5 transactions per scenario for demo
                    break
                tid = f"TXN-{row['record_id']}"
                fraud_reason = row.get("fraud_reason",
                    f"Suspicious {scenario_type.replace('_',' ').lower()} pattern detected")

                conn.execute("""
                    INSERT OR IGNORE INTO transactions
                      (transaction_id, case_id, sender_id, sender_account,
                       receiver_id, receiver_account, amount, channel, step, type,
                       old_balance_orig, new_balance_orig, old_balance_dest, new_balance_dest,
                       timestamp, is_new_payee, is_vpn, is_fraud, alert_triggered,
                       scenario_type, fraud_reason, severity)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    tid, None,
                    row["nameOrig"], make_account_id(row["nameOrig"]),
                    row["nameDest"], make_account_id(row["nameDest"]),
                    float(row["amount"]), "UPI",
                    int(row["step"]), row["type"],
                    float(row["oldbalanceOrg"]), float(row["newbalanceOrig"]),
                    float(row["oldbalanceDest"]), float(row["newbalanceDest"]),
                    random_ts(30),
                    1, 0, 1, 1,
                    scenario_type, fraud_reason, severity
                ))
                count += 1
                total_loaded += 1

    conn.commit()
    print(f"   Inserted {total_loaded} fraud scenario transactions")


def load_legitimate_counterexamples(conn):
    """Load L01-L10 legitimate counterexamples (false positive demos)."""
    print("[LEG ] Loading legitimate counterexample transactions...")

    legit_files = [
        "synthetic_L01_legitimate_high_value.csv",
        "synthetic_L03_legitimate_high_value_history.csv",
        "synthetic_L06_legitimate_transfer_cashout.csv",
    ]

    total = 0
    for filename in legit_files:
        filepath = f"{DATA_PATH}/{filename}"
        if not os.path.exists(filepath):
            continue
        with open(filepath, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            count  = 0
            for row in reader:
                if count >= 3:
                    break
                tid = f"TXN-{row['record_id']}"
                conn.execute("""
                    INSERT OR IGNORE INTO transactions
                      (transaction_id, case_id, sender_id, sender_account,
                       receiver_id, receiver_account, amount, channel, step, type,
                       old_balance_orig, new_balance_orig, old_balance_dest, new_balance_dest,
                       timestamp, is_new_payee, is_vpn, is_fraud, alert_triggered,
                       scenario_type, fraud_reason, severity)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    tid, None,
                    row["nameOrig"], make_account_id(row["nameOrig"]),
                    row["nameDest"], make_account_id(row["nameDest"]),
                    float(row["amount"]), "UPI",
                    int(row["step"]), row["type"],
                    float(row["oldbalanceOrg"]), float(row["newbalanceOrig"]),
                    float(row["oldbalanceDest"]), float(row["newbalanceDest"]),
                    random_ts(30),
                    0, 0, 0, 1,  # alert_triggered=1 (it looked suspicious) but is_fraud=0
                    row.get("scenario_type", "LEGITIMATE_COUNTEREXAMPLE"),
                    row.get("fraud_reason", "High-value transaction within legitimate distribution"),
                    "NONE"
                ))
                count += 1
                total += 1

    conn.commit()
    print(f"   Inserted {total} legitimate counterexample transactions")


def print_summary(conn):
    customers = conn.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
    txns      = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
    fraud     = conn.execute("SELECT COUNT(*) FROM transactions WHERE is_fraud=1").fetchone()[0]
    cases     = conn.execute("SELECT COUNT(*) FROM cases").fetchone()[0]

    print("\n=== Database Summary ===")
    print(f"   Customers    : {customers}")
    print(f"   Transactions : {txns}  (fraud={fraud}, legit={txns-fraud})")
    print(f"   Cases        : {cases}")
    print(f"\nDatabase ready: {DB_PATH}")


if __name__ == "__main__":
    print("\nHorizon -- Data Loader")
    print("=" * 40)

    # Wipe and re-init
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f"Removed old {DB_PATH}")

    init_db()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    load_customers(conn)
    load_transactions_base(conn)
    load_scenario_transactions(conn)
    load_legitimate_counterexamples(conn)
    print_summary(conn)
    conn.close()

    print("\nDone! Run the server: uvicorn main:app --reload")
