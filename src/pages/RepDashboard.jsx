import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, Area, ReferenceLine,
} from 'recharts'
import { T, FONT_MONO, FONT_SANS, RADIUS, CARD_SHADOW, STAGE_COLORS, STAGE_WIN_PROB, STAGE_ORDER, stageProb } from '../lib/constants'
import Badge from '../components/shared/Badge'
import Stat from '../components/shared/Stat'
import ProbBar from '../components/shared/ProbBar'
import Tip from '../components/shared/Tip'
import { chartTheme, $, $k, pc } from '../components/shared/ChartTheme'

// --- Helpers ---

function parseDate(s) {
  if (!s) return null
  let d = new Date(s)
  if (!isNaN(d.getTime())) return d
  const p = String(s).split('/')
  if (p.length >= 3) {
    d = new Date(p[2], p[0] - 1, p[1])
    if (!isNaN(d.getTime())) return d
  }
  return null
}

function normalizeStage(s) {
  if (!s) return ''
  const l = s.toLowerCase().trim()
  if (l.includes('accepted') || l === '5 - accepted' || l === 'closed-won' || l === 'closed won') return 'closed won'
  if (l.includes('closed lost') || l === 'close lost') return 'closed lost'
  return s
}

function normalizeForecast(f) {
  if (!f) return 'Not In Forecast'
  const l = f.toLowerCase().trim()
  if (l === 'closed' || l === 'closed won') return 'Closed'
  if (l === 'commit') return 'Commit'
  if (l === 'best case') return 'Best Case'
  if (l === 'longshot') return 'Longshot'
  return 'Not In Forecast'
}

function isBooking(d) {
  if (normalizeForecast(d.forecast) !== 'Closed') return false
  if (d.major_project) return false // exclude major project deals
  return true
}

function daysSince(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return 999
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function paceColor(pct) {
  if (pct >= 1.0) return T.green
  if (pct >= 0.75) return T.yellow
  return T.red
}

function qLabel(d) {
  return `Q${Math.floor(d.getMonth() / 3) + 1}`
}

// --- Attainment Ring (SVG Donut) ---
function AttainmentRing({ value, quota, size = 140, label }) {
  const pct = quota > 0 ? Math.min(value / quota, 1.5) : 0
  const displayPct = quota > 0 ? value / quota : 0
  const r = (size - 16) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - Math.min(pct, 1))
  const color = paceColor(displayPct)

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.border} strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: '22px', fontWeight: 700, color }}>{pc(displayPct)}</div>
        <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim }}>{label}</div>
      </div>
    </div>
  )
}

// --- Pace Bar ---
function PaceBar({ actual, expected, quota, periodMode, currentQ, currentMonthName }) {
  const pctActual = quota > 0 ? actual / quota : 0
  const pctExpected = quota > 0 ? expected / quota : 0
  const color = paceColor(pctExpected > 0 ? pctActual / pctExpected : 0)
  const paceRatio = pctExpected > 0 ? pctActual / pctExpected : 0

  return (
    <div style={{ background: T.surface, borderRadius: '6px', padding: '8px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <Tip label={`PACE TO QUOTA\n\nFormula: ${periodMode === 'month' ? 'MTD' : 'QTD'} Bookings ÷ Expected Bookings at this point in the ${periodMode === 'month' ? 'month' : 'quarter'}\n\nActual: ${$k(actual)}\nExpected: ${$k(expected)} (pro-rated based on day ${Math.floor((Date.now() - (periodMode === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1)).getTime()) / 86400000) + 1} of ${periodMode === 'month' ? 'month' : 'quarter'})\nQuota: ${$k(quota)}\n\nPace: ${(paceRatio * 100).toFixed(0)}% of expected\n\nThe white marker shows where you should be. The colored bar shows where you are.\n• Green: ≥100% of pace\n• Yellow: 75–99% of pace\n• Red: <75% of pace`}>
          <span style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim }}>Pace to Quota</span>
        </Tip>
        <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color }}>
          {$k(actual)} of {$k(expected)} expected
        </span>
      </div>
      <div style={{ position: 'relative', height: '6px', background: T.border, borderRadius: '3px' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '3px',
          width: `${Math.min(pctActual * 100, 100)}%`, background: color,
          transition: 'width 0.8s ease',
        }} />
        {/* Expected pace marker */}
        <div style={{
          position: 'absolute', top: '-2px', height: '10px', width: '2px', background: T.text,
          left: `${Math.min(pctExpected * 100, 100)}%`, borderRadius: '1px',
        }} />
      </div>
    </div>
  )
}

// --- Tab Button ---
function TabBtn({ active, label, color = T.cyan, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 16px', borderRadius: RADIUS, cursor: 'pointer',
      fontFamily: FONT_SANS, fontSize: '11px', fontWeight: active ? 600 : 400,
      border: 'none', background: active ? T.card : 'transparent',
      color: active ? T.text : T.textDim,
      boxShadow: active ? CARD_SHADOW : 'none', transition: 'all 0.15s',
    }}>
      {label}
    </button>
  )
}

// --- Filter Pill ---
function Pill({ active, label, count, color = T.cyan, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', borderRadius: '16px', cursor: 'pointer',
      fontFamily: FONT_SANS, fontSize: '9px', fontWeight: active ? 600 : 400,
      border: 'none', background: active ? `${color}15` : T.surface,
      boxShadow: active ? `0 0 0 1px ${color}30` : 'none',
      color: active ? color : T.textDim, transition: 'all 0.15s',
    }}>
      {label}{count != null ? ` (${count})` : ''}
    </button>
  )
}

// =======================================================================
// REP DASHBOARD
// =======================================================================

// ─── Signal text builder ─────────────────────────────────────────────────────
function buildSignalRows(accountSignals) {
  if (!accountSignals) return []
  const rows = []
  const p = accountSignals.prospecting || {}
  const g = accountSignals.growth || {}
  const r = accountSignals.retention || {}

  // Retention (most urgent)
  if (r.mtmServices?.count > 0)
    rows.push({ icon: '⏰', text: `${r.mtmServices.products.slice(0,2).join(', ')} MtM for ${r.mtmServices.maxMtmDays}d — $${r.mtmServices.mrrSum.toLocaleString()} MRR exposed`, cat: 'retention' })
  if (r.expiringServices?.count > 0)
    rows.push({ icon: '📅', text: `${r.expiringServices.products.slice(0,2).join(', ')} expires in ${r.expiringServices.soonestExpiryDays}d — $${r.expiringServices.mrrSum.toLocaleString()} MRR`, cat: 'retention' })
  if (r.openRenewalOpportunity && !r.openRenewalOpportunity.hasOpenRenewal && r.mrrAtRisk > 0)
    rows.push({ icon: '⚠', text: `$${r.mrrAtRisk.toLocaleString()} MRR at risk — no renewal opp logged`, cat: 'retention' })

  // Growth
  if (g.underservedLocations?.count > 0)
    rows.push({ icon: '🏢', text: `${g.underservedLocations.count} on-net locations with no active service`, cat: 'growth' })
  if (g.productRecommendation)
    rows.push({ icon: '💡', text: `Recommend ${g.productRecommendation.product} — ${Math.round(g.productRecommendation.winRate * 100)}% win rate in segment`, cat: 'growth' })
  if (g.similarWin)
    rows.push({ icon: '🔄', text: `Similar win: ${g.similarWin.product} at $${g.similarWin.mrr.toLocaleString()} — closed in ${g.similarWin.daysToClose}d`, cat: 'growth' })

  // Prospecting
  if (p.nearNetOpportunity?.count > 0)
    rows.push({ icon: '📍', text: `${p.nearNetOpportunity.count} near-net locations — ${p.nearNetOpportunity.cities.slice(0,2).join(', ')}`, cat: 'prospecting' })
  if (p.recentLoss)
    rows.push({ icon: '📉', text: `Lost ${p.recentLoss.product} ${p.recentLoss.daysAgo}d ago (${p.recentLoss.lossReason}) — $${p.recentLoss.mrr.toLocaleString()}`, cat: 'prospecting' })
  if (p.lastContact && p.lastContact.daysAgo > 60)
    rows.push({ icon: '📞', text: `No contact in ${p.lastContact.daysAgo}d — last was ${p.lastContact.activityType} with ${p.lastContact.contactName}`, cat: 'prospecting' })
  if (p.historicalPriceRange?.count > 0)
    rows.push({ icon: '💰', text: `Buys $${p.historicalPriceRange.min.toLocaleString()}–$${p.historicalPriceRange.max.toLocaleString()} MRR (${p.historicalPriceRange.count} deals)`, cat: 'prospecting' })

  // Renewal strategy
  if (r.renewalStrategy)
    rows.push({ icon: '🛡', text: r.renewalStrategy, cat: 'strategy' })

  return rows.slice(0, 5) // Cap at 5 most important
}

const CAT_COLORS = { retention: T.red, growth: T.green, prospecting: T.cyan, strategy: T.purple }

export default function RepDashboard({ accounts, rawData }) {
  const [tab, setTab] = useState('accounts')
  const [selectedRep, setSelectedRep] = useState('')
  const [showFilter, setShowFilter] = useState('all')
  const [sortBy, setSortBy] = useState('risk')
  const [userTarget, setUserTarget] = useState('')
  const [periodMode, setPeriodMode] = useState('quarter') // 'month' or 'quarter'
  const [accountSearch, setAccountSearch] = useState('')
  const [signalsData, setSignalsData] = useState(null)
  const [signalsAge, setSignalsAge] = useState(null)
  const [aiSignals, setAiSignals] = useState({}) // accountName -> [...aiSignalRows]
  const [aiLoading, setAiLoading] = useState({}) // accountName -> bool

  // Load signals JSON
  useEffect(() => {
    fetch('/local-data/file?name=revos-signals.json')
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(data => {
        if (data?.signals) {
          setSignalsData(data.signals)
          if (data.generatedAt) {
            const age = Math.round((Date.now() - new Date(data.generatedAt).getTime()) / 3600000)
            setSignalsAge(age < 1 ? 'just now' : age < 24 ? `${age}h ago` : `${Math.round(age / 24)}d ago`)
          }
        }
      })
  }, [])

  // AI refresh handler
  const refreshAI = useCallback(async (accountName, segment, signals) => {
    setAiLoading(prev => ({ ...prev, [accountName]: true }))
    try {
      const resp = await fetch('/api/engine/refresh-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName, segment, signals }),
      })
      const data = await resp.json()
      if (data.aiSignals?.length > 0) {
        setAiSignals(prev => ({ ...prev, [accountName]: data.aiSignals }))
      }
    } catch (e) {
      console.error('AI refresh failed:', e)
    } finally {
      setAiLoading(prev => ({ ...prev, [accountName]: false }))
    }
  }, [])

  // Derive seller list from Sales Owner field in customers.csv
  const allReps = useMemo(() => [...new Set(
    accounts.map(acc => (acc.sales_owner || '').trim()).filter(Boolean)
  )].sort((a, b) => {
    const aLast = a.split(/\s+/).pop().toLowerCase()
    const bLast = b.split(/\s+/).pop().toLowerCase()
    return aLast.localeCompare(bLast)
  }), [accounts])

  // Auto-select first seller
  const rep = selectedRep || allReps[0] || ''

  // Rep profile from CSV (if loaded)
  const repProfile = useMemo(() => {
    const profiles = rawData?.rep_profiles || []
    return profiles.find(p => (p.rep_name || '').trim() === rep) || null
  }, [rawData, rep])

  // Accounts where this seller is the Sales Owner
  const repAccounts = useMemo(() =>
    accounts.filter(acc => (acc.sales_owner || '').trim() === rep),
  [accounts, rep])

  // Active deals where this seller is the Opportunity Owner (d.rep)
  // Bookings and pipeline are attributed by Opportunity Owner, not Account Sales Owner
  const allActiveDeals = useMemo(() =>
    accounts.flatMap(acc =>
      (acc.active_deals || [])
        .filter(d => (d.rep || '').trim() === rep)
        .map(d => ({ ...d, accountName: acc.name }))
    ), [accounts, rep])

  // Funnel closed deals: from funnel.csv ONLY — used for bookings & forecast
  // Filtered by Opportunity Owner (d.rep), not Account Sales Owner
  const funnelClosed = useMemo(() =>
    accounts.flatMap(acc =>
      (acc.funnel_closed || [])
        .filter(d => (d.rep || '').trim() === rep)
        .map(d => ({ ...d, accountName: acc.name }))
    ), [accounts, rep])

  // Historical deals — for modeling/predictions only (NOT bookings)
  const allHistorical = useMemo(() =>
    accounts.flatMap(acc =>
      (acc.historical_deals || [])
        .filter(d => (d.rep || '').trim() === rep || (acc.sales_owner || '').trim() === rep)
        .map(d => ({ ...d, accountName: acc.name }))
    ), [accounts, rep])

  // Bookings calculations
  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 1) // 1st of next quarter
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1) // 1st of next month
  const currentQ = Math.floor(now.getMonth() / 3) + 1
  const currentMonthName = now.toLocaleString('default', { month: 'long' })

  // Period-aware pace
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1)
  const periodStart = periodMode === 'month' ? mStart : periodMode === 'annual' ? yearStart : qStart
  const periodEnd = periodMode === 'month' ? mEnd : periodMode === 'annual' ? yearEnd : qEnd
  const dayOfPeriod = Math.floor((now - periodStart) / 86400000) + 1
  const daysInPeriod = Math.floor((periodEnd - periodStart) / 86400000)
  const periodPacePct = dayOfPeriod / daysInPeriod

  // All funnel deals for bookings: active pipeline + funnel closed (NOT historical.csv)
  const allFunnelDeals = useMemo(() => [...allActiveDeals, ...funnelClosed], [allActiveDeals, funnelClosed])

  const closedWonDeals = useMemo(() =>
    funnelClosed.filter(d => {
      const s = normalizeStage(d.stage)
      return s === 'closed won' && (d.mrr || 0) >= 0
    }), [funnelClosed])

  // Bookings: forecast=Closed, major_project blank, positive MRR. NOT annualized.
  // Source: funnel.csv only (NOT historical.csv)
  const ytdBookings = useMemo(() =>
    allFunnelDeals.filter(d => {
      if ((d.mrr || 0) <= 0) return false
      if (!isBooking(d)) return false
      const dt = parseDate(d.close)
      return dt && dt >= yearStart && dt < yearEnd
    }).reduce((s, d) => s + (d.mrr || 0), 0), [allFunnelDeals])

  const qtdBookings = useMemo(() =>
    allFunnelDeals.filter(d => {
      if ((d.mrr || 0) <= 0) return false
      if (!isBooking(d)) return false
      const dt = parseDate(d.close)
      return dt && dt >= qStart && dt < qEnd
    }).reduce((s, d) => s + (d.mrr || 0), 0), [allFunnelDeals])

  const mtdBookings = useMemo(() =>
    allFunnelDeals.filter(d => {
      if ((d.mrr || 0) <= 0) return false
      if (!isBooking(d)) return false
      const dt = parseDate(d.close)
      return dt && dt >= mStart && dt < mEnd
    }).reduce((s, d) => s + (d.mrr || 0), 0), [allFunnelDeals])

  // Period bookings based on toggle
  const periodBookings = periodMode === 'month' ? mtdBookings : periodMode === 'annual' ? ytdBookings : qtdBookings

  // User target is always ANNUAL — divided by 4 for quarterly, by 12 for monthly
  const parsedTarget = parseFloat(String(userTarget).replace(/[^0-9.]/g, '')) || 0
  const annualQuota = parsedTarget > 0 ? parsedTarget : (parseFloat(repProfile?.annual_quota) || 65000)
  const quarterlyQuota = annualQuota / 4
  const monthlyQuota = annualQuota / 12
  const periodQuota = periodMode === 'month' ? monthlyQuota : periodMode === 'annual' ? annualQuota : quarterlyQuota
  const expectedPeriod = periodQuota * periodPacePct

  // Pipeline metrics — weighted by stage win probability (MRR terms, not annualized)
  // Exclude deals already counted as bookings (forecast=Closed) from pipeline weighting
  const pipelineDeals = allActiveDeals.filter(d => !isBooking(d) && (d.mrr || 0) > 0)
  const totalPipelineMRR = pipelineDeals.reduce((s, d) => s + (d.mrr || 0), 0)
  const weightedPipeline = pipelineDeals.reduce((s, d) => {
    return s + (d.mrr || 0) * stageProb(d.stage)
  }, 0)
  const targetRemaining = Math.max(0, periodQuota - periodBookings)
  // Pipeline coverage: weighted pipeline MRR vs remaining MRR target (same units)
  const pipelineCoverage = targetRemaining > 0 ? weightedPipeline / targetRemaining : 999

  // Book of business ARR
  const bookARR = repAccounts.reduce((s, a) => s + (a.arr || 0), 0)

  return (
    <div>
      {/* Rep Selector + Target + Period Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em' }}>
          Seller
        </div>
        <select
          value={rep}
          onChange={(e) => setSelectedRep(e.target.value)}
          style={{
            padding: '6px 10px', fontFamily: FONT_MONO, fontSize: '11px',
            background: T.card, border: `1px solid ${T.border}`, borderRadius: RADIUS,
            color: T.text, outline: 'none', cursor: 'pointer', minWidth: '180px',
          }}
        >
          {allReps.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <div style={{ width: '1px', height: '20px', background: T.border }} />

        {/* Target Input — always annual, divided by 4 or 12 for period */}
        <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim }}>Annual Target</div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim }}>$</span>
          <input
            type="text"
            value={userTarget}
            onChange={e => setUserTarget(e.target.value)}
            placeholder="65000"
            style={{
              padding: '6px 10px 6px 18px', fontFamily: FONT_MONO, fontSize: '11px',
              background: T.card, border: `1px solid ${userTarget ? T.cyan : T.border}`, borderRadius: RADIUS,
              color: T.text, outline: 'none', width: '100px',
            }}
            onFocus={e => e.target.style.borderColor = T.cyan}
            onBlur={e => { if (!userTarget) e.target.style.borderColor = T.border }}
          />
        </div>

        <div style={{ width: '1px', height: '20px', background: T.border }} />

        {/* Month / Quarter Toggle */}
        <div style={{ display: 'flex', gap: '2px', background: T.surface, borderRadius: RADIUS, padding: '2px' }}>
          <button onClick={() => setPeriodMode('month')} style={{
            padding: '4px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600,
            background: periodMode === 'month' ? T.card : 'transparent',
            color: periodMode === 'month' ? T.cyan : T.textDim,
            boxShadow: periodMode === 'month' ? CARD_SHADOW : 'none',
          }}>Month</button>
          <button onClick={() => setPeriodMode('quarter')} style={{
            padding: '4px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600,
            background: periodMode === 'quarter' ? T.card : 'transparent',
            color: periodMode === 'quarter' ? T.cyan : T.textDim,
            boxShadow: periodMode === 'quarter' ? CARD_SHADOW : 'none',
          }}>Quarter</button>
          <button onClick={() => setPeriodMode('annual')} style={{
            padding: '4px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600,
            background: periodMode === 'annual' ? T.card : 'transparent',
            color: periodMode === 'annual' ? T.cyan : T.textDim,
            boxShadow: periodMode === 'annual' ? CARD_SHADOW : 'none',
          }}>Annual</button>
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}>
          {repAccounts.length} accounts · {allActiveDeals.length} deals
        </div>
      </div>

      {/* Internal Tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '16px', padding: '4px',
        background: T.surface, borderRadius: RADIUS, width: 'fit-content',
      }}>
        <TabBtn active={tab === 'accounts'} label="My Accounts" onClick={() => setTab('accounts')} />
        <TabBtn active={tab === 'pipeline'} label="My Pipeline" onClick={() => setTab('pipeline')} />
        <TabBtn active={tab === 'pipeline-gap'} label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>Pipeline Gap <span style={{ width: 7, height: 7, borderRadius: '50%', background: pipelineCoverage >= 3 ? T.green : pipelineCoverage >= 1.5 ? T.yellow : pipelineCoverage >= 1 ? T.orange : T.red }} /></span>} onClick={() => setTab('pipeline-gap')} />
        <TabBtn active={tab === 'kpi'} label="KPI Scorecard" onClick={() => setTab('kpi')} />
      </div>

      {/* TAB 1: MY ACCOUNTS */}
      {tab === 'accounts' && <MyAccountsTab
        repAccounts={repAccounts} rep={rep} repProfile={repProfile}
        periodBookings={periodBookings} ytdBookings={ytdBookings} periodQuota={periodQuota}
        annualQuota={annualQuota} expectedPeriod={expectedPeriod} pipelineCoverage={pipelineCoverage}
        bookARR={bookARR} showFilter={showFilter} setShowFilter={setShowFilter}
        sortBy={sortBy} setSortBy={setSortBy} periodMode={periodMode} currentQ={currentQ}
        currentMonthName={currentMonthName}
        accountSearch={accountSearch} setAccountSearch={setAccountSearch}
        weightedPipeline={weightedPipeline} targetRemaining={targetRemaining}
        signalsData={signalsData} signalsAge={signalsAge}
        aiSignals={aiSignals} aiLoading={aiLoading} refreshAI={refreshAI}
      />}

      {/* TAB 2: MY PIPELINE */}
      {tab === 'pipeline' && <MyPipelineTab
        allActiveDeals={allActiveDeals} repAccounts={repAccounts} rep={rep}
        totalPipelineMRR={totalPipelineMRR} weightedPipeline={weightedPipeline}
        targetRemaining={targetRemaining} closedWonDeals={closedWonDeals}
        periodQuota={periodQuota} annualQuota={annualQuota} funnelClosed={funnelClosed}
        periodMode={periodMode} currentQ={currentQ} currentMonthName={currentMonthName}
      />}

      {/* TAB 3: PIPELINE GAP */}
      {tab === 'pipeline-gap' && <PipelineGapTab
        allActiveDeals={allActiveDeals} funnelClosed={funnelClosed}
        periodQuota={periodQuota} annualQuota={annualQuota}
        periodMode={periodMode} currentQ={currentQ} currentMonthName={currentMonthName}
        weightedPipeline={weightedPipeline} totalPipelineMRR={totalPipelineMRR}
        periodBookings={periodBookings}
      />}

      {/* TAB 4: KPI SCORECARD */}
      {tab === 'kpi' && <KPITab
        repAccounts={repAccounts} rep={rep} repProfile={repProfile}
        periodBookings={periodBookings} ytdBookings={ytdBookings}
        periodQuota={periodQuota} annualQuota={annualQuota}
        closedWonDeals={closedWonDeals} funnelClosed={funnelClosed}
        allActiveDeals={allActiveDeals} expectedPeriod={expectedPeriod}
        periodPacePct={periodPacePct} currentQ={currentQ}
        periodMode={periodMode} currentMonthName={currentMonthName}
        qtdBookings={qtdBookings}
      />}
    </div>
  )
}

// =======================================================================
// TAB 1: MY ACCOUNTS
// =======================================================================

function MyAccountsTab({
  repAccounts, rep, repProfile, periodBookings, ytdBookings, periodQuota,
  annualQuota, expectedPeriod, pipelineCoverage, bookARR, showFilter, setShowFilter,
  sortBy, setSortBy, periodMode, currentQ, currentMonthName,
  accountSearch, setAccountSearch, weightedPipeline, targetRemaining,
  signalsData, signalsAge, aiSignals, aiLoading, refreshAI,
}) {
  // Filter + search
  const filtered = useMemo(() => {
    let list = repAccounts
    if (accountSearch) list = list.filter(a => a.name.toLowerCase().includes(accountSearch.toLowerCase()))
    if (showFilter === 'engaged') list = list.filter(a => daysSince(a.engagement?.lastDate) <= 90)
    if (showFilter === 'unengaged') list = list.filter(a => daysSince(a.engagement?.lastDate) > 90)
    if (showFilter === 'deals') list = list.filter(a => (a.active_deals?.length || 0) > 0)
    if (showFilter === 'no_pipeline') list = list.filter(a => (a.active_deals?.length || 0) === 0)
    if (showFilter === 'risk') list = list.filter(a => (a.risk_score || 0) >= 30)
    return list
  }, [repAccounts, showFilter, accountSearch])

  // Sort
  const sorted = useMemo(() => {
    const s = [...filtered]
    if (sortBy === 'risk') s.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    if (sortBy === 'revenue') s.sort((a, b) => (b.arr || 0) - (a.arr || 0))
    if (sortBy === 'pipeline') s.sort((a, b) => (b.pipeline_mrr || 0) - (a.pipeline_mrr || 0))
    if (sortBy === 'name') s.sort((a, b) => a.name.localeCompare(b.name))
    if (sortBy === 'activity') s.sort((a, b) => daysSince(a.engagement?.lastDate) - daysSince(b.engagement?.lastDate))
    if (sortBy === 'nrr') s.sort((a, b) => (a.nrr || 0) - (b.nrr || 0))
    return s
  }, [filtered, sortBy])

  const filterCounts = useMemo(() => ({
    all: repAccounts.length,
    engaged: repAccounts.filter(a => daysSince(a.engagement?.lastDate) <= 90).length,
    unengaged: repAccounts.filter(a => daysSince(a.engagement?.lastDate) > 90).length,
    deals: repAccounts.filter(a => (a.active_deals?.length || 0) > 0).length,
    no_pipeline: repAccounts.filter(a => (a.active_deals?.length || 0) === 0).length,
    risk: repAccounts.filter(a => (a.risk_score || 0) >= 30).length,
  }), [repAccounts])

  return (
    <div>
      {/* Top row: Ring + Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
          <AttainmentRing value={periodBookings} quota={periodQuota} label={periodMode === 'month' ? `${currentMonthName} Attainment` : periodMode === 'annual' ? `${now.getFullYear()} Attainment` : `Q${currentQ} Attainment`} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          <Stat label={<Tip label={`${periodMode === 'month' ? 'MTD' : periodMode === 'annual' ? 'YTD' : 'QTD'} BOOKINGS\n\nFormula: SUM(MRR) for deals matching all filters\n\nFilters:\n• Forecast Category = "Closed"\n• MRR > $0\n• Close Date in ${periodMode === 'month' ? currentMonthName : periodMode === 'annual' ? new Date().getFullYear() : 'Q' + currentQ} ${new Date().getFullYear()}\n• Major Project = blank\n• Opp Owner = selected seller\n\nData Source: funnel.csv only\n\nCurrent value: ${$k(periodBookings)}`}>{periodMode === 'month' ? 'MTD' : periodMode === 'annual' ? 'YTD' : 'QTD'} Bookings</Tip>} value={`${$k(periodBookings)}`} sub={periodQuota > 0 ? `of ${$k(periodQuota)} target` : 'no target set'} color={paceColor(periodQuota > 0 ? periodBookings / expectedPeriod : 1)} />
          <Stat label={<Tip label={`YTD BOOKINGS\n\nFormula: SUM(MRR) for deals matching all filters\n\nFilters:\n• Forecast Category = "Closed"\n• MRR > $0\n• Close Date >= 1/1/${new Date().getFullYear()} and < 1/1/${new Date().getFullYear() + 1}\n• Major Project = blank\n• Opp Owner = selected seller\n\nData Source: funnel.csv only\n\nCurrent value: ${$k(ytdBookings)}`}>YTD Bookings</Tip>} value={`${$k(ytdBookings)}`} sub={annualQuota > 0 ? `of ${$k(annualQuota)} annual` : ''} color={T.cyan} />
          <Stat label={<Tip label={`PIPELINE COVERAGE\n\nFormula: Weighted Pipeline ÷ Remaining Target\n= ${$k(weightedPipeline)} ÷ ${$k(targetRemaining)} = ${pipelineCoverage.toFixed(1)}x\n\nWeighted Pipeline: SUM(deal MRR × Stage Win Probability) for active deals where Forecast Category ≠ "Closed", MRR > $0, and Opportunity Owner = selected seller\n\nStage Win Probabilities:\n• Discover: 30.57%\n• Design Solution: 53.21%\n• Propose: 66.23%\n• Negotiate: 84.67%\n• Verbal Agreement: 92.49%\n\nRemaining Target: ${periodMode === 'month' ? 'Monthly' : 'Quarterly'} Quota − ${periodMode === 'month' ? 'MTD' : 'QTD'} Bookings\n= ${$k(periodQuota)} − ${$k(periodBookings)} = ${$k(targetRemaining)}\n\nBenchmark: 3x+ = healthy, 1.5–3x = caution, <1.5x = at risk`}>Pipeline Coverage</Tip>} value={`${pipelineCoverage.toFixed(1)}x`} sub={`${$k(weightedPipeline)} vs ${$k(targetRemaining)} gap`} color={pipelineCoverage >= 3 ? T.green : pipelineCoverage >= 1.5 ? T.yellow : T.red} />
          <Stat label={<Tip label={`BOOK OF BUSINESS\n\nFormula: SUM(Total ARR) across all accounts where Sales Owner = selected seller\n\nSource: customers.csv "Total BRR" field\n\nAccounts: ${repAccounts.length}\nCurrent value: ${$(bookARR)}`}>Book of Business</Tip>} value={$(bookARR)} sub={`${repAccounts.length} accounts`} color={T.teal} />
        </div>
      </div>

      {/* Pace bar */}
      {periodQuota > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <PaceBar actual={periodBookings} expected={expectedPeriod} quota={periodQuota} periodMode={periodMode} currentQ={currentQ} currentMonthName={currentMonthName} />
        </div>
      )}

      {/* Account Search */}
      <div style={{ position: 'relative', marginBottom: '10px' }}>
        <input
          type="text"
          value={accountSearch}
          onChange={e => setAccountSearch(e.target.value)}
          placeholder="Search accounts..."
          style={{
            width: '100%', padding: '8px 30px 8px 12px', fontFamily: FONT_MONO, fontSize: '11px',
            background: T.card, border: `1px solid ${T.border}`, borderRadius: RADIUS,
            color: T.text, outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = T.cyan}
          onBlur={e => e.target.style.borderColor = T.border}
        />
        {accountSearch && (
          <button
            onClick={() => setAccountSearch('')}
            style={{
              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
              fontFamily: FONT_MONO, fontSize: '14px', color: T.textDim, lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, alignSelf: 'center', marginRight: '4px' }}>Show</div>
        {[
          { id: 'all', label: 'All', color: T.cyan },
          { id: 'engaged', label: 'Engaged', color: T.green },
          { id: 'unengaged', label: 'Unengaged', color: T.red },
          { id: 'deals', label: 'Active Deals', color: T.purple },
          { id: 'no_pipeline', label: 'No Pipeline', color: T.orange },
          { id: 'risk', label: 'At Risk', color: T.red },
        ].map(f => (
          <Pill key={f.id} active={showFilter === f.id} label={f.label} count={filterCounts[f.id]} color={f.color} onClick={() => setShowFilter(f.id)} />
        ))}
        <div style={{ width: '1px', background: T.border, margin: '0 6px' }} />
        <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, alignSelf: 'center', marginRight: '4px' }}>Sort</div>
        {['risk', 'revenue', 'pipeline', 'name', 'activity', 'nrr'].map(s => (
          <Pill key={s} active={sortBy === s} label={s.charAt(0).toUpperCase() + s.slice(1)} color={T.blue} onClick={() => setSortBy(s)} />
        ))}
      </div>

      <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, marginBottom: '10px' }}>
        {sorted.length} accounts
      </div>

      {/* Account Cards */}
      {sorted.map((acc, i) => {
        const ds = daysSince(acc.engagement?.lastDate)
        const riskColor = acc.risk_score >= 50 ? T.red : acc.risk_score >= 30 ? T.orange : T.green
        const velColor = acc.velocity === 'accelerating' ? T.green : acc.velocity === 'stalled' ? T.red : T.yellow

        return (
          <div key={acc.name} style={{
            background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW,
            padding: '12px 14px', marginBottom: '8px',
            borderLeft: `3px solid ${riskColor}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{acc.name}</span>
                <Badge color={riskColor}>{acc.risk_level?.toUpperCase()}</Badge>
                {acc.velocity && <Badge color={velColor}>{acc.velocity.toUpperCase()}</Badge>}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 700, color: T.cyan }}>
                {$(acc.arr)}
              </div>
            </div>
            {(() => {
              // 2026 Deals from funnel.csv (active_deals + funnel_closed)
              const funnelDeals = [...(acc.active_deals || []), ...(acc.funnel_closed || [])]
              const thisYear = new Date().getFullYear()
              const currentYrDeals = funnelDeals.filter(d => { const dt = parseDate(d.close || d.created); return dt && dt.getFullYear() === thisYear })
              const currentYr = currentYrDeals.length
              const positiveMRR = currentYrDeals.filter(d => (d.mrr || 0) > 0).reduce((s, d) => s + (d.mrr || 0), 0)
              const negativeMRR = currentYrDeals.filter(d => (d.mrr || 0) < 0).reduce((s, d) => s + (d.mrr || 0), 0)
              const netMRR = positiveMRR + negativeMRR

              // Historical deals from historical.csv — won/churned/lost breakdown
              const histDeals = acc.historical_deals || []
              const histWon = histDeals.filter(d => normalizeStage(d.stage) === 'closed won' && (d.mrr || 0) >= 0).length
              const histChurned = histDeals.filter(d => normalizeStage(d.stage) === 'closed won' && (d.mrr || 0) < 0).length
              const histLost = (acc.losses?.deals || []).length

              // Build predictions for active deals using Bayesian model
              const activeDeals = acc.active_deals || []
              const prior = Math.max(0.05, Math.min(0.95, acc.win_rate || 0.5))
              const dealPredictions = activeDeals.map(d => {
                const stageWinProb = stageProb(d.stage)
                let stageLR = (stageWinProb / (1 - stageWinProb)) / (prior / (1 - prior))
                stageLR = Math.max(0.1, Math.min(stageLR, 20))
                const priorLO = Math.log(prior / (1 - prior))
                const posteriorLO = priorLO + Math.log(stageLR)
                const posterior = Math.max(0.02, Math.min(0.98, 1 / (1 + Math.exp(-posteriorLO))))
                return { ...d, winProb: posterior }
              }).sort((a, b) => b.winProb - a.winProb)

              return <>
                {/* Row 1: Pipeline + Active Deals count + Prior breakdown + Last Engagement */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 2fr', gap: '8px' }}>
                  <MiniStat label="Pipeline" value={`${$k(acc.pipeline_mrr || 0)}`} color={T.purple} />
                  <MiniStat label={`${thisYear} Deals`} value={currentYr} color={T.cyan} />
                  <MiniStat label="Won" value={histWon} color={T.green} />
                  <MiniStat label="Churned" value={histChurned} color={T.red} />
                  <MiniStat label="Close Lost" value={histLost} color={T.orange} />
                  <div>
                    <div style={{ fontFamily: FONT_SANS, fontSize: '8px', color: T.textDim }}>
                      <Tip label="LAST ENGAGEMENT">LAST ENGAGEMENT</Tip>
                    </div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 600, color: ds <= 30 ? T.green : ds <= 90 ? T.yellow : T.red }}>
                      {ds < 999 ? `${ds}d ago` : '---'}
                    </div>
                  </div>
                </div>

                {/* Active deal predictions — win rate inline with deal info */}
                {dealPredictions.length > 0 && (
                  <div style={{ marginTop: '6px', padding: '6px 8px', background: `${T.cyan}08`, border: `1px solid ${T.cyan}18`, borderRadius: '6px' }}>
                    <div style={{ fontFamily: FONT_SANS, fontSize: '7px', color: T.cyan, letterSpacing: '0.06em', marginBottom: '4px' }}>DEAL PREDICTIONS</div>
                    {dealPredictions.map((d, idx) => {
                      const probColor = d.winProb > 0.6 ? T.green : d.winProb > 0.35 ? T.yellow : T.orange
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                          <span style={{ fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 700, color: probColor, minWidth: '36px' }}>{pc(d.winProb)}</span>
                          <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.text }}>{d.product || 'Unknown'}</span>
                          <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>{d.stage}</span>
                          <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.cyan }}>{$k(d.mrr || 0)}/mo</span>
                          <div style={{ flex: 1 }} />
                          {d.opportunity_id && (
                            <a href={`https://zayo.lightning.force.com/lightning/r/Opportunity/${d.opportunity_id}/view`}
                              target="_blank" rel="noopener noreferrer"
                              style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.blue, textDecoration: 'none', padding: '1px 4px', background: `${T.blue}12`, borderRadius: '4px', border: `1px solid ${T.blue}25` }}>
                              SFDC ↗
                            </a>
                          )}
                          {d.icb_id && (
                            <a href={`https://zayo.lightning.force.com/lightning/r/Opportunity/${d.icb_id}/view`}
                              target="_blank" rel="noopener noreferrer"
                              style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.purple, textDecoration: 'none', padding: '1px 4px', background: `${T.purple}12`, borderRadius: '4px', border: `1px solid ${T.purple}25` }}>
                              ICB ↗
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {currentYr > 0 && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '6px', padding: '5px 8px', background: `${T.surface}80`, borderRadius: '6px' }}>
                    <span style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{thisYear} NIB</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.green, fontWeight: 600 }}>+{$k(positiveMRR)}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: negativeMRR < 0 ? T.red : T.textDim, fontWeight: 600 }}>{negativeMRR < 0 ? `${$k(negativeMRR)}` : '$0'}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>=</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: netMRR >= 0 ? T.cyan : T.red, fontWeight: 700 }}>Net {$k(netMRR)}</span>
                  </div>
                )}
              </>
            })()}
            {/* WHY NOW — signal rows */}
            {(() => {
              const acctSignals = signalsData?.[acc.name]
              const signalRows = buildSignalRows(acctSignals)
              const acctAI = aiSignals[acc.name] || []
              const isLoadingAI = aiLoading[acc.name]
              if (signalRows.length === 0 && acctAI.length === 0) return null
              return (
                <div style={{ marginTop: '6px', padding: '6px 8px', background: `${T.purple}06`, border: `1px solid ${T.purple}15`, borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ fontFamily: FONT_SANS, fontSize: '7px', color: T.purple, letterSpacing: '0.06em' }}>
                      WHY NOW {signalsAge && <span style={{ color: T.textDim, marginLeft: '6px' }}>updated {signalsAge}</span>}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); refreshAI(acc.name, acctSignals?.segment, acctSignals) }}
                      disabled={isLoadingAI}
                      style={{
                        background: 'none', border: `1px solid ${T.purple}30`, borderRadius: '4px',
                        padding: '1px 6px', cursor: isLoadingAI ? 'default' : 'pointer',
                        fontFamily: FONT_MONO, fontSize: '7px', color: T.purple,
                        opacity: isLoadingAI ? 0.5 : 1,
                      }}
                    >
                      {isLoadingAI ? 'LOADING...' : '🌐 REFRESH'}
                    </button>
                  </div>
                  {signalRows.map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', marginBottom: '2px' }}>
                      <span style={{ fontSize: '10px', flexShrink: 0 }}>{row.icon}</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: CAT_COLORS[row.cat] || T.text, lineHeight: 1.4 }}>
                        {row.text}
                      </span>
                    </div>
                  ))}
                  {acctAI.map((row, idx) => (
                    <div key={`ai-${idx}`} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', marginBottom: '2px' }}>
                      <span style={{ fontSize: '10px', flexShrink: 0 }}>{row.icon || '🌐'}</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.teal, lineHeight: 1.4 }}>
                        {row.text}
                      </span>
                      <span style={{
                        fontFamily: FONT_MONO, fontSize: '7px', color: T.teal, background: `${T.teal}15`,
                        padding: '0 4px', borderRadius: '3px', flexShrink: 0, alignSelf: 'center',
                      }}>LIVE</span>
                    </div>
                  ))}
                </div>
              )
            })()}
            {/* Deals per stage with MRR — active pipeline + funnel closed */}
            {((acc.active_deals?.length || 0) + (acc.funnel_closed?.length || 0)) > 0 && (() => {
              const allDeals = [...(acc.active_deals || []), ...(acc.funnel_closed || [])]
              const stageMap = {}
              for (const d of allDeals) {
                const s = d.stage || 'Unknown'
                if (!stageMap[s]) stageMap[s] = { count: 0, mrr: 0 }
                stageMap[s].count++
                stageMap[s].mrr += d.mrr || 0
              }
              const orderedStages = STAGE_ORDER.filter(s => stageMap[s]).concat(
                Object.keys(stageMap).filter(s => !STAGE_ORDER.includes(s))
              )
              return (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {orderedStages.map(stage => {
                    const data = stageMap[stage]
                    const color = STAGE_COLORS[stage] || T.textDim
                    return (
                      <div key={stage} style={{
                        padding: '3px 8px', borderRadius: '12px',
                        background: `${color}12`, border: `1px solid ${color}30`,
                        fontFamily: FONT_MONO, fontSize: '9px', color,
                      }}>
                        {stage}: {data.count} deal{data.count > 1 ? 's' : ''} · {$k(data.mrr)}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )
      })}

      {sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: T.textDim }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '11px' }}>No accounts match this filter.</div>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontFamily: FONT_SANS, fontSize: '8px', color: T.textDim }}>
        <Tip label={label.toUpperCase()}>{label}</Tip>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 600, color }}>{value}</div>
    </div>
  )
}

// =======================================================================
// TAB 2: MY PIPELINE
// =======================================================================

function MyPipelineTab({
  allActiveDeals, repAccounts, rep, totalPipelineMRR, weightedPipeline,
  targetRemaining, closedWonDeals, periodQuota, annualQuota, funnelClosed,
  periodMode, currentQ, currentMonthName,
}) {
  const now = new Date()
  const thirtyDaysOut = new Date(now.getTime() + 30 * 86400000)
  const pStart = periodMode === 'month'
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const pEnd = periodMode === 'month'
    ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
    : new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 1)

  // Filter active deals to those with close date in the selected period
  const periodDeals = useMemo(() =>
    allActiveDeals.filter(d => {
      const dt = parseDate(d.close)
      return dt && dt >= pStart && dt < pEnd
    }), [allActiveDeals, periodMode])

  const stalledDeals = periodDeals.filter(d => {
    const created = parseDate(d.close)
    return !d.next_step || (created && daysSince(d.close) < -30 === false)
  })
  const closingSoon = periodDeals.filter(d => {
    const dt = parseDate(d.close)
    return dt && dt <= thirtyDaysOut && dt >= now
  })

  // Pipeline by stage with raw + weighted values — filtered to selected period
  const stageData = useMemo(() => {
    const stages = {}
    for (const d of periodDeals) {
      const s = d.stage || 'Unknown'
      if (!stages[s]) stages[s] = { stage: s, count: 0, raw: 0, weighted: 0, prob: stageProb(s) }
      stages[s].count++
      stages[s].raw += d.mrr || 0
      stages[s].weighted += (d.mrr || 0) * stageProb(s)
    }
    const order = [...STAGE_ORDER]
    return order.filter(s => stages[s]).map(s => stages[s]).concat(
      Object.values(stages).filter(s => !order.includes(s.stage))
    )
  }, [periodDeals])

  const rawTotal = stageData.reduce((s, d) => s + d.raw, 0)
  const weightedTotal = stageData.reduce((s, d) => s + d.weighted, 0)
  const periodLabel = periodMode === 'month' ? currentMonthName : `Q${currentQ}`

  // Sorted deal list (highest probability stages first)
  const sortedDeals = useMemo(() => {
    const order = { Accepted: -1, 'Verbal Agreement': 0, Negotiate: 1, Propose: 2, 'Design Solution': 3, Design: 3, Discover: 4 }
    return [...allActiveDeals].sort((a, b) => (order[a.stage] ?? 5) - (order[b.stage] ?? 5))
  }, [allActiveDeals])

  // Funnel MRR trajectory: current year, monthly cumulative raw + weighted by stage win rate
  const trajectoryData = useMemo(() => {
    const year = new Date().getFullYear()
    const allDeals = [...funnelClosed, ...allActiveDeals]
    const months = {}

    // Initialize all 12 months
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`
      months[key] = { month: key, raw: 0, weighted: 0 }
    }

    // Bucket each deal by close date month — raw MRR and weighted MRR
    for (const d of allDeals) {
      const dt = parseDate(d.close)
      if (!dt || dt.getFullYear() !== year) continue
      const mrr = d.mrr || 0
      if (mrr <= 0) continue
      const key = `${year}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      if (!months[key]) continue
      months[key].raw += mrr
      // Closed won deals get 100% weight, active deals get stage probability
      const stage = normalizeStage(d.stage)
      const weight = stage === 'closed won' ? 1 : stageProb(d.stage)
      months[key].weighted += mrr * weight
    }

    const sorted = Object.values(months).sort((a, b) => a.month.localeCompare(b.month))
    let cumRaw = 0
    let cumWeighted = 0
    return sorted.map(m => {
      cumRaw += m.raw
      cumWeighted += m.weighted
      return { month: m.month, raw: Math.round(cumRaw), weighted: Math.round(cumWeighted) }
    })
  }, [funnelClosed, allActiveDeals])

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <Stat label={<Tip label={`Total raw MRR across active deals closing in ${periodLabel}.`}>Pipeline MRR ({periodLabel})</Tip>} value={`${$k(rawTotal)}`} sub={`${periodDeals.length} deals`} color={T.purple} />
        <Stat label={<Tip label={`SUM(Deal MRR × Stage Win Probability) for deals closing in ${periodLabel}. Discover 30.6%, Design Solution 53.2%, Propose 66.2%, Negotiate 84.7%, Verbal Agreement 92.5%.`}>Prob-Adjusted ({periodLabel})</Tip>} value={`${$k(weightedTotal)}`} sub="SUM(MRR × Stage Win %)" color={T.teal} />
        <Stat label={<Tip label={`Remaining target for the current ${periodMode} after subtracting bookings already closed.`}>Target Remaining</Tip>} value={$k(targetRemaining)} color={T.orange} />
        <Stat label={<Tip>CLOSING IN 30D</Tip>} value={closingSoon.length} sub={`${$k(closingSoon.reduce((s, d) => s + (d.mrr || 0), 0))}`} color={T.green} />
        <Stat label={<Tip>STALLED</Tip>} value={stalledDeals.length} color={stalledDeals.length > 0 ? T.red : T.green} />
      </div>

      {/* Pipeline by Stage — raw vs weighted */}
      <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em' }}>
            <Tip label={`Deals closing in ${periodLabel}. Each deal's MRR × stage win probability. Discover 30.57%, Design Solution 53.21%, Propose 66.23%, Negotiate 84.67%, Verbal Agreement 92.49%.`}>
              PIPELINE BY STAGE — {periodLabel.toUpperCase()}
            </Tip>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontFamily: FONT_MONO, fontSize: '10px' }}>
            <span style={{ color: T.textMid }}>Raw: <span style={{ color: T.purple, fontWeight: 600 }}>{$k(rawTotal)}</span></span>
            <span style={{ color: T.textMid }}>Weighted: <span style={{ color: T.teal, fontWeight: 700 }}>{$k(weightedTotal)}</span></span>
          </div>
        </div>

        {stageData.map(s => {
          const maxRaw = Math.max(...stageData.map(x => x.raw), 1)
          const barPct = (s.raw / maxRaw) * 100
          const color = STAGE_COLORS[s.stage] || T.textDim
          return (
            <div key={s.stage} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: FONT_SANS, fontSize: '11px', fontWeight: 600, color }}>{s.stage}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>({pc(s.prob)})</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>{s.count} deals</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.purple }}>{$k(s.raw)}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>→</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 700, color: T.teal }}>{$k(s.weighted)}</span>
                </div>
              </div>
              <div style={{ position: 'relative', height: '6px', background: T.border, borderRadius: '3px' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '3px', width: `${barPct}%`, background: `${color}50`, transition: 'width 0.5s' }} />
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '3px', width: `${barPct * s.prob}%`, background: color, transition: 'width 0.5s' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Funnel MRR Build — Current Year */}
      {trajectoryData.length > 0 && (
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em' }}>
              <Tip label={`Cumulative funnel MRR by close date for ${new Date().getFullYear()}.\n\nRaw Funnel (cyan line): Total MRR from all deals by their close month — no probability adjustment.\n\nWeighted (filled teal area): MRR adjusted by stage win probability. Closed Won deals count at 100%. Active deals weighted by: Discover 30.6%, Design Solution 53.2%, Propose 66.2%, Negotiate 84.7%, Verbal Agreement 92.5%.\n\nTarget line (red dashed): Annual quota for reference.`}>
                {new Date().getFullYear()} FUNNEL MRR BUILD
              </Tip>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontFamily: FONT_MONO, fontSize: '9px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 12, height: 2, background: T.cyan, display: 'inline-block' }} /> Raw Funnel
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 12, height: 6, background: `${T.teal}40`, display: 'inline-block', borderRadius: 1 }} /> Weighted
              </span>
              {annualQuota > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 12, height: 0, borderTop: `2px dashed ${T.red}`, display: 'inline-block' }} /> Target
                </span>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={trajectoryData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="month" tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} width={50} tickFormatter={v => `$${Math.round(v).toLocaleString()}`} />
              <Tooltip contentStyle={chartTheme.tooltip} formatter={(v, name) => [`$${Math.round(v).toLocaleString()}`, name === 'raw' ? 'Raw Funnel MRR' : 'Weighted MRR']} />
              {annualQuota > 0 && <ReferenceLine y={annualQuota} stroke={T.red} strokeDasharray="6 3" strokeWidth={1.5} ifOverflow="extendDomain" label={{ value: `Target ${$k(annualQuota)}`, position: 'right', fill: T.red, fontSize: 9, fontFamily: FONT_MONO }} />}
              <Area type="monotone" dataKey="weighted" fill={`${T.teal}25`} stroke={T.teal} strokeWidth={1.5} name="weighted" dot={false} />
              <Line type="monotone" dataKey="raw" stroke={T.cyan} strokeWidth={2} dot={false} name="raw" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Deal List */}
      <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1.8fr 1fr 0.7fr 0.7fr 1fr 0.9fr 0.7fr',
          gap: '4px', padding: '8px 12px', background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, letterSpacing: '0.04em',
        }}>
          <div>Account</div>
          <div>Product</div>
          <div style={{ textAlign: 'right' }}>MRR</div>
          <div style={{ textAlign: 'right' }}>Weighted</div>
          <div>Stage</div>
          <div>Close</div>
          <div>Forecast</div>
        </div>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {sortedDeals.map((d, i) => {
            const closeDate = parseDate(d.close)
            const isClosingSoon = closeDate && closeDate <= thirtyDaysOut && closeDate >= now
            const prob = stageProb(d.stage)
            const wMrr = (d.mrr || 0) * prob
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1.8fr 1fr 0.7fr 0.7fr 1fr 0.9fr 0.7fr',
                gap: '4px', padding: '8px 12px', fontSize: '11px',
                borderBottom: `1px solid ${T.border}`,
                background: i % 2 === 0 ? 'transparent' : `${T.surface}40`,
                alignItems: 'center',
              }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.accountName}
                </div>
                <div style={{ color: T.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.product}</div>
                <div style={{ textAlign: 'right', fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600, color: T.purple }}>
                  {$k(d.mrr)}
                </div>
                <div style={{ textAlign: 'right', fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600, color: T.teal }}>
                  {$k(wMrr)}
                </div>
                <div>
                  <Badge color={STAGE_COLORS[d.stage] || T.textDim}>{d.stage}</Badge>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: isClosingSoon ? T.green : T.textMid }}>
                  {d.close || '---'}
                </div>
                <div>
                  {d.forecast && (
                    <Badge color={d.forecast === 'Commit' ? T.green : d.forecast === 'Best Case' ? T.teal : T.textDim}>
                      {d.forecast}
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// =======================================================================
// TAB 3: PIPELINE GAP
// =======================================================================

const STAGES = ['Discover', 'Design Solution', 'Propose', 'Negotiate', 'Verbal Agreement', 'Closed']
const DEFAULT_MIX = { Discover: 20, 'Design Solution': 25, Propose: 30, Negotiate: 15, 'Verbal Agreement': 10 }

function PipelineGapTab({
  allActiveDeals, funnelClosed, periodQuota, annualQuota,
  periodMode, currentQ, currentMonthName, weightedPipeline, totalPipelineMRR,
  periodBookings,
}) {
  const [customTarget, setCustomTarget] = useState('')
  const [scenarioMix, setScenarioMix] = useState({ ...DEFAULT_MIX })
  const [simAdds, setSimAdds] = useState({ Discover: { count: 0, mrr: '' }, 'Design Solution': { count: 0, mrr: '' }, Propose: { count: 0, mrr: '' }, Negotiate: { count: 0, mrr: '' }, 'Verbal Agreement': { count: 0, mrr: '' } })

  // Period date boundaries
  const now = new Date()
  const pStart = periodMode === 'month'
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const pEnd = periodMode === 'month'
    ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
    : new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 1)

  // Active pipeline deals (not closed, positive MRR, close date in selected period)
  const activePeriodDeals = useMemo(() =>
    allActiveDeals.filter(d => {
      const s = normalizeStage(d.stage)
      if (s === 'closed won' || s === 'closed lost' || (d.mrr || 0) <= 0) return false
      const dt = parseDate(d.close)
      return dt && dt >= pStart && dt < pEnd
    }), [allActiveDeals, periodMode])

  // Closed-won deals in the selected period (from funnelClosed)
  const closedPeriodDeals = useMemo(() =>
    funnelClosed.filter(d => {
      const s = normalizeStage(d.stage)
      if (s !== 'closed won' || (d.mrr || 0) <= 0) return false
      const dt = parseDate(d.close)
      return dt && dt >= pStart && dt < pEnd
    }).map(d => ({ ...d, stage: 'Closed' })),
  [funnelClosed, periodMode])

  // Combined pipeline: active + closed for the period
  const pipeline = useMemo(() =>
    [...activePeriodDeals, ...closedPeriodDeals],
  [activePeriodDeals, closedPeriodDeals])

  // Historical won deals for avg calculations
  const wonDeals = useMemo(() =>
    funnelClosed.filter(d => normalizeStage(d.stage) === 'closed won' && (d.mrr || 0) > 0),
  [funnelClosed])

  const historicalAvgDeal = wonDeals.length > 0
    ? wonDeals.reduce((s, d) => s + (d.mrr || 0), 0) / wonDeals.length
    : 3000

  // Per-stage breakdown
  const byStage = useMemo(() => {
    const result = {}
    for (const st of STAGES) {
      const stDeals = pipeline.filter(d => d.stage === st)
      const raw = stDeals.reduce((s, d) => s + (d.mrr || 0), 0)
      const avg = stDeals.length > 0 ? raw / stDeals.length : historicalAvgDeal
      result[st] = { deals: stDeals.length, raw, weighted: raw * stageProb(st), avg, prob: stageProb(st) }
    }
    return result
  }, [pipeline, historicalAvgDeal])

  const totalRaw = pipeline.reduce((s, d) => s + (d.mrr || 0), 0)
  const totalWeighted = pipeline.reduce((s, d) => s + (d.mrr || 0) * stageProb(d.stage), 0)

  // Target
  const parsedCustom = parseFloat(String(customTarget).replace(/[^0-9.]/g, '')) || 0
  const target = parsedCustom > 0 ? parsedCustom : periodQuota
  const gap = Math.max(0, target - totalWeighted)
  const coverage = target > 0 ? totalWeighted / target : 0
  const covColor = coverage >= 1 ? T.green : coverage >= 0.7 ? T.yellow : coverage >= 0.4 ? T.orange : T.red

  // What-if simulation
  const simWeighted = useMemo(() => {
    let added = 0
    for (const st of STAGES) {
      const entry = simAdds[st] || { count: 0, mrr: '' }
      const customMrr = parseFloat(String(entry.mrr).replace(/[^0-9.]/g, '')) || 0
      const dealMrr = customMrr > 0 ? customMrr : (byStage[st]?.avg || historicalAvgDeal)
      added += (entry.count || 0) * dealMrr * stageProb(st)
    }
    return added
  }, [simAdds, byStage, historicalAvgDeal])

  const simTotal = totalWeighted + simWeighted
  const simCoverage = target > 0 ? simTotal / target : 0
  const simCovColor = simCoverage >= 1 ? T.green : simCoverage >= 0.7 ? T.yellow : simCoverage >= 0.4 ? T.orange : T.red

  // Blended build plan
  const totalMixPct = Object.values(scenarioMix).reduce((s, v) => s + v, 0) || 1
  const buildPlan = useMemo(() => {
    if (gap <= 0) return null
    const plan = {}
    let totalDeals = 0
    let totalAdded = 0
    for (const st of STAGES) {
      const pct = (scenarioMix[st] || 0) / totalMixPct
      const stageGapShare = gap * pct
      const avg = byStage[st]?.avg || historicalAvgDeal
      const rawNeeded = stageProb(st) > 0 ? stageGapShare / stageProb(st) : 0
      const deals = Math.ceil(rawNeeded / (avg || 1))
      const weightedVal = deals * avg * stageProb(st)
      plan[st] = { deals, pct, rawNeeded, weightedVal, avg }
      totalDeals += deals
      totalAdded += weightedVal
    }
    return { stages: plan, totalDeals, totalAdded, projected: totalWeighted + totalAdded, projectedCov: target > 0 ? (totalWeighted + totalAdded) / target : 0 }
  }, [gap, scenarioMix, totalMixPct, byStage, historicalAvgDeal, totalWeighted, target])

  const maxRaw = Math.max(...STAGES.map(s => byStage[s]?.raw || 0), 1)

  return (
    <div>
      {/* Section 1 — Status Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '12px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
            {periodMode === 'month' ? currentMonthName : `Q${currentQ}`} Target
          </div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim }}>$</span>
            <input
              type="text"
              value={customTarget}
              onChange={e => setCustomTarget(e.target.value)}
              placeholder={$k(target)}
              style={{
                width: '100%', padding: '6px 8px 6px 16px', fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 700,
                background: T.surface, border: `1px solid ${customTarget ? T.cyan : T.border}`, borderRadius: RADIUS,
                color: T.text, outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = T.cyan}
              onBlur={e => { if (!customTarget) e.target.style.borderColor = T.border }}
            />
          </div>
        </div>
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '12px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Weighted Pipeline</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: '22px', fontWeight: 700, color: T.purple }}>{$k(totalWeighted)}</div>
          <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, marginTop: '2px' }}>Raw: {$k(totalRaw)}</div>
        </div>
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '12px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Gap</div>
          {gap > 0
            ? <div style={{ fontFamily: FONT_MONO, fontSize: '22px', fontWeight: 700, color: T.red }}>{$k(gap)}</div>
            : <div style={{ fontFamily: FONT_MONO, fontSize: '22px', fontWeight: 700, color: T.green }}>COVERED</div>
          }
        </div>
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '12px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Coverage</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: '22px', fontWeight: 700, color: covColor }}>{pc(coverage)}</div>
          <div style={{ height: '4px', background: T.border, borderRadius: '2px', marginTop: '6px' }}>
            <div style={{ height: '100%', borderRadius: '2px', background: covColor, width: `${Math.min(coverage * 100, 100)}%`, transition: 'width 0.5s' }} />
          </div>
        </div>
      </div>

      {/* Section 2 — Current Pipeline by Stage */}
      <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px', marginBottom: '16px' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '10px', textTransform: 'uppercase' }}>
          Current Pipeline by Stage
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Stage', 'Win %', 'Deals', 'Raw MRR', '', 'Weighted MRR'].map((h, i) => (
                <th key={i} style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, textAlign: i >= 3 ? 'right' : 'left', padding: '4px 8px', borderBottom: `1px solid ${T.border}`, fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STAGES.map(st => {
              const d = byStage[st]
              const color = STAGE_COLORS[st] || T.textDim
              return (
                <tr key={st}>
                  <td style={{ fontFamily: FONT_MONO, fontSize: '11px', color, padding: '6px 8px', borderBottom: `1px solid ${T.border}08` }}>{st}</td>
                  <td style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textMid, padding: '6px 8px' }}>{(d.prob * 100).toFixed(1)}%</td>
                  <td style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.text, padding: '6px 8px' }}>{d.deals}</td>
                  <td style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.text, padding: '6px 8px', textAlign: 'right' }}>{$k(d.raw)}</td>
                  <td style={{ padding: '6px 8px', width: '120px' }}>
                    <div style={{ height: '6px', background: T.border, borderRadius: '3px' }}>
                      <div style={{ height: '100%', borderRadius: '3px', background: color, width: `${(d.raw / maxRaw) * 100}%`, transition: 'width 0.3s' }} />
                    </div>
                  </td>
                  <td style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.purple, padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{$k(d.weighted)}</td>
                </tr>
              )
            })}
            <tr style={{ borderTop: `2px solid ${T.border}` }}>
              <td style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 700, color: T.text, padding: '8px 8px' }}>Total</td>
              <td />
              <td style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 700, color: T.text, padding: '8px 8px' }}>{pipeline.length}</td>
              <td style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 700, color: T.text, padding: '8px 8px', textAlign: 'right' }}>{$k(totalRaw)}</td>
              <td />
              <td style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 700, color: T.purple, padding: '8px 8px', textAlign: 'right' }}>{$k(totalWeighted)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 4 — Blended Build Plan */}
      {gap > 0 && buildPlan && (
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px', marginBottom: '16px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px', textTransform: 'uppercase' }}>
            Blended Build Plan
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>
            {/* Left: Sliders */}
            <div>
              {STAGES.map(st => {
                const color = STAGE_COLORS[st] || T.textDim
                const plan = buildPlan.stages[st]
                return (
                  <div key={st} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color }}>{st}</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.text }}>{scenarioMix[st]}% &rarr; <span style={{ fontWeight: 700 }}>{plan.deals} deals</span> <span style={{ color: T.purple }}>(+{$k(plan.weightedVal)})</span></span>
                    </div>
                    <input
                      type="range" min="0" max="50" value={scenarioMix[st]}
                      onChange={e => setScenarioMix(prev => ({ ...prev, [st]: parseInt(e.target.value) }))}
                      style={{ width: '100%', accentColor: color, height: '4px' }}
                    />
                  </div>
                )
              })}
              <button
                onClick={() => setScenarioMix({ ...DEFAULT_MIX })}
                style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS, padding: '4px 10px', cursor: 'pointer', marginTop: '4px' }}
              >Reset to defaults</button>
            </div>
            {/* Right: Summary */}
            <div style={{ background: T.surface, borderRadius: RADIUS, padding: '12px' }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, textTransform: 'uppercase', marginBottom: '10px' }}>Plan Summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontFamily: FONT_SANS, fontSize: '8px', color: T.textDim }}>New Deals</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '18px', fontWeight: 700, color: T.text }}>{buildPlan.totalDeals}</div>
                </div>
                <div>
                  <div style={{ fontFamily: FONT_SANS, fontSize: '8px', color: T.textDim }}>They'd Add</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '18px', fontWeight: 700, color: T.purple }}>+{$k(buildPlan.totalAdded)}</div>
                </div>
              </div>
              <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, marginBottom: '4px' }}>Projected Coverage</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 700, color: buildPlan.projectedCov >= 1 ? T.green : T.yellow, marginBottom: '4px' }}>
                {pc(buildPlan.projectedCov)}
              </div>
              <div style={{ height: '6px', background: T.border, borderRadius: '3px', marginBottom: '12px' }}>
                <div style={{ height: '100%', borderRadius: '3px', background: T.purple, width: `${Math.min((totalWeighted / (target || 1)) * 100, 100)}%`, position: 'relative' }}>
                  <div style={{ position: 'absolute', right: 0, top: '-1px', width: '2px', height: '8px', background: T.text, borderRadius: '1px' }} />
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: `${T.purple}40`, width: `${Math.min(buildPlan.projectedCov * 100, 100)}%`, marginTop: '-6px' }} />
              </div>
              <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, marginBottom: '4px' }}>Funnel Shape</div>
              {STAGES.map(st => {
                const current = byStage[st]?.deals || 0
                const needed = buildPlan.stages[st]?.deals || 0
                const color = STAGE_COLORS[st] || T.textDim
                const maxDeals = Math.max(...STAGES.map(s => (byStage[s]?.deals || 0) + (buildPlan.stages[s]?.deals || 0)), 1)
                return (
                  <div key={st} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, width: '18px', textAlign: 'right' }}>{current + needed}</span>
                    <div style={{ flex: 1, height: '8px', background: T.border, borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ height: '100%', background: color, width: `${(current / maxDeals) * 100}%` }} />
                      {needed > 0 && <div style={{ height: '100%', background: `${color}50`, width: `${(needed / maxDeals) * 100}%` }} />}
                    </div>
                    <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color, width: '50px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{st.split(' ')[0]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Section 5 — What-If Simulator */}
      <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            What-If Simulator
          </div>
          <button
            onClick={() => setSimAdds({ Discover: { count: 0, mrr: '' }, 'Design Solution': { count: 0, mrr: '' }, Propose: { count: 0, mrr: '' }, Negotiate: { count: 0, mrr: '' }, 'Verbal Agreement': { count: 0, mrr: '' } })}
            style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS, padding: '3px 8px', cursor: 'pointer' }}
          >Reset</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '16px' }}>
          <div>
            {STAGES.map(st => {
              const stageAvg = byStage[st]?.avg || historicalAvgDeal
              const entry = simAdds[st] || { count: 0, mrr: '' }
              const count = entry.count || 0
              const customMrr = parseFloat(String(entry.mrr).replace(/[^0-9.]/g, '')) || 0
              const dealMrr = customMrr > 0 ? customMrr : stageAvg
              const contrib = count * dealMrr * stageProb(st)
              const color = STAGE_COLORS[st] || T.textDim
              return (
                <div key={st} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '6px 8px', background: count > 0 ? `${color}08` : 'transparent', borderRadius: RADIUS }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color, width: '110px' }}>{st}</span>
                  <button onClick={() => setSimAdds(p => ({ ...p, [st]: { ...p[st], count: Math.max(0, (p[st]?.count || 0) - 1) } }))} style={{ width: '24px', height: '24px', borderRadius: '4px', border: `1px solid ${T.border}`, background: T.surface, color: T.text, cursor: 'pointer', fontFamily: FONT_MONO, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&minus;</button>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 700, color: T.text, width: '24px', textAlign: 'center' }}>{count}</span>
                  <button onClick={() => setSimAdds(p => ({ ...p, [st]: { ...p[st], count: (p[st]?.count || 0) + 1 } }))} style={{ width: '24px', height: '24px', borderRadius: '4px', border: `1px solid ${T.border}`, background: T.surface, color: T.text, cursor: 'pointer', fontFamily: FONT_MONO, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  <div style={{ position: 'relative', width: '80px' }}>
                    <span style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>$</span>
                    <input
                      type="text"
                      value={entry.mrr}
                      onChange={e => setSimAdds(p => ({ ...p, [st]: { ...p[st], mrr: e.target.value } }))}
                      placeholder={$k(stageAvg)}
                      style={{
                        width: '100%', padding: '3px 6px 3px 14px', fontFamily: FONT_MONO, fontSize: '10px',
                        background: T.surface, border: `1px solid ${entry.mrr ? T.cyan : T.border}`, borderRadius: '4px',
                        color: T.text, outline: 'none', boxSizing: 'border-box',
                      }}
                      onFocus={e => e.target.style.borderColor = T.cyan}
                      onBlur={e => { if (!entry.mrr) e.target.style.borderColor = T.border }}
                    />
                  </div>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>x {(stageProb(st) * 100).toFixed(1)}%</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: contrib > 0 ? T.purple : T.textDim, fontWeight: contrib > 0 ? 600 : 400, minWidth: '70px', textAlign: 'right' }}>
                    {contrib > 0 ? `+${$k(contrib)}` : '---'}
                  </span>
                </div>
              )
            })}
          </div>
          <div style={{ background: T.surface, borderRadius: RADIUS, padding: '12px' }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, textTransform: 'uppercase', marginBottom: '8px' }}>Simulated Result</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: '8px', color: T.textDim, marginBottom: '2px' }}>Current</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 600, color: T.purple, marginBottom: '6px' }}>{$k(totalWeighted)}</div>
            {simWeighted > 0 && <>
              <div style={{ fontFamily: FONT_SANS, fontSize: '8px', color: T.textDim, marginBottom: '2px' }}>+ New Deals</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 600, color: T.green, marginBottom: '6px' }}>+{$k(simWeighted)}</div>
            </>}
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '6px', marginTop: '4px' }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: '8px', color: T.textDim, marginBottom: '2px' }}>Projected</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '18px', fontWeight: 700, color: simCovColor }}>{$k(simTotal)}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 600, color: simCovColor, marginTop: '4px' }}>{pc(simCoverage)} coverage</div>
              <div style={{ height: '6px', background: T.border, borderRadius: '3px', marginTop: '6px' }}>
                <div style={{ height: '100%', borderRadius: '3px', background: simCovColor, width: `${Math.min(simCoverage * 100, 100)}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 6 — Model Reference */}
      <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '10px', textTransform: 'uppercase' }}>
          Model Reference
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, marginBottom: '6px', textTransform: 'uppercase' }}>Formulas</div>
            {[
              ['Weighted Pipeline', 'SUM(Deal MRR x Stage Win %)'],
              ['Gap', 'Target - Weighted Pipeline'],
              ['Coverage', 'Weighted Pipeline / Target'],
              ['Deals Needed', 'Gap / (Avg Deal MRR x Stage Win %)'],
            ].map(([name, formula]) => (
              <div key={name} style={{ marginBottom: '6px' }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.text, fontWeight: 600 }}>{name}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}> = {formula}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, marginBottom: '6px', textTransform: 'uppercase' }}>Stage Win Probabilities</div>
            {STAGES.map(st => {
              const prob = stageProb(st)
              const color = STAGE_COLORS[st] || T.textDim
              return (
                <div key={st} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color, width: '120px' }}>{st}</span>
                  <div style={{ flex: 1, height: '6px', background: T.border, borderRadius: '3px' }}>
                    <div style={{ height: '100%', borderRadius: '3px', background: color, width: `${prob * 100}%` }} />
                  </div>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.text, width: '45px', textAlign: 'right' }}>{(prob * 100).toFixed(1)}%</span>
                </div>
              )
            })}
            <div style={{ fontFamily: FONT_SANS, fontSize: '8px', color: T.textDim, marginTop: '6px', fontStyle: 'italic' }}>Win probabilities from historical close rates</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =======================================================================
// TAB 4: KPI SCORECARD
// =======================================================================

function KPITab({
  repAccounts, rep, repProfile, periodBookings, ytdBookings,
  periodQuota, annualQuota, closedWonDeals, funnelClosed,
  allActiveDeals, expectedPeriod, periodPacePct, currentQ,
  periodMode, currentMonthName, qtdBookings,
}) {
  const now = new Date()

  // Win rate — current year closed deals from funnel.csv only
  const allClosed = funnelClosed.filter(d => {
    const s = normalizeStage(d.stage)
    if (s !== 'closed won' && s !== 'closed lost') return false
    const dt = parseDate(d.close)
    return dt && dt.getFullYear() === now.getFullYear()
  })
  const totalWon = allClosed.filter(d => normalizeStage(d.stage) === 'closed won').length
  const totalLost = allClosed.filter(d => normalizeStage(d.stage) === 'closed lost').length
  const winRate = (totalWon + totalLost) > 0 ? totalWon / (totalWon + totalLost) : 0

  // Avg deal size — current year closed deals only
  const currentYearClosedWon = closedWonDeals.filter(d => {
    const dt = parseDate(d.close)
    return dt && dt.getFullYear() === now.getFullYear()
  })
  const avgDealSize = currentYearClosedWon.length > 0
    ? currentYearClosedWon.reduce((s, d) => s + (d.mrr || 0), 0) / currentYearClosedWon.length
    : 0

  // Pipeline generated: current year closed MRR + all active pipeline MRR
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const currentYearClosedMRR = currentYearClosedWon.reduce((s, d) => s + (d.mrr || 0), 0)
  const activePipelineMRR = allActiveDeals.reduce((s, d) => s + (d.mrr || 0), 0)
  const pipelineGen = (currentYearClosedMRR + activePipelineMRR) * 12

  // Stage probability breakdown for reference card
  const stagePipeBreakdown = useMemo(() => {
    const stages = {}
    for (const d of allActiveDeals) {
      const s = d.stage || 'Unknown'
      if (!stages[s]) stages[s] = { stage: s, count: 0, raw: 0, weighted: 0, prob: stageProb(s) }
      stages[s].count++
      stages[s].raw += (d.mrr || 0) * 12
      stages[s].weighted += (d.mrr || 0) * stageProb(s) * 12
    }
    return STAGE_ORDER.filter(s => stages[s]).map(s => stages[s]).concat(
      Object.values(stages).filter(s => !STAGE_ORDER.includes(s.stage))
    )
  }, [allActiveDeals])
  const totalWeightedARR = stagePipeBreakdown.reduce((s, d) => s + d.weighted, 0)
  const totalRawARR = stagePipeBreakdown.reduce((s, d) => s + d.raw, 0)

  // Quarterly bookings by type
  const bookingsByType = useMemo(() => {
    const types = { 'New Logo': 0, 'Expansion': 0, 'Renewal': 0, 'Other': 0 }
    for (const d of closedWonDeals) {
      const t = (d.type || '').toLowerCase()
      if (t.includes('new') && !t.includes('re-rate')) types['New Logo'] += (d.mrr || 0) * 12
      else if (t.includes('expansion') || t.includes('upgrade') || t.includes('re-rate') || t.includes('rerate')) types['Expansion'] += (d.mrr || 0) * 12
      else if (t.includes('renewal')) types['Renewal'] += (d.mrr || 0) * 12
      else types['Other'] += (d.mrr || 0) * 12
    }
    return Object.entries(types).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  }, [closedWonDeals])

  // Monthly bookings for current quarter
  const monthlyBookings = useMemo(() => {
    const months = {}
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3
    for (let m = qStartMonth; m < qStartMonth + 3; m++) {
      const label = new Date(now.getFullYear(), m, 1).toLocaleString('default', { month: 'short' })
      months[label] = 0
    }
    for (const d of closedWonDeals) {
      const dt = parseDate(d.close)
      if (dt && dt >= qStart) {
        const label = dt.toLocaleString('default', { month: 'short' })
        if (months[label] !== undefined) months[label] += (d.mrr || 0) * 12
      }
    }
    return Object.entries(months).map(([month, bookings]) => ({ month, bookings: Math.round(bookings) }))
  }, [closedWonDeals])

  // Losses this year
  const ytdLosses = useMemo(() =>
    repAccounts.flatMap(acc =>
      (acc.losses?.deals || []).filter(d => {
        const dt = parseDate(d.date)
        return dt && dt >= new Date(now.getFullYear(), 0, 1) && (d.rep || '').trim() === rep
      }).map(d => ({ ...d, accountName: acc.name }))
    ), [repAccounts, rep])

  const annualPace = annualQuota > 0 ? ytdBookings / (annualQuota * (now.getMonth() + 1) / 12) : 0
  const periodPace = periodQuota > 0 && expectedPeriod > 0 ? periodBookings / expectedPeriod : 0

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <KPICard label={<Tip label={`YTD Bookings ÷ Annual Quota = ${$k(ytdBookings)} ÷ ${$k(annualQuota)} = ${annualQuota > 0 ? pc(ytdBookings / annualQuota) : '---'}. Bookings: Forecast Category = Closed, MRR > 0, Major Project = blank, Close Date in ${now.getFullYear()}.`}>Annual Attainment</Tip>} value={annualQuota > 0 ? pc(ytdBookings / annualQuota) : '---'} sub={`${$k(ytdBookings)} of ${$k(annualQuota)}`} pace={annualPace} />
        <KPICard label={<Tip label={`Period Bookings ÷ Period Quota = ${$k(periodBookings)} ÷ ${$k(periodQuota)} = ${periodQuota > 0 ? pc(periodBookings / periodQuota) : '---'}. Bookings: Forecast Category = Closed, MRR > 0, Major Project = blank, Close Date in ${periodMode === 'month' ? currentMonthName : 'Q' + currentQ}.`}>{periodMode === 'month' ? `${currentMonthName} Attainment` : `Q${currentQ} Attainment`}</Tip>} value={periodQuota > 0 ? pc(periodBookings / periodQuota) : '---'} sub={`${$k(periodBookings)} of ${$k(periodQuota)}`} pace={periodPace} />
        <KPICard label={<Tip label={`Won ÷ (Won + Lost) = ${totalWon} ÷ (${totalWon} + ${totalLost}) = ${pc(winRate)}. ${now.getFullYear()} closed deals only. Source: funnel.csv`}>Win Rate</Tip>} value={pc(winRate)} sub={`${totalWon}W / ${totalLost}L`} pace={winRate >= 0.5 ? 1.1 : winRate >= 0.3 ? 0.85 : 0.5} />
        <KPICard label={<Tip label={`Average MRR across ${now.getFullYear()} closed-won deals.\n\nSUM(MRR) ÷ deal count = ${$k(currentYearClosedWon.reduce((s, d) => s + (d.mrr || 0), 0))} ÷ ${currentYearClosedWon.length} = ${$k(avgDealSize)}\n\nOnly positive MRR, current year close dates.\nSource: funnel.csv`}>Avg Deal Size</Tip>} value={`${$k(avgDealSize)}`} sub={`${currentYearClosedWon.length} deals in ${now.getFullYear()}`} pace={1} />
        <KPICard label={<Tip label={`${now.getFullYear()} closed MRR + active pipeline MRR, annualized.\n\nClosed: ${$k(currentYearClosedMRR)} (${currentYearClosedWon.length} deals)\nPipeline: ${$k(activePipelineMRR)} (${allActiveDeals.length} deals)\nTotal: (${$k(currentYearClosedMRR)} + ${$k(activePipelineMRR)}) × 12 = ${$k(pipelineGen)}\n\nSource: funnel.csv`}>Pipeline Generated</Tip>} value={$k(pipelineGen)} sub={`${currentYearClosedWon.length} closed + ${allActiveDeals.length} open`} pace={1} />
        <KPICard label={<Tip label="Count of accounts that have at least one deal (active or closed) in the funnel.">Accounts with Deals</Tip>} value={repAccounts.filter(a => ((a.active_deals?.length || 0) + (a.funnel_closed?.length || 0)) > 0).length} sub={`of ${repAccounts.length} total`} pace={1} />
      </div>

      {/* Stage Win Probability Reference Card */}
      <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Left: Stage probability table */}
          <div>
            <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '10px' }}>
              <Tip label="Stage win probabilities from validated 2026 funnel model historical win rates.">
                STAGE WIN PROBABILITIES
              </Tip>
            </div>
            {STAGE_ORDER.map(stage => {
              const prob = stageProb(stage)
              const color = STAGE_COLORS[stage] || T.textDim
              const pipeData = stagePipeBreakdown.find(s => s.stage === stage)
              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '110px', fontFamily: FONT_SANS, fontSize: '10px', color, fontWeight: 600 }}>{stage}</div>
                  <div style={{ flex: 1, position: 'relative', height: '8px', background: T.border, borderRadius: '4px' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '4px', width: `${prob * 100}%`, background: `${color}60`, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ width: '40px', fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600, color, textAlign: 'right' }}>
                    {(prob * 100).toFixed(1)}%
                  </div>
                  {pipeData && (
                    <div style={{ width: '80px', fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim, textAlign: 'right' }}>
                      {$k(pipeData.raw)} → {$k(pipeData.weighted)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Right: Weighted total + formula + breakdown */}
          <div>
            <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '10px' }}>
              <Tip>WEIGHTED PIPELINE SUMMARY</Tip>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '28px', fontWeight: 700, color: T.teal, marginBottom: '4px' }}>
              {$k(totalWeightedARR)}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim, marginBottom: '12px' }}>
              Probability-Adjusted ARR
            </div>
            <div style={{
              fontFamily: FONT_MONO, fontSize: '9px', color: T.textMid, padding: '8px',
              background: T.surface, borderRadius: '6px', marginBottom: '12px',
            }}>
              SUM( Deal MRR × Stage Win % ) × 12
            </div>

            {/* Per-stage multiplication breakdown */}
            {stagePipeBreakdown.map(s => {
              const color = STAGE_COLORS[s.stage] || T.textDim
              return (
                <div key={s.stage} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 0', borderBottom: `1px solid ${T.border}`,
                  fontFamily: FONT_MONO, fontSize: '10px',
                }}>
                  <span style={{ color }}>{s.stage} ({s.count})</span>
                  <span style={{ color: T.textMid }}>
                    {$k(s.raw)} × {(s.prob * 100).toFixed(1)}% = <span style={{ color: T.teal, fontWeight: 600 }}>{$k(s.weighted)}</span>
                  </span>
                </div>
              )
            })}
            {stagePipeBreakdown.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 700 }}>
                <span style={{ color: T.text }}>Total</span>
                <span>
                  <span style={{ color: T.purple }}>{$k(totalRawARR)}</span>
                  <span style={{ color: T.textDim }}> → </span>
                  <span style={{ color: T.teal }}>{$k(totalWeightedARR)}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Bookings by type */}
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip>BOOKINGS BY TYPE</Tip>
          </div>
          {bookingsByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={bookingsByType} layout="vertical" margin={{ left: 60, right: 10 }}>
                <XAxis type="number" tick={{ fontFamily: FONT_MONO, fontSize: 9, fill: T.textDim }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontFamily: FONT_SANS, fontSize: 10, fill: T.textMid }} axisLine={false} tickLine={false} width={55} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => [`$${Math.round(v).toLocaleString()}`, 'ARR']} />
                <Bar dataKey="value" fill={T.teal} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px', fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}>No bookings data</div>
          )}
        </div>

        {/* Monthly bookings chart */}
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip label="Monthly bookings for the current quarter from closed-won deals.">{periodMode === 'month' ? `${currentMonthName} Bookings` : `Q${currentQ} Monthly Bookings`}</Tip>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={monthlyBookings} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="month" tick={{ fontFamily: FONT_SANS, fontSize: 10, fill: T.textMid }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 9, fill: T.textDim }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => [`$${Math.round(v).toLocaleString()}`, 'Booked']} />
              <Bar dataKey="bookings" fill={T.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* YTD Losses */}
      {ytdLosses.length > 0 && (
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.red, letterSpacing: '0.04em', marginBottom: '10px' }}>
            <Tip label="Deals lost year-to-date by this seller. Includes competitive losses, no-decisions, and churn.">YTD Losses ({ytdLosses.length})</Tip>
          </div>
          {ytdLosses.map((d, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '2fr 1.5fr 0.8fr 1fr',
              gap: '4px', padding: '6px 8px', fontSize: '11px',
              background: i % 2 ? T.surface : 'transparent', borderRadius: '4px',
            }}>
              <div style={{ fontWeight: 600 }}>{d.accountName}</div>
              <div style={{ color: T.textMid }}>{d.product}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.red }}>-{$(Math.abs(d.mrr))}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}>{d.date}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function KPICard({ label, value, sub, pace }) {
  const color = paceColor(pace)
  return (
    <div style={{
      background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW,
      padding: '14px', borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '6px', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '20px', fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textMid, marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}
