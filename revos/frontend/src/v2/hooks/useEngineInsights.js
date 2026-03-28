import { useMemo } from 'react'

/**
 * Shared hook: aggregates engine signals across accounts.
 * Surfaces outage, location, prediction, and event engine results.
 *
 * @param {Array} accounts - Account objects from useAccounts/useLocalData
 * @returns {{ insights: Array, byEngine: Object, totalSignals: number }}
 */
export default function useEngineInsights(accounts = []) {
  return useMemo(() => {
    const insights = []
    const byEngine = {
      outage: [],
      location: [],
      prediction: [],
      event: [],
    }

    for (const acct of accounts) {
      const signals = acct.signals || []
      for (const signal of signals) {
        const entry = { ...signal, accountName: acct.name }
        insights.push(entry)

        const engine = (signal.engine || signal.type || 'event').toLowerCase()
        if (byEngine[engine]) {
          byEngine[engine].push(entry)
        } else {
          byEngine.event.push(entry)
        }
      }
    }

    return {
      insights,
      byEngine,
      totalSignals: insights.length,
    }
  }, [accounts])
}
