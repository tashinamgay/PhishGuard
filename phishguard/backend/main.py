# =============================================================================
# main.py — FastAPI Application Entry Point
# =============================================================================
# Run: uvicorn main:app --reload --port 8000
# =============================================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.database import create_tables
from routers import predict, stats, auth, admin, researcher

app = FastAPI(
    title       = "PhishGuard API",
    version     = "3.0.0",
    description = "LLM-Assisted Phishing Detection Platform with Role-Based Access"
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:5173", "http://localhost:3000"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    create_tables()
    print("[APP] PhishGuard API v3.0 started successfully")

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,        prefix="/api/auth",     tags=["Authentication"])
app.include_router(predict.router,     prefix="/api",          tags=["Prediction"])
app.include_router(admin.router,       prefix="/api/admin",    tags=["Admin"])
app.include_router(stats.router,       prefix="/api",          tags=["Stats"])
app.include_router(researcher.router,  prefix="/api/research", tags=["Researcher"])

# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"status": "ok", "message": "PhishGuard API v3.0 is running", "docs": "/docs"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
