"""
Location enrichment service.
Google Places API + Claude AI for multi-source location discovery.
"""
import os
import json
import requests
import anthropic
from math import radians, cos, sin, asin, sqrt


def _haversine(lat1, lng1, lat2, lng2):
    """Distance in km between two lat/lng points."""
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return 2 * 6371 * asin(sqrt(a))


def deduplicate_locations(existing, discovered, threshold_km=0.5):
    """Remove discovered locations that are too close to existing ones."""
    unique = []
    seen_coords = set()

    for loc in existing:
        key = f"{loc['lat']:.3f},{loc['lng']:.3f}"
        seen_coords.add(key)

    for loc in discovered:
        key = f"{loc['lat']:.3f},{loc['lng']:.3f}"
        if key in seen_coords:
            continue

        # Check distance to all existing + already-accepted
        too_close = False
        for ex in existing + unique:
            if _haversine(loc['lat'], loc['lng'], ex['lat'], ex['lng']) < threshold_km:
                too_close = True
                break

        if not too_close:
            seen_coords.add(key)
            unique.append(loc)

    return unique


class LocationEnrichmentService:
    def __init__(self):
        self.google_api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")

    def search_google_places(self, company_name, hq_location=None):
        """Search Google Places API for company locations."""
        if not self.google_api_key:
            return {"error": "GOOGLE_PLACES_API_KEY not configured", "results": []}

        results = []

        # Text Search for the company
        url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
        params = {
            "query": company_name,
            "key": self.google_api_key,
        }

        try:
            resp = requests.get(url, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()

            if data.get("status") != "OK":
                return {
                    "error": f"Google Places API: {data.get('status')} - {data.get('error_message', '')}",
                    "results": [],
                }

            for place in data.get("results", []):
                loc = place.get("geometry", {}).get("location", {})
                if not loc:
                    continue

                # Determine location type from place types
                place_types = place.get("types", [])
                loc_type = "Office"
                if "data_center" in str(place_types).lower():
                    loc_type = "Data Center"
                elif "warehouse" in place_types:
                    loc_type = "Warehouse"
                elif "store" in place_types:
                    loc_type = "Retail"

                results.append({
                    "address": place.get("formatted_address", ""),
                    "name": place.get("name", ""),
                    "type": loc_type,
                    "lat": loc.get("lat", 0),
                    "lng": loc.get("lng", 0),
                    "confidence": min(0.95, (place.get("rating", 0) or 0) / 5 * 0.3 + 0.65),
                    "source": "Google Places",
                    "place_id": place.get("place_id", ""),
                })

            # Also search for "{company} office" and "{company} data center"
            for suffix in ["office", "data center"]:
                params2 = {
                    "query": f"{company_name} {suffix}",
                    "key": self.google_api_key,
                }
                try:
                    resp2 = requests.get(url, params=params2, timeout=10)
                    data2 = resp2.json()
                    for place in data2.get("results", [])[:5]:
                        loc2 = place.get("geometry", {}).get("location", {})
                        if not loc2:
                            continue
                        addr = place.get("formatted_address", "")
                        # Skip if we already have this address
                        if any(r["address"] == addr for r in results):
                            continue
                        results.append({
                            "address": addr,
                            "name": place.get("name", ""),
                            "type": "Data Center" if suffix == "data center" else "Office",
                            "lat": loc2.get("lat", 0),
                            "lng": loc2.get("lng", 0),
                            "confidence": min(0.90, (place.get("rating", 0) or 0) / 5 * 0.25 + 0.55),
                            "source": "Google Places",
                            "place_id": place.get("place_id", ""),
                        })
                except Exception:
                    pass

        except requests.RequestException as e:
            return {"error": f"Google Places request failed: {str(e)}", "results": []}

        return {"results": results[:15], "count": len(results)}

    def analyze_with_claude(self, company_name, industry=None, hq=None, website=None):
        """Use Claude to research and identify company locations."""
        if not self.anthropic_key:
            return {"error": "ANTHROPIC_API_KEY not configured", "results": []}

        client = anthropic.Anthropic(api_key=self.anthropic_key)

        context_parts = [f"Company: {company_name}"]
        if industry:
            context_parts.append(f"Industry: {industry}")
        if hq:
            context_parts.append(f"Headquarters: {hq}")
        if website:
            context_parts.append(f"Website: {website}")
        context = "\n".join(context_parts)

        prompt = f"""Research the following company and identify all known office locations, data centers, warehouses, and facilities.

{context}

Return a JSON array of locations. Each location should have:
- "address": full street address with city, state, zip
- "type": one of "HQ", "Office", "Data Center", "NOC", "Regional Office", "Warehouse", "Lab", "Sales Office"
- "lat": approximate latitude (float)
- "lng": approximate longitude (float)
- "confidence": your confidence 0.0-1.0 that this is a real, current location
- "notes": brief note about why you believe this location exists

Only include locations you have reasonable confidence about. Respond with ONLY the JSON array, no other text."""

        try:
            message = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )

            response_text = message.content[0].text.strip()

            # Extract JSON from response
            if response_text.startswith("["):
                locations = json.loads(response_text)
            elif "```" in response_text:
                json_block = response_text.split("```")[1]
                if json_block.startswith("json"):
                    json_block = json_block[4:]
                locations = json.loads(json_block.strip())
            else:
                locations = json.loads(response_text)

            results = []
            for loc in locations:
                results.append({
                    "address": loc.get("address", ""),
                    "type": loc.get("type", "Office"),
                    "lat": float(loc.get("lat", 0)),
                    "lng": float(loc.get("lng", 0)),
                    "confidence": float(loc.get("confidence", 0.7)),
                    "source": "Claude AI",
                    "notes": loc.get("notes", ""),
                })

            return {"results": results, "count": len(results)}

        except json.JSONDecodeError:
            return {"error": "Failed to parse Claude response as JSON", "results": []}
        except anthropic.APIError as e:
            return {"error": f"Anthropic API error: {str(e)}", "results": []}
        except Exception as e:
            return {"error": f"Claude analysis failed: {str(e)}", "results": []}

    def enrich_account(self, company_name, industry=None, hq=None, website=None, existing_locations=None):
        """Run full enrichment pipeline for an account."""
        existing = existing_locations or []

        # Run both sources
        google_result = self.search_google_places(company_name, hq)
        claude_result = self.analyze_with_claude(company_name, industry, hq, website)

        all_discovered = []
        source_status = {}

        # Google Places results
        if "error" in google_result and not google_result.get("results"):
            source_status["google_places"] = {
                "status": "error",
                "message": google_result["error"],
                "count": 0,
            }
        else:
            gp_results = google_result.get("results", [])
            all_discovered.extend(gp_results)
            source_status["google_places"] = {
                "status": "done",
                "message": f"Found {len(gp_results)} locations",
                "count": len(gp_results),
            }

        # Claude AI results
        if "error" in claude_result and not claude_result.get("results"):
            source_status["claude_ai"] = {
                "status": "error",
                "message": claude_result["error"],
                "count": 0,
            }
        else:
            ai_results = claude_result.get("results", [])
            all_discovered.extend(ai_results)
            source_status["claude_ai"] = {
                "status": "done",
                "message": f"Found {len(ai_results)} locations",
                "count": len(ai_results),
            }

        # Deduplicate against existing locations
        unique = deduplicate_locations(existing, all_discovered)

        # Mark all as new
        for loc in unique:
            loc["isNew"] = True
            loc["id"] = f"loc_{hash(loc['address']) % 100000}"

        return {
            "discovered": unique,
            "source_status": source_status,
            "total_raw": len(all_discovered),
            "total_unique": len(unique),
        }
