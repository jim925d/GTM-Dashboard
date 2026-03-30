import { useState, useMemo } from 'react'
import { V2, V2_FONTS, ENGINE_COLORS, STAGES, STAGE_WEIGHTS, fmt, fmtPct } from '../tokens'
import { DEMO_ACCOUNTS } from '../demoData'

// ─── Animations ───────────────────────────────────────────────────────────────
const styleId = 'v2-deal-anims'
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    @keyframes v2FadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .v2-fade-up { animation: v2FadeUp 0.4s ease-out both; }
  `
  document.head.appendChild(style)
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRESCRIPTIVE ACTIONS ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

const STAGE_EXIT_CRITERIA = {
  'Discover': {
    next: 'Design', avgDays: 14, maxDays: 25,
    criteria: [
      { name: 'Pain identified', question: 'Have you identified a quantified business pain?' },
      { name: 'Budget range confirmed', question: 'Is there budget allocated or allocatable?' },
      { name: 'Decision maker identified', question: 'Do you know who owns the budget?' },
      { name: 'Timeline established', question: 'Is there an event or deadline driving the timeline?' },
    ],
  },
  'Design': {
    next: 'Propose', avgDays: 16, maxDays: 28,
    criteria: [
      { name: 'Technical requirements gathered', question: 'Have you completed a design review or technical discovery?' },
      { name: 'Solution mapped to pain', question: 'Does your proposed solution directly address the identified pain?' },
      { name: 'Champion engaged', question: 'Is there an internal advocate pushing this forward?' },
      { name: 'Competitive landscape known', question: 'Do you know if other vendors are being evaluated?' },
    ],
  },
  'Propose': {
    next: 'Negotiate', avgDays: 12, maxDays: 21,
    criteria: [
      { name: 'Proposal delivered', question: 'Has the formal proposal been presented (not just emailed)?' },
      { name: 'Pricing reviewed', question: 'Has the customer reviewed and responded to pricing?' },
      { name: 'Decision criteria confirmed', question: 'Do you know exactly how they will evaluate?' },
      { name: 'Executive sponsor met', question: 'Has a VP+ been in at least one meeting?' },
    ],
  },
  'Negotiate': {
    next: 'Closed Won', avgDays: 10, maxDays: 18,
    criteria: [
      { name: 'Terms agreed', question: 'Are contract terms (length, SLA, pricing) agreed?' },
      { name: 'Legal/procurement engaged', question: 'Is legal or procurement reviewing the contract?' },
      { name: 'Paper process known', question: 'Do you know the signature path and expected timeline?' },
      { name: 'No outstanding objections', question: 'Are all technical and commercial objections resolved?' },
    ],
  },
}

function getEngagementActions(deal, events) {
  const actions = []
  const touchCount = events.length
  const now = new Date()

  // Days since last touch
  let daysSinceTouch = deal.gap || 0
  if (events.length > 0) {
    const lastDate = events[0]?.d
    if (lastDate) {
      const parts = lastDate.split('/')
      if (parts.length >= 3) {
        const d = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`)
        if (!isNaN(d)) daysSinceTouch = Math.max(0, Math.floor((now - d) / 86400000))
      }
    }
  }

  if (daysSinceTouch >= 7) {
    actions.push({
      category: 'engagement', severity: daysSinceTouch >= 14 ? 'critical' : 'warning',
      title: `Re-engage \u2014 ${daysSinceTouch} day activity gap`,
      action: 'Schedule a call or send a value-add email within 48 hours. Reference a specific next step or share new intel.',
      impact: `+17%`, impactNum: 17,
      basis: `Deals with ${daysSinceTouch}+ day gaps at ${deal.stage} close at 31%. Re-engaging within 48h recovers to 53%.`,
    })
  }

  // No meetings
  const meetings = events.filter(e => e.t === 'meeting' || e.t === 'call')
  if (meetings.length === 0 && touchCount >= 2) {
    actions.push({
      category: 'engagement', severity: 'warning',
      title: 'Schedule a meeting \u2014 no live conversations',
      action: 'Propose a 30-minute design review, pricing walkthrough, or executive alignment call.',
      impact: '+9%', impactNum: 9,
      basis: 'Deals with at least one meeting close at 82% vs 64% for email-only.',
    })
  }

  // Single contact
  const contacts = new Set(events.map(e => e.c).filter(Boolean))
  if (contacts.size <= 1 && touchCount > 0) {
    actions.push({
      category: 'engagement', severity: 'warning',
      title: `Single-threaded \u2014 ${contacts.size || 1} contact`,
      action: 'Ask your contact to include their manager or a colleague from another department in the next meeting.',
      impact: '+8%', impactNum: 8,
      basis: 'Multi-threaded deals (3+ contacts) close at 78% vs 54% for single-threaded.',
    })
  }

  return actions
}

function getStageActions(deal) {
  const actions = []
  const sc = STAGE_EXIT_CRITERIA[deal.stage]
  if (!sc) return actions
  const days = deal.daysInStage || 0

  if (days > sc.maxDays) {
    actions.push({
      category: 'stage', severity: 'critical',
      title: `Overdue in ${deal.stage} \u2014 ${days}d (max ${sc.maxDays})`,
      action: `This deal has been in ${deal.stage} for ${days - sc.maxDays} days beyond the typical maximum. Advance to ${sc.next} or assess if stalled.`,
      impact: '-10%', impactNum: -10,
      basis: `Deals exceeding ${sc.maxDays} days in ${deal.stage} close at 22% lower rates.`,
    })
  } else if (days > sc.avgDays) {
    actions.push({
      category: 'stage', severity: 'monitor',
      title: `${days}d in ${deal.stage} (avg ${sc.avgDays})`,
      action: `Slightly above average. Review exit criteria to identify what blocks advancement to ${sc.next}.`,
      impact: 'Monitor', impactNum: 0,
      basis: `Average time in ${deal.stage} is ${sc.avgDays} days.`,
    })
  }

  // Always show exit criteria checklist
  actions.push({
    category: 'stage', severity: 'info', type: 'checklist',
    title: `Exit criteria: ${deal.stage} \u2192 ${sc.next}`,
    items: sc.criteria,
  })

  return actions
}

function getTimingActions(deal) {
  const actions = []
  const today = new Date()

  if (deal.close_date) {
    const close = new Date(deal.close_date)
    if (!isNaN(close)) {
      const daysUntil = Math.ceil((close - today) / 86400000)
      if (daysUntil < 0) {
        actions.push({
          category: 'timing', severity: 'critical',
          title: `Close date passed ${Math.abs(daysUntil)} days ago`,
          action: 'Update the close date to a realistic target. Stale close dates reduce forecast accuracy.',
          impact: 'Forecast risk', impactNum: 0,
          basis: 'Deals with expired close dates close at 40% lower rates.',
        })
      } else if (daysUntil <= 7 && !['Negotiate', 'Closed Won'].includes(deal.stage)) {
        actions.push({
          category: 'timing', severity: 'warning',
          title: `Close date in ${daysUntil}d but still in ${deal.stage}`,
          action: `Accelerate with a clear proposal + decision meeting, or push close date to a realistic target.`,
          impact: 'At risk', impactNum: -5,
          basis: 'Deals that slip past their close date have 35% lower close rates.',
        })
      }
    }
  }

  return actions
}

function getCompetitiveActions(deal, signals) {
  const actions = []
  const compSignals = signals.filter(s => s.engine === 'competitive' || (s.text || '').toLowerCase().includes('competitor'))

  if (compSignals.length > 0) {
    actions.push({
      category: 'competitive', severity: 'warning',
      title: `Competitive threat detected`,
      action: compSignals[0].text,
      impact: 'Position proactively', impactNum: 0,
      basis: 'Deals with known competitive landscape close at 68% vs 59% when blind.',
    })
  } else if (['Propose', 'Negotiate'].includes(deal.stage)) {
    actions.push({
      category: 'competitive', severity: 'monitor',
      title: 'No competitive intel at advanced stage',
      action: 'Ask directly: "Are you evaluating other providers?" Knowing the landscape lets you position proactively.',
      impact: '+3%', impactNum: 3,
      basis: 'Deals where competitive landscape is known close at 68% vs 59% when blind.',
    })
  }

  return actions
}

function getAllActions(deal, events, signals) {
  return [
    ...getEngagementActions(deal, events),
    ...getStageActions(deal),
    ...getTimingActions(deal),
    ...getCompetitiveActions(deal, signals),
  ].sort((a, b) => {
    const sev = { critical: 0, warning: 1, monitor: 2, info: 3 }
    return (sev[a.severity] ?? 4) - (sev[b.severity] ?? 4)
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const SEV_STYLES = {
  critical: { bg: V2.redDim, border: `0.5px solid rgba(224,144,144,0.25)`, accent: V2.red, dot: V2.red },
  warning: { bg: V2.amberDim, border: `0.5px solid rgba(224,176,96,0.25)`, accent: V2.amber, dot: V2.amber },
  monitor: { bg: V2.surface, border: `0.5px solid ${V2.border}`, accent: V2.textDim, dot: V2.textDim },
  info: { bg: V2.surface, border: `0.5px solid ${V2.border}`, accent: V2.textDim, dot: V2.blue },
}

function ActionCard({ action }) {
  const sev = SEV_STYLES[action.severity] || SEV_STYLES.monitor

  if (action.type === 'checklist') {
    return (
      <div style={{ background: sev.bg, border: sev.border, borderRadius: V2.radius, padding: 16, borderLeft: `3px solid ${sev.dot}` }}>
        <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
          {action.title}
        </div>
        {action.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
            <div style={{
              width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${V2.border}`,
              flexShrink: 0, marginTop: 1,
            }} />
            <div>
              <div style={{ fontSize: 12, color: V2.text, fontWeight: 500 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: V2.textDim, fontWeight: 300 }}>{item.question}</div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ background: sev.bg, border: sev.border, borderRadius: V2.radius, padding: 16, borderLeft: `3px solid ${sev.dot}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sev.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: V2.text }}>{action.title}</span>
        </div>
        {action.impactNum > 0 && (
          <span style={{ fontFamily: V2_FONTS.serif, fontSize: 18, color: V2.teal }}>+{action.impactNum}%</span>
        )}
        {action.impactNum < 0 && (
          <span style={{ fontFamily: V2_FONTS.serif, fontSize: 18, color: V2.red }}>{action.impactNum}%</span>
        )}
        {action.impactNum === 0 && action.impact && (
          <span style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: sev.accent }}>{action.impact}</span>
        )}
      </div>
      <div style={{ fontSize: 12, color: V2.textMid, lineHeight: 1.6, marginBottom: 10, fontWeight: 400 }}>
        {action.action}
      </div>
      {action.basis && (
        <div style={{ fontSize: 11, color: V2.textDim, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: V2.radiusSm, lineHeight: 1.5, fontWeight: 300 }}>
          <span style={{ color: V2.teal, fontWeight: 500 }}>Historical: </span>{action.basis}
        </div>
      )}
    </div>
  )
}

function ActionsSection({ actions }) {
  const actionable = actions.filter(a => a.type !== 'checklist' && a.impactNum > 0)
  const totalImpact = actionable.reduce((s, a) => s + a.impactNum, 0)

  return (
    <div className="v2-fade-up" style={{ animationDelay: '160ms', background: V2.card, border: `0.5px solid ${V2.border}`, borderRadius: V2.radius, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Actions to Increase Win Rate
        </div>
        {totalImpact > 0 && (
          <span style={{
            fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.teal,
            background: V2.tealDim, padding: '3px 10px', borderRadius: V2.radiusFull,
            border: '1px solid rgba(93,202,165,0.2)',
          }}>
            {actionable.length} actions &middot; +{totalImpact}% potential
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {actions.map((a, i) => <ActionCard key={i} action={a} />)}
        {actions.length === 0 && (
          <div style={{ fontSize: 12, color: V2.textDim, textAlign: 'center', padding: 16 }}>
            No actions identified — this deal is tracking well.
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXISTING COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StageTrack({ currentStage }) {
  const stageIdx = STAGES.indexOf(currentStage)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
      {STAGES.map((stage, i) => {
        const done = i < stageIdx
        const current = i === stageIdx
        const color = done ? V2.teal : current ? V2.amber : V2.border
        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
              background: done || current ? color : 'transparent',
              border: `2px solid ${color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {done && (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#111318" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </div>
            {i < STAGES.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? V2.teal : V2.border }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function WinProbRing({ prob }) {
  const size = 100, stroke = 8, r = (size - stroke) / 2
  const circ = 2 * Math.PI * r, offset = circ * (1 - prob)
  const color = prob >= 0.7 ? V2.teal : prob >= 0.4 ? V2.amber : V2.red
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={V2.border} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: V2_FONTS.serif, fontSize: 24, color }}>
        {fmtPct(prob)}
      </div>
    </div>
  )
}

function FactorRow({ label, value, impact }) {
  const color = impact === 'positive' ? V2.teal : impact === 'negative' ? V2.red : V2.textMid
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${V2.border}` }}>
      <span style={{ fontSize: 12, color: V2.textMid }}>{label}</span>
      <span style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color }}>{value}</span>
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function V2DealDetail({ deal, accounts = [], onBack }) {
  if (!deal) return null
  const hasRealPipeline = accounts.some(a => (a.pipeline || []).length > 0)
  const isDemo = !hasRealPipeline
  const accts = isDemo ? DEMO_ACCOUNTS : accounts

  const account = useMemo(() => accts.find(a => a.name === deal.accountName) || {}, [accts, deal.accountName])

  const signals = account.signals || []
  const locations = account.locations || []
  const events = account.engagement?.events || []

  const stageWeight = STAGE_WEIGHTS[deal.stage] || 0.10
  const factors = [
    { label: 'Stage base rate', value: fmtPct(stageWeight), impact: stageWeight >= 0.5 ? 'positive' : 'neutral' },
    { label: 'Gap penalty', value: deal.gap > 20 ? `-${Math.round(deal.gap * 0.5)}%` : 'None', impact: deal.gap > 20 ? 'negative' : 'neutral' },
    { label: 'Product boost', value: ['Dark Fiber', 'Wavelengths'].includes(deal.product_group) ? '+8%' : '+3%', impact: 'positive' },
    { label: 'Size adjustment', value: deal.mrr > 15000 ? '-5%' : deal.mrr < 5000 ? '+5%' : '0%', impact: deal.mrr > 15000 ? 'negative' : deal.mrr < 5000 ? 'positive' : 'neutral' },
  ]

  // Compute prescriptive actions
  const actions = useMemo(() => getAllActions(deal, events, signals), [deal, events, signals])

  return (
    <div>
      {/* Back nav */}
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, background: 'none', border: 'none', cursor: 'pointer', fontFamily: V2_FONTS.sans, fontSize: 13, color: V2.accent }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        Pipeline
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* ── Main Column ── */}
        <div>
          {/* Deal Header */}
          <div className="v2-fade-up" style={{ marginBottom: 24 }}>
            <h1 style={{ fontFamily: V2_FONTS.serif, fontSize: 28, fontWeight: 400, marginBottom: 4 }}>{deal.accountName}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: V2.textDim }}>{deal.product_group}</span>
              <span style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: V2.purple }}>{fmt(deal.mrr)}/mo</span>
              {deal.term && <span style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: V2.textDim }}>{deal.term}</span>}
            </div>
          </div>

          {/* Stage Track */}
          <div className="v2-fade-up" style={{ animationDelay: '60ms' }}>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>Stage Progression</div>
            <StageTrack currentStage={deal.stage} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: -16, marginBottom: 24 }}>
              {STAGES.map(s => (
                <span key={s} style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, textAlign: 'center', flex: 1 }}>{s}</span>
              ))}
            </div>
          </div>

          {/* Win Probability Card */}
          <div className="v2-fade-up" style={{ animationDelay: '120ms', background: V2.card, border: `0.5px solid ${V2.border}`, borderRadius: V2.radius, padding: 20, marginBottom: 16 }}>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', marginBottom: 16, textTransform: 'uppercase' }}>Win Probability</div>
            <div style={{ display: 'flex', gap: 24 }}>
              <WinProbRing prob={deal.winProb || 0} />
              <div style={{ flex: 1 }}>
                {factors.map((f, i) => <FactorRow key={i} {...f} />)}
              </div>
            </div>
          </div>

          {/* ── PRESCRIPTIVE ACTIONS ── */}
          <ActionsSection actions={actions} />

          {/* Activity Timeline */}
          <div className="v2-fade-up" style={{ animationDelay: '220ms', background: V2.card, border: `0.5px solid ${V2.border}`, borderRadius: V2.radius, padding: 20 }}>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', marginBottom: 16, textTransform: 'uppercase' }}>Activity Timeline</div>
            {signals.map((s, i) => (
              <div key={`s${i}`} style={{ display: 'flex', gap: 12, marginBottom: 14, position: 'relative', paddingLeft: 20 }}>
                <div style={{ position: 'absolute', left: 4, top: 4, width: 8, height: 8, borderRadius: '50%', background: (ENGINE_COLORS[s.engine] || ENGINE_COLORS.event).text }} />
                {i < signals.length + events.length - 1 && (
                  <div style={{ position: 'absolute', left: 7, top: 14, width: 1, height: 'calc(100% + 2px)', background: V2.border }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                    <EnginePill engine={s.engine || s.type} />
                    <span style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim }}>{s.ts}</span>
                  </div>
                  <div style={{ fontSize: 12, color: V2.textMid, lineHeight: 1.4 }}>{s.text}</div>
                </div>
              </div>
            ))}
            {events.slice(0, 5).map((ev, i) => {
              const evColor = ev.t === 'call' ? V2.teal : ev.t === 'meeting' ? V2.purple : V2.blue
              return (
                <div key={`e${i}`} style={{ display: 'flex', gap: 12, marginBottom: 14, position: 'relative', paddingLeft: 20 }}>
                  <div style={{ position: 'absolute', left: 4, top: 4, width: 8, height: 8, borderRadius: '50%', background: evColor }} />
                  {i < events.slice(0, 5).length - 1 && (
                    <div style={{ position: 'absolute', left: 7, top: 14, width: 1, height: 'calc(100% + 2px)', background: V2.border }} />
                  )}
                  <div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: evColor, textTransform: 'capitalize' }}>{ev.t}</span>
                      <span style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim }}>{ev.d}</span>
                      {ev.c && <span style={{ fontSize: 11, color: V2.textDim }}>&middot; {ev.c}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: V2.textMid }}>{ev.s}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div>
          {/* Deal Details */}
          <div className="v2-fade-up" style={{ background: V2.card, border: `0.5px solid ${V2.border}`, borderRadius: V2.radius, padding: 16, marginBottom: 12 }}>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', marginBottom: 12, textTransform: 'uppercase' }}>Deal Details</div>
            {[
              { label: 'MRR', value: fmt(deal.mrr), color: V2.text },
              { label: 'Term', value: deal.term || '--' },
              { label: 'Product', value: deal.product_group || '--' },
              { label: 'Close Date', value: deal.close_date || '--' },
              { label: 'Days in Stage', value: deal.daysInStage != null ? `${deal.daysInStage}d` : '--' },
              { label: 'Rep', value: deal.rep || '--' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${V2.border}` }}>
                <span style={{ fontSize: 12, color: V2.textDim }}>{row.label}</span>
                <span style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: row.color || V2.textMid }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Locations */}
          <div className="v2-fade-up" style={{ animationDelay: '60ms', background: V2.card, border: `0.5px solid ${V2.border}`, borderRadius: V2.radius, padding: 16 }}>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', marginBottom: 12, textTransform: 'uppercase' }}>Locations</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {locations.map((loc, i) => (
                <span key={i} style={{
                  fontFamily: V2_FONTS.mono, fontSize: 10,
                  color: loc.onNet ? V2.teal : V2.textDim,
                  background: loc.onNet ? V2.tealDim : V2.surfaceHover,
                  border: `1px solid ${loc.isNew ? V2.accent : loc.onNet ? 'rgba(93,202,165,0.25)' : V2.border}`,
                  padding: '3px 10px', borderRadius: V2.radiusFull,
                }}>
                  {loc.city}, {loc.state}
                  {loc.isNew && <span style={{ color: V2.accent, marginLeft: 4 }}>NEW</span>}
                </span>
              ))}
              {locations.length === 0 && (
                <span style={{ fontSize: 12, color: V2.textDim }}>No location data available</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
