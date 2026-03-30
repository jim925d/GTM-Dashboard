"""
CSV field normalization — maps any CRM column name to canonical field names.
Handles BOM, encoding, Excel junk rows, and smart header detection.
"""

import csv
import io
import re
from typing import Optional

# Canonical field name → list of accepted aliases (lowercase)
FIELD_MAP = {
    "customer_account": ["customer account", "account name", "company", "customer_account", "account", "customer name"],
    "mrr": ["total mrr", "mrr", "monthly recurring revenue", "total mrr & mar (converted)", "monthly revenue"],
    "forecast_category": ["forecast category", "forecast", "forecast_category"],
    "stage": ["stage", "deal stage", "opportunity stage", "sales stage"],
    "close_date": ["close date", "close_date", "expected close", "expected close date"],
    "type": ["type", "deal type", "opportunity type", "deal_type"],
    "product_group": ["product group", "product family", "product", "product_group", "product name"],
    "created_date": ["created date", "create date", "created_date", "date created"],
    "total_contract_value": ["total contract value", "amount", "tcv", "total_contract_value", "deal amount"],
    "rep": ["created by", "rep", "owner", "deal owner", "sales rep", "representative"],
    "mega_vertical": ["mega vertical grouping", "mega vertical", "vertical", "industry", "mega_vertical"],
    "sub_vertical": ["sub vertical", "sub_vertical", "sub-vertical", "sub industry"],
    "primary_rep": ["primary rep", "primary_rep", "assigned rep", "account owner"],
    "loss_reason": ["loss reason", "loss_reason", "close lost reason", "reason lost"],
    "competitor_won": ["competitor", "competitor won", "competitor_won", "winning competitor"],
    "on_net_status": ["on-net status", "on net status", "on_net_status", "net status"],
    "latitude": ["latitude", "lat"],
    "longitude": ["longitude", "lng", "lon", "long"],
    "location_name": ["location name", "location_name", "site name", "site"],
    "location_type": ["location type", "location_type", "site type"],
    "service_status": ["service status", "service_status", "status"],
    "service_id": ["service id", "service_id", "circuit id", "circuit_id"],
    "product_detail": ["product detail", "product_detail", "product description"],
    "start_date": ["start date", "start_date", "service start", "install date"],
    "contract_end_date": ["contract end date", "contract_end_date", "end date", "expiration"],
    "term_months": ["term months", "term_months", "term", "contract term"],
    "auto_renew": ["auto renew", "auto_renew", "auto-renew"],
    "location_a": ["location a", "location_a", "a-side", "a side", "a_location"],
    "location_z": ["location z", "location_z", "z-side", "z side", "z_location"],
    "bandwidth": ["bandwidth", "capacity", "speed"],
    "last_change_date": ["last change date", "last_change_date", "last modified"],
    "change_type": ["change type", "change_type"],
    "quote_number": ["quote number", "quote_number", "quote id", "quote_id"],
    "quoted_mrr": ["quoted mrr", "quoted_mrr", "quote mrr", "price"],
    "quoted_tcv": ["quoted tcv", "quoted_tcv", "quote tcv", "quote amount"],
    "quote_date": ["quote date", "quote_date", "date quoted"],
    "expiration_date": ["expiration date", "expiration_date", "expires", "expiry"],
    "quote_status": ["quote status", "quote_status"],
    "discount_pct": ["discount pct", "discount_pct", "discount", "discount %", "discount percent"],
    "list_mrr": ["list mrr", "list_mrr", "list price", "rack rate"],
    "competitor_quote": ["competitor quote", "competitor_quote", "competitive price"],
    "opportunity_name": ["opportunity name", "opportunity_name", "deal name", "opp name"],
    "account_id": ["account id", "account_id", "crm id"],
    "rep_email": ["rep email", "rep_email", "email"],
    "account_manager": ["account manager", "account_manager", "am"],
    "executive_sponsor": ["executive sponsor", "executive_sponsor", "champion"],
    "customer_since": ["customer since", "customer_since", "since"],
    "annual_revenue": ["annual revenue", "annual_revenue", "revenue"],
    "employee_count": ["employee count", "employee_count", "employees", "headcount"],
    "parent_company": ["parent company", "parent_company", "parent"],
    "territory": ["territory"],
    "segment": ["segment", "reporting segment", "reporting_segment"],
    "account_tier": ["account tier", "account_tier", "tier"],
    "stage_lost_from": ["stage lost from", "stage_lost_from", "lost from stage"],
    "loss_notes": ["loss notes", "loss_notes", "notes", "close lost notes"],
    "next_step": ["next step", "next_step", "next action"],
    "address": ["address", "street address", "street"],
    "city": ["city"],
    "state": ["state", "province"],
    "zip": ["zip", "zip code", "postal code", "zipcode"],
    "building_access": ["building access", "building_access", "access"],
    "active_services": ["active services", "active_services", "service count"],
    "monthly_revenue": ["monthly revenue", "monthly_revenue", "site mrr"],
    "fiber_lit": ["fiber lit", "fiber_lit", "lit", "fiber"],
    "location_notes": ["location notes", "location_notes", "site notes"],
}

# Build reverse lookup: lowercase alias → canonical name
_REVERSE_MAP = {}
for canonical, aliases in FIELD_MAP.items():
    for alias in aliases:
        _REVERSE_MAP[alias.lower().strip()] = canonical


def normalize_column_name(raw: str) -> Optional[str]:
    """Map a raw column name to its canonical field name."""
    cleaned = re.sub(r"[^\w\s&()-]", "", raw.strip()).lower().strip()
    # Direct match
    if cleaned in _REVERSE_MAP:
        return _REVERSE_MAP[cleaned]
    # Fuzzy: remove extra spaces
    collapsed = re.sub(r"\s+", " ", cleaned)
    if collapsed in _REVERSE_MAP:
        return _REVERSE_MAP[collapsed]
    # Try with underscores
    underscored = collapsed.replace(" ", "_")
    if underscored in _REVERSE_MAP:
        return _REVERSE_MAP[underscored]
    return None


def detect_header_row(lines: list[str], known_fields: set[str] = None) -> int:
    """Scan first 20 lines to find the header row. Returns 0-based index."""
    if known_fields is None:
        known_fields = set(_REVERSE_MAP.keys())

    best_row = 0
    best_count = 0

    for i, line in enumerate(lines[:20]):
        if not line.strip():
            continue
        # Try parsing as CSV
        try:
            reader = csv.reader(io.StringIO(line))
            cols = next(reader)
        except Exception:
            cols = line.split(",")

        matches = 0
        for col in cols:
            cleaned = re.sub(r"[^\w\s&()-]", "", col.strip()).lower().strip()
            if cleaned in known_fields or normalize_column_name(col) is not None:
                matches += 1

        if matches > best_count:
            best_count = matches
            best_row = i

    return best_row


def parse_csv(content: str | bytes, tab_name: str = None) -> list[dict]:
    """Parse CSV content with smart header detection and field normalization."""
    # Handle bytes and encoding
    if isinstance(content, bytes):
        # Remove BOM
        if content.startswith(b"\xef\xbb\xbf"):
            content = content[3:]
        try:
            content = content.decode("utf-8")
        except UnicodeDecodeError:
            content = content.decode("latin-1")

    lines = content.splitlines()
    if not lines:
        return []

    header_idx = detect_header_row(lines)
    header_line = lines[header_idx]

    # Parse header
    reader = csv.reader(io.StringIO(header_line))
    raw_headers = next(reader)

    # Map headers to canonical names
    col_map = {}
    for i, h in enumerate(raw_headers):
        canonical = normalize_column_name(h)
        if canonical:
            col_map[i] = canonical

    if not col_map:
        return []

    # Parse data rows
    data_lines = "\n".join(lines[header_idx + 1:])
    reader = csv.reader(io.StringIO(data_lines))
    records = []

    for row in reader:
        if not row or all(not c.strip() for c in row):
            continue
        record = {}
        for i, val in enumerate(row):
            if i in col_map:
                val = val.strip()
                if val == "" or val.lower() in ("null", "none", "n/a", "-"):
                    val = None
                record[col_map[i]] = val
        if record.get("customer_account"):
            records.append(record)

    return records
