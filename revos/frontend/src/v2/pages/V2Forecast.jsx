import { useState, useMemo, useCallback } from 'react'
import { V2, V2_FONTS, STAGES, STAGE_WEIGHTS, pc, fmt, fmtPct } from '../tokens'
import { DEMO_ACCOUNTS, DEMO_DEALS, DEMO_BACKTEST } from '../demoData'
import useDeals from '../hooks/useDeals'
import useV2Forecast from '../hooks/useV2Forecast'
import ProbTooltip from '../components/ProbTooltip'
import WeightedTooltip from '../components/WeightedTooltip'

// ═══ Helpers ═══════════════════════════════════════════════════════════════════

function dealProb(d) {
  const p = d.prob || d.winProb || STAGE_WEIGHTS[d.stage] || 0.1
  return p <= 1 ? p : p / 100
}

function getDealFactors(deal) {
  if (deal.factors?.length) return deal.factors
  const base = { 'Discover': 31, 'Design': 42, 'Design Solution': 53, 'Propose': 66, 'Negotiate': 75, 'Verbal Agreement': 92 }[deal.stage] || 50
  return [['Stage base', `${base}%`, V2.textMid, `${deal.stage} closes at ${base}%`]]
}

const scale = (val, view) => view === 'quarterly' ? val * 3 : view === 'annual' ? val * 12 : val
const unscale = (val, view) => view === 'quarterly' ? val / 3 : view === 'annual' ? val / 12 : val
const periodLabel = (view) => {
  const now = new Date()
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  if (view === 'monthly') return `${m[now.getMonth()]} ${now.getFullYear()}`
  if (view === 'quarterly') return `Q${Math.ceil((now.getMonth()+1)/3)} ${now.getFullYear()}`
  return String(now.getFullYear())
}

// ═══ Waterfall ═══════════════════════════════════════════════════════════════

function Waterfall({ data, view }) {
  const bars = [
    { label: 'Target', value: scale(data.target, view), color: V2.elevated, border: V2.borderLight, dashed: true },
    { label: 'Committed', value: scale(data.committed, view), color: V2.sageBg, border: V2.sageBd },
    { label: 'Best Case', value: scale(data.bestCase, view), color: V2.purpleBg, border: V2.purpleBd },
    { label: 'Upside', value: scale(data.upside, view), color: V2.amberBg, border: V2.amberBd },
    { label: 'Gap', value: scale(data.gap, view), color: V2.dangerBg, border: V2.dangerBd, dashed: true },
    { label: 'Forecast', value: scale(data.forecast, view), color: V2.card, border: V2.border },
  ]
  const maxVal = Math.max(...bars.map(b => b.value), 1)
  const barH = 160

  return (
    <div style={{ background: V2.card, border: `1px solid ${V2.border}`, borderRadius: 10, padding: '18px 22px', marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginBottom: 16, fontFamily: V2_FONTS.sans }}>
        Forecast waterfall · {periodLabel(view)}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: barH, paddingBottom: 36, position: 'relative' }}>
        {/* Dashed target line */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 36 + (bars[0].value / maxVal) * (barH - 36), borderTop: `1.5px dashed ${V2.textDim}`, opacity: 0.3 }} />
        {bars.map((b, i) => {
          const h = Math.max((b.value / maxVal) * (barH - 36), 4)
          return (
            <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              <div style={{ fontFamily: V2_FONTS.serif, fontSize: 14, color: b.dashed ? V2.textDim : V2.text, marginBottom: 5 }}>{fmt(b.value)}</div>
              <div style={{ width: '100%', maxWidth: 44, height: h, borderRadius: '4px 4px 0 0', background: b.dashed ? 'transparent' : b.color, border: b.dashed ? `1.5px dashed ${b.border}` : `1px solid ${b.border}`, opacity: b.dashed ? 0.6 : 1 }} />
              <div style={{ fontSize: 9, color: V2.textDim, marginTop: 6, textAlign: 'center', position: 'absolute', bottom: -30, letterSpacing: '0.03em', fontFamily: V2_FONTS.sans, whiteSpace: 'nowrap' }}>{b.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══ Trend Chart (SVG) ═══════════════════════════════════════════════════════

function TrendChart({ deals, target, view }) {
  const [hover, setHover] = useState(null)
  const W = 600, H = 200, PAD = { l: 50, r: 20, t: 20, b: 30 }
  const cw = W - PAD.l - PAD.r, ch = H - PAD.t - PAD.b

  const data = useMemo(() => {
    const now = new Date()
    const points = []
    const n = view === 'annual' ? 4 : view === 'quarterly' ? 5 : 6

    for (let i = n - 1; i >= 0; i--) {
      let label, raw = 0, weighted = 0, created = 0
      if (view === 'monthly') {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        label = d.toLocaleString('default', { month: 'short' })
        const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        for (const deal of deals) {
          if ((deal.close_date || '').startsWith(ym)) { raw += deal.mrr || 0; weighted += (deal.mrr || 0) * dealProb(deal) }
          if ((deal.created_date || '').startsWith(ym)) created += deal.mrr || 0
        }
      } else if (view === 'quarterly') {
        const q = Math.ceil((now.getMonth()+1)/3) - i
        const yr = now.getFullYear() + Math.floor((q - 1) / 4)
        const qn = ((q - 1) % 4 + 4) % 4 + 1
        label = `Q${qn}`
        raw = deals.reduce((s, d) => s + (d.mrr || 0), 0) * (0.7 + i * 0.06)
        weighted = raw * 0.65
        created = raw * 0.3
      } else {
        label = String(now.getFullYear() - i)
        raw = deals.reduce((s, d) => s + (d.mrr || 0), 0) * 12 * (0.6 + i * 0.1)
        weighted = raw * 0.6
        created = raw * 0.25
      }
      points.push({ label, raw, weighted, created, target: scale(target, view) })
    }
    return points
  }, [deals, target, view])

  const maxY = Math.max(...data.flatMap(d => [d.raw, d.weighted, d.target]), 1)
  const x = i => PAD.l + (i / (data.length - 1 || 1)) * cw
  const y = v => PAD.t + ch - (v / maxY) * ch

  const line = (key, color) => data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d[key])}`).join(' ')
  const area = (key, color) => {
    const pts = data.map((d, i) => `${x(i)},${y(d[key])}`).join(' L')
    return `M${pts} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`
  }

  const fmtY = v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v/1000)}K` : `$${v}`

  return (
    <div style={{ background: V2.card, border: `1px solid ${V2.border}`, borderRadius: 10, padding: '18px 22px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, fontFamily: V2_FONTS.sans }}>Pipeline trend</div>
        <div style={{ display: 'flex', gap: 14 }}>
          {[['Raw', V2.textMid, false], ['Weighted', V2.purple, false], ['Created', V2.sage, true], ['Target', V2.accent, true]].map(([l, c, dashed]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 16, height: 2, background: c, borderRadius: 1, ...(dashed ? { backgroundImage: `repeating-linear-gradient(90deg, ${c} 0px, ${c} 4px, transparent 4px, transparent 8px)`, background: 'transparent' } : {}) }} />
              <span style={{ fontSize: 9, color: V2.textDim, fontFamily: V2_FONTS.sans }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const mx = (e.clientX - rect.left) / rect.width * W
          const idx = Math.round(((mx - PAD.l) / cw) * (data.length - 1))
          setHover(idx >= 0 && idx < data.length ? idx : null)
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => (
          <g key={pct}>
            <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ch * (1 - pct)} y2={PAD.t + ch * (1 - pct)} stroke={V2.ghost} strokeWidth={0.5} />
            <text x={PAD.l - 6} y={PAD.t + ch * (1 - pct) + 3} textAnchor="end" fill={V2.dim} fontSize={9} fontFamily={V2_FONTS.mono}>{fmtY(maxY * pct)}</text>
          </g>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text key={i} x={x(i)} y={H - 5} textAnchor="middle" fill={V2.dim} fontSize={9} fontFamily={V2_FONTS.sans}>{d.label}</text>
        ))}

        {/* Area fills */}
        <path d={area('raw', V2.textMid)} fill={`${V2.textMid}08`} />
        <path d={area('weighted', V2.purple)} fill={`${V2.purple}10`} />

        {/* Lines */}
        <path d={line('raw')} fill="none" stroke={V2.textMid} strokeWidth={1.5} />
        <path d={line('weighted')} fill="none" stroke={V2.purple} strokeWidth={2.5} />
        <path d={line('created')} fill="none" stroke={V2.sage} strokeWidth={1.5} strokeDasharray="5 3" />
        {/* Target line */}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(scale(target, view))} y2={y(scale(target, view))} stroke={V2.accent} strokeWidth={1.5} strokeDasharray="6 4" />

        {/* Hover */}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ch} stroke={V2.borderLight} strokeWidth={1} />
            {['raw', 'weighted', 'created'].map(k => {
              const c = k === 'raw' ? V2.textMid : k === 'weighted' ? V2.purple : V2.sage
              return <circle key={k} cx={x(hover)} cy={y(data[hover][k])} r={4} fill={c} stroke={V2.card} strokeWidth={2} />
            })}
          </g>
        )}
      </svg>

      {/* Hover tooltip */}
      {hover !== null && (
        <div style={{ display: 'flex', gap: 16, padding: '8px 14px', background: V2.elevated, borderRadius: 8, border: `1px solid ${V2.ghost}`, marginTop: 8 }}>
          <span style={{ fontSize: 11, color: V2.text, fontWeight: 500, fontFamily: V2_FONTS.sans }}>{data[hover].label}</span>
          {[['Raw', data[hover].raw, V2.textMid], ['Weighted', data[hover].weighted, V2.purple], ['Created', data[hover].created, V2.sage]].map(([l, v, c]) => (
            <span key={l} style={{ fontSize: 10, fontFamily: V2_FONTS.sans }}>
              <span style={{ color: V2.textDim }}>{l} </span><span style={{ fontFamily: V2_FONTS.mono, color: c }}>{fmt(v)}</span>
            </span>
          ))}
          <span style={{ fontSize: 10, fontFamily: V2_FONTS.sans }}>
            <span style={{ color: V2.textDim }}>Coverage </span>
            <span style={{ fontFamily: V2_FONTS.mono, color: data[hover].raw >= data[hover].target ? V2.sage : V2.amber }}>{data[hover].target > 0 ? `${Math.round(data[hover].raw / data[hover].target * 100)}%` : '--'}</span>
          </span>
        </div>
      )}
    </div>
  )
}

// ═══ Stage Breakdown ═════════════════════════════════════════════════════════

function StageBreakdown({ stageGroups, view, onSelectDeal }) {
  const [expanded, setExpanded] = useState(null)

  return (
    <div>
      <div style={{ fontSize: 11, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, fontWeight: 500, fontFamily: V2_FONTS.sans }}>
        Pipeline by stage · {periodLabel(view)}
      </div>
      <div style={{ background: V2.card, border: `1px solid ${V2.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {stageGroups.map((g, gi) => {
          const isOpen = expanded === g.stage
          const scaledRaw = scale(g.rawMRR, view)
          const scaledWeighted = scale(g.weightedMRR, view)
          const weightedDeals = g.deals.map(d => ({ accountName: d.accountName || d.account, mrr: scale(d.mrr || 0, view), winProb: dealProb(d) }))

          return (
            <div key={g.stage}>
              {/* Stage row */}
              <div
                onClick={() => setExpanded(isOpen ? null : g.stage)}
                style={{
                  display: 'grid', gridTemplateColumns: '0.5fr 1.5fr 0.6fr 0.8fr 0.8fr 32px',
                  alignItems: 'center', padding: '11px 16px',
                  borderBottom: `1px solid ${V2.ghost}22`, cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.purple, padding: '2px 8px', borderRadius: 4, background: V2.purpleBg, width: 'fit-content' }}>
                  {Math.round(g.weight * 100)}%
                </span>
                <span style={{ fontSize: 13, color: V2.text, fontWeight: 500, fontFamily: V2_FONTS.sans }}>{g.stage}</span>
                <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.textDim }}>{g.count} deals</span>
                <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.textDim }}>{fmt(scaledRaw)}</span>
                <WeightedTooltip value={scaledWeighted} deals={weightedDeals} />
                <div style={{ color: V2.textDim, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : '' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
              </div>

              {/* Expanded deals */}
              {isOpen && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr 0.6fr', padding: '6px 16px 6px 46px', borderBottom: `1px solid ${V2.ghost}22` }}>
                    {['Account', 'Raw MRR', 'Weighted', 'Gap'].map(h => (
                      <span key={h} style={{ fontSize: 9, color: V2.dim, textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: V2_FONTS.sans }}>{h}</span>
                    ))}
                  </div>
                  {g.deals.map((d, di) => {
                    const prob = dealProb(d)
                    const probPct = Math.round(prob * 100)
                    const factors = getDealFactors(d)
                    const w = scale((d.mrr || 0) * prob, view)
                    return (
                      <div
                        key={di}
                        onClick={e => { e.stopPropagation(); onSelectDeal && onSelectDeal(d, 'Forecast') }}
                        style={{
                          display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr 0.6fr',
                          alignItems: 'center', padding: '8px 16px 8px 46px',
                          borderBottom: di < g.deals.length - 1 ? `1px solid ${V2.ghost}11` : `1px solid ${V2.ghost}22`,
                          cursor: 'pointer', transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div>
                          <span style={{ fontSize: 12, color: V2.textMid, fontFamily: V2_FONTS.sans }}>{d.accountName || d.account}</span>
                          <span style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, marginLeft: 8 }}>{d.product_group || d.product}</span>
                        </div>
                        <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.textDim }}>{fmt(scale(d.mrr || 0, view))}</span>
                        <WeightedTooltip value={Math.round(w)} deal={{ mrr: scale(d.mrr || 0, view), winProb: prob }} />
                        <span style={{ fontSize: 10, color: (d.gap || 0) > 7 ? V2.red : V2.dim, fontFamily: V2_FONTS.sans }}>{d.gap != null ? `${d.gap}d` : '\u2014'}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {stageGroups.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: V2.textDim, fontSize: 12, fontFamily: V2_FONTS.sans }}>No deals in pipeline.</div>
        )}
      </div>
    </div>
  )
}

// ═══ Right Column Cards ══════════════════════════════════════════════════════

function GapCard({ gap, target, forecast, dealCount, view }) {
  const gapVal = scale(gap.value, view)
  const targetVal = scale(target, view)
  const forecastVal = scale(forecast, view)
  const att = targetVal > 0 ? Math.round(forecastVal / targetVal * 100) : 0
  const onTrack = gapVal <= 0

  return (
    <div style={{ background: V2.card, border: `1px solid ${V2.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginBottom: 10, fontFamily: V2_FONTS.sans }}>Pipeline gap</div>
      <div style={{ fontFamily: V2_FONTS.serif, fontSize: 28, color: onTrack ? V2.sage : V2.red, lineHeight: 1 }}>{onTrack ? 'On track' : fmt(gapVal)}</div>
      <div style={{ fontSize: 11, color: V2.textDim, marginTop: 4, fontFamily: V2_FONTS.sans }}>vs {fmt(targetVal)} target</div>
      <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: att >= 100 ? V2.sage : V2.amber }}>{att}%</span>
          <span style={{ fontSize: 9, color: V2.dim, fontFamily: V2_FONTS.sans }}>attainment</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: V2.textMid }}>{dealCount}</span>
          <span style={{ fontSize: 9, color: V2.dim, fontFamily: V2_FONTS.sans }}>deals</span>
        </div>
      </div>
      {!onTrack && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: V2.elevated, borderRadius: 6, border: `1px solid ${V2.ghost}` }}>
          <div style={{ fontSize: 10, color: V2.textDim, fontFamily: V2_FONTS.sans }}>
            {gap.daysToClose < 90
              ? `At current pace, gap closes in ~${gap.daysToClose} days (${gap.newDealsPerWeek} new deals/wk at ${Math.round(gap.discoverCloseRate * 100)}% Discover close rate)`
              : 'Gap requires accelerated pipeline generation or deal advancement'}
          </div>
        </div>
      )}
    </div>
  )
}

function ModelHealthCard({ backtest }) {
  const bt = backtest || DEMO_BACKTEST
  return (
    <div style={{ background: V2.card, border: `1px solid ${V2.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginBottom: 10, fontFamily: V2_FONTS.sans }}>Model health</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        {[
          { l: 'Brier', v: bt.brierScore?.toFixed(2) || '0.14', c: V2.text, target: '< 0.20' },
          { l: 'Cal. error', v: (bt.avgError || 0.09).toFixed(2), c: V2.amber, target: '< 0.05' },
          { l: 'AUC', v: (bt.accuracy || 0.82).toFixed(2), c: V2.sage, target: '> 0.75' },
        ].map(m => (
          <div key={m.l} style={{ flex: 1, background: V2.elevated, borderRadius: 6, padding: '8px 10px', textAlign: 'center', border: `1px solid ${V2.ghost}` }}>
            <div style={{ fontFamily: V2_FONTS.serif, fontSize: 18, color: m.c }}>{m.v}</div>
            <div style={{ fontSize: 8, color: V2.dim, marginTop: 2, fontFamily: V2_FONTS.sans }}>{m.l} · {m.target}</div>
          </div>
        ))}
      </div>
      {(bt.insights || []).slice(0, 3).map((ins, i) => {
        const colors = [V2.sage, V2.amber, V2.purple]
        return (
          <div key={i} style={{ padding: '6px 10px', marginBottom: 4, borderRadius: 5, borderLeft: `3px solid ${colors[i % 3]}`, background: V2.elevated }}>
            <div style={{ fontSize: 11, color: V2.textMid, fontFamily: V2_FONTS.sans, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: ins.text.replace(/\*\*(.*?)\*\*/g, `<strong style="color:${V2.text}">$1</strong>`) }} />
          </div>
        )
      })}
    </div>
  )
}

function GovernanceCard({ forecast, view, target }) {
  const fv = scale(forecast, view)
  const lastApproved = Math.round(fv * 0.95)
  const delta = fv - lastApproved

  return (
    <div style={{ background: V2.accentBg, border: `1px solid ${V2.accentBorder}`, borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ fontSize: 10, color: V2.accent, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginBottom: 10, fontFamily: V2_FONTS.sans }}>Forecast governance</div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: V2.textDim, fontFamily: V2_FONTS.sans }}>Current</div>
          <div style={{ fontFamily: V2_FONTS.serif, fontSize: 20, color: V2.purple }}>{fmt(fv)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: V2.textDim, fontFamily: V2_FONTS.sans }}>Last approved</div>
          <div style={{ fontFamily: V2_FONTS.mono, fontSize: 13, color: V2.textMid }}>{fmt(lastApproved)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: V2.textDim, fontFamily: V2_FONTS.sans }}>Delta</div>
          <div style={{ fontFamily: V2_FONTS.mono, fontSize: 13, color: V2.sage }}>+{fmt(delta)}</div>
        </div>
        <span style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.amber, padding: '2px 8px', borderRadius: 4, background: V2.amberBg, border: `1px solid ${V2.amberBd}` }}>PENDING REVIEW</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ fontFamily: V2_FONTS.sans, fontSize: 11, fontWeight: 600, background: V2.accent, color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}>Submit</button>
        <button style={{ fontFamily: V2_FONTS.sans, fontSize: 11, color: V2.textDim, background: 'none', border: `1px solid ${V2.ghost}`, padding: '5px 12px', borderRadius: 6, cursor: 'pointer' }}>History</button>
      </div>
    </div>
  )
}

// ═══ Main ═════════════════════════════════════════════════════════════════════

export default function V2Forecast({ accounts = [], rawData = {}, quota, onQuotaChange, onSelectDeal }) {
  const { deals: realDeals } = useDeals(accounts)
  const isDemo = !realDeals.length
  const accts = isDemo ? DEMO_ACCOUNTS : accounts
  const allDeals = isDemo ? DEMO_DEALS : realDeals

  const [view, setView] = useState('monthly')
  const [editingTarget, setEditingTarget] = useState(false)
  const [tempTarget, setTempTarget] = useState('')

  const monthlyTarget = quota || 180000
  const displayTarget = scale(monthlyTarget, view)

  const fcData = useV2Forecast(accts, { quota: monthlyTarget })

  const totalMRR = allDeals.reduce((s, d) => s + (d.mrr || 0), 0)
  const weightedMRR = allDeals.reduce((s, d) => s + (d.mrr || 0) * dealProb(d), 0)
  const weightedDeals = allDeals.map(d => ({ accountName: d.accountName || d.account, mrr: d.mrr || 0, winProb: dealProb(d) }))

  const targetLabels = { monthly: 'Monthly target', quarterly: 'Quarterly target', annual: 'Annual target' }

  const handleTargetEdit = () => { setTempTarget(String(displayTarget)); setEditingTarget(true) }
  const handleTargetSave = () => {
    const val = parseInt(tempTarget.replace(/[^0-9]/g, '')) || 0
    const monthly = Math.round(unscale(val, view))
    if (onQuotaChange && monthly > 0) onQuotaChange(monthly)
    setEditingTarget(false)
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: V2_FONTS.serif, fontSize: 24, color: V2.text }}>Forecast</span>
            <span style={{ fontSize: 12, color: V2.textDim, fontFamily: V2_FONTS.sans }}>{periodLabel(view)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6 }}>
            <span style={{ fontSize: 12, color: V2.textDim, fontFamily: V2_FONTS.sans }}>{allDeals.length} deals</span>
            <span style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: V2.text }}>{fmt(scale(totalMRR, view))}</span>
            <WeightedTooltip value={Math.round(scale(weightedMRR, view))} deals={weightedDeals} label="Weighted " />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Editable target */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3, fontFamily: V2_FONTS.sans }}>{targetLabels[view]}</div>
            {editingTarget ? (
              <input
                value={tempTarget}
                onChange={e => setTempTarget(e.target.value)}
                onBlur={handleTargetSave}
                onKeyDown={e => e.key === 'Enter' && handleTargetSave()}
                autoFocus
                style={{ fontFamily: V2_FONTS.mono, fontSize: 14, color: V2.accent, background: V2.elevated, border: `1px solid ${V2.accentBorder}`, borderRadius: 6, padding: '3px 8px', width: 100, outline: 'none', textAlign: 'right' }}
              />
            ) : (
              <div onClick={handleTargetEdit} style={{ fontFamily: V2_FONTS.mono, fontSize: 14, color: V2.accent, cursor: 'pointer', borderBottom: `1px dashed ${V2.accentBorder}` }}>
                {fmt(displayTarget)}
              </div>
            )}
          </div>
          {/* Time toggle */}
          <div style={{ display: 'flex', gap: 1, background: V2.elevated, borderRadius: 8, padding: 2, border: `1px solid ${V2.ghost}` }}>
            {[['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['annual', 'Annual']].map(([id, label]) => (
              <button key={id} onClick={() => setView(id)} style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: view === id ? 500 : 400,
                color: view === id ? V2.accent : V2.textDim, background: view === id ? V2.accentBg : 'transparent',
                border: view === id ? `1px solid ${V2.accentBorder}` : '1px solid transparent', cursor: 'pointer', fontFamily: V2_FONTS.sans,
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Waterfall ── */}
      <Waterfall data={{ ...fcData.waterfall, target: monthlyTarget, forecast: fcData.forecast }} view={view} />

      {/* ── Trend Chart ── */}
      <TrendChart deals={allDeals} target={monthlyTarget} view={view} />

      {/* ── Two-column ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <StageBreakdown stageGroups={fcData.stageGroups} view={view} onSelectDeal={onSelectDeal} />
        <div>
          <GapCard gap={fcData.gap} target={monthlyTarget} forecast={fcData.forecast} dealCount={fcData.dealCount} view={view} />
          <ModelHealthCard backtest={fcData.backtest} />
          <GovernanceCard forecast={fcData.forecast} view={view} target={monthlyTarget} />
        </div>
      </div>
    </div>
  )
}
