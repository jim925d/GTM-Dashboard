"""
Backtest Engine — historical predict vs actual comparison.
"""

import json
import os
from anthropic import Anthropic

SYSTEM_PROMPT = """You are a sales backtesting engine. Given account state AS OF a historical date, predict NEXT QUARTER. You do NOT know what happened after the cutoff.

OUTPUT ONLY JSON:
{
  "predicted_outcome":"<expanded|grew_modestly|stable|churned/contracted|dormant>",
  "predicted_action":"<what rep should do>",
  "predicted_strategy":"<aggressive_expand|strategic_nurture|defensive_protect|retention_emergency|winback|patience>",
  "churn_risk":"<high|medium|low|none>",
  "expansion_opportunity":"<high|medium|low|none>",
  "predicted_won_mrr_range":"<str>",
  "predicted_lost_mrr_range":"<str>",
  "key_signals":["<3-5 signals>"],
  "recommended_play":"<2-3 sent>",
  "confidence":<0-1>,
  "reasoning":"<2-3 sent>"
}"""


async def run_backtest(account_state: dict, cutoff_date: str) -> dict:
    """Run backtest prediction for an account as-of a cutoff date."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")

    client = Anthropic(api_key=api_key)

    context = f"""Given this account state AS OF {cutoff_date}, predict what happens NEXT QUARTER.
You must NOT use any knowledge of events after {cutoff_date}.

ACCOUNT: {account_state['customer_account']}
VERTICAL: {account_state['mega_vertical']}

AS OF {cutoff_date}:
- ARR: ${account_state['total_arr']:,.0f}
- MRR: ${account_state['total_mrr']:,.0f}
- Pipeline: {account_state['active_pipeline_count']} deals, ${account_state['active_pipeline_mrr']:,.0f}/mo
- Win Rate: {account_state['win_rate']:.1%}
- Risk Score: {account_state['risk_score']}/100
- Velocity: {account_state['deal_velocity_trend']}
- Days Silent: {account_state['days_since_last_activity']}
- Disconnects: {account_state['disconnects']}
- Lost MRR: ${account_state['lost_mrr_total']:,.0f}
- NRR: {account_state['net_revenue_retention']:.1%}

Products: {json.dumps(account_state.get('product_concentration', {}), default=str)}
Loss History: {json.dumps(account_state.get('close_lost_deals', [])[:5], default=str)}

Predict the next quarter outcome."""

    message = client.messages.create(
        model="claude-sonnet-4-5-20250514",
        max_tokens=2500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": context}],
    )

    response_text = message.content[0].text
    return _parse_json_response(response_text)


def score_backtest(predicted: dict, actual: dict) -> int:
    """Score a backtest prediction against actuals. Returns 0-100."""
    score = 0

    # Outcome match (40 pts)
    if predicted.get("predicted_outcome") == actual.get("outcome"):
        score += 40
    elif _outcome_close(predicted.get("predicted_outcome", ""), actual.get("outcome", "")):
        score += 20

    # Churn detection (30 pts)
    actual_churned = actual.get("outcome", "").startswith("churn")
    predicted_churn = predicted.get("churn_risk", "none") in ("high", "medium")
    if actual_churned and predicted_churn:
        score += 30
    elif not actual_churned and not predicted_churn:
        score += 30
    elif actual_churned and not predicted_churn:
        score += 0  # Missed churn — worst failure
    else:
        score += 15  # False alarm — better than missing

    # Expansion prediction (20 pts)
    actual_expanded = actual.get("outcome", "") in ("expanded", "grew_modestly")
    predicted_expansion = predicted.get("expansion_opportunity", "none") in ("high", "medium")
    if actual_expanded == predicted_expansion:
        score += 20
    else:
        score += 5

    # Confidence calibration (10 pts)
    confidence = predicted.get("confidence", 0.5)
    if 0.6 <= confidence <= 0.85:
        score += 10
    elif 0.4 <= confidence <= 0.95:
        score += 5

    return min(score, 100)


def _outcome_close(predicted: str, actual: str) -> bool:
    close_pairs = [
        ("expanded", "grew_modestly"),
        ("stable", "grew_modestly"),
        ("stable", "dormant"),
        ("churned/contracted", "dormant"),
    ]
    return (predicted, actual) in close_pairs or (actual, predicted) in close_pairs


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
    return {"error": "Failed to parse backtest response", "raw": text}
