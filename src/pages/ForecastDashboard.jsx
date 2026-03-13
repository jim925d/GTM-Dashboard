import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, ReferenceLine,
  LineChart, Cell,
} from 'recharts'
import { T, FONT_MONO, FONT_SANS, RADIUS, CARD_SHADOW, STAGE_COLORS, STAGE_WIN_PROB, STAGE_ORDER, stageProb } from '../lib/constants'
import Badge from '../components/shared/Badge'
import Stat from '../components/shared/Stat'
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

function isClosed(stage) {
  const n = normalizeStage(stage)
  return n === 'closed won' || n === 'closed lost'
}

function isPremier(d) {
  const ch = (d.sales_channel || '').toLowerCase().trim()
  return ch === 'premier'
}

function paceColor(pct) {
  if (pct >= 1.0) return T.green
  if (pct >= 0.75) return T.yellow
  return T.red
}

// --- Tab Button ---
function TabBtn({ active, label, onClick }) {
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

// Forecast category ordering
const FORECAST_ORDER = ['Closed', 'Commit', 'Best Case', 'Longshot', 'Not In Forecast']
function normalizeForecast(f) {
  if (!f) return 'Not In Forecast'
  const l = f.toLowerCase().trim()
  if (l === 'closed' || l === 'closed won') return 'Closed'
  if (l === 'commit') return 'Commit'
  if (l === 'best case') return 'Best Case'
  if (l === 'longshot') return 'Longshot'
  return 'Not In Forecast'
}

// =======================================================================
// FORECAST DASHBOARD
// =======================================================================

export default function ForecastDashboard({ accounts, rawData }) {
  const [tab, setTab] = useState('overview')
  const [periodMode, setPeriodMode] = useState('quarter')

  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const currentQ = Math.floor(now.getMonth() / 3) + 1
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 1) // 1st of next quarter
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1) // 1st of next month
  const currentMonthName = now.toLocaleString('default', { month: 'long' })

  // All active deals — ONLY Premier channel
  const allActiveDeals = useMemo(() =>
    accounts.flatMap(acc =>
      (acc.active_deals || [])
        .filter(d => isPremier(d))
        .map(d => ({ ...d, accountName: acc.name, sales_owner: acc.sales_owner }))
    ), [accounts])

  // Funnel closed deals: from funnel.csv ONLY — used for bookings & forecast
  // historical_deals (from historical.csv/JSON) is for modeling/predictions only
  const funnelClosed = useMemo(() =>
    accounts.flatMap(acc =>
      (acc.funnel_closed || [])
        .filter(d => isPremier(d))
        .map(d => ({ ...d, accountName: acc.name, sales_owner: acc.sales_owner }))
    ), [accounts])

  // Historical deals — for modeling/predictions only (NOT bookings)
  const allHistorical = useMemo(() =>
    accounts.flatMap(acc =>
      (acc.historical_deals || [])
        .filter(d => isPremier(d))
        .map(d => ({ ...d, accountName: acc.name, sales_owner: acc.sales_owner }))
    ), [accounts])

  // Closed won deals (positive MRR) — from funnel.csv, Premier only
  const closedWonDeals = useMemo(() =>
    funnelClosed.filter(d => {
      const s = normalizeStage(d.stage)
      return s === 'closed won' && (d.mrr || 0) > 0
    }), [funnelClosed])

  // Churn deals (negative MRR) — from funnel.csv
  const churnDeals = useMemo(() =>
    funnelClosed.filter(d => (d.mrr || 0) < 0),
    [funnelClosed])

  // ---- Key Metrics ----

  const periodStart = periodMode === 'month' ? mStart : qStart
  const periodEnd = periodMode === 'month' ? mEnd : qEnd // full month/quarter boundary

  // All funnel deals for bookings: active pipeline + funnel closed (NOT historical.csv)
  const allFunnelDeals = useMemo(() => [...allActiveDeals, ...funnelClosed], [allActiveDeals, funnelClosed])

  // 1. Total MRR: total positive MRR in funnel where close date is in the selected period
  const totalMRR = useMemo(() =>
    allFunnelDeals
      .filter(d => {
        if ((d.mrr || 0) <= 0) return false
        const dt = parseDate(d.close)
        return dt && dt >= periodStart && dt < periodEnd
      })
      .reduce((s, d) => s + (d.mrr || 0), 0),
    [allFunnelDeals, periodStart, periodEnd])

  // Helper: deal counts as a booking — forecast category = Closed AND major_project is blank
  const isBooking = (d) => {
    if (normalizeForecast(d.forecast) !== 'Closed') return false
    if (d.major_project) return false // exclude major project deals
    return true
  }

  const yearEnd = new Date(now.getFullYear() + 1, 0, 1)

  // 2. YTD Bookings: forecast=Closed, major_project blank, close date in current year
  const ytdBookings = useMemo(() =>
    allFunnelDeals.filter(d => {
      if ((d.mrr || 0) <= 0) return false
      if (!isBooking(d)) return false
      const dt = parseDate(d.close)
      return dt && dt >= yearStart && dt < yearEnd
    }).reduce((s, d) => s + (d.mrr || 0), 0), [allFunnelDeals])

  // 3. MTD/QTD Bookings: forecast=Closed, major_project blank, close date in full period
  const periodBookings = useMemo(() =>
    allFunnelDeals.filter(d => {
      if ((d.mrr || 0) <= 0) return false
      if (!isBooking(d)) return false
      const dt = parseDate(d.close)
      return dt && dt >= periodStart && dt < periodEnd
    }).reduce((s, d) => s + (d.mrr || 0), 0), [allFunnelDeals, periodStart, periodEnd])

  // Active deals: current non-closed deals with positive MRR
  const currentActiveDeals = useMemo(() =>
    allActiveDeals.filter(d => !isClosed(d.stage) && (d.mrr || 0) > 0),
    [allActiveDeals])

  // Pipeline metrics — weighted by stage win probability (MRR, not annualized)
  const weightedPipeline = currentActiveDeals.reduce((s, d) =>
    s + (d.mrr || 0) * stageProb(d.stage), 0)

  // 4. Win Rate: wins / losses only for deals with close date in current month/quarter
  const periodClosed = useMemo(() =>
    allFunnelDeals.filter(d => {
      const s = normalizeStage(d.stage)
      if (s !== 'closed won' && s !== 'closed lost') return false
      const dt = parseDate(d.close)
      return dt && dt >= periodStart && dt <= now
    }), [allFunnelDeals, periodStart])
  const totalWon = periodClosed.filter(d => normalizeStage(d.stage) === 'closed won' && (d.mrr || 0) > 0).length
  const totalLost = periodClosed.filter(d => normalizeStage(d.stage) === 'closed lost').length
  const winRate = (totalWon + totalLost) > 0 ? totalWon / (totalWon + totalLost) : 0

  return (
    <div>
      {/* Period Toggle + Premier Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <Badge color={T.green}>PREMIER CHANNEL ONLY</Badge>
        <div style={{ width: '1px', height: '20px', background: T.border }} />
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
          {currentActiveDeals.length} active deals · {accounts.length} accounts
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '16px', padding: '4px',
        background: T.surface, borderRadius: RADIUS, width: 'fit-content',
      }}>
        <TabBtn active={tab === 'overview'} label="Overview" onClick={() => setTab('overview')} />
        <TabBtn active={tab === 'bookings'} label="Bookings Forecast" onClick={() => setTab('bookings')} />
        <TabBtn active={tab === 'churn'} label="Churn Model" onClick={() => setTab('churn')} />
        <TabBtn active={tab === 'patterns'} label="Buy Patterns" onClick={() => setTab('patterns')} />
        <TabBtn active={tab === 'product'} label="Product Intel" onClick={() => setTab('product')} />
        <TabBtn active={tab === 'health'} label="Account Health" onClick={() => setTab('health')} />
      </div>

      {tab === 'overview' && <OverviewTab
        accounts={accounts} currentActiveDeals={currentActiveDeals} funnelClosed={funnelClosed}
        closedWonDeals={closedWonDeals} churnDeals={churnDeals}
        totalMRR={totalMRR} weightedPipeline={weightedPipeline}
        ytdBookings={ytdBookings} periodBookings={periodBookings}
        winRate={winRate} totalWon={totalWon} totalLost={totalLost}
        currentQ={currentQ} periodMode={periodMode} currentMonthName={currentMonthName}
        allActiveDeals={allActiveDeals}
      />}

      {tab === 'bookings' && <BookingsForecastTab
        currentActiveDeals={currentActiveDeals} funnelClosed={funnelClosed}
        closedWonDeals={closedWonDeals} weightedPipeline={weightedPipeline}
        totalMRR={totalMRR} currentQ={currentQ}
        allActiveDeals={allActiveDeals}
      />}

      {tab === 'churn' && <ChurnTab
        accounts={accounts} allHistorical={allHistorical} churnDeals={churnDeals}
      />}

      {tab === 'patterns' && <BuyPatternsTab
        closedWonDeals={closedWonDeals} allHistorical={allHistorical} currentQ={currentQ}
        currentActiveDeals={currentActiveDeals}
      />}

      {tab === 'product' && <ProductIntelTab
        accounts={accounts} currentActiveDeals={currentActiveDeals} closedWonDeals={closedWonDeals}
      />}

      {tab === 'health' && <AccountHealthTab accounts={accounts} />}
    </div>
  )
}

// =======================================================================
// OVERVIEW TAB
// =======================================================================

function OverviewTab({
  accounts, currentActiveDeals, funnelClosed, closedWonDeals, churnDeals,
  totalMRR, weightedPipeline, ytdBookings, periodBookings,
  winRate, totalWon, totalLost, currentQ, periodMode, currentMonthName,
  allActiveDeals,
}) {
  // MRR Forecast: funnel.csv deals only (active + closed from funnel)
  // Filters: Close Date in period, MRR > 0, Major Project blank, Premier (already filtered)
  // Raw = sum of MRR per stage, Forecast = sum of MRR × stage win probability
  const now = new Date()
  const allFunnel = useMemo(() => [...allActiveDeals, ...funnelClosed], [allActiveDeals, funnelClosed])
  const trajectoryData = useMemo(() => {
    const months = {}

    for (const d of allFunnel) {
      const mrr = d.mrr || 0
      if (mrr <= 0) continue
      if (d.major_project) continue // exclude major project deals
      const dt = parseDate(d.close)
      if (!dt) continue
      // Filter to current period
      if (periodMode === 'month') {
        if (dt.getFullYear() !== now.getFullYear() || dt.getMonth() !== now.getMonth()) continue
      } else {
        const q = Math.floor(now.getMonth() / 3)
        if (dt.getFullYear() !== now.getFullYear() || Math.floor(dt.getMonth() / 3) !== q) continue
      }
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      if (!months[key]) months[key] = { month: key, raw: 0, forecast: 0, deals: 0 }
      months[key].raw += mrr
      months[key].forecast += mrr * stageProb(d.stage)
      months[key].deals++
    }

    const result = Object.values(months)

    // If quarter mode, ensure all 3 months exist
    if (periodMode === 'quarter') {
      const q = Math.floor(now.getMonth() / 3)
      for (let i = 0; i < 3; i++) {
        const mo = q * 3 + i
        const key = `${now.getFullYear()}-${String(mo + 1).padStart(2, '0')}`
        if (!result.find(m => m.month === key)) {
          result.push({ month: key, raw: 0, forecast: 0, deals: 0 })
        }
      }
    }

    return result.sort((a, b) => a.month.localeCompare(b.month)).map(m => ({
      ...m,
      raw: Math.round(m.raw),
      forecast: Math.round(m.forecast),
    }))
  }, [allFunnel, periodMode])

  // Quarterly Net New MRR — from funnel.csv closed deals only
  const quarterlyNetNew = useMemo(() => {
    const quarters = {}
    for (const d of funnelClosed) {
      if (d.major_project) continue
      const dt = parseDate(d.close)
      if (!dt) continue
      const q = `${dt.getFullYear()} Q${Math.floor(dt.getMonth() / 3) + 1}`
      if (!quarters[q]) quarters[q] = { quarter: q, booked: 0, churn: 0 }
      const mrr = d.mrr || 0
      if (mrr >= 0) quarters[q].booked += mrr * 12
      else quarters[q].churn += Math.abs(mrr) * 12
    }
    return Object.values(quarters)
      .sort((a, b) => a.quarter.localeCompare(b.quarter))
      .slice(-8)
      .map(q => ({ ...q, net: q.booked - q.churn }))
  }, [funnelClosed])

  // 4. Pipeline by stage — positive MRR only, exclude major projects
  const stageData = useMemo(() => {
    const stages = {}
    for (const d of currentActiveDeals) {
      if ((d.mrr || 0) <= 0) continue
      if (d.major_project) continue
      const s = d.stage || 'Unknown'
      if (!stages[s]) stages[s] = { stage: s, count: 0, raw: 0, weighted: 0, prob: stageProb(s) }
      stages[s].count++
      stages[s].raw += (d.mrr || 0)
      stages[s].weighted += (d.mrr || 0) * stageProb(s)
    }
    return STAGE_ORDER.filter(s => stages[s]).map(s => stages[s]).concat(
      Object.values(stages).filter(s => !STAGE_ORDER.includes(s.stage))
    )
  }, [currentActiveDeals])

  const totalWeightedMRR = stageData.reduce((s, d) => s + d.weighted, 0)
  const totalRawMRR = stageData.reduce((s, d) => s + d.raw, 0)

  return (
    <div>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <Stat label={<Tip label={`SUM(deal MRR) where: MRR > 0, Close Date in ${periodMode === 'month' ? currentMonthName : 'Q' + currentQ} ${now.getFullYear()}, Sales Channel = Premier. Source: funnel.csv`}>Total MRR</Tip>} value={`${$k(totalMRR)}/mo`} color={T.cyan} />
        <Stat label={<Tip label={`SUM(deal MRR) where: Forecast Category = Closed, MRR > 0, Close Date >= 1/1/${now.getFullYear()} and < 1/1/${now.getFullYear() + 1}, Major Project = blank, Sales Channel = Premier. Source: funnel.csv`}>YTD Bookings</Tip>} value={`${$k(ytdBookings)}/mo`} color={T.green} />
        <Stat label={<Tip label={`SUM(deal MRR) where: Forecast Category = Closed, MRR > 0, Close Date in ${periodMode === 'month' ? currentMonthName : 'Q' + currentQ} ${now.getFullYear()}, Major Project = blank, Sales Channel = Premier. Source: funnel.csv`}>{periodMode === 'month' ? 'MTD' : 'QTD'} Bookings</Tip>} value={`${$k(periodBookings)}/mo`} color={T.teal} />
        <Stat label={<Tip label={`SUM(deal MRR × Stage Win Prob) for active pipeline deals. Major Project = blank, Sales Channel = Premier. Win probs: Discover ${(stageProb('Discover') * 100).toFixed(1)}%, Design ${(stageProb('Design Solution') * 100).toFixed(1)}%, Propose ${(stageProb('Propose') * 100).toFixed(1)}%, Negotiate ${(stageProb('Negotiate') * 100).toFixed(1)}%, Verbal ${(stageProb('Verbal Agreement') * 100).toFixed(1)}%`}>Weighted Pipeline</Tip>} value={`${$k(weightedPipeline)}/mo`} sub={`Raw: ${$k(totalRawMRR)}/mo`} color={T.purple} />
        <Stat label={<Tip label={`Won ÷ (Won + Lost) where: Close Date in ${periodMode === 'month' ? currentMonthName : 'Q' + currentQ} ${now.getFullYear()}, Sales Channel = Premier. = ${totalWon} ÷ (${totalWon} + ${totalLost}) = ${pc(winRate)}. Source: funnel.csv`}>Win Rate</Tip>} value={pc(winRate)} sub={`${totalWon}W / ${totalLost}L`} color={winRate >= 0.5 ? T.green : T.yellow} />
        <Stat label={<Tip label="Count of non-closed deals with MRR > 0 in the active pipeline. Sales Channel = Premier. Source: funnel.csv">Active Deals</Tip>} value={currentActiveDeals.length} sub={`${accounts.length} accounts`} color={T.blue} />
      </div>

      {/* MRR Forecast — current period only */}
      <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px', marginBottom: '16px' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
          <Tip label={`Per stage: Raw = SUM(deal MRR), Forecast = SUM(deal MRR × Stage Win Prob). Filters: MRR > 0, Close Date in ${periodMode === 'month' ? currentMonthName : 'Q' + currentQ}, Major Project = blank, Sales Channel = Premier. Source: funnel.csv`}>
            MRR FORECAST — {periodMode === 'month' ? currentMonthName.toUpperCase() : `Q${currentQ}`} {new Date().getFullYear()}
          </Tip>
        </div>
        {trajectoryData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trajectoryData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="month" tick={{ fontFamily: FONT_MONO, fontSize: 9, fill: T.textDim }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} width={50} />
              <Tooltip contentStyle={chartTheme.tooltip} formatter={(v, name) => [`$${Math.round(v).toLocaleString()}/mo`, name === 'raw' ? 'Raw Pipeline MRR' : 'Stage-Weighted Forecast']} />
              <Bar dataKey="raw" fill={`${T.purple}50`} radius={[4, 4, 0, 0]} name="raw" />
              <Bar dataKey="forecast" fill={T.teal} radius={[4, 4, 0, 0]} name="forecast" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}>No forecast data for this period</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Quarterly Net New MRR */}
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip label="Per quarter: Bookings = SUM(MRR) where MRR >= 0, Churn = SUM(|MRR|) where MRR < 0. Both × 12 for ARR. Excludes Major Projects. Sales Channel = Premier. Source: funnel.csv closed deals.">
              QUARTERLY NET NEW MRR
            </Tip>
          </div>
          {quarterlyNetNew.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={quarterlyNetNew} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="quarter" tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} width={45} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => [`$${Math.round(v).toLocaleString()}`, '']} />
                <Bar dataKey="booked" fill={T.green} radius={[4, 4, 0, 0]} name="Bookings" />
                <Bar dataKey="churn" fill={T.red} radius={[4, 4, 0, 0]} name="Churn" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}>No quarterly data</div>
          )}
        </div>

        {/* Pipeline by Stage — positive MRR only */}
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em' }}>
              <Tip label={`Per stage: Raw = SUM(deal MRR), Weighted = SUM(deal MRR × Win Prob). Active deals only, MRR > 0, Major Project = blank, Premier. Win probs: Disc ${(stageProb('Discover') * 100).toFixed(0)}%, Design ${(stageProb('Design Solution') * 100).toFixed(0)}%, Prop ${(stageProb('Propose') * 100).toFixed(0)}%, Neg ${(stageProb('Negotiate') * 100).toFixed(0)}%, VA ${(stageProb('Verbal Agreement') * 100).toFixed(0)}%`}>
                PIPELINE BY STAGE (MRR)
              </Tip>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '10px' }}>
              <span style={{ color: T.purple }}>{$k(totalRawMRR)}/mo</span>
              <span style={{ color: T.textDim }}> → </span>
              <span style={{ color: T.teal, fontWeight: 700 }}>{$k(totalWeightedMRR)}/mo</span>
            </div>
          </div>
          {stageData.map(s => {
            const maxRaw = Math.max(...stageData.map(x => x.raw), 1)
            const barPct = (s.raw / maxRaw) * 100
            const color = STAGE_COLORS[s.stage] || T.textDim
            return (
              <div key={s.stage} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: FONT_SANS, fontSize: '10px', fontWeight: 600, color }}>{s.stage}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>({(s.prob * 100).toFixed(1)}%)</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>{s.count}</span>
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '9px' }}>
                    <span style={{ color: T.purple }}>{$k(s.raw)}/mo</span>
                    <span style={{ color: T.textDim }}> → </span>
                    <span style={{ color: T.teal, fontWeight: 600 }}>{$k(s.weighted)}/mo</span>
                  </div>
                </div>
                <div style={{ position: 'relative', height: '5px', background: T.border, borderRadius: '3px' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '3px', width: `${barPct}%`, background: `${color}40` }} />
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '3px', width: `${barPct * s.prob}%`, background: color }} />
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
// BOOKINGS FORECAST TAB
// =======================================================================

function BookingsForecastTab({
  currentActiveDeals, funnelClosed, closedWonDeals, weightedPipeline,
  totalMRR, currentQ, allActiveDeals,
}) {
  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)

  // Pipeline by stage (positive MRR only, exclude major projects)
  const stageData = useMemo(() => {
    const stages = {}
    for (const d of currentActiveDeals) {
      if ((d.mrr || 0) <= 0) continue
      if (d.major_project) continue
      const s = d.stage || 'Unknown'
      if (!stages[s]) stages[s] = { stage: s, count: 0, raw: 0, weighted: 0, prob: stageProb(s) }
      stages[s].count++
      stages[s].raw += (d.mrr || 0) * 12
      stages[s].weighted += (d.mrr || 0) * stageProb(s) * 12
    }
    return STAGE_ORDER.filter(s => stages[s]).map(s => stages[s]).concat(
      Object.values(stages).filter(s => !STAGE_ORDER.includes(s.stage))
    )
  }, [currentActiveDeals])

  const totalWeightedARR = stageData.reduce((s, d) => s + d.weighted, 0)
  const totalRawARR = stageData.reduce((s, d) => s + d.raw, 0)

  // Bookings composition by quarter
  const bookingsComp = useMemo(() => {
    const quarters = {}
    for (const d of closedWonDeals) {
      const dt = parseDate(d.close)
      if (!dt) continue
      const q = `${dt.getFullYear()} Q${Math.floor(dt.getMonth() / 3) + 1}`
      if (!quarters[q]) quarters[q] = { quarter: q, 'New Logo': 0, Expansion: 0, Renewal: 0, Other: 0 }
      const t = (d.type || '').toLowerCase()
      const mrr = (d.mrr || 0) * 12
      if (t.includes('new') && !t.includes('re-rate')) quarters[q]['New Logo'] += mrr
      else if (t.includes('expansion') || t.includes('upgrade') || t.includes('re-rate') || t.includes('rerate')) quarters[q].Expansion += mrr
      else if (t.includes('renewal')) quarters[q].Renewal += mrr
      else quarters[q].Other += mrr
    }
    return Object.values(quarters).sort((a, b) => a.quarter.localeCompare(b.quarter)).slice(-8)
  }, [closedWonDeals])

  // Win rate trend by quarter — from funnel.csv closed deals
  const winRateTrend = useMemo(() => {
    const quarters = {}
    for (const d of funnelClosed) {
      if (d.major_project) continue
      const dt = parseDate(d.close)
      if (!dt) continue
      const s = normalizeStage(d.stage)
      if (s !== 'closed won' && s !== 'closed lost') continue
      const q = `${dt.getFullYear()} Q${Math.floor(dt.getMonth() / 3) + 1}`
      if (!quarters[q]) quarters[q] = { quarter: q, won: 0, lost: 0 }
      if (s === 'closed won' && (d.mrr || 0) > 0) quarters[q].won++
      else if (s === 'closed lost') quarters[q].lost++
    }
    return Object.values(quarters)
      .sort((a, b) => a.quarter.localeCompare(b.quarter))
      .slice(-8)
      .map(q => ({ ...q, rate: (q.won + q.lost) > 0 ? q.won / (q.won + q.lost) : 0 }))
  }, [funnelClosed])

  // 8. Pipeline by Forecast Category — ordered: Closed, Commit, Best Case, Longshot, Not In Forecast
  const byForecast = useMemo(() => {
    const cats = {}
    for (const d of allActiveDeals) {
      const f = normalizeForecast(d.forecast)
      if (!cats[f]) cats[f] = { category: f, count: 0, mrr: 0 }
      cats[f].count++
      cats[f].mrr += (d.mrr || 0) * 12
    }
    return FORECAST_ORDER
      .filter(f => cats[f])
      .map(f => cats[f])
  }, [allActiveDeals])

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <Stat label={<Tip label="Total raw ARR in active pipeline, positive MRR only (MRR × 12). Premier channel.">Raw Pipeline ARR</Tip>} value={$k(totalRawARR)} sub={`${currentActiveDeals.length} deals`} color={T.purple} />
        <Stat label={<Tip label="SUM(Deal MRR × Stage Win Probability × 12). The probability-adjusted view of the pipeline.">Weighted Pipeline ARR</Tip>} value={$k(totalWeightedARR)} sub="Stage-probability adjusted" color={T.teal} />
        <Stat label="Avg Deal Size" value={$k(closedWonDeals.length > 0 ? closedWonDeals.reduce((s, d) => s + (d.mrr || 0), 0) / closedWonDeals.length * 12 : 0)} sub={`${closedWonDeals.length} closed deals`} color={T.cyan} />
        <Stat label="Pipeline Deals" value={currentActiveDeals.length} sub={`across ${[...new Set(currentActiveDeals.map(d => d.accountName))].length} accounts`} color={T.blue} />
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
              const pipeData = stageData.find(s => s.stage === stage)
              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '110px', fontFamily: FONT_SANS, fontSize: '10px', color, fontWeight: 600 }}>{stage}</div>
                  <div style={{ flex: 1, position: 'relative', height: '8px', background: T.border, borderRadius: '4px' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '4px', width: `${prob * 100}%`, background: `${color}60` }} />
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

            {stageData.map(s => {
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
            {stageData.length > 0 && (
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
        {/* Bookings Composition by Quarter */}
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip label="Quarterly bookings broken down by deal type: New Logo, Expansion, Renewal, Other. Premier channel only.">
              BOOKINGS COMPOSITION BY QUARTER
            </Tip>
          </div>
          {bookingsComp.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={bookingsComp} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="quarter" tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} width={45} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => [`$${Math.round(v).toLocaleString()}`, '']} />
                <Bar dataKey="New Logo" stackId="a" fill={T.cyan} />
                <Bar dataKey="Expansion" stackId="a" fill={T.green} />
                <Bar dataKey="Renewal" stackId="a" fill={T.teal} />
                <Bar dataKey="Other" stackId="a" fill={T.textDim} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}>No data</div>
          )}
        </div>

        {/* Win Rate Trend */}
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip label="Win rate per quarter: deals closed-won ÷ (closed-won + closed-lost). Premier channel only.">
              WIN RATE TREND
            </Tip>
          </div>
          {winRateTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={winRateTrend} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="quarter" tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} width={35} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => [`${(v * 100).toFixed(1)}%`, 'Win Rate']} />
                <Line type="monotone" dataKey="rate" stroke={T.green} strokeWidth={2} dot={{ r: 3, fill: T.green }} name="Win Rate" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}>No data</div>
          )}
        </div>
      </div>

      {/* Pipeline by Forecast Category — Closed > Commit > Best Case > Longshot > Not In Forecast */}
      {byForecast.length > 0 && (
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px', marginBottom: '16px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip>PIPELINE BY FORECAST CATEGORY</Tip>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {byForecast.map(f => {
              const color = f.category === 'Closed' ? T.green : f.category === 'Commit' ? T.teal : f.category === 'Best Case' ? T.cyan : f.category === 'Longshot' ? T.yellow : T.textDim
              return (
                <div key={f.category} style={{
                  flex: 1, padding: '10px', background: T.surface, borderRadius: '8px',
                  borderLeft: `3px solid ${color}`,
                }}>
                  <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, marginBottom: '4px' }}>{f.category}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 700, color }}>{$k(f.mrr)}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>{f.count} deals</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// =======================================================================
// CHURN MODEL TAB
// =======================================================================

function ChurnTab({ accounts, allHistorical, churnDeals }) {
  // Monthly churn trend
  const monthlyChurn = useMemo(() => {
    const months = {}
    for (const d of allHistorical) {
      const dt = parseDate(d.close)
      if (!dt) continue
      const mrr = d.mrr || 0
      if (mrr >= 0) continue
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      if (!months[key]) months[key] = { month: key, churn: 0, count: 0 }
      months[key].churn += Math.abs(mrr) * 12
      months[key].count++
    }
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-12)
  }, [allHistorical])

  // Churn by reason/type
  const churnByType = useMemo(() => {
    const types = {}
    for (const d of churnDeals) {
      const t = (d.type || d.product || 'Unknown').trim()
      if (!types[t]) types[t] = { name: t, value: 0, count: 0 }
      types[t].value += Math.abs(d.mrr || 0) * 12
      types[t].count++
    }
    return Object.values(types).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [churnDeals])

  const totalChurnARR = churnDeals.reduce((s, d) => s + Math.abs(d.mrr || 0) * 12, 0)

  // At-risk accounts
  const atRiskAccounts = useMemo(() =>
    accounts.filter(a => (a.risk_score || 0) >= 30)
      .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
      .slice(0, 15),
    [accounts])

  const atRiskARR = atRiskAccounts.reduce((s, a) => s + (a.arr || 0), 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <Stat label={<Tip label="Total ARR from deals with negative MRR. Premier channel.">Total Churn ARR</Tip>} value={$k(totalChurnARR)} sub={`${churnDeals.length} deals`} color={T.red} />
        <Stat label={<Tip>AT-RISK ARR</Tip>} value={$(atRiskARR)} sub={`${atRiskAccounts.length} accounts`} color={T.orange} />
        <Stat label={<Tip>AVG CHURN DEAL</Tip>} value={$k(churnDeals.length > 0 ? totalChurnARR / churnDeals.length : 0)} color={T.red} />
        <Stat label={<Tip>CHURN RATE</Tip>} value={accounts.length > 0 ? pc(atRiskAccounts.length / accounts.length) : '---'} sub="of accounts at risk" color={T.yellow} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip>MONTHLY CHURN TREND (ARR)</Tip>
          </div>
          {monthlyChurn.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyChurn} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="month" tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} width={45} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => [`$${Math.round(v).toLocaleString()}`, 'Churn ARR']} />
                <Bar dataKey="churn" fill={T.red} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}>No churn data</div>
          )}
        </div>

        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip>CHURN BY PRODUCT/TYPE</Tip>
          </div>
          {churnByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={churnByType} layout="vertical" margin={{ left: 80, right: 10 }}>
                <XAxis type="number" tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontFamily: FONT_SANS, fontSize: 9, fill: T.textMid }} axisLine={false} tickLine={false} width={75} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => [`$${Math.round(v).toLocaleString()}`, 'ARR']} />
                <Bar dataKey="value" fill={T.red} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}>No churn data</div>
          )}
        </div>
      </div>

      {atRiskAccounts.length > 0 && (
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 0.6fr 0.8fr 0.6fr 1fr',
            gap: '4px', padding: '8px 12px', background: T.surface,
            borderBottom: `1px solid ${T.border}`,
            fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, letterSpacing: '0.04em',
          }}>
            <div>Account</div>
            <div style={{ textAlign: 'right' }}>Risk</div>
            <div style={{ textAlign: 'right' }}>ARR</div>
            <div style={{ textAlign: 'right' }}>NRR</div>
            <div>Owner</div>
          </div>
          {atRiskAccounts.map((acc, i) => (
            <div key={acc.name} style={{
              display: 'grid', gridTemplateColumns: '2fr 0.6fr 0.8fr 0.6fr 1fr',
              gap: '4px', padding: '8px 12px', fontSize: '11px',
              borderBottom: `1px solid ${T.border}`,
              background: i % 2 === 0 ? 'transparent' : `${T.surface}40`,
            }}>
              <div style={{ fontWeight: 600 }}>{acc.name}</div>
              <div style={{ textAlign: 'right' }}>
                <Badge color={acc.risk_score >= 50 ? T.red : T.orange}>{acc.risk_score}/100</Badge>
              </div>
              <div style={{ textAlign: 'right', fontFamily: FONT_MONO, fontSize: '10px', color: T.cyan }}>{$(acc.arr)}</div>
              <div style={{ textAlign: 'right', fontFamily: FONT_MONO, fontSize: '10px', color: acc.nrr >= 1 ? T.green : T.red }}>{pc(acc.nrr)}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textMid }}>{acc.sales_owner || acc.rep}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// =======================================================================
// BUY PATTERNS TAB
// =======================================================================

function BuyPatternsTab({ closedWonDeals, allHistorical, currentQ, currentActiveDeals }) {
  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)

  // 6. Booking seasonality — total closed MRR where Premier is channel (already filtered)
  const seasonality = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2000, i, 1).toLocaleString('default', { month: 'short' }),
      mrr: 0, count: 0,
    }))
    for (const d of closedWonDeals) {
      const dt = parseDate(d.close)
      if (!dt) continue
      months[dt.getMonth()].mrr += d.mrr || 0
      months[dt.getMonth()].count++
    }
    return months
  }, [closedWonDeals])

  // 5. Deal size distribution — YTD closed count + open pipeline count per bucket
  const dealSizes = useMemo(() => {
    const buckets = [
      { label: '<$1K', min: 0, max: 1000, closed: 0, pipeline: 0 },
      { label: '$1K-$5K', min: 1000, max: 5000, closed: 0, pipeline: 0 },
      { label: '$5K-$10K', min: 5000, max: 10000, closed: 0, pipeline: 0 },
      { label: '$10K-$25K', min: 10000, max: 25000, closed: 0, pipeline: 0 },
      { label: '$25K-$50K', min: 25000, max: 50000, closed: 0, pipeline: 0 },
      { label: '$50K+', min: 50000, max: Infinity, closed: 0, pipeline: 0 },
    ]
    // YTD closed deals
    for (const d of closedWonDeals) {
      const dt = parseDate(d.close)
      if (!dt || dt < yearStart) continue
      const arr = (d.mrr || 0) * 12
      const bucket = buckets.find(b => arr >= b.min && arr < b.max)
      if (bucket) bucket.closed++
    }
    // Open pipeline deals (not closed)
    for (const d of currentActiveDeals) {
      if ((d.mrr || 0) <= 0) continue
      const arr = (d.mrr || 0) * 12
      const bucket = buckets.find(b => arr >= b.min && arr < b.max)
      if (bucket) bucket.pipeline++
    }
    return buckets.filter(b => b.closed > 0 || b.pipeline > 0)
  }, [closedWonDeals, currentActiveDeals])

  // Sales cycle trend
  const cycleTrend = useMemo(() => {
    const quarters = {}
    for (const d of closedWonDeals) {
      const close = parseDate(d.close)
      const create = parseDate(d.created || d.create_date)
      if (!close || !create) continue
      const days = Math.floor((close - create) / 86400000)
      if (days < 0 || days > 730) continue
      const q = `${close.getFullYear()} Q${Math.floor(close.getMonth() / 3) + 1}`
      if (!quarters[q]) quarters[q] = { quarter: q, totalDays: 0, count: 0 }
      quarters[q].totalDays += days
      quarters[q].count++
    }
    return Object.values(quarters)
      .sort((a, b) => a.quarter.localeCompare(b.quarter))
      .slice(-8)
      .map(q => ({ ...q, avgDays: q.count > 0 ? Math.round(q.totalDays / q.count) : 0 }))
  }, [closedWonDeals])

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* 6. Booking Seasonality — total closed MRR, Premier channel */}
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip label="Total closed MRR by month, aggregated across all years. Premier Opportunity Owner Channel only.">
              BOOKING SEASONALITY (MRR)
            </Tip>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={seasonality} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="month" tick={{ fontFamily: FONT_SANS, fontSize: 9, fill: T.textMid }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} width={45} />
              <Tooltip contentStyle={chartTheme.tooltip} formatter={(v, name) => [name === 'count' ? v : `$${Math.round(v).toLocaleString()}/mo`, name === 'count' ? 'Deals' : 'MRR']} />
              <Bar dataKey="mrr" fill={T.green} radius={[4, 4, 0, 0]} name="MRR" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 5. Deal Size Distribution — YTD closed count + pipeline count */}
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip label="Count of YTD closed deals (green) and open pipeline deals (purple) per ARR bucket.">
              DEAL SIZE DISTRIBUTION (COUNT)
            </Tip>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dealSizes} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="label" tick={{ fontFamily: FONT_MONO, fontSize: 9, fill: T.textDim }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={chartTheme.tooltip} />
              <Bar dataKey="closed" fill={T.green} radius={[4, 4, 0, 0]} name="YTD Closed" />
              <Bar dataKey="pipeline" fill={T.purple} radius={[4, 4, 0, 0]} name="Open Pipeline" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sales Cycle Trend */}
      {cycleTrend.length > 0 && (
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px', marginBottom: '16px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip label="Average number of days from deal creation to close, by quarter. Premier channel only.">
              AVG SALES CYCLE (DAYS)
            </Tip>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={cycleTrend} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="quarter" tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => [`${v} days`, 'Avg Cycle']} />
              <Line type="monotone" dataKey="avgDays" stroke={T.orange} strokeWidth={2} dot={{ r: 3, fill: T.orange }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// =======================================================================
// PRODUCT INTEL TAB
// =======================================================================

function ProductIntelTab({ accounts, currentActiveDeals, closedWonDeals }) {
  // Product pipeline (from active deals)
  const productPipeline = useMemo(() => {
    const products = {}
    for (const d of currentActiveDeals) {
      if ((d.mrr || 0) <= 0) continue
      const prod = d.product || 'Unknown'
      if (!products[prod]) products[prod] = { product: prod, pipeline: 0, count: 0 }
      products[prod].pipeline += (d.mrr || 0) * 12
      products[prod].count++
    }
    return Object.values(products).sort((a, b) => b.pipeline - a.pipeline).slice(0, 12)
  }, [currentActiveDeals])

  // Product bookings
  const productBookings = useMemo(() => {
    const products = {}
    for (const d of closedWonDeals) {
      const prod = d.product || 'Unknown'
      if (!products[prod]) products[prod] = { product: prod, bookings: 0, count: 0 }
      products[prod].bookings += (d.mrr || 0) * 12
      products[prod].count++
    }
    return Object.values(products).sort((a, b) => b.bookings - a.bookings).slice(0, 10)
  }, [closedWonDeals])

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* 7. Product Pipeline — with vertical dotted gridlines */}
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip>PRODUCT BY PIPELINE (ARR)</Tip>
          </div>
          {productPipeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(180, productPipeline.length * 28)}>
              <BarChart data={productPipeline} layout="vertical" margin={{ left: 100, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
                <XAxis type="number" tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="product" tick={{ fontFamily: FONT_SANS, fontSize: 9, fill: T.textMid }} axisLine={false} tickLine={false} width={95} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => [`$${Math.round(v).toLocaleString()}`, 'Pipeline ARR']} />
                <Bar dataKey="pipeline" fill={T.purple} radius={[0, 4, 4, 0]} name="Pipeline" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}>No pipeline data</div>
          )}
        </div>

        {/* Bookings by Product — with vertical dotted gridlines */}
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip>BOOKINGS BY PRODUCT (ARR)</Tip>
          </div>
          {productBookings.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(180, productBookings.length * 28)}>
              <BarChart data={productBookings} layout="vertical" margin={{ left: 100, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
                <XAxis type="number" tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="product" tick={{ fontFamily: FONT_SANS, fontSize: 9, fill: T.textMid }} axisLine={false} tickLine={false} width={95} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => [`$${Math.round(v).toLocaleString()}`, 'Bookings ARR']} />
                <Bar dataKey="bookings" fill={T.green} radius={[0, 4, 4, 0]} name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}>No bookings data</div>
          )}
        </div>
      </div>
    </div>
  )
}

// =======================================================================
// ACCOUNT HEALTH TAB
// =======================================================================

function AccountHealthTab({ accounts }) {
  const healthDist = useMemo(() => {
    const buckets = { healthy: 0, warning: 0, critical: 0 }
    for (const a of accounts) {
      const r = a.risk_score || 0
      if (r >= 50) buckets.critical++
      else if (r >= 30) buckets.warning++
      else buckets.healthy++
    }
    return [
      { status: 'Healthy', count: buckets.healthy, color: T.green },
      { status: 'Warning', count: buckets.warning, color: T.yellow },
      { status: 'Critical', count: buckets.critical, color: T.red },
    ]
  }, [accounts])

  const velocityDist = useMemo(() => {
    const v = { accelerating: 0, stable: 0, stalled: 0 }
    for (const a of accounts) {
      const vel = (a.velocity || '').toLowerCase()
      if (vel === 'accelerating') v.accelerating++
      else if (vel === 'stalled') v.stalled++
      else if (vel === 'stable') v.stable++
    }
    return [
      { status: 'Accelerating', count: v.accelerating, color: T.green },
      { status: 'Stable', count: v.stable, color: T.yellow },
      { status: 'Stalled', count: v.stalled, color: T.red },
    ].filter(x => x.count > 0)
  }, [accounts])

  const nrrDist = useMemo(() => {
    const buckets = [
      { label: '<80%', min: 0, max: 0.8, count: 0 },
      { label: '80-90%', min: 0.8, max: 0.9, count: 0 },
      { label: '90-100%', min: 0.9, max: 1.0, count: 0 },
      { label: '100-110%', min: 1.0, max: 1.1, count: 0 },
      { label: '110%+', min: 1.1, max: Infinity, count: 0 },
    ]
    for (const a of accounts) {
      const nrr = a.nrr || 0
      const bucket = buckets.find(b => nrr >= b.min && nrr < b.max)
      if (bucket) bucket.count++
    }
    return buckets.filter(b => b.count > 0)
  }, [accounts])

  const repProductivity = useMemo(() => {
    const reps = {}
    for (const a of accounts) {
      const rep = (a.sales_owner || a.rep || '').trim()
      if (!rep) continue
      if (!reps[rep]) reps[rep] = { rep, accounts: 0, arr: 0, pipeline: 0, deals: 0 }
      reps[rep].accounts++
      reps[rep].arr += a.arr || 0
      reps[rep].pipeline += (a.pipeline_mrr || 0) * 12
      reps[rep].deals += (a.active_deals?.length || 0)
    }
    return Object.values(reps).sort((a, b) => b.arr - a.arr)
  }, [accounts])

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}><Tip>ACCOUNT HEALTH</Tip></div>
          {healthDist.map(h => (
            <div key={h.status} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '60px', fontFamily: FONT_SANS, fontSize: '10px', color: h.color, fontWeight: 600 }}>{h.status}</div>
              <div style={{ flex: 1, height: '8px', background: T.border, borderRadius: '4px', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '4px', width: `${accounts.length > 0 ? (h.count / accounts.length) * 100 : 0}%`, background: h.color }} />
              </div>
              <div style={{ width: '30px', fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 600, color: h.color, textAlign: 'right' }}>{h.count}</div>
            </div>
          ))}
        </div>

        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}><Tip>ACCOUNT VELOCITY</Tip></div>
          {velocityDist.map(v => (
            <div key={v.status} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '80px', fontFamily: FONT_SANS, fontSize: '10px', color: v.color, fontWeight: 600 }}>{v.status}</div>
              <div style={{ flex: 1, height: '8px', background: T.border, borderRadius: '4px', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '4px', width: `${accounts.length > 0 ? (v.count / accounts.length) * 100 : 0}%`, background: v.color }} />
              </div>
              <div style={{ width: '30px', fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 600, color: v.color, textAlign: 'right' }}>{v.count}</div>
            </div>
          ))}
        </div>

        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip label="Net Revenue Retention distribution across accounts.">NRR DISTRIBUTION</Tip>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={nrrDist} margin={{ left: 5, right: 5 }}>
              <XAxis dataKey="label" tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} width={25} />
              <Tooltip contentStyle={chartTheme.tooltip} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Accounts">
                {nrrDist.map((entry, i) => (
                  <Cell key={i} fill={entry.min >= 1.0 ? T.green : entry.min >= 0.9 ? T.yellow : T.red} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {repProductivity.length > 0 && (
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em' }}>
              <Tip label="ARR, pipeline, and deal count per sales rep.">REP PRODUCTIVITY</Tip>
            </div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.8fr 0.5fr',
            gap: '4px', padding: '8px 12px', background: T.surface,
            borderBottom: `1px solid ${T.border}`,
            fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, letterSpacing: '0.04em',
          }}>
            <div>Rep</div>
            <div style={{ textAlign: 'right' }}>ARR</div>
            <div style={{ textAlign: 'right' }}>Pipeline</div>
            <div style={{ textAlign: 'right' }}>Accounts</div>
            <div style={{ textAlign: 'right' }}>Deals</div>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {repProductivity.map((r, i) => (
              <div key={r.rep} style={{
                display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.8fr 0.5fr',
                gap: '4px', padding: '8px 12px', fontSize: '11px',
                borderBottom: `1px solid ${T.border}`,
                background: i % 2 === 0 ? 'transparent' : `${T.surface}40`,
              }}>
                <div style={{ fontWeight: 600 }}>{r.rep}</div>
                <div style={{ textAlign: 'right', fontFamily: FONT_MONO, fontSize: '10px', color: T.cyan }}>{$(r.arr)}</div>
                <div style={{ textAlign: 'right', fontFamily: FONT_MONO, fontSize: '10px', color: T.purple }}>{$k(r.pipeline)}</div>
                <div style={{ textAlign: 'right', fontFamily: FONT_MONO, fontSize: '10px', color: T.textMid }}>{r.accounts}</div>
                <div style={{ textAlign: 'right', fontFamily: FONT_MONO, fontSize: '10px', color: T.teal }}>{r.deals}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
