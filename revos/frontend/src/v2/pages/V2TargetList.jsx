import { useState, useMemo } from 'react'
import { V2, V2_FONTS, ENGINE_COLORS, fmt, fmtPct } from '../tokens'
import { DEMO_ACCOUNTS, DEMO_PLAYBOOKS } from '../demoData'
import useDeals from '../hooks/useDeals'
import usePredictions from '../hooks/usePredictions'
import useLocations from '../hooks/useLocations'
import useEngineInsights from '../hooks/useEngineInsights'

// ─── Animations ───────────────────────────────────────────────────────────────
const styleId = 'v2-tgt-anims'
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    @keyframes v2FadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .v2-fade-up { animation: v2FadeUp 0.4s ease-out both; }
    .v2-card-hover:hover { border-color: ${V2.accent} !important; }
  `
  document.head.appendChild(style)
}

// Signal filter definitions
const SIGNAL_DEFS = [
  { id: 'on-net', label: 'On-Net', check: a => (a.locations || []).some(l => l.onNet) },
  { id: 'new-sites', label: 'New Sites', check: a => (a.locations || []).some(l => l.isNew) },
  { id: 'whitespace', label: 'Whitespace >$50K', check: a => (a.pipelineMRR || 0) > 50000 || ((a.totalTMR || 0) - (a.servicesMRR || 0) * 12) > 50000 },
  { id: 'churn-risk', label: 'Churn Risk', check: a => (a.churnProbability || 0) > 0.15 },
  { id: 'open-pipeline', label: 'Open Pipeline', check: a => (a.pipeline || []).length > 0 },
  { id: 'no-deal', label: 'No Active Deal', check: a => (a.pipeline || []).length === 0 },
  { id: 'sec-filing', label: 'SEC Filing', check: a => (a.signals || []).some(s => (s.text || '').toLowerCase().includes('sec')) },
  { id: 'win-back', label: 'Win-Back', check: a => (a.churnProbability || 0) > 0.2 && (a.pipeline || []).length > 0 },
]

const SORT_OPTIONS = [
  { id: 'score', label: 'Target Score' },
  { id: 'whitespace', label: 'Whitespace' },
  { id: 'onnet', label: 'On-Net %' },
  { id: 'churn', label: 'Churn Risk' },
  { id: 'recency', label: 'Recency' },
]

function targetScore(acct) {
  const ps = acct.premierScore || 0
  const churn = acct.churnProbability || 0
  const hasPipeline = (acct.pipeline || []).length > 0 ? 20 : 0
  const hasNew = (acct.locations || []).some(l => l.isNew) ? 15 : 0
  return Math.round(ps * 0.4 + (1 - churn) * 80 + hasPipeline + hasNew)
}

function whitespaceValue(acct) {
  return Math.max(0, (acct.totalTMR || 0) - (acct.servicesMRR || 0) * 12)
}

function onNetPct(acct) {
  const locs = acct.locations || []
  if (!locs.length) return 0
  return locs.filter(l => l.onNet).length / locs.length
}

function SignalChip({ label, active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: V2_FONTS.sans, fontSize: 11, fontWeight: active ? 600 : 400,
        color: active ? V2.teal : V2.textDim,
        background: active ? V2.tealDim : 'transparent',
        border: `1px solid ${active ? V2.teal : V2.border}`,
        padding: '5px 12px', borderRadius: V2.radiusFull, cursor: 'pointer',
        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      {label}
      {count > 0 && (
        <span style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: active ? V2.teal : V2.textDim, opacity: 0.7 }}>{count}</span>
      )}
    </button>
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

function PlaybookCard({ play }) {
  const isRec = play.recommended
  return (
    <div style={{
      background: V2.card, borderRadius: V2.radiusSm,
      border: `0.5px solid ${isRec ? V2.teal : V2.border}`,
      padding: 14, flex: 1, minWidth: 0,
    }}>
      {isRec && (
        <div style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.teal, letterSpacing: '0.06em', marginBottom: 6 }}>RECOMMENDED</div>
      )}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{play.title}</div>
      <div style={{ fontSize: 11, color: V2.textDim, lineHeight: 1.4, marginBottom: 8 }}>{play.desc}</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        {play.products.map(p => (
          <span key={p} style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.purple, background: V2.purpleDim, padding: '2px 8px', borderRadius: V2.radiusFull }}>{p}</span>
        ))}
      </div>
      <div style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.teal }}>+{fmt(play.mrrImpact)}/mo</div>
    </div>
  )
}

function TargetCard({ acct, rank, expanded, onToggle }) {
  const score = targetScore(acct)
  const ws = whitespaceValue(acct)
  const onNet = onNetPct(acct)
  const signals = acct.signals || []
  const locs = acct.locations || []
  const pipeline = acct.pipeline || []
  const plays = DEMO_PLAYBOOKS[acct.name] || []

  return (
    <div
      className="v2-card-hover"
      style={{
        background: V2.card,
        border: `0.5px solid ${V2.border}`,
        borderRadius: V2.radius,
        padding: 20,
        transition: 'border-color 0.15s',
      }}
    >
      {/* Header with score + name */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
        <div style={{
          fontFamily: V2_FONTS.serif, fontSize: 28, color: V2.accent,
          width: 48, textAlign: 'center', lineHeight: 1, flexShrink: 0,
        }}>
          {rank}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>{acct.name}</div>
          <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim }}>
            Score: {score} · {acct.manager || 'Unassigned'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[...new Set(signals.map(s => s.engine || s.type))].map(e => (
            <div key={e} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: (ENGINE_COLORS[e] || ENGINE_COLORS.event).text,
            }} />
          ))}
        </div>
      </div>

      {/* Three-column metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 14 }}>
        {/* Why (signals) */}
        <div>
          <div style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, letterSpacing: '0.04em', marginBottom: 8, textTransform: 'uppercase' }}>Why</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {signals.slice(0, 2).map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: (ENGINE_COLORS[s.engine] || ENGINE_COLORS.event).text, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: V2.textMid, lineHeight: 1.3 }}>{s.text.slice(0, 60)}...</span>
              </div>
            ))}
          </div>
        </div>
        {/* Current State */}
        <div>
          <div style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, letterSpacing: '0.04em', marginBottom: 8, textTransform: 'uppercase' }}>Current State</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <MetricRow label="TMR" value={fmt(acct.totalTMR)} />
            <MetricRow label="Active MRR" value={fmt(acct.servicesMRR)} />
            <MetricRow label="Churn" value={fmtPct(acct.churnProbability)} color={acct.churnProbability > 0.15 ? V2.red : V2.teal} />
          </div>
        </div>
        {/* Opportunity */}
        <div>
          <div style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, letterSpacing: '0.04em', marginBottom: 8, textTransform: 'uppercase' }}>Opportunity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <MetricRow label="Whitespace" value={fmt(ws)} color={V2.teal} />
            <MetricRow label="Pipeline" value={`${pipeline.length} deals`} />
            {/* On-net locations */}
            {locs.filter(l => l.onNet).length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: V2.teal, marginBottom: 3 }}>On-Net</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {locs.filter(l => l.onNet).map((loc, i) => (
                    <span key={i} style={{
                      fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.teal,
                      background: V2.tealDim, padding: '2px 7px', borderRadius: V2.radiusFull,
                      border: '1px solid rgba(93,202,165,0.2)',
                    }}>
                      {loc.city}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Off-net / no service locations */}
            {locs.filter(l => !l.onNet).length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: V2.textDim, marginBottom: 3 }}>No Service</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {locs.filter(l => !l.onNet).map((loc, i) => (
                    <span key={i} style={{
                      fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim,
                      background: V2.surfaceHover, padding: '2px 7px', borderRadius: V2.radiusFull,
                      border: `1px solid ${loc.isNew ? V2.accent : V2.border}`,
                    }}>
                      {loc.city}{loc.isNew ? ' ✦' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toggle for full context */}
      <button
        onClick={onToggle}
        style={{
          fontFamily: V2_FONTS.sans, fontSize: 11, color: V2.accent,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        {expanded ? 'Hide detail ▴' : 'Full context ▾'}
      </button>

      {/* Expanded section */}
      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${V2.border}` }}>
          {/* Score breakdown */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, letterSpacing: '0.04em', marginBottom: 8, textTransform: 'uppercase' }}>Score Breakdown</div>
            <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${acct.premierScore ? (acct.premierScore / 300) * 40 : 10}%`, background: V2.purple }} title="Premier Score" />
              <div style={{ width: `${(1 - (acct.churnProbability || 0)) * 30}%`, background: V2.teal }} title="Retention" />
              <div style={{ width: `${pipeline.length ? 15 : 0}%`, background: V2.accent }} title="Pipeline" />
              <div style={{ width: `${locs.some(l => l.isNew) ? 10 : 0}%`, background: V2.amber }} title="New Sites" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'Premier', value: acct.premierScore || '--', color: V2.purple },
                { label: 'Retention', value: fmtPct(1 - (acct.churnProbability || 0)), color: V2.teal },
                { label: 'Pipeline Bonus', value: pipeline.length ? '+20' : '0', color: V2.accent },
                { label: 'New Site Bonus', value: locs.some(l => l.isNew) ? '+15' : '0', color: V2.amber },
              ].map((f, i) => (
                <div key={i}>
                  <div style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontFamily: V2_FONTS.mono, fontSize: 13, color: f.color }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sites */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, letterSpacing: '0.04em', marginBottom: 8, textTransform: 'uppercase' }}>Sites</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {locs.map((loc, i) => (
                <span key={i} style={{
                  fontFamily: V2_FONTS.mono, fontSize: 10,
                  color: loc.onNet ? V2.teal : V2.textDim,
                  background: loc.onNet ? V2.tealDim : V2.surfaceHover,
                  border: `1px solid ${loc.isNew ? V2.accent : loc.onNet ? 'rgba(93,202,165,0.25)' : V2.border}`,
                  padding: '3px 10px', borderRadius: V2.radiusFull,
                }}>
                  {loc.city}, {loc.state} {loc.onNet ? '●' : '○'}
                  {loc.isNew && <span style={{ color: V2.accent, marginLeft: 4 }}>NEW</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Market Intelligence */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, letterSpacing: '0.04em', marginBottom: 8, textTransform: 'uppercase' }}>Market Intelligence</div>
            {signals.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 8 }}>
                <EnginePill engine={s.engine || s.type || 'event'} />
                <div>
                  <div style={{ fontSize: 12, color: V2.textMid, lineHeight: 1.4 }}>{s.text}</div>
                  <div style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, marginTop: 2 }}>{s.ts}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Playbooks */}
          {plays.length > 0 && (
            <div>
              <div style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, letterSpacing: '0.04em', marginBottom: 8, textTransform: 'uppercase' }}>Playbooks</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {plays.map(p => <PlaybookCard key={p.id} play={p} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetricRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 11, color: V2.textDim }}>{label}</span>
      <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: color || V2.textMid }}>{value}</span>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function V2TargetList({ accounts = [], rawData = {} }) {
  const { deals: realDeals } = useDeals(accounts)
  const isDemo = !realDeals.length
  const accts = isDemo ? DEMO_ACCOUNTS : accounts
  const [activeFilters, setActiveFilters] = useState([])
  const [sortBy, setSortBy] = useState('score')
  const [expandedIdx, setExpandedIdx] = useState(null)

  // Filter counts
  const filterCounts = useMemo(() => {
    const m = {}
    for (const sd of SIGNAL_DEFS) {
      m[sd.id] = accts.filter(sd.check).length
    }
    return m
  }, [accts])

  // Apply filters
  const filtered = useMemo(() => {
    if (!activeFilters.length) return accts
    return accts.filter(a => activeFilters.every(fId => {
      const def = SIGNAL_DEFS.find(d => d.id === fId)
      return def ? def.check(a) : true
    }))
  }, [accts, activeFilters])

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered]
    switch (sortBy) {
      case 'whitespace': return arr.sort((a, b) => whitespaceValue(b) - whitespaceValue(a))
      case 'onnet': return arr.sort((a, b) => onNetPct(b) - onNetPct(a))
      case 'churn': return arr.sort((a, b) => (b.churnProbability || 0) - (a.churnProbability || 0))
      case 'recency': return arr.sort((a, b) => (a.daysSilent || 999) - (b.daysSilent || 999))
      default: return arr.sort((a, b) => targetScore(b) - targetScore(a))
    }
  }, [filtered, sortBy])

  // Summary metrics
  const totalPipeline = sorted.reduce((s, a) => s + (a.pipelineMRR || 0), 0)
  const avgScore = sorted.length ? Math.round(sorted.reduce((s, a) => s + targetScore(a), 0) / sorted.length) : 0

  const toggleFilter = (id) => {
    setActiveFilters(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: V2_FONTS.serif, fontSize: 28, fontWeight: 400, marginBottom: 4 }}>Targets</h1>
        <p style={{ fontSize: 13, color: V2.textDim }}>Priority-ranked account target list with engine-powered scoring.</p>
      </div>

      {/* Signal filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {SIGNAL_DEFS.map(sd => (
          <SignalChip
            key={sd.id}
            label={sd.label}
            active={activeFilters.includes(sd.id)}
            count={filterCounts[sd.id]}
            onClick={() => toggleFilter(sd.id)}
          />
        ))}
      </div>

      {/* Sort + Summary strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'Accounts', value: String(sorted.length) },
            { label: 'Avg Score', value: String(avgScore) },
            { label: 'Pipeline', value: fmt(totalPipeline) },
            { label: 'Avg Churn', value: fmtPct(sorted.length ? sorted.reduce((s, a) => s + (a.churnProbability || 0), 0) / sorted.length : 0) },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, letterSpacing: '0.04em' }}>{m.label}</span>
              <span style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: V2.textMid }}>{m.value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim }}>SORT</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              fontFamily: V2_FONTS.sans, fontSize: 12, color: V2.textMid,
              background: V2.surface, border: `1px solid ${V2.border}`,
              borderRadius: V2.radiusSm, padding: '4px 8px', outline: 'none',
            }}
          >
            {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Target cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sorted.map((acct, i) => (
          <div key={acct.name} className="v2-fade-up" style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}>
            <TargetCard
              acct={acct}
              rank={i + 1}
              expanded={expandedIdx === i}
              onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
