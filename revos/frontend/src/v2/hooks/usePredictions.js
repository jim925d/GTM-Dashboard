import { useMemo } from 'react'

/**
 * Shared hook: extracts prediction/scoring data from account objects.
 * Surfaces churn probability, premier scores, and win rates.
 *
 * @param {Array} accounts - Account objects from useAccounts/useLocalData
 * @returns {{ predictions: Array, avgChurnRisk: number, avgPremierScore: number }}
 */
export default function usePredictions(accounts = []) {
  return useMemo(() => {
    const predictions = accounts.map((acct) => ({
      name: acct.name,
      churnProbability: acct.churnProbability ?? null,
      premierScore: acct.premierScore ?? null,
      winRate: acct.winRate ?? null,
      signals: acct.signals || [],
    }))

    const withChurn = predictions.filter((p) => p.churnProbability !== null)
    const avgChurnRisk =
      withChurn.length > 0
        ? withChurn.reduce((s, p) => s + p.churnProbability, 0) / withChurn.length
        : 0

    const withScore = predictions.filter((p) => p.premierScore !== null)
    const avgPremierScore =
      withScore.length > 0
        ? withScore.reduce((s, p) => s + p.premierScore, 0) / withScore.length
        : 0

    return { predictions, avgChurnRisk, avgPremierScore }
  }, [accounts])
}
