import { useMemo } from 'react'

/**
 * Shared hook: extracts location data from account objects.
 * Provides enriched location counts and geo distribution.
 *
 * @param {Array} accounts - Account objects from useAccounts/useLocalData
 * @returns {{ locations: Array, totalLocations: number, byState: Object }}
 */
export default function useLocations(accounts = []) {
  return useMemo(() => {
    const locations = []
    const byState = {}

    for (const acct of accounts) {
      const locs = acct.locations || []
      for (const loc of locs) {
        const l = { ...loc, accountName: acct.name }
        locations.push(l)
        const state = l.state || l.region || 'Unknown'
        byState[state] = (byState[state] || 0) + 1
      }
    }

    return { locations, totalLocations: locations.length, byState }
  }, [accounts])
}
