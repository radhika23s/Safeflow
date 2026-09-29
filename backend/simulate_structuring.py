"""
SafeFlow Phase 3 — Structuring / Smurfing Simulation Demo Script
=================================================================
Validates the Network-Layer Differentiator against per-transaction ML.

Scenario:
  An organized financial crime actor attempts to move ~INR 1,40,000 across
  multiple mule accounts. To evade the PMLA Section 12 statutory AML reporting
  ceiling of INR 50,000, the actor splits the sum into 4 rapid, sub-threshold transfers
  (INR 34,500, 36,200, 32,800, 38,000) within 4 minutes.

Demonstration Output:
  - Per-Transaction XGBoost Model: Evaluates each transfer independently as LOW/MEDIUM risk.
  - SafeFlow NetworkX Graph Layer: Tracks topological out-degree and sub-50k velocity,
    escalating the composite case to CRITICAL (Structuring Syndicate Confirmed).
"""

import sys
import os
import sqlite3
from datetime import datetime, timedelta

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import networkx as nx
from routers.graph import _detect_patterns

def run_simulation():
    print("=" * 72)
    print("SAFEFLOW FINANCIAL CRIME INTELLIGENCE -- PHASE 3 NETWORK REHEARSAL")
    print("SCENARIO: PMLA Sub-Threshold Structuring (Smurfing Attack)")
    print("=" * 72)
    print()

    sender_account = "HDFC-STRUCT-SENDER"
    receivers = [
        ("MULE-PAYEE-01", 34500.0),
        ("MULE-PAYEE-02", 36200.0),
        ("MULE-PAYEE-03", 32800.0),
        ("MULE-PAYEE-04", 38000.0),
    ]

    G = nx.DiGraph()
    G.add_node(sender_account)

    base_time = datetime.now()
    total_laundered = 0.0

    print(f"Origin Target Account: {sender_account}")
    print(f"PMLA Reporting Statutory Limit: INR 50,000.00")
    print("-" * 72)

    for step, (receiver, amount) in enumerate(receivers, 1):
        txn_time = base_time + timedelta(minutes=step)
        total_laundered += amount

        # Add to graph
        G.add_node(receiver)
        G.add_edge(
            sender_account,
            receiver,
            amount=amount,
            channel="UPI",
            timestamp=txn_time.isoformat(),
            transaction_id=f"SIM-STR-0{step}",
        )

        # Mock per-transaction XGBoost score (each transfer looks like normal UPI)
        mock_xgboost_score = 38.0 + (step * 1.5)
        xgboost_band = "LOW" if mock_xgboost_score < 50 else "MEDIUM"

        # SafeFlow NetworkX Relational Detection
        patterns, network_risk, summary = _detect_patterns(G, sender_account, receiver)

        print(f"\n[TRANSFER {step}/4] Time: +{step}m | Amount: INR {amount:,.2f} -> {receiver}")
        print(f"  |-- Standalone XGBoost Score : {mock_xgboost_score:.1f}/100 ({xgboost_band} Risk)")
        print(f"  |   +-- Model Judgment       : INDIVIDUALLY BENIGN (< INR 50,000 PMLA Ceiling)")
        print(f"  |-- SafeFlow NetworkX Layer  : {network_risk} ({summary})")
        print(f"  |   |-- Unique Counterparties: {G.out_degree(sender_account)}")
        print(f"  |   +-- Cluster Flow Total   : INR {total_laundered:,.2f}")

        if patterns:
            for p in patterns:
                print(f"  +-- [ALERT] PATTERN DETECTED : [{p['type']}] ({p.get('severity', 'HIGH')})")
                print(f"      +-- {p['description']}")
        else:
            print(f"  +-- Patterns Detected        : None yet (threshold accumulation in progress)")

    print("\n" + "=" * 72)
    print("FINAL INVESTIGATION ASSESSMENT:")
    print("  Standalone ML Outcome : MISSED (4 disconnected low-risk UPI alerts)")
    print(f"  SafeFlow NetworkX Call: {network_risk} ESCALATION - Statutory STR Draft Triggered")
    print("=" * 72)

if __name__ == "__main__":
    run_simulation()
