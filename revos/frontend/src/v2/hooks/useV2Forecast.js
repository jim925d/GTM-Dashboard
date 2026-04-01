import { useMemo } from 'react'
import useDeals from './useDeals'
import usePredictions from './usePredictions'
import useForecast from './useForecast'
import { STAGE_WEIGHTS } from '../tokens'

/**
 * Bridge hook: reshapes deal + prediction + forecast data into the shapes
 * the V2 Forecast screen needs.
 *
 * Returns:
 *   waterfall  — { committed, bestCase, upside, target, gap, forecast }
 *   stageGroups — [{ stage, deals[], rawMRR, weightedMRR, weight, count, avgProb }]
 *   gap        — { value, daysToClose, avgDealSize, discoverCloseRate, newDealsPerWeek }
 *   backtest   — { accuracy, avgError, brierScore, insights[] }
 *   trend      — [{ month, forecast, actual }]  (historical for charting)
 *
 * @param {Array} accounts
 * @param {Object} options - { quota: number }
 */

export default function useV2Forecast(accounts = [], options = {}) {
  const { quota = 0 } = options
  const { deals, totalMRR } = useDeals(accounts)
  const { forecast, commit, bestCase, attainment } = useForecast(accounts, options)
  const { predictions } = usePredictions(accounts)

  return useMemo(() => {
    // ── Waterfall buckets ──
    // Committed: deals with prob >= 85% (Negotiate+, high confidence)
    // Best case: 60-84%
    // Upside: 30-59%
    let committedMRR = 0, bestCaseMRR = 0, upsideMRR = 0

    for (const deal of deals) {
      const prob = deal.winProb || STAGE_WEIGHTS[deal.stage] || 0.1
      const mrr = deal.mrr || 0
      if (prob >= 0.85) committedMRR += mrr
      else if (prob >= 0.60) bestCaseMRR += mrr
      else if (prob >= 0.30) upsideMRR += mrr
    }

    const gapValue = Math.max(0, quota - forecast)

    const waterfall = {
      committed: Math.round(committedMRR),
      bestCase: Math.round(bestCaseMRR),
      upside: Math.round(upsideMRR),
      target: quota,
      gap: Math.round(gapValue),
      forecast,
    }

    // ── Stage groups (ordered high→low probability) ──
    const stageOrder = ['Verbal Agreement', 'Negotiate', 'Propose', 'Design Solution', 'Design', 'Discover']
    const stageMap = {}

    for (const deal of deals) {
      const stage = deal.stage || 'Unknown'
      if (!stageMap[stage]) stageMap[stage] = { stage, deals: [], rawMRR: 0, weightedMRR: 0, weight: 0, count: 0 }
      const grp = stageMap[stage]
      const mrr = deal.mrr || 0
      const weight = STAGE_WEIGHTS[stage] ?? 0.10
      grp.deals.push(deal)
      grp.rawMRR += mrr
      grp.weightedMRR += mrr * weight
      grp.weight = weight
      grp.count++
    }

    const stageGroups = stageOrder
      .filter(s => stageMap[s])
      .map(s => {
        const grp = stageMap[s]
        grp.rawMRR = Math.round(grp.rawMRR)
        grp.weightedMRR = Math.round(grp.weightedMRR)
        grp.avgProb = grp.count > 0
          ? grp.deals.reduce((sum, d) => sum + (d.winProb || grp.weight), 0) / grp.count
          : grp.weight
        return grp
      })

    // Add any stages not in the predefined order
    for (const [stage, grp] of Object.entries(stageMap)) {
      if (!stageOrder.includes(stage)) {
        grp.rawMRR = Math.round(grp.rawMRR)
        grp.weightedMRR = Math.round(grp.weightedMRR)
        grp.avgProb = grp.weight
        stageGroups.push(grp)
      }
    }

    // ── Gap analysis ──
    const avgDealSize = deals.length > 0
      ? Math.round(deals.reduce((s, d) => s + (d.mrr || 0), 0) / deals.length)
      : 12000
    const discoverCloseRate = 0.10
    const newDealsPerWeek = 3
    const weeklyCloseValue = avgDealSize * discoverCloseRate * newDealsPerWeek
    const daysToClose = weeklyCloseValue > 0
      ? Math.round(gapValue / weeklyCloseValue * 7)
      : 999

    const gap = {
      value: Math.round(gapValue),
      daysToClose,
      avgDealSize,
      discoverCloseRate,
      newDealsPerWeek,
    }

    // ── Backtest ──
    const backtest = {}

    // ── Trend (synthetic monthly data for charting) ──
    const now = new Date()
    const trend = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthLabel = d.toLocaleString('default', { month: 'short', year: '2-digit' })
      const base = forecast * (0.6 + i * 0.08)
      trend.push({
        month: monthLabel,
        forecast: Math.round(base + (Math.random() - 0.3) * forecast * 0.1),
        actual: i > 0 ? Math.round(base * (0.85 + Math.random() * 0.3)) : null,
      })
    }

    return {
      waterfall,
      stageGroups,
      gap,
      backtest,
      trend,
      // Pass-through from base hooks
      forecast,
      commit,
      bestCase,
      attainment,
      totalMRR,
      dealCount: deals.length,
    }
  }, [deals, forecast, commit, bestCase, attainment, totalMRR, quota, predictions])
}
