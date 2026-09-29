import sqlite3
import pickle
import json
from state import app_state
from routers.score import score_transaction

with open("fraud_model.pkl", "rb") as f:
    app_state.model = pickle.load(f)
with open("model_metadata.json", "r") as f:
    app_state.metadata = json.load(f)

conn = sqlite3.connect("horizon.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()

c.execute("SELECT * FROM transactions WHERE is_fraud=1 GROUP BY scenario_type")
rows = c.fetchall()

print(f"{'Scenario Type':<30} | {'Amount':<12} | {'Risk Score':<10} | {'Band':<8} | {'Top Factor'}")
print("-" * 80)
for r in rows:
    txn = {
        "transaction_id": r["transaction_id"],
        "step": r["step"],
        "type": r["type"],
        "amount": r["amount"],
        "nameOrig": r["sender_account"] or r["sender_id"],
        "nameDest": r["receiver_account"] or r["receiver_id"],
        "oldbalanceOrg": r["old_balance_orig"],
        "newbalanceOrig": r["new_balance_orig"],
        "oldbalanceDest": r["old_balance_dest"],
        "newbalanceDest": r["new_balance_dest"],
        "severity": r["severity"],
    }
    res = score_transaction(txn)
    top_f = res["top_factors"][0]["feature"] if res["top_factors"] else "N/A"
    print(f"{r['scenario_type']:<30} | {r['amount']:<12,.0f} | {res['risk_score']:<10.1f} | {res['risk_band']:<8} | {top_f}")

conn.close()
