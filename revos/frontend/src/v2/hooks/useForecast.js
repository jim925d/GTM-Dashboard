import { useMemo } from 'react'

/**
 * Shared hook: computes forecast metrics from accounts and pipeline.
 * Stage-weighted forecast, commit, best case, and attainment.
 *
 * @param {Array} accounts - Account objects from useAccounts/useLocalData
 * @param {Object} options - { quota: number }
 * @returns {{ forecast: number, commit: number, bestCase: number, attainment: number }}
 */

const STAGE_WEIGHTS = {
  'Discover': 0.10,
  'Design': 0.25,
  'Design Solution': 0.25,
  'Propose': 0.50,
  'Negotiate': 0.75,
  'Closed Won': 1.00,
}

export default function useForecast(accounts = [], options = {}) {
  const { quota = 0 } = options

  return useMemo(() => {
    let forecast = 0
    let commit = 0
    let bestCase = 0

    for (const acct of accounts) {
      const pipeline = acct.pipeline || []
      for (const deal of pipeline) {
        const mrr = deal.mrr || 0
        const stage = deal.stage || ''
        const weight = STAGE_WEIGHTS[stage] ?? 0.10

        const weighted = mrr * weight
        forecast += weighted
        bestCase += mrr

        // Commit = Negotiate + Closed Won
        if (weight >= 0.75) commit += mrr
      }
    }

    const attainment = quota > 0 ? (forecast / quota) * 100 : 0

    return {
      forecast: Math.round(forecast),
      commit: Math.round(commit),
      bestCase: Math.round(bestCase),
      attainment: Math.round(attainment * 10) / 10,
    }
  }, [accounts, quota])
}
