"""
RevOS Backend — FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from models.database import init_db
from routers import ingest, accounts, analyze, signals, enrich, modeling

app = FastAPI(
    title="RevOS API",
    description="Multi-model AI orchestration platform for B2B sales",
    version="1.0.0",
)

# CORS for frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ingest.router)
app.include_router(accounts.router)
app.include_router(analyze.router)
app.include_router(signals.router)
app.include_router(enrich.router)
app.include_router(modeling.router)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/dashboard")
def dashboard():
    """Return everything needed for the frontend — delegates to accounts list."""
    from routers.accounts import list_accounts
    from models.database import SessionLocal
    db = SessionLocal()
    try:
        return {"accounts": list_accounts(db)}
    finally:
        db.close()


@app.get("/")
def root():
    return {"name": "RevOS API", "version": "1.0.0", "status": "running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
