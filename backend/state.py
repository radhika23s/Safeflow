"""
state.py — Shared application state
=====================================
Holds the globally loaded ML model and metadata so that routers can
import app_state without creating a circular dependency with main.py.

Usage:
    from state import app_state
"""


class AppState:
    model = None
    metadata = None


app_state = AppState()
