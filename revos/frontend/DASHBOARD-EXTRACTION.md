# RevOS Dashboard Extraction Guide

> Complete inventory of every dashboard/app in the RevOS GTM Platform.
> Use this to convert each into a self-contained single-file HTML app.

---

## Dashboard Index

| # | Name | File | Description | Lines | Key Libs |
|---|------|------|-------------|-------|----------|
| 1 | **Seller Actions** | `pages/SellerActions.jsx` | Account prioritization with win/churn scoring, market intel, and AI-drafted strategies | 1,151 | React only |
| 2 | **Rep Dashboard** | `pages/RepDashboard.jsx` | Individual seller KPIs: bookings, pipeline, attainment, quota tracking | 1,703 | Recharts |
| 3 | **Forecast Dashboard** | `pages/ForecastDashboard.jsx` | Company-wide forecast: bookings, churn model, buy patterns, product intel | 1,206 | Recharts |
| 4 | **Engagement Dashboard** | `pages/EngagementDashboard.jsx` | Rep/team engagement tracking: emails, calls, meetings, pipeline, heatmap | 1,512 | Recharts, PapaParse |
| 5 | **Prediction Engine** | `pages/EngineDashboard.jsx` | Bayesian deal scoring with strategies, calibration, and segment analysis | 798 | Recharts |
| 6 | **Backtest Engine** | `pages/BacktestEngine.jsx` | Train logistic regression models on historical deals with 5-step wizard | 932 | xlsx |
| 7 | **Location Intelligence** | `pages/SellerLocations.jsx` | Map-based location enrichment via Google Places + Claude AI | 898 | Leaflet, react-leaflet |
| 8 | **Priority** | `pages/Priority.jsx` | Account priority ranking with composite scoring and filters | 319 | React only |
| 9 | **Overview** | `pages/Overview.jsx` | Single-account overview: ARR, pipeline, health, engagement, product mix | 181 | Recharts |
| 10 | **Engagement (Account)** | `pages/Engagement.jsx` | Per-account engagement tracking with AI email drafting | 399 | React only |
| 11 | **Locations (Account)** | `pages/Locations.jsx` | Per-account location map with on-net/near-net/off-net status | 302 | Leaflet (vanilla) |
| 12 | **Predictions (Account)** | `pages/Predictions.jsx` | Bayesian win probability and churn risk per deal | 364 | React only |
| 13 | **Deals** | `pages/Deals.jsx` | Active pipeline + historical deal manager with ICB linking | 377 | React only |
| 14 | **Signals** | `pages/Signals.jsx` | AI strategy analysis via Claude API | 201 | React only |
| 15 | **Losses** | `pages/Losses.jsx` | Loss accounting: close-lost, churn, disconnects, NRR impact | 105 | React only |
| 16 | **Backtest (Account)** | `pages/Backtest.jsx` | Per-account model accuracy and calibration by quarter | 149 | Recharts |
| 17 | **Learning Curve** | `pages/Learning.jsx` | Model accuracy vs training dataset size visualization | 85 | Recharts |

---

## Shared Dependencies (required by all apps)

### Design Tokens — `lib/constants.js`
```
T = { bg, surface, card, cardHover, border, borderLight, text, textMid, textDim,
      cyan, green, red, yellow, orange, purple, blue, teal, pink, lime }
RADIUS = '12px'
CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.3)'
FONT_MONO = "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace"
FONT_SANS = "'Inter', system-ui, sans-serif"
STAGE_COLORS = { Discover: blue, Design: purple, Propose: yellow, ... }
STAGE_WIN_PROB = { Discover: 0.3057, ... , Closed Won: 1.0 }
stageProb(stage) → number
```

### Formatters — `components/shared/ChartTheme.js`
```
$(n)  → "$1,234"      (integer with commas)
$k(n) → "$1,234"      (rounded)
pc(n) → "52%"          (float → percent, no decimal)
pc1(n) → "52.3%"       (float → percent, 1 decimal)
chartTheme = { bg, grid, text, font, tooltip: {...} }
```

### Class Utility — `lib/utils.js`
```
cn(...inputs) → string   // clsx + tailwind-merge
```
**For single-file extraction:** Replace `cn()` with simple class concatenation or include clsx inline.

### Tooltip System — `components/shared/Tip.jsx`
- Wraps children with hover tooltip
- Auto-looks up definitions from `lib/definitions.js` (DEFS object)
- Renders via `createPortal` to escape overflow containers

### Shared Components
| Component | File | Props | Purpose |
|-----------|------|-------|---------|
| `Badge` | `shared/Badge.jsx` | `{children, color, className, size}` | Status label pill |
| `Stat` | `shared/Stat.jsx` | `{label, value, sub, color, small}` | KPI card |
| `ProbBar` | `shared/ProbBar.jsx` | `{value, color, h}` | Probability/progress bar |
| `Tip` | `shared/Tip.jsx` | `{children, label, tip, delay, style}` | Hover tooltip |

### Account Builder — `lib/accountBuilder.js`
- `normalizeStage(raw)` → canonical stage string
- `buildAccountState(customer, funnel, closeLost, quotes, services, locations)` → account object (40+ fields)
- `buildBacktestData(funnel)` → quarterly accuracy data
- `buildLearningData(funnel)` → learning curve points
- `buildCalibration(backtest)` → Bayes calibration multipliers

### Data Hooks
| Hook | File | Returns | Purpose |
|------|------|---------|---------|
| `useLocalData` | `hooks/useLocalData.js` | `{localAccounts, localFiles, localRawData, loading, dataDir, setDataDir, refresh, serverAvailable}` | Loads CSVs from local data/ folder via HTTP |
| `useAccounts` | `hooks/useAccounts.js` | `{accounts, rawData, ingestLocalCSV, ingestAllFiles, clearData}` | In-browser CSV upload processing |

---

## App-by-App Extraction

---

### 1. Seller Actions (`SellerActions.jsx`)

**Description:** Priority action dashboard ranking accounts by Prospecting/Growth/Retention mode with win probability scoring, churn risk, and AI-generated market intelligence.

**Props received:**
- `accounts` — array of account objects (optional; falls back to demo)
- `onNavigate` — callback to navigate to other screens

**State variables:**
- `active` — currently expanded card type
- `steeringMode` — 'Prospecting' | 'Growth' | 'Retention'
- `modelData` — trained model weights (falls back to DEMO_MODEL)
- `intelData` — { accountName → market intel object }
- `refreshingAccount` — account currently loading intel

**Data user inputs:** Mode selection, card expansion, Market Intel button
**Data generated:** Win probability (0-100%), churn risk (0-100%), impact scores, account rankings, market intel (news, competitors, financials)
**Data persisted:** None (component state only)
**Storage method:** None

**API calls:**
- `GET /api/engine/model/params` — loads trained model (optional)

**Third-party libs:**
- React (essential)

**Internal functions (must inline for single-file):**
- `sigmoid(x)`, `dot(a,b)`, `predict(x,model)` — logistic regression math
- `extractFeatures(deal, stats)` → 5-element feature vector
- `scoreWinProb(deal, modelData)` → 0-100
- `scoreChurnRisk(deal, modelData)` → 0-100
- `buildWinBreakdown(deal, modelData)` → 5-factor decomposition
- `buildChurnBreakdown(deal, modelData)` → 5-factor decomposition
- `classifyAccount(acct)` → { mode, impactScore, signals, tagline, suggestedMove }
- `rankAccounts(accounts, mode)` → top 3 by impact
- `computeDemoScores(mode, modelData)` → demo score map
- `generateIntelForAccount(acct)` → market intel object (seeded randomness)

**Sub-components:**
- `ScoreBar` — thin progress bar
- `TooltipBadge` — hoverable probability badge with breakdown
- `MarketIntelPanel` — news, competitors, financials panel
- `ActionCard` — main card with signals, suggested move, CTAs

---

### 2. Rep Dashboard (`RepDashboard.jsx`)

**Description:** Individual seller performance dashboard with 4 tabs: My Accounts, My Pipeline, Pipeline Gap, KPI Scorecard.

**Props received:**
- `accounts` — array of account objects
- `rawData` — { rep_profiles: [{rep_name, annual_quota}] }

**State variables:**
- `tab` — accounts | pipeline | pipeline-gap | kpi
- `selectedRep` — selected seller name
- `showFilter` — all | at-risk | engaged
- `sortBy` — risk | mrr | engagement
- `userTarget` — custom annual quota
- `periodMode` — month | quarter | annual
- `accountSearch` — search text
- `signalsData`, `signalsAge` — loaded signals.json
- `aiSignals`, `aiLoading` — per-account AI signal state
- `customTarget`, `scenarioMix`, `simAdds` — KPI simulator state

**Data user inputs:** Rep selection, tab/filter/sort, period mode, quota override, scenario simulator params
**Data generated:** YTD/QTD/MTD bookings, weighted pipeline, pipeline coverage, attainment %, stage distribution, trajectory projections
**Data persisted:** None
**Storage method:** None

**API calls:**
- `GET /local-data/file?name=revos-signals.json` — loads signal data
- `POST /api/engine/refresh-signals` — refreshes AI signals for account

**Third-party libs:**
- React (essential)
- Recharts (essential — BarChart, ComposedChart, Line, Area)

---

### 3. Forecast Dashboard (`ForecastDashboard.jsx`)

**Description:** Company-wide forecast with 6 tabs: Overview, Bookings Forecast, Churn Model, Buy Patterns, Product Intel, Account Health.

**Props received:**
- `accounts` — array of account objects
- `rawData` — (unused)

**State variables:**
- `tab` — overview | bookings | churn | patterns | product | health
- `periodMode` — month | quarter

**Data user inputs:** Tab selection, period toggle
**Data generated:** YTD bookings, weighted pipeline, win rate, trajectory, quarterly net-new, churn by type, seasonality, deal size distribution, product pipeline/bookings, health/velocity/NRR distributions, rep productivity
**Data persisted:** None
**Storage method:** None

**API calls:** None

**Third-party libs:**
- React (essential)
- Recharts (essential — BarChart, ComposedChart, LineChart, Line, Cell)

---

### 4. Engagement Dashboard (`EngagementDashboard.jsx`)

**Description:** Rep/team engagement tracking with CSV upload, column mapping, heatmap coverage, and pipeline correlation.

**Props received:** None (self-contained)

**State variables:**
- `view` — rep | team | account
- `dataMode` — demo | live
- `countMode` — total | unique
- `timeRange` — all | month | qtd | ytd
- `selectedRep`, `selectedAccount` — current selections
- `liveData` — uploaded data { accounts, engagements, pipeline, quotes, hierarchy }
- `mapperState` — column mapping dialog state
- `resolveReport` — account resolution report
- `showDiag` — diagnostics panel visibility

**Data user inputs:** CSV file uploads (engagement, pipeline, quotes, hierarchy), column mapping, view/time/count toggles
**Data generated:** Weekly engagement aggregations, account coverage heatmap, sales funnel conversion, rep stats, pipeline correlation
**Data persisted:** None (component state)
**Storage method:** None

**API calls:** None

**Third-party libs:**
- React (essential)
- Recharts (essential — ComposedChart, Area, Bar, Line)
- PapaParse (essential — CSV parsing for uploads)

---

### 5. Prediction Engine (`EngineDashboard.jsx`)

**Description:** Deal scoring engine with 3 tabs: Strategies (scored deals), Model Health (calibration), Segments (per-vertical performance).

**Props received:**
- `accounts` — array of account objects
- `backtestResults` — trained model output (or null)

**State variables:**
- `tab` — strategies | health | segments
- `selectedDeal` — deal object for detail view
- `sortField` — win_prob | amount | close | risks | deal | account
- `sortDir` — asc | desc

**Data user inputs:** Tab selection, deal selection, sort column/direction
**Data generated:** Scored deals with win_probability + risk_flags + trend, calibration curve, segment-level model stats, strategy recommendations (pricing, product, engagement, competitive)
**Data persisted:** `predictions.json` via engineStore
**Storage method:** File (via Vite local-data plugin)

**API calls:** None

**Third-party libs:**
- React (essential)
- Recharts (essential — ScatterChart for calibration curve)

**Internal functions (must inline):**
- `scoreDealsFromAccounts(accounts, backtestResults)` — scores all active deals
- `buildCalibrationFromBacktest(backtestResults)` — calibration metrics
- `buildSegmentData(accounts, backtestResults)` — per-vertical stats

---

### 6. Backtest Engine (`BacktestEngine.jsx`)

**Description:** 5-step wizard for training logistic regression models on historical deal CSV/Excel data.

**Props received:**
- `onResults` — callback with results object
- `savedResults` — pre-loaded results (skips upload)

**State variables:**
- `step` — upload | sheets | map | configure | results
- `rows`, `headers` — parsed file data
- `mapping` — field mapping { outcome, product, segment, deal_value, created_date, close_date }
- `trainPct` — train/test split (default 80)
- `results` — backtest output
- `running`, `runStatus` — training status
- `drag` — drag-over state
- `sheets`, `wonSheet`, `lostSheet` — Excel multi-sheet support
- `wonFile`, `lostFile` — two-file CSV upload

**Data user inputs:** CSV/Excel file upload, sheet selection, column mapping, train/test split %
**Data generated:** Trained logistic regression weights, Brier score, AUC-ROC, calibration curve, per-vertical model performance, feature importance
**Data persisted:** Via parent callback → `backtest-results.json`
**Storage method:** File (via engineStore in parent)

**API calls:** None

**Third-party libs:**
- React (essential)
- xlsx (essential — Excel/CSV parsing)

**Internal functions (must inline — this is the ML engine):**
- `parseCsvText(text)` — CSV parser
- `normalizeOutcome(val)` — outcome normalization
- `computeStats(deals)` — per-segment win rates, deal value distributions
- `trainLogistic(X, y, opts)` — gradient descent logistic regression
- `predict(x, model)` — sigmoid prediction
- `brier(preds, actuals)` — Brier score
- `auc(preds, actuals)` — AUC-ROC computation
- `runBacktest(deals, trainPct)` — full pipeline: split → train → evaluate → compare models

---

### 7. Location Intelligence (`SellerLocations.jsx`)

**Description:** Map-based location discovery with Google Places + Claude AI enrichment, Bayesian expansion signals, and merge workflow.

**Props received:** None (self-contained)

**State variables:**
- `currentScreen` — locations | dashboard | deal-prep | ask | documents
- `navCollapsed` — sidebar state
- LocationsScreen internal state (13+ variables): selectedAccount, managerFilter, searchQuery, enriching, sourceStatus, discoveredLocations, enrichmentComplete, bayesianSignals, activeTab, merged, confirmMerge, existingLocations, loadingLocations, locationsLoaded

**Data user inputs:** Account selection, manager filter, search, enrichment trigger, merge confirmation
**Data generated:** Discovered locations (lat/lng/type/address), Bayesian signals (footprint, geo spread, growth signal, expansion probability), deduplicated merged locations
**Data persisted:** `enriched-locations.json` via engineStore (keyed by account name)
**Storage method:** File (via Vite local-data plugin)

**API calls:**
- `POST /api/engine/enrich/google-places` — Google Places Text Search
- `POST /api/engine/enrich/claude` — Claude AI location research
- `GET /local-data/file?name=location-summary.json` — account summary
- `GET /local-data/locations.json` — cached locations

**Third-party libs:**
- React (essential)
- Leaflet / react-leaflet (essential — MapContainer, TileLayer, CircleMarker, Popup)

---

### 8. Priority (`Priority.jsx`)

**Description:** Account priority ranking with composite scoring (pipeline + engagement + risk) and 7 filter types.

**Props received:**
- `accounts` — array of account objects
- `onSelect` — callback when account clicked
- `backtestResults` — optional calibration data

**State variables:**
- `activeFilters` — Set of active filter IDs
- `scored` (useMemo) — accounts with priority scores
- `filtered` (useMemo) — filtered + sorted results

**Data user inputs:** Filter toggles (deals, dark, need, highprob, onnet, offnet, icb)
**Data generated:** Priority score (0-100) per account with reason breakdown, Bayesian win probability
**Data persisted:** None
**Storage method:** None

**Third-party libs:** React only

---

### 9. Overview (`Overview.jsx`)

**Description:** Single-account overview showing ARR, pipeline, win rate, health, engagement, and product mix.

**Props received:** `a` — single account object

**State variables:** None (memoized pure component)

**Data user inputs:** None (display only)
**Data generated:** Formatted metrics, health factor breakdown, pipeline by stage, engagement summary, product percentages
**Data persisted:** None

**Third-party libs:** Recharts (BarChart for engagement timeline)

---

### 10. Engagement — Account Level (`Engagement.jsx`)

**Description:** Per-account engagement tracker with tab categories (engaged/not-engaged/priority) and AI email drafting.

**Props received:**
- `accounts` — array of account objects
- `onSelect` — callback

**State variables:**
- `tab` — engaged | not_engaged | priority
- `draftAcc` — selected account for draft

**Data user inputs:** Tab selection, account selection, "Draft Outreach" button, email editing
**Data generated:** Engagement categorization, email drafts (subject + body) based on account context
**Data persisted:** None

**Third-party libs:** React only

**Internal functions (must inline):**
- `engagedThisMonth()` — checks current month engagement
- `daysSince()` — calculates days since date
- `ytdEngagementCount()` — sums YTD events
- `buildOutreachContext()` — builds context string for email template
- `draftEmail()` — generates email subject + body from account signals

---

### 11. Locations — Account Level (`Locations.jsx`)

**Description:** Interactive map showing account locations with on-net/near-net/off-net status and drill-down detail.

**Props received:** `a` — single account object

**State variables:**
- `selLoc` — selected location index
- `filter` — all | on-net | near-net | off-net
- `mapRef`, `mapInstanceRef`, `markersRef`, `highlightRef` — Leaflet refs

**Data user inputs:** Filter buttons, map marker clicks, location card clicks
**Data generated:** Location counts/MRR by status, marker sizing
**Data persisted:** None

**Third-party libs:** Leaflet (vanilla, via window.L — essential)

---

### 12. Predictions — Account Level (`Predictions.jsx`)

**Description:** Bayesian win probability and churn risk predictions per deal with evidence chains.

**Props received:**
- `a` — single account object
- `backtestResults` — optional calibration

**State variables:**
- `engineCal` (useMemo) — calibration from backtest
- `predictions` (useMemo) — deal predictions
- `churnPreds` (useMemo) — churn risk signals

**Data user inputs:** None (display only)
**Data generated:**
- Per-deal posterior win probability via log-odds Bayesian update (prior × stage LR × engagement LR × health LR)
- Churn probability via multi-factor likelihood ratios
- Evidence chains with factor breakdowns
**Data persisted:** None

**Third-party libs:** React only

**Internal functions (critical Bayesian math — must inline):**
- Engagement signal computation (recency, intensity, breadth)
- Log-odds Bayesian update formula
- Churn likelihood ratio computation

---

### 13. Deals (`Deals.jsx`)

**Description:** Active pipeline + historical deal manager with detail panels, ICB links, and stage-based filtering.

**Props received:** `a` — single account object

**State variables:**
- `tab` — current | historical
- `selDeal` — selected deal index
- `histFilter` — all | won | lost | churn

**Data user inputs:** Tab toggle, deal selection, filter selection
**Data generated:** Deal categorization (won/lost/churn), summary stats, normalized stages
**Data persisted:** None

**External links:** Salesforce Opportunity URLs

**Third-party libs:** React only

---

### 14. Signals (`Signals.jsx`)

**Description:** AI strategy analysis that generates recommendations, actions, cross-sell opportunities, and risk analysis via Claude API.

**Props received:** `a` — single account object

**State variables:**
- `analysis` — cached analysis object
- `loading`, `error` — API state
- `abortRef` — AbortController for cancellation
- `cache` (module-level) — session-persistent analysis cache

**Data user inputs:** "Generate Analysis" button
**Data generated:** Strategic summary, health assessment, prioritized actions, cross-sell opportunities, risk signals with mitigations
**Data persisted:** Session cache only (module-level object)

**API calls:**
- `POST /api/analyze` — sends prompt to Claude API, returns structured strategy JSON

**Third-party libs:** React only (Claude API via backend proxy)

**Internal dependency:**
- `lib/analyzePrompt.js` — `buildAnalyzePrompt(account)` builds the Claude prompt

---

### 15. Losses (`Losses.jsx`)

**Description:** Loss accounting showing close-lost deals, churn/re-rates, disconnects, and NRR impact.

**Props received:** `a` — single account object

**State variables:** None (memoized pure component)

**Data user inputs:** None (display only)
**Data generated:** Loss categorization (by type, by product), NRR impact
**Data persisted:** None

**Third-party libs:** React only

---

### 16. Backtest — Account Level (`Backtest.jsx`)

**Description:** Per-account model accuracy by quarter with accuracy trend chart and confusion analysis.

**Props received:**
- `a` — single account object
- `backtestResults` — engine results

**State variables:**
- `selQ` — selected quarter index

**Data user inputs:** Quarter selection
**Data generated:** Average accuracy, outcome hit rate, per-quarter predicted vs actual comparison
**Data persisted:** None

**Third-party libs:** Recharts (ComposedChart)

---

### 17. Learning Curve (`Learning.jsx`)

**Description:** Model accuracy vs training dataset size visualization with minimum viable dataset identification.

**Props received:** `a` — single account object

**State variables:** None (memoized pure component)

**Data user inputs:** None (display only)
**Data generated:** First 80% accuracy threshold, peak accuracy point, trend analysis
**Data persisted:** None

**Third-party libs:** Recharts (LineChart)

---

## Third-Party Library Summary

| Library | Used By | Essential? | Vanilla JS Alternative |
|---------|---------|------------|----------------------|
| **React 18** | All | Yes | Preact (3KB) or vanilla DOM |
| **Recharts** | Overview, Backtest, Learning, RepDashboard, ForecastDashboard, EngineDashboard, EngagementDashboard | Yes for charts | Chart.js or D3 (heavier); or SVG by hand |
| **PapaParse** | EngagementDashboard | Yes for CSV | Simple CSV parser (~50 lines) |
| **xlsx** | BacktestEngine | Yes for Excel | Drop Excel support (CSV only) |
| **Leaflet + react-leaflet** | SellerLocations, Locations | Yes for maps | Leaflet standalone (no React wrapper needed) |
| **clsx + tailwind-merge** | All (via cn()) | Replaceable | Simple string concat |

---

## Data Model Reference

### Account Object (40+ fields)
```
{
  name, id, vertical, sales_owner, manager,
  arr, mrr, pipeline_mrr, pipeline_count,
  win_rate, risk_score, risk_level, health_score,
  nrr, velocity, days_silent, disconnects,
  churn_mrr, lost, products: [],
  active_deals: [{ product, stage, mrr, created, ... }],
  funnel_closed: [{ stage, mrr, close_date, ... }],
  engagement: { total, byType, timeline, contacts, lastDate },
  locations: [{ address, lat, lng, status, mrr, ... }],
  losses: { lost_mrr, churn_mrr, disconnects, by_product, ... },
  backtest: [{ q, score, predicted, actual }],
  learning: [{ deals, accuracy, churn, expand }],
  calibration: { winLR, churnLR },
  cross_sell: [{ product, reason, confidence }],
}
```

### CSV Data Tables
| Table | Source File | Key Fields |
|-------|-----------|------------|
| Customers | customers.csv | customer_account, total_brr, vertical, sales_owner |
| Funnel | funnel.csv | customer_account, stage, amount, product, close_date, forecast |
| Close Lost | close_lost.csv | customer_account, stage, amount, product |
| Quotes | quotes.csv | customer_account, quote_mrr, product |
| Services | services.csv | customer_account, service_mrr, product, status |
| Locations | locations.csv | customer_account, address, lat, lng, net_status |
| ICB | icb.csv | customer_account, opportunity_id (Salesforce link) |
| Hierarchy | hierarchy.csv | parent_account, child_account |
