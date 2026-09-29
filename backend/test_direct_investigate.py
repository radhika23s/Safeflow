import asyncio
import json
import sqlite3
from routers.investigate import run_investigation

async def test():
    conn = sqlite3.connect("horizon.db")
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    row = c.execute("SELECT transaction_id, scenario_type, severity, amount FROM transactions WHERE is_fraud=1 LIMIT 1").fetchone()
    txn_id = row["transaction_id"]
    print(f"Direct Test with Txn: {txn_id} | Scenario: {row['scenario_type']} | Amount: INR {row['amount']:,.0f}")
    
    result = await run_investigation(transaction_id=txn_id, auto_create_case=True, conn=conn)
    
    print("\n" + "="*50)
    print(f"Case ID       : {result.get('case_id')}")
    print(f"Risk Score    : {result['risk_score']['risk_score']}/100 ({result['risk_score']['risk_band']})")
    print(f"Action        : {result['recommended_action']}")
    print(f"Confidence    : {result['confidence']}")
    print("\nTop Factors:")
    for f in result['risk_score']['top_factors'][:3]:
        print(f"  - {f['feature']} (SHAP={f['shap_value']:+.3f}): {f['description']}")
    
    print("\nLLM Investigation Report:")
    print("-" * 50)
    print(result.get("llm_analysis", "")[:1200])
    print("=" * 50)
    conn.close()

if __name__ == "__main__":
    asyncio.run(test())
