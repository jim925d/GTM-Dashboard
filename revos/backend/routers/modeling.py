"""
Modeling Layer router — unified engine orchestration endpoints.
Serves snapshot data, triggers engine runs, and individual enrichment.
"""

import os
import time
import logging

from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/modeling", tags=["modeling"])

# ---- Lazy init of the modeling layer ----
# Initialized on first request so the app starts even if the event ledger is missing.

_ml = None


def _get_ml():
    global _ml
    if _ml is not None:
        return _ml

    from modeling_layer import ModelingLayer

    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ledger = os.path.join(base, 'data', 'revos_event_ledger_template.csv')
    if not os.path.exists(ledger):
        ledger = os.path.join(base, 'revos_event_ledger.csv')
    if not os.path.exists(ledger):
        # Search common locations
        for candidate in [
            os.path.join(base, 'backend', 'data', 'revos_event_ledger_template.csv'),
            os.path.join(base, 'backend', 'revos_event_ledger.csv'),
        ]:
            if os.path.exists(candidate):
                ledger = candidate
                break

    locations = os.path.join(base, 'frontend', 'data', 'locations.csv')
    if not os.path.exists(locations):
        locations = None

    _ml = ModelingLayer(
        event_ledger_path=ledger,
        locations_path=locations,
    )
    logger.info("ModelingLayer initialized: ledger=%s, locations=%s", ledger, locations)
    return _ml


# ---- Pydantic models ----

class RunEnginesPayload(BaseModel):
    accounts: List[dict]
    deals_by_account: Dict[str, List[dict]]


class EnrichAccountPayload(BaseModel):
    account: dict
    deals: List[dict]


# ---- Snapshot endpoints ----

@router.get("/snapshot")
async def get_snapshot():
    """Load the last saved engine run. Called on frontend startup."""
    ml = _get_ml()
    snap = ml.load_snapshot()
    if snap:
        return snap
    return {"has_data": False, "message": "No engine run found. Click 'Run Engines' to generate."}


@router.get("/snapshot-info")
async def get_snapshot_info():
    """Lightweight metadata about last run (no full data)."""
    ml = _get_ml()
    info = ml.get_snapshot_info()
    return info or {"has_data": False}


@router.post("/run-engines")
async def run_engines(payload: RunEnginesPayload):
    """Run all engines on provided data, save snapshot, return results."""
    ml = _get_ml()
    start = time.time()
    result = ml.run_all_engines(payload.accounts, payload.deals_by_account)
    elapsed = round(time.time() - start, 2)

    if result and 'metadata' in result:
        result['metadata']['run_duration_seconds'] = elapsed
        ml.save_snapshot(result['accounts'], result['deals'], result['metadata'])

    return result


# ---- Location Intelligence ----

@router.get("/locations/{account_name}")
async def get_account_locations(account_name: str):
    """Get location signals for a specific account from last snapshot."""
    ml = _get_ml()
    snap = ml.load_snapshot()
    if not snap:
        return {"error": "No snapshot. Run engines first."}
    acct = next(
        (a for a in snap['accounts']
         if (a.get('name') or a.get('account') or a.get('Customer Account', '')) == account_name),
        None,
    )
    if not acct:
        return {"error": f"Account '{account_name}' not found"}
    return {
        "location_count": acct.get('loc_location_count', 0),
        "geographic_spread": acct.get('loc_geographic_spread', 0),
        "has_data_center": acct.get('loc_has_data_center', False),
        "footprint_score": acct.get('loc_footprint_score', 0),
        "product_affinity": acct.get('loc_product_affinity', {}),
        "locations": acct.get('loc_locations', []),
    }


# ---- Individual enrichment ----

@router.post("/enrich-deal")
async def enrich_deal(deal: dict):
    ml = _get_ml()
    return ml.enrich_deal(deal)


@router.post("/enrich-account")
async def enrich_account(payload: EnrichAccountPayload):
    ml = _get_ml()
    return ml.enrich_account(payload.account, payload.deals)


@router.post("/enrich-pipeline")
async def enrich_pipeline(deals: List[dict]):
    ml = _get_ml()
    return ml.enrich_deals_batch(deals)


# ---- Events & Backtest ----

@router.get("/events")
async def get_events(lookback_days: int = Query(default=90)):
    ml = _get_ml()
    return ml.get_active_events(lookback_days)


@router.get("/backtest")
async def get_backtest():
    ml = _get_ml()
    return ml.get_backtest_summary()
