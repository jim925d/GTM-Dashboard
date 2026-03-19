import { useState, useEffect } from 'react'
import { T, FONT_MONO, FONT_SANS, RADIUS, CARD_SHADOW } from '../lib/constants'

// ── Math helpers ───────────────────────────────────────────────
const sigmoid = x => 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))))
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0)
const predict = (x, model) => sigmoid(dot(model.weights, x) + model.bias)

function extractFeatures(deal, stats) {
  const ov = stats.overall
  const vwr = stats.vwr[deal.vertical] ?? ov
  const pwr = stats.pwr[deal.product] ?? ov
  const szp = stats.valsSorted.length ? stats.valsSorted.findIndex(v => v >= deal.dealValue) / stats.valsSorted.length : 0.5
  const dn = deal.daysOpen != null ? Math.max(0, Math.min(1, 1 - (deal.daysOpen - stats.daysMean) / (stats.daysStd * 3 + 1))) : 0.5
  const cwr = stats.comboR[`${deal.vertical}|${deal.product}`] ?? ov
  return [vwr, pwr, szp < 0 ? 1 : szp, dn, cwr]
}

// ── Demo fallback model ────────────────────────────────────────
const DEMO_MODEL = {
  generatedAt: '2026-03-18T00:00:00Z', source: 'demo',
  stats: {
    overall: 0.52,
    vwr: { 'Enterprise Telco': 0.68, 'Regional ISP': 0.54, 'Cable MSO': 0.61, 'Neutral Host': 0.44 },
    pwr: { 'Metro Ethernet': 0.71, DIA: 0.58, 'SD-WAN': 0.63, MPLS: 0.49 },
    comboR: { 'Enterprise Telco|Metro Ethernet': 0.79, 'Regional ISP|DIA': 0.55, 'Cable MSO|SD-WAN': 0.66, 'Neutral Host|MPLS': 0.38 },
    valsSorted: [2000, 4000, 6000, 8000, 10000, 12000, 15000, 20000], daysMean: 28, daysStd: 14,
  },
  vertModels: {
    'Enterprise Telco': { weights: [1.2, 0.9, -0.3, 0.4, 1.1], bias: -0.5 },
    'Regional ISP': { weights: [0.8, 1.1, -0.2, 0.3, 0.7], bias: -0.3 },
  },
  globalModel: { weights: [0.9, 0.8, -0.25, 0.35, 0.85], bias: -0.35 },
  churnModel: { weights: [1.1, 0.9, -0.3, 0.4, 0.8], bias: -0.4 },
}

// ── Scoring functions ──────────────────────────────────────────
const scoreWinProb = (deal, md) => Math.round(predict(extractFeatures(deal, md.stats), md.vertModels[deal.vertical] || md.globalModel) * 100)
const scoreChurnRisk = (deal, md) => {
  const s = md.stats
  const mtmNorm = Math.min(1, (deal.mtmDays || 0) / 90)
  const touchNorm = deal.daysSinceContact != null ? Math.min(1, deal.daysSinceContact / 60) : 0.5
  const szp = s.valsSorted.length ? s.valsSorted.findIndex(v => v >= (deal.dealValue || 0)) / s.valsSorted.length : 0.5
  const vcr = 1 - (s.vwr[deal.vertical] ?? s.overall)
  return Math.round(predict([mtmNorm, touchNorm, szp < 0 ? 1 : szp, vcr, 0.5], md.churnModel) * 100)
}

const buildWinBreakdown = (deal, md) => {
  const s = md.stats
  const vwr = s.vwr[deal.vertical] ?? s.overall, pwr = s.pwr[deal.product] ?? s.overall
  const cwr = s.comboR[`${deal.vertical}|${deal.product}`] ?? s.overall
  const szp = s.valsSorted.length ? s.valsSorted.findIndex(v => v >= deal.dealValue) / s.valsSorted.length : 0.5
  return [
    { icon: '\ud83d\udcca', label: 'Vertical win rate', value: `${Math.round(vwr * 100)}%`, sub: deal.vertical, score: Math.round(vwr * 100) },
    { icon: '\u2705', label: 'Product win rate', value: `${Math.round(pwr * 100)}%`, sub: deal.product, score: Math.round(pwr * 100) },
    { icon: '\u2694\ufe0f', label: 'Vertical \u00d7 Product', value: `${Math.round(cwr * 100)}%`, sub: `${deal.vertical} + ${deal.product}`, score: Math.round(cwr * 100) },
    { icon: '\ud83d\udcb0', label: 'Deal size percentile', value: `${Math.round((szp < 0 ? 1 : szp) * 100)}th`, sub: `$${(deal.dealValue || 0).toLocaleString()} MRR`, score: Math.round((szp < 0 ? 1 : szp) * 100) },
    { icon: '\u23f1', label: 'Days open', value: deal.daysOpen != null ? `${deal.daysOpen}d` : '\u2014', sub: `Avg close: ${s.daysMean}d`, score: deal.daysOpen != null ? Math.round(Math.max(0, Math.min(1, 1 - (deal.daysOpen - s.daysMean) / (s.daysStd * 3 + 1))) * 100) : 50 },
  ]
}

const buildChurnBreakdown = (deal, md) => {
  const s = md.stats
  const vwr = s.vwr[deal.vertical] ?? s.overall
  return [
    { icon: '\u23f0', label: 'Days in MtM', value: `${deal.mtmDays || 0}d`, sub: 'churn risk rises after 60d', score: Math.min(100, Math.round(((deal.mtmDays || 0) / 90) * 100)) },
    { icon: '\ud83d\udcc9', label: 'Days since contact', value: deal.daysSinceContact != null ? `${deal.daysSinceContact}d` : '\u2014', sub: 'no renewal discussion logged', score: Math.min(100, Math.round(((deal.daysSinceContact || 0) / 60) * 100)) },
    { icon: '\ud83c\udfe2', label: 'Vertical churn rate', value: `${Math.round((1 - vwr) * 100)}%`, sub: deal.vertical, score: Math.round((1 - vwr) * 100) },
    { icon: '\ud83d\udcb0', label: 'MRR at risk', value: `$${(deal.dealValue || 0).toLocaleString()}`, sub: 'total exposed revenue', score: 80 },
    { icon: '\ud83d\udee1\ufe0f', label: 'Save window', value: deal.mtmDays < 60 ? 'Open' : 'Closing', sub: 'save rate drops after day 60', score: deal.mtmDays < 60 ? 30 : 85 },
  ]
}

// ── Demo deal profiles & card content ──────────────────────────
const dealProfiles = {
  conversation: { vertical: 'Regional ISP', product: 'Metro Ethernet', dealValue: 10000, daysOpen: null, mtmDays: null, daysSinceContact: null },
  expansion: { vertical: 'Enterprise Telco', product: 'Metro Ethernet', dealValue: 12400, daysOpen: 18, mtmDays: null, daysSinceContact: null },
  churn: { vertical: 'Enterprise Telco', product: 'MPLS', dealValue: 11400, daysOpen: null, mtmDays: 47, daysSinceContact: 47 },
}

const cardContent = {
  conversation: {
    type: 'conversation', label: 'PROSPECTING', labelColor: T.blue,
    account: 'Pacific Fiber Networks', tagline: '3 new locations detected \u00b7 Competitor shift at HQ',
    signals: [
      { icon: '\ud83d\udccd', text: 'Added 3 locations in Sacramento metro (last 30 days)' },
      { icon: '\u26a1', text: 'HQ site moved on-net \u2014 AT&T lost coverage on Nov build-out' },
      { icon: '\ud83d\udcc9', text: 'Lost 2 competitor bids in 2023 \u2014 both on price, not product' },
      { icon: '\ud83d\udcb0', text: 'Historically buys in $8K\u2013$14K MRR range per location' },
    ],
    suggestedMove: 'Reach out re: new Sacramento sites. Lead with the HQ on-net news \u2014 they\u2019ve been price-sensitive, not product-sensitive. Anchor to $10K MRR per site.',
    cta: 'Draft Outreach', hasWinProb: false, hasChurnRisk: false,
  },
  expansion: {
    type: 'expansion', label: 'GROWTH', labelColor: T.green,
    account: 'Cascade Broadband Co.', tagline: '2 locations underserved \u00b7 Competitor displacement opportunity',
    signals: [
      { icon: '\ud83c\udfe2', text: 'Phoenix (AZ-04): Currently on Lumen DIA 500Mb \u2014 your 1Gb fiber is on-net same building' },
      { icon: '\ud83c\udfe2', text: 'Tucson (AZ-07): Off-net today, new on-net POP live Q1 2026 \u2014 0.3mi from their office' },
      { icon: '\ud83d\udd04', text: 'Similar displacement win in Mesa, AZ \u2014 $6,200 MRR, 14-day close' },
      { icon: '\ud83d\udca1', text: 'Recommend: Metro Ethernet 1Gb at Phoenix, SD-WAN bundle at Tucson on activation' },
    ],
    suggestedMove: 'Lead with Phoenix \u2014 it\u2019s a direct upgrade at the same building, easy yes. Use that to open Tucson conversation before your POP goes live.',
    cta: 'Build Quote', ctaSecondary: 'Build Outreach', hasWinProb: true, hasChurnRisk: false,
  },
  churn: {
    type: 'churn', label: 'RETENTION', labelColor: T.yellow,
    account: 'TriState Infrastructure LLC', tagline: '2 services MtM \u00b7 Contract window closing in 34 days',
    signals: [
      { icon: '\u23f0', text: 'DIA 200Mb at Dallas-01 went MtM 47 days ago \u2014 no renewal discussion logged' },
      { icon: '\u23f0', text: 'MPLS 3-site bundle expires Dec 31 \u2014 $11,400 MRR at risk' },
      { icon: '\ud83d\udcca', text: 'Accounts in this pattern churn within 90 days 68% of the time without contact' },
      { icon: '\ud83d\udee1\ufe0f', text: 'Save rate jumps to 81% when renewal offer made before day 60 of MtM' },
    ],
    suggestedMove: 'Contact by Friday. Offer 2-year renewal with 5% rate lock \u2014 historicals show they respond to pricing stability over upgrades. Don\u2019t lead with new products.',
    cta: 'Build Renewal Offer', hasWinProb: true, hasChurnRisk: true,
  },
}

function computeScores(modelData) {
  const s = {}
  for (const [key, profile] of Object.entries(dealProfiles)) {
    const c = cardContent[key]
    if (c.hasWinProb) s[key] = { winProb: scoreWinProb(profile, modelData), winBreakdown: buildWinBreakdown(profile, modelData) }
    if (c.hasChurnRisk) s[key] = { ...s[key], churnRisk: scoreChurnRisk(profile, modelData), churnBreakdown: buildChurnBreakdown(profile, modelData) }
  }
  return s
}

// ── ScoreBar ───────────────────────────────────────────────────
function ScoreBar({ score, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
      <div style={{ flex: 1, height: 2, background: T.border, borderRadius: 2 }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 2, opacity: 0.6 }} />
      </div>
      <span style={{ fontSize: 10, color: T.textDim, fontFamily: FONT_MONO, minWidth: 28 }}>{score}%</span>
    </div>
  )
}

// ── TooltipBadge (kept custom — no shared equivalent) ──────────
function TooltipBadge({ prob, label, color, breakdown }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-block' }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', background: `${color}15`,
        border: `1px solid ${show ? color : color + '40'}`, borderRadius: 8, padding: '8px 14px',
        minWidth: 80, cursor: 'default', transition: 'border-color 0.15s',
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, color, fontFamily: FONT_MONO }}>{prob}%</span>
        <span style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
          {label} <span style={{ color: `${color}90`, fontSize: 9 }}>\u24d8</span>
        </span>
      </div>
      {show && (
        <div onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
          style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 300,
            background: T.surface, border: `1px solid ${color}40`, borderRadius: 10, padding: 14,
            zIndex: 100, boxShadow: '0 16px 48px rgba(0,0,0,0.7)', animation: 'tooltipIn 0.15s ease',
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT_MONO }}>
              {breakdown.length} signals
            </span>
            <span style={{ fontSize: 16, fontWeight: 700, color, fontFamily: FONT_MONO }}>{prob}% confidence</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {breakdown.map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>{d.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 11, color: T.textMid, fontWeight: 500 }}>{d.label}</span>
                    <span style={{ fontSize: 11, color, fontFamily: FONT_MONO, fontWeight: 600, marginLeft: 8, flexShrink: 0 }}>{d.value}</span>
                  </div>
                  <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>{d.sub}</div>
                  <ScoreBar score={d.score} color={color} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.border}`, fontSize: 10, color: T.textDim, display: 'flex', justifyContent: 'space-between' }}>
            <span>Per-vertical model</span>
            {modelSource === 'demo' && <span style={{ color: T.yellow }}>\u26a0 demo data</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// Module-level variable set by SellerActions render
let modelSource = 'demo'

// ── ActionCard ─────────────────────────────────────────────────
function ActionCard({ content, scores, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.card,
      border: `1px solid ${active ? content.labelColor + '60' : T.border}`,
      borderRadius: RADIUS, padding: 20, cursor: 'pointer', transition: 'all 0.2s ease',
      boxShadow: active ? `0 0 0 1px ${content.labelColor}30, 0 8px 32px rgba(0,0,0,0.4)` : 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{
            display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            color: content.labelColor, background: `${content.labelColor}18`, border: `1px solid ${content.labelColor}35`,
            borderRadius: 4, padding: '3px 8px', marginBottom: 8, fontFamily: FONT_MONO,
          }}>
            {content.label}
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: T.text, letterSpacing: '-0.02em' }}>{content.account}</div>
          <div style={{ fontSize: 12, color: T.textDim, marginTop: 3 }}>{content.tagline}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }} onClick={e => e.stopPropagation()}>
          {content.hasWinProb && scores && (
            <TooltipBadge prob={scores.winProb} label={content.type === 'churn' ? 'Save Rate' : 'Win Prob'} color={T.purple} breakdown={scores.winBreakdown} />
          )}
          {content.hasChurnRisk && scores && (
            <TooltipBadge prob={scores.churnRisk} label="Churn Risk" color={T.red} breakdown={scores.churnBreakdown} />
          )}
        </div>
      </div>

      {/* Signals */}
      {active && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: T.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, fontFamily: FONT_MONO }}>WHY NOW</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {content.signals.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                <span style={{ fontSize: 13, color: T.textMid, lineHeight: 1.5 }}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested move */}
      {active && (
        <div style={{
          background: T.bg, border: `1px solid ${T.border}`, borderLeft: `3px solid ${content.labelColor}`,
          borderRadius: 6, padding: '12px 14px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, color: T.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontFamily: FONT_MONO }}>SUGGESTED MOVE</div>
          <p style={{ fontSize: 13, color: T.textMid, lineHeight: 1.6, margin: 0 }}>{content.suggestedMove}</p>
        </div>
      )}

      {/* CTA row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: T.textDim }}>{active ? 'Click to collapse' : 'Click to expand'}</span>
        {active && (
          <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
            {content.ctaSecondary && (
              <button style={{
                background: 'transparent', color: content.labelColor, border: `1px solid ${content.labelColor}50`,
                borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: FONT_SANS,
              }}>
                {content.ctaSecondary} &rarr;
              </button>
            )}
            <button style={{
              background: content.labelColor, color: T.bg, border: 'none', borderRadius: 6,
              padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: FONT_SANS,
            }}>
              {content.cta} &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function SellerActions({ accounts, rawData, onNavigate }) {
  const [active, setActive] = useState('expansion')
  const [steeringMode, setSteeringMode] = useState('Prospecting')
  const [modelData, setModelData] = useState(DEMO_MODEL)
  const [signalsData, setSignalsData] = useState(null)
  const [aiSignals, setAiSignals] = useState({})
  const [refreshing, setRefreshing] = useState(false)

  // Track model source for tooltip display
  modelSource = modelData.source || 'demo'
  const isDemo = modelSource === 'demo'

  // Load model stats and signals
  useEffect(() => {
    fetch('/api/engine/model/params')
      .then(r => r.ok ? r.json() : null).catch(() => null)
      .then(data => { if (data && data.stats) setModelData(data); })

    fetch('/local-data/file?name=revos-signals.json')
      .then(r => r.ok ? r.json() : null).catch(() => null)
      .then(signals => { if (signals) setSignalsData(signals); })
  }, [])

  const scores = computeScores(modelData)

  const modes = [
    { label: 'Prospecting', color: T.blue },
    { label: 'Growth', color: T.green },
    { label: 'Retention', color: T.yellow },
  ]

  const handleAIRefresh = async (accountName, segment, signals) => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/engine/refresh-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName, segment, signals }),
      })
      const data = await res.json()
      setAiSignals(prev => ({ ...prev, [accountName]: data.aiSignals || [] }))
    } catch (e) {
      console.error('AI refresh failed:', e)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div style={{ padding: '28px 20px', maxWidth: 920, margin: '0 auto' }}>
      <style>{`@keyframes tooltipIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: T.textDim, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: FONT_MONO, marginBottom: 6 }}>
          REVOS &middot; SELLER DASHBOARD
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '-0.03em', fontFamily: FONT_SANS }}>
          Your Priority Actions
        </h1>
        <p style={{ fontSize: 13, color: T.textDim, margin: '6px 0 0', fontFamily: FONT_SANS }}>
          3 accounts need your attention today &middot; Ranked by impact
        </p>
      </div>

      {/* Model banner */}
      {isDemo && (
        <div style={{
          background: `${T.yellow}10`, border: `1px solid ${T.yellow}30`, borderRadius: 8, padding: '8px 14px',
          marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: T.yellow, fontFamily: FONT_MONO }}>
            \u26a0 DEMO MODEL &mdash; run backtest with real data to activate live scoring
          </span>
          <span
            onClick={() => onNavigate('backtest')}
            style={{ fontSize: 11, color: T.yellow, textDecoration: 'underline', cursor: 'pointer', fontFamily: FONT_MONO }}
          >
            Run Backtest &rarr;
          </span>
        </div>
      )}

      {/* Steering bar */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, color: T.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: FONT_MONO }}>MODE</span>
        {modes.map(m => (
          <button key={m.label} onClick={() => setSteeringMode(m.label)} style={{
            background: steeringMode === m.label ? `${m.color}15` : 'transparent',
            border: steeringMode === m.label ? `1px solid ${m.color}50` : `1px solid ${T.border}`,
            borderRadius: 20, padding: '5px 14px', fontSize: 12,
            color: steeringMode === m.label ? m.color : T.textDim,
            cursor: 'pointer', fontWeight: 600, fontFamily: FONT_SANS,
          }}>
            {m.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: T.textDim, fontFamily: FONT_MONO }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Object.values(cardContent).map(card => (
          <ActionCard
            key={card.type}
            content={card}
            scores={scores[card.type]}
            active={active === card.type}
            onClick={() => setActive(active === card.type ? null : card.type)}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 24, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { color: T.purple, label: 'Win / Save Probability' },
          { color: T.red, label: 'Churn Risk Score' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
            <span style={{ fontSize: 11, color: T.textDim }}>{l.label}</span>
          </div>
        ))}
        <span style={{ fontSize: 11, color: T.textDim, marginLeft: 'auto' }}>Hover badges to see signal breakdown</span>
      </div>
    </div>
  )
}
