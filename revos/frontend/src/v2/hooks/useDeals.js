import { useMemo } from 'react'

/**
 * Shared hook: extracts pipeline deals from account objects.
 * Works with both V1 and V2 pages.
 *
 * @param {Array} accounts - Account objects from useAccounts/useLocalData
 * @returns {{ deals: Array, byStage: Object, totalMRR: number }}
 */
export default function useDeals(accounts = []) {
  return useMemo(() => {
    const deals = []
    const byStage = {}

    for (const acct of accounts) {
      const pipeline = acct.pipeline || acct.active_deals || []
      for (const deal of pipeline) {
        const d = { ...deal, accountName: acct.name }
        deals.push(d)
        const stage = d.stage || 'Unknown'
        if (!byStage[stage]) byStage[stage] = []
        byStage[stage].push(d)
      }
    }

    const totalMRR = deals.reduce((sum, d) => sum + (d.mrr || 0), 0)

    return { deals, byStage, totalMRR }
  }, [accounts])
}
