# PROJECT-SNAPSHOT.md — RevOS GTM Platform

Generated: 2026-03-11

---

## 1. Directory Tree

```
GTM Platform/
├── .claude/
│   ├── settings.json
│   └── settings.local.json
├── revos/
│   ├── README.md
│   ├── backend/                          # Python FastAPI (not actively used — frontend is self-contained)
│   │   ├── .env.example
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── database.py
│   │   │   └── schemas.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── accounts.py
│   │   │   ├── analyze.py
│   │   │   ├── ingest.py
│   │   │   └── signals.py
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── account_builder.py
│   │       ├── backtest_engine.py
│   │       ├── bayesian_engine.py
│   │       ├── game_theory_engine.py
│   │       ├── learning_curve.py
│   │       ├── normalizer.py
│   │       └── signal_engine.py
│   ├── frontend/                         # ★ Active codebase — React + Vite
│   │   ├── .env.local                    # VITE_ANTHROPIC_API_KEY placeholder
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── package-lock.json
│   │   ├── postcss.config.js
│   │   ├── tailwind.config.js
│   │   ├── vite.config.js               # Vite plugins: local-data server + Claude API proxy
│   │   ├── data/                         # CSV + JSON data files (gitignored content)
│   │   │   ├── .gitkeep
│   │   │   ├── customers.csv
│   │   │   ├── funnel.csv
│   │   │   ├── close_lost.csv
│   │   │   ├── quotes.csv
│   │   │   ├── services.csv
│   │   │   ├── locations.csv
│   │   │   ├── locations_geocoded.csv
│   │   │   ├── historical.csv
│   │   │   ├── engagements.csv
│   │   │   ├── engagement_2026.csv
│   │   │   ├── locations.json            # Pre-built by scripts
│   │   │   ├── historical.json           # Pre-built by scripts
│   │   │   ├── engagements.json          # Pre-built by scripts
│   │   │   └── engagements_2026.json     # Pre-built by scripts
│   │   ├── scripts/                      # Node.js data preprocessing
│   │   │   ├── build-engagements.cjs     # 2025 engagement CSV → JSON
│   │   │   ├── build-engagements-2026.cjs# 2026 engagement CSV → JSON
│   │   │   ├── build-historical.cjs      # Historical deals CSV → JSON
│   │   │   ├── build-locations.cjs       # Locations CSV → JSON
│   │   │   ├── geocode-locations.cjs     # Adds lat/lng from postal codes
│   │   │   └── .geocache/               # Cached GeoNames data
│   │   └── src/
│   │       ├── App.jsx                   # Root component — routing, filters, layout
│   │       ├── main.jsx                  # React entry point
│   │       ├── index.css                 # Base styles
│   │       ├── components/
│   │       │   ├── layout/
│   │       │   │   ├── Header.jsx        # Top bar with logo + account count
│   │       │   │   ├── Sidebar.jsx       # Account list with risk badges
│   │       │   │   └── TopNav.jsx        # Page tabs + Modeling dropdown
│   │       │   ├── shared/
│   │       │   │   ├── Badge.jsx         # Colored pill badge
│   │       │   │   ├── ChartTheme.js     # Recharts theme + $ formatters
│   │       │   │   ├── ProbBar.jsx       # Probability progress bar
│   │       │   │   ├── Stat.jsx          # Metric card with label/value
│   │       │   │   └── Tip.jsx           # Portal-based hover tooltip
│   │       │   └── upload/
│   │       │       └── CSVUploader.jsx   # Drag-drop CSV upload with auto-detect
│   │       ├── demo/
│   │       │   └── demoData.js           # Embedded demo accounts (no API needed)
│   │       ├── hooks/
│   │       │   ├── useAccounts.js        # CSV upload → account state builder
│   │       │   ├── useClaudeAPI.js       # API call hooks (Bayesian, Game Theory, Signals)
│   │       │   └── useLocalData.js       # Local data/ folder loader with dir picker
│   │       ├── lib/
│   │       │   ├── accountBuilder.js     # CSV records → structured account objects
│   │       │   ├── analyzePrompt.js      # Builds Claude analysis prompt per account
│   │       │   ├── constants.js          # Theme colors, fonts, page definitions
│   │       │   ├── definitions.js        # Tooltip text for every UI label
│   │       │   └── normalize.js          # CSV column name mapping + PapaParse
│   │       └── pages/
│   │           ├── Priority.jsx          # ★ Default landing — ranked account list
│   │           ├── Overview.jsx          # Account dashboard: stats, pipeline, engagement
│   │           ├── Engagement.jsx        # Rep engagement tracker + draft outreach
│   │           ├── Locations.jsx         # Leaflet map + on/near/off-net locations
│   │           ├── Predictions.jsx       # Bayesian win/churn probability
│   │           ├── Deals.jsx             # Current funnel + merged historicals
│   │           ├── Signals.jsx           # Claude AI strategy analysis
│   │           ├── Losses.jsx            # Loss/churn/disconnect breakdown
│   │           ├── Backtest.jsx          # Prediction accuracy by quarter
│   │           └── Learning.jsx          # Accuracy vs training data curve
│   └── scripts/
│       └── revos-anonymize.py
├── revos-anonymize.py
├── revos-dashboard-full.jsx
└── REVOS-BUILD-PROMPT.md
```

---

## 2. File Contents (First 30 Lines)

### src/App.jsx (355 lines)
```jsx
import { useState, useCallback } from 'react'
import { T, FONT_MONO } from './lib/constants'
import useAccounts from './hooks/useAccounts'
import useLocalData from './hooks/useLocalData'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import TopNav from './components/layout/TopNav'
import CSVUploader from './components/upload/CSVUploader'
import Badge from './components/shared/Badge'
import Tip from './components/shared/Tip'
import { pc } from './components/shared/ChartTheme'
import Overview from './pages/Overview'
import Locations from './pages/Locations'
import Predictions from './pages/Predictions'
import Deals from './pages/Deals'
import Signals from './pages/Signals'
import Losses from './pages/Losses'
import Backtest from './pages/Backtest'
import Learning from './pages/Learning'
import Priority from './pages/Priority'
import Engagement from './pages/Engagement'

export default function App() {
  const { accounts: uploadedAccounts, isDemo: isUploadDemo, rawData, ingestLocalCSV, clearData } = useAccounts()
  const { localAccounts, localFiles, loading: localLoading, dataDir, setDataDir, refresh } = useLocalData()
  const [showDirPicker, setShowDirPicker] = useState(false)
  const [dirInput, setDirInput] = useState('')
  const [dirError, setDirError] = useState('')
  const handleSetDir = useCallback(async () => {
... (325 more lines)
```

### src/main.jsx (10 lines)
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### src/hooks/useAccounts.js (245 lines)
```js
import { useState, useCallback } from 'react'
import { DEMO_ACCOUNTS } from '../demo/demoData'
import { parseCSV } from '../lib/normalize'
import { buildAccountState } from '../lib/accountBuilder'

// All data stays in browser memory only.
// Nothing is sent to any server. CSV files are read via FileReader API,
// parsed in-browser, and stored in React state.
export default function useAccounts() {
  const [accounts, setAccounts] = useState(DEMO_ACCOUNTS)
  const [isDemo, setIsDemo] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [rawData, setRawData] = useState({
    customers: [], funnel: [], close_lost: [],
    quotes: [], services: [], locations: [],
  })
... (215 more lines)
```

### src/hooks/useLocalData.js (407 lines)
```js
import { useState, useEffect, useCallback } from 'react'
import { parseCSV } from '../lib/normalize'
import { buildAccountState, buildBacktestData, buildLearningData, buildCalibration } from '../lib/accountBuilder'

// Loads CSV files from configurable data folder via Vite dev server.
// Loads once on mount, re-loads on manual refresh or folder change.

const KNOWN_TABS = ['customers', 'funnel', 'close_lost', 'quotes', 'services', 'locations']

function tabTypeFromFileName(name) { ... }
function detectTabTypeFromRecord(record) { ... }

export default function useLocalData() {
  const [localFiles, setLocalFiles] = useState([])
  const [localAccounts, setLocalAccounts] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dataDir, setDataDirState] = useState('')
  // Restores saved dir from localStorage, loads data once on mount
  // Exposes: localAccounts, localFiles, loading, dataDir, setDataDir, refresh
}
... (370 more lines)
```

### src/hooks/useClaudeAPI.js (85 lines)
```js
import { useState, useCallback } from 'react'
import { API_BASE } from '../lib/constants'

export default function useClaudeAPI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const runBayesian = useCallback(async (accountId) => { ... }, [])
  const runGameTheory = useCallback(async (accountId, dealIndex) => { ... }, [])
  const runSignals = useCallback(async (accountId) => { ... }, [])
  return { loading, error, runBayesian, runGameTheory, runSignals }
}
... (55 more lines)
```

### src/lib/constants.js (82 lines)
```js
export const T = {
  bg: '#06080F', surface: '#0D1117', card: '#161B22', cardHover: '#1C2333',
  border: '#21262D', borderLight: '#30363D', text: '#E6EDF3',
  textMid: '#8B949E', textDim: '#484F58', cyan: '#58A6FF', green: '#3FB950',
  red: '#F85149', yellow: '#D29922', orange: '#DB6D28', purple: '#BC8CFF',
  blue: '#388BFD', teal: '#2DD4BF', pink: '#F778BA', lime: '#A3E635',
}
export const FONT_MONO = "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace"
export const FONT_SANS = "'Inter', system-ui, sans-serif"
export const PAGES = [
  { id: 'priority', label: 'Priority', icon: '⚡' },
  { id: 'overview', label: 'Overview', icon: '◉' },
  { id: 'engagement', label: 'Engagement', icon: '💬' },
  { id: 'locations', label: 'Locations', icon: '📍' },
  { id: 'predict', label: 'Predictions', icon: '📊' },
  { id: 'deals', label: 'Deals', icon: '♟' },
  { id: 'signals', label: 'Signals', icon: '📡' },
  { id: 'losses', label: 'Losses', icon: '⚠' },
]
export const MODELING_PAGES = [
  { id: 'backtest', label: 'Backtest', icon: '⏪' },
  { id: 'learning', label: 'Learning', icon: '📈' },
]
... (52 more lines)
```

### src/lib/normalize.js (174 lines)
```js
import Papa from 'papaparse'

const FIELD_MAP = {
  customer_account: ['customer account', 'account name', 'company', ...],
  mega_vertical: ['mega vertical', 'vertical', 'industry', ...],
  primary_rep: ['primary rep', 'assigned rep', 'account owner', ...],
  account_manager: ['account manager', 'am', 'csm', 'sales funnel manager', ...],
  sales_owner: ['sales owner', 'sales_owner', 'sales rep owner', ...],
  // ... 40+ field mappings for deals, services, locations
}
// Normalizes CSV headers → canonical field names
// Auto-detects table type from column signatures
// Uses PapaParse for CSV parsing
... (140 more lines)
```

### src/lib/accountBuilder.js (395 lines)
```js
// Client-side account state builder — mirrors backend logic
function normalizeStage(raw) { ... }

export function buildAccountState(customer, funnel, closeLost, quotes, services, locations) {
  // Computes: total_arr, pipeline_mrr, win_rate, risk_score, risk_level,
  // net_revenue_retention, deal_velocity_trend, product_concentration,
  // loss_reasons, competitors, close_lost_deals, historical_deals, etc.
  // Applies isRealDeal filter (excludes deals created+closed within 2 days)
}
export function buildBacktestData(deals) { ... }     // Quarter-by-quarter prediction accuracy
export function buildLearningData(deals) { ... }     // Accuracy vs training set size
export function buildCalibration(backtest) { ... }   // Empirical Bayes calibration multipliers
... (355 more lines)
```

### src/lib/analyzePrompt.js (155 lines)
```js
// Builds a structured prompt for Claude to analyze an account
// Includes: account metrics, pipeline, installed products, engagement urgency,
// risk signals, loss history, location footprint
// Claude returns JSON with: plays[], signals[], urgency scoring
... (125 more lines)
```

### src/lib/definitions.js (96 lines)
```js
export const DEFS = {
  'PRIORITY RANKING': 'Accounts ranked by composite priority score (0-100)...',
  'TOTAL ARR': 'Annual Recurring Revenue from Total BRR field in customers.csv...',
  'PIPELINE': 'Sum of MRR across all active deals in the sales funnel...',
  'WIN RATE': 'Historical win rate = Won / (Won + Lost)...',
  'RISK': 'Composite risk score (0-100) derived from: days silent, losses...',
  'ENGAGEMENT TIMELINE': 'Rolling engagement feed with email subjects...',
  'CALIBRATION STATUS': 'Shows backtest-calibrated multipliers...',
  // ... 30+ definitions for every metric and section
}
```

### src/pages/Priority.jsx (304 lines)
```jsx
// Default landing page — ranked list of ALL accounts
// Composite scoring (0-100): active deals, engagement recency, open needs,
// Bayesian win probability, on-net presence, ARR size + risk amplifier
// 6 filter toggles (AND logic): Active Deals, Gone Dark, Left on Need,
// High Win Prob, On-Net, Off-Net
// Click account → navigates to Overview
... (274 more lines)
```

### src/pages/Overview.jsx (173 lines)
```jsx
// Account dashboard: 6 top stats (ARR, Pipeline, Win Rate, Lost MRR, NRR, Risk)
// Pipeline by stage bar chart, Risk signals section
// Engagement timeline with rolling event feed (email subjects, calls, meetings)
// Monthly engagement bar chart, product mix breakdown
... (143 more lines)
```

### src/pages/Engagement.jsx (419 lines)
```jsx
// Rep-level engagement tracker across all filtered accounts
// 3 tabs: Engaged (this month), Not Engaged, Priority (active deals)
// Each row: account name, ARR, pipeline, YTD activity, last engagement + subject, status
// "Draft Outreach" button per account → modal with:
//   - Context panel (services, last engagement, pipeline, risk)
//   - Pre-drafted email (based on deal stage, gone dark, last topic)
//   - Editable subject + body, copy to clipboard
... (389 more lines)
```

### src/pages/Locations.jsx (310 lines)
```jsx
// Leaflet map with on-net/near-net/off-net location pins
// Filter toggles, location detail panel, MRR by location
// Uses CartoDB dark tile layer
... (280 more lines)
```

### src/pages/Predictions.jsx (350 lines)
```jsx
// Bayesian win/churn probability predictions per deal
// Calibrated by backtest results (empirical Bayes)
// Evidence trails showing likelihood ratios
// Calibration status banner with Win LR / Churn LR badges
... (320 more lines)
```

### src/pages/Deals.jsx (298 lines)
```jsx
// Current Funnel tab: deal list + detail panel
// Historicals tab: merged bookings + churn + closed-lost
//   Sub-filters: ALL, BOOKINGS, CHURN, CLOSED LOST
//   Full dollar MRR display, sorted by close date desc
... (268 more lines)
```

### src/pages/Signals.jsx (214 lines)
```jsx
// Claude AI strategy analysis — sends account data to /api/analyze
// Returns structured plays (expand/protect/recover/coach) with urgency
// Session-cached results, abort-on-unmount
// Requires Anthropic API key in .env.local
... (184 more lines)
```

### src/pages/Losses.jsx (102 lines)
```jsx
// Loss event breakdown: close-lost deals, churn/re-rates, disconnects, downgrades
// By-product loss table, NRR stat
... (72 more lines)
```

### src/pages/Backtest.jsx (115 lines)
```jsx
// Quarter-by-quarter prediction accuracy chart (ComposedChart)
// Avg accuracy, outcome hit rate, quarters tested
// Expandable detail per quarter
... (85 more lines)
```

### src/pages/Learning.jsx (83 lines)
```jsx
// Accuracy vs training data volume (LineChart)
// Shows 80% accuracy threshold line
// Identifies minimum data requirement for reliable predictions
... (53 more lines)
```

### src/components/layout/TopNav.jsx (120 lines)
```jsx
// Page tab bar with Modeling dropdown (far right)
// PAGES: Priority, Overview, Engagement, Locations, Predictions, Deals, Signals, Losses
// MODELING dropdown: Backtest, Learning
// Active page highlighting, outside-click close
... (90 more lines)
```

### src/components/layout/Sidebar.jsx (79 lines)
```jsx
// Account list with: name, risk badge (with tooltip), vertical, ARR, velocity
// Risk tooltips: Low, Moderate, Elevated, Critical, At Risk — each with description
// Click to select account
... (49 more lines)
```

### src/components/layout/Header.jsx (48 lines)
```jsx
// Top bar: gradient logo, "RevOS" title, subtitle, account count, demo badge
... (18 more lines)
```

### src/components/shared/Badge.jsx (22 lines — complete)
```jsx
import { FONT_MONO, T } from '../../lib/constants'
export default function Badge({ children, color = T.cyan, size = 'sm' }) {
  return (
    <span style={{
      display: 'inline-flex', padding: size === 'sm' ? '1px 7px' : '3px 10px',
      borderRadius: '12px', fontFamily: FONT_MONO,
      fontSize: size === 'sm' ? '9px' : '10px', fontWeight: 600,
      color, background: `${color}18`, border: `1px solid ${color}30`,
    }}>{children}</span>
  )
}
```

### src/components/shared/ChartTheme.js (22 lines — complete)
```js
import { T, FONT_MONO, FONT_SANS } from '../../lib/constants'
export const chartTheme = { bg: T.card, grid: T.border, text: T.textDim, font: FONT_MONO, tooltip: { ... } }
export const $ = (n) => `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
export const $k = (n) => Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(0)}`
export const pc = (n) => `${(n * 100).toFixed(0)}%`
export const pc1 = (n) => `${(n * 100).toFixed(1)}%`
```

### src/components/shared/Tip.jsx (70 lines)
```jsx
// Portal-based hover tooltip — renders on document.body with position: fixed
// Looks up definitions from DEFS map by label, or uses custom `tip` prop
// Clamps horizontally to viewport, flips below if not enough room above
// z-index: 99999, pointer-events: none
... (40 more lines)
```

### src/components/shared/Stat.jsx (51 lines)
```jsx
// Metric card: label (with auto-tooltip), large value, optional sub-text
// Themed with T.card background, configurable color
... (21 more lines)
```

### src/components/shared/ProbBar.jsx (24 lines — complete)
```jsx
// Horizontal probability bar: colored fill over T.border background
// Props: value (0-1), color, h (height in px)
```

### src/components/upload/CSVUploader.jsx (202 lines)
```jsx
// Drag-drop or click-to-upload CSV files
// Auto-detect table type from column headers, or manual tab selection
// Shows upload status, record counts, data-stays-local notice
... (172 more lines)
```

### src/demo/demoData.js (304 lines)
```js
// Embedded demo accounts — 6 anonymized telecom accounts with full data
// Used when no CSV files are loaded (demo mode)
// Each account has: arr, pipeline, deals, losses, locations, engagement, etc.
... (274 more lines)
```

### vite.config.js (254 lines)
```js
// Two Vite plugins:
// 1. localDataPlugin — serves CSV/JSON from configurable data/ folder
//    - GET/POST /local-data/data-dir — get/set data directory
//    - GET /local-data/manifest — list CSV files + timestamps
//    - GET /local-data/file?name=X — read CSV content
//    - GET /local-data/*.json — pre-built JSON files
// 2. analyzePlugin — proxies POST /api/analyze to Claude API
//    - Reads VITE_ANTHROPIC_API_KEY from .env.local
//    - Sends to api.anthropic.com, extracts JSON from response
... (224 more lines)
```

### package.json (28 lines — complete)
```json
{
  "name": "revos-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.13.3",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",
    "papaparse": "^5.4.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.16",
    "vite": "^6.0.3"
  }
}
```

### scripts/build-engagements.cjs (203 lines)
```js
// Pre-processes engagements.csv (2025) → engagements.json
// Groups by account, aggregates by type+month, stores recent events with subjects
// Output per account: { t: total, c: contacts, r: reps, l: lastDate, tp: byType, m: byMonth, e: events[] }
... (173 more lines)
```

### scripts/build-engagements-2026.cjs (166 lines)
```js
// Same as above for engagement_2026.csv → engagements_2026.json
... (136 more lines)
```

### scripts/build-historical.cjs (132 lines)
```js
// Pre-processes historical.csv → historical.json
// Compact format: { p: product, m: mrr, s: stage, t: type, c: closeDate, r: rep, ... }
... (102 more lines)
```

### scripts/build-locations.cjs (142 lines)
```js
// Pre-processes locations_geocoded.csv → locations.json
// Compact: { n: name, t: type, a: address, la: lat, lo: lng, s: status, m: mrr, ... }
... (112 more lines)
```

### scripts/geocode-locations.cjs (319 lines)
```js
// Downloads GeoNames postal code data, geocodes locations.csv → locations_geocoded.csv
// Adds Latitude + Longitude columns based on postal code lookup
... (289 more lines)
```

---

## 3. Functional vs Stubbed Components

### Fully Functional Pages
| Page | Status | Notes |
|------|--------|-------|
| **Priority** | ✅ Functional | Default landing, composite scoring, 6 filter toggles |
| **Overview** | ✅ Functional | Full dashboard: stats, pipeline chart, engagement timeline |
| **Engagement** | ✅ Functional | Rep tracker, 3 tabs, draft outreach modal |
| **Locations** | ✅ Functional | Leaflet map, on/near/off-net filtering |
| **Predictions** | ✅ Functional | Bayesian model, backtest-calibrated, evidence trails |
| **Deals** | ✅ Functional | Current funnel + merged historicals with sub-filters |
| **Signals** | ⚠️ Requires API key | Claude AI analysis — needs VITE_ANTHROPIC_API_KEY |
| **Losses** | ✅ Functional | Loss/churn/disconnect breakdown |
| **Backtest** | ✅ Functional | Quarter-by-quarter accuracy chart |
| **Learning** | ✅ Functional | Accuracy vs data volume curve |

### Fully Functional Components
| Component | Status |
|-----------|--------|
| Header | ✅ |
| Sidebar | ✅ (with risk tooltips) |
| TopNav | ✅ (with Modeling dropdown) |
| CSVUploader | ✅ |
| Badge, Stat, Tip, ProbBar, ChartTheme | ✅ |

### Hooks
| Hook | Status | Notes |
|------|--------|-------|
| useAccounts | ✅ | CSV upload + demo fallback |
| useLocalData | ✅ | Folder picker, load-on-demand, refresh button |
| useClaudeAPI | ⚠️ Partially wired | Hooks exist but backend routes not used (Vite proxy used instead) |

### Backend (Python)
| Component | Status |
|-----------|--------|
| All routers/services | ❌ Not actively used | Frontend is self-contained; backend was an earlier architecture |

---

## 4. What Currently Renders

When you run `npm run dev`:

1. **Priority page** loads as default — shows all accounts ranked by composite score
2. **Sidebar** shows account list with manager filter, sales owner dropdown, search
3. **Data folder picker** button allows selecting any folder with the right CSVs
4. **Refresh button** reloads data from the selected folder
5. **Top nav** has: Priority, Overview, Engagement, Locations, Predictions, Deals, Signals, Losses — plus a "Modeling" dropdown (far right) with Backtest and Learning

Data flows: `data/*.csv` → Vite dev server → browser fetch → PapaParse → accountBuilder → React state → pages

If no data folder has CSVs: falls back to embedded demo data (6 anonymized accounts).

---

## 5. Known Issues / Errors

1. **API key placeholder**: `.env.local` has `VITE_ANTHROPIC_API_KEY=your-api-key-here` — Signals tab will fail with "Set VITE_ANTHROPIC_API_KEY in .env.local" until a real key is set
2. **Chunk size warning**: Build produces a 725KB JS chunk — could benefit from code splitting
3. **historical.json dirty data**: Some stage values contain CSV parsing artifacts (long text snippets that leaked into the stage field from multiline CSV fields) — affects ~15 records out of 15,027
4. **useLocalData comment outdated**: Doc comment still says "Polls every 5 seconds" but polling was removed in favor of manual refresh
5. **Tailwind config present but not actively used**: Inline styles via `T` constants are used everywhere instead of Tailwind classes

---

## 6. Package Dependencies

### Runtime
| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.3.1 | UI framework |
| react-dom | ^18.3.1 | DOM rendering |
| recharts | ^2.13.3 | Charts (bar, line, composed) |
| leaflet | ^1.9.4 | Map tiles + markers |
| react-leaflet | ^4.2.1 | React wrapper for Leaflet |
| papaparse | ^5.4.1 | CSV parsing in browser |

### Dev
| Package | Version | Purpose |
|---------|---------|---------|
| vite | ^6.0.3 | Dev server + bundler |
| @vitejs/plugin-react | ^4.3.4 | React fast refresh |
| tailwindcss | ^3.4.16 | CSS framework (configured but not actively used) |
| postcss | ^8.4.49 | PostCSS processor |
| autoprefixer | ^10.4.20 | CSS vendor prefixes |
| @types/react | ^18.3.12 | TypeScript types (for IDE support) |
| @types/react-dom | ^18.3.1 | TypeScript types |

---

## 7. Claude API Wiring

### Current Implementation

**Method**: Server-side proxy via Vite dev server plugin (`analyzePlugin` in `vite.config.js`)

**Flow**:
1. Frontend `Signals.jsx` sends `POST /api/analyze` with `{ prompt }` body
2. Vite middleware reads `VITE_ANTHROPIC_API_KEY` from `.env.local` (via `loadEnv`)
3. If key is missing or `"your-api-key-here"`, returns 400 error with setup instructions
4. Otherwise, proxies to `https://api.anthropic.com/v1/messages`:
   - Model: `claude-sonnet-4-20250514`
   - Max tokens: 4096
   - Sends the prompt as a user message
5. Extracts JSON from Claude's response (handles ```json blocks)
6. Returns parsed JSON to frontend

**Key location**: Environment variable `VITE_ANTHROPIC_API_KEY` in `revos/frontend/.env.local`

**Current state**: Placeholder key — requires user to replace with their actual Anthropic API key.

**What uses it**: Only the Signals page (`/api/analyze`). The Predictions, Backtest, and Learning pages all compute locally in the browser without any API calls.

**useClaudeAPI.js**: Contains hooks for `runBayesian`, `runGameTheory`, `runSignals` that call `/api/analyze/*` endpoints — these were designed for the Python backend architecture and are **not currently wired** to the Vite proxy. Only the direct `fetch('/api/analyze')` in Signals.jsx is active.

---

## NEXT ITERATION REQUIREMENTS

Architecture change: RevOS becomes a self-service platform where any company plugs in their OWN Anthropic API key. Key requirements:

- Settings page where user enters their Anthropic API key
- Key stored in browser localStorage (encrypted) or passed per-request via server proxy
- All Claude API calls (Bayesian, Game Theory, Signals, Backtest) use the user's key
- Demo mode works without any key (embedded demo data)
- Live mode requires the key — show clear error state if key is missing/invalid
- Key validation on entry: make a lightweight Claude call to verify it works
- No server-side key storage needed for v1 — the key lives with the user
- Settings page also allows: company name, default vertical, product list customization
- Migration from Next.js API routes: instead of server reading env var, frontend sends key in request header, API route passes it to Anthropic
