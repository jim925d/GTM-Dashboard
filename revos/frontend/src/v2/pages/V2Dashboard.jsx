import { useMemo } from 'react'
import { V2, V2_FONTS, pc, fmt } from '../tokens'
import useDeals from '../hooks/useDeals'
import useV2Targets from '../hooks/useV2Targets'
import ProbTooltip from '../components/ProbTooltip'

// ═══ Helpers ═══════════════════════════════════════════════════════════════════

function urgencyScore(deal) {
  const prob = (deal.prob || deal.winProb || 0.5)
  const p = prob <= 1 ? prob * 100 : prob
  return (deal.gap || 0) + Math.max(60 - p, 0)
}

function getMonthLabel() {
  const m = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const now = new Date()
  return `${m[now.getMonth()]} ${now.getFullYear()}`
}

function getDealFactors(deal) {
  if (deal.factors?.length) return deal.factors
  const stageBase = { 'Discover': 31, 'Design': 42, 'Design Solution': 53, 'Propose': 66, 'Negotiate': 75, 'Verbal Agreement': 92 }
  const base = stageBase[deal.stage] || 50
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

function getActionDesc(deal) {
  const action = null
  const gap = deal.gap || 0
  if (gap > 14) return { desc: `${gap}-day activity gap. Re-engage within 48h \u2014 send value-add intel or schedule a call.`, impact: `+${Math.min(19, Math.round(gap * 0.6))}%` }
  const prob = (deal.winProb || deal.prob || 0.5)
  if (prob < 0.35) return { desc: `Low probability at ${deal.stage}. Review exit criteria \u2014 is the deal genuinely progressing?`, impact: '+5%' }
  if (deal.daysInStage > 20) return { desc: `${deal.daysInStage} days in ${deal.stage}. Propose a concrete next step with a specific date.`, impact: '+4%' }
  return { desc: 'Advance to next stage. Review exit criteria below.', impact: '+3%' }
}

function dealProb(d) {
  const p = d.prob || d.winProb || 0.5
  return Math.round(p <= 1 ? p * 100 : p)
}

// ═══ Main ═════════════════════════════════════════════════════════════════════

export default function V2Dashboard({ accounts = [], rawData = {}, onNavigate, onSelectDeal, onSelectTarget }) {
  const { deals: realDeals } = useDeals(accounts)
  const accts = accounts
  const allDeals = realDeals
  const { targets } = useV2Targets(accts)

  // Urgency-sorted for priority actions
  const actionDeals = useMemo(() =>
    [...allDeals].sort((a, b) => urgencyScore(b) - urgencyScore(a)).slice(0, 3),
    [allDeals]
  )

  // Metrics
  const pipeline = allDeals.reduce((s, d) => s + (d.mrr || 0), 0)
  const atRisk = allDeals.filter(d => (d.gap || 0) > 7 || dealProb(d) < 40).length
  const closeStages = ['Negotiate', 'Verbal Agreement']
  const closeThisMonth = allDeals.filter(d => closeStages.includes(d.stage))
  const closeMRR = closeThisMonth.reduce((s, d) => s + (d.mrr || 0), 0)
  const avgProb = allDeals.length
    ? Math.round(allDeals.reduce((s, d) => s + dealProb(d), 0) / allDeals.length)
    : 0

  const metrics = [
    { l: 'Pipeline', v: fmt(pipeline), c: V2.text, s: `${allDeals.length} deals` },
    { l: 'Forecast confidence', v: `${avgProb}%`, c: V2.sage, s: 'Calibrated' },
    { l: 'Deals at risk', v: String(atRisk), c: V2.red, s: 'gap >7d or prob <40%' },
    { l: 'Close this month', v: String(closeThisMonth.length), c: V2.text, s: fmt(closeMRR) },
  ]

  // Navigation helper — pass source so deal detail knows where to go back
  const selectDeal = (deal) => {
    if (onSelectDeal) onSelectDeal(deal, 'Dashboard')
  }

  return (
    <div>
      {/* Month header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: V2_FONTS.serif, fontSize: 24, color: V2.text }}>{getMonthLabel()}</div>
        <div style={{ fontSize: 12, color: V2.textDim, fontFamily: V2_FONTS.sans }}>Current month overview</div>
      </div>

      {/* ── Metric strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ background: V2.card, borderRadius: 10, padding: '16px 18px', border: `1px solid ${V2.border}` }}>
            <div style={{ fontSize: 10, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 500, fontFamily: V2_FONTS.sans }}>{m.l}</div>
            <div style={{ fontFamily: V2_FONTS.serif, fontSize: 26, color: m.c }}>{m.v}</div>
            <div style={{ fontSize: 10, color: V2.dim, marginTop: 3, fontFamily: V2_FONTS.sans }}>{m.s}</div>
          </div>
        ))}
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Left: Priority actions + Top targets */}
        <div>
          <div style={{ fontSize: 11, color: V2.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, fontWeight: 500, fontFamily: V2_FONTS.sans }}>Priority actions</div>

          {actionDeals.map((deal, i) => {
            const prob = dealProb(deal)
            const { desc, impact } = getActionDesc(deal)
            const factors = getDealFactors(deal)

            return (
              <div
                key={deal.id}
                onClick={() => selectDeal(deal)}
                style={{
                  padding: '18px 20px', borderRadius: 10, marginBottom: 8, cursor: 'pointer',
                  background: i === 0 ? V2.sageBg : V2.card,
                  border: `1px solid ${i === 0 ? V2.sageBd : V2.border}`,
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { if (i > 0) e.currentTarget.style.borderColor = V2.borderLight }}
                onMouseLeave={e => { if (i > 0) e.currentTarget.style.borderColor = V2.border }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 14, color: V2.text, fontWeight: 500, fontFamily: V2_FONTS.sans, marginBottom: 2 }}>
                      {deal.accountName || deal.account}
                    </div>
                    <div style={{ fontSize: 11, color: V2.textDim, fontFamily: V2_FONTS.sans }}>
                      {deal.product_group || deal.product} · {fmt(deal.mrr)} · {deal.stage}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ProbTooltip prob={prob} factors={factors} />
                    <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.sage, padding: '2px 7px', background: V2.sageBg, borderRadius: 4 }}>
                      {impact}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: V2.textMid, lineHeight: 1.6, fontFamily: V2_FONTS.sans }}>{desc}</div>
              </div>
            )
          })}

          {/* Top targets */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, color: V2.purple, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, fontWeight: 500, fontFamily: V2_FONTS.sans }}>Top targets</div>

            {targets.slice(0, 2).map(t => (
              <div
                key={t.id}
                onClick={() => onSelectTarget ? onSelectTarget(t) : onNavigate && onNavigate('v2-targets')}
                style={{
                  padding: '14px 18px', borderRadius: 10, marginBottom: 8, cursor: 'pointer',
                  background: V2.card, border: `1px solid ${V2.border}`,
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = V2.borderLight}
                onMouseLeave={e => e.currentTarget.style.borderColor = V2.border}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: V2.text, fontWeight: 500, fontFamily: V2_FONTS.sans }}>{t.name}</div>
                  <div style={{ fontFamily: V2_FONTS.serif, fontSize: 18, color: V2.sage }}>{t.score}</div>
                </div>
                <div style={{ display: 'flex', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
                  {t.signals.map((s, si) => (
                    <span key={si} style={{
                      fontSize: 10, color: V2.sage, padding: '2px 8px', borderRadius: 4,
                      background: V2.sageBg, border: `1px solid ${V2.sageBd}`, fontFamily: V2_FONTS.sans,
                    }}>
                      {s}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: V2.textDim, fontFamily: V2_FONTS.sans }}>
                  {t.winCase?.headline || t.headline}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Deal table */}
        <div>
          <div style={{ fontSize: 11, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, fontWeight: 500, fontFamily: V2_FONTS.sans }}>
            Active pipeline · {allDeals.length} deals
          </div>

          <div style={{ background: V2.card, borderRadius: 10, border: `1px solid ${V2.border}`, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 0.7fr 0.6fr 0.4fr', padding: '8px 16px', borderBottom: `1px solid ${V2.ghost}` }}>
              {['Account', 'Stage', 'Prob', 'MRR', 'Gap'].map(h => (
                <span key={h} style={{ fontSize: 9, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, fontFamily: V2_FONTS.sans }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {allDeals.map((d, i) => {
              const prob = dealProb(d)
              const factors = getDealFactors(d)
              const gap = d.gap || 0

              return (
                <div
                  key={d.id || i}
                  onClick={() => selectDeal(d)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1.8fr 1fr 0.7fr 0.6fr 0.4fr',
                    alignItems: 'center', padding: '10px 16px',
                    borderBottom: i < allDeals.length - 1 ? `1px solid ${V2.ghost}22` : 'none',
                    cursor: 'pointer', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: V2.text, fontFamily: V2_FONTS.sans }}>{d.accountName || d.account}</div>
                    <div style={{ fontSize: 10, color: V2.textDim, marginTop: 1, fontFamily: V2_FONTS.sans }}>{d.product_group || d.product}</div>
                  </div>
                  <span style={{
                    fontSize: 10, color: V2.textMid, padding: '3px 8px', borderRadius: 5,
                    background: V2.elevated, border: `1px solid ${V2.ghost}`,
                    width: 'fit-content', fontFamily: V2_FONTS.sans,
                  }}>
                    {d.stage}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 30, height: 3, background: V2.ghost, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${prob}%`, height: '100%', borderRadius: 2, background: pc(prob) }} />
                    </div>
                    <ProbTooltip prob={prob} factors={factors} />
                  </div>
                  <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.textMid }}>{fmt(d.mrr)}</span>
                  <span style={{
                    fontSize: 10, fontFamily: V2_FONTS.sans,
                    color: gap > 7 ? V2.red : V2.dim,
                    fontWeight: gap > 7 ? 500 : 300,
                  }}>
                    {gap}d
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
