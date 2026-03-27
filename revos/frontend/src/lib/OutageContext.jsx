/**
 * Outage Engine — React Context + hooks.
 *
 * Follows the same pattern as ModelingContext.jsx:
 *   1. On mount: load last fetch from localStorage (or demo fallback)
 *   2. Dashboard renders instantly from cached data
 *   3. Auto-refresh if data is stale (>12h)
 *   4. User clicks "Refresh" → fetch fresh data from APIs
 *
 * Any dashboard can call useOutageData() and get outage records,
 * filtered views, loading state, and refresh controls.
 */

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import { fetchAndNormalizeOutages } from './outageEngine'
import { DEMO_OUTAGES } from './outageDemo'

const OutageContext = createContext(null)

const STORAGE_KEY = 'revos_outage_snapshot'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('[OutageContext] Storage save failed:', e)
  }
}

export function OutageProvider({ children }) {
  const [outages, setOutages] = useState([])
  const [lastFetched, setLastFetched] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [meta, setMeta] = useState({
    cloudflareCount: 0, iodaCount: 0, totalCount: 0, errors: [],
  })

  // ── Hydrate: try pre-scraped outages.json first, then localStorage, then demo ──
  useEffect(() => {
    async function hydrate() {
      // Try pre-scraped file from daily cron
      try {
        const res = await window.fetch('/local-data/outages.json')
        if (res.ok) {
          const snapshot = await res.json()
          if (snapshot?.outages?.length) {
            setOutages(snapshot.outages)
            setLastFetched(snapshot.lastFetched)
            setMeta(snapshot.meta || { cloudflareCount: 0, iodaCount: 0, totalCount: 0, errors: [] })
            saveToStorage(snapshot)
            return
          }
        }
      } catch { /* file not available, fall through */ }

      // Fall back to localStorage cache
      const cached = loadFromStorage()
      if (cached?.outages?.length) {
        setOutages(cached.outages)
        setLastFetched(cached.lastFetched)
        setMeta(cached.meta || { cloudflareCount: 0, iodaCount: 0, totalCount: 0, errors: [] })
      } else {
        setOutages(DEMO_OUTAGES)
        setLastFetched(null)
      }
    }
    hydrate()
  }, [])

  // ── Refresh: fetch from APIs, normalize, persist ──
  const refreshOutages = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchAndNormalizeOutages()
      const snapshot = {
        outages: result.outages,
        lastFetched: new Date().toISOString(),
        meta: result.meta,
      }

      setOutages(result.outages.length > 0 ? result.outages : DEMO_OUTAGES)
      setLastFetched(snapshot.lastFetched)
      setMeta(result.meta)

      if (result.outages.length > 0) {
        saveToStorage(snapshot)
      }
    } catch (e) {
      setError(e.message)
      console.error('[OutageContext] Refresh failed:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── Auto-refresh if stale (>12 hours) ──
  useEffect(() => {
    if (!lastFetched) {
      refreshOutages()
      return
    }
    const ageMs = Date.now() - new Date(lastFetched).getTime()
    if (ageMs > 12 * 60 * 60 * 1000) {
      refreshOutages()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Staleness info for UI ──
  const lastRunAge = useMemo(() => {
    if (!lastFetched) return null
    const ms = Date.now() - new Date(lastFetched).getTime()
    const hours = Math.floor(ms / 3600000)
    const mins = Math.floor((ms % 3600000) / 60000)
    if (hours > 24) return `${Math.floor(hours / 24)}d ago`
    if (hours > 0) return `${hours}h ${mins}m ago`
    return `${mins}m ago`
  }, [lastFetched])

  const isStale = useMemo(() => {
    if (!lastFetched) return true
    return Date.now() - new Date(lastFetched).getTime() > 24 * 60 * 60 * 1000
  }, [lastFetched])

  // ── Filtered views ──
  const getFiltered = useCallback((filter) => {
    if (filter === 'current') return outages.filter(o => o.status === 'active')
    return outages // "30d" = all
  }, [outages])

  const activeOutages = useMemo(() => outages.filter(o => o.status === 'active'), [outages])
  const resolvedOutages = useMemo(() => outages.filter(o => o.status === 'resolved'), [outages])

  // ── Severity counts ──
  const severityCounts = useMemo(() => {
    const active = outages.filter(o => o.status === 'active')
    return {
      high: active.filter(o => o.severity === 'high').length,
      medium: active.filter(o => o.severity === 'medium').length,
      low: active.filter(o => o.severity === 'low').length,
      total: active.length,
    }
  }, [outages])

  // ── Context value ──
  const value = useMemo(() => ({
    // Data
    outages,
    activeOutages,
    resolvedOutages,
    getFiltered,
    meta,
    severityCounts,

    // State
    isLoading,
    error,
    lastFetched,
    lastRunAge,
    isStale,

    // Actions
    refreshOutages,
  }), [outages, activeOutages, resolvedOutages, getFiltered, meta, severityCounts,
       isLoading, error, lastFetched, lastRunAge, isStale, refreshOutages])

  return (
    <OutageContext.Provider value={value}>
      {children}
    </OutageContext.Provider>
  )
}

// ── Hook for any dashboard to consume ──

export const useOutageData = () => {
  const ctx = useContext(OutageContext)
  if (!ctx) throw new Error('useOutageData must be used within OutageProvider')
  return ctx
}
