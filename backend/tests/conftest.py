"""
pytest conftest — Test database fixtures and shared test utilities.

Provides an isolated SQLite test database that is never horizon.db.
All integration tests use this fixture to ensure safety.
"""

import os
import sys
import sqlite3
import tempfile
import pytest

# Ensure backend root is on sys.path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Override DATABASE_URL before any app imports
_TEST_DB_FD = None
_TEST_DB_PATH = None


@pytest.fixture(scope="session", autouse=True)
def _isolate_test_db():
    """Create a temporary test database for the entire test session."""
    global _TEST_DB_FD, _TEST_DB_PATH
    _TEST_DB_FD, _TEST_DB_PATH = tempfile.mkstemp(suffix=".db", prefix="horizon_test_")
    os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH}"
    os.environ["AUTH_SECRET"] = "test-secret-for-pytest-only"
    os.environ["DEMO_PASSWORD"] = "test-password"
    yield
    os.close(_TEST_DB_FD)
    os.unlink(_TEST_DB_PATH)


@pytest.fixture()
def test_db():
    """Provide a fresh database connection with tables created, rolled back after each test."""
    conn = sqlite3.connect(_TEST_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
    finally:
        conn.rollback()
        conn.close()


@pytest.fixture()
def seed_transactions(test_db):
    """Seed test transactions for graph and scoring tests."""
    transactions = [
        ("TXN-001", "CUST-A", "ACCT-A1", "CUST-B", "ACCT-B1", 5000.0, "UPI", 100, "TRANSFER", 10000.0, 5000.0, 0.0, 5000.0, "2026-08-01T10:00:00", "HIGH", "TRANSFER", "suspicious_velocity", "Test reason"),
        ("TXN-002", "CUST-A", "ACCT-A1", "CUST-C", "ACCT-C1", 3000.0, "UPI", 101, "TRANSFER", 5000.0, 2000.0, 0.0, 3000.0, "2026-08-01T10:05:00", "HIGH", "TRANSFER", "suspicious_velocity", "Test reason"),
        ("TXN-003", "CUST-A", "ACCT-A1", "CUST-D", "ACCT-D1", 2000.0, "UPI", 102, "TRANSFER", 2000.0, 0.0, 0.0, 2000.0, "2026-08-01T10:10:00", "HIGH", "TRANSFER", "suspicious_velocity", "Test reason"),
        ("TXN-004", "CUST-A", "ACCT-A1", "CUST-E", "ACCT-E1", 1000.0, "UPI", 103, "TRANSFER", 0.0, 0.0, 0.0, 1000.0, "2026-08-01T10:15:00", "HIGH", "TRANSFER", "suspicious_velocity", "Test reason"),
        ("TXN-005", "CUST-A", "ACCT-A1", "CUST-F", "ACCT-F1", 500.0, "UPI", 104, "TRANSFER", 0.0, 0.0, 0.0, 500.0, "2026-08-01T10:20:00", "HIGH", "TRANSFER", "suspicious_velocity", "Test reason"),
        ("TXN-006", "CUST-G", "ACCT-G1", "CUST-B", "ACCT-B1", 1000.0, "UPI", 100, "CASH_IN", 0.0, 1000.0, 5000.0, 6000.0, "2026-08-01T10:00:00", "LOW", "CASH_IN", "normal", "Normal transaction"),
    ]

    for txn in transactions:
        test_db.execute(
            """INSERT OR IGNORE INTO transactions
            (transaction_id, sender_id, sender_account, receiver_id, receiver_account,
             amount, channel, step, type, old_balance_orig, new_balance_orig,
             old_balance_dest, new_balance_dest, timestamp, severity, type,
             scenario_type, fraud_reason)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            txn,
        )

    # Seed a customer
    test_db.execute(
        """INSERT OR IGNORE INTO customers
        (customer_id, name, account_id, bank, kyc_status, risk_category, city, phone, created_at)
        VALUES (?,?,?,?,?,?,?,?,?)""",
        ("CUST-A", "Test User", "ACCT-A1", "TestBank", "VERIFIED", "LOW", "Mumbai", "+91-99999", "2026-01-01"),
    )
    test_db.commit()
    return transactions


@pytest.fixture()
def seed_fanout_transactions(test_db):
    """Seed 5+ outbound transfers from one sender (classic fan-out mule pattern)."""
    sender = "CUST-FANOUT"
    sender_acct = "ACCT-FANOUT-1"
    transactions = []
    for i in range(6):
        txn_id = f"TXN-FANOUT-{i+1}"
        recv_acct = f"ACCT-RECV-{i+1}"
        txn = (
            txn_id, sender, sender_acct, f"CUST-RECV-{i+1}", recv_acct,
            1000.0 * (i + 1), "UPI", 200 + i, "TRANSFER",
            50000.0, 50000.0 - 1000.0 * (i + 1),
            0.0, 1000.0 * (i + 1),
            f"2026-08-02T10:{i*5:02d}:00",
            "HIGH", "TRANSFER", "FAN_OUT", "Multiple outbound transfers",
        )
        test_db.execute(
            """INSERT OR IGNORE INTO transactions
            (transaction_id, sender_id, sender_account, receiver_id, receiver_account,
             amount, channel, step, type, old_balance_orig, new_balance_orig,
             old_balance_dest, new_balance_dest, timestamp, severity, type,
             scenario_type, fraud_reason)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            txn,
        )
        transactions.append(txn)
    test_db.commit()
    return transactions
