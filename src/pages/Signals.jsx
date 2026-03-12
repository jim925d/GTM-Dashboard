import { useState, useRef } from 'react'
import { T, FONT_MONO, FONT_SANS, RADIUS, CARD_SHADOW } from '../lib/constants'
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
        <div style={{ textAlign: 'center', padding: '50px 30px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, marginBottom: '16px', letterSpacing: '0.04em' }}>
            ACCOUNT STRATEGY ANALYSIS
          </div>
          <div style={{ fontSize: '13px', color: T.textMid, lineHeight: 1.7, maxWidth: '480px', margin: '0 auto 24px' }}>
            Generate AI-powered strategy recommendations based on this account's pipeline, deal history, engagement patterns, installed base, and risk signals.
          </div>
          <button
            onClick={runAnalysis}
            disabled={loading}
            style={{
              padding: '10px 28px',
              fontFamily: FONT_MONO,
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              background: loading ? T.surface : `linear-gradient(135deg, ${T.teal}, ${T.blue})`,
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: loading ? 'none' : `0 4px 16px ${T.teal}40`,
            }}
          >
            {loading ? 'ANALYZING...' : 'GENERATE ANALYSIS'}
          </button>
          {loading && (
            <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim, marginTop: '12px' }}>
              Sending account data to Claude...
            </div>
          )}
          {error && (
            <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.red, marginTop: '12px', maxWidth: '400px', margin: '12px auto 0' }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.teal, letterSpacing: '0.04em' }}>
          <Tip tip="AI-generated strategy recommendations based on account data. Click Regenerate to refresh.">ACCOUNT STRATEGY</Tip>
        </div>
        <button
          onClick={() => { cache[a.name] = null; setAnalysis(null) }}
          style={{
            padding: '4px 12px', fontFamily: FONT_MONO, fontSize: '9px',
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: '4px',
            color: T.textDim, cursor: 'pointer', letterSpacing: '0.06em',
          }}
        >
          REGENERATE
        </button>
      </div>

      {/* Strategic Assessment */}
      <div style={{ background: `linear-gradient(135deg, ${T.teal}08, ${T.blue}08)`, border: `1px solid ${T.teal}25`, borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.teal, letterSpacing: '0.04em' }}>
            <Tip tip="Overall strategic assessment synthesized from pipeline, engagement, deal history, and risk signals.">STRATEGIC ASSESSMENT</Tip>
          </div>
          <Badge color={d.health === 'growing' ? T.green : d.health === 'stable' ? T.cyan : d.health === 'at_risk' ? T.red : T.orange}>
            {(d.health || 'unknown').toUpperCase().replace('_', ' ')}
          </Badge>
        </div>
        <div style={{ fontSize: '13px', color: T.text, lineHeight: 1.7 }}>{d.summary}</div>
      </div>

      {/* Next Best Actions */}
      {d.actions?.length > 0 && (
        <>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.teal, letterSpacing: '0.04em', marginBottom: '10px' }}>
            <Tip tip="Prioritized actions derived from account data patterns. Type: expand (grow revenue), protect (retain), recover (win back), coach (improve execution).">
              NEXT BEST ACTIONS
            </Tip> ({d.actions.length})
          </div>
          {d.actions.map((act, i) => {
            const typeColor = TYPE_COLORS[act.type] || T.textDim
            const urgColor = URGENCY_COLORS[act.urgency] || T.yellow
            return (
              <div key={i} style={{
                background: T.card, boxShadow: CARD_SHADOW, borderRadius: RADIUS,
                padding: '14px', marginBottom: '10px', borderLeft: `3px solid ${typeColor}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, flex: 1, marginRight: '8px' }}>{act.title}</span>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <Badge color={typeColor}>{act.type?.toUpperCase()}</Badge>
                    <Badge color={urgColor}>{act.urgency?.replace('_', ' ').toUpperCase()}</Badge>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: T.textMid, lineHeight: 1.6 }}>{act.detail}</div>
                {act.impact_mrr > 0 && (
                  <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.green, marginTop: '6px', fontWeight: 600 }}>
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
        <div style={{ background: T.card, border: `1px solid ${T.green}18`, borderRadius: '8px', padding: '14px', marginTop: '14px', marginBottom: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.green, letterSpacing: '0.04em', marginBottom: '10px' }}>
            <Tip tip="Products this account should be buying based on their vertical, installed base, and location footprint.">
              CROSS-SELL OPPORTUNITIES
            </Tip>
          </div>
          {d.cross_sell.map((cs, i) => (
            <div key={i} style={{ padding: '8px', background: i % 2 ? T.surface : 'transparent', borderRadius: '4px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <span style={{ fontWeight: 600, fontSize: '12px' }}>{cs.product}</span>
                <Badge color={cs.confidence >= 0.7 ? T.green : cs.confidence >= 0.4 ? T.yellow : T.textDim}>
                  {pc(cs.confidence)} match
                </Badge>
              </div>
              <div style={{ fontSize: '11px', color: T.textMid, lineHeight: 1.5 }}>{cs.reason}</div>
            </div>
          ))}
        </div>
      )}

      {/* Risk Analysis */}
      {d.risks?.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.red}18`, borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.red, letterSpacing: '0.04em', marginBottom: '10px' }}>
            <Tip tip="Account-specific risks identified from engagement gaps, churn patterns, revenue concentration, and pipeline weakness.">
              RISK ANALYSIS
            </Tip>
          </div>
          {d.risks.map((r, i) => (
            <div key={i} style={{ padding: '8px', background: i % 2 ? T.surface : 'transparent', borderRadius: '4px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <span style={{ fontWeight: 600, fontSize: '12px' }}>{r.signal}</span>
                <Badge color={r.severity === 'high' ? T.red : r.severity === 'medium' ? T.orange : T.yellow}>
                  {r.severity?.toUpperCase()}
                </Badge>
              </div>
              <div style={{ fontSize: '11px', color: T.textMid, lineHeight: 1.5 }}>{r.mitigation}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
