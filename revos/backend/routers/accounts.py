"""
Accounts router — list accounts and get full account state.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db, Customer, FunnelDeal, CloseLostDeal, Quote, Service, Location
from services.account_builder import build_account_state

router = APIRouter(prefix="/api", tags=["accounts"])


@router.get("/accounts")
def list_accounts(db: Session = Depends(get_db)):
    """Return all accounts with summary data."""
    customers = db.query(Customer).all()
    summaries = []

    for cust in customers:
        state = _build_state(db, cust)
        summaries.append({
            "customer_account": state["customer_account"],
            "mega_vertical": state["mega_vertical"],
            "primary_rep": state["primary_rep"],
            "total_arr": state["total_arr"],
            "total_mrr": state["total_mrr"],
            "active_pipeline_mrr": state["active_pipeline_mrr"],
            "active_pipeline_count": state["active_pipeline_count"],
            "win_rate": state["win_rate"],
            "risk_score": state["risk_score"],
            "risk_level": state["risk_level"],
            "velocity": state["deal_velocity_trend"],
            "days_silent": state["days_since_last_activity"],
            "nrr": state["net_revenue_retention"],
            "total_deals_won": state["total_deals_won"],
            "total_deals_lost": state["total_deals_lost"],
        })

    return summaries


@router.get("/accounts/{account_id}")
def get_account(account_id: str, db: Session = Depends(get_db)):
    """Return full account state for a specific account."""
    cust = db.query(Customer).filter(Customer.customer_account == account_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail=f"Account '{account_id}' not found")

    return _build_state(db, cust)


def _build_state(db: Session, cust: Customer) -> dict:
    """Build full account state from DB records."""
    acct = cust.customer_account

    funnel = [_row_to_dict(d) for d in db.query(FunnelDeal).filter(FunnelDeal.customer_account == acct).all()]
    lost = [_row_to_dict(d) for d in db.query(CloseLostDeal).filter(CloseLostDeal.customer_account == acct).all()]
    quotes = [_row_to_dict(d) for d in db.query(Quote).filter(Quote.customer_account == acct).all()]
    services = [_row_to_dict(d) for d in db.query(Service).filter(Service.customer_account == acct).all()]
    locations = [_row_to_dict(d) for d in db.query(Location).filter(Location.customer_account == acct).all()]

    customer_dict = _row_to_dict(cust)
    return build_account_state(customer_dict, funnel, lost, quotes, services, locations)


def _row_to_dict(row) -> dict:
    """Convert SQLAlchemy model to dict."""
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        d[col.name] = val
    return d
