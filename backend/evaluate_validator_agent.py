"""
SafeFlow validatorAgent (Agent 5) Accuracy & Fault-Injection Evaluation Harness
==============================================================================
Evaluates validatorAgent accuracy against the labeled transaction dataset in horizon.db
WITHOUT touching MongoDB or any ledger storage infrastructure.

Phases:
  1. Threshold Boundary Audit (Verifying synchronization with PaySim 20/50/80 bands)
  2. Adversarial Fault-Injection Suite (Hallucinated citations, Irrelevant citations, Contradictory decisions)
  3. Clean Baseline & False Positive Rate (Alarm fatigue check on legitimate transactions)
  4. Historical Case Spot-Check (Audit of existing cases & human analyst overrides)
"""

import os
import sys
import sqlite3
import re
from typing import Any

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from agents.validator_agent import (
    validate_investigation,
    HIGH_RISK_SCORE_THRESHOLD,
    LOW_MEDIUM_SCORE_BOUNDARY,
    CITATION_RELEVANCE_THRESHOLD,
)
from database import seed_regulations


def get_dataset_connection() -> tuple[sqlite3.Connection, str]:
    """Find and connect to horizon.db containing the 413 transaction dataset."""
    root_db = os.path.join(os.path.dirname(backend_dir), "horizon.db")
    backend_db = os.path.join(backend_dir, "horizon.db")

    target_db = root_db if os.path.exists(root_db) else backend_db
    conn = sqlite3.connect(target_db)
    conn.row_factory = sqlite3.Row

    # Ensure regulations table exists in target DB
    conn.execute("""
        CREATE TABLE IF NOT EXISTS regulations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            act TEXT NOT NULL,
            section TEXT NOT NULL,
            page_ref TEXT,
            summary_text TEXT NOT NULL,
            UNIQUE(act, section)
        )
    """)
    conn.commit()
    seed_regulations(conn)

    return conn, target_db


# ─── Report Generator Helpers ──────────────────────────────────────────────────

def make_clean_report(txn: dict, act: str = "PMLA", section: str = "12") -> str:
    """Generates a well-formed report with valid regulatory citation and context."""
    return f"""
### 1. ALERT SUMMARY
Transaction {txn.get('transaction_id')} involves an amount of INR {float(txn.get('amount', 0)):,.2f}.

### 2. SUSPICIOUS INDICATORS
Observed fund movement on channel {txn.get('channel', 'UPI')} from account {txn.get('sender_account')} 
to account {txn.get('receiver_account')}. Rapid fund dispersion across counterparties detected.

### 3. REGULATORY COMPLIANCE ASSESSMENT
- **PMLA 2002 (Sec 12)**: Reporting entity to maintain records of all transactions, verify client identities, and furnish information to FIU-IND within specified timeframes. Section 12 of the Prevention of Money Laundering Act mandates strict filing.
- **RBI Master Direction (Fraud Risk Management 2024)**: Framework for early fraud detection, account monitoring, staff accountability, and prompt reporting of suspicious transactions.
- **NPCI OC 138**: Operational circular mandating detection and containment of mule accounts, velocity monitoring, and real-time transaction blocking across UPI rails.

### 4. ACTION & RATIONALE
Recommended intervention based on multi-hop network intelligence.
"""


def make_hallucinated_citation_report(txn: dict) -> str:
    """Injects a non-existent regulatory section into the narrative."""
    return f"""
### 1. ALERT SUMMARY
Transaction {txn.get('transaction_id')} for INR {float(txn.get('amount', 0)):,.2f}.

### 2. SUSPICIOUS INDICATORS
High velocity flow detected across origin and beneficiary accounts.

### 3. REGULATORY COMPLIANCE ASSESSMENT
- **PMLA 2002 (Sec 99)**: Mandates immediate confiscation under Section 99 of the Prevention of Money Laundering Act.
- **RBI Master Direction (Fraud Risk Management 2024)**: Reporting required to authorities.

### 4. ACTION & RATIONALE
Escalation required.
"""


def make_irrelevant_citation_report(txn: dict) -> str:
    """Injects a valid regulation ID but with completely unrelated, mismatched text."""
    return f"""
### 1. ALERT SUMMARY
Transaction {txn.get('transaction_id')} for INR {float(txn.get('amount', 0)):,.2f}.

### 2. SUSPICIOUS INDICATORS
The weather in the northern hills showed sunny skies and temperatures around twenty degrees. 
Agricultural yields for winter wheat reached expected seasonal benchmarks across farming zones.

### 3. REGULATORY COMPLIANCE ASSESSMENT
- **NPCI OC 138**: The seasonal crop harvesting timeline was monitored by local municipal committees.

### 4. ACTION & RATIONALE
Review completed.
"""


# ─── Evaluation Harness ────────────────────────────────────────────────────────

def evaluate():
    conn, db_path = get_dataset_connection()
    txn_count = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
    case_count = conn.execute("SELECT COUNT(*) FROM cases").fetchone()[0]

    print("=" * 78)
    print(" SAFEFLOW VALIDATOR AGENT (AGENT 5) AUDIT & ACCURACY EVALUATION")
    print("=" * 78)
    print(f"Database Target        : {db_path} (Pure SQLite)")
    print(f"Dataset Scale          : {txn_count} Total Transactions, {case_count} Historical Cases")
    print(f"Active Threshold Config: HIGH_RISK >= {HIGH_RISK_SCORE_THRESHOLD} | LOW_RISK < {LOW_MEDIUM_SCORE_BOUNDARY}")
    print("=" * 78)

    # ──────────────────────────────────────────────────────────────────────────
    # Phase 1: Threshold Boundary Audit
    # ──────────────────────────────────────────────────────────────────────────
    print("\n>>> PHASE 1: THRESHOLD BOUNDARY SYNCHRONIZATION AUDIT")
    print("-" * 78)
    
    boundary_tests = [
        # (risk_score, action, expected_consistent, test_desc)
        (49.9, "ALLOW", True,  "ALLOW on 49.9 (Below HIGH band 50.0) -> Must PASS"),
        (50.0, "ALLOW", False, "ALLOW on 50.0 (At HIGH band boundary) -> Must FAIL (inconsistent)"),
        (85.0, "ALLOW", False, "ALLOW on 85.0 (CRITICAL band) -> Must FAIL (inconsistent)"),
        (20.0, "BLOCK", True,  "BLOCK on 20.0 (At MEDIUM band boundary) -> Must PASS"),
        (19.9, "BLOCK", False, "BLOCK on 19.9 (Below LOW band 20.0) -> Must FAIL (inconsistent)"),
        (5.0,  "BLOCK", False, "BLOCK on 5.0 (Deep in LOW band) -> Must FAIL (inconsistent)"),
        (75.0, "FLAG",  True,  "FLAG on 75.0 (In HIGH band) -> Must PASS"),
        (92.0, "BLOCK", True,  "BLOCK on 92.0 (In CRITICAL band) -> Must PASS"),
    ]

    p1_passed = 0
    clean_rep = make_clean_report({"transaction_id": "TEST-01"})
    for score, action, expected_consistent, desc in boundary_tests:
        res = validate_investigation(
            reason_output=clean_rep,
            decision_output={"action": action},
            risk_score=score,
            regulations_db=conn,
        )
        is_consistent = "decision_consistent" not in res["failed_checks"]
        passed = (is_consistent == expected_consistent)
        status = "PASS" if passed else "FAIL"
        if passed:
            p1_passed += 1
        print(f"  [{status}] {desc}")
        if not passed:
            print(f"         Got failed_checks: {res['failed_checks']}")

    print(f"\nPhase 1 Result: {p1_passed}/{len(boundary_tests)} Boundary Checks Passed.")

    # ──────────────────────────────────────────────────────────────────────────
    # Phase 2: Adversarial Injection Testing
    # ──────────────────────────────────────────────────────────────────────────
    print("\n>>> PHASE 2: ADVERSARIAL FAULT-INJECTION SUITE (GROUND-TRUTH ACCURACY)")
    print("-" * 78)

    # Sample representative transactions: 70 fraud (all types) + 30 legit
    fraud_rows = conn.execute("""
        SELECT * FROM transactions WHERE is_fraud = 1
        ORDER BY scenario_type
    """).fetchall()

    legit_rows = conn.execute("""
        SELECT * FROM transactions WHERE is_fraud = 0
        LIMIT 30
    """).fetchall()

    test_sample = [dict(r) for r in fraud_rows] + [dict(r) for r in legit_rows]
    sample_size = len(test_sample)

    print(f"Evaluating across {sample_size} sample transactions ({len(fraud_rows)} Fraud + {len(legit_rows)} Legit):")

    fault1_caught = 0  # Hallucinated citation
    fault2_caught = 0  # Irrelevant citation
    fault3a_caught = 0 # Contradictory ALLOW on Critical
    fault3b_caught = 0 # Contradictory BLOCK on Low

    for txn in test_sample:
        # Fault 1: Hallucinated citation
        rep_f1 = make_hallucinated_citation_report(txn)
        res_f1 = validate_investigation(rep_f1, {"action": "MONITOR"}, 40.0, conn)
        if "citation_exists" in res_f1["failed_checks"] and not res_f1["validated"]:
            fault1_caught += 1

        # Fault 2: Irrelevant citation
        rep_f2 = make_irrelevant_citation_report(txn)
        res_f2 = validate_investigation(rep_f2, {"action": "MONITOR"}, 40.0, conn)
        if "citation_relevant" in res_f2["failed_checks"] and not res_f2["validated"]:
            fault2_caught += 1

        # Fault 3a: Force ALLOW on high/critical risk
        rep_clean = make_clean_report(txn)
        res_f3a = validate_investigation(rep_clean, {"action": "ALLOW"}, 92.5, conn)
        if "decision_consistent" in res_f3a["failed_checks"] and not res_f3a["validated"]:
            fault3a_caught += 1

        # Fault 3b: Force BLOCK on low risk
        res_f3b = validate_investigation(rep_clean, {"action": "BLOCK"}, 12.0, conn)
        if "decision_consistent" in res_f3b["failed_checks"] and not res_f3b["validated"]:
            fault3b_caught += 1

    f1_rate = (fault1_caught / sample_size) * 100
    f2_rate = (fault2_caught / sample_size) * 100
    f3a_rate = (fault3a_caught / sample_size) * 100
    f3b_rate = (fault3b_caught / sample_size) * 100
    total_injected = sample_size * 4
    total_caught = fault1_caught + fault2_caught + fault3a_caught + fault3b_caught
    overall_recall = (total_caught / total_injected) * 100

    print(f"  Fault 1 (Citation Hallucination) : {fault1_caught}/{sample_size} Caught ({f1_rate:.2f}%)")
    print(f"  Fault 2 (Irrelevant Citation)    : {fault2_caught}/{sample_size} Caught ({f2_rate:.2f}%)")
    print(f"  Fault 3a (ALLOW on CRITICAL 92.5): {fault3a_caught}/{sample_size} Caught ({f3a_rate:.2f}%)")
    print(f"  Fault 3b (BLOCK on LOW 12.0)     : {fault3b_caught}/{sample_size} Caught ({f3b_rate:.2f}%)")
    print(f"\n  OVERALL ADVERSARIAL RECALL      : {total_caught}/{total_injected} Caught ({overall_recall:.2f}%)")

    # ──────────────────────────────────────────────────────────────────────────
    # Phase 3: Clean Baseline & False Positive Rate (Alarm Fatigue Test)
    # ──────────────────────────────────────────────────────────────────────────
    print("\n>>> PHASE 3: CLEAN BASELINE & FALSE POSITIVE AUDIT (ALARM FATIGUE CHECK)")
    print("-" * 78)

    legit_all = conn.execute("""
        SELECT * FROM transactions WHERE scenario_type = 'LEGITIMATE'
        LIMIT 100
    """).fetchall()

    clean_tested = 0
    clean_false_alarms = 0

    for r in legit_all:
        txn = dict(r)
        rep = make_clean_report(txn)
        # Legitimate transaction appropriately mapped to ALLOW with low score
        res = validate_investigation(rep, {"action": "ALLOW"}, 8.5, conn)
        clean_tested += 1
        if not res["validated"]:
            clean_false_alarms += 1

    fp_rate = (clean_false_alarms / clean_tested) * 100 if clean_tested > 0 else 0
    print(f"  Legitimate Baseline Tested   : {clean_tested} Well-Formed Transactions")
    print(f"  Spurious 'Needs Review' Flags: {clean_false_alarms}")
    print(f"  False Positive Rate (FPR)    : {fp_rate:.2f}% (Target: <= 1.0%)")

    # ──────────────────────────────────────────────────────────────────────────
    # Phase 4: Historical 15 Cases Spot-Check
    # ──────────────────────────────────────────────────────────────────────────
    print("\n>>> PHASE 4: HISTORICAL 15 CASES SPOT-CHECK & HUMAN OVERRIDE AUDIT")
    print("-" * 78)

    historical_cases = conn.execute("SELECT * FROM cases LIMIT 15").fetchall()
    print(f"Auditing {len(historical_cases)} Pre-Existing Historical Cases in horizon.db:\n")

    override_vindications = 0
    for idx, c in enumerate(historical_cases, 1):
        case_id = c["case_id"]
        txn_id = c["transaction_id"]
        score = float(c["risk_score"] or 50.0)
        rec_action = c["recommended_action"] or "MONITOR"
        human_dec = c["analyst_decision"]

        # Run validation on the recorded recommendation
        rep = make_clean_report({"transaction_id": txn_id})
        val_res = validate_investigation(rep, {"action": rec_action}, score, conn)
        status_badge = "VALIDATED" if val_res["validated"] else "NEEDS_REVIEW"

        disagreement = human_dec and (human_dec != rec_action and f"APPROVE_{rec_action}" != human_dec)
        override_str = f" [HUMAN OVERRIDE: {rec_action} -> {human_dec}]" if disagreement else ""
        if disagreement:
            override_vindications += 1

        print(f"  {idx:2d}. Case {case_id} ({txn_id}):")
        print(f"      Risk Score: {score:.1f} | Recommended: {rec_action}{override_str}")
        print(f"      Validator Result: {status_badge} (Review Level: {val_res['forced_review_level']})")

    print(f"\nHistorical Analyst Overrides Identified: {override_vindications}")

    # ──────────────────────────────────────────────────────────────────────────
    # Phase 5: Executive Scorecard
    # ──────────────────────────────────────────────────────────────────────────
    print("\n" + "=" * 78)
    print(" VALIDATOR AGENT (AGENT 5) VERIFICATION SCORECARD")
    print("=" * 78)
    print(f"  Threshold Alignment       : {'100% (SYNCHRONIZED)' if p1_passed == len(boundary_tests) else 'MISALIGNED'}")
    print(f"  Citation Hallucination Det: {f1_rate:.1f}%")
    print(f"  Citation Relevance Det    : {f2_rate:.1f}%")
    print(f"  Contradiction Detection   : {((fault3a_caught + fault3b_caught) / (sample_size * 2)) * 100:.1f}%")
    print(f"  Adversarial Recall (Power): {overall_recall:.1f}%")
    print(f"  Alarm Fatigue FPR (Clean) : {fp_rate:.1f}%")
    print("=" * 78)
    if overall_recall >= 99.0 and fp_rate <= 1.0 and p1_passed == len(boundary_tests):
        print(">>> ALL EVALUATION PHASES PASSED: VALIDATOR AGENT DEFENSE-GRADE! <<<")
    else:
        print(">>> ATTENTION REQUIRED ON FLAGGED ITEMS ABOVE <<<")
    print("=" * 78)

    conn.close()


if __name__ == "__main__":
    evaluate()
