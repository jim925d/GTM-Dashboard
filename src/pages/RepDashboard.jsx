import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line,
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
function PaceBar({ actual, expected, quota }) {
  const pctActual = quota > 0 ? actual / quota : 0
  const pctExpected = quota > 0 ? expected / quota : 0
  const color = paceColor(pctExpected > 0 ? pctActual / pctExpected : 0)

  return (
    <div style={{ background: T.surface, borderRadius: '6px', padding: '8px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim }}>Pace to Quota</span>
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

export default function RepDashboard({ accounts, rawData }) {
  const [tab, setTab] = useState('accounts')
  const [selectedRep, setSelectedRep] = useState('')
  const [showFilter, setShowFilter] = useState('all')
  const [sortBy, setSortBy] = useState('risk')
  const [userTarget, setUserTarget] = useState('')
  const [periodMode, setPeriodMode] = useState('quarter') // 'month' or 'quarter'
  const [accountSearch, setAccountSearch] = useState('')

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

  // Active deals across ALL accounts where this seller is the opportunity owner (rep)
  // or where the account belongs to this seller
  const allActiveDeals = useMemo(() =>
    accounts.flatMap(acc =>
      (acc.active_deals || [])
        .filter(d => (d.rep || '').trim() === rep || (acc.sales_owner || '').trim() === rep)
        .map(d => ({ ...d, accountName: acc.name }))
    ), [accounts, rep])

  // Funnel closed deals: from funnel.csv ONLY — used for bookings & forecast
  // historical_deals (from historical.csv/JSON) is for modeling/predictions only
  const funnelClosed = useMemo(() =>
    accounts.flatMap(acc =>
      (acc.funnel_closed || [])
        .filter(d => (d.rep || '').trim() === rep || (acc.sales_owner || '').trim() === rep)
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
  const periodStart = periodMode === 'month' ? mStart : qStart
  const periodEnd = periodMode === 'month' ? mEnd : qEnd
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
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1)
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
  const periodBookings = periodMode === 'month' ? mtdBookings : qtdBookings

  // User target overrides quota
  const parsedTarget = parseFloat(String(userTarget).replace(/[^0-9.]/g, '')) || 0
  const annualQuota = parseFloat(repProfile?.annual_quota) || 0
  const qQuotaKey = `q${currentQ}_quota`
  const csvQuarterlyQuota = parseFloat(repProfile?.[qQuotaKey]) || (annualQuota / 4)
  const quarterlyQuota = parsedTarget > 0 ? parsedTarget : csvQuarterlyQuota
  const monthlyQuota = parsedTarget > 0 ? parsedTarget : (csvQuarterlyQuota / 3)
  const periodQuota = periodMode === 'month' ? monthlyQuota : quarterlyQuota
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
        {repProfile && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <Badge color={T.teal}>{repProfile.territory || repProfile.team || ''}</Badge>
            <Badge color={T.purple}>{repProfile.team || ''}</Badge>
          </div>
        )}

        <div style={{ width: '1px', height: '20px', background: T.border }} />

        {/* Target Input */}
        <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim }}>Target</div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim }}>$</span>
          <input
            type="text"
            value={userTarget}
            onChange={e => setUserTarget(e.target.value)}
            placeholder={periodMode === 'month' ? $k(monthlyQuota) : $k(quarterlyQuota)}
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
      />}

      {/* TAB 2: MY PIPELINE */}
      {tab === 'pipeline' && <MyPipelineTab
        allActiveDeals={allActiveDeals} repAccounts={repAccounts} rep={rep}
        totalPipelineMRR={totalPipelineMRR} weightedPipeline={weightedPipeline}
        targetRemaining={targetRemaining} closedWonDeals={closedWonDeals}
        periodQuota={periodQuota} funnelClosed={funnelClosed}
        periodMode={periodMode} currentQ={currentQ} currentMonthName={currentMonthName}
      />}

      {/* TAB 3: KPI SCORECARD */}
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
          <AttainmentRing value={periodBookings} quota={periodQuota} label={periodMode === 'month' ? `${currentMonthName} Attainment` : `Q${currentQ} Attainment`} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          <Stat label={<Tip label={`SUM(deal MRR) where: Forecast Category = Closed, MRR > 0, Close Date in ${periodMode === 'month' ? currentMonthName : 'Q' + currentQ} ${now.getFullYear()}, Major Project = blank, Opp Owner = selected seller, Sales Channel = Premier. Source: funnel.csv`}>{periodMode === 'month' ? 'MTD' : 'QTD'} Bookings</Tip>} value={`${$k(periodBookings)}/mo`} sub={periodQuota > 0 ? `of ${$k(periodQuota)} target` : 'no target set'} color={paceColor(periodQuota > 0 ? periodBookings / expectedPeriod : 1)} />
          <Stat label={<Tip label={`SUM(deal MRR) where: Forecast Category = Closed, MRR > 0, Close Date >= 1/1/${now.getFullYear()} and < 1/1/${now.getFullYear() + 1}, Major Project = blank, Opp Owner = selected seller, Sales Channel = Premier. Source: funnel.csv`}>YTD Bookings</Tip>} value={`${$k(ytdBookings)}/mo`} sub={annualQuota > 0 ? `of ${$k(annualQuota)} annual` : ''} color={T.cyan} />
          <Stat label={<Tip label={`SUM(deal MRR × Stage Win Prob) ÷ (Target − Bookings). Excludes booked deals. = ${$k(weightedPipeline)} ÷ ${$k(targetRemaining)} = ${pipelineCoverage.toFixed(1)}x. Win probs: Discover 30.6%, Design 53.2%, Propose 66.2%, Negotiate 84.7%, Verbal 92.5%`}>Pipeline Coverage</Tip>} value={`${pipelineCoverage.toFixed(1)}x`} sub={`${$k(weightedPipeline)}/mo vs ${$k(targetRemaining)}/mo gap`} color={pipelineCoverage >= 3 ? T.green : pipelineCoverage >= 1.5 ? T.yellow : T.red} />
          <Stat label={<Tip label="SUM(Total ARR) across all accounts where Sales Owner = selected seller. Source: customers.csv Total BRR field.">Book of Business</Tip>} value={$(bookARR)} sub={`${repAccounts.length} accounts`} color={T.teal} />
        </div>
      </div>

      {/* Pace bar */}
      {periodQuota > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <PaceBar actual={periodBookings} expected={expectedPeriod} quota={periodQuota} />
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              <MiniStat label="Pipeline" value={`${$k(acc.pipeline_mrr || 0)}/mo`} color={T.purple} />
              <MiniStat label="Deals" value={(acc.active_deals?.length || 0) + (acc.funnel_closed?.length || 0)} color={T.cyan} />
              <MiniStat label="Win Rate" value={pc(acc.win_rate)} color={acc.win_rate > 0.6 ? T.green : T.yellow} />
              <MiniStat label="NRR" value={pc(acc.nrr)} color={acc.nrr >= 1 ? T.green : acc.nrr >= 0.9 ? T.yellow : T.red} />
              <MiniStat label="Last Eng" value={ds < 999 ? `${ds}d` : '---'} color={ds <= 30 ? T.green : ds <= 90 ? T.yellow : T.red} />
            </div>
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
                        {stage}: {data.count} deal{data.count > 1 ? 's' : ''} · {$k(data.mrr)}/mo
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
  targetRemaining, closedWonDeals, periodQuota, funnelClosed,
  periodMode, currentQ, currentMonthName,
}) {
  const now = new Date()
  const thirtyDaysOut = new Date(now.getTime() + 30 * 86400000)

  const stalledDeals = allActiveDeals.filter(d => {
    const created = parseDate(d.close)
    return !d.next_step || (created && daysSince(d.close) < -30 === false)
  })
  const closingSoon = allActiveDeals.filter(d => {
    const dt = parseDate(d.close)
    return dt && dt <= thirtyDaysOut && dt >= now
  })

  // Pipeline by stage with raw + weighted values
  const stageData = useMemo(() => {
    const stages = {}
    for (const d of allActiveDeals) {
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
  }, [allActiveDeals])

  const rawTotal = stageData.reduce((s, d) => s + d.raw, 0)
  const weightedTotal = stageData.reduce((s, d) => s + d.weighted, 0)

  // Sorted deal list (highest probability stages first)
  const sortedDeals = useMemo(() => {
    const order = { Accepted: -1, 'Verbal Agreement': 0, Negotiate: 1, Propose: 2, 'Design Solution': 3, Design: 3, Discover: 4 }
    return [...allActiveDeals].sort((a, b) => (order[a.stage] ?? 5) - (order[b.stage] ?? 5))
  }, [allActiveDeals])

  // MRR trajectory data: monthly cumulative from POSITIVE MRR deals only
  const trajectoryData = useMemo(() => {
    const now = new Date()
    const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const months = {}

    // Build monthly bookings from funnel closed deals — positive MRR only
    for (const d of funnelClosed) {
      const dt = parseDate(d.close)
      if (!dt) continue
      const mrr = d.mrr || 0
      if (mrr <= 0) continue // only positive MRR deals
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      if (!months[key]) months[key] = { month: key, booked: 0, projected: 0 }
      months[key].booked += mrr
    }

    // Forecast: use each active deal's close date, weighted by stage win probability
    for (const d of allActiveDeals) {
      const dt = parseDate(d.close)
      const mrr = d.mrr || 0
      if (!dt || mrr <= 0) continue
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      if (key <= nowKey) continue // skip deals with close dates in the past
      if (!months[key]) months[key] = { month: key, booked: 0, projected: 0 }
      months[key].projected += mrr * stageProb(d.stage)
    }

    const sorted = Object.values(months).sort((a, b) => a.month.localeCompare(b.month))
    let cumActual = 0
    let cumForecast = 0
    return sorted.map(m => {
      cumActual += m.booked || 0
      cumForecast += m.projected || 0
      const result = { month: m.month }
      if (m.month <= nowKey) {
        result.actual = Math.round(cumActual)
      }
      if (m.month >= nowKey && cumForecast > 0) {
        result.forecast = Math.round(cumActual + cumForecast)
      }
      return result
    })
  }, [funnelClosed, allActiveDeals])

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <Stat label={<Tip label="Total raw MRR across all active deals in the pipeline.">Pipeline MRR</Tip>} value={`${$k(totalPipelineMRR)}/mo`} sub={`${allActiveDeals.length} deals`} color={T.purple} />
        <Stat label={<Tip label="SUM(Deal MRR × Stage Win Probability). Excludes deals already forecast as Closed. Discover 30.6%, Design Solution 53.2%, Propose 66.2%, Negotiate 84.7%, Verbal Agreement 92.5%.">Prob-Adjusted Pipeline</Tip>} value={`${$k(weightedPipeline)}/mo`} sub="SUM(MRR × Stage Win %)" color={T.teal} />
        <Stat label={<Tip label={`Remaining target for the current ${periodMode} after subtracting bookings already closed.`}>Target Remaining</Tip>} value={$k(targetRemaining)} color={T.orange} />
        <Stat label={<Tip>CLOSING IN 30D</Tip>} value={closingSoon.length} sub={`${$k(closingSoon.reduce((s, d) => s + (d.mrr || 0), 0))}/mo`} color={T.green} />
        <Stat label={<Tip>STALLED</Tip>} value={stalledDeals.length} color={stalledDeals.length > 0 ? T.red : T.green} />
      </div>

      {/* Pipeline by Stage — raw vs weighted */}
      <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em' }}>
            <Tip label="Probability-adjusted pipeline: each deal's MRR x its stage win probability. Discover 30.57%, Design Solution 53.21%, Propose 66.23%, Negotiate 84.67%, Verbal Agreement 92.49%, Closed 100%.">
              PIPELINE BY STAGE (PROBABILITY-WEIGHTED)
            </Tip>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontFamily: FONT_MONO, fontSize: '10px' }}>
            <span style={{ color: T.textMid }}>Raw: <span style={{ color: T.purple, fontWeight: 600 }}>{$k(rawTotal)}/mo</span></span>
            <span style={{ color: T.textMid }}>Weighted: <span style={{ color: T.teal, fontWeight: 700 }}>{$k(weightedTotal)}/mo</span></span>
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
                  <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.purple }}>{$k(s.raw)}/mo</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>→</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 700, color: T.teal }}>{$k(s.weighted)}/mo</span>
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

      {/* MRR Trajectory with Forecast Projection */}
      {trajectoryData.length > 0 && (
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px', marginBottom: '16px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip label="Positive MRR deals only. Solid line shows actual cumulative MRR from closed-won bookings by month. Dashed line projects future months using each active deal's expected close date weighted by its stage win probability (Discover 30.6%, Design Solution 53.2%, Propose 66.2%, Negotiate 84.7%, Verbal Agreement 92.5%).">
              MRR TRAJECTORY + FORECAST
            </Tip>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={trajectoryData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="month" tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={chartTheme.tooltip} formatter={(v, name) => [`$${Math.round(v).toLocaleString()}/mo`, name === 'actual' ? 'Actual MRR' : 'Forecast']} />
              <Line type="monotone" dataKey="actual" stroke={T.cyan} strokeWidth={2} dot={false} name="actual" />
              <Line type="monotone" dataKey="forecast" stroke={T.purple} strokeWidth={2} strokeDasharray="6 3" dot={false} name="forecast" />
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
// TAB 3: KPI SCORECARD
// =======================================================================

function KPITab({
  repAccounts, rep, repProfile, periodBookings, ytdBookings,
  periodQuota, annualQuota, closedWonDeals, funnelClosed,
  allActiveDeals, expectedPeriod, periodPacePct, currentQ,
  periodMode, currentMonthName, qtdBookings,
}) {
  const now = new Date()

  // Win rate — from funnel.csv closed deals only
  const allClosed = funnelClosed.filter(d => {
    const s = normalizeStage(d.stage)
    return s === 'closed won' || s === 'closed lost'
  })
  const totalWon = allClosed.filter(d => normalizeStage(d.stage) === 'closed won' && (d.mrr || 0) >= 0).length
  const totalLost = allClosed.filter(d => normalizeStage(d.stage) === 'closed lost').length
  const winRate = (totalWon + totalLost) > 0 ? totalWon / (totalWon + totalLost) : 0

  // Avg deal size
  const avgDealSize = closedWonDeals.length > 0
    ? closedWonDeals.reduce((s, d) => s + (d.mrr || 0), 0) / closedWonDeals.length * 12
    : 0

  // Pipeline generated (deals created this quarter)
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const pipelineGen = allActiveDeals.reduce((s, d) => s + (d.mrr || 0) * 12, 0)

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
        <KPICard label={<Tip label={`Won ÷ (Won + Lost) = ${totalWon} ÷ (${totalWon} + ${totalLost}) = ${pc(winRate)}. From all closed deals for this seller. Source: funnel.csv`}>Win Rate</Tip>} value={pc(winRate)} sub={`${totalWon}W / ${totalLost}L`} pace={winRate >= 0.5 ? 1.1 : winRate >= 0.3 ? 0.85 : 0.5} />
        <KPICard label={<Tip label={`SUM(closed-won MRR × 12) ÷ count of closed-won deals = ${$k(avgDealSize)}. Positive MRR deals only. Source: funnel.csv`}>Avg Deal Size</Tip>} value={$k(avgDealSize)} sub={`${closedWonDeals.length} deals`} pace={1} />
        <KPICard label={<Tip label={`SUM(active deal MRR × 12) = ${$k(pipelineGen)}. ${allActiveDeals.length} non-closed deals with MRR > 0. Source: funnel.csv`}>Pipeline Generated</Tip>} value={$k(pipelineGen)} sub={`${allActiveDeals.length} open deals`} pace={1} />
        <KPICard label={<Tip label="Count of accounts that have at least one active (non-closed) deal in the pipeline.">Active Accounts</Tip>} value={repAccounts.filter(a => (a.active_deals?.length || 0) > 0).length} sub={`of ${repAccounts.length} total`} pace={1} />
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
              <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.red }}>-{$(Math.abs(d.mrr))}/mo</div>
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
