"""
Signals router — web search signal intelligence.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db, Customer
from routers.accounts import _build_state
from services.signal_engine import run_signal_intelligence

router = APIRouter(prefix="/api", tags=["signals"])


@router.post("/analyze/signals/{account_id}")
async def signal_intelligence(account_id: str, db: Session = Depends(get_db)):
    """Run signal intelligence web scrub for an account."""
    cust = db.query(Customer).filter(Customer.customer_account == account_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail=f"Account '{account_id}' not found")

    state = _build_state(db, cust)
    try:
        result = await run_signal_intelligence(state)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
