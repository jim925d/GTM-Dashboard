"""
Signal Intelligence Engine — web scrub for company news and sales signals.
"""

import json
import os
from anthropic import Anthropic

SYSTEM_PROMPT = """You are a sales signal detection engine. Search the web for recent company news. Extract actionable sales signals.

OUTPUT ONLY JSON:
{
  "signals":[{"headline":"<str>","signal_type":"<funding|expansion|leadership|acquisition|technology|regulatory|financial|risk>","urgency":"<act_now|this_week|this_month|monitor>","sales_impact":"<1-2 sent>","recommended_action":"<1 sent>","confidence":<0-1>}],
  "company_summary":"<2-3 sent>",
  "overall_signal_strength":"<strong|moderate|weak|none>",
  "entity_match_confidence":<0-1>
}"""


async def run_signal_intelligence(account_state: dict) -> dict:
    """Run signal intelligence for an account using web search."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")

    client = Anthropic(api_key=api_key)
    company_name = account_state["customer_account"]
    vertical = account_state.get("mega_vertical", "")

    context = f"""Search for recent news about {company_name} ({vertical} company).
Find actionable sales signals: funding, expansion, leadership changes, acquisitions, technology shifts, regulatory updates, financial results, or risk indicators.

Current relationship context:
- ARR: ${account_state['total_arr']:,.0f}
- Products: {list(account_state.get('product_concentration', {}).keys())}
- Risk: {account_state['risk_score']}/100
- Days since last activity: {account_state['days_since_last_activity']}"""

    message = client.messages.create(
        model="claude-sonnet-4-5-20250514",
        max_tokens=2500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": context}],
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
    )

    # Process response — may have multiple content blocks
    response_text = ""
    for block in message.content:
        if hasattr(block, "text"):
            response_text += block.text

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
    return {"error": "Failed to parse signal response", "raw": text}
