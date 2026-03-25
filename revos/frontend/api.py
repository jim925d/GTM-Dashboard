"""
RevOS Engine API
FastAPI server serving predictions, strategies, and calibration data.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging
import os

from .main import RevOSEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="RevOS Prediction & Recommendation Engine",
    version="0.1.0",
    description="Self-calibrating Bayesian engine for B2B sales intelligence",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Engine instance
# ---------------------------------------------------------------------------

DATA_DIR = os.getenv("REVOS_DATA_DIR", "data")
MODEL_DIR = os.getenv("REVOS_MODEL_DIR", "models")

engine = RevOSEngine(data_dir=DATA_DIR, model_dir=MODEL_DIR)

# Track whether engine is initialized
_initialized = False


# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------

class LoadRequest(BaseModel):
    files: Optional[dict[str, str]] = None  # {table: filepath}


class OutcomeRequest(BaseModel):
    deal_id: str
    outcome: str  # "won" or "lost"
    close_date: Optional[str] = None


class RecTrackRequest(BaseModel):
    deal_id: str
    domain: str  # "pricing", "product", "engagement"
    followed: bool
    outcome: Optional[str] = None  # "won" or "lost"


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

@app.post("/api/engine/load")
async def load_data(req: LoadRequest):
    """Load CSV/Excel data files."""
    global _initialized
    try:
        summary = engine.load_data(req.files)
        _initialized = True
        return {"status": "loaded", "summary": summary}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/engine/train")
async def train():
    """Train the prediction and recommendation engines."""
    if not _initialized:
        raise HTTPException(400, "Load data first via POST /api/engine/load")
    try:
        summary = engine.train(save=True)
        return {"status": "trained", "summary": summary}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/engine/load-and-train")
async def load_and_train(req: LoadRequest):
    """Load data and train in one call."""
    global _initialized
    try:
        load_summary = engine.load_data(req.files)
        _initialized = True
        train_summary = engine.train(save=True)
        return {
            "status": "ready",
            "data": load_summary,
            "model": train_summary,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------------------------------------------------------------------------
# Predictions
# ---------------------------------------------------------------------------

@app.get("/api/predictions")
async def get_all_predictions():
    """Score all open deals and return predictions."""
    _check_trained()
    predictions = engine.score_all_deals()
    return {"deals": predictions, "count": len(predictions)}


@app.get("/api/predictions/{deal_id}")
async def get_prediction(deal_id: str):
    """Get prediction for a single deal."""
    _check_trained()
    result = engine.score_deal(deal_id)
    if not result:
        raise HTTPException(404, f"Deal {deal_id} not found in open pipeline")
    return result


# ---------------------------------------------------------------------------
# Strategies (prediction + recommendations combined)
# ---------------------------------------------------------------------------

@app.get("/api/strategies")
async def get_all_strategies():
    """Get full Deal Strategy Cards for all open deals."""
    _check_trained()
    strategies = engine.get_all_strategies()
    return {"deals": strategies, "count": len(strategies)}


@app.get("/api/strategies/{deal_id}")
async def get_strategy(deal_id: str):
    """Get full Deal Strategy Card for a single deal."""
    _check_trained()
    result = engine.get_deal_strategy(deal_id)
    if not result:
        raise HTTPException(404, f"Deal {deal_id} not found")
    return result


# ---------------------------------------------------------------------------
# Calibration
# ---------------------------------------------------------------------------

@app.get("/api/calibration")
async def get_calibration():
    """Get full calibration dashboard data."""
    _check_trained()
    return engine.get_calibration_report()


@app.post("/api/calibration/check-retrain")
async def check_retrain():
    """Check if retraining is needed and do it if so."""
    _check_trained()
    result = engine.check_and_retrain()
    return result


@app.post("/api/calibration/outcome")
async def record_outcome(req: OutcomeRequest):
    """Record a deal outcome for calibration tracking."""
    engine.calibrator.record_outcome(
        req.deal_id, req.outcome, req.close_date
    )
    return {"status": "recorded", "deal_id": req.deal_id}


@app.post("/api/calibration/track-recommendation")
async def track_recommendation(req: RecTrackRequest):
    """Track whether a recommendation was followed."""
    engine.calibrator.track_recommendation(
        req.deal_id, req.domain, req.followed, req.outcome
    )
    return {"status": "tracked"}


@app.get("/api/calibration/recommendation-report")
async def recommendation_report():
    """Get the recommendation report card (lift from following recs)."""
    return engine.calibrator.recommendation_report_card()


# ---------------------------------------------------------------------------
# Model inspection
# ---------------------------------------------------------------------------

@app.get("/api/model/summary")
async def model_summary():
    """Get training summary and model parameters."""
    _check_trained()
    return engine.get_training_summary()


@app.get("/api/model/params")
async def model_params():
    """Get full model parameters for inspection."""
    _check_trained()
    return engine.get_model_params()


@app.get("/api/data/summary")
async def data_summary():
    """Get summary of loaded data."""
    if not _initialized:
        raise HTTPException(400, "No data loaded")
    return engine.loader.summary()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "initialized": _initialized,
        "trained": engine.predictor.is_trained,
        "training_deals": engine.predictor.training_count,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _check_trained():
    if not engine.predictor.is_trained:
        raise HTTPException(
            400,
            "Engine not trained. POST to /api/engine/load-and-train first."
        )


# ---------------------------------------------------------------------------
# Run with: uvicorn engine.api:app --reload --port 8000
# ---------------------------------------------------------------------------
