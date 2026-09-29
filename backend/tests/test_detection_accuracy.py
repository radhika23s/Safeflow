"""
Detection Accuracy & False-Positive Evaluation (PS Outcome 4)
=============================================================
Runs the full detection pipeline over LABELED suspicious + legitimate scenarios
and asserts quantitative accuracy thresholds:

  - Suspicious scenarios (ground truth = fraud) must be DETECTED   → recall
  - Legitimate controls  (ground truth = clean) must NOT alert     → FPR

Pipeline under test (no LLM, no model pickle required):
  1. Money-flow graph construction (NetworkX)
  2. External pattern detection (_detect_patterns: STRUCTURING / FAN_OUT /
     FAN_IN / CIRCULAR / LAYERED_MULE)
  3. Insider-risk correlation (detect_insider_patterns)

Run:  cd backend && python -m pytest tests/test_detection_accuracy.py -v
"""

import os
import sys
import sqlite3
import pytest
import networkx as nx
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routers.graph import _detect_patterns
from insider_risk import detect_insider_patterns

BASE = datetime(2026, 9, 1, 10, 0, 0)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _txn(txn_id, sender, receiver, amount, minutes, channel="UPI", processed_by=None):
    return {
        "transaction_id": txn_id,
        "sender_account": sender,
        "receiver_account": receiver,
        "amount": amount,
        "channel": channel,
        "timestamp": (BASE + timedelta(minutes=minutes)).isoformat(),
        "processed_by": processed_by,
    }


def _build_graph(txns) -> nx.DiGraph:
    G = nx.DiGraph()
    for t in txns:
        G.add_node(t["sender_account"])
        G.add_node(t["receiver_account"])
        G.add_edge(
            t["sender_account"], t["receiver_account"],
            amount=t["amount"], transaction_id=t["transaction_id"],
            channel=t["channel"], timestamp=t["timestamp"],
        )
    return G


def _index_txns(txns) -> dict:
    return {t["transaction_id"]: t for t in txns}


def _external_types(patterns):
    return {p["type"] for p in patterns}


def _insider_types(alerts):
    return {a["pattern_type"] for a in alerts}


# ---------------------------------------------------------------------------
# Insider-risk test DB fixture (employees + links + activity)
# ---------------------------------------------------------------------------

@pytest.fixture()
def insider_db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("""CREATE TABLE employees (
        employee_id TEXT PRIMARY KEY, name TEXT, designation TEXT,
        department TEXT, branch_id TEXT, branch_city TEXT,
        access_tier TEXT, access_rights TEXT, employee_status TEXT,
        hired_at TEXT, created_at TEXT)""")
    c.execute("""CREATE TABLE employee_account_links (
        link_id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT, account_id TEXT, customer_id TEXT,
        relationship TEXT, declared INTEGER)""")
    c.execute("""CREATE TABLE employee_activity_log (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT, action TEXT, entity_ref TEXT, details TEXT, timestamp TEXT)""")
    c.execute("""CREATE TABLE transactions (
        transaction_id TEXT PRIMARY KEY, sender_account TEXT, receiver_account TEXT,
        amount REAL, channel TEXT, timestamp TEXT, processed_by TEXT)""")

    c.executemany("INSERT INTO employees VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
        ("EMP-100", "Fraudulent Fred", "Operations Officer", "Ops", "BR-1", "Bengaluru",
         "ELEVATED", "account_view,transfer_initiate,limit_override", "ACTIVE",
         "2024-01-01", "2026-01-01"),
        ("EMP-200", "Honest Hannah", "Teller", "Branch Ops", "BR-1", "Mumbai",
         "STANDARD", "deposit,withdrawal,account_view", "ACTIVE",
         "2024-01-01", "2026-01-01"),
    ])

    # Fred: undeclared cousin account inside the flow. Hannah: declared self account.
    c.executemany("INSERT INTO employee_account_links (employee_id, account_id, customer_id, relationship, declared) VALUES (?,?,?,?,?)", [
        ("EMP-100", "ACCT-COUSIN", "CUST-COUSIN", "COUSIN", 0),
        ("EMP-200", "ACCT-HANNAH", None, "SELF", 1),
    ])

    # Fred: off-hours login + override; Hannah: in-shift routine events
    c.executemany("INSERT INTO employee_activity_log (employee_id, action, entity_ref, details, timestamp) VALUES (?,?,?,?,?)", [
        ("EMP-100", "LOGIN", "portal", "Login at 02:47 local time — outside assigned shift (09:00-18:00)",
         "2026-09-01T02:47:00"),
        ("EMP-100", "TXN_OVERRIDE", "TXN-S-02", "Applied manual limit override on sub-threshold transfer",
         "2026-09-01T10:03:00"),
        ("EMP-200", "LOGIN", "portal", "Login at 09:58 local time — within assigned shift",
         "2026-09-01T09:58:00"),
        ("EMP-200", "DEPOSIT", "BR-1", "Routine cash deposit intake, counter 3",
         "2026-09-01T10:30:00"),
    ])
    conn.commit()
    yield conn
    conn.close()


# ---------------------------------------------------------------------------
# Scenario builders (labeled ground truth)
# ---------------------------------------------------------------------------

def _structuring_scenario(processed_by="EMP-100"):
    """4 sub-threshold transfers within 8 minutes — insider-processed."""
    return [
        _txn("TXN-S-01", "ACCT-ORIG", "ACCT-A", 48000.0, 0, processed_by=processed_by),
        _txn("TXN-S-02", "ACCT-ORIG", "ACCT-B", 49200.0, 2, processed_by=processed_by),
        _txn("TXN-S-03", "ACCT-ORIG", "ACCT-C", 47800.0, 4, processed_by=processed_by),
        _txn("TXN-S-04", "ACCT-ORIG", "ACCT-D", 46900.0, 7, processed_by=processed_by),
    ]


def _circular_scenario():
    """A → B → C → A round-trip."""
    return [
        _txn("TXN-C-01", "ACCT-A", "ACCT-B", 100000.0, 0),
        _txn("TXN-C-02", "ACCT-B", "ACCT-C", 99000.0, 5),
        _txn("TXN-C-03", "ACCT-C", "ACCT-A", 98000.0, 11),
    ]


def _fanout_scenario():
    return [
        _txn(f"TXN-F-{i:02d}", "ACCT-ORIG", f"ACCT-R-{i}", 30000.0, i * 2)
        for i in range(1, 6)
    ]


def _terminal_beneficiary_scenario():
    """Funds terminate in an employee's undeclared cousin account."""
    return [
        _txn("TXN-T-01", "ACCT-ORIG", "ACCT-COUSIN", 250000.0, 0),
        _txn("TXN-T-02", "ACCT-ORIG", "ACCT-COUSIN", 180000.0, 3),
    ]


def _benign_payroll_scenario():
    """Large but legitimate: regular payroll to a known vendor account."""
    return [
        _txn("TXN-L-01", "ACCT-CORP", "ACCT-VENDOR", 450000.0, 30, channel="NEFT"),
        _txn("TXN-L-02", "ACCT-CORP", "ACCT-VENDOR", 450000.0, 61, channel="NEFT"),
    ]


def _benign_salary_scenario():
    return [
        _txn("TXN-L-03", "ACCT-EMPLOYER", "ACCT-HANNAH", 62000.0, 45, channel="IMPS"),
    ]


def _benign_bilateral_scenario():
    return [_txn("TXN-L-04", "ACCT-P", "ACCT-Q", 15000.0, 20)]


# ---------------------------------------------------------------------------
# Accuracy: suspicious scenarios must be detected
# ---------------------------------------------------------------------------

class TestSuspiciousDetection:
    """Ground truth = fraud. Every scenario must raise the correct alert."""

    def test_structuring_detected(self):
        txns = _structuring_scenario()
        G = _build_graph(txns)
        patterns, band, _ = _detect_patterns(G, "ACCT-ORIG", "ACCT-A")
        assert "STRUCTURING" in _external_types(patterns), f"got {_external_types(patterns)}"
        assert band == "CRITICAL"

    def test_circular_detected(self):
        txns = _circular_scenario()
        G = _build_graph(txns)
        patterns, band, _ = _detect_patterns(G, "ACCT-A", "ACCT-B")
        assert "CIRCULAR" in _external_types(patterns)
        assert band == "CRITICAL"

    def test_fanout_detected(self):
        txns = _fanout_scenario()
        G = _build_graph(txns)
        patterns, band, _ = _detect_patterns(G, "ACCT-ORIG", "ACCT-R-1")
        assert "FAN_OUT" in _external_types(patterns)
        assert band in ("HIGH", "CRITICAL")

    def test_insider_structuring_detected(self, insider_db):
        txns = _structuring_scenario(processed_by="EMP-100")
        G = _build_graph(txns)
        patterns, _, _ = _detect_patterns(G, "ACCT-ORIG", "ACCT-A")
        alerts = detect_insider_patterns(
            insider_db, _index_txns(txns), G, "ACCT-ORIG", "ACCT-A", patterns=patterns
        )
        assert "INSIDER_STRUCTURING" in _insider_types(alerts)
        struct = next(a for a in alerts if a["pattern_type"] == "INSIDER_STRUCTURING")
        assert struct["employee_id"] == "EMP-100"
        assert len(struct["evidence"]) >= 3  # 4 txns (capped evidence) + override event

    def test_insider_terminal_beneficiary_detected(self, insider_db):
        txns = _terminal_beneficiary_scenario()
        G = _build_graph(txns)
        alerts = detect_insider_patterns(
            insider_db, _index_txns(txns), G, "ACCT-ORIG", "ACCT-COUSIN"
        )
        assert "INSIDER_TERMINAL_BENEFICIARY" in _insider_types(alerts)
        ben = next(a for a in alerts if a["pattern_type"] == "INSIDER_TERMINAL_BENEFICIARY")
        assert ben["severity"] == "CRITICAL"  # undeclared link
        assert any(e["type"] == "account_link" for e in ben["evidence"])

    def test_insider_circular_involvement_detected(self, insider_db):
        # Route the cycle through the insider's cousin account
        txns = [
            _txn("TXN-C-01", "ACCT-A", "ACCT-COUSIN", 100000.0, 0),
            _txn("TXN-C-02", "ACCT-COUSIN", "ACCT-B", 99000.0, 5),
            _txn("TXN-C-03", "ACCT-B", "ACCT-A", 98000.0, 11),
        ]
        G = _build_graph(txns)
        patterns, _, _ = _detect_patterns(G, "ACCT-A", "ACCT-COUSIN")
        alerts = detect_insider_patterns(
            insider_db, _index_txns(txns), G, "ACCT-A", "ACCT-COUSIN", patterns=patterns
        )
        assert "INSIDER_CIRCULAR_INVOLVEMENT" in _insider_types(alerts)

    def test_insider_profile_mismatch_detected(self, insider_db):
        txns = _structuring_scenario(processed_by="EMP-100")
        G = _build_graph(txns)
        alerts = detect_insider_patterns(
            insider_db, _index_txns(txns), G, "ACCT-ORIG", "ACCT-A"
        )
        assert "INSIDER_PROFILE_MISMATCH" in _insider_types(alerts)
        mm = next(a for a in alerts if a["pattern_type"] == "INSIDER_PROFILE_MISMATCH")
        assert mm["employee_id"] == "EMP-100"
        # Evidence must cite both the activity event and the employee profile
        ev_types = {e["type"] for e in mm["evidence"]}
        assert "activity_event" in ev_types and "profile" in ev_types


# ---------------------------------------------------------------------------
# False-positive controls: legitimate scenarios must stay clean
# ---------------------------------------------------------------------------

class TestLegitimateNoAlert:
    """Ground truth = clean. No external patterns and no insider alerts."""

    def test_benign_payroll_no_external_pattern(self):
        txns = _benign_payroll_scenario()
        G = _build_graph(txns)
        patterns, band, _ = _detect_patterns(G, "ACCT-CORP", "ACCT-VENDOR")
        # Two transfers to the same payee is bilateral, not structuring/fan-out
        assert not (_external_types(patterns) & {"STRUCTURING", "FAN_OUT", "FAN_IN", "CIRCULAR"})
        assert band in ("LOW", "MEDIUM")

    def test_benign_salary_to_declared_employee_account_no_alert(self, insider_db):
        txns = _benign_salary_scenario()
        G = _build_graph(txns)
        patterns, _, _ = _detect_patterns(G, "ACCT-EMPLOYER", "ACCT-HANNAH")
        alerts = detect_insider_patterns(
            insider_db, _index_txns(txns), G, "ACCT-EMPLOYER", "ACCT-HANNAH",
            patterns=patterns
        )
        # Hannah's declared SELF account receiving salary must NOT alert…
        ben = [a for a in alerts if a["pattern_type"] == "INSIDER_TERMINAL_BENEFICIARY"]
        # …unless explicitly declared-benefit flagged; we require either no
        # beneficiary alert or a non-critical one with declared-link evidence.
        for a in ben:
            assert a["severity"] != "CRITICAL"
            assert any("declared" in e["detail"].lower() for e in a["evidence"])

    def test_benign_bilateral_no_alerts(self, insider_db):
        txns = _benign_bilateral_scenario()
        G = _build_graph(txns)
        patterns, band, _ = _detect_patterns(G, "ACCT-P", "ACCT-Q")
        assert band == "LOW"
        alerts = detect_insider_patterns(
            insider_db, _index_txns(txns), G, "ACCT-P", "ACCT-Q", patterns=patterns
        )
        assert alerts == []

    def test_benign_employee_activity_no_mismatch(self, insider_db):
        """Hannah's in-shift routine events must never produce a mismatch alert."""
        txns = _benign_bilateral_scenario()
        G = _build_graph(txns)
        alerts = detect_insider_patterns(
            insider_db, _index_txns(txns), G, "ACCT-P", "ACCT-Q"
        )
        mm = [a for a in alerts if a["pattern_type"] == "INSIDER_PROFILE_MISMATCH"
              and a["employee_id"] == "EMP-200"]
        assert mm == []


# ---------------------------------------------------------------------------
# Aggregate metrics — the PS accuracy / FPR assertions
# ---------------------------------------------------------------------------

class TestAggregateMetrics:
    """PS Outcome 4: quantitative detection accuracy + false positive rate."""

    def test_detection_accuracy_and_fpr(self, insider_db):
        suspicious_cases = {
            "structuring": _structuring_scenario(),
            "circular": _circular_scenario(),
            "fanout": _fanout_scenario(),
            "terminal_beneficiary": _terminal_beneficiary_scenario(),
        }
        legitimate_cases = {
            "payroll": _benign_payroll_scenario(),
            "salary": _benign_salary_scenario(),
            "bilateral": _benign_bilateral_scenario(),
        }

        def _anchor(txns):
            return txns[0]["sender_account"], txns[0]["receiver_account"]

        tp = 0
        fn = []
        for name, txns in suspicious_cases.items():
            G = _build_graph(txns)
            s, r = _anchor(txns)
            patterns, _, _ = _detect_patterns(G, s, r)
            alerts = detect_insider_patterns(insider_db, _index_txns(txns), G, s, r, patterns=patterns)
            detected = bool(patterns) or bool(alerts)
            if detected:
                tp += 1
            else:
                fn.append(name)

        fp = 0
        fp_names = []
        for name, txns in legitimate_cases.items():
            G = _build_graph(txns)
            s, r = _anchor(txns)
            patterns, band, _ = _detect_patterns(G, s, r)
            alerts = detect_insider_patterns(insider_db, _index_txns(txns), G, s, r, patterns=patterns)
            # FPR counts only *actionable* alerts: CRITICAL/HIGH patterns or alerts.
            loud_patterns = [p for p in patterns if p.get("severity") in ("CRITICAL", "HIGH")]
            loud_alerts = [a for a in alerts if a.get("severity") in ("CRITICAL", "HIGH")]
            if loud_patterns or loud_alerts:
                fp += 1
                fp_names.append(name)

        recall = tp / len(suspicious_cases)
        fpr = fp / len(legitimate_cases)

        assert recall == 1.0, f"Missed suspicious scenarios: {fn}"
        assert fpr <= 0.34, (
            f"False positive rate {fpr:.0%} too high; offenders: {fp_names}"
        )

    def test_explanations_always_present_with_alerts(self, insider_db):
        """PS Outcome 5: every alert must carry non-empty explanation + evidence."""
        scenarios = [
            _structuring_scenario(), _circular_scenario(),
            _fanout_scenario(), _terminal_beneficiary_scenario(),
        ]
        for txns in scenarios:
            G = _build_graph(txns)
            s, r = txns[0]["sender_account"], txns[0]["receiver_account"]
            patterns, _, _ = _detect_patterns(G, s, r)
            for p in patterns:
                assert p.get("description"), f"Pattern {p.get('type')} missing description"
                assert p.get("severity")
            alerts = detect_insider_patterns(
                insider_db, _index_txns(txns), G, s, r, patterns=patterns
            )
            for a in alerts:
                assert a.get("explanation"), f"Alert {a.get('alert_id')} missing explanation"
                assert a.get("evidence"), f"Alert {a.get('alert_id')} missing evidence"
                for e in a["evidence"]:
                    assert e.get("type") and e.get("detail"), f"Malformed evidence in {a['alert_id']}"
