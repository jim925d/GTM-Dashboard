import { useState, useMemo } from 'react'
import { V2, V2_FONTS, ENGINE_COLORS, STAGES, STAGE_WEIGHTS, fmt, fmtPct } from '../tokens'
import { DEMO_ACCOUNTS, DEMO_DEALS } from '../demoData'
import useDeals from '../hooks/useDeals'

// ─── Animations ───────────────────────────────────────────────────────────────
const styleId = 'v2-pipe-anims'
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    @keyframes v2FadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .v2-fade-up { animation: v2FadeUp 0.4s ease-out both; }
    .v2-row-hover:hover { background: ${V2.surfaceHover} !important; }
  `
  document.head.appendChild(style)
}

const FILTERS = [
  { id: 'all', label: 'All Stages' },
  { id: 'at-risk', label: 'At Risk' },
  { id: 'closing-soon', label: 'Closing Soon' },
  { id: 'new', label: 'New This Month' },
]

function EngineDot({ engines }) {
  if (!engines || !engines.length) return null
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {engines.map((e, i) => {
        const c = ENGINE_COLORS[e] || ENGINE_COLORS.event
        return <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c.text, border: `1px solid ${c.border}` }} title={e} />
      })}
    </div>
  )
}

export default function V2Pipeline({ accounts = [], rawData = {}, onSelectDeal }) {
  const { deals: realDeals } = useDeals(accounts)
  const isDemo = !realDeals.length
  const accts = isDemo ? DEMO_ACCOUNTS : accounts
  const allDeals = isDemo ? DEMO_DEALS : realDeals
  const [filter, setFilter] = useState('all')

  // Build byStage from allDeals
  const byStage = useMemo(() => {
    const m = {}
    for (const d of allDeals) {
      const s = d.stage || 'Unknown'
      if (!m[s]) m[s] = []
      m[s].push(d)
    }
    return m
  }, [allDeals])

  // Filter deals
  const filteredDeals = useMemo(() => {
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    switch (filter) {
      case 'at-risk':
        return allDeals.filter(d => (d.winProb || 0) < 0.4 || (d.gap || 0) > 30)
      case 'closing-soon': {
        const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() + 30)
        return allDeals.filter(d => d.close_date && new Date(d.close_date) <= cutoff)
      }
      case 'new':
        return allDeals.filter(d => d.created_date && d.created_date.startsWith(ym))
      default:
        return allDeals
    }
  }, [allDeals, filter])

  // Assign engine tags to deals based on account signals
  const dealEngines = useMemo(() => {
    const m = {}
    for (const acct of accts) {
      const engines = [...new Set((acct.signals || []).map(s => s.engine || s.type || 'event'))]
      for (const deal of (acct.pipeline || [])) {
        m[deal.id] = engines
      }
    }
    // For demo deals, map by accountName
    if (isDemo) {
      for (const d of DEMO_DEALS) {
        const acct = accts.find(a => a.name === d.accountName)
        if (acct) m[d.id] = [...new Set((acct.signals || []).map(s => s.engine || s.type || 'event'))]
      }
    }
    return m
  }, [accts, isDemo])

  return (
    <div>
      {/* Header + Filters */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: V2_FONTS.serif, fontSize: 28, fontWeight: 400, marginBottom: 4 }}>Pipeline</h1>
          <p style={{ fontSize: 13, color: V2.textDim }}>
            {filteredDeals.length} deals · {fmt(filteredDeals.reduce((s, d) => s + (d.mrr || 0), 0))} total MRR
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                fontFamily: V2_FONTS.sans, fontSize: 12, fontWeight: filter === f.id ? 600 : 400,
                color: filter === f.id ? V2.text : V2.textDim,
                background: filter === f.id ? V2.accentDim : 'transparent',
                border: `1px solid ${filter === f.id ? V2.accentBorder : V2.border}`,
                padding: '6px 14px', borderRadius: V2.radiusFull, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Funnel Strip */}
      <div className="v2-fade-up" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {STAGES.filter(s => s !== 'Closed Won').map((stage, i) => {
          const stageDeals = byStage[stage] || []
          const stageMRR = stageDeals.reduce((s, d) => s + (d.mrr || 0), 0)
          const avgProb = stageDeals.length ? stageDeals.reduce((s, d) => s + (d.winProb || STAGE_WEIGHTS[stage] || 0), 0) / stageDeals.length : 0
          return (
            <div
              key={stage}
              className="v2-fade-up"
              style={{
                animationDelay: `${i * 60}ms`,
                flex: 1,
                background: V2.card,
                border: `0.5px solid ${V2.border}`,
                borderRadius: V2.radius,
                padding: '16px 14px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', marginBottom: 8 }}>
                {stage.toUpperCase()}
              </div>
              <div style={{ fontFamily: V2_FONTS.serif, fontSize: 24, color: V2.text, marginBottom: 2 }}>
                {stageDeals.length}
              </div>
              <div style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.purple, marginBottom: 4 }}>
                {fmt(stageMRR)}
              </div>
              <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim }}>
                {fmtPct(avgProb)} avg
              </div>
            </div>
          )
        })}
      </div>

      {/* Deal Grid */}
      <div
        className="v2-fade-up"
        style={{
          animationDelay: '300ms',
          background: V2.card,
          border: `0.5px solid ${V2.border}`,
          borderRadius: V2.radius,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 0.8fr 0.6fr 40px',
          padding: '10px 20px', borderBottom: `1px solid ${V2.border}`, background: V2.bgSubtle,
        }}>
          {['Account / Product', 'Stage', 'MRR', 'Win Prob', 'Gap', 'Engines', ''].map(h => (
            <div key={h} style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.04em' }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {filteredDeals.map(deal => {
          const probColor = (deal.winProb || 0) >= 0.7 ? V2.teal : (deal.winProb || 0) >= 0.4 ? V2.amber : V2.red
          return (
            <div
              key={deal.id}
              className="v2-row-hover"
              onClick={() => onSelectDeal && onSelectDeal(deal)}
              style={{
                display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 0.8fr 0.6fr 40px',
                padding: '12px 20px', borderBottom: `1px solid ${V2.border}`,
                cursor: 'pointer', transition: 'background 0.12s',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{deal.accountName}</div>
                <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, marginTop: 2 }}>{deal.product_group}</div>
              </div>
              <div style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: V2.textMid, alignSelf: 'center' }}>{deal.stage}</div>
              <div style={{ fontFamily: V2_FONTS.serif, fontSize: 16, color: V2.purple, alignSelf: 'center' }}>{fmt(deal.mrr)}</div>
              <div style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 40, height: 4, background: V2.border, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(deal.winProb || 0) * 100}%`, height: '100%', background: probColor, borderRadius: 2 }} />
                </div>
                <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: probColor }}>{fmtPct(deal.winProb)}</span>
              </div>
              <div style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: (deal.gap || 0) > 30 ? V2.red : V2.textMid, alignSelf: 'center' }}>
                {deal.gap != null ? `${deal.gap}d` : '--'}
              </div>
              <div style={{ alignSelf: 'center' }}>
                <EngineDot engines={dealEngines[deal.id]} />
              </div>
              <div style={{ alignSelf: 'center', color: V2.textDim }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </div>
            </div>
          )
        })}

        {filteredDeals.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: V2.textDim, fontSize: 13 }}>
            No deals match the current filter.
          </div>
        )}
      </div>
    </div>
  )
}
