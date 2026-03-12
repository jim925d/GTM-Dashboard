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

  // Historical deals where this seller is the opportunity owner or account owner
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
  const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0)
  const dayOfQ = Math.floor((now - qStart) / 86400000) + 1
  const daysInQ = Math.floor((qEnd - qStart) / 86400000) + 1
  const qPacePct = dayOfQ / daysInQ
  const currentQ = Math.floor(now.getMonth() / 3) + 1

  const closedWonDeals = useMemo(() =>
    allHistorical.filter(d => {
      const s = normalizeStage(d.stage)
      return s === 'closed won' && (d.mrr || 0) >= 0
    }), [allHistorical])

  const ytdBookings = useMemo(() =>
    closedWonDeals.filter(d => { const dt = parseDate(d.close); return dt && dt >= yearStart })
      .reduce((s, d) => s + (d.mrr || 0) * 12, 0), [closedWonDeals])

  const qtdBookings = useMemo(() =>
    closedWonDeals.filter(d => { const dt = parseDate(d.close); return dt && dt >= qStart })
      .reduce((s, d) => s + (d.mrr || 0) * 12, 0), [closedWonDeals])

  // Quota
  const annualQuota = parseFloat(repProfile?.annual_quota) || 0
  const qQuotaKey = `q${currentQ}_quota`
  const quarterlyQuota = parseFloat(repProfile?.[qQuotaKey]) || (annualQuota / 4)
  const expectedQTD = quarterlyQuota * qPacePct

  // Pipeline metrics — weighted by stage win probability
  const totalPipelineMRR = allActiveDeals.reduce((s, d) => s + (d.mrr || 0), 0)
  const weightedPipeline = allActiveDeals.reduce((s, d) => {
    return s + (d.mrr || 0) * stageProb(d.stage) * 12
  }, 0)
  const quotaRemaining = Math.max(0, quarterlyQuota - qtdBookings)
  const pipelineCoverage = quotaRemaining > 0 ? (totalPipelineMRR * 12) / quotaRemaining : 999

  // Book of business ARR
  const bookARR = repAccounts.reduce((s, a) => s + (a.arr || 0), 0)

  return (
    <div>
      {/* Rep Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
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
        qtdBookings={qtdBookings} ytdBookings={ytdBookings} quarterlyQuota={quarterlyQuota}
        annualQuota={annualQuota} expectedQTD={expectedQTD} pipelineCoverage={pipelineCoverage}
        bookARR={bookARR} showFilter={showFilter} setShowFilter={setShowFilter}
        sortBy={sortBy} setSortBy={setSortBy}
      />}

      {/* TAB 2: MY PIPELINE */}
      {tab === 'pipeline' && <MyPipelineTab
        allActiveDeals={allActiveDeals} repAccounts={repAccounts} rep={rep}
        totalPipelineMRR={totalPipelineMRR} weightedPipeline={weightedPipeline}
        quotaRemaining={quotaRemaining} closedWonDeals={closedWonDeals}
        quarterlyQuota={quarterlyQuota} allHistorical={allHistorical}
      />}

      {/* TAB 3: KPI SCORECARD */}
      {tab === 'kpi' && <KPITab
        repAccounts={repAccounts} rep={rep} repProfile={repProfile}
        qtdBookings={qtdBookings} ytdBookings={ytdBookings}
        quarterlyQuota={quarterlyQuota} annualQuota={annualQuota}
        closedWonDeals={closedWonDeals} allHistorical={allHistorical}
        allActiveDeals={allActiveDeals} expectedQTD={expectedQTD}
        qPacePct={qPacePct} currentQ={currentQ}
      />}
    </div>
  )
}

// =======================================================================
// TAB 1: MY ACCOUNTS
// =======================================================================

function MyAccountsTab({
  repAccounts, rep, repProfile, qtdBookings, ytdBookings, quarterlyQuota,
  annualQuota, expectedQTD, pipelineCoverage, bookARR, showFilter, setShowFilter,
  sortBy, setSortBy,
}) {
  // Filter
  const filtered = useMemo(() => {
    let list = repAccounts
    if (showFilter === 'engaged') list = list.filter(a => daysSince(a.engagement?.lastDate) <= 90)
    if (showFilter === 'unengaged') list = list.filter(a => daysSince(a.engagement?.lastDate) > 90)
    if (showFilter === 'deals') list = list.filter(a => (a.active_deals?.length || 0) > 0)
    if (showFilter === 'no_pipeline') list = list.filter(a => (a.active_deals?.length || 0) === 0)
    if (showFilter === 'risk') list = list.filter(a => (a.risk_score || 0) >= 30)
    return list
  }, [repAccounts, showFilter])

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
          <AttainmentRing value={qtdBookings} quota={quarterlyQuota} label={`Q${Math.floor(new Date().getMonth() / 3) + 1} Attainment`} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          <Stat label="QTD Bookings" value={$k(qtdBookings)} sub={quarterlyQuota > 0 ? `of ${$k(quarterlyQuota)} quota` : 'no quota set'} color={paceColor(quarterlyQuota > 0 ? qtdBookings / expectedQTD : 1)} />
          <Stat label="YTD Bookings" value={$k(ytdBookings)} sub={annualQuota > 0 ? `of ${$k(annualQuota)} annual` : ''} color={T.cyan} />
          <Stat label="Pipeline Coverage" value={`${pipelineCoverage.toFixed(1)}x`} sub={`vs ${$k(Math.max(0, quarterlyQuota - qtdBookings))} gap`} color={pipelineCoverage >= 3 ? T.green : pipelineCoverage >= 1.5 ? T.yellow : T.red} />
          <Stat label="Book of Business" value={$(bookARR)} sub={`${repAccounts.length} accounts`} color={T.teal} />
        </div>
      </div>

      {/* Pace bar */}
      {quarterlyQuota > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <PaceBar actual={qtdBookings} expected={expectedQTD} quota={quarterlyQuota} />
        </div>
      )}

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
              <MiniStat label="Deals" value={acc.active_deals?.length || 0} color={T.cyan} />
              <MiniStat label="Win Rate" value={pc(acc.win_rate)} color={acc.win_rate > 0.6 ? T.green : T.yellow} />
              <MiniStat label="NRR" value={pc(acc.nrr)} color={acc.nrr >= 1 ? T.green : acc.nrr >= 0.9 ? T.yellow : T.red} />
              <MiniStat label="Last Eng" value={ds < 999 ? `${ds}d` : '---'} color={ds <= 30 ? T.green : ds <= 90 ? T.yellow : T.red} />
            </div>
            {/* Stage distribution mini-bar */}
            {acc.active_deals?.length > 0 && (
              <div style={{ display: 'flex', gap: '2px', marginTop: '6px', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                {Object.entries(acc.pipeline_by_stage || {}).map(([stage, data]) => (
                  <div key={stage} style={{
                    flex: data.count, background: STAGE_COLORS[stage] || T.textDim,
                    borderRadius: '2px',
                  }} title={`${stage}: ${data.count} deals`} />
                ))}
              </div>
            )}
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
      <div style={{ fontFamily: FONT_SANS, fontSize: '8px', color: T.textDim }}>{label}</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 600, color }}>{value}</div>
    </div>
  )
}

// =======================================================================
// TAB 2: MY PIPELINE
// =======================================================================

function MyPipelineTab({
  allActiveDeals, repAccounts, rep, totalPipelineMRR, weightedPipeline,
  quotaRemaining, closedWonDeals, quarterlyQuota, allHistorical,
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

  // MRR trajectory data: monthly cumulative from historical bookings
  const trajectoryData = useMemo(() => {
    const months = {}
    // Build monthly net bookings from historical deals
    for (const d of allHistorical) {
      const dt = parseDate(d.close)
      if (!dt) continue
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      if (!months[key]) months[key] = { month: key, booked: 0, churn: 0 }
      const mrr = d.mrr || 0
      if (mrr >= 0) months[key].booked += mrr
      else months[key].churn += Math.abs(mrr)
    }
    const sorted = Object.values(months).sort((a, b) => a.month.localeCompare(b.month))
    let cumMRR = 0
    const actual = sorted.map(m => {
      cumMRR += m.booked - m.churn
      return { month: m.month, actual: Math.round(cumMRR) }
    })

    // Forecast projection: extend 3 months from last actual using weighted pipeline
    if (actual.length > 0) {
      const lastActual = actual[actual.length - 1].actual
      const monthlyWeighted = weightedTotal / 3 // spread weighted pipeline over ~3 months
      const lastMonth = actual[actual.length - 1].month
      const [y, m] = lastMonth.split('-').map(Number)
      for (let i = 1; i <= 3; i++) {
        const nm = m + i
        const ny = y + Math.floor((nm - 1) / 12)
        const mm = ((nm - 1) % 12) + 1
        actual.push({
          month: `${ny}-${String(mm).padStart(2, '0')}`,
          forecast: Math.round(lastActual + monthlyWeighted * i),
        })
      }
    }
    return actual
  }, [allHistorical, weightedTotal])

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <Stat label="Pipeline MRR" value={`${$k(totalPipelineMRR)}/mo`} sub={`${allActiveDeals.length} deals`} color={T.purple} />
        <Stat label="Prob-Adjusted Pipeline" value={$k(weightedPipeline)} sub="SUM(MRR x Stage Win %)" color={T.teal} />
        <Stat label="Quota Remaining" value={$k(quotaRemaining)} color={T.orange} />
        <Stat label="Closing in 30d" value={closingSoon.length} sub={`${$k(closingSoon.reduce((s, d) => s + (d.mrr || 0), 0))}/mo`} color={T.green} />
        <Stat label="Stalled" value={stalledDeals.length} color={stalledDeals.length > 0 ? T.red : T.green} />
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
            <Tip label="Solid line shows actual cumulative MRR from historical bookings. Dashed line shows probability-adjusted forecast projection using weighted pipeline.">
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
  repAccounts, rep, repProfile, qtdBookings, ytdBookings,
  quarterlyQuota, annualQuota, closedWonDeals, allHistorical,
  allActiveDeals, expectedQTD, qPacePct, currentQ,
}) {
  const now = new Date()

  // Win rate
  const allClosed = allHistorical.filter(d => {
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
  const qPace = quarterlyQuota > 0 && expectedQTD > 0 ? qtdBookings / expectedQTD : 0

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <KPICard label="Annual Attainment" value={annualQuota > 0 ? pc(ytdBookings / annualQuota) : '---'} sub={`${$k(ytdBookings)} of ${$k(annualQuota)}`} pace={annualPace} />
        <KPICard label={`Q${currentQ} Attainment`} value={quarterlyQuota > 0 ? pc(qtdBookings / quarterlyQuota) : '---'} sub={`${$k(qtdBookings)} of ${$k(quarterlyQuota)}`} pace={qPace} />
        <KPICard label="Win Rate" value={pc(winRate)} sub={`${totalWon}W / ${totalLost}L`} pace={winRate >= 0.5 ? 1.1 : winRate >= 0.3 ? 0.85 : 0.5} />
        <KPICard label="Avg Deal Size" value={$k(avgDealSize)} sub={`${closedWonDeals.length} deals`} pace={1} />
        <KPICard label="Pipeline Generated" value={$k(pipelineGen)} sub={`${allActiveDeals.length} open deals`} pace={1} />
        <KPICard label="Active Accounts" value={repAccounts.filter(a => (a.active_deals?.length || 0) > 0).length} sub={`of ${repAccounts.length} total`} pace={1} />
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
              WEIGHTED PIPELINE SUMMARY
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
            Bookings by Type
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
            Q{currentQ} Monthly Bookings
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
            YTD Losses ({ytdLosses.length})
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
