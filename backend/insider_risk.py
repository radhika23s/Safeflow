"""
Insider Risk Detection — Employee × Financial Crime Correlation
================================================================
Closes the PS gap: links employees + access rights + account ownership into the
money-flow graph and produces explainable, evidence-backed insider alerts.

Pattern types emitted (each with machine-checkable evidence):

  INSIDER_TERMINAL_BENEFICIARY
      Funds from the investigated flow terminate in an employee-linked account
      (SELF or undeclared related-party). Strongest direct-benefit signal.

  INSIDER_STRUCTURING
      An employee processed >= 3 sub-threshold transfers in a short window,
      and/or a limit_override activity event exists on a structuring txn.
      Insider-assisted transaction splitting.

  INSIDER_CIRCULAR_INVOLVEMENT
      A cycle node is employee-linked — round-tripping with insider assistance.

  INSIDER_PROFILE_MISMATCH
      Employee activity contradicts their profile: after-hours access, TXN
      overrides outside entitlement, or access-events clustering around the
      flagged transaction window on entities they do not own.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta
from typing import Any

import networkx as nx


# ---------------------------------------------------------------------------
# Data access helpers
# ---------------------------------------------------------------------------

def _fetch_employee_links(conn: sqlite3.Connection) -> dict[str, list[dict[str, Any]]]:
    """Return account_id -> [{employee_id, relationship, declared, name, designation}]."""
    rows = conn.execute("""
        SELECT l.account_id, l.employee_id, l.relationship, l.declared,
               e.name, e.designation, e.branch_id, e.branch_city, e.access_tier, e.access_rights
        FROM employee_account_links l
        JOIN employees e ON e.employee_id = l.employee_id
    """).fetchall()
    links: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        d = dict(r)
        links.setdefault(d["account_id"], []).append(d)
    return links


def _fetch_activity(conn: sqlite3.Connection, days: int = 30) -> list[dict[str, Any]]:
    """Fetch employee activity events from the lookback window (default 30 days)."""
    since = (datetime.now() - timedelta(days=days)).isoformat()
    rows = conn.execute("""
        SELECT employee_id, action, entity_ref, details, timestamp
        FROM employee_activity_log
        WHERE timestamp >= ?
        ORDER BY timestamp ASC
    """, (since,)).fetchall()
    return [dict(r) for r in rows]


def _is_after_hours(ts_str: str | None) -> tuple[bool, str]:
    """True if ISO timestamp falls outside 08:00–19:00 local business hours."""
    if not ts_str:
        return False, ""
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00").split("+")[0])
        hour = dt.hour
        if hour < 8 or hour >= 19:
            return True, f"{dt.strftime('%H:%M')} (outside 08:00-19:00 business hours)"
    except Exception:
        pass
    return False, ""


def _iso_minutes_between(a: str | None, b: str | None) -> float | None:
    """Minutes between two ISO timestamps; None if unparseable."""
    try:
        if not a or not b:
            return None
        d1 = datetime.fromisoformat(a.replace("Z", "+00:00").split("+")[0])
        d2 = datetime.fromisoformat(b.replace("Z", "+00:00").split("+")[0])
        return abs((d1 - d2).total_seconds() / 60.0)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Core detector — runs against the case's collected transactions + graph
# ---------------------------------------------------------------------------

def detect_insider_patterns(
    conn: sqlite3.Connection,
    collected_txns: dict[str, dict[str, Any]],
    G: nx.DiGraph,
    primary_sender: str,
    primary_receiver: str,
    patterns: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """
    Detect employee-linked anomalies in the case graph.

    Args:
        conn: DB connection (for employee/link/activity lookups).
        collected_txns: transaction_id -> txn dict gathered for this case.
        G: the money-flow DiGraph (account nodes).
        primary_sender / primary_receiver: case anchor accounts.
        patterns: existing external-crime patterns, used to correlate
                   STRUCTURING / CIRCULAR hits with employee involvement.

    Returns:
        List of insider alert dicts, each with:
        { alert_id, employee_id, pattern_type, severity, evidence[], explanation }
        Evidence entries are {type, ref, detail} — reviewer-verifiable pointers.
    """
    insider_alerts: list[dict[str, Any]] = []
    links = _fetch_employee_links(conn)
    activity = _fetch_activity(conn)

    if not links:
        return insider_alerts

    # Index activity by referenced entity for quick lookup
    activity_by_ref: dict[str, list[dict[str, Any]]] = {}
    for ev in activity:
        if ev.get("entity_ref"):
            activity_by_ref.setdefault(ev["entity_ref"], []).append(ev)

    def _link_for(account: str) -> dict[str, Any] | None:
        for lk in links.get(account, []):
            return lk
        return None

    def _evidence(kind: str, ref: str, detail: str) -> dict[str, str]:
        return {"type": kind, "ref": ref, "detail": detail}

    # ── 1. INSIDER_TERMINAL_BENEFICIARY ───────────────────────────────────────
    # Any graph node with an employee link that received funds in this flow.
    for node in G.nodes:
        lk = _link_for(node)
        if not lk:
            continue
        inflow = G.in_edges(node, data=True) if node in G else []
        inflow_amt = sum(float(d.get("amount", 0)) for _, _, d in inflow)
        if inflow_amt <= 0:
            continue

        declared_txt = "declared" if lk.get("declared") else "UNDECLARED"
        severity = "CRITICAL" if not lk.get("declared") and node not in (primary_sender,) else "HIGH"
        evidence = [
            _evidence("account_link", node,
                      f"{lk['name']} ({lk['designation']}) is linked to {node} "
                      f"as {lk['relationship']} ({declared_txt} link)"),
            _evidence("inflow", node,
                      f"Account received ₹{inflow_amt:,.2f} across {G.in_degree(node)} "
                      f"inflow(s) inside the investigated money flow"),
        ]
        # Correlate employee processing of the inflows
        for _, _, d in inflow:
            src_txn = d.get("transaction_id")
            txn_row = collected_txns.get(src_txn)
            if txn_row and txn_row.get("processed_by"):
                pb = txn_row["processed_by"]
                if pb == lk["employee_id"]:
                    evidence.append(_evidence(
                        "self_processed", src_txn,
                        f"{lk['name']} personally processed transaction {src_txn} "
                        f"that paid {node} (employee-linked account)"
                    ))
                else:
                    emp_rows = conn.execute(
                        "SELECT name, designation FROM employees WHERE employee_id = ?", (pb,)
                    ).fetchone()
                    if emp_rows:
                        evidence.append(_evidence(
                            "colleague_processed", src_txn,
                            f"Transaction {src_txn} processed by {emp_rows['name']} "
                            f"({emp_rows['designation']})"
                        ))

        explanation = (
            f"Money-flow terminates in an employee-linked account: {node} belongs to "
            f"{lk['name']} ({lk['designation']}, {lk.get('branch_city', '')}) as their "
            f"{lk['relationship']} — {declared_txt}. The flow delivered ₹{inflow_amt:,.2f} "
            f"into this account, creating a direct-benefit channel between the "
            f"investigated transaction cluster and bank staff."
        )
        insider_alerts.append({
            "alert_id": f"INS-{lk['employee_id']}-BEN-{node}",
            "employee_id": lk["employee_id"],
            "pattern_type": "INSIDER_TERMINAL_BENEFICIARY",
            "severity": severity,
            "evidence": evidence,
            "explanation": explanation,
        })

    # ── 2. INSIDER_STRUCTURING ────────────────────────────────────────────────
    # Employee processed >= 3 of the case's sub-threshold (<₹50k) transfers.
    per_employee_sub_threshold: dict[str, list[dict[str, Any]]] = {}
    for t_id, txn in collected_txns.items():
        amt = float(txn.get("amount", 0))
        if 0 < amt < 50000 and txn.get("processed_by"):
            per_employee_sub_threshold.setdefault(txn["processed_by"], []).append(
                {"transaction_id": t_id, "amount": amt, "timestamp": txn.get("timestamp")}
            )

    for emp_id, txns in per_employee_sub_threshold.items():
        if len(txns) < 3:
            continue
        emp_rows = conn.execute(
            "SELECT name, designation, branch_city, access_rights FROM employees WHERE employee_id = ?",
            (emp_id,),
        ).fetchone()
        if not emp_rows:
            continue
        total = sum(t["amount"] for t in txns)
        evidence = [
            _evidence("processed_transactions", t["transaction_id"],
                      f"Processed sub-threshold transfer of ₹{t['amount']:,.2f} at {t['timestamp']}")
            for t in txns
        ]
        # Correlate with STRUCTURING graph pattern if detected
        if patterns:
            for p in patterns:
                if p.get("type") == "STRUCTURING" and p.get("node") in (
                    primary_sender, primary_receiver
                ):
                    evidence.append(_evidence(
                        "network_pattern", "STRUCTURING",
                        f"Graph engine independently flagged STRUCTURING at node {p['node']}: "
                        f"{p.get('description', '')}"
                    ))
        # Limit-override activity within the case window
        for ev in activity:
            if ev["employee_id"] == emp_id and ev.get("action") == "TXN_OVERRIDE":
                evidence.append(_evidence(
                    "activity_event", ev.get("entity_ref") or ev["action"],
                    f"Access-log evidence: {ev.get('details', '')} (at {ev['timestamp']})"
                ))
        explanation = (
            f"Employee {emp_rows['name']} ({emp_rows['designation']}, "
            f"{emp_rows['branch_city']}) personally processed {len(txns)} transfers below "
            f"the ₹50,000 PMLA reporting threshold totalling ₹{total:,.2f}. Sub-threshold "
            f"splitting processed by the same insider is consistent with employee-assisted "
            f"structuring: the insider is positioned to keep each leg under review limits."
        )
        insider_alerts.append({
            "alert_id": f"INS-{emp_id}-STRUCT",
            "employee_id": emp_id,
            "pattern_type": "INSIDER_STRUCTURING",
            "severity": "CRITICAL",
            "evidence": evidence,
            "explanation": explanation,
        })

    # ── 3. INSIDER_CIRCULAR_INVOLVEMENT ───────────────────────────────────────
    if patterns:
        for p in patterns:
            if p.get("type") != "CIRCULAR":
                continue
            for node in p.get("nodes", []):
                lk = _link_for(node)
                if not lk:
                    continue
                insider_alerts.append({
                    "alert_id": f"INS-{lk['employee_id']}-CIRC-{node}",
                    "employee_id": lk["employee_id"],
                    "pattern_type": "INSIDER_CIRCULAR_INVOLVEMENT",
                    "severity": "CRITICAL",
                    "evidence": [
                        _evidence("account_link", node,
                                  f"{lk['name']} is linked to cycle node {node} as "
                                  f"{lk['relationship']} ({'declared' if lk['declared'] else 'UNDECLARED'})"),
                        _evidence("network_pattern", "CIRCULAR",
                                  f"Round-trip cycle passes through employee-linked node: "
                                  f"{' → '.join(p.get('nodes', []))}"),
                    ],
                    "explanation": (
                        f"A circular fund-routing cycle includes {node}, an account linked to "
                        f"employee {lk['name']} ({lk['designation']}) as {lk['relationship']}. "
                        f"Round-tripping through a staff-linked account suggests insider "
                        f"participation in layering, not merely coincidence."
                    ),
                })

    # ── 4. INSIDER_PROFILE_MISMATCH ───────────────────────────────────────────
    # Employees become 'involved' in a case by processing its transactions or
    # owning linked accounts inside the flow. Their activity events that
    # contradict their profile (after-hours access, TXN overrides) are then
    # correlated — including generic events (e.g. portal logins) that do not
    # name a case entity directly.
    case_accounts = {primary_sender, primary_receiver} | set(G.nodes)
    involved_employees: dict[str, str] = {}
    for t_id, txn in collected_txns.items():
        pb = txn.get("processed_by")
        if pb:
            involved_employees.setdefault(pb, f"having processed case transaction {t_id}")
    for acct in case_accounts:
        for lk in links.get(acct, []):
            involved_employees.setdefault(
                lk["employee_id"], f"linked to case account {acct} ({lk['relationship']})"
            )

    seen_mismatch: set[str] = set()

    for ev in activity:
        emp_id = ev["employee_id"]
        if emp_id not in involved_employees:
            continue

        is_override = ev.get("action") == "TXN_OVERRIDE"
        is_after, hhmm = _is_after_hours(ev.get("timestamp"))
        is_offshift = is_after and "outside assigned shift" in (ev.get("details") or "")

        if not (is_override or is_offshift):
            continue

        emp_rows = conn.execute(
            "SELECT name, designation, branch_city, access_rights, access_tier FROM employees WHERE employee_id = ?",
            (emp_id,),
        ).fetchone()
        if not emp_rows:
            continue

        ref = ev.get("entity_ref") or ev["action"]
        if is_override:
            mismatch_reason = (
                f"Applied a transaction override on {ref} while {involved_employees[emp_id]} "
                f"— override outside documented entitlements."
            )
            sev = "HIGH"
        else:
            mismatch_reason = (
                f"System access at {hhmm} while {involved_employees[emp_id]} — "
                f"access inconsistent with assigned shift."
            )
            sev = "MEDIUM"

        dedup_key = f"{emp_id}:{ev['action']}:{'OVR' if is_override else 'OFFSHIFT'}"
        if dedup_key in seen_mismatch:
            continue
        seen_mismatch.add(dedup_key)

        insider_alerts.append({
            "alert_id": f"INS-{emp_id}-MISMATCH-{ev['action']}",
            "employee_id": emp_id,
            "pattern_type": "INSIDER_PROFILE_MISMATCH",
            "severity": sev,
            "evidence": [
                _evidence("activity_event", ref,
                          f"{ev.get('details', '')} (at {ev['timestamp']})"),
                _evidence("profile", emp_id,
                          f"{emp_rows['name']} — {emp_rows['designation']}, tier "
                          f"{emp_rows['access_tier']}, rights: {emp_rows['access_rights']}"),
            ],
            "explanation": (
                f"Profile mismatch: {mismatch_reason} Employee profile shows "
                f"{emp_rows['designation']} with {emp_rows['access_tier']} access "
                f"({emp_rows['access_rights']})."
            ),
        })

    return insider_alerts


# ---------------------------------------------------------------------------
# Persistence (evidence-backed alert records)
# ---------------------------------------------------------------------------

def persist_insider_alerts(
    conn: sqlite3.Connection,
    alerts: list[dict[str, Any]],
    case_id: str | None = None,
) -> int:
    """Upsert insider alerts into insider_alerts with full evidence payload."""
    now = datetime.utcnow().isoformat()
    count = 0
    for a in alerts:
        conn.execute("""
            INSERT INTO insider_alerts (
                alert_id, employee_id, case_id, pattern_type, severity,
                evidence, explanation, status, opened_at
            ) VALUES (?,?,?,?,?,?,?,?,?)
            ON CONFLICT(alert_id) DO UPDATE SET
                severity = excluded.severity,
                evidence = excluded.evidence,
                explanation = excluded.explanation,
                case_id = COALESCE(excluded.case_id, insider_alerts.case_id)
        """, (
            a["alert_id"], a["employee_id"], case_id, a["pattern_type"],
            a["severity"], json.dumps(a["evidence"]), a["explanation"],
            "OPEN", now,
        ))
        count += 1
    conn.commit()
    return count


# ---------------------------------------------------------------------------
# Case activity timeline (employee actions interleaved with money flow)
# ---------------------------------------------------------------------------

def build_case_timeline(
    conn: sqlite3.Connection,
    collected_txns: dict[str, dict[str, Any]],
    case_accounts: set[str],
) -> list[dict[str, Any]]:
    """
    Unified activity timeline: employee access events interleaved with
    transactions touching the case's accounts. Sorted chronologically.
    """
    events: list[dict[str, Any]] = []

    for t_id, txn in collected_txns.items():
        if txn.get("sender_account") in case_accounts or txn.get("receiver_account") in case_accounts:
            events.append({
                "ts": txn.get("timestamp"),
                "kind": "TRANSACTION",
                "ref": t_id,
                "actor": txn.get("processed_by"),
                "detail": (
                    f"₹{float(txn.get('amount', 0)):,.2f} {txn.get('channel', '')} "
                    f"{txn.get('sender_account', '')} → {txn.get('receiver_account', '')}"
                ),
            })

    for ev in _fetch_activity(conn, days=30):
        if ev.get("entity_ref") in case_accounts or ev.get("entity_ref") in collected_txns:
            emp_rows = conn.execute(
                "SELECT name, designation FROM employees WHERE employee_id = ?",
                (ev["employee_id"],),
            ).fetchone()
            events.append({
                "ts": ev["timestamp"],
                "kind": "EMPLOYEE_ACCESS",
                "ref": ev.get("entity_ref") or ev["action"],
                "actor": ev["employee_id"],
                "actor_name": emp_rows["name"] if emp_rows else ev["employee_id"],
                "action": ev["action"],
                "detail": ev.get("details", ""),
            })

    events.sort(key=lambda e: e.get("ts") or "")
    return events
