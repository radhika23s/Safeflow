"""
Insider Router — /api/insider
=============================
Employee & access-risk intelligence endpoints:

  GET  /api/insider/employees           — directory with links + alert rollup
  GET  /api/insider/alerts              — all persisted insider alerts (evidence-backed)
  GET  /api/insider/alerts/{alert_id}   — single alert with full evidence chain
  GET  /api/insider/employees/{id}/timeline — employee activity + linked-account flow
  GET  /api/insider/case/{case_id}/summary  — insider correlation summary for a case
  GET  /api/insider/audit               — insider lifecycle events from the audit trail
"""

import json
import sqlite3
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import get_db, log_audit
from auth import current_user, CurrentUser, require_roles

router = APIRouter(dependencies=[Depends(current_user)])

# Minimum-role gate: higher roles inherit the powers of lower ones.
_ROLE_LEVEL = {"investigator": 1, "manager": 2, "administrator": 3}


def _require_min_role(user: CurrentUser, min_role: str) -> CurrentUser:
    if _ROLE_LEVEL.get(user.role, 0) < _ROLE_LEVEL.get(min_role, 99):
        raise HTTPException(403, f"Requires {min_role} role or higher (current: {user.role})")
    return user

# Alert lifecycle transitions (mirrors case statuses for reviewer familiarity)
_ALERT_ACTIONS = {
    # action -> (from_statuses, to_status, audit_action, minimum_role)
    "CLAIM":    ({"OPEN", "CLAIMED"},           "CLAIMED",   "INSIDER_ALERT_CLAIMED",    "investigator"),
    "ESCALATE": ({"OPEN", "CLAIMED", "ESCALATED"}, "ESCALATED", "INSIDER_ALERT_ESCALATED", "investigator"),
    "DISMISS":  ({"OPEN", "CLAIMED", "ESCALATED"}, "DISMISSED", "INSIDER_ALERT_DISMISSED", "manager"),
    "RESOLVE":  ({"CLAIMED", "ESCALATED"},       "RESOLVED",  "INSIDER_ALERT_RESOLVED",   "manager"),
    "REOPEN":   ({"DISMISSED", "RESOLVED"},      "OPEN",      "INSIDER_ALERT_REOPENED",   "manager"),
}


class AlertActionRequest(BaseModel):
    action: str  # CLAIM | ESCALATE | DISMISS | RESOLVE | REOPEN
    notes: Optional[str] = ""


def _row_dicts(rows) -> list[dict]:
    return [dict(r) for r in rows]


@router.get("/employees")
async def list_employees(
    branch: Optional[str] = None,
    conn: sqlite3.Connection = Depends(get_db),
    _: CurrentUser = Depends(current_user),
):
    """Employee directory with account links and open insider-alert counts."""
    sql = "SELECT * FROM employees"
    params: tuple = ()
    if branch:
        sql += " WHERE branch_id = ?"
        params = (branch,)
    rows = _row_dicts(conn.execute(sql + " ORDER BY employee_id", params).fetchall())

    links = _row_dicts(conn.execute("SELECT * FROM employee_account_links").fetchall())
    alerts = _row_dicts(conn.execute(
        "SELECT alert_id, employee_id, pattern_type, severity, status FROM insider_alerts"
    ).fetchall())

    links_by_emp: dict[str, list[dict]] = {}
    for l in links:
        links_by_emp.setdefault(l["employee_id"], []).append(l)
    alerts_by_emp: dict[str, list[dict]] = {}
    for a in alerts:
        alerts_by_emp.setdefault(a["employee_id"], []).append(a)

    for emp in rows:
        emp_links = links_by_emp.get(emp["employee_id"], [])
        emp["account_links"] = [
            {k: v for k, v in l.items() if k != "employee_id"} for l in emp_links
        ]
        emp_alerts = [a for a in alerts_by_emp.get(emp["employee_id"], []) if a["status"] == "OPEN"]
        emp["open_alert_count"] = len(emp_alerts)
        emp["alert_types"] = sorted({a["pattern_type"] for a in emp_alerts})
        emp["max_severity"] = (
            "CRITICAL" if any(a["severity"] == "CRITICAL" for a in emp_alerts)
            else "HIGH" if any(a["severity"] == "HIGH" for a in emp_alerts)
            else "MEDIUM" if emp_alerts else "NONE"
        )

    return {"employees": rows, "total": len(rows)}


@router.get("/alerts")
async def list_alerts(
    status: Optional[str] = None,
    pattern_type: Optional[str] = None,
    severity: Optional[str] = None,
    conn: sqlite3.Connection = Depends(get_db),
    _: CurrentUser = Depends(current_user),
):
    """All insider alerts with employee + case context."""
    sql = """
        SELECT a.alert_id, a.employee_id, a.case_id, a.pattern_type, a.severity,
               a.evidence, a.explanation, a.status, a.opened_at,
               e.name AS employee_name, e.designation, e.branch_city
        FROM insider_alerts a
        LEFT JOIN employees e ON e.employee_id = a.employee_id
        WHERE 1=1
    """
    params: list = []
    if status:
        sql += " AND a.status = ?"
        params.append(status)
    if pattern_type:
        sql += " AND a.pattern_type = ?"
        params.append(pattern_type)
    if severity:
        sql += " AND a.severity = ?"
        params.append(severity)
    sql += " ORDER BY a.opened_at DESC"

    out = []
    for r in _row_dicts(conn.execute(sql, params).fetchall()):
        try:
            r["evidence"] = json.loads(r.get("evidence") or "[]")
        except Exception:
            r["evidence"] = []
        out.append(r)
    return {"alerts": out, "total": len(out)}


@router.get("/alerts/{alert_id}")
async def get_alert(
    alert_id: str,
    conn: sqlite3.Connection = Depends(get_db),
    _: CurrentUser = Depends(current_user),
):
    """Single insider alert with the complete evidence chain."""
    row = conn.execute("""
        SELECT a.*, e.name AS employee_name, e.designation, e.branch_city,
               e.access_tier, e.access_rights
        FROM insider_alerts a
        LEFT JOIN employees e ON e.employee_id = a.employee_id
        WHERE a.alert_id = ?
    """, (alert_id,)).fetchone()
    if not row:
        raise HTTPException(404, f"Alert {alert_id} not found")
    d = dict(row)
    try:
        d["evidence"] = json.loads(d.get("evidence") or "[]")
    except Exception:
        d["evidence"] = []
    return d


@router.get("/employees/{employee_id}/timeline")
async def employee_timeline(
    employee_id: str,
    conn: sqlite3.Connection = Depends(get_db),
    _: CurrentUser = Depends(current_user),
):
    """Chronological view: employee access events + activity on linked accounts."""
    emp = conn.execute("SELECT * FROM employees WHERE employee_id = ?", (employee_id,)).fetchone()
    if not emp:
        raise HTTPException(404, f"Employee {employee_id} not found")

    linked_accounts = [
        r["account_id"] for r in conn.execute(
            "SELECT account_id FROM employee_account_links WHERE employee_id = ?",
            (employee_id,),
        ).fetchall()
    ]

    events = []
    for r in conn.execute("""
        SELECT action, entity_ref, details, timestamp
        FROM employee_activity_log WHERE employee_id = ? ORDER BY timestamp ASC
    """, (employee_id,)).fetchall():
        d = dict(r)
        d["kind"] = "EMPLOYEE_ACCESS"
        events.append(d)

    if linked_accounts:
        placeholders = ",".join("?" for _ in linked_accounts)
        for r in conn.execute(f"""
            SELECT transaction_id AS entity_ref, amount, channel, timestamp,
                   sender_account, receiver_account, processed_by
            FROM transactions
            WHERE sender_account IN ({placeholders}) OR receiver_account IN ({placeholders})
            ORDER BY timestamp ASC
        """, linked_accounts + linked_accounts).fetchall():
            d = dict(r)
            d["action"] = "LINKED_ACCOUNT_TXN"
            d["details"] = (
                f"₹{d['amount']:,.2f} {d['channel'] or ''} "
                f"{d['sender_account']} → {d['receiver_account']}"
            )
            d["kind"] = "LINKED_ACCOUNT_FLOW"
            events.append(d)

    events.sort(key=lambda e: e.get("timestamp") or "")
    return {
        "employee": dict(emp),
        "linked_accounts": linked_accounts,
        "events": events,
        "total_events": len(events),
    }


@router.post("/alerts/{alert_id}/action")
async def alert_action(
    alert_id: str,
    body: AlertActionRequest,
    conn: sqlite3.Connection = Depends(get_db),
    user: CurrentUser = Depends(current_user),
):
    """
    Advance an insider alert through its lifecycle: CLAIM → ESCALATE/RESOLVE,
    with manager-gated dismissal and reopening. Every transition is recorded
    in the immutable audit trail against the related case (if any).
    """
    action = body.action.strip().upper()
    cfg = _ALERT_ACTIONS.get(action)
    if not cfg:
        raise HTTPException(422, f"Invalid action '{body.action}'. Valid: {sorted(_ALERT_ACTIONS)}")

    from_statuses, to_status, audit_action, min_role = cfg
    user = _require_min_role(user, min_role)

    row = conn.execute("SELECT * FROM insider_alerts WHERE alert_id = ?", (alert_id,)).fetchone()
    if not row:
        raise HTTPException(404, f"Alert {alert_id} not found")
    alert = dict(row)

    if alert["status"] not in from_statuses:
        raise HTTPException(
            409,
            f"Cannot {action} an alert in status '{alert['status']}' (allowed from: {sorted(from_statuses)})",
        )

    conn.execute(
        "UPDATE insider_alerts SET status = ? WHERE alert_id = ?",
        (to_status, alert_id),
    )

    # Immutable audit trail — case-linked when the alert belongs to a case.
    log_audit(
        conn,
        case_id=alert.get("case_id") or "INSIDER-UNASSIGNED",
        action=audit_action,
        actor=f"{user.name} ({user.role})",
        details=(
            f"Insider alert {alert_id} [{alert['pattern_type']}] on employee "
            f"{alert['employee_id']}: {alert['status']} -> {to_status}."
            f"{(' Notes: ' + body.notes) if body.notes else ''}"
        ),
    )

    return {
        "alert_id": alert_id,
        "previous_status": alert["status"],
        "status": to_status,
        "action": action,
        "actor": user.name,
        "role": user.role,
        "case_id": alert.get("case_id"),
        "audited": True,
    }


@router.get("/alerts/{alert_id}/history")
async def alert_history(
    alert_id: str,
    conn: sqlite3.Connection = Depends(get_db),
    _: CurrentUser = Depends(current_user),
):
    """Immutable audit-trail history for one insider alert."""
    row = conn.execute("SELECT * FROM insider_alerts WHERE alert_id = ?", (alert_id,)).fetchone()
    if not row:
        raise HTTPException(404, f"Alert {alert_id} not found")
    events = [dict(r) for r in conn.execute(
        "SELECT action, actor, details, timestamp FROM audit_log "
        "WHERE details LIKE ? ORDER BY timestamp ASC",
        (f"%{alert_id}%",),
    ).fetchall()]
    return {"alert_id": alert_id, "events": events, "total": len(events)}


@router.get("/audit")
async def insider_audit_trail(
    limit: int = 200,
    conn: sqlite3.Connection = Depends(get_db),
    _: CurrentUser = Depends(current_user),
):
    """
    All insider lifecycle events from the immutable audit trail (system-wide).
    Includes ALERT_OPENED auto-entries from detection plus every CLAIM / ESCALATE /
    DISMISS / RESOLVE / REOPEN transition, newest first.
    """
    limit = max(1, min(limit, 500))
    rows = conn.execute(
        "SELECT log_id, case_id, action, actor, details, timestamp FROM audit_log "
        "WHERE action LIKE 'INSIDER\\_%' ESCAPE '\\' "
        "ORDER BY timestamp DESC, log_id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    events = [dict(r) for r in rows]
    return {"events": events, "total": len(events)}


@router.get("/case/{case_id}/summary")
async def case_insider_summary(
    case_id: str,
    conn: sqlite3.Connection = Depends(get_db),
    _: CurrentUser = Depends(current_user),
):
    """Insider correlation summary attached to a case (for evidence export)."""
    clean_id = case_id.strip().replace(" ", "-")
    alerts = _row_dicts(conn.execute(
        "SELECT * FROM insider_alerts WHERE case_id = ? OR case_id IS NULL ORDER BY severity DESC",
        (clean_id,),
    ).fetchall())
    for a in alerts:
        try:
            a["evidence"] = json.loads(a.get("evidence") or "[]")
        except Exception:
            a["evidence"] = []

    attributed = _row_dicts(conn.execute("""
        SELECT t.transaction_id, t.amount, t.channel, t.timestamp, t.processed_by,
               e.name AS employee_name, e.designation
        FROM transactions t
        LEFT JOIN employees e ON e.employee_id = t.processed_by
        WHERE t.case_id = ? AND t.processed_by IS NOT NULL
    """, (clean_id,)).fetchall())

    severities = [a["severity"] for a in alerts]
    return {
        "case_id": clean_id,
        "insider_alert_count": len(alerts),
        "max_severity": (
            "CRITICAL" if "CRITICAL" in severities
            else "HIGH" if "HIGH" in severities
            else "MEDIUM" if severities else "NONE"
        ),
        "alerts": alerts,
        "attributed_transactions": attributed,
    }
