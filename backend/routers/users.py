"""
Users Router — /api/users
=========================
Role-based user management for administrators and compliance managers.
Allows administrators to create investigators/managers and manage active status.
"""

import hashlib
import sqlite3
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from database import get_db, log_audit
from auth import CurrentUser, current_user, require_roles

router = APIRouter(dependencies=[Depends(current_user)])


def _hash_pwd(pwd: str) -> str:
    return hashlib.sha256(("safeflow:" + pwd).encode()).hexdigest()


class CreateUserRequest(BaseModel):
    name: str
    email: str
    role: str
    password: Optional[str] = "demo-password"


class UpdateUserStatusRequest(BaseModel):
    status: str


@router.get("/")
async def list_users(
    conn: sqlite3.Connection = Depends(get_db),
    user: CurrentUser = Depends(require_roles("administrator", "manager")),
):
    """List all registered platform users."""
    rows = conn.execute(
        "SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at ASC"
    ).fetchall()

    users = []
    for r in rows:
        u_dict = dict(r)
        u_dict["lastActive"] = "Active today"
        users.append(u_dict)

    return {"users": users, "count": len(users)}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserRequest,
    conn: sqlite3.Connection = Depends(get_db),
    user: CurrentUser = Depends(require_roles("administrator")),
):
    """
    Administrator creates a new platform user with designated role.
    Only administrators hold user provisioning authority.
    """
    valid_roles = {"investigator", "manager", "administrator"}
    if body.role.lower() not in valid_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role '{body.role}'. Must be one of: {valid_roles}",
        )

    # Check for duplicate email
    existing = conn.execute(
        "SELECT id FROM users WHERE email = ?", (body.email.lower().strip(),)
    ).fetchone()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"User with email '{body.email}' already exists.",
        )

    user_id = f"usr-{uuid.uuid4().hex[:8]}"
    pwd_hash = _hash_pwd(body.password or "demo-password")
    now_iso = datetime.utcnow().isoformat()
    clean_email = body.email.lower().strip()
    clean_role = body.role.lower().strip()

    conn.execute(
        """
        INSERT INTO users (id, name, email, password_hash, role, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'Active', ?)
        """,
        (user_id, body.name.strip(), clean_email, pwd_hash, clean_role, now_iso),
    )
    conn.commit()

    log_audit(
        conn,
        case_id="SYSTEM",
        action="USER_CREATED",
        actor=user.email,
        details=f"Created user {body.name} ({clean_email}) as {clean_role}",
    )

    return {
        "id": user_id,
        "name": body.name.strip(),
        "email": clean_email,
        "role": clean_role,
        "status": "Active",
        "created_at": now_iso,
    }


@router.patch("/{user_id}/status")
async def update_user_status(
    user_id: str,
    body: UpdateUserStatusRequest,
    conn: sqlite3.Connection = Depends(get_db),
    user: CurrentUser = Depends(require_roles("administrator")),
):
    """Toggle or update user activation status."""
    if body.status not in {"Active", "Inactive"}:
        raise HTTPException(status_code=400, detail="Status must be 'Active' or 'Inactive'")

    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    conn.execute("UPDATE users SET status = ? WHERE id = ?", (body.status, user_id))
    conn.commit()

    log_audit(
        conn,
        case_id="SYSTEM",
        action="USER_STATUS_UPDATED",
        actor=user.email,
        details=f"Updated status for {row['email']} to {body.status}",
    )

    return {"id": user_id, "status": body.status}
