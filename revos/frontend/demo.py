"""
RevOS Engine Demo
Generates realistic synthetic telecom sales data and runs the full engine.
Run: python demo.py
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine.main import RevOSEngine


def td(days):
    """timedelta helper that handles numpy int64."""
    return timedelta(days=int(days))


def generate_demo_data(n_deals=3000, seed=42):
    """Generate 5 years of realistic telecom sales data."""
    rng = np.random.RandomState(seed)

    products = ["Fiber", "Copper", "SD-WAN", "UCaaS", "Managed Services", "Security"]
    product_weights = [0.30, 0.15, 0.20, 0.15, 0.12, 0.08]
    product_win_rates = {
        "Fiber": 0.42, "Copper": 0.38, "SD-WAN": 0.35,
        "UCaaS": 0.44, "Managed Services": 0.51, "Security": 0.39,
    }
    product_amounts = {
        "Fiber": (4000, 15000), "Copper": (800, 3000),
        "SD-WAN": (3000, 12000), "UCaaS": (2000, 8000),
        "Managed Services": (5000, 20000), "Security": (2000, 9000),
    }

    reps = [
        "Sarah Chen", "Mike Rodriguez", "Jamie Park", "Alex Thompson",
        "Dana Williams", "Chris Nakamura", "Jordan Hayes", "Morgan Swift",
    ]
    rep_skill = {r: rng.uniform(0.7, 1.3) for r in reps}
    territories = ["West", "Central", "East", "Southeast", "Northeast"]
    stages = ["Discover", "Propose", "Negotiate", "Verbal Agreement"]

    stage_advance_base = {
        "Discover": 0.68, "Propose": 0.55,
        "Negotiate": 0.72, "Verbal Agreement": 0.88,
    }
    stage_days = {
        "Discover": (8, 25), "Propose": (10, 35),
        "Negotiate": (7, 22), "Verbal Agreement": (3, 12),
    }

    loss_reasons = [
        "Price", "Competitor", "No Decision", "Budget Frozen",
        "Timing", "Technical Fit", "Champion Left",
    ]

    start_date = datetime(2021, 1, 1)
    end_date = datetime(2026, 3, 1)
    date_range_days = (end_date - start_date).days

    records = []
    quote_records = []
    service_records = []

    for i in range(n_deals):
        product = rng.choice(products, p=product_weights)
        rep = rng.choice(reps)
        territory = rng.choice(territories)
        lo, hi = product_amounts[product]
        amount = round(float(rng.uniform(lo, hi)), 2)
        created = start_date + td(rng.randint(0, date_range_days))

        account_id = f"ACCT-{rng.randint(1000, 5000)}"
        account_name = f"Customer {account_id[-4:]}"
        opp_id = f"OPP-{i + 1000:04d}"
        base_win = product_win_rates[product] * rep_skill[rep]

        # Simulate deal progression
        current_date = created
        final_stage = "Discover"
        days_total = 0
        won = False

        for stage in stages:
            lo_d, hi_d = stage_days[stage]
            days_in = int(rng.randint(lo_d, hi_d + 1) / rep_skill[rep])
            current_date += td(days_in)
            days_total += days_in

            advance_prob = float(
                np.clip(stage_advance_base[stage] * rep_skill[rep]
                        * (1 + rng.normal(0, 0.1)), 0.1, 0.95)
            )
            if rng.random() < advance_prob:
                final_stage = stage
                if stage == "Verbal Agreement":
                    won = True
                    break
            else:
                final_stage = stage
                break

        close_date = current_date
        if close_date > datetime.now():
            status = "open"
            stage_out = final_stage
        elif won:
            status = "won"
            stage_out = "Closed Won"
            ratio = float(np.clip(rng.normal(0.92, 0.08), 0.75, 1.05))
            amount = round(amount * ratio, 2)
        else:
            status = "lost"
            stage_out = "Closed Lost"

        last_act = (
            close_date - td(rng.randint(0, 14)) if status != "open"
            else datetime.now() - td(rng.randint(0, 21))
        )

        records.append({
            "opportunity_id": opp_id,
            "opportunity_name": f"{product} — {account_name}",
            "account_name": account_name,
            "account_id": account_id,
            "stage": stage_out,
            "last_active_stage": final_stage,
            "amount": amount,
            "product_type": product,
            "close_date": close_date.strftime("%Y-%m-%d"),
            "created_date": created.strftime("%Y-%m-%d"),
            "rep_name": rep,
            "territory": territory,
            "days_in_pipeline": days_total,
            "probability": round(float(base_win * (0.5 + 0.5 * rng.random())), 2),
            "status": status,
            "loss_reason": rng.choice(loss_reasons) if status == "lost" else "",
            "last_activity_date": last_act.strftime("%Y-%m-%d"),
            "num_contacts": int(rng.choice([1, 1, 2, 2, 3, 3, 4, 5])),
        })

        # Quotes for ~70% of deals
        if rng.random() < 0.7:
            n_quotes = int(rng.choice([1, 1, 1, 2, 2, 3]))
            for q in range(n_quotes):
                disc = float(rng.choice([0, 0, 0, 0.03, 0.05, 0.05,
                                         0.08, 0.08, 0.10, 0.12, 0.15]))
                term = int(rng.choice([12, 24, 24, 36, 36, 36, 60]))
                esc = float(rng.choice([0, 0, 0.02, 0.03, 0.03, 0.05]))
                q_date = created + td(rng.randint(5, 30))
                quote_records.append({
                    "quote_id": f"Q-{i + 1000:04d}-{q + 1}",
                    "opportunity_id": opp_id,
                    "quote_amount": round(amount * (1 + disc + float(rng.normal(0, 0.05))), 2),
                    "discount_pct": disc,
                    "term_months": term,
                    "annual_escalator": esc,
                    "product_type": product,
                    "created_date": q_date.strftime("%Y-%m-%d"),
                    "revision_number": q + 1,
                })

        # Services for won deals
        if won and status == "won":
            service_records.append({
                "service_id": f"SVC-{i + 1000:04d}",
                "customer_id": account_id,
                "service_type": product,
                "mrr": amount,
                "install_date": (close_date + td(rng.randint(14, 60))).strftime("%Y-%m-%d"),
                "contract_end": (close_date + td(rng.choice([365, 730, 1095]))).strftime("%Y-%m-%d"),
                "status": "Active",
                "bandwidth": rng.choice(["100 Mbps", "500 Mbps", "1 Gbps", "10 Gbps"]) if product == "Fiber" else "",
            })
            # Cross-sell for ~35%
            if rng.random() < 0.35:
                addon = rng.choice([p for p in products if p != product])
                lo2, hi2 = product_amounts[addon]
                service_records.append({
                    "service_id": f"SVC-{i + 1000:04d}-A",
                    "customer_id": account_id,
                    "service_type": addon,
                    "mrr": round(float(rng.uniform(lo2, hi2)), 2),
                    "install_date": (close_date + td(rng.randint(60, 180))).strftime("%Y-%m-%d"),
                    "contract_end": (close_date + td(rng.randint(365, 1095))).strftime("%Y-%m-%d"),
                    "status": "Active",
                    "bandwidth": "",
                })

    os.makedirs("data", exist_ok=True)
    opps_df = pd.DataFrame(records)
    quotes_df = pd.DataFrame(quote_records)
    services_df = pd.DataFrame(service_records)
    opps_df.to_csv("data/opportunities.csv", index=False)
    quotes_df.to_csv("data/quotes.csv", index=False)
    services_df.to_csv("data/services.csv", index=False)

    print(f"\n{'='*60}")
    print("DEMO DATA GENERATED")
    print(f"{'='*60}")
    print(f"  Opportunities: {len(opps_df)}")
    won_n = (opps_df["status"] == "won").sum()
    lost_n = (opps_df["status"] == "lost").sum()
    open_n = (opps_df["status"] == "open").sum()
    print(f"    Won: {won_n}  |  Lost: {lost_n}  |  Open: {open_n}")
    print(f"  Quotes: {len(quotes_df)}  |  Services: {len(services_df)}")
    print(f"  Date range: {opps_df['created_date'].min()} → {opps_df['created_date'].max()}")
    print(f"  Products: {dict(opps_df['product_type'].value_counts())}")
    print(f"  Reps: {opps_df['rep_name'].nunique()}")
    return opps_df, quotes_df, services_df


def run_demo():
    # ---- Step 1: Generate data ----
    print("\n" + "="*60)
    print(" STEP 1: Generating 5 years of demo data")
    print("="*60)
    generate_demo_data(n_deals=3000)

    # ---- Step 2: Load ----
    print("\n" + "="*60)
    print(" STEP 2: Loading into engine")
    print("="*60)
    engine = RevOSEngine(data_dir="data", model_dir="models")
    summary = engine.load_data()
    print(json.dumps(summary, indent=2, default=str))

    # ---- Step 3: Train ----
    print("\n" + "="*60)
    print(" STEP 3: Training prediction + recommendation engines")
    print("="*60)
    train_summary = engine.train()
    print(json.dumps(train_summary, indent=2, default=str))

    # ---- Step 4: Score open deals ----
    print("\n" + "="*60)
    print(" STEP 4: Scoring all open deals")
    print("="*60)
    predictions = engine.score_all_deals()
    print(f"  Scored {len(predictions)} open deals\n")

    top = sorted(predictions, key=lambda x: x["win_probability"], reverse=True)
    print("  TOP 5 DEALS BY WIN PROBABILITY:")
    print(f"  {'ID':<12} {'Win%':>6} {'Range':>14} {'Close Date':>12} {'Flags':>6}")
    print(f"  {'-'*54}")
    for p in top[:5]:
        print(f"  {p['deal_id']:<12} "
              f"{p['win_probability']:5.0%}  "
              f"({p['win_prob_ci_low']:.0%}-{p['win_prob_ci_high']:.0%})  "
              f"{p['predicted_close_date'] or 'N/A':>10}  "
              f"{len(p['risk_flags']):>3}")

    print("\n  BOTTOM 5 (AT-RISK):")
    print(f"  {'ID':<12} {'Win%':>6} {'Flags':>6}")
    print(f"  {'-'*26}")
    for p in top[-5:]:
        print(f"  {p['deal_id']:<12} {p['win_probability']:5.0%}  {len(p['risk_flags']):>3}")
        for flag in p["risk_flags"][:2]:
            print(f"    ⚠ {flag}")

    # ---- Step 5: Full strategy card ----
    print("\n" + "="*60)
    print(" STEP 5: Deal Strategy Card")
    print("="*60)
    if predictions:
        mid = top[len(top) // 2]
        strat = engine.get_deal_strategy(mid["deal_id"])
        if strat:
            print(f"\n  ┌─────────────────────────────────────────────────")
            print(f"  │ {strat['deal_name']}")
            print(f"  │ {strat['stage']}  •  ${strat['amount']:,.0f}  •  {strat['product_type']}")
            print(f"  │ Win: {strat['prediction']['win_probability']:.0%}  "
                  f"({strat['prediction']['win_prob_ci_low']:.0%}-"
                  f"{strat['prediction']['win_prob_ci_high']:.0%})")
            print(f"  │ Close: {strat['prediction']['predicted_close_date']}")
            print(f"  ├─────────────────────────────────────────────────")

            pr = strat["strategy"]["pricing"]
            if pr.get("recommended_mrr"):
                print(f"  │ 💰 PRICING")
                print(f"  │   Recommended: ${pr['recommended_mrr']:,.0f}/mo")
                print(f"  │   Sweet discount: {pr['sweet_spot_discount']:.0%}  "
                      f"Max: {pr['max_discount']:.0%}")
                if pr.get("discount_floor_mrr"):
                    print(f"  │   Floor: ${pr['discount_floor_mrr']:,.0f}/mo")
                if pr.get("term_recommendation"):
                    print(f"  │   Term: {pr['term_recommendation']}")
                if pr.get("quote_timing_insight"):
                    print(f"  │   ⚡ {pr['quote_timing_insight']}")

            pd_rec = strat["strategy"]["product"]
            if pd_rec.get("primary_product"):
                print(f"  ├─────────────────────────────────────────────────")
                print(f"  │ 📦 PRODUCT")
                print(f"  │   Primary: {pd_rec['primary_product']} "
                      f"({pd_rec['primary_confidence']:.0%} match)")
                for b in pd_rec.get("bundles", [])[:3]:
                    print(f"  │   + {b['name']}  "
                          f"attach: {b['attach_rate']:.0%}  "
                          f"priority: {b['priority']}")
                if pd_rec.get("expansion_path"):
                    print(f"  │   Expansion: {pd_rec['expansion_path']}")

            eng = strat["strategy"]["engagement"]
            print(f"  ├─────────────────────────────────────────────────")
            print(f"  │ 🎯 ENGAGEMENT")
            print(f"  │   Urgency: {eng['urgency_score']:.1f}/10"
                  f"{'  ⚠ STALLED' if eng['is_stalled'] else ''}")
            print(f"  │   Next: {eng['next_action']}")
            print(f"  │   Deadline: {eng['next_deadline']}")
            print(f"  │   Contacts: need {eng['contacts_recommended']}  "
                  f"({eng['contacts_impact']})")
            if eng.get("cadence_recommended"):
                print(f"  │   Cadence: {eng['cadence_recommended']}")
            if eng.get("momentum_window"):
                print(f"  │   {eng['momentum_window']}")
            if eng.get("rescue_play"):
                print(f"  │   Rescue: {eng['rescue_play'][:80]}...")

            print(f"  │")
            hb = pr.get("historical_basis", {})
            print(f"  │ 📊 Based on: {hb.get('similar_deals', '?')} pricing deals, "
                  f"{pd_rec.get('historical_basis', {}).get('similar_deals', '?')} product matches")
            print(f"  └─────────────────────────────────────────────────")

    # ---- Step 6: Calibration ----
    print("\n" + "="*60)
    print(" STEP 6: Calibration Report Card")
    print("="*60)
    cal = engine.get_calibration_report()
    bl = cal.get("baseline")
    if bl:
        brier = bl["brier_score"]
        brier_grade = "✓ GOOD" if brier < 0.20 else "⚠ NEEDS WORK"
        print(f"\n  Brier Score:       {brier:.4f}  {brier_grade}  (target < 0.20)")
        print(f"  Calibration Error: {bl['calibration_error']:.4f}  (target < 0.05)")
        print(f"  AUC-ROC:           {bl['auc_roc']:.3f}  (target > 0.75)")
        print(f"  Sample size:       {bl['sample_size']} deals")

    curve = cal.get("calibration_curve", [])
    if curve:
        print(f"\n  CALIBRATION CURVE (predicted → actual):")
        for b in curve:
            bar_len = int(b["actual"] * 30)
            bar = "█" * bar_len + "░" * (30 - bar_len)
            delta = b["actual"] - b["predicted"]
            arrow = "↑" if delta > 0.03 else "↓" if delta < -0.03 else "="
            print(f"  {b['predicted']:5.0%} → {b['actual']:5.0%} {arrow}  "
                  f"|{bar}|  n={b['count']}")

    # ---- Step 7: Model inspection ----
    print("\n" + "="*60)
    print(" STEP 7: Model Parameters")
    print("="*60)
    params = engine.get_model_params()
    pred_params = params["prediction"]
    print(f"\n  Stage win rates (Bayesian posterior means):")
    for stage, vals in pred_params.get("stage_win_rates", {}).items():
        bar_len = int(vals["mean"] * 30)
        bar = "█" * bar_len
        print(f"    {stage:<20} {vals['mean']:5.0%}  |{bar}|  "
              f"(n={vals['count']}, α={vals['alpha']:.0f} β={vals['beta']:.0f})")

    print(f"\n  Product win rates:")
    for prod, vals in sorted(pred_params.get("product_win_rates", {}).items(),
                             key=lambda x: -x[1]["win_rate"]):
        print(f"    {prod:<20} {vals['win_rate']:5.0%}  (n={vals['count']})")

    print(f"\n  Rep win rates:")
    for rep, vals in sorted(pred_params.get("rep_win_rates", {}).items(),
                            key=lambda x: -x[1]["win_rate"]):
        print(f"    {rep:<20} {vals['win_rate']:5.0%}  (n={vals['count']})")

    sr = pred_params.get("size_ratios", {})
    if sr:
        print(f"\n  Deal size at close: {sr.get('median', 0):.1%} of quoted "
              f"(n={sr.get('count', 0)})")

    rec_params = params["recommendation"]
    dc = rec_params.get("discount_curves", {})
    if dc:
        print(f"\n  Discount patterns:")
        print(f"    Median: {dc.get('median', 0):.1%}  |  "
              f"P75: {dc.get('p75', 0):.1%}  |  "
              f"P90 (max effective): {dc.get('p90', 0):.1%}")
        cliff = dc.get("cliff", {})
        if cliff:
            print(f"    Win rate by discount bucket:")
            for bucket, rate in cliff.items():
                bar = "█" * int(rate * 25)
                print(f"      {bucket:<8} {rate:5.0%}  |{bar}|")

    ta = rec_params.get("term_analysis", {})
    if ta:
        print(f"\n  Term length win rates:")
        for months, vals in sorted(ta.items(), key=lambda x: int(x[0])):
            print(f"    {months:>3} months: {vals['win_rate']:5.0%}  (n={vals['count']})")

    pe = rec_params.get("product_expansion", {})
    if pe:
        print(f"\n  Product expansion:")
        print(f"    Avg products/customer: {pe.get('avg_products_per_customer', 0):.1f}")
        print(f"    Multi-product rate: {pe.get('pct_multi_product', 0):.0%}")
        co = pe.get("co_occurrence", {})
        if co:
            top_co = sorted(co.items(), key=lambda x: -x[1])[:8]
            print(f"    Top cross-sell paths:")
            for path, count in top_co:
                print(f"      {path:<30} ({count} customers)")

    # ---- Done ----
    print("\n" + "="*60)
    print(" ENGINE READY")
    print("="*60)
    print(f"\n  Start API:  uvicorn engine.api:app --reload --port 8000")
    print(f"\n  Key endpoints:")
    print(f"    GET  /api/strategies           All deal strategy cards")
    print(f"    GET  /api/strategies/{{id}}      Single deal strategy")
    print(f"    GET  /api/predictions           Win probabilities")
    print(f"    GET  /api/calibration           Model health dashboard")
    print(f"    POST /api/calibration/outcome   Record deal outcome")
    print(f"    POST /api/engine/load-and-train Reload data + retrain")
    print(f"    GET  /api/model/params          Inspect model weights")
    print()


if __name__ == "__main__":
    run_demo()
