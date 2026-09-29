"""
Complete Pipeline Flow Demo
Walks one transaction through all 5 stages showing exact input/output at each level.
"""
import pickle, json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import numpy as np
import pandas as pd
import networkx as nx

with open('fraud_model.pkl', 'rb') as f:
    model = pickle.load(f)
with open('model_metadata.json', 'r') as f:
    metadata = json.load(f)
thresholds = metadata.get('feature_thresholds', {})
from features import engineer_features, FEATURE_COLS, TYPE_MAP
from routers.graph import _detect_patterns

# ========================================================
# EXAMPLE TRANSACTION: Suspected mule account
# ========================================================
txn_raw = {
    'transaction_id': 'TXN-FRAUD-001',
    'step': 1,
    'type': 'TRANSFER',
    'amount': 4987500.0,
    'nameOrig': 'ACC-MULE-5050',
    'oldbalanceOrg': 5000000.0,
    'newbalanceOrig': 12500.0,
    'nameDest': 'ACC-NEW-3321',
    'oldbalanceDest': 0.0,
    'newbalanceDest': 4987500.0,
    'is_new_payee': True,
    'is_vpn': True,
    'severity': 'CRITICAL',
    'scenario_type': 'RAPID_DISPERSAL',
    'fraud_reason': '99.7pct balance depletion to brand-new payee via VPN'
}

print("=" * 70)
print("EXAMPLE: SUSPECTED MULE - RAPID DISPERSAL")
print("=" * 70)
print(json.dumps(txn_raw, indent=2))

# ========================================================
# STAGE 1: FRAUD SIGNAL ENGINE
# ========================================================
print()
print("=" * 70)
print(">>> STAGE 1: FRAUD SIGNAL ENGINE (features.py)")
print("=" * 70)
print()
print("WHAT IT IS: Pure Python feature engineering. No ML model.")
print("PURPOSE:   Transform UPI fields into 14 model-ready features.")
print()
print("INPUT (raw transaction from UPI/rail system):")
print("  transaction_id = TXN-FRAUD-001")
print("  step           = 1 (hour 1)")
print("  type           = TRANSFER")
print("  amount         = INR 49,87,500")
print("  oldbalanceOrg  = INR 50,00,000 (sender before)")
print("  newbalanceOrig = INR 12,500    (sender after)")
print("  oldbalanceDest = INR 0         (receiver before)")
print("  newbalanceDest = INR 49,87,500 (receiver after)")
print()

df_raw = pd.DataFrame([txn_raw])
df_features = engineer_features(df_raw, thresholds)

print("OUTPUT (14 engineered features computed):")
print("-" * 50)
for col in FEATURE_COLS:
    val = df_features[col].iloc[0]
    # Add human-readable interpretation
    note = ""
    if col == "type_TRANSFER":
        note = "    (TRANSFER rail active)"
    elif col == "is_night":
        note = "    (Night-time transaction flag)"
    elif col == "orig_counterparty_degree":
        note = "    (Unique receiver accounts connected to sender)"
    elif col == "dest_counterparty_degree":
        note = "    (Unique sender accounts connected to receiver)"
    print(f"  {col:30s} = {val}{note}")
print()

# ========================================================
# STAGE 2: SCORE AGENT
# ========================================================
print("=" * 70)
print(">>> STAGE 2: SCORE AGENT (XGBoost + SHAP)")
print("=" * 70)
print()
print("WHAT IT IS: ML model scoring + explainability.")
print("TOOL:       XGBoost classifier (300 trees, depth 6)")
print("            SHAP TreeExplainer for explainability")
print("PURPOSE:    Predict fraud probability + explain WHY.")
print()

X = df_features[FEATURE_COLS]
model_probability = float(model.predict_proba(X)[0, 1])

print("Step 2a - XGBoost Model Prediction:")
print("  INPUT:  14-feature vector from Stage 1")
print("  MODEL:  fraud_model.pkl (ROC-AUC=0.9694, F1=0.7782 across 128,001 PaySim records)")
print(f"  OUTPUT: P(fraud) = {model_probability:.6f}")
print(f"          Meaning: {model_probability*100:.2f}% confidence this is fraud")
print()

# Severity override
SEVERITY_OVERRIDES = {'CRITICAL': 0.85, 'HIGH': 0.68}
proba = model_probability
override_label = None
severity = txn_raw.get('severity', '')
if severity in SEVERITY_OVERRIDES:
    if proba < SEVERITY_OVERRIDES[severity]:
        proba = SEVERITY_OVERRIDES[severity]
        override_label = f"{severity} severity floor applied (floor=0.85)"

print("Step 2b - Severity Override:")
print(f"  INPUT:  severity={severity}, model_prob={model_probability:.6f}")
print("  RULE:   If severity=CRITICAL and prob < 0.85, set prob = 0.85")
if override_label:
    print(f"  OUTPUT: {override_label}")
    print(f"          Final probability raised: {model_probability:.4f} -> {proba:.4f}")
else:
    print(f"  OUTPUT: No override needed (prob already above floor)")
print()

# Band
if proba < 0.20: band = 'LOW'
elif proba < 0.50: band = 'MEDIUM'
elif proba < 0.80: band = 'HIGH'
else: band = 'CRITICAL'
action_map = {'LOW': 'ALLOW', 'MEDIUM': 'MONITOR', 'HIGH': 'FLAG', 'CRITICAL': 'BLOCK'}

print("Step 2c - Risk Band + Action:")
print(f"  INPUT:  probability = {proba:.4f}")
print(f"  RULE:   <0.20=LOW, 0.20-0.50=MEDIUM, 0.50-0.80=HIGH, >=0.80=CRITICAL")
print(f"  OUTPUT: band = {band}  -->  action = {action_map[band]}")
print()

# SHAP
import shap
explainer = shap.TreeExplainer(model)
shap_vals = explainer.shap_values(X)[0]
shap_dict = {f: round(float(v), 4) for f, v in zip(FEATURE_COLS, shap_vals)}
top5 = sorted(shap_dict.items(), key=lambda x: abs(x[1]), reverse=True)[:5]

print("Step 2d - SHAP Explainability (top 5 feature drivers):")
print("  INPUT:  14-feature vector + trained model")
print("  TOOL:   SHAP TreeExplainer (game-theoretic feature attribution)")
print("  OUTPUT: Per-feature contribution to this specific prediction")
for feat, val in top5:
    desc = metadata.get('feature_descriptions', {}).get(feat, feat)
    direction = "INCREASES risk" if val > 0 else "decreases risk"
    print(f"    {feat}")
    print(f"      SHAP = {val:+.4f} --> {direction}")
    print(f"      What: {desc}")
print()

print("STEP 2 COMPLETE OUTPUT:")
score_output = {
    'risk_score': round(proba * 100, 1),
    'model_probability': round(model_probability, 4),
    'risk_band': band,
    'recommended_action': action_map[band],
    'top_factors': [{'feature': k, 'shap_value': v} for k, v in top5],
    'rule_adjustments': [override_label] if override_label else []
}
print(json.dumps(score_output, indent=2))

# ========================================================
# STAGE 3: CONTEXT AGENT (Graph Analysis)
# ========================================================
print()
print("=" * 70)
print(">>> STAGE 3: CONTEXT AGENT (NetworkX Graph)")
print("=" * 70)
print()
print("WHAT IT IS: Builds money-flow graph + detects fraud patterns.")
print("TOOL:       NetworkX directed graph + custom pattern detection")
print("PURPOSE:    Understand relationships between accounts,")
print("            detect mule networks, circular flows, velocity.")
print()
print("INPUT: All related transactions from DB")
print("  SQL: WHERE sender_account='ACC-MULE-5050'")
print("       OR receiver_account='ACC-MULE-5050'")
print("  (Finds ALL transactions involving this account, not just this one)")
print()

# Simulate finding 5 related transactions in the DB
related_txns = [
    {'from': 'ACC-MULE-5050', 'to': 'ACC-NEW-3321', 'amount': 4987500},
    {'from': 'ACC-MULE-5050', 'to': 'ACC-SHELL-A1', 'amount': 1200000},
    {'from': 'ACC-MULE-5050', 'to': 'ACC-SHELL-B2', 'amount': 890000},
    {'from': 'ACC-MULE-5050', 'to': 'ACC-SHELL-C3', 'amount': 750000},
    {'from': 'ACC-SHELL-C3', 'to': 'ACC-MULE-5050', 'amount': 200000},
]

print("Building directed graph from 5 transactions...")
G = nx.DiGraph()
for t in related_txns:
    G.add_edge(t['from'], t['to'], amount=t['amount'])

print(f"  Nodes (accounts): {list(G.nodes())}")
print(f"  Edges (transfers): {G.number_of_edges()}")
print()

print("Pattern Detection Results:")
patterns, network_risk, network_summary = _detect_patterns(G, 'ACC-MULE-5050', 'ACC-NEW-3321')
print(f"Network Risk Level: {network_risk} ({network_summary})")
for p in patterns:
    print(f"  [{p['type']}]")
    print(f"    {p.get('description', '')}")
    if 'degree' in p:
        print(f"    Degree: {p['degree']}")
    if 'nodes' in p:
        print(f"    Cycle: {' -> '.join(p['nodes'])}")
