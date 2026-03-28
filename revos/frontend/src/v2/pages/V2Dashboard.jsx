import { useState, useMemo } from 'react'
import { V2, V2_FONTS, ENGINE_COLORS, STAGE_WEIGHTS, fmt, fmtPct } from '../tokens'
import { DEMO_ACCOUNTS, DEMO_DEALS, DEMO_ALERTS, DEMO_ACTIONS } from '../demoData'
import useDeals from '../hooks/useDeals'
import usePredictions from '../hooks/usePredictions'
import useEngineInsights from '../hooks/useEngineInsights'

// ─── Animation keyframes (injected once) ─────────────────────────────────────
const styleId = 'v2-dash-anims'
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    @keyframes v2FadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes v2Pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
    .v2-fade-up { animation: v2FadeUp 0.4s ease-out both; }
    .v2-row-hover:hover { background: ${V2.surfaceHover} !important; }
    .v2-card-hover:hover { border-color: ${V2.accent} !important; box-shadow: ${V2.shadowGlow} !important; }
  `
  document.head.appendChild(style)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function urgencyScore(deal) {
  const gap = deal.gap || 0
  const invProb = 1 - (deal.winProb || 0)
  return gap * 4.5 + invProb * 40
}

function getThisMonthDeals(deals) {
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return deals.filter(d => d.close_date && d.close_date.startsWith(ym))
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color, delay = 0 }) {
  return (
    <div
      className="v2-fade-up"
      style={{
        animationDelay: `${delay}ms`,
        background: V2.card,
        border: `0.5px solid ${V2.border}`,
        borderRadius: V2.radius,
        padding: '20px 20px 16px',
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontFamily: V2_FONTS.serif, fontSize: 32, fontWeight: 400, color: color || V2.text, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function ActionCarousel({ deals, actions }) {
  const [idx, setIdx] = useState(0)
  const actionDeals = useMemo(() =>
    deals
      .filter(d => urgencyScore(d) >= 40 && actions[d.id])
      .sort((a, b) => urgencyScore(b) - urgencyScore(a)),
    [deals, actions]
  )
  if (!actionDeals.length) return null
  const deal = actionDeals[idx]
  const action = actions[deal.id]
  const score = urgencyScore(deal)

  return (
    <div
      className="v2-fade-up"
      style={{
        animationDelay: '200ms',
        background: V2.card,
        border: `0.5px solid ${V2.accentBorder}`,
        borderRadius: V2.radius,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: score > 80 ? V2.red : V2.amber, animation: 'v2Pulse 2s infinite' }} />
          <span style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em' }}>PRIORITY ACTION</span>
          <span style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.accent }}>{idx + 1}/{actionDeals.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {actionDeals.map((_, i) => (
            <div
              key={i}
              onClick={() => setIdx(i)}
              style={{
                width: 6, height: 6, borderRadius: '50%', cursor: 'pointer',
                background: i === idx ? V2.accent : V2.border,
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ fontFamily: V2_FONTS.sans, fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
        {action.title}
      </div>
      <div style={{ fontSize: 13, color: V2.textMid, lineHeight: 1.5, marginBottom: 12 }}>
        {action.desc}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          style={{
            fontFamily: V2_FONTS.sans, fontSize: 12, fontWeight: 600,
            background: V2.accent, color: '#fff', border: 'none',
            padding: '8px 18px', borderRadius: V2.radiusSm, cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.target.style.background = V2.accentHover}
          onMouseLeave={e => e.target.style.background = V2.accent}
        >
          {action.cta}
        </button>
        <div style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.textDim }}>
          {deal.accountName} · {deal.product_group} · {fmt(deal.mrr)}/mo
        </div>
        {idx < actionDeals.length - 1 && (
          <button
            onClick={() => setIdx(i => i + 1)}
            style={{
              marginLeft: 'auto', fontFamily: V2_FONTS.sans, fontSize: 12, color: V2.accent,
              background: 'none', border: `1px solid ${V2.accentBorder}`, padding: '6px 14px',
              borderRadius: V2.radiusSm, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.target.style.borderColor = V2.accent; e.target.style.color = V2.text }}
            onMouseLeave={e => { e.target.style.borderColor = V2.accentBorder; e.target.style.color = V2.accent }}
          >
            Next &rarr;
          </button>
        )}
      </div>
    </div>
  )
}

function MicroBar({ value, max = 1, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 48, height: 4, background: V2.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(value / max * 100, 100)}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color }}>{fmtPct(value)}</span>
    </div>
  )
}

function DealTable({ deals, onSelectDeal }) {
  const sorted = useMemo(() =>
    [...deals].sort((a, b) => urgencyScore(b) - urgencyScore(a)),
    [deals]
  )

  return (
    <div
      className="v2-fade-up"
      style={{
        animationDelay: '280ms',
        background: V2.card,
        border: `0.5px solid ${V2.border}`,
        borderRadius: V2.radius,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${V2.border}` }}>
        <span style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          DEAL TABLE · SORTED BY URGENCY
        </span>
      </div>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.8fr', padding: '10px 20px', borderBottom: `1px solid ${V2.border}`, background: V2.bgSubtle }}>
        {['Account', 'Stage', 'Win Prob', 'MRR', 'Gap'].map(h => (
          <div key={h} style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.04em' }}>{h}</div>
        ))}
      </div>
      {/* Rows */}
      {sorted.map((deal) => {
        const probColor = deal.winProb >= 0.7 ? V2.teal : deal.winProb >= 0.4 ? V2.amber : V2.red
        return (
          <div
            key={deal.id}
            className="v2-row-hover"
            onClick={() => onSelectDeal && onSelectDeal(deal)}
            style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.8fr',
              padding: '12px 20px', borderBottom: `1px solid ${V2.border}`,
              cursor: 'pointer', transition: 'background 0.12s',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{deal.accountName}</div>
              <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, marginTop: 2 }}>{deal.product_group}</div>
            </div>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: V2.textMid, alignSelf: 'center' }}>{deal.stage}</div>
            <div style={{ alignSelf: 'center' }}>
              <MicroBar value={deal.winProb} color={probColor} />
            </div>
            <div style={{ fontFamily: V2_FONTS.serif, fontSize: 16, color: V2.purple, alignSelf: 'center' }}>{fmt(deal.mrr)}</div>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: deal.gap > 30 ? V2.red : V2.textMid, alignSelf: 'center' }}>{deal.gap}d</div>
          </div>
        )
      })}
    </div>
  )
}

function EnginePill({ engine }) {
  const c = ENGINE_COLORS[engine] || ENGINE_COLORS.event
  return (
    <span style={{
      fontFamily: V2_FONTS.mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
      color: c.text, background: c.bg, border: `1px solid ${c.border}`,
      padding: '2px 8px', borderRadius: V2.radiusFull, textTransform: 'uppercase',
    }}>
      {engine}
    </span>
  )
}

function SidebarAlerts({ alerts }) {
  return (
    <div style={{ background: V2.card, border: `0.5px solid ${V2.border}`, borderRadius: V2.radius, padding: 16, marginBottom: 12 }}>
      <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', marginBottom: 12, textTransform: 'uppercase' }}>Alerts</div>
      {alerts.map(a => (
        <div key={a.id} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0,
            background: a.severity === 'high' ? V2.red : a.severity === 'medium' ? V2.amber : V2.teal,
          }} />
          <div>
            <div style={{ fontSize: 12, color: V2.textMid, lineHeight: 1.4 }}>{a.text}</div>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, marginTop: 3 }}>{a.ts}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SidebarInsights({ insights }) {
  const recent = insights.slice(0, 8)
  return (
    <div style={{ background: V2.card, border: `0.5px solid ${V2.border}`, borderRadius: V2.radius, padding: 16, marginBottom: 12 }}>
      <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', marginBottom: 12, textTransform: 'uppercase' }}>Engine Insights</div>
      {recent.map((ins, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <EnginePill engine={ins.engine || ins.type || 'event'} />
            <span style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim }}>{ins.ts}</span>
          </div>
          <div style={{ fontSize: 12, color: V2.textMid, lineHeight: 1.4 }}>{ins.text}</div>
        </div>
      ))}
    </div>
  )
}

function SidebarEngagement({ accounts }) {
  const [expanded, setExpanded] = useState(false)
  // Aggregate last 14 days of engagement events
  const dailyData = useMemo(() => {
    const days = {}
    const now = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i)
      const key = `${d.getMonth() + 1}/${d.getDate()}`
      days[key] = { calls: 0, emails: 0, meetings: 0 }
    }
    for (const acct of accounts) {
      for (const ev of (acct.engagement?.events || [])) {
        const parts = ev.d?.split('/')
        if (!parts || parts.length < 2) continue
        const key = `${parseInt(parts[0])}/${parseInt(parts[1])}`
        if (days[key]) {
          if (ev.t === 'call') days[key].calls++
          else if (ev.t === 'email') days[key].emails++
          else if (ev.t === 'meeting') days[key].meetings++
        }
      }
    }
    return Object.entries(days).map(([label, v]) => ({ label, ...v, total: v.calls + v.emails + v.meetings }))
  }, [accounts])

  const maxVal = Math.max(...dailyData.map(d => d.total), 1)

  return (
    <div
      style={{
        background: V2.card, border: `0.5px solid ${V2.border}`, borderRadius: V2.radius,
        padding: expanded ? 16 : '12px 16px', cursor: 'pointer', transition: 'all 0.2s',
        overflow: 'hidden',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Engagement · 14d
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={V2.textDim} strokeWidth="2" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {expanded && (
        <div style={{ marginTop: 12 }}>
          {/* Mini bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, marginBottom: 8 }}>
            {dailyData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column-reverse', gap: 1 }}>
                  {d.calls > 0 && <div style={{ height: (d.calls / maxVal) * 60, background: V2.teal, borderRadius: 1, minHeight: 2 }} />}
                  {d.emails > 0 && <div style={{ height: (d.emails / maxVal) * 60, background: V2.blue, borderRadius: 1, minHeight: 2 }} />}
                  {d.meetings > 0 && <div style={{ height: (d.meetings / maxVal) * 60, background: V2.purple, borderRadius: 1, minHeight: 2 }} />}
                  {d.total === 0 && <div style={{ height: 2, background: V2.border, borderRadius: 1 }} />}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {[{ label: 'Calls', color: V2.teal }, { label: 'Emails', color: V2.blue }, { label: 'Meetings', color: V2.purple }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: 1, background: l.color }} />
                <span style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function V2Dashboard({ accounts = [], rawData = {}, onNavigate, onSelectDeal }) {
  // Use demo data when no real pipeline deals exist
  const { deals: realDeals } = useDeals(accounts)
  const isDemo = !realDeals.length
  const accts = isDemo ? DEMO_ACCOUNTS : accounts
  const allDeals = isDemo ? DEMO_DEALS : realDeals
  const { predictions, avgChurnRisk } = usePredictions(accts)
  const { insights } = useEngineInsights(accts)

  // Metrics
  const weightedPipeline = useMemo(() =>
    allDeals.reduce((sum, d) => sum + (d.mrr || 0) * (STAGE_WEIGHTS[d.stage] || 0.1), 0),
    [allDeals]
  )

  const dealsAtRisk = useMemo(() =>
    allDeals.filter(d => urgencyScore(d) >= 40).length,
    [allDeals]
  )

  const closeThisMonth = getThisMonthDeals(allDeals)
  const closeThisMonthMRR = closeThisMonth.reduce((s, d) => s + (d.mrr || 0), 0)

  const forecastConfidence = useMemo(() => {
    if (!allDeals.length) return 0
    return allDeals.reduce((s, d) => s + (d.winProb || 0), 0) / allDeals.length
  }, [allDeals])

  const alerts = DEMO_ALERTS
  const actions = DEMO_ACTIONS

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
      {/* ── Main Column ── */}
      <div>
        {/* Metric Strip */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <MetricCard label="Weighted Pipeline" value={fmt(weightedPipeline)} sub={`${allDeals.length} active deals`} color={V2.purple} delay={0} />
          <MetricCard label="Forecast Confidence" value={fmtPct(forecastConfidence)} sub="avg win probability" color={V2.teal} delay={60} />
          <MetricCard label="Deals at Risk" value={String(dealsAtRisk)} sub="urgency score ≥ 40" color={V2.red} delay={120} />
          <MetricCard label="Close This Month" value={fmt(closeThisMonthMRR)} sub={`${closeThisMonth.length} deals`} color={V2.accent} delay={180} />
        </div>

        {/* Action Carousel */}
        <ActionCarousel deals={allDeals} actions={actions} />

        {/* Deal Table */}
        <DealTable deals={allDeals} onSelectDeal={onSelectDeal} />
      </div>

      {/* ── Sidebar ── */}
      <div className="v2-fade-up" style={{ animationDelay: '320ms' }}>
        <SidebarAlerts alerts={alerts} />
        <SidebarInsights insights={isDemo ? accts.flatMap(a => a.signals || []) : insights} />
        <SidebarEngagement accounts={accts} />
      </div>
    </div>
  )
}
