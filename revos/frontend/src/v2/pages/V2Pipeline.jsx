import { useState, useMemo } from 'react'
import { V2, V2_FONTS, STAGES, STAGE_WEIGHTS, pc, fmt, fmtPct } from '../tokens'
import useDeals from '../hooks/useDeals'
import ProbTooltip from '../components/ProbTooltip'
import WeightedTooltip from '../components/WeightedTooltip'

// ═══ Helpers ═══════════════════════════════════════════════════════════════════

function dealProb(d) {
  const p = d.prob || d.winProb || 0.5
  return Math.round(p <= 1 ? p * 100 : p)
}

function isAtRisk(d) {
  return (d.gap || 0) > 7 || dealProb(d) < 40
}

function isClosingSoon(d) {
  return d.stage === 'Negotiate' || d.stage === 'Verbal Agreement'
}

function getDealFactors(deal) {
  if (deal.factors?.length) return deal.factors
  const base = { 'Discover': 31, 'Design': 42, 'Design Solution': 53, 'Propose': 66, 'Negotiate': 75, 'Verbal Agreement': 92 }[deal.stage] || 50
  const result = [['Stage base', `${base}%`, V2.textMid, `${deal.stage} closes at ${base}%`]]
  const gap = deal.gap || 0
  if (gap > 7) result.push(['Gap', `\u2212${Math.round(gap * 0.5)}%`, V2.red, `${gap} days since last touch`])
  else result.push(['Gap', '0%', V2.textMuted, `Last touch ${gap}d ago`])
  const prod = deal.product_group || deal.product || ''
  if (['Dark Fiber', 'Wavelengths'].includes(prod)) result.push(['Product', '+3%', V2.sage, `${prod} above avg`])
  else result.push(['Product', '+2%', V2.sage, `${prod} slight boost`])
  if ((deal.mrr || 0) > 25000) result.push(['Size', '\u22122%', V2.amber, 'Above median'])
  return result
}

function getPeriodLabel(view) {
  const now = new Date()
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  if (view === 'monthly') return `${m[now.getMonth()]} ${now.getFullYear()}`
  if (view === 'quarterly') return `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`
  return String(now.getFullYear())
}

// ═══ Main ═════════════════════════════════════════════════════════════════════

export default function V2Pipeline({ accounts = [], rawData = {}, onSelectDeal }) {
  const { deals: realDeals } = useDeals(accounts)
  const allDeals = realDeals

  const [view, setView] = useState('quarterly')
  const [filter, setFilter] = useState('all')
  const [stageFilter, setStageFilter] = useState(null)

  // Time-filtered deals
  const timeFiltered = useMemo(() => {
    if (view === 'quarterly' || view === 'annual') return allDeals
    // Monthly: filter to current month close dates
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return allDeals.filter(d => {
      if (!d.close_date) return true // include deals without close date
      return d.close_date.startsWith(ym)
    })
  }, [allDeals, view])

  // Apply pill filter + stage filter
  const filteredDeals = useMemo(() => {
    let deals = timeFiltered
    if (filter === 'at-risk') deals = deals.filter(isAtRisk)
    else if (filter === 'closing') deals = deals.filter(isClosingSoon)
    if (stageFilter) deals = deals.filter(d => d.stage === stageFilter)
    return deals
  }, [timeFiltered, filter, stageFilter])

  // Stage aggregations from time-filtered (not pill-filtered) deals
  const stageAgg = useMemo(() => {
    const m = {}
    for (const s of STAGES) m[s] = { count: 0, mrr: 0 }
    for (const d of timeFiltered) {
      const s = d.stage || 'Unknown'
      if (m[s]) { m[s].count++; m[s].mrr += d.mrr || 0 }
    }
    return m
  }, [timeFiltered])

  // Header metrics
  const totalMRR = timeFiltered.reduce((s, d) => s + (d.mrr || 0), 0)
  const weightedMRR = timeFiltered.reduce((s, d) => {
    const p = (d.winProb || d.prob || STAGE_WEIGHTS[d.stage] || 0.1)
    return s + (d.mrr || 0) * (p <= 1 ? p : p / 100)
  }, 0)
  const atRiskCount = timeFiltered.filter(isAtRisk).length
  const closingSoonCount = timeFiltered.filter(isClosingSoon).length

  // For WeightedTooltip breakdown
  const weightedDeals = timeFiltered.map(d => ({
    accountName: d.accountName || d.account,
    mrr: d.mrr || 0,
    winProb: (d.winProb || d.prob || STAGE_WEIGHTS[d.stage] || 0.1),
  }))

  const handleStageClick = (stage) => {
    if (stageFilter === stage) { setStageFilter(null); setFilter('all') }
    else { setStageFilter(stage); setFilter('all') }
  }

  const handleFilterClick = (f) => {
    setStageFilter(null)
    setFilter(filter === f ? 'all' : f)
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: V2_FONTS.serif, fontSize: 24, color: V2.text }}>Pipeline</span>
            <span style={{ fontSize: 12, color: V2.textDim, fontFamily: V2_FONTS.sans }}>{getPeriodLabel(view)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6 }}>
            <span style={{ fontSize: 12, color: V2.textDim, fontFamily: V2_FONTS.sans }}>{timeFiltered.length} deals</span>
            <span style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: V2.text }}>{fmt(totalMRR)}</span>
            <WeightedTooltip value={Math.round(weightedMRR)} deals={weightedDeals} label="Weighted " />
            {atRiskCount > 0 && (
              <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.red, padding: '2px 8px', background: V2.dangerBg, borderRadius: 4, border: `1px solid ${V2.dangerBd}` }}>
                {atRiskCount} at risk
              </span>
            )}
          </div>
        </div>

        {/* Time toggle */}
        <div style={{ display: 'flex', gap: 1, background: V2.elevated, borderRadius: 8, padding: 2, border: `1px solid ${V2.ghost}` }}>
          {[['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['annual', 'Annual']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 11,
                fontWeight: view === id ? 500 : 400,
                color: view === id ? V2.accent : V2.textDim,
                background: view === id ? V2.accentBg : 'transparent',
                border: view === id ? `1px solid ${V2.accentBorder}` : '1px solid transparent',
                cursor: 'pointer', fontFamily: V2_FONTS.sans,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stage Funnel Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: 8, marginBottom: 16 }}>
        {STAGES.map(stage => {
          const agg = stageAgg[stage] || { count: 0, mrr: 0 }
          const active = stageFilter === stage
          const weight = STAGE_WEIGHTS[stage] || 0.1
          return (
            <div
              key={stage}
              onClick={() => handleStageClick(stage)}
              style={{
                background: active ? V2.accentBg : V2.card,
                border: `1px solid ${active ? V2.accentBorder : V2.border}`,
                borderRadius: 10, padding: '14px 12px', textAlign: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = V2.borderLight }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = active ? V2.accentBorder : V2.border }}
            >
              <div style={{ fontFamily: V2_FONTS.serif, fontSize: 22, color: V2.text }}>{agg.count}</div>
              <div style={{ fontSize: 10, color: V2.textDim, fontWeight: 500, marginTop: 2, fontFamily: V2_FONTS.sans }}>{stage}</div>
              <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, marginTop: 4 }}>
                {fmt(agg.mrr)} · {Math.round(weight * 100)}%
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Filter Pills ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'at-risk', label: `At risk (${atRiskCount})` },
          { id: 'closing', label: `Closing soon (${closingSoonCount})` },
        ].map(f => {
          const active = filter === f.id && !stageFilter
          return (
            <button
              key={f.id}
              onClick={() => handleFilterClick(f.id)}
              style={{
                padding: '5px 14px', borderRadius: 6, fontSize: 11, fontWeight: active ? 500 : 400,
                color: active ? V2.accent : V2.textDim,
                background: active ? V2.accentBg : 'transparent',
                border: `1px solid ${active ? V2.accentBorder : V2.border}`,
                cursor: 'pointer', fontFamily: V2_FONTS.sans,
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* ── Deal Table ── */}
      <div style={{ background: V2.card, borderRadius: 10, border: `1px solid ${V2.border}`, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 0.9fr 0.8fr 0.6fr 0.5fr 0.7fr 32px',
          padding: '8px 16px', borderBottom: `1px solid ${V2.ghost}`,
        }}>
          {['Account / Product', 'Stage', 'Win prob', 'MRR', 'Gap', 'Rep', ''].map(h => (
            <span key={h} style={{ fontSize: 9, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, fontFamily: V2_FONTS.sans }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {filteredDeals.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: V2.textDim, fontSize: 12, fontFamily: V2_FONTS.sans }}>
            No deals match the current filter.
          </div>
        )}

        {filteredDeals.map((d, i) => {
          const prob = dealProb(d)
          const factors = getDealFactors(d)
          const gap = d.gap || 0

          return (
            <div
              key={d.id || i}
              onClick={() => onSelectDeal && onSelectDeal(d, 'Pipeline')}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 0.9fr 0.8fr 0.6fr 0.5fr 0.7fr 32px',
                alignItems: 'center', padding: '10px 16px',
                borderBottom: i < filteredDeals.length - 1 ? `1px solid ${V2.ghost}22` : 'none',
                cursor: 'pointer', transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Account + Product */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: V2.text, fontFamily: V2_FONTS.sans }}>{d.accountName || d.account}</div>
                <div style={{ fontSize: 10, color: V2.textDim, marginTop: 1, fontFamily: V2_FONTS.sans }}>{d.product_group || d.product}</div>
              </div>

              {/* Stage pill */}
              <span style={{
                fontSize: 10, color: V2.textMid, padding: '3px 8px', borderRadius: 5,
                background: V2.elevated, border: `1px solid ${V2.ghost}`,
                width: 'fit-content', fontFamily: V2_FONTS.sans,
              }}>
                {d.stage}
              </span>

              {/* Win prob: bar + tooltip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 30, height: 3, background: V2.ghost, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${prob}%`, height: '100%', borderRadius: 2, background: pc(prob) }} />
                </div>
                <ProbTooltip prob={prob} factors={factors} />
              </div>

              {/* MRR */}
              <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.textMid }}>{fmt(d.mrr)}</span>

              {/* Gap */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{
                  fontSize: 10, fontFamily: V2_FONTS.sans,
                  color: gap > 7 ? V2.red : V2.dim,
                  fontWeight: gap > 7 ? 500 : 300,
                }}>
                  {gap}d
                </span>
                {gap > 7 && <span style={{ fontSize: 10 }}>&#9888;</span>}
              </div>

              {/* Rep */}
              <span style={{ fontSize: 11, color: V2.textDim, fontFamily: V2_FONTS.sans }}>{d.rep || '\u2014'}</span>

              {/* Arrow */}
              <div style={{ color: V2.ghost, display: 'flex', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
