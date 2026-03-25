"""
FastAPI endpoints for the RevOS Prediction Engine.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env before anything else
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from .main import RevOSEngine
from .enrichment import LocationEnrichmentService

app = FastAPI(title="RevOS Prediction Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = RevOSEngine()
enrichment = LocationEnrichmentService()


class LoadRequest(BaseModel):
    data_dir: Optional[str] = None
    deals: Optional[list] = None


class TrackRequest(BaseModel):
    deal_id: str
    domain: str = "all"
    followed: bool = True


class LocationModel(BaseModel):
    address: str = ""
    lat: float = 0
    lng: float = 0
    type: str = "Office"
    source: str = ""


class EnrichRequest(BaseModel):
    company_name: str
    industry: Optional[str] = None
    hq: Optional[str] = None
    website: Optional[str] = None
    existing_locations: Optional[List[LocationModel]] = []


class GooglePlacesRequest(BaseModel):
    company_name: str
    hq: Optional[str] = None


class ClaudeAnalyzeRequest(BaseModel):
    company_name: str
    industry: Optional[str] = None
    hq: Optional[str] = None
    website: Optional[str] = None


# ── Prediction Engine endpoints ──────────────────────────────────

@app.get("/api/health")
def health():
    return engine.get_health()


@app.post("/api/load-and-train")
def load_and_train(req: LoadRequest):
    if req.data_dir:
        return engine.load_and_train(data_dir=req.data_dir)
    elif req.deals:
        return engine.load_and_train(deals_data=req.deals)
    else:
        engine_root = Path(__file__).resolve().parent.parent
        default_dir = engine_root.parent / 'frontend' / 'data'
        if default_dir.exists():
            return engine.load_and_train(data_dir=str(default_dir))
        demo_dir = engine_root / 'demo_data'
        if demo_dir.exists():
            return engine.load_and_train(data_dir=str(demo_dir))
        return {"error": "No data_dir provided and no default data found."}


@app.get("/api/predictions")
def predictions():
    return engine.score_deals()


@app.get("/api/strategies")
def strategies():
    return engine.get_strategies()


@app.get("/api/calibration")
def calibration():
    return engine.calibrator.get_calibration_report()


@app.get("/api/model/params")
def model_params():
    return engine.predictor.get_model_params()


@app.post("/api/calibration/track-recommendation")
def track_recommendation(req: TrackRequest):
    engine.calibrator.track_recommendation(req.deal_id, req.domain, req.followed)
    return {"status": "tracked"}


# ── Location Enrichment endpoints ────────────────────────────────

@app.post("/api/enrich")
def enrich_full(req: EnrichRequest):
    """Run full enrichment pipeline (Google Places + Claude AI)."""
    existing = [loc.model_dump() for loc in (req.existing_locations or [])]
    result = enrichment.enrich_account(
        company_name=req.company_name,
        industry=req.industry,
        hq=req.hq,
        website=req.website,
        existing_locations=existing,
    )
    return result


@app.post("/api/enrich/google-places")
def enrich_google(req: GooglePlacesRequest):
    """Search Google Places for company locations."""
    return enrichment.search_google_places(req.company_name, req.hq)


@app.post("/api/enrich/claude")
def enrich_claude(req: ClaudeAnalyzeRequest):
    """Use Claude AI to research company locations."""
    return enrichment.analyze_with_claude(
        company_name=req.company_name,
        industry=req.industry,
        hq=req.hq,
        website=req.website,
    )


# ── Signal Refresh endpoint ──────────────────────────────────────

class RefreshSignalsRequest(BaseModel):
    accountName: str
    segment: Optional[str] = None
    signals: Optional[dict] = None


@app.post("/api/refresh-signals")
def refresh_signals(req: RefreshSignalsRequest):
    """Use Claude with web_search to layer market/industry context on pre-computed signals."""
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not anthropic_key:
        return {"error": "ANTHROPIC_API_KEY not configured", "aiSignals": []}

    import anthropic as anth
    import json as jsonlib

    client = anth.Anthropic(api_key=anthropic_key)

    signals_summary = jsonlib.dumps(req.signals, indent=2, default=str) if req.signals else "No pre-computed signals"

    prompt = f"""You are a B2B sales intelligence assistant for Zayo Group, a telecom infrastructure company that sells fiber, ethernet, colocation, IP services, and wavelengths.

Account: {req.accountName}
Segment: {req.segment or 'Unknown'}
Current signals:
{signals_summary}

Search for any recent market or industry news that would make this account a higher or lower priority right now. Focus on:
- Infrastructure investment announcements
- New construction or expansion projects
- M&A activity
- Competitor service changes or outages
- Budget or regulatory changes affecting this segment
- Technology initiatives (cloud migration, data center buildout, etc.)

Return a JSON array of 2-3 signal objects, each with:
{{ "icon": "🌐", "text": "concise signal description", "source": "source name", "recency": "X days ago" }}

Return ONLY the JSON array, no other text."""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            messages=[{"role": "user", "content": prompt}],
        )

        # Extract text blocks from response (may include tool use blocks)
        text_parts = [b.text for b in message.content if hasattr(b, 'text')]
        text = "\n".join(text_parts).strip()

        # Parse JSON from response
        clean = text.replace("```json", "").replace("```", "").strip()
        try:
            ai_signals = jsonlib.loads(clean)
            return {"aiSignals": ai_signals}
        except jsonlib.JSONDecodeError:
            # Try to find JSON array in the text
            import re
            match = re.search(r'\[[\s\S]*?\]', clean)
            if match:
                ai_signals = jsonlib.loads(match.group())
                return {"aiSignals": ai_signals}
            return {"aiSignals": [], "raw": text[:500]}

    except Exception as e:
        return {"error": str(e), "aiSignals": []}
