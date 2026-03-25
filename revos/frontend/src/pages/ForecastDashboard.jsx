import { useState, useMemo, useRef, useEffect } from 'react'
import { T, STAGE_COLORS, STAGE_WIN_PROB, STAGE_ORDER, stageProb } from '../lib/constants'
import { cn } from '@/lib/utils'
import Badge from '../components/shared/Badge'
import Tip from '../components/shared/Tip'
import { $, $k, pc } from '../components/shared/ChartTheme'
import { SpotlightCard, GlowBadge, AnimatedBorderCard, Sparkline, ProgressRing } from '../components/effects'
import { useAnimatedCounter } from '../components/effects/use-animated-counter'

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

// --- Smooth curve ---
function smoothPath(points, tension = 0.3) {
  if (points.length < 2) return ''
  if (points.length === 2) return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, points.length - 1)]
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }
  return d
}

// --- Section (progressive disclosure) ---
function Section({ title, badge, children, defaultOpen = false, color = T.cyan }) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyRef = useRef(null)
  const [h, setH] = useState(0)
  useEffect(() => {
    if (bodyRef.current) setH(bodyRef.current.scrollHeight)
  }, [open, children])
  return (
    <div className="bg-revos-card rounded-xl shadow-card mb-3 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-transparent border-none cursor-pointer text-left"
      >
        <span
          className="text-[10px] transition-transform duration-200"
          style={{ color, transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >▶</span>
        <span className="font-sans text-[11px] font-semibold text-revos-text flex-1">{title}</span>
        {badge && <span className="font-mono text-[10px] text-revos-text-dim">{badge}</span>}
      </button>
      <div
        style={{ maxHeight: open ? h : 0, opacity: open ? 1 : 0 }}
        className="transition-all duration-300 ease-out overflow-hidden"
      >
        <div ref={bodyRef} className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// --- Sparkline placeholder data ---
const SPARK_BOOK = [10, 15, 12, 20, 25, 22, 30, 28, 35, 40, 38, 45]
const SPARK_PIPE = [30, 35, 25, 40, 38, 45, 50, 48, 55, 60, 58, 65]
const SPARK_WIN  = [55, 60, 58, 65, 70, 68, 72, 75, 78, 80, 82, 85]
const SPARK_CHURN = [8, 6, 10, 5, 7, 4, 6, 3, 5, 4, 3, 2]

// --- Animated KPI value ---
function AnimatedKPI({ value, prefix = '', suffix = '', color }) {
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0
  const display = useAnimatedCounter(num)
  return <span style={{ color }}>{prefix}{display}{suffix}</span>
}

// --- Forecast Chart (SVG with tooltip) ---
function ForecastChart({ data, periodMode }) {
  const svgRef = useRef(null)
  const [hover, setHover] = useState(null)
  const [dims, setDims] = useState({ w: 600, h: 200 })

  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const obs = new ResizeObserver(([e]) => {
      const { width } = e.contentRect
      if (width > 0) setDims({ w: width, h: 200 })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  if (!data || data.length === 0) {
    return <div className="text-center py-10 font-mono text-[10px] text-revos-text-dim">No data for this period</div>
  }

  const pad = { t: 20, r: 20, b: 30, l: 55 }
  const cw = dims.w - pad.l - pad.r
  const ch = dims.h - pad.t - pad.b

  const maxVal = Math.max(...data.map(d => Math.max(d.bookings, d.churn, Math.abs(d.net))), 1)
  const yScale = (v) => pad.t + ch - (v / maxVal) * ch
  const xScale = (i) => pad.l + (data.length === 1 ? cw / 2 : (i / (data.length - 1)) * cw)

  const bookPts = data.map((d, i) => ({ x: xScale(i), y: yScale(d.bookings) }))
  const churnPts = data.map((d, i) => ({ x: xScale(i), y: yScale(d.churn) }))
  const netPts = data.map((d, i) => ({ x: xScale(i), y: yScale(Math.max(d.net, 0)) }))

  const bookArea = data.length > 1
    ? smoothPath(bookPts) + ` L${bookPts[bookPts.length - 1].x},${yScale(0)} L${bookPts[0].x},${yScale(0)} Z`
    : ''
  const churnArea = data.length > 1
    ? smoothPath(churnPts) + ` L${churnPts[churnPts.length - 1].x},${yScale(0)} L${churnPts[0].x},${yScale(0)} Z`
    : ''

  // Y-axis ticks
  const yTicks = []
  const step = maxVal > 0 ? Math.pow(10, Math.floor(Math.log10(maxVal))) : 1
  let tickStep = step
  if (maxVal / step < 3) tickStep = step / 2
  for (let v = 0; v <= maxVal; v += tickStep) {
    yTicks.push(v)
  }

  const handleMouse = (e) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || data.length === 0) return
    const mx = e.clientX - rect.left
    let closest = 0
    let minDist = Infinity
    for (let i = 0; i < data.length; i++) {
      const dist = Math.abs(xScale(i) - mx)
      if (dist < minDist) { minDist = dist; closest = i }
    }
    if (minDist < 40) setHover(closest)
    else setHover(null)
  }

  const hd = hover !== null ? data[hover] : null
  const hx = hover !== null ? xScale(hover) : 0
  const flipLeft = hx > dims.w * 0.65

  return (
    <div className="relative" style={{ width: '100%' }}>
      <svg
        ref={svgRef}
        width={dims.w}
        height={dims.h}
        className="block"
        onMouseMove={handleMouse}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="fc-book-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.green} stopOpacity="0.35" />
            <stop offset="100%" stopColor={T.green} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="fc-churn-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.red} stopOpacity="0.25" />
            <stop offset="100%" stopColor={T.red} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={pad.l} x2={dims.w - pad.r} y1={yScale(v)} y2={yScale(v)} stroke={T.border} strokeDasharray="3 3" />
            <text x={pad.l - 8} y={yScale(v) + 3} textAnchor="end" fill={T.textDim} fontSize={8} fontFamily="'IBM Plex Mono', monospace">
              {$k(v)}
            </text>
          </g>
        ))}

        {/* X labels */}
        {data.map((d, i) => (
          <text key={i} x={xScale(i)} y={dims.h - 6} textAnchor="middle" fill={T.textDim} fontSize={8} fontFamily="'IBM Plex Mono', monospace">
            {d.label}
          </text>
        ))}

        {/* Areas */}
        {bookArea && <path d={bookArea} fill="url(#fc-book-grad)" />}
        {churnArea && <path d={churnArea} fill="url(#fc-churn-grad)" />}

        {/* Lines */}
        {data.length > 1 && (
          <>
            <path d={smoothPath(bookPts)} fill="none" stroke={T.green} strokeWidth={2} />
            <path d={smoothPath(churnPts)} fill="none" stroke={T.red} strokeWidth={2} />
            <path d={smoothPath(netPts)} fill="none" stroke={T.teal} strokeWidth={1.5} strokeDasharray="5 3" />
          </>
        )}

        {/* Dots */}
        {bookPts.map((p, i) => (
          <circle key={`b${i}`} cx={p.x} cy={p.y} r={hover === i ? 5 : 3} fill={T.green} opacity={hover === i ? 1 : 0.8} />
        ))}
        {churnPts.map((p, i) => (
          <circle key={`c${i}`} cx={p.x} cy={p.y} r={hover === i ? 5 : 3} fill={T.red} opacity={hover === i ? 1 : 0.8} />
        ))}
        {netPts.map((p, i) => (
          <circle key={`n${i}`} cx={p.x} cy={p.y} r={hover === i ? 4 : 2.5} fill={T.teal} opacity={hover === i ? 1 : 0.7} />
        ))}

        {/* Crosshair */}
        {hover !== null && (
          <line x1={hx} x2={hx} y1={pad.t} y2={dims.h - pad.b} stroke={T.textDim} strokeDasharray="3 3" strokeWidth={0.5} />
        )}
      </svg>

      {/* Tooltip */}
      {hd && (
        <div
          className="absolute pointer-events-none bg-revos-card border border-revos-border rounded-lg shadow-card px-3 py-2 z-10"
          style={{
            top: 10,
            ...(flipLeft ? { right: dims.w - hx + 12 } : { left: hx + 12 }),
          }}
        >
          <div className="font-sans text-[10px] font-bold text-revos-text mb-1">{hd.label}</div>
          <div className="font-mono text-[9px] text-revos-green">↑ Bookings: {$k(hd.bookings)}/mo</div>
          <div className="font-mono text-[9px] text-revos-red">↓ Churn: {$k(hd.churn)}/mo</div>
          <div className="font-mono text-[9px] text-revos-teal">= Net: {$k(hd.net)}/mo</div>
          <div className="font-mono text-[9px] text-revos-cyan">♟ Deals: {hd.deals}</div>
          {hd.winRate !== undefined && (
            <div className="font-mono text-[9px] text-revos-text-mid">Win: {pc(hd.winRate)}</div>
          )}
        </div>
      )}
    </div>
  )
}

// =======================================================================
// FORECAST DASHBOARD
// =======================================================================

export default function ForecastDashboard({ accounts, rawData }) {
  const [periodMode, setPeriodMode] = useState('quarter')
  const [ownerView, setOwnerView] = useState('rep')
  const [selectedOwner, setSelectedOwner] = useState(null)

  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1)
  const currentQ = Math.floor(now.getMonth() / 3) + 1
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 1)
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const currentMonthName = now.toLocaleString('default', { month: 'long' })

  // --- Owner pills ---
  const reps = useMemo(() => {
    const set = new Set()
    accounts.forEach(a => { if (a.sales_owner) set.add(a.sales_owner) })
    return [...set].sort()
  }, [accounts])

  const managers = useMemo(() => {
    const set = new Set()
    accounts.forEach(a => { if (a.manager) set.add(a.manager) })
    return [...set].sort()
  }, [accounts])

  const ownerPills = ownerView === 'rep' ? reps : managers

  // --- Filter accounts by selected owner ---
  const filteredAccounts = useMemo(() => {
    if (!selectedOwner) return accounts
    if (ownerView === 'rep') return accounts.filter(a => a.sales_owner === selectedOwner)
    return accounts.filter(a => a.manager === selectedOwner)
  }, [accounts, selectedOwner, ownerView])

  // --- Data pipelines (preserved logic, now using filteredAccounts) ---

  const allActiveDeals = useMemo(() =>
    filteredAccounts.flatMap(acc =>
      (acc.active_deals || [])
        .filter(d => isPremier(d))
        .map(d => ({ ...d, accountName: acc.name, sales_owner: acc.sales_owner }))
    ), [filteredAccounts])

  const funnelClosed = useMemo(() =>
    filteredAccounts.flatMap(acc =>
      (acc.funnel_closed || [])
        .filter(d => isPremier(d))
        .map(d => ({ ...d, accountName: acc.name, sales_owner: acc.sales_owner }))
    ), [filteredAccounts])

  const allHistorical = useMemo(() =>
    filteredAccounts.flatMap(acc =>
      (acc.historical_deals || [])
        .filter(d => isPremier(d))
        .map(d => ({ ...d, accountName: acc.name, sales_owner: acc.sales_owner }))
    ), [filteredAccounts])

  const closedWonDeals = useMemo(() =>
    funnelClosed.filter(d => {
      const s = normalizeStage(d.stage)
      return s === 'closed won' && (d.mrr || 0) > 0
    }), [funnelClosed])

  const churnDeals = useMemo(() =>
    funnelClosed.filter(d => (d.mrr || 0) < 0),
    [funnelClosed])

  const allFunnelDeals = useMemo(() => [...allActiveDeals, ...funnelClosed], [allActiveDeals, funnelClosed])

  const isBooking = (d) => {
    if (normalizeForecast(d.forecast) !== 'Closed') return false
    if (d.major_project) return false
    return true
  }

  // Period boundaries based on periodMode
  const periodStart = periodMode === 'month' ? mStart : periodMode === 'quarter' ? qStart : yearStart
  const periodEnd = periodMode === 'month' ? mEnd : periodMode === 'quarter' ? qEnd : yearEnd
  const periodLabel = periodMode === 'month' ? 'MTD' : periodMode === 'quarter' ? 'QTD' : 'YTD'
  const periodTitle = periodMode === 'month' ? currentMonthName : periodMode === 'quarter' ? `Q${currentQ} ${now.getFullYear()}` : `${now.getFullYear()}`

  // KPI: Period bookings
  const periodBookings = useMemo(() =>
    allFunnelDeals.filter(d => {
      if ((d.mrr || 0) <= 0) return false
      if (!isBooking(d)) return false
      const dt = parseDate(d.close)
      return dt && dt >= periodStart && dt < periodEnd
    }).reduce((s, d) => s + (d.mrr || 0), 0), [allFunnelDeals, periodStart, periodEnd])

  // KPI: Weighted pipeline
  const currentActiveDeals = useMemo(() =>
    allActiveDeals.filter(d => !isClosed(d.stage) && (d.mrr || 0) > 0),
    [allActiveDeals])

  const weightedPipeline = currentActiveDeals.reduce((s, d) =>
    s + (d.mrr || 0) * stageProb(d.stage), 0)

  // KPI: Win rate for period
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

  // KPI: Period churn
  const periodChurn = useMemo(() =>
    allFunnelDeals.filter(d => {
      if ((d.mrr || 0) >= 0) return false
      const dt = parseDate(d.close)
      return dt && dt >= periodStart && dt < periodEnd
    }).reduce((s, d) => s + Math.abs(d.mrr || 0), 0), [allFunnelDeals, periodStart, periodEnd])

  // --- Chart data ---
  const chartData = useMemo(() => {
    if (periodMode === 'month') {
      // Daily cumulative traction for current month
      const dayDeals = allFunnelDeals.filter(d => {
        const dt = parseDate(d.close)
        return dt && dt >= mStart && dt < mEnd && !d.major_project
      }).sort((a, b) => parseDate(a.close) - parseDate(b.close))

      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const daily = []
      let cumBook = 0, cumChurn = 0, cumDeals = 0

      for (let day = 1; day <= Math.min(now.getDate(), daysInMonth); day++) {
        const dayDate = new Date(now.getFullYear(), now.getMonth(), day)
        const nextDay = new Date(now.getFullYear(), now.getMonth(), day + 1)
        const dayDealsForDay = dayDeals.filter(d => {
          const dt = parseDate(d.close)
          return dt >= dayDate && dt < nextDay
        })
        for (const d of dayDealsForDay) {
          const mrr = d.mrr || 0
          if (mrr > 0 && isBooking(d)) cumBook += mrr
          else if (mrr < 0) cumChurn += Math.abs(mrr)
          cumDeals++
        }
        // Only include days that have data or are key milestones
        if (day === 1 || day === now.getDate() || day % 5 === 0 || dayDealsForDay.length > 0) {
          daily.push({
            label: `${day}`,
            bookings: cumBook,
            churn: cumChurn,
            net: cumBook - cumChurn,
            deals: cumDeals,
          })
        }
      }
      // Ensure at least the first and last day
      if (daily.length === 0) {
        daily.push({ label: '1', bookings: 0, churn: 0, net: 0, deals: 0 })
      }
      return daily
    }

    if (periodMode === 'quarter') {
      const q = Math.floor(now.getMonth() / 3)
      const months = []
      for (let i = 0; i < 3; i++) {
        const mo = q * 3 + i
        const moStart = new Date(now.getFullYear(), mo, 1)
        const moEnd = new Date(now.getFullYear(), mo + 1, 1)
        const moLabel = moStart.toLocaleString('default', { month: 'short' })
        let book = 0, churn = 0, deals = 0, won = 0, lost = 0
        for (const d of allFunnelDeals) {
          const dt = parseDate(d.close)
          if (!dt || dt < moStart || dt >= moEnd || d.major_project) continue
          const mrr = d.mrr || 0
          if (mrr > 0 && isBooking(d)) book += mrr
          else if (mrr < 0) churn += Math.abs(mrr)
          deals++
          const s = normalizeStage(d.stage)
          if (s === 'closed won' && mrr > 0) won++
          else if (s === 'closed lost') lost++
        }
        months.push({
          label: moLabel,
          bookings: book,
          churn,
          net: book - churn,
          deals,
          winRate: (won + lost) > 0 ? won / (won + lost) : undefined,
        })
      }
      return months
    }

    // Annual: monthly granularity through current month
    const months = []
    for (let mo = 0; mo <= now.getMonth(); mo++) {
      const moStart = new Date(now.getFullYear(), mo, 1)
      const moEnd = new Date(now.getFullYear(), mo + 1, 1)
      const moLabel = moStart.toLocaleString('default', { month: 'short' })
      let book = 0, churn = 0, deals = 0, won = 0, lost = 0
      for (const d of allFunnelDeals) {
        const dt = parseDate(d.close)
        if (!dt || dt < moStart || dt >= moEnd || d.major_project) continue
        const mrr = d.mrr || 0
        if (mrr > 0 && isBooking(d)) book += mrr
        else if (mrr < 0) churn += Math.abs(mrr)
        deals++
        const s = normalizeStage(d.stage)
        if (s === 'closed won' && mrr > 0) won++
        else if (s === 'closed lost') lost++
      }
      months.push({
        label: moLabel,
        bookings: book,
        churn,
        net: book - churn,
        deals,
        winRate: (won + lost) > 0 ? won / (won + lost) : undefined,
      })
    }
    return months
  }, [allFunnelDeals, periodMode])

  // --- Pipeline by stage ---
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

  // --- Product data ---
  const productPipeline = useMemo(() => {
    const products = {}
    for (const d of currentActiveDeals) {
      if ((d.mrr || 0) <= 0) continue
      const prod = d.product || 'Unknown'
      if (!products[prod]) products[prod] = { product: prod, pipeline: 0, bookings: 0, count: 0 }
      products[prod].pipeline += (d.mrr || 0)
      products[prod].count++
    }
    for (const d of closedWonDeals) {
      const prod = d.product || 'Unknown'
      if (!products[prod]) products[prod] = { product: prod, pipeline: 0, bookings: 0, count: 0 }
      products[prod].bookings += (d.mrr || 0)
    }
    return Object.values(products).sort((a, b) => (b.pipeline + b.bookings) - (a.pipeline + a.bookings)).slice(0, 10)
  }, [currentActiveDeals, closedWonDeals])

  // --- Churn / at-risk ---
  const totalChurnTMR = churnDeals.reduce((s, d) => s + Math.abs(d.mrr || 0) * 12, 0)
  const atRiskAccounts = useMemo(() =>
    filteredAccounts.filter(a => (a.risk_score || 0) >= 30)
      .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
      .slice(0, 15),
    [filteredAccounts])
  const atRiskTMR = atRiskAccounts.reduce((s, a) => s + (a.tmr || 0), 0)

  // Churn by product/type
  const churnByProduct = useMemo(() => {
    const types = {}
    for (const d of churnDeals) {
      const t = (d.product || d.type || 'Unknown').trim()
      if (!types[t]) types[t] = { name: t, value: 0, count: 0 }
      types[t].value += Math.abs(d.mrr || 0)
      types[t].count++
    }
    return Object.values(types).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [churnDeals])

  // --- Buy Patterns data ---
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

  const avgCycle = cycleTrend.length > 0 ? cycleTrend[cycleTrend.length - 1].avgDays : null

  // --- Pipeline by forecast category ---
  const byForecast = useMemo(() => {
    const cats = {}
    for (const d of allActiveDeals) {
      const f = normalizeForecast(d.forecast)
      if (!cats[f]) cats[f] = { category: f, count: 0, mrr: 0 }
      cats[f].count++
      cats[f].mrr += (d.mrr || 0)
    }
    return FORECAST_ORDER.filter(f => cats[f]).map(f => cats[f])
  }, [allActiveDeals])

  // =======================================================================
  // RENDER
  // =======================================================================

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <Badge color={T.green}>PREMIER CHANNEL</Badge>
          {selectedOwner && (
            <>
              <div className="w-px h-5 bg-revos-border" />
              <GlowBadge color={T.cyan}>{selectedOwner}</GlowBadge>
            </>
          )}
          <div className="flex-1" />
          <div className="font-mono text-[10px] text-revos-text-dim">
            {currentActiveDeals.length} active deals · {filteredAccounts.length} accounts
          </div>
        </div>

        {/* Timeline toggle */}
        <div className="flex items-center gap-3 mb-2">
          <span className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase w-16">Timeline</span>
          <div className="flex gap-0.5 bg-revos-surface rounded-xl p-0.5">
            {['month', 'quarter', 'annual'].map(m => (
              <button
                key={m}
                onClick={() => setPeriodMode(m)}
                className={cn(
                  'px-3 py-1 rounded-[10px] border-none cursor-pointer font-mono text-[10px] font-semibold capitalize',
                  periodMode === m ? 'bg-revos-card text-revos-cyan shadow-card' : 'bg-transparent text-revos-text-dim shadow-none'
                )}
              >{m}</button>
            ))}
          </div>
        </div>

        {/* Ownership toggle */}
        <div className="flex items-center gap-3 mb-2">
          <span className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase w-16">View</span>
          <div className="flex gap-0.5 bg-revos-surface rounded-xl p-0.5">
            {[['rep', 'Rep'], ['1lm', '1LM']].map(([k, label]) => (
              <button
                key={k}
                onClick={() => { setOwnerView(k); setSelectedOwner(null) }}
                className={cn(
                  'px-3 py-1 rounded-[10px] border-none cursor-pointer font-mono text-[10px] font-semibold',
                  ownerView === k ? 'bg-revos-card text-revos-cyan shadow-card' : 'bg-transparent text-revos-text-dim shadow-none'
                )}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Owner pills */}
        <div className="flex items-center gap-3">
          <span className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase w-16">Owner</span>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setSelectedOwner(null)}
              className={cn(
                'px-2.5 py-1 rounded-full border cursor-pointer font-mono text-[9px] transition-all',
                !selectedOwner
                  ? 'bg-revos-cyan/15 text-revos-cyan border-revos-cyan/30'
                  : 'bg-transparent text-revos-text-dim border-revos-border hover:border-revos-text-dim'
              )}
            >All</button>
            {ownerPills.map(name => (
              <button
                key={name}
                onClick={() => setSelectedOwner(selectedOwner === name ? null : name)}
                className={cn(
                  'px-2.5 py-1 rounded-full border cursor-pointer font-mono text-[9px] transition-all',
                  selectedOwner === name
                    ? 'bg-revos-cyan/15 text-revos-cyan border-revos-cyan/30'
                    : 'bg-transparent text-revos-text-dim border-revos-border hover:border-revos-text-dim'
                )}
              >{name}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Hero Card ── */}
      <AnimatedBorderCard className="bg-revos-card rounded-xl shadow-card p-4 mb-4" borderColor={T.accent}>
        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <Tip label={`SUM(deal MRR) where: Forecast = Closed, MRR > 0, Close Date in ${periodTitle}, Major Project = blank, Premier. Source: funnel.csv`}>
                <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase mb-1">{periodLabel} Bookings</div>
              </Tip>
              <div className="font-mono text-lg font-bold text-revos-green">{$k(periodBookings)}<span className="text-[10px] font-normal text-revos-text-dim">/mo</span></div>
            </div>
            <Sparkline data={SPARK_BOOK} color={T.green} width={48} height={20} />
          </div>
          <div className="flex items-start justify-between">
            <div>
              <Tip label={`SUM(deal MRR × Stage Win Prob) for active pipeline. Major Project = blank, Premier.`}>
                <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase mb-1">Weighted Pipeline</div>
              </Tip>
              <div className="font-mono text-lg font-bold text-revos-purple">{$k(weightedPipeline)}<span className="text-[10px] font-normal text-revos-text-dim">/mo</span></div>
              <div className="font-mono text-[9px] text-revos-text-dim">Raw: {$k(totalRawMRR)}/mo</div>
            </div>
            <Sparkline data={SPARK_PIPE} color={T.purple} width={48} height={20} />
          </div>
          <div className="flex items-start justify-between">
            <div>
              <Tip label={`Won ÷ (Won + Lost) in ${periodTitle}. = ${totalWon} ÷ (${totalWon} + ${totalLost})`}>
                <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase mb-1">Win Rate</div>
              </Tip>
              <div className="font-mono text-lg font-bold" style={{ color: winRate >= 0.5 ? T.green : T.yellow }}>{pc(winRate)}</div>
              <div className="font-mono text-[9px] text-revos-text-dim">{totalWon}W / {totalLost}L</div>
            </div>
            <ProgressRing value={Math.round(winRate * 100)} size={36} color={winRate >= 0.5 ? T.green : T.yellow} strokeWidth={2.5} />
          </div>
          <div className="flex items-start justify-between">
            <div>
              <Tip label={`SUM(|MRR|) where MRR < 0, Close Date in ${periodTitle}, Premier. Source: funnel.csv`}>
                <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase mb-1">{periodLabel} Churn</div>
              </Tip>
              <div className="font-mono text-lg font-bold text-revos-red">{$k(periodChurn)}<span className="text-[10px] font-normal text-revos-text-dim">/mo</span></div>
            </div>
            <Sparkline data={SPARK_CHURN} color={T.red} width={48} height={20} />
          </div>
        </div>

        {/* Chart */}
        <div className="border-t border-revos-border pt-3">
          <div className="font-sans text-[10px] text-revos-text-dim tracking-wide mb-2">
            BOOKINGS vs CHURN — {periodTitle.toUpperCase()}
            {periodMode === 'month' && <span className="text-revos-text-dim ml-1">(cumulative)</span>}
          </div>
          <ForecastChart data={chartData} periodMode={periodMode} />
          <div className="flex gap-4 mt-2 font-mono text-[9px]">
            <span className="text-revos-green">● Bookings</span>
            <span className="text-revos-red">● Churn</span>
            <span className="text-revos-teal">- - Net</span>
          </div>
        </div>
      </AnimatedBorderCard>

      {/* ── Section: Pipeline by Stage ── */}
      <Section
        title="Pipeline by Stage"
        badge={`${$k(totalRawMRR)}/mo → ${$k(totalWeightedMRR)}/mo`}
        defaultOpen={true}
        color={T.purple}
      >
        {stageData.length > 0 ? (
          <>
            {stageData.map(s => {
              const maxRaw = Math.max(...stageData.map(x => x.raw), 1)
              const barPct = (s.raw / maxRaw) * 100
              const color = STAGE_COLORS[s.stage] || T.textDim
              return (
                <div key={s.stage} className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-[10px] font-semibold" style={{ color }}>{s.stage}</span>
                      <span className="font-mono text-[9px] text-revos-text-dim">({(s.prob * 100).toFixed(1)}%)</span>
                      <span className="font-mono text-[9px] text-revos-text-dim">{s.count} deal{s.count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="font-mono text-[9px]">
                      <span className="text-revos-purple">{$k(s.raw)}/mo</span>
                      <span className="text-revos-text-dim"> → </span>
                      <span className="text-revos-teal font-semibold">{$k(s.weighted)}/mo</span>
                    </div>
                  </div>
                  <div className="relative h-[6px] bg-revos-border rounded-sm">
                    <div className="absolute left-0 top-0 h-full rounded-sm transition-all" style={{ width: `${barPct}%`, background: `${color}40` }} />
                    <div className="absolute left-0 top-0 h-full rounded-sm transition-all" style={{ width: `${barPct * s.prob}%`, background: color }} />
                  </div>
                </div>
              )
            })}
            <div className="flex justify-between pt-2 border-t border-revos-border font-mono text-[10px] font-bold mt-1">
              <span className="text-revos-text">Total ({currentActiveDeals.length} deals)</span>
              <span>
                <span className="text-revos-purple">{$k(totalRawMRR)}/mo</span>
                <span className="text-revos-text-dim"> → </span>
                <span className="text-revos-teal">{$k(totalWeightedMRR)}/mo</span>
              </span>
            </div>

            {/* Forecast category breakdown */}
            {byForecast.length > 0 && (
              <div className="mt-4">
                <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase mb-2">BY FORECAST CATEGORY</div>
                <div className="flex gap-2">
                  {byForecast.map(f => {
                    const color = f.category === 'Closed' ? T.green : f.category === 'Commit' ? T.teal : f.category === 'Best Case' ? T.cyan : f.category === 'Longshot' ? T.yellow : T.textDim
                    return (
                      <div key={f.category} className="flex-1 p-2.5 bg-revos-surface rounded-lg" style={{ borderLeft: `3px solid ${color}` }}>
                        <div className="font-sans text-[9px] text-revos-text-dim mb-0.5">{f.category}</div>
                        <div className="font-mono text-sm font-bold" style={{ color }}>{$k(f.mrr)}/mo</div>
                        <div className="font-mono text-[9px] text-revos-text-dim">{f.count} deal{f.count !== 1 ? 's' : ''}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6 font-mono text-[10px] text-revos-text-dim">No active pipeline deals</div>
        )}
      </Section>

      {/* ── Section: Product Intelligence ── */}
      <Section
        title="Product Intelligence"
        badge={`${productPipeline.length} products`}
        color={T.cyan}
      >
        {productPipeline.length > 0 ? (
          <div className="space-y-2">
            {productPipeline.map(p => {
              const maxVal = Math.max(...productPipeline.map(x => x.pipeline + x.bookings), 1)
              const pipePct = (p.pipeline / maxVal) * 100
              const bookPct = (p.bookings / maxVal) * 100
              return (
                <div key={p.product}>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-sans text-[10px] font-semibold text-revos-text">{p.product}</span>
                    <div className="font-mono text-[9px]">
                      <span className="text-revos-purple">{$k(p.pipeline)}/mo pipe</span>
                      {p.bookings > 0 && (
                        <>
                          <span className="text-revos-text-dim"> · </span>
                          <span className="text-revos-green">{$k(p.bookings)}/mo booked</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="relative h-[5px] bg-revos-border rounded-sm">
                    <div className="absolute left-0 top-0 h-full rounded-sm" style={{ width: `${pipePct}%`, background: `${T.purple}60` }} />
                    <div className="absolute left-0 top-0 h-full rounded-sm" style={{ width: `${bookPct}%`, background: T.green }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-6 font-mono text-[10px] text-revos-text-dim">No product data</div>
        )}
      </Section>

      {/* ── Section: Churn & Risk ── */}
      <Section
        title="Churn & Risk"
        badge={`${atRiskAccounts.length} at risk`}
        color={T.red}
      >
        {/* Churn KPIs */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-revos-surface rounded-lg p-2.5">
            <div className="font-sans text-[9px] text-revos-text-dim mb-1">Total Churn TMR</div>
            <div className="font-mono text-sm font-bold text-revos-red">{$k(totalChurnTMR)}</div>
            <div className="font-mono text-[9px] text-revos-text-dim">{churnDeals.length} deals</div>
          </div>
          <div className="bg-revos-surface rounded-lg p-2.5">
            <div className="font-sans text-[9px] text-revos-text-dim mb-1">At-Risk TMR</div>
            <div className="font-mono text-sm font-bold text-revos-orange">{$(atRiskTMR)}</div>
            <div className="font-mono text-[9px] text-revos-text-dim">{atRiskAccounts.length} accounts</div>
          </div>
          <div className="bg-revos-surface rounded-lg p-2.5">
            <div className="font-sans text-[9px] text-revos-text-dim mb-1">Avg Churn Deal</div>
            <div className="font-mono text-sm font-bold text-revos-red">{$k(churnDeals.length > 0 ? totalChurnTMR / churnDeals.length : 0)}</div>
          </div>
          <div className="bg-revos-surface rounded-lg p-2.5">
            <div className="font-sans text-[9px] text-revos-text-dim mb-1">Churn Rate</div>
            <div className="font-mono text-sm font-bold text-revos-yellow">{filteredAccounts.length > 0 ? pc(atRiskAccounts.length / filteredAccounts.length) : '---'}</div>
            <div className="font-mono text-[9px] text-revos-text-dim">of accounts at risk</div>
          </div>
        </div>

        {/* Churn by product */}
        {churnByProduct.length > 0 && (
          <div className="mb-4">
            <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase mb-2">CHURN BY PRODUCT</div>
            {churnByProduct.map(p => {
              const maxVal = Math.max(...churnByProduct.map(x => x.value), 1)
              const pct = (p.value / maxVal) * 100
              return (
                <div key={p.name} className="mb-1.5">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-sans text-[10px] text-revos-text">{p.name}</span>
                    <span className="font-mono text-[9px] text-revos-red">{$k(p.value)}/mo · {p.count} deal{p.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="relative h-[4px] bg-revos-border rounded-sm">
                    <div className="absolute left-0 top-0 h-full rounded-sm" style={{ width: `${pct}%`, background: T.red }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* At-risk accounts table */}
        {atRiskAccounts.length > 0 && (
          <div>
            <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase mb-2">AT-RISK ACCOUNTS</div>
            <div className="bg-revos-surface rounded-lg overflow-hidden">
              <div
                className="grid gap-1 px-3 py-1.5 font-sans text-[9px] text-revos-text-dim tracking-wide border-b border-revos-border"
                style={{ gridTemplateColumns: '2fr 0.6fr 0.8fr 0.6fr 1fr' }}
              >
                <div>Account</div>
                <div className="text-right">Risk</div>
                <div className="text-right">TMR</div>
                <div className="text-right">NRR</div>
                <div>Owner</div>
              </div>
              {atRiskAccounts.map((acc, i) => (
                <div
                  key={acc.name}
                  className="grid gap-1 px-3 py-1.5 text-[10px] border-b border-revos-border last:border-b-0"
                  style={{
                    gridTemplateColumns: '2fr 0.6fr 0.8fr 0.6fr 1fr',
                    background: i % 2 === 0 ? 'transparent' : `${T.surface}40`,
                  }}
                >
                  <div className="font-semibold text-revos-text">{acc.name}</div>
                  <div className="text-right">
                    <span className={cn('font-mono text-[9px] font-semibold', acc.risk_score >= 50 ? 'text-revos-red' : 'text-revos-orange')}>{acc.risk_score}</span>
                  </div>
                  <div className="text-right font-mono text-[9px] text-revos-cyan">{$(acc.tmr)}</div>
                  <div className={cn('text-right font-mono text-[9px]', acc.nrr >= 1 ? 'text-revos-green' : 'text-revos-red')}>{pc(acc.nrr)}</div>
                  <div className="font-mono text-[9px] text-revos-text-mid">{acc.sales_owner || acc.rep}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── Section: Buy Patterns & Velocity ── */}
      <Section
        title="Buy Patterns & Velocity"
        badge={avgCycle ? `${avgCycle}d avg cycle` : undefined}
        color={T.teal}
      >
        {/* Seasonality bars */}
        <div className="mb-4">
          <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase mb-2">
            <Tip label="Total closed MRR by month, aggregated across all years. Premier channel only.">BOOKING SEASONALITY</Tip>
          </div>
          <div className="flex items-end gap-1" style={{ height: 80 }}>
            {seasonality.map((m, i) => {
              const maxMRR = Math.max(...seasonality.map(x => x.mrr), 1)
              const h = maxMRR > 0 ? (m.mrr / maxMRR) * 70 : 0
              const isCurrentMonth = i === now.getMonth()
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{
                      height: Math.max(h, 2),
                      background: isCurrentMonth ? T.cyan : m.mrr > 0 ? T.green : T.border,
                      opacity: isCurrentMonth ? 1 : 0.7,
                    }}
                  />
                  <span className={cn('font-mono text-[7px]', isCurrentMonth ? 'text-revos-cyan font-bold' : 'text-revos-text-dim')}>{m.month}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sales cycle trend */}
        {cycleTrend.length > 0 && (
          <div className="mb-4">
            <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase mb-2">
              <Tip label="Average days from deal creation to close, by quarter. Premier channel only.">AVG SALES CYCLE</Tip>
            </div>
            <div className="flex items-end gap-1" style={{ height: 60 }}>
              {cycleTrend.map((q, i) => {
                const maxDays = Math.max(...cycleTrend.map(x => x.avgDays), 1)
                const h = (q.avgDays / maxDays) * 50
                const isLast = i === cycleTrend.length - 1
                return (
                  <div key={q.quarter} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="font-mono text-[8px] text-revos-text-mid">{q.avgDays}d</span>
                    <div
                      className="w-full rounded-t-sm"
                      style={{ height: Math.max(h, 2), background: isLast ? T.orange : `${T.orange}60` }}
                    />
                    <span className="font-mono text-[7px] text-revos-text-dim">{q.quarter.replace(/^\d+ /, '')}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Deal velocity summary */}
        <div>
          <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase mb-2">ACCOUNT VELOCITY</div>
          <div className="flex gap-3">
            {(() => {
              const v = { accelerating: 0, stable: 0, stalled: 0 }
              for (const a of filteredAccounts) {
                const vel = (a.velocity || '').toLowerCase()
                if (vel === 'accelerating') v.accelerating++
                else if (vel === 'stalled') v.stalled++
                else if (vel === 'stable') v.stable++
              }
              return [
                { label: 'Accelerating', count: v.accelerating, color: T.green },
                { label: 'Stable', count: v.stable, color: T.yellow },
                { label: 'Stalled', count: v.stalled, color: T.red },
              ].filter(x => x.count > 0).map(x => (
                <div key={x.label} className="flex items-center gap-1.5 bg-revos-surface rounded-lg px-3 py-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: x.color }} />
                  <span className="font-sans text-[10px] text-revos-text">{x.label}</span>
                  <span className="font-mono text-[11px] font-bold" style={{ color: x.color }}>{x.count}</span>
                </div>
              ))
            })()}
          </div>
        </div>
      </Section>
    </div>
  )
}
