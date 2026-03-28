import { useState, useMemo } from 'react'
import { V2, V2_FONTS, ENGINE_COLORS, STAGES, STAGE_WEIGHTS, fmt, fmtPct } from '../tokens'
import { DEMO_ACCOUNTS, DEMO_DEALS, DEMO_BACKTEST } from '../demoData'
import useDeals from '../hooks/useDeals'
import useForecast from '../hooks/useForecast'

// ─── Animations ───────────────────────────────────────────────────────────────
const styleId = 'v2-fc-anims'
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    @keyframes v2FadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .v2-fade-up { animation: v2FadeUp 0.4s ease-out both; }
  `
  document.head.appendChild(style)
}

const VIEW_TABS = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'annual', label: 'Annual' },
  { id: 'rolling', label: 'Rolling 90' },
]

const DEMO_QUOTA = 180000

// ─── Waterfall chart (pure CSS) ──────────────────────────────────────────────
function WaterfallChart({ target, committed, bestCase, upside, gap, forecast }) {
  const maxVal = Math.max(target, bestCase, forecast) || 1
  const barH = 180

  const cols = [
    { label: 'Target', value: target, color: V2.textDim, dashed: true },
    { label: 'Committed', value: committed, color: V2.teal },
    { label: 'Best Case', value: bestCase, color: V2.purple },
    { label: 'Upside', value: upside, color: V2.amber },
    { label: 'Gap', value: gap, color: V2.red, dashed: true },
    { label: 'Forecast', value: forecast, color: V2.accent },
  ]

  return (
    <div style={{ background: V2.card, border: `0.5px solid ${V2.border}`, borderRadius: V2.radius, padding: 24, marginBottom: 16 }}>
      <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', marginBottom: 20, textTransform: 'uppercase' }}>
        Forecast Waterfall
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: barH, paddingBottom: 40, position: 'relative' }}>
        {/* Target dashed line */}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          bottom: 40 + (target / maxVal) * (barH - 40),
          borderTop: `1.5px dashed ${V2.textDim}`,
          opacity: 0.4,
        }} />

        {cols.map((col, i) => {
          const h = Math.max((col.value / maxVal) * (barH - 40), 4)
          return (
            <div key={col.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              <div style={{ fontFamily: V2_FONTS.serif, fontSize: 16, color: col.color, marginBottom: 6 }}>
                {fmt(col.value)}
              </div>
              <div style={{
                width: '100%', maxWidth: 48, height: h, borderRadius: '4px 4px 0 0',
                background: col.dashed ? 'transparent' : col.color,
                border: col.dashed ? `1.5px dashed ${col.color}` : 'none',
                opacity: col.dashed ? 0.6 : 0.8,
              }} />
              <div style={{
                fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, marginTop: 8,
                textAlign: 'center', position: 'absolute', bottom: -32, letterSpacing: '0.04em',
              }}>
                {col.label.toUpperCase()}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Stage breakdown ─────────────────────────────────────────────────────────
function StageBreakdown({ deals }) {
  const [expandedStage, setExpandedStage] = useState(null)

  // Group by stage in reverse weight order (high prob first)
  const stageGroups = useMemo(() => {
    const groups = []
    const orderedStages = [...STAGES].reverse().filter(s => s !== 'Closed Won')
    for (const stage of orderedStages) {
      const stageDeals = deals.filter(d => d.stage === stage)
      if (!stageDeals.length) continue
      const rawMRR = stageDeals.reduce((s, d) => s + (d.mrr || 0), 0)
      const weight = STAGE_WEIGHTS[stage] || 0.1
      const weightedMRR = rawMRR * weight
      groups.push({ stage, deals: stageDeals, rawMRR, weightedMRR, weight, count: stageDeals.length })
    }
    return groups
  }, [deals])

  return (
    <div style={{ background: V2.card, border: `0.5px solid ${V2.border}`, borderRadius: V2.radius, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${V2.border}` }}>
        <span style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Stage-by-Stage Breakdown
        </span>
      </div>
      {stageGroups.map(g => (
        <div key={g.stage}>
          {/* Stage header row */}
          <div
            onClick={() => setExpandedStage(expandedStage === g.stage ? null : g.stage)}
            style={{
              display: 'grid', gridTemplateColumns: '2fr 0.6fr 0.8fr 1fr 1fr 40px',
              padding: '12px 20px', borderBottom: `1px solid ${V2.border}`,
              cursor: 'pointer', transition: 'background 0.12s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontFamily: V2_FONTS.mono, fontSize: 9, fontWeight: 600,
                color: V2.purple, background: V2.purpleDim, padding: '2px 8px',
                borderRadius: V2.radiusFull,
              }}>
                {fmtPct(g.weight)}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{g.stage}</span>
            </div>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: V2.textMid, alignSelf: 'center' }}>
              {g.count} deals
            </div>
            <div style={{ alignSelf: 'center' }}>
              <div style={{ width: 60, height: 4, background: V2.border, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${g.weight * 100}%`, height: '100%', background: V2.purple, borderRadius: 2 }} />
              </div>
            </div>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: V2.textMid, alignSelf: 'center' }}>
              {fmt(g.rawMRR)} raw
            </div>
            <div style={{ fontFamily: V2_FONTS.serif, fontSize: 16, color: V2.purple, alignSelf: 'center' }}>
              {fmt(g.weightedMRR)}
            </div>
            <div style={{ alignSelf: 'center', color: V2.textDim, transition: 'transform 0.2s', transform: expandedStage === g.stage ? 'rotate(180deg)' : '' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>

          {/* Expanded deal rows */}
          {expandedStage === g.stage && g.deals.map(deal => (
            <div
              key={deal.id}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 0.6fr 0.8fr 1fr 1fr 40px',
                padding: '10px 20px 10px 44px', borderBottom: `1px solid ${V2.border}`,
                background: V2.bgSubtle,
              }}
            >
              <div>
                <span style={{ fontSize: 12, color: V2.textMid }}>{deal.accountName}</span>
                <span style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, marginLeft: 8 }}>{deal.product_group}</span>
              </div>
              <div style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.textMid, alignSelf: 'center' }}>
                {fmt(deal.mrr)}
              </div>
              <div style={{ alignSelf: 'center' }}>
                <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: (deal.winProb || 0) >= 0.5 ? V2.teal : V2.amber }}>
                  {fmtPct(deal.winProb)}
                </span>
              </div>
              <div style={{ fontFamily: V2_FONTS.serif, fontSize: 14, color: V2.purple, alignSelf: 'center' }}>
                {fmt((deal.mrr || 0) * (STAGE_WEIGHTS[deal.stage] || 0.1))}
              </div>
              <div style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: (deal.gap || 0) > 20 ? V2.red : V2.textDim, alignSelf: 'center' }}>
                {deal.gap != null ? `${deal.gap}d gap` : '--'}
              </div>
              <div />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Pipeline gap model ──────────────────────────────────────────────────────
function GapModel({ gap, forecast, target }) {
  // Compute paths to close
  const avgDealSize = 12000
  const discoverCloseRate = 0.10
  const avgNewDealsWeek = 3
  const daysToClose = gap > 0 ? Math.round(gap / (avgDealSize * discoverCloseRate * avgNewDealsWeek / 7)) : 0

  return (
    <div style={{ background: V2.card, border: `0.5px solid ${V2.border}`, borderRadius: V2.radius, padding: 20, marginBottom: 16 }}>
      <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', marginBottom: 16, textTransform: 'uppercase' }}>
        Pipeline Gap Analysis
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: V2_FONTS.serif, fontSize: 36, color: V2.red }}>{fmt(gap)}</span>
        <span style={{ fontSize: 13, color: V2.textDim }}>gap to target</span>
      </div>
      <div style={{ fontSize: 13, color: V2.textMid, lineHeight: 1.6, marginBottom: 16 }}>
        Current weighted forecast of <strong style={{ color: V2.purple }}>{fmt(forecast)}</strong> is{' '}
        <strong style={{ color: V2.red }}>{fmt(gap)}</strong> short of the{' '}
        <strong>{fmt(target)}</strong> target. Multiple paths to close:
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{ background: V2.bgSubtle, borderRadius: V2.radiusSm, padding: 14 }}>
          <div style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, marginBottom: 6 }}>DISCOVER→CLOSE RATE</div>
          <div style={{ fontFamily: V2_FONTS.serif, fontSize: 20, color: V2.purple }}>{fmtPct(discoverCloseRate)}</div>
        </div>
        <div style={{ background: V2.bgSubtle, borderRadius: V2.radiusSm, padding: 14 }}>
          <div style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, marginBottom: 6 }}>AVG NEW DEALS/WK</div>
          <div style={{ fontFamily: V2_FONTS.serif, fontSize: 20, color: V2.text }}>{avgNewDealsWeek}</div>
        </div>
        <div style={{ background: V2.bgSubtle, borderRadius: V2.radiusSm, padding: 14 }}>
          <div style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, marginBottom: 6 }}>DAYS TO CLOSE AT PACE</div>
          <div style={{ fontFamily: V2_FONTS.serif, fontSize: 20, color: daysToClose > 60 ? V2.red : V2.amber }}>{daysToClose}d</div>
        </div>
      </div>
    </div>
  )
}

// ─── Backtest calibration ────────────────────────────────────────────────────
function BacktestCalibration() {
  const bt = DEMO_BACKTEST
  return (
    <div style={{ background: V2.card, border: `0.5px solid ${V2.border}`, borderRadius: V2.radius, padding: 20, marginBottom: 16 }}>
      <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', marginBottom: 16, textTransform: 'uppercase' }}>
        Backtest Calibration
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Accuracy', value: fmtPct(bt.accuracy), color: V2.teal },
          { label: 'Avg Error', value: fmtPct(bt.avgError), color: V2.amber },
          { label: 'Brier Score', value: bt.brierScore.toFixed(2), color: V2.purple },
        ].map(m => (
          <div key={m.label} style={{ flex: 1, background: V2.bgSubtle, borderRadius: V2.radiusSm, padding: 14, textAlign: 'center' }}>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, marginBottom: 6 }}>{m.label.toUpperCase()}</div>
            <div style={{ fontFamily: V2_FONTS.serif, fontSize: 22, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>
      {bt.insights.map((ins, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{
            fontFamily: V2_FONTS.mono, fontSize: 9, fontWeight: 600, color: (ENGINE_COLORS.backtest).text,
            background: (ENGINE_COLORS.backtest).bg, border: `1px solid ${(ENGINE_COLORS.backtest).border}`,
            padding: '2px 8px', borderRadius: V2.radiusFull, flexShrink: 0, marginTop: 2,
          }}>
            BACKTEST
          </div>
          <div style={{ fontSize: 12, color: V2.textMid, lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: ins.text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#F0F2F5">$1</strong>') }} />
        </div>
      ))}
    </div>
  )
}

// ─── Governance bar ──────────────────────────────────────────────────────────
function GovernanceBar({ forecast }) {
  return (
    <div style={{
      background: V2.card, border: `0.5px solid ${V2.border}`, borderRadius: V2.radius, padding: '14px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim, letterSpacing: '0.04em' }}>CURRENT</span>
        <span style={{ fontFamily: V2_FONTS.serif, fontSize: 18, color: V2.purple }}>{fmt(forecast)}</span>
      </div>
      <div style={{ width: 1, height: 24, background: V2.border }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.textDim }}>LAST APPROVED</span>
        <span style={{ fontFamily: V2_FONTS.mono, fontSize: 13, color: V2.textMid }}>{fmt(forecast * 0.95)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.teal }}>Δ +{fmt(forecast * 0.05)}</span>
      </div>
      <span style={{
        fontFamily: V2_FONTS.mono, fontSize: 9, color: V2.amber, background: V2.amberDim,
        border: `1px solid rgba(224,176,96,0.25)`, padding: '2px 10px', borderRadius: V2.radiusFull,
      }}>
        PENDING REVIEW
      </span>
      <div style={{ flex: 1 }} />
      <button style={{
        fontFamily: V2_FONTS.sans, fontSize: 12, fontWeight: 600,
        background: V2.accent, color: '#fff', border: 'none',
        padding: '7px 16px', borderRadius: V2.radiusSm, cursor: 'pointer',
      }}>
        Submit
      </button>
      <button style={{
        fontFamily: V2_FONTS.sans, fontSize: 12, color: V2.textDim,
        background: 'none', border: `1px solid ${V2.border}`,
        padding: '6px 14px', borderRadius: V2.radiusSm, cursor: 'pointer',
      }}>
        History
      </button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function V2Forecast({ accounts = [], rawData = {} }) {
  const isDemo = !accounts.length
  const accts = isDemo ? DEMO_ACCOUNTS : accounts
  const allDeals = isDemo ? DEMO_DEALS : useDeals(accts).deals
  const { forecast, commit, bestCase } = useForecast(accts, { quota: DEMO_QUOTA })
  const [view, setView] = useState('monthly')

  const target = DEMO_QUOTA
  const upside = bestCase - commit
  const gap = Math.max(0, target - forecast)

  return (
    <div>
      {/* Header + View tabs */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: V2_FONTS.serif, fontSize: 28, fontWeight: 400, marginBottom: 4 }}>Forecast</h1>
          <p style={{ fontSize: 13, color: V2.textDim }}>Revenue forecasting with confidence intervals and scenario modeling.</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {VIEW_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              style={{
                fontFamily: V2_FONTS.sans, fontSize: 12, fontWeight: view === t.id ? 600 : 400,
                color: view === t.id ? V2.text : V2.textDim,
                background: view === t.id ? V2.accentDim : 'transparent',
                border: `1px solid ${view === t.id ? V2.accentBorder : V2.border}`,
                padding: '6px 14px', borderRadius: V2.radiusFull, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="v2-fade-up" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'FORECAST TMR', value: fmt(forecast), sub: 'stage-weighted', color: V2.purple },
          { label: 'COMMIT', value: fmt(commit), sub: 'high confidence', color: V2.teal },
          { label: 'BEST CASE', value: fmt(bestCase), sub: 'upside included', color: V2.text },
          { label: 'ATTAINMENT', value: target > 0 ? `${Math.round(forecast / target * 100)}%` : '--%', sub: `vs ${fmt(target)} quota`, color: forecast >= target ? V2.teal : V2.red },
        ].map((kpi, i) => (
          <div
            key={kpi.label}
            className="v2-fade-up"
            style={{
              animationDelay: `${i * 60}ms`,
              flex: 1, background: V2.card, border: `0.5px solid ${V2.border}`,
              borderRadius: V2.radius, padding: '18px 16px',
            }}
          >
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, letterSpacing: '0.06em', marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontFamily: V2_FONTS.serif, fontSize: 28, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, marginTop: 6 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Waterfall */}
      <div className="v2-fade-up" style={{ animationDelay: '260ms' }}>
        <WaterfallChart target={target} committed={commit} bestCase={bestCase} upside={upside} gap={gap} forecast={forecast} />
      </div>

      {/* Stage breakdown */}
      <div className="v2-fade-up" style={{ animationDelay: '320ms' }}>
        <StageBreakdown deals={allDeals} />
      </div>

      {/* Gap model */}
      {gap > 0 && (
        <div className="v2-fade-up" style={{ animationDelay: '380ms' }}>
          <GapModel gap={gap} forecast={forecast} target={target} />
        </div>
      )}

      {/* Backtest */}
      <div className="v2-fade-up" style={{ animationDelay: '440ms' }}>
        <BacktestCalibration />
      </div>

      {/* Governance */}
      <div className="v2-fade-up" style={{ animationDelay: '500ms' }}>
        <GovernanceBar forecast={forecast} />
      </div>
    </div>
  )
}
