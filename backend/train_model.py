"""
Horizon — XGBoost Fraud Detection Model Trainer
================================================
Trains on paysim_base_128k.csv → saves fraud_model.pkl
Also generates SHAP explanation capability for the scoreAgent

Run:  python train_model.py
Output:
  - fraud_model.pkl     (XGBoost model)
  - model_metadata.json (features, thresholds, metrics — used by API)
"""

import json
import os
import pickle
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import xgboost as xgb
import shap
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report, roc_auc_score,
    precision_recall_curve, confusion_matrix, f1_score
)
from sklearn.preprocessing import LabelEncoder

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
DATA_PATH   = "drivematerial/drive_material/Data/paysim_base_128k.csv"
MODEL_OUT   = "fraud_model.pkl"
META_OUT    = "model_metadata.json"
RANDOM_SEED = 42


# ─────────────────────────────────────────────
# 1. LOAD DATA
# ─────────────────────────────────────────────
def load_data():
    print("[LOAD] Loading dataset...")
    df = pd.read_csv(DATA_PATH)
    print(f"   Rows: {len(df):,}  |  Fraud: {df['isFraud'].sum():,}  ({df['isFraud'].mean()*100:.2f}%)")
    return df


# ─────────────────────────────────────────────
# 2. FEATURE ENGINEERING
# ─────────────────────────────────────────────
def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build fraud-signal features from raw PaySim columns.
    Every feature here has a real-world investigative meaning —
    we use this to justify our SHAP explanations to judges.
    """
    print("[FEAT] Engineering features...")
    fe = df.copy()

    # --- Transaction type encoding ---
    type_map = {"CASH_OUT": 0, "PAYMENT": 1, "CASH_IN": 2, "TRANSFER": 3, "DEBIT": 4}
    fe["type_encoded"] = fe["type"].map(type_map).fillna(5).astype(int)

    # --- Balance deltas (how much actually moved) ---
    fe["balance_diff_orig"]  = fe["oldbalanceOrg"]  - fe["newbalanceOrig"]
    fe["balance_diff_dest"]  = fe["newbalanceDest"] - fe["oldbalanceDest"]

    # --- Balance error (legit txns should have zero error) ---
    # If orig balance diff ≠ amount → suspicious (hidden balance manipulation)
    fe["error_balance_orig"] = np.abs(fe["oldbalanceOrg"] - fe["newbalanceOrig"] - fe["amount"])
    fe["error_balance_dest"] = np.abs(fe["oldbalanceDest"] + fe["amount"] - fe["newbalanceDest"])

    # --- Amount ratios ---
    fe["amount_to_orig_ratio"] = fe["amount"] / (fe["oldbalanceOrg"] + 1)
    fe["amount_to_dest_ratio"] = fe["amount"] / (fe["oldbalanceDest"] + 1)

    # --- Account draining signal ---
    # Fraud often drains origin account to exactly 0
    fe["orig_balance_zeroed"]  = (fe["newbalanceOrig"] == 0).astype(int)
    # Fraud often flows into fresh (zero-balance) destination accounts = mule
    fe["dest_was_zero"]        = (fe["oldbalanceDest"] == 0).astype(int)

    # --- Large amount flags ---
    amount_p90 = fe["amount"].quantile(0.90)
    amount_p99 = fe["amount"].quantile(0.99)
    fe["is_large_amount"]    = (fe["amount"] > amount_p90).astype(int)
    fe["is_very_large"]      = (fe["amount"] > amount_p99).astype(int)

    # --- Time-of-day proxy (step is hour in PaySim) ---
    fe["step_mod_24"]  = fe["step"] % 24   # hour of day
    fe["is_night_txn"] = ((fe["step_mod_24"] >= 22) | (fe["step_mod_24"] <= 5)).astype(int)

    # --- Transfer + CashOut are highest-fraud types ---
    fe["is_transfer"]  = (fe["type"] == "TRANSFER").astype(int)
    fe["is_cashout"]   = (fe["type"] == "CASH_OUT").astype(int)

    # --- Dest balance never increases (dest pockets nothing → passthrough mule) ---
    fe["dest_unchanged"] = (fe["balance_diff_dest"] == 0).astype(int)

    print(f"   Features engineered: {fe.shape[1]} columns total")
    return fe


# ─────────────────────────────────────────────
# 3. SELECT FINAL FEATURE SET
# ─────────────────────────────────────────────
FEATURE_COLS = [
    "step",
    "type_encoded",
    "amount",
    "oldbalanceOrg",
    "newbalanceOrig",
    "oldbalanceDest",
    "newbalanceDest",
    "balance_diff_orig",
    "balance_diff_dest",
    "error_balance_orig",
    "error_balance_dest",
    "amount_to_orig_ratio",
    "amount_to_dest_ratio",
    "orig_balance_zeroed",
    "dest_was_zero",
    "is_large_amount",
    "is_very_large",
    "step_mod_24",
    "is_night_txn",
    "is_transfer",
    "is_cashout",
    "dest_unchanged",
]

TARGET_COL = "isFraud"


# ─────────────────────────────────────────────
# 4. TRAIN / TEST SPLIT
# ─────────────────────────────────────────────
def split_data(df: pd.DataFrame):
    X = df[FEATURE_COLS]
    y = df[TARGET_COL]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )
    print(f"   Train: {len(X_train):,}  |  Test: {len(X_test):,}")
    print(f"   Train fraud rate: {y_train.mean()*100:.2f}%")
    return X_train, X_test, y_train, y_test



# ─────────────────────────────────────────────
# 5. TRAIN XGBOOST
# ─────────────────────────────────────────────
def train_model(X_train, y_train):
    """
    XGBoost with scale_pos_weight to handle class imbalance.
    Fraud is rare (< 1%) -- without this, model predicts everything as legit.
    """
    print("\n[TRAIN] Training XGBoost model...")

    fraud_count = y_train.sum()
    legit_count = len(y_train) - fraud_count
    scale_pos_weight = legit_count / fraud_count
    print(f"   Class imbalance ratio (scale_pos_weight): {scale_pos_weight:.1f}")

    model = xgb.XGBClassifier(
        n_estimators       = 300,
        max_depth          = 6,
        learning_rate      = 0.1,
        subsample          = 0.8,
        colsample_bytree   = 0.8,
        scale_pos_weight   = scale_pos_weight,
        eval_metric        = "auc",
        random_state       = RANDOM_SEED,
        n_jobs             = -1,
    )

    model.fit(
        X_train, y_train,
        eval_set           = [(X_train, y_train)],
        verbose            = False,
    )
    print("   Training complete!")
    return model


# ─────────────────────────────────────────────
# 6. EVALUATE
# ─────────────────────────────────────────────
def evaluate(model, X_test, y_test):
    print("\n[EVAL] Evaluation Results:")
    print("-" * 50)

    y_pred_proba = model.predict_proba(X_test)[:, 1]
    y_pred       = (y_pred_proba >= 0.5).astype(int)

    auc = roc_auc_score(y_test, y_pred_proba)
    f1  = f1_score(y_test, y_pred)
    cm  = confusion_matrix(y_test, y_pred)

    print(f"   ROC-AUC Score : {auc:.4f}")
    print(f"   F1 Score      : {f1:.4f}")
    print(f"\n   Confusion Matrix:")
    print(f"   TN={cm[0,0]:,}  FP={cm[0,1]:,}")
    print(f"   FN={cm[1,0]:,}  TP={cm[1,1]:,}")
    print(f"\n   Classification Report:")
    print(classification_report(y_test, y_pred, target_names=["Legitimate","Fraud"]))

    # Find optimal threshold (max F1)
    precisions, recalls, thresholds = precision_recall_curve(y_test, y_pred_proba)
    f1_scores = 2 * precisions * recalls / (precisions + recalls + 1e-9)
    best_idx  = np.argmax(f1_scores)
    best_threshold = float(thresholds[best_idx]) if best_idx < len(thresholds) else 0.5
    print(f"   Optimal threshold (max F1) : {best_threshold:.3f}")

    return {
        "roc_auc":          round(auc, 4),
        "f1_score":         round(f1, 4),
        "best_threshold":   round(best_threshold, 3),
        "confusion_matrix": cm.tolist(),
    }


# ─────────────────────────────────────────────
# 7. SHAP — VERIFY IT WORKS
# ─────────────────────────────────────────────
def verify_shap(model, X_test):
    print("\n[SHAP] Verifying SHAP explainability...")
    sample = X_test.head(5)
    explainer   = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(sample)

    print("   SHAP values computed for 5 sample transactions OK")
    print("   Top feature for first transaction:")
    feature_importance = dict(zip(FEATURE_COLS, np.abs(shap_values[0])))
    top_feature = max(feature_importance, key=feature_importance.get)
    print(f"   → {top_feature}  (|SHAP| = {feature_importance[top_feature]:.4f})")
    return True


# ─────────────────────────────────────────────
# 8. SAVE MODEL + METADATA
# ─────────────────────────────────────────────
def save_artifacts(model, metrics):
    print("\n[SAVE] Saving model artifacts...")

    # Save model
    with open(MODEL_OUT, "wb") as f:
        pickle.dump(model, f)
    print(f"   Saved: {MODEL_OUT} -- model file")

    # Save metadata (used by the FastAPI scoreAgent endpoint)
    metadata = {
        "model_file":       MODEL_OUT,
        "feature_columns":  FEATURE_COLS,
        "target_column":    TARGET_COL,
        "threshold":        metrics["best_threshold"],
        "metrics": {
            "roc_auc":  metrics["roc_auc"],
            "f1_score": metrics["f1_score"],
        },
        "risk_bands": {
            "LOW":      [0.0,  0.35],
            "MEDIUM":   [0.35, 0.60],
            "HIGH":     [0.60, 0.80],
            "CRITICAL": [0.80, 1.0],
        },
        "feature_descriptions": {
            "step":                 "Time step (hour proxy)",
            "type_encoded":         "Transaction type (CASH_OUT=0, PAYMENT=1, CASH_IN=2, TRANSFER=3)",
            "amount":               "Transaction amount",
            "oldbalanceOrg":        "Sender balance before transaction",
            "newbalanceOrig":       "Sender balance after transaction",
            "oldbalanceDest":       "Receiver balance before transaction",
            "newbalanceDest":       "Receiver balance after transaction",
            "balance_diff_orig":    "How much sender's balance decreased",
            "balance_diff_dest":    "How much receiver's balance increased",
            "error_balance_orig":   "Balance discrepancy at sender (0 = no manipulation)",
            "error_balance_dest":   "Balance discrepancy at receiver (0 = no manipulation)",
            "amount_to_orig_ratio": "Amount as fraction of sender's original balance",
            "amount_to_dest_ratio": "Amount as fraction of receiver's balance",
            "orig_balance_zeroed":  "Sender account drained to exactly 0 (fraud signal)",
            "dest_was_zero":        "Receiver had zero balance before (fresh/mule account signal)",
            "is_large_amount":      "Amount above 90th percentile",
            "is_very_large":        "Amount above 99th percentile",
            "step_mod_24":          "Hour of day (0-23)",
            "is_night_txn":         "Transaction between 10PM-5AM (suspicious window)",
            "is_transfer":          "Transaction type is TRANSFER",
            "is_cashout":           "Transaction type is CASH_OUT",
            "dest_unchanged":       "Receiver balance unchanged (passthrough mule signal)",
        }
    }

    with open(META_OUT, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"   Saved: {META_OUT} -- metadata file")


# ─────────────────────────────────────────────
# 9. PREDICT SINGLE TRANSACTION (API helper)
# ─────────────────────────────────────────────
def predict_transaction(model, raw_txn: dict) -> dict:
    """
    Takes a raw transaction dict, returns risk score + SHAP explanation.
    This is what the FastAPI scoreAgent endpoint will call.

    raw_txn example:
    {
        "step": 1, "type": "TRANSFER", "amount": 490000,
        "nameOrig": "C123", "oldbalanceOrg": 500000, "newbalanceOrig": 10000,
        "nameDest": "C456", "oldbalanceDest": 0, "newbalanceDest": 490000
    }
    """
    df_row = pd.DataFrame([raw_txn])

    # Engineer features
    df_fe = engineer_features(df_row)
    X = df_fe[FEATURE_COLS]

    # Predict
    proba = float(model.predict_proba(X)[0, 1])

    # SHAP
    explainer   = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)[0]
    shap_dict   = {feat: round(float(val), 4) for feat, val in zip(FEATURE_COLS, shap_values)}

    # Top 5 contributing features (by absolute SHAP value)
    top_factors = sorted(shap_dict.items(), key=lambda x: abs(x[1]), reverse=True)[:5]

    # Risk band
    if proba < 0.35:
        band = "LOW"
    elif proba < 0.60:
        band = "MEDIUM"
    elif proba < 0.80:
        band = "HIGH"
    else:
        band = "CRITICAL"

    return {
        "risk_score":  round(proba * 100, 1),
        "risk_band":   band,
        "probability": round(proba, 4),
        "shap_values": shap_dict,
        "top_factors": [
            {"feature": k, "shap_value": v, "impact": "increases risk" if v > 0 else "decreases risk"}
            for k, v in top_factors
        ],
    }


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("\nHorizon -- XGBoost Fraud Model Trainer")
    print("=" * 50)

    # Load
    df = load_data()

    # Engineer features
    df = engineer_features(df)

    # Split
    print("\n[SPLIT] Splitting data...")
    X_train, X_test, y_train, y_test = split_data(df)

    # Train
    model = train_model(X_train, y_train)

    # Evaluate
    metrics = evaluate(model, X_test, y_test)

    # Verify SHAP
    verify_shap(model, X_test)

    # Save
    save_artifacts(model, metrics)

    # Quick demo prediction
    print("\n[DEMO] Demo Prediction (suspicious transaction):")
    demo_txn = {
        "step": 2, "type": "TRANSFER", "amount": 490000,
        "nameOrig": "C123", "oldbalanceOrg": 490000, "newbalanceOrig": 0,
        "nameDest": "C456", "oldbalanceDest": 0, "newbalanceDest": 490000,
    }
    result = predict_transaction(model, demo_txn)
    print(f"   Risk Score : {result['risk_score']}/100")
    print(f"   Risk Band  : {result['risk_band']}")
    print(f"   Top Factors:")
    for f in result["top_factors"]:
        direction = ">" if f["shap_value"] > 0 else "<"
        print(f"   {direction} {f['feature']}: {f['shap_value']:+.4f}")

    print("\nDone! Ready for FastAPI integration.")
    print(f"   -> {MODEL_OUT}")
    print(f"   -> {META_OUT}")
