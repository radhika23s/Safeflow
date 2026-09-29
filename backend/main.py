"""
Horizon -- FastAPI Backend
=========================
Main application entry point.
Loads the fraud model at startup and registers all agent routers.
"""

import os
import pickle
import json
from dotenv import load_dotenv

load_dotenv(override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from auth import LoginRequest, authenticate

# Ensure database tables exist
init_db()

from state import app_state

# Load model and metadata at startup
MODEL_PATH = "fraud_model.pkl"
META_PATH = "model_metadata.json"

if os.path.exists(MODEL_PATH):
    try:
        with open(MODEL_PATH, "rb") as f:
            app_state.model = pickle.load(f)
        print(f"[STARTUP] Loaded fraud model: {MODEL_PATH}")
    except Exception as e:
        print(f"[STARTUP ERROR] Model loading failed: {e}")

if os.path.exists(META_PATH):
    try:
        with open(META_PATH, "r") as f:
            app_state.metadata = json.load(f)
        print(f"[STARTUP] Loaded metadata: {META_PATH}")
    except Exception as e:
        print(f"[STARTUP ERROR] Metadata loading failed: {e}")

# FastAPI App
app = FastAPI(
    title="Horizon - Financial Crime Investigation API",
    description="Autonomous multi-agent financial crime investigation system. AI recommends, human decides.",
    version="2.0.0",
)

# CORS — explicitly allow all local frontend ports
cors_origins = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]
_cors_raw = os.getenv("CORS_ORIGINS", "")
for origin in _cors_raw.split(","):
    cleaned = origin.strip()
    if cleaned and cleaned != "*" and cleaned not in cors_origins:
        cors_origins.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from routers import cases, score, graph, investigate, reports, audit, users
from routers import ingest, simulator, insider

@app.post("/api/auth/login")
def login(body: LoginRequest):
    return authenticate(body)

app.include_router(cases.router, prefix="/api/cases", tags=["Cases"])
app.include_router(score.router, prefix="/api/score", tags=["Score Agent"])
app.include_router(graph.router, prefix="/api/graph", tags=["Graph Agent"])
app.include_router(investigate.router, prefix="/api/investigate", tags=["Investigation"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(ingest.router, prefix="/api", tags=["Ledger Ingest"])
app.include_router(simulator.router, prefix="/api/simulator", tags=["Banking Simulator"])
app.include_router(insider.router, prefix="/api/insider", tags=["Insider Risk"])

@app.get("/")
def root():
    return {
        "service": "Horizon Investigation API",
        "status": "online",
        "model_loaded": app_state.model is not None,
        "insider_risk_enabled": True,
        "version": "2.1.0",
    }

@app.get("/health")
def health():
    """Health endpoint for the Integrations status page."""
    import httpx
    ledger_url = os.getenv("LEDGER_URL", "http://localhost:3000")
    ledger_status = "unknown"
    ledger_latency_ms = None
    try:
        import time
        t0 = time.time()
        r = httpx.get(f"{ledger_url}/", timeout=2.0)
        ledger_latency_ms = round((time.time() - t0) * 1000)
        ledger_status = "online" if r.status_code < 500 else "degraded"
    except Exception:
        ledger_status = "offline"

    return {
        "status": "ok",
        "model": "loaded" if app_state.model is not None else "not_loaded",
        "version": "2.0.0",
        "ledger": {
            "status": ledger_status,
            "url": ledger_url,
            "latency_ms": ledger_latency_ms,
        },
    }
