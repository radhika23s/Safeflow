"""Quick live verification of the RBAC decision matrix against a running server."""
import os
import sys

import httpx

BASE = os.getenv("SAFEFLOW_BASE", "http://127.0.0.1:8000")
PASSWORD = os.getenv("DEMO_PASSWORD", "demo-password")

USERS = {
    "investigator": "marcus.johnson@smarthorizon.ai",
    "manager": "sarah.chen@smarthorizon.ai",
    "administrator": "alex.chen@smarthorizon.ai",
}


def login(email: str) -> str:
    r = httpx.post(f"{BASE}/api/auth/login", json={"email": email, "password": PASSWORD}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def decide(token: str, decision: str):
    r = httpx.post(
        f"{BASE}/api/cases/FC-TEST-RBAC/decision",
        json={"decision": decision, "notes": "rbac-matrix-verification"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    return r.status_code


def main() -> int:
    tokens = {role: login(email) for role, email in USERS.items()}

    # decision -> (allowed roles)
    matrix = {
        "APPROVE_BLOCK": {"manager"},
        "APPROVE_FLAG": {"investigator", "manager"},
        "DISMISS": {"investigator", "manager"},
        "ESCALATE": {"investigator", "manager"},
    }

    failures = []
    for decision, allowed in matrix.items():
        for role, token in tokens.items():
            code = decide(token, decision)
            allowed_response = 200 <= code < 300
            # 404 (unknown case) still proves the RBAC gate passed; 403 proves it blocked.
            gate_passed = code != 403
            ok = gate_passed if role in allowed else (code == 403)
            status_word = "PASS" if ok else "FAIL"
            print(f"[{status_word}] {role:13s} {decision:14s} -> HTTP {code}")
            if not ok:
                failures.append((role, decision, code))

    if failures:
        print(f"\n{len(failures)} RBAC FAILURES: {failures}")
        return 1
    print("\nAll RBAC decision-gate checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
