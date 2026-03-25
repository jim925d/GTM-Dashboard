"""
Account State Builder — joins all 6 tables per customer to compute derived AccountState.
"""

from datetime import date, timedelta
from collections import defaultdict


def compute_health_score(
    nrr: float,
    churn_rate: float,
    product_count: int,
    pipeline_mrr: float,
    tenure_months: int,
) -> dict:
    """CLAUDE.md canonical health score — 5-factor composite, 0-100."""
    nrr_score = min(40, (nrr / 1.0) * 40)
    churn_penalty = min(20, churn_rate * 200)
    product_diversity = min(15, product_count * 3)
    pipeline_bonus = min(15, (pipeline_mrr / 10000) * 15) if pipeline_mrr > 0 else 0
    tenure_score = min(10, (tenure_months / 24) * 10)

    health = nrr_score - churn_penalty + product_diversity + pipeline_bonus + tenure_score
    health = max(0, min(round(health), 100))

    return {
        "health": health,
        "factors": {
            "nrrScore": round(nrr_score),
            "churnPenalty": round(churn_penalty),
            "productDiversity": round(product_diversity),
            "pipelineBonus": round(pipeline_bonus),
            "tenureScore": round(tenure_score),
        },
    }


def health_level(score: int) -> str:
    if score >= 70:
        return "healthy"
    elif score >= 40:
        return "at_risk"
    return "critical"


def build_account_state(
    customer: dict,
    funnel: list[dict],
    close_lost: list[dict],
    quotes: list[dict],
    services: list[dict],
    locations: list[dict],
    today: date = None,
) -> dict:
    """Build a full account state from raw table data."""
    if today is None:
        today = date.today()

    account_name = customer.get("customer_account", "Unknown")

    # --- Services ---
    active_services = [s for s in services if s.get("service_status", "").lower() == "active"]
    total_mrr = sum(float(s.get("mrr", 0) or 0) for s in active_services)
    total_arr = total_mrr * 12

    disconnects_list = [s for s in services if s.get("service_status", "").lower() == "disconnected"]
    downgrades_list = [s for s in services if s.get("change_type", "").lower() == "downgrade"]
    downgrade_mrr = sum(abs(float(s.get("mrr", 0) or 0)) for s in downgrades_list)

    # --- Funnel ---
    active_pipeline = [d for d in funnel if d.get("stage", "").lower() not in ("closed won", "closed lost", "")]
    pipeline_mrr = sum(float(d.get("mrr", 0) or 0) for d in active_pipeline)
    pipeline_count = len(active_pipeline)

    pipeline_by_stage = defaultdict(lambda: {"count": 0, "mrr": 0})
    for d in active_pipeline:
        stage = d.get("stage", "Unknown")
        pipeline_by_stage[stage]["count"] += 1
        pipeline_by_stage[stage]["mrr"] += float(d.get("mrr", 0) or 0)

    pipeline_by_product = defaultdict(lambda: {"count": 0, "mrr": 0})
    for d in active_pipeline:
        prod = d.get("product_group", "Unknown")
        pipeline_by_product[prod]["count"] += 1
        pipeline_by_product[prod]["mrr"] += float(d.get("mrr", 0) or 0)

    # --- Won/Lost ---
    won_deals = [d for d in funnel if d.get("stage", "").lower() == "closed won"]
    total_won = len(won_deals)
    total_lost = len(close_lost)
    win_rate = total_won / (total_won + total_lost) if (total_won + total_lost) > 0 else 0

    # Sales cycle
    cycles = []
    for d in won_deals + list(close_lost):
        try:
            created = _parse_date(d.get("created_date"))
            closed = _parse_date(d.get("close_date"))
            if created and closed:
                cycles.append((closed - created).days)
        except Exception:
            pass
    avg_cycle = sum(cycles) / len(cycles) if cycles else 0

    # --- Losses ---
    lost_mrr_total = sum(float(d.get("mrr", 0) or 0) for d in close_lost)

    lost_by_product = defaultdict(lambda: {"count": 0, "mrr": 0})
    for d in close_lost:
        prod = d.get("product_group", "Unknown")
        lost_by_product[prod]["count"] += 1
        lost_by_product[prod]["mrr"] += float(d.get("mrr", 0) or 0)

    loss_reasons = defaultdict(int)
    for d in close_lost:
        reason = d.get("loss_reason", "Unknown")
        loss_reasons[reason] += 1

    # --- Product history ---
    product_history = defaultdict(lambda: {"count": 0, "total_mrr": 0, "dates": []})
    for s in services:
        prod = s.get("product_group", "Unknown")
        product_history[prod]["count"] += 1
        product_history[prod]["total_mrr"] += float(s.get("mrr", 0) or 0)
        sd = _parse_date(s.get("start_date"))
        if sd:
            product_history[prod]["dates"].append(sd)

    # Compute intervals and days_since_last
    for prod, info in product_history.items():
        dates = sorted(info["dates"])
        if len(dates) >= 2:
            intervals = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
            info["avg_interval_days"] = sum(intervals) / len(intervals)
        else:
            info["avg_interval_days"] = None
        info["days_since_last"] = (today - dates[-1]).days if dates else None
        del info["dates"]

    adoption_sequence = sorted(
        [(prod, min(s.get("start_date", "") for s in services if s.get("product_group") == prod))
         for prod in set(s.get("product_group", "Unknown") for s in services)],
        key=lambda x: x[1] if x[1] else ""
    )
    adoption_sequence = [p[0] for p in adoption_sequence]

    # Concentration
    product_concentration = {}
    if total_mrr > 0:
        for s in active_services:
            prod = s.get("product_group", "Unknown")
            if prod not in product_concentration:
                product_concentration[prod] = {"mrr": 0, "pct": 0}
            product_concentration[prod]["mrr"] += float(s.get("mrr", 0) or 0)
        for prod in product_concentration:
            product_concentration[prod]["pct"] = product_concentration[prod]["mrr"] / total_mrr

    concentration_risk = any(v["pct"] > 0.7 for v in product_concentration.values()) if product_concentration else False

    # --- Velocity ---
    all_dates = []
    for d in funnel:
        cd = _parse_date(d.get("created_date"))
        if cd:
            all_dates.append(cd)
    for d in close_lost:
        cd = _parse_date(d.get("close_date"))
        if cd:
            all_dates.append(cd)

    days_silent = 0
    if all_dates:
        most_recent = max(all_dates)
        days_silent = (today - most_recent).days

    # Simple velocity: compare deal count in last 6mo vs prior 6mo
    six_mo_ago = today - timedelta(days=180)
    twelve_mo_ago = today - timedelta(days=365)
    recent_deals = sum(1 for d in all_dates if d >= six_mo_ago)
    prior_deals = sum(1 for d in all_dates if twelve_mo_ago <= d < six_mo_ago)

    if recent_deals == 0 and days_silent > 180:
        velocity = "stalled"
    elif recent_deals > prior_deals:
        velocity = "accelerating"
    elif recent_deals < prior_deals:
        velocity = "decelerating"
    else:
        velocity = "stable"

    # --- Reps ---
    all_reps = set()
    for d in funnel:
        if d.get("rep"):
            all_reps.add(d["rep"])
    for d in close_lost:
        if d.get("rep"):
            all_reps.add(d["rep"])
    rep_count = len(all_reps)

    # Tenure
    tenure_months = 0
    cs = _parse_date(customer.get("customer_since"))
    if cs:
        tenure_months = max(0, (today.year - cs.year) * 12 + (today.month - cs.month))

    # --- NRR ---
    # Simplified: (current MRR + expansion - contraction - churn) / starting MRR
    starting_mrr = total_mrr + downgrade_mrr + sum(float(s.get("mrr", 0) or 0) for s in disconnects_list)
    nrr = total_mrr / starting_mrr if starting_mrr > 0 else 1.0

    # --- Health Score (CLAUDE.md canonical formula) ---
    total_service_count = max(len(services), 1)
    churn_rate = (len(disconnects_list) + len(downgrades_list)) / total_service_count
    product_count = len(product_concentration)

    h = compute_health_score(
        nrr=nrr,
        churn_rate=churn_rate,
        product_count=product_count,
        pipeline_mrr=pipeline_mrr,
        tenure_months=tenure_months,
    )
    h_score = h["health"]

    # --- Competitors ---
    competitors = set()
    for d in close_lost:
        if d.get("competitor_won"):
            competitors.add(d["competitor_won"])
    for d in funnel:
        if d.get("competitor"):
            competitors.add(d["competitor"])

    return {
        "customer_account": account_name,
        "mega_vertical": customer.get("mega_vertical", ""),
        "primary_rep": customer.get("primary_rep", ""),
        "total_arr": round(total_arr, 2),
        "total_mrr": round(total_mrr, 2),
        "active_pipeline_mrr": round(pipeline_mrr, 2),
        "active_pipeline_count": pipeline_count,
        "pipeline_by_stage": dict(pipeline_by_stage),
        "pipeline_by_product": dict(pipeline_by_product),
        "total_deals_won": total_won,
        "total_deals_lost": total_lost,
        "win_rate": round(win_rate, 4),
        "avg_sales_cycle_days": round(avg_cycle, 1),
        "lost_mrr_total": round(lost_mrr_total, 2),
        "lost_by_product": dict(lost_by_product),
        "loss_reasons": dict(loss_reasons),
        "disconnects": len(disconnects_list),
        "downgrades": len(downgrades_list),
        "downgrade_mrr": round(downgrade_mrr, 2),
        "net_revenue_retention": round(nrr, 4),
        "product_history": dict(product_history),
        "adoption_sequence": adoption_sequence,
        "product_concentration": product_concentration,
        "deal_velocity_trend": velocity,
        "days_since_last_activity": days_silent,
        "rep_count": rep_count,
        "relationship_tenure_months": tenure_months,
        "risk_score": h_score,
        "risk_level": health_level(h_score),
        "health": h_score,
        "health_level": health_level(h_score),
        "health_factors": h["factors"],
        "locations": locations,
        "quote_history": quotes,
        "competitor_landscape": list(competitors),
        "services": services,
        "funnel_deals": [d for d in funnel if d.get("stage", "").lower() not in ("closed won", "closed lost")],
        "close_lost_deals": close_lost,
    }


def _parse_date(val) -> date | None:
    if val is None:
        return None
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        val = val.strip()
        if not val:
            return None
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%Y/%m/%d", "%d-%b-%Y", "%B %d, %Y"):
            try:
                from datetime import datetime
                return datetime.strptime(val, fmt).date()
            except ValueError:
                continue
    return None


def _days_ago(d: date | None, today: date) -> int:
    if d is None:
        return 9999
    return (today - d).days
