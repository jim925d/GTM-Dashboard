import { useState, useMemo } from 'react'
import { T } from '../lib/constants'
import Badge from '../components/shared/Badge'
import Stat from '../components/shared/Stat'
import Tip from '../components/shared/Tip'
import ProbBar from '../components/shared/ProbBar'
import { $, $k, pc } from '../components/shared/ChartTheme'

const FILTERS = [
  { id: 'deals', label: 'Active Deals', icon: '\u265F', color: T.cyan, tip: 'Accounts with open pipeline deals \u2014 sorted by total pipeline MRR' },
  { id: 'dark', label: 'Gone Dark', icon: '\u25CC', color: T.red, tip: 'Accounts with no engagement in 60+ days \u2014 highest churn risk' },
  { id: 'need', label: 'Left on Need', icon: '\u25CE', color: T.orange, tip: 'Last engagement ended on an open need or request \u2014 follow-up required' },
  { id: 'highprob', label: 'High Win Prob', icon: '\u2191', color: T.green, tip: 'Accounts where the Bayesian model predicts >60% win probability on at least one deal' },
  { id: 'onnet', label: 'On-Net', icon: '\u25CF', color: T.teal, tip: 'Accounts with on-net locations \u2014 lowest cost to serve, fastest install' },
  { id: 'offnet', label: 'Off-Net', icon: '\u25CB', color: T.yellow, tip: 'Accounts with mostly off-net locations \u2014 potential network build or partner opportunity' },
  { id: 'icb', label: 'Has ICB', icon: '\u25C6', color: T.orange, tip: 'Accounts with active deals that have an ICB (Internal Case for Business) attached \u2014 pricing approved' },
]

function scoreAccount(acc, backtestResults) {
  let score = 0
  const reasons = []

  // Active deals + pipeline MRR (up to 50)
  const dealCount = acc.active_deals?.length || 0
  const pipelineMrr = acc.pipeline_mrr || 0
  if (dealCount > 0) {
    score += 20 + Math.min(pipelineMrr / 100, 30)
    reasons.push(`${dealCount} deal${dealCount > 1 ? 's' : ''} \u00B7 ${$k(pipelineMrr)}/mo pipeline`)
  }

  // Engagement urgency — gone dark
  const eng = acc.engagement
  if (eng) {
    if (eng.lastDate) {
      const daysSince = Math.floor((Date.now() - new Date(eng.lastDate).getTime()) / 86400000)
      if (daysSince > 180) { score += 25; reasons.push(`${daysSince}d dark \u2014 critical`) }
      else if (daysSince > 90) { score += 25; reasons.push(`${daysSince}d since engagement`) }
    } else {
      score += 20; reasons.push('No engagement date recorded')
    }
  } else {
    score += 15; reasons.push('No engagement data')
  }

  // Last engagement ended on a need
  if (hasOpenNeed(acc)) {
    score += 20
    reasons.push('Last engagement left open need')
  }

  // Win probability from predictions
  const bestProb = getBestWinProb(acc, backtestResults)
  if (bestProb > 0.6) { score += 15; reasons.push(`${pc(bestProb)} win probability`) }

  // On-net locations
  const onNet = acc.locations?.filter(l => l.status === 'on-net').length || 0
  const total = acc.locations?.length || 0
  if (onNet > 0) { score += 20; reasons.push(`${onNet}/${total} on-net`) }

  // TMR weight
  if (acc.tmr > 100000) { score += 5; reasons.push(`TMR ${$k(acc.tmr)}/mo`) }

  // Risk amplifier
  if (acc.risk_score >= 50) { score += 15; reasons.push('High risk score') }

  return { score: Math.min(score, 100), reasons }
}

function getBestWinProb(acc, backtestResults) {
  if (!acc.active_deals?.length) return 0
  // Prefer engine backtest calibration if available this session
  let cal = acc.calibration || { winLR: 1 }
  if (backtestResults) {
    const best = backtestResults.B.auc >= backtestResults.A.auc ? backtestResults.B : backtestResults.A
    cal = { winLR: best.acc > 0 ? best.acc / backtestResults.overallWinRate : 1 }
  }
  const prior = Math.max(0.05, Math.min(acc.win_rate || 0.5, 0.95))
  let best = 0
  for (const d of acc.active_deals) {
    let stageLR = 1.0
    const stage = (d.stage || '').toLowerCase()
    if (stage.includes('negotiate') || stage.includes('4')) stageLR = 3.0
    else if (stage.includes('propose') || stage.includes('3')) stageLR = 1.8
    else if (stage.includes('design') || stage.includes('2')) stageLR = 1.2
    else if (stage.includes('discover') || stage.includes('1')) stageLR = 0.6
    stageLR *= (cal.winLR || 1)
    const lo = Math.log(prior / (1 - prior)) + Math.log(stageLR)
    const prob = 1 / (1 + Math.exp(-lo))
    if (prob > best) best = prob
  }
  return best
}

function hasOpenNeed(acc) {
  const eng = acc.engagement
  if (!eng?.byType) return false
  // Heuristic: last engagement type suggests unresolved need
  // If recent engagements include quote_request, demo, proposal, or support with no follow-up win
  const needTypes = ['quote_request', 'demo', 'proposal', 'rfp', 'support', 'inquiry']
  const hasNeedActivity = needTypes.some(t => (eng.byType[t] || 0) > 0)
  if (!hasNeedActivity) return false
  // Check if there's been a gap since that activity
  if (eng.lastDate) {
    const daysSince = Math.floor((Date.now() - new Date(eng.lastDate).getTime()) / 86400000)
    return daysSince > 14 // Need left open for 2+ weeks
  }
  return true
}

function getDaysSilent(acc) {
  if (!acc.engagement?.lastDate) return null
  return Math.floor((Date.now() - new Date(acc.engagement.lastDate).getTime()) / 86400000)
}

export default function Priority({ accounts, onSelect, backtestResults }) {
  const [activeFilters, setActiveFilters] = useState(new Set())

  const toggle = (id) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const scored = useMemo(() => {
    return accounts.map((acc, idx) => {
      const { score, reasons } = scoreAccount(acc, backtestResults)
      return { acc, idx, score, reasons, bestProb: getBestWinProb(acc, backtestResults), daysSilent: getDaysSilent(acc) }
    })
  }, [accounts, backtestResults])

  const filtered = useMemo(() => {
    let list = scored
    if (activeFilters.size > 0) {
      list = list.filter(({ acc, daysSilent }) => {
        for (const f of activeFilters) {
          if (f === 'deals' && !(acc.active_deals?.length > 0)) return false
          if (f === 'dark' && daysSilent !== null && daysSilent < 60) return false
          if (f === 'dark' && daysSilent === null && acc.engagement) return false
          if (f === 'need' && !hasOpenNeed(acc)) return false
          if (f === 'highprob' && getBestWinProb(acc, backtestResults) <= 0.6) return false
          if (f === 'onnet' && !(acc.locations?.some(l => l.status === 'on-net'))) return false
          if (f === 'offnet') {
            const onNet = acc.locations?.filter(l => l.status === 'on-net').length || 0
            const total = acc.locations?.length || 0
            if (total === 0 || onNet / total > 0.3) return false
          }
          if (f === 'icb' && !(acc.active_deals?.some(d => d.icb_id))) return false
        }
        return true
      })
    }
    return list.sort((a, b) => b.score - a.score)
  }, [scored, activeFilters])

  // Summary stats
  const totalPipeline = filtered.reduce((s, { acc }) => s + (acc.pipeline_mrr || 0), 0)
  const darkCount = filtered.filter(({ daysSilent }) => daysSilent === null || daysSilent > 60).length
  const highProbCount = filtered.filter(({ bestProb }) => bestProb > 0.6).length

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-4 gap-2 mb-3.5">
        <Stat label="ACCOUNTS" value={filtered.length} sub={`of ${accounts.length}`} color={T.cyan} />
        <Stat label="TOTAL PIPELINE" value={`${$k(totalPipeline)}/mo`} color={T.green} />
        <Stat label="GONE DARK" value={darkCount} color={darkCount > 0 ? T.red : T.green} />
        <Stat label="HIGH PROBABILITY" value={highProbCount} color={T.teal} />
      </div>

      {/* Filters */}
      <div className="mb-3.5">
        <div className="font-sans text-[10px] text-revos-text-dim tracking-wide mb-2">
          <Tip label="PRIORITY FILTERS">PRIORITY FILTERS</Tip>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => {
            const active = activeFilters.has(f.id)
            return (
              <Tip key={f.id} tip={f.tip}>
                <button
                  onClick={() => toggle(f.id)}
                  className="flex items-center gap-[5px] px-3 py-1.5 rounded-md cursor-pointer font-mono text-[10px] font-semibold border-none transition-all duration-150"
                  style={{
                    background: active ? `${f.color}15` : T.surface,
                    boxShadow: active ? `0 0 0 1px ${f.color}30` : 'none',
                    color: active ? f.color : T.textMid,
                  }}
                >
                  <span className="text-xs">{f.icon}</span>
                  {f.label}
                </button>
              </Tip>
            )
          })}
          {activeFilters.size > 0 && (
            <button
              onClick={() => setActiveFilters(new Set())}
              className="px-2.5 py-1.5 rounded-md cursor-pointer font-mono text-[10px] bg-transparent border border-revos-border text-revos-text-dim"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Priority list */}
      <div className="font-sans text-[10px] text-revos-text-dim tracking-wide mb-2">
        <Tip label="PRIORITY RANKING">PRIORITY RANKING</Tip> ({filtered.length})
      </div>

      {filtered.length === 0 && (
        <div className="text-center p-10 text-revos-text-dim">
          <div className="font-mono text-[11px]">No accounts match the selected filters.</div>
        </div>
      )}

      {filtered.map(({ acc, idx, score, reasons, bestProb, daysSilent }, i) => {
        const dealCount = acc.active_deals?.length || 0
        const onNet = acc.locations?.filter(l => l.status === 'on-net').length || 0
        const totalLocs = acc.locations?.length || 0
        const riskColor = acc.risk_score >= 50 ? T.red : acc.risk_score >= 30 ? T.orange : T.green

        return (
          <div
            key={acc.id || i}
            onClick={() => onSelect(idx)}
            className="grid items-center gap-3 px-3.5 py-2.5 cursor-pointer rounded-md mb-0.5 transition-[background] duration-150"
            style={{
              gridTemplateColumns: '1fr 260px',
              background: i % 2 === 0 ? T.card : 'transparent',
              borderLeft: `3px solid ${score >= 70 ? T.red : score >= 40 ? T.orange : T.green}`,
            }}
            onMouseEnter={e => e.currentTarget.style.background = T.cardHover}
            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? T.card : 'transparent'}
          >
            {/* Account info */}
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-[13px]">{acc.name}</span>
                <Tip delay={1000} tip={`Priority Score: ${score}/100 \u2014 composite of pipeline value, engagement recency, win probability, on-net presence, TMR size, and risk level.`} style={{ borderBottom: 'none' }}>
                  <span className="font-mono text-[9px] font-bold" style={{ color: score >= 70 ? T.red : score >= 40 ? T.orange : T.green }}>{score}</span>
                </Tip>
                <Tip delay={1000} tip={`Risk Level: ${acc.risk_level} \u2014 based on churn signals, engagement gaps, loss history, and pipeline health.`} style={{ borderBottom: 'none' }}>
                  <Badge color={riskColor}>{acc.risk_level?.toUpperCase()}</Badge>
                </Tip>
                {dealCount > 0 && (
                  <Tip delay={1000} tip={`${dealCount} active deal${dealCount > 1 ? 's' : ''} in pipeline totaling ${$k(acc.pipeline_mrr || 0)}/mo MRR. Click to view deal details.`} style={{ borderBottom: 'none' }}>
                    <Badge color={T.cyan}>{dealCount} DEAL{dealCount > 1 ? 'S' : ''}</Badge>
                  </Tip>
                )}
                {daysSilent !== null && daysSilent > 60 && (
                  <Tip delay={1000} tip={`Gone Dark: ${daysSilent} days since last engagement. Accounts silent for 60+ days have elevated churn risk and need immediate outreach.`} style={{ borderBottom: 'none' }}>
                    <Badge color={T.red}>{daysSilent}D DARK</Badge>
                  </Tip>
                )}
                {hasOpenNeed(acc) && (
                  <Tip delay={1000} tip="Open Need: last engagement ended with an unresolved request, quote, or demo \u2014 follow-up is required to keep the opportunity alive." style={{ borderBottom: 'none' }}>
                    <Badge color={T.orange}>OPEN NEED</Badge>
                  </Tip>
                )}
                {bestProb > 0.6 && (
                  <Tip delay={1000} tip={`High Win Probability: ${pc(bestProb)} \u2014 Bayesian model estimates strong likelihood of closing based on deal stage, historical win rates, and calibration data.`} style={{ borderBottom: 'none' }}>
                    <Badge color={T.green}>{pc(bestProb)} WIN</Badge>
                  </Tip>
                )}
              </div>
              <div className="font-mono text-[10px] text-revos-text-mid leading-relaxed">
                {reasons.slice(0, 3).join(' \u00B7 ')}
              </div>
            </div>

            {/* Metrics strip */}
            <div className="grid grid-cols-4 gap-1 text-center">
              <div>
                <div className="font-mono text-xs font-bold text-revos-cyan">{$k(acc.tmr)}</div>
                <div className="font-mono text-[7px] text-revos-text-dim">TMR</div>
              </div>
              <div>
                <div className="font-mono text-xs font-bold text-revos-green">{$k(acc.pipeline_mrr || 0)}</div>
                <div className="font-mono text-[7px] text-revos-text-dim">PIPE/MO</div>
              </div>
              <div>
                <div className="font-mono text-xs font-bold" style={{ color: bestProb > 0.6 ? T.green : bestProb > 0.3 ? T.yellow : T.textDim }}>
                  {bestProb > 0 ? pc(bestProb) : '\u2014'}
                </div>
                <div className="font-mono text-[7px] text-revos-text-dim">WIN %</div>
              </div>
              <div>
                {(() => {
                  const engColor = daysSilent === null ? T.textDim
                    : daysSilent <= 7 ? T.green
                    : daysSilent <= 25 ? T.yellow
                    : T.red
                  const engLabel = daysSilent === null ? '\u2014'
                    : daysSilent <= 7 ? `${daysSilent}d`
                    : daysSilent <= 25 ? `${daysSilent}d`
                    : `${daysSilent}d`
                  return <>
                    <div className="font-mono text-xs font-bold" style={{ color: engColor }}>{engLabel}</div>
                    <div className="font-mono text-[7px] text-revos-text-dim">LAST ENG</div>
                  </>
                })()}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
