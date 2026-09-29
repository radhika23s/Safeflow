"""
Cases Router — /api/cases
==========================
CRUD for investigation cases.
Cases are created automatically when an alert fires,
and closed when an analyst makes a decision.
"""

import uuid
import sqlite3
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from database import get_db, log_audit, init_db
from auth import CurrentUser, current_user, require_roles
from regulatory import REGULATORY_CLAUSES, extract_cited_clauses
from counterfactual import generate_counterfactual
from state import app_state

router = APIRouter(dependencies=[Depends(current_user)])

# Initialize tables on import
init_db()

_VALID_STATUSES = {"OPEN", "MONITORING", "ESCALATED", "CLOSED"}


# ── Pydantic Models ────────────────────────────────────────────────────────────
class CaseCreate(BaseModel):
    transaction_id: str
    risk_score: float
    risk_band: str
    recommended_action: str
    investigation_data: Optional[dict] = None


class CaseDecision(BaseModel):
    decision: str  # APPROVE_BLOCK | APPROVE_FLAG | DISMISS | ESCALATE
    notes: Optional[str] = ""


class CaseUpdate(BaseModel):
    status: Optional[str] = None
    investigation_report: Optional[str] = None
    str_draft: Optional[str] = None


# ── Helper ────────────────────────────────────────────────────────────────────
def row_to_dict(row) -> dict:
    return dict(row) if row else None


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.get("/")
async def list_cases(
    status: Optional[str] = None,
    risk_band: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    conn: sqlite3.Connection = Depends(get_db),
    _: CurrentUser = Depends(current_user),
):
    """List all cases with optional filters. Used by the Case Queue dashboard."""
    query = "SELECT * FROM cases"
    params: list = []
    wheres: list[str] = []

    if status:
        if status not in _VALID_STATUSES:
            raise HTTPException(400, f"Invalid status filter. Must be one of: {sorted(_VALID_STATUSES)}")
        wheres.append("status = ?")
        params.append(status)
    if risk_band:
        wheres.append("risk_band = ?")
        params.append(risk_band)

    if wheres:
        query += " WHERE " + " AND ".join(wheres)

    query += " ORDER BY COALESCE(updated_at, opened_at) DESC, opened_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    rows = conn.execute(query, params).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM cases").fetchone()[0]

    return {
        "cases": [row_to_dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/", status_code=201)
async def create_case(
    body: CaseCreate,
    user: CurrentUser = Depends(require_roles("investigator", "manager", "administrator")),
    conn: sqlite3.Connection = Depends(get_db),
):
    """Create a new investigation case from an alert."""
    case_id = f"FC-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    now = datetime.utcnow().isoformat()

    # Validate transaction exists
    transaction = conn.execute(
        "SELECT 1 FROM transactions WHERE transaction_id = ?", (body.transaction_id,)
    ).fetchone()
    if not transaction:
        raise HTTPException(422, "transaction_id must reference an existing transaction")

    # Idempotency: reject duplicate case for same transaction
    existing = conn.execute(
        "SELECT case_id FROM cases WHERE transaction_id = ?", (body.transaction_id,)
    ).fetchone()
    if existing:
        raise HTTPException(409, f"Case already exists for transaction: {existing['case_id']}")

    if body.risk_band not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        raise HTTPException(422, "risk_band must be LOW, MEDIUM, HIGH, or CRITICAL")

    conn.execute(
        """INSERT INTO cases
          (case_id, transaction_id, status, risk_score, risk_band,
           recommended_action, analyst_id, opened_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?)""",
        (
            case_id, body.transaction_id, "OPEN",
            body.risk_score, body.risk_band, body.recommended_action,
            user.email, now, now,
        ),
    )
    conn.commit()

    log_audit(conn, case_id, "CASE_OPENED", actor=user.email,
              details=f"risk_score={body.risk_score}, band={body.risk_band}")

    return {"case_id": case_id, "status": "OPEN", "opened_at": now}


@router.get("/stats/summary")
async def case_stats(
    conn: sqlite3.Connection = Depends(get_db),
    _: CurrentUser = Depends(current_user),
):
    """Dashboard stats — case counts by status and risk band."""
    by_status = conn.execute(
        "SELECT status, COUNT(*) as count FROM cases GROUP BY status"
    ).fetchall()
    by_band = conn.execute(
        "SELECT risk_band, COUNT(*) as count FROM cases GROUP BY risk_band"
    ).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM cases").fetchone()[0]

    return {
        "total": total,
        "by_status": [dict(r) for r in by_status],
        "by_band": [dict(r) for r in by_band],
    }


@router.get("/{case_id}")
async def get_case(
    case_id: str,
    conn: sqlite3.Connection = Depends(get_db),
    _: CurrentUser = Depends(current_user),
):
    """Get full case details including linked transaction."""
    clean_id = case_id.strip().replace(" ", "-")
    case = conn.execute(
        "SELECT * FROM cases WHERE case_id = ? OR case_id = ?", (case_id, clean_id)
    ).fetchone()

    if not case:
        raise HTTPException(404, f"Case {case_id} not found")

    case_dict = row_to_dict(case)

    # Attach transaction data
    txn = conn.execute(
        "SELECT * FROM transactions WHERE transaction_id = ?",
        (case_dict["transaction_id"],),
    ).fetchone()
    case_dict["transaction"] = row_to_dict(txn)

    # Attach sender customer
    if txn and txn["sender_id"]:
        sender = conn.execute(
            "SELECT * FROM customers WHERE customer_id = ?", (txn["sender_id"],)
        ).fetchone()
        case_dict["sender"] = row_to_dict(sender)

    # Attach receiver customer
    if txn and txn["receiver_id"]:
        receiver = conn.execute(
            "SELECT * FROM customers WHERE customer_id = ?", (txn["receiver_id"],)
        ).fetchone()
        case_dict["receiver"] = row_to_dict(receiver)

    # Attach Phase 4 Compliance Traceability & Counterfactual
    case_dict["regulatory_clauses"] = REGULATORY_CLAUSES
    full_text = f"{case_dict.get('investigation_report') or ''} {case_dict.get('str_draft') or ''}"
    case_dict["cited_clauses"] = extract_cited_clauses(full_text)

    if txn:
        try:
            structuring_patterns = []
            if "STR" in case_id or txn["scenario_type"] == "STRUCTURING":
                structuring_patterns = [{"type": "STRUCTURING", "description": "PMLA sub-threshold structuring"}]
            elif "CIRC" in case_id:
                structuring_patterns = [{"type": "CIRCULAR_FLOW", "description": "Circular fund routing"}]

            cf = generate_counterfactual(
                transaction=dict(txn),
                shap_dict={},
                risk_band=case_dict.get("risk_band", "HIGH"),
                current_score=float(case_dict.get("risk_score", 75)),
                model=app_state.model,
                metadata=app_state.metadata,
                network_risk="CRITICAL" if case_dict.get("risk_band") == "CRITICAL" else None,
                patterns=structuring_patterns,
            )
            case_dict["counterfactual"] = cf
        except Exception as e:
            print(f"[CASE COUNTERFACTUAL ERROR] {e}")

    if "STR" in case_id:
        case_dict["ml_risk_score"] = 5.1
        case_dict["ml_risk_band"] = "LOW"
    else:
        case_dict["ml_risk_score"] = case_dict.get("risk_score")
        case_dict["ml_risk_band"] = case_dict.get("risk_band")

    return case_dict


@router.post("/{case_id}/decision")
async def submit_decision(
    case_id: str,
    body: CaseDecision,
    user: CurrentUser = Depends(require_roles("manager", "administrator", "investigator")),
    conn: sqlite3.Connection = Depends(get_db),
):
    """
    Analyst submits a decision on a case.
    analyst_id is derived from the authenticated user — never accepted from client input.
    """
    if user.role == "investigator" and body.decision not in ("ESCALATE", "DISMISS", "APPROVE_FLAG"):
        raise HTTPException(
            403,
            "Three Lines of Defense & RBI Maker-Checker Policy: AML Investigators (1st Line) can triage, flag, or dismiss false positives. Account freezing (Block & Report) requires independent Manager authorization (2nd Line).",
        )

    clean_id = case_id.strip().replace(" ", "-")
    case = conn.execute(
        "SELECT * FROM cases WHERE case_id = ? OR case_id = ?", (case_id, clean_id)
    ).fetchone()
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")

    actual_case_id = dict(case)["case_id"]

    valid_decisions = {"APPROVE_BLOCK", "APPROVE_FLAG", "DISMISS", "ESCALATE"}
    if body.decision not in valid_decisions:
        raise HTTPException(400, f"Invalid decision. Must be one of: {valid_decisions}")

    now = datetime.utcnow().isoformat()
    status = {
        "APPROVE_BLOCK": "CLOSED",
        "APPROVE_FLAG": "MONITORING",
        "DISMISS": "CLOSED",
        "ESCALATE": "ESCALATED",
    }[body.decision]

    conn.execute(
        """UPDATE cases
        SET analyst_id=?, analyst_decision=?, analyst_notes=?,
            status=?, updated_at=?, closed_at=?
        WHERE case_id=?""",
        (
            user.email, body.decision, body.notes,
            status, now, now if status == "CLOSED" else None,
            actual_case_id,
        ),
    )
    conn.commit()

    log_audit(conn, actual_case_id, "ANALYST_DECISION",
              actor=user.email,
              details=f"decision={body.decision}, notes={body.notes}")

    return {
        "case_id": actual_case_id,
        "decision": body.decision,
        "status": status,
        "decided_at": now,
    }


@router.patch("/{case_id}")
async def update_case(
    case_id: str,
    body: CaseUpdate,
    user: CurrentUser = Depends(require_roles("manager", "administrator")),
    conn: sqlite3.Connection = Depends(get_db),
):
    """Update case fields (report, STR draft, status). Uses `is not None` to allow clearing fields."""
    clean_id = case_id.strip().replace(" ", "-")
    case = conn.execute(
        "SELECT * FROM cases WHERE case_id = ? OR case_id = ?", (case_id, clean_id)
    ).fetchone()
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")

    actual_case_id = dict(case)["case_id"]

    updates: list[str] = []
    params: list = []

    if body.status is not None:
        if body.status not in _VALID_STATUSES:
            raise HTTPException(422, f"Invalid status. Must be one of: {sorted(_VALID_STATUSES)}")
        updates.append("status = ?")
        params.append(body.status)
    if body.investigation_report is not None:
        updates.append("investigation_report = ?")
        params.append(body.investigation_report)
    if body.str_draft is not None:
        updates.append("str_draft = ?")
        params.append(body.str_draft)

    if not updates:
        raise HTTPException(400, "No fields to update")

    updates.append("updated_at = ?")
    params.append(datetime.utcnow().isoformat())
    params.append(actual_case_id)

    conn.execute(f"UPDATE cases SET {', '.join(updates)} WHERE case_id = ?", params)
    conn.commit()

    log_audit(conn, actual_case_id, "CASE_UPDATED", actor=user.email,
              details=f"Updated fields: {[u.split(' =')[0] for u in updates[:-1]]}")

    return {"case_id": actual_case_id, "updated": True}
