"""
Seed Graph Clusters — Enrich database with realistic multi-hop fraud topologies.
Schema:
['transaction_id', 'case_id', 'sender_id', 'sender_account', 'receiver_id', 'receiver_account', 
 'amount', 'channel', 'step', 'type', 'old_balance_orig', 'new_balance_orig', 'old_balance_dest', 
 'new_balance_dest', 'timestamp', 'device_id', 'ip_address', 'location_city', 'is_new_payee', 
 'is_vpn', 'fraud_type', 'is_fraud', 'alert_triggered', 'scenario_type', 'fraud_reason', 'severity']
"""

import sqlite3
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "horizon.db")


def _resolve_db_path() -> str:
    """Honor DATABASE_URL so the seed lands in the same DB the app reads.

    Mirrors database.py's resolution: an absolute path (or aiosqlite URL) is
    used as-is; relative paths resolve against the backend directory.
    """
    raw = os.getenv("DATABASE_URL", "")
    if not raw or raw == "sqlite+aiosqlite:///./horizon.db":
        return DB_PATH
    candidate = raw.replace("sqlite+aiosqlite:///./", "").replace("sqlite:///", "")
    if not os.path.isabs(candidate):
        candidate = os.path.join(os.path.dirname(os.path.abspath(__file__)), candidate)
    return candidate


def seed():
    conn = sqlite3.connect(_resolve_db_path())
    c = conn.cursor()

    now = datetime.now()

    # --------------------------------------------------------------------------
    # 0. Seed Cluster Customers
    # --------------------------------------------------------------------------
    customers = [
        ("CUST-FEEDER-1", "Aarav Sharma", "SBI-91028312", "SBI", "FULL_KYC", "LOW", "Mumbai", "+919820112233", 0, 0, (now - timedelta(days=60)).isoformat()),
        ("CUST-FEEDER-2", "Rohan Kumar", "HDFC-11209485", "HDFC", "FULL_KYC", "LOW", "Delhi", "+919820112234", 0, 0, (now - timedelta(days=55)).isoformat()),
        ("CUST-36480482", "Vikram Malhotra", "Canara-36480482", "Canara", "SIMPLIFIED", "CRITICAL", "Mumbai", "+919820112235", 1, 0, (now - timedelta(days=30)).isoformat()),
        ("CUST-74333786", "Suresh Nair", "Kotak-74333786", "Kotak", "E_KYC", "CRITICAL", "Surat", "+919820112236", 1, 0, (now - timedelta(days=20)).isoformat()),
        ("CUST-MULE-1", "Kiran Joshi", "Axis-55019283", "Axis", "SIMPLIFIED", "HIGH", "Surat", "+919820112237", 1, 0, (now - timedelta(days=10)).isoformat()),
        ("CUST-MULE-2", "Pooja Patel", "ICICI-88192039", "ICICI", "SIMPLIFIED", "HIGH", "Ahmedabad", "+919820112238", 1, 0, (now - timedelta(days=10)).isoformat()),
        ("CUST-MULE-3", "Dev Yadav", "Paytm-99018274", "Paytm", "SIMPLIFIED", "CRITICAL", "Jaipur", "+919820112239", 1, 0, (now - timedelta(days=5)).isoformat()),
        ("CUST-STR-S", "Anjali Verma", "HDFC-44344942", "HDFC", "FULL_KYC", "CRITICAL", "Bengaluru", "+919820112240", 0, 0, (now - timedelta(days=90)).isoformat()),
        ("CUST-STR-R0", "Raj Bansal", "Axis-20152485", "Axis", "E_KYC", "MEDIUM", "Bengaluru", "+919820112241", 0, 0, (now - timedelta(days=40)).isoformat()),
        ("CUST-STR-R2", "Sneha Rao", "ICICI-63650963", "ICICI", "E_KYC", "MEDIUM", "Bengaluru", "+919820112242", 0, 0, (now - timedelta(days=40)).isoformat()),
        ("CUST-STR-R4", "Amit Kulkarni", "BOB-85021338", "BOB", "E_KYC", "MEDIUM", "Bengaluru", "+919820112243", 0, 0, (now - timedelta(days=40)).isoformat()),
        ("CUST-STR-R7", "Meera Desai", "Canara-85484212", "Canara", "E_KYC", "MEDIUM", "Bengaluru", "+919820112244", 0, 0, (now - timedelta(days=40)).isoformat()),
        ("CUST-Axis-36480482", "Yash Agarwal", "Axis-36480482", "Axis", "FULL_KYC", "CRITICAL", "Mumbai", "+919820112245", 0, 0, (now - timedelta(days=120)).isoformat()),
        ("CUST-PNB-91699287", "Sumit Gupta", "PNB-91699287", "PNB", "FULL_KYC", "CRITICAL", "Mumbai", "+919820112246", 0, 0, (now - timedelta(days=110)).isoformat()),
        ("CUST-Canara-84073862", "Priya Reddy", "Canara-84073862", "Canara", "FULL_KYC", "CRITICAL", "Mumbai", "+919820112247", 0, 0, (now - timedelta(days=100)).isoformat()),
    ]
    for cust in customers:
        c.execute("""
            INSERT OR REPLACE INTO customers (
                customer_id, name, account_id, bank, kyc_status,
                risk_category, city, phone, is_mule_suspected, is_pep, created_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, cust)

    # --------------------------------------------------------------------------
    # 1. Cluster for FC-20260815-8E916E (Canara-36480482 -> Kotak-74333786)
    # --------------------------------------------------------------------------
    base_time = now - timedelta(hours=3)
    
    feeder_and_mule_txns = [
        # Upstream Feeders -> Canara-36480482
        (
            "TXN-FEEDER-01", "FC-20260815-8E916E",
            "CUST-FEEDER-1", "SBI-91028312",
            "CUST-36480482", "Canara-36480482",
            95000.0, "IMPS", 1, "TRANSFER",
            120000.0, 25000.0, 5000.0, 100000.0,
            (base_time - timedelta(minutes=25)).isoformat(),
            "DEV-F01", "103.21.244.11", "Mumbai",
            0, 0, "AGGREGATION_FEEDER", 0, 0,
            "AGGREGATION_FEEDER", "Feeder transfer pooling funds into syndicate origin", "LOW"
        ),
        (
            "TXN-FEEDER-02", "FC-20260815-8E916E",
            "CUST-FEEDER-2", "HDFC-11209485",
            "CUST-36480482", "Canara-36480482",
            100000.0, "NEFT", 2, "TRANSFER",
            150000.0, 50000.0, 100000.0, 200000.0,
            (base_time - timedelta(minutes=15)).isoformat(),
            "DEV-F02", "103.21.244.12", "Delhi",
            0, 0, "AGGREGATION_FEEDER", 0, 0,
            "AGGREGATION_FEEDER", "Feeder transfer pooling funds into syndicate origin", "LOW"
        ),
        # Downstream Mule Fan-Out from Kotak-74333786
        (
            "TXN-MULE-01", "FC-20260815-8E916E",
            "CUST-74333786", "Kotak-74333786",
            "CUST-MULE-1", "Axis-55019283",
            58000.0, "UPI", 3, "TRANSFER",
            181684.0, 123684.0, 1200.0, 59200.0,
            (base_time + timedelta(minutes=4)).isoformat(),
            "DEV-M01", "45.112.55.10", "Surat",
            1, 1, "MULE_DISPERSION", 1, 1,
            "MULE_DISPERSION", "Rapid fan-out mule dispersion following major inward credit", "HIGH"
        ),
        (
            "TXN-MULE-02", "FC-20260815-8E916E",
            "CUST-74333786", "Kotak-74333786",
            "CUST-MULE-2", "ICICI-88192039",
            62000.0, "UPI", 4, "TRANSFER",
            123684.0, 61684.0, 500.0, 62500.0,
            (base_time + timedelta(minutes=6)).isoformat(),
            "DEV-M02", "45.112.55.11", "Ahmedabad",
            1, 1, "MULE_DISPERSION", 1, 1,
            "MULE_DISPERSION", "Rapid fan-out mule dispersion following major inward credit", "HIGH"
        ),
        (
            "TXN-MULE-03", "FC-20260815-8E916E",
            "CUST-74333786", "Kotak-74333786",
            "CUST-MULE-3", "Paytm-99018274",
            60000.0, "UPI", 5, "TRANSFER",
            61684.0, 1684.0, 200.0, 60200.0,
            (base_time + timedelta(minutes=8)).isoformat(),
            "DEV-M03", "45.112.55.12", "Jaipur",
            1, 1, "MULE_DISPERSION", 1, 1,
            "MULE_DISPERSION", "Account draining cashout through third mule account", "CRITICAL"
        ),
    ]

    for t in feeder_and_mule_txns:
        c.execute("""
            INSERT OR REPLACE INTO transactions (
                transaction_id, case_id, sender_id, sender_account,
                receiver_id, receiver_account, amount, channel, step, type,
                old_balance_orig, new_balance_orig, old_balance_dest, new_balance_dest,
                timestamp, device_id, ip_address, location_city,
                is_new_payee, is_vpn, fraud_type, is_fraud, alert_triggered,
                scenario_type, fraud_reason, severity
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, t)

    # Add case for feeder and mule dispersion cluster (FC-20260815-8E916E)
    c.execute("""
        INSERT OR REPLACE INTO cases (
            case_id, transaction_id, status, risk_score, risk_band, recommended_action,
            analyst_id, opened_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "FC-20260815-8E916E", "TXN-FEEDER-01", "OPEN", 94.2, "CRITICAL", "BLOCK",
        "Alex Chen", base_time.isoformat(), base_time.isoformat()
    ))

    # Add case for high-velocity mule cashout (FC-20260815-83D0B1)
    c.execute("""
        INSERT OR REPLACE INTO cases (
            case_id, transaction_id, status, risk_score, risk_band, recommended_action,
            analyst_id, opened_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "FC-20260815-83D0B1", "TXN-MULE-03", "OPEN", 99.8, "CRITICAL", "BLOCK",
        "INV-CURRENT", base_time.isoformat(), base_time.isoformat()
    ))

    # --------------------------------------------------------------------------
    # 2. Structuring / Smurfing Case: FC-20260904-STR01
    # --------------------------------------------------------------------------
    struct_sender = "HDFC-44344942"
    struct_time = now - timedelta(hours=1)
    
    structuring_txns = [
        ("TXN-STR-01", struct_sender, "Axis-20152485", 48500.0, 0),
        ("TXN-STR-02", struct_sender, "ICICI-63650963", 49200.0, 2),
        ("TXN-STR-03", struct_sender, "BOB-85021338", 47800.0, 4),
        ("TXN-STR-04", struct_sender, "Canara-85484212", 46900.0, 7),
    ]

    for tx_id, s_acc, r_acc, amt, offset_min in structuring_txns:
        c.execute("""
            INSERT OR REPLACE INTO transactions (
                transaction_id, case_id, sender_id, sender_account,
                receiver_id, receiver_account, amount, channel, step, type,
                old_balance_orig, new_balance_orig, old_balance_dest, new_balance_dest,
                timestamp, device_id, ip_address, location_city,
                is_new_payee, is_vpn, fraud_type, is_fraud, alert_triggered,
                scenario_type, fraud_reason, severity
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            tx_id, "FC-20260904-STR01",
            "CUST-STR-S", s_acc,
            f"CUST-STR-R{offset_min}", r_acc,
            amt, "UPI", offset_min, "TRANSFER",
            200000.0, 200000.0 - amt, 1000.0, 1000.0 + amt,
            (struct_time + timedelta(minutes=offset_min)).isoformat(),
            "DEV-STR01", "185.220.101.5", "Bengaluru",
            1, 1, "STRUCTURING", 1, 1,
            "STRUCTURING",
            "Multiple sub-50,000 INR transfers in under 10 minutes to evade PMLA threshold",
            "CRITICAL"
        ))

    # Add case for structuring
    c.execute("""
        INSERT OR REPLACE INTO cases (
            case_id, transaction_id, status, risk_score, risk_band, recommended_action,
            analyst_id, opened_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "FC-20260904-STR01", "TXN-STR-01", "OPEN", 98.4, "CRITICAL", "ESCALATE",
        "INV-CURRENT", struct_time.isoformat(), struct_time.isoformat()
    ))

    # --------------------------------------------------------------------------
    # 3. Circular Flow Case: FC-20260904-CIRC01
    # --------------------------------------------------------------------------
    circ_time = now - timedelta(hours=2)
    circular_txns = [
        ("TXN-CIRC-01", "Axis-36480482", "PNB-91699287", 813608.0, 0),
        ("TXN-CIRC-02", "PNB-91699287", "Canara-84073862", 810000.0, 5),
        ("TXN-CIRC-03", "Canara-84073862", "Axis-36480482", 805000.0, 11),
    ]

    for tx_id, s_acc, r_acc, amt, offset_min in circular_txns:
        c.execute("""
            INSERT OR REPLACE INTO transactions (
                transaction_id, case_id, sender_id, sender_account,
                receiver_id, receiver_account, amount, channel, step, type,
                old_balance_orig, new_balance_orig, old_balance_dest, new_balance_dest,
                timestamp, device_id, ip_address, location_city,
                is_new_payee, is_vpn, fraud_type, is_fraud, alert_triggered,
                scenario_type, fraud_reason, severity
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            tx_id, "FC-20260904-CIRC01",
            f"CUST-{s_acc}", s_acc,
            f"CUST-{r_acc}", r_acc,
            amt, "RTGS", offset_min, "TRANSFER",
            900000.0, 900000.0 - amt, 50000.0, 50000.0 + amt,
            (circ_time + timedelta(minutes=offset_min)).isoformat(),
            "DEV-CIRC", "192.168.1.1", "Mumbai",
            0, 0, "CIRCULAR_TRANSACTIONS", 1, 1,
            "CIRCULAR_TRANSACTIONS",
            "Closed loop fund cycling detected across 3 accounts (Round-tripping)",
            "CRITICAL"
        ))

    c.execute("""
        INSERT OR REPLACE INTO cases (
            case_id, transaction_id, status, risk_score, risk_band, recommended_action,
            analyst_id, opened_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "FC-20260904-CIRC01", "TXN-CIRC-01", "OPEN", 99.2, "CRITICAL", "ESCALATE",
        "INV-CURRENT", circ_time.isoformat(), circ_time.isoformat()
    ))

    # Apply insider attribution (processed_by) — must run AFTER transaction
    # inserts because INSERT OR REPLACE resets unlisted columns to defaults.
    try:
        from seed_insider_scenarios import ATTRIBUTION
        for txn_id, emp_id in ATTRIBUTION.items():
            c.execute(
                "UPDATE transactions SET processed_by = ? WHERE transaction_id = ?",
                (emp_id, txn_id),
            )
    except Exception as e:
        print(f"[STARTUP NOTICE] Insider attribution skipped: {e}")

    conn.commit()
    conn.close()
    print("Successfully seeded multi-hop clusters, structuring case, and circular cycle!")

if __name__ == "__main__":
    seed()
