"""
Live Insider Demo — Scenario C End-to-End Walkthrough
=====================================================
Demonstrates the full insider-risk story against a running backend:

  1. Insiders exist:      employee directory with access tiers + undeclared links
  2. The crime happens:   Scenario C transfers fired through the banking simulator
                          (sub-threshold splits processed by compromised EMP-003)
  3. The system notices:  graph engine correlates processed_by + employee-linked
                          accounts into evidence-backed insider alerts
  4. Governance responds: investigator claims the alert; manager resolves it
                          -- every step written to the immutable audit trail
  5. Regulators receive:  the STR dossier carries the insider_involvement block

Prerequisites:
  - Backend running:  cd backend && python -m uvicorn main:app --port 8000
  - Seed data:        python reset_and_seed_db.py   (once)

Run:
  cd backend && python demo_insider_flow.py
"""

import os
import sys
import time
import uuid

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import requests

BASE = os.getenv("SAFEFLOW_BASE", "http://127.0.0.1:8000")
SIM_ACCOUNTS_URL = f"{BASE}/api/simulator/accounts"
SIM_TRANSFER_URL = f"{BASE}/api/simulator/transfer"


def banner(title: str) -> None:
    print("\n" + "=" * 74)
    print(title)
    print("=" * 74)


def main() -> None:
    # ── 0. Authenticate ────────────────────────────────────────────────────────
    r = requests.post(f"{BASE}/api/auth/login", json={
        "email": "marcus.johnson@smarthorizon.ai", "password": "demo-password"
    })
    if r.status_code != 200:
        print(f"[FATAL] Login failed: {r.status_code} {r.text[:200]}")
        sys.exit(1)
    H = {"Authorization": f"Bearer {r.json()['access_token']}"}
    print(f"[OK] Authenticated as Marcus Johnson (investigator) at {BASE}")

    # ── 1. The insider exists ─────────────────────────────────────────────────
    banner("STEP 1 - THE INSIDER: Employee directory & access rights")
    emps = requests.get(f"{BASE}/api/insider/employees", headers=H).json()["employees"]
    emp = next(e for e in emps if e["employee_id"] == "EMP-003")
    undeclared = [l for l in emp["account_links"] if not l["declared"]]
    print(f"  {emp['name']} - {emp['designation']} ({emp['branch_city']})")
    print(f"  Access tier : {emp['access_tier']}")
    print(f"  Rights      : {emp['access_rights']}")
    for l in undeclared:
        print(f"  UNDECLARED LINK: {l['account_id']} ({l['relationship']})")

    # ── 2. Pick simulator accounts ────────────────────────────────────────────
    banner("STEP 2 - THE CRIME: Fire Scenario C structuring splits from /bank")
    accounts = requests.get(SIM_ACCOUNTS_URL).json()
    if not accounts:
        print("[FATAL] No simulator accounts (MongoDB Atlas offline?).")
        print("        The seeded scenarios in the case workspace show the same evidence.")
        sys.exit(1)
    sender = next((a for a in accounts if a["balance"] > 300000), accounts[0])
    receiver = next((a for a in accounts if a["id"] != sender["id"]), None)
    print(f"  Originator : {sender['name']} ({sender['accountNumber']}, bal ₹{sender['balance']:,.0f})")
    print(f"  Beneficiary: {receiver['name']} ({receiver['accountNumber']})")

    txn_ids = []
    for step in range(1, 5):
        r = requests.post(SIM_TRANSFER_URL, json={
            "from_account_id": sender["id"],
            "to_account_id": receiver["id"],
            "amount": 40000.0 + step * 1500,
            "channel": "UPI",
            "category": "Insider Structuring Demo",
            "scenario": "C",
            "step_number": step,
            "processed_by": "EMP-003",
            "idempotency_key": f"INSIDER-DEMO-{uuid.uuid4()}",
        })
        if r.status_code == 200:
            d = r.json()
            txn_ids.append(d["transaction_id"])
            print(f"  Split {step}: ₹{d['amount']:,.0f} -> ML {d['ml_risk_score']} ({d['ml_risk_band']}) "
                  f"| network {d['network_risk']} | case {d.get('case_id') or '-'}")
        else:
            print(f"  Split {step}: simulator returned {r.status_code} {r.text[:120]}")
        time.sleep(0.4)

    if not txn_ids:
        print("[WARN] No Scenario C transfers committed; skipping live-case steps.")
        return

    case_id = requests.get(f"{BASE}/api/cases/", headers=H, params={"limit": 1}).json()
    live_case = None
    if isinstance(case_id, list) and case_id:
        live_case = case_id[0]["case_id"]
    print(f"\n  Case under investigation: {live_case or '(check SOC dashboard)'}")

    # ── 3. Correlation runs ───────────────────────────────────────────────────
    banner("STEP 3 - THE SYSTEM NOTICES: Insider correlation on the case graph")
    if live_case:
        g = requests.get(f"{BASE}/api/graph/{live_case}", headers=H).json()
        print(f"  Patterns      : {[p['type'] for p in g['patterns']]}")
        print(f"  Network risk  : {g['network_risk']}")
        print(f"  Timeline      : {len(g['activity_timeline'])} interleaved events")
        for a in g["insider_alerts"]:
            print(f"  [{a['severity']:8s}] {a['pattern_type']} -> {a['employee_id']} ({len(a['evidence'])} evidence)")
    else:
        print("  (Open a case workspace in the UI to trigger graph correlation.)")

    # ── 4. Governance responds ────────────────────────────────────────────────
    banner("STEP 4 - GOVERNANCE: Claim -> escalate -> resolve with audit trail")
    alerts = requests.get(f"{BASE}/api/insider/alerts", headers=H,
                          params={"status": "OPEN"}).json()["alerts"]
    if not alerts:
        print("  No open alerts available (already reviewed?).")
        return
    target = alerts[0]
    aid = target["alert_id"]
    print(f"  Target alert : {aid} [{target['pattern_type']}]")

    r = requests.post(f"{BASE}/api/insider/alerts/{aid}/action", headers=H,
                      json={"action": "CLAIM", "notes": "Insider demo: taking ownership"})
    print(f"  CLAIM   -> {r.json()['status']} (audited={r.json()['audited']})")

    r = requests.post(f"{BASE}/api/insider/alerts/{aid}/action", headers=H,
                      json={"action": "ESCALATE", "notes": "HR + compliance conference scheduled"})
    print(f"  ESCALATE-> {r.json()['status']}")

    r = requests.post(f"{BASE}/api/auth/login", json={
        "email": "sarah.chen@smarthorizon.ai", "password": "demo-password"
    })
    MGR = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = requests.post(f"{BASE}/api/insider/alerts/{aid}/action", headers=MGR,
                      json={"action": "RESOLVE", "notes": "Confirmed with HR; employee suspended pending LEA referral"})
    print(f"  RESOLVE -> {r.json()['status']} (by {r.json()['actor']}, {r.json()['role']})")

    hist = requests.get(f"{BASE}/api/insider/alerts/{aid}/history", headers=H).json()
    print(f"  Audit history ({hist['total']} entries):")
    for e in hist["events"]:
        print(f"    - {e['action']} by {e['actor']}")

    # ── 5. Regulators receive ─────────────────────────────────────────────────
    banner("STEP 5 - THE REGULATOR: STR dossier with insider_involvement block")
    if live_case:
        s = requests.get(f"{BASE}/api/reports/{live_case}/str-draft", headers=H).json()
        ii = s.get("insider_involvement", {})
        print(f"  STR {s.get('report_id')}")
        print(f"  Insider alerts in dossier : {ii.get('insider_alert_count')}")
        print(f"  Max severity              : {ii.get('max_severity')}")
        print(f"  Attributed transactions   : {len(ii.get('attributed_transactions', []))}")
    print("\n[DEMO COMPLETE] Insider crime -> correlation -> governance -> regulator.")


if __name__ == "__main__":
    main()
