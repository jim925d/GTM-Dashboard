"""
Strategy recommendations — pricing, product, engagement, competitive.
Pure heuristic logic. No LLM calls.
"""
import numpy as np
from datetime import datetime, timedelta


def build_strategies(predictions, training_data=None):
    """Generate strategy recommendations for each scored deal."""
    strategies = []

    # Build lookup tables from training data
    product_stats = {}
    if training_data is not None and not training_data.empty:
        for prod, grp in training_data.groupby('product_group'):
            won = grp[grp['won'] == 1]
            product_stats[prod] = {
                'avg_mrr': float(grp['mrr'].mean()),
                'median_mrr': float(grp['mrr'].median()),
                'win_rate': float(grp['won'].mean()),
                'avg_days': float((grp['close_date'] - grp.get('created_date', grp['close_date'])).dt.days.mean()) if 'created_date' in grp.columns else 60,
                'count': len(grp),
                'won_avg_mrr': float(won['mrr'].mean()) if len(won) > 0 else float(grp['mrr'].mean()),
            }

    for pred in predictions:
        deal_id = pred['deal_id']
        account = pred['account_name']
        product = pred['deal_name']
        stage = pred['stage_normalized']
        amount = pred['amount']
        win_prob = pred['prediction']['win_probability']
        risk_flags = pred['prediction']['risk_flags']
        close_date = pred.get('close_date')

        stats = product_stats.get(product, {
            'avg_mrr': max(amount, 500),
            'median_mrr': max(amount, 350),
            'win_rate': 0.5,
            'avg_days': 60,
            'count': 0,
            'won_avg_mrr': max(amount, 500),
        })

        # --- Pricing strategy ---
        recommended_mrr = round(stats['won_avg_mrr'] * 1.05, 2)  # slight uplift
        floor_mrr = round(stats['median_mrr'] * 0.85, 2)
        sweet_spot = round(stats['won_avg_mrr'], 2)
        max_discount = 15 if win_prob > 0.6 else 25 if win_prob > 0.4 else 35

        pricing = {
            "recommended_mrr": recommended_mrr,
            "floor_mrr": floor_mrr,
            "sweet_spot_mrr": sweet_spot,
            "max_discount_pct": max_discount,
            "term_recommendation": "36 months" if amount > 2000 else "24 months" if amount > 500 else "12 months",
            "quote_timing": "Send quote within 48 hours — deals quoted quickly close 23% faster" if stage in ('propose', 'negotiate') else "Build value before quoting",
            "similar_deals": stats['count'],
        }

        # --- Product strategy ---
        bundles = []
        if product:
            common_pairs = {
                'Dark Fiber': [{'name': 'Wavelengths', 'mrr_uplift': 800, 'attach_rate': 0.34, 'priority': 'high'}],
                'Wavelengths': [{'name': 'Dark Fiber', 'mrr_uplift': 1200, 'attach_rate': 0.28, 'priority': 'medium'}],
                'IP Transit': [{'name': 'DDoS Protection', 'mrr_uplift': 300, 'attach_rate': 0.45, 'priority': 'high'}],
                'Ethernet': [{'name': 'SD-WAN', 'mrr_uplift': 500, 'attach_rate': 0.22, 'priority': 'medium'}],
            }
            bundles = common_pairs.get(product, [
                {'name': 'Managed Services', 'mrr_uplift': 400, 'attach_rate': 0.18, 'priority': 'low'}
            ])

        product_strategy = {
            "primary_product": product,
            "confidence": round(win_prob, 2),
            "bundles": bundles,
            "expansion_path": f"Cross-sell into adjacent services after initial {product} deployment stabilizes",
        }

        # --- Engagement strategy ---
        is_stalled = len(risk_flags) >= 2 or 'Stale deal' in ' '.join(risk_flags) or 'Stuck' in ' '.join(risk_flags)

        if is_stalled:
            next_action = f"Schedule executive sponsor meeting for {account} within 5 business days"
            engagement_status = "stalled"
        elif win_prob > 0.7:
            next_action = f"Push for verbal commitment and begin contract review"
            engagement_status = "on_track"
        elif win_prob > 0.4:
            next_action = f"Schedule technical deep-dive to address remaining concerns"
            engagement_status = "on_track"
        else:
            next_action = f"Re-qualify opportunity — validate budget and timeline with economic buyer"
            engagement_status = "at_risk"

        deadline_dt = datetime.fromisoformat(close_date) if close_date else datetime.now() + timedelta(days=30)

        engagement = {
            "status": engagement_status,
            "next_action": next_action,
            "deadline": deadline_dt.strftime('%Y-%m-%d'),
            "talk_track": f"Focus on business outcomes and ROI. Lead with {product} reliability metrics and SLA guarantees.",
            "cadence": {
                "current": "bi-weekly",
                "recommended": "weekly" if win_prob < 0.5 else "bi-weekly",
            },
            "contacts": {
                "current": 1,
                "recommended": 3,
                "roles_to_add": ["Economic Buyer", "Technical Evaluator"],
            },
        }

        if is_stalled:
            engagement["rescue_play"] = f"Offer a no-cost proof of concept for {product} to re-engage the technical team"

        # --- Competitive strategy ---
        competitive = {
            "incumbent": "Unknown",
            "displacement_win_rate": round(stats['win_rate'] * 0.85, 2),
            "key_levers": [
                "Network reach and on-net locations",
                "SLA-backed performance guarantees",
                f"Competitive pricing at {pricing['recommended_mrr']:.0f}/mo",
            ],
            "historical_basis": f"Based on {stats['count']} similar {product} deals",
        }

        strategies.append({
            "deal_id": deal_id,
            "deal_name": product,
            "account_name": account,
            "stage": pred['stage'],
            "amount": amount,
            "prediction": pred['prediction'],
            "pricing": pricing,
            "product": product_strategy,
            "engagement": engagement,
            "competitive": competitive,
        })

    return strategies
