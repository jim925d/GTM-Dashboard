"""
Feature extraction for the hybrid prediction model.
Computes features from activity logs, playbook, and deal data.
All functions are deterministic — no LLM, no randomness.
"""

import json
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

# ─── Load playbook ───
PLAYBOOK_PATH = Path(__file__).parent / "snapshots" / "playbook_snapshot.json"


def load_playbook():
    if PLAYBOOK_PATH.exists():
        with open(PLAYBOOK_PATH) as f:
            return json.load(f)
    return {"products": []}


PLAYBOOK = load_playbook()


# ═══════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════

def parse_date(d):
    """Parse various date formats to datetime."""
    if isinstance(d, datetime):
        return d
    if not d or str(d).strip() == "":
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%m/%d/%Y", "%Y-%m-%d %H:%M:%S", "%m/%d/%y"):
        try:
            return datetime.strptime(str(d).strip(), fmt)
        except (ValueError, TypeError):
            continue
    return None


def get_product_config(product_name):
    """Look up product in playbook by name or ID. Fuzzy match."""
    if not product_name:
        return None
    norm = product_name.lower().replace("-", " ").replace("_", " ").strip()
    for p in PLAYBOOK.get("products", []):
        pid = (p.get("product_id") or "").replace("_", " ").lower()
        pname = (p.get("display_name") or "").lower().strip()
        if pid == norm or pname == norm:
            return p
        if norm in pname or pname in norm:
            return p
        # Try partial match on key words
        norm_words = set(norm.split())
        pid_words = set(pid.split())
        pname_words = set(pname.split())
        if norm_words and (norm_words & pid_words or norm_words & pname_words):
            return p
    return None


def get_vertical_fit(product_config, vertical):
    """Get playbook fit score (0-100) for a product-vertical combo."""
    if not product_config or not vertical:
        return 50  # neutral default
    scores = product_config.get("ideal_customer_profile", {}).get("vertical_fit_scores", {}) or {}
    if vertical in scores:
        return scores[vertical]
    for k, v in scores.items():
        if k.lower().strip() == vertical.lower().strip():
            return v
    return 50


def find_upsell_path(product_config, customer_products):
    """Find best matching upsell path from customer's existing products."""
    if not product_config or not customer_products:
        return None
    from_paths = product_config.get("upsell_paths", {})
    if isinstance(from_paths, dict):
        from_paths = from_paths.get("from", [])
    if not from_paths:
        return None
    cust_lower = [str(p).lower().strip() for p in customer_products if p]
    best = None
    for path in from_paths:
        if not isinstance(path, dict):
            continue
        if path.get("product", "").lower().strip() in cust_lower:
            if not best or path.get("fit_score", 0) > best.get("fit_score", 0):
                best = path
    return best


# ═══════════════════════════════════════
# ACTIVITY FEATURES (from engagement data)
# ═══════════════════════════════════════

def compute_activity_features(deal, engagements):
    """
    Compute engagement features for a deal.

    Args:
        deal: dict with at least created_date
        engagements: list of dicts with date, type, direction (optional), duration_minutes (optional)

    Returns: dict of numeric features
    """
    defaults = {
        "touch_count": 0,
        "engagement_velocity": 0.0,
        "days_since_last_touch": 999,
        "recency_trend": 1.0,
        "meeting_ratio": 0.0,
        "inbound_ratio": 0.0,
        "activity_depth_minutes": 0,
        "touches_in_stage": 0,
        "response_time_avg_hours": 999.0,
    }

    if not engagements:
        return defaults

    now = datetime.now()

    # Parse and sort engagements by date
    dated = []
    for e in engagements:
        d = parse_date(e.get("date") or e.get("activity_date") or e.get("d"))
        if d:
            dated.append((d, e))
    dated.sort(key=lambda x: x[0])

    if not dated:
        return defaults

    dates = [d for d, _ in dated]
    engs = [e for _, e in dated]

    created = parse_date(deal.get("created_date") or deal.get("open_date") or deal.get("created"))
    if not created:
        created = dates[0]
    weeks_open = max((now - created).days / 7.0, 0.5)

    touch_count = len(engs)
    engagement_velocity = round(touch_count / weeks_open, 2)
    days_since_last_touch = max((now - dates[-1]).days, 0)

    # Recency trend
    if len(dates) >= 6:
        n = min(3, len(dates) - 1)
        first_gaps = [(dates[i + 1] - dates[i]).days for i in range(n)]
        last_gaps = [(dates[-(i + 1)] - dates[-(i + 2)]).days for i in range(n)]
        avg_first = max(sum(first_gaps) / len(first_gaps), 0.5)
        avg_last = max(sum(last_gaps) / len(last_gaps), 0.5)
        recency_trend = round(avg_last / avg_first, 2)
    else:
        recency_trend = 1.0

    # Meeting ratio
    meeting_types = {"meeting", "event", "demo", "call"}
    meetings = [e for e in engs if str(e.get("type") or e.get("t") or "").lower() in meeting_types]
    meeting_ratio = round(len(meetings) / max(touch_count, 1), 2)

    # Inbound ratio
    inbound_vals = {"inbound", "received", "incoming"}
    inbound = [e for e in engs if str(e.get("direction", "")).lower() in inbound_vals]
    inbound_ratio = round(len(inbound) / max(touch_count, 1), 2)

    # Activity depth
    activity_depth = sum(int(e.get("duration_minutes") or 0) for e in meetings)

    # Touches in current stage
    stage_entered = parse_date(deal.get("stage_entered_date") or deal.get("last_stage_change_date"))
    if stage_entered:
        touches_in_stage = len([d for d in dates if d >= stage_entered])
    else:
        touches_in_stage = touch_count

    # Response time
    response_times = []
    last_outbound_time = None
    for e in engs:
        direction = str(e.get("direction", "")).lower()
        e_date = parse_date(e.get("date") or e.get("activity_date") or e.get("d"))
        if not e_date:
            continue
        if direction in ("outbound", "sent", "outgoing"):
            last_outbound_time = e_date
        elif direction in ("inbound", "received", "incoming") and last_outbound_time:
            gap_hours = (e_date - last_outbound_time).total_seconds() / 3600
            if 0 < gap_hours < 720:
                response_times.append(gap_hours)
            last_outbound_time = None

    response_time_avg = round(sum(response_times) / len(response_times), 1) if response_times else 999.0

    return {
        "touch_count": touch_count,
        "engagement_velocity": engagement_velocity,
        "days_since_last_touch": days_since_last_touch,
        "recency_trend": recency_trend,
        "meeting_ratio": meeting_ratio,
        "inbound_ratio": inbound_ratio,
        "activity_depth_minutes": activity_depth,
        "touches_in_stage": touches_in_stage,
        "response_time_avg_hours": response_time_avg,
    }


# ═══════════════════════════════════════
# PLAYBOOK FEATURES
# ═══════════════════════════════════════

def compute_playbook_features(deal):
    """
    Compute playbook-derived features for a deal.

    Args:
        deal: dict with product, vertical/mega_vertical, and optionally:
              current_products, onnet_pct, primary_site_onnet

    Returns: dict of numeric features
    """
    product = deal.get("product") or deal.get("product_group") or ""
    vertical = deal.get("vertical") or deal.get("mega_vertical") or deal.get("segment") or ""
    product_config = get_product_config(product)

    playbook_fit = get_vertical_fit(product_config, vertical) if product_config else 50

    onnet_pct = deal.get("onnet_pct") or deal.get("sites_onnet_pct")
    if onnet_pct is not None:
        onnet_pct = float(onnet_pct)
    else:
        onnet_pct = 0.5

    primary_onnet_raw = str(deal.get("primary_site_onnet") or deal.get("onnet_status") or "").lower()
    if any(kw in primary_onnet_raw for kw in ("on-net", "on_net", "lit", "yes", "true")):
        primary_onnet = 1
    elif any(kw in primary_onnet_raw for kw in ("near", "partial")):
        primary_onnet = 0.5
    elif any(kw in primary_onnet_raw for kw in ("off", "no", "false")):
        primary_onnet = 0
    else:
        primary_onnet = 0.5

    customer_products = deal.get("current_products") or deal.get("existing_services") or []
    if isinstance(customer_products, str):
        customer_products = [p.strip() for p in customer_products.split(",") if p.strip()]

    is_existing_customer = 1 if len(customer_products) > 0 else 0
    current_product_count = len(customer_products)

    upsell_path = find_upsell_path(product_config, customer_products)
    upsell_fit = upsell_path.get("fit_score", 0) if upsell_path else 0
    upsell_rate = upsell_path.get("historical_close_rate") if upsell_path else None
    if upsell_rate is None:
        upsell_rate = 0.5 if is_existing_customer else 0.0

    onnet_req = "none"
    if product_config:
        onnet_req = product_config.get("requirements", {}).get("on_net", "none")
    onnet_requirement_match = onnet_pct if onnet_req != "none" else 0.5

    return {
        "playbook_vertical_fit": playbook_fit,
        "onnet_pct": onnet_pct,
        "primary_site_onnet": primary_onnet,
        "upsell_path_fit": upsell_fit,
        "upsell_path_rate": upsell_rate,
        "is_existing_customer": is_existing_customer,
        "current_product_count": current_product_count,
        "onnet_requirement_match": onnet_requirement_match,
    }


# ═══════════════════════════════════════
# INTERACTION FEATURES
# ═══════════════════════════════════════

def compute_interaction_features(deal, activity_features, playbook_features):
    """Compute interaction terms that capture non-linear relationships."""
    days_since = activity_features.get("days_since_last_touch", 999)
    velocity = activity_features.get("engagement_velocity", 0)
    meeting_ratio = activity_features.get("meeting_ratio", 0)

    STAGE_RANK = {
        "Discover": 1, "Design": 2, "Design Solution": 2,
        "Propose": 3, "Negotiate": 4, "Verbal Agreement": 5,
    }
    stage = deal.get("stage", "Discover")
    stage_rank = STAGE_RANK.get(stage, 1)

    deal_size = float(deal.get("mrr") or deal.get("amount") or deal.get("deal_value") or 0)
    is_existing = playbook_features.get("is_existing_customer", 0)
    upsell_fit = playbook_features.get("upsell_path_fit", 0) / 100.0
    onnet = playbook_features.get("onnet_pct", 0.5)

    return {
        "gap_x_stage": days_since * stage_rank,
        "velocity_x_stage": velocity * stage_rank,
        "size_x_low_velocity": deal_size * max(0, 1.0 - velocity / 3.0),
        "existing_x_velocity": is_existing * velocity,
        "upsell_x_onnet": upsell_fit * onnet,
        "meetings_x_stage": meeting_ratio * stage_rank,
    }


# ═══════════════════════════════════════
# FULL FEATURE VECTOR
# ═══════════════════════════════════════

def extract_all_features(deal, engagements=None):
    """
    Compute the complete feature vector for a deal.
    Returns a flat dict of all features for the calibration model.
    """
    activity = compute_activity_features(deal, engagements or [])
    playbook = compute_playbook_features(deal)
    interactions = compute_interaction_features(deal, activity, playbook)

    features = {}
    features.update({f"act_{k}": v for k, v in activity.items()})
    features.update({f"pb_{k}": v for k, v in playbook.items()})
    features.update({f"ix_{k}": v for k, v in interactions.items()})

    features["act_has_data"] = 1 if (engagements and len(engagements) > 0) else 0
    features["pb_has_config"] = 1 if get_product_config(deal.get("product", "")) is not None else 0

    return features
