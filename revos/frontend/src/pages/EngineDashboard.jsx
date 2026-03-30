import { useState, useMemo, useEffect } from 'react'
import {
  ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ScatterChart, Scatter,
} from 'recharts'
import { T, STAGE_COLORS } from '../lib/constants'
import { savePredictions } from '../lib/engineStore'
import { cn } from '@/lib/utils'
import Badge from '../components/shared/Badge'
import Stat from '../components/shared/Stat'
import ProbBar from '../components/shared/ProbBar'
import { chartTheme, $k, pc } from '../components/shared/ChartTheme'

const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

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

function TabBtn({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-[7px] rounded-xl cursor-pointer font-sans text-[11px] border-none transition-all duration-150',
        active ? 'bg-revos-card font-semibold text-revos-text' : 'bg-transparent font-normal text-revos-text-dim'
      )}
    >
      {label}
    </button>
  )
}

function ColHeader({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field
  return (
    <div
      onClick={() => onSort(field)}
      className={cn(
        'font-sans text-[9px] tracking-[0.04em] uppercase cursor-pointer select-none flex items-center gap-[3px]',
        active ? 'text-revos-text' : 'text-revos-text-dim'
      )}
    >
      {label}
      {active && <span className="text-[8px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
    </div>
  )
}

// --- Strategy Sub-Cards ---

function PricingCard({ pricing }) {
  if (!pricing) return null
  return (
    <div className="bg-revos-card border border-revos-border border-l-[3px] border-l-revos-green rounded-xl p-[14px] shadow-card">
      <div className="font-sans text-[9px] text-revos-text-dim tracking-[0.04em] uppercase mb-[10px]">
        Pricing Strategy
      </div>
      <div className="font-mono text-[22px] font-bold text-revos-green mb-2">
        {$k(pricing.recommended_mrr || 0)}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-sans text-[10px] text-revos-text-dim">Discount</span>
        <div className="flex-1 h-[6px] bg-revos-border rounded-[3px] relative overflow-hidden">
          <div
            className="h-full bg-revos-green rounded-[3px]"
            style={{ width: `${(pricing.sweet_spot || 0) * 100}%` }}
          />
        </div>
        <span className="font-mono text-[10px] text-revos-text-mid">
          {pc(pricing.sweet_spot || 0)}
        </span>
      </div>
      <div className="flex gap-4">
        <div>
          <span className="font-sans text-[9px] text-revos-text-dim">Floor </span>
          <span className="font-mono text-[11px] text-revos-text-mid">{$k(pricing.floor_mrr || 0)}</span>
        </div>
        <div>
          <span className="font-sans text-[9px] text-revos-text-dim">Term </span>
          <span className="font-mono text-[11px] text-revos-text-mid">{pricing.term || '—'}</span>
        </div>
      </div>
    </div>
  )
}

function EngagementCard({ engagement }) {
  if (!engagement) return null
  const stalled = engagement.status === 'stalled'
  const borderColor = stalled ? T.red : T.green
  return (
    <div className={cn(
      'bg-revos-card border border-revos-border rounded-xl p-[14px] shadow-card border-l-[3px]',
      stalled ? 'border-l-revos-red' : 'border-l-revos-green'
    )}>
      <div className="flex items-center gap-2 mb-[10px]">
        <span className="font-sans text-[9px] text-revos-text-dim tracking-[0.04em] uppercase">
          Engagement
        </span>
        <Badge color={borderColor}>
          {stalled ? '\u26A0 STALLED' : '\u2713 ON TRACK'}
        </Badge>
      </div>
      {engagement.next_action && (
        <div className="font-sans text-[11px] font-semibold text-revos-text mb-[6px]">
          {engagement.next_action}
        </div>
      )}
      <div className="flex gap-4">
        {engagement.days_silent != null && (
          <div>
            <span className="font-sans text-[9px] text-revos-text-dim">Days Silent </span>
            <span className={cn('font-mono text-[10px]', engagement.days_silent > 30 ? 'text-revos-red' : 'text-revos-text-mid')}>
              {engagement.days_silent}
            </span>
          </div>
        )}
        {engagement.activity_count != null && (
          <div>
            <span className="font-sans text-[9px] text-revos-text-dim">Activities </span>
            <span className="font-mono text-[10px] text-revos-text-mid">
              {engagement.activity_count}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function CompetitiveCard({ competitive }) {
  if (!competitive) return null
  return (
    <div className="bg-revos-card border border-revos-border border-l-[3px] border-l-revos-yellow rounded-xl p-[14px] shadow-card">
      <div className="font-sans text-[9px] text-revos-text-dim tracking-[0.04em] uppercase mb-[10px]">
        Risk Factors
      </div>
      {competitive.factors && competitive.factors.length > 0 ? (
        <div className="flex flex-col gap-[6px]">
          {competitive.factors.map((f, i) => (
            <div key={i} className="font-sans text-[10px] text-revos-text-mid py-[3px] border-b border-revos-border">
              {f}
            </div>
          ))}
        </div>
      ) : (
        <div className="font-sans text-[11px] text-revos-text-dim">No major risk factors detected</div>
      )}
    </div>
  )
}

function ProductCard({ product }) {
  if (!product) return null
  return (
    <div className="bg-revos-card border border-revos-border border-l-[3px] border-l-revos-blue rounded-xl p-[14px] shadow-card">
      <div className="font-sans text-[9px] text-revos-text-dim tracking-[0.04em] uppercase mb-[10px]">
        Product Strategy
      </div>
      <div className="flex items-center gap-2 mb-[10px]">
        <span className="font-mono text-[13px] font-semibold text-revos-text">{product.primary || '—'}</span>
      </div>
      {product.products && product.products.length > 0 && (
        <div className="flex gap-[6px] flex-wrap">
          {product.products.map((p, i) => (
            <span
              key={i}
              className="text-[10px] font-mono rounded-[4px] px-2 py-[2px]"
              style={{
                background: `${T.blue}15`,
                border: `1px solid ${T.blue}40`,
                color: T.blue,
              }}
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}


// ============================================================
// Score active deals using backtest model data
// ============================================================

function scoreDealsFromAccounts(accounts, backtestResults) {
  const deals = []
  if (!accounts || accounts.length === 0) return deals

  // Build stats from backtest if available
  const hasBacktest = backtestResults && backtestResults.overallWinRate != null

  for (const acc of accounts) {
    // Get active funnel deals (account objects use active_deals, not funnel)
    const funnel = acc.active_deals || acc.funnel || []
    for (const deal of funnel) {
      const mrr = parseFloat(deal.mrr || deal.MRR || deal.amount || 0)
      if (mrr <= 0) continue // skip churn/negative

      const stage = deal.stage || deal.Stage || '—'
      const product = deal.product || deal.Product || acc.products?.[0] || 'Unknown'
      const vertical = acc.vertical || 'Unknown'
      const closeDate = deal.close_date || deal.Close_Date || deal.expected_close || null
      const createdDate = deal.created_date || deal.Created_Date || null

      // Compute days open
      let daysOpen = null
      if (createdDate) {
        const created = new Date(createdDate)
        const now = new Date()
        if (!isNaN(created.getTime())) {
          daysOpen = Math.max(0, (now - created) / 86400000)
        }
      }

      // Win probability — use stage-based heuristic + backtest calibration
      let winProb = 0.5
      const stageLower = stage.toLowerCase()
      if (stageLower.includes('closed won') || stageLower.includes('accepted')) winProb = 0.95
      else if (stageLower.includes('negotiate') || stageLower.includes('contract')) winProb = 0.75
      else if (stageLower.includes('propose') || stageLower.includes('proposal')) winProb = 0.55
      else if (stageLower.includes('design') || stageLower.includes('qualify')) winProb = 0.35
      else if (stageLower.includes('discover') || stageLower.includes('prospect')) winProb = 0.20

      // If backtest results exist, calibrate using vertical win rate
      if (hasBacktest) {
        const vertData = backtestResults.byVertical?.find(v => v.vertical === vertical)
        if (vertData) {
          // Blend stage-based with vertical historical win rate
          winProb = winProb * 0.6 + vertData.winRate * 0.4
        }
      }

      // Risk flags
      const risks = []
      if (daysOpen != null && daysOpen > 120) risks.push('Long sales cycle')
      if (acc.nrr != null && acc.nrr < 0.85) risks.push('Low NRR account')
      if (acc.churn_rate != null && acc.churn_rate > 0.1) risks.push('High churn rate')
      if (mrr > 50000 && winProb < 0.4) risks.push('Large deal at risk')

      // Engagement status
      const daysSilent = acc.days_silent ?? null
      const stalled = daysSilent != null && daysSilent > 30

      deals.push({
        deal_id: `${acc.name}-${product}-${stage}`.replace(/\s+/g, '-'),
        deal_name: `${product} — ${stage}`,
        account_name: acc.name,
        stage,
        amount: mrr,
        product,
        vertical,
        close_date: closeDate,
        days_open: daysOpen,
        prediction: {
          win_probability: Math.max(0.01, Math.min(0.99, winProb)),
          risk_flags: risks,
          trend: daysOpen != null && daysOpen < 30 ? 'up' : daysOpen > 90 ? 'down' : 'flat',
        },
        strategy: {
          pricing: {
            recommended_mrr: mrr,
            sweet_spot: winProb > 0.6 ? 0.05 : 0.12,
            floor_mrr: mrr * 0.85,
            term: mrr > 10000 ? '36 months' : '12 months',
          },
          product: {
            primary: product,
            products: acc.products || [],
          },
          engagement: {
            status: stalled ? 'stalled' : 'on_track',
            next_action: stalled ? 'Re-engage — send exec sponsor outreach' : 'Continue cadence',
            days_silent: daysSilent,
            activity_count: acc.activities?.length || 0,
          },
          competitive: {
            factors: risks,
          },
        },
      })
    }
  }

  return deals
}

// Build calibration data from backtest results
function buildCalibrationFromBacktest(backtestResults) {
  if (!backtestResults || !backtestResults.A || !backtestResults.B) return null
  const { A, B, calibration } = backtestResults
  const winner = (B.brier ?? 1) < (A.brier ?? 1) ? 'B' : 'A'

  // Build calibration curve from backtest calibration buckets
  const calibrationCurve = (calibration || []).map(c => ({
    predicted: winner === 'B' ? c.predB : c.predA,
    actual: c.actual,
    count: c.n,
  }))

  return {
    metrics: {
      '90d': {
        brier_score: winner === 'B' ? B.brier : A.brier,
        calibration_error: Math.abs(mean((calibration || []).map(c => (winner === 'B' ? c.predB : c.predA) - c.actual))),
        auc_roc: winner === 'B' ? B.auc : A.auc,
        close_date_mae_days: null,
      },
    },
    calibration_curve: calibrationCurve,
    drift_alerts: [],
    retrain_log: [],
  }
}

// Build segment data from backtest + accounts
function buildSegmentData(accounts, backtestResults) {
  if (!accounts || accounts.length === 0) return null

  // Product win rates from backtest
  const productWinRates = {}
  if (backtestResults?.byVertical) {
    // Use vertical data as proxy
    for (const v of backtestResults.byVertical) {
      productWinRates[v.vertical] = { win_rate: v.winRate, count: v.count }
    }
  }

  // Rep win rates from accounts
  const repMap = {}
  for (const acc of accounts) {
    const rep = acc.rep || acc.sales_owner || 'Unknown'
    if (!repMap[rep]) repMap[rep] = { deals: 0, won: 0 }
    repMap[rep].deals += (acc.active_deals?.length || acc.funnel?.length || 0)
    // Approximate won deals from NRR
    if (acc.nrr >= 1.0) repMap[rep].won++
  }
  const repWinRates = {}
  for (const [rep, data] of Object.entries(repMap)) {
    if (data.deals >= 1) {
      repWinRates[rep] = { win_rate: data.deals > 0 ? Math.min(1, data.won / Math.max(1, data.deals) + 0.3) : 0.5, count: data.deals }
    }
  }

  return {
    prediction: {
      product_win_rates: productWinRates,
      rep_win_rates: repWinRates,
    },
  }
}


// ============================================================
// Main Component
// ============================================================

export default function EngineDashboard({ accounts, backtestResults }) {
  const [tab, setTab] = useState('strategies')
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [sortField, setSortField] = useState('win_prob')
  const [sortDir, setSortDir] = useState('desc')

  // Score deals from loaded accounts + backtest model
  const strategies = useMemo(
    () => scoreDealsFromAccounts(accounts, backtestResults),
    [accounts, backtestResults]
  )

  const calibration = useMemo(
    () => buildCalibrationFromBacktest(backtestResults),
    [backtestResults]
  )

  const modelParams = useMemo(
    () => buildSegmentData(accounts, backtestResults),
    [accounts, backtestResults]
  )

  const hasTrained = backtestResults != null

  // Persist scored predictions whenever they change
  useEffect(() => {
    if (strategies.length > 0) {
      savePredictions({ strategies, calibration, timestamp: Date.now() })
    }
  }, [strategies, calibration])

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

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
  // No data states
  // ============================================================

  if (!accounts || accounts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="bg-revos-card border border-revos-border rounded-xl p-8 max-w-[520px] w-full shadow-card text-center">
          <div className="font-sans text-[16px] font-bold text-revos-yellow mb-3">
            No Account Data Loaded
          </div>
          <div className="font-sans text-xs text-revos-text-mid mb-4">
            Upload your CSV data files first, then return here to see deal predictions and strategies.
          </div>
          <div className="font-mono text-[10px] text-revos-text-dim">
            Go back to the landing page and upload your data.
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // Main Render
  // ============================================================

  return (
    <div className="p-0">

      {/* Header Bar */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <span className="font-sans text-[16px] font-bold text-revos-text">Prediction Engine</span>
          <Badge color={hasTrained ? T.green : T.yellow}>
            {hasTrained ? '\u25CF CALIBRATED' : '\u25CF STAGE-BASED'}
          </Badge>
          <span className="font-mono text-[10px] text-revos-text-dim">
            {strategies.length} active deals &middot; {accounts.length} accounts
          </span>
        </div>
        {!hasTrained && (
          <div
            className="px-[14px] py-[6px] rounded-xl font-mono text-[10px]"
            style={{
              border: `1px solid ${T.orange}40`,
              background: `${T.orange}10`,
              color: T.orange,
            }}
          >
            Run Backtest Engine first for calibrated predictions
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-revos-surface rounded-xl w-fit">
        <TabBtn active={tab === 'strategies'} label="Deal Strategies" onClick={() => setTab('strategies')} />
        <TabBtn active={tab === 'health'} label="Model Health" onClick={() => setTab('health')} />
        <TabBtn active={tab === 'segments'} label="Segments" onClick={() => setTab('segments')} />
      </div>

      {/* ============================================================ */}
      {/* TAB 1: Deal Strategies                                       */}
      {/* ============================================================ */}
      {tab === 'strategies' && (
        <div>
          {/* Table Header */}
          <div className="grid gap-2 px-3 py-2 mb-[2px]" style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.2fr 0.6fr 0.8fr 0.7fr' }}>
            <ColHeader label="Deal" field="deal" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <ColHeader label="Account" field="account" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <div className="font-sans text-[9px] text-revos-text-dim tracking-[0.04em] uppercase">Stage</div>
            <ColHeader label="Amount" field="amount" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <ColHeader label="Win Prob" field="win_prob" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <div className="font-sans text-[9px] text-revos-text-dim tracking-[0.04em] uppercase">Trend</div>
            <ColHeader label="Close" field="close" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <ColHeader label="Risks" field="risks" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
          </div>

          {/* Table Rows */}
          {sorted.length === 0 && (
            <div className="font-sans text-xs text-revos-text-dim p-6 text-center">
              No active deals found in loaded accounts. Deals with positive MRR in the funnel will appear here.
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
                className="grid gap-2 px-3 py-[10px] items-center rounded-xl mb-1 cursor-pointer transition-[border-color] duration-150"
                style={{
                  gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.2fr 0.6fr 0.8fr 0.7fr',
                  background: isSelected ? `${T.cyan}08` : T.card,
                  border: isSelected ? `1px solid ${T.cyan}` : `1px solid ${T.border}`,
                }}
              >
                <div>
                  <div className="font-sans text-[11px] font-semibold text-revos-text leading-[1.3]">
                    {s.deal_name || '—'}
                  </div>
                  <div className="font-mono text-[9px] text-revos-text-dim">{s.deal_id}</div>
                </div>
                <div className="font-sans text-[11px] text-revos-text-mid">
                  {s.account_name || '—'}
                </div>
                <Badge color={stageColor}>{s.stage || '—'}</Badge>
                <div className="font-mono text-[11px] text-revos-text">
                  {s.amount != null ? $k(s.amount) : '—'}
                </div>
                <div className="flex items-center gap-[6px]">
                  <div className="flex-1 max-w-[60px]">
                    <ProbBar value={wp} color={probColor(wp)} h={5} />
                  </div>
                  <span className="font-mono text-[11px] font-semibold" style={{ color: probColor(wp) }}>
                    {pc(wp)}
                  </span>
                </div>
                <div className="font-mono text-xs text-center">
                  {trend === 'up' && <span className="text-revos-green">▲</span>}
                  {trend === 'down' && <span className="text-revos-red">▼</span>}
                  {trend !== 'up' && trend !== 'down' && <span className="text-revos-text-dim">&ndash;</span>}
                </div>
                <div className="font-mono text-[10px] text-revos-text-mid">
                  {fmtDate(s.close_date)}
                </div>
                <div>
                  {riskCount >= 2 && <Badge color={T.red}>{riskCount} risks</Badge>}
                  {riskCount === 1 && <Badge color={T.orange}>1 risk</Badge>}
                  {riskCount === 0 && <span className="font-mono text-[11px] text-revos-green">{'\u2713'}</span>}
                </div>
              </div>
            )
          })}

          {/* Strategy Card (expanded detail) */}
          {selectedDeal && selectedDeal.strategy && (
            <div className="mt-4">
              <div className="font-sans text-xs font-semibold text-revos-text mb-[10px]">
                Strategy: {selectedDeal.deal_name || selectedDeal.deal_id}
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <PricingCard pricing={selectedDeal.strategy.pricing} />
                <ProductCard product={selectedDeal.strategy.product} />
                <EngagementCard engagement={selectedDeal.strategy.engagement} />
                <CompetitiveCard competitive={selectedDeal.strategy.competitive} />
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
          {!hasTrained ? (
            <div className="bg-revos-card border border-revos-border rounded-xl p-8 text-center shadow-card">
              <div className="font-sans text-sm font-semibold text-revos-yellow mb-2">
                No Backtest Results Available
              </div>
              <div className="font-sans text-xs text-revos-text-mid mb-4">
                Run the Backtest Engine first to get model health metrics. Currently using stage-based heuristic scoring.
              </div>
              <div className="font-mono text-[10px] text-revos-text-dim">
                Go to Backtest Engine → Upload deal history → Run backtest
              </div>
            </div>
          ) : !calibration ? (
            <div className="bg-revos-card border border-revos-border rounded-xl p-8 text-center shadow-card">
              <div className="font-sans text-sm font-semibold text-revos-yellow mb-2">
                Backtest data incomplete
              </div>
              <div className="font-sans text-xs text-revos-text-mid">
                Re-run the Backtest Engine to generate calibration metrics.
              </div>
            </div>
          ) : (
            <>
              {/* Metric Cards */}
              <div className="grid grid-cols-4 gap-3 mb-5">
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
                  label="Winner"
                  value={(backtestResults?.B?.brier ?? 1) < (backtestResults?.A?.brier ?? 1) ? 'Option B' : 'Option A'}
                  color={T.cyan}
                  sub={`${backtestResults?.verticalModelCount || 0} vertical models`}
                />
              </div>

              {/* Calibration Curve */}
              <div className="bg-revos-card border border-revos-border rounded-xl p-4 shadow-card mb-5">
                <div className="font-sans text-[9px] text-revos-text-dim tracking-[0.04em] uppercase mb-3">
                  Calibration Curve
                </div>
                {calibration.calibration_curve && calibration.calibration_curve.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis
                        dataKey="predicted" type="number" domain={[0, 1]}
                        tick={{ fontFamily: chartTheme.font, fontSize: 10, fill: chartTheme.text }}
                        label={{ value: 'Predicted Probability', position: 'insideBottom', offset: -10, fontFamily: chartTheme.font, fontSize: 10, fill: T.textDim }}
                      />
                      <YAxis
                        dataKey="actual" type="number" domain={[0, 1]}
                        tick={{ fontFamily: chartTheme.font, fontSize: 10, fill: chartTheme.text }}
                        label={{ value: 'Actual Win Rate', angle: -90, position: 'insideLeft', offset: 0, fontFamily: chartTheme.font, fontSize: 10, fill: T.textDim }}
                      />
                      <Tooltip contentStyle={chartTheme.tooltip} />
                      <ReferenceLine
                        segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                        stroke={T.textDim} strokeDasharray="4 4" strokeWidth={1}
                      />
                      <Scatter
                        data={calibration.calibration_curve}
                        dataKey="actual" fill={T.cyan}
                        shape={(props) => {
                          const size = Math.max(4, Math.min((props.payload.count || 1) * 2, 14))
                          return (
                            <circle cx={props.cx} cy={props.cy} r={size} fill={T.cyan} fillOpacity={0.7} stroke={T.cyan} strokeWidth={1} />
                          )
                        }}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="font-sans text-[11px] text-revos-text-dim p-5 text-center">
                    No calibration data available yet.
                  </div>
                )}
              </div>

              {/* Backtest Summary */}
              <div className="bg-revos-card border border-revos-border rounded-xl p-4 shadow-card">
                <div className="font-sans text-[9px] text-revos-text-dim tracking-[0.04em] uppercase mb-[10px]">
                  Backtest Summary
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="font-sans text-[10px] text-revos-text-dim mb-[2px]">Train Size</div>
                    <div className="font-mono text-sm font-semibold text-revos-text">{backtestResults.trainSize?.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="font-sans text-[10px] text-revos-text-dim mb-[2px]">Test Size</div>
                    <div className="font-mono text-sm font-semibold text-revos-text">{backtestResults.testSize?.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="font-sans text-[10px] text-revos-text-dim mb-[2px]">Overall Win Rate</div>
                    <div className="font-mono text-sm font-semibold text-revos-text">{pc(backtestResults.overallWinRate)}</div>
                  </div>
                </div>
              </div>
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
            <div className="font-sans text-xs text-revos-text-dim p-6">Loading...</div>
          ) : (
            <>
              {/* Product / Vertical Win Rates */}
              {modelParams.prediction?.product_win_rates && (() => {
                const products = Object.entries(modelParams.prediction.product_win_rates)
                const avgWr = products.length > 0 ? products.reduce((s, [, v]) => s + (v.win_rate || 0), 0) / products.length : 0
                return (
                  <div className="mb-6">
                    <div className="font-sans text-[9px] text-revos-text-dim tracking-[0.04em] uppercase mb-[10px]">
                      Vertical Win Rates
                    </div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                      {products.sort((a, b) => (b[1].win_rate || 0) - (a[1].win_rate || 0)).map(([name, data]) => {
                        const wr = data.win_rate || 0
                        const borderColor = wr > avgWr ? T.green : T.red
                        return (
                          <div
                            key={name}
                            className={cn(
                              'bg-revos-card border border-revos-border border-l-[3px] rounded-xl p-3 shadow-card',
                              wr > avgWr ? 'border-l-revos-green' : 'border-l-revos-red'
                            )}
                          >
                            <div className="flex justify-between items-center mb-[6px]">
                              <span className="font-sans text-[11px] font-semibold text-revos-text">{name}</span>
                              <span className="font-mono text-[9px] text-revos-text-dim">{data.count || 0} deals</span>
                            </div>
                            <ProbBar value={wr} color={borderColor} h={5} />
                            <div className="font-mono text-xs font-semibold mt-1" style={{ color: borderColor }}>
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
                    <div className="font-sans text-[9px] text-revos-text-dim tracking-[0.04em] uppercase mb-[10px]">
                      Rep Win Rates
                    </div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                      {reps.sort((a, b) => (b[1].win_rate || 0) - (a[1].win_rate || 0)).map(([name, data]) => {
                        const wr = data.win_rate || 0
                        const borderColor = wr > avgWr ? T.green : T.red
                        return (
                          <div
                            key={name}
                            className={cn(
                              'bg-revos-card border border-revos-border border-l-[3px] rounded-xl p-3 shadow-card',
                              wr > avgWr ? 'border-l-revos-green' : 'border-l-revos-red'
                            )}
                          >
                            <div className="flex justify-between items-center mb-[6px]">
                              <span className="font-sans text-[11px] font-semibold text-revos-text">{name}</span>
                              <span className="font-mono text-[9px] text-revos-text-dim">{data.count || 0} deals</span>
                            </div>
                            <ProbBar value={wr} color={borderColor} h={5} />
                            <div className="font-mono text-xs font-semibold mt-1" style={{ color: borderColor }}>
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
    </div>
  )
}
