"""
Analysis router — Claude AI orchestration for Bayesian, Game Theory, Backtest, Learning Curve.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db
from routers.accounts import _build_state, get_account
from services.bayesian_engine import run_bayesian_prediction
from services.game_theory_engine import run_game_theory
from services.backtest_engine import run_backtest
from services.learning_curve import run_learning_curve
from models.database import Customer

router = APIRouter(prefix="/api", tags=["analyze"])


@router.post("/analyze/bayesian/{account_id}")
async def bayesian_prediction(account_id: str, db: Session = Depends(get_db)):
    """Run Bayesian prediction for an account."""
    cust = db.query(Customer).filter(Customer.customer_account == account_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail=f"Account '{account_id}' not found")

    state = _build_state(db, cust)
    try:
        result = await run_bayesian_prediction(state)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/analyze/game-theory/{account_id}/{deal_index}")
async def game_theory_analysis(account_id: str, deal_index: int, db: Session = Depends(get_db)):
    """Run game theory analysis for a specific deal."""
    cust = db.query(Customer).filter(Customer.customer_account == account_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail=f"Account '{account_id}' not found")

    state = _build_state(db, cust)
    deals = state.get("funnel_deals", [])

    if deal_index < 0 or deal_index >= len(deals):
        raise HTTPException(status_code=404, detail=f"Deal index {deal_index} not found")

    try:
        result = await run_game_theory(state, deals[deal_index])
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/backtest/{account_id}")
async def backtest(account_id: str, cutoff_date: str = "2025-06-30", db: Session = Depends(get_db)):
    """Run historical backtest for an account."""
    cust = db.query(Customer).filter(Customer.customer_account == account_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail=f"Account '{account_id}' not found")

    state = _build_state(db, cust)
    try:
        result = await run_backtest(state, cutoff_date)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/learning-curve/{account_id}")
async def learning_curve(account_id: str, db: Session = Depends(get_db)):
    """Run learning curve analysis for an account."""
    cust = db.query(Customer).filter(Customer.customer_account == account_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail=f"Account '{account_id}' not found")

    state = _build_state(db, cust)
    try:
        result = await run_learning_curve(state)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
