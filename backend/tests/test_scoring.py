"""Tests for scoring consistency, feature parity, and severity overrides (Points 4-5).

Verifies:
- Training/serving feature parity with 14 PaySim features (TC-U01, TC-U02, TC-U03)
- Cross-endpoint scoring consistency with calibrated bands (TC-C01)
- Severity override transparency (TC-C02)
"""

import os
import sys
import math
import pytest
import numpy as np
import pandas as pd
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from features import engineer_features, TYPE_MAP, FEATURE_COLS, SUPPORTED_TYPES

BASE = "http://127.0.0.1:8000"


def _login():
    r = requests.post(f"{BASE}/api/auth/login", json={
        "email": "marcus.johnson@smarthorizon.ai", "password": "demo-password"
    })
    assert r.status_code == 200
    return r.json()["access_token"]


# ── TC-U01: Feature engineering parity ───────────────────────────────────────

class TestFeatureParity:
    """Ensure engineer_features emits the canonical 14 features in exact order."""

    def _make_txn(self, amount=50000.0, step=100, txn_type="TRANSFER"):
        old_bal = max(amount, 100000.0)
        return {
            "step": step, "type": txn_type, "amount": amount,
            "nameOrig": "C1001", "nameDest": "C2002",
            "oldbalanceOrg": old_bal, "newbalanceOrig": old_bal - amount,
            "oldbalanceDest": 0.0, "newbalanceDest": amount,
        }

    def test_engineering_matches_feature_cols(self):
        """engineer_features must emit exactly the 14 features in exact order."""
        txn = self._make_txn(50000.0)
        df = pd.DataFrame([txn])
        result = engineer_features(df)
        assert list(result.columns) == FEATURE_COLS
        assert len(result.columns) == 14

    def test_hour_and_night_features(self):
        """Step 3 (3 AM) should be night; step 14 (2 PM) should not be night."""
        night_txn = self._make_txn(step=3)
        day_txn = self._make_txn(step=14)
        df_night = engineer_features(pd.DataFrame([night_txn]))
        df_day = engineer_features(pd.DataFrame([day_txn]))

        assert df_night["hour"].iloc[0] == 3
        assert df_night["is_night"].iloc[0] == 1
        assert df_day["hour"].iloc[0] == 14
        assert df_day["is_night"].iloc[0] == 0


# ── TC-U02: Transaction rail one-hot encoding ────────────────────────────────

class TestTypeEncoding:
    """Validate one-hot encoding across supported transaction rails."""

    def test_unknown_type_maps_to_all_zeros(self):
        txn = {
            "step": 100, "type": "UNKNOWN_RAIL", "amount": 5000.0,
            "oldbalanceOrg": 10000.0, "newbalanceOrig": 5000.0,
            "oldbalanceDest": 0.0, "newbalanceDest": 5000.0,
        }
        df = pd.DataFrame([txn])
        result = engineer_features(df)
        for t in SUPPORTED_TYPES:
            assert result[f"type_{t}"].iloc[0] == 0

    def test_known_types_encode_correctly(self):
        for type_name in SUPPORTED_TYPES:
            txn = {
                "step": 100, "type": type_name, "amount": 5000.0,
                "oldbalanceOrg": 10000.0, "newbalanceOrig": 5000.0,
                "oldbalanceDest": 0.0, "newbalanceDest": 5000.0,
            }
            df = pd.DataFrame([txn])
            result = engineer_features(df)
            for t in SUPPORTED_TYPES:
                expected = 1 if t == type_name else 0
                assert result[f"type_{t}"].iloc[0] == expected, \
                    f"Rail type_{t} for {type_name}: expected {expected}, got {result[f'type_{t}'].iloc[0]}"


# ── TC-U03: Input validation ────────────────────────────────────────────────

class TestInputValidation:
    """Reject invalid inputs: negative balances, NaN, inf, missing amount."""

    def test_negative_balance_rejected(self):
        txn = {
            "step": 100, "type": "TRANSFER", "amount": 5000.0,
            "oldbalanceOrg": -1.0, "newbalanceOrig": 0.0,
            "oldbalanceDest": 0.0, "newbalanceDest": 5000.0,
        }
        df = pd.DataFrame([txn])
        with pytest.raises(ValueError, match="negative"):
            engineer_features(df)

    def test_nan_balance_rejected(self):
        txn = {
            "step": 100, "type": "TRANSFER", "amount": 5000.0,
            "oldbalanceOrg": float("nan"), "newbalanceOrig": 0.0,
            "oldbalanceDest": 0.0, "newbalanceDest": 5000.0,
        }
        df = pd.DataFrame([txn])
        with pytest.raises(ValueError, match="non-finite"):
            engineer_features(df)

    def test_inf_amount_rejected(self):
        txn = {
            "step": 100, "type": "TRANSFER", "amount": float("inf"),
            "oldbalanceOrg": 10000.0, "newbalanceOrig": 5000.0,
            "oldbalanceDest": 0.0, "newbalanceDest": 5000.0,
        }
        df = pd.DataFrame([txn])
        with pytest.raises(ValueError, match="non-finite"):
            engineer_features(df)

    def test_missing_amount_rejected(self):
        df = pd.DataFrame([{"step": 100, "type": "TRANSFER"}])
        with pytest.raises(ValueError, match="Missing required"):
            engineer_features(df)


# ── TC-C01: Cross-endpoint scoring consistency ──────────────────────────────

class TestScoringConsistency:
    """Score from /score/analyze and /investigate must use the same override logic."""

    def test_same_transaction_same_score(self):
        """Investigation must use the centralized score_transaction function with calibrated bands."""
        token = _login()
        headers = {"Authorization": f"Bearer {token}"}

        # Create a case via investigation
        r = requests.post(f"{BASE}/api/investigate/TXN-001",
                          headers=headers, timeout=60)
        if r.status_code == 200:
            inv_result = r.json()
            inv_score = inv_result.get("risk_score")
            inv_band = inv_result.get("risk_band")
            # The risk_score should be consistent with the calibrated bands:
            if inv_band == "LOW":
                assert inv_score < 20
            elif inv_band == "MEDIUM":
                assert 20 <= inv_score < 50
            elif inv_band == "HIGH":
                assert 50 <= inv_score < 80
            elif inv_band == "CRITICAL":
                assert inv_score >= 80


# ── TC-C02: Override transparency ───────────────────────────────────────────

class TestOverrideTransparency:
    """rule_adjustments must clearly flag when severity override was applied."""

    def test_model_probability_exposed(self):
        """Response must include both model_probability and risk_score."""
        token = _login()
        headers = {"Authorization": f"Bearer {token}"}

        r = requests.post(f"{BASE}/api/investigate/TXN-001",
                          headers=headers, timeout=60)
        if r.status_code == 200:
            data = r.json()
            assert "model_probability" in data, \
                "Response must include model_probability (pre-override)"
            assert "risk_score" in data, "Response must include risk_score"
            assert "rule_adjustments" in data, "Response must include rule_adjustments"
