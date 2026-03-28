import { useMemo } from 'react'
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
  const size = 100
  const stroke = 8
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - prob)
  const color = prob >= 0.7 ? V2.teal : prob >= 0.4 ? V2.amber : V2.red

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={V2.border} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: V2_FONTS.serif, fontSize: 24, color,
      }}>
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

export default function V2DealDetail({ deal, accounts = [], onBack }) {
  if (!deal) return null
  const isDemo = !accounts.length
  const accts = isDemo ? DEMO_ACCOUNTS : accounts

  // Find parent account
  const account = useMemo(() =>
    accts.find(a => a.name === deal.accountName) || {},
    [accts, deal.accountName]
  )

  const signals = account.signals || []
  const locations = account.locations || []
  const events = account.engagement?.events || []

  // Win probability factors
  const stageWeight = STAGE_WEIGHTS[deal.stage] || 0.10
  const factors = [
    { label: 'Stage base rate', value: fmtPct(stageWeight), impact: stageWeight >= 0.5 ? 'positive' : 'neutral' },
    { label: 'Gap penalty', value: deal.gap > 20 ? `-${Math.round(deal.gap * 0.5)}%` : 'None', impact: deal.gap > 20 ? 'negative' : 'neutral' },
    { label: 'Product boost', value: ['Dark Fiber', 'Wavelengths'].includes(deal.product_group) ? '+8%' : '+3%', impact: 'positive' },
    { label: 'Size adjustment', value: deal.mrr > 15000 ? '-5%' : deal.mrr < 5000 ? '+5%' : '0%', impact: deal.mrr > 15000 ? 'negative' : deal.mrr < 5000 ? 'positive' : 'neutral' },
  ]

  return (
    <div>
      {/* Back nav */}
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20,
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: V2_FONTS.sans, fontSize: 13, color: V2.accent,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        Pipeline
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* ── Main Column ── */}
        <div>
          {/* Deal Header */}
          <div className="v2-fade-up" style={{ marginBottom: 24 }}>
            <h1 style={{ fontFamily: V2_FONTS.serif, fontSize: 28, fontWeight: 400, marginBottom: 4 }}>
              {deal.accountName}
            </h1>
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

          {/* Activity Timeline */}
          <div className="v2-fade-up" style={{ animationDelay: '180ms', background: V2.card, border: `0.5px solid ${V2.border}`, borderRadius: V2.radius, padding: 20 }}>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', marginBottom: 16, textTransform: 'uppercase' }}>Activity Timeline</div>
            {/* Engine signals */}
            {signals.map((s, i) => (
              <div key={`s${i}`} style={{ display: 'flex', gap: 12, marginBottom: 14, position: 'relative', paddingLeft: 20 }}>
                <div style={{
                  position: 'absolute', left: 4, top: 4, width: 8, height: 8, borderRadius: '50%',
                  background: (ENGINE_COLORS[s.engine] || ENGINE_COLORS.event).text,
                }} />
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
            {/* Engagement events */}
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
                      {ev.c && <span style={{ fontSize: 11, color: V2.textDim }}>· {ev.c}</span>}
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
              { label: 'Weighted MRR', value: fmt((deal.mrr || 0) * (STAGE_WEIGHTS[deal.stage] || 0.1)), color: V2.purple },
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
                <span
                  key={i}
                  style={{
                    fontFamily: V2_FONTS.mono, fontSize: 10,
                    color: loc.onNet ? V2.teal : V2.textDim,
                    background: loc.onNet ? V2.tealDim : V2.surfaceHover,
                    border: `1px solid ${loc.isNew ? V2.accent : loc.onNet ? 'rgba(93,202,165,0.25)' : V2.border}`,
                    padding: '3px 10px', borderRadius: V2.radiusFull,
                  }}
                >
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
