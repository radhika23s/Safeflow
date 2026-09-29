"""
Reports Router — /api/reports
==============================
Generates investigation reports and STR (Suspicious Transaction Report) drafts.
STR format is based on FIU-IND reporting requirements under PMLA 2002.
"""

import sqlite3
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from database import get_db
from auth import current_user, CurrentUser

router = APIRouter(dependencies=[Depends(current_user)])


@router.get("/{case_id}/str-draft")
async def generate_str_draft(
    case_id: str,
    conn: sqlite3.Connection = Depends(get_db),
    _: CurrentUser = Depends(current_user),
):
    """
    Generate a Suspicious Transaction Report (STR) draft
    in FIU-IND format for submission to Financial Intelligence Unit - India.
    """
    clean_id = case_id.strip().replace(" ", "-")
    case = conn.execute("SELECT * FROM cases WHERE case_id = ? OR case_id = ?", (case_id, clean_id)).fetchone()
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")

    case_dict = dict(case)
    txn = conn.execute(
        "SELECT * FROM transactions WHERE transaction_id = ?",
        (case_dict["transaction_id"],)
    ).fetchone()
    txn_dict = dict(txn) if txn else {}

    sender = conn.execute(
        "SELECT * FROM customers WHERE customer_id = ?",
        (txn_dict.get("sender_id", ""),)
    ).fetchone()
    sender_dict = dict(sender) if sender else {}

    now = datetime.utcnow()

    str_draft = {
        "report_type": "STR",
        "report_id": f"STR-{case_id}",
        "filing_institution": "[YOUR BANK NAME]",
        "report_date": now.strftime("%Y-%m-%d"),
        "fiu_category": "SUSPICIOUS_TRANSACTION",

        "subject": {
            "name": sender_dict.get("name", "Unknown"),
            "account_id": txn_dict.get("sender_account", "Unknown"),
            "kyc_status": sender_dict.get("kyc_status", "Unknown"),
            "risk_category": sender_dict.get("risk_category", "Unknown"),
            "city": sender_dict.get("city", "Unknown"),
            "phone": sender_dict.get("phone", "Redacted"),
        },

        "transaction": {
            "id": txn_dict.get("transaction_id"),
            "date": txn_dict.get("timestamp", ""),
            "amount_inr": txn_dict.get("amount", 0),
            "channel": txn_dict.get("channel", "UPI"),
            "type": txn_dict.get("type", "TRANSFER"),
            "sender_acc": txn_dict.get("sender_account"),
            "receiver_acc": txn_dict.get("receiver_account"),
            "scenario": txn_dict.get("scenario_type", "UNKNOWN"),
        },

        "risk_assessment": {
            "risk_score": case_dict.get("risk_score"),
            "risk_band": case_dict.get("risk_band"),
            "ai_recommendation": case_dict.get("recommended_action"),
            "analyst_decision": case_dict.get("analyst_decision"),
        },

        "grounds_of_suspicion": txn_dict.get(
            "fraud_reason",
            case_dict.get("investigation_report", "See attached investigation report"),
        ),

        # ── Insider involvement (evidence-backed employee correlation) ─────────
        "insider_involvement": _build_insider_block(conn, clean_id),

        "regulatory_basis": [
            "PMLA 2002, Section 12 — Obligation to maintain records and report",
            "RBI Master Direction on Fraud Risk Management 2024",
            "NPCI UPI OC No. 138 — Suspicious transaction monitoring",
        ],

        "declaration": (
            "I hereby certify that the information given above is true and correct "
            "to the best of my knowledge and belief. This STR is filed in compliance "
            "with Prevention of Money Laundering Act, 2002."
        ),

        "status": "DRAFT — Pending Analyst Review",
        "generated_at": now.isoformat(),
        "generated_by": "Horizon AI Investigation System v2.1",
    }

    return str_draft


def _build_insider_block(conn: sqlite3.Connection, case_id: str) -> dict:
    """Assemble the insider_involvement evidence block for the STR dossier."""
    alerts = []
    for r in conn.execute(
        """SELECT a.*, e.name AS employee_name, e.designation, e.branch_city
           FROM insider_alerts a
           LEFT JOIN employees e ON e.employee_id = a.employee_id
           WHERE a.case_id = ? OR a.case_id IS NULL
           ORDER BY CASE a.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END""",
        (case_id,),
    ).fetchall():
        d = dict(r)
        try:
            d["evidence"] = json.loads(d.get("evidence") or "[]")
        except Exception:
            d["evidence"] = []
        alerts.append(d)

    attributed = [dict(r) for r in conn.execute(
        """SELECT t.transaction_id, t.amount, t.channel, t.timestamp, t.processed_by,
                  e.name AS employee_name, e.designation
           FROM transactions t
           LEFT JOIN employees e ON e.employee_id = t.processed_by
           WHERE t.case_id = ? AND t.processed_by IS NOT NULL""",
        (case_id,),
    ).fetchall()]

    severities = [a["severity"] for a in alerts]
    return {
        "insider_alert_count": len(alerts),
        "max_severity": (
            "CRITICAL" if "CRITICAL" in severities
            else "HIGH" if "HIGH" in severities
            else "MEDIUM" if severities else "NONE"
        ),
        "summary": (
            f"{len(alerts)} evidence-backed insider alert(s) correlate bank-employee "
            f"access and related-party accounts with this transaction cluster."
            if alerts else "No employee-linked anomalies correlated with this case."
        ),
        "alerts": alerts,
        "attributed_transactions": attributed,
    }


@router.get("/{case_id}/full-report")
async def get_full_report(
    case_id: str,
    conn: sqlite3.Connection = Depends(get_db),
    _: CurrentUser = Depends(current_user),
):
    """Get the complete investigation report for a case."""
    clean_id = case_id.strip().replace(" ", "-")
    case = conn.execute("SELECT * FROM cases WHERE case_id = ? OR case_id = ?", (case_id, clean_id)).fetchone()
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")

    case_dict = dict(case)
    return {
        "case_id": case_id,
        "report": case_dict.get("investigation_report", "Report not yet generated."),
        "status": case_dict.get("status"),
        "generated_at": case_dict.get("updated_at"),
    }
