import { useState, useCallback } from 'react'
import { API_BASE } from '../lib/constants'

export default function useClaudeAPI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const runBayesian = useCallback(async (accountId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/analyze/bayesian/${encodeURIComponent(accountId)}`, { method: 'POST' })
      if (!res.ok) throw new Error(`Bayesian analysis failed: ${res.statusText}`)
      return await res.json()
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const runGameTheory = useCallback(async (accountId, dealIndex) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/analyze/game-theory/${encodeURIComponent(accountId)}/${dealIndex}`, { method: 'POST' })
      if (!res.ok) throw new Error(`Game theory analysis failed: ${res.statusText}`)
      return await res.json()
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const runSignals = useCallback(async (accountId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/analyze/signals/${encodeURIComponent(accountId)}`, { method: 'POST' })
      if (!res.ok) throw new Error(`Signal analysis failed: ${res.statusText}`)
      return await res.json()
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const runBacktest = useCallback(async (accountId, cutoffDate) => {
    setLoading(true)
    setError(null)
    try {
      const url = `${API_BASE}/backtest/${encodeURIComponent(accountId)}${cutoffDate ? `?cutoff_date=${cutoffDate}` : ''}`
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) throw new Error(`Backtest failed: ${res.statusText}`)
      return await res.json()
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const runLearningCurve = useCallback(async (accountId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/learning-curve/${encodeURIComponent(accountId)}`, { method: 'POST' })
      if (!res.ok) throw new Error(`Learning curve failed: ${res.statusText}`)
      return await res.json()
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, runBayesian, runGameTheory, runSignals, runBacktest, runLearningCurve }
}
