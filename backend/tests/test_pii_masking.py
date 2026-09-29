"""
Unit Tests for Zero-Knowledge PII Tokenization and Re-hydration Layer
Testing Compliance with RBI IT Outsourcing Directives & DPDP Act 2023
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routers.investigate import mask_for_llm, rehydrate_llm_report, _build_llm_prompt


def test_pii_masking_tokens_and_reverse_map():
    txn = {
        "transaction_id": "TXN-SEC-998822",
        "sender_account": "Canara-36480482",
        "receiver_account": "Kotak-74333786",
        "amount": 100000.0,
        "channel": "UPI",
        "customer_name": "Vikram Malhotra",
        "phone": "+919820112235",
        "old_balance_orig": 120000.0,
        "new_balance_orig": 20000.0,
        "old_balance_dest": 5000.0,
        "new_balance_dest": 105000.0,
    }
    score_result = {
        "risk_score": 92.5,
        "risk_band": "CRITICAL",
        "top_factors": [{"feature": "amount", "shap_value": 0.45, "description": "High value"}],
    }
    graph_context = {
        "nodes": [
            {"id": "Canara-36480482", "role": "ORIGIN"},
            {"id": "Kotak-74333786", "role": "INTERMEDIARY"},
            {"id": "Axis-55019283", "role": "MULE_CASHOUT"},
        ],
        "links": [
            {"source": "Canara-36480482", "target": "Kotak-74333786", "amount": 100000.0, "transaction_id": "TXN-SEC-998822"},
            {"source": "Kotak-74333786", "target": "Axis-55019283", "amount": 58000.0, "transaction_id": "TXN-MULE-01"},
        ],
        "patterns": [{"type": "FAN_OUT", "description": "Mule fan-out from Kotak-74333786 to Axis-55019283"}],
    }

    masked_txn, masked_graph, reverse_map = mask_for_llm(txn, score_result, graph_context)

    # 1. Verify sensitive raw values do not exist in masked_txn
    assert masked_txn["sender_account"] != "Canara-36480482"
    assert masked_txn["receiver_account"] != "Kotak-74333786"
    assert masked_txn["transaction_id"] != "TXN-SEC-998822"
    assert masked_txn["customer_name"] == "[PII_STRIPPED_PER_DPDP_ACT]"
    assert masked_txn["phone"] == "[PII_STRIPPED_PER_DPDP_ACT]"

    # 2. Verify prompt string contains ZERO raw customer identifiers
    prompt = _build_llm_prompt(masked_txn, score_result, masked_graph)
    assert "Canara-36480482" not in prompt
    assert "Kotak-74333786" not in prompt
    assert "TXN-SEC-998822" not in prompt
    assert "Vikram Malhotra" not in prompt
    assert "+919820112235" not in prompt

    # 3. Verify tokens exist in prompt
    assert "ACC_ORIGIN_A1" in prompt
    assert "ACC_BENEFICIARY_B1" in prompt

    # 4. Verify rehydration restores exact identifiers
    simulated_llm_output = (
        "Investigation indicates that ACC_ORIGIN_A1 initiated an unauthorized transfer to "
        "ACC_BENEFICIARY_B1 under transaction TXN_REF_01. Downstream funds moved to ACC_MULE_1."
    )
    rehydrated = rehydrate_llm_report(simulated_llm_output, reverse_map)
    assert "Canara-36480482" in rehydrated
    assert "Kotak-74333786" in rehydrated
    assert "TXN-SEC-998822" in rehydrated
    assert "Axis-55019283" in rehydrated
    assert "ACC_ORIGIN_A1" not in rehydrated
    assert "ACC_BENEFICIARY_B1" not in rehydrated
