import { useState, useMemo } from 'react'
import { T, FONT_MONO, FONT_SANS, RADIUS, CARD_SHADOW } from '../lib/constants'
import Badge from '../components/shared/Badge'
import Stat from '../components/shared/Stat'
import Tip from '../components/shared/Tip'
import ProbBar from '../components/shared/ProbBar'
import { $, $k, pc } from '../components/shared/ChartTheme'

const FILTERS = [
  { id: 'deals', label: 'Active Deals', icon: '♟', color: T.cyan, tip: 'Accounts with open pipeline deals — sorted by total pipeline MRR' },
  { id: 'dark', label: 'Gone Dark', icon: '◌', color: T.red, tip: 'Accounts with no engagement in 60+ days — highest churn risk' },
  { id: 'need', label: 'Left on Need', icon: '◎', color: T.orange, tip: 'Last engagement ended on an open need or request — follow-up required' },
  { id: 'highprob', label: 'High Win Prob', icon: '↑', color: T.green, tip: 'Accounts where the Bayesian model predicts >60% win probability on at least one deal' },
  { id: 'onnet', label: 'On-Net', icon: '●', color: T.teal, tip: 'Accounts with on-net locations — lowest cost to serve, fastest install' },
  { id: 'offnet', label: 'Off-Net', icon: '○', color: T.yellow, tip: 'Accounts with mostly off-net locations — potential network build or partner opportunity' },
  { id: 'icb', label: 'Has ICB', icon: '◆', color: T.orange, tip: 'Accounts with active deals that have an ICB (Internal Case for Business) attached — pricing approved' },
]

function scoreAccount(acc) {
  let score = 0
  const reasons = []

  // Active deals boost
  const dealCount = acc.active_deals?.length || 0
  const pipelineMrr = acc.pipeline_mrr || 0
  if (dealCount > 0) {
    score += 20 + Math.min(pipelineMrr / 100, 30)
    reasons.push(`${dealCount} deal${dealCount > 1 ? 's' : ''} · ${$k(pipelineMrr)}/mo pipeline`)
  }

  // Engagement urgency
  const eng = acc.engagement
  if (eng) {
    if (eng.lastDate) {
      const daysSince = Math.floor((Date.now() - new Date(eng.lastDate).getTime()) / 86400000)
      if (daysSince > 180) { score += 35; reasons.push(`${daysSince}d dark — critical`) }
      else if (daysSince > 90) { score += 25; reasons.push(`${daysSince}d since engagement`) }
      else if (daysSince > 60) { score += 15; reasons.push(`${daysSince}d since engagement`) }
    } else {
      score += 20; reasons.push('No engagement date recorded')
    }
    if (eng.contacts <= 1) { score += 8; reasons.push('Single-threaded') }
  } else {
    score += 15; reasons.push('No engagement data')
  }

  // Last engagement ended on a need
  if (hasOpenNeed(acc)) {
    score += 20
    reasons.push('Last engagement left open need')
  }

  // Win probability from predictions
  const bestProb = getBestWinProb(acc)
  if (bestProb > 0.6) { score += 15; reasons.push(`${pc(bestProb)} win probability`) }
  else if (bestProb > 0.4) { score += 8; reasons.push(`${pc(bestProb)} win probability`) }

  // On-net locations (opportunity)
  const onNet = acc.locations?.filter(l => l.status === 'on-net').length || 0
  const total = acc.locations?.length || 0
  if (onNet > 0) { score += 5; reasons.push(`${onNet}/${total} on-net`) }

  // ARR weight — bigger accounts matter more
  if (acc.arr > 100000) score += 10
  else if (acc.arr > 50000) score += 5

  // Risk amplifier
  if (acc.risk_score >= 50) score += 15
  else if (acc.risk_score >= 30) score += 8

  return { score: Math.min(score, 100), reasons }
}

function getBestWinProb(acc) {
  if (!acc.active_deals?.length) return 0
  const cal = acc.calibration || { winLR: 1 }
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

export default function Priority({ accounts, onSelect }) {
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
      const { score, reasons } = scoreAccount(acc)
      return { acc, idx, score, reasons, bestProb: getBestWinProb(acc), daysSilent: getDaysSilent(acc) }
    })
  }, [accounts])

  const filtered = useMemo(() => {
    let list = scored
    if (activeFilters.size > 0) {
      list = list.filter(({ acc, daysSilent }) => {
        for (const f of activeFilters) {
          if (f === 'deals' && !(acc.active_deals?.length > 0)) return false
          if (f === 'dark' && daysSilent !== null && daysSilent < 60) return false
          if (f === 'dark' && daysSilent === null && acc.engagement) return false
          if (f === 'need' && !hasOpenNeed(acc)) return false
          if (f === 'highprob' && getBestWinProb(acc) <= 0.6) return false
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
        <Stat label="ACCOUNTS" value={filtered.length} sub={`of ${accounts.length}`} color={T.cyan} />
        <Stat label="TOTAL PIPELINE" value={`${$k(totalPipeline)}/mo`} color={T.green} />
        <Stat label="GONE DARK" value={darkCount} color={darkCount > 0 ? T.red : T.green} />
        <Stat label="HIGH PROBABILITY" value={highProbCount} color={T.teal} />
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '8px' }}>
          <Tip label="PRIORITY FILTERS">PRIORITY FILTERS</Tip>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const active = activeFilters.has(f.id)
            return (
              <Tip key={f.id} tip={f.tip}>
                <button
                  onClick={() => toggle(f.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
                    fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600,
                    background: active ? `${f.color}15` : T.surface,
                    border: 'none',
                    boxShadow: active ? `0 0 0 1px ${f.color}30` : 'none',
                    color: active ? f.color : T.textMid,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: '12px' }}>{f.icon}</span>
                  {f.label}
                </button>
              </Tip>
            )
          })}
          {activeFilters.size > 0 && (
            <button
              onClick={() => setActiveFilters(new Set())}
              style={{
                padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
                fontFamily: FONT_MONO, fontSize: '10px',
                background: 'transparent', border: `1px solid ${T.border}`,
                color: T.textDim,
              }}
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Priority list */}
      <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '8px' }}>
        <Tip label="PRIORITY RANKING">PRIORITY RANKING</Tip> ({filtered.length})
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: T.textDim }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '11px' }}>No accounts match the selected filters.</div>
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
            style={{
              display: 'grid', gridTemplateColumns: '1fr 260px',
              alignItems: 'center', gap: '12px',
              padding: '10px 14px', cursor: 'pointer',
              background: i % 2 === 0 ? T.card : 'transparent',
              borderRadius: '6px',
              borderLeft: `3px solid ${score >= 70 ? T.red : score >= 40 ? T.orange : T.green}`,
              marginBottom: '2px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = T.cardHover}
            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? T.card : 'transparent'}
          >
            {/* Account info */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{acc.name}</span>
                <Tip delay={1000} tip={`Priority Score: ${score}/100 — composite of pipeline value, engagement recency, win probability, on-net presence, ARR size, and risk level.`} style={{ borderBottom: 'none' }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '9px', fontWeight: 700, color: score >= 70 ? T.red : score >= 40 ? T.orange : T.green }}>{score}</span>
                </Tip>
                <Tip delay={1000} tip={`Risk Level: ${acc.risk_level} — based on churn signals, engagement gaps, loss history, and pipeline health.`} style={{ borderBottom: 'none' }}>
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
                  <Tip delay={1000} tip="Open Need: last engagement ended with an unresolved request, quote, or demo — follow-up is required to keep the opportunity alive." style={{ borderBottom: 'none' }}>
                    <Badge color={T.orange}>OPEN NEED</Badge>
                  </Tip>
                )}
                {bestProb > 0.6 && (
                  <Tip delay={1000} tip={`High Win Probability: ${pc(bestProb)} — Bayesian model estimates strong likelihood of closing based on deal stage, historical win rates, and calibration data.`} style={{ borderBottom: 'none' }}>
                    <Badge color={T.green}>{pc(bestProb)} WIN</Badge>
                  </Tip>
                )}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textMid, lineHeight: 1.6 }}>
                {reasons.slice(0, 3).join(' · ')}
              </div>
            </div>

            {/* Metrics strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'center' }}>
              <div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 700, color: T.cyan }}>{$k(acc.arr)}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '7px', color: T.textDim }}>ARR</div>
              </div>
              <div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 700, color: T.green }}>{$k(acc.pipeline_mrr || 0)}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '7px', color: T.textDim }}>PIPE/MO</div>
              </div>
              <div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 700, color: bestProb > 0.6 ? T.green : bestProb > 0.3 ? T.yellow : T.textDim }}>
                  {bestProb > 0 ? pc(bestProb) : '—'}
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '7px', color: T.textDim }}>WIN %</div>
              </div>
              <div>
                {(() => {
                  const engColor = daysSilent === null ? T.textDim
                    : daysSilent <= 7 ? T.green
                    : daysSilent <= 25 ? T.yellow
                    : T.red
                  const engLabel = daysSilent === null ? '—'
                    : daysSilent <= 7 ? `${daysSilent}d`
                    : daysSilent <= 25 ? `${daysSilent}d`
                    : `${daysSilent}d`
                  return <>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 700, color: engColor }}>{engLabel}</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '7px', color: T.textDim }}>LAST ENG</div>
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
