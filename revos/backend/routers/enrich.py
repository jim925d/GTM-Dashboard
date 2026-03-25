"""
Enrichment router — Google Places + Claude AI location discovery.
"""

import os
import json
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import anthropic

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/engine/enrich", tags=["enrich"])


# ── Request schemas ──────────────────────────────────────────────

class GooglePlacesRequest(BaseModel):
    company_name: str
    hq: str | None = None


class ClaudeEnrichRequest(BaseModel):
    company_name: str
    industry: str | None = None
    hq: str | None = None
    website: str | None = None


# ── Google Places endpoint ───────────────────────────────────────

@router.post("/google-places")
async def enrich_google_places(req: GooglePlacesRequest):
    """Search Google Places API for company office locations."""
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_PLACES_API_KEY not configured")

    query = req.company_name
    if req.hq:
        query += f" {req.hq}"

    results = []

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Use Text Search (New) API
            resp = await client.post(
                "https://places.googleapis.com/v1/places:searchText",
                headers={
                    "X-Goog-Api-Key": api_key,
                    "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.types",
                },
                json={
                    "textQuery": f"{req.company_name} office",
                    "maxResultCount": 20,
                },
            )

            if resp.status_code != 200:
                logger.error(f"Google Places API error: {resp.status_code} {resp.text}")
                return {"results": [], "error": f"Google Places API returned {resp.status_code}"}

            data = resp.json()
            places = data.get("places", [])

            for place in places:
                loc = place.get("location", {})
                results.append({
                    "name": place.get("displayName", {}).get("text", req.company_name),
                    "address": place.get("formattedAddress", ""),
                    "lat": loc.get("latitude", 0),
                    "lng": loc.get("longitude", 0),
                    "type": _classify_place_type(place.get("types", [])),
                    "source": "google_places",
                })

    except httpx.TimeoutException:
        return {"results": [], "error": "Google Places API timed out"}
    except Exception as e:
        logger.exception("Google Places enrichment failed")
        return {"results": [], "error": str(e)}

    return {"results": results}


def _classify_place_type(types: list[str]) -> str:
    """Map Google place types to RevOS location types."""
    type_set = set(types)
    if type_set & {"data_center"}:
        return "Data Center"
    if type_set & {"corporate_office", "headquarters"}:
        return "HQ"
    if type_set & {"office", "establishment", "point_of_interest"}:
        return "Office"
    if type_set & {"store", "shopping_mall", "retail"}:
        return "Retail"
    if type_set & {"warehouse", "storage"}:
        return "Warehouse"
    if type_set & {"school", "university"}:
        return "Campus"
    if type_set & {"hospital", "health"}:
        return "Healthcare"
    return "Office"


# ── Claude AI endpoint ───────────────────────────────────────────

CLAUDE_SYSTEM_PROMPT = """You are a business location research assistant. Given a company name and optional context, identify their known office, data center, retail, and facility locations.

Return a JSON array of location objects. Each object must have:
- "name": short label (e.g. "NYC HQ", "Austin Data Center")
- "address": full street address including city, state, zip
- "lat": latitude as a number
- "lng": longitude as a number
- "type": one of "HQ", "Office", "Data Center", "Retail", "Warehouse", "Campus", "Healthcare", "Branch"

Only include locations you are confident about. Do not fabricate addresses — if you're unsure of the exact address, use the city center coordinates and note the city name in the address. Return between 3-15 locations. Return ONLY the JSON array, no other text."""


@router.post("/claude")
async def enrich_claude(req: ClaudeEnrichRequest):
    """Use Claude AI to research company locations."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    context_parts = [f"Company: {req.company_name}"]
    if req.industry:
        context_parts.append(f"Industry: {req.industry}")
    if req.hq:
        context_parts.append(f"HQ: {req.hq}")
    if req.website:
        context_parts.append(f"Website: {req.website}")

    user_prompt = "\n".join(context_parts) + "\n\nFind their office and facility locations."

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=CLAUDE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        raw_text = message.content[0].text.strip()

        # Extract JSON array from response
        if raw_text.startswith("["):
            locations = json.loads(raw_text)
        else:
            # Try to find JSON array in the response
            start = raw_text.find("[")
            end = raw_text.rfind("]") + 1
            if start >= 0 and end > start:
                locations = json.loads(raw_text[start:end])
            else:
                return {"results": [], "error": "Claude did not return valid location JSON"}

        results = []
        for loc in locations:
            results.append({
                "name": loc.get("name", "Unknown"),
                "address": loc.get("address", ""),
                "lat": float(loc.get("lat", 0)),
                "lng": float(loc.get("lng", 0)),
                "type": loc.get("type", "Office"),
                "source": "claude_ai",
            })

        return {"results": results}

    except anthropic.APIError as e:
        logger.exception("Claude API error")
        return {"results": [], "error": f"Claude API error: {e.message}"}
    except json.JSONDecodeError:
        return {"results": [], "error": "Failed to parse Claude response as JSON"}
    except Exception as e:
        logger.exception("Claude enrichment failed")
        return {"results": [], "error": str(e)}
