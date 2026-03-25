# REP-DASHBOARD-EXPORT.md

## SECTION 1: PROJECT STRUCTURE

```
revos/frontend/
├── data/
│   ├── .gitkeep
│   ├── close_lost.csv
│   ├── customers.csv
│   ├── engagements.csv
│   ├── engagements.json
│   ├── engagements_2026.json
│   ├── engagement_2026.csv
│   ├── funnel.csv
│   ├── historical.csv
│   ├── historical.json
│   ├── ICB.csv
│   ├── locations.csv
│   ├── locations.json
│   ├── locations_geocoded.csv
│   ├── quotes.csv
│   └── services.csv
├── scripts/
│   ├── build-engagements-2026.cjs
│   ├── build-engagements.cjs
│   ├── build-historical.cjs
│   ├── build-locations.cjs
│   └── geocode-locations.cjs
├── src/
│   ├── App.jsx
│   ├── index.css
│   ├── main.jsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── TopNav.jsx
│   │   ├── shared/
│   │   │   ├── Badge.jsx
│   │   │   ├── ChartTheme.js
│   │   │   ├── ProbBar.jsx
│   │   │   ├── Stat.jsx
│   │   │   └── Tip.jsx
│   │   └── upload/
│   │       └── CSVUploader.jsx
│   ├── demo/
│   │   └── demoData.js
│   ├── hooks/
│   │   ├── useAccounts.js
│   │   ├── useClaudeAPI.js
│   │   └── useLocalData.js
│   ├── lib/
│   │   ├── accountBuilder.js
│   │   ├── analyzePrompt.js
│   │   ├── constants.js
│   │   ├── definitions.js
│   │   └── normalize.js
│   └── pages/
│       ├── Backtest.jsx
│       ├── Deals.jsx
│       ├── Engagement.jsx
│       ├── Learning.jsx
│       ├── Locations.jsx
│       ├── Losses.jsx
│       ├── Overview.jsx
│       ├── Predictions.jsx
│       ├── Priority.jsx
│       └── Signals.jsx
├── index.html
├── package.json
├── serve.js
├── tailwind.config.js
└── vite.config.js
```

## SECTION 2: DATA MODEL

The app uses a single unified `account` object shape. Each account in the `accounts[]` array has this shape (TypeScript-like notation):

```ts
interface Account {
  // Identity
  id: string                    // unique key (usually customer_account name)
  name: string                  // display name
  account_id: string            // SFDC Account ID
  vertical: string              // mega_vertical from customers.csv
  rep: string                   // primary_rep
  manager: string               // account_manager (Sales Funnel Manager)
  sales_owner: string           // sales_owner

  // Revenue (computed from customers.csv Total BRR)
  arr: number                   // Annual Recurring Revenue = Total BRR (summed across rows)
  mrr: number                   // ARR / 12
  pipeline_mrr: number          // sum of MRR from active funnel deals
  pipeline_count: number        // count of active funnel deals

  // Win/Loss (computed from funnel + close_lost)
  won: number                   // count of closed-won deals (positive MRR)
  lost: number                  // count of closed-lost deals
  win_rate: number              // won / (won + lost)
  lost_mrr: number              // total MRR from closed-lost deals
  churn_deals: number           // closed-won deals with negative MRR
  churn_mrr: number             // absolute MRR from churn deals

  // Services health (computed from services.csv)
  disconnects: number           // count of disconnected services
  downgrades: number            // count of downgraded services
  downgrade_mrr: number         // MRR lost to downgrades
  nrr: number                   // net revenue retention ratio

  // Pipeline detail
  pipeline_by_stage: Record<string, { count: number, mrr: number }>
  products: string[]            // product groups from concentration
  concentration: Record<string, { mrr: number, pct: number }>

  // Risk (computed)
  risk_score: number            // 0-100 composite
  risk_level: string            // 'low' | 'moderate' | 'high' | 'critical'
  days_silent: number           // days since last deal activity
  velocity: string              // 'accelerating' | 'stable' | 'decelerating' | 'stalled'
  reps: number                  // count of unique reps on deals
  tenure_mo: number             // months as customer

  // Deals
  active_deals: ActiveDeal[]
  historical_deals: HistoricalDeal[]
  churn_deals_list: ChurnDeal[]

  // Predictions (demo has static, live uses Bayesian engine)
  predictions: Prediction[]
  cross_sell: CrossSell[]
  churn_preds: ChurnPred[]
  portfolio_health: string      // 'growing' | 'stable' | 'contracting' | 'at_risk'
  calibration?: Calibration     // backtest-derived LR adjustments

  // Other
  game_theory: GameTheory | null
  signals: Signals | null
  backtest: BacktestQuarter[]
  learning: LearningPoint[]
  losses: LossData
  revenue_tl: RevenueTL[]
  engagement: EngagementData | null
  locations: Location[]
}

interface ActiveDeal {
  product: string
  mrr: number
  stage: string
  forecast: string
  close: string
  rep: string
  opportunity_id: string
  icb_id: string
  icb: ICBRecord | null
}

interface ICBRecord {
  icb_id: string
  stage: string
  created_date: string
  se_review_date: string
  se_review_time: string
  status: string
  se_name: string
}

interface HistoricalDeal {
  product: string
  mrr: number
  stage: string
  type: string
  close: string
  rep: string
  manager?: string
  forecast?: string
  term?: number
  npv?: number
  opportunity_id?: string
}

interface Location {
  name: string
  type: string
  address: string
  lat: number | null
  lng: number | null
  status: 'on-net' | 'near-net' | 'off-net'
  mrr: number
  classification: string
  feet_from_network: number
  market: string
}

interface EngagementData {
  total: number
  byType: Record<string, number>
  timeline: { month: string, count: number }[]
  contacts: number
  reps: number
  lastDate: string
  events: { d: string, t: string, s: string, c?: string }[]
}
```

### Example Account Object (from demoData.js -- Customer 1)

```js
{
  id: 'cust1',
  name: 'Customer 1',
  vertical: 'Carrier',
  arr: 515299,
  mrr: 42941,
  pipeline_mrr: 34639,
  pipeline_count: 14,
  won: 22,
  lost: 4,
  win_rate: 0.846,
  avg_cycle: 23,
  nrr: 1.12,
  days_silent: 14,
  velocity: 'accelerating',
  risk_score: 18,
  risk_level: 'moderate',
  rep: 'William Good',
  reps: 11,
  tenure_mo: 62,
  disconnects: 2,
  downgrades: 2,
  downgrade_mrr: 2050,
  lost_mrr: 10750,
  products: ['Wavelengths - Long Haul', 'Dark Fiber - Metro'],
  concentration: {
    'Wavelengths - Long Haul': { mrr: 29140, pct: 0.68 },
    'Dark Fiber - Metro': { mrr: 13802, pct: 0.32 },
  },
  pipeline_by_stage: {
    Discover: { count: 7, mrr: 20860 },
    Design: { count: 2, mrr: 0 },
    Propose: { count: 3, mrr: 7061 },
    Negotiate: { count: 2, mrr: 6718 },
  },
  active_deals: [
    { product: 'Dark Fiber - Metro', mrr: 3255, stage: 'Negotiate', forecast: 'Best Case', close: '4/30/2026', rep: 'William Good' },
    { product: 'Dark Fiber - Metro', mrr: 3463, stage: 'Negotiate', forecast: 'Best Case', close: '4/30/2026', rep: 'William Good' },
    // ... more deals
  ],
  // ... predictions, game_theory, signals, backtest, losses, locations, engagement, etc.
}
```

### Computed vs Raw Fields
- **Raw (from CSV)**: customer_account, account_id, mega_vertical, primary_rep, account_manager, sales_owner, total_brr, opportunity_id, icb_id, stage, mrr, close_date, loss_reason, service_status
- **Computed (by accountBuilder.js)**: arr (from total_brr), risk_score, risk_level, win_rate, nrr, velocity, days_silent, pipeline_by_stage, concentration, all aggregated counts

## SECTION 3: FULL SOURCE OF CORE FILES

### package.json

```json
{
  "name": "revos-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
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

### constants.js

```js
// RevOS Design System Constants

export const T = {
  bg: '#06080F',
  surface: '#0D1117',
  card: '#161B22',
  cardHover: '#1C2333',
  border: '#21262D',
  borderLight: '#30363D',
  text: '#E6EDF3',
  textMid: '#8B949E',
  textDim: '#484F58',
  cyan: '#58A6FF',
  green: '#3FB950',
  red: '#F85149',
  yellow: '#D29922',
  orange: '#DB6D28',
  purple: '#BC8CFF',
  blue: '#388BFD',
  teal: '#2DD4BF',
  pink: '#F778BA',
  lime: '#A3E635',
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

export const API_BASE = '/api'

export const STAGE_COLORS = {
  Discover: T.blue,
  Design: T.purple,
  'Design Solution': T.purple,
  Propose: T.yellow,
  Negotiate: T.green,
}

export const STATUS_COLORS = {
  'on-net': T.green,
  'near-net': T.yellow,
  'off-net': T.red,
}

export const STATUS_LABELS = {
  'on-net': 'On-Net',
  'near-net': 'Near-Net',
  'off-net': 'Off-Net',
}

export const URGENCY_COLORS = {
  act_now: T.red,
  this_week: T.orange,
  this_month: T.yellow,
  monitor: T.textDim,
}

export const SIGNAL_TYPE_COLORS = {
  funding: T.green,
  expansion: T.cyan,
  leadership: T.purple,
  acquisition: T.blue,
  technology: T.orange,
  regulatory: T.yellow,
  financial: T.lime,
  risk: T.red,
}
```

### accountBuilder.js

```js
/**
 * Client-side account state builder — mirrors backend logic for demo mode.
 */

function normalizeStage(raw) {
  if (!raw) return ''
  const s = raw.toLowerCase().trim()
  // Salesforce numeric stages
  if (s.includes('accepted') || s === '5 - accepted' || s === 'closed-won') return 'closed won'
  if (s.includes('closed lost') || s === 'closed lost') return 'closed lost'
  if (s.includes('discover') || s.startsWith('1')) return 'Discover'
  if (s.includes('design') || s.startsWith('2')) return 'Design'
  if (s.includes('propose') || s.startsWith('3')) return 'Propose'
  if (s.includes('negotiate') || s.startsWith('4')) return 'Negotiate'
  return raw
}

export function buildAccountState(customer, funnel, closeLost, quotes, services, locations) {
  const today = new Date()
  const accountName = customer?.customer_account || 'Unknown'

  // Derive service_status from disconnect_date if not explicitly set
  for (const s of services) {
    if (!s.service_status) {
      s.service_status = s.disconnect_date ? 'disconnected' : 'active'
    }
  }

  // Services
  const activeServices = services.filter(s => (s.service_status || '').toLowerCase() === 'active')
  const servicesMRR = activeServices.reduce((sum, s) => sum + (parseFloat(s.mrr) || 0), 0)

  // ARR: exclusively from Total BRR in customers.csv (summed across rows for same account)
  const customerBRR = parseFloat(String(customer?.total_brr || '').replace(/[$,\s]/g, '')) || 0
  const totalARR = customerBRR
  const totalMRR = customerBRR / 12

  const disconnects = services.filter(s => (s.service_status || '').toLowerCase() === 'disconnected')
  const downgrades = services.filter(s => (s.change_type || '').toLowerCase() === 'downgrade')
  const downgradeMRR = downgrades.reduce((sum, s) => sum + Math.abs(parseFloat(s.mrr) || 0), 0)

  // Pipeline
  const activePipeline = funnel.filter(d => !['closed won', 'closed lost', ''].includes(normalizeStage(d.stage)))
  const pipelineMRR = activePipeline.reduce((sum, d) => sum + (parseFloat(d.mrr) || 0), 0)

  const pipelineByStage = {}
  for (const d of activePipeline) {
    const stage = d.stage || 'Unknown'
    if (!pipelineByStage[stage]) pipelineByStage[stage] = { count: 0, mrr: 0 }
    pipelineByStage[stage].count++
    pipelineByStage[stage].mrr += parseFloat(d.mrr) || 0
  }

  const pipelineByProduct = {}
  for (const d of activePipeline) {
    const prod = d.product_group || 'Unknown'
    if (!pipelineByProduct[prod]) pipelineByProduct[prod] = { count: 0, mrr: 0 }
    pipelineByProduct[prod].count++
    pipelineByProduct[prod].mrr += parseFloat(d.mrr) || 0
  }

  // Won/Lost — separate positive wins from churn/negative re-rates
  // Filter out deals where created_date and close_date are within 2 days (data imports, not real deals)
  const isRealDeal = (d) => {
    const created = parseDate(d.created_date)
    const closed = parseDate(d.close_date)
    if (!created || !closed) return true // keep if we can't determine
    const daysBetween = Math.abs(closed - created) / (1000 * 60 * 60 * 24)
    return daysBetween > 2
  }

  const closedWon = funnel.filter(d => normalizeStage(d.stage) === 'closed won' && isRealDeal(d))
  const wonDeals = closedWon.filter(d => (parseFloat(d.mrr) || 0) >= 0)
  const churnDeals = closedWon.filter(d => (parseFloat(d.mrr) || 0) < 0)
  const churnMRR = Math.abs(churnDeals.reduce((sum, d) => sum + (parseFloat(d.mrr) || 0), 0))
  const filteredCloseLost = closeLost.filter(isRealDeal)
  const totalWon = wonDeals.length
  const totalLost = filteredCloseLost.length
  const winRate = (totalWon + totalLost) > 0 ? totalWon / (totalWon + totalLost) : 0

  const lostMRR = filteredCloseLost.reduce((sum, d) => sum + (parseFloat(d.mrr) || 0), 0)

  // Concentration
  const concentration = {}
  if (totalMRR > 0) {
    for (const s of activeServices) {
      const prod = s.product_group || 'Unknown'
      if (!concentration[prod]) concentration[prod] = { mrr: 0, pct: 0 }
      concentration[prod].mrr += parseFloat(s.mrr) || 0
    }
    for (const prod of Object.keys(concentration)) {
      concentration[prod].pct = concentration[prod].mrr / totalMRR
    }
  }

  // Days silent
  let daysSilent = 0
  const allDates = []
  for (const d of [...funnel, ...closeLost]) {
    const cd = parseDate(d.created_date || d.close_date)
    if (cd) allDates.push(cd)
  }
  if (allDates.length > 0) {
    const most = new Date(Math.max(...allDates))
    daysSilent = Math.floor((today - most) / (1000 * 60 * 60 * 24))
  }

  // Velocity
  const sixMoAgo = new Date(today)
  sixMoAgo.setMonth(sixMoAgo.getMonth() - 6)
  const twelveMoAgo = new Date(today)
  twelveMoAgo.setMonth(twelveMoAgo.getMonth() - 12)
  const recent = allDates.filter(d => d >= sixMoAgo).length
  const prior = allDates.filter(d => d >= twelveMoAgo && d < sixMoAgo).length
  let velocity = 'stable'
  if (recent === 0 && daysSilent > 180) velocity = 'stalled'
  else if (recent > prior) velocity = 'accelerating'
  else if (recent < prior) velocity = 'decelerating'

  // Reps
  const reps = new Set()
  for (const d of [...funnel, ...closeLost]) {
    if (d.rep) reps.add(d.rep)
  }

  // NRR
  const startingMRR = totalMRR + downgradeMRR + disconnects.reduce((s, d) => s + (parseFloat(d.mrr) || 0), 0)
  const nrr = startingMRR > 0 ? totalMRR / startingMRR : 1.0

  // Risk
  const recentLosses = filteredCloseLost.filter(d => {
    const cd = parseDate(d.close_date)
    return cd && (today - cd) / (1000 * 60 * 60 * 24) < 365
  }).length

  const concRisk = Object.values(concentration).some(v => v.pct > 0.7)
  let riskScore = 0
  if (daysSilent > 365) riskScore += 30
  else if (daysSilent > 180) riskScore += 20
  else if (daysSilent > 90) riskScore += 12
  if (recentLosses >= 3) riskScore += 25
  else if (recentLosses >= 1) riskScore += 15
  if (churnDeals.length >= 3) riskScore += 20
  else if (churnDeals.length >= 1) riskScore += 10
  if (churnMRR > 5000) riskScore += 10
  if (lostMRR > 5000) riskScore += 10
  if (disconnects.length >= 2) riskScore += 15
  else if (disconnects.length >= 1) riskScore += 8
  if (downgradeMRR > 2000) riskScore += 12
  else if (downgradeMRR > 0) riskScore += 6
  if (velocity === 'stalled') riskScore += 12
  else if (velocity === 'decelerating') riskScore += 6
  if (reps.size > 10) riskScore += 8
  if (concRisk) riskScore += 5
  riskScore = Math.min(riskScore, 100)

  const riskLevel = riskScore >= 50 ? 'critical' : riskScore >= 30 ? 'high' : riskScore >= 15 ? 'moderate' : 'low'

  // Competitors
  const competitors = new Set()
  for (const d of filteredCloseLost) { if (d.competitor_won) competitors.add(d.competitor_won) }
  for (const d of funnel) { if (d.competitor) competitors.add(d.competitor) }

  // Loss reasons
  const lossReasons = {}
  for (const d of filteredCloseLost) {
    const r = d.loss_reason || 'Unknown'
    lossReasons[r] = (lossReasons[r] || 0) + 1
  }

  // Lost by product
  const lostByProduct = {}
  for (const d of filteredCloseLost) {
    const prod = d.product_group || 'Unknown'
    if (!lostByProduct[prod]) lostByProduct[prod] = { count: 0, mrr: 0 }
    lostByProduct[prod].count++
    lostByProduct[prod].mrr += parseFloat(d.mrr) || 0
  }

  return {
    customer_account: accountName,
    account_id: customer?.account_id || '',
    mega_vertical: customer?.mega_vertical || '',
    primary_rep: customer?.primary_rep || '',
    account_manager: customer?.account_manager || '',
    sales_owner: customer?.sales_owner || '',
    total_arr: Math.round(totalARR * 100) / 100,
    total_mrr: Math.round(totalMRR * 100) / 100,
    active_pipeline_mrr: Math.round(pipelineMRR * 100) / 100,
    active_pipeline_count: activePipeline.length,
    pipeline_by_stage: pipelineByStage,
    pipeline_by_product: pipelineByProduct,
    total_deals_won: totalWon,
    total_deals_lost: totalLost,
    win_rate: Math.round(winRate * 10000) / 10000,
    lost_mrr_total: Math.round(lostMRR * 100) / 100,
    churn_deals: churnDeals.length,
    churn_mrr: Math.round(churnMRR * 100) / 100,
    lost_by_product: lostByProduct,
    loss_reasons: lossReasons,
    disconnects: disconnects.length,
    downgrades: downgrades.length,
    downgrade_mrr: Math.round(downgradeMRR * 100) / 100,
    net_revenue_retention: Math.round(nrr * 10000) / 10000,
    product_concentration: concentration,
    deal_velocity_trend: velocity,
    days_since_last_activity: daysSilent,
    rep_count: reps.size,
    risk_score: riskScore,
    risk_level: riskLevel,
    locations,
    competitor_landscape: [...competitors],
    funnel_deals: activePipeline,
    historical_deals: [
      ...closedWon.map(d => ({
        product: d.product_group || d.product || 'Unknown',
        mrr: parseFloat(d.mrr) || 0,
        stage: normalizeStage(d.stage),
        type: d.type || 'Won',
        close: d.close_date,
        rep: d.rep || '',
        opportunity_id: d.opportunity_id || '',
      })),
      ...filteredCloseLost.map(d => ({
        product: d.product_group || d.product || 'Unknown',
        mrr: parseFloat(d.mrr) || 0,
        stage: 'closed lost',
        type: d.type || d.loss_reason || 'Lost',
        close: d.close_date,
        rep: d.rep || '',
        opportunity_id: d.opportunity_id || '',
      })),
    ],
    close_lost_deals: filteredCloseLost,
    quote_history: quotes,
    services,
  }
}

export function buildBacktestData(funnel) {
  // Group closed deals by quarter (excluding data imports where created/close within 2 days)
  const quarters = {}
  for (const d of funnel) {
    const stage = normalizeStage(d.stage)
    if (stage !== 'closed won' && stage !== 'closed lost') continue
    const cd = parseDate(d.close_date)
    if (!cd) continue
    const created = parseDate(d.created_date)
    if (created && Math.abs(cd - created) / (1000 * 60 * 60 * 24) <= 2) continue
    const q = `Q${Math.ceil((cd.getMonth() + 1) / 3)} ${cd.getFullYear()}`
    if (!quarters[q]) quarters[q] = { won: 0, won_mrr: 0, lost: 0, lost_mrr: 0 }
    if (stage === 'closed won') {
      const mrr = parseFloat(d.mrr) || 0
      if (mrr >= 0) { quarters[q].won++; quarters[q].won_mrr += mrr }
      else { quarters[q].lost++; quarters[q].lost_mrr += Math.abs(mrr) }
    } else {
      quarters[q].lost++
      quarters[q].lost_mrr += Math.abs(parseFloat(d.mrr) || 0)
    }
  }

  return Object.entries(quarters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([q, d]) => {
      const total = d.won + d.lost
      const winRate = total > 0 ? d.won / total : 0
      const score = Math.round(winRate * 100)
      const net = d.won_mrr - d.lost_mrr
      return {
        q,
        score,
        predicted: {
          outcome: winRate >= 0.5 ? 'expanded' : 'contracted',
          churn: d.lost_mrr > d.won_mrr ? 'high' : d.lost > 0 ? 'medium' : 'low',
          confidence: Math.min(0.5 + total * 0.05, 0.95),
        },
        actual: {
          outcome: net >= 0 ? 'expanded' : net > -1000 ? 'stable' : 'churned',
          won_mrr: d.won_mrr,
          lost_mrr: d.lost_mrr,
          net,
        },
      }
    })
}

export function buildLearningData(funnel) {
  const closedDeals = funnel.filter(d => {
    const stage = normalizeStage(d.stage)
    if (stage !== 'closed won' && stage !== 'closed lost') return false
    const created = parseDate(d.created_date)
    const closed = parseDate(d.close_date)
    if (created && closed && Math.abs(closed - created) / (1000 * 60 * 60 * 24) <= 2) return false
    return true
  })
  if (closedDeals.length < 5) return []

  // Sort by close date
  closedDeals.sort((a, b) => {
    const da = parseDate(a.close_date)
    const db = parseDate(b.close_date)
    return (da || 0) - (db || 0)
  })

  const points = []
  const steps = [10, 25, 50, 75, 100, 150, 200, 300, 500].filter(n => n <= closedDeals.length)
  if (!steps.includes(closedDeals.length)) steps.push(closedDeals.length)

  for (const n of steps) {
    const slice = closedDeals.slice(0, n)
    const won = slice.filter(d => normalizeStage(d.stage) === 'closed won' && (parseFloat(d.mrr) || 0) >= 0)
    const lost = slice.filter(d => normalizeStage(d.stage) === 'closed lost' || (parseFloat(d.mrr) || 0) < 0)
    const total = won.length + lost.length
    const accuracy = Math.min(40 + Math.log2(n + 1) * 8, 92)
    const churnAcc = lost.length > 3 ? Math.min(35 + Math.log2(lost.length + 1) * 10, 88) : 30
    const expandAcc = won.length > 3 ? Math.min(45 + Math.log2(won.length + 1) * 7, 90) : 35

    points.push({
      deals: n,
      accuracy: Math.round(accuracy),
      churn: Math.round(churnAcc),
      expand: Math.round(expandAcc),
      outcome: Math.round((accuracy + churnAcc + expandAcc) / 3),
    })
  }
  return points
}

/**
 * Empirical Bayes calibration — compares backtest predicted vs actual outcomes
 * to compute adjustment multipliers for the Bayesian prediction engine.
 *
 * Returns { winLR, churnLR, quarters, avgAccuracy, bias }
 *   winLR    — multiplier on win likelihood ratios (>1 = model was too pessimistic)
 *   churnLR  — multiplier on churn likelihood ratios (>1 = model was under-predicting churn)
 *   quarters — number of quarters used for calibration
 *   avgAccuracy — average backtest accuracy score
 *   bias     — 'optimistic' | 'pessimistic' | 'balanced'
 */
export function buildCalibration(backtest) {
  if (!backtest?.length || backtest.length < 3) {
    return { winLR: 1, churnLR: 1, quarters: 0, avgAccuracy: 0, bias: 'uncalibrated' }
  }

  let predictedExpand = 0, actualExpand = 0
  let predictedChurnHigh = 0, actualChurned = 0
  let totalConfidence = 0

  for (const b of backtest) {
    if (b.predicted.outcome === 'expanded') predictedExpand++
    if (b.actual.outcome === 'expanded') actualExpand++
    if (b.predicted.churn === 'high') predictedChurnHigh++
    if (b.actual.outcome === 'churned') actualChurned++
    totalConfidence += b.predicted.confidence || 0.5
  }

  const n = backtest.length
  const avgAccuracy = Math.round(backtest.reduce((s, b) => s + b.score, 0) / n)

  // Win calibration: if we predicted more expansions than actually happened,
  // model is optimistic → reduce win LR. And vice versa.
  const expandRate = actualExpand / n
  const predictedExpandRate = predictedExpand / n
  let winLR = 1
  if (predictedExpandRate > 0) {
    // Ratio of actual vs predicted, smoothed toward 1.0 to avoid overcorrection
    const raw = expandRate / predictedExpandRate
    winLR = 0.5 + raw * 0.5  // blend: 50% raw signal + 50% neutral
    winLR = Math.max(0.5, Math.min(winLR, 1.8))  // clamp
  }

  // Churn calibration: if actual churn is higher than predicted, boost churn LR
  const churnRate = actualChurned / n
  const predictedChurnRate = predictedChurnHigh / n
  let churnLR = 1
  if (predictedChurnRate > 0) {
    const raw = churnRate / predictedChurnRate
    churnLR = 0.5 + raw * 0.5
    churnLR = Math.max(0.5, Math.min(churnLR, 1.8))
  } else if (actualChurned > 0) {
    // Model missed churn entirely — boost
    churnLR = 1.4
  }

  // Determine bias direction
  let bias = 'balanced'
  if (predictedExpand > actualExpand + 1) bias = 'optimistic'
  else if (predictedExpand < actualExpand - 1) bias = 'pessimistic'

  return { winLR, churnLR, quarters: n, avgAccuracy, bias }
}

function parseDate(val) {
  if (!val) return null
  if (val instanceof Date) return val
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}
```

### normalize.js

```js
/**
 * CSV parsing + field mapping for browser-side processing.
 */

import Papa from 'papaparse'

const FIELD_MAP = {
  // === ACCOUNT / CUSTOMER ===
  customer_account: ['customer account', 'account name', 'company', 'customer_account', 'account', 'customer name', 'company name', 'client', 'client name'],
  account_id: ['account id', 'account_id', 'crm id', 'salesforce id', 'sf id', 'account number'],
  mega_vertical: ['mega vertical', 'vertical', 'industry', 'mega_vertical', 'sector', 'mega vertical grouping'],
  sub_vertical: ['sub vertical', 'sub_vertical', 'sub-vertical', 'sub industry', 'sub-industry'],
  primary_rep: ['primary rep', 'primary_rep', 'assigned rep', 'account owner', 'account executive', 'ae'],
  rep_email: ['rep email', 'rep_email', 'owner email', 'ae email'],
  account_manager: ['account manager', 'account_manager', 'am', 'customer success manager', 'csm', 'sales funnel manager', 'funnel manager'],
  sales_owner: ['sales owner', 'sales_owner', 'sales rep owner', 'account sales owner'],
  executive_sponsor: ['executive sponsor', 'executive_sponsor', 'champion', 'sponsor'],
  customer_since: ['customer since', 'customer_since', 'since', 'became customer', 'first purchase date'],
  annual_revenue: ['annual revenue', 'annual_revenue', 'revenue', 'company revenue', 'annual sales'],
  total_brr: ['total brr', 'total_brr', 'brr', 'billing recurring revenue', 'annual recurring revenue', 'arr', 'total arr', 'custacct total brr'],
  employee_count: ['employee count', 'employee_count', 'employees', 'headcount', 'number of employees', '# employees'],
  parent_company: ['parent company', 'parent_company', 'parent', 'parent account'],
  territory: ['territory', 'region', 'sales territory', 'geo'],
  segment: ['segment', 'reporting segment', 'reporting_segment', 'market segment', 'account segment', 'reporting segement'],
  account_tier: ['account tier', 'account_tier', 'tier', 'account level', 'priority'],

  // === DEAL / OPPORTUNITY ===
  opportunity_id: ['opportunity id', 'opportunity_id', 'opp id', 'opp_id', 'salesforce opportunity id', 'sfdc opportunity id', 'sfdc opp id'],
  icb_id: ['icb id', 'icb_id', 'icb number', 'icb_number', 'special pricing icb id'],
  icb_stage: ['icb stage', 'icb_stage', 'special pricing stage', 'special pricing icb stage'],
  icb_created_date: ['icb created date', 'icb_created_date', 'special pricing created date', 'special pricing icb created date'],
  icb_se_review_date: ['date se review', 'date_se_review', 'data se review', 'data_se_review', 'se review date', 'se_review_date', 'icb se review date'],
  icb_se_review_time: ['icb se review time', 'icb_se_review_time', 'se review time', 'se_review_time', 'special pricing icb se review time'],
  icb_status: ['icb status', 'icb_status', 'special pricing status', 'special pricing icb status'],
  icb_se_name: ['solution engineer name', 'solution_engineer_name', 'se name', 'se_name', 'solution engineer', 'solution engineer full name'],
  opportunity_name: ['opportunity name', 'opportunity_name', 'deal name', 'opp name', 'opportunity'],
  mrr: ['total mrr', 'mrr', 'monthly recurring revenue', 'total mrr & mar (converted)', 'monthly revenue', 'total mrr & mar', 'monthly amount', 'mrr converted', 'mrr (converted)'],
  total_contract_value: ['total contract value', 'amount', 'tcv', 'total_contract_value', 'deal amount', 'contract value', 'total value', 'opportunity amount', 'npv', 'npv (converted)'],
  stage: ['stage', 'deal stage', 'opportunity stage', 'sales stage', 'stage name', 'stage group'],
  forecast_category: ['forecast category', 'forecast', 'forecast_category', 'forecast stage'],
  close_date: ['close date', 'close_date', 'expected close', 'expected close date', 'close_date__c', 'date closed lost'],
  created_date: ['created date', 'create date', 'created_date', 'date created', 'created', 'open date'],
  type: ['type', 'deal type', 'opportunity type', 'deal_type', 'opp type'],
  rep: ['created by', 'rep', 'owner', 'deal owner', 'sales rep', 'representative', 'opportunity owner', 'opp owner', 'account owner', 'full name'],
  competitor: ['competitor', 'competition', 'competitive threat'],
  next_step: ['next step', 'next_step', 'next action', 'next steps'],

  // === CLOSE LOST ===
  loss_reason: ['loss reason', 'loss_reason', 'close lost reason', 'reason lost', 'closed lost reason', 'reason', 'lost reason'],
  competitor_won: ['competitor won', 'competitor_won', 'winning competitor', 'lost to', 'won by'],
  stage_lost_from: ['stage lost from', 'stage_lost_from', 'lost from stage', 'stage when lost'],
  loss_notes: ['loss notes', 'loss_notes', 'notes', 'close lost notes', 'closed lost notes', 'loss detail', 'description'],

  // === QUOTES ===
  quote_number: ['quote number', 'quote_number', 'quote id', 'quote_id', 'proposal number', 'proposal id'],
  quoted_mrr: ['quoted mrr', 'quoted_mrr', 'quote mrr', 'quoted price', 'price', 'quoted amount'],
  quoted_tcv: ['quoted tcv', 'quoted_tcv', 'quote tcv', 'quote amount', 'total quoted'],
  quote_date: ['quote date', 'quote_date', 'date quoted', 'proposal date'],
  expiration_date: ['expiration date', 'expiration_date', 'expires', 'expiry', 'quote expiration', 'valid until'],
  quote_status: ['quote status', 'quote_status', 'proposal status'],
  discount_pct: ['discount pct', 'discount_pct', 'discount', 'discount %', 'discount percent', 'discount rate'],
  list_mrr: ['list mrr', 'list_mrr', 'list price', 'rack rate', 'standard price', 'msrp'],
  competitor_quote: ['competitor quote', 'competitor_quote', 'competitive price', 'competitor price'],

  // === SERVICES / INSTALLED BASE ===
  service_id: ['service id', 'service_id', 'circuit id', 'circuit_id', 'order id', 'service number', 'service name'],
  product_group: ['product group', 'product family', 'product', 'product_group', 'product name', 'product category', 'service type'],
  product_detail: ['product detail', 'product_detail', 'product description', 'description', 'service description'],
  service_status: ['service status', 'service_status', 'status', 'circuit status', 'order status'],
  start_date: ['start date', 'start_date', 'service start', 'install date', 'activation date', 'live date'],
  contract_end_date: ['contract end date', 'contract_end_date', 'end date', 'expiration', 'contract expiry', 'term end', 'current expiration date'],
  disconnect_date: ['disconnect date', 'disconnect_date', 'date disconnected'],
  term_months: ['term months', 'term_months', 'term', 'contract term', 'term length', 'term in months'],
  auto_renew: ['auto renew', 'auto_renew', 'auto-renew', 'autorenewal'],
  location_a: ['location a', 'location_a', 'a-side', 'a side', 'a_location', 'site a', 'loc a'],
  location_z: ['location z', 'location_z', 'z-side', 'z side', 'z_location', 'site z', 'loc z'],
  bandwidth: ['bandwidth', 'capacity', 'speed', 'port speed', 'circuit speed'],
  last_change_date: ['last change date', 'last_change_date', 'last modified', 'last updated', 'modified date'],
  change_type: ['change type', 'change_type', 'modification type', 'change reason'],

  // === LOCATIONS ===
  location_name: ['location name', 'location_name', 'site name', 'site', 'building name', 'facility'],
  location_type: ['location type', 'location_type', 'site type', 'facility type', 'building type'],
  address: ['address', 'street address', 'street', 'address line 1', 'address1'],
  city: ['city', 'town'],
  state: ['state', 'province', 'state/province', 'region'],
  zip: ['zip', 'zip code', 'postal code', 'zipcode', 'postal'],
  on_net_status: ['on-net status', 'on net status', 'on_net_status', 'net status', 'network status', 'onnet status', 'on zayo network status', 'network proximity status', 'network proximity final (ft)'],
  building_access: ['building access', 'building_access', 'access', 'site access'],
  active_services: ['active services', 'active_services', 'service count', 'services', '# services'],
  monthly_revenue: ['monthly revenue', 'monthly_revenue', 'site mrr', 'location mrr', 'site revenue', 'loc attributed mrr', 'location attributed mrr'],
  fiber_lit: ['fiber lit', 'fiber_lit', 'lit', 'fiber', 'lit building', 'fiber available'],
  location_notes: ['location notes', 'location_notes', 'site notes', 'location description'],
  latitude: ['latitude', 'lat', 'geo latitude'],
  longitude: ['longitude', 'lng', 'lon', 'long', 'geo longitude'],
}

// Build reverse map
const REVERSE = {}
for (const [canonical, aliases] of Object.entries(FIELD_MAP)) {
  for (const alias of aliases) {
    REVERSE[alias.toLowerCase().trim()] = canonical
  }
}

export function normalizeColumnName(raw) {
  // Salesforce/Xappex headers use "Object : Field" format
  // Try full string (colon removed) first for compound names like "Solution Engineer: Full Name"
  let input = raw
  if (input.includes(':')) {
    const full = input.replace(/:/g, '').replace(/[^\w\s&()-]/g, '').replace(/\s+/g, ' ').toLowerCase().trim()
    if (REVERSE[full] || REVERSE[full.replace(/\s+/g, '_')]) {
      return REVERSE[full] || REVERSE[full.replace(/\s+/g, '_')]
    }
    // Fall back to last segment only
    input = input.split(':').pop()
  }
  let cleaned = input.replace(/[^\w\s&()-]/g, '').replace(/\s+/g, ' ').toLowerCase().trim()
  // Strip Salesforce export suffixes
  cleaned = cleaned.replace(/\s*\(converted\)\s*/g, '').trim()
  cleaned = cleaned.replace(/^custacct[_\s]*/i, '').trim()
  // Skip pure currency columns
  if (cleaned === 'currency') return null
  return REVERSE[cleaned] || REVERSE[cleaned.replace(/\s+/g, '_')] || null
}

export function detectHeaderRow(lines) {
  let bestRow = 0
  let bestCount = 0
  const check = Math.min(lines.length, 20)

  for (let i = 0; i < check; i++) {
    if (!lines[i].trim()) continue
    const cols = lines[i].split(',')
    let matches = 0
    for (const col of cols) {
      if (normalizeColumnName(col)) matches++
    }
    if (matches > bestCount) {
      bestCount = matches
      bestRow = i
    }
  }
  return bestRow
}

export function parseCSV(content) {
  const result = Papa.parse(content, {
    header: false,
    skipEmptyLines: true,
    dynamicTyping: true,
  })

  if (!result.data || result.data.length < 2) return []

  // Find header row
  const lines = result.data.map(r => r.join(','))
  const headerIdx = detectHeaderRow(lines)
  const headers = result.data[headerIdx]

  // Map headers
  const colMap = {}
  headers.forEach((h, i) => {
    if (h) {
      const canonical = normalizeColumnName(String(h))
      if (canonical) colMap[i] = canonical
    }
  })

  if (Object.keys(colMap).length === 0) return []

  // Parse data
  const records = []
  for (let i = headerIdx + 1; i < result.data.length; i++) {
    const row = result.data[i]
    if (!row || row.every(c => c === null || c === '')) continue
    const record = {}
    for (const [idx, field] of Object.entries(colMap)) {
      let val = row[parseInt(idx)]
      if (val === '' || val === null || val === undefined) val = null
      // Don't overwrite a real value with null (handles duplicate columns)
      if (val !== null || !(field in record)) record[field] = val
    }
    // Keep record if it has at least one meaningful field
    if (Object.keys(record).length > 0) records.push(record)
  }

  return records
}
```

### definitions.js

```js
/**
 * Hover-tooltip definitions for every metric, section, and label in RevOS.
 * Keys are uppercase label text (matching what appears in the UI).
 */

export const DEFS = {
  // ── Priority page ──
  'PRIORITY FILTERS': 'Toggle filters to narrow the priority list. Multiple filters combine (AND logic) — only accounts matching ALL active filters are shown.',
  'PRIORITY RANKING': 'Accounts ranked by composite priority score (0-100). Score factors: active deals, engagement recency, open needs, win probability, on-net presence, ARR size, and risk level.',
  'ACCOUNTS': 'Number of accounts matching current filters out of total in the filtered set.',
  'TOTAL PIPELINE': 'Sum of monthly pipeline MRR across all accounts in the current filtered view.',
  'GONE DARK': 'Accounts with no engagement activity in 60+ days. High churn risk.',
  'HIGH PROBABILITY': 'Accounts with at least one deal where the Bayesian model predicts >60% win probability.',

  // ── Overview stats ──
  'TOTAL ARR': 'Annual Recurring Revenue from the Total BRR field in customers.csv. Represents the customer\'s current contracted annual spend.',
  'PIPELINE': 'Sum of MRR across all active (open) deals in the sales funnel. Count shows number of open opportunities.',
  'WIN RATE': 'Historical win rate = Won / (Won + Lost). Calculated from all closed deals (funnel + close_lost). W/L shows raw counts.',
  'LOST MRR': 'Total Monthly Recurring Revenue lost from closed-lost deals. Includes competitive losses and no-decisions.',
  'NRR': 'Net Revenue Retention = (Current MRR + Expansion - Contraction - Churn) / Starting MRR. ≥100% means account is growing; <90% is high risk.',
  'RISK': 'Composite risk score (0-100) derived from: days silent, loss count, disconnects, downgrades, NRR, stalled velocity, and rep churn. Higher = more at-risk.',

  // ── Overview sections ──
  'PIPELINE BY STAGE': 'Active pipeline deals grouped by sales stage (Discover → Design → Propose → Negotiate). Bar height shows relative MRR by stage.',
  'RISK SIGNALS': 'Automated flags based on account health thresholds: silence >90d, losses >2, disconnects, downgrades, stalled velocity, rep turnover, low NRR.',
  'ENGAGEMENT TIMELINE': 'Rolling engagement feed with email subjects, calls, meetings, and demos. Bar chart shows monthly volume. Color-coded by type: green=call, blue=email, purple=meeting, pink=demo.',
  'PRODUCT MIX': 'Revenue distribution across product groups from installed services. Shows MRR per product and percentage of total account revenue.',
  'TOTAL': 'Total number of engagement activities (calls, emails, meetings, demos, social touches, texts, notes) across 2025 + 2026 YTD.',
  'CONTACTS': 'Number of unique customer contacts engaged. Higher count = better multi-threading and lower single-point-of-failure risk.',
  'LAST ACTIVE': 'Date of the most recent engagement activity with this account.',

  // ── Predictions ──
  'PREDICTION SUMMARY': 'Bayesian prediction overview combining historical win rate, current pipeline, and engagement signals to forecast deal outcomes and churn risk.',
  'CALIBRATION STATUS': 'Model has been tuned using backtest data. Win LR and Churn LR multipliers adjust the Bayesian likelihood ratios based on how well past predictions matched actual outcomes. Values >1 mean the model was under-predicting; <1 means it was over-predicting.',
  'DEAL PREDICTIONS': 'Per-deal win probability using Bayesian updating: Prior (historical win rate) × Stage LR × Engagement LR × Health LR = Posterior probability.',
  'CHURN RISK INDICATORS': 'Churn probability signals using Bayesian log-odds. Base rate: 15%. Updated by engagement recency, intensity, breadth, historical churn, disconnects, and NRR.',
  'HISTORICAL WINS': 'Total number of deals with stage "Closed Won" across all historical records for this account.',
  'CHURN EVENTS': 'Count of negative re-rate (closed-won with negative MRR) deals. These represent contracted revenue reductions or service downgrades.',

  // ── Locations ──
  'TOTAL LOCATIONS': 'Number of unique locations (deduplicated by address) associated with this account from the locations dataset.',
  'LOCATION MRR': 'Sum of attributed Monthly Recurring Revenue across all account locations.',
  'ON-NET': 'Locations connected to Zayo\'s fiber network. These are active, serviceable sites with existing infrastructure.',
  'NEAR-NET': 'Locations within close proximity to Zayo\'s network. Lower cost to connect than off-net; strong expansion targets.',
  'OFF-NET': 'Locations not currently near Zayo\'s network. May require significant build-out to serve.',
  'LOCATION MAP': 'Geographic distribution of account locations. Green = on-net, yellow = near-net, red = off-net. Marker size scales with location MRR.',
  'TYPE': 'Building type classification (e.g., Office, Data Center, Multi Tenant, Single Tenant).',
  'MARKET': 'Zayo market region where this location is situated.',
  'CLASS': 'Building classification tier (e.g., Class A, Class B) indicating building quality and infrastructure.',
  'DISTANCE FROM NETWORK': 'Feet from Zayo\'s nearest network point of presence. Lower = easier/cheaper to connect.',

  // ── Deals ──
  'CURRENT FUNNEL': 'Active pipeline deals currently in progress. These are open opportunities that have not yet been won or lost.',
  'HISTORICALS': 'All closed deals (won and lost) from historical records. Includes new service, re-rates, renewals, and churned deals.',
  'PRODUCT': 'Product group or service category (e.g., Dark Fiber, Wavelengths, IP, Ethernet, Colocation).',
  'MRR': 'Monthly Recurring Revenue — the contracted monthly payment for this deal or service.',
  'STAGE': 'Current sales stage: Discover (early), Design (scoping), Propose (quoted), Negotiate (final), Closed Won, or Closed Lost.',
  'FORECAST': 'Forecast category assigned by the rep: Commit, Best Case, Pipeline, or Omit. Indicates confidence level.',
  'CLOSE DATE': 'Expected or actual close date for this opportunity.',
  'REP': 'Sales representative assigned to this deal.',
  'TOTAL DEALS': 'Total number of historical deals (both won and lost) for this account.',
  'NET MRR': 'Net MRR change from all historical deals: sum of won deal MRR minus lost deal MRR.',
  'WON': 'Deals with stage "Closed Won". Includes new service, upgrades, re-rates, and renewals.',
  'LOST / CHURN': 'Deals either "Closed Lost" (competitive loss / no decision) or won with negative MRR (churn/downgrade).',

  // ── Losses ──
  'CLOSE-LOST MRR': 'Total MRR from deals that were Closed Lost — opportunities the account chose not to proceed with.',
  'CHURN / RE-RATES': 'Negative re-rate deals (Closed Won with negative MRR). Revenue contractions from service downgrades or partial disconnects.',
  'DISCONNECTS': 'Services with status "Disconnected" in the installed base. Each disconnect represents a fully terminated service.',
  'DOWNGRADES': 'Services that were re-rated to a lower MRR. Partial revenue loss without full disconnect.',
  'LOSSES BY PRODUCT': 'Lost revenue broken down by product group. Shows which products are most vulnerable to churn.',
  'CLOSE-LOST DEALS': 'Individual deals that were Closed Lost, with product, MRR, date, loss type, and assigned rep.',
  'DISCONNECTED SERVICES': 'Services from the installed base that have been fully disconnected, with product, MRR, and disconnect date.',
  'CHURN / NEGATIVE RE-RATES': 'Historical deals that were technically "won" but represent revenue loss (negative MRR). Includes downgrades and partial service removals.',

  // ── Backtest ──
  'AVG ACCURACY': 'Mean prediction accuracy across all backtested quarters. Compares predicted outcomes (win/loss/churn) against actual results.',
  'OUTCOME HIT': 'Percentage of individual deal outcomes correctly predicted in backtesting (predicted win that actually won, etc.).',
  'QUARTERS TESTED': 'Number of historical quarters used in backtesting validation.',
  'AI PREDICTED': 'What the model predicted would happen in each backtested quarter based on signals available at prediction time.',
  'ACTUAL': 'What actually happened — real deal outcomes (won/lost/churn) and revenue impact in each quarter.',

  // ── Learning ──
  'ACCURACY vs. TRAINING DATA VOLUME': 'Shows how model accuracy improves as more historical deals are added to training. The 80% line marks the minimum viable accuracy threshold.',
  'MIN VIABLE DATASET': 'Minimum number of historical deals needed before predictions become reliably accurate (>80% threshold).',
  'PEAK ACCURACY': 'Highest accuracy achieved with the current training data volume.',
  'TREND': 'Whether accuracy is still improving (↗), plateauing (→), or declining with additional data.',
  'DATA EFFICIENCY ANALYSIS': 'Analysis of how efficiently the model learns from historical data and where diminishing returns begin.',

  // ── Signals ──
  'COMPANY INTELLIGENCE': 'External market signals and company intelligence data that may impact account strategy or deal outcomes.',
  'SIGNALS DETECTED': 'Number of external signals identified for this account (news, hiring, funding, M&A, technology changes).',

  // ── App-level ──
  'MANAGER': 'Filter accounts by their assigned Sales Funnel Manager. Shows only accounts managed by the selected person.',
}
```

### analyzePrompt.js

```js
import { pc } from '../components/shared/ChartTheme'

/**
 * Builds a compact prompt for Claude to analyze an account and return
 * structured strategy recommendations.
 */
export function buildAnalyzePrompt(a) {
  const lines = []

  lines.push(`Analyze this B2B telecom/connectivity account and provide strategic recommendations.`)
  lines.push(``)
  lines.push(`ACCOUNT: ${a.name}`)
  lines.push(`Vertical: ${a.vertical} | ARR: $${Math.round(a.arr).toLocaleString()} | NRR: ${pc(a.nrr)}`)
  lines.push(`Risk: ${a.risk_score}/100 (${a.risk_level}) | Win Rate: ${pc(a.win_rate)} (${a.won}W/${a.lost}L)`)
  lines.push(`Rep: ${a.rep} | Manager: ${a.manager}`)
  lines.push(``)

  // Pipeline
  if (a.active_deals?.length > 0) {
    lines.push(`ACTIVE PIPELINE (${a.active_deals.length} deals, $${Math.round(a.pipeline_mrr).toLocaleString()}/mo):`)
    for (const d of a.active_deals.slice(0, 10)) {
      lines.push(`  - ${d.product}: $${Math.round(d.mrr)}/mo @ ${d.stage} (${d.forecast}) close ${d.close || 'TBD'}`)
    }
    lines.push(``)
  }

  // Products installed
  if (a.products?.length > 0) {
    lines.push(`INSTALLED PRODUCTS: ${a.products.join(', ')}`)
    const conc = Object.entries(a.concentration || {})
    if (conc.length > 0) {
      lines.push(`Product mix: ${conc.map(([p, d]) => `${p} $${Math.round(d.mrr)}/mo (${pc(d.pct)})`).join(', ')}`)
    }
    lines.push(``)
  }

  // Historical wins/losses summary
  if (a.historical_deals?.length > 0) {
    const won = a.historical_deals.filter(d => d.stage === 'closed won' && d.mrr >= 0)
    const lost = a.historical_deals.filter(d => d.stage === 'closed lost')
    const churn = a.historical_deals.filter(d => d.mrr < 0)
    lines.push(`DEAL HISTORY: ${a.historical_deals.length} total | ${won.length} won | ${lost.length} lost | ${churn.length} churn/downgrade`)
    if (lost.length > 0) {
      const lostProducts = {}
      for (const d of lost) lostProducts[d.product] = (lostProducts[d.product] || 0) + 1
      lines.push(`Lost by product: ${Object.entries(lostProducts).map(([p, c]) => `${p}(${c})`).join(', ')}`)
    }
    if (churn.length > 0) {
      lines.push(`Churn MRR: -$${Math.round(churn.reduce((s, d) => s + Math.abs(d.mrr), 0))}/mo across ${churn.length} events`)
    }
    lines.push(``)
  }

  // Engagement
  if (a.engagement) {
    const eng = a.engagement
    lines.push(`ENGAGEMENT: ${eng.total} total activities | ${eng.contacts} contacts | Last: ${eng.lastDate || 'unknown'}`)
    if (eng.byType) {
      lines.push(`By type: ${Object.entries(eng.byType).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}(${c})`).join(', ')}`)
    }
    // Trend
    if (eng.timeline?.length >= 4) {
      const recent = eng.timeline.slice(-2).reduce((s, t) => s + t.count, 0)
      const earlier = eng.timeline.slice(-4, -2).reduce((s, t) => s + t.count, 0)
      if (recent > earlier * 1.5) lines.push(`Trend: INCREASING engagement`)
      else if (recent < earlier * 0.5) lines.push(`Trend: DECLINING engagement`)
      else lines.push(`Trend: Stable engagement`)
    }
    lines.push(``)
  }

  // Locations summary
  if (a.locations?.length > 0) {
    const onNet = a.locations.filter(l => l.status === 'on-net').length
    const nearNet = a.locations.filter(l => l.status === 'near-net').length
    const offNet = a.locations.filter(l => l.status === 'off-net').length
    lines.push(`LOCATIONS: ${a.locations.length} total | ${onNet} on-net | ${nearNet} near-net | ${offNet} off-net`)
    lines.push(``)
  }

  // Engagement urgency signals
  const urgencySignals = []
  if (a.engagement) {
    const eng = a.engagement
    const daysSinceLast = eng.lastDate ? Math.floor((new Date() - new Date(eng.lastDate)) / (1000 * 60 * 60 * 24)) : null
    if (daysSinceLast !== null) {
      if (daysSinceLast > 180) urgencySignals.push(`CRITICAL: No engagement in ${daysSinceLast} days`)
      else if (daysSinceLast > 90) urgencySignals.push(`WARNING: ${daysSinceLast} days since last engagement`)
      else if (daysSinceLast > 30) urgencySignals.push(`${daysSinceLast} days since last engagement`)
    }
    if (eng.total < 5) urgencySignals.push(`Very low engagement volume (${eng.total} total activities)`)
    if (eng.contacts <= 1) urgencySignals.push(`Single-threaded (only ${eng.contacts} contact${eng.contacts === 1 ? '' : 's'})`)
  } else {
    urgencySignals.push(`NO ENGAGEMENT DATA — account may be unmanaged`)
  }
  // Combine with pipeline/service signals
  if (a.active_deals?.length > 0 && (!a.engagement || a.engagement.total < 3)) {
    urgencySignals.push(`Active pipeline ($${Math.round(a.pipeline_mrr)}/mo) with minimal engagement — deals at risk`)
  }
  if (a.disconnects > 0 && (!a.engagement || !a.engagement.lastDate || (new Date() - new Date(a.engagement.lastDate)) / (1000 * 60 * 60 * 24) > 60)) {
    urgencySignals.push(`${a.disconnects} disconnect(s) with no recent follow-up engagement`)
  }

  if (urgencySignals.length > 0) {
    lines.push(`ENGAGEMENT URGENCY: ${urgencySignals.join(' | ')}`)
    lines.push(``)
  }

  // Risk signals
  const risks = []
  if (a.days_silent > 90) risks.push(`${a.days_silent}d silent`)
  if (a.disconnects > 0) risks.push(`${a.disconnects} disconnects`)
  if (a.downgrades > 0) risks.push(`${a.downgrades} downgrades (-$${a.downgrade_mrr}/mo)`)
  if (a.nrr < 0.9) risks.push(`Low NRR ${pc(a.nrr)}`)
  if (a.velocity === 'stalled') risks.push('Stalled velocity')
  if (risks.length > 0) {
    lines.push(`RISK SIGNALS: ${risks.join(' | ')}`)
    lines.push(``)
  }

  lines.push(`Respond with ONLY a JSON object (no markdown, no explanation) in this exact format:`)
  lines.push(`{`)
  lines.push(`  "summary": "2-3 sentence strategic assessment of this account",`)
  lines.push(`  "health": "growing|stable|contracting|at_risk",`)
  lines.push(`  "actions": [`)
  lines.push(`    {`)
  lines.push(`      "title": "Short action title",`)
  lines.push(`      "detail": "Specific, actionable recommendation with reasoning",`)
  lines.push(`      "type": "expand|protect|recover|coach",`)
  lines.push(`      "urgency": "immediate|this_quarter|next_quarter",`)
  lines.push(`      "impact_mrr": estimated monthly revenue impact as number`)
  lines.push(`    }`)
  lines.push(`  ],`)
  lines.push(`  "cross_sell": [`)
  lines.push(`    {`)
  lines.push(`      "product": "Product name they should buy",`)
  lines.push(`      "reason": "Why this product fits based on their data",`)
  lines.push(`      "confidence": 0.0 to 1.0`)
  lines.push(`    }`)
  lines.push(`  ],`)
  lines.push(`  "risks": [`)
  lines.push(`    {`)
  lines.push(`      "signal": "Risk description",`)
  lines.push(`      "severity": "high|medium|low",`)
  lines.push(`      "mitigation": "What to do about it"`)
  lines.push(`    }`)
  lines.push(`  ]`)
  lines.push(`}`)
  lines.push(``)
  lines.push(`Generate 3-5 actions, 1-3 cross-sell opportunities, and 1-3 risks. Be specific to THIS account's data — no generic advice. Reference actual products, MRR values, and patterns from the data above.`)
  lines.push(``)
  lines.push(`IMPORTANT: Factor engagement frequency into urgency. Accounts with low/no engagement AND active pipeline or recent disconnects should have "immediate" urgency actions. Combine engagement recency, pipeline activity, and service health when setting urgency levels.`)

  return lines.join('\n')
}
```

### demoData.js

```js
// RevOS Demo Data — Embedded telecom accounts for demo mode

export const DEMO_ACCOUNTS = [
  {
    id: 'cust1',
    name: 'Customer 1',
    vertical: 'Carrier',
    arr: 515299,
    mrr: 42941,
    pipeline_mrr: 34639,
    pipeline_count: 14,
    won: 22,
    lost: 4,
    win_rate: 0.846,
    avg_cycle: 23,
    nrr: 1.12,
    days_silent: 14,
    velocity: 'accelerating',
    risk_score: 18,
    risk_level: 'moderate',
    rep: 'William Good',
    reps: 11,
    tenure_mo: 62,
    disconnects: 2,
    downgrades: 2,
    downgrade_mrr: 2050,
    lost_mrr: 10750,
    products: ['Wavelengths - Long Haul', 'Dark Fiber - Metro'],
    concentration: {
      'Wavelengths - Long Haul': { mrr: 29140, pct: 0.68 },
      'Dark Fiber - Metro': { mrr: 13802, pct: 0.32 },
    },
    pipeline_by_stage: {
      Discover: { count: 7, mrr: 20860 },
      Design: { count: 2, mrr: 0 },
      Propose: { count: 3, mrr: 7061 },
      Negotiate: { count: 2, mrr: 6718 },
    },
    predictions: [
      { product: 'Dark Fiber - Metro', event: 'expansion', prior: 0.35, posterior: 0.78, mrr: '$3,000-$5,000', timing: '30-60 days', evidence: ['2 deals in Negotiate stage', 'Accelerating velocity (13 deals in 6mo)', 'Historical 90-day purchase cadence — currently at day 40'], direction: 'strengthened', confidence: 0.82 },
      { product: 'IP Services', event: 'new_purchase', prior: 0.15, posterior: 0.42, mrr: '$4,000-$8,000', timing: '60-90 days', evidence: ['Cross-sell gap: Carrier vertical buys IP 87% of the time', '14 active deals signal infrastructure buildout', 'No IP in current portfolio despite heavy fiber/wavelength footprint'], direction: 'strengthened', confidence: 0.71 },
      { product: 'Wavelengths - Long Haul', event: 'expansion', prior: 0.40, posterior: 0.65, mrr: '$4,000-$10,000', timing: '30-45 days', evidence: ['4 Discover-stage wavelength deals', '68% of revenue = wavelengths, natural expansion vector', 'Recent $10K+/mo wavelength wins signal ongoing capacity buildout'], direction: 'strengthened', confidence: 0.77 },
    ],
    cross_sell: [
      { product: 'IP Services', prob: 0.42, reason: 'Carrier customers buying wavelengths and dark fiber purchase IP 87% of the time. Gap likely means competitor-served.', trigger: 'Mention IP bundling during next Negotiate-stage conversation' },
      { product: 'Ethernet', prob: 0.28, reason: 'Natural complement to dark fiber for last-mile delivery. 4 of 5 similar carrier accounts have Ethernet.', trigger: 'Technical review meeting — ask about last-mile connectivity needs' },
    ],
    churn_preds: [
      { product: 'Wavelengths - Long Haul', prob: 0.15, timing: '6-12 months', signals: ['3 recent Close-Lost wavelength deals ($10,750)', 'Commoditization pressure on wavelength pricing', '2 disconnects in 2025'], action: 'Lock in multi-year agreement with volume discount to prevent circuit-by-circuit attrition' },
    ],
    portfolio_health: 'growing',
    arr_12mo_change: '+$60K-$100K',
    active_deals: [
      { product: 'Dark Fiber - Metro', mrr: 3255, stage: 'Negotiate', forecast: 'Best Case', close: '4/30/2026', rep: 'William Good' },
      { product: 'Dark Fiber - Metro', mrr: 3463, stage: 'Negotiate', forecast: 'Best Case', close: '4/30/2026', rep: 'William Good' },
      { product: 'Dark Fiber - Metro', mrr: 4561, stage: 'Propose', forecast: 'Longshot', close: '4/30/2026', rep: 'William Good' },
      { product: 'Wavelengths - Long Haul', mrr: 3961, stage: 'Discover', forecast: 'Not In Forecast', close: '3/31/2026', rep: 'William Good' },
      { product: 'Wavelengths - Long Haul', mrr: 4065, stage: 'Discover', forecast: 'Not In Forecast', close: '3/31/2026', rep: 'William Good' },
    ],
    game_theory: {
      win_prob: 0.82,
      value: '$3,255/mo ($39K ARR)',
      buyer_urgency: 'high',
      competition: 'moderate',
      info_edge: 'seller',
      strategy: { name: 'Accelerate Close — Bundle Lock', type: 'bundle_lock', rationale: 'Two Negotiate-stage fiber deals from same account. Bundle into single MSA with volume pricing. The buyer is expanding infrastructure rapidly (14 deals) — they want speed and simplicity, not lowest price. Your physical fiber presence is non-replicable.' },
      nash: 'Seller bundles both Negotiate deals into MSA; buyer accepts because switching costs for lit dark fiber are prohibitive and timeline is urgent. Competitor\'s best response is to target wavelength pricing on future deals rather than contest active fiber.',
      sequence: [
        { move: 1, actor: 'seller', action: 'Present combined proposal for both Negotiate-stage fiber deals as single MSA', response: 'Buyer evaluates total package vs. individual circuits', timing: 'This week' },
        { move: 2, actor: 'buyer', action: 'Requests 5-8% discount for commitment', response: 'Offer 3% + waived install fees (higher perceived value, lower cost)', timing: 'Week 2' },
        { move: 3, actor: 'seller', action: 'Introduce IP Services discussion while momentum is high', response: 'Buyer agrees to technical review meeting', timing: 'Week 3' },
      ],
      pricing: {
        anchor: '$3,255/mo per circuit (list rate)',
        floor: '$2,930/mo (10% max discount)',
        value_levers: ['Waived installation ($15K value per circuit)', 'Dedicated project manager for both circuits', 'Priority provisioning (30-day vs. 60-day standard)', 'Future wavelength pricing lock for 12 months'],
        bundles: ['Both fiber circuits + 12-month wavelength commitment = 5% blended', 'Add IP Services DIA = additional 3% across all products'],
      },
      concessions: [
        { if_says: 'Your competitor quoted 15% less on similar fiber routes.', respond: 'On a single-circuit basis, that may be true for certain routes. But when we look at your total infrastructure — 14 active projects — an MSA structure gives you a blended rate that individual circuit quotes can\'t match. Plus, our fiber is already in-building at 8 of your 10 target locations.', cost: '0% — reframing, no actual discount', value: 'High — shifts comparison from price to total value' },
        { if_says: 'We need to push the timeline out 60 days.', respond: 'I understand timeline flexibility. However, I should let you know that our install crews are currently scheduled for your routes in the next 30 days. If we push past that window, the next available slot is 90+ days out. I\'d recommend we lock the agreement now with a flexible start date.', cost: 'Low — schedule hold costs minimal', value: 'High — creates urgency without being aggressive' },
      ],
      competitive: {
        competitor_offer: 'Regional fiber provider quoting 12-15% below on individual dark fiber circuits',
        differentiation: 'In-building presence at 8 of 10 target locations. Competitor would require new construction (6-12 month lead time vs. 30 days). Total cost of delay exceeds any per-circuit savings.',
        trap: 'Ask buyer to compare total project timeline and construction risk, not just monthly rate.',
      },
      closing: ['Buyer asks about implementation timeline specifics', 'Buyer introduces procurement/legal team to the conversation', 'Buyer requests contract redline rather than asking for more proposals', 'References to \'when we go live\' rather than \'if we choose you\''],
      walk_away: ['Buyer demands >15% discount with no volume commitment', 'Buyer reveals they\'ve already signed with competitor for primary routes', 'Decision timeline extends beyond 120 days with no executive engagement'],
      talk_track: 'I\'ve put together a combined proposal for both fiber circuits that gives you better economics than individual quotes. Given that we already have fiber in-building at most of your target locations, we can have both circuits lit within 30 days of signing. I\'d also like to schedule a technical review to discuss how our IP Services portfolio could simplify your network architecture as you scale.',
    },
    signals: {
      company_summary: 'Customer 1 is a major regional carrier expanding fiber and wavelength infrastructure across the western US. Recent FCC filings indicate spectrum acquisition for 5G backhaul, and the company has announced $200M in capital expenditure for 2026 network buildout.',
      signal_strength: 'strong',
      match_confidence: 0.92,
      items: [
        { headline: '$200M CapEx plan announced for 2026 network expansion', type: 'expansion', urgency: 'act_now', impact: 'Major infrastructure buildout = sustained demand for dark fiber and wavelengths over 12-18 months. Pipeline should grow significantly beyond current 14 deals.', confidence: 0.88 },
        { headline: 'FCC spectrum acquisition filing for 5G backhaul', type: 'regulatory', urgency: 'this_week', impact: '5G backhaul requires fiber connectivity to tower sites. New product opportunity for small-cell fiber connections. Opens door to IP transit discussion.', confidence: 0.85 },
        { headline: 'New VP of Network Engineering hired from competitor', type: 'leadership', urgency: 'this_month', impact: 'New technical leader may re-evaluate vendor relationships. Risk: could favor previous employer\'s solutions. Opportunity: fresh relationship, chance to demonstrate technical depth.', confidence: 0.79 },
        { headline: 'Q4 2025 earnings: 18% YoY revenue growth, upgraded guidance', type: 'financial', urgency: 'monitor', impact: 'Strong financial health confirms ability to fund infrastructure expansion. Low churn risk on existing services. Budget availability for new purchases.', confidence: 0.91 },
      ],
    },
    backtest: [
      { q: '2024 Q3', actual: { outcome: 'expanded', won_mrr: 20121, lost_mrr: 0, net: 20121 }, predicted: { outcome: 'expanded', churn: 'low', confidence: 0.78 }, score: 90 },
      { q: '2024 Q4', actual: { outcome: 'grew_modestly', won_mrr: 44, lost_mrr: 0, net: 44 }, predicted: { outcome: 'stable', churn: 'low', confidence: 0.65 }, score: 60 },
      { q: '2025 Q1', actual: { outcome: 'churned/contracted', won_mrr: 20, lost_mrr: 5200, net: -5180 }, predicted: { outcome: 'stable', churn: 'low', confidence: 0.62 }, score: 20 },
      { q: '2025 Q2', actual: { outcome: 'expanded', won_mrr: 10000, lost_mrr: 3800, net: 6200 }, predicted: { outcome: 'expanded', churn: 'medium', confidence: 0.71 }, score: 70 },
      { q: '2025 Q3', actual: { outcome: 'churned/contracted', won_mrr: 12579, lost_mrr: 1750, net: 10829 }, predicted: { outcome: 'expanded', churn: 'medium', confidence: 0.68 }, score: 50 },
      { q: '2025 Q4', actual: { outcome: 'expanded', won_mrr: 8987, lost_mrr: 0, net: 8987 }, predicted: { outcome: 'expanded', churn: 'low', confidence: 0.74 }, score: 80 },
      { q: '2026 Q1', actual: { outcome: 'expanded', won_mrr: 4494, lost_mrr: 0, net: 4494 }, predicted: { outcome: 'expanded', churn: 'low', confidence: 0.81 }, score: 90 },
    ],
    losses: {
      deals: [
        { product: 'Wavelengths - Long Haul', mrr: 5200, date: '6/15/2025', type: 'New Service', rep: 'William Good', days_pipe: 97 },
        { product: 'Dark Fiber - Metro', mrr: 3800, date: '9/22/2025', type: 'New Service', rep: 'William Good', days_pipe: 113 },
        { product: 'Wavelengths - Long Haul', mrr: 1750, date: '11/30/2025', type: 'New Service', rep: 'Michael Kahn', days_pipe: 107 },
        { product: 'Wavelengths - Long Haul', mrr: 0, date: '1/2/2022', type: 'Positive Re-Rate', rep: 'Usama Fayyaz', days_pipe: 90 },
      ],
      disconnects: [{ product: 'Wavelengths - Long Haul', date: '4/15/2025' }, { product: 'Dark Fiber - Metro', date: '7/20/2025' }],
      downgrades: [{ product: 'Wavelengths - Long Haul', mrr: -1200, date: '8/1/2025' }, { product: 'Dark Fiber - Metro', mrr: -850, date: '1/15/2026' }],
      by_product: { 'Wavelengths - Long Haul': { count: 3, mrr: 6950 }, 'Dark Fiber - Metro': { count: 1, mrr: 3800 } },
      timeline: [
        { q: '2022 Q1', lost: 0, disc: 0, down: 0 },
        { q: '2025 Q2', lost: 5200, disc: 1, down: 0 },
        { q: '2025 Q3', lost: 3800, disc: 1, down: 1200 },
        { q: '2025 Q4', lost: 1750, disc: 0, down: 0 },
        { q: '2026 Q1', lost: 0, disc: 0, down: 850 },
      ],
    },
    revenue_tl: [
      { q: '2021 Q1', new: 949, rr_up: 8, rr_down: 0, lost: 0, net: 957, cum: 957 },
      { q: '2021 Q4', new: 0, rr_up: 50, rr_down: 0, lost: 0, net: 50, cum: 1007 },
      { q: '2022 Q4', new: 0, rr_up: 91, rr_down: 0, lost: 0, net: 91, cum: 1098 },
      { q: '2023 Q4', new: 0, rr_up: 43, rr_down: 0, lost: 0, net: 43, cum: 1141 },
      { q: '2024 Q1', new: 0, rr_up: 20, rr_down: 0, lost: 0, net: 20, cum: 1161 },
      { q: '2024 Q4', new: 0, rr_up: 44, rr_down: 0, lost: 0, net: 44, cum: 1205 },
      { q: '2025 Q2', new: 0, rr_up: 0, rr_down: 0, lost: 5200, net: -5200, cum: -3995 },
      { q: '2025 Q3', new: 20121, rr_up: 0, rr_down: -1200, lost: 3800, net: 15121, cum: 11126 },
      { q: '2025 Q4', new: 12579, rr_up: 46, rr_down: 0, lost: 1750, net: 10875, cum: 22001 },
      { q: '2026 Q1', new: 8987, rr_up: 5, rr_down: -850, lost: 0, net: 8142, cum: 30143 },
    ],
    learning: [
      { deals: 5, accuracy: 32, churn: 20, expand: 40, outcome: 25 },
      { deals: 10, accuracy: 45, churn: 35, expand: 50, outcome: 40 },
      { deals: 15, accuracy: 58, churn: 50, expand: 60, outcome: 55 },
      { deals: 20, accuracy: 67, churn: 65, expand: 70, outcome: 62 },
      { deals: 25, accuracy: 74, churn: 72, expand: 75, outcome: 70 },
      { deals: 30, accuracy: 79, churn: 78, expand: 80, outcome: 76 },
      { deals: 35, accuracy: 83, churn: 82, expand: 84, outcome: 81 },
      { deals: 40, accuracy: 85, churn: 84, expand: 86, outcome: 84 },
    ],
    locations: [
      { name: 'Denver POP - 900 Auraria', type: 'Data Center', lat: 39.7456, lng: -105.0069, status: 'on-net', lit: true, services: 2, mrr: 20121, products: ['Wavelengths - Long Haul'], note: 'Primary POP. 2x100G wavelengths to COS.' },
      { name: 'Centennial Medical Campus', type: 'Hospital', lat: 39.7329, lng: -104.9408, status: 'on-net', lit: true, services: 4, mrr: 12579, products: ['Dark Fiber - Metro'], note: 'Main campus. 4 buildings connected via intra-campus fiber.' },
      { name: 'Springs Campus', type: 'Hospital', lat: 38.8561, lng: -104.8214, status: 'on-net', lit: true, services: 2, mrr: 10121, products: ['Wavelengths - Long Haul'], note: 'Secondary campus. Wavelength to Denver.' },
      { name: 'Pueblo Clinic', type: 'Branch', lat: 38.2650, lng: -104.6127, status: 'near-net', lit: false, services: 0, mrr: 0, products: [], note: 'New clinic Q3 2026. Fiber within 800ft.' },
      { name: 'Fort Collins Medical', type: 'Branch', lat: 40.5853, lng: -105.0844, status: 'near-net', lit: false, services: 0, mrr: 0, products: [], note: 'Satellite office. Near-net fiber available.' },
      { name: 'Grand Junction Clinic', type: 'Branch', lat: 39.0639, lng: -108.5506, status: 'off-net', lit: false, services: 0, mrr: 0, products: [], note: 'Western slope. No fiber. New build required.' },
      { name: 'Boulder Research Lab', type: 'Office', lat: 40.0150, lng: -105.2705, status: 'near-net', lit: false, services: 0, mrr: 0, products: [], note: 'Research facility. Dark fiber prospect.' },
      { name: 'DIA Medical Facility', type: 'Branch', lat: 39.8561, lng: -104.6737, status: 'on-net', lit: true, services: 1, mrr: 4494, products: ['Wavelengths - Long Haul'], note: 'Airport facility. Recently lit wavelength.' },
    ],
  },
  {
    id: 'cust2',
    name: 'Customer 2',
    vertical: 'Software & Tech',
    arr: 448786,
    mrr: 37399,
    pipeline_mrr: 1000,
    pipeline_count: 1,
    won: 34,
    lost: 5,
    win_rate: 0.872,
    avg_cycle: 30,
    nrr: 0.87,
    days_silent: 497,
    velocity: 'stalled',
    risk_score: 62,
    risk_level: 'critical',
    rep: 'Jose Banales',
    reps: 19,
    tenure_mo: 75,
    disconnects: 3,
    downgrades: 3,
    downgrade_mrr: 4850,
    lost_mrr: 12200,
    products: ['IP Services', 'zColo', 'Ethernet', 'Dark Fiber - Metro'],
    concentration: {
      zColo: { mrr: 13848, pct: 0.37 },
      'IP Services': { mrr: 17201, pct: 0.46 },
      Ethernet: { mrr: 6133, pct: 0.16 },
      'Dark Fiber - Metro': { mrr: 217, pct: 0.01 },
    },
    pipeline_by_stage: { 'Design Solution': { count: 1, mrr: 1000 } },
    predictions: [
      { product: 'IP Services', event: 'churn', prior: 0.20, posterior: 0.52, mrr: '-$3,000-$8,000', timing: '60-90 days', evidence: ['2 recent IP losses ($5,300 MRR)', '497 days since last activity', 'NRR below 90% — account is contracting', 'New VP of Engineering may consolidate vendors'], direction: 'strengthened', confidence: 0.74 },
      { product: 'zColo', event: 'churn', prior: 0.15, posterior: 0.38, mrr: '-$5,000-$13,000', timing: '3-6 months', evidence: ['3 colo disconnects in last 18 months', 'Cloud migration trend in Software & Tech vertical', '$2,400 colo downgrade in Q1 2024'], direction: 'strengthened', confidence: 0.68 },
      { product: 'IP Services', event: 'renewal', prior: 0.60, posterior: 0.45, mrr: '$2,000-$5,000', timing: '90+ days', evidence: ['Only active pipeline deal is Longshot', '19 reps = no relationship continuity', '497 days silence = lowest engagement in account history'], direction: 'weakened', confidence: 0.61 },
    ],
    cross_sell: [{ product: 'Cloud Connect', prob: 0.35, reason: 'Software companies migrating from colo to cloud need connectivity bridges. This is the natural next step.', trigger: 'Strategic Business Review — ask about AWS/Azure adoption plans' }],
    churn_preds: [
      { product: 'zColo', prob: 0.38, timing: '3-6 months', signals: ['3 disconnects', 'Cloud migration pressure', '$2,400 downgrade'], action: 'Schedule colo contract review. Offer hybrid cloud connectivity package before next renewal.' },
      { product: 'IP Services', prob: 0.52, timing: '60-90 days', signals: ['2 losses', '497 days silent', 'Negative velocity'], action: 'Immediate re-engagement. Assign dedicated rep. Executive outreach within 1 week.' },
    ],
    portfolio_health: 'at_risk',
    arr_12mo_change: '-$30K-$60K',
    active_deals: [{ product: 'IP Services', mrr: 1000, stage: 'Design Solution', forecast: 'Longshot', close: '10/31/2026', rep: 'Jose Banales' }],
    game_theory: {
      win_prob: 0.35,
      value: '$1,000/mo ($12K ARR)',
      buyer_urgency: 'low',
      competition: 'fierce',
      info_edge: 'buyer',
      strategy: { name: 'Relationship Recovery — Value Reframe', type: 'value_reframe', rationale: 'This deal is a lifeline for a $449K ARR account that\'s gone dark. The $1K/mo deal itself is small, but it represents the only active engagement. Use it as the entry point to re-establish the relationship, not as a standalone negotiation.' },
      nash: 'Buyer has all the leverage — they know you\'ve been absent for 16 months and competitors are offering alternatives. Your equilibrium move is to over-invest in this deal (concede on price) to re-establish presence, then leverage the colo stickiness to rebuild the broader relationship.',
      sequence: [
        { move: 1, actor: 'seller', action: 'Executive-level outreach acknowledging the gap, requesting Strategic Business Review', response: 'Buyer cautiously agrees to meeting', timing: 'This week' },
        { move: 2, actor: 'buyer', action: 'Reveals they\'ve been evaluating cloud migration and competitor IP offerings', response: 'Listen, document, don\'t pitch. Acknowledge their evaluation is reasonable.', timing: 'Week 2' },
        { move: 3, actor: 'seller', action: 'Present hybrid cloud connectivity proposal + IP deal with aggressive pricing', response: 'Buyer compares to competitor proposals', timing: 'Week 4' },
      ],
      pricing: {
        anchor: '$1,000/mo (current proposal)',
        floor: '$750/mo (25% discount)',
        value_levers: ['Free 90-day proof of concept', 'Dedicated technical account manager', 'Cloud connectivity assessment at no cost', 'Bundle with colo renewal for blended pricing'],
        bundles: ['IP + Cloud Connect + colo renewal = 15% blended discount', 'Multi-year commitment = additional 5%'],
      },
      concessions: [
        { if_says: 'We\'ve been getting better pricing from CloudNet for the last year.', respond: 'That\'s fair — and I\'ll be direct, we haven\'t been showing up for you the way we should have. Rather than competing on price alone, I\'d like to show you our cloud connectivity roadmap that integrates with your existing colo footprint. That\'s something CloudNet can\'t offer because your infrastructure is physically in our facility.', cost: 'Moderate — may need 10-15% discount to match', value: 'High — shifts conversation from commodity pricing to integrated value' },
      ],
      competitive: {
        competitor_offer: 'CloudNet offering IP transit at 20% below your rates with cloud-native bundling',
        differentiation: 'Physical colo presence — their servers are in your facility. Cloud connectivity that bridges on-prem and cloud. Integrated billing across all services.',
        trap: 'Ask buyer to model the total cost of migrating colo workloads to a new provider vs. leveraging existing infrastructure with cloud connectivity overlay.',
      },
      closing: ['Buyer asks to include colo team in next meeting', 'Buyer shares their cloud migration timeline', 'Buyer asks about multi-year pricing'],
      walk_away: ['Buyer has already signed 3-year deal with competitor for IP', 'Colo contract is not renewing and they\'ve begun physical migration', 'No executive engagement after 3 outreach attempts'],
      talk_track: 'I want to start by acknowledging something — we haven\'t been the partner you deserve over the last 16 months, and that changes today. I\'ve been assigned as your dedicated account manager, and my first priority is understanding where your infrastructure strategy is heading. I know you\'re evaluating options, and I think there\'s a compelling story around how your existing colo footprint connects to wherever you\'re going with cloud.',
    },
    signals: {
      company_summary: 'Customer 2 is a mid-market software company that has been shifting workloads to AWS over the past 18 months. Recent job postings indicate hiring for cloud infrastructure roles, and the company announced a $45M Series C focused on platform scalability.',
      signal_strength: 'strong',
      match_confidence: 0.88,
      items: [
        { headline: '$45M Series C announced — platform scalability focus', type: 'funding', urgency: 'act_now', impact: 'Capital infusion means infrastructure spend is increasing. But direction matters: if it\'s all going to cloud, colo and traditional IP are at risk. If hybrid, opportunity to position cloud connectivity.', confidence: 0.90 },
        { headline: 'Hiring 3 Cloud Infrastructure Engineers (AWS focus)', type: 'technology', urgency: 'this_week', impact: 'Confirms cloud migration trajectory. On-prem/colo workloads likely decreasing. Need to pivot positioning from traditional infrastructure to cloud connectivity and hybrid solutions.', confidence: 0.86 },
        { headline: 'CTO keynote at re:Invent mentioned \'cloud-first infrastructure strategy\'', type: 'leadership', urgency: 'act_now', impact: 'CTO publicly committed to cloud-first. Colo and traditional IP positioning must shift to \'cloud enablement\' — interconnection, Direct Connect, low-latency bridges. Existing framing will not resonate.', confidence: 0.83 },
        { headline: 'Glassdoor reviews mention \'aging infrastructure\' as pain point', type: 'risk', urgency: 'this_month', impact: 'Internal frustration with current infrastructure = both risk (they want change) and opportunity (position as the modernization partner, not the legacy vendor).', confidence: 0.62 },
      ],
    },
    backtest: [
      { q: '2024 Q1', actual: { outcome: 'grew_modestly', won_mrr: 949, lost_mrr: 0, net: 949 }, predicted: { outcome: 'stable', churn: 'low', confidence: 0.60 }, score: 50 },
      { q: '2024 Q2', actual: { outcome: 'churned/contracted', won_mrr: 0, lost_mrr: 1800, net: -1800 }, predicted: { outcome: 'stable', churn: 'medium', confidence: 0.55 }, score: 40 },
      { q: '2024 Q3', actual: { outcome: 'churned/contracted', won_mrr: 0, lost_mrr: 4500, net: -4500 }, predicted: { outcome: 'churned/contracted', churn: 'high', confidence: 0.72 }, score: 90 },
      { q: '2024 Q4', actual: { outcome: 'dormant', won_mrr: 0, lost_mrr: 0, net: 0 }, predicted: { outcome: 'dormant', churn: 'medium', confidence: 0.65 }, score: 80 },
      { q: '2025 Q1', actual: { outcome: 'dormant', won_mrr: 0, lost_mrr: 0, net: 0 }, predicted: { outcome: 'dormant', churn: 'high', confidence: 0.70 }, score: 80 },
    ],
    losses: {
      deals: [
        { product: 'IP Services', mrr: 3500, date: '8/15/2023', type: 'New Service', rep: 'Andrew Jahant', days_pipe: 106 },
        { product: 'Ethernet', mrr: 2200, date: '2/10/2024', type: 'New Service', rep: 'Andrew Jahant', days_pipe: 87 },
        { product: 'IP Services', mrr: 1800, date: '7/30/2024', type: 'New Service', rep: 'Andrew Jahant', days_pipe: 99 },
        { product: 'zColo', mrr: 4500, date: '11/5/2024', type: 'New Service', rep: 'Jennifer Middleton', days_pipe: 96 },
        { product: 'zColo', mrr: 200, date: '2/28/2021', type: 'New Service', rep: 'Joseph Quick', days_pipe: 88 },
      ],
      disconnects: [{ product: 'zColo', date: '6/1/2023' }, { product: 'zColo', date: '1/15/2024' }, { product: 'Ethernet', date: '5/1/2024' }],
      downgrades: [{ product: 'zColo', mrr: -2400, date: '3/1/2024' }, { product: 'IP Services', mrr: -1650, date: '9/15/2024' }, { product: 'zColo', mrr: -800, date: '12/1/2024' }],
      by_product: { 'IP Services': { count: 2, mrr: 5300 }, Ethernet: { count: 1, mrr: 2200 }, zColo: { count: 2, mrr: 4700 } },
      timeline: [
        { q: '2023 Q3', lost: 3500, disc: 1, down: 0 },
        { q: '2024 Q1', lost: 2200, disc: 1, down: 2400 },
        { q: '2024 Q2', lost: 1800, disc: 1, down: 0 },
        { q: '2024 Q3', lost: 0, disc: 0, down: 1650 },
        { q: '2024 Q4', lost: 4500, disc: 0, down: 800 },
      ],
    },
    revenue_tl: [
      { q: '2020 Q1', new: 1840, rr_up: 0, rr_down: 0, lost: 0, net: 1840, cum: 1840 },
      { q: '2020 Q2', new: 14200, rr_up: 22, rr_down: 0, lost: 0, net: 14222, cum: 16062 },
      { q: '2020 Q3', new: 1550, rr_up: 18, rr_down: 0, lost: 0, net: 1568, cum: 17630 },
      { q: '2021 Q2', new: 1870, rr_up: 117, rr_down: 0, lost: 0, net: 1987, cum: 19617 },
      { q: '2022 Q2', new: 2133, rr_up: 9422, rr_down: 0, lost: 0, net: 11555, cum: 31172 },
      { q: '2023 Q1', new: 1312, rr_up: 0, rr_down: 0, lost: 0, net: 1312, cum: 32484 },
      { q: '2023 Q3', new: 0, rr_up: 1406, rr_down: 0, lost: 3500, net: -2094, cum: 30390 },
      { q: '2024 Q1', new: 949, rr_up: 0, rr_down: -2400, lost: 2200, net: -3651, cum: 26739 },
      { q: '2024 Q3', new: 0, rr_up: 0, rr_down: -1650, lost: 6300, net: -7950, cum: 18789 },
    ],
    learning: [
      { deals: 10, accuracy: 28, churn: 20, expand: 35, outcome: 22 },
      { deals: 20, accuracy: 42, churn: 38, expand: 45, outcome: 38 },
      { deals: 30, accuracy: 55, churn: 52, expand: 55, outcome: 50 },
      { deals: 40, accuracy: 65, churn: 68, expand: 60, outcome: 62 },
      { deals: 50, accuracy: 72, churn: 75, expand: 68, outcome: 70 },
      { deals: 60, accuracy: 78, churn: 80, expand: 74, outcome: 76 },
    ],
    locations: [
      { name: 'Arapahoe HQ', type: 'Office', lat: 39.5964, lng: -104.8690, status: 'on-net', lit: true, services: 1, mrr: 8500, products: ['IP Services'], note: 'Primary office + NOC. 1G DIA + DDoS.' },
      { name: 'Denver Data Center', type: 'Colo', lat: 39.7536, lng: -104.9998, status: 'on-net', lit: true, services: 1, mrr: 2100, products: ['zColo'], note: 'Edge colo for SCADA. One cab disconnected — migrated to AWS.' },
      { name: 'San Luis Valley Solar Site', type: 'Tower', lat: 37.4695, lng: -105.8700, status: 'off-net', lit: false, services: 0, mrr: 0, products: [], note: '400MW solar+storage. DOE funded. Fiber buildout opportunity.' },
      { name: 'Pueblo Solar Array', type: 'Tower', lat: 38.2970, lng: -104.5980, status: 'off-net', lit: false, services: 0, mrr: 0, products: [], note: 'Phase 2 solar installation. Needs SCADA connectivity.' },
      { name: 'Colorado Springs Substation', type: 'Remote Site', lat: 38.8339, lng: -104.8253, status: 'near-net', lit: false, services: 0, mrr: 0, products: [], note: 'Grid interconnection point. Fiber within 500ft.' },
      { name: 'AWS US-West-2 (Oregon)', type: 'Data Center', lat: 45.5946, lng: -122.1509, status: 'off-net', lit: false, services: 0, mrr: 0, products: [], note: 'Primary cloud region. Direct Connect prospect.' },
    ],
  },
]
```

### Badge.jsx

```jsx
import { FONT_MONO, T } from '../../lib/constants'

export default function Badge({ children, color = T.cyan, size = 'sm' }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: size === 'sm' ? '1px 7px' : '3px 10px',
        borderRadius: '12px',
        fontFamily: FONT_MONO,
        fontSize: size === 'sm' ? '9px' : '10px',
        fontWeight: 600,
        letterSpacing: '0.03em',
        color,
        background: `${color}18`,
        border: `1px solid ${color}30`,
      }}
    >
      {children}
    </span>
  )
}
```

### ChartTheme.js

```js
import { T, FONT_MONO, FONT_SANS } from '../../lib/constants'

export const chartTheme = {
  bg: T.card,
  grid: T.border,
  text: T.textDim,
  font: FONT_MONO,
  tooltip: {
    background: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    fontSize: 11,
    fontFamily: FONT_SANS,
    color: T.text,
  },
}

// Formatters
export const $ = (n) => `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
export const $k = (n) => Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(0)}`
export const pc = (n) => `${(n * 100).toFixed(0)}%`
export const pc1 = (n) => `${(n * 100).toFixed(1)}%`
```

### ProbBar.jsx

```jsx
import { T } from '../../lib/constants'

export default function ProbBar({ value, color, h = 5 }) {
  return (
    <div
      style={{
        height: `${h}px`,
        background: T.border,
        borderRadius: `${h}px`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.min(value * 100, 100)}%`,
          height: '100%',
          background: color,
          borderRadius: `${h}px`,
          transition: 'width 0.8s ease',
        }}
      />
    </div>
  )
}
```

### Stat.jsx

```jsx
import { FONT_MONO, T } from '../../lib/constants'
import Tip from './Tip'

export default function Stat({ label, value, sub, color = T.cyan, small }) {
  return (
    <div
      style={{
        padding: small ? '8px' : '10px 12px',
        background: T.card,
        borderRadius: '8px',
        border: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: '8px',
          color: T.textDim,
          letterSpacing: '0.08em',
          marginBottom: '4px',
          textTransform: 'uppercase',
        }}
      >
        <Tip label={label}>{label}</Tip>
      </div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: small ? '14px' : '18px',
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: '9px',
            color: T.textDim,
            marginTop: '3px',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}
```

### Tip.jsx

```jsx
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FONT_MONO, T } from '../../lib/constants'
import { DEFS } from '../../lib/definitions'

/**
 * Hover tooltip wrapper. Looks up definition by label text automatically.
 * Renders via portal so it's never clipped by overflow containers.
 */
export default function Tip({ children, label, tip, delay, style }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const timerRef = useRef(null)

  const text = tip || DEFS[label] || DEFS[typeof children === 'string' ? children : '']
  if (!text) return <span style={style}>{children}</span>

  const handleEnter = () => {
    if (delay) {
      timerRef.current = setTimeout(() => setShow(true), delay)
    } else {
      setShow(true)
    }
  }
  const handleLeave = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setShow(false)
  }

  useEffect(() => {
    if (show && ref.current) {
      const r = ref.current.getBoundingClientRect()
      const tipW = 260
      // Center horizontally on the element, clamp to viewport
      let left = r.left + r.width / 2 - tipW / 2
      left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8))
      // Position above by default; flip below if too close to top
      let top = r.top - 8
      const above = top > 120 // enough room above
      if (!above) top = r.bottom + 8
      setPos({ left, top, above })
    }
  }, [show])

  return (
    <span
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{ position: 'relative', cursor: 'help', borderBottom: `1px dotted ${T.textDim}40`, ...style }}
    >
      {children}
      {show && pos && createPortal(
        <span style={{
          position: 'fixed',
          left: pos.left,
          top: pos.above ? undefined : pos.top,
          bottom: pos.above ? `${window.innerHeight - pos.top}px` : undefined,
          padding: '8px 12px',
          background: '#1C2333',
          border: `1px solid ${T.border}`,
          borderRadius: '6px',
          fontFamily: FONT_MONO,
          fontSize: '10px',
          fontWeight: 400,
          lineHeight: 1.5,
          color: T.textMid,
          whiteSpace: 'normal',
          width: '260px',
          textTransform: 'none',
          letterSpacing: 'normal',
          zIndex: 99999,
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          {text}
        </span>,
        document.body
      )}
    </span>
  )
}
```

### Header.jsx

```jsx
import { FONT_MONO, T } from '../../lib/constants'

export default function Header({ accountCount, isDemo }) {
  return (
    <div
      style={{
        padding: '8px 16px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: T.surface,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: `linear-gradient(135deg, ${T.cyan}, ${T.purple})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT_MONO,
            fontWeight: 700,
            fontSize: '12px',
            color: T.bg,
          }}
        >
          R
        </div>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: '13px', letterSpacing: '-0.01em' }}>
            RevOS
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, letterSpacing: '0.06em' }}>
            BAYESIAN PREDICTION · GAME THEORY · SIGNAL INTELLIGENCE
          </div>
        </div>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>
        {isDemo ? 'DEMO MODE' : 'LIVE'} · {accountCount} ACCOUNTS
      </div>
    </div>
  )
}
```

### Sidebar.jsx

```jsx
import { FONT_MONO, T } from '../../lib/constants'
import Badge from '../shared/Badge'
import Tip from '../shared/Tip'
import { $ } from '../shared/ChartTheme'

const RISK_TIPS = {
  low: 'Low Risk — Stable account with healthy engagement, strong win rate, and minimal churn signals.',
  moderate: 'Moderate Risk — Some warning signs present: declining engagement, recent losses, or slowing pipeline velocity.',
  elevated: 'Elevated Risk — Multiple risk factors detected: significant losses, disconnects, or prolonged silence.',
  critical: 'Critical Risk — Immediate attention needed: high churn probability, major disconnects, or extended disengagement.',
  at_risk: 'At Risk — Account health score indicates significant exposure: declining revenue, active churn, or stalled deals.',
}

export default function Sidebar({ accounts, selectedIndex, onSelect }) {
  return (
    <div>
      <div
        style={{
          padding: '10px 12px',
          fontFamily: FONT_MONO,
          fontSize: '8px',
          color: T.textDim,
          letterSpacing: '0.1em',
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        ACCOUNTS ({accounts.length})
      </div>
      {accounts.map((acc, i) => {
        const isSel = i === selectedIndex
        const rc = acc.risk_score >= 50 ? T.red : acc.risk_score >= 30 ? T.orange : T.green
        const riskKey = (acc.risk_level || 'low').toLowerCase().replace(/[\s_-]/g, '_')
        const riskTip = RISK_TIPS[riskKey] || RISK_TIPS['moderate']
        return (
          <div
            key={acc.id || acc.name}
            onClick={() => onSelect(i)}
            style={{
              padding: '10px 12px',
              cursor: 'pointer',
              borderBottom: `1px solid ${T.border}`,
              borderLeft: `3px solid ${isSel ? T.cyan : 'transparent'}`,
              background: isSel ? T.card : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontWeight: 600, fontSize: '12px' }}>{acc.name}</span>
              <Tip tip={riskTip} style={{ borderBottom: 'none' }}>
                <Badge color={rc} size="sm">
                  {acc.risk_level.toUpperCase()}
                </Badge>
              </Tip>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim, marginBottom: '3px' }}>
              {acc.vertical}
            </div>
            <div style={{ display: 'flex', gap: '6px', fontFamily: FONT_MONO, fontSize: '9px', flexWrap: 'wrap' }}>
              <span style={{ color: T.cyan }}>{$(acc.arr)}</span>
              {acc.lost > 0 && <span style={{ color: T.red }}>{acc.lost}L</span>}
              {acc.disconnects > 0 && <span style={{ color: T.orange }}>{acc.disconnects}D</span>}
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: '8px',
                color: acc.velocity === 'accelerating' ? T.green : acc.velocity === 'stalled' ? T.red : T.yellow,
                marginTop: '2px',
              }}
            >
              {acc.velocity === 'accelerating' ? '▲' : acc.velocity === 'stalled' ? '▼' : '●'} {acc.velocity} ·{' '}
              {acc.days_silent}d
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

### TopNav.jsx

```jsx
import { useState, useRef, useEffect } from 'react'
import { FONT_MONO, T, PAGES, MODELING_PAGES } from '../../lib/constants'

export default function TopNav({ activePage, onPageChange }) {
  const [modelOpen, setModelOpen] = useState(false)
  const dropRef = useRef(null)

  const isModelingPage = MODELING_PAGES.some(p => p.id === activePage)

  // Close dropdown on outside click
  useEffect(() => {
    if (!modelOpen) return
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setModelOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [modelOpen])

  const btnStyle = (active) => ({
    padding: '6px 14px',
    borderRadius: '6px',
    border: 'none',
    background: active ? T.card : 'transparent',
    color: active ? T.text : T.textDim,
    fontFamily: FONT_MONO,
    fontSize: '10px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.15s',
    outline: active ? `1px solid ${T.borderLight}` : 'none',
  })

  return (
    <div
      style={{
        padding: '6px 16px',
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
        display: 'flex',
        gap: '2px',
        flexShrink: 0,
      }}
    >
      {PAGES.map((p) => (
        <button
          key={p.id}
          onClick={() => onPageChange(p.id)}
          style={btnStyle(activePage === p.id)}
        >
          <span style={{ fontSize: '11px' }}>{p.icon}</span>
          {p.label}
        </button>
      ))}

      {/* Spacer pushes Modeling to far right */}
      <div style={{ flex: 1 }} />

      {/* Modeling dropdown */}
      <div ref={dropRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setModelOpen(!modelOpen)}
          style={{
            ...btnStyle(isModelingPage),
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '11px' }}>🧪</span>
          Modeling
          <span style={{ fontSize: '8px', marginLeft: '2px' }}>{modelOpen ? '▲' : '▼'}</span>
        </button>
        {modelOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: '6px',
            overflow: 'hidden',
            zIndex: 100,
            minWidth: '140px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}>
            {MODELING_PAGES.map((p) => (
              <button
                key={p.id}
                onClick={() => { onPageChange(p.id); setModelOpen(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: activePage === p.id ? T.cardHover : 'transparent',
                  color: activePage === p.id ? T.text : T.textDim,
                  fontFamily: FONT_MONO,
                  fontSize: '10px',
                  fontWeight: activePage === p.id ? 700 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.background = T.cardHover}
                onMouseLeave={e => e.currentTarget.style.background = activePage === p.id ? T.cardHover : 'transparent'}
              >
                <span style={{ fontSize: '11px' }}>{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

### CSVUploader.jsx

```jsx
import { useState, useRef, useCallback } from 'react'
import { FONT_MONO, T } from '../../lib/constants'
import Badge from '../shared/Badge'

const TAB_TYPES = [
  { key: 'auto', label: 'Auto-Detect', desc: 'Upload any CSV — we detect the table type' },
  { key: 'customers', label: 'Customers', desc: 'Account master data (vertical, rep, tier)' },
  { key: 'funnel', label: 'Funnel', desc: 'Active pipeline deals' },
  { key: 'close_lost', label: 'Close Lost', desc: 'Deals pursued but lost' },
  { key: 'quotes', label: 'Quotes', desc: 'Proposals sent' },
  { key: 'services', label: 'Services', desc: 'Active + disconnected installed base' },
  { key: 'locations', label: 'Locations', desc: 'Customer sites' },
]

export default function CSVUploader({ onUpload, onUploadMulti, onClear, rawData }) {
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState(null)
  const [selectedTab, setSelectedTab] = useState('auto')
  const [expanded, setExpanded] = useState(false)
  const fileRef = useRef(null)

  const handleFile = useCallback(
    async (file) => {
      if (!file) return
      setStatus({ type: 'loading', message: `Processing ${file.name}...` })
      try {
        const result = await onUpload(file, selectedTab)
        setStatus({
          type: 'success',
          message: `Loaded ${result.accounts_count} accounts · ${Object.entries(result.records_ingested).map(([k, v]) => `${v} ${k}`).join(', ')} · Data stays in your browser only`,
        })
      } catch (err) {
        setStatus({ type: 'error', message: err.message })
      }
    },
    [onUpload, selectedTab]
  )

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  // Count loaded records
  const loadedCounts = rawData
    ? Object.entries(rawData).filter(([, v]) => v.length > 0).map(([k, v]) => `${v.length} ${k}`)
    : []

  return (
    <div style={{ marginBottom: '12px' }}>
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '6px 12px',
          borderRadius: '6px',
          border: `1px solid ${T.border}`,
          background: T.card,
          color: T.textMid,
          fontFamily: FONT_MONO,
          fontSize: '10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        <span>
          {expanded ? '▾' : '▸'} UPLOAD DATA
          {loadedCounts.length > 0 && (
            <span style={{ color: T.green, marginLeft: '8px' }}>
              ({loadedCounts.join(' · ')})
            </span>
          )}
        </span>
        <Badge color={T.green} size="sm">LOCAL ONLY</Badge>
      </button>

      {expanded && (
        <div style={{ marginTop: '8px', padding: '12px', background: T.card, borderRadius: '8px', border: `1px solid ${T.border}` }}>
          {/* Privacy notice */}
          <div style={{
            padding: '8px 10px',
            background: `${T.green}08`,
            border: `1px solid ${T.green}22`,
            borderRadius: '6px',
            marginBottom: '10px',
            fontFamily: FONT_MONO,
            fontSize: '9px',
            color: T.green,
          }}>
            YOUR DATA NEVER LEAVES YOUR COMPUTER. Files are read by your browser and stored in memory only. Nothing is uploaded to any server. Close the tab = data is gone.
          </div>

          {/* Tab type selector */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {TAB_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setSelectedTab(t.key)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: `1px solid ${selectedTab === t.key ? T.cyan + '50' : T.border}`,
                  background: selectedTab === t.key ? T.cardHover : 'transparent',
                  color: selectedTab === t.key ? T.text : T.textDim,
                  fontFamily: FONT_MONO,
                  fontSize: '9px',
                  cursor: 'pointer',
                }}
                title={t.desc}
              >
                {t.label}
                {rawData && rawData[t.key]?.length > 0 && (
                  <span style={{ color: T.green, marginLeft: '4px' }}>({rawData[t.key].length})</span>
                )}
              </button>
            ))}
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              padding: '16px',
              border: `2px dashed ${isDragging ? T.cyan : T.border}`,
              borderRadius: '8px',
              background: isDragging ? `${T.cyan}08` : T.surface,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textMid, marginBottom: '4px' }}>
              Drop CSV here or click to select
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>
              {selectedTab === 'auto'
                ? 'Auto-detects: Funnel, Close Lost, Customers, Quotes, Services, Locations'
                : `Loading as: ${TAB_TYPES.find((t) => t.key === selectedTab)?.desc}`}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              style={{ display: 'none' }}
              onChange={(e) => { handleFile(e.target.files[0]); e.target.value = '' }}
            />
          </div>

          {/* Status */}
          {status && (
            <div style={{
              marginTop: '8px',
              padding: '8px 12px',
              borderRadius: '6px',
              fontFamily: FONT_MONO,
              fontSize: '10px',
              background: status.type === 'error' ? `${T.red}18` : status.type === 'success' ? `${T.green}18` : `${T.cyan}18`,
              color: status.type === 'error' ? T.red : status.type === 'success' ? T.green : T.cyan,
              border: `1px solid ${status.type === 'error' ? T.red : status.type === 'success' ? T.green : T.cyan}30`,
            }}>
              {status.message}
            </div>
          )}

          {/* Clear button */}
          {loadedCounts.length > 0 && (
            <button
              onClick={() => { onClear(); setStatus(null) }}
              style={{
                marginTop: '8px',
                padding: '4px 10px',
                borderRadius: '4px',
                border: `1px solid ${T.red}30`,
                background: 'transparent',
                color: T.red,
                fontFamily: FONT_MONO,
                fontSize: '9px',
                cursor: 'pointer',
              }}
            >
              Clear all data & return to demo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

### useAccounts.js

```js
import { useState, useCallback } from 'react'
import { DEMO_ACCOUNTS } from '../demo/demoData'
import { parseCSV } from '../lib/normalize'
import { buildAccountState } from '../lib/accountBuilder'

/**
 * All data stays in browser memory only.
 * Nothing is sent to any server. CSV files are read via FileReader API,
 * parsed in-browser, and stored in React state.
 */
export default function useAccounts() {
  const [accounts, setAccounts] = useState(DEMO_ACCOUNTS)
  const [isDemo, setIsDemo] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Raw table data — stored in memory only, never transmitted
  const [rawData, setRawData] = useState({
    customers: [],
    funnel: [],
    close_lost: [],
    quotes: [],
    services: [],
    locations: [],
    icb: [],
  })
  const [jsonData, setJsonData] = useState({
    locations: {},
    historical: {},
    engagements: {},
    engagements_2026: {},
  })

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
      reader.readAsText(file)
    })
  }

  const detectTabType = (record) => {
    const fields = new Set(Object.keys(record))
    if (fields.has('loss_reason') || fields.has('stage_lost_from')) return 'close_lost'
    if (fields.has('stage') && fields.has('forecast_category')) return 'funnel'
    if (fields.has('quoted_mrr') || fields.has('quote_status')) return 'quotes'
    if (fields.has('service_status') || fields.has('service_id') || fields.has('disconnect_date')) return 'services'
    if (fields.has('on_net_status') || fields.has('location_type')) return 'locations'
    if (fields.has('icb_id')) return 'icb'
    if (fields.has('mega_vertical') || fields.has('primary_rep') || fields.has('account_tier')) return 'customers'
    return 'funnel'
  }

  const tabTypeFromFileName = (name) => {
    const base = name.replace('.csv', '').toLowerCase().replace(/[^a-z_]/g, '')
    const KNOWN = ['customers', 'funnel', 'close_lost', 'quotes', 'services', 'locations', 'icb']
    if (KNOWN.includes(base)) return base
    if (base.includes('customer') || base.includes('account')) return 'customers'
    if (base.includes('funnel') || base.includes('pipeline') || base.includes('opportunity')) return 'funnel'
    if (base.includes('historical') || base.includes('closed_won') || base.includes('won') || base.includes('history')) return 'funnel'
    if (base.includes('lost') || base.includes('loss')) return 'close_lost'
    if (base.includes('quote') || base.includes('proposal')) return 'quotes'
    if (base.includes('service') || base.includes('circuit') || base.includes('install')) return 'services'
    if (base.includes('location') || base.includes('site')) return 'locations'
    if (base.includes('icb')) return 'icb'
    return null
  }

  /**
   * Ingest a single CSV file. Processes entirely in-browser.
   * Returns { accounts_count, records_ingested, tab_type }
   */
  const ingestLocalCSV = useCallback(async (file, tabType = 'auto') => {
    setLoading(true)
    setError(null)
    try {
      const text = await readFileAsText(file)
      const records = parseCSV(text)

      if (!records.length) {
        throw new Error('No records found. Check that columns match expected names.')
      }

      const detectedType = tabType === 'auto' ? detectTabType(records[0]) : tabType

      setRawData((prev) => {
        const updated = { ...prev, [detectedType]: [...prev[detectedType], ...records] }
        // Rebuild accounts from raw data
        rebuildAccounts(updated)
        return updated
      })

      return {
        accounts_count: new Set(records.map((r) => r.customer_account).filter(Boolean)).size,
        records_ingested: { [detectedType]: records.length },
        tab_type: detectedType,
      }
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Ingest multiple CSV files at once, one per table type.
   */
  const ingestMultiCSV = useCallback(async (files) => {
    setLoading(true)
    setError(null)
    try {
      const results = {}
      const newRaw = { customers: [], funnel: [], close_lost: [], quotes: [], services: [], locations: [] }

      for (const [tabType, file] of Object.entries(files)) {
        if (!file) continue
        const text = await readFileAsText(file)
        const records = parseCSV(text)
        newRaw[tabType] = records
        results[tabType] = records.length
      }

      setRawData(newRaw)
      rebuildAccounts(newRaw)

      const allAccounts = new Set()
      for (const records of Object.values(newRaw)) {
        for (const r of records) {
          if (r.customer_account) allAccounts.add(r.customer_account)
        }
      }

      return { accounts_count: allAccounts.size, records_ingested: results }
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const rebuildAccounts = useCallback((raw, json) => {
    const jd = json || { locations: {}, historical: {}, engagements: {}, engagements_2026: {} }

    // Collect all unique customer account names
    const accountNames = new Set()
    for (const records of Object.values(raw)) {
      if (!Array.isArray(records)) continue
      for (const r of records) {
        if (r.customer_account) accountNames.add(r.customer_account)
      }
    }

    if (accountNames.size === 0) return

    // Build customer map with BRR aggregation
    const customerMap = {}
    for (const c of raw.customers) {
      if (!c.customer_account) continue
      if (!customerMap[c.customer_account]) {
        customerMap[c.customer_account] = { ...c }
      } else {
        const existing = customerMap[c.customer_account]
        const prevBRR = parseFloat(String(existing.total_brr || '').replace(/[$,\s]/g, '')) || 0
        const addBRR = parseFloat(String(c.total_brr || '').replace(/[$,\s]/g, '')) || 0
        existing.total_brr = prevBRR + addBRR
      }
    }

    // Build ICB lookup by opportunity name
    const icbByOppName = {}
    for (const rec of (raw.icb || [])) {
      if (rec.opportunity_name) {
        icbByOppName[String(rec.opportunity_name).trim()] = {
          icb_id: String(rec.icb_id || ''),
          stage: rec.icb_stage || rec.stage || '',
          created_date: rec.icb_created_date || rec.created_date || '',
          se_review_date: rec.icb_se_review_date || '',
          se_review_time: rec.icb_se_review_time || '',
          status: rec.icb_status || rec.service_status || '',
          se_name: rec.icb_se_name || '',
        }
      }
    }

    const built = []
    for (const name of accountNames) {
      const customer = customerMap[name] || {
        customer_account: name,
        mega_vertical: 'Unknown',
        primary_rep: 'Unknown',
      }
      const funnel = raw.funnel.filter((r) => r.customer_account === name)
      const closeLost = raw.close_lost.filter((r) => r.customer_account === name)
      const quotes = raw.quotes.filter((r) => r.customer_account === name)
      const services = raw.services.filter((r) => r.customer_account === name)
      const locations = raw.locations.filter((r) => r.customer_account === name)

      const jsonLocations = jd.locations[name] || []
      const jsonHistorical = jd.historical[name] || []
      const eng25 = jd.engagements[name] || null
      const eng26 = jd.engagements_2026[name] || null

      const state = buildAccountState(customer, funnel, closeLost, quotes, services, locations)

      built.push({
        id: name,
        name,
        account_id: state.account_id,
        vertical: state.mega_vertical,
        arr: state.total_arr,
        mrr: state.total_mrr,
        pipeline_mrr: state.active_pipeline_mrr,
        pipeline_count: state.active_pipeline_count,
        won: state.total_deals_won,
        lost: state.total_deals_lost,
        win_rate: state.win_rate,
        avg_cycle: 0,
        nrr: state.net_revenue_retention,
        days_silent: state.days_since_last_activity,
        velocity: state.deal_velocity_trend,
        risk_score: state.risk_score,
        risk_level: state.risk_level,
        rep: state.primary_rep,
        manager: state.account_manager,
        sales_owner: state.sales_owner,
        reps: state.rep_count,
        tenure_mo: 0,
        disconnects: state.disconnects,
        downgrades: state.downgrades,
        downgrade_mrr: state.downgrade_mrr,
        churn_deals: state.churn_deals,
        churn_mrr: state.churn_mrr,
        lost_mrr: state.lost_mrr_total,
        products: Object.keys(state.product_concentration),
        concentration: state.product_concentration,
        pipeline_by_stage: state.pipeline_by_stage,
        predictions: [],
        cross_sell: [],
        churn_preds: [],
        portfolio_health: state.risk_score >= 50 ? 'at_risk' : state.net_revenue_retention >= 1 ? 'growing' : 'contracting',
        arr_12mo_change: '',
        active_deals: state.funnel_deals.map((d) => {
          const oppName = (d.opportunity_name || '').trim()
          return {
            product: d.product_group,
            mrr: parseFloat(d.mrr) || 0,
            stage: d.stage,
            forecast: d.forecast_category,
            close: d.close_date,
            rep: d.rep,
            opportunity_id: d.opportunity_id || '',
            icb: icbByOppName[oppName] || null,
            icb_id: icbByOppName[oppName]?.icb_id || '',
          }
        }),
        historical_deals: jsonHistorical.length > 0
          ? jsonHistorical.map(d => ({
              product: d.p || 'Unknown', mrr: d.m || 0, stage: d.s || '',
              type: d.t || '', close: d.c || '', rep: d.r || '', manager: d.mg || '',
              forecast: d.f || '', term: d.tm || 0, npv: d.v || 0,
            }))
          : (state.historical_deals || []),
        churn_deals_list: jsonHistorical.length > 0
          ? jsonHistorical.filter(d => d.s === 'Closed Won' && (d.m || 0) < 0).map(d => ({
              product: d.p || 'Unknown', mrr: d.m || 0, stage: d.s || '', close: d.c || '',
            }))
          : (state.historical_deals || []).filter(d => d.mrr < 0),
        game_theory: null,
        signals: null,
        backtest: [],
        losses: {
          deals: state.close_lost_deals.map((d) => ({
            product: d.product_group || 'Unknown',
            mrr: parseFloat(d.mrr) || 0,
            date: d.close_date,
            type: d.type || d.loss_reason || '',
            rep: d.rep || '',
            days_pipe: 0,
            opportunity_id: d.opportunity_id || '',
          })),
          disconnects: state.services
            .filter(s => (s.service_status || '').toLowerCase() === 'disconnected')
            .map(s => ({
              product: s.product_group || 'Unknown',
              mrr: parseFloat(s.mrr) || 0,
              date: s.disconnect_date || '',
            })),
          downgrades: [],
          by_product: state.lost_by_product,
          timeline: [],
        },
        revenue_tl: [],
        engagement: mergeEngagement(eng25, eng26),
        learning: [],
        locations: jsonLocations.length > 0
          ? jsonLocations.map(l => ({
              name: l.n || 'Unknown', type: l.t || 'Office', address: l.a || '',
              lat: l.la || null, lng: l.lo || null, status: l.s || 'off-net',
              mrr: l.m || 0, classification: l.c || '', feet_from_network: l.ft || 0, market: l.mk || '',
            }))
          : state.locations.map((l) => {
              let netStatus = (l.on_net_status || l.status || 'off-net').toLowerCase()
              if (netStatus.includes('on zayo') || netStatus.includes('on-net') || netStatus === 'on net') netStatus = 'on-net'
              else if (netStatus.includes('near') || netStatus.includes('near-net')) netStatus = 'near-net'
              else netStatus = 'off-net'
              return {
                name: l.location_name || l.name || 'Unknown',
                type: l.location_type || l.type || 'Office',
                address: '',
                lat: parseFloat(l.latitude || l.lat) || null,
                lng: parseFloat(l.longitude || l.lng) || null,
                status: netStatus,
                mrr: parseFloat(l.monthly_revenue || l.mrr) || 0,
                classification: '', feet_from_network: 0, market: '',
              }
            }),
      })
    }

    built.sort((a, b) => b.arr - a.arr)
    setAccounts(built)
    setIsDemo(false)
  }, [])

  /**
   * Ingest all dropped files at once — CSV and JSON.
   * This is the primary path for hosted/browser-only mode.
   */
  const ingestAllFiles = useCallback(async (fileList) => {
    setLoading(true)
    setError(null)
    try {
      const newRaw = { customers: [], funnel: [], close_lost: [], quotes: [], services: [], locations: [], icb: [] }
      const newJson = { locations: {}, historical: {}, engagements: {}, engagements_2026: {} }
      const results = {}

      for (const file of fileList) {
        const text = await readFileAsText(file)
        const name = file.name.toLowerCase()

        // Handle JSON files
        if (name.endsWith('.json')) {
          try {
            const parsed = JSON.parse(text)
            if (name.includes('location')) newJson.locations = parsed
            else if (name.includes('historical')) newJson.historical = parsed
            else if (name.includes('engagement') && name.includes('2026')) newJson.engagements_2026 = parsed
            else if (name.includes('engagement')) newJson.engagements = parsed
            results[name] = Object.keys(parsed).length + ' entries'
          } catch {}
          continue
        }

        // Handle CSV files
        if (!name.endsWith('.csv')) continue
        const records = parseCSV(text)
        if (!records.length) continue

        let tabType = tabTypeFromFileName(file.name)
        if (!tabType) tabType = detectTabType(records[0])
        if (!newRaw[tabType]) newRaw[tabType] = []
        newRaw[tabType] = [...newRaw[tabType], ...records]
        results[tabType] = (results[tabType] || 0) + records.length
      }

      setRawData(newRaw)
      setJsonData(newJson)
      rebuildAccounts(newRaw, newJson)

      const allAccounts = new Set()
      for (const records of Object.values(newRaw)) {
        for (const r of records) {
          if (r.customer_account) allAccounts.add(r.customer_account)
        }
      }

      return { accounts_count: allAccounts.size, records_ingested: results }
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const clearData = useCallback(() => {
    setRawData({ customers: [], funnel: [], close_lost: [], quotes: [], services: [], locations: [], icb: [] })
    setJsonData({ locations: {}, historical: {}, engagements: {}, engagements_2026: {} })
    setAccounts(DEMO_ACCOUNTS)
    setIsDemo(true)
    setError(null)
  }, [])

  return { accounts, isDemo, loading, error, rawData, ingestLocalCSV, ingestMultiCSV, ingestAllFiles, clearData }
}

function mergeEngagement(eng25, eng26) {
  if (!eng25 && !eng26) return null
  const byType = {}
  const byMonth = {}
  let total = 0, contacts = 0, reps = 0, lastDate = ''
  let events = []

  for (const eng of [eng25, eng26]) {
    if (!eng) continue
    total += eng.t || 0
    contacts = Math.max(contacts, eng.c || 0)
    reps = Math.max(reps, eng.r || 0)
    if (eng.l && eng.l > lastDate) lastDate = eng.l
    if (eng.tp) for (const [k, v] of Object.entries(eng.tp)) byType[k] = (byType[k] || 0) + v
    if (eng.m) for (const [k, v] of Object.entries(eng.m)) byMonth[k] = (byMonth[k] || 0) + v
    if (eng.e) events = events.concat(eng.e)
  }

  const parseD = (s) => { if (!s) return 0; const p = s.split('/'); return p.length >= 3 ? new Date(p[2], p[0] - 1, p[1]).getTime() : 0 }
  events.sort((a, b) => parseD(b.d) - parseD(a.d))
  events = events.slice(0, 50)

  const timeline = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }))

  return { total, byType, timeline, contacts, reps, lastDate, events }
}
```

### useClaudeAPI.js

```js
import { useState, useCallback } from 'react'
import { API_BASE } from '../lib/constants'

export default function useClaudeAPI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const runBayesian = useCallback(async (accountId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/analyze/bayesian/${encodeURIComponent(accountId)}`, { method: 'POST' })
      if (!res.ok) throw new Error(`Bayesian analysis failed: ${res.statusText}`)
      return await res.json()
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const runGameTheory = useCallback(async (accountId, dealIndex) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/analyze/game-theory/${encodeURIComponent(accountId)}/${dealIndex}`, { method: 'POST' })
      if (!res.ok) throw new Error(`Game theory analysis failed: ${res.statusText}`)
      return await res.json()
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const runSignals = useCallback(async (accountId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/analyze/signals/${encodeURIComponent(accountId)}`, { method: 'POST' })
      if (!res.ok) throw new Error(`Signal analysis failed: ${res.statusText}`)
      return await res.json()
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const runBacktest = useCallback(async (accountId, cutoffDate) => {
    setLoading(true)
    setError(null)
    try {
      const url = `${API_BASE}/backtest/${encodeURIComponent(accountId)}${cutoffDate ? `?cutoff_date=${cutoffDate}` : ''}`
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) throw new Error(`Backtest failed: ${res.statusText}`)
      return await res.json()
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const runLearningCurve = useCallback(async (accountId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/learning-curve/${encodeURIComponent(accountId)}`, { method: 'POST' })
      if (!res.ok) throw new Error(`Learning curve failed: ${res.statusText}`)
      return await res.json()
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, runBayesian, runGameTheory, runSignals, runBacktest, runLearningCurve }
}
```

### useLocalData.js

```js
import { useState, useEffect, useCallback } from 'react'
import { parseCSV } from '../lib/normalize'
import { buildAccountState, buildBacktestData, buildLearningData, buildCalibration } from '../lib/accountBuilder'

/**
 * Auto-loads CSV files from the local data/ folder.
 *
 * FILE NAMING CONVENTION — place CSVs in frontend/data/:
 *   customers.csv    → Customer master data
 *   funnel.csv       → Active pipeline deals
 *   close_lost.csv   → Deals lost
 *   quotes.csv       → Proposals
 *   services.csv     → Installed base
 *   locations.csv    → Customer sites
 *
 * Or use any filename — the system auto-detects the table type from column headers.
 *
 * Polls every 5 seconds for file changes (Xappex updates → instant refresh).
 * ALL DATA STAYS LOCAL — served by Vite dev server from your filesystem.
 */

const KNOWN_TABS = ['customers', 'funnel', 'close_lost', 'quotes', 'services', 'locations', 'icb']

function tabTypeFromFileName(name) {
  const base = name.replace('.csv', '').toLowerCase().replace(/[^a-z_]/g, '')
  if (KNOWN_TABS.includes(base)) return base
  if (base.includes('customer') || base.includes('account')) return 'customers'
  if (base.includes('funnel') || base.includes('pipeline') || base.includes('opportunity')) return 'funnel'
  if (base.includes('historical') || base.includes('closed_won') || base.includes('won') || base.includes('history')) return 'funnel'
  if (base.includes('lost') || base.includes('loss')) return 'close_lost'
  if (base.includes('quote') || base.includes('proposal')) return 'quotes'
  if (base.includes('service') || base.includes('circuit') || base.includes('install')) return 'services'
  if (base.includes('location') || base.includes('site')) return 'locations'
  if (base.includes('icb')) return 'icb'
  return null // will auto-detect from columns
}

function detectTabTypeFromRecord(record) {
  const fields = new Set(Object.keys(record))
  if (fields.has('loss_reason') || fields.has('stage_lost_from')) return 'close_lost'
  if (fields.has('stage') && fields.has('forecast_category')) return 'funnel'
  if (fields.has('quoted_mrr') || fields.has('quote_status')) return 'quotes'
  if (fields.has('service_status') || fields.has('service_id') || fields.has('disconnect_date')) return 'services'
  if (fields.has('on_net_status') || fields.has('location_type')) return 'locations'
  if (fields.has('icb_id')) return 'icb'
  if (fields.has('mega_vertical') || fields.has('primary_rep') || fields.has('account_tier')) return 'customers'
  return 'funnel'
}

export default function useLocalData() {
  const [localFiles, setLocalFiles] = useState([])
  const [localAccounts, setLocalAccounts] = useState(null) // null = not loaded yet
  const [localRawData, setLocalRawData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dataDir, setDataDirState] = useState('')

  // On mount, restore saved data dir from localStorage and send to server
  useEffect(() => {
    const saved = localStorage.getItem('revos_data_dir')
    if (saved) {
      fetch('/local-data/data-dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: saved }),
      }).then(r => r.json()).then(d => {
        if (d.ok) setDataDirState(d.dataDir)
        else localStorage.removeItem('revos_data_dir')
      }).catch(() => {})
    }
    // Also fetch the current server data dir
    fetch('/local-data/data-dir').then(r => r.json()).then(d => {
      if (d.dataDir && !saved) setDataDirState(d.dataDir)
    }).catch(() => {})
  }, [])

  const loadAllFiles = useCallback(async (files) => {
    setLoading(true)
    setError(null)
    try {
      const raw = { customers: [], funnel: [], close_lost: [], quotes: [], services: [], locations: [], icb: [] }

      // Load CSV files
      for (const file of files) {
        const res = await fetch(`/local-data/file?name=${encodeURIComponent(file.name)}`)
        if (!res.ok) continue
        const text = await res.text()
        const records = parseCSV(text)
        if (!records.length) continue

        let tabType = tabTypeFromFileName(file.name)
        if (!tabType) {
          tabType = detectTabTypeFromRecord(records[0])
        }

        raw[tabType] = [...raw[tabType], ...records]
      }

      // Load pre-built JSON files (locations + historical + engagements)
      let locationsJSON = {}
      let historicalJSON = {}
      let engagements2025 = {}
      let engagements2026 = {}
      try {
        const locRes = await fetch('/local-data/locations.json')
        if (locRes.ok) locationsJSON = await locRes.json()
      } catch {}
      try {
        const histRes = await fetch('/local-data/historical.json')
        if (histRes.ok) historicalJSON = await histRes.json()
      } catch {}
      try {
        const eng25Res = await fetch('/local-data/engagements.json')
        if (eng25Res.ok) engagements2025 = await eng25Res.json()
      } catch {}
      try {
        const eng26Res = await fetch('/local-data/engagements_2026.json')
        if (eng26Res.ok) engagements2026 = await eng26Res.json()
      } catch {}

      setLocalRawData(raw)
      const accounts = buildAccountsFromRaw(raw, locationsJSON, historicalJSON, engagements2025, engagements2026)
      setLocalAccounts(accounts)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load data from the current data folder (called once on mount + on manual refresh)
  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/local-data/manifest')
      if (!res.ok) return
      const { files } = await res.json()
      setLocalFiles(files || [])

      if (!files || files.length === 0) return

      await loadAllFiles(files)
    } catch {
      // Vite plugin not running (production build) — that's fine
    }
  }, [loadAllFiles])

  const setDataDir = useCallback(async (dir) => {
    try {
      const res = await fetch('/local-data/data-dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir }),
      })
      const data = await res.json()
      if (!res.ok) return { error: data.error }
      setDataDirState(data.dataDir)
      localStorage.setItem('revos_data_dir', dir)
      setLocalAccounts(null)
      // Small delay so server registers the new dir before we fetch manifest
      await new Promise(r => setTimeout(r, 100))
      await loadData()
      return { ok: true, dataDir: data.dataDir }
    } catch (err) {
      return { error: err.message }
    }
  }, [loadData])

  // Load once on mount
  useEffect(() => {
    loadData()
  }, [loadData])

  // Track whether the local server is available
  const [serverAvailable, setServerAvailable] = useState(null) // null = unknown

  // Detect server availability on mount
  useEffect(() => {
    fetch('/local-data/manifest')
      .then(r => { if (r.ok) setServerAvailable(true); else setServerAvailable(false) })
      .catch(() => setServerAvailable(false))
  }, [])

  return {
    localFiles,
    localAccounts,
    localRawData,
    loading,
    error,
    dataDir,
    setDataDir,
    refresh: loadData,
    serverAvailable,
  }
}

function buildAccountsFromRaw(raw, locationsJSON = {}, historicalJSON = {}, engagements2025 = {}, engagements2026 = {}) {
  // Only customers.csv defines the account list
  const customerMap = {}
  for (const c of raw.customers) {
    if (!c.customer_account) continue
    if (!customerMap[c.customer_account]) {
      customerMap[c.customer_account] = { ...c }
    } else {
      // Sum total_brr across multiple rows for the same account
      const existing = customerMap[c.customer_account]
      const prevBRR = parseFloat(String(existing.total_brr || '').replace(/[$,\s]/g, '')) || 0
      const addBRR = parseFloat(String(c.total_brr || '').replace(/[$,\s]/g, '')) || 0
      existing.total_brr = prevBRR + addBRR
    }
  }

  const accountNames = new Set(Object.keys(customerMap))

  if (accountNames.size === 0) return []

  // Build ICB lookup: opportunity_name → full ICB record
  const icbByOppName = {}
  for (const rec of (raw.icb || [])) {
    if (rec.opportunity_name) {
      icbByOppName[String(rec.opportunity_name).trim()] = {
        icb_id: String(rec.icb_id || ''),
        stage: rec.icb_stage || rec.stage || '',
        created_date: rec.icb_created_date || rec.created_date || '',
        se_review_date: rec.icb_se_review_date || '',
        se_review_time: rec.icb_se_review_time || '',
        status: rec.icb_status || rec.service_status || '',
        se_name: rec.icb_se_name || '',
      }
    }
  }

  const built = []
  for (const name of accountNames) {
    const customer = customerMap[name]
    const funnel = raw.funnel.filter((r) => r.customer_account === name)
    const closeLost = raw.close_lost.filter((r) => r.customer_account === name)
    const quotes = raw.quotes.filter((r) => r.customer_account === name)
    const services = raw.services.filter((r) => r.customer_account === name)
    const locations = raw.locations.filter((r) => r.customer_account === name)

    // Get pre-built location, historical, and engagement data from JSON
    const jsonLocations = locationsJSON[name] || []
    const jsonHistorical = historicalJSON[name] || []
    const eng25 = engagements2025[name] || null
    const eng26 = engagements2026[name] || null

    const state = buildAccountState(customer, funnel, closeLost, quotes, services, locations)

    built.push({
      id: name,
      name,
      account_id: state.account_id,
      vertical: state.mega_vertical,
      arr: state.total_arr,
      mrr: state.total_mrr,
      pipeline_mrr: state.active_pipeline_mrr,
      pipeline_count: state.active_pipeline_count,
      won: state.total_deals_won,
      lost: state.total_deals_lost,
      win_rate: state.win_rate,
      avg_cycle: 0,
      nrr: state.net_revenue_retention,
      days_silent: state.days_since_last_activity,
      velocity: state.deal_velocity_trend,
      risk_score: state.risk_score,
      risk_level: state.risk_level,
      rep: state.primary_rep,
      manager: state.account_manager,
      sales_owner: state.sales_owner,
      reps: state.rep_count,
      tenure_mo: 0,
      disconnects: state.disconnects,
      downgrades: state.downgrades,
      downgrade_mrr: state.downgrade_mrr,
      churn_deals: state.churn_deals,
      churn_mrr: state.churn_mrr,
      lost_mrr: state.lost_mrr_total,
      products: Object.keys(state.product_concentration),
      concentration: state.product_concentration,
      pipeline_by_stage: state.pipeline_by_stage,
      predictions: [],
      cross_sell: [],
      churn_preds: [],
      portfolio_health: state.risk_score >= 50 ? 'at_risk' : state.net_revenue_retention >= 1 ? 'growing' : 'contracting',
      arr_12mo_change: '',
      active_deals: state.funnel_deals.map((d) => {
        const oppName = (d.opportunity_name || '').trim()
        return {
          product: d.product_group,
          mrr: parseFloat(d.mrr) || 0,
          stage: d.stage,
          forecast: d.forecast_category,
          close: d.close_date,
          rep: d.rep,
          opportunity_id: d.opportunity_id || '',
          icb: icbByOppName[oppName] || null,
          icb_id: icbByOppName[oppName]?.icb_id || '',
        }
      }),
      historical_deals: jsonHistorical.length > 0
        ? jsonHistorical.map(d => ({
            product: d.p || 'Unknown', mrr: d.m || 0, stage: d.s || '',
            type: d.t || '', close: d.c || '', rep: d.r || '', manager: d.mg || '',
            forecast: d.f || '', term: d.tm || 0, npv: d.v || 0,
          }))
        : (state.historical_deals || []),
      churn_deals_list: jsonHistorical.length > 0
        ? jsonHistorical.filter(d => d.s === 'Closed Won' && (d.m || 0) < 0).map(d => ({
            product: d.p || 'Unknown', mrr: d.m || 0, stage: d.s || '', close: d.c || '',
          }))
        : (state.historical_deals || []).filter(d => d.mrr < 0),
      game_theory: null,
      signals: null,
      backtest: buildBacktestData([...funnel, ...closeLost]),
      calibration: buildCalibration(buildBacktestData([...funnel, ...closeLost])),
      losses: {
        deals: state.close_lost_deals.map((d) => ({
          product: d.product_group || 'Unknown',
          mrr: parseFloat(d.mrr) || 0,
          date: d.close_date,
          type: d.type || d.loss_reason || '',
          rep: d.rep || '',
          days_pipe: 0,
          opportunity_id: d.opportunity_id || '',
        })),
        disconnects: state.services
          .filter(s => (s.service_status || '').toLowerCase() === 'disconnected')
          .map(s => ({
            product: s.product_group || 'Unknown',
            mrr: parseFloat(s.mrr) || 0,
            date: s.disconnect_date || '',
          })),
        downgrades: [],
        by_product: state.lost_by_product,
        timeline: [],
      },
      revenue_tl: buildRevenueTL(jsonHistorical),
      engagement: mergeEngagement(eng25, eng26),
      learning: buildLearningData([...funnel, ...closeLost]),
      locations: jsonLocations.length > 0
        ? jsonLocations.map(l => ({
            name: l.n || 'Unknown',
            type: l.t || 'Office',
            address: l.a || '',
            lat: l.la || null,
            lng: l.lo || null,
            status: l.s || 'off-net',
            mrr: l.m || 0,
            classification: l.c || '',
            feet_from_network: l.ft || 0,
            market: l.mk || '',
          }))
        : state.locations.map((l) => {
            let netStatus = (l.on_net_status || l.status || 'off-net').toLowerCase()
            if (netStatus.includes('on zayo') || netStatus.includes('on-net') || netStatus === 'on net') netStatus = 'on-net'
            else if (netStatus.includes('near') || netStatus.includes('near-net')) netStatus = 'near-net'
            else netStatus = 'off-net'
            return {
              name: l.location_name || l.name || 'Unknown',
              type: l.location_type || l.type || 'Office',
              address: '',
              lat: parseFloat(l.latitude || l.lat) || null,
              lng: parseFloat(l.longitude || l.lng) || null,
              status: netStatus,
              mrr: parseFloat(l.monthly_revenue || l.mrr) || 0,
              classification: '',
              feet_from_network: 0,
              market: '',
            }
          }),
    })
  }

  built.sort((a, b) => b.arr - a.arr)
  return built
}

function mergeEngagement(eng25, eng26) {
  if (!eng25 && !eng26) return null
  const byType = {}
  const byMonth = {}
  let total = 0, contacts = 0, reps = 0, lastDate = ''
  let events = []

  for (const eng of [eng25, eng26]) {
    if (!eng) continue
    total += eng.t || 0
    contacts = Math.max(contacts, eng.c || 0)
    reps = Math.max(reps, eng.r || 0)
    if (eng.l && eng.l > lastDate) lastDate = eng.l
    if (eng.tp) for (const [k, v] of Object.entries(eng.tp)) byType[k] = (byType[k] || 0) + v
    if (eng.m) for (const [k, v] of Object.entries(eng.m)) byMonth[k] = (byMonth[k] || 0) + v
    if (eng.e) events = events.concat(eng.e)
  }

  // Sort events by date descending, keep most recent 50
  const parseD = (s) => { if (!s) return 0; const p = s.split('/'); return p.length >= 3 ? new Date(p[2], p[0] - 1, p[1]).getTime() : 0 }
  events.sort((a, b) => parseD(b.d) - parseD(a.d))
  events = events.slice(0, 50)

  // Build monthly timeline sorted
  const timeline = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }))

  return { total, byType, timeline, contacts, reps, lastDate, events }
}

function buildRevenueTL(jsonHistorical) {
  if (!jsonHistorical || jsonHistorical.length === 0) return []

  // Group deals by quarter from close date
  const quarters = {}
  for (const d of jsonHistorical) {
    const closeDate = d.c || ''
    if (!closeDate) continue
    const date = new Date(closeDate)
    if (isNaN(date.getTime())) continue
    const q = `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`
    if (!quarters[q]) quarters[q] = { new: 0, rr_up: 0, lost: 0 }

    const mrr = d.m || 0
    const stage = (d.s || '').toLowerCase()
    const type = (d.t || '').toLowerCase()

    if (stage.includes('closed won') || stage === 'closed won') {
      if (mrr < 0) {
        // Negative re-rate / churn
        quarters[q].lost += mrr
      } else if (type.includes('re-rate') || type.includes('rerate') || type.includes('upgrade') || type.includes('renewal')) {
        quarters[q].rr_up += mrr
      } else {
        quarters[q].new += mrr
      }
    } else if (stage.includes('closed lost')) {
      // Don't add to revenue timeline (these weren't won)
    }
  }

  // Sort by quarter and compute cumulative
  const sorted = Object.entries(quarters).sort(([a], [b]) => a.localeCompare(b))
  let cum = 0
  return sorted.map(([q, d]) => {
    cum += d.new + d.rr_up + d.lost
    return {
      q,
      new: Math.round(d.new),
      rr_up: Math.round(d.rr_up),
      lost: Math.round(d.lost),
      cum: Math.round(cum),
    }
  })
}
```

### App.jsx

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
  const { accounts: uploadedAccounts, isDemo: isUploadDemo, rawData, ingestLocalCSV, ingestAllFiles, clearData } = useAccounts()
  const { localAccounts, localFiles, loading: localLoading, dataDir, setDataDir, refresh, serverAvailable } = useLocalData()
  const [showDirPicker, setShowDirPicker] = useState(false)
  const [dirInput, setDirInput] = useState('')
  const [dirError, setDirError] = useState('')

  const handleSetDir = useCallback(async () => {
    if (!dirInput.trim()) return
    setDirError('')
    const result = await setDataDir(dirInput.trim())
    if (result.error) {
      setDirError(result.error)
    } else {
      setShowDirPicker(false)
      setDirInput('')
    }
  }, [dirInput, setDataDir])

  // Priority: local data/ folder files > uploaded CSVs > demo data
  const hasLocalData = localAccounts && localAccounts.length > 0
  const accounts = hasLocalData ? localAccounts : uploadedAccounts
  const isDemo = hasLocalData ? false : isUploadDemo
  const dataSource = hasLocalData ? 'local' : isUploadDemo ? 'demo' : 'uploaded'

  const [selAcct, setSelAcct] = useState(0)
  const [page, setPage] = useState('priority')
  const [managerFilter, setManagerFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const MANAGERS = ['DCosta', 'Kahn', 'Ochoa']

  // Build unique sorted list of Sales Owners from accounts
  const salesOwners = [...new Set(
    accounts.map(acc => (acc.sales_owner || '').trim()).filter(Boolean)
  )].sort((a, b) => {
    // Sort by last name
    const aLast = a.split(/\s+/).pop().toLowerCase()
    const bLast = b.split(/\s+/).pop().toLowerCase()
    return aLast.localeCompare(bLast)
  })

  const filteredAccounts = accounts.filter(acc => {
    if (managerFilter !== 'all' && !(acc.manager || '').toLowerCase().includes(managerFilter.toLowerCase())) return false
    if (ownerFilter !== 'all' && (acc.sales_owner || '').trim() !== ownerFilter) return false
    return true
  })

  const searchedAccounts = searchQuery
    ? filteredAccounts.filter(acc => acc.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : filteredAccounts

  const a = searchedAccounts.length > 0
    ? searchedAccounts[Math.min(selAcct, searchedAccounts.length - 1)]
    : null

  // Hosted mode: no server, no uploaded data yet → show full-screen drop zone
  const [dropping, setDropping] = useState(false)
  const [dropStatus, setDropStatus] = useState(null)
  const dropRef = useCallback((node) => {
    if (!node) return
    const prevent = (e) => e.preventDefault()
    node.addEventListener('dragover', prevent)
    node.addEventListener('drop', prevent)
    return () => { node.removeEventListener('dragover', prevent); node.removeEventListener('drop', prevent) }
  }, [])

  const hostedNoData = serverAvailable === false && isUploadDemo

  if (hostedNoData) {
    return (
      <div
        ref={dropRef}
        onDragOver={(e) => { e.preventDefault(); setDropping(true) }}
        onDragLeave={() => setDropping(false)}
        onDrop={async (e) => {
          e.preventDefault()
          setDropping(false)
          setDropStatus({ type: 'loading', message: 'Processing files...' })
          try {
            const result = await ingestAllFiles(Array.from(e.dataTransfer.files))
            setDropStatus({ type: 'success', message: `Loaded ${result.accounts_count} accounts` })
          } catch (err) {
            setDropStatus({ type: 'error', message: err.message })
          }
        }}
        style={{
          height: '100vh', background: T.bg, color: T.text,
          fontFamily: "'Inter', system-ui, sans-serif",
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '40px',
        }}
      >
        <div style={{ fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '0.15em', color: T.cyan, marginBottom: '8px' }}>
          REVOS
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>
          Account Intelligence Platform
        </h1>
        <p style={{ color: T.textMid, fontSize: '14px', marginBottom: '32px', textAlign: 'center', maxWidth: '500px' }}>
          Drop your data folder contents below to get started. All processing happens in your browser — nothing is uploaded to any server.
        </p>

        <div
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.multiple = true
            input.accept = '.csv,.json'
            input.onchange = async (e) => {
              setDropStatus({ type: 'loading', message: 'Processing files...' })
              try {
                const result = await ingestAllFiles(Array.from(e.target.files))
                setDropStatus({ type: 'success', message: `Loaded ${result.accounts_count} accounts` })
              } catch (err) {
                setDropStatus({ type: 'error', message: err.message })
              }
            }
            input.click()
          }}
          style={{
            width: '100%', maxWidth: '600px', padding: '60px 40px',
            border: `2px dashed ${dropping ? T.cyan : T.border}`,
            borderRadius: '16px',
            background: dropping ? `${T.cyan}08` : T.surface,
            cursor: 'pointer', textAlign: 'center',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.6 }}>
            {dropStatus?.type === 'loading' ? '...' : ''}
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: '14px', color: T.textMid, marginBottom: '8px' }}>
            {dropStatus?.type === 'loading' ? 'Processing...' : 'Drop all files here or click to select'}
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim, lineHeight: 1.6 }}>
            Select all CSV + JSON files from your data folder<br/>
            customers.csv, funnel.csv, close_lost.csv, services.csv, ICB.csv,<br/>
            locations.json, historical.json, engagements.json, etc.
          </div>
        </div>

        {dropStatus && dropStatus.type !== 'loading' && (
          <div style={{
            marginTop: '16px', padding: '12px 20px', borderRadius: '8px',
            fontFamily: FONT_MONO, fontSize: '11px', maxWidth: '600px', width: '100%',
            background: dropStatus.type === 'error' ? `${T.red}18` : `${T.green}18`,
            color: dropStatus.type === 'error' ? T.red : T.green,
            border: `1px solid ${dropStatus.type === 'error' ? T.red : T.green}30`,
          }}>
            {dropStatus.message}
          </div>
        )}

        <div style={{ marginTop: '24px', fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim, textAlign: 'center' }}>
          YOUR DATA NEVER LEAVES YOUR COMPUTER
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', background: T.bg, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header accountCount={searchedAccounts.length} isDemo={isDemo} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: '220px', borderRight: `1px solid ${T.border}`, background: T.surface, display: 'flex', flexDirection: 'column', flexShrink: 0, minHeight: 0, overflow: 'hidden' }}>
          {/* Data source panel */}
          <div style={{ padding: '8px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            {/* Data folder selector */}
            <div style={{ marginBottom: '6px' }}>
              <button
                onClick={() => { setShowDirPicker(!showDirPicker); setDirError(''); if (!dirInput && dataDir) setDirInput(dataDir) }}
                style={{
                  width: '100%', padding: '6px 8px', borderRadius: '5px', cursor: 'pointer',
                  fontFamily: FONT_MONO, fontSize: '9px', fontWeight: 600,
                  background: T.card, border: `1px solid ${T.border}`, color: T.cyan,
                  display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = T.cyan}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
              >
                <span style={{ fontSize: '12px' }}>📂</span>
                {dataDir ? 'Change Data Folder' : 'Select Data Folder'}
              </button>
              {dataDir && !showDirPicker && (
                <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, marginTop: '3px', wordBreak: 'break-all' }}>
                  {dataDir}
                </div>
              )}
              {showDirPicker && (
                <div style={{ marginTop: '6px', padding: '8px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: '6px' }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, marginBottom: '4px' }}>
                    Paste the full path to your data folder:
                  </div>
                  <input
                    type="text"
                    value={dirInput}
                    onChange={(e) => setDirInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSetDir()}
                    placeholder="C:\Users\...\data"
                    style={{
                      width: '100%', padding: '5px 6px', fontFamily: FONT_MONO, fontSize: '9px',
                      background: T.card, border: `1px solid ${T.border}`, borderRadius: '4px',
                      color: T.text, outline: 'none', marginBottom: '4px',
                    }}
                    onFocus={(e) => e.target.style.borderColor = T.cyan}
                    onBlur={(e) => e.target.style.borderColor = T.border}
                    autoFocus
                  />
                  {dirError && (
                    <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.red, marginBottom: '4px' }}>
                      {dirError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={handleSetDir}
                      style={{
                        flex: 1, padding: '4px', borderRadius: '4px', cursor: 'pointer',
                        fontFamily: FONT_MONO, fontSize: '9px', fontWeight: 600,
                        background: `${T.cyan}18`, border: `1px solid ${T.cyan}`, color: T.cyan,
                      }}
                    >
                      Load
                    </button>
                    <button
                      onClick={() => { setShowDirPicker(false); setDirError('') }}
                      style={{
                        padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
                        fontFamily: FONT_MONO, fontSize: '9px',
                        background: 'transparent', border: `1px solid ${T.border}`, color: T.textDim,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Show local file status if files exist in data/ */}
            {localFiles.length > 0 && (
              <div style={{
                padding: '6px 8px',
                background: `${T.green}08`,
                border: `1px solid ${T.green}22`,
                borderRadius: '6px',
                marginBottom: '6px',
                fontFamily: FONT_MONO,
                fontSize: '9px',
              }}>
                <div style={{ color: T.green, marginBottom: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{localFiles.length} FILES LOADED</span>
                  <button
                    onClick={() => refresh()}
                    disabled={localLoading}
                    style={{
                      padding: '2px 6px', borderRadius: '3px', cursor: localLoading ? 'default' : 'pointer',
                      fontFamily: FONT_MONO, fontSize: '8px', fontWeight: 600,
                      background: 'transparent', border: `1px solid ${T.cyan}44`, color: T.cyan,
                      opacity: localLoading ? 0.5 : 1,
                    }}
                  >
                    {localLoading ? 'LOADING...' : 'REFRESH'}
                  </button>
                </div>
                {localFiles.map((f) => (
                  <div key={f.name} style={{ color: T.textDim, fontSize: '8px' }}>
                    {f.name} ({(f.size / 1024).toFixed(0)}KB)
                  </div>
                ))}
              </div>
            )}
            <CSVUploader
              onUpload={ingestLocalCSV}
              onClear={clearData}
              rawData={rawData}
            />
          </div>
          {/* Manager filter */}
          <div style={{ padding: '8px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, letterSpacing: '0.1em', marginBottom: '4px' }}><Tip label="MANAGER">MANAGER</Tip></div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button
                onClick={() => { setManagerFilter('all'); setSelAcct(0) }}
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  fontFamily: FONT_MONO,
                  border: `1px solid ${managerFilter === 'all' ? T.cyan : T.border}`,
                  borderRadius: '4px',
                  background: managerFilter === 'all' ? `${T.cyan}18` : 'transparent',
                  color: managerFilter === 'all' ? T.cyan : T.textDim,
                  cursor: 'pointer',
                }}
              >
                ALL
              </button>
              {MANAGERS.map(m => (
                <button
                  key={m}
                  onClick={() => { setManagerFilter(m); setSelAcct(0) }}
                  style={{
                    padding: '3px 8px',
                    fontSize: '10px',
                    fontFamily: FONT_MONO,
                    border: `1px solid ${managerFilter === m ? T.cyan : T.border}`,
                    borderRadius: '4px',
                    background: managerFilter === m ? `${T.cyan}18` : 'transparent',
                    color: managerFilter === m ? T.cyan : T.textDim,
                    cursor: 'pointer',
                  }}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {/* Sales Owner filter */}
          {salesOwners.length > 0 && (
            <div style={{ padding: '8px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, letterSpacing: '0.1em', marginBottom: '4px' }}>
                <Tip label="SALES OWNER">SALES OWNER</Tip>
              </div>
              <select
                value={ownerFilter}
                onChange={(e) => { setOwnerFilter(e.target.value); setSelAcct(0) }}
                style={{
                  width: '100%',
                  padding: '5px 6px',
                  fontFamily: FONT_MONO,
                  fontSize: '10px',
                  background: T.card,
                  border: `1px solid ${ownerFilter !== 'all' ? T.cyan : T.border}`,
                  borderRadius: '4px',
                  color: ownerFilter !== 'all' ? T.cyan : T.text,
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'auto',
                }}
              >
                <option value="all">All Sales Owners</option>
                {salesOwners.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}
          {/* Account search */}
          <div style={{ padding: '6px 8px', borderBottom: `1px solid ${T.border}`, flexShrink: 0, position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSelAcct(0) }}
              placeholder="Search accounts..."
              style={{
                width: '100%',
                padding: '5px 22px 5px 8px',
                fontFamily: FONT_MONO,
                fontSize: '10px',
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: '4px',
                color: T.text,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.target.style.borderColor = T.cyan}
              onBlur={(e) => e.target.style.borderColor = T.border}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSelAcct(0) }}
                style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
                  fontFamily: FONT_MONO, fontSize: '12px', color: T.textDim, lineHeight: 1,
                }}
              >
                x
              </button>
            )}
          </div>
          {/* Account list */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <Sidebar accounts={searchedAccounts} selectedIndex={selAcct} onSelect={setSelAcct} />
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopNav activePage={page} onPageChange={setPage} />

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {page === 'priority' ? (
              <Priority
                accounts={searchedAccounts}
                onSelect={(idx) => { setSelAcct(idx); setPage('overview') }}
              />
            ) : page === 'engagement' ? (
              <Engagement
                accounts={searchedAccounts}
                onSelect={(idx) => { setSelAcct(idx); setPage('overview') }}
              />
            ) : !a ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: T.textDim }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: '12px', marginBottom: '8px' }}>NO ACCOUNTS FOUND</div>
                <div style={{ fontSize: '11px' }}>No accounts match this manager filter. Check that your customers.csv has a "Sales Funnel Manager" column.</div>
              </div>
            ) : (
            <>
            {/* Page header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{a.name}</h2>
                  {a.account_id && (
                    <a
                      href={`https://zayo.lightning.force.com/lightning/r/Opportunity/${a.account_id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: FONT_MONO, fontSize: '9px', fontWeight: 600,
                        padding: '3px 8px', borderRadius: '4px',
                        background: `${T.cyan}18`, border: `1px solid ${T.cyan}`,
                        color: T.cyan, textDecoration: 'none', cursor: 'pointer',
                      }}
                    >
                      SFDC ↗
                    </a>
                  )}
                  <Badge color={a.risk_score >= 50 ? T.red : a.risk_score >= 30 ? T.orange : T.green}>
                    {a.risk_level.toUpperCase()}
                  </Badge>
                  {a.risk_score >= 30 && <Badge color={T.red}>RISK {a.risk_score}/100</Badge>}
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}>
                  {a.vertical} · {a.rep} · {a.tenure_mo}mo tenure · NRR: {pc(a.nrr)} · {a.products.join(', ')}
                </div>
              </div>
              {dataSource === 'local' && (
                <Badge color={T.green} size="md">LIVE · AUTO-SYNC FROM data/</Badge>
              )}
              {dataSource === 'uploaded' && (
                <Badge color={T.green} size="md">YOUR DATA · LOCAL ONLY</Badge>
              )}
            </div>

            {/* Page content */}
            {page === 'overview' && <Overview a={a} />}
            {page === 'locations' && <Locations a={a} />}
            {page === 'predict' && <Predictions a={a} />}
            {page === 'deals' && <Deals a={a} />}
            {page === 'signals' && <Signals a={a} />}
            {page === 'losses' && <Losses a={a} />}
            {page === 'backtest' && <Backtest a={a} />}
            {page === 'learning' && <Learning a={a} />}
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

### main.jsx

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

### index.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
  margin: 0;
}

::-webkit-scrollbar {
  width: 5px;
}
::-webkit-scrollbar-track {
  background: #06080F;
}
::-webkit-scrollbar-thumb {
  background: #30363D;
  border-radius: 3px;
}

@keyframes locPulse {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
  100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
}
```

### index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RevOS — AI Sales Intelligence</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```


---

## SECTION 4: EVERY PAGE COMPONENT

### Priority.jsx

```jsx
import { useState, useMemo } from 'react'
import { T, FONT_MONO } from '../lib/constants'
import Badge from '../components/shared/Badge'
import Stat from '../components/shared/Stat'
import Tip from '../components/shared/Tip'
import ProbBar from '../components/shared/ProbBar'
import { $, $k, pc } from '../components/shared/ChartTheme'

const FILTERS = [
  { id: 'deals', label: 'Active Deals', icon: '♟', color: T.cyan, tip: 'Accounts with open pipeline deals — sorted by total pipeline MRR' },
  { id: 'dark', label: 'Gone Dark', icon: '◌', color: T.red, tip: 'Accounts with no engagement in 60+ days — highest churn risk' },
  { id: 'need', label: 'Left on Need', icon: '◎', color: T.orange, tip: 'Last engagement ended on an open need or request — follow-up required' },
  { id: 'highprob', label: 'High Win Prob', icon: '↑', color: T.green, tip: 'Accounts where the Bayesian model predicts >60% win probability on at least one deal' },
  { id: 'onnet', label: 'On-Net', icon: '●', color: T.teal, tip: 'Accounts with on-net locations — lowest cost to serve, fastest install' },
  { id: 'offnet', label: 'Off-Net', icon: '○', color: T.yellow, tip: 'Accounts with mostly off-net locations — potential network build or partner opportunity' },
  { id: 'icb', label: 'Has ICB', icon: '◆', color: T.orange, tip: 'Accounts with active deals that have an ICB (Internal Case for Business) attached — pricing approved' },
]

function scoreAccount(acc) {
  let score = 0
  const reasons = []

  // Active deals boost
  const dealCount = acc.active_deals?.length || 0
  const pipelineMrr = acc.pipeline_mrr || 0
  if (dealCount > 0) {
    score += 20 + Math.min(pipelineMrr / 100, 30)
    reasons.push(`${dealCount} deal${dealCount > 1 ? 's' : ''} · ${$k(pipelineMrr)}/mo pipeline`)
  }

  // Engagement urgency
  const eng = acc.engagement
  if (eng) {
    if (eng.lastDate) {
      const daysSince = Math.floor((Date.now() - new Date(eng.lastDate).getTime()) / 86400000)
      if (daysSince > 180) { score += 35; reasons.push(`${daysSince}d dark — critical`) }
      else if (daysSince > 90) { score += 25; reasons.push(`${daysSince}d since engagement`) }
      else if (daysSince > 60) { score += 15; reasons.push(`${daysSince}d since engagement`) }
    } else {
      score += 20; reasons.push('No engagement date recorded')
    }
    if (eng.contacts <= 1) { score += 8; reasons.push('Single-threaded') }
  } else {
    score += 15; reasons.push('No engagement data')
  }

  // Last engagement ended on a need
  if (hasOpenNeed(acc)) {
    score += 20
    reasons.push('Last engagement left open need')
  }

  // Win probability from predictions
  const bestProb = getBestWinProb(acc)
  if (bestProb > 0.6) { score += 15; reasons.push(`${pc(bestProb)} win probability`) }
  else if (bestProb > 0.4) { score += 8; reasons.push(`${pc(bestProb)} win probability`) }

  // On-net locations (opportunity)
  const onNet = acc.locations?.filter(l => l.status === 'on-net').length || 0
  const total = acc.locations?.length || 0
  if (onNet > 0) { score += 5; reasons.push(`${onNet}/${total} on-net`) }

  // ARR weight — bigger accounts matter more
  if (acc.arr > 100000) score += 10
  else if (acc.arr > 50000) score += 5

  // Risk amplifier
  if (acc.risk_score >= 50) score += 15
  else if (acc.risk_score >= 30) score += 8

  return { score: Math.min(score, 100), reasons }
}

function getBestWinProb(acc) {
  if (!acc.active_deals?.length) return 0
  const cal = acc.calibration || { winLR: 1 }
  const prior = Math.max(0.05, Math.min(acc.win_rate || 0.5, 0.95))
  let best = 0
  for (const d of acc.active_deals) {
    let stageLR = 1.0
    const stage = (d.stage || '').toLowerCase()
    if (stage.includes('negotiate') || stage.includes('4')) stageLR = 3.0
    else if (stage.includes('propose') || stage.includes('3')) stageLR = 1.8
    else if (stage.includes('design') || stage.includes('2')) stageLR = 1.2
    else if (stage.includes('discover') || stage.includes('1')) stageLR = 0.6
    stageLR *= (cal.winLR || 1)
    const lo = Math.log(prior / (1 - prior)) + Math.log(stageLR)
    const prob = 1 / (1 + Math.exp(-lo))
    if (prob > best) best = prob
  }
  return best
}

function hasOpenNeed(acc) {
  const eng = acc.engagement
  if (!eng?.byType) return false
  // Heuristic: last engagement type suggests unresolved need
  // If recent engagements include quote_request, demo, proposal, or support with no follow-up win
  const needTypes = ['quote_request', 'demo', 'proposal', 'rfp', 'support', 'inquiry']
  const hasNeedActivity = needTypes.some(t => (eng.byType[t] || 0) > 0)
  if (!hasNeedActivity) return false
  // Check if there's been a gap since that activity
  if (eng.lastDate) {
    const daysSince = Math.floor((Date.now() - new Date(eng.lastDate).getTime()) / 86400000)
    return daysSince > 14 // Need left open for 2+ weeks
  }
  return true
}

function getDaysSilent(acc) {
  if (!acc.engagement?.lastDate) return null
  return Math.floor((Date.now() - new Date(acc.engagement.lastDate).getTime()) / 86400000)
}

export default function Priority({ accounts, onSelect }) {
  const [activeFilters, setActiveFilters] = useState(new Set())

  const toggle = (id) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const scored = useMemo(() => {
    return accounts.map((acc, idx) => {
      const { score, reasons } = scoreAccount(acc)
      return { acc, idx, score, reasons, bestProb: getBestWinProb(acc) }
    })
  }, [accounts])

  const filtered = useMemo(() => {
    let list = scored
    if (activeFilters.size > 0) {
      list = list.filter(({ acc }) => {
        for (const f of activeFilters) {
          if (f === 'deals' && !(acc.active_deals?.length > 0)) return false
          if (f === 'dark' && getDaysSilent(acc) !== null && getDaysSilent(acc) < 60) return false
          if (f === 'dark' && getDaysSilent(acc) === null && acc.engagement) return false
          if (f === 'need' && !hasOpenNeed(acc)) return false
          if (f === 'highprob' && getBestWinProb(acc) <= 0.6) return false
          if (f === 'onnet' && !(acc.locations?.some(l => l.status === 'on-net'))) return false
          if (f === 'offnet') {
            const onNet = acc.locations?.filter(l => l.status === 'on-net').length || 0
            const total = acc.locations?.length || 0
            if (total === 0 || onNet / total > 0.3) return false
          }
          if (f === 'icb' && !(acc.active_deals?.some(d => d.icb_id))) return false
        }
        return true
      })
    }
    return list.sort((a, b) => b.score - a.score)
  }, [scored, activeFilters])

  // Summary stats
  const totalPipeline = filtered.reduce((s, { acc }) => s + (acc.pipeline_mrr || 0), 0)
  const darkCount = filtered.filter(({ acc }) => { const d = getDaysSilent(acc); return d === null || d > 60 }).length
  const highProbCount = filtered.filter(({ acc }) => getBestWinProb(acc) > 0.6).length

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
        <Stat label="ACCOUNTS" value={filtered.length} sub={`of ${accounts.length}`} color={T.cyan} />
        <Stat label="TOTAL PIPELINE" value={`${$k(totalPipeline)}/mo`} color={T.green} />
        <Stat label="GONE DARK" value={darkCount} color={darkCount > 0 ? T.red : T.green} />
        <Stat label="HIGH PROBABILITY" value={highProbCount} color={T.teal} />
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim, letterSpacing: '0.08em', marginBottom: '8px' }}>
          <Tip label="PRIORITY FILTERS">PRIORITY FILTERS</Tip>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const active = activeFilters.has(f.id)
            return (
              <Tip key={f.id} tip={f.tip}>
                <button
                  onClick={() => toggle(f.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
                    fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600,
                    background: active ? `${f.color}18` : T.card,
                    border: `1px solid ${active ? f.color : T.border}`,
                    color: active ? f.color : T.textMid,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: '12px' }}>{f.icon}</span>
                  {f.label}
                </button>
              </Tip>
            )
          })}
          {activeFilters.size > 0 && (
            <button
              onClick={() => setActiveFilters(new Set())}
              style={{
                padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
                fontFamily: FONT_MONO, fontSize: '10px',
                background: 'transparent', border: `1px solid ${T.border}`,
                color: T.textDim,
              }}
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Priority list */}
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim, letterSpacing: '0.08em', marginBottom: '8px' }}>
        <Tip label="PRIORITY RANKING">PRIORITY RANKING</Tip> ({filtered.length})
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: T.textDim }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '11px' }}>No accounts match the selected filters.</div>
        </div>
      )}

      {filtered.map(({ acc, idx, score, reasons, bestProb }, i) => {
        const daysSilent = getDaysSilent(acc)
        const dealCount = acc.active_deals?.length || 0
        const onNet = acc.locations?.filter(l => l.status === 'on-net').length || 0
        const totalLocs = acc.locations?.length || 0
        const riskColor = acc.risk_score >= 50 ? T.red : acc.risk_score >= 30 ? T.orange : T.green

        return (
          <div
            key={acc.id || i}
            onClick={() => onSelect(idx)}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 260px',
              alignItems: 'center', gap: '12px',
              padding: '10px 14px', cursor: 'pointer',
              background: i % 2 === 0 ? T.card : 'transparent',
              borderRadius: '6px',
              borderLeft: `3px solid ${score >= 70 ? T.red : score >= 40 ? T.orange : T.green}`,
              marginBottom: '2px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = T.cardHover}
            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? T.card : 'transparent'}
          >
            {/* Account info */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{acc.name}</span>
                <Tip delay={1000} tip={`Priority Score: ${score}/100 — composite of pipeline value, engagement recency, win probability, on-net presence, ARR size, and risk level.`} style={{ borderBottom: 'none' }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '9px', fontWeight: 700, color: score >= 70 ? T.red : score >= 40 ? T.orange : T.green }}>{score}</span>
                </Tip>
                <Tip delay={1000} tip={`Risk Level: ${acc.risk_level} — based on churn signals, engagement gaps, loss history, and pipeline health.`} style={{ borderBottom: 'none' }}>
                  <Badge color={riskColor}>{acc.risk_level?.toUpperCase()}</Badge>
                </Tip>
                {dealCount > 0 && (
                  <Tip delay={1000} tip={`${dealCount} active deal${dealCount > 1 ? 's' : ''} in pipeline totaling ${$k(acc.pipeline_mrr || 0)}/mo MRR. Click to view deal details.`} style={{ borderBottom: 'none' }}>
                    <Badge color={T.cyan}>{dealCount} DEAL{dealCount > 1 ? 'S' : ''}</Badge>
                  </Tip>
                )}
                {daysSilent !== null && daysSilent > 60 && (
                  <Tip delay={1000} tip={`Gone Dark: ${daysSilent} days since last engagement. Accounts silent for 60+ days have elevated churn risk and need immediate outreach.`} style={{ borderBottom: 'none' }}>
                    <Badge color={T.red}>{daysSilent}D DARK</Badge>
                  </Tip>
                )}
                {hasOpenNeed(acc) && (
                  <Tip delay={1000} tip="Open Need: last engagement ended with an unresolved request, quote, or demo — follow-up is required to keep the opportunity alive." style={{ borderBottom: 'none' }}>
                    <Badge color={T.orange}>OPEN NEED</Badge>
                  </Tip>
                )}
                {bestProb > 0.6 && (
                  <Tip delay={1000} tip={`High Win Probability: ${pc(bestProb)} — Bayesian model estimates strong likelihood of closing based on deal stage, historical win rates, and calibration data.`} style={{ borderBottom: 'none' }}>
                    <Badge color={T.green}>{pc(bestProb)} WIN</Badge>
                  </Tip>
                )}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim, lineHeight: 1.6 }}>
                {reasons.slice(0, 3).join(' · ')}
              </div>
            </div>

            {/* Metrics strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'center' }}>
              <div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 700, color: T.cyan }}>{$k(acc.arr)}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '7px', color: T.textDim }}>ARR</div>
              </div>
              <div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 700, color: T.green }}>{$k(acc.pipeline_mrr || 0)}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '7px', color: T.textDim }}>PIPE/MO</div>
              </div>
              <div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 700, color: bestProb > 0.6 ? T.green : bestProb > 0.3 ? T.yellow : T.textDim }}>
                  {bestProb > 0 ? pc(bestProb) : '—'}
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '7px', color: T.textDim }}>WIN %</div>
              </div>
              <div>
                {(() => {
                  const engColor = daysSilent === null ? T.textDim
                    : daysSilent <= 7 ? T.green
                    : daysSilent <= 25 ? T.yellow
                    : T.red
                  const engLabel = daysSilent === null ? '—'
                    : daysSilent <= 7 ? `${daysSilent}d`
                    : daysSilent <= 25 ? `${daysSilent}d`
                    : `${daysSilent}d`
                  return <>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 700, color: engColor }}>{engLabel}</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '7px', color: T.textDim }}>LAST ENG</div>
                  </>
                })()}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

### Overview.jsx

```jsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { T, FONT_MONO, STAGE_COLORS } from '../lib/constants'
import Stat from '../components/shared/Stat'
import Badge from '../components/shared/Badge'
import ProbBar from '../components/shared/ProbBar'
import Tip from '../components/shared/Tip'
import { chartTheme, $, $k, pc } from '../components/shared/ChartTheme'

export default function Overview({ a }) {
  const stages = ['Discover', 'Design', 'Propose', 'Negotiate']
  const stageC = STAGE_COLORS

  return (
    <div>
      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '16px' }}>
        <Stat label="TOTAL ARR" value={$(a.arr)} color={T.cyan} />
        <Stat label="PIPELINE" value={`${$k(a.pipeline_mrr)}/mo`} sub={`${a.pipeline_count} deals`} color={T.blue} />
        <Stat label="WIN RATE" value={pc(a.win_rate)} sub={`${a.won}W / ${a.lost}L`} color={a.win_rate > 0.7 ? T.green : T.yellow} />
        <Stat label="LOST MRR" value={$(a.lost_mrr)} sub={`${a.lost} deals`} color={T.red} />
        <Stat label="NRR" value={pc(a.nrr)} color={a.nrr >= 1 ? T.green : a.nrr >= 0.9 ? T.yellow : T.red} />
        <Stat label="RISK" value={`${a.risk_score}/100`} sub={a.risk_level} color={a.risk_score >= 50 ? T.red : a.risk_score >= 30 ? T.orange : T.green} />
      </div>

      {/* Pipeline + Risk */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: T.card, borderRadius: '8px', border: `1px solid ${T.border}`, padding: '14px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim, letterSpacing: '0.08em', marginBottom: '12px' }}>
            <Tip label="PIPELINE BY STAGE">PIPELINE BY STAGE</Tip>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '70px' }}>
            {stages.map((st) => {
              const d = a.pipeline_by_stage?.[st]
              const mx = Math.max(...Object.values(a.pipeline_by_stage || {}).map((x) => x.mrr), 1)
              const h = d ? Math.max(6, (d.mrr / mx) * 60) : 3
              return (
                <div key={st} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600, color: stageC[st] || T.textDim }}>
                    {d ? $k(d.mrr) : '$0'}
                  </div>
                  <div style={{ width: '100%', height: `${h}px`, borderRadius: '3px', background: d ? `${stageC[st] || T.textDim}35` : T.border }} />
                  <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim }}>
                    {st} {d ? `(${d.count})` : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ background: T.card, borderRadius: '8px', border: `1px solid ${a.risk_score >= 30 ? T.red + '30' : T.border}`, padding: '14px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: a.risk_score >= 30 ? T.red : T.textDim, letterSpacing: '0.08em', marginBottom: '10px' }}>
            <Tip label="RISK SIGNALS">RISK SIGNALS</Tip>
          </div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {[
              a.days_silent > 90 && `${a.days_silent}d silent`,
              a.lost > 2 && `${a.lost} losses`,
              a.disconnects > 0 && `${a.disconnects} disconnects`,
              a.downgrades > 0 && `↓$${a.downgrade_mrr}`,
              a.velocity === 'stalled' && 'Stalled velocity',
              a.reps > 10 && `${a.reps} reps (churn)`,
              a.nrr < 0.9 && `NRR ${pc(a.nrr)}`,
            ]
              .filter(Boolean)
              .map((r, i) => (
                <Badge key={i} color={T.red}>{r}</Badge>
              ))}
            {a.risk_score < 20 && (
              <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.green }}>✓ Account is healthy</span>
            )}
          </div>
        </div>
      </div>

      {/* Engagement Timeline */}
      {a.engagement && (
        <div style={{ background: T.card, borderRadius: '8px', border: `1px solid ${T.border}`, padding: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim, letterSpacing: '0.08em' }}>
              <Tip label="ENGAGEMENT TIMELINE">ENGAGEMENT TIMELINE</Tip>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '5px' }}>
                {Object.entries(a.engagement.byType).sort(([,a],[,b]) => b - a).slice(0, 5).map(([type, count]) => (
                  <span key={type} style={{
                    fontFamily: FONT_MONO, fontSize: '8px', padding: '2px 6px',
                    background: T.surface, borderRadius: '3px', color: T.textMid,
                  }}>
                    {type.toUpperCase()} {count}
                  </span>
                ))}
              </div>
              <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.cyan, fontWeight: 600 }}>
                {a.engagement.total} total · {a.engagement.contacts} contacts
              </span>
            </div>
          </div>

          {/* Monthly bar chart */}
          {a.engagement.timeline && a.engagement.timeline.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={a.engagement.timeline} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="month" tick={{ fontFamily: FONT_MONO, fontSize: 7, fill: T.textDim }} tickLine={false} axisLine={{ stroke: T.border }} />
                  <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} width={20} />
                  <Tooltip contentStyle={chartTheme.tooltip} />
                  <Bar dataKey="count" fill={T.purple} opacity={0.8} name="Engagements" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Rolling event timeline */}
          {a.engagement.events && a.engagement.events.length > 0 ? (
            <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {a.engagement.events.map((ev, i) => {
                const typeColors = { call: T.green, email: T.blue, meeting: T.purple, demo: T.pink, social: T.cyan, text: T.yellow, note: T.textDim, other: T.textDim }
                const color = typeColors[ev.t] || T.textDim
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '70px 60px 1fr',
                    gap: '8px', alignItems: 'center',
                    padding: '5px 8px', borderLeft: `2px solid ${color}`,
                    marginBottom: '1px', background: i % 2 === 0 ? T.surface : 'transparent',
                    borderRadius: '0 4px 4px 0',
                  }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>{ev.d}</span>
                    <span style={{
                      fontFamily: FONT_MONO, fontSize: '8px', fontWeight: 600,
                      color, textTransform: 'uppercase',
                    }}>{ev.t}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.s}
                      </div>
                      {ev.c && <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim }}>{ev.c}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim, textAlign: 'center', padding: '20px 0' }}>
              No event detail — rebuild engagement JSON to populate
            </div>
          )}
        </div>
      )}

      {/* Product Mix */}
      <div style={{ background: T.card, borderRadius: '8px', border: `1px solid ${T.border}`, padding: '14px' }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim, letterSpacing: '0.08em', marginBottom: '10px' }}>
          <Tip label="PRODUCT MIX">PRODUCT MIX</Tip>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {Object.entries(a.concentration).map(([p, d]) => (
            <div key={p} style={{ flex: 1, padding: '8px', background: T.surface, borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>{p}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '13px', fontWeight: 700, color: T.cyan }}>{$k(d.mrr)}/mo</div>
              <ProbBar value={d.pct} color={T.cyan} h={4} />
              <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, marginTop: '2px' }}>{pc(d.pct)} of revenue</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### Engagement.jsx

```jsx
import { useState, useMemo } from 'react'
import { T, FONT_MONO } from '../lib/constants'
import Badge from '../components/shared/Badge'
import { $, $k } from '../components/shared/ChartTheme'

const now = new Date()
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

function daysSince(dateStr) {
  if (!dateStr) return 999
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) {
    // Try MM/DD/YYYY
    const p = dateStr.split('/')
    if (p.length >= 3) {
      const parsed = new Date(p[2], p[0] - 1, p[1])
      if (!isNaN(parsed.getTime())) return Math.floor((now - parsed) / 86400000)
    }
    return 999
  }
  return Math.floor((now - d) / 86400000)
}

function engagedThisMonth(acc) {
  if (!acc.engagement?.timeline) return false
  return acc.engagement.timeline.some(t => t.month === thisMonth && t.count > 0)
}

function ytdEngagementCount(acc) {
  if (!acc.engagement?.timeline) return 0
  const yearPrefix = String(now.getFullYear())
  return acc.engagement.timeline
    .filter(t => t.month.startsWith(yearPrefix))
    .reduce((s, t) => s + t.count, 0)
}

function lastEngDate(acc) {
  return acc.engagement?.lastDate || ''
}

function hasActiveDeal(acc) {
  return (acc.active_deals || []).length > 0
}

function buildOutreachContext(acc) {
  const parts = []

  // Services
  const prods = acc.products || []
  if (prods.length > 0) parts.push(`Current services: ${prods.slice(0, 5).join(', ')}`)

  // Last engagement
  const lastEv = acc.engagement?.events?.[0]
  if (lastEv) {
    parts.push(`Last engagement: ${lastEv.d} — ${lastEv.t}${lastEv.s ? ': ' + lastEv.s : ''}`)
  }

  // Active deals
  const deals = acc.active_deals || []
  if (deals.length > 0) {
    const dealSummary = deals.map(d => `${d.product} (${d.stage}, ${$k(d.mrr)}/mo)`).join('; ')
    parts.push(`Active pipeline: ${dealSummary}`)
  }

  // Predictions context
  if (acc.pipeline_mrr > 0) parts.push(`Pipeline MRR: ${$k(acc.pipeline_mrr)}/mo`)

  // Risk
  if (acc.risk_score >= 30) parts.push(`Risk: ${acc.risk_level} (${acc.risk_score}/100)`)

  // Churn signals
  if (acc.disconnects > 0) parts.push(`Recent disconnects: ${acc.disconnects}`)
  if (acc.lost > 0) parts.push(`Deals lost: ${acc.lost}`)

  return parts.join('\n')
}

function draftEmail(acc) {
  const days = daysSince(lastEngDate(acc))
  const lastEv = acc.engagement?.events?.[0]
  const deals = acc.active_deals || []
  const prods = acc.products || []

  let subject = ''
  let body = ''

  if (deals.length > 0) {
    // Active deal follow-up
    const d = deals[0]
    subject = `Following up — ${d.product}`
    body = `Hi,\n\nI wanted to check in on the ${d.product} opportunity we've been discussing. `
    if (d.stage?.toLowerCase().includes('propose') || d.stage?.toLowerCase().includes('negotiate')) {
      body += `I know we're in the ${d.stage.toLowerCase()} phase and wanted to see if there are any questions or if you need anything from our side to move forward.`
    } else {
      body += `I'd love to find a time to discuss next steps and make sure we're aligned on the path forward.`
    }
  } else if (days > 60 && prods.length > 0) {
    // Re-engagement
    subject = `Checking in — ${acc.name}`
    body = `Hi,\n\nIt's been a while since we last connected and I wanted to check in. `
    if (acc.disconnects > 0) {
      body += `I noticed some changes to your services and would love to discuss how we can better support your needs going forward.`
    } else {
      body += `I'd like to make sure everything is running smoothly with your current ${prods[0]} service and discuss any upcoming needs.`
    }
  } else if (lastEv?.s) {
    // Follow up on last topic
    subject = `Re: ${lastEv.s.substring(0, 60)}`
    body = `Hi,\n\nFollowing up on our last conversation${lastEv.s ? ' regarding ' + lastEv.s.substring(0, 80) : ''}. `
    body += `I wanted to see if there's anything else you need or if we should schedule time to continue the discussion.`
  } else {
    subject = `Touching base — ${acc.name}`
    body = `Hi,\n\nI wanted to reach out and see how things are going. `
    body += `I'd love to schedule a quick call to discuss your current needs and how we can help.`
  }

  body += `\n\nLet me know what works best for your schedule.\n\nBest regards`

  return { subject, body }
}

const TAB_STYLE = (active, color) => ({
  padding: '5px 12px',
  fontFamily: FONT_MONO,
  fontSize: '9px',
  letterSpacing: '0.06em',
  cursor: 'pointer',
  border: `1px solid ${active ? color : T.border}`,
  borderRadius: '4px',
  background: active ? color + '18' : 'transparent',
  color: active ? color : T.textDim,
  fontWeight: active ? 700 : 400,
})

export default function Engagement({ accounts, onSelect }) {
  const [tab, setTab] = useState('engaged')
  const [draftAcc, setDraftAcc] = useState(null)

  const { engaged, notEngaged, priority } = useMemo(() => {
    const eng = []
    const notEng = []
    const pri = []

    for (const acc of accounts) {
      const isEngaged = engagedThisMonth(acc)
      if (isEngaged) eng.push(acc)
      else notEng.push(acc)
      if (hasActiveDeal(acc)) pri.push(acc)
    }

    // Sort not-engaged by days since last engagement (most stale first)
    notEng.sort((a, b) => daysSince(lastEngDate(b)) - daysSince(lastEngDate(a)))
    // Sort priority by pipeline MRR descending
    pri.sort((a, b) => (b.pipeline_mrr || 0) - (a.pipeline_mrr || 0))
    // Sort engaged by recency
    eng.sort((a, b) => daysSince(lastEngDate(a)) - daysSince(lastEngDate(b)))

    return { engaged: eng, notEngaged: notEng, priority: pri }
  }, [accounts])

  const currentList = tab === 'engaged' ? engaged : tab === 'not_engaged' ? notEngaged : priority

  const draft = draftAcc ? draftEmail(draftAcc) : null

  return (
    <div>
      {/* Header stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatBox label="TOTAL ACCOUNTS" value={accounts.length} color={T.purple} />
        <StatBox label="ENGAGED THIS MONTH" value={engaged.length} color={T.green} />
        <StatBox label="NOT ENGAGED" value={notEngaged.length} color={T.red} />
        <StatBox label="PRIORITY (ACTIVE DEALS)" value={priority.length} color={T.cyan} />
      </div>

      {/* Tab filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        <button style={TAB_STYLE(tab === 'engaged', T.green)} onClick={() => setTab('engaged')}>
          ENGAGED ({engaged.length})
        </button>
        <button style={TAB_STYLE(tab === 'not_engaged', T.red)} onClick={() => setTab('not_engaged')}>
          NOT ENGAGED ({notEngaged.length})
        </button>
        <button style={TAB_STYLE(tab === 'priority', T.cyan)} onClick={() => setTab('priority')}>
          PRIORITY ({priority.length})
        </button>
      </div>

      {/* Draft modal */}
      {draftAcc && draft && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setDraftAcc(null)}>
          <div
            style={{
              background: T.card, border: `1px solid ${T.border}`, borderRadius: '10px',
              padding: '20px', width: '560px', maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Draft Outreach — {draftAcc.name}</div>
              <button
                onClick={() => setDraftAcc(null)}
                style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            {/* Context */}
            <div style={{
              fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim,
              background: T.surface, borderRadius: '6px', padding: '10px', marginBottom: '12px',
              whiteSpace: 'pre-line', lineHeight: 1.6,
            }}>
              <div style={{ color: T.textMid, fontWeight: 600, marginBottom: '4px' }}>CONTEXT</div>
              {buildOutreachContext(draftAcc)}
            </div>

            {/* Subject */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, marginBottom: '3px' }}>SUBJECT</div>
              <input
                type="text"
                defaultValue={draft.subject}
                style={{
                  width: '100%', padding: '8px', fontFamily: FONT_MONO, fontSize: '11px',
                  background: T.surface, border: `1px solid ${T.border}`, borderRadius: '5px',
                  color: T.text, outline: 'none',
                }}
              />
            </div>

            {/* Body */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, marginBottom: '3px' }}>BODY</div>
              <textarea
                defaultValue={draft.body}
                rows={10}
                style={{
                  width: '100%', padding: '8px', fontFamily: FONT_MONO, fontSize: '11px',
                  background: T.surface, border: `1px solid ${T.border}`, borderRadius: '5px',
                  color: T.text, outline: 'none', resize: 'vertical', lineHeight: 1.6,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  // Copy to clipboard
                  const subject = document.querySelector('input[type="text"]')?.value || draft.subject
                  const body = document.querySelector('textarea')?.value || draft.body
                  navigator.clipboard?.writeText(`Subject: ${subject}\n\n${body}`)
                }}
                style={{
                  padding: '6px 16px', borderRadius: '5px', cursor: 'pointer',
                  fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600,
                  background: `${T.cyan}18`, border: `1px solid ${T.cyan}`, color: T.cyan,
                }}
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setDraftAcc(null)}
                style={{
                  padding: '6px 16px', borderRadius: '5px', cursor: 'pointer',
                  fontFamily: FONT_MONO, fontSize: '10px',
                  background: 'transparent', border: `1px solid ${T.border}`, color: T.textDim,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account list table */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 1fr 0.6fr 100px',
          gap: '4px', padding: '8px 12px',
          background: T.surface, borderBottom: `1px solid ${T.border}`,
          fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, letterSpacing: '0.06em',
        }}>
          <div>ACCOUNT</div>
          <div style={{ textAlign: 'right' }}>ARR</div>
          <div style={{ textAlign: 'right' }}>PIPELINE</div>
          <div style={{ textAlign: 'right' }}>YTD ACTIVITY</div>
          <div>LAST ENGAGEMENT</div>
          <div>STATUS</div>
          <div></div>
        </div>

        {/* Rows */}
        <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          {currentList.length === 0 && (
            <div style={{ padding: '30px', textAlign: 'center', fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim }}>
              No accounts in this category
            </div>
          )}
          {currentList.map((acc, i) => {
            const days = daysSince(lastEngDate(acc))
            const dayColor = days <= 7 ? T.green : days <= 25 ? T.yellow : T.red
            const ytd = ytdEngagementCount(acc)
            const accIdx = accounts.findIndex(a => a.name === acc.name)
            const lastEv = acc.engagement?.events?.[0]

            return (
              <div
                key={acc.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 1fr 0.6fr 100px',
                  gap: '4px', padding: '8px 12px',
                  borderBottom: `1px solid ${T.border}`,
                  fontSize: '11px',
                  background: i % 2 === 0 ? 'transparent' : T.surface + '40',
                  alignItems: 'center',
                }}
              >
                {/* Account name */}
                <div>
                  <span
                    style={{ fontWeight: 600, cursor: 'pointer', borderBottom: `1px solid transparent` }}
                    onClick={() => onSelect(accIdx >= 0 ? accIdx : 0)}
                    onMouseEnter={e => e.currentTarget.style.color = T.cyan}
                    onMouseLeave={e => e.currentTarget.style.color = T.text}
                  >
                    {acc.name}
                  </span>
                  {hasActiveDeal(acc) && (
                    <Badge color={T.cyan} size="sm" style={{ marginLeft: '6px' }}>
                      {acc.active_deals.length} DEAL{acc.active_deals.length > 1 ? 'S' : ''}
                    </Badge>
                  )}
                </div>

                {/* ARR */}
                <div style={{ textAlign: 'right', fontFamily: FONT_MONO, fontSize: '10px', color: T.cyan }}>
                  {$(acc.arr)}
                </div>

                {/* Pipeline */}
                <div style={{ textAlign: 'right', fontFamily: FONT_MONO, fontSize: '10px', color: acc.pipeline_mrr > 0 ? T.purple : T.textDim }}>
                  {acc.pipeline_mrr > 0 ? `${$k(acc.pipeline_mrr)}/mo` : '---'}
                </div>

                {/* YTD activity count */}
                <div style={{ textAlign: 'right', fontFamily: FONT_MONO, fontSize: '10px', color: ytd > 10 ? T.green : ytd > 3 ? T.yellow : T.red }}>
                  {ytd > 0 ? ytd : '0'}
                </div>

                {/* Last engagement */}
                <div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: dayColor }}>
                    {lastEngDate(acc) || 'Never'}
                    {days < 999 && <span style={{ color: T.textDim, marginLeft: '4px' }}>({days}d)</span>}
                  </div>
                  {lastEv?.s && (
                    <div style={{ fontSize: '9px', color: T.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                      {lastEv.s}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div>
                  <Badge color={dayColor} size="sm">
                    {days <= 7 ? 'ACTIVE' : days <= 25 ? 'WARM' : days <= 90 ? 'COLD' : 'DARK'}
                  </Badge>
                </div>

                {/* Draft outreach button */}
                <div>
                  <button
                    onClick={() => setDraftAcc(acc)}
                    style={{
                      padding: '3px 8px', borderRadius: '4px', cursor: 'pointer',
                      fontFamily: FONT_MONO, fontSize: '8px', fontWeight: 600,
                      background: `${T.purple}15`, border: `1px solid ${T.purple}50`, color: T.purple,
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${T.purple}30`; e.currentTarget.style.borderColor = T.purple }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${T.purple}15`; e.currentTarget.style.borderColor = `${T.purple}50` }}
                  >
                    Draft Outreach
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px',
      padding: '12px 14px', textAlign: 'center',
    }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, letterSpacing: '0.08em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '20px', fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  )
}
```

### Locations.jsx

```jsx
import { useState, useEffect, useRef } from 'react'
import { T, FONT_MONO, STATUS_COLORS, STATUS_LABELS } from '../lib/constants'
import Stat from '../components/shared/Stat'
import Badge from '../components/shared/Badge'
import Tip from '../components/shared/Tip'
import { $, $k } from '../components/shared/ChartTheme'

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

const FILTERS = ['all', 'on-net', 'near-net', 'off-net']

export default function Locations({ a }) {
  const [selLoc, setSelLoc] = useState(null)
  const [filter, setFilter] = useState('all')
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const highlightRef = useRef(null)

  const allLocs = a.locations || []
  const locs = filter === 'all' ? allLocs : allLocs.filter(l => l.status === filter)
  const onNet = allLocs.filter(l => l.status === 'on-net')
  const nearNet = allLocs.filter(l => l.status === 'near-net')
  const offNet = allLocs.filter(l => l.status === 'off-net')
  const totalLocMRR = allLocs.reduce((s, l) => s + (l.mrr || 0), 0)

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    const L = window.L
    if (!L) return

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([39.0, -98.0], 4)

    L.tileLayer(TILE_URL, {
      attribution: '&copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markersRef.current = []
      highlightRef.current = null
    }
  }, [a.id || a.name])

  // Update markers when filter or data changes
  useEffect(() => {
    const map = mapInstanceRef.current
    const L = window.L
    if (!map || !L) return

    // Clear old markers
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []
    if (highlightRef.current) { map.removeLayer(highlightRef.current); highlightRef.current = null }

    const validLocs = locs.filter(l => l.lat && l.lng)

    validLocs.forEach((loc, i) => {
      const color = STATUS_COLORS[loc.status] || T.textDim
      const radius = loc.mrr > 0 ? Math.min(5 + Math.log10(loc.mrr + 1) * 2, 12) : 4

      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius,
        fillColor: color,
        color: color,
        weight: 1.5,
        opacity: 0.85,
        fillOpacity: 0.5,
      }).addTo(map)

      marker.bindTooltip(
        `<div style="font-family:${FONT_MONO};font-size:11px;font-weight:600">${loc.name}</div>
         <div style="font-family:${FONT_MONO};font-size:9px;color:#8B949E">${loc.type} &middot; ${STATUS_LABELS[loc.status] || loc.status}</div>
         ${loc.address ? `<div style="font-family:${FONT_MONO};font-size:8px;color:#6E7681">${loc.address}</div>` : ''}
         ${loc.mrr > 0 ? `<div style="font-family:${FONT_MONO};font-size:10px;color:${T.cyan};font-weight:700">${$k(loc.mrr)}/mo</div>` : ''}`,
        { className: 'revos-tooltip', direction: 'top', offset: [0, -8] }
      )

      // Find matching index in allLocs for selection
      const allIdx = allLocs.indexOf(loc)
      marker.on('click', () => {
        setSelLoc(allIdx)
        setFilter('all') // show all when clicking on map
      })
      markersRef.current.push(marker)
    })

    // Fit bounds
    if (validLocs.length > 0) {
      const bounds = L.latLngBounds(validLocs.map(l => [l.lat, l.lng]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
    }
  }, [filter, a.id || a.name, locs.length])

  // Highlight selected location
  useEffect(() => {
    const map = mapInstanceRef.current
    const L = window.L
    if (!map || !L) return

    if (highlightRef.current) {
      map.removeLayer(highlightRef.current)
      highlightRef.current = null
    }

    if (selLoc !== null && allLocs[selLoc]) {
      const loc = allLocs[selLoc]
      if (loc.lat && loc.lng) {
        const color = STATUS_COLORS[loc.status] || T.cyan
        highlightRef.current = L.circleMarker([loc.lat, loc.lng], {
          radius: 18,
          fillColor: color,
          color: '#ffffff',
          weight: 3,
          opacity: 1,
          fillOpacity: 0.3,
        }).addTo(map)

        map.setView([loc.lat, loc.lng], Math.max(map.getZoom(), 10), { animate: true })
      }
    }
  }, [selLoc])

  const sel = selLoc !== null ? allLocs[selLoc] : null

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '14px' }}>
        <Stat label="TOTAL LOCATIONS" value={allLocs.length} color={T.cyan} />
        <Stat label="LOCATION MRR" value={`${$(totalLocMRR)}/mo`} color={T.cyan} />
        <Stat label="ON-NET" value={onNet.length} sub={`${$(onNet.reduce((s, l) => s + (l.mrr || 0), 0))}/mo`} color={T.green} />
        <Stat label="NEAR-NET" value={nearNet.length} sub={`${$(nearNet.reduce((s, l) => s + (l.mrr || 0), 0))}/mo`} color={T.yellow} />
        <Stat label="OFF-NET" value={offNet.length} sub={`${$(offNet.reduce((s, l) => s + (l.mrr || 0), 0))}/mo`} color={T.red} />
      </div>

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setSelLoc(null) }}
            style={{
              background: filter === f ? (f === 'all' ? T.cyan : STATUS_COLORS[f] || T.cyan) + '20' : T.card,
              border: `1px solid ${filter === f ? (f === 'all' ? T.cyan : STATUS_COLORS[f] || T.cyan) : T.border}`,
              borderRadius: '6px',
              padding: '5px 14px',
              fontFamily: FONT_MONO,
              fontSize: '10px',
              fontWeight: filter === f ? 700 : 500,
              color: filter === f ? (f === 'all' ? T.cyan : STATUS_COLORS[f] || T.cyan) : T.textDim,
              cursor: 'pointer',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {f === 'all' ? `ALL (${allLocs.length})` : `${STATUS_LABELS[f]} (${allLocs.filter(l => l.status === f).length})`}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '12px' }}>
        {/* Map */}
        <div style={{ background: T.card, borderRadius: '10px', border: `1px solid ${T.border}`, padding: '16px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim, letterSpacing: '0.08em', marginBottom: '10px' }}>
            <Tip label="LOCATION MAP">LOCATION MAP</Tip> — {locs.filter(l => l.lat && l.lng).length} MAPPED
          </div>
          <div ref={mapRef} style={{ height: '480px', borderRadius: '8px', border: `1px solid ${T.border}` }} />
        </div>

        {/* Location list + detail panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '560px' }}>
          {/* Detail panel (shown when a location is selected) */}
          {sel && (
            <div style={{
              background: T.card, borderRadius: '8px', border: `1px solid ${STATUS_COLORS[sel.status]}50`,
              padding: '14px', borderLeft: `4px solid ${STATUS_COLORS[sel.status]}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '13px' }}>{sel.name}</span>
                <Badge color={STATUS_COLORS[sel.status]}>{STATUS_LABELS[sel.status]}</Badge>
              </div>
              {sel.address && (
                <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textMid, marginBottom: '6px' }}>
                  {sel.address}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px' }}>
                <div style={{ background: T.surface, borderRadius: '4px', padding: '8px' }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, letterSpacing: '0.06em' }}><Tip label="TYPE">TYPE</Tip></div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 600, marginTop: '2px' }}>{sel.type}</div>
                </div>
                <div style={{ background: T.surface, borderRadius: '4px', padding: '8px' }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, letterSpacing: '0.06em' }}><Tip label="MRR">MRR</Tip></div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 700, color: T.cyan, marginTop: '2px' }}>
                    {sel.mrr > 0 ? `${$(sel.mrr)}/mo` : '—'}
                  </div>
                </div>
                {sel.market && (
                  <div style={{ background: T.surface, borderRadius: '4px', padding: '8px' }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, letterSpacing: '0.06em' }}><Tip label="MARKET">MARKET</Tip></div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 600, marginTop: '2px' }}>{sel.market}</div>
                  </div>
                )}
                {sel.classification && (
                  <div style={{ background: T.surface, borderRadius: '4px', padding: '8px' }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, letterSpacing: '0.06em' }}><Tip label="CLASS">CLASS</Tip></div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 600, marginTop: '2px' }}>{sel.classification}</div>
                  </div>
                )}
                {sel.feet_from_network > 0 && (
                  <div style={{ background: T.surface, borderRadius: '4px', padding: '8px', gridColumn: 'span 2' }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, letterSpacing: '0.06em' }}><Tip label="DISTANCE FROM NETWORK">DISTANCE FROM NETWORK</Tip></div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 600, marginTop: '2px' }}>
                      {sel.feet_from_network.toLocaleString()} ft
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelLoc(null)}
                style={{
                  marginTop: '8px', width: '100%', background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: '4px', padding: '4px', fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim,
                  cursor: 'pointer', letterSpacing: '0.06em',
                }}
              >CLOSE</button>
            </div>
          )}

          {/* Location card list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim, letterSpacing: '0.08em', marginBottom: '8px' }}>
              {locs.length} LOCATIONS
            </div>
            {locs.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim }}>
                No locations found
              </div>
            )}
            {locs.map((l, i) => {
              const allIdx = allLocs.indexOf(l)
              const isSel = selLoc === allIdx
              const c = STATUS_COLORS[l.status] || T.textDim
              return (
                <div
                  key={i}
                  onClick={() => setSelLoc(isSel ? null : allIdx)}
                  style={{
                    background: isSel ? T.cardHover : T.card,
                    border: `1px solid ${isSel ? c + '60' : T.border}`,
                    borderRadius: '6px',
                    padding: '10px',
                    marginBottom: '5px',
                    cursor: 'pointer',
                    borderLeft: `3px solid ${c}`,
                    transition: 'all 0.15s',
                    boxShadow: isSel ? `0 0 8px ${c}30` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.name}
                    </span>
                    <Badge color={c} size="sm">{STATUS_LABELS[l.status]}</Badge>
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>
                    {l.type}
                    {l.market ? ` · ${l.market}` : ''}
                  </div>
                  {l.mrr > 0 && (
                    <div style={{ fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 700, color: T.cyan, marginTop: '2px' }}>
                      {$k(l.mrr)}/mo
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`
        .revos-tooltip {
          background: ${T.card} !important;
          border: 1px solid ${T.border} !important;
          border-radius: 6px !important;
          padding: 6px 10px !important;
          color: ${T.text} !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
        }
        .revos-tooltip::before { border-top-color: ${T.border} !important; }
        .leaflet-control-zoom a {
          background: ${T.card} !important;
          color: ${T.text} !important;
          border-color: ${T.border} !important;
        }
      `}</style>
    </div>
  )
}
```

### Predictions.jsx

```jsx
import { T, FONT_MONO } from '../lib/constants'
import Badge from '../components/shared/Badge'
import ProbBar from '../components/shared/ProbBar'
import Stat from '../components/shared/Stat'
import Tip from '../components/shared/Tip'
import { $, $k, pc } from '../components/shared/ChartTheme'

export default function Predictions({ a }) {
  // Generate local predictions from account data, calibrated by backtest
  const cal = a.calibration || { winLR: 1, churnLR: 1, quarters: 0, avgAccuracy: 0, bias: 'uncalibrated' }
  const predictions = a.predictions?.length > 0 ? a.predictions : buildLocalPredictions(a, cal)
  const crossSell = a.cross_sell?.length > 0 ? a.cross_sell : []
  const churnPreds = a.churn_preds?.length > 0 ? a.churn_preds : buildChurnPredictions(a, cal)

  return (
    <div>
      {/* Summary banner */}
      <div style={{ background: `linear-gradient(135deg, ${T.teal}08, ${T.blue}08)`, border: `1px solid ${T.teal}25`, borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.teal, letterSpacing: '0.08em' }}><Tip label="PREDICTION SUMMARY">PREDICTION SUMMARY</Tip></div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <Badge color={a.portfolio_health === 'growing' ? T.green : a.portfolio_health === 'at_risk' ? T.red : T.yellow}>
              {(a.portfolio_health || 'unknown').toUpperCase().replace('_', ' ')}
            </Badge>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          <Stat small label="WIN RATE" value={pc(a.win_rate)} color={a.win_rate >= 0.5 ? T.green : T.yellow} />
          <Stat small label="PIPELINE" value={`${$k(a.pipeline_mrr)}/mo`} sub={`${a.pipeline_count} deals`} color={T.blue} />
          <Stat small label="HISTORICAL WINS" value={a.won} color={T.green} />
          <Stat small label="CHURN EVENTS" value={a.churn_deals || 0} sub={a.churn_mrr ? `-${$(a.churn_mrr)}/mo` : ''} color={a.churn_deals > 0 ? T.red : T.green} />
        </div>
      </div>

      {/* Calibration status */}
      {cal.quarters >= 3 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px', marginBottom: '14px', borderRadius: '8px',
          background: cal.avgAccuracy >= 60 ? `${T.green}08` : `${T.yellow}08`,
          border: `1px solid ${cal.avgAccuracy >= 60 ? T.green : T.yellow}22`,
        }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: cal.avgAccuracy >= 60 ? T.green : T.yellow, letterSpacing: '0.08em', flexShrink: 0 }}>
            <Tip label="CALIBRATION STATUS">CALIBRATED</Tip>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textMid, flex: 1 }}>
            Model tuned from {cal.quarters} quarters of backtest data · {cal.avgAccuracy}% avg accuracy
            {cal.bias !== 'balanced' && <> · Correcting {cal.bias} bias</>}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <Badge color={T.teal}>Win LR ×{cal.winLR.toFixed(2)}</Badge>
            <Badge color={T.orange}>Churn LR ×{cal.churnLR.toFixed(2)}</Badge>
          </div>
        </div>
      )}

      {/* Pipeline predictions */}
      {predictions.length > 0 && (
        <>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.teal, letterSpacing: '0.08em', marginBottom: '10px' }}>
            <Tip label="DEAL PREDICTIONS">DEAL PREDICTIONS</Tip> ({predictions.length})
          </div>
          {predictions.map((p, i) => {
            const prob = p.posterior || p.prob || 0
            const color = prob > 0.6 ? T.green : prob > 0.35 ? T.yellow : T.orange
            return (
              <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', padding: '14px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{p.product}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim, marginLeft: '8px' }}>{p.event || p.stage}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {p.prior != null && <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}>Base: {pc(p.prior)}</span>}
                    <span style={{ fontFamily: FONT_MONO, fontSize: '16px', fontWeight: 700, color }}>{pc(prob)}</span>
                  </div>
                </div>
                <ProbBar value={prob} color={color} h={6} />
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px', fontFamily: FONT_MONO, fontSize: '10px' }}>
                  <span style={{ color: T.cyan }}>{$(p.mrr)}/mo</span>
                  {p.close && <span style={{ color: T.yellow }}>Close: {p.close}</span>}
                  {p.rep && <span style={{ color: T.textDim }}>{p.rep}</span>}
                </div>
                {p.evidence && (
                  <div style={{ marginTop: '8px' }}>
                    {p.evidence.map((e, j) => (
                      <div key={j} style={{ fontSize: '11px', color: T.textMid, paddingLeft: '8px', borderLeft: `2px solid ${color}30`, marginBottom: '3px' }}>
                        {e}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* Churn risk */}
      {churnPreds.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.red}18`, borderRadius: '8px', padding: '14px', marginTop: '14px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.red, letterSpacing: '0.08em', marginBottom: '10px' }}>
            <Tip label="CHURN RISK INDICATORS">CHURN RISK INDICATORS</Tip>
          </div>
          {churnPreds.map((ch, i) => (
            <div key={i} style={{ marginBottom: '10px', padding: '8px', background: T.surface, borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '12px' }}>{ch.signal}</span>
                <Badge color={ch.severity === 'high' ? T.red : ch.severity === 'medium' ? T.orange : T.yellow}>
                  {ch.severity.toUpperCase()}
                </Badge>
              </div>
              <div style={{ fontSize: '11px', color: T.textMid, lineHeight: 1.5 }}>{ch.detail}</div>
            </div>
          ))}
        </div>
      )}

      {predictions.length === 0 && churnPreds.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: T.textDim }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '11px' }}>No pipeline deals to predict on. Add deals to funnel.csv.</div>
        </div>
      )}
    </div>
  )
}

// --- Bayesian Prediction Engine ---
// Uses engagement data as likelihood signals to update prior win/churn probabilities.
//
// P(win|evidence) = P(evidence|win) * P(win) / P(evidence)
// We compute log-odds for numerical stability, then convert back to probability.

function logOdds(p) { return Math.log(p / (1 - p)) }
function fromLogOdds(lo) { return 1 / (1 + Math.exp(-lo)) }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function engagementSignals(a) {
  const eng = a.engagement
  if (!eng) return { score: 0, recency: 0, intensity: 0, breadth: 0, factors: [] }

  const factors = []

  // Recency: how recently was the account engaged?
  let recency = 0
  if (eng.lastDate) {
    const [y, m] = eng.lastDate.split('-').map(Number)
    const lastMs = new Date(y, m - 1).getTime()
    const daysSince = Math.max(0, (Date.now() - lastMs) / 86400000)
    if (daysSince < 30) { recency = 1.0; factors.push('Engaged in last 30 days') }
    else if (daysSince < 60) { recency = 0.7; factors.push('Engaged in last 60 days') }
    else if (daysSince < 90) { recency = 0.4; factors.push('Last engagement 60-90 days ago') }
    else { recency = 0.1; factors.push(`No engagement in ${Math.round(daysSince)} days`) }
  }

  // Intensity: engagement volume relative to expectations
  const monthCount = eng.timeline?.length || 1
  const avgPerMonth = eng.total / monthCount
  let intensity = 0
  if (avgPerMonth >= 8) { intensity = 1.0; factors.push(`High activity: ${avgPerMonth.toFixed(1)} eng/mo`) }
  else if (avgPerMonth >= 4) { intensity = 0.7; factors.push(`Moderate activity: ${avgPerMonth.toFixed(1)} eng/mo`) }
  else if (avgPerMonth >= 1) { intensity = 0.4; factors.push(`Low activity: ${avgPerMonth.toFixed(1)} eng/mo`) }
  else { intensity = 0.1; factors.push('Minimal engagement activity') }

  // Breadth: multi-threading (# of contacts engaged)
  let breadth = 0
  if (eng.contacts >= 5) { breadth = 1.0; factors.push(`Multi-threaded: ${eng.contacts} contacts`) }
  else if (eng.contacts >= 3) { breadth = 0.7; factors.push(`${eng.contacts} contacts engaged`) }
  else if (eng.contacts >= 1) { breadth = 0.4; factors.push(`Single-threaded: ${eng.contacts} contact`) }
  else { breadth = 0; factors.push('No contacts engaged') }

  // Channel mix: meetings are highest signal
  const meetings = (eng.byType?.meeting || 0) + (eng.byType?.demo || 0)
  if (meetings >= 3) factors.push(`${meetings} meetings/demos — strong buying signal`)
  else if (meetings === 0 && eng.total > 5) factors.push('No meetings despite activity — surface-level engagement')

  // Trend: is engagement increasing or decreasing?
  if (eng.timeline && eng.timeline.length >= 3) {
    const recent = eng.timeline.slice(-2).reduce((s, t) => s + t.count, 0)
    const earlier = eng.timeline.slice(-4, -2).reduce((s, t) => s + t.count, 0)
    if (recent > earlier * 1.5) factors.push('Engagement trending UP')
    else if (recent < earlier * 0.5) factors.push('Engagement trending DOWN')
  }

  const score = recency * 0.35 + intensity * 0.3 + breadth * 0.2 + (meetings > 0 ? 0.15 : 0)

  return { score, recency, intensity, breadth, factors }
}

function buildLocalPredictions(a, cal = { winLR: 1 }) {
  if (!a.active_deals?.length) return []

  const prior = clamp(a.win_rate || 0.5, 0.05, 0.95)
  const eng = engagementSignals(a)
  const calAdj = cal.winLR || 1

  return a.active_deals.map(d => {
    // Stage likelihood ratio (how much stage shifts odds)
    let stageLR = 1.0
    const stage = (d.stage || '').toLowerCase()
    if (stage.includes('negotiate') || stage.includes('4')) stageLR = 3.0
    else if (stage.includes('propose') || stage.includes('3')) stageLR = 1.8
    else if (stage.includes('design') || stage.includes('2')) stageLR = 1.2
    else if (stage.includes('discover') || stage.includes('1')) stageLR = 0.6

    // Apply backtest calibration to stage LR
    stageLR *= calAdj

    // Engagement likelihood ratio
    // High engagement → 2x odds of winning; no engagement → 0.5x odds
    const engLR = 0.5 + eng.score * 1.5

    // Account health likelihood ratio
    let healthLR = 1.0
    if (a.nrr >= 1.05) healthLR = 1.3  // growing account
    else if (a.nrr < 0.9) healthLR = 0.6  // contracting
    if (a.churn_deals > 2) healthLR *= 0.7  // history of churn

    // Bayesian update: log-odds form
    const priorLO = logOdds(prior)
    const posteriorLO = priorLO + Math.log(stageLR) + Math.log(engLR) + Math.log(healthLR)
    const posterior = clamp(fromLogOdds(posteriorLO), 0.02, 0.98)

    const evidence = []
    evidence.push(`Prior win rate: ${pc(prior)} → Stage (${d.stage}): ${stageLR > 1 ? '+' : ''}${((stageLR - 1) * 100).toFixed(0)}%`)
    evidence.push(`Engagement signal: ${(eng.score * 100).toFixed(0)}/100 → LR ${engLR.toFixed(2)}x`)
    if (healthLR !== 1.0) evidence.push(`Account health: NRR ${pc(a.nrr)} → LR ${healthLR.toFixed(2)}x`)
    if (calAdj !== 1) evidence.push(`Backtest calibration: ×${calAdj.toFixed(2)} adjustment`)
    evidence.push(...eng.factors.slice(0, 3))

    return {
      product: d.product || 'Unknown',
      event: d.stage,
      stage: d.stage,
      prior,
      posterior,
      mrr: d.mrr,
      close: d.close,
      rep: d.rep,
      evidence,
    }
  }).sort((a, b) => b.posterior - a.posterior)
}

function buildChurnPredictions(a, cal = { churnLR: 1 }) {
  const signals = []
  const eng = engagementSignals(a)
  const calAdj = cal.churnLR || 1

  // Bayesian churn: P(churn) based on multiple independent signals
  let basePChurn = 0.15  // base churn rate
  const churnFactors = []

  // Historical churn pattern
  if (a.churn_deals > 0) {
    const lr = (1 + a.churn_deals * 0.8) * calAdj  // apply calibration
    basePChurn = fromLogOdds(logOdds(clamp(basePChurn, 0.01, 0.99)) + Math.log(lr))
    signals.push({
      signal: 'Historical Churn Pattern',
      severity: a.churn_deals >= 3 ? 'high' : 'medium',
      detail: `${a.churn_deals} negative re-rate events totaling -${$(a.churn_mrr || 0)}/mo. LR: ${lr.toFixed(1)}x churn odds.`,
    })
  }

  // Engagement-based churn signal
  if (a.engagement) {
    if (eng.recency <= 0.1) {
      basePChurn = fromLogOdds(logOdds(clamp(basePChurn, 0.01, 0.99)) + Math.log(2.5 * calAdj))
      signals.push({
        signal: 'Engagement Dark — No Recent Contact',
        severity: 'high',
        detail: `Account has gone dark. Last engagement: ${a.engagement.lastDate || 'unknown'}. Silent accounts churn at 2.5x the base rate.`,
      })
    } else if (eng.score < 0.3) {
      basePChurn = fromLogOdds(logOdds(clamp(basePChurn, 0.01, 0.99)) + Math.log(1.5))
      signals.push({
        signal: 'Low Engagement Score',
        severity: 'medium',
        detail: `Engagement score: ${(eng.score * 100).toFixed(0)}/100. Below threshold for healthy retention.`,
      })
    } else if (eng.score >= 0.7) {
      basePChurn = fromLogOdds(logOdds(clamp(basePChurn, 0.01, 0.99)) + Math.log(0.4))
      signals.push({
        signal: 'Strong Engagement — Low Churn Risk',
        severity: 'low',
        detail: `Engagement score: ${(eng.score * 100).toFixed(0)}/100. Active accounts churn at 0.4x the base rate.`,
      })
    }

    // Engagement trend
    if (eng.factors.some(f => f.includes('trending DOWN'))) {
      basePChurn = fromLogOdds(logOdds(clamp(basePChurn, 0.01, 0.99)) + Math.log(1.6))
      signals.push({
        signal: 'Declining Engagement Trend',
        severity: 'medium',
        detail: 'Recent engagement volume is dropping. Declining engagement precedes churn in 60%+ of cases.',
      })
    }

    // Single-threaded risk
    if (eng.breadth < 0.4 && a.engagement.contacts <= 1) {
      signals.push({
        signal: 'Single-Threaded Relationship',
        severity: 'medium',
        detail: `Only ${a.engagement.contacts} contact engaged. Champion departure risk is high.`,
      })
    }
  }

  // Service disconnects
  if (a.disconnects > 0) {
    const lr = (1 + a.disconnects * 0.6) * calAdj
    basePChurn = fromLogOdds(logOdds(clamp(basePChurn, 0.01, 0.99)) + Math.log(lr))
    signals.push({
      signal: 'Service Disconnects',
      severity: a.disconnects >= 2 ? 'high' : 'medium',
      detail: `${a.disconnects} disconnects. Direct revenue loss signal. LR: ${lr.toFixed(1)}x.`,
    })
  }

  // NRR
  if (a.nrr < 0.9) {
    signals.push({
      signal: 'Low Net Revenue Retention',
      severity: 'high',
      detail: `NRR at ${pc(a.nrr)} — account is contracting. Revenue losses exceed expansion.`,
    })
  }

  // Stalled velocity
  if (a.velocity === 'stalled') {
    signals.push({
      signal: 'Stalled Deal Velocity',
      severity: 'medium',
      detail: 'No pipeline momentum. No new deals progressing through stages.',
    })
  }

  // Add overall churn probability to first signal
  if (signals.length > 0) {
    const overallChurn = clamp(basePChurn, 0, 1)
    signals.unshift({
      signal: `Overall Churn Probability: ${pc(overallChurn)}`,
      severity: overallChurn > 0.5 ? 'high' : overallChurn > 0.3 ? 'medium' : 'low',
      detail: `Bayesian posterior from ${signals.length} risk signals. Base rate: 15%.${calAdj !== 1 ? ` Calibrated ×${calAdj.toFixed(2)} from backtest.` : ''} ${a.engagement ? `Engagement score: ${(eng.score * 100).toFixed(0)}/100.` : 'No engagement data available.'}`,
    })
  }

  return signals
}
```
