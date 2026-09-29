import httpx
import json
import sqlite3

# Get a fraud transaction ID from the DB
conn = sqlite3.connect("horizon.db")
row = conn.execute(
    "SELECT transaction_id, amount, scenario_type, severity FROM transactions WHERE is_fraud=1 LIMIT 1"
).fetchone()
conn.close()

txn_id, amount, scenario, severity = row
print(f"Testing with: {txn_id}")
print(f"Scenario: {scenario}, Severity: {severity}, Amount: {amount:,.0f}")

# Run the full investigation pipeline
r = httpx.post(f"http://localhost:8000/api/investigate/{txn_id}", timeout=60)
print("Status:", r.status_code)

if r.status_code == 200:
    data = r.json()
    rs   = data.get("risk_score", {})

    print()
    print("=== INVESTIGATION RESULT ===")
    print(f"Case ID      : {data.get('case_id')}")
    print(f"Risk Score   : {rs.get('risk_score')}/100")
    print(f"Risk Band    : {rs.get('risk_band')}")
    print(f"Action       : {rs.get('recommended_action')}")
    print()
    print("Top Risk Factors:")
    for f in rs.get("top_factors", [])[:3]:
        print(f"  {f['feature']}: SHAP={f['shap_value']:+.3f}")
        print(f"    -> {f['description'][:70]}")
    print()
    print("LLM Analysis (first 800 chars):")
    print("-" * 50)
    print(data.get("llm_analysis", "")[:800])
else:
    print("ERROR:", r.text[:500])
