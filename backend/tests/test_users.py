"""Tests for user management endpoints (/api/users)."""

import os
import sys
import pytest
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

BASE = "http://127.0.0.1:8000"


def _login(email="admin@smarthorizon.ai", password="demo-password"):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _auth_header(token):
    return {"Authorization": f"Bearer {token}"}


class TestUserManagement:
    def test_list_users_unauthenticated(self):
        r = requests.get(f"{BASE}/api/users/")
        assert r.status_code == 401

    def test_investigator_cannot_list_users(self):
        token = _login(email="marcus.johnson@smarthorizon.ai")
        r = requests.get(f"{BASE}/api/users/", headers=_auth_header(token))
        assert r.status_code == 403

    def test_admin_can_list_users(self):
        token = _login(email="admin@smarthorizon.ai")
        r = requests.get(f"{BASE}/api/users/", headers=_auth_header(token))
        assert r.status_code == 200
        data = r.json()
        assert "users" in data
        assert any(u["email"] == "admin@smarthorizon.ai" for u in data["users"])

    def test_admin_can_create_user(self):
        import uuid
        token = _login(email="admin@smarthorizon.ai")
        test_email = f"test.{uuid.uuid4().hex[:6]}@smarthorizon.ai"
        r = requests.post(
            f"{BASE}/api/users/",
            headers=_auth_header(token),
            json={
                "name": "Test Investigator",
                "email": test_email,
                "role": "investigator",
                "password": "demo-password",
            },
        )
        assert r.status_code == 201

        # Verify the new user can log in
        new_token = _login(email=test_email, password="demo-password")
        assert new_token is not None

    def test_investigator_cannot_create_user(self):
        token = _login(email="marcus.johnson@smarthorizon.ai")
        r = requests.post(
            f"{BASE}/api/users/",
            headers=_auth_header(token),
            json={
                "name": "Hacker Agent",
                "email": "hacker@smarthorizon.ai",
                "role": "administrator",
                "password": "demo-password",
            },
        )
        assert r.status_code == 403
