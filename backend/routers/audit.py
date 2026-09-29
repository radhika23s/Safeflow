"""
Audit Router — /api/audit
==========================
Read-only audit trail. All actions are append-only.
Used for the Audit Log tab in the dashboard.
"""

import sqlite3
from fastapi import APIRouter, Depends
from database import get_db
from auth import current_user, CurrentUser

router = APIRouter(dependencies=[Depends(current_user)])


@router.get("/")
async def get_audit_log(
    case_id: str | None = None,
    limit: int = 100,
    conn: sqlite3.Connection = Depends(get_db),
    _: CurrentUser = Depends(current_user),
):
    """Get audit log entries, optionally filtered by case."""
    if case_id:
        clean_id = case_id.strip().replace(" ", "-")
        rows = conn.execute(
            "SELECT * FROM audit_log WHERE case_id = ? OR case_id = ? ORDER BY timestamp DESC LIMIT ?",
            (case_id, clean_id, limit)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?",
            (limit,)
        ).fetchall()

    return {"entries": [dict(r) for r in rows], "count": len(rows)}
