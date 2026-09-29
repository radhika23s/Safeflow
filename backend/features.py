"""Canonical fraud-model features shared by training and inference.

14-feature specification trained strictly on PaySim (paysim_base_128k.csv):
['step', 'amount', 'isFlaggedFraud', 'hour', 'is_night', 'orig_txn_count', 'dest_txn_count',
 'orig_counterparty_degree', 'dest_counterparty_degree', 'type_CASH_IN', 'type_CASH_OUT',
 'type_DEBIT', 'type_PAYMENT', 'type_TRANSFER']
"""

import math
import sqlite3
import numpy as np
import pandas as pd
from typing import Optional

FEATURE_COLS = [
    "step",
    "amount",
    "isFlaggedFraud",
    "hour",
    "is_night",
    "orig_txn_count",
    "dest_txn_count",
    "orig_counterparty_degree",
    "dest_counterparty_degree",
    "type_CASH_IN",
    "type_CASH_OUT",
    "type_DEBIT",
    "type_PAYMENT",
    "type_TRANSFER",
]

SUPPORTED_TYPES = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"]

# Kept for backward compatibility with existing imports
TYPE_MAP = {
    "CASH_OUT": 0,
    "PAYMENT": 1,
    "CASH_IN": 2,
    "TRANSFER": 3,
    "DEBIT": 4,
}


def training_thresholds(df: pd.DataFrame) -> dict[str, float]:
    """Compute percentile thresholds for metadata (backward compatibility)."""
    return {
        "large_amount": float(df["amount"].quantile(0.90)),
        "very_large_amount": float(df["amount"].quantile(0.99)),
    }


def compute_account_graph_metrics(
    sender_account: Optional[str] = None,
    receiver_account: Optional[str] = None,
    conn: Optional[sqlite3.Connection] = None,
) -> dict[str, int]:
    """
    Computes (orig_txn_count, dest_txn_count, orig_counterparty_degree, dest_counterparty_degree).
    Shared identically between scoreAgent and contextAgent to prevent divergent logic.
    """
    orig_txn_count = 1
    orig_counterparty_degree = 1
    dest_txn_count = 1
    dest_counterparty_degree = 1

    if conn is not None:
        try:
            if sender_account and sender_account != "UNKNOWN":
                row = conn.execute(
                    """SELECT COUNT(*), COUNT(DISTINCT receiver_account)
                       FROM transactions
                       WHERE sender_account = ? OR sender_id = ?""",
                    (sender_account, sender_account),
                ).fetchone()
                if row and row[0] is not None and row[0] > 0:
                    orig_txn_count = int(row[0]) + 1
                    orig_counterparty_degree = max(1, int(row[1]))

            if receiver_account and receiver_account != "UNKNOWN":
                row = conn.execute(
                    """SELECT COUNT(*), COUNT(DISTINCT sender_account)
                       FROM transactions
                       WHERE receiver_account = ? OR receiver_id = ?""",
                    (receiver_account, receiver_account),
                ).fetchone()
                if row and row[0] is not None and row[0] > 0:
                    dest_txn_count = int(row[0]) + 1
                    dest_counterparty_degree = max(1, int(row[1]))
        except Exception:
            pass  # Fallback to safe defaults (1)

    return {
        "orig_txn_count": max(1, orig_txn_count),
        "dest_txn_count": max(1, dest_txn_count),
        "orig_counterparty_degree": max(1, orig_counterparty_degree),
        "dest_counterparty_degree": max(1, dest_counterparty_degree),
    }


def engineer_features(
    df: pd.DataFrame,
    thresholds: Optional[dict[str, float]] = None,
    conn: Optional[sqlite3.Connection] = None,
) -> pd.DataFrame:
    """Engineer model features from raw transaction data.

    Emits exactly the 14 features in exact order matching horizon_features.pkl:
    ['step', 'amount', 'isFlaggedFraud', 'hour', 'is_night', 'orig_txn_count',
     'dest_txn_count', 'orig_counterparty_degree', 'dest_counterparty_degree',
     'type_CASH_IN', 'type_CASH_OUT', 'type_DEBIT', 'type_PAYMENT', 'type_TRANSFER']
    """
    fe = df.copy()

    # Step: timestamp hour index
    if "step" not in fe:
        fe["step"] = 1
    fe["step"] = fe["step"].astype(int)

    # Validate amount: must be present, finite, and non-negative
    if "amount" not in fe:
        raise ValueError("Missing required feature field: amount")
    fe["amount"] = fe["amount"].astype(float)
    if not np.isfinite(fe["amount"]).all():
        raise ValueError("Column 'amount' contains non-finite values (NaN/inf)")
    if (fe["amount"] < 0).any():
        raise ValueError("Column 'amount' contains negative values")

    # Validate balance fields if present (reject negative or non-finite)
    for b_col in ["oldbalanceOrg", "newbalanceOrig", "oldbalanceDest", "newbalanceDest"]:
        if b_col in fe:
            vals = fe[b_col].astype(float)
            if not np.isfinite(vals).all():
                raise ValueError(f"Column '{b_col}' contains non-finite values (NaN/inf)")
            if (vals < 0).any():
                raise ValueError(f"Column '{b_col}' contains negative values")

    # isFlaggedFraud: binary flag (default 0)
    if "isFlaggedFraud" not in fe:
        fe["isFlaggedFraud"] = 0
    fe["isFlaggedFraud"] = fe["isFlaggedFraud"].fillna(0).astype(int)

    # Time features: hour of day (0-23) and night-time flag (10 PM to 5 AM)
    fe["hour"] = fe["step"] % 24
    fe["is_night"] = ((fe["hour"] >= 22) | (fe["hour"] <= 5)).astype(int)

    # Shared graph & velocity features
    graph_cols = ["orig_txn_count", "dest_txn_count", "orig_counterparty_degree", "dest_counterparty_degree"]
    missing_graph_cols = [c for c in graph_cols if c not in fe]

    if missing_graph_cols:
        # If running on a multi-row dataset (e.g., PaySim batch) with nameOrig/nameDest:
        if len(fe) > 1 and "nameOrig" in fe and "nameDest" in fe:
            fe["orig_txn_count"] = fe.groupby("nameOrig")["step"].transform("count")
            fe["dest_txn_count"] = fe.groupby("nameDest")["step"].transform("count")
            fe["orig_counterparty_degree"] = fe.groupby("nameOrig")["nameDest"].transform("nunique")
            fe["dest_counterparty_degree"] = fe.groupby("nameDest")["nameOrig"].transform("nunique")
        else:
            # Single transaction scoring: look up from DB or use account parameters
            sender = fe["nameOrig"].iloc[0] if "nameOrig" in fe else (fe["sender_account"].iloc[0] if "sender_account" in fe else None)
            receiver = fe["nameDest"].iloc[0] if "nameDest" in fe else (fe["receiver_account"].iloc[0] if "receiver_account" in fe else None)

            metrics = compute_account_graph_metrics(sender, receiver, conn=conn)
            for c in graph_cols:
                if c not in fe:
                    fe[c] = metrics[c]

    for c in graph_cols:
        fe[c] = fe[c].fillna(1).astype(int)

    # One-hot encoded transaction rails
    type_series = fe["type"] if "type" in fe else pd.Series(["TRANSFER"] * len(fe))
    for t in SUPPORTED_TYPES:
        fe[f"type_{t}"] = (type_series == t).astype(int)

    return fe[FEATURE_COLS]
