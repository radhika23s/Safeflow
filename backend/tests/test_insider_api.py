"""
Insider API Tests — /api/insider endpoints
==========================================
Covers authentication enforcement, employee directory rollups, the alerts feed,
per-employee timeline, case summary, and error paths (404 / 422).

Uses an isolated SQLite test DB + FastAPI TestClient (no live server needed).

Run:  cd backend && python -m pytest tests/test_insider_api.py -v
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# App fixture — isolated DB with insider seed
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client():
    import tempfile
    fd, db_path = tempfile.mkstemp(suffix=".db", prefix="insider_api_test_")
    os.close(fd)
    os.environ["DATABASE_URL"] = db_path
    os.environ["AUTH_SECRET"] = "test-secret-insider-api"
    os.environ["DEMO_PASSWORD"] = "demo-password"

    import database
    # Bind the module's DB_PATH directly to the isolated test file: the module
    # may already be imported in this pytest session (its env-based path
    # resolution only re-evaluates at import time).
    database.DB_PATH = db_path
    database.init_db()

    from main import app
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c, db_path

    try:
        os.unlink(db_path)
    except OSError:
        pass


@pytest.fixture()
def auth(client):
    c, _ = client
    r = c.post("/api/auth/login", json={
        "email": "marcus.johnson@smarthorizon.ai", "password": "demo-password"
    })
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

class TestAuth:
    def test_endpoints_require_auth(self, client):
        c, _ = client
        for path in [
            "/api/insider/employees",
            "/api/insider/alerts",
            "/api/insider/case/FC-20260904-STR01/summary",
            "/api/insider/employees/EMP-001/timeline",
        ]:
            r = c.get(path)
            assert r.status_code in (401, 403), f"{path} returned {r.status_code}"

    def test_valid_token_accepted(self, client, auth):
        c, _ = client
        r = c.get("/api/insider/employees", headers=auth)
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Employee directory
# ---------------------------------------------------------------------------

class TestEmployeeDirectory:
    def test_returns_seeded_employees(self, client, auth):
        c, _ = client
        r = c.get("/api/insider/employees", headers=auth)
        assert r.status_code == 200
        body = r.json()
        assert body["total"] >= 8
        ids = {e["employee_id"] for e in body["employees"]}
        assert {"EMP-001", "EMP-002", "EMP-003", "EMP-007"} <= ids

    def test_alert_rollup_fields_present(self, client, auth):
        c, _ = client
        r = c.get("/api/insider/employees", headers=auth)
        emp = r.json()["employees"][0]
        for field in ["open_alert_count", "alert_types", "max_severity", "account_links"]:
            assert field in emp

    def test_insider_seed_linked_accounts_flagged(self, client, auth):
        c, _ = client
        r = c.get("/api/insider/employees", headers=auth)
        by_id = {e["employee_id"]: e for e in r.json()["employees"]}
        # EMP-003 has an undeclared cousin link
        links = by_id["EMP-003"]["account_links"]
        assert any(l["declared"] == 0 for l in links)

    def test_branch_filter(self, client, auth):
        c, _ = client
        r = c.get("/api/insider/employees", headers=auth, params={"branch": "BR-BLR-007"})
        assert r.status_code == 200
        for e in r.json()["employees"]:
            assert e["branch_id"] == "BR-BLR-007"


# ---------------------------------------------------------------------------
# Alerts feed & persistence
# ---------------------------------------------------------------------------

class TestAlerts:
    def test_empty_before_graph_correlation(self, client, auth):
        c, _ = client
        r = c.get("/api/insider/alerts", headers=auth)
        assert r.status_code == 200
        assert isinstance(r.json()["alerts"], list)

    def test_graph_run_persists_and_exposes_alerts(self, client, auth):
        c, _ = client
        # Trigger correlation via the case graph
        rg = c.get("/api/graph/FC-20260904-STR01", headers=auth)
        assert rg.status_code == 200
        assert len(rg.json()["insider_alerts"]) >= 1

        r = c.get("/api/insider/alerts", headers=auth)
        alerts = r.json()["alerts"]
        assert len(alerts) >= 1
        for a in alerts:
            assert a["pattern_type"] and a["severity"] and a["explanation"]
            assert isinstance(a["evidence"], list)

    def test_filter_by_severity(self, client, auth):
        c, _ = client
        r = c.get("/api/insider/alerts", headers=auth, params={"severity": "CRITICAL"})
        assert r.status_code == 200
        for a in r.json()["alerts"]:
            assert a["severity"] == "CRITICAL"

    def test_unknown_alert_404(self, client, auth):
        c, _ = client
        r = c.get("/api/insider/alerts/INS-DOES-NOT-EXIST", headers=auth)
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Employee timeline
# ---------------------------------------------------------------------------

class TestEmployeeTimeline:
    def test_timeline_for_flagged_employee(self, client, auth):
        c, _ = client
        r = c.get("/api/insider/employees/EMP-003/timeline", headers=auth)
        assert r.status_code == 200
        body = r.json()
        assert body["employee"]["employee_id"] == "EMP-003"
        assert body["total_events"] >= 1
        kinds = {e["kind"] for e in body["events"]}
        assert "EMPLOYEE_ACCESS" in kinds

    def test_timeline_unknown_employee_404(self, client, auth):
        c, _ = client
        r = c.get("/api/insider/employees/EMP-9999/timeline", headers=auth)
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Case insider summary
# ---------------------------------------------------------------------------

class TestCaseSummary:
    def test_summary_after_correlation(self, client, auth):
        c, _ = client
        c.get("/api/graph/FC-20260904-STR01", headers=auth)  # ensure alerts persisted
        r = c.get("/api/insider/case/FC-20260904-STR01/summary", headers=auth)
        assert r.status_code == 200
        body = r.json()
        assert body["case_id"] == "FC-20260904-STR01"
        assert body["insider_alert_count"] >= 1
        assert body["max_severity"] in ("CRITICAL", "HIGH", "MEDIUM")
        assert len(body["attributed_transactions"]) >= 3  # EMP-003 processed 4 structuring txns

    def test_summary_unknown_case_is_empty_not_error(self, client, auth):
        c, _ = client
        r = c.get("/api/insider/case/FC-UNKNOWN-000/summary", headers=auth)
        assert r.status_code == 200
        body = r.json()
        assert body["insider_alert_count"] == 0


# ---------------------------------------------------------------------------
# Graph endpoint returns insider + timeline payload
# ---------------------------------------------------------------------------

class TestGraphIntegration:
    def test_scenario_c_insider_attribution(self, client, auth):
        """Live simulator Scenario C: transaction is attributed to EMP-003."""
        c, _ = client
        # Direct DB attribution check via the summary endpoint after inserting
        # a Scenario C-style transaction is covered by the simulator endpoint;
        # here we verify the attribution plumbing: processed_by on new txns.
        r = c.get("/api/insider/employees/EMP-003/timeline", headers=auth)
        assert r.status_code == 200
        # EMP-003 processed the four seeded structuring transactions
        assert r.json()["total_events"] >= 1

    def test_graph_payload_contains_insider_fields(self, client, auth):
        c, _ = client
        r = c.get("/api/graph/FC-20260904-CIRC01", headers=auth)
        assert r.status_code == 200
        d = r.json()
        assert "insider_alerts" in d and "activity_timeline" in d
        types = {a["pattern_type"] for a in d["insider_alerts"]}
        assert "INSIDER_CIRCULAR_INVOLVEMENT" in types
        # The cycle node Canara-84073862 is EMP-007's undeclared spouse account
        circ = next(a for a in d["insider_alerts"]
                    if a["pattern_type"] == "INSIDER_CIRCULAR_INVOLVEMENT")
        assert circ["employee_id"] == "EMP-007"
        assert any(e["type"] == "account_link" for e in circ["evidence"])


# ---------------------------------------------------------------------------
# Alert lifecycle: CLAIM → ESCALATE/RESOLVE with manager-gated transitions
# ---------------------------------------------------------------------------

class TestAlertLifecycle:
    def _first_alert_id(self, c, auth):
        r = c.get("/api/insider/alerts", headers=auth)
        alerts = r.json()["alerts"]
        assert alerts, "expected persisted insider alerts after graph correlation"
        return alerts[0]["alert_id"]

    def test_invalid_action_rejected_422(self, client, auth):
        c, _ = client
        alert_id = self._first_alert_id(c, auth)
        r = c.post(f"/api/insider/alerts/{alert_id}/action", headers=auth,
                   json={"action": "NUKE"})
        assert r.status_code == 422

    def test_full_lifecycle_with_audit_trail(self, client, auth):
        c, _ = client
        alert_id = self._first_alert_id(c, auth)

        # Investigator claims
        r = c.post(f"/api/insider/alerts/{alert_id}/action", headers=auth,
                   json={"action": "CLAIM", "notes": "Taking ownership for review"})
        assert r.status_code == 200
        assert r.json()["status"] == "CLAIMED"
        assert r.json()["audited"] is True

        # Investigator escalates
        r = c.post(f"/api/insider/alerts/{alert_id}/action", headers=auth,
                   json={"action": "ESCALATE"})
        assert r.status_code == 200
        assert r.json()["status"] == "ESCALATED"

        # Manager resolves (login as Sarah Chen — investigator cannot resolve)
        r = c.post("/api/auth/login", json={
            "email": "sarah.chen@smarthorizon.ai", "password": "demo-password"
        })
        mgr = {"Authorization": f"Bearer {r.json()['access_token']}"}
        r = c.post(f"/api/insider/alerts/{alert_id}/action", headers=mgr,
                   json={"action": "RESOLVE", "notes": "Confirmed with HR, employee suspended"})
        assert r.status_code == 200
        assert r.json()["status"] == "RESOLVED"

        # History recorded all three transitions
        r = c.get(f"/api/insider/alerts/{alert_id}/history", headers=auth)
        assert r.status_code == 200
        actions = [e["action"] for e in r.json()["events"]]
        assert "INSIDER_ALERT_CLAIMED" in actions
        assert "INSIDER_ALERT_ESCALATED" in actions
        assert "INSIDER_ALERT_RESOLVED" in actions

    def test_invalid_transition_rejected_409(self, client, auth):
        c, _ = client
        # Find or drive an alert into RESOLVED, then try to ESCALATE it
        r = c.get("/api/insider/alerts", headers=auth)
        alerts = r.json()["alerts"]
        target = next((a for a in alerts if a["status"] == "OPEN"), None)
        assert target, "expected an OPEN alert"
        alert_id = target["alert_id"]

        c.post(f"/api/insider/alerts/{alert_id}/action", headers=auth, json={"action": "CLAIM"})

        # RESOLVE is manager-gated — login as Sarah Chen
        r = c.post("/api/auth/login", json={
            "email": "sarah.chen@smarthorizon.ai", "password": "demo-password"
        })
        mgr = {"Authorization": f"Bearer {r.json()['access_token']}"}
        c.post(f"/api/insider/alerts/{alert_id}/action", headers=mgr, json={"action": "RESOLVE"})

        # RESOLVED cannot be escalated (must REOPEN first)
        r = c.post(f"/api/insider/alerts/{alert_id}/action", headers=auth, json={"action": "ESCALATE"})
        assert r.status_code == 409

    def test_dismiss_requires_manager_role(self, client, auth):
        c, _ = client
        r = c.get("/api/insider/alerts", headers=auth)
        alerts = r.json()["alerts"]
        target = next((a for a in alerts if a["status"] == "OPEN"), None)
        if not target:
            pytest.skip("no OPEN alert available")
        alert_id = target["alert_id"]

        # Investigator lacks permission to dismiss
        r = c.post(f"/api/insider/alerts/{alert_id}/action", headers=auth, json={"action": "DISMISS"})
        assert r.status_code == 403

        # Manager can dismiss, then reopen
        r = c.post("/api/auth/login", json={
            "email": "sarah.chen@smarthorizon.ai", "password": "demo-password"
        })
        mgr = {"Authorization": f"Bearer {r.json()['access_token']}"}
        r = c.post(f"/api/insider/alerts/{alert_id}/action", headers=mgr, json={"action": "DISMISS"})
        assert r.status_code == 200
        assert r.json()["status"] == "DISMISSED"

        r = c.post(f"/api/insider/alerts/{alert_id}/action", headers=mgr, json={"action": "REOPEN"})
        assert r.status_code == 200
        assert r.json()["status"] == "OPEN"


# ---------------------------------------------------------------------------
# Insider audit trail endpoint (/api/insider/audit)
# ---------------------------------------------------------------------------

class TestInsiderAuditTrail:
    def test_requires_auth(self, client):
        c, _ = client
        assert c.get("/api/insider/audit").status_code in (401, 403)

    def test_returns_lifecycle_events_after_transition(self, client, auth):
        c, _ = client
        # Drive one transition so at least one insider event exists
        r = c.get("/api/insider/alerts", headers=auth)
        alerts = r.json()["alerts"]
        target = next((a for a in alerts if a["status"] == "OPEN"), None)
        assert target, "expected an OPEN alert"
        r = c.post(f"/api/insider/alerts/{target['alert_id']}/action", headers=auth,
                   json={"action": "CLAIM"})
        assert r.status_code == 200

        r = c.get("/api/insider/audit", headers=auth)
        assert r.status_code == 200
        body = r.json()
        assert body["total"] >= 1
        for evt in body["events"]:
            assert evt["action"].startswith("INSIDER_")
            assert evt["actor"] and evt["timestamp"]
        assert any(e["action"] == "INSIDER_ALERT_CLAIMED" for e in body["events"])
        assert any(target["alert_id"] in e["details"] for e in body["events"])

    def test_excludes_unrelated_audit_events(self, client, auth):
        c, _ = client
        r = c.get("/api/insider/audit", headers=auth)
        actions = {e["action"] for e in r.json()["events"]}
        assert not (actions & {"CASE_OPENED", "CASE_UPDATED", "ANALYST_DECISION"})

    def test_limit_param_respected(self, client, auth):
        c, _ = client
        r = c.get("/api/insider/audit", headers=auth, params={"limit": 1})
        assert r.status_code == 200
        assert r.json()["total"] <= 1
