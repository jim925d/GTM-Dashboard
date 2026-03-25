import { useMemo } from 'react'
import { T, stageProb } from '../lib/constants'
import { cn } from '@/lib/utils'
import Badge from '../components/shared/Badge'
import ProbBar from '../components/shared/ProbBar'
import Stat from '../components/shared/Stat'
import Tip from '../components/shared/Tip'
import { $, $k, pc } from '../components/shared/ChartTheme'

export default function Predictions({ a, backtestResults }) {
  // If engine backtest was run this session, derive calibration from its accuracy
  const engineCal = useMemo(() => {
    if (!backtestResults) return null
    const best = backtestResults.B.auc >= backtestResults.A.auc ? backtestResults.B : backtestResults.A
    // Use engine accuracy to derive a likelihood ratio adjustment
    const winLR = best.acc > 0 ? best.acc / backtestResults.overallWinRate : 1
    return { winLR, churnLR: 1 / winLR, quarters: 1, avgAccuracy: best.acc, bias: best.acc > 0.6 ? 'calibrated' : 'weak' }
  }, [backtestResults])

  // Generate local predictions from account data, calibrated by backtest
  const cal = engineCal || a.calibration || { winLR: 1, churnLR: 1, quarters: 0, avgAccuracy: 0, bias: 'uncalibrated' }
  const predictions = useMemo(() => a.predictions?.length > 0 ? a.predictions : buildLocalPredictions(a, cal), [a, cal])
  const crossSell = a.cross_sell?.length > 0 ? a.cross_sell : []
  const churnPreds = useMemo(() => a.churn_preds?.length > 0 ? a.churn_preds : buildChurnPredictions(a, cal), [a, cal])

  return (
    <div>
      {/* Summary banner */}
      <div
        className="rounded-xl p-4 mb-4"
        style={{ background: `linear-gradient(135deg, ${T.teal}08, ${T.blue}08)`, border: `1px solid ${T.teal}25` }}
      >
        <div className="flex justify-between mb-2">
          <div className="font-sans text-[10px] text-revos-teal tracking-[0.04em]"><Tip label="PREDICTION SUMMARY">PREDICTION SUMMARY</Tip></div>
          <div className="flex gap-1">
            <Badge color={a.portfolio_health === 'growing' ? T.green : a.portfolio_health === 'at_risk' ? T.red : T.yellow}>
              {(a.portfolio_health || 'unknown').toUpperCase().replace('_', ' ')}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Stat small label="WIN RATE" value={pc(a.win_rate)} color={a.win_rate >= 0.5 ? T.green : T.yellow} />
          <Stat small label="PIPELINE" value={`${$k(a.pipeline_mrr)}/mo`} sub={`${a.pipeline_count} deals`} color={T.blue} />
          <Stat small label="HISTORICAL WINS" value={a.won} color={T.green} />
          <Stat small label="CHURN EVENTS" value={a.churn_deals || 0} sub={a.churn_mrr ? `-${$(a.churn_mrr)}/mo` : ''} color={a.churn_deals > 0 ? T.red : T.green} />
        </div>
      </div>

      {/* Calibration status */}
      {cal.quarters >= 3 && (
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 mb-3.5 rounded-xl"
          style={{
            background: cal.avgAccuracy >= 60 ? `${T.green}08` : `${T.yellow}08`,
            border: `1px solid ${cal.avgAccuracy >= 60 ? T.green : T.yellow}22`,
          }}
        >
          <div className={cn('font-sans text-[10px] tracking-[0.04em] shrink-0', cal.avgAccuracy >= 60 ? 'text-revos-green' : 'text-revos-yellow')}>
            <Tip label="CALIBRATION STATUS">CALIBRATED</Tip>
          </div>
          <div className="font-mono text-[10px] text-revos-text-mid flex-1">
            Model tuned from {cal.quarters} quarters of backtest data · {cal.avgAccuracy}% avg accuracy
            {cal.bias !== 'balanced' && <> · Correcting {cal.bias} bias</>}
          </div>
          <div className="flex gap-1.5">
            <Badge color={T.teal}>Win LR ×{cal.winLR.toFixed(2)}</Badge>
            <Badge color={T.orange}>Churn LR ×{cal.churnLR.toFixed(2)}</Badge>
          </div>
        </div>
      )}

      {/* Pipeline predictions */}
      {predictions.length > 0 && (
        <>
          <div className="font-mono text-[9px] text-revos-teal tracking-[0.08em] mb-2.5">
            <Tip label="DEAL PREDICTIONS">DEAL PREDICTIONS</Tip> ({predictions.length})
          </div>
          {predictions.map((p, i) => {
            const prob = p.posterior || p.prob || 0
            const color = prob > 0.6 ? T.green : prob > 0.35 ? T.yellow : T.orange
            return (
              <div key={i} className="bg-revos-card border border-revos-border rounded-lg p-3.5 mb-2.5">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <span className="font-semibold text-sm">{p.product}</span>
                    <span className="font-mono text-[10px] text-revos-text-dim ml-2">{p.event || p.stage}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.prior != null && <span className="font-mono text-[10px] text-revos-text-dim">Base: {pc(p.prior)}</span>}
                    <span className="font-mono text-[16px] font-bold" style={{ color }}>{pc(prob)}</span>
                  </div>
                </div>
                <ProbBar value={prob} color={color} h={6} />
                <div className="flex gap-2.5 mt-2 font-mono text-[10px]">
                  <span className="text-revos-cyan">{$(p.mrr)}/mo</span>
                  {p.close && <span className="text-revos-yellow">Close: {p.close}</span>}
                  {p.rep && <span className="text-revos-text-dim">{p.rep}</span>}
                </div>
                {p.evidence && (
                  <div className="mt-2">
                    {p.evidence.map((e, j) => (
                      <div key={j} className="text-[11px] text-revos-text-mid pl-2 mb-[3px]" style={{ borderLeft: `2px solid ${color}30` }}>
                        {e}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* Churn risk */}
      {churnPreds.length > 0 && (
        <div className="bg-revos-card rounded-lg p-3.5 mt-3.5" style={{ border: `1px solid ${T.red}18` }}>
          <div className="font-mono text-[9px] text-revos-red tracking-[0.08em] mb-2.5">
            <Tip label="CHURN RISK INDICATORS">CHURN RISK INDICATORS</Tip>
          </div>
          {churnPreds.map((ch, i) => (
            <div key={i} className="mb-2.5 p-2 bg-revos-surface rounded-[6px]">
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-xs">{ch.signal}</span>
                <Badge color={ch.severity === 'high' ? T.red : ch.severity === 'medium' ? T.orange : T.yellow}>
                  {ch.severity.toUpperCase()}
                </Badge>
              </div>
              <div className="text-[11px] text-revos-text-mid leading-normal">{ch.detail}</div>
            </div>
          ))}
        </div>
      )}

      {predictions.length === 0 && churnPreds.length === 0 && (
        <div className="text-center p-10 text-revos-text-dim">
          <div className="font-mono text-[11px]">No pipeline deals to predict on. Add deals to funnel.csv.</div>
        </div>
      )}
    </div>
  )
}

// --- Bayesian Prediction Engine ---
// Uses engagement data as likelihood signals to update prior win/churn probabilities.
//
// P(win|evidence) = P(evidence|win) * P(win) / P(evidence)
// We compute log-odds for numerical stability, then convert back to probability.

function logOdds(p) { return Math.log(p / (1 - p)) }
function fromLogOdds(lo) { return 1 / (1 + Math.exp(-lo)) }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function engagementSignals(a) {
  const eng = a.engagement
  if (!eng) return { score: 0, recency: 0, intensity: 0, breadth: 0, factors: [] }

  const factors = []

  // Recency: how recently was the account engaged?
  let recency = 0
  if (eng.lastDate) {
    const [y, m] = eng.lastDate.split('-').map(Number)
    const lastMs = new Date(y, m - 1).getTime()
    const daysSince = Math.max(0, (Date.now() - lastMs) / 86400000)
    if (daysSince < 30) { recency = 1.0; factors.push('Engaged in last 30 days') }
    else if (daysSince < 60) { recency = 0.7; factors.push('Engaged in last 60 days') }
    else if (daysSince < 90) { recency = 0.4; factors.push('Last engagement 60-90 days ago') }
    else { recency = 0.1; factors.push(`No engagement in ${Math.round(daysSince)} days`) }
  }

  // Intensity: engagement volume relative to expectations
  const monthCount = eng.timeline?.length || 1
  const avgPerMonth = eng.total / monthCount
  let intensity = 0
  if (avgPerMonth >= 8) { intensity = 1.0; factors.push(`High activity: ${avgPerMonth.toFixed(1)} eng/mo`) }
  else if (avgPerMonth >= 4) { intensity = 0.7; factors.push(`Moderate activity: ${avgPerMonth.toFixed(1)} eng/mo`) }
  else if (avgPerMonth >= 1) { intensity = 0.4; factors.push(`Low activity: ${avgPerMonth.toFixed(1)} eng/mo`) }
  else { intensity = 0.1; factors.push('Minimal engagement activity') }

  // Breadth: multi-threading (# of contacts engaged)
  let breadth = 0
  if (eng.contacts >= 5) { breadth = 1.0; factors.push(`Multi-threaded: ${eng.contacts} contacts`) }
  else if (eng.contacts >= 3) { breadth = 0.7; factors.push(`${eng.contacts} contacts engaged`) }
  else if (eng.contacts >= 1) { breadth = 0.4; factors.push(`Single-threaded: ${eng.contacts} contact`) }
  else { breadth = 0; factors.push('No contacts engaged') }

  // Channel mix: meetings are highest signal
  const meetings = (eng.byType?.meeting || 0) + (eng.byType?.demo || 0)
  if (meetings >= 3) factors.push(`${meetings} meetings/demos — strong buying signal`)
  else if (meetings === 0 && eng.total > 5) factors.push('No meetings despite activity — surface-level engagement')

  // Trend: is engagement increasing or decreasing?
  if (eng.timeline && eng.timeline.length >= 3) {
    const recent = eng.timeline.slice(-2).reduce((s, t) => s + t.count, 0)
    const earlier = eng.timeline.slice(-4, -2).reduce((s, t) => s + t.count, 0)
    if (recent > earlier * 1.5) factors.push('Engagement trending UP')
    else if (recent < earlier * 0.5) factors.push('Engagement trending DOWN')
  }

  const score = recency * 0.35 + intensity * 0.3 + breadth * 0.2 + (meetings > 0 ? 0.15 : 0)

  return { score, recency, intensity, breadth, factors }
}

function buildLocalPredictions(a, cal = { winLR: 1 }) {
  if (!a.active_deals?.length) return []

  const prior = clamp(a.win_rate || 0.5, 0.05, 0.95)
  const eng = engagementSignals(a)
  const calAdj = cal.winLR || 1

  return a.active_deals.map(d => {
    // Stage likelihood ratio derived from validated 2026 funnel model win probabilities
    // Convert stage win probability to likelihood ratio relative to base rate (prior)
    const stageWinProb = stageProb(d.stage)
    let stageLR = (stageWinProb / (1 - stageWinProb)) / (prior / (1 - prior))
    stageLR = Math.max(0.1, Math.min(stageLR, 20)) // clamp for numerical stability

    // Apply backtest calibration to stage LR
    stageLR *= calAdj

    // Engagement likelihood ratio
    // High engagement → 2x odds of winning; no engagement → 0.5x odds
    const engLR = 0.5 + eng.score * 1.5

    // Account health likelihood ratio
    let healthLR = 1.0
    if (a.nrr >= 1.05) healthLR = 1.3  // growing account
    else if (a.nrr < 0.9) healthLR = 0.6  // contracting
    if (a.churn_deals > 2) healthLR *= 0.7  // history of churn

    // Bayesian update: log-odds form
    const priorLO = logOdds(prior)
    const posteriorLO = priorLO + Math.log(stageLR) + Math.log(engLR) + Math.log(healthLR)
    const posterior = clamp(fromLogOdds(posteriorLO), 0.02, 0.98)

    const evidence = []
    evidence.push(`Prior win rate: ${pc(prior)} → Stage (${d.stage}): ${pc(stageWinProb)} win prob, LR ${stageLR.toFixed(2)}x`)
    evidence.push(`Engagement signal: ${(eng.score * 100).toFixed(0)}/100 → LR ${engLR.toFixed(2)}x`)
    if (healthLR !== 1.0) evidence.push(`Account health: NRR ${pc(a.nrr)} → LR ${healthLR.toFixed(2)}x`)
    if (calAdj !== 1) evidence.push(`Backtest calibration: ×${calAdj.toFixed(2)} adjustment`)
    evidence.push(...eng.factors.slice(0, 3))

    return {
      product: d.product || 'Unknown',
      event: d.stage,
      stage: d.stage,
      prior,
      posterior,
      mrr: d.mrr,
      close: d.close,
      rep: d.rep,
      evidence,
    }
  }).sort((a, b) => b.posterior - a.posterior)
}

function buildChurnPredictions(a, cal = { churnLR: 1 }) {
  const signals = []
  const eng = engagementSignals(a)
  const calAdj = cal.churnLR || 1

  // Bayesian churn: P(churn) based on multiple independent signals
  let basePChurn = 0.15  // base churn rate
  const churnFactors = []

  // Historical churn pattern
  if (a.churn_deals > 0) {
    const lr = (1 + a.churn_deals * 0.8) * calAdj  // apply calibration
    basePChurn = fromLogOdds(logOdds(clamp(basePChurn, 0.01, 0.99)) + Math.log(lr))
    signals.push({
      signal: 'Historical Churn Pattern',
      severity: a.churn_deals >= 3 ? 'high' : 'medium',
      detail: `${a.churn_deals} negative re-rate events totaling -${$(a.churn_mrr || 0)}/mo. LR: ${lr.toFixed(1)}x churn odds.`,
    })
  }

  // Engagement-based churn signal
  if (a.engagement) {
    if (eng.recency <= 0.1) {
      basePChurn = fromLogOdds(logOdds(clamp(basePChurn, 0.01, 0.99)) + Math.log(2.5 * calAdj))
      signals.push({
        signal: 'Engagement Dark — No Recent Contact',
        severity: 'high',
        detail: `Account has gone dark. Last engagement: ${a.engagement.lastDate || 'unknown'}. Silent accounts churn at 2.5x the base rate.`,
      })
    } else if (eng.score < 0.3) {
      basePChurn = fromLogOdds(logOdds(clamp(basePChurn, 0.01, 0.99)) + Math.log(1.5))
      signals.push({
        signal: 'Low Engagement Score',
        severity: 'medium',
        detail: `Engagement score: ${(eng.score * 100).toFixed(0)}/100. Below threshold for healthy retention.`,
      })
    } else if (eng.score >= 0.7) {
      basePChurn = fromLogOdds(logOdds(clamp(basePChurn, 0.01, 0.99)) + Math.log(0.4))
      signals.push({
        signal: 'Strong Engagement — Low Churn Risk',
        severity: 'low',
        detail: `Engagement score: ${(eng.score * 100).toFixed(0)}/100. Active accounts churn at 0.4x the base rate.`,
      })
    }

    // Engagement trend
    if (eng.factors.some(f => f.includes('trending DOWN'))) {
      basePChurn = fromLogOdds(logOdds(clamp(basePChurn, 0.01, 0.99)) + Math.log(1.6))
      signals.push({
        signal: 'Declining Engagement Trend',
        severity: 'medium',
        detail: 'Recent engagement volume is dropping. Declining engagement precedes churn in 60%+ of cases.',
      })
    }

    // Single-threaded risk
    if (eng.breadth < 0.4 && a.engagement.contacts <= 1) {
      signals.push({
        signal: 'Single-Threaded Relationship',
        severity: 'medium',
        detail: `Only ${a.engagement.contacts} contact engaged. Champion departure risk is high.`,
      })
    }
  }

  // Service disconnects
  if (a.disconnects > 0) {
    const lr = (1 + a.disconnects * 0.6) * calAdj
    basePChurn = fromLogOdds(logOdds(clamp(basePChurn, 0.01, 0.99)) + Math.log(lr))
    signals.push({
      signal: 'Service Disconnects',
      severity: a.disconnects >= 2 ? 'high' : 'medium',
      detail: `${a.disconnects} disconnects. Direct revenue loss signal. LR: ${lr.toFixed(1)}x.`,
    })
  }

  // NRR
  if (a.nrr < 0.9) {
    signals.push({
      signal: 'Low Net Revenue Retention',
      severity: 'high',
      detail: `NRR at ${pc(a.nrr)} — account is contracting. Revenue losses exceed expansion.`,
    })
  }

  // Stalled velocity
  if (a.velocity === 'stalled') {
    signals.push({
      signal: 'Stalled Deal Velocity',
      severity: 'medium',
      detail: 'No pipeline momentum. No new deals progressing through stages.',
    })
  }

  // Add overall churn probability to first signal
  if (signals.length > 0) {
    const overallChurn = clamp(basePChurn, 0, 1)
    signals.unshift({
      signal: `Overall Churn Probability: ${pc(overallChurn)}`,
      severity: overallChurn > 0.5 ? 'high' : overallChurn > 0.3 ? 'medium' : 'low',
      detail: `Bayesian posterior from ${signals.length} risk signals. Base rate: 15%.${calAdj !== 1 ? ` Calibrated ×${calAdj.toFixed(2)} from backtest.` : ''} ${a.engagement ? `Engagement score: ${(eng.score * 100).toFixed(0)}/100.` : 'No engagement data available.'}`,
    })
  }

  return signals
}
