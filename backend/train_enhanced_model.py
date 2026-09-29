"""
Horizon -- Enhanced XGBoost Fraud Model Trainer
================================================
Combines:
  1. paysim_base_128k.csv (128k base transactions)
  2. synthetic_S01 to S10 (40k fraud scenario records)
  3. synthetic_L01 to L10 (35k legitimate counterexample records)

Produces:
  - fraud_model.pkl (Trained XGBoost model)
  - model_metadata.json (Feature definitions, SHAP configuration, metrics)
"""

import os
import glob
import json
import pickle
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import xgboost as xgb
import shap
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score, f1_score, confusion_matrix
from features import FEATURE_COLS, engineer_features as shared_engineer_features, training_thresholds

DATA_DIR    = "drivematerial/drive_material/Data"
MODEL_OUT   = "fraud_model.pkl"
META_OUT    = "model_metadata.json"
RANDOM_SEED = 42

def load_combined_data():
    print("[LOAD] Loading all datasets...")
    dfs = []
    
    # 1. Base dataset
    base_file = os.path.join(DATA_DIR, "paysim_base_128k.csv")
    if os.path.exists(base_file):
        df_base = pd.read_csv(base_file)
        df_base["isFraud"] = df_base["isFraud"].astype(int)
        df_base["source_type"] = "BASE_PAYSIM"
        dfs.append(df_base)
        print(f"   Base PaySim: {len(df_base):,} rows (Fraud: {df_base['isFraud'].sum():,})")

    # 2. Synthetic Fraud Scenarios S01 - S10
    s_files = glob.glob(os.path.join(DATA_DIR, "synthetic_S*.csv"))
    s_count = 0
    s_fraud = 0
    for sf in s_files:
        df_s = pd.read_csv(sf)
        df_s["isFraud"] = 1
        df_s["source_type"] = os.path.basename(sf)
        dfs.append(df_s)
        s_count += len(df_s)
        s_fraud += len(df_s)
    print(f"   Synthetic Fraud (S01-S10): {s_count:,} rows across {len(s_files)} files")

    # 3. Synthetic Legitimate Counterexamples L01 - L10
    l_files = glob.glob(os.path.join(DATA_DIR, "synthetic_L*.csv"))
    l_count = 0
    for lf in l_files:
        df_l = pd.read_csv(lf)
        df_l["isFraud"] = 0
        df_l["source_type"] = os.path.basename(lf)
        dfs.append(df_l)
        l_count += len(df_l)
    print(f"   Synthetic Legit (L01-L10): {l_count:,} rows across {len(l_files)} files")

    combined = pd.concat(dfs, ignore_index=True)
    print(f"\n[TOTAL] Combined dataset: {len(combined):,} rows | Fraud: {combined['isFraud'].sum():,} ({combined['isFraud'].mean()*100:.2f}%)")
    return combined

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    print("[FEAT] Engineering domain features...")
    return shared_engineer_features(df, training_thresholds(df))

def main():
    df = load_combined_data()
    df_fe = engineer_features(df)

    X = df_fe[FEATURE_COLS]
    y = df_fe["isFraud"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )
    print(f"\n[SPLIT] Train: {len(X_train):,} | Test: {len(X_test):,}")

    fraud_count = y_train.sum()
    legit_count = len(y_train) - fraud_count
    scale_pos_weight = max(1.0, legit_count / (fraud_count + 1e-5))
    print(f"[SCALE] scale_pos_weight: {scale_pos_weight:.2f}")

    print("\n[TRAIN] Training XGBoost model...")
    model = xgb.XGBClassifier(
        n_estimators     = 300,
        max_depth        = 6,
        learning_rate    = 0.1,
        subsample        = 0.8,
        colsample_bytree = 0.8,
        scale_pos_weight = scale_pos_weight,
        eval_metric      = "auc",
        random_state     = RANDOM_SEED,
        n_jobs           = -1,
    )

    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    print("[TRAIN] Completed training.")

    y_pred_proba = model.predict_proba(X_test)[:, 1]
    y_pred = (y_pred_proba >= 0.5).astype(int)

    auc = roc_auc_score(y_test, y_pred_proba)
    f1  = f1_score(y_test, y_pred)
    cm  = confusion_matrix(y_test, y_pred)

    print("\n[EVAL] Results on Test Set:")
    print("-" * 50)
    print(f"   ROC-AUC Score : {auc:.4f}")
    print(f"   F1 Score      : {f1:.4f}")
    print(f"   Confusion Matrix: TN={cm[0,0]:,}, FP={cm[0,1]:,}, FN={cm[1,0]:,}, TP={cm[1,1]:,}")
    print(classification_report(y_test, y_pred, target_names=["Legit", "Fraud"]))

    # Save model artifacts
    with open(MODEL_OUT, "wb") as f:
        pickle.dump(model, f)
    print(f"\n[SAVE] Saved model to {MODEL_OUT}")

    metadata = {
        "model_file": MODEL_OUT,
        "feature_columns": FEATURE_COLS,
        "feature_thresholds": training_thresholds(df),
        "target_column": "isFraud",
        "threshold": 0.5,
        "metrics": {
            "roc_auc": round(auc, 4),
            "f1_score": round(f1, 4),
            "total_training_samples": len(df),
        },
        "risk_bands": {
            "LOW":      [0.0,  0.30],
            "MEDIUM":   [0.30, 0.60],
            "HIGH":     [0.60, 0.80],
            "CRITICAL": [0.80, 1.0],
        },
        "feature_descriptions": {
            "step":                 "Transaction timestamp hour step",
            "type_encoded":         "Encoded transaction channel/type",
            "amount":               "Transaction amount in INR",
            "oldbalanceOrg":        "Origin account balance before transaction",
            "newbalanceOrig":       "Origin account balance after transaction",
            "oldbalanceDest":       "Destination account balance before transaction",
            "newbalanceDest":       "Destination account balance after transaction",
            "balance_diff_orig":    "Net reduction from sender account",
            "balance_diff_dest":    "Net credit to receiver account",
            "error_balance_orig":   "Sender balance reconciliation discrepancy",
            "error_balance_dest":   "Receiver balance reconciliation discrepancy",
            "amount_to_orig_ratio": "Transaction amount relative to sender balance",
            "amount_to_dest_ratio": "Transaction amount relative to destination balance",
            "orig_balance_zeroed":  "Sender balance fully depleted to 0",
            "dest_was_zero":        "Destination account opened or previously zero-balance",
            "is_large_amount":      "Amount exceeds 90th percentile threshold",
            "is_very_large":        "Amount exceeds 99th percentile threshold",
            "step_mod_24":          "Hour of day (0-23)",
            "is_night_txn":         "Night-time transaction window (10PM - 5AM)",
            "is_transfer":          "TRANSFER payment rail",
            "is_cashout":           "CASH_OUT withdrawal rail",
            "dest_unchanged":       "Receiver balance unchanged (passthrough transit)",
            "amount_dest_balance_ratio": "Transfer ratio to final recipient balance"
        }
    }

    with open(META_OUT, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"[SAVE] Saved metadata to {META_OUT}")

if __name__ == "__main__":
    main()
