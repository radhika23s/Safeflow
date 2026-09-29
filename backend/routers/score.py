"""
Score Router — /api/score
=========================
Single entry point for fraud risk scoring with centralized severity overrides.

This is Agent 1 in the 4-agent pipeline. All scoring flows (direct score
and investigation) MUST go through the functions here to ensure consistency.
"""

import math
import shap
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional


from auth import current_user, CurrentUser
from features import FEATURE_COLS, TYPE_MAP, engineer_features
from state import app_state
from counterfactual import generate_counterfactual

router = APIRouter(dependencies=[Depends(current_user)])


# ── Centralized severity override configuration ─────────────────────────────
# Both /score/analyze and /investigate must use this single source of truth.
SEVERITY_OVERRIDES = {
    "CRITICAL": {"floor": 0.85, "label": "CRITICAL alert floor applied (85%)"},
    "HIGH":     {"floor": 0.68, "label": "HIGH alert floor applied (68%)"},
}


# ── Request / Response schemas ──────────────────────────────────────────────

class TransactionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    transaction_id:   str = Field(min_length=1, max_length=128)
    step:             int = Field(default=1, ge=0)
    type:             str = "TRANSFER"
    amount:           float = Field(ge=0, allow_inf_nan=False)
    nameOrig:         str = "UNKNOWN"
    oldbalanceOrg:    float = Field(default=0.0, ge=0, allow_inf_nan=False)
    newbalanceOrig:   float = Field(default=0.0, ge=0, allow_inf_nan=False)
    nameDest:         str = "UNKNOWN"
    oldbalanceDest:   float = Field(default=0.0, ge=0, allow_inf_nan=False)
    newbalanceDest:   float = Field(default=0.0, ge=0, allow_inf_nan=False)
    is_new_payee:     Optional[bool] = False
    is_vpn:           Optional[bool] = False
    location_city:    Optional[str]  = "Unknown"
    device_id:        Optional[str]  = None
    ip_address:       Optional[str]  = None
    scenario_type:    Optional[str]  = None
    fraud_reason:     Optional[str]  = None


class ScoreResponse(BaseModel):
    transaction_id: str
    risk_score: float
    risk_band: str
    model_probability: float
    probability: float
    recommended_action: str
    top_factors: list
    shap_values: dict
    rule_adjustments: list
    model_version: str
    counterfactual: Optional[dict] = None


# ── Internal helpers ────────────────────────────────────────────────────────

def _engineer(txn: dict) -> pd.DataFrame:
    """Engineer the canonical 14 features for the fraud model."""
    metadata = app_state.metadata or {}
    thresholds = metadata.get("feature_thresholds")
    return engineer_features(pd.DataFrame([txn]), thresholds=thresholds)


def _validate_transaction_input(txn: dict) -> dict:
    """Validate and sanitize transaction inputs before scoring."""
    amount = txn.get("amount", 0)
    if not math.isfinite(amount) or amount < 0:
        raise HTTPException(422, "Transaction amount must be a finite, non-negative number.")

    # Validate numeric balances if provided
    for field in ["oldbalanceOrg", "newbalanceOrig", "oldbalanceDest", "newbalanceDest"]:
        if field in txn and txn[field] is not None:
            val = txn.get(field, 0)
            if not math.isfinite(val) or val < 0:
                raise HTTPException(422, f"Field '{field}' must be a finite, non-negative number.")

    return txn


def _apply_severity_override(proba: float, severity: str | None) -> tuple[float, str | None]:
    """Apply centralized severity floor. Returns (new_proba, adjustment_label_or_None)."""
    if severity and severity in SEVERITY_OVERRIDES:
        cfg = SEVERITY_OVERRIDES[severity]
        if proba < cfg["floor"]:
            return cfg["floor"], cfg["label"]
    return proba, None


def _band_from_proba(proba: float) -> str:
    """Map probability to risk band based on empirical PaySim validation distribution."""
    if proba < 0.20:
        return "LOW"
    elif proba < 0.50:
        return "MEDIUM"
    elif proba < 0.80:
        return "HIGH"
    else:
        return "CRITICAL"


def _action_from_band(band: str) -> str:
    return {"LOW": "ALLOW", "MEDIUM": "MONITOR", "HIGH": "FLAG", "CRITICAL": "BLOCK"}.get(band, "MONITOR")


def score_transaction(transaction: dict) -> dict:
    """
    scoreAgent: Run fraud risk scoring on a single transaction.
    Returns risk score 0-100 with SHAP feature attribution.

    This is the SINGLE scoring function used by both /score/analyze and /investigate.
    All severity overrides happen here — never duplicated elsewhere.
    """
    if app_state.model is None:
        raise HTTPException(503, "Fraud model not loaded. Run train_enhanced_model.py first.")

    model = app_state.model
    metadata = app_state.metadata or {}

    txn = _validate_transaction_input(transaction)

    try:
        X = _engineer(txn)
    except (TypeError, ValueError) as e:
        raise HTTPException(422, f"Feature engineering failed: {str(e)}") from e

    # 1. Get raw model probability (before any override)
    model_probability = float(model.predict_proba(X)[0, 1])
    proba = model_probability

    # 2. Apply centralized severity override
    rule_adjustments: list[str] = []
    proba, override_label = _apply_severity_override(proba, txn.get("severity"))
    if override_label:
        rule_adjustments.append(override_label)

    # 3. Compute band and action from (possibly overridden) probability
    band = _band_from_proba(proba)
    action = _action_from_band(band)

    # 4. SHAP explanation is always from the raw model (pre-override)
    #    This ensures the explanation reflects what the model actually learned,
    #    while the override is clearly flagged in rule_adjustments.
    explainer = shap.TreeExplainer(model)
    shap_vals = explainer.shap_values(X)[0]
    shap_dict = {f: round(float(v), 4) for f, v in zip(FEATURE_COLS, shap_vals)}

    feat_desc = metadata.get("feature_descriptions", {})
    top_factors = sorted(shap_dict.items(), key=lambda x: abs(x[1]), reverse=True)[:5]
    factors_out = [
        {
            "feature": k,
            "shap_value": v,
            "impact": "increases_risk" if v > 0 else "decreases_risk",
            "description": feat_desc.get(k, k),
        }
        for k, v in top_factors
    ]

    # 5. Counterfactual explanation (what-if analysis from SHAP drivers)
    counterfactual = generate_counterfactual(
        transaction=txn,
        shap_dict=shap_dict,
        risk_band=band,
        current_score=round(proba * 100, 1),
        model=model,
        metadata=metadata,
    )

    return {
        "risk_score": round(proba * 100, 1),
        "model_probability": round(model_probability, 4),
        "risk_band": band,
        "probability": round(proba, 4),
        "recommended_action": action,
        "top_factors": factors_out,
        "shap_values": shap_dict,
        "rule_adjustments": rule_adjustments,
        "counterfactual": counterfactual,
    }


# ── Endpoint ────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=ScoreResponse)
async def analyze_transaction(txn: TransactionInput, _: CurrentUser = Depends(current_user)):
    result = score_transaction(txn.model_dump())
    return ScoreResponse(
        transaction_id=txn.transaction_id,
        model_version="paysim-14feat-v1.0",
        **result,
    )
