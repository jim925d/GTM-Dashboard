import { useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, BarChart, Bar, ScatterChart, Scatter,
} from 'recharts'
import { T, FONT_MONO, FONT_SANS, RADIUS, CARD_SHADOW, STAGE_COLORS } from '../lib/constants'
import Badge from '../components/shared/Badge'
import Stat from '../components/shared/Stat'
import ProbBar from '../components/shared/ProbBar'
import Tip from '../components/shared/Tip'
import { chartTheme, $, $k, pc } from '../components/shared/ChartTheme'

// --- Helpers ---

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function probColor(v) {
  if (v >= 0.7) return T.green
  if (v >= 0.4) return T.yellow
  return T.red
}

// --- Tab Button ---
function TabBtn({ active, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 16px', borderRadius: RADIUS, cursor: 'pointer',
      fontFamily: FONT_SANS, fontSize: '11px', fontWeight: active ? 600 : 400,
      border: 'none', background: active ? T.card : 'transparent',
      color: active ? T.text : T.textDim, transition: 'all 0.15s',
    }}>
      {label}
    </button>
  )
}

// --- Column Header ---
function ColHeader({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field
  return (
    <div
      onClick={() => onSort(field)}
      style={{
        fontFamily: FONT_SANS, fontSize: '9px', color: active ? T.text : T.textDim,
        letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer',
        userSelect: 'none', display: 'flex', alignItems: 'center', gap: '3px',
      }}
    >
      {label}
      {active && <span style={{ fontSize: '8px' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
    </div>
  )
}

// --- Strategy Sub-Cards ---

function PricingCard({ pricing }) {
  if (!pricing) return null
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.green}`,
      borderRadius: RADIUS, padding: '14px', boxShadow: CARD_SHADOW,
    }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '10px' }}>
        Pricing Strategy
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '22px', fontWeight: 700, color: T.green, marginBottom: '8px' }}>
        {$k(pricing.recommended_mrr || 0)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim }}>Discount</span>
        <div style={{ flex: 1, height: '6px', background: T.border, borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            width: `${(pricing.sweet_spot || 0) * 100}%`, height: '100%',
            background: T.green, borderRadius: '3px',
          }} />
        </div>
        <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textMid }}>
          {pc(pricing.sweet_spot || 0)}
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>
          max {pc(pricing.max_discount || 0)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '6px' }}>
        <div>
          <span style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim }}>Floor </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textMid }}>{$k(pricing.floor_mrr || 0)}</span>
        </div>
        <div>
          <span style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim }}>Term </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textMid }}>{pricing.term_recommendation || '—'}</span>
        </div>
      </div>
      {pricing.quote_timing && (
        <div style={{
          padding: '6px 10px', background: `${T.green}10`, borderRadius: '6px',
          fontFamily: FONT_SANS, fontSize: '10px', color: T.green, marginBottom: '6px',
        }}>
          {pricing.quote_timing}
        </div>
      )}
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>
        {pricing.similar_deals || 0} similar deals
      </div>
    </div>
  )
}

function ProductCard({ product }) {
  if (!product) return null
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.blue}`,
      borderRadius: RADIUS, padding: '14px', boxShadow: CARD_SHADOW,
    }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '10px' }}>
        Product Strategy
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: '13px', fontWeight: 600, color: T.text }}>{product.primary_product || '—'}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.blue }}>{pc(product.confidence || 0)}</span>
      </div>
      {product.bundles && product.bundles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
          {product.bundles.map((b, i) => (
            <div key={i} style={{
              padding: '6px 10px', background: `${T.blue}10`, borderRadius: '6px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.text, flex: 1 }}>{b.name}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.green }}>+{$k(b.mrr_uplift || 0)}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>{pc(b.attach_rate || 0)} attach</span>
              <Badge color={b.priority === 'high' ? T.green : b.priority === 'medium' ? T.yellow : T.textDim}>{b.priority}</Badge>
            </div>
          ))}
        </div>
      )}
      {product.expansion_path && (
        <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim }}>
          {product.expansion_path}
        </div>
      )}
    </div>
  )
}

function EngagementCard({ engagement }) {
  if (!engagement) return null
  const stalled = engagement.status === 'stalled'
  const borderColor = stalled ? T.red : T.green
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${borderColor}`,
      borderRadius: RADIUS, padding: '14px', boxShadow: CARD_SHADOW,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Engagement
        </span>
        <Badge color={borderColor}>
          {stalled ? '\u26A0 STALLED' : '\u2713 ON TRACK'}
        </Badge>
      </div>
      {engagement.next_action && (
        <div style={{ fontFamily: FONT_SANS, fontSize: '11px', fontWeight: 600, color: T.text, marginBottom: '6px' }}>
          {engagement.next_action}
        </div>
      )}
      {engagement.deadline && (
        <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim, marginBottom: '8px' }}>
          Deadline: {fmtDate(engagement.deadline)}
        </div>
      )}
      {engagement.talk_track && (
        <div style={{
          padding: '8px 10px', background: `${T.purple}12`, borderRadius: '6px',
          fontFamily: FONT_SANS, fontSize: '10px', color: T.purple, marginBottom: '8px',
          lineHeight: 1.5,
        }}>
          {engagement.talk_track}
        </div>
      )}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '6px' }}>
        {engagement.cadence && (
          <div>
            <span style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim }}>Cadence </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textMid }}>
              {engagement.cadence.current || '—'} → {engagement.cadence.recommended || '—'}
            </span>
          </div>
        )}
        {engagement.contacts && (
          <div>
            <span style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim }}>Contacts </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textMid }}>
              {engagement.contacts.current || 0}/{engagement.contacts.recommended || 0}
            </span>
            {engagement.contacts.roles_to_add && engagement.contacts.roles_to_add.length > 0 && (
              <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.orange, marginLeft: '4px' }}>
                +{engagement.contacts.roles_to_add.join(', ')}
              </span>
            )}
          </div>
        )}
      </div>
      {engagement.rescue_play && (
        <div style={{
          padding: '6px 10px', background: `${T.red}10`, borderRadius: '6px',
          fontFamily: FONT_SANS, fontSize: '10px', color: T.red, marginTop: '6px',
        }}>
          Rescue: {engagement.rescue_play}
        </div>
      )}
    </div>
  )
}

function CompetitiveCard({ competitive }) {
  if (!competitive) return null
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.yellow}`,
      borderRadius: RADIUS, padding: '14px', boxShadow: CARD_SHADOW,
    }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '10px' }}>
        Competitive
      </div>
      {competitive.displacement_win_rate != null && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textMid }}>Displacement Win Rate</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 600, color: T.yellow }}>
              {pc(competitive.displacement_win_rate)}
            </span>
          </div>
          <ProbBar value={competitive.displacement_win_rate} color={T.yellow} h={5} />
        </div>
      )}
      {competitive.key_levers && competitive.key_levers.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          {competitive.key_levers.map((lever, i) => (
            <div key={i} style={{
              fontFamily: FONT_SANS, fontSize: '10px', color: T.textMid,
              padding: '3px 0', borderBottom: `1px solid ${T.border}`,
            }}>
              {lever}
            </div>
          ))}
        </div>
      )}
      {competitive.historical_basis && (
        <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>
          {competitive.historical_basis}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function EngineDashboard() {
  const [tab, setTab] = useState('strategies')
  const [health, setHealth] = useState(null)
  const [engineError, setEngineError] = useState(null)
  const [strategies, setStrategies] = useState([])
  const [calibration, setCalibration] = useState(null)
  const [modelParams, setModelParams] = useState(null)
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [sortField, setSortField] = useState('win_prob')
  const [sortDir, setSortDir] = useState('desc')
  const [training, setTraining] = useState(false)
  const [scoring, setScoring] = useState(false)

  // --- Data loading ---

  useEffect(() => {
    checkHealth()
  }, [])

  async function checkHealth() {
    try {
      const res = await fetch('/api/engine/health')
      if (!res.ok) throw new Error('not_running')
      const data = await res.json()
      setHealth(data)
      if (!data.trained) {
        setEngineError('not_trained')
      } else {
        setEngineError(null)
        loadStrategies()
      }
    } catch {
      setEngineError('not_running')
    }
  }

  async function loadStrategies() {
    try {
      const res = await fetch('/api/engine/strategies')
      if (res.ok) {
        const data = await res.json()
        setStrategies(data)
      }
    } catch { /* silent */ }
  }

  async function loadCalibration() {
    try {
      const res = await fetch('/api/engine/calibration')
      if (res.ok) {
        const data = await res.json()
        setCalibration(data)
      }
    } catch { /* silent */ }
  }

  async function loadModelParams() {
    try {
      const res = await fetch('/api/engine/model/params')
      if (res.ok) {
        const data = await res.json()
        setModelParams(data)
      }
    } catch { /* silent */ }
  }

  async function handleRetrain() {
    setTraining(true)
    try {
      const res = await fetch('/api/engine/load-and-train', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (res.ok) {
        await checkHealth()
      }
    } catch { /* silent */ }
    setTraining(false)
  }

  async function handleScoreAll() {
    setScoring(true)
    try {
      const res = await fetch('/api/engine/predictions')
      if (res.ok) {
        await loadStrategies()
      }
    } catch { /* silent */ }
    setScoring(false)
  }

  async function handleTrainFromError() {
    setTraining(true)
    try {
      await fetch('/api/engine/load-and-train', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      await checkHealth()
    } catch { /* silent */ }
    setTraining(false)
  }

  async function handleAcceptStrategy() {
    if (!selectedDeal) return
    try {
      await fetch('/api/engine/calibration/track-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: selectedDeal.deal_id, domain: 'all', followed: true }),
      })
    } catch { /* silent */ }
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // Load tab-specific data
  useEffect(() => {
    if (tab === 'health' || tab === 'retrain') {
      if (!calibration) loadCalibration()
    }
    if (tab === 'segments') {
      if (!modelParams) loadModelParams()
    }
  }, [tab])

  // --- Sorted deals ---
  const sorted = useMemo(() => {
    const list = [...strategies]
    list.sort((a, b) => {
      let va, vb
      if (sortField === 'win_prob') { va = a.prediction?.win_probability ?? 0; vb = b.prediction?.win_probability ?? 0 }
      else if (sortField === 'amount') { va = a.amount ?? 0; vb = b.amount ?? 0 }
      else if (sortField === 'close') { va = a.close_date || ''; vb = b.close_date || '' }
      else if (sortField === 'risks') { va = (a.prediction?.risk_flags || []).length; vb = (b.prediction?.risk_flags || []).length }
      else if (sortField === 'deal') { va = a.deal_name || ''; vb = b.deal_name || '' }
      else if (sortField === 'account') { va = a.account_name || ''; vb = b.account_name || '' }
      else { va = 0; vb = 0 }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [strategies, sortField, sortDir])

  // ============================================================
  // Error States
  // ============================================================

  if (engineError === 'not_running') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: RADIUS,
          padding: '32px', maxWidth: '520px', width: '100%', boxShadow: CARD_SHADOW,
        }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '16px', fontWeight: 700, color: T.red, marginBottom: '16px' }}>
            Engine Server Not Running
          </div>
          <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: T.textMid, marginBottom: '16px' }}>
            The prediction engine API is not reachable. Start it with:
          </div>
          <div style={{
            fontFamily: FONT_MONO, fontSize: '11px', color: T.text,
            background: T.bg, border: `1px solid ${T.border}`, borderRadius: '6px',
            padding: '14px', lineHeight: 1.8, whiteSpace: 'pre',
          }}>
{`cd revos/engine
python -m uvicorn api:app --port 8001 --reload`}
          </div>
          <button onClick={checkHealth} style={{
            marginTop: '16px', padding: '8px 20px', borderRadius: RADIUS,
            border: `1px solid ${T.border}`, background: T.card, color: T.cyan,
            fontFamily: FONT_MONO, fontSize: '11px', cursor: 'pointer',
          }}>
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  if (engineError === 'not_trained') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: RADIUS,
          padding: '32px', maxWidth: '420px', width: '100%', boxShadow: CARD_SHADOW,
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '16px', fontWeight: 700, color: T.yellow, marginBottom: '12px' }}>
            Engine Not Trained
          </div>
          <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: T.textMid, marginBottom: '20px' }}>
            The engine is running but has no trained model. Train on historical deal data to enable predictions.
          </div>
          <button onClick={handleTrainFromError} disabled={training} style={{
            padding: '10px 28px', borderRadius: RADIUS, border: 'none',
            background: T.cyan, color: T.bg, fontFamily: FONT_MONO, fontSize: '12px',
            fontWeight: 700, cursor: training ? 'wait' : 'pointer', opacity: training ? 0.6 : 1,
          }}>
            {training ? 'Training...' : 'Train Engine'}
          </button>
        </div>
      </div>
    )
  }

  // ============================================================
  // Main Render
  // ============================================================

  const btnStyle = {
    padding: '6px 14px', borderRadius: RADIUS, border: `1px solid ${T.border}`,
    background: T.card, color: T.cyan, fontFamily: FONT_MONO, fontSize: '10px', cursor: 'pointer',
  }

  return (
    <div style={{ padding: '0' }}>

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: FONT_SANS, fontSize: '16px', fontWeight: 700, color: T.text }}>Prediction Engine</span>
          <Badge color={health?.trained ? T.green : T.yellow}>
            {health?.trained ? '\u25CF CALIBRATED' : '\u25CF NOT TRAINED'}
          </Badge>
          <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim }}>
            {health?.training_deals} training deals &middot; {health?.active_deals} active
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleScoreAll} disabled={scoring} style={{ ...btnStyle, opacity: scoring ? 0.6 : 1, cursor: scoring ? 'wait' : 'pointer' }}>
            {scoring ? 'Scoring...' : 'Score All Deals'}
          </button>
          <button onClick={handleRetrain} disabled={training} style={{ ...btnStyle, opacity: training ? 0.6 : 1, cursor: training ? 'wait' : 'pointer' }}>
            {training ? 'Training...' : 'Force Retrain'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '16px', padding: '4px',
        background: T.surface, borderRadius: RADIUS, width: 'fit-content',
      }}>
        <TabBtn active={tab === 'strategies'} label="Deal Strategies" onClick={() => setTab('strategies')} />
        <TabBtn active={tab === 'health'} label="Model Health" onClick={() => setTab('health')} />
        <TabBtn active={tab === 'segments'} label="Segments" onClick={() => setTab('segments')} />
        <TabBtn active={tab === 'retrain'} label="Retrain Log" onClick={() => setTab('retrain')} />
      </div>

      {/* ============================================================ */}
      {/* TAB 1: Deal Strategies                                       */}
      {/* ============================================================ */}
      {tab === 'strategies' && (
        <div>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.2fr 0.6fr 0.8fr 0.7fr',
            gap: '8px', padding: '8px 12px', marginBottom: '2px',
          }}>
            <ColHeader label="Deal" field="deal" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <ColHeader label="Account" field="account" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Stage</div>
            <ColHeader label="Amount" field="amount" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <ColHeader label="Win Prob" field="win_prob" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Trend</div>
            <ColHeader label="Close" field="close" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <ColHeader label="Risks" field="risks" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
          </div>

          {/* Table Rows */}
          {sorted.length === 0 && (
            <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: T.textDim, padding: '24px', textAlign: 'center' }}>
              No strategies loaded. Click "Score All Deals" to generate predictions.
            </div>
          )}
          {sorted.map((s) => {
            const wp = s.prediction?.win_probability ?? 0
            const riskCount = (s.prediction?.risk_flags || []).length
            const isSelected = selectedDeal?.deal_id === s.deal_id
            const trend = s.prediction?.trend || 'flat'
            const stageColor = STAGE_COLORS[s.stage] || T.textDim
            return (
              <div
                key={s.deal_id}
                onClick={() => setSelectedDeal(s)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.2fr 0.6fr 0.8fr 0.7fr',
                  gap: '8px', padding: '10px 12px', alignItems: 'center',
                  background: isSelected ? `${T.cyan}08` : T.card,
                  border: isSelected ? `1px solid ${T.cyan}` : `1px solid ${T.border}`,
                  borderRadius: RADIUS, marginBottom: '4px', cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Deal */}
                <div>
                  <div style={{ fontFamily: FONT_SANS, fontSize: '11px', fontWeight: 600, color: T.text, lineHeight: 1.3 }}>
                    {s.deal_name || s.product || '—'}
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>{s.deal_id}</div>
                </div>

                {/* Account */}
                <div style={{ fontFamily: FONT_SANS, fontSize: '11px', color: T.textMid }}>
                  {s.account_name || '—'}
                </div>

                {/* Stage */}
                <Badge color={stageColor}>{s.stage || '—'}</Badge>

                {/* Amount */}
                <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.text }}>
                  {s.amount != null ? $k(s.amount) : '—'}
                </div>

                {/* Win Prob */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ flex: 1, maxWidth: '60px' }}>
                    <ProbBar value={wp} color={probColor(wp)} h={5} />
                  </div>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 600, color: probColor(wp) }}>
                    {pc(wp)}
                  </span>
                </div>

                {/* Trend */}
                <div style={{ fontFamily: FONT_MONO, fontSize: '12px', textAlign: 'center' }}>
                  {trend === 'up' && <span style={{ color: T.green }}>▲</span>}
                  {trend === 'down' && <span style={{ color: T.red }}>▼</span>}
                  {trend !== 'up' && trend !== 'down' && <span style={{ color: T.textDim }}>&ndash;</span>}
                </div>

                {/* Close */}
                <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textMid }}>
                  {fmtDate(s.close_date)}
                </div>

                {/* Risks */}
                <div>
                  {riskCount >= 2 && <Badge color={T.red}>{riskCount} risks</Badge>}
                  {riskCount === 1 && <Badge color={T.orange}>1 risk</Badge>}
                  {riskCount === 0 && <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.green }}>{'\u2713'}</span>}
                </div>
              </div>
            )
          })}

          {/* Strategy Card (expanded detail) */}
          {selectedDeal && selectedDeal.strategy && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: '12px', fontWeight: 600, color: T.text, marginBottom: '10px' }}>
                Strategy: {selectedDeal.deal_name || selectedDeal.deal_id}
              </div>

              {/* 2x2 Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <PricingCard pricing={selectedDeal.strategy.pricing} />
                <ProductCard product={selectedDeal.strategy.product} />
                <EngagementCard engagement={selectedDeal.strategy.engagement} />
                <CompetitiveCard competitive={selectedDeal.strategy.competitive} />
              </div>

              {/* Action Bar */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={handleAcceptStrategy} style={{
                  padding: '8px 20px', borderRadius: RADIUS, border: 'none',
                  background: T.cyan, color: T.bg, fontFamily: FONT_MONO, fontSize: '11px',
                  fontWeight: 700, cursor: 'pointer',
                }}>
                  Accept Strategy
                </button>
                <button style={{
                  padding: '8px 20px', borderRadius: RADIUS,
                  border: `1px solid ${T.border}`, background: T.card,
                  color: T.textMid, fontFamily: FONT_MONO, fontSize: '11px', cursor: 'pointer',
                }}>
                  Modify
                </button>
                <button style={{
                  padding: '8px 20px', borderRadius: RADIUS,
                  border: `1px solid ${T.border}`, background: T.card,
                  color: T.textMid, fontFamily: FONT_MONO, fontSize: '11px', cursor: 'pointer',
                }}>
                  Override with Reason
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: Model Health                                          */}
      {/* ============================================================ */}
      {tab === 'health' && (
        <div>
          {!calibration ? (
            <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: T.textDim, padding: '24px' }}>Loading...</div>
          ) : (
            <>
              {/* Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <Stat
                  label="Brier Score"
                  value={calibration.metrics?.['90d']?.brier_score?.toFixed(3) ?? '—'}
                  color={(calibration.metrics?.['90d']?.brier_score ?? 1) < 0.20 ? T.green : T.red}
                  sub="Lower is better (< 0.20)"
                />
                <Stat
                  label="Calibration Error"
                  value={calibration.metrics?.['90d']?.calibration_error?.toFixed(3) ?? '—'}
                  color={(calibration.metrics?.['90d']?.calibration_error ?? 1) < 0.05 ? T.green : T.red}
                  sub="Target < 0.05"
                />
                <Stat
                  label="AUC-ROC"
                  value={calibration.metrics?.['90d']?.auc_roc?.toFixed(3) ?? '—'}
                  color={(calibration.metrics?.['90d']?.auc_roc ?? 0) > 0.75 ? T.green : T.red}
                  sub="Target > 0.75"
                />
                <Stat
                  label="Close Date MAE"
                  value={`${calibration.metrics?.['90d']?.close_date_mae_days?.toFixed(0) ?? '—'} days`}
                  color={(calibration.metrics?.['90d']?.close_date_mae_days ?? 99) < 15 ? T.green : T.red}
                  sub="Target < 15 days"
                />
              </div>

              {/* Calibration Curve */}
              <div style={{
                background: T.card, border: `1px solid ${T.border}`, borderRadius: RADIUS,
                padding: '16px', boxShadow: CARD_SHADOW, marginBottom: '20px',
              }}>
                <div style={{
                  fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim,
                  letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '12px',
                }}>
                  Calibration Curve
                </div>
                {calibration.calibration_curve && calibration.calibration_curve.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={calibration.calibration_curve} margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis
                        dataKey="predicted" type="number" domain={[0, 1]}
                        tick={{ fontFamily: chartTheme.font, fontSize: 10, fill: chartTheme.text }}
                        label={{ value: 'Predicted Probability', position: 'insideBottom', offset: -10, fontFamily: FONT_SANS, fontSize: 10, fill: T.textDim }}
                      />
                      <YAxis
                        dataKey="actual" type="number" domain={[0, 1]}
                        tick={{ fontFamily: chartTheme.font, fontSize: 10, fill: chartTheme.text }}
                        label={{ value: 'Actual Win Rate', angle: -90, position: 'insideLeft', offset: 0, fontFamily: FONT_SANS, fontSize: 10, fill: T.textDim }}
                      />
                      <Tooltip contentStyle={chartTheme.tooltip} />
                      <ReferenceLine
                        segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                        stroke={T.textDim} strokeDasharray="4 4" strokeWidth={1}
                      />
                      <Scatter
                        dataKey="actual" fill={T.cyan}
                        shape={(props) => {
                          const size = Math.max(4, Math.min((props.payload.count || 1) * 2, 14))
                          return (
                            <circle cx={props.cx} cy={props.cy} r={size} fill={T.cyan} fillOpacity={0.7} stroke={T.cyan} strokeWidth={1} />
                          )
                        }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ fontFamily: FONT_SANS, fontSize: '11px', color: T.textDim, padding: '20px', textAlign: 'center' }}>
                    No calibration data available yet.
                  </div>
                )}
              </div>

              {/* Drift Alerts */}
              {calibration.drift_alerts && calibration.drift_alerts.length > 0 && (
                <div>
                  <div style={{
                    fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim,
                    letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '8px',
                  }}>
                    Drift Alerts
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {calibration.drift_alerts.map((alert, i) => {
                      const severityColor = alert.severity === 'high' ? T.red : alert.severity === 'medium' ? T.orange : T.yellow
                      return (
                        <div key={i} style={{
                          background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${severityColor}`,
                          borderRadius: RADIUS, padding: '10px 14px', boxShadow: CARD_SHADOW,
                          display: 'flex', alignItems: 'center', gap: '10px',
                        }}>
                          <Badge color={severityColor}>{alert.severity}</Badge>
                          <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textMid }}>{alert.segment || '—'}</span>
                          <span style={{ fontFamily: FONT_SANS, fontSize: '11px', color: T.text, flex: 1 }}>{alert.message}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: Segments                                              */}
      {/* ============================================================ */}
      {tab === 'segments' && (
        <div>
          {!modelParams ? (
            <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: T.textDim, padding: '24px' }}>Loading...</div>
          ) : (
            <>
              {/* Product Win Rates */}
              {modelParams.prediction?.product_win_rates && (() => {
                const products = Object.entries(modelParams.prediction.product_win_rates)
                const avgWr = products.length > 0 ? products.reduce((s, [, v]) => s + (v.win_rate || 0), 0) / products.length : 0
                return (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{
                      fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim,
                      letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '10px',
                    }}>
                      Product Win Rates
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                      {products.sort((a, b) => (b[1].win_rate || 0) - (a[1].win_rate || 0)).map(([name, data]) => {
                        const wr = data.win_rate || 0
                        const borderColor = wr > avgWr ? T.green : T.red
                        return (
                          <div key={name} style={{
                            background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${borderColor}`,
                            borderRadius: RADIUS, padding: '12px', boxShadow: CARD_SHADOW,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontFamily: FONT_SANS, fontSize: '11px', fontWeight: 600, color: T.text }}>{name}</span>
                              <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>{data.count || 0} deals</span>
                            </div>
                            <ProbBar value={wr} color={borderColor} h={5} />
                            <div style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 600, color: borderColor, marginTop: '4px' }}>
                              {pc(wr)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Rep Win Rates */}
              {modelParams.prediction?.rep_win_rates && (() => {
                const reps = Object.entries(modelParams.prediction.rep_win_rates)
                const avgWr = reps.length > 0 ? reps.reduce((s, [, v]) => s + (v.win_rate || 0), 0) / reps.length : 0
                return (
                  <div>
                    <div style={{
                      fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim,
                      letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '10px',
                    }}>
                      Rep Win Rates
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                      {reps.sort((a, b) => (b[1].win_rate || 0) - (a[1].win_rate || 0)).map(([name, data]) => {
                        const wr = data.win_rate || 0
                        const borderColor = wr > avgWr ? T.green : T.red
                        return (
                          <div key={name} style={{
                            background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${borderColor}`,
                            borderRadius: RADIUS, padding: '12px', boxShadow: CARD_SHADOW,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontFamily: FONT_SANS, fontSize: '11px', fontWeight: 600, color: T.text }}>{name}</span>
                              <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>{data.count || 0} deals</span>
                            </div>
                            <ProbBar value={wr} color={borderColor} h={5} />
                            <div style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 600, color: borderColor, marginTop: '4px' }}>
                              {pc(wr)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: Retrain Log                                           */}
      {/* ============================================================ */}
      {tab === 'retrain' && (
        <div>
          {!calibration ? (
            <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: T.textDim, padding: '24px' }}>Loading...</div>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.6fr 0.7fr',
                gap: '8px', padding: '8px 12px', marginBottom: '2px',
              }}>
                {['Date', 'Trigger', 'Deals Added', 'Brier Before', 'Brier After', '\u0394', 'Status'].map(label => (
                  <div key={label} style={{
                    fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>
                    {label}
                  </div>
                ))}
              </div>

              {(!calibration.retrain_log || calibration.retrain_log.length === 0) && (
                <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: T.textDim, padding: '24px', textAlign: 'center' }}>
                  No retrain events logged yet.
                </div>
              )}

              {(calibration.retrain_log || []).map((entry, i) => {
                const delta = (entry.brier_after != null && entry.brier_before != null)
                  ? entry.brier_after - entry.brier_before : null
                const deltaColor = delta != null ? (delta < 0 ? T.green : delta > 0 ? T.red : T.textDim) : T.textDim
                const triggerColor = entry.trigger === 'scheduled' ? T.blue : entry.trigger === 'manual' ? T.purple : T.orange
                return (
                  <div key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.6fr 0.7fr',
                    gap: '8px', padding: '10px 12px', alignItems: 'center',
                    background: T.card, border: `1px solid ${T.border}`,
                    borderRadius: RADIUS, marginBottom: '4px',
                  }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textMid }}>
                      {fmtDate(entry.date || entry.timestamp)}
                    </div>
                    <div><Badge color={triggerColor}>{entry.trigger || '—'}</Badge></div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.text }}>
                      {entry.deals_added ?? '—'}
                    </div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textMid }}>
                      {entry.brier_before?.toFixed(3) ?? '—'}
                    </div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textMid }}>
                      {entry.brier_after?.toFixed(3) ?? '—'}
                    </div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 600, color: deltaColor }}>
                      {delta != null ? (delta > 0 ? '+' : '') + delta.toFixed(3) : '—'}
                    </div>
                    <div>
                      <Badge color={entry.status === 'success' ? T.green : entry.status === 'failed' ? T.red : T.textDim}>
                        {entry.status || '—'}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
