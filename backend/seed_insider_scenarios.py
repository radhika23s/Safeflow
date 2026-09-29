"""
Seed Insider Scenarios — Employee / Access-Risk Layer
=====================================================
Populates the insider-risk tables required by the PS:
  - employees                (bank staff with role, branch, access tier & rights)
  - employee_account_links   (related-party / self accounts, declared or undeclared)
  - employee_activity_log    (access events interleaved with money flow)
  - transactions.processed_by (which employee processed each transaction)
  - legitimate control transactions processed by benign employees

Suspicious insiders seeded (linked to the existing demo clusters):
  EMP-002 Vikram Desai  — RM, Mumbai.   Processed feeder + cash-out for the mule
                          ring case FC-20260815-8E916E. Undeclared relative account
                          is the ORIGIN of the structuring case (HDFC-44344942).
  EMP-003 Sanjay Kulkarni — Ops Officer, Bengaluru. Processed all 4 sub-threshold
                          structuring transfers (TXN-STR-01..04) including one to
                          his own undeclared cousin account (ICICI-63650963).
  EMP-007 Rakesh Yadav  — Clearing Officer, Bengaluru. Processed the circular
                          round-trip loop (TXN-CIRC-01..03); undeclared spouse
                          account Canara-84073862 is a cycle node.

Benign controls (must NOT raise insider alerts — false-positive guards):
  EMP-001/004/005/006/008 with routine declared accounts and business-hours activity.
"""

import os
import sqlite3
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "horizon.db")

# Transaction -> processing employee. Imported by seed_graph_clusters so that
# attribution survives INSERT OR REPLACE re-seeding.
ATTRIBUTION = {
    "TXN-FEEDER-01": "EMP-002",   # RM processed feeder into syndicate origin
    "TXN-MULE-01": "EMP-005",     # benign teller (control)
    "TXN-MULE-02": "EMP-005",     # benign teller (control)
    "TXN-MULE-03": "EMP-002",     # RM processed the critical cash-out
    "TXN-STR-01": "EMP-003",      # ops officer processed all structuring splits
    "TXN-STR-02": "EMP-003",
    "TXN-STR-03": "EMP-003",
    "TXN-STR-04": "EMP-003",
    "TXN-CIRC-01": "EMP-007",     # clearing officer processed round-trip loop
    "TXN-CIRC-02": "EMP-007",
    "TXN-CIRC-03": "EMP-007",
}


def seed_insider(conn: sqlite3.Connection | None = None) -> None:
    """Seed employees, links, activity, and processed_by attribution.

    Accepts an optional open connection (used by database.init_db so the seed
    participates in the same transaction); otherwise opens DB_PATH directly.
    """
    own_conn = conn is None
    if own_conn:
        conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    now = datetime.now()

    # ── 1. Employee directory (staff + access rights) ─────────────────────────
    employees = [
        # employee_id, name, designation, department, branch_id, branch_city,
        # access_tier, access_rights, status, hired_at
        ("EMP-001", "Rahul Mehta", "Teller", "Branch Operations", "BR-MUM-014", "Mumbai",
         "STANDARD", "deposit,withdrawal,account_view", "ACTIVE", (now - timedelta(days=1400)).isoformat()),
        ("EMP-002", "Vikram Desai", "Relationship Manager", "Retail Banking", "BR-MUM-014", "Mumbai",
         "ELEVATED", "account_view,transfer_initiate,kyc_update", "ACTIVE", (now - timedelta(days=950)).isoformat()),
        ("EMP-003", "Sanjay Kulkarni", "Operations Officer", "Transaction Ops", "BR-BLR-007", "Bengaluru",
         "ELEVATED", "account_view,transfer_initiate,limit_override", "ACTIVE", (now - timedelta(days=720)).isoformat()),
        ("EMP-004", "Anita Rao", "Branch Manager", "Branch Management", "BR-MUM-014", "Mumbai",
         "HIGH", "transfer_approve,limit_override,user_provision,account_view", "ACTIVE", (now - timedelta(days=2200)).isoformat()),
        ("EMP-005", "Farhan Ali", "Teller", "Branch Operations", "BR-BLR-007", "Bengaluru",
         "STANDARD", "deposit,withdrawal,account_view", "ACTIVE", (now - timedelta(days=410)).isoformat()),
        ("EMP-006", "Deepa Iyer", "Compliance Officer", "Compliance", "HQ-MUM-001", "Mumbai",
         "HIGH", "case_review,report_export,audit_view", "ACTIVE", (now - timedelta(days=1600)).isoformat()),
        ("EMP-007", "Rakesh Yadav", "Clearing Officer", "Clearing & Settlement", "BR-BLR-007", "Bengaluru",
         "ELEVATED", "account_view,transfer_initiate,bulk_upload", "ACTIVE", (now - timedelta(days=560)).isoformat()),
        ("EMP-008", "Sneha Kulkarni", "Customer Service Exec", "Branch Operations", "BR-MUM-014", "Mumbai",
         "STANDARD", "account_view", "ACTIVE", (now - timedelta(days=230)).isoformat()),
    ]
    for emp in employees:
        c.execute("""
            INSERT OR IGNORE INTO employees (
                employee_id, name, designation, department, branch_id, branch_city,
                access_tier, access_rights, employee_status, hired_at, created_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, emp + (now.isoformat(),))

    # ── 2. Employee ↔ account links (related-party accounts) ──────────────────
    # declared=0 links to accounts appearing in fraud clusters are the key signal.
    links = [
        # employee_id, account_id, customer_id, relationship, declared
        ("EMP-001", "SBI-44011209", None, "SELF", 1),
        ("EMP-002", "ICICI-77100288", None, "SELF", 1),
        ("EMP-002", "HDFC-44344942", "CUST-STR-S", "SISTER-IN-LAW", 0),   # structuring origin
        ("EMP-003", "SBI-33004517", None, "SELF", 1),
        ("EMP-003", "ICICI-63650963", "CUST-STR-R2", "COUSIN", 0),        # structuring hop 2
        ("EMP-004", "HDFC-99031121", None, "SELF", 1),
        ("EMP-005", "SBI-88112039", None, "SELF", 1),
        ("EMP-007", "Axis-77810233", None, "SELF", 1),
        ("EMP-007", "Canara-84073862", "CUST-Canara-84073862", "SPOUSE", 0),  # circular cycle node
        ("EMP-008", "Axis-20991184", None, "SELF", 1),
    ]
    for emp_id, acct, cust_id, rel, declared in links:
        c.execute("""
            INSERT OR IGNORE INTO employee_account_links
                (employee_id, account_id, customer_id, relationship, declared)
            VALUES (?,?,?,?,?)
        """, (emp_id, acct, cust_id, rel, declared))

    # ── 3. Employee activity log (access events around suspicious clusters) ───
    # Idempotent: skip if events already seeded (plain INSERTs, no natural key).
    existing_activity = c.execute("SELECT count(*) FROM employee_activity_log").fetchone()[0]
    if existing_activity == 0:
        _seed_activity(c, now)

    # ── 4. processed_by attribution on existing cluster transactions ──────────
    for txn_id, emp_id in ATTRIBUTION.items():
        c.execute(
            "UPDATE transactions SET processed_by = ? WHERE transaction_id = ?",
            (emp_id, txn_id),
        )

    # ── 5. Benign control transactions (false-positive guards) ────────────────
    _seed_benign_controls(c, now, base=now - timedelta(hours=6))

    conn.commit()
    if own_conn:
        conn.close()
    counts = _counts(conn if not own_conn else sqlite3.connect(DB_PATH))
    print("Successfully seeded insider scenarios:",
          f"employees={counts['employees']}, links={counts['links']}, "
          f"activity={counts['activity']}, attributed={counts['attributed']}")


def _seed_activity(c, now: datetime) -> None:
    """Insert employee access events around the suspicious cluster windows."""
    base = now - timedelta(hours=6)
    events = [
        # employee_id, action, entity_ref, details, timestamp
        # -- Insider-interest events -------------------------------------------------
        ("EMP-003", "LOGIN", "portal", "Login at 02:47 local time — outside assigned shift (09:00-18:00)",
         (base + timedelta(minutes=0)).isoformat()),
        ("EMP-003", "TXN_OVERRIDE", "TXN-STR-02", "Applied manual limit override on sub-threshold transfer; no manager countersign recorded",
         (base + timedelta(minutes=3)).isoformat()),
        ("EMP-003", "PROFILE_UPDATE", "CUST-STR-R2", "Changed registered phone number of related-party customer 12 minutes before transfer",
         (base + timedelta(minutes=6)).isoformat()),
        ("EMP-002", "PAYEE_ADDED", "Canara-36480482", "Added high-risk beneficiary as new payee for customer portfolio",
         (base + timedelta(minutes=10)).isoformat()),
        ("EMP-002", "ACCOUNT_VIEW", "CUST-36480482", "Viewed customer profile 6 times within 10 minutes (baseline: <1/day)",
         (base + timedelta(minutes=12)).isoformat()),
        ("EMP-007", "BULK_UPLOAD", "BEN-LIST-7741", "Bulk beneficiary upload of 3 accounts immediately preceding round-trip transfers",
         (base + timedelta(minutes=14)).isoformat()),
        ("EMP-007", "TXN_QUEUE_BYPASS", "TXN-CIRC-02", "Moved RTGS out of standard verification queue citing 'priority corporate'",
         (base + timedelta(minutes=20)).isoformat()),
        # -- Benign control events (false-positive guards) ---------------------------
        ("EMP-004", "TRANSFER_APPROVE", "TXN-LEG-01", "Approved corporate payroll transfer during business hours with full documentation",
         (base + timedelta(minutes=30)).isoformat()),
        ("EMP-005", "LOGIN", "portal", "Login at 09:58 local time — within assigned shift",
         (base + timedelta(minutes=40)).isoformat()),
        ("EMP-006", "CASE_REVIEW", "FC-20260904-STR01", "Routine compliance QC review of open case",
         (base + timedelta(minutes=50)).isoformat()),
        ("EMP-001", "DEPOSIT", "BR-MUM-014", "Routine cash deposit intake, counter 3",
         (base + timedelta(minutes=55)).isoformat()),
    ]
    for emp_id, action, ref, details, ts in events:
        c.execute("""
            INSERT INTO employee_activity_log (employee_id, action, entity_ref, details, timestamp)
            VALUES (?,?,?,?,?)
        """, (emp_id, action, ref, details, ts))


def _seed_benign_controls(c, now: datetime, base: datetime) -> None:
    """Insert legitimate control transactions processed by benign employees."""
    leg_txns = [
        # Corporate payroll batch approved by branch manager EMP-004
        ("TXN-LEG-01", None, "CUST-LEG-PAYROLL", "HDFC-22001145",
         "CUST-LEG-VENDOR", "HDFC-33002267", 450000.0, "NEFT", 11, "TRANSFER",
         900000.0, 450000.0, 120000.0, 570000.0,
         (base + timedelta(minutes=31)).isoformat(),
         "DEV-LEG-01", "103.21.9.40", "Mumbai",
         0, 0, None, 0, 0, "LEGITIMATE_CONTROL", None, "NONE", "EMP-004"),
        # Routine salary credit processed by teller EMP-005
        ("TXN-LEG-02", None, "CUST-LEG-SALARY", "SBI-55003321",
         "CUST-LEG-EMPLOYEE", "SBI-66004432", 62000.0, "IMPS", 10, "TRANSFER",
         80000.0, 18000.0, 4000.0, 66000.0,
         (base + timedelta(minutes=42)).isoformat(),
         "DEV-LEG-02", "49.37.8.12", "Bengaluru",
         0, 0, None, 0, 0, "LEGITIMATE_CONTROL", None, "NONE", "EMP-005"),
    ]
    for t in leg_txns:
        c.execute("""
            INSERT OR IGNORE INTO transactions (
                transaction_id, case_id, sender_id, sender_account,
                receiver_id, receiver_account, amount, channel, step, type,
                old_balance_orig, new_balance_orig, old_balance_dest, new_balance_dest,
                timestamp, device_id, ip_address, location_city,
                is_new_payee, is_vpn, fraud_type, is_fraud, alert_triggered,
                scenario_type, fraud_reason, severity, processed_by
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, t)
    for cust_id, name, acct in [
        ("CUST-LEG-PAYROLL", "Megatech Solutions Pvt Ltd", "HDFC-22001145"),
        ("CUST-LEG-VENDOR", "Bright Facilities Services", "HDFC-33002267"),
        ("CUST-LEG-SALARY", "Innovate Labs India", "SBI-55003321"),
        ("CUST-LEG-EMPLOYEE", "Kavita Nair", "SBI-66004432"),
    ]:
        c.execute("""
            INSERT OR IGNORE INTO customers (
                customer_id, name, account_id, bank, kyc_status, risk_category,
                city, phone, is_mule_suspected, is_pep, created_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (cust_id, name, acct, acct.split("-")[0], "FULL_KYC", "LOW",
              "Mumbai", "+9198200000000", 0, 0, now.isoformat()))


def _counts(conn: sqlite3.Connection) -> dict:
    try:
        return {
            "employees": conn.execute("SELECT count(*) FROM employees").fetchone()[0],
            "links": conn.execute("SELECT count(*) FROM employee_account_links").fetchone()[0],
            "activity": conn.execute("SELECT count(*) FROM employee_activity_log").fetchone()[0],
            "attributed": conn.execute(
                "SELECT count(*) FROM transactions WHERE processed_by IS NOT NULL"
            ).fetchone()[0],
        }
    except sqlite3.OperationalError:
        return {"employees": 0, "links": 0, "activity": 0, "attributed": 0}


if __name__ == "__main__":
    seed_insider()
