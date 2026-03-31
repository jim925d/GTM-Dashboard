import { useState, useMemo } from 'react'
import { V2, V2_FONTS, pc, fmt } from '../tokens'
import { DEMO_ACCOUNTS } from '../demoData'
import useDeals from '../hooks/useDeals'
import useV2Targets from '../hooks/useV2Targets'

// ═══ Signal filter definitions ═══════════════════════════════════════════════

const SIGNAL_DEFS = [
  { id: 'on-net', label: 'On-net', dot: V2.sage, check: t => t.signals.some(s => s.includes('on-net')) },
  { id: 'whitespace', label: 'Whitespace >$30K', dot: V2.sage, check: t => {
    const ws = t.signals.find(s => s.includes('whitespace'))
    if (!ws) return false
    const m = ws.match(/\$(\d+)K/)
    return m && parseInt(m[1]) >= 30
  }},
  { id: 'new-sites', label: 'New sites', dot: V2.purple, check: t => t.signals.some(s => s.toLowerCase().includes('new')) },
  { id: 'upsell', label: 'Upsell path', dot: V2.accent, check: t => t.winCase?.path && t.winCase.path !== 'Greenfield' },
  { id: 'pipeline', label: 'Active pipeline', dot: V2.blue, check: t => t.signals.some(s => s.toLowerCase().includes('pipeline') || s.toLowerCase().includes('deal')) },
  { id: 'churn', label: 'Churn risk', dot: V2.red, check: t => t.signals.some(s => s.toLowerCase().includes('churn')) },
  { id: 'low-churn', label: 'Low churn', dot: V2.sage, check: t => !t.signals.some(s => s.toLowerCase().includes('churn')) },
  { id: 'stalled', label: 'Stalled deal', dot: V2.amber, check: t => t.signals.some(s => s.toLowerCase().includes('stall') || s.toLowerCase().includes('gap')) },
]

const SORT_OPTIONS = [
  { id: 'score', label: 'Target score', fn: (a, b) => b.score - a.score },
  { id: 'whitespace', label: 'Whitespace', fn: (a, b) => {
    const wsA = parseInt((a.signals.find(s => s.includes('whitespace')) || '').replace(/[^0-9]/g, '')) || 0
    const wsB = parseInt((b.signals.find(s => s.includes('whitespace')) || '').replace(/[^0-9]/g, '')) || 0
    return wsB - wsA
  }},
  { id: 'onnet', label: 'On-net %', fn: (a, b) => {
    const parse = t => { const m = (t.signals.find(s => s.includes('on-net')) || '').match(/(\d+)\/(\d+)/); return m ? parseInt(m[1]) / parseInt(m[2]) : 0 }
    return parse(b) - parse(a)
  }},
  { id: 'mrr', label: 'Current MRR', fn: (a, b) => (b.current?.mrr || 0) - (a.current?.mrr || 0) },
  { id: 'tenure', label: 'Tenure', fn: (a, b) => (b.current?.tenure || 0) - (a.current?.tenure || 0) },
]

// ═══ Score color ═════════════════════════════════════════════════════════════

const scoreColor = s => s >= 70 ? V2.sage : s >= 50 ? V2.amber : V2.red

// ═══ Main ═════════════════════════════════════════════════════════════════════

export default function V2TargetList({ accounts = [], rawData = {}, onSelectTarget }) {
  const { deals: realDeals } = useDeals(accounts)
  const isDemo = !realDeals.length
  const accts = isDemo ? DEMO_ACCOUNTS : accounts
  const { targets, loading } = useV2Targets(accts)

  const [activeFilters, setActiveFilters] = useState([])
  const [sortBy, setSortBy] = useState('score')

  // Filter counts
  const filterCounts = useMemo(() => {
    const m = {}
    for (const sd of SIGNAL_DEFS) m[sd.id] = targets.filter(sd.check).length
    return m
  }, [targets])

  // Apply filters (OR logic)
  const filtered = useMemo(() => {
    if (!activeFilters.length) return targets
    return targets.filter(t => activeFilters.some(fId => {
      const def = SIGNAL_DEFS.find(d => d.id === fId)
      return def ? def.check(t) : false
    }))
  }, [targets, activeFilters])

  // Sort
  const sorted = useMemo(() => {
    const sortDef = SORT_OPTIONS.find(s => s.id === sortBy) || SORT_OPTIONS[0]
    return [...filtered].sort(sortDef.fn)
  }, [filtered, sortBy])

  // Summary metrics
  const totalWhitespace = useMemo(() => {
    let total = 0
    for (const t of sorted) {
      const ws = t.signals.find(s => s.includes('whitespace'))
      if (ws) { const m = ws.match(/\$(\d+)K/); if (m) total += parseInt(m[1]) * 1000 }
    }
    return total
  }, [sorted])
  const onNetCount = sorted.filter(t => t.signals.some(s => s.includes('on-net'))).length
  const avgScore = sorted.length ? Math.round(sorted.reduce((s, t) => s + t.score, 0) / sorted.length) : 0

  const toggleFilter = id => setActiveFilters(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: V2_FONTS.serif, fontSize: 24, color: V2.text }}>Targets</div>
        <div style={{ fontSize: 12, color: V2.textDim, fontFamily: V2_FONTS.sans }}>Accounts ranked by opportunity score — who to sell to next</div>
      </div>

      {/* Signal filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {SIGNAL_DEFS.map(sd => {
          const active = activeFilters.includes(sd.id)
          const count = filterCounts[sd.id] || 0
          return (
            <button
              key={sd.id}
              onClick={() => toggleFilter(sd.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 6, fontSize: 11,
                fontWeight: active ? 500 : 400,
                color: active ? sd.dot : V2.textDim,
                background: active ? `${sd.dot}10` : 'transparent',
                border: `1px solid ${active ? `${sd.dot}30` : V2.border}`,
                cursor: 'pointer', fontFamily: V2_FONTS.sans,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? sd.dot : V2.dim }} />
              {sd.label}
              <span style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: active ? sd.dot : V2.dim, opacity: 0.7 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Sort + summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        {/* Summary metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: 20 }}>
          {[
            { l: 'Targets shown', v: String(sorted.length) },
            { l: 'Total whitespace', v: fmt(totalWhitespace) },
            { l: 'On-net accounts', v: String(onNetCount) },
            { l: 'Avg score', v: String(avgScore) },
          ].map(m => (
            <div key={m.l} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 10, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, fontFamily: V2_FONTS.sans }}>{m.l}</span>
              <span style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: V2.textMid }}>{m.v}</span>
            </div>
          ))}
        </div>

        {/* Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, fontFamily: V2_FONTS.sans }}>Sort</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              fontFamily: V2_FONTS.sans, fontSize: 11, color: V2.text,
              background: V2.elevated, border: `1px solid ${V2.ghost}`,
              borderRadius: 6, padding: '5px 10px', outline: 'none',
            }}
          >
            {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Target cards */}
      {loading && <div style={{ color: V2.textDim, fontSize: 12, fontFamily: V2_FONTS.sans }}>Loading playbook data...</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sorted.map((t, i) => {
          const rank = i + 1
          const wc = t.winCase
          const topPlay = t.plays?.find(p => p.recommended) || t.plays?.[0]

          return (
            <div
              key={t.id}
              onClick={() => onSelectTarget && onSelectTarget(t, 'Targets')}
              style={{
                background: V2.card, border: `1px solid ${V2.border}`, borderRadius: 12,
                padding: '20px 24px', cursor: 'pointer', transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = V2.borderLight}
              onMouseLeave={e => e.currentTarget.style.borderColor = V2.border}
            >
              {/* Header row: rank + name + industry + score */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.dim, minWidth: 20 }}>#{rank}</span>
                  <div>
                    <div style={{ fontFamily: V2_FONTS.serif, fontSize: 20, color: V2.text }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: V2.textDim, fontFamily: V2_FONTS.sans, marginTop: 2 }}>{t.industry}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: V2_FONTS.serif, fontSize: 32, color: scoreColor(t.score), lineHeight: 1 }}>{t.score}</div>
                  <div style={{ fontSize: 9, color: V2.dim, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3, fontFamily: V2_FONTS.sans }}>Score</div>
                </div>
              </div>

              {/* Why we win block */}
              {wc && (
                <div style={{ background: V2.card, border: `1px solid ${V2.sageBd}`, borderRadius: 10, padding: '18px 22px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: V2.sage, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 500, fontFamily: V2_FONTS.sans }}>Why we should win this account</div>
                  <div style={{ fontFamily: V2_FONTS.serif, fontSize: 17, color: V2.text, lineHeight: 1.4, marginBottom: 14 }}>{wc.headline}</div>

                  {/* Three columns */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    <div style={{ padding: '10px 14px', background: V2.elevated, borderRadius: 8, border: `1px solid ${V2.ghost}` }}>
                      <div style={{ fontSize: 9, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: V2_FONTS.sans }}>They have</div>
                      <div style={{ fontSize: 12, color: V2.textMid, fontFamily: V2_FONTS.sans }}>{wc.has}</div>
                    </div>
                    <div style={{ padding: '10px 14px', background: V2.elevated, borderRadius: 8, border: `1px solid ${V2.ghost}` }}>
                      <div style={{ fontSize: 9, color: V2.sage, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: V2_FONTS.sans }}>On-net advantage</div>
                      <div style={{ fontSize: 12, color: V2.sage, fontFamily: V2_FONTS.sans }}>{wc.onNet}</div>
                    </div>
                    <div style={{ padding: '10px 14px', background: V2.elevated, borderRadius: 8, border: `1px solid ${V2.ghost}` }}>
                      <div style={{ fontSize: 9, color: V2.accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: V2_FONTS.sans }}>Sell this</div>
                      <div style={{ fontSize: 12, color: V2.accentLight, fontWeight: 500, fontFamily: V2_FONTS.sans }}>{wc.sell}</div>
                    </div>
                  </div>

                  {/* Upsell path stats */}
                  {wc.path && wc.path !== 'Greenfield' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${V2.sageBd}` }}>
                      <span style={{ fontSize: 10, color: V2.textDim, fontFamily: V2_FONTS.sans }}>Upsell path:</span>
                      <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.textMid }}>{wc.path}</span>
                      <span style={{ width: 1, height: 12, background: V2.ghost }} />
                      <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.sage, fontWeight: 500 }}>{wc.rate} close rate</span>
                      {wc.deals > 0 && <>
                        <span style={{ width: 1, height: 12, background: V2.ghost }} />
                        <span style={{ fontSize: 10, color: V2.textDim, fontFamily: V2_FONTS.sans }}>{wc.deals} deals</span>
                      </>}
                    </div>
                  )}

                  {wc.path === 'Greenfield' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${V2.amberBd}` }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: V2.amber }} />
                      <span style={{ fontSize: 11, color: V2.amber, fontFamily: V2_FONTS.sans }}>No existing products — greenfield, longer cycle</span>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom row: Signals + Current state + Top play */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                {/* Signals */}
                <div>
                  <div style={{ fontSize: 9, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, fontWeight: 500, fontFamily: V2_FONTS.sans }}>Signals</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {t.signals.map((s, si) => (
                      <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: V2.sage, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: V2.textMid, fontFamily: V2_FONTS.sans }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Current state */}
                <div>
                  <div style={{ fontSize: 9, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, fontWeight: 500, fontFamily: V2_FONTS.sans }}>Current state</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 10, color: V2.textDim, fontFamily: V2_FONTS.sans }}>MRR</span>
                      <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.textMid }}>{fmt(t.current?.mrr)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 10, color: V2.textDim, fontFamily: V2_FONTS.sans }}>Services</span>
                      <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.textMid }}>{t.current?.services || 0}</span>
                    </div>
                    {t.current?.products?.length > 0 && (
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                        {t.current.products.slice(0, 3).map(p => (
                          <span key={p} style={{ fontSize: 9, color: V2.purple, padding: '1px 6px', borderRadius: 3, background: V2.purpleBg, border: `1px solid ${V2.purpleBd}`, fontFamily: V2_FONTS.sans }}>{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Top play */}
                <div>
                  <div style={{ fontSize: 9, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, fontWeight: 500, fontFamily: V2_FONTS.sans }}>Top play</div>
                  {topPlay ? (
                    <div>
                      <div style={{ fontSize: 12, color: V2.text, fontWeight: 500, fontFamily: V2_FONTS.sans, marginBottom: 3 }}>{topPlay.title}</div>
                      {topPlay.products?.length > 0 && (
                        <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
                          {topPlay.products.map(p => (
                            <span key={p} style={{ fontSize: 9, color: V2.accent, padding: '1px 6px', borderRadius: 3, background: V2.accentBg, border: `1px solid ${V2.accentBorder}`, fontFamily: V2_FONTS.sans }}>{p}</span>
                          ))}
                        </div>
                      )}
                      <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.sage, fontWeight: 500 }}>{topPlay.impact}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: V2.textDim, fontFamily: V2_FONTS.sans }}>No plays available</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {sorted.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: V2.textDim, fontSize: 12, fontFamily: V2_FONTS.sans }}>
            No targets match the current filters.
          </div>
        )}
      </div>
    </div>
  )
}
