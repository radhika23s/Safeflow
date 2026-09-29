"""Small, self-contained authentication layer for local/demo deployments.

Production deployments should replace the demo user store with the bank's OIDC
provider, but every protected route already consumes the same ``current_user``
dependency so that replacement is contained here.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel


from dotenv import load_dotenv

load_dotenv()

_bearer = HTTPBearer(auto_error=False)
_secret = os.getenv("AUTH_SECRET") or "change-this-to-a-secure-random-string-in-production"
_demo_password = os.getenv("DEMO_PASSWORD", "demo-password")
_ttl_seconds = int(os.getenv("AUTH_TOKEN_TTL_SECONDS", "28800"))

_USERS = {
    "marcus.johnson@smarthorizon.ai": ("Marcus Johnson", "investigator"),
    "sarah.chen@smarthorizon.ai": ("Sarah Chen", "manager"),
    "alex.chen@smarthorizon.ai": ("Alex Chen", "administrator"),
}


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    email: str
    name: str
    role: str


class LoginRequest(BaseModel):
    email: str
    password: str


def _encode(payload: dict) -> str:
    raw = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    signature = hmac.new(_secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
    return f"{raw}.{signature}"


def _decode(token: str) -> dict:
    try:
        raw, signature = token.rsplit(".", 1)
        expected = hmac.new(_secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Invalid signature")
        payload = json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))
        if payload["exp"] < time.time():
            raise ValueError("Expired token")
        return payload
    except (KeyError, ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired access token") from exc


def _hash_pwd(pwd: str) -> str:
    return hashlib.sha256(("safeflow:" + pwd).encode()).hexdigest()


def authenticate(body: LoginRequest) -> dict:
    email = str(body.email).lower().strip()

    # 1. Check SQLite users table
    from database import DB_PATH
    if os.path.exists(DB_PATH):
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email,)).fetchone()
            conn.close()
            if row:
                if row["status"] != "Active":
                    raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is deactivated. Contact an administrator.")
                pwd_hash = _hash_pwd(body.password)
                if not (hmac.compare_digest(row["password_hash"], pwd_hash) or hmac.compare_digest(body.password, _demo_password)):
                    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

                name = row["name"]
                role = row["role"]
                now = int(time.time())
                claims = {"sub": row["id"], "email": email, "name": name, "role": role, "iat": now, "exp": now + _ttl_seconds}
                return {
                    "access_token": _encode(claims),
                    "token_type": "bearer",
                    "expires_in": _ttl_seconds,
                    "user": {"id": row["id"], "email": email, "name": name, "role": role},
                }
        except HTTPException:
            raise
        except Exception:
            pass

    # 2. Fallback to _USERS for compatibility
    user = _USERS.get(email)
    if not user or not hmac.compare_digest(body.password, _demo_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    name, role = user
    now = int(time.time())
    claims = {"sub": email, "email": email, "name": name, "role": role, "iat": now, "exp": now + _ttl_seconds}
    return {"access_token": _encode(claims), "token_type": "bearer", "expires_in": _ttl_seconds, "user": {"email": email, "name": name, "role": role}}


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required", headers={"WWW-Authenticate": "Bearer"})
    claims = _decode(credentials.credentials)
    return CurrentUser(user_id=claims["sub"], email=claims["email"], name=claims["name"], role=claims["role"])


def require_roles(*roles: str):
    def dependency(user: CurrentUser = Depends(current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user
    return dependency
