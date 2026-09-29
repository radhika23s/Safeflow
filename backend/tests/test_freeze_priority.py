"""
Unit Tests for Asset Recovery & Freeze Priority Matrix and Visibility Tiers
Testing Compliance with RBI FRM 2024 & NPCI Operational Directives
"""

import pytest
import sys
import os
import networkx as nx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routers.graph import assign_visibility_tiers, compute_freeze_priority_matrix, extract_bank_name


def test_extract_bank_name():
    assert extract_bank_name("Canara-36480482") == "Canara"
    assert extract_bank_name("Kotak-74333786") == "Kotak"
    assert extract_bank_name("Axis-55019283") == "Axis"
    assert extract_bank_name("C12345678") == "Partner Bank"


def test_assign_visibility_tiers():
    G = nx.DiGraph()
    G.add_edge("Canara-36480482", "Kotak-74333786", amount=100000.0)
    G.add_edge("Kotak-74333786", "Axis-55019283", amount=58000.0)
    G.add_edge("Kotak-74333786", "ICICI-88192039", amount=40000.0)

    assign_visibility_tiers(G, "Canara-36480482", "Kotak-74333786")

    # Host bank internal
    assert G.nodes["Canara-36480482"]["visibility_tier"] == "HOST_INTERNAL"
    assert "Host Bank" in G.nodes["Canara-36480482"]["visibility_label"]

    # Hop 1 (counterparty)
    assert G.nodes["Kotak-74333786"]["visibility_tier"] == "EXTERNAL_LAST_CONFIRMED_HOP"
    assert "Payment Rail Egress" in G.nodes["Kotak-74333786"]["visibility_label"]

    # 2+ hops out
    assert G.nodes["Axis-55019283"]["visibility_tier"] == "COLLABORATIVE_REGULATORY_LAYER"
    assert G.nodes["ICICI-88192039"]["visibility_tier"] == "COLLABORATIVE_REGULATORY_LAYER"


def test_compute_freeze_priority_matrix():
    G = nx.DiGraph()
    # Canara -> Kotak (100k)
    G.add_edge("Canara-36480482", "Kotak-74333786", amount=100000.0, timestamp="2026-09-04T10:00:00")
    # Kotak -> Axis (58k, leaves Axis untouched -> active recoverable)
    G.add_edge("Kotak-74333786", "Axis-55019283", amount=58000.0, timestamp="2026-09-04T10:05:00")
    # Kotak -> ICICI (40k, then ICICI cashes out 40k -> ATM terminal)
    G.add_edge("Kotak-74333786", "ICICI-88192039", amount=40000.0, timestamp="2026-09-04T10:06:00")
    G.add_edge("ICICI-88192039", "ATM-CASHOUT-01", amount=40000.0, timestamp="2026-09-04T10:15:00")

    assign_visibility_tiers(G, "Canara-36480482", "Kotak-74333786")
    matrix, stopping_rule = compute_freeze_priority_matrix(
        G, "Canara-36480482", "Kotak-74333786", 100000.0
    )

    assert len(matrix) >= 3
    assert "stopping" in stopping_rule.lower() or "halted" in stopping_rule.lower()

    # Find Axis in matrix
    axis_entry = next(item for item in matrix if item["account_id"] == "Axis-55019283")
    assert axis_entry["retained_amount"] == 58000.0
    assert axis_entry["retained_pct"] == 58.0
    assert axis_entry["recovery_status"] == "RECOVERABLE_IN_ACCOUNT"
    assert axis_entry["freeze_priority"] == "P1_IMMEDIATE_DEBIT_FREEZE"

    # Find ICICI in matrix (forwarded all 40k to ATM)
    icici_entry = next(item for item in matrix if item["account_id"] == "ICICI-88192039")
    assert icici_entry["retained_amount"] == 0.0
    assert icici_entry["recovery_status"] == "DISPERSED_TERMINAL_CASHOUT"
    assert icici_entry["freeze_priority"] == "LEA_NCRP_REFERRAL_ONLY"

    # Top priority should be Axis since it has ₹58k active
    assert matrix[0]["account_id"] == "Axis-55019283"
