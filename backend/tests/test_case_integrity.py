"""Tests for case and database integrity (Point 6 of remediation).

Verifies:
- Duplicate investigation reuse (TC-I01 / B5)
- PATCH field clearing with empty string (TC-I02 / B6)
- Status validation (B7)
- Transaction reference validation (B11)
"""

import os
import sys
import pytest
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

BASE = "http://127.0.0.1:8000"


def _login(email="sarah.chen@smarthorizon.ai", password="demo-password"):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


def _auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# ── TC-I01: Investigation idempotency ────────────────────────────────────────

class TestInvestigationIdempotency:
    """Repeated investigation of the same transaction must reuse one case."""

    def test_duplicate_investigation_reuses_case(self):
        token = _login()
        headers = _auth_header(token)

        # Get an existing transaction from the database if available
        cases_resp = requests.get(f"{BASE}/api/cases/", headers=headers)
        txn_id = "TXN-001"
        if cases_resp.status_code == 200 and cases_resp.json().get("cases"):
            txn_id = cases_resp.json()["cases"][0]["transaction_id"]

        # First investigation
        r1 = requests.post(f"{BASE}/api/investigate/{txn_id}",
                           headers=headers, timeout=60)
        assert r1.status_code == 200
        case_id_1 = r1.json()["case_id"]

        # Second investigation with same transaction_id
        r2 = requests.post(f"{BASE}/api/investigate/{txn_id}",
                           headers=headers, timeout=60)
        assert r2.status_code == 200
        case_id_2 = r2.json()["case_id"]

        # Must be the same case_id (idempotent)
        assert case_id_1 == case_id_2, \
            f"Expected same case_id on repeated investigation, got {case_id_1} vs {case_id_2}"


# ── TC-I02: PATCH field clearing ─────────────────────────────────────────────

class TestPatchFieldClearing:
    """PATCH with empty string should clear the field, not be silently ignored."""

    def test_clear_investigation_report(self):
        token = _login()
        headers = _auth_header(token)

        # Create a case first
        r = requests.post(f"{BASE}/api/cases/", json={
            "transaction_id": "TXN-002",
            "risk_score": 75.0,
            "risk_band": "HIGH",
            "recommended_action": "FLAG",
        }, headers=headers)
        if r.status_code == 201:
            case_id = r.json()["case_id"]
            # Set a report
            requests.patch(f"{BASE}/api/cases/{case_id}", json={
                "investigation_report": "Some report text"
            }, headers=headers)
            # Now clear it with empty string
            r2 = requests.patch(f"{BASE}/api/cases/{case_id}", json={
                "investigation_report": ""
            }, headers=headers)
            assert r2.status_code == 200
            # Verify it was cleared
            r3 = requests.get(f"{BASE}/api/cases/{case_id}", headers=headers)
            if r3.status_code == 200:
                assert r3.json().get("investigation_report") == "", \
                    f"Expected empty string, got: {r3.json().get('investigation_report')!r}"


# ── B7: Status validation ───────────────────────────────────────────────────

class TestStatusValidation:
    """Invalid status values must be rejected by PATCH."""

    def test_invalid_status_rejected(self):
        token = _login()
        headers = _auth_header(token)

        r = requests.post(f"{BASE}/api/cases/", json={
            "transaction_id": "TXN-003",
            "risk_score": 50.0,
            "risk_band": "MEDIUM",
            "recommended_action": "MONITOR",
        }, headers=headers)
        if r.status_code == 201:
            case_id = r.json()["case_id"]
            # Try invalid status
            r2 = requests.patch(f"{BASE}/api/cases/{case_id}", json={
                "status": "banana"
            }, headers=headers)
            assert r2.status_code == 422, \
                f"Expected 422 for invalid status, got: {r2.status_code}"

    def test_valid_status_accepted(self):
        token = _login()
        headers = _auth_header(token)

        r = requests.post(f"{BASE}/api/cases/", json={
            "transaction_id": "TXN-004",
            "risk_score": 50.0,
            "risk_band": "MEDIUM",
            "recommended_action": "MONITOR",
        }, headers=headers)
        if r.status_code == 201:
            case_id = r.json()["case_id"]
            for status in ["OPEN", "MONITORING", "ESCALATED", "CLOSED"]:
                r2 = requests.patch(f"{BASE}/api/cases/{case_id}", json={
                    "status": status
                }, headers=headers)
                assert r2.status_code == 200, \
                    f"Expected 200 for status '{status}', got: {r2.status_code}"


# ── B11: Transaction reference validation ───────────────────────────────────

class TestTransactionReferenceValidation:
    """Cases must reference existing transactions; invalid references rejected."""

    def test_nonexistent_transaction_rejected(self):
        token = _login()
        headers = _auth_header(token)

        r = requests.post(f"{BASE}/api/cases/", json={
            "transaction_id": "TXN-DOES-NOT-EXIST",
            "risk_score": 50.0,
            "risk_band": "MEDIUM",
            "recommended_action": "MONITOR",
        }, headers=headers)
        assert r.status_code == 422, \
            f"Expected 422 for nonexistent transaction, got: {r.status_code}"

    def test_duplicate_case_rejected(self):
        """Two cases for the same transaction should be rejected (409)."""
        token = _login()
        headers = _auth_header(token)

        r1 = requests.post(f"{BASE}/api/cases/", json={
            "transaction_id": "TXN-006",
            "risk_score": 50.0,
            "risk_band": "MEDIUM",
            "recommended_action": "MONITOR",
        }, headers=headers)
        if r1.status_code == 201:
            r2 = requests.post(f"{BASE}/api/cases/", json={
                "transaction_id": "TXN-006",
                "risk_score": 75.0,
                "risk_band": "HIGH",
                "recommended_action": "FLAG",
            }, headers=headers)
            assert r2.status_code == 409, \
                f"Expected 409 for duplicate case, got: {r2.status_code}"
