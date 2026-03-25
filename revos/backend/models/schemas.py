from pydantic import BaseModel
from typing import Optional
from datetime import date


# --- Input schemas ---
class CustomerIn(BaseModel):
    customer_account: str
    account_id: Optional[str] = None
    mega_vertical: str
    sub_vertical: Optional[str] = None
    primary_rep: str
    rep_email: Optional[str] = None
    account_manager: Optional[str] = None
    executive_sponsor: Optional[str] = None
    customer_since: Optional[date] = None
    contract_end_date: Optional[date] = None
    annual_revenue: Optional[float] = None
    employee_count: Optional[int] = None
    parent_company: Optional[str] = None
    territory: Optional[str] = None
    segment: Optional[str] = None
    account_tier: Optional[str] = None


class FunnelDealIn(BaseModel):
    customer_account: str
    opportunity_name: Optional[str] = None
    product_group: str
    mrr: float
    total_contract_value: Optional[float] = None
    stage: str
    forecast_category: str
    close_date: date
    created_date: date
    type: str
    rep: Optional[str] = None
    competitor: Optional[str] = None
    next_step: Optional[str] = None


class CloseLostDealIn(BaseModel):
    customer_account: str
    opportunity_name: Optional[str] = None
    product_group: str
    mrr: float
    total_contract_value: Optional[float] = None
    close_date: date
    created_date: date
    type: str
    stage_lost_from: Optional[str] = None
    loss_reason: str
    competitor_won: Optional[str] = None
    rep: Optional[str] = None
    loss_notes: Optional[str] = None


class QuoteIn(BaseModel):
    customer_account: str
    quote_number: Optional[str] = None
    product_group: str
    quoted_mrr: float
    quoted_tcv: Optional[float] = None
    term_months: Optional[int] = None
    quote_date: date
    expiration_date: Optional[date] = None
    quote_status: str
    discount_pct: Optional[float] = None
    list_mrr: Optional[float] = None
    competitor_quote: Optional[float] = None


class ServiceIn(BaseModel):
    customer_account: str
    service_id: Optional[str] = None
    product_group: str
    product_detail: Optional[str] = None
    mrr: float
    service_status: str
    start_date: date
    contract_end_date: Optional[date] = None
    term_months: Optional[int] = None
    auto_renew: Optional[bool] = None
    location_a: Optional[str] = None
    location_z: Optional[str] = None
    bandwidth: Optional[str] = None
    last_change_date: Optional[date] = None
    change_type: Optional[str] = None


class LocationIn(BaseModel):
    customer_account: str
    location_name: str
    location_type: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    on_net_status: str
    building_access: Optional[str] = None
    active_services: Optional[int] = None
    monthly_revenue: Optional[float] = None
    fiber_lit: Optional[bool] = None
    location_notes: Optional[str] = None


# --- Output schemas ---
class AccountSummary(BaseModel):
    customer_account: str
    mega_vertical: str
    primary_rep: str
    total_arr: float
    total_mrr: float
    active_pipeline_mrr: float
    active_pipeline_count: int
    win_rate: float
    risk_score: int
    risk_level: str
    velocity: str
    days_silent: int
    nrr: float
    total_deals_won: int
    total_deals_lost: int


class AccountState(BaseModel):
    customer_account: str
    mega_vertical: str
    primary_rep: str
    total_arr: float
    total_mrr: float
    active_pipeline_mrr: float
    active_pipeline_count: int
    pipeline_by_stage: dict
    pipeline_by_product: dict
    total_deals_won: int
    total_deals_lost: int
    win_rate: float
    avg_sales_cycle_days: float
    lost_mrr_total: float
    lost_by_product: dict
    loss_reasons: dict
    disconnects: int
    downgrades: int
    downgrade_mrr: float
    net_revenue_retention: float
    product_history: dict
    adoption_sequence: list
    product_concentration: dict
    deal_velocity_trend: str
    days_since_last_activity: int
    rep_count: int
    relationship_tenure_months: int
    risk_score: int
    risk_level: str
    locations: list
    quote_history: list
    competitor_landscape: list
    services: list
    funnel_deals: list
    close_lost_deals: list


class AnalysisRequest(BaseModel):
    account_id: str
    deal_index: Optional[int] = None


class IngestResponse(BaseModel):
    accounts_count: int
    records_ingested: dict
    accounts: list[str]
