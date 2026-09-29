"""
Ingest Router — /api/ingest
============================
Webhook receiver from the Node.js ledger.

Flow:
  Ledger commits transfer → fires POST /api/ingest-transaction
  → idempotency check → feature build → XGBoost score
  → persist transaction → if CRITICAL/HIGH, auto-create case
  → audit log entry → return result

Design principle: ledger correctness NEVER depends on this service.
The ledger fires and forgets — a timeout or error here must NOT roll back money.
"""

import uuid
import sqlite3
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import get_db, log_audit
from auth import current_user
from routers.score import score_transaction
from state import app_state

# Ingest is system-to-system; authenticated by a shared secret header
# For the demo we accept any caller on localhost (CORS already restricts origin).
# In production: use HMAC-SHA256 webhook signature verification.
router = APIRouter()

THRESHOLD_HIGH = 65.0      # risk_score >= this → create case (CRITICAL & HIGH only)
THRESHOLD_CRITICAL = 85.0  # risk_score >= this → CRITICAL band


class IncomingTransaction(BaseModel):
    """Payload sent by the Node.js ledger after a successful commit."""
    transaction_id: str = Field(min_length=1, max_length=256)
    sender_account_id: str
    receiver_account_id: str
    amount: float = Field(ge=0)
    currency: str = "INR"
    channel: str = "IMPS"         # UPI | IMPS | NEFT | RTGS
    timestamp: str                 # ISO-8601 from ledger createdAt
    idempotency_key: str
    # Optional enrichment — ledger may not have balance data
    sender_balance_before: Optional[float] = 0.0
    sender_balance_after: Optional[float] = 0.0
    receiver_balance_before: Optional[float] = 0.0
    receiver_balance_after: Optional[float] = 0.0


def _already_processed(idempotency_key: str, conn: sqlite3.Connection) -> bool:
    """Returns True if we've already handled this idempotency key."""
    row = conn.execute(
        "SELECT 1 FROM transactions WHERE transaction_id = ?",
        (idempotency_key,)
    ).fetchone()
    return row is not None


def _derive_step(timestamp_str: str) -> int:
    """
    Convert ISO-8601 timestamp to a PaySim-compatible 'step' (hour index).
    PaySim step = hours elapsed; we use total hours since epoch mod 744 (31 days).
    """
    try:
        dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
        hours = int((dt - epoch).total_seconds() / 3600)
        return hours % 744
    except Exception:
        return 1  # safe default


def _build_score_input(txn: IncomingTransaction) -> dict:
    """
    Map ledger transaction fields to the format expected by score_transaction().
    Uses safe defaults for fields the ledger doesn't know (balance data).
    Uses `is not None` (not `or`) so legitimate 0-balance values are preserved.
    """
    step = _derive_step(txn.timestamp)
    return {
        "transaction_id": txn.transaction_id,
        "step": step,
        "type": "TRANSFER",          # ledger transactions are all transfers
        "amount": txn.amount,
        "nameOrig": txn.sender_account_id,
        "oldbalanceOrg": txn.sender_balance_before if txn.sender_balance_before is not None else 0.0,
        "newbalanceOrig": txn.sender_balance_after if txn.sender_balance_after is not None else 0.0,
        "nameDest": txn.receiver_account_id,
        "oldbalanceDest": txn.receiver_balance_before if txn.receiver_balance_before is not None else 0.0,
        "newbalanceDest": txn.receiver_balance_after if txn.receiver_balance_after is not None else 0.0,
        "is_new_payee": False,
        "is_vpn": False,
        "location_city": "Unknown",
        "device_id": None,
        "ip_address": None,
        "scenario_type": "LIVE",
        "fraud_reason": None,
    }


def _insert_transaction(txn: IncomingTransaction, score: dict, conn: sqlite3.Connection):
    """Persist the transaction to SQLite transactions table."""
    now = datetime.utcnow().isoformat()
    conn.execute(
        """
        INSERT OR IGNORE INTO transactions (
            transaction_id, sender_id, sender_account, receiver_id, receiver_account,
            amount, channel, step, type,
            old_balance_orig, new_balance_orig,
            old_balance_dest, new_balance_dest,
            timestamp, is_fraud, alert_triggered, scenario_type, severity
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            txn.transaction_id,
            txn.sender_account_id,   # use account id as sender_id for live txns
            txn.sender_account_id,
            txn.receiver_account_id,
            txn.receiver_account_id,
            txn.amount,
            txn.channel,
            _derive_step(txn.timestamp),
            "TRANSFER",
            txn.sender_balance_before or 0.0,
            txn.sender_balance_after or 0.0,
            txn.receiver_balance_before or 0.0,
            txn.receiver_balance_after or 0.0,
            txn.timestamp,
            0,      # is_fraud: unknown at ingest time (model will score it)
            1 if score["risk_score"] >= THRESHOLD_HIGH else 0,
            "LIVE",
            score["risk_band"],
        )
    )
    conn.commit()


def _create_case(txn: IncomingTransaction, score: dict, conn: sqlite3.Connection) -> str:
    """
    Create an investigation case — exact same path as seed data case creation.
    Returns the new case_id.
    """
    case_id = f"FC-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    now = datetime.utcnow().isoformat()

    conn.execute(
        """
        INSERT INTO cases (
            case_id, transaction_id, status, risk_score, risk_band,
            recommended_action, opened_at, updated_at
        ) VALUES (?, ?, 'OPEN', ?, ?, ?, ?, ?)
        """,
        (
            case_id,
            txn.transaction_id,
            score["risk_score"],
            score["risk_band"],
            score["recommended_action"],
            now,
            now,
        )
    )
    conn.commit()

    # Immutable audit entry
    log_audit(
        conn,
        case_id=case_id,
        action="CASE_AUTO_CREATED",
        actor="SYSTEM:ingest",
        details=(
            f"Live transaction ingested from ledger. "
            f"Amount: {txn.amount} {txn.currency}. "
            f"Risk: {score['risk_score']:.1f} ({score['risk_band']}). "
            f"Channel: {txn.channel}. "
            f"Recommended: {score['recommended_action']}."
        ),
    )

    return case_id


@router.post("/ingest-transaction")
async def ingest_transaction(
    txn: IncomingTransaction,
    conn: sqlite3.Connection = Depends(get_db),
):
    """
    Webhook endpoint called by the Node.js ledger after a successful commit.
    Never returns an error that would cause the ledger to retry a duplicate.
    """
    # 1. Idempotency — safe to call twice
    if _already_processed(txn.idempotency_key, conn):
        print(f"[INGEST] Duplicate ignored: {txn.idempotency_key}")
        return {"status": "duplicate_ignored", "idempotency_key": txn.idempotency_key}

    # 2. Score the transaction
    if app_state.model is None:
        # Model not loaded — persist the transaction but don't score/case
        print(f"[INGEST WARNING] Model not loaded, skipping score for {txn.transaction_id}")
        return {"status": "model_unavailable", "transaction_id": txn.transaction_id}

    score_input = _build_score_input(txn)
    try:
        score = score_transaction(score_input)
    except Exception as e:
        print(f"[INGEST ERROR] Scoring failed for {txn.transaction_id}: {e}")
        return {"status": "score_error", "error": str(e), "transaction_id": txn.transaction_id}

    print(
        f"[INGEST] {txn.transaction_id} | "
        f"₹{txn.amount:,.0f} | "
        f"Score: {score['risk_score']:.1f} | "
        f"Band: {score['risk_band']} | "
        f"Channel: {txn.channel}"
    )

    # 3. Persist the transaction
    try:
        _insert_transaction(txn, score, conn)
    except Exception as e:
        print(f"[INGEST ERROR] DB insert failed: {e}")
        return {"status": "db_error", "error": str(e)}

    # 4. Auto-create case if risk is HIGH or CRITICAL
    if score["risk_score"] >= THRESHOLD_HIGH:
        try:
            case_id = _create_case(txn, score, conn)
            print(f"[INGEST] Case created: {case_id} for transaction {txn.transaction_id}")
            return {
                "status": "case_created",
                "case_id": case_id,
                "risk_score": score["risk_score"],
                "risk_band": score["risk_band"],
                "recommended_action": score["recommended_action"],
                "transaction_id": txn.transaction_id,
            }
        except Exception as e:
            print(f"[INGEST ERROR] Case creation failed: {e}")
            return {
                "status": "scored_case_error",
                "risk_score": score["risk_score"],
                "error": str(e),
            }

    return {
        "status": "scored_no_case",
        "risk_score": score["risk_score"],
        "risk_band": score["risk_band"],
        "transaction_id": txn.transaction_id,
    }
