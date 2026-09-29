"""
Verification script for investigation scoring.
Verifies that:
1. Cases with score ~94 (e.g. FC-20260815-8E916E) do NOT drop to 1.1, 4, 10.
2. Structuring and Circular cases maintain their critical scores (98.4, 99.2).
3. Direct transaction investigations on CRITICAL transactions maintain CRITICAL floors (>= 85).
4. Persisted cases retain their high risk scores in the database.
"""
import asyncio
import os
import pickle
import json
import sqlite3
from state import app_state
from routers.investigate import run_investigation
from auth import CurrentUser

async def main():
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(backend_dir, "fraud_model.pkl")
    meta_path = os.path.join(backend_dir, "model_metadata.json")
    with open(model_path, "rb") as f:
        app_state.model = pickle.load(f)
    with open(meta_path, "r") as f:
        app_state.metadata = json.load(f)

    db_path = os.path.join(backend_dir, "horizon.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    user = CurrentUser(
        user_id="usr-test",
        email="test@smarthorizon.ai",
        name="Test Analyst",
        role="investigator",
    )

    test_targets = [
        ("FC-20260815-8E916E", 94.0, "Feeder/Mule Syndicate Case"),
        ("FC-20260904-STR01", 98.0, "Structuring Case"),
        ("FC-20260904-CIRC01", 99.0, "Circular Flow Case"),
        ("TXN-CIRC-03", 85.0, "Direct Txn: Circular Hop 3"),
        ("TXN-STR-01", 85.0, "Direct Txn: Structuring Hop 1"),
        ("TXN-MULE-03", 85.0, "Direct Txn: Mule Cashout"),
    ]

    print("=" * 70)
    print("INVESTIGATION RISK SCORE VERIFICATION")
    print("=" * 70)

    all_passed = True
    for target_id, min_expected_score, label in test_targets:
        res = await run_investigation(
            transaction_id=target_id,
            conn=conn,
            user=user,
            auto_create_case=True,
        )
        score = res["risk_score"]
        band = res["risk_band"]
        action = res["recommended_action"]
        val_status = res.get("validator", {}).get("validated")

        passed = score >= min_expected_score and band == "CRITICAL"
        status_str = "PASS" if passed else "FAIL"
        if not passed:
            all_passed = False

        print(f"[{status_str}] {label} ({target_id}):")
        print(f"       Score: {score}/100 (Expected >= {min_expected_score})")
        print(f"       Band:  {band} | Action: {action}")
        print(f"       Validator: {'Validated' if val_status else 'Flagged/Needs Review'}")
        print(f"       Adjustments: {res.get('rule_adjustments', [])}")
        print("-" * 70)

    # Verify DB persistence
    print("\nVerifying database cases table:")
    rows = conn.execute("SELECT case_id, risk_score, risk_band, recommended_action FROM cases").fetchall()
    for r in rows:
        print(f"  DB Case {r['case_id']}: Score={r['risk_score']}, Band={r['risk_band']}, Action={r['recommended_action']}")
        if r["risk_score"] < 80.0:
            print(f"  [ERROR] Case {r['case_id']} has dropped below critical band!")
            all_passed = False

    conn.close()

    print("\n" + "=" * 70)
    if all_passed:
        print(">>> ALL VERIFICATION CHECKS PASSED: SCORES MAINTAINED IN CRITICAL BAND! <<<")
    else:
        print(">>> SOME CHECKS FAILED! <<<")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
