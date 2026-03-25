# RevOS Platform — Master Build Specification
# Paste this entire document as the prompt to Claude Code in VS Code.
# It contains everything needed to build the full platform.

## WHAT THIS IS

RevOS is a multi-model AI orchestration platform for B2B sales. It uses Bayesian analysis to predict what and when customers will buy, and game theory to optimize deal negotiation. Currently focused on telecom infrastructure (wavelengths, dark fiber, IP services, colocation) but the architecture is industry-agnostic.

---

## ARCHITECTURE

```
Frontend: React + Vite + Tailwind + Recharts + Leaflet (map)
Backend:  FastAPI (Python) + Anthropic Claude API
Database: PostgreSQL (SQLAlchemy ORM) — or SQLite for dev
Auth:     API key for now
Deploy:   Vercel (frontend) + Railway/Render (backend)
```

### Project Structure

```
revos/
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.jsx        # Left sidebar — account list
│   │   │   │   ├── TopNav.jsx         # Top tab navigation (8 pages)
│   │   │   │   └── Header.jsx
│   │   │   ├── shared/
│   │   │   │   ├── Badge.jsx
│   │   │   │   ├── Stat.jsx
│   │   │   │   ├── ProbBar.jsx
│   │   │   │   └── ChartTheme.js
│   │   │   └── upload/
│   │   │       └── CSVUploader.jsx    # Drag-drop CSV, smart header detection
│   │   ├── pages/
│   │   │   ├── Overview.jsx
│   │   │   ├── Locations.jsx          # Map with on-net/near-net/off-net pins
│   │   │   ├── Predictions.jsx        # Bayesian predictions
│   │   │   ├── Deals.jsx             # Per-deal game theory
│   │   │   ├── Signals.jsx           # Web scrub signal intelligence
│   │   │   ├── Losses.jsx            # Loss/disconnect/downgrade analysis
│   │   │   ├── Backtest.jsx          # Historical predict vs actual
│   │   │   └── Learning.jsx          # Accuracy vs data volume curve
│   │   ├── hooks/
│   │   │   ├── useAccounts.js
│   │   │   └── useClaudeAPI.js
│   │   ├── lib/
│   │   │   ├── normalize.js           # CSV parsing + field mapping
│   │   │   ├── accountBuilder.js      # Build account state from raw data
│   │   │   └── constants.js
│   │   └── demo/
│   │       └── demoData.js            # Embedded telecom demo data
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── main.py
│   ├── models/
│   │   ├── schemas.py                 # Pydantic models
│   │   └── database.py                # SQLAlchemy models
│   ├── routers/
│   │   ├── ingest.py                  # CSV upload + multi-tab parsing
│   │   ├── accounts.py
│   │   ├── analyze.py                 # Claude orchestration
│   │   └── signals.py
│   ├── services/
│   │   ├── normalizer.py
│   │   ├── account_builder.py
│   │   ├── bayesian_engine.py
│   │   ├── game_theory_engine.py
│   │   ├── signal_engine.py
│   │   ├── backtest_engine.py
│   │   └── learning_curve.py
│   ├── requirements.txt
│   └── .env.example
├── scripts/
│   └── revos-anonymize.py
└── README.md
```

---

## DATA MODEL — 6 INPUT TABLES

### 1. Customers (one row per account)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| customer_account | TEXT | YES | Primary key. Must match across ALL tables. |
| account_id | TEXT | No | CRM account ID |
| mega_vertical | TEXT | YES | Industry: Carrier, Software & Tech, Healthcare, Energy, Financial Services, Government, Education, Transportation |
| sub_vertical | TEXT | No | Sub-industry |
| primary_rep | TEXT | YES | Assigned sales rep |
| rep_email | TEXT | No | Rep email |
| account_manager | TEXT | No | Post-sale AM |
| executive_sponsor | TEXT | No | Customer champion |
| customer_since | DATE | No | When they became a customer |
| contract_end_date | DATE | No | Master contract expiration |
| annual_revenue | FLOAT | No | Customer's company revenue |
| employee_count | INT | No | Customer headcount |
| parent_company | TEXT | No | Parent if subsidiary |
| territory | TEXT | No | Sales territory |
| segment | TEXT | No | Enterprise / Mid-Market / SMB |
| account_tier | TEXT | No | Strategic / Growth / Maintain / Harvest |

### 2. Funnel (active pipeline — NOT yet won or lost)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| customer_account | TEXT | YES | FK to Customers |
| opportunity_name | TEXT | No | Deal name |
| product_group | TEXT | YES | Product family |
| mrr | FLOAT | YES | Monthly recurring revenue |
| total_contract_value | FLOAT | No | Full contract value |
| stage | TEXT | YES | Discover, Design Solution, Propose, Negotiate |
| forecast_category | TEXT | YES | Not In Forecast, Longshot, Best Case, Commit |
| close_date | DATE | YES | Expected close |
| created_date | DATE | YES | When deal entered CRM |
| type | TEXT | YES | New Service, Positive Re-Rate/Move/Change, Renewal |
| rep | TEXT | No | Rep working deal |
| competitor | TEXT | No | Known competitor |
| next_step | TEXT | No | Next action |

### 3. Close Lost (deals pursued but lost)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| customer_account | TEXT | YES | FK |
| opportunity_name | TEXT | No | Deal name |
| product_group | TEXT | YES | Product lost |
| mrr | FLOAT | YES | MRR that would have been won |
| total_contract_value | FLOAT | No | Full value |
| close_date | DATE | YES | Date lost |
| created_date | DATE | YES | Date created |
| type | TEXT | YES | Deal type |
| stage_lost_from | TEXT | No | Stage when lost |
| loss_reason | TEXT | YES | Price, Competitor, No Decision, Budget, Technical, Timing, Relationship |
| competitor_won | TEXT | No | Which competitor won |
| rep | TEXT | No | Rep |
| loss_notes | TEXT | No | Free-form detail — GOLD for the AI |

### 4. Quotes (proposals sent)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| customer_account | TEXT | YES | FK |
| quote_number | TEXT | No | Quote reference |
| product_group | TEXT | YES | Product quoted |
| quoted_mrr | FLOAT | YES | Monthly price quoted |
| quoted_tcv | FLOAT | No | Total contract value |
| term_months | INT | No | Contract term |
| quote_date | DATE | YES | When sent |
| expiration_date | DATE | No | Expiry |
| quote_status | TEXT | YES | Draft, Sent, Accepted, Rejected, Expired, Revised |
| discount_pct | FLOAT | No | % off list |
| list_mrr | FLOAT | No | Rack rate before discount |
| competitor_quote | FLOAT | No | Known competitor price |

### 5. Services (active + recently disconnected installed base)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| customer_account | TEXT | YES | FK |
| service_id | TEXT | No | Circuit/service ID |
| product_group | TEXT | YES | Product family |
| product_detail | TEXT | No | Specific product description |
| mrr | FLOAT | YES | Current monthly revenue |
| service_status | TEXT | YES | Active, Pending Install, Pending Disconnect, Disconnected, Suspended |
| start_date | DATE | YES | When service started |
| contract_end_date | DATE | No | Expiry |
| term_months | INT | No | Contract term |
| auto_renew | BOOL | No | Auto-renew? |
| location_a | TEXT | No | A-side location |
| location_z | TEXT | No | Z-side location |
| bandwidth | TEXT | No | Capacity |
| last_change_date | DATE | No | Last modification |
| change_type | TEXT | No | Upgrade, Downgrade, Move, Disconnect |

### 6. Locations (customer sites)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| customer_account | TEXT | YES | FK |
| location_name | TEXT | YES | Site name |
| location_type | TEXT | YES | HQ, Data Center, Branch, Warehouse, POP, Colo, Tower, Hospital, Office |
| address | TEXT | No | Street address |
| city | TEXT | No | City |
| state | TEXT | No | State |
| zip | TEXT | No | Zip |
| latitude | FLOAT | No | For map (geocode if missing) |
| longitude | FLOAT | No | For map |
| on_net_status | TEXT | YES | On-Net, Near-Net, Off-Net |
| building_access | TEXT | No | Yes, No, Pending |
| active_services | INT | No | Count of services at this site |
| monthly_revenue | FLOAT | No | MRR from this site |
| fiber_lit | BOOL | No | Fiber in building? |
| location_notes | TEXT | No | Notes |

---

## ACCOUNT STATE BUILDER

Join all 6 tables per customer to compute a derived AccountState:

```
total_arr, total_mrr, active_pipeline_mrr, active_pipeline_count,
pipeline_by_stage, pipeline_by_product,
total_deals_won, total_deals_lost, win_rate, avg_sales_cycle_days,
lost_mrr_total, lost_by_product, loss_reasons,
disconnects, downgrades, downgrade_mrr, net_revenue_retention,
product_history (per product: count, total_mrr, avg_interval_days, days_since_last),
adoption_sequence, product_concentration,
deal_velocity_trend, days_since_last_activity,
primary_rep, rep_count, relationship_tenure_months,
risk_score (composite 0-100), risk_level (critical/high/moderate/low),
locations (with on_net/near_net/off_net counts),
quote_history (discount acceptance patterns),
competitor_landscape (competitors from losses + funnel)
```

### Risk Score Formula:
- Days silent >365: +30, >180: +20, >90: +12
- Recent losses >=3: +25, >=1: +15. Lost MRR >5000: +10
- Disconnects >=2: +15, >=1: +8
- Downgrade MRR >2000: +12, >0: +6
- Velocity stalled: +12, decelerating: +6
- Rep count >10: +8
- Concentration risk high: +5

### Deal Type Classification:
- "New Service" = net new revenue (positive MRR)
- "Positive Re-Rate/Move/Change" = expansion (positive or zero MRR)
- "Negative Re-Rate/Move/Change" = downgrade (NEGATIVE MRR)
- "Negative Re-Rate/Disconnect" = service removal (ZERO MRR, strongest churn signal)
- "Close Lost" = competitive loss (from Close Lost table)

### Field Mapping (accept any of these as column names, case-insensitive):
```
customer account, account name, company → customer_account
total mrr, mrr, monthly recurring revenue, total mrr & mar (converted) → mrr
forecast category, forecast → forecast_category
stage, deal stage → stage
close date → close_date
type, deal type, opportunity type → deal_type
product group, product family, product → product_group
reporting segment, segment → reporting_segment
created date, create date → created_date
total contract value, amount, tcv → total_contract_value
created by, rep, owner, deal owner → created_by
mega vertical, vertical, industry → mega_vertical
loss reason → loss_reason
competitor, competitor won → competitor_won
on-net status, on net status → on_net_status
latitude, lat → latitude
longitude, lng, lon → longitude
```

### Smart CSV Header Detection:
Scan first 20 rows for the row containing "Customer Account" or 3+ known field names. Use that as headers. Skip everything above. Handle Excel title rows, BOM, encoding issues.

---

## AI ENGINE PROMPTS

### Engine 1: Bayesian Prediction

System prompt:
```
You are a Bayesian prediction engine for B2B sales. Predict WHAT a customer will buy and WHEN using Bayesian reasoning.

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
}
```

### Engine 2: Game Theory Negotiation (per-deal)

System prompt:
```
You are a game theory negotiation engine for a specific B2B deal. Model as strategic game: SELLER, BUYER, COMPETITOR.

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
}
```

### Engine 3: Signal Intelligence

System prompt:
```
You are a sales signal detection engine. Search the web for recent company news. Extract actionable sales signals.

OUTPUT ONLY JSON:
{
  "signals":[{"headline":"<str>","signal_type":"<funding|expansion|leadership|acquisition|technology|regulatory|financial|risk>","urgency":"<act_now|this_week|this_month|monitor>","sales_impact":"<1-2 sent>","recommended_action":"<1 sent>","confidence":<0-1>}],
  "company_summary":"<2-3 sent>",
  "overall_signal_strength":"<strong|moderate|weak|none>",
  "entity_match_confidence":<0-1>
}
```

API call MUST include: `tools: [{"type": "web_search_20250305", "name": "web_search"}]`

### Engine 4: Backtest

System prompt:
```
You are a sales backtesting engine. Given account state AS OF a historical date, predict NEXT QUARTER. You do NOT know what happened after the cutoff.

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
}
```

Scoring: outcome match (40pts) + churn detection (30pts) + expansion prediction (20pts) + confidence (10pts) = 0-100.

### Claude API Config:
```
model: "claude-sonnet-4-5-20250514"
max_tokens: 2500
```

---

## FRONTEND DESIGN SYSTEM

```
Theme: Dark (GitHub-dark, NOT generic purple gradient)
Background:  #06080F
Surface:     #0D1117
Card:        #161B22
Card Hover:  #1C2333
Border:      #21262D
Border Light:#30363D
Text:        #E6EDF3
Text Mid:    #8B949E
Text Dim:    #484F58
Cyan:        #58A6FF
Green:       #3FB950
Red:         #F85149
Yellow:      #D29922
Orange:      #DB6D28
Purple:      #BC8CFF
Blue:        #388BFD
Teal:        #2DD4BF
Pink:        #F778BA
Lime:        #A3E635

Fonts: Inter (body), JetBrains Mono (data/numbers/labels/badges)
Charts: Recharts with dark theme matching above colors
Map: Leaflet with CartoDB dark tiles (free, no API key needed)
     Tile URL: https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png
```

### Layout: Left sidebar (accounts) + Top tabs (pages)

```
┌─────────────────────────────────────────────┐
│ RevOS  │  BAYESIAN · GAME THEORY · SIGNALS  │
├─────────┬───────────────────────────────────┤
│         │ [◉ Overview] [📍 Locations]       │
│ Account │ [📊 Predictions] [♟ Deals]        │
│ List    │ [📡 Signals] [⚠ Losses]          │
│         │ [⏪ Backtest] [📈 Learning]       │
│ - Name  ├───────────────────────────────────┤
│ - ARR   │                                   │
│ - Risk  │    Page Content                   │
│ - Vel.  │                                   │
│ - Losses│                                   │
└─────────┴───────────────────────────────────┘
```

---

## DEMO DATA (embed in frontend)

### Customer 1 — Carrier (healthy, expanding)
```
ARR: $515,299 | MRR: $42,941 | Pipeline: 14 deals, $34,639/mo
Products: Wavelengths - Long Haul, Dark Fiber - Metro
Won: 22 | Lost: 4 | Win Rate: 84.6% | NRR: 112%
Velocity: accelerating | Risk: 18/100 (moderate) | Silent: 14 days
Rep: William Good | Reps: 11 | Tenure: 62 months
Disconnects: 2 | Downgrades: 2 ($2,050)

8 Locations (Colorado):
- Denver POP (On-Net, $20K/mo, Wavelengths)
- Centennial Medical Campus (On-Net, $12.5K/mo, Dark Fiber)
- Springs Campus (On-Net, $10K/mo, Wavelengths)
- DIA Medical Facility (On-Net, $4.5K/mo, Wavelengths)
- Pueblo Clinic (Near-Net, fiber within 800ft)
- Fort Collins Medical (Near-Net)
- Boulder Research Lab (Near-Net)
- Grand Junction Clinic (Off-Net, new build required)

Bayesian Predictions:
- Dark Fiber expansion: prior 35% → posterior 78% (2 Negotiate deals, accelerating velocity)
- IP Services cross-sell: prior 15% → posterior 42% (Carrier buys IP 87% of time, gap)
- Wavelength expansion: prior 40% → posterior 65% (4 Discover deals, capacity buildout)
- Wavelength churn risk: 15% (3 recent losses, pricing pressure)

Game Theory (Negotiate-stage Dark Fiber deal, $3,255/mo):
- Win prob: 82% | Buyer urgency: high | Competition: moderate | Info edge: seller
- Strategy: Bundle Lock — combine 2 Negotiate deals into MSA with volume pricing
- Anchor: $3,255/mo | Floor: $2,930/mo (10% max)
- Value levers: waived install, dedicated PM, priority provisioning, wavelength price lock
- Competitor: regional fiber provider quoting 12-15% below on individual circuits
- Differentiation: in-building presence at 8/10 target locations, 30-day vs 6-12mo install

Signals:
- $200M CapEx plan for 2026 (expansion, act_now)
- FCC spectrum filing for 5G backhaul (regulatory, this_week)
- New VP Network Engineering from competitor (leadership, this_month)
- Q4 earnings: 18% YoY growth (financial, monitor)

Backtest: 7 quarters, avg accuracy 66%
Learning: 8 checkpoints (5-40 deals), hits 80% at 30 deals

Close Lost deals:
- Wavelength I-70: $5,200, lost to Zayo on price (Negotiate stage)
- Dark Fiber South: $3,800, lost to Crown Castle bundled offer (Propose)
- Wavelength DIA route: $1,750, lost (Michael Kahn rep)
```

### Customer 2 — Software & Tech (at-risk, dormant)
```
ARR: $448,786 | MRR: $37,399 | Pipeline: 1 deal (Longshot), $1,000/mo
Products: IP Services, zColo, Ethernet, Dark Fiber - Metro
Won: 34 | Lost: 5 | Win Rate: 87.2% | NRR: 87%
Velocity: stalled | Risk: 62/100 (critical) | Silent: 497 days
Rep: Jose Banales | Reps: 19 (instability) | Tenure: 75 months
Disconnects: 3 | Downgrades: 3 ($4,850)

6 Locations:
- Arapahoe HQ, Centennial CO (On-Net, $8.5K/mo, IP Services)
- Denver Data Center (On-Net, $2.1K/mo, zColo — 1 cab disconnected)
- Colorado Springs Substation (Near-Net, fiber 500ft)
- San Luis Valley Solar Site (Off-Net, DOE funded buildout)
- Pueblo Solar Array (Off-Net, Phase 2)
- AWS US-West-2 Oregon (Off-Net, Direct Connect prospect)

Bayesian:
- IP Services churn: prior 20% → posterior 52% (2 losses, 497d silent, NRR <90%)
- zColo churn: prior 15% → posterior 38% (3 disconnects, cloud migration)
- IP renewal weakened: prior 60% → posterior 45% (Longshot deal, 19 reps)

Game Theory (Longshot IP deal, $1,000/mo — really a retention play):
- Win prob: 35% | Buyer urgency: low | Competition: fierce | Info edge: buyer
- Strategy: Value Reframe — this deal is entry point to save $449K ARR, not standalone
- Anchor: $1,000/mo | Floor: $750/mo (25% to re-engage)
- Competitor: CloudNet offering 20% below with cloud-native bundling

Signals:
- $45M Series C, scalability focus (funding, act_now)
- Hiring 3 Cloud Infrastructure Engineers, AWS (technology, this_week)
- CTO keynote: "cloud-first infrastructure" (leadership, act_now)
- Glassdoor: "aging infrastructure" complaints (risk, this_month)

Backtest: 5 quarters, best was Q3 2024 catching churn at 90%
Learning: 6 checkpoints (10-60 deals), hits 78% at 60

Close Lost:
- IP Services: $3,500 (2023), $1,800 (2024) — Andrew Jahant
- Ethernet: $2,200 (2024) — budget shifted to cloud
- zColo primary: $4,500 (2024) — no decision pending Series C
Disconnects: 2x zColo, 1x Ethernet CloudLink
Downgrades: zColo -$2,400, IP -$1,650, zColo -$800
```

---

## BACKEND API ENDPOINTS

```
POST /api/ingest                          — Upload CSV, returns accounts
POST /api/ingest-multi                    — Upload per-tab CSVs (customers, funnel, lost, quotes, services, locations)
GET  /api/accounts                        — All accounts with summary
GET  /api/accounts/{id}                   — Full account state
POST /api/analyze/bayesian/{id}           — Run Bayesian prediction
POST /api/analyze/game-theory/{id}/{deal} — Game theory per deal
POST /api/analyze/signals/{id}            — Signal scrub (web search)
POST /api/backtest/{id}                   — Historical backtest
POST /api/learning-curve/{id}             — Learning curve analysis
GET  /api/dashboard                       — Everything for frontend
```

---

## PERFORMANCE REQUIREMENTS

- Handle 15K+ rows across 1000+ accounts without UI freeze
- Process account building in batches of 500, yield to UI between batches
- Use single-pass algorithms (not multiple .filter() on large arrays)
- Smart CSV header detection: scan first 20 lines for known columns
- Handle BOM, mixed encoding (UTF-8 fallback to latin-1), Excel junk rows

---

## KEY PRINCIPLES

1. **Bayesian vs Game Theory are separate.** Bayesian = WHAT/WHEN (account-level prediction). Game Theory = HOW TO WIN (per-deal negotiation). Never mix them.
2. **Signals feed into Bayesian as evidence.** They update priors before predictions run.
3. **Backtest never leaks future data.** Reconstruct only what was known at each cutoff date.
4. **Close Lost data is the most valuable.** Always emphasize this in UI and docs.
5. **Claude API key via env var only.** Frontend calls proxy through backend. Demo mode calls Claude directly (no key needed in claude.ai artifact context).
6. **Field mapping must be flexible.** Accept Salesforce, HubSpot, Dynamics, or any CRM column names.
