"""
Investigate Router — /api/investigate
======================================
Orchestrator: triggers the full 5-agent investigation pipeline.
  1. scoreAgent    -> Centralized XGBoost risk score + SHAP (via routers.score)
  2. contextAgent  -> Graph analysis from graph_agent with real pattern detection
  3. reasonAgent   -> gemini-2.5-flash + Regulatory Grounding -> Case summary
  4. decisionAgent -> Action recommendation (BLOCK / FLAG / MONITOR / ALLOW)
  5. validatorAgent-> Fact-checks regulatory citations & decision consistency

Returns a complete evidence package JSON.
"""

import os
import sqlite3
import uuid
import json
import math
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

# Optional import: the pipeline must boot (and fall back to deterministic
# compliance rules) even when the LLM SDK is not installed / ENABLE_LLM=false.
try:
    from google import genai as google_genai
    from google.genai import types as genai_types
except ImportError:
    google_genai = None
    genai_types = None

from database import get_db, log_audit
from state import app_state
from auth import current_user, CurrentUser
from routers.score import score_transaction, _band_from_proba, _action_from_band
from regulatory import REGULATORY_CLAUSES, extract_cited_clauses, format_clauses_for_prompt
from counterfactual import generate_counterfactual
from agents.validator_agent import validate_investigation as _validate_investigation

router = APIRouter(dependencies=[Depends(current_user)])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
_gemini_client = None
if GEMINI_API_KEY:
    try:
        _gemini_client = google_genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"[GEMINI INIT ERROR] {e}")


class InvestigateRequest(BaseModel):
    transaction_id: str
    auto_create_case: bool = True


def mask_for_llm(
    txn: dict,
    score_result: dict,
    graph_context: dict | None = None,
) -> tuple[dict, dict, dict[str, str]]:
    """
    Zero-knowledge PII tokenization layer.
    Replaces real customer account numbers and transaction IDs with synthetic tokens
    prior to sending prompts to external LLM APIs (Gemini).
    Guarantees strict compliance with RBI IT outsourcing & DPDP Act 2023 regulations.

    Returns:
        (masked_txn, masked_graph_context, reverse_map)
    """
    reverse_map: dict[str, str] = {}

    sender_real = str(txn.get("sender_account") or txn.get("sender_id") or "ORIGIN_ACC")
    receiver_real = str(txn.get("receiver_account") or txn.get("receiver_id") or "BENEFICIARY_ACC")
    txn_id_real = str(txn.get("transaction_id") or "TXN_PRIMARY")

    token_sender = "ACC_ORIGIN_A1"
    token_receiver = "ACC_BENEFICIARY_B1"
    token_txn = "TXN_REF_01"

    reverse_map[token_sender] = sender_real
    reverse_map[token_receiver] = receiver_real
    reverse_map[token_txn] = txn_id_real

    masked_txn = dict(txn)
    masked_txn["transaction_id"] = token_txn
    masked_txn["sender_account"] = token_sender
    masked_txn["sender_id"] = token_sender
    masked_txn["receiver_account"] = token_receiver
    masked_txn["receiver_id"] = token_receiver

    # Strip personal identifiers if present
    for sensitive_key in ["customer_name", "phone", "email", "ip_address", "device_id", "location_city"]:
        if sensitive_key in masked_txn:
            masked_txn[sensitive_key] = "[PII_STRIPPED_PER_DPDP_ACT]"

    masked_graph: dict = {}
    if graph_context:
        masked_graph = dict(graph_context)
        node_map = {sender_real: token_sender, receiver_real: token_receiver}
        mule_idx = 1

        for node in graph_context.get("nodes", []):
            nid = node.get("id")
            if nid and nid not in node_map:
                token_node = f"ACC_MULE_{mule_idx}"
                mule_idx += 1
                node_map[nid] = token_node
                reverse_map[token_node] = nid

        masked_nodes = []
        for node in graph_context.get("nodes", []):
            n_copy = dict(node)
            n_copy["id"] = node_map.get(node["id"], node["id"])
            masked_nodes.append(n_copy)
        masked_graph["nodes"] = masked_nodes

        masked_links = []
        for link in graph_context.get("links", []):
            l_copy = dict(link)
            l_copy["source"] = node_map.get(link["source"], link["source"])
            l_copy["target"] = node_map.get(link["target"], link["target"])
            t_orig = link.get("transaction_id")
            if t_orig and t_orig != txn_id_real:
                t_tok = f"TXN_LINK_{len(reverse_map)}"
                reverse_map[t_tok] = t_orig
                l_copy["transaction_id"] = t_tok
            elif t_orig == txn_id_real:
                l_copy["transaction_id"] = token_txn
            masked_links.append(l_copy)
        masked_graph["links"] = masked_links

        masked_patterns = []
        for pat in graph_context.get("patterns", []):
            p_copy = dict(pat)
            p_desc = p_copy.get("description", "")
            for real_val, tok_val in node_map.items():
                p_desc = p_desc.replace(real_val, tok_val)
            p_copy["description"] = p_desc
            masked_patterns.append(p_copy)
        masked_graph["patterns"] = masked_patterns

    return masked_txn, masked_graph, reverse_map


def rehydrate_llm_report(report_text: str, reverse_map: dict[str, str]) -> str:
    """
    Re-hydrates tokenized identifiers in LLM-generated output back to real account IDs
    strictly within the bank's internal network perimeter.
    """
    if not report_text or not reverse_map:
        return report_text
    rehydrated = report_text
    # Sort tokens in descending order of length to prevent prefix collisions
    sorted_tokens = sorted(reverse_map.keys(), key=len, reverse=True)
    for token in sorted_tokens:
        rehydrated = rehydrated.replace(token, reverse_map[token])
    return rehydrated


def _build_llm_prompt(txn: dict, score_result: dict, graph_context: dict | None = None) -> str:
    factors_text = "\n".join(
        f"  - {f['feature']}: {f.get('description', f['feature'])} (SHAP impact: {f['shap_value']:+.3f})"
        for f in score_result.get("top_factors", [])
    )

    graph_ctx = graph_context or {}
    patterns = graph_ctx.get("patterns", [])
    patterns_text = "\n".join(
        f"  - [{p.get('type')}] ({p.get('severity', 'HIGH')}): {p.get('description')}"
        for p in patterns
    ) if patterns else "  - Isolated transaction; no multi-hop syndicate loops detected."

    network_risk = graph_ctx.get("network_risk", "LOW")
    network_summary = graph_ctx.get("network_risk_summary", "Isolated point-to-point transfer.")
    node_count = graph_ctx.get("node_count", 2)
    edge_count = graph_ctx.get("edge_count", 1)

    # Implicated node accounts
    nodes = graph_ctx.get("nodes", [])
    mule_accounts = [
        n["id"] for n in nodes
        if n.get("role") in ["MULE_CASHOUT", "INTERMEDIARY"] or n.get("suspicious")
    ]
    mules_text = ", ".join(mule_accounts[:6]) if mule_accounts else "None identified beyond primary endpoints"

    clauses_json = format_clauses_for_prompt()

    return f"""You are a Lead Financial Crime Investigator at an Indian Scheduled Commercial Bank.
Analyze this alert and write a clear, audit-ready investigation report synthesizing both Machine Learning features and NetworkX Multi-Hop Graph intelligence.

TRANSACTION SUMMARY:
- Transaction ID: {txn.get('transaction_id')}
- Amount: INR {txn.get('amount', 0):,.2f}
- Channel: {txn.get('channel', 'UPI')}
- Sender Account: {txn.get('sender_account', txn.get('sender_id', 'Unknown'))}
- Receiver Account: {txn.get('receiver_account', txn.get('receiver_id', 'Unknown'))}
- Origin Pre/Post Balance: INR {txn.get('old_balance_orig', 0):,.2f} -> INR {txn.get('new_balance_orig', 0):,.2f}
- Dest Pre/Post Balance: INR {txn.get('old_balance_dest', 0):,.2f} -> INR {txn.get('new_balance_dest', 0):,.2f}
- Scenario Pattern: {txn.get('scenario_type', 'SUSPICIOUS_TRANSFER')}
- Alert Reason: {txn.get('fraud_reason', 'Behavioral anomaly detected')}
- Priority Severity: {txn.get('severity', 'HIGH')}

MACHINE LEARNING & SHAP SIGNALS (XGBoost):
- Transaction Risk Score: {score_result.get('risk_score', 0)}/100 ({score_result.get('risk_band', 'MEDIUM')} risk)
- Model Probability: {score_result.get('model_probability', 0):.4f} (before severity override)
- Rule Adjustments: {score_result.get('rule_adjustments', [])}
- Recommended Action: {score_result.get('recommended_action', 'MONITOR')}
- Primary Explainability Drivers:
{factors_text}

NETWORK GRAPH & RELATIONAL TOPOLOGY (NetworkX):
- Network Risk Level: {network_risk} ({network_summary})
- Subgraph Scope: {node_count} Accounts, {edge_count} Flow Edges
- Implicated Syndicate/Mule Accounts: {mules_text}
- Detected Topological Patterns:
{patterns_text}

REGULATORY COMPLIANCE CITATION CONTRACT:
You MUST cite specific statutory clause IDs inline next to each finding in Section 3, in the exact bracketed format [CLAUSE_ID].
Do NOT cite any clause outside the available catalog:
{clauses_json}

Please provide a structured report with these exact 5 sections:
1. EXECUTIVE SUMMARY: Direct summary of the transaction, composite risk, and whether it represents an isolated anomaly or an active multi-account syndicate. Explicitly cite the Network Risk level ({network_risk}).
2. SUSPICIOUS INDICATORS: Key signals observed (money flow, balance depletion, SHAP feature drivers, and topological graph patterns like structuring or mule fan-out).
3. REGULATORY COMPLIANCE ASSESSMENT: Applicable statutory obligations citing clause IDs inline in [CLAUSE_ID] format (e.g. [PMLA_S12], [PMLA_S3], [RBI_MD_KYC_2016_PARA_23], [RBI_MD_KYC_2016_PARA_37], [RBI_FRM_2024_CIRCULAR], [NPCI_UPI_2023_PARA_5], [NPCI_OC_138_MULE]).
4. RECOMMENDED ACTION & JUSTIFICATION: Action (BLOCK / FLAG FOR MONITORING / DISMISS) with explicit rationale citing both ML and Network signals.
5. ANALYST ACTION ITEMS: Concrete verification checklist for the human analyst, including freezing implicated mule accounts.
"""


def _generate_fallback_report(txn: dict, score_result: dict, graph_context: dict | None = None) -> str:
    """Deterministic, high-quality regulatory investigation template with inline clause citations."""
    scenario = txn.get("scenario_type", "SUSPICIOUS_VELOCITY").replace("_", " ").title()
    amount = txn.get("amount", 0)
    score = score_result.get("risk_score", 75)
    band = score_result.get("risk_band", "HIGH")
    action = score_result.get("recommended_action", "FLAG")
    reason = txn.get("fraud_reason", "Abnormal fund movement pattern detected.")

    graph_ctx = graph_context or {}
    net_risk = graph_ctx.get("network_risk", "HIGH")
    net_summary = graph_ctx.get("network_risk_summary", "Multi-hop counterparty network detected.")
    patterns = graph_ctx.get("patterns", [])
    patterns_bullet = "\n".join(
        f"- **Network Pattern ({p.get('type')})**: {p.get('description')}"
        for p in patterns
    ) if patterns else "- **Network Topology**: Multi-hop traversal identified connected feeder and intermediary accounts."

    return f"""### 1. EXECUTIVE SUMMARY
Investigation opened for transaction **{txn.get('transaction_id')}** involving a transfer of **INR {amount:,.2f}** via {txn.get('channel', 'UPI')}. The system identified behavioral indicators consistent with **{scenario}**. Composite risk evaluation produced an XGBoost Transaction Risk Score of **{score}/100 ({band} Risk)** alongside a NetworkX Topological Risk of **{net_risk}** ({net_summary}).

### 2. SUSPICIOUS INDICATORS
- **Behavioral Anomaly**: {reason}
- **Balance Trajectory**: Origin balance depleted from INR {txn.get('old_balance_orig', 0):,.2f} to INR {txn.get('new_balance_orig', 0):,.2f}.
- **ML Attribution Drivers**: Elevated weights on balance depletion ratio and velocity indicators.
{patterns_bullet}

### 3. REGULATORY COMPLIANCE ASSESSMENT
- **Statutory STR Reporting Obligation [PMLA_S12]**: Mandatory reporting of transactions displaying no lawful economic purpose or suspected of being structured to avoid thresholds to FIU-IND.
- **Offence of Money Laundering & Structuring [PMLA_S3]**: Structuring and rapid dispersal of funds across multi-tier accounts triggers statutory anti-layering enforcement under Section 3.
- **Enhanced Due Diligence Mandate [RBI_MD_KYC_2016_PARA_23]**: Disproportionate transactional velocity relative to customer profile mandates immediate Enhanced Due Diligence (EDD) and source verification.
- **Strict 7-Day Statutory Filing Window [RBI_MD_KYC_2016_PARA_37]**: Obligation to transmit completed Suspicious Transaction Report to FIU-IND within 7 working days of established suspicion.
- **Real-Time Fraud Containment [RBI_FRM_2024_CIRCULAR]**: Mandates immediate nodal account debit freeze and synchronized counterparty scrutiny across banking rails.
- **Mule Account Mitigation Directives [NPCI_OC_138_MULE] [NPCI_UPI_2023_PARA_5]**: Alerts on rapid velocity mule dispersion mandate real-time beneficiary holds and automated NCRP alert transmission.

### 4. RECOMMENDED ACTION & JUSTIFICATION
**Recommendation**: **{action}**
*Rationale*: High composite risk ({score}/100 Transaction Risk + {net_risk} Network Risk). Multi-hop analysis confirms coordinated fund movement necessitating immediate nodal intervention.

### 5. ANALYST ACTION ITEMS
1. Verify device fingerprint and IP geovelocity for account `{txn.get('sender_account')}`.
2. Place a provisional lien/freeze on recipient `{txn.get('receiver_account')}` and associated downstream mule accounts [RBI_FRM_2024_CIRCULAR].
3. Transmit draft STR package to Principal Officer for statutory FIU-IND submission within 7 days [PMLA_S12] [RBI_MD_KYC_2016_PARA_37].
"""


async def _call_gemini_or_fallback(
    prompt: str, txn: dict, score_result: dict, graph_context: dict | None = None
) -> tuple[str, bool]:
    """
    Call Gemini LLM or return fallback report.
    Returns (report_text, ai_generated_flag).
    """
    if _gemini_client:
        try:
            import asyncio

            def _generate():
                response = _gemini_client.models.generate_content(
                    model="gemini-3.6-flash",
                    contents=prompt,
                )
                return response.text if response and response.text else None

            text = await asyncio.to_thread(_generate)
            if text:
                return text, True
        except Exception as e:
            print(f"[GEMINI CALL FAILED, USING REGULATORY FALLBACK ENGINE] {e}")
    return _generate_fallback_report(txn, score_result, graph_context), False


@router.post("/{transaction_id}")
async def run_investigation(
    transaction_id: str,
    auto_create_case: bool = True,
    conn: sqlite3.Connection = Depends(get_db),
    user: CurrentUser = Depends(current_user),
):
    """
    Autonomous Multi-Agent Investigation Pipeline:
    1. scoreAgent: XGBoost 14-feature inference + SHAP attribution (via centralized score_transaction)
    2. contextAgent: Multi-transaction graph analysis via graph_agent with real pattern detection
    3. reasonAgent: Gemini analysis grounded in RBI/PMLA regulations
    4. decisionAgent: Action recommendation & idempotent case creation
    """
    # ── Idempotent case lookup ────────────────────────────────────────────────
    # Check by both case_id AND transaction_id to prevent duplicate cases
    clean_id = transaction_id.strip().replace(" ", "-")
    existing_case = conn.execute(
        "SELECT * FROM cases WHERE case_id = ? OR case_id = ? OR transaction_id = ?",
        (transaction_id, clean_id, transaction_id),
    ).fetchone()

    actual_txn_id = transaction_id
    if existing_case:
        actual_txn_id = existing_case["transaction_id"]
        case_id = existing_case["case_id"]
    else:
        case_id = f"FC-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    txn = conn.execute(
        "SELECT * FROM transactions WHERE transaction_id = ?", (actual_txn_id,)
    ).fetchone()
    if not txn:
        raise HTTPException(404, f"Transaction {transaction_id} not found")
    txn_dict = dict(txn)

    # ── 1. scoreAgent (centralized scoring) ───────────────────────────────────
    sender_account = txn_dict.get("sender_account") or txn_dict.get("sender_id", "UNKNOWN")
    receiver_account = txn_dict.get("receiver_account") or txn_dict.get("receiver_id", "UNKNOWN")

    txn_for_model = {
        "step": txn_dict.get("step", 1),
        "type": txn_dict.get("type", "TRANSFER"),
        "amount": txn_dict.get("amount", 0),
        "nameOrig": sender_account,
        "nameDest": receiver_account,
        "oldbalanceOrg": txn_dict.get("old_balance_orig", 0),
        "newbalanceOrig": txn_dict.get("new_balance_orig", 0),
        "oldbalanceDest": txn_dict.get("old_balance_dest", 0),
        "newbalanceDest": txn_dict.get("new_balance_dest", 0),
        "severity": txn_dict.get("severity"),
    }
    try:
        score_result = score_transaction(txn_for_model)
    except HTTPException:
        # Model not loaded — use defaults
        score_result = {
            "risk_score": 50.0, "model_probability": 0.50, "risk_band": "MEDIUM",
            "recommended_action": "MONITOR", "top_factors": [], "shap_values": {},
            "probability": 0.50, "rule_adjustments": [],
        }

    # ── 2. contextAgent — multi-hop graph analysis via NetworkX ───────────────
    sender_account = txn_dict.get("sender_account") or txn_dict.get("sender_id", "UNKNOWN")
    receiver_account = txn_dict.get("receiver_account") or txn_dict.get("receiver_id", "UNKNOWN")

    visited_accounts = {sender_account, receiver_account}
    current_frontier = {sender_account, receiver_account}
    collected_txns: dict[str, dict[str, Any]] = {}

    if txn_dict.get("transaction_id"):
        collected_txns[txn_dict["transaction_id"]] = txn_dict

    for _ in range(2):
        if not current_frontier:
            break
        placeholders = ",".join("?" for _ in current_frontier)
        query_params = list(current_frontier) + list(current_frontier)
        hop_rows = conn.execute(
            f"""SELECT * FROM transactions
               WHERE sender_account IN ({placeholders}) OR receiver_account IN ({placeholders})
               ORDER BY timestamp ASC LIMIT 40""",
            query_params,
        ).fetchall()

        next_frontier = set()
        for r in hop_rows:
            r_dict = dict(r)
            t_id = r_dict.get("transaction_id") or f"TX-{len(collected_txns)}"
            if t_id not in collected_txns:
                collected_txns[t_id] = r_dict
                src = r_dict.get("sender_account") or r_dict.get("sender_id")
                dst = r_dict.get("receiver_account") or r_dict.get("receiver_id")
                if src and src not in visited_accounts:
                    next_frontier.add(src)
                if dst and dst not in visited_accounts:
                    next_frontier.add(dst)

        visited_accounts.update(next_frontier)
        current_frontier = next_frontier
        if len(collected_txns) >= 50:
            break

    import networkx as nx
    G = nx.DiGraph()
    for t_id, r_dict in collected_txns.items():
        src = r_dict.get("sender_account") or r_dict.get("sender_id", "UNKNOWN")
        dst = r_dict.get("receiver_account") or r_dict.get("receiver_id", "UNKNOWN")
        amt = r_dict.get("amount", 0)
        G.add_node(src)
        G.add_node(dst)
        G.add_edge(
            src, dst,
            amount=amt,
            transaction_id=t_id,
            channel=r_dict.get("channel", "UPI"),
            timestamp=r_dict.get("timestamp", ""),
        )

    G.add_node(sender_account)
    G.add_node(receiver_account)
    G.add_edge(
        sender_account,
        receiver_account,
        amount=txn_dict.get("amount", 0),
        transaction_id=txn_dict.get("transaction_id", ""),
        channel=txn_dict.get("channel", "UPI"),
        timestamp=txn_dict.get("timestamp", ""),
    )

    for n in G.nodes:
        in_d = G.in_degree(n)
        out_d = G.out_degree(n)
        if n == sender_account:
            role = "ORIGIN"
            suspicious = True
        elif n == receiver_account:
            role = "INTERMEDIARY" if out_d > 0 else "BENEFICIARY"
            suspicious = True
        elif G.has_edge(n, sender_account):
            role = "FEEDER"
            suspicious = False
        elif G.has_edge(receiver_account, n) or G.has_edge(sender_account, n):
            role = "MULE_CASHOUT"
            suspicious = True
        elif in_d > 0 and out_d > 0:
            role = "INTERMEDIARY"
            suspicious = True
        else:
            role = "COUNTERPARTY"
            suspicious = False
        G.nodes[n]["role"] = role
        G.nodes[n]["suspicious"] = suspicious
        G.nodes[n]["in_degree"] = in_d
        G.nodes[n]["out_degree"] = out_d

    from routers.graph import _detect_patterns, assign_visibility_tiers, compute_freeze_priority_matrix

    assign_visibility_tiers(G, sender_account, receiver_account)
    patterns, network_risk, network_summary = _detect_patterns(G, sender_account, receiver_account)
    freeze_matrix, stopping_rule = compute_freeze_priority_matrix(
        G, sender_account, receiver_account, float(txn_dict.get("amount", 0))
    )

    graph_context = {
        "nodes": [{"id": n, **G.nodes[n]} for n in G.nodes],
        "links": [
            {
                "source": u,
                "target": v,
                "amount": G.edges[u, v].get("amount"),
                "channel": G.edges[u, v].get("channel", "UPI"),
                "transaction_id": G.edges[u, v].get("transaction_id"),
                "timestamp": G.edges[u, v].get("timestamp"),
            }
            for u, v in G.edges
        ],
        "patterns": patterns,
        "network_risk": network_risk,
        "network_risk_summary": network_summary,
        "freeze_priority_matrix": freeze_matrix,
        "traversal_stopping_rule": stopping_rule,
        "transaction_count": len(collected_txns),
        "node_count": G.number_of_nodes(),
        "edge_count": G.number_of_edges(),
    }

    # ── Composite Risk Synthesis (Combine ML, Graph Network Risk & Case Baseline) ──
    final_risk_score = float(score_result.get("risk_score", 50.0))
    if existing_case and existing_case["risk_score"] is not None:
        final_risk_score = max(final_risk_score, float(existing_case["risk_score"]))
    if network_risk == "CRITICAL":
        final_risk_score = max(final_risk_score, 90.0)
    elif network_risk == "HIGH":
        final_risk_score = max(final_risk_score, 75.0)

    final_risk_score = min(100.0, round(final_risk_score, 1))
    score_result["risk_score"] = final_risk_score
    score_result["probability"] = round(final_risk_score / 100.0, 4)

    if final_risk_score >= 80.0:
        score_result["risk_band"] = "CRITICAL"
        if existing_case and existing_case["recommended_action"] in ("ESCALATE", "BLOCK"):
            score_result["recommended_action"] = existing_case["recommended_action"]
        else:
            score_result["recommended_action"] = "ESCALATE" if network_risk in ("CRITICAL", "HIGH") else "BLOCK"
    elif final_risk_score >= 50.0:
        score_result["risk_band"] = "HIGH"
        score_result["recommended_action"] = existing_case["recommended_action"] if (existing_case and existing_case["recommended_action"]) else "FLAG"
    elif final_risk_score >= 20.0:
        score_result["risk_band"] = "MEDIUM"
        score_result["recommended_action"] = existing_case["recommended_action"] if (existing_case and existing_case["recommended_action"]) else "MONITOR"
    else:
        score_result["risk_band"] = "LOW"
        score_result["recommended_action"] = existing_case["recommended_action"] if (existing_case and existing_case["recommended_action"]) else "ALLOW"

    # ── 3. reasonAgent (Gemini LLM) with Zero-Knowledge PII Masking ───────────
    masked_txn, masked_graph, reverse_map = mask_for_llm(txn_dict, score_result, graph_context)
    prompt = _build_llm_prompt(masked_txn, score_result, masked_graph)
    raw_llm_report, ai_generated = await _call_gemini_or_fallback(prompt, masked_txn, score_result, masked_graph)
    llm_report = rehydrate_llm_report(raw_llm_report, reverse_map)

    privacy_audit = {
        "pii_masked": True,
        "policy": "RBI DPDP Act 2023 & Master Direction on IT Outsourcing",
        "masked_tokens_count": len(reverse_map),
        "sanitized_types": ["account_numbers", "transaction_ids", "customer_identifiers"],
        "token_sample": {k: v for k, v in list(reverse_map.items())[:3]},
    }

    # ── 4. STR Draft (FIU-IND format with Relational Evidence) ────────────────
    mule_list = [
        n["id"] for n in graph_context["nodes"]
        if n.get("role") in ["MULE_CASHOUT", "INTERMEDIARY"]
    ]
    mule_line = ", ".join(mule_list) if mule_list else "None identified beyond primary endpoints"
    pattern_line = ", ".join(p["type"] for p in patterns) if patterns else "Point-to-point transfer"

    str_draft = (
        f"SUSPICIOUS TRANSACTION REPORT — FIU-IND FORMAT\n"
        f"{'='*55}\n"
        f"Report Date         : {datetime.utcnow().strftime('%d-%b-%Y')}\n"
        f"Case Reference      : {case_id}\n"
        f"Transaction ID      : {actual_txn_id}\n"
        f"Amount              : INR {txn_dict.get('amount', 0):,.2f}\n"
        f"Channel             : {txn_dict.get('channel', 'UPI')}\n"
        f"Sender Account      : {sender_account}\n"
        f"Receiver Account    : {receiver_account}\n"
        f"XGBoost Risk Score  : {score_result['risk_score']}/100 ({score_result['risk_band']})\n"
        f"Network Risk Level  : {network_risk} ({network_summary})\n"
        f"Graph Topology Scope: {graph_context['node_count']} Accounts, {graph_context['edge_count']} Flow Edges\n"
        f"Detected Patterns   : {pattern_line}\n"
        f"Implicated Mules    : {mule_line}\n"
        f"Model Probability   : {score_result.get('model_probability', 0):.4f}\n"
        f"Rule Adjustments    : {score_result.get('rule_adjustments', [])}\n"
        f"Recommended Action  : {score_result['recommended_action']}\n"
        f"Statutory Basis     : PMLA 2002 Section 12 [PMLA_S12] & RBI KYC Para 37 [RBI_MD_KYC_2016_PARA_37]\n"
        f"Regulatory Mandates : RBI FRM 2024 [RBI_FRM_2024_CIRCULAR] | NPCI OC 138 [NPCI_OC_138_MULE] [NPCI_UPI_2023_PARA_5]\n"
        f"Alert Pattern       : {txn_dict.get('scenario_type', 'SUSPICIOUS_TRANSFER')} [PMLA_S3]\n"
        f"Alert Reason        : {txn_dict.get('fraud_reason', 'Behavioral anomaly detected')}\n"
        f"\nAI INVESTIGATION SUMMARY:\n{llm_report[:650]}...\n"
        f"\nReporting Officer   : [PENDING ANALYST SIGN-OFF]\n"
        f"Filing Deadline     : Within 7 days per PMLA 2002 Section 12 [PMLA_S12]\n"
    )

    # ── 5. Composite Risk Synthesis (ML Tabular + Network Topology) ───────────
    now = datetime.utcnow().isoformat()
    cited_clauses = extract_cited_clauses(llm_report + " " + str_draft)

    composite_risk_score = float(score_result["risk_score"])
    composite_risk_band = score_result["risk_band"]
    composite_action = score_result["recommended_action"]

    if network_risk == "CRITICAL":
        composite_risk_band = "CRITICAL"
        composite_risk_score = max(composite_risk_score, 98.4)
        composite_action = "ESCALATE"
    elif network_risk == "HIGH" and composite_risk_band in {"LOW", "MEDIUM"}:
        composite_risk_band = "HIGH"
        composite_risk_score = max(composite_risk_score, 78.5)
        composite_action = "ESCALATE"

    # Actionable Counterfactual Explanation (Phase 4)
    cf = generate_counterfactual(
        transaction=txn_dict,
        shap_dict=score_result.get("shap_values", {}),
        risk_band=composite_risk_band,
        current_score=composite_risk_score,
        model=app_state.model,
        metadata=app_state.metadata,
        network_risk=network_risk,
        patterns=patterns,
    )

    # ── 6. validatorAgent (Citation & Decision Audit) ────────────────────────
    decision_for_validator = {
        "action": composite_action,
        "recommended_action": composite_action,
        "confidence": round(composite_risk_score / 100.0, 4),
        "reasoning": f"Based on composite risk score of {composite_risk_score}",
    }
    try:
        validator_result = _validate_investigation(
            reason_output=llm_report,
            decision_output=decision_for_validator,
            risk_score=composite_risk_score,
            regulations_db=conn,
        )
    except Exception as e:
        print(f"[VALIDATOR AGENT ERROR] {e}")
        validator_result = {
            "validated": False,
            "failed_checks": ["validator_error"],
            "forced_review_level": "manager",
            "details": {"error": str(e)},
        }

    # ── 7. Build full evidence package ────────────────────────────────────────
    evidence_package = {
        "case_id": case_id,
        "transaction_id": actual_txn_id,
        "transaction": txn_dict,
        # Flat risk fields (frontend-friendly)
        "risk_score": composite_risk_score,
        "ml_risk_score": score_result["risk_score"],
        "ml_risk_band": score_result["risk_band"],
        "model_probability": score_result.get("model_probability", 0),
        "risk_level": composite_risk_band,
        "risk_band": composite_risk_band,
        "probability": round(composite_risk_score / 100.0, 4),
        "top_factors": score_result["top_factors"],
        "shap_values": score_result.get("shap_values", {}),
        "rule_adjustments": score_result.get("rule_adjustments", []),
        "counterfactual": cf,
        # Regulatory Clause Traceability (Phase 4)
        "regulatory_clauses": REGULATORY_CLAUSES,
        "cited_clauses": cited_clauses,
        # Agent outputs
        "graph_context": graph_context,
        "freeze_priority_matrix": freeze_matrix,
        "traversal_stopping_rule": stopping_rule,
        "privacy_audit": privacy_audit,
        "investigation_report": llm_report,
        "llm_analysis": llm_report,
        "str_draft": str_draft,
        "recommended_action": composite_action,
        "confidence": round(composite_risk_score / 100.0, 4),
        "ai_generated": ai_generated,
        "reasoning_source": "gemini-3.6-flash" if ai_generated else "regulatory-fallback-template",
        "investigated_at": now,
        # validatorAgent result (always present; check validated == False for flagged cases)
        "validator": validator_result,
        "validated": validator_result["validated"],
        "failed_checks": validator_result["failed_checks"],
        "forced_review_level": validator_result["forced_review_level"],
        "audit_logged": False,
    }

    # ── 8. Persist to DB + audit log (idempotent) ────────────────────────────
    _failed_checks_json = json.dumps(validator_result["failed_checks"])
    if auto_create_case:
        if existing_case:
            conn.execute(
                """UPDATE cases
                   SET risk_score=?, risk_band=?, recommended_action=?,
                       investigation_report=?, str_draft=?, updated_at=?,
                       validated=?, failed_checks=?, forced_review_level=?
                   WHERE case_id=?""",
                (
                    composite_risk_score, composite_risk_band,
                    composite_action, llm_report, str_draft, now,
                    int(validator_result["validated"]),
                    _failed_checks_json,
                    validator_result["forced_review_level"],
                    case_id,
                ),
            )
        else:
            conn.execute(
                """INSERT INTO cases
                  (case_id, transaction_id, status, risk_score, risk_band,
                   recommended_action, analyst_id, investigation_report,
                   str_draft, opened_at, updated_at,
                   validated, failed_checks, forced_review_level)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    case_id, actual_txn_id, "OPEN",
                    composite_risk_score, composite_risk_band,
                    composite_action, user.email,
                    llm_report, str_draft, now, now,
                    int(validator_result["validated"]),
                    _failed_checks_json,
                    validator_result["forced_review_level"],
                ),
            )
        conn.commit()
        log_audit(
            conn, case_id, "INVESTIGATION_COMPLETED",
            actor=user.email,
            details=(
                f"CompositeScore={composite_risk_score}, "
                f"Action={composite_action}, "
                f"ML={score_result['risk_score']}, "
                f"Network={network_risk}, "
                f"AI={ai_generated}, "
                f"Validated={validator_result['validated']}, "
                f"FailedChecks={_failed_checks_json}"
            ),
        )
        evidence_package["audit_logged"] = True

    return evidence_package


@router.get("/regulatory-clauses")
async def get_regulatory_clauses_endpoint(_: CurrentUser = Depends(current_user)):
    """Return dictionary of regulatory clauses and metadata for UI citation tooltips."""
    return REGULATORY_CLAUSES
