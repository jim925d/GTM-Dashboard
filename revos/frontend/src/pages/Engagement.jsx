import { useState, useMemo, useRef, useEffect } from 'react'
import { T } from '../lib/constants'
import { $, $k } from '../components/shared/ChartTheme'
import { SpotlightCard, GlowBadge, AnimatedBorderCard, Sparkline, ProgressRing } from '../components/effects'
import { useAnimatedCounter } from '../components/effects/use-animated-counter'

// ─── Helpers ────────────────────────────────────────────────────────────────

const now = new Date()

function daysSince(dateStr) {
  if (!dateStr) return 999
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) {
    const p = dateStr.split('/')
    if (p.length >= 3) {
      const parsed = new Date(p[2], p[0] - 1, p[1])
      if (!isNaN(parsed.getTime())) return Math.floor((now - parsed) / 86400000)
    }
    return 999
  }
  return Math.floor((now - d) / 86400000)
}

function healthStatus(days) {
  if (days <= 14) return { label: 'CURRENT', color: T.green }
  if (days <= 45) return { label: 'WARM', color: T.yellow }
  if (days <= 90) return { label: 'NEEDS ATTENTION', color: T.orange }
  return { label: 'GONE DARK', color: T.red }
}

// ─── Catmull-Rom smooth spline ──────────────────────────────────────────────

function smoothPath(points, tension = 0.35) {
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

// ─── Collapsible Section ────────────────────────────────────────────────────

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
    <div className="mt-3">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer p-0 w-full"
        style={{ paddingTop: 4, paddingBottom: 4 }}>
        <svg width={10} height={10} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', flexShrink: 0 }}>
          <path d="M3 1.5 L7.5 5 L3 8.5" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-sans uppercase" style={{ fontSize: 10, fontWeight: 600, color, letterSpacing: '0.1em' }}>{title}</span>
        {count != null && <span className="font-mono" style={{ fontSize: 9, color: T.tertiary }}>({count})</span>}
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

// ─── Sparkline placeholder data ─────────────────────────────────────────────
const SPARK_TOTAL = [20, 25, 22, 30, 35, 32, 40, 38, 42, 48, 45, 52]
const SPARK_CALLS = [8, 10, 9, 12, 14, 11, 15, 13, 16, 18, 17, 20]
const SPARK_EMAILS = [7, 9, 8, 11, 13, 12, 15, 14, 16, 18, 17, 19]
const SPARK_MEETINGS = [5, 6, 5, 7, 8, 9, 10, 11, 10, 12, 11, 13]

// ─── Animated KPI value ─────────────────────────────────────────────────────
function AnimatedValue({ value, color }) {
  const display = useAnimatedCounter(value)
  return <span className="font-mono" style={{ fontSize: 22, fontWeight: 700, color }}>{display}</span>
}

// ─── Engagement Chart (stacked area — smooth curves) ────────────────────────

const CHART_W = 720
const CHART_H = 200
const CHART_PAD = { top: 16, right: 12, bottom: 28, left: 40 }

function EngagementChart({ data }) {
  const [hoverIdx, setHoverIdx] = useState(null)

  if (!data || data.length === 0) return null

  const w = CHART_W - CHART_PAD.left - CHART_PAD.right
  const h = CHART_H - CHART_PAD.top - CHART_PAD.bottom

  const maxTotal = Math.max(...data.map(d => d.calls + d.emails + d.meetings), 1)
  const yScale = v => CHART_PAD.top + h - (v / maxTotal) * h
  const xScale = i => CHART_PAD.left + (data.length === 1 ? w / 2 : (i / (data.length - 1)) * w)

  const layers = [
    { key: 'meetings', color: T.green, base: () => 0 },
    { key: 'emails', color: T.purple, base: d => d.meetings },
    { key: 'calls', color: T.cyan, base: d => d.meetings + d.emails },
  ]

  const getPoints = (accessor, baseFn) =>
    data.map((d, i) => ({ x: xScale(i), y: yScale(accessor(d) + baseFn(d)) }))
  const getBasePoints = (baseFn) =>
    data.map((d, i) => ({ x: xScale(i), y: yScale(baseFn(d)) }))

  // Y-axis ticks
  const yTicks = []
  const step = Math.max(1, Math.ceil(maxTotal / 4))
  for (let v = 0; v <= maxTotal; v += step) yTicks.push(v)

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" style={{ maxHeight: 220 }}>
      <defs>
        {layers.map(l => (
          <linearGradient key={l.key} id={`eng-grad-${l.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={l.color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={l.color} stopOpacity="0.02" />
          </linearGradient>
        ))}
      </defs>

      {/* Grid lines */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={CHART_PAD.left} x2={CHART_W - CHART_PAD.right}
            y1={yScale(v)} y2={yScale(v)}
            stroke={T.border} strokeWidth="0.5" strokeDasharray="3,3" />
          <text x={CHART_PAD.left - 6} y={yScale(v) + 3}
            fill={T.textDim} fontSize="8" fontFamily="'IBM Plex Mono'" textAnchor="end">{v}</text>
        </g>
      ))}

      {/* Areas + lines */}
      {layers.map(l => {
        const topPts = getPoints(d => d[l.key], l.base)
        const basePts = getBasePoints(l.base)
        const topD = smoothPath(topPts)
        const baseD = smoothPath([...basePts].reverse())
        const lastTop = topPts[topPts.length - 1]
        const lastBase = basePts[basePts.length - 1]
        const firstBase = basePts[0]
        const areaD = `${topD} L${lastTop.x},${lastBase.y} ${baseD} L${firstBase.x},${topPts[0].y} Z`

        return (
          <g key={l.key}>
            <path d={areaD} fill={`url(#eng-grad-${l.key})`} />
            <path d={topD} fill="none" stroke={l.color} strokeWidth="2" strokeLinecap="round" />
            {topPts.map((p, idx) => (
              <circle key={idx} cx={p.x} cy={p.y} r={hoverIdx === idx ? 4 : 2.5}
                fill={l.color} stroke={T.card} strokeWidth="1.5"
                style={{ transition: 'r 0.15s ease' }} />
            ))}
          </g>
        )
      })}

      {/* X-axis labels */}
      {data.map((d, i) => (
        <text key={i} x={xScale(i)} y={CHART_H - 4}
          fill={T.textDim} fontSize="8" fontFamily="'IBM Plex Mono'" textAnchor="middle">
          {d.label}
        </text>
      ))}

      {/* Hover zones */}
      {data.map((d, i) => {
        const bw = data.length > 1 ? w / (data.length - 1) : w
        return (
          <rect key={i} x={xScale(i) - bw / 2} y={CHART_PAD.top} width={bw} height={h}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} />
        )
      })}

      {/* Tooltip */}
      {hoverIdx !== null && (() => {
        const d = data[hoverIdx]
        const x = xScale(hoverIdx)
        const total = d.calls + d.emails + d.meetings
        return (
          <g>
            <line x1={x} x2={x} y1={CHART_PAD.top} y2={CHART_PAD.top + h}
              stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <rect x={x - 52} y={4} width={104} height={56} rx={8}
              fill={T.card} stroke={T.border} strokeWidth="1" />
            <text x={x} y={17} fill={T.text} fontSize="9" fontFamily="'IBM Plex Mono'" fontWeight="600" textAnchor="middle">{d.label} — {total}</text>
            <text x={x - 40} y={30} fill={T.cyan} fontSize="8" fontFamily="'IBM Plex Mono'">Calls: {d.calls}</text>
            <text x={x - 40} y={41} fill={T.purple} fontSize="8" fontFamily="'IBM Plex Mono'">Emails: {d.emails}</text>
            <text x={x - 40} y={52} fill={T.green} fontSize="8" fontFamily="'IBM Plex Mono'">Meetings: {d.meetings}</text>
          </g>
        )
      })()}

      {/* Legend */}
      {[
        { label: 'Calls', color: T.cyan },
        { label: 'Emails', color: T.purple },
        { label: 'Meetings', color: T.green },
      ].map((l, i) => (
        <g key={l.label} transform={`translate(${CHART_W - 180 + i * 65}, ${CHART_PAD.top - 10})`}>
          <circle cx={0} cy={0} r={3} fill={l.color} />
          <text x={6} y={3} fill={T.textMid} fontSize="8" fontFamily="'IBM Plex Mono'">{l.label}</text>
        </g>
      ))}
    </svg>
  )
}

// ─── Account Card ───────────────────────────────────────────────────────────

function AccountCard({ acc, isOpen, onToggle, onSelect, accIdx }) {
  const ds = daysSince(acc.engagement?.lastDate)
  const status = healthStatus(ds)
  const events = acc.engagement?.events || []
  const dealCount = (acc.active_deals || []).length

  // Type breakdown
  const typeCounts = useMemo(() => {
    const counts = { call: 0, email: 0, meeting: 0, other: 0 }
    for (const ev of events) {
      const t = (ev.t || '').toLowerCase()
      if (t.includes('call') || t.includes('phone')) counts.call++
      else if (t.includes('email') || t.includes('mail')) counts.email++
      else if (t.includes('meeting') || t.includes('demo') || t.includes('visit')) counts.meeting++
      else counts.other++
    }
    return counts
  }, [events])

  return (
    <div className="mb-2 opacity-0 animate-fade-slide-in"
      style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}>
      <div onClick={onToggle}
        className="cursor-pointer transition-all duration-300"
        style={{
          borderRadius: 14,
          border: `1px solid rgba(255,255,255,${isOpen ? 0.08 : 0.04})`,
          borderLeft: `3px solid ${status.color}`,
          background: T.card,
          boxShadow: isOpen
            ? '0 8px 32px rgba(120,90,255,0.06), 0 0 0 1px rgba(120,90,255,0.1)'
            : '0 1px 3px rgba(0,0,0,0.2)',
        }}>

        {/* Collapsed row */}
        <div className="flex items-center gap-3" style={{ padding: '12px 16px' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[13px] cursor-pointer"
                onClick={e => { e.stopPropagation(); onSelect(accIdx) }}
                onMouseEnter={e => e.currentTarget.style.color = T.cyan}
                onMouseLeave={e => e.currentTarget.style.color = T.text}>
                {acc.name}
              </span>
              <GlowBadge color={status.color} className="text-[8px] px-2 py-0">{status.label}</GlowBadge>
              {dealCount > 0 && <GlowBadge color={T.cyan} className="text-[8px] px-2 py-0">{dealCount} DEAL{dealCount > 1 ? 'S' : ''}</GlowBadge>}
            </div>
            <div className="flex gap-3 mt-0.5">
              <span className="font-mono text-[10px]" style={{ color: T.cyan }}>{$(acc.tmr)} TMR</span>
              {acc.pipeline_mrr > 0 && <span className="font-mono text-[10px]" style={{ color: T.purple }}>{$k(acc.pipeline_mrr)} pipe</span>}
              <span className="font-mono text-[10px]" style={{ color: status.color }}>
                {ds < 999 ? `${ds}d ago` : 'Never contacted'}
              </span>
            </div>
          </div>

          {/* Type dots */}
          <div className="flex gap-2">
            {typeCounts.call > 0 && <span className="font-mono text-[9px]" style={{ color: T.cyan }}>📞{typeCounts.call}</span>}
            {typeCounts.email > 0 && <span className="font-mono text-[9px]" style={{ color: T.purple }}>📧{typeCounts.email}</span>}
            {typeCounts.meeting > 0 && <span className="font-mono text-[9px]" style={{ color: T.green }}>🤝{typeCounts.meeting}</span>}
          </div>

          <span className="font-mono text-[11px] font-bold" style={{ color: events.length > 10 ? T.green : events.length > 3 ? T.yellow : T.red }}>
            {events.length}
          </span>

          <svg width={12} height={12} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease', flexShrink: 0, opacity: 0.3 }}>
            <path d="M2 4 L6 8 L10 4" fill="none" stroke={T.textDim} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Expanded content */}
        {isOpen && (
          <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
            {/* Type breakdown */}
            <div className="grid grid-cols-4 gap-2 mt-3 rounded-lg" style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.015)' }}>
              {[
                { label: 'Calls', value: typeCounts.call, color: T.cyan, icon: '📞' },
                { label: 'Emails', value: typeCounts.email, color: T.purple, icon: '📧' },
                { label: 'Meetings', value: typeCounts.meeting, color: T.green, icon: '🤝' },
                { label: 'Other', value: typeCounts.other, color: T.textDim, icon: '📋' },
              ].map(t => (
                <div key={t.label} className="text-center">
                  <div style={{ fontSize: 16 }}>{t.icon}</div>
                  <div className="font-mono" style={{ fontSize: 16, fontWeight: 700, color: t.color }}>{t.value}</div>
                  <div className="font-sans uppercase" style={{ fontSize: 8, color: T.textDim, letterSpacing: '0.08em' }}>{t.label}</div>
                </div>
              ))}
            </div>

            {/* Recent activity timeline */}
            {events.length > 0 && (
              <div className="mt-3">
                <div className="font-sans uppercase" style={{ fontSize: 9, fontWeight: 600, color: T.textDim, letterSpacing: '0.1em', marginBottom: 6 }}>
                  Recent Activity
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {events.slice(0, 8).map((ev, idx) => {
                    const t = (ev.t || '').toLowerCase()
                    const evColor = t.includes('call') || t.includes('phone') ? T.cyan
                      : t.includes('email') || t.includes('mail') ? T.purple
                      : t.includes('meeting') || t.includes('demo') ? T.green
                      : T.textDim
                    return (
                      <div key={idx} className="flex items-start gap-2 mb-1.5">
                        <div style={{ width: 4, height: 4, borderRadius: 2, background: evColor, marginTop: 5, flexShrink: 0 }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex gap-2 items-baseline">
                            <span className="font-mono text-[9px]" style={{ color: evColor }}>{ev.t}</span>
                            <span className="font-mono text-[8px] text-revos-text-dim">{ev.d}</span>
                          </div>
                          {ev.s && <div className="font-mono text-[9px] text-revos-text-mid overflow-hidden text-ellipsis whitespace-nowrap">{ev.s}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Engagement({ accounts, onSelect }) {
  const [period, setPeriod] = useState('quarterly')
  const [expandedAcc, setExpandedAcc] = useState(null)

  // Build monthly engagement data from all accounts
  const chartData = useMemo(() => {
    const monthMap = {}
    for (const acc of accounts) {
      const events = acc.engagement?.events || []
      for (const ev of events) {
        if (!ev.d) continue
        const d = new Date(ev.d)
        if (isNaN(d.getTime())) continue
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthMap[key]) monthMap[key] = { calls: 0, emails: 0, meetings: 0 }
        const t = (ev.t || '').toLowerCase()
        if (t.includes('call') || t.includes('phone')) monthMap[key].calls++
        else if (t.includes('email') || t.includes('mail')) monthMap[key].emails++
        else if (t.includes('meeting') || t.includes('demo') || t.includes('visit')) monthMap[key].meetings++
        else monthMap[key].emails++ // default to email
      }
    }

    let months = Object.keys(monthMap).sort()
    if (months.length === 0) return []

    // Apply period filter
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const currentQ = Math.ceil(currentMonth / 3)

    if (period === 'quarterly') {
      // Current quarter + previous quarter = up to 6 months
      const qStart = (currentQ - 1) * 3 + 1
      const prevQStart = qStart <= 3 ? (currentYear - 1) * 100 + 10 : currentYear * 100 + (qStart - 3)
      const startKey = qStart <= 3
        ? `${currentYear - 1}-${String(10).padStart(2, '0')}`
        : `${currentYear}-${String(qStart - 3).padStart(2, '0')}`
      months = months.filter(m => m >= startKey)
    } else if (period === 'yearly') {
      const startKey = `${currentYear - 1}-${String(currentMonth + 1).padStart(2, '0')}`
      months = months.filter(m => m >= startKey)
    }

    return months.map(m => {
      const d = monthMap[m] || { calls: 0, emails: 0, meetings: 0 }
      const parts = m.split('-')
      const label = `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(parts[1]) - 1]} ${parts[0].slice(2)}`
      return { label, ...d }
    })
  }, [accounts, period])

  // KPI totals
  const kpiTotals = useMemo(() => {
    let calls = 0, emails = 0, meetings = 0
    for (const d of chartData) {
      calls += d.calls
      emails += d.emails
      meetings += d.meetings
    }
    return { total: calls + emails + meetings, calls, emails, meetings }
  }, [chartData])

  // Account health sections
  const { needsEngagement, engaged } = useMemo(() => {
    const needs = []
    const eng = []
    for (const acc of accounts) {
      const ds = daysSince(acc.engagement?.lastDate)
      if (ds > 45) needs.push(acc)
      else eng.push(acc)
    }
    needs.sort((a, b) => daysSince(b.engagement?.lastDate) - daysSince(a.engagement?.lastDate))
    eng.sort((a, b) => daysSince(a.engagement?.lastDate) - daysSince(b.engagement?.lastDate))
    return { needsEngagement: needs, engaged: eng }
  }, [accounts])

  return (
    <div className="relative">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-[0.03]"
        style={{ background: 'radial-gradient(circle, #7c5aff 0%, transparent 70%)' }} />

      {/* ── KPI STRIP ── */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'TOTAL ENGAGEMENTS', value: kpiTotals.total, color: T.text, icon: '📊', spark: SPARK_TOTAL, sparkColor: T.text },
          { label: 'CALLS', value: kpiTotals.calls, color: T.cyan, icon: '📞', spark: SPARK_CALLS, sparkColor: T.cyan },
          { label: 'EMAILS', value: kpiTotals.emails, color: T.purple, icon: '📧', spark: SPARK_EMAILS, sparkColor: T.purple },
          { label: 'MEETINGS', value: kpiTotals.meetings, color: T.green, icon: '🤝', spark: SPARK_MEETINGS, sparkColor: T.green },
        ].map((kpi, i) => (
          <SpotlightCard key={i} className="p-4 opacity-0 animate-fade-slide-in"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'forwards' }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <span style={{ fontSize: 20 }}>{kpi.icon}</span>
                <div>
                  <div className="font-sans uppercase" style={{ fontSize: 8, fontWeight: 600, color: T.textDim, letterSpacing: '0.1em', marginBottom: 2 }}>{kpi.label}</div>
                  <AnimatedValue value={kpi.value} color={kpi.color} />
                </div>
              </div>
              <Sparkline data={kpi.spark} color={kpi.sparkColor} width={56} height={22} />
            </div>
          </SpotlightCard>
        ))}
      </div>

      {/* ── CHART + PERIOD TOGGLE ── */}
      <AnimatedBorderCard className="mb-4 opacity-0 animate-fade-slide-in" borderColor={T.accent} style={{ animationDelay: '250ms', animationFillMode: 'forwards' }}>
        <div style={{ padding: '16px 20px' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-sans uppercase" style={{ fontSize: 10, fontWeight: 600, color: T.textDim, letterSpacing: '0.1em' }}>
              Engagement Activity
            </div>
            <div className="flex gap-1">
              {['monthly', 'quarterly', 'yearly'].map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className="px-2.5 py-1 rounded-lg cursor-pointer font-sans text-[9px] border-none transition-all duration-150"
                  style={{
                    fontWeight: period === p ? 600 : 400,
                    background: period === p ? `${T.accent}15` : 'transparent',
                    boxShadow: period === p ? `0 0 0 1px ${T.accent}30, 0 0 12px ${T.accent}15` : 'none',
                    color: period === p ? T.accent : T.textDim,
                  }}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {chartData.length > 0 ? (
            <EngagementChart data={chartData} />
          ) : (
            <div className="text-center py-10 font-mono text-[11px] text-revos-text-dim">No engagement data available</div>
          )}
        </div>
      </AnimatedBorderCard>

      {/* ── ACCOUNT HEALTH SECTIONS ── */}
      <div className="opacity-0 animate-fade-slide-in" style={{ animationDelay: '350ms', animationFillMode: 'forwards' }}>
        {/* Needs Engagement */}
        <Section title="Needs Engagement" color={T.red} count={needsEngagement.length} defaultOpen={true}>
          {needsEngagement.length === 0 ? (
            <div className="py-4 text-center font-mono text-[11px] text-revos-text-dim">All accounts are actively engaged</div>
          ) : (
            needsEngagement.map(acc => {
              const accIdx = accounts.findIndex(a => a.name === acc.name)
              return (
                <AccountCard key={acc.name} acc={acc}
                  isOpen={expandedAcc === acc.name}
                  onToggle={() => setExpandedAcc(expandedAcc === acc.name ? null : acc.name)}
                  onSelect={onSelect} accIdx={accIdx >= 0 ? accIdx : 0} />
              )
            })
          )}
        </Section>

        {/* Engaged */}
        <Section title="Engaged" color={T.green} count={engaged.length} defaultOpen={true}>
          {engaged.length === 0 ? (
            <div className="py-4 text-center font-mono text-[11px] text-revos-text-dim">No recently engaged accounts</div>
          ) : (
            engaged.map(acc => {
              const accIdx = accounts.findIndex(a => a.name === acc.name)
              return (
                <AccountCard key={acc.name} acc={acc}
                  isOpen={expandedAcc === acc.name}
                  onToggle={() => setExpandedAcc(expandedAcc === acc.name ? null : acc.name)}
                  onSelect={onSelect} accIdx={accIdx >= 0 ? accIdx : 0} />
              )
            })
          )}
        </Section>
      </div>
    </div>
  )
}
