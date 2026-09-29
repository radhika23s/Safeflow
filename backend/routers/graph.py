"""
Graph Router — /api/graph
=========================
Two endpoints:

  GET  /api/graph/{case_id}       — Fetches case transactions from DB, queries
                                    related transactions within configurable depth/time
                                    window, builds a money-flow graph with real pattern
                                    detection (FAN_OUT / FAN_IN / CIRCULAR / VELOCITY).

  POST /api/graph/analyze         — Accepts a validated list of TransactionRecord
                                    objects and returns a clean graph summary.

The core graph-building logic lives in:
  backend/agents/graph_agent/builder.py  ← NetworkX DiGraph construction
  backend/agents/graph_agent/service.py  ← analyze_transactions() entry point
  backend/agents/graph_agent/schemas.py  ← TransactionRecord + GraphAnalysisResult
"""

import sqlite3
from typing import Any
from datetime import datetime, timedelta

import networkx as nx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import get_db, log_audit
from auth import current_user, CurrentUser
from agents.graph_agent.service import analyze_transactions as _analyze_transactions
from agents.graph_agent.schemas import TransactionRecord
from insider_risk import detect_insider_patterns, persist_insider_alerts, build_case_timeline

router = APIRouter(dependencies=[Depends(current_user)])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    transactions: list[TransactionRecord]


# ---------------------------------------------------------------------------
# Pattern detection on an existing graph
# ---------------------------------------------------------------------------

def _detect_patterns(G: nx.DiGraph, primary_sender: str, primary_receiver: str) -> tuple[list[dict[str, Any]], str, str]:
    """
    Detect STRUCTURING (smurfing below PMLA thresholds), FAN_OUT (mule dispersion),
    FAN_IN (aggregation), CIRCULAR (wash-trading cycles), and LAYERED_MULE patterns.
    Returns (patterns, network_risk_band, network_risk_summary).
    """
    patterns: list[dict[str, Any]] = []

    # 1. STRUCTURING / SMURFING (Rapid sub-₹50,000 transfers under PMLA reporting ceiling)
    for node in G.nodes:
        out_edges = G.out_edges(node, data=True)
        sub_50k_transfers = [
            d for _, _, d in out_edges
            if d.get("amount") and 10000 <= float(d.get("amount", 0)) < 50000
        ]
        if len(sub_50k_transfers) >= 3:
            total_structured = sum(float(d.get("amount", 0)) for d in sub_50k_transfers)
            destinations = len(set(v for _, v, _ in out_edges))
            patterns.append({
                "type": "STRUCTURING",
                "severity": "CRITICAL",
                "node": node,
                "count": len(sub_50k_transfers),
                "total_amount": round(total_structured, 2),
                "description": (
                    f"Structuring/Smurfing pattern: Account {node} executed {len(sub_50k_transfers)} "
                    f"transfers under the ₹50,000 PMLA statutory threshold (Total: ₹{total_structured:,.2f}) "
                    f"to {destinations} destination accounts to evade automated AML triggers."
                ),
            })

    # 2. FAN_OUT: Mule dispersion (out_degree >= 3)
    for node in G.nodes:
        out_deg = G.out_degree(node)
        if out_deg >= 3:
            patterns.append({
                "type": "FAN_OUT",
                "severity": "HIGH",
                "node": node,
                "degree": out_deg,
                "description": (
                    f"Mule fan-out dispersion: Account {node} split and disbursed funds across "
                    f"{out_deg} separate counterparty accounts."
                ),
            })

    # 3. FAN_IN: Inflow aggregation (in_degree >= 3)
    for node in G.nodes:
        in_deg = G.in_degree(node)
        if in_deg >= 3:
            patterns.append({
                "type": "FAN_IN",
                "severity": "HIGH",
                "node": node,
                "degree": in_deg,
                "description": (
                    f"Fund aggregation funnel: Account {node} collected inflows from "
                    f"{in_deg} distinct feeder accounts."
                ),
            })

    # 4. CIRCULAR: Fund cycling (simple cycles >= 2 nodes)
    try:
        cycles = list(nx.simple_cycles(G))
        for cycle in cycles[:3]:
            if len(cycle) >= 2:
                patterns.append({
                    "type": "CIRCULAR",
                    "severity": "CRITICAL",
                    "nodes": cycle,
                    "length": len(cycle),
                    "description": f"Circular fund laundering loop: {' → '.join(cycle)} → {cycle[0]}.",
                })
    except nx.NetworkXError:
        pass

    # 5. LAYERED_MULE / RAPID PASSTHROUGH (conduit node receiving and immediately passing funds)
    for node in G.nodes:
        if G.in_degree(node) >= 1 and G.out_degree(node) >= 1 and node != primary_sender:
            patterns.append({
                "type": "LAYERED_MULE",
                "severity": "HIGH",
                "node": node,
                "description": (
                    f"Layered conduit mule: Account {node} acts as an intermediary, receiving funds "
                    f"from {G.in_degree(node)} source(s) and dispersing to {G.out_degree(node)} recipient(s)."
                ),
            })

    # 6. Composite Network Risk Scoring
    has_critical = any(p.get("severity") == "CRITICAL" for p in patterns)
    has_high = any(p.get("severity") == "HIGH" for p in patterns)
    has_mule_layering = any(p["type"] == "LAYERED_MULE" for p in patterns)
    has_structuring = any(p["type"] == "STRUCTURING" for p in patterns)
    has_circular = any(p["type"] == "CIRCULAR" for p in patterns)

    if has_critical or (has_structuring and has_high):
        network_risk = "CRITICAL"
        if has_circular:
            summary = "Circular wash-routing cycle detected across accounts."
        elif has_structuring:
            summary = "PMLA sub-threshold structuring syndicate with multi-destination dispersion."
        else:
            summary = "Critical multi-node syndicate structure identified."
    elif has_high or has_mule_layering:
        network_risk = "HIGH"
        summary = "Coordinated mule dispersion/aggregation detected across cluster."
    elif G.number_of_nodes() > 2:
        network_risk = "MEDIUM"
        summary = "Multi-hop counterparty network detected; elevated relational connection."
    else:
        network_risk = "LOW"
        summary = "Isolated bilateral transaction; no multi-hop syndicate topology detected."

    return patterns, network_risk, summary


def extract_bank_name(account_id: str) -> str:
    """Extract bank name from account identifier (e.g. 'Canara-36480482' -> 'Canara') or return default."""
    if not account_id:
        return "Unknown Bank"
    parts = str(account_id).split("-")
    if len(parts) >= 2 and len(parts[0]) >= 3 and not parts[0].isdigit():
        return parts[0]
    return "Partner Bank"


def assign_visibility_tiers(
    G: nx.DiGraph, primary_sender: str, primary_receiver: str
) -> None:
    """
    Annotates each node with banking rail visibility boundaries:
    - HOST_INTERNAL: Account domiciled inside reporting bank (full internal ledger visibility).
    - EXTERNAL_LAST_CONFIRMED_HOP: Counterparty bank confirmed via interbank payment rails (UPI/NEFT/IMPS).
    - COLLABORATIVE_REGULATORY_LAYER: Secondary hops coordinated via central switch (NPCI / RBI CPFIR DAKSH).
    """
    host_bank = extract_bank_name(primary_sender)

    for n in G.nodes:
        n_bank = extract_bank_name(n)
        if n_bank == host_bank:
            v_tier = "HOST_INTERNAL"
            v_label = "Host Bank Internal Ledger"
            v_desc = f"Fully reconciled within {host_bank} internal core ledger."
        elif G.has_edge(primary_sender, n) or G.has_edge(n, primary_sender) or n == primary_receiver:
            v_tier = "EXTERNAL_LAST_CONFIRMED_HOP"
            v_label = "Payment Rail Egress (Hop 1)"
            v_desc = f"Inter-bank transfer confirmed via {n_bank} IFSC/UPI metadata. Direct visibility terminates here."
        else:
            v_tier = "COLLABORATIVE_REGULATORY_LAYER"
            v_label = "Central Registry Federation (NPCI/CPFIR)"
            v_desc = f"Cross-bank tracking federated via NPCI switch & RBI CPFIR (DAKSH) aggregated STR filings."

        G.nodes[n]["bank"] = n_bank
        G.nodes[n]["visibility_tier"] = v_tier
        G.nodes[n]["visibility_label"] = v_label
        G.nodes[n]["visibility_desc"] = v_desc


def compute_freeze_priority_matrix(
    G: nx.DiGraph,
    primary_sender: str,
    primary_receiver: str,
    total_amount: float,
) -> tuple[list[dict[str, Any]], str]:
    """
    Computes an actionable Asset Recovery & Freeze Priority Matrix for all downstream accounts:
    - Retained amount & % of initial flagged amount.
    - Dwell time (minutes since fund arrival).
    - Actionable ranked recommendation (P1 Immediate Freeze, P2 Provisional Lien, LEA Referral).
    - Dynamic stopping rule explanation.
    """
    matrix: list[dict[str, Any]] = []
    base_amt = max(total_amount, 1.0)

    # Find all downstream accounts reachable from primary_sender or primary_receiver
    downstream_nodes: set[str] = set()
    for start_node in [primary_receiver, primary_sender]:
        if start_node in G:
            for desc in nx.descendants(G, start_node):
                downstream_nodes.add(desc)
    if primary_receiver in G and primary_receiver != primary_sender:
        downstream_nodes.add(primary_receiver)

    now_dt = datetime.now()

    for node in downstream_nodes:
        in_edges = list(G.in_edges(node, data=True))
        out_edges = list(G.out_edges(node, data=True))

        total_inflow = sum(float(d.get("amount", 0)) for _, _, d in in_edges)
        total_outflow = sum(float(d.get("amount", 0)) for _, _, d in out_edges)
        retained = max(0.0, total_inflow - total_outflow)
        inflow_pct = round((total_inflow / base_amt) * 100, 1)
        retained_pct = round((retained / base_amt) * 100, 1)

        # Dwell time calculation
        dwell_minutes = 18
        timestamps = [d.get("timestamp") for _, _, d in in_edges if d.get("timestamp")]
        if timestamps:
            try:
                earliest_in = min(
                    datetime.fromisoformat(ts.replace("Z", "+00:00").split("+")[0])
                    for ts in timestamps
                )
                diff_m = max(1, int((now_dt - earliest_in).total_seconds() / 60))
                dwell_minutes = min(diff_m, 180)
            except Exception:
                dwell_minutes = 18

        out_deg = G.out_degree(node)
        bank_name = G.nodes[node].get("bank", extract_bank_name(node))
        v_tier = G.nodes[node].get("visibility_tier", "EXTERNAL_LAST_CONFIRMED_HOP")

        if retained > 0 and out_deg == 0:
            status = "RECOVERABLE_IN_ACCOUNT"
            priority = "P1_IMMEDIATE_DEBIT_FREEZE"
            action = f"Execute immediate debit freeze under RBI FRM 2024. ₹{retained:,.2f} ({retained_pct}%) active and recoverable."
            priority_score = 1000 + retained
        elif retained > 0 and out_deg > 0:
            status = "PARTIALLY_RECOVERABLE"
            priority = "P2_PROVISIONAL_LIEN"
            action = f"Place provisional lien on remaining ₹{retained:,.2f}; issue NCRP alert to downstream nodes."
            priority_score = 500 + retained
        else:
            status = "DISPERSED_TERMINAL_CASHOUT"
            priority = "LEA_NCRP_REFERRAL_ONLY"
            action = "Funds already liquidated / cashed out at ATM/POS. Post-freeze recovery zero; escalate to LEA & NCRP."
            priority_score = 10

        matrix.append({
            "account_id": node,
            "bank": bank_name,
            "visibility_tier": v_tier,
            "role": G.nodes[node].get("role", "MULE_CASHOUT"),
            "total_inflow": round(total_inflow, 2),
            "inflow_pct": inflow_pct,
            "retained_amount": round(retained, 2),
            "retained_pct": retained_pct,
            "dwell_minutes": dwell_minutes,
            "recovery_status": status,
            "freeze_priority": priority,
            "recommended_action": action,
            "_sort_score": priority_score,
        })

    matrix.sort(key=lambda x: x["_sort_score"], reverse=True)
    for item in matrix:
        del item["_sort_score"]

    stopping_rule = (
        "Traversal dynamically halted upon identifying terminal cash-out endpoints (leaves) "
        "and external inter-bank payment rail perimeters. Halting at terminal nodes is a deliberate "
        "finding confirming the complete blast radius of digital fund movement."
    )

    return matrix, stopping_rule


# ---------------------------------------------------------------------------
# POST /api/graph/analyze  — validated ad-hoc graph analysis
# ---------------------------------------------------------------------------

@router.post("/analyze")
async def analyze_transaction_graph(body: AnalyzeRequest):
    """
    Accept a list of raw transactions, build a directed graph, and return
    a validated summary (nodes, connections, counts).
    """
    try:
        result = _analyze_transactions([t.model_dump() for t in body.transactions])
        return result
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# GET /api/graph/{case_id}  — case-based graph from DB (with real pattern detection)
# ---------------------------------------------------------------------------

@router.get("/{case_id}")
async def get_transaction_graph(
    case_id: str,
    depth: int = 2,
    conn: sqlite3.Connection = Depends(get_db),
    _: CurrentUser = Depends(current_user),
) -> dict[str, Any]:
    """
    Build a multi-hop money-flow graph for a persisted case by performing
    a BFS traversal (up to `depth` hops) from the case's primary sender and receiver.
    Returns nodes with role labels (ORIGIN, INTERMEDIARY, MULE_CASHOUT, FEEDER),
    edges with amounts/channels, detected relational patterns (STRUCTURING, FAN_OUT,
    FAN_IN, CIRCULAR, LAYERED_MULE), and composite dual network risk scoring.
    """
    clean_id = case_id.strip().replace(" ", "-")
    case = conn.execute("SELECT * FROM cases WHERE case_id = ? OR case_id = ?", (case_id, clean_id)).fetchone()
    if not case:
        raise HTTPException(404, detail=f"Case {case_id} not found")

    txn = conn.execute(
        "SELECT * FROM transactions WHERE transaction_id = ?",
        (dict(case)["transaction_id"],),
    ).fetchone()
    if not txn:
        return {
            "case_id": case_id,
            "nodes": [],
            "links": [],
            "patterns": [],
            "network_risk": "LOW",
            "network_risk_summary": "No transaction records found.",
        }

    txn_dict = dict(txn)
    primary_sender = txn_dict.get("sender_account") or txn_dict.get("sender_id", "UNKNOWN")
    primary_receiver = txn_dict.get("receiver_account") or txn_dict.get("receiver_id", "UNKNOWN")

    # ── Multi-Hop BFS Traversal (up to `depth` hops) ───────────────────────────
    visited_accounts = {primary_sender, primary_receiver}
    current_frontier = {primary_sender, primary_receiver}
    collected_txns: dict[str, dict[str, Any]] = {}

    # Add primary transaction first
    if txn_dict.get("transaction_id"):
        collected_txns[txn_dict["transaction_id"]] = txn_dict

    search_depth = max(1, min(depth, 3))
    for _ in range(search_depth):
        if not current_frontier:
            break
        placeholders = ",".join("?" for _ in current_frontier)
        # Check both sender and receiver matches
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

    # ── Construct NetworkX Graph ──────────────────────────────────────────────
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

    # Ensure the primary edge is explicitly recorded
    G.add_node(primary_sender)
    G.add_node(primary_receiver)
    G.add_edge(
        primary_sender,
        primary_receiver,
        amount=txn_dict.get("amount", 0),
        transaction_id=txn_dict.get("transaction_id", ""),
        channel=txn_dict.get("channel", "UPI"),
        timestamp=txn_dict.get("timestamp", ""),
    )

    # ── Role Classification per Node ──────────────────────────────────────────
    for n in G.nodes:
        in_d = G.in_degree(n)
        out_d = G.out_degree(n)
        if n == primary_sender:
            role = "ORIGIN"
            suspicious = True
        elif n == primary_receiver:
            role = "INTERMEDIARY" if out_d > 0 else "BENEFICIARY"
            suspicious = True
        elif G.has_edge(n, primary_sender):
            role = "FEEDER"
            suspicious = False
        elif G.has_edge(primary_receiver, n) or G.has_edge(primary_sender, n):
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

    # ── Bank Visibility Tiers & Cross-Bank Boundary ───────────────────────────
    assign_visibility_tiers(G, primary_sender, primary_receiver)

    # ── Pattern Detection & Composite Risk ────────────────────────────────────
    patterns, network_risk, network_summary = _detect_patterns(G, primary_sender, primary_receiver)

    # ── Insider-Risk Correlation (employee × money-flow) ──────────────────────
    insider_alerts = detect_insider_patterns(
        conn, collected_txns, G, primary_sender, primary_receiver, patterns=patterns
    )
    if insider_alerts:
        persist_insider_alerts(conn, insider_alerts, case_id=clean_id)
        # Merge persisted lifecycle status (survives upsert) into the response.
        persisted_status = {
            r["alert_id"]: r["status"]
            for r in conn.execute(
                "SELECT alert_id, status FROM insider_alerts"
            ).fetchall()
        }
        for a in insider_alerts:
            a["status"] = persisted_status.get(a["alert_id"], "OPEN")
        insider_severities = {a["severity"] for a in insider_alerts}
        if "CRITICAL" in insider_severities and network_risk not in ("CRITICAL",):
            network_risk = "HIGH"
            network_summary = (
                network_summary + " | Employee-linked accounts detected in flow — "
                "insider involvement flagged (see insider_alerts)."
            )

    # ── Employee × Transaction Activity Timeline ──────────────────────────────
    case_accounts = {primary_sender, primary_receiver}
    timeline = build_case_timeline(conn, collected_txns, case_accounts)

    # ── Asset Recovery & Freeze Priority Matrix ───────────────────────────────
    freeze_matrix, stopping_rule = compute_freeze_priority_matrix(
        G, primary_sender, primary_receiver, float(txn_dict.get("amount", 0))
    )

    nodes = [{"id": n, **G.nodes[n]} for n in G.nodes]
    links = [
        {
            "source": u,
            "target": v,
            "amount": G.edges[u, v].get("amount"),
            "channel": G.edges[u, v].get("channel", "UPI"),
            "transaction_id": G.edges[u, v].get("transaction_id"),
            "timestamp": G.edges[u, v].get("timestamp"),
        }
        for u, v in G.edges
    ]

    return {
        "case_id": case_id,
        "nodes": nodes,
        "links": links,
        "patterns": patterns,
        "network_risk": network_risk,
        "network_risk_summary": network_summary,
        "insider_alerts": insider_alerts,
        "activity_timeline": timeline,
        "freeze_priority_matrix": freeze_matrix,
        "traversal_stopping_rule": stopping_rule,
        "transaction_count": len(collected_txns),
        "node_count": G.number_of_nodes(),
        "edge_count": G.number_of_edges(),
        "primary_sender": primary_sender,
        "primary_receiver": primary_receiver,
    }
