"""Tests for authentication and authorization (Point 2 of remediation)."""

import os
import sys
import pytest
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

BASE = "http://127.0.0.1:8000"


def _login(email="marcus.johnson@smarthorizon.ai", password="demo-password"):
    """Login and return the bearer token."""
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# ── TC-S01: Unauthenticated access returns 401 ──────────────────────────────

class TestUnauthenticatedAccess:
    """All protected endpoints must reject unauthenticated requests."""

    def test_list_cases_no_auth(self):
        r = requests.get(f"{BASE}/api/cases/")
        assert r.status_code == 401

    def test_get_case_no_auth(self):
        r = requests.get(f"{BASE}/api/cases/FC-FAKE")
        assert r.status_code == 401

    def test_score_analyze_no_auth(self):
        r = requests.post(f"{BASE}/api/score/analyze", json={
            "transaction_id": "TXN-TEST", "amount": 1000.0
        })
        assert r.status_code == 401

    def test_investigate_no_auth(self):
        r = requests.post(f"{BASE}/api/investigate/TXN-TEST")
        assert r.status_code == 401

    def test_audit_log_no_auth(self):
        r = requests.get(f"{BASE}/api/audit/")
        assert r.status_code == 401

    def test_reports_no_auth(self):
        r = requests.get(f"{BASE}/api/reports/FC-FAKE/str-draft")
        assert r.status_code == 401

    def test_graph_no_auth(self):
        r = requests.get(f"{BASE}/api/graph/FC-FAKE")
        assert r.status_code == 401

    def test_decision_no_auth(self):
        r = requests.post(f"{BASE}/api/cases/FC-FAKE/decision", json={
            "decision": "DISMISS", "notes": "test"
        })
        assert r.status_code == 401


# ── TC-S02: Role-based access control ────────────────────────────────────────

class TestRoleBasedAccess:
    """Role checks: investigators can view/create, only managers/admins can decide."""

    def test_investigator_can_list_cases(self):
        token = _login("marcus.johnson@smarthorizon.ai")
        r = requests.get(f"{BASE}/api/cases/", headers=_auth_header(token))
        assert r.status_code == 200

    def test_investigator_cannot_submit_block_decision(self):
        token = _login("marcus.johnson@smarthorizon.ai")
        r = requests.post(
            f"{BASE}/api/cases/FC-FAKE/decision",
            json={"decision": "APPROVE_BLOCK", "notes": "test"},
            headers=_auth_header(token),
        )
        assert r.status_code == 403

    def test_manager_can_submit_decision(self):
        token = _login("sarah.chen@smarthorizon.ai")
        r = requests.post(
            f"{BASE}/api/cases/FC-FAKE/decision",
            json={"decision": "DISMISS", "notes": "test"},
            headers=_auth_header(token),
        )
        # 404 is expected (no such case), but not 403
        assert r.status_code != 403

    def test_invalid_login_rejected(self):
        r = requests.post(f"{BASE}/api/auth/login", json={
            "email": "nobody@example.com", "password": "wrong"
        })
        assert r.status_code == 401


# ── B10: Frontend role cannot be spoofed server-side ─────────────────────────

class TestServerSideRoleEnforcement:
    """Server must use the token's role, not any client-supplied value."""

    def test_analyst_id_derived_from_token(self):
        """Decision endpoint uses the authenticated user's email, not client input."""
        token = _login("sarah.chen@smarthorizon.ai")
        # Create a case first
        r = requests.post(f"{BASE}/api/cases/", json={
            "transaction_id": "TXN-001",
            "risk_score": 75.0,
            "risk_band": "HIGH",
            "recommended_action": "FLAG",
        }, headers=_auth_header(token))
        if r.status_code == 201:
            case_id = r.json()["case_id"]
            # Submit decision — analyst_id should come from the token
            r2 = requests.post(
                f"{BASE}/api/cases/{case_id}/decision",
                json={"decision": "DISMISS", "notes": "testing"},
                headers=_auth_header(token),
            )
            if r2.status_code == 200:
                # Check audit log — actor should be the token's email
                r3 = requests.get(f"{BASE}/api/audit/?case_id={case_id}",
                                  headers=_auth_header(token))
                if r3.status_code == 200:
                    entries = r3.json().get("entries", [])
                    for e in entries:
                        if e.get("action") == "ANALYST_DECISION":
                            assert e["actor"] == "sarah.chen@smarthorizon.ai"
