# GTM Intelligence Engine — Implementation Roadmap (from Feedback v1)

This roadmap maps feedback items to the app and separates **implement now** (UI + existing data) from **blocked** (data or decisions needed).

---

## Can implement now (no new SF fields)

| Item | Change | File / Area |
|------|--------|--------------|
| **Top Accounts count** | Show **top 10** instead of 4 | `gtm-intelligence-engine.jsx` — Briefing, `.slice(0,4)` → `.slice(0,10)` |
| **Pipeline: current month filter** | Filter Open Pipeline to opportunities with `close_date` in current month | Add `close_date` to quote shape; filter in Briefing by current month |
| **Urgent triggers** | Action items from defined triggers (see below) | Implemented: getActionItems() + Action items card in Briefing |
| **KPI labels** | "Book of Business" → support "Revenue" when data exists; keep "MRR" as fallback | Label + use revenue field if present in upload spec |
| **Opportunity click-through** | Pipeline row click → **Opportunity detail** (new view) instead of Account detail | New view: OpportunityDetail; route by opportunity id; Briefing links to it |
| **Opportunity Detail view (stub)** | New view: Current MRR, Quoted Amount, AI Opportunity, Last Touch, ICBs (placeholder) | New component + route; data from account + selected quote |

---

## Needs data model extension (upload spec + CSV)

| Item | Change | Data to add |
|------|--------|-------------|
| **Book of Business = Revenue** | Use total revenue per account when provided | CSV: `revenue` or `total_revenue` on Accounts; optional in parser |
| **Pipeline current month** | Filter by close date | CSV: `close_date` on Quotes; already in spec, ensure parsed |
| ~~Urgent triggers~~ | ~~Count by defined rules~~ | **Done.** Triggers: No contact 30+ days (all accounts); No contact 14+ days (accounts with open opp only); Stalled quote; Stalled ICB (created 14+ days ago); Renewal in 90 days; Renewal in 60 days (separate buckets). |
| **Top 10 scoring** | New formula (white space, addressable spend gap, location coverage) | Accounts: `total_revenue`, `target_addressable_spend`, `total_location_count`; Locations: already have serviced count |
| **Account header KPIs** | Purchased last 12mo, Churned last 12mo | Historical wins/churns in CSV or new tables |
| **Location map** | Map of locations with products per location | Locations: lat/long or geocode; product-per-location (new table or location-level products) |
| **ICB on Opportunity** | Show ICBs on opportunity detail | New table: ICBs with opportunity_id or quote id |

---

## Blocked (decisions / SF)

| Item | Blocker |
|------|--------|
| **Avg Score = new scoring model** | Definition of Target Addressable Spend; weights; data source |
| **Target Addressable Spend** | Product decision: manual vs. benchmark vs. third-party |
| **Products at location** | SF: does product-to-location mapping exist? |
| **ICB structure** | SF: custom object and fields |
| **Last Touch = human-only** | SF: activity type filtering; export must exclude automated |
| ~~Urgent trigger list~~ | **Done.** No contact 30+ days (all); No contact 14+ days (open opp only); Stalled quote; Stalled ICB (created 14+ days ago); Renewal in 90 days; Renewal in 60 days (two buckets). ICB: account.icbs[] with createdDate (optional; add via CSV/upload when SF ICB available). |

---

## Suggested order of work

1. **Phase 1 (quick wins)**  
   - Top 10 accounts in Briefing  
   - Pipeline filtered to current month (use `close_date` from quotes)  
   - KPI label tweaks and "Action items" for Urgent  
   - Add `close_date` to quote type and CSV parser if missing  

2. **Phase 2 (new views)**  
   - Opportunity Detail view (stub) with: account MRR, quoted amount, AI opportunity, last touch, ICB placeholder  
   - Briefing pipeline rows link to Opportunity Detail (pass account + quote/opportunity id)  

3. **Phase 3 (data + scoring)**  
   - Extend CSV upload for: `revenue`, `target_addressable_spend`, `total_location_count`, `close_date`  
   - Urgent count from rules (using contract_end, quote status, engagement gap)  
   - New scoring formula when addressable spend (or proxy) is available  

4. **Phase 4 (map + ICB)**  
   - Location map (after product-per-location and lat/long or geocoding decided)  
   - ICB section when SF structure is known  

---

## CSV/upload spec additions (for Phase 3)

Add to **HOW-TO-UPLOAD.md** and parser when ready:

- **Accounts:** `revenue` or `total_revenue`, `target_addressable_spend`, `total_location_count` (optional).
- **Quotes:** `close_date` (required for current-month filter).
- **Locations:** `lat`, `long` or `latitude`, `longitude` (optional, for map).
- **Product at location** (new table or columns): `account_id`, `address` or `location_id`, `product_name`, `mrr` (optional).

These can be added as optional columns so existing CSVs still work.
