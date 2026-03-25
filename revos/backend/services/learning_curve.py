"""
Learning Curve Engine — accuracy vs data volume analysis.
Simulates how prediction accuracy improves with more training data.
"""

import json
import os
from anthropic import Anthropic


async def run_learning_curve(account_state: dict, backtest_results: list[dict] = None) -> dict:
    """Analyze how prediction accuracy scales with data volume for this account."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")

    client = Anthropic(api_key=api_key)

    total_deals = account_state["total_deals_won"] + account_state["total_deals_lost"]
    backtest_summary = ""
    if backtest_results:
        backtest_summary = f"\nBacktest results: {json.dumps(backtest_results[:10], default=str)}"

    context = f"""Analyze the learning curve for predictions on this account.

ACCOUNT: {account_state['customer_account']}
Total deals (won + lost): {total_deals}
Products: {list(account_state.get('product_concentration', {}).keys())}
Win rate: {account_state['win_rate']:.1%}
{backtest_summary}

Estimate accuracy at these data checkpoints: 5, 10, 15, 20, 25, 30, 35, 40, 50, 60 deals.
Consider: overall accuracy, churn detection accuracy, expansion prediction accuracy, outcome match accuracy.

OUTPUT ONLY JSON:
{{
  "checkpoints": [{{"deals": <int>, "accuracy": <0-100>, "churn": <0-100>, "expand": <0-100>, "outcome": <0-100>}}],
  "min_viable_dataset": <int>,
  "peak_accuracy": <0-100>,
  "peak_at_deals": <int>,
  "trend": "<improving|plateau|declining>",
  "analysis": "<2-3 sent>"
}}"""

    message = client.messages.create(
        model="claude-sonnet-4-5-20250514",
        max_tokens=1500,
        messages=[{"role": "user", "content": context}],
    )

    response_text = message.content[0].text
    return _parse_json_response(response_text)


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
    return {"error": "Failed to parse learning curve response", "raw": text}
