import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, Area, ReferenceLine,
} from 'recharts'
import { T, STAGE_COLORS, STAGE_WIN_PROB, STAGE_ORDER, stageProb } from '../lib/constants'
import { cn } from '@/lib/utils'
import Badge from '../components/shared/Badge'
import Stat from '../components/shared/Stat'
import ProbBar from '../components/shared/ProbBar'
import Tip from '../components/shared/Tip'
import { chartTheme, $, $k, pc } from '../components/shared/ChartTheme'
import {
  SpotlightCard, AnimatedBorderCard,
  Sparkline, GlowBadge,
} from '../components/effects'

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

function paceColorClass(pct) {
  if (pct >= 1.0) return 'text-revos-green'
  if (pct >= 0.75) return 'text-revos-yellow'
  return 'text-revos-red'
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
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.border} strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-[stroke-dashoffset] duration-[800ms] ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-[22px] font-bold" style={{ color }}>{pc(displayPct)}</div>
        <div className="font-sans text-[9px] text-revos-text-dim">{label}</div>
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
    <div className="bg-revos-surface rounded-md px-3 py-2">
      <div className="flex justify-between mb-1">
        <Tip label={`PACE TO QUOTA\n\nFormula: ${periodMode === 'month' ? 'MTD' : 'QTD'} Bookings ÷ Expected Bookings at this point in the ${periodMode === 'month' ? 'month' : 'quarter'}\n\nActual: ${$k(actual)}\nExpected: ${$k(expected)} (pro-rated based on day ${Math.floor((Date.now() - (periodMode === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1)).getTime()) / 86400000) + 1} of ${periodMode === 'month' ? 'month' : 'quarter'})\nQuota: ${$k(quota)}\n\nPace: ${(paceRatio * 100).toFixed(0)}% of expected\n\nThe white marker shows where you should be. The colored bar shows where you are.\n• Green: ≥100% of pace\n• Yellow: 75–99% of pace\n• Red: <75% of pace`}>
          <span className="font-sans text-[9px] text-revos-text-dim">Pace to Quota</span>
        </Tip>
        <span className="font-mono text-[9px]" style={{ color }}>
          {$k(actual)} of {$k(expected)} expected
        </span>
      </div>
      <div className="relative h-1.5 rounded-sm" style={{ background: T.border }}>
        <div className="absolute left-0 top-0 h-full rounded-sm transition-[width] duration-[800ms] ease-out"
          style={{ width: `${Math.min(pctActual * 100, 100)}%`, background: color }} />
        {/* Expected pace marker */}
        <div className="absolute -top-0.5 h-2.5 w-0.5 rounded-sm"
          style={{ background: T.text, left: `${Math.min(pctExpected * 100, 100)}%` }} />
      </div>
    </div>
  )
}

// --- Tab Button ---
function TabBtn({ active, label, color = T.cyan, onClick }) {
  return (
    <button onClick={onClick} className={cn(
      'px-4 py-[7px] rounded-xl cursor-pointer font-sans text-[11px] border-none transition-all duration-150',
      active ? 'bg-revos-card text-revos-text font-semibold shadow-card' : 'bg-transparent text-revos-text-dim font-normal'
    )}>
      {label}
    </button>
  )
}

// --- Filter Pill ---
function Pill({ active, label, count, color = T.cyan, onClick }) {
  return (
    <button onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-2xl cursor-pointer font-sans text-[9px] border-none transition-all duration-150',
        !active && 'bg-revos-surface'
      )}
      style={{
        fontWeight: active ? 600 : 400,
        background: active ? `${color}15` : undefined,
        boxShadow: active ? `0 0 0 1px ${color}30, 0 0 12px ${color}15` : 'none',
        color: active ? color : T.textDim,
      }}
    >
      {label}{count != null ? ` (${count})` : ''}
    </button>
  )
}

// --- Collapsible Section ---
function Section({ title, color = T.textDim, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const contentRef = useRef(null)
  const [height, setHeight] = useState(defaultOpen ? 'auto' : 0)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(open ? contentRef.current.scrollHeight : 0)
    }
  }, [open, children])

  return (
    <div className="mt-2">
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer p-0 w-full"
        style={{ paddingTop: 4, paddingBottom: 4 }}>
        <svg width={10} height={10} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', flexShrink: 0 }}>
          <path d="M3 1.5 L7.5 5 L3 8.5" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-sans uppercase" style={{ fontSize: 9, fontWeight: 600, color, letterSpacing: '0.1em' }}>{title}</span>
        {count != null && <span className="font-mono" style={{ fontSize: 8, color: T.tertiary }}>({count})</span>}
        <div className="flex-1" style={{ height: 1, background: `${color}18`, marginLeft: 4 }} />
      </button>
      <div style={{ overflow: 'hidden', transition: 'height 0.3s cubic-bezier(0.16,1,0.3,1)', height: height === 'auto' ? 'auto' : height }}>
        <div ref={contentRef} style={{ paddingTop: 6 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// --- Risk Bar ---
function RiskBar({ score }) {
  const color = score >= 50 ? T.red : score >= 30 ? T.orange : T.green
  return (
    <div className="flex items-center gap-1.5">
      <div className="overflow-hidden" style={{ width: 40, height: 3, borderRadius: 2, background: T.border }}>
        <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.8s ease' }} />
      </div>
      <span className="font-mono" style={{ fontSize: 9, fontWeight: 600, color }}>{score}</span>
    </div>
  )
}

// --- Deal Row ---
function DealRow({ d, winProb }) {
  const [hover, setHover] = useState(false)
  const probColor = winProb > 0.6 ? T.green : winProb > 0.35 ? T.yellow : T.orange
  const stageColor = STAGE_COLORS[d.stage] || T.textDim

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="items-center"
      style={{ display: 'grid', gridTemplateColumns: '38px 1fr auto auto auto', gap: 10, padding: '8px 12px', borderRadius: 10, background: hover ? 'rgba(255,255,255,0.02)' : 'transparent', transition: 'background 0.2s', cursor: 'default' }}
      onClick={e => e.stopPropagation()}>
      <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: probColor, textShadow: `0 0 12px ${probColor}35` }}>{pc(winProb)}</span>
      <div>
        <div className="font-semibold" style={{ fontSize: 12, color: T.text }}>{d.product || 'Unknown'}</div>
        <div className="flex gap-1.5 mt-0.5">
          <GlowBadge color={stageColor} className="text-[9px] px-1.5 py-0">{d.stage}</GlowBadge>
        </div>
      </div>
      <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: T.cyan }}>{$k(d.mrr || 0)}/mo</span>
      <span className="font-mono" style={{ fontSize: 9, color: T.tertiary }}>{$k((d.mrr || 0) * 12)}/yr</span>
      <div className="flex gap-1">
        {d.opportunity_id && (
          <a href={`https://zayo.lightning.force.com/lightning/r/Opportunity/${d.opportunity_id}/view`}
            target="_blank" rel="noopener noreferrer"
            className="font-mono no-underline" style={{ fontSize: 8, padding: '3px 8px', borderRadius: 6, color: T.cyan, background: `${T.cyan}10`, border: `1px solid ${T.cyan}20` }}>
            SFDC ↗
          </a>
        )}
        {d.icb_id && (
          <a href={`https://zayo.lightning.force.com/lightning/r/Opportunity/${d.icb_id}/view`}
            target="_blank" rel="noopener noreferrer"
            className="font-mono no-underline" style={{ fontSize: 8, padding: '3px 8px', borderRadius: 6, color: T.purple, background: `${T.purple}10`, border: `1px solid ${T.purple}20` }}>
            ICB ↗
          </a>
        )}
      </div>
    </div>
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

  // Book of business TMR
  const bookTMR = repAccounts.reduce((s, a) => s + (a.tmr || 0), 0)

  return (
    <div>
      {/* Rep Selector + Target + Period Toggle */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="font-sans text-[10px] text-revos-text-dim tracking-wide">
          Seller
        </div>
        <select
          value={rep}
          onChange={(e) => setSelectedRep(e.target.value)}
          className="px-2.5 py-1.5 font-mono text-[11px] bg-revos-card border border-revos-border rounded-xl text-revos-text outline-none cursor-pointer min-w-[180px]"
        >
          {allReps.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <div className="w-px h-5 bg-revos-border" />

        {/* Target Input — always annual, divided by 4 or 12 for period */}
        <div className="font-sans text-[10px] text-revos-text-dim">Annual Target</div>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-revos-text-dim">$</span>
          <input
            type="text"
            value={userTarget}
            onChange={e => setUserTarget(e.target.value)}
            placeholder="65000"
            className="py-1.5 pr-2.5 pl-[18px] font-mono text-[11px] bg-revos-card rounded-xl text-revos-text outline-none w-[100px]"
            style={{ border: `1px solid ${userTarget ? T.cyan : T.border}` }}
            onFocus={e => e.target.style.borderColor = T.cyan}
            onBlur={e => { if (!userTarget) e.target.style.borderColor = T.border }}
          />
        </div>

        <div className="w-px h-5 bg-revos-border" />

        {/* Month / Quarter Toggle */}
        <div className="flex gap-0.5 bg-revos-surface rounded-xl p-0.5">
          {['month', 'quarter', 'annual'].map(mode => (
            <button key={mode} onClick={() => setPeriodMode(mode)} className={cn(
              'px-3 py-1 rounded-[10px] border-none cursor-pointer font-mono text-[10px] font-semibold',
              periodMode === mode ? 'bg-revos-card shadow-card' : 'bg-transparent'
            )} style={{ color: periodMode === mode ? T.cyan : T.textDim }}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <div className="font-mono text-[10px] text-revos-text-dim">
          {repAccounts.length} accounts · {allActiveDeals.length} deals
        </div>
      </div>

      {/* Internal Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-revos-surface rounded-xl w-fit">
        <TabBtn active={tab === 'accounts'} label="My Accounts" onClick={() => setTab('accounts')} />
        <TabBtn active={tab === 'pipeline'} label="My Pipeline" onClick={() => setTab('pipeline')} />
        <TabBtn active={tab === 'pipeline-gap'} label={<span className="inline-flex items-center gap-1.5">Pipeline Gap <span className="w-[7px] h-[7px] rounded-full" style={{ background: pipelineCoverage >= 3 ? T.green : pipelineCoverage >= 1.5 ? T.yellow : pipelineCoverage >= 1 ? T.orange : T.red }} /></span>} onClick={() => setTab('pipeline-gap')} />
        <TabBtn active={tab === 'kpi'} label="KPI Scorecard" onClick={() => setTab('kpi')} />
      </div>

      {/* TAB 1: MY ACCOUNTS */}
      {tab === 'accounts' && <MyAccountsTab
        repAccounts={repAccounts} rep={rep} repProfile={repProfile}
        periodBookings={periodBookings} ytdBookings={ytdBookings} periodQuota={periodQuota}
        annualQuota={annualQuota} expectedPeriod={expectedPeriod} pipelineCoverage={pipelineCoverage}
        bookTMR={bookTMR} showFilter={showFilter} setShowFilter={setShowFilter}
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
// TAB 1: MY ACCOUNTS (Progressive Disclosure)
// =======================================================================

function MyAccountsTab({
  repAccounts, rep, repProfile, periodBookings, ytdBookings, periodQuota,
  annualQuota, expectedPeriod, pipelineCoverage, bookTMR, showFilter, setShowFilter,
  sortBy, setSortBy, periodMode, currentQ, currentMonthName,
  accountSearch, setAccountSearch, weightedPipeline, targetRemaining,
  signalsData, signalsAge, aiSignals, aiLoading, refreshAI,
}) {
  const [expandedCard, setExpandedCard] = useState(null)
  const [kpiExpanded, setKpiExpanded] = useState(false)

  // Filter + search (same logic as before)
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

  const sorted = useMemo(() => {
    const s = [...filtered]
    if (sortBy === 'risk') s.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    if (sortBy === 'revenue') s.sort((a, b) => (b.tmr || 0) - (a.tmr || 0))
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

  const periodLabel = periodMode === 'month' ? currentMonthName : periodMode === 'annual' ? `${new Date().getFullYear()}` : `Q${currentQ}`
  const paceRatio = periodQuota > 0 && expectedPeriod > 0 ? periodBookings / expectedPeriod : 1

  return (
    <div className="relative">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-[0.03]"
        style={{ background: 'radial-gradient(circle, #7c5aff 0%, transparent 70%)' }} />

      {/* ── KPI STRIP (collapsible) ── */}
      <SpotlightCard className="mb-4 opacity-0 animate-fade-slide-in" style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}>
        <div className="cursor-pointer" style={{ padding: '14px 20px' }} onClick={() => setKpiExpanded(!kpiExpanded)}>
          {/* Always visible: compact KPI row */}
          <div className="flex items-center gap-6">
            <AttainmentRing value={periodBookings} quota={periodQuota} size={64}
              label={`${periodLabel} Att.`} />

            <div className="flex-1 grid grid-cols-4 gap-4">
              {[
                { label: `${periodMode === 'month' ? 'MTD' : periodMode === 'annual' ? 'YTD' : 'QTD'} BOOKINGS`, value: $k(periodBookings), sub: `of ${$k(periodQuota)}`, color: paceColor(paceRatio) },
                { label: 'PIPELINE COVERAGE', value: `${pipelineCoverage.toFixed(1)}x`, sub: `${$k(weightedPipeline)} weighted`, color: pipelineCoverage >= 3 ? T.green : pipelineCoverage >= 1.5 ? T.yellow : T.red },
                { label: 'TOTAL MONTHLY REVENUE', value: $(bookTMR), sub: `${repAccounts.length} accounts`, color: T.teal },
                { label: 'AT RISK', value: `${filterCounts.risk}`, sub: `of ${filterCounts.all} accounts`, color: T.red },
              ].map((kpi, i) => (
                <div key={i}>
                  <div className="font-sans uppercase" style={{ fontSize: 8, fontWeight: 600, color: T.textDim, letterSpacing: '0.1em', marginBottom: 4 }}>{kpi.label}</div>
                  <div className="font-mono leading-none" style={{ fontSize: 20, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                  <div className="font-sans" style={{ fontSize: 9, color: T.tertiary, marginTop: 3 }}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            <svg width={16} height={16} style={{ transform: kpiExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease', flexShrink: 0, opacity: 0.4 }}>
              <path d="M3 6 L8 11 L13 6" fill="none" stroke={T.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Expanded: pace bar + sparklines */}
          {kpiExpanded && (
            <div className="mt-4 pt-3.5" style={{ borderTop: `1px solid ${T.border}` }}>
              {periodQuota > 0 && (
                <div className="mb-3.5">
                  <div className="flex justify-between mb-1">
                    <Tip label={`Pace to Quota — ${periodLabel}`}>
                      <span className="font-sans" style={{ fontSize: 9, color: T.textDim }}>Pace to Quota</span>
                    </Tip>
                    <span className="font-mono" style={{ fontSize: 9, color: paceColor(paceRatio) }}>
                      {$k(periodBookings)} of {$k(expectedPeriod)} expected
                    </span>
                  </div>
                  <div className="overflow-hidden" style={{ height: 4, borderRadius: 2, background: T.border }}>
                    <div style={{ width: `${Math.min((periodBookings / periodQuota) * 100, 100)}%`, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${paceColor(paceRatio)}, ${T.orange})`, transition: 'width 1s ease' }} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: `${periodMode === 'month' ? 'MTD' : 'QTD'} Bookings Trend`, color: paceColor(paceRatio) },
                  { label: `YTD: ${$k(ytdBookings)} of ${$k(annualQuota)} annual`, color: T.cyan },
                  { label: 'Coverage Trend', color: pipelineCoverage >= 1.5 ? T.yellow : T.red },
                  { label: 'TMR Trend', color: T.teal },
                ].map((s, i) => (
                  <div key={i} className="rounded-lg" style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.015)' }}>
                    <div className="font-sans" style={{ fontSize: 8, color: T.textDim, marginBottom: 6 }}>{s.label}</div>
                    <Sparkline data={[0.2, 0.35, 0.5, 0.6, 0.55, 0.7, 0.85, 1].map(v => v * (i === 0 ? periodBookings : i === 1 ? ytdBookings : i === 2 ? pipelineCoverage : bookTMR))}
                      width={120} height={32} color={s.color} className="opacity-80" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SpotlightCard>

      {/* ── SEARCH + FILTERS (compact inline row) ── */}
      <div className="mb-3.5 opacity-0 animate-fade-slide-in" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input type="text" value={accountSearch} onChange={e => setAccountSearch(e.target.value)}
              placeholder="Search accounts..."
              className="w-full font-sans text-[12px] bg-[#0d1117] text-revos-text outline-none"
              style={{ padding: '8px 14px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}
              onFocus={e => e.target.style.borderColor = 'rgba(120,90,255,0.3)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'} />
            {accountSearch && (
              <button onClick={() => setAccountSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-revos-text-dim text-sm">×</button>
            )}
          </div>
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
          <div className="w-px bg-revos-border" style={{ height: 18, margin: '0 4px' }} />
          <div className="font-sans text-revos-text-dim self-center mr-0.5" style={{ fontSize: 9 }}>Sort</div>
          {['risk', 'revenue', 'pipeline', 'name', 'activity', 'nrr'].map(s => (
            <Pill key={s} active={sortBy === s} label={s.charAt(0).toUpperCase() + s.slice(1)} color={T.blue} onClick={() => setSortBy(s)} />
          ))}
        </div>
      </div>

      <div className="font-sans text-revos-text-dim mb-2.5" style={{ fontSize: 10 }}>
        {sorted.length} accounts
      </div>

      {/* ── ACCOUNT CARDS (progressive disclosure) ── */}
      {sorted.map((acc, i) => {
        const ds = daysSince(acc.engagement?.lastDate)
        const riskCol = acc.risk_score >= 50 ? T.red : acc.risk_score >= 30 ? T.orange : T.green
        const velCol = acc.velocity === 'accelerating' ? T.green : acc.velocity === 'stalled' ? T.red : T.yellow
        const isOpen = expandedCard === acc.name
        const allDeals = [...(acc.active_deals || []), ...(acc.funnel_closed || [])]
        const histWon = (acc.historical_deals || []).filter(d => normalizeStage(d.stage) === 'closed won' && (d.mrr || 0) >= 0).length
        const histChurned = (acc.historical_deals || []).filter(d => normalizeStage(d.stage) === 'closed won' && (d.mrr || 0) < 0).length
        const histLost = (acc.losses?.deals || []).length

        // Deal predictions (Bayesian — same logic as before)
        const prior = Math.max(0.05, Math.min(0.95, acc.win_rate || 0.5))
        const dealPredictions = (acc.active_deals || []).map(d => {
          const stageWinProb = stageProb(d.stage)
          let stageLR = (stageWinProb / (1 - stageWinProb)) / (prior / (1 - prior))
          stageLR = Math.max(0.1, Math.min(stageLR, 20))
          const priorLO = Math.log(prior / (1 - prior))
          const posteriorLO = priorLO + Math.log(stageLR)
          const posterior = Math.max(0.02, Math.min(0.98, 1 / (1 + Math.exp(-posteriorLO))))
          return { ...d, winProb: posterior }
        }).sort((a, b) => b.winProb - a.winProb)

        // NIB
        const currentYrDeals = allDeals.filter(d => { const dt = parseDate(d.close || d.created); return dt && dt.getFullYear() === new Date().getFullYear() })
        const positiveMRR = currentYrDeals.filter(d => (d.mrr || 0) > 0).reduce((s, d) => s + (d.mrr || 0), 0)
        const negativeMRR = currentYrDeals.filter(d => (d.mrr || 0) < 0).reduce((s, d) => s + (d.mrr || 0), 0)
        const netMRR = positiveMRR + negativeMRR

        // Stage breakdown
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

        // Signals
        const acctSignals = signalsData?.[acc.name]
        const signalRows = buildSignalRows(acctSignals)
        const acctAI = aiSignals[acc.name] || []
        const isLoadingAI = aiLoading[acc.name]

        return (
          <div key={acc.name} className="mb-2.5 opacity-0 animate-fade-slide-in"
            style={{ animationDelay: `${Math.min(i, 10) * 60}ms`, animationFillMode: 'forwards' }}>
            <div onClick={() => setExpandedCard(isOpen ? null : acc.name)}
              className="cursor-pointer transition-all duration-300"
              style={{
                borderRadius: 16,
                border: `1px solid rgba(255,255,255,${isOpen ? 0.08 : 0.04})`,
                borderLeft: `3px solid ${riskCol}`,
                background: T.card,
                boxShadow: isOpen
                  ? '0 8px 32px rgba(120,90,255,0.06), 0 0 0 1px rgba(120,90,255,0.1)'
                  : '0 1px 3px rgba(0,0,0,0.2)',
              }}>

              {/* ── COLLAPSED ROW ── */}
              <div className="flex items-center gap-3.5" style={{ padding: '14px 18px' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[14px]">{acc.name}</span>
                    <GlowBadge color={riskCol} className="text-[9px] px-2 py-0">{acc.risk_level?.toUpperCase().replace('_', ' ')}</GlowBadge>
                    {acc.velocity && <GlowBadge color={velCol} className="text-[9px] px-2 py-0">{acc.velocity.toUpperCase()}</GlowBadge>}
                  </div>
                  {/* One-line summary */}
                  <div className="flex gap-3 mt-1">
                    <span className="font-mono text-[10px]" style={{ color: T.purple }}>{$k(acc.pipeline_mrr || 0)} pipe</span>
                    <span className="font-mono text-[10px]" style={{ color: T.cyan }}>{allDeals.length} deals</span>
                    <span className="font-mono text-[10px]" style={{ color: ds <= 30 ? T.green : ds <= 90 ? T.yellow : T.red }}>{ds < 999 ? `${ds}d ago` : 'No contact'}</span>
                    {(signalRows.length + acctAI.length) > 0 && (
                      <span className="font-mono text-[10px]" style={{ color: T.purple }}>{signalRows.length + acctAI.length} signals</span>
                    )}
                  </div>
                </div>

                <RiskBar score={acc.risk_score || 0} />

                <span className="font-mono text-[15px] font-bold text-revos-cyan min-w-[70px] text-right">{$(acc.tmr)}</span>

                <svg width={14} height={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease', flexShrink: 0, opacity: 0.3 }}>
                  <path d="M3 5 L7 9 L11 5" fill="none" stroke={T.textDim} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>

              {/* ── EXPANDED SECTIONS ── */}
              {isOpen && (
                <div style={{ padding: '0 18px 16px', borderTop: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>

                  {/* Deal Predictions */}
                  {dealPredictions.length > 0 && (
                    <Section title="Deal Predictions" color={T.cyan} count={dealPredictions.length} defaultOpen={true}>
                      <div className="rounded-lg overflow-hidden" style={{ background: `${T.cyan}04`, border: `1px solid ${T.cyan}10` }}>
                        {dealPredictions.map((d, idx) => <DealRow key={idx} d={d} winProb={d.winProb} />)}
                      </div>
                    </Section>
                  )}

                  {/* Account Health */}
                  <Section title="Account Health" color={T.teal}>
                    <div className="grid grid-cols-6 gap-2.5 rounded-lg" style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.015)' }}>
                      <MiniStat label="Pipeline" value={$k(acc.pipeline_mrr || 0)} color={T.purple} />
                      <MiniStat label={`${new Date().getFullYear()} Deals`} value={currentYrDeals.length} color={T.cyan} />
                      <MiniStat label="Won" value={histWon} color={T.green} />
                      <MiniStat label="Churned" value={histChurned} color={T.red} />
                      <MiniStat label="Close Lost" value={histLost} color={T.orange} />
                      <MiniStat label="Last Engaged" value={ds < 999 ? `${ds}d ago` : '---'} color={ds <= 30 ? T.green : ds <= 90 ? T.yellow : T.red} />
                    </div>
                    {currentYrDeals.length > 0 && (
                      <div className="flex gap-3 items-center mt-2 rounded-md" style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.015)' }}>
                        <span className="font-sans text-[9px] text-revos-text-dim uppercase tracking-wide">{new Date().getFullYear()} NIB</span>
                        <span className="font-mono text-[11px] text-revos-green font-semibold">+{$k(positiveMRR)}</span>
                        <span className="font-mono text-[11px] font-semibold" style={{ color: negativeMRR < 0 ? T.red : T.textDim }}>{negativeMRR < 0 ? $k(negativeMRR) : '$0'}</span>
                        <span className="font-mono text-[9px] text-revos-text-dim">=</span>
                        <span className="font-mono text-[11px] font-bold" style={{ color: netMRR >= 0 ? T.cyan : T.red }}>Net {$k(netMRR)}</span>
                      </div>
                    )}
                  </Section>

                  {/* WHY NOW */}
                  {(signalRows.length > 0 || acctAI.length > 0) && (
                    <Section title="Why Now — AI Signals" color={T.purple} count={signalRows.length + acctAI.length}>
                      <AnimatedBorderCard className="" borderColor={`${T.purple}90`}>
                        <div className="px-3 py-2">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-sans text-[7px] tracking-[0.06em]" style={{ color: T.purple }}>
                              {signalsAge && <span className="text-revos-text-dim ml-1.5">updated {signalsAge}</span>}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); refreshAI(acc.name, acctSignals?.segment, acctSignals) }}
                              disabled={isLoadingAI}
                              className="bg-transparent rounded px-1.5 py-px cursor-pointer font-mono text-[7px]"
                              style={{ border: `1px solid ${T.purple}30`, color: T.purple, opacity: isLoadingAI ? 0.5 : 1 }}>
                              {isLoadingAI ? 'LOADING...' : '🌐 REFRESH'}
                            </button>
                          </div>
                          {signalRows.map((row, idx) => (
                            <div key={idx} className="flex gap-1.5 items-start mb-0.5">
                              <span className="text-[10px] shrink-0">{row.icon}</span>
                              <span className="font-mono text-[9px] leading-[1.4]" style={{ color: CAT_COLORS[row.cat] || T.text }}>{row.text}</span>
                            </div>
                          ))}
                          {acctAI.map((row, idx) => (
                            <div key={`ai-${idx}`} className="flex gap-1.5 items-start mb-0.5">
                              <span className="text-[10px] shrink-0">{row.icon || '🌐'}</span>
                              <span className="font-mono text-[9px] text-revos-teal leading-[1.4]">{row.text}</span>
                              <span className="font-mono text-[7px] text-revos-teal px-1 rounded-[3px] shrink-0 self-center" style={{ background: `${T.teal}15` }}>LIVE</span>
                            </div>
                          ))}
                        </div>
                      </AnimatedBorderCard>
                    </Section>
                  )}

                  {/* Stage Pipeline */}
                  {orderedStages.length > 0 && (
                    <Section title="Stage Pipeline" color={T.textDim}>
                      <div className="flex gap-1.5 flex-wrap">
                        {orderedStages.map(stage => {
                          const data = stageMap[stage]
                          const color = STAGE_COLORS[stage] || T.textDim
                          return (
                            <GlowBadge key={stage} color={color} className="font-mono text-[9px] px-2 py-[3px]">
                              {stage}: {data.count} deal{data.count > 1 ? 's' : ''} · {$k(data.mrr)}
                            </GlowBadge>
                          )
                        })}
                      </div>
                    </Section>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {sorted.length === 0 && (
        <div className="text-center p-10 text-revos-text-dim">
          <div className="font-mono text-[11px]">No accounts match this filter.</div>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div>
      <div className="font-sans text-[8px] text-revos-text-dim">
        <Tip label={label.toUpperCase()}>{label}</Tip>
      </div>
      <div className="font-mono text-[11px] font-semibold" style={{ color }}>{value}</div>
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
      <div className="grid grid-cols-5 gap-2.5 mb-4">
        <Stat label={<Tip label={`Total raw MRR across active deals closing in ${periodLabel}.`}>Pipeline MRR ({periodLabel})</Tip>} value={`${$k(rawTotal)}`} sub={`${periodDeals.length} deals`} color={T.purple} />
        <Stat label={<Tip label={`SUM(Deal MRR × Stage Win Probability) for deals closing in ${periodLabel}. Discover 30.6%, Design Solution 53.2%, Propose 66.2%, Negotiate 84.7%, Verbal Agreement 92.5%.`}>Prob-Adjusted ({periodLabel})</Tip>} value={`${$k(weightedTotal)}`} sub="SUM(MRR × Stage Win %)" color={T.teal} />
        <Stat label={<Tip label={`Remaining target for the current ${periodMode} after subtracting bookings already closed.`}>Target Remaining</Tip>} value={$k(targetRemaining)} color={T.orange} />
        <Stat label={<Tip>CLOSING IN 30D</Tip>} value={closingSoon.length} sub={`${$k(closingSoon.reduce((s, d) => s + (d.mrr || 0), 0))}`} color={T.green} />
        <Stat label={<Tip>STALLED</Tip>} value={stalledDeals.length} color={stalledDeals.length > 0 ? T.red : T.green} />
      </div>

      {/* Pipeline by Stage — raw vs weighted */}
      <div className="bg-revos-card rounded-xl shadow-card p-3.5 mb-4">
        <div className="flex justify-between items-center mb-3">
          <div className="font-sans text-[10px] text-revos-text-dim tracking-wide">
            <Tip label={`Deals closing in ${periodLabel}. Each deal's MRR × stage win probability. Discover 30.57%, Design Solution 53.21%, Propose 66.23%, Negotiate 84.67%, Verbal Agreement 92.49%.`}>
              PIPELINE BY STAGE — {periodLabel.toUpperCase()}
            </Tip>
          </div>
          <div className="flex gap-3 font-mono text-[10px]">
            <span className="text-revos-text-mid">Raw: <span className="text-revos-purple font-semibold">{$k(rawTotal)}</span></span>
            <span className="text-revos-text-mid">Weighted: <span className="text-revos-teal font-bold">{$k(weightedTotal)}</span></span>
          </div>
        </div>

        {stageData.map(s => {
          const maxRaw = Math.max(...stageData.map(x => x.raw), 1)
          const barPct = (s.raw / maxRaw) * 100
          const color = STAGE_COLORS[s.stage] || T.textDim
          return (
            <div key={s.stage} className="mb-2">
              <div className="flex justify-between items-center mb-[3px]">
                <div className="flex items-center gap-1.5">
                  <span className="font-sans text-[11px] font-semibold" style={{ color }}>{s.stage}</span>
                  <span className="font-mono text-[9px] text-revos-text-dim">({pc(s.prob)})</span>
                  <span className="font-mono text-[9px] text-revos-text-dim">{s.count} deals</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-revos-purple">{$k(s.raw)}</span>
                  <span className="font-mono text-[9px] text-revos-text-dim">→</span>
                  <span className="font-mono text-[10px] font-bold text-revos-teal">{$k(s.weighted)}</span>
                </div>
              </div>
              <div className="relative h-1.5 rounded-sm" style={{ background: T.border }}>
                <div className="absolute left-0 top-0 h-full rounded-sm transition-[width] duration-500" style={{ width: `${barPct}%`, background: `${color}50` }} />
                <div className="absolute left-0 top-0 h-full rounded-sm transition-[width] duration-500" style={{ width: `${barPct * s.prob}%`, background: color }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Funnel MRR Build — Current Year */}
      {trajectoryData.length > 0 && (
        <div className="bg-revos-card rounded-xl shadow-card p-3.5 mb-4">
          <div className="flex justify-between items-center mb-3">
            <div className="font-sans text-[10px] text-revos-text-dim tracking-wide">
              <Tip label={`Cumulative funnel MRR by close date for ${new Date().getFullYear()}.\n\nRaw Funnel (cyan line): Total MRR from all deals by their close month — no probability adjustment.\n\nWeighted (filled teal area): MRR adjusted by stage win probability. Closed Won deals count at 100%. Active deals weighted by: Discover 30.6%, Design Solution 53.2%, Propose 66.2%, Negotiate 84.7%, Verbal Agreement 92.5%.\n\nTarget line (red dashed): Annual quota for reference.`}>
                {new Date().getFullYear()} FUNNEL MRR BUILD
              </Tip>
            </div>
            <div className="flex gap-4 font-mono text-[9px]">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 inline-block" style={{ background: T.cyan }} /> Raw Funnel
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-1.5 inline-block rounded-sm" style={{ background: `${T.teal}40` }} /> Weighted
              </span>
              {annualQuota > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0 inline-block" style={{ borderTop: `2px dashed ${T.red}` }} /> Target
                </span>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={trajectoryData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="month" tick={{ fontFamily: "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace", fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace", fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} width={50} tickFormatter={v => `$${Math.round(v).toLocaleString()}`} />
              <Tooltip contentStyle={chartTheme.tooltip} formatter={(v, name) => [`$${Math.round(v).toLocaleString()}`, name === 'raw' ? 'Raw Funnel MRR' : 'Weighted MRR']} />
              {annualQuota > 0 && <ReferenceLine y={annualQuota} stroke={T.red} strokeDasharray="6 3" strokeWidth={1.5} ifOverflow="extendDomain" label={{ value: `Target ${$k(annualQuota)}`, position: 'right', fill: T.red, fontSize: 9, fontFamily: "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace" }} />}
              <Area type="monotone" dataKey="weighted" fill={`${T.teal}25`} stroke={T.teal} strokeWidth={1.5} name="weighted" dot={false} />
              <Line type="monotone" dataKey="raw" stroke={T.cyan} strokeWidth={2} dot={false} name="raw" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Deal List */}
      <div className="bg-revos-card rounded-xl shadow-card overflow-hidden">
        <div className="grid gap-1 px-3 py-2 bg-revos-surface font-sans text-[9px] text-revos-text-dim tracking-wide"
          style={{ gridTemplateColumns: '1.8fr 1fr 0.7fr 0.7fr 1fr 0.9fr 0.7fr', borderBottom: `1px solid ${T.border}` }}>
          <div>Account</div>
          <div>Product</div>
          <div className="text-right">MRR</div>
          <div className="text-right">Weighted</div>
          <div>Stage</div>
          <div>Close</div>
          <div>Forecast</div>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {sortedDeals.map((d, i) => {
            const closeDate = parseDate(d.close)
            const isClosingSoon = closeDate && closeDate <= thirtyDaysOut && closeDate >= now
            const prob = stageProb(d.stage)
            const wMrr = (d.mrr || 0) * prob
            return (
              <div key={i} className="grid gap-1 px-3 py-2 text-[11px] items-center"
                style={{
                  gridTemplateColumns: '1.8fr 1fr 0.7fr 0.7fr 1fr 0.9fr 0.7fr',
                  borderBottom: `1px solid ${T.border}`,
                  background: i % 2 === 0 ? 'transparent' : `${T.surface}40`,
                }}>
                <div className="font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                  {d.accountName}
                </div>
                <div className="text-revos-text-mid overflow-hidden text-ellipsis whitespace-nowrap">{d.product}</div>
                <div className="text-right font-mono text-[10px] font-semibold text-revos-purple">
                  {$k(d.mrr)}
                </div>
                <div className="text-right font-mono text-[10px] font-semibold text-revos-teal">
                  {$k(wMrr)}
                </div>
                <div>
                  <Badge color={STAGE_COLORS[d.stage] || T.textDim}>{d.stage}</Badge>
                </div>
                <div className="font-mono text-[10px]" style={{ color: isClosingSoon ? T.green : T.textMid }}>
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
      <div className="grid grid-cols-4 gap-2.5 mb-4">
        <div className="bg-revos-card rounded-xl shadow-card p-3">
          <div className="font-sans text-[9px] text-revos-text-dim uppercase tracking-wide mb-1">
            {periodMode === 'month' ? currentMonthName : `Q${currentQ}`} Target
          </div>
          <div className="relative">
            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-revos-text-dim">$</span>
            <input
              type="text"
              value={customTarget}
              onChange={e => setCustomTarget(e.target.value)}
              placeholder={$k(target)}
              className="w-full py-1.5 pr-2 pl-4 font-mono text-sm font-bold bg-revos-surface rounded-xl text-revos-text outline-none box-border"
              style={{ border: `1px solid ${customTarget ? T.cyan : T.border}` }}
              onFocus={e => e.target.style.borderColor = T.cyan}
              onBlur={e => { if (!customTarget) e.target.style.borderColor = T.border }}
            />
          </div>
        </div>
        <div className="bg-revos-card rounded-xl shadow-card p-3">
          <div className="font-sans text-[9px] text-revos-text-dim uppercase tracking-wide mb-1">Weighted Pipeline</div>
          <div className="font-mono text-[22px] font-bold text-revos-purple">{$k(totalWeighted)}</div>
          <div className="font-sans text-[9px] text-revos-text-dim mt-0.5">Raw: {$k(totalRaw)}</div>
        </div>
        <div className="bg-revos-card rounded-xl shadow-card p-3">
          <div className="font-sans text-[9px] text-revos-text-dim uppercase tracking-wide mb-1">Gap</div>
          {gap > 0
            ? <div className="font-mono text-[22px] font-bold text-revos-red">{$k(gap)}</div>
            : <div className="font-mono text-[22px] font-bold text-revos-green">COVERED</div>
          }
        </div>
        <div className="bg-revos-card rounded-xl shadow-card p-3">
          <div className="font-sans text-[9px] text-revos-text-dim uppercase tracking-wide mb-1">Coverage</div>
          <div className="font-mono text-[22px] font-bold" style={{ color: covColor }}>{pc(coverage)}</div>
          <div className="h-1 rounded-sm mt-1.5" style={{ background: T.border }}>
            <div className="h-full rounded-sm transition-[width] duration-500" style={{ background: covColor, width: `${Math.min(coverage * 100, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Section 2 — Current Pipeline by Stage */}
      <div className="bg-revos-card rounded-xl shadow-card p-3.5 mb-4">
        <div className="font-sans text-[10px] text-revos-text-dim tracking-wide mb-2.5 uppercase">
          Current Pipeline by Stage
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Stage', 'Win %', 'Deals', 'Raw MRR', '', 'Weighted MRR'].map((h, i) => (
                <th key={i} className="font-sans text-[9px] text-revos-text-dim font-medium px-2 py-1" style={{ textAlign: i >= 3 ? 'right' : 'left', borderBottom: `1px solid ${T.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STAGES.map(st => {
              const d = byStage[st]
              const color = STAGE_COLORS[st] || T.textDim
              return (
                <tr key={st}>
                  <td className="font-mono text-[11px] px-2 py-1.5" style={{ color, borderBottom: `1px solid ${T.border}08` }}>{st}</td>
                  <td className="font-mono text-[11px] text-revos-text-mid px-2 py-1.5">{(d.prob * 100).toFixed(1)}%</td>
                  <td className="font-mono text-[11px] text-revos-text px-2 py-1.5">{d.deals}</td>
                  <td className="font-mono text-[11px] text-revos-text px-2 py-1.5 text-right">{$k(d.raw)}</td>
                  <td className="px-2 py-1.5 w-[120px]">
                    <div className="h-1.5 rounded-sm" style={{ background: T.border }}>
                      <div className="h-full rounded-sm transition-[width] duration-300" style={{ background: color, width: `${(d.raw / maxRaw) * 100}%` }} />
                    </div>
                  </td>
                  <td className="font-mono text-[11px] text-revos-purple px-2 py-1.5 text-right font-semibold">{$k(d.weighted)}</td>
                </tr>
              )
            })}
            <tr style={{ borderTop: `2px solid ${T.border}` }}>
              <td className="font-mono text-[11px] font-bold text-revos-text px-2 py-2">Total</td>
              <td />
              <td className="font-mono text-[11px] font-bold text-revos-text px-2 py-2">{pipeline.length}</td>
              <td className="font-mono text-[11px] font-bold text-revos-text px-2 py-2 text-right">{$k(totalRaw)}</td>
              <td />
              <td className="font-mono text-[11px] font-bold text-revos-purple px-2 py-2 text-right">{$k(totalWeighted)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 4 — Blended Build Plan */}
      {gap > 0 && buildPlan && (
        <div className="bg-revos-card rounded-xl shadow-card p-3.5 mb-4">
          <div className="font-sans text-[10px] text-revos-text-dim tracking-wide mb-3 uppercase">
            Blended Build Plan
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 280px' }}>
            {/* Left: Sliders */}
            <div>
              {STAGES.map(st => {
                const color = STAGE_COLORS[st] || T.textDim
                const plan = buildPlan.stages[st]
                return (
                  <div key={st} className="mb-2.5">
                    <div className="flex justify-between mb-1">
                      <span className="font-mono text-[10px]" style={{ color }}>{st}</span>
                      <span className="font-mono text-[10px] text-revos-text">{scenarioMix[st]}% &rarr; <span className="font-bold">{plan.deals} deals</span> <span className="text-revos-purple">(+{$k(plan.weightedVal)})</span></span>
                    </div>
                    <input
                      type="range" min="0" max="50" value={scenarioMix[st]}
                      onChange={e => setScenarioMix(prev => ({ ...prev, [st]: parseInt(e.target.value) }))}
                      className="w-full h-1" style={{ accentColor: color }}
                    />
                  </div>
                )
              })}
              <button
                onClick={() => setScenarioMix({ ...DEFAULT_MIX })}
                className="font-sans text-[9px] text-revos-text-dim bg-revos-surface border border-revos-border rounded-xl px-2.5 py-1 cursor-pointer mt-1"
              >Reset to defaults</button>
            </div>
            {/* Right: Summary */}
            <div className="bg-revos-surface rounded-xl p-3">
              <div className="font-sans text-[9px] text-revos-text-dim uppercase mb-2.5">Plan Summary</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <div className="font-sans text-[8px] text-revos-text-dim">New Deals</div>
                  <div className="font-mono text-lg font-bold text-revos-text">{buildPlan.totalDeals}</div>
                </div>
                <div>
                  <div className="font-sans text-[8px] text-revos-text-dim">They'd Add</div>
                  <div className="font-mono text-lg font-bold text-revos-purple">+{$k(buildPlan.totalAdded)}</div>
                </div>
              </div>
              <div className="font-sans text-[9px] text-revos-text-dim mb-1">Projected Coverage</div>
              <div className="font-mono text-sm font-bold mb-1" style={{ color: buildPlan.projectedCov >= 1 ? T.green : T.yellow }}>
                {pc(buildPlan.projectedCov)}
              </div>
              <div className="h-1.5 rounded-sm mb-3" style={{ background: T.border }}>
                <div className="h-full rounded-sm relative" style={{ background: T.purple, width: `${Math.min((totalWeighted / (target || 1)) * 100, 100)}%` }}>
                  <div className="absolute right-0 -top-px w-0.5 h-2 rounded-sm" style={{ background: T.text }} />
                </div>
                <div className="h-1.5 rounded-sm -mt-1.5" style={{ background: `${T.purple}40`, width: `${Math.min(buildPlan.projectedCov * 100, 100)}%` }} />
              </div>
              <div className="font-sans text-[9px] text-revos-text-dim mb-1">Funnel Shape</div>
              {STAGES.map(st => {
                const current = byStage[st]?.deals || 0
                const needed = buildPlan.stages[st]?.deals || 0
                const color = STAGE_COLORS[st] || T.textDim
                const maxDeals = Math.max(...STAGES.map(s => (byStage[s]?.deals || 0) + (buildPlan.stages[s]?.deals || 0)), 1)
                return (
                  <div key={st} className="flex items-center gap-1.5 mb-[3px]">
                    <span className="font-mono text-[8px] text-revos-text-dim w-[18px] text-right">{current + needed}</span>
                    <div className="flex-1 h-2 rounded overflow-hidden flex" style={{ background: T.border }}>
                      <div style={{ height: '100%', background: color, width: `${(current / maxDeals) * 100}%` }} />
                      {needed > 0 && <div style={{ height: '100%', background: `${color}50`, width: `${(needed / maxDeals) * 100}%` }} />}
                    </div>
                    <span className="font-mono text-[8px] w-[50px] overflow-hidden text-ellipsis whitespace-nowrap" style={{ color }}>{st.split(' ')[0]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Section 5 — What-If Simulator */}
      <div className="bg-revos-card rounded-xl shadow-card p-3.5 mb-4">
        <div className="flex justify-between items-center mb-3">
          <div className="font-sans text-[10px] text-revos-text-dim tracking-wide uppercase">
            What-If Simulator
          </div>
          <button
            onClick={() => setSimAdds({ Discover: { count: 0, mrr: '' }, 'Design Solution': { count: 0, mrr: '' }, Propose: { count: 0, mrr: '' }, Negotiate: { count: 0, mrr: '' }, 'Verbal Agreement': { count: 0, mrr: '' } })}
            className="font-sans text-[9px] text-revos-text-dim bg-revos-surface border border-revos-border rounded-xl px-2 py-[3px] cursor-pointer"
          >Reset</button>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 200px' }}>
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
                <div key={st} className={cn('flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-xl', count > 0 ? '' : 'bg-transparent')} style={{ background: count > 0 ? `${color}08` : undefined }}>
                  <span className="font-mono text-[10px] w-[110px]" style={{ color }}>{st}</span>
                  <button onClick={() => setSimAdds(p => ({ ...p, [st]: { ...p[st], count: Math.max(0, (p[st]?.count || 0) - 1) } }))} className="w-6 h-6 rounded border border-revos-border bg-revos-surface text-revos-text cursor-pointer font-mono text-sm flex items-center justify-center">&minus;</button>
                  <span className="font-mono text-sm font-bold text-revos-text w-6 text-center">{count}</span>
                  <button onClick={() => setSimAdds(p => ({ ...p, [st]: { ...p[st], count: (p[st]?.count || 0) + 1 } }))} className="w-6 h-6 rounded border border-revos-border bg-revos-surface text-revos-text cursor-pointer font-mono text-sm flex items-center justify-center">+</button>
                  <div className="relative w-20">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 font-mono text-[9px] text-revos-text-dim">$</span>
                    <input
                      type="text"
                      value={entry.mrr}
                      onChange={e => setSimAdds(p => ({ ...p, [st]: { ...p[st], mrr: e.target.value } }))}
                      placeholder={$k(stageAvg)}
                      className="w-full py-[3px] pr-1.5 pl-3.5 font-mono text-[10px] bg-revos-surface rounded text-revos-text outline-none box-border"
                      style={{ border: `1px solid ${entry.mrr ? T.cyan : T.border}` }}
                      onFocus={e => e.target.style.borderColor = T.cyan}
                      onBlur={e => { if (!entry.mrr) e.target.style.borderColor = T.border }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-revos-text-dim">x {(stageProb(st) * 100).toFixed(1)}%</span>
                  <span className="font-mono text-[11px] min-w-[70px] text-right" style={{ color: contrib > 0 ? T.purple : T.textDim, fontWeight: contrib > 0 ? 600 : 400 }}>
                    {contrib > 0 ? `+${$k(contrib)}` : '---'}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="bg-revos-surface rounded-xl p-3">
            <div className="font-sans text-[9px] text-revos-text-dim uppercase mb-2">Simulated Result</div>
            <div className="font-sans text-[8px] text-revos-text-dim mb-0.5">Current</div>
            <div className="font-mono text-sm font-semibold text-revos-purple mb-1.5">{$k(totalWeighted)}</div>
            {simWeighted > 0 && <>
              <div className="font-sans text-[8px] text-revos-text-dim mb-0.5">+ New Deals</div>
              <div className="font-mono text-sm font-semibold text-revos-green mb-1.5">+{$k(simWeighted)}</div>
            </>}
            <div className="pt-1.5 mt-1" style={{ borderTop: `1px solid ${T.border}` }}>
              <div className="font-sans text-[8px] text-revos-text-dim mb-0.5">Projected</div>
              <div className="font-mono text-lg font-bold" style={{ color: simCovColor }}>{$k(simTotal)}</div>
              <div className="font-mono text-xs font-semibold mt-1" style={{ color: simCovColor }}>{pc(simCoverage)} coverage</div>
              <div className="h-1.5 rounded-sm mt-1.5" style={{ background: T.border }}>
                <div className="h-full rounded-sm transition-[width] duration-300" style={{ background: simCovColor, width: `${Math.min(simCoverage * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 6 — Model Reference */}
      <div className="bg-revos-card rounded-xl shadow-card p-3.5">
        <div className="font-sans text-[10px] text-revos-text-dim tracking-wide mb-2.5 uppercase">
          Model Reference
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="font-sans text-[9px] text-revos-text-dim mb-1.5 uppercase">Formulas</div>
            {[
              ['Weighted Pipeline', 'SUM(Deal MRR x Stage Win %)'],
              ['Gap', 'Target - Weighted Pipeline'],
              ['Coverage', 'Weighted Pipeline / Target'],
              ['Deals Needed', 'Gap / (Avg Deal MRR x Stage Win %)'],
            ].map(([name, formula]) => (
              <div key={name} className="mb-1.5">
                <span className="font-mono text-[10px] text-revos-text font-semibold">{name}</span>
                <span className="font-mono text-[10px] text-revos-text-dim"> = {formula}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="font-sans text-[9px] text-revos-text-dim mb-1.5 uppercase">Stage Win Probabilities</div>
            {STAGES.map(st => {
              const prob = stageProb(st)
              const color = STAGE_COLORS[st] || T.textDim
              return (
                <div key={st} className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] w-[120px]" style={{ color }}>{st}</span>
                  <div className="flex-1 h-1.5 rounded-sm" style={{ background: T.border }}>
                    <div className="h-full rounded-sm" style={{ background: color, width: `${prob * 100}%` }} />
                  </div>
                  <span className="font-mono text-[10px] text-revos-text w-[45px] text-right">{(prob * 100).toFixed(1)}%</span>
                </div>
              )
            })}
            <div className="font-sans text-[8px] text-revos-text-dim mt-1.5 italic">Win probabilities from historical close rates</div>
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
  const totalWeightedTMR = stagePipeBreakdown.reduce((s, d) => s + d.weighted, 0)
  const totalRawTMR = stagePipeBreakdown.reduce((s, d) => s + d.raw, 0)

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
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <KPICard label={<Tip label={`YTD Bookings ÷ Annual Quota = ${$k(ytdBookings)} ÷ ${$k(annualQuota)} = ${annualQuota > 0 ? pc(ytdBookings / annualQuota) : '---'}. Bookings: Forecast Category = Closed, MRR > 0, Major Project = blank, Close Date in ${now.getFullYear()}.`}>Annual Attainment</Tip>} value={annualQuota > 0 ? pc(ytdBookings / annualQuota) : '---'} sub={`${$k(ytdBookings)} of ${$k(annualQuota)}`} pace={annualPace} />
        <KPICard label={<Tip label={`Period Bookings ÷ Period Quota = ${$k(periodBookings)} ÷ ${$k(periodQuota)} = ${periodQuota > 0 ? pc(periodBookings / periodQuota) : '---'}. Bookings: Forecast Category = Closed, MRR > 0, Major Project = blank, Close Date in ${periodMode === 'month' ? currentMonthName : 'Q' + currentQ}.`}>{periodMode === 'month' ? `${currentMonthName} Attainment` : `Q${currentQ} Attainment`}</Tip>} value={periodQuota > 0 ? pc(periodBookings / periodQuota) : '---'} sub={`${$k(periodBookings)} of ${$k(periodQuota)}`} pace={periodPace} />
        <KPICard label={<Tip label={`Won ÷ (Won + Lost) = ${totalWon} ÷ (${totalWon} + ${totalLost}) = ${pc(winRate)}. ${now.getFullYear()} closed deals only. Source: funnel.csv`}>Win Rate</Tip>} value={pc(winRate)} sub={`${totalWon}W / ${totalLost}L`} pace={winRate >= 0.5 ? 1.1 : winRate >= 0.3 ? 0.85 : 0.5} />
        <KPICard label={<Tip label={`Average MRR across ${now.getFullYear()} closed-won deals.\n\nSUM(MRR) ÷ deal count = ${$k(currentYearClosedWon.reduce((s, d) => s + (d.mrr || 0), 0))} ÷ ${currentYearClosedWon.length} = ${$k(avgDealSize)}\n\nOnly positive MRR, current year close dates.\nSource: funnel.csv`}>Avg Deal Size</Tip>} value={`${$k(avgDealSize)}`} sub={`${currentYearClosedWon.length} deals in ${now.getFullYear()}`} pace={1} />
        <KPICard label={<Tip label={`${now.getFullYear()} closed MRR + active pipeline MRR, annualized.\n\nClosed: ${$k(currentYearClosedMRR)} (${currentYearClosedWon.length} deals)\nPipeline: ${$k(activePipelineMRR)} (${allActiveDeals.length} deals)\nTotal: (${$k(currentYearClosedMRR)} + ${$k(activePipelineMRR)}) × 12 = ${$k(pipelineGen)}\n\nSource: funnel.csv`}>Pipeline Generated</Tip>} value={$k(pipelineGen)} sub={`${currentYearClosedWon.length} closed + ${allActiveDeals.length} open`} pace={1} />
        <KPICard label={<Tip label="Count of accounts that have at least one deal (active or closed) in the funnel.">Accounts with Deals</Tip>} value={repAccounts.filter(a => ((a.active_deals?.length || 0) + (a.funnel_closed?.length || 0)) > 0).length} sub={`of ${repAccounts.length} total`} pace={1} />
      </div>

      {/* Stage Win Probability Reference Card */}
      <div className="bg-revos-card rounded-xl shadow-card p-3.5 mb-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Left: Stage probability table */}
          <div>
            <div className="font-sans text-[10px] text-revos-text-dim tracking-wide mb-2.5">
              <Tip label="Stage win probabilities from validated 2026 funnel model historical win rates.">
                STAGE WIN PROBABILITIES
              </Tip>
            </div>
            {STAGE_ORDER.map(stage => {
              const prob = stageProb(stage)
              const color = STAGE_COLORS[stage] || T.textDim
              const pipeData = stagePipeBreakdown.find(s => s.stage === stage)
              return (
                <div key={stage} className="flex items-center gap-2 mb-1.5">
                  <div className="w-[110px] font-sans text-[10px] font-semibold" style={{ color }}>{stage}</div>
                  <div className="flex-1 relative h-2 rounded" style={{ background: T.border }}>
                    <div className="absolute left-0 top-0 h-full rounded transition-[width] duration-500" style={{ width: `${prob * 100}%`, background: `${color}60` }} />
                  </div>
                  <div className="w-10 font-mono text-[10px] font-semibold text-right" style={{ color }}>
                    {(prob * 100).toFixed(1)}%
                  </div>
                  {pipeData && (
                    <div className="w-20 font-mono text-[9px] text-revos-text-dim text-right">
                      {$k(pipeData.raw)} → {$k(pipeData.weighted)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Right: Weighted total + formula + breakdown */}
          <div>
            <div className="font-sans text-[10px] text-revos-text-dim tracking-wide mb-2.5">
              <Tip>WEIGHTED PIPELINE SUMMARY</Tip>
            </div>
            <div className="font-mono text-[28px] font-bold text-revos-teal mb-1">
              {$k(totalWeightedTMR)}
            </div>
            <div className="font-mono text-[9px] text-revos-text-dim mb-3">
              Probability-Adjusted TMR
            </div>
            <div className="font-mono text-[9px] text-revos-text-mid p-2 bg-revos-surface rounded-md mb-3">
              SUM( Deal MRR × Stage Win % ) × 12
            </div>

            {/* Per-stage multiplication breakdown */}
            {stagePipeBreakdown.map(s => {
              const color = STAGE_COLORS[s.stage] || T.textDim
              return (
                <div key={s.stage} className="flex justify-between items-center py-1 font-mono text-[10px]"
                  style={{ borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ color }}>{s.stage} ({s.count})</span>
                  <span className="text-revos-text-mid">
                    {$k(s.raw)} × {(s.prob * 100).toFixed(1)}% = <span className="text-revos-teal font-semibold">{$k(s.weighted)}</span>
                  </span>
                </div>
              )
            })}
            {stagePipeBreakdown.length > 0 && (
              <div className="flex justify-between py-1.5 font-mono text-[10px] font-bold">
                <span className="text-revos-text">Total</span>
                <span>
                  <span className="text-revos-purple">{$k(totalRawTMR)}</span>
                  <span className="text-revos-text-dim"> → </span>
                  <span className="text-revos-teal">{$k(totalWeightedTMR)}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Bookings by type */}
        <div className="bg-revos-card rounded-xl shadow-card p-3.5">
          <div className="font-sans text-[10px] text-revos-text-dim tracking-wide mb-3">
            <Tip>BOOKINGS BY TYPE</Tip>
          </div>
          {bookingsByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={bookingsByType} layout="vertical" margin={{ left: 60, right: 10 }}>
                <XAxis type="number" tick={{ fontFamily: "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace", fontSize: 9, fill: T.textDim }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 10, fill: T.textMid }} axisLine={false} tickLine={false} width={55} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => [`$${Math.round(v).toLocaleString()}`, 'TMR']} />
                <Bar dataKey="value" fill={T.teal} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center p-[30px] font-mono text-[10px] text-revos-text-dim">No bookings data</div>
          )}
        </div>

        {/* Monthly bookings chart */}
        <div className="bg-revos-card rounded-xl shadow-card p-3.5">
          <div className="font-sans text-[10px] text-revos-text-dim tracking-wide mb-3">
            <Tip label="Monthly bookings for the current quarter from closed-won deals.">{periodMode === 'month' ? `${currentMonthName} Bookings` : `Q${currentQ} Monthly Bookings`}</Tip>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={monthlyBookings} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="month" tick={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 10, fill: T.textMid }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace", fontSize: 9, fill: T.textDim }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => [`$${Math.round(v).toLocaleString()}`, 'Booked']} />
              <Bar dataKey="bookings" fill={T.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* YTD Losses */}
      {ytdLosses.length > 0 && (
        <div className="bg-revos-card rounded-xl shadow-card p-3.5">
          <div className="font-sans text-[10px] text-revos-red tracking-wide mb-2.5">
            <Tip label="Deals lost year-to-date by this seller. Includes competitive losses, no-decisions, and churn.">YTD Losses ({ytdLosses.length})</Tip>
          </div>
          {ytdLosses.map((d, i) => (
            <div key={i} className="grid gap-1 px-2 py-1.5 text-[11px] rounded"
              style={{ gridTemplateColumns: '2fr 1.5fr 0.8fr 1fr', background: i % 2 ? T.surface : 'transparent' }}>
              <div className="font-semibold">{d.accountName}</div>
              <div className="text-revos-text-mid">{d.product}</div>
              <div className="font-mono text-[10px] text-revos-red">-{$(Math.abs(d.mrr))}</div>
              <div className="font-mono text-[10px] text-revos-text-dim">{d.date}</div>
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
    <div className="bg-revos-card rounded-xl shadow-card p-3.5"
      style={{ borderLeft: `3px solid ${color}` }}>
      <div className="font-sans text-[9px] text-revos-text-dim tracking-wide mb-1.5 uppercase">
        {label}
      </div>
      <div className="font-mono text-xl font-bold leading-none" style={{ color }}>
        {value}
      </div>
      {sub && <div className="font-sans text-[9px] text-revos-text-mid mt-1">{sub}</div>}
    </div>
  )
}
