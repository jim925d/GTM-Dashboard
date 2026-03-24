import { useState, useRef } from 'react'
import { T } from '../lib/constants'
import Badge from '../components/shared/Badge'
import Tip from '../components/shared/Tip'
import { $, pc } from '../components/shared/ChartTheme'
import { buildAnalyzePrompt } from '../lib/analyzePrompt'

const TYPE_COLORS = {
  expand: T.green,
  protect: T.yellow,
  recover: T.red,
  coach: T.purple,
}

const URGENCY_COLORS = {
  immediate: T.red,
  this_quarter: T.orange,
  next_quarter: T.yellow,
}

// Session cache — persists across tab switches but not page reloads
const cache = {}

export default function Signals({ a }) {
  const [analysis, setAnalysis] = useState(cache[a.name] || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const runAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const prompt = buildAnalyzePrompt(a)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `API error ${res.status}`)
      }
      const data = await res.json()
      cache[a.name] = data
      setAnalysis(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // No analysis yet — show generate button
  if (!analysis) {
    return (
      <div>
        <div className="text-center py-12 px-8">
          <div className="font-sans text-[10px] text-revos-text-dim mb-4 tracking-wide">
            ACCOUNT STRATEGY ANALYSIS
          </div>
          <div className="text-[13px] text-revos-text-mid leading-relaxed max-w-[480px] mx-auto mb-6">
            Generate AI-powered strategy recommendations based on this account's pipeline, deal history, engagement patterns, installed base, and risk signals.
          </div>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="px-7 py-2.5 font-mono text-xs font-bold tracking-wide border-none rounded-lg text-white"
            style={{
              background: loading ? T.surface : `linear-gradient(135deg, ${T.teal}, ${T.blue})`,
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: loading ? 'none' : `0 4px 16px ${T.teal}40`,
            }}
          >
            {loading ? 'ANALYZING...' : 'GENERATE ANALYSIS'}
          </button>
          {loading && (
            <div className="font-mono text-[10px] text-revos-text-dim mt-3">
              Sending account data to Claude...
            </div>
          )}
          {error && (
            <div className="font-mono text-[11px] text-revos-red mt-3 max-w-[400px] mx-auto">
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Render analysis results
  const d = analysis

  return (
    <div>
      {/* Header with regenerate button */}
      <div className="flex justify-between items-center mb-3.5">
        <div className="font-sans text-[10px] text-revos-teal tracking-wide">
          <Tip tip="AI-generated strategy recommendations based on account data. Click Regenerate to refresh.">ACCOUNT STRATEGY</Tip>
        </div>
        <button
          onClick={() => { cache[a.name] = null; setAnalysis(null) }}
          className="px-3 py-1 font-mono text-[9px] bg-revos-surface border border-revos-border rounded text-revos-text-dim cursor-pointer tracking-wide"
        >
          REGENERATE
        </button>
      </div>

      {/* Strategic Assessment */}
      <div className="rounded-[10px] p-4 mb-4" style={{ background: `linear-gradient(135deg, ${T.teal}08, ${T.blue}08)`, border: `1px solid ${T.teal}25` }}>
        <div className="flex justify-between items-center mb-2">
          <div className="font-sans text-[10px] text-revos-teal tracking-wide">
            <Tip tip="Overall strategic assessment synthesized from pipeline, engagement, deal history, and risk signals.">STRATEGIC ASSESSMENT</Tip>
          </div>
          <Badge color={d.health === 'growing' ? T.green : d.health === 'stable' ? T.cyan : d.health === 'at_risk' ? T.red : T.orange}>
            {(d.health || 'unknown').toUpperCase().replace('_', ' ')}
          </Badge>
        </div>
        <div className="text-[13px] text-revos-text leading-relaxed">{d.summary}</div>
      </div>

      {/* Next Best Actions */}
      {d.actions?.length > 0 && (
        <>
          <div className="font-sans text-[10px] text-revos-teal tracking-wide mb-2.5">
            <Tip tip="Prioritized actions derived from account data patterns. Type: expand (grow revenue), protect (retain), recover (win back), coach (improve execution).">
              NEXT BEST ACTIONS
            </Tip> ({d.actions.length})
          </div>
          {d.actions.map((act, i) => {
            const typeColor = TYPE_COLORS[act.type] || T.textDim
            const urgColor = URGENCY_COLORS[act.urgency] || T.yellow
            return (
              <div key={i} className="bg-revos-card shadow-card rounded-xl p-3.5 mb-2.5" style={{ borderLeft: `3px solid ${typeColor}` }}>
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-[13px] font-semibold flex-1 mr-2">{act.title}</span>
                  <div className="flex gap-1 shrink-0">
                    <Badge color={typeColor}>{act.type?.toUpperCase()}</Badge>
                    <Badge color={urgColor}>{act.urgency?.replace('_', ' ').toUpperCase()}</Badge>
                  </div>
                </div>
                <div className="text-xs text-revos-text-mid leading-relaxed">{act.detail}</div>
                {act.impact_mrr > 0 && (
                  <div className="font-mono text-[10px] text-revos-green mt-1.5 font-semibold">
                    +${(act.impact_mrr).toLocaleString()}/mo potential
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* Cross-Sell Opportunities */}
      {d.cross_sell?.length > 0 && (
        <div className="bg-revos-card rounded-lg p-3.5 mt-3.5 mb-3.5" style={{ border: `1px solid ${T.green}18` }}>
          <div className="font-sans text-[10px] text-revos-green tracking-wide mb-2.5">
            <Tip tip="Products this account should be buying based on their vertical, installed base, and location footprint.">
              CROSS-SELL OPPORTUNITIES
            </Tip>
          </div>
          {d.cross_sell.map((cs, i) => (
            <div key={i} className="p-2 rounded mb-1" style={{ background: i % 2 ? T.surface : 'transparent' }}>
              <div className="flex justify-between items-center mb-0.5">
                <span className="font-semibold text-xs">{cs.product}</span>
                <Badge color={cs.confidence >= 0.7 ? T.green : cs.confidence >= 0.4 ? T.yellow : T.textDim}>
                  {pc(cs.confidence)} match
                </Badge>
              </div>
              <div className="text-[11px] text-revos-text-mid leading-normal">{cs.reason}</div>
            </div>
          ))}
        </div>
      )}

      {/* Risk Analysis */}
      {d.risks?.length > 0 && (
        <div className="bg-revos-card rounded-lg p-3.5" style={{ border: `1px solid ${T.red}18` }}>
          <div className="font-sans text-[10px] text-revos-red tracking-wide mb-2.5">
            <Tip tip="Account-specific risks identified from engagement gaps, churn patterns, revenue concentration, and pipeline weakness.">
              RISK ANALYSIS
            </Tip>
          </div>
          {d.risks.map((r, i) => (
            <div key={i} className="p-2 rounded mb-1" style={{ background: i % 2 ? T.surface : 'transparent' }}>
              <div className="flex justify-between items-center mb-0.5">
                <span className="font-semibold text-xs">{r.signal}</span>
                <Badge color={r.severity === 'high' ? T.red : r.severity === 'medium' ? T.orange : T.yellow}>
                  {r.severity?.toUpperCase()}
                </Badge>
              </div>
              <div className="text-[11px] text-revos-text-mid leading-normal">{r.mitigation}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
