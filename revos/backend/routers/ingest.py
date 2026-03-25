"""
CSV ingest router — handles single and multi-tab CSV uploads.
"""

from fastapi import APIRouter, UploadFile, File, Form, Depends
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from models.database import get_db, Customer, FunnelDeal, CloseLostDeal, Quote, Service, Location
from services.normalizer import parse_csv

router = APIRouter(prefix="/api", tags=["ingest"])


@router.post("/ingest")
async def ingest_csv(
    file: UploadFile = File(...),
    tab_type: str = Form("auto"),
    db: Session = Depends(get_db),
):
    """Upload a single CSV file. tab_type: customers, funnel, close_lost, quotes, services, locations, or auto."""
    content = await file.read()
    records = parse_csv(content)

    if not records:
        return {"error": "No records found in CSV", "accounts_count": 0}

    if tab_type == "auto":
        tab_type = _detect_tab_type(records[0])

    counts = _ingest_records(db, records, tab_type)
    accounts = list(set(r.get("customer_account", "") for r in records if r.get("customer_account")))

    return {
        "accounts_count": len(accounts),
        "records_ingested": {tab_type: counts},
        "accounts": accounts,
    }


@router.post("/ingest-multi")
async def ingest_multi(
    customers: Optional[UploadFile] = File(None),
    funnel: Optional[UploadFile] = File(None),
    close_lost: Optional[UploadFile] = File(None),
    quotes: Optional[UploadFile] = File(None),
    services: Optional[UploadFile] = File(None),
    locations: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """Upload per-tab CSVs for each data table."""
    all_accounts = set()
    counts = {}

    tabs = {
        "customers": customers,
        "funnel": funnel,
        "close_lost": close_lost,
        "quotes": quotes,
        "services": services,
        "locations": locations,
    }

    for tab_name, file in tabs.items():
        if file is None:
            continue
        content = await file.read()
        records = parse_csv(content, tab_name)
        if records:
            n = _ingest_records(db, records, tab_name)
            counts[tab_name] = n
            for r in records:
                if r.get("customer_account"):
                    all_accounts.add(r["customer_account"])

    return {
        "accounts_count": len(all_accounts),
        "records_ingested": counts,
        "accounts": sorted(all_accounts),
    }


def _detect_tab_type(record: dict) -> str:
    """Detect which table type a record belongs to based on its fields."""
    fields = set(record.keys())
    if "loss_reason" in fields or "stage_lost_from" in fields:
        return "close_lost"
    if "stage" in fields and "forecast_category" in fields:
        return "funnel"
    if "quoted_mrr" in fields or "quote_status" in fields:
        return "quotes"
    if "service_status" in fields or "service_id" in fields:
        return "services"
    if "on_net_status" in fields or "location_type" in fields:
        return "locations"
    if "mega_vertical" in fields or "primary_rep" in fields:
        return "customers"
    # Default to funnel
    return "funnel"


def _ingest_records(db: Session, records: list[dict], tab_type: str) -> int:
    """Insert records into the appropriate table. Returns count."""
    count = 0
    for rec in records:
        try:
            if tab_type == "customers":
                _upsert_customer(db, rec)
            elif tab_type == "funnel":
                _insert_funnel(db, rec)
            elif tab_type == "close_lost":
                _insert_close_lost(db, rec)
            elif tab_type == "quotes":
                _insert_quote(db, rec)
            elif tab_type == "services":
                _insert_service(db, rec)
            elif tab_type == "locations":
                _insert_location(db, rec)
            count += 1
        except Exception as e:
            print(f"Error ingesting record: {e}")
            continue

    db.commit()
    return count


def _parse_date(val):
    if val is None:
        return None
    if isinstance(val, str):
        val = val.strip()
        if not val:
            return None
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%Y/%m/%d"):
            try:
                return datetime.strptime(val, fmt).date()
            except ValueError:
                continue
    return None


def _parse_float(val):
    if val is None:
        return None
    try:
        return float(str(val).replace(",", "").replace("$", "").strip())
    except (ValueError, TypeError):
        return None


def _parse_int(val):
    if val is None:
        return None
    try:
        return int(float(str(val).replace(",", "").strip()))
    except (ValueError, TypeError):
        return None


def _parse_bool(val):
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    s = str(val).strip().lower()
    return s in ("true", "yes", "1", "y")


def _upsert_customer(db: Session, rec: dict):
    acct = rec.get("customer_account")
    existing = db.query(Customer).filter(Customer.customer_account == acct).first()
    data = {
        "customer_account": acct,
        "account_id": rec.get("account_id"),
        "mega_vertical": rec.get("mega_vertical", "Unknown"),
        "sub_vertical": rec.get("sub_vertical"),
        "primary_rep": rec.get("primary_rep", "Unknown"),
        "rep_email": rec.get("rep_email"),
        "account_manager": rec.get("account_manager"),
        "executive_sponsor": rec.get("executive_sponsor"),
        "customer_since": _parse_date(rec.get("customer_since")),
        "contract_end_date": _parse_date(rec.get("contract_end_date")),
        "annual_revenue": _parse_float(rec.get("annual_revenue")),
        "employee_count": _parse_int(rec.get("employee_count")),
        "parent_company": rec.get("parent_company"),
        "territory": rec.get("territory"),
        "segment": rec.get("segment"),
        "account_tier": rec.get("account_tier"),
    }
    if existing:
        for k, v in data.items():
            if v is not None:
                setattr(existing, k, v)
    else:
        db.add(Customer(**data))


def _insert_funnel(db: Session, rec: dict):
    db.add(FunnelDeal(
        customer_account=rec.get("customer_account"),
        opportunity_name=rec.get("opportunity_name"),
        product_group=rec.get("product_group", "Unknown"),
        mrr=_parse_float(rec.get("mrr")) or 0,
        total_contract_value=_parse_float(rec.get("total_contract_value")),
        stage=rec.get("stage", "Unknown"),
        forecast_category=rec.get("forecast_category", "Not In Forecast"),
        close_date=_parse_date(rec.get("close_date")) or _parse_date("2026-12-31"),
        created_date=_parse_date(rec.get("created_date")) or _parse_date("2026-01-01"),
        type=rec.get("type", "New Service"),
        rep=rec.get("rep"),
        competitor=rec.get("competitor"),
        next_step=rec.get("next_step"),
    ))


def _insert_close_lost(db: Session, rec: dict):
    db.add(CloseLostDeal(
        customer_account=rec.get("customer_account"),
        opportunity_name=rec.get("opportunity_name"),
        product_group=rec.get("product_group", "Unknown"),
        mrr=_parse_float(rec.get("mrr")) or 0,
        total_contract_value=_parse_float(rec.get("total_contract_value")),
        close_date=_parse_date(rec.get("close_date")) or _parse_date("2026-01-01"),
        created_date=_parse_date(rec.get("created_date")) or _parse_date("2025-01-01"),
        type=rec.get("type", "New Service"),
        stage_lost_from=rec.get("stage_lost_from"),
        loss_reason=rec.get("loss_reason", "Unknown"),
        competitor_won=rec.get("competitor_won"),
        rep=rec.get("rep"),
        loss_notes=rec.get("loss_notes"),
    ))


def _insert_quote(db: Session, rec: dict):
    db.add(Quote(
        customer_account=rec.get("customer_account"),
        quote_number=rec.get("quote_number"),
        product_group=rec.get("product_group", "Unknown"),
        quoted_mrr=_parse_float(rec.get("quoted_mrr")) or 0,
        quoted_tcv=_parse_float(rec.get("quoted_tcv")),
        term_months=_parse_int(rec.get("term_months")),
        quote_date=_parse_date(rec.get("quote_date")) or _parse_date("2026-01-01"),
        expiration_date=_parse_date(rec.get("expiration_date")),
        quote_status=rec.get("quote_status", "Draft"),
        discount_pct=_parse_float(rec.get("discount_pct")),
        list_mrr=_parse_float(rec.get("list_mrr")),
        competitor_quote=_parse_float(rec.get("competitor_quote")),
    ))


def _insert_service(db: Session, rec: dict):
    db.add(Service(
        customer_account=rec.get("customer_account"),
        service_id=rec.get("service_id"),
        product_group=rec.get("product_group", "Unknown"),
        product_detail=rec.get("product_detail"),
        mrr=_parse_float(rec.get("mrr")) or 0,
        service_status=rec.get("service_status", "Active"),
        start_date=_parse_date(rec.get("start_date")) or _parse_date("2025-01-01"),
        contract_end_date=_parse_date(rec.get("contract_end_date")),
        term_months=_parse_int(rec.get("term_months")),
        auto_renew=_parse_bool(rec.get("auto_renew")),
        location_a=rec.get("location_a"),
        location_z=rec.get("location_z"),
        bandwidth=rec.get("bandwidth"),
        last_change_date=_parse_date(rec.get("last_change_date")),
        change_type=rec.get("change_type"),
    ))


def _insert_location(db: Session, rec: dict):
    db.add(Location(
        customer_account=rec.get("customer_account"),
        location_name=rec.get("location_name", "Unknown"),
        location_type=rec.get("location_type", "Office"),
        address=rec.get("address"),
        city=rec.get("city"),
        state=rec.get("state"),
        zip=rec.get("zip"),
        latitude=_parse_float(rec.get("latitude")),
        longitude=_parse_float(rec.get("longitude")),
        on_net_status=rec.get("on_net_status", "Off-Net"),
        building_access=rec.get("building_access"),
        active_services=_parse_int(rec.get("active_services")),
        monthly_revenue=_parse_float(rec.get("monthly_revenue")),
        fiber_lit=_parse_bool(rec.get("fiber_lit")),
        location_notes=rec.get("location_notes"),
    ))
