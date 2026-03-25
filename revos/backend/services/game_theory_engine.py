"""
Game Theory Negotiation Engine — per-deal strategic analysis.
"""

import json
import os
from anthropic import Anthropic

SYSTEM_PROMPT = """You are a game theory negotiation engine for a specific B2B deal. Model as strategic game: SELLER, BUYER, COMPETITOR.

METHODOLOGY: Players/strategies, payoff matrix, Nash equilibrium, sequential game, information asymmetry.

OUTPUT ONLY JSON:
{
  "deal_assessment":{"win_probability":<0-1>,"deal_value_range":"<str>","buyer_urgency":"<high|medium|low>","competitive_intensity":"<fierce|moderate|light|none>","information_advantage":"<seller|neutral|buyer>"},
  "optimal_strategy":{"name":"<str>","type":"<price_hold|strategic_discount|bundle_lock|accelerate_close|value_reframe|controlled_concession>","rationale":"<2-3 sent>"},
  "nash_equilibrium":"<2-3 sent>",
  "negotiation_sequence":[{"move":1,"actor":"<seller|buyer|competitor>","action":"<str>","expected_response":"<str>","timing":"<str>"}],
  "pricing_strategy":{"anchor_price":"<str>","floor_price":"<str>","discount_triggers":["<conditions>"],"value_levers":["<non-price value>"],"bundle_opportunities":["<bundles>"]},
  "concession_playbook":[{"if_buyer_says":"<str>","respond_with":"<str>","concession_cost":"<str>","concession_value":"<str>"}],
  "competitive_counter":{"likely_competitor_offer":"<str>","your_differentiation":"<str>","trap_to_set":"<str>"},
  "closing_signals":["<buying signals>"],
  "walk_away_triggers":["<disengage conditions>"],
  "expected_outcome":"<str>",
  "talk_track":"<2-3 sent>"
}"""


async def run_game_theory(account_state: dict, deal: dict) -> dict:
    """Run game theory analysis for a specific deal."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")

    client = Anthropic(api_key=api_key)
    context = _build_context(account_state, deal)

    message = client.messages.create(
        model="claude-sonnet-4-5-20250514",
        max_tokens=2500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": context}],
    )

    response_text = message.content[0].text
    return _parse_json_response(response_text)


def _build_context(state: dict, deal: dict) -> str:
    return f"""Analyze this specific deal using game theory.

ACCOUNT: {state['customer_account']} ({state['mega_vertical']})
TOTAL ARR: ${state['total_arr']:,.0f} | NRR: {state['net_revenue_retention']:.1%}
RISK: {state['risk_score']}/100 | VELOCITY: {state['deal_velocity_trend']}

THIS DEAL:
- Product: {deal.get('product_group', 'Unknown')}
- MRR: ${float(deal.get('mrr', 0)):,.0f}/mo
- Stage: {deal.get('stage', 'Unknown')}
- Forecast: {deal.get('forecast_category', 'Unknown')}
- Close Date: {deal.get('close_date', 'Unknown')}
- Type: {deal.get('type', 'Unknown')}
- Competitor: {deal.get('competitor', 'None known')}

OTHER ACTIVE DEALS: {len(state.get('funnel_deals', []))} total, ${state['active_pipeline_mrr']:,.0f}/mo pipeline

ACCOUNT CONTEXT:
- Win Rate: {state['win_rate']:.1%} ({state['total_deals_won']}W / {state['total_deals_lost']}L)
- Avg Cycle: {state['avg_sales_cycle_days']:.0f} days
- Days Silent: {state['days_since_last_activity']}
- Disconnects: {state['disconnects']} | Downgrades: {state['downgrades']}
- Rep Count: {state['rep_count']} (relationship stability)

LOSS HISTORY:
{json.dumps(state['close_lost_deals'][:5], indent=2, default=str)}

COMPETITORS SEEN: {state['competitor_landscape']}

QUOTE HISTORY:
{json.dumps(state.get('quote_history', [])[:5], indent=2, default=str)}

Model this as a strategic game and recommend the optimal negotiation strategy."""


def _parse_json_response(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    import re
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {"error": "Failed to parse game theory response", "raw": text}
