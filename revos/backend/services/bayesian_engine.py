"""
Bayesian Prediction Engine — predicts WHAT and WHEN customers will buy.
"""

import json
import os
from anthropic import Anthropic

SYSTEM_PROMPT = """You are a Bayesian prediction engine for B2B sales. Predict WHAT a customer will buy and WHEN using Bayesian reasoning.

METHODOLOGY:
1. PRIORS: Historical purchase frequency, cadence, deal sizes, adoption sequence, seasonal patterns
2. EVIDENCE: Recent velocity, pipeline activity, loss patterns, disconnects/downgrades, days overdue vs cadence, cross-sell patterns, real-world signals, quote history, location on-net status
3. POSTERIORS: Updated probabilities for specific purchase events

OUTPUT ONLY JSON:
{
  "predictions": [{"product":"<name>","event_type":"<new_purchase|expansion|renewal|upgrade|churn>","probability":<0-1>,"expected_mrr":"<range>","expected_timing":"<string>","prior":<0-1>,"posterior":<0-1>,"key_evidence":["<2-3 factors>"],"evidence_direction":"<strengthened|weakened|unchanged>","confidence":<0-1>}],
  "cross_sell_opportunities": [{"product":"<not purchased>","probability":<0-1>,"reasoning":"<1-2 sent>","trigger":"<what converts>"}],
  "churn_predictions": [{"product":"<at risk>","churn_probability":<0-1>,"expected_timing":"<string>","warning_signals":["<list>"],"preventive_action":"<string>"}],
  "next_purchase_summary":"<2-3 sent>",
  "portfolio_health":"<growing|stable|contracting|at_risk>",
  "expected_12mo_arr_change":"<string>",
  "bayesian_reasoning":"<3-4 sent>"
}"""


async def run_bayesian_prediction(account_state: dict) -> dict:
    """Run Bayesian prediction for an account."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")

    client = Anthropic(api_key=api_key)

    # Build context from account state
    context = _build_context(account_state)

    message = client.messages.create(
        model="claude-sonnet-4-5-20250514",
        max_tokens=2500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": context}],
    )

    response_text = message.content[0].text
    # Extract JSON from response
    return _parse_json_response(response_text)


def _build_context(state: dict) -> str:
    return f"""Analyze this B2B account and predict what they will buy next and when.

ACCOUNT: {state['customer_account']}
VERTICAL: {state['mega_vertical']}
REP: {state['primary_rep']}

FINANCIALS:
- Total ARR: ${state['total_arr']:,.0f}
- Total MRR: ${state['total_mrr']:,.0f}
- NRR: {state['net_revenue_retention']:.1%}

PIPELINE:
- Active deals: {state['active_pipeline_count']} ({json.dumps(state['pipeline_by_stage'])})
- Pipeline MRR: ${state['active_pipeline_mrr']:,.0f}/mo
- By product: {json.dumps(state['pipeline_by_product'])}

HISTORY:
- Won: {state['total_deals_won']} | Lost: {state['total_deals_lost']} | Win Rate: {state['win_rate']:.1%}
- Avg sales cycle: {state['avg_sales_cycle_days']:.0f} days
- Products: {json.dumps(state['product_concentration'])}
- Adoption sequence: {state['adoption_sequence']}

RISK SIGNALS:
- Risk score: {state['risk_score']}/100 ({state['risk_level']})
- Days silent: {state['days_since_last_activity']}
- Velocity: {state['deal_velocity_trend']}
- Disconnects: {state['disconnects']}
- Downgrades: {state['downgrades']} (${state['downgrade_mrr']:,.0f})
- Lost MRR: ${state['lost_mrr_total']:,.0f}
- Lost by product: {json.dumps(state['lost_by_product'])}
- Loss reasons: {json.dumps(state['loss_reasons'])}
- Rep count: {state['rep_count']}

CLOSE-LOST DETAILS:
{json.dumps(state['close_lost_deals'][:10], indent=2, default=str)}

LOCATIONS:
- Total: {len(state['locations'])}
- On-net: {sum(1 for l in state['locations'] if l.get('on_net_status','').lower() == 'on-net')}
- Near-net: {sum(1 for l in state['locations'] if l.get('on_net_status','').lower() == 'near-net')}
- Off-net: {sum(1 for l in state['locations'] if l.get('on_net_status','').lower() == 'off-net')}

COMPETITORS: {state['competitor_landscape']}

Provide Bayesian predictions with explicit prior → posterior updates."""


def _parse_json_response(text: str) -> dict:
    """Extract JSON from model response."""
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try extracting JSON block
    import re
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {"error": "Failed to parse prediction response", "raw": text}
