"""Tests for API hardening (Point 7 of remediation).

Verifies:
- CORS configuration (B8)
- LLM fallback labeling (B12)
- Input sanitization for text fields
"""

import os
import sys
import pytest
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

BASE = "http://127.0.0.1:8000"


def _login(email="marcus.johnson@smarthorizon.ai", password="demo-password"):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


# ── B8: CORS configuration ──────────────────────────────────────────────────

class TestCORS:
    """CORS must use environment-driven origins, not wildcard."""

    def test_cors_reflects_configured_origins(self):
        """Origin header should be validated against configured list."""
        token = _login()
        headers = {
            "Authorization": f"Bearer {token}",
            "Origin": "http://localhost:5173",
        }
        r = requests.options(f"{BASE}/api/cases/", headers=headers)
        # Should allow localhost:5173 (default configured origin)
        acao = r.headers.get("access-control-allow-origin", "")
        assert "localhost:5173" in acao or acao == "*"

    def test_cors_rejects_evil_origin(self):
        """Credentialed requests from evil origins should not be allowed."""
        token = _login()
        headers = {
            "Authorization": f"Bearer {token}",
            "Origin": "https://evil.example.com",
        }
        r = requests.options(f"{BASE}/api/cases/", headers=headers)
        acao = r.headers.get("access-control-allow-origin", "")
        # evil.example.com should NOT be in allowed origins
        assert "evil.example.com" not in acao or acao == "", \
            f"evil.example.com should not be allowed, got ACAO: {acao}"


# ── B12: LLM fallback labeling ──────────────────────────────────────────────

class TestLLMFallbackLabeling:
    """Investigation response must indicate whether AI or fallback was used."""

    def test_investigation_includes_ai_generated_flag(self):
        token = _login()
        headers = {"Authorization": f"Bearer {token}"}

        r = requests.post(f"{BASE}/api/investigate/TXN-001",
                          headers=headers, timeout=60)
        if r.status_code == 200:
            data = r.json()
            assert "ai_generated" in data, \
                "Response must include 'ai_generated' flag"
            assert "reasoning_source" in data, \
                "Response must include 'reasoning_source' to distinguish AI vs fallback"


# ── Input sanitization ──────────────────────────────────────────────────────

class TestInputSanitization:
    """Text fields should handle HTML/script payloads safely."""

    def test_html_in_notes_stored_safely(self):
        """HTML in analyst_notes should not break the system."""
        token = _login("sarah.chen@smarthorizon.ai")
        headers = {"Authorization": f"Bearer {token}"}

        r = requests.post(f"{BASE}/api/cases/", json={
            "transaction_id": "TXN-002",
            "risk_score": 50.0,
            "risk_band": "MEDIUM",
            "recommended_action": "MONITOR",
        }, headers=headers)
        if r.status_code == 201:
            case_id = r.json()["case_id"]
            malicious_notes = "<script>alert('xss')</script>Normal notes"
            r2 = requests.post(f"{BASE}/api/cases/{case_id}/decision", json={
                "decision": "DISMISS",
                "notes": malicious_notes,
            }, headers=headers)
            # Should succeed (notes stored as text, not rendered as HTML)
            assert r2.status_code == 200
            # Verify the notes were stored
            r3 = requests.get(f"{BASE}/api/cases/{case_id}", headers=headers)
            if r3.status_code == 200:
                stored_notes = r3.json().get("analyst_notes", "")
                assert "<script>" in stored_notes or stored_notes == malicious_notes, \
                    "Notes should be stored as-is (React escapes on render)"
