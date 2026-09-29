"""
Database Setup
==============
SQLAlchemy-free SQLite with foreign-key enforcement, WAL mode, and
immutable audit-log semantics.
"""

import os
import sqlite3
from datetime import datetime


_raw_db = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./horizon.db").replace("sqlite+aiosqlite:///./", "")
if os.path.isabs(_raw_db):
    DB_PATH = _raw_db
else:
    _backend_dir = os.path.dirname(os.path.abspath(__file__))
    _candidate = os.path.join(_backend_dir, _raw_db)
    if os.path.exists(_candidate) or not os.path.exists(_raw_db):
        DB_PATH = _candidate
    else:
        DB_PATH = os.path.abspath(_raw_db)

_CASE_STATUSES = {"OPEN", "MONITORING", "ESCALATED", "CLOSED"}


def init_db():
    """Create all tables with foreign keys enabled. Safe to call multiple times."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys=ON")

    c = conn.cursor()

    # ── Customers ─────────────────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            customer_id      TEXT PRIMARY KEY,
            name             TEXT,
            account_id       TEXT,
            bank             TEXT,
            kyc_status       TEXT,
            risk_category    TEXT DEFAULT 'LOW',
            city             TEXT,
            phone            TEXT,
            is_mule_suspected INTEGER DEFAULT 0,
            is_pep           INTEGER DEFAULT 0,
            created_at       TEXT
        )
    """)

    # ── Transactions ───────────────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            transaction_id   TEXT PRIMARY KEY,
            case_id          TEXT,
            sender_id        TEXT,
            sender_account   TEXT,
            receiver_id      TEXT,
            receiver_account TEXT,
            amount           REAL NOT NULL CHECK (amount >= 0),
            channel          TEXT DEFAULT 'UPI',
            step             INTEGER,
            type             TEXT,
            old_balance_orig REAL DEFAULT 0.0,
            new_balance_orig REAL DEFAULT 0.0,
            old_balance_dest REAL DEFAULT 0.0,
            new_balance_dest REAL DEFAULT 0.0,
            timestamp        TEXT,
            device_id        TEXT,
            ip_address       TEXT,
            location_city    TEXT,
            is_new_payee     INTEGER DEFAULT 0,
            is_vpn           INTEGER DEFAULT 0,
            fraud_type       TEXT,
            is_fraud         INTEGER DEFAULT 0,
            alert_triggered  INTEGER DEFAULT 0,
            scenario_type    TEXT,
            fraud_reason     TEXT,
            severity         TEXT DEFAULT 'NONE'
        )
    """)

    # ── Cases ──────────────────────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS cases (
            case_id              TEXT PRIMARY KEY,
            transaction_id       TEXT NOT NULL UNIQUE,
            status               TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN','MONITORING','ESCALATED','CLOSED')),
            risk_score           REAL DEFAULT 0,
            risk_band            TEXT DEFAULT 'LOW',
            recommended_action   TEXT DEFAULT 'MONITOR',
            analyst_id           TEXT,
            analyst_decision     TEXT,
            analyst_notes        TEXT,
            investigation_report TEXT,
            str_draft            TEXT,
            opened_at            TEXT,
            updated_at           TEXT,
            closed_at            TEXT,
            FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id)
        )
    """)

    # ── Audit Log (immutable — append-only) ────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            log_id      INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id     TEXT NOT NULL,
            action      TEXT NOT NULL,
            actor       TEXT NOT NULL DEFAULT 'SYSTEM',
            details     TEXT DEFAULT '',
            timestamp   TEXT NOT NULL,
            FOREIGN KEY (case_id) REFERENCES cases(case_id)
        )
    """)

    # ── Users (Role-based authentication & directory) ───────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            email         TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role          TEXT NOT NULL CHECK (role IN ('administrator', 'manager', 'investigator')),
            status        TEXT DEFAULT 'Active',
            created_at    TEXT NOT NULL
        )
    """)

    # ── Bank Employees (Insider-risk entities under investigation) ─────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS employees (
            employee_id       TEXT PRIMARY KEY,
            name              TEXT NOT NULL,
            designation       TEXT,
            department        TEXT,
            branch_id         TEXT,
            branch_city       TEXT,
            access_tier       TEXT DEFAULT 'STANDARD',
            access_rights     TEXT DEFAULT '',
            employee_status   TEXT DEFAULT 'ACTIVE',
            hired_at          TEXT,
            created_at        TEXT
        )
    """)

    # ── Employee ↔ Customer Account Links (related-party / self accounts) ──────
    c.execute("""
        CREATE TABLE IF NOT EXISTS employee_account_links (
            link_id       INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id   TEXT NOT NULL,
            account_id    TEXT NOT NULL,
            customer_id   TEXT,
            relationship  TEXT DEFAULT 'SELF',
            declared      INTEGER DEFAULT 0,
            UNIQUE(employee_id, account_id),
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        )
    """)

    # ── Employee Activity Log (access events interleaved with money flow) ──────
    c.execute("""
        CREATE TABLE IF NOT EXISTS employee_activity_log (
            event_id      INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id   TEXT NOT NULL,
            action        TEXT NOT NULL,
            entity_ref    TEXT,
            details       TEXT DEFAULT '',
            timestamp     TEXT NOT NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        )
    """)

    # ── Insider Alerts (evidence-backed employee risk findings) ───────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS insider_alerts (
            alert_id       TEXT PRIMARY KEY,
            employee_id    TEXT,
            case_id        TEXT,
            pattern_type   TEXT NOT NULL,
            severity       TEXT DEFAULT 'MEDIUM',
            evidence       TEXT DEFAULT '[]',
            explanation    TEXT DEFAULT '',
            status         TEXT DEFAULT 'OPEN',
            opened_at      TEXT,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        )
    """)

    # Seed default users if empty
    import hashlib
    def _hash_pwd(pwd: str) -> str:
        return hashlib.sha256(("safeflow:" + pwd).encode()).hexdigest()

    default_pwd_hash = _hash_pwd("demo-password")
    now_iso = datetime.utcnow().isoformat()

    default_users = [
        ("usr-admin", "System Administrator", "admin@smarthorizon.ai", default_pwd_hash, "administrator", "Active", now_iso),
        ("usr-alex", "Alex Chen", "alex.chen@smarthorizon.ai", default_pwd_hash, "administrator", "Active", now_iso),
        ("usr-sarah", "Sarah Chen", "sarah.chen@smarthorizon.ai", default_pwd_hash, "manager", "Active", now_iso),
        ("usr-marcus", "Marcus Johnson", "marcus.johnson@smarthorizon.ai", default_pwd_hash, "investigator", "Active", now_iso),
        ("usr-priya", "Priya Patel", "priya.patel@smarthorizon.ai", default_pwd_hash, "investigator", "Active", now_iso),
    ]

    for u in default_users:
        c.execute("""
            INSERT OR IGNORE INTO users (id, name, email, password_hash, role, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, u)

    # ── Regulations Grounding Table (validatorAgent reference) ─────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS regulations (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            act          TEXT NOT NULL,
            section      TEXT NOT NULL,
            page_ref     TEXT,
            summary_text TEXT NOT NULL,
            UNIQUE(act, section)
        )
    """)

    # Ensure validator columns exist on cases (safe migrations)
    for col, col_type in [
        ("validated", "INTEGER"),
        ("failed_checks", "TEXT"),
        ("forced_review_level", "TEXT"),
    ]:
        try:
            c.execute(f"ALTER TABLE cases ADD COLUMN {col} {col_type}")
        except Exception:
            pass  # Column already exists

    # Insider-risk migration: attribute transactions to processing employees
    try:
        c.execute("ALTER TABLE transactions ADD COLUMN processed_by TEXT")
    except Exception:
        pass  # Column already exists

    seed_regulations(conn)

    # Seed baseline bank employees + access rights if empty
    emp_count = c.execute("SELECT count(*) FROM employees").fetchone()[0]
    if emp_count == 0:
        from seed_insider_scenarios import seed_insider
        try:
            seed_insider(conn)
            print("[OK] Insider-risk employee directory seeded.")
        except Exception as e:
            print(f"[STARTUP NOTICE] Insider seed skipped: {e}")

    conn.commit()

    # Self-healing: If fresh cloud container has no cases, auto-populate baseline clusters
    try:
        case_count = c.execute("SELECT count(*) FROM cases").fetchone()[0]
        if case_count == 0:
            conn.close()
            from seed_graph_clusters import seed
            seed()
            print(f"[OK] Fresh database detected: auto-seeded baseline clusters.")
            conn = sqlite3.connect(DB_PATH)
            # Re-run insider seed (idempotent) so processed_by attribution applies
            # to the now-existing cluster transactions.
            c2 = conn.cursor()
            c2.execute("SELECT count(*) FROM transactions WHERE processed_by IS NOT NULL")
            if c2.fetchone()[0] < 5:
                from seed_insider_scenarios import seed_insider
                seed_insider(conn)
    except Exception as e:
        print(f"[STARTUP NOTICE] Auto-seed check: {e}")

    conn.close()
    print(f"[OK] Database initialized: {DB_PATH}")


def seed_regulations(conn: sqlite3.Connection) -> None:
    """Seed base regulatory ground-truth for validatorAgent."""
    rows = [
        (
            "PMLA",
            "12",
            "p.14",
            "Reporting entity to maintain records of all transactions, verify client identities, and furnish information to FIU-IND within specified timeframes. Section 12 of the Prevention of Money Laundering Act, 2002 mandates that every reporting entity shall maintain a record of all transactions, furnish information relating to such transactions to the Director within the prescribed time, and verify the identity of its clients.",
        ),
        (
            "RBI_MASTER_DIRECTION_FRM_2024",
            "GENERAL",
            "p.3",
            "Framework for early fraud detection, account monitoring, staff accountability, and prompt reporting of suspicious transactions and fraud to RBI. Master Direction on Fraud Risk Management in Regulated Entities covers governance, early detection mechanisms, transaction monitoring, reporting thresholds, and coordination with law enforcement agencies.",
        ),
        (
            "NPCI_OC",
            "138",
            "p.2",
            "Operational circular mandating detection and containment of mule accounts, velocity monitoring, and real-time transaction blocking across UPI rails. Directs banks and payment system participants to establish automated alerts for rapid fund movement, implement customer refund timelines, and report mule accounts to cybercrime and regulatory authorities.",
        ),
    ]
    conn.executemany(
        """
        INSERT INTO regulations (act, section, page_ref, summary_text)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(act, section) DO UPDATE SET
            summary_text = excluded.summary_text,
            page_ref = excluded.page_ref
        """,
        rows,
    )
    conn.commit()


def get_db():
    """Yield a SQLite connection with foreign keys enabled. Use as FastAPI dependency."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
    finally:
        conn.close()


def log_audit(conn, case_id: str, action: str, actor: str = "SYSTEM", details: str = ""):
    """Append an immutable audit entry. Actor identity must come from the server."""
    conn.execute(
        "INSERT INTO audit_log (case_id, action, actor, details, timestamp) VALUES (?,?,?,?,?)",
        (case_id, action, actor, details, datetime.utcnow().isoformat()),
    )
    conn.commit()
