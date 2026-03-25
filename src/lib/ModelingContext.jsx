/**
 * RevOS Modeling Layer — React Context + hooks.
 *
 * Wraps the entire app and exposes computed intelligence to every page.
 * Any dashboard can call useAccountIntel(account, deals) or useDealPrediction(deal)
 * and get predictions, event context, location data, and derived metrics
 * without knowing which engine produced them.
 *
 * Snapshot lifecycle:
 *   1. On mount: load last engine run from backend (or localStorage fallback)
 *   2. Dashboards render instantly from cached data
 *   3. User clicks "Run Engines" -> recompute + save new snapshot
 */

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'

const ModelingContext = createContext(null)

// Stage win probabilities — matches backend canonical values and constants.js
const STAGE_WIN_PROB = {
  'Accepted': 1.0, 'Closed': 1.0, 'Closed Won': 1.0, '5 - Accepted': 1.0,
  'Verbal Agreement': 0.9249, 'Negotiate': 0.8467,
  'Propose': 0.6623, 'Design Solution': 0.5321, 'Discover': 0.3057,
  'Close Lost': 0.0, 'Closed Lost': 0.0,
}

const stageProb = (stage) => {
  const s = (stage || '').trim()
  if (STAGE_WIN_PROB[s] !== undefined) return STAGE_WIN_PROB[s]
  const sl = s.toLowerCase()
  if (sl.includes('accepted') || sl.includes('closed won')) return 1.0
  if (sl.includes('close lost') || sl.includes('lost')) return 0.0
  if (sl.includes('verbal')) return 0.9249
  if (sl.includes('negotiate')) return 0.8467
  if (sl.includes('propose')) return 0.6623
  if (sl.includes('design')) return 0.5321
  if (sl.includes('discover')) return 0.3057
  return 0.1
}

// Calibrated event weights from backtest validation
const EVENT_WEIGHTS = {
  tech_shift_relevance: 0.18844,
  regulatory_tailwind_180d: 0.10232,
  ma_severity_weighted_90d: 0.03470,
  event_density_30d: 0.02046,
  macro_sentiment_90d: 0.01370,
  competitive_pressure_90d: -0.01319,
  ma_proximity_90d: -0.02217,
  outage_count_60d: -0.04695,
}

// Static backtest results from validation
const BACKTEST = {
  brier_improvement: -0.0042,
  cv_folds_won: '5/5',
  p_value: '< 0.0001',
  deals_tested: 22867,
  won_improved_pct: 78.7,
  lost_improved_pct: 14.2,
  overall_improved_pct: 59.4,
  calibrated_weights: EVENT_WEIGHTS,
  modifier_separation: { won_mean: 1.069, lost_mean: 1.040, delta: 0.029 },
}

export function ModelingProvider({ children, eventLedger = [], locationData = {} }) {
  const [snapshot, setSnapshot] = useState(null)
  const [snapshotInfo, setSnapshotInfo] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState(null)
  const [events, setEvents] = useState(eventLedger)
  const [locations, setLocations] = useState(locationData)

  // ---- Load snapshot on mount ----
  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const res = await fetch('/api/modeling/snapshot')
        if (res.ok) {
          const data = await res.json()
          if (data.has_data !== false) {
            setSnapshot(data)
            if (data.events) setEvents(data.events)
            setSnapshotInfo({
              generated_at: data.generated_at,
              metadata: data.metadata,
              has_data: true,
            })
          }
        }
      } catch {
        // Backend not available — try localStorage
        try {
          const stored = localStorage.getItem('revos_modeling_snapshot')
          if (stored) {
            const data = JSON.parse(stored)
            setSnapshot(data)
            if (data.events) setEvents(data.events)
            setSnapshotInfo({
              generated_at: data.generated_at,
              metadata: data.metadata,
              has_data: true,
            })
          }
        } catch { /* no local cache */ }
      }
      setIsLoading(false)
    }
    load()
  }, [])

  // ---- Run Engines (backend) ----
  const runEngines = useCallback(async (accounts, dealsByAccount) => {
    setIsRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/modeling/run-engines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts, deals_by_account: dealsByAccount }),
      })
      if (!res.ok) throw new Error(`Engine run failed: ${res.status}`)
      const data = await res.json()

      setSnapshot(data)
      if (data.events) setEvents(data.events)
      setSnapshotInfo({
        generated_at: data.generated_at,
        metadata: data.metadata,
        has_data: true,
      })

      try { localStorage.setItem('revos_modeling_snapshot', JSON.stringify(data)) }
      catch { /* non-critical */ }

      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsRunning(false)
    }
  }, [])

  // ---- Core computation: event modifier per deal ----
  const computeEventModifier = useCallback((deal) => {
    if (!events.length) return { modifier: 1.0, drivers: [], features: {} }

    const features = deal.event_features || {}
    const score = Object.entries(EVENT_WEIGHTS)
      .reduce((sum, [k, w]) => sum + (features[k] || 0) * w, 0)
    const modifier = Math.max(0.7, Math.min(1.3, 1.0 + score))

    const drivers = Object.entries(EVENT_WEIGHTS)
      .map(([k, w]) => ({
        feature: k, value: features[k] || 0,
        contribution: (features[k] || 0) * w,
        direction: (features[k] || 0) * w > 0 ? 'boost' : 'drag',
      }))
      .filter(d => Math.abs(d.contribution) > 0.003)
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 4)

    return { modifier: Math.round(modifier * 10000) / 10000, drivers, features }
  }, [events])

  // ---- Enrich a single deal ----
  const enrichDeal = useCallback((deal) => {
    const baseProb = stageProb(deal.stage || deal.Stage || '')
    const eventResult = computeEventModifier(deal)
    const adjusted = Math.min(Math.max(baseProb * eventResult.modifier, 0), 1)
    const deltaPct = (adjusted - baseProb) * 100

    return {
      ...deal,
      stage_probability: baseProb,
      event_modifier: eventResult.modifier,
      adjusted_probability: Math.round(adjusted * 10000) / 10000,
      event_drivers: eventResult.drivers,
      event_features: eventResult.features,
      probability_delta: `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`,
      modifier_direction: eventResult.modifier > 1.02 ? 'boost'
        : eventResult.modifier < 0.98 ? 'drag' : 'neutral',
    }
  }, [computeEventModifier])

  // ---- Enrich an account with all its deals ----
  const enrichAccount = useCallback((account, deals) => {
    const enriched = deals.map(enrichDeal)
    const active = enriched.filter(d => d.stage_probability > 0 && d.stage_probability < 1)

    const avgMod = active.length
      ? active.reduce((s, d) => s + d.event_modifier, 0) / active.length : 1.0
    const favorable = active.filter(d => d.event_modifier > 1.02).length
    const unfavorable = active.filter(d => d.event_modifier < 0.98).length

    const wpBase = active.reduce(
      (s, d) => s + (parseFloat(d.mrr || d.MRR || 0)) * d.stage_probability, 0)
    const wpAdj = active.reduce(
      (s, d) => s + (parseFloat(d.mrr || d.MRR || 0)) * d.adjusted_probability, 0)

    let summary = 'No active pipeline deals'
    if (active.length) {
      if (avgMod > 1.05) summary = `Favorable context — ${favorable} of ${active.length} deals boosted`
      else if (avgMod < 0.97) summary = `Headwind context — ${unfavorable} of ${active.length} deals dragging`
      else summary = `Neutral context across ${active.length} active deals`
    }

    return {
      ...account,
      avg_event_modifier: Math.round(avgMod * 10000) / 10000,
      event_context_summary: summary,
      deal_predictions: enriched,
      favorable_events: favorable,
      unfavorable_events: unfavorable,
      weighted_pipeline_base: Math.round(wpBase * 100) / 100,
      weighted_pipeline_adjusted: Math.round(wpAdj * 100) / 100,
      pipeline_delta: Math.round((wpAdj - wpBase) * 100) / 100,
    }
  }, [enrichDeal])

  // ---- Run Engines locally (demo mode / no backend) ----
  const runEnginesLocal = useCallback((accounts, allDeals) => {
    setIsRunning(true)
    try {
      const enrichedAccounts = accounts.map(acct => {
        const acctName = acct.name || acct.account || acct['Customer Account'] || ''
        const acctDeals = allDeals.filter(d =>
          (d.account || d['Customer Account'] || '') === acctName)
        return enrichAccount(acct, acctDeals)
      })

      // ---- Product Affinity Heuristic ----
      // Analyze what products accounts in the same vertical/market typically buy
      // to identify whitespace (products they should have but don't)
      const verticalProductMix = {}
      const marketProductMix = {}

      for (const acct of accounts) {
        const vertical = acct.vertical || acct.mega_vertical || 'Unknown'
        const locs = acct.locations || []
        const market = (locs[0]?.market || locs[0]?.city || locs[0]?.name || 'Unknown').split(',')[0].trim()
        const products = acct.products || []
        const services = acct.services || []

        if (!verticalProductMix[vertical]) verticalProductMix[vertical] = {}
        if (!marketProductMix[market]) marketProductMix[market] = {}

        // Count products from services (more granular) and fallback to products array
        const counted = new Set()
        for (const svc of services) {
          const p = svc.product || 'Unknown'
          if (p === 'Unknown') continue
          verticalProductMix[vertical][p] = (verticalProductMix[vertical][p] || 0) + 1
          marketProductMix[market][p] = (marketProductMix[market][p] || 0) + 1
          counted.add(p.toLowerCase())
        }
        for (const p of products) {
          if (counted.has(p.toLowerCase())) continue
          verticalProductMix[vertical][p] = (verticalProductMix[vertical][p] || 0) + 1
          marketProductMix[market][p] = (marketProductMix[market][p] || 0) + 1
        }
      }

      // Second pass: compute loc_product_affinity per account
      const finalAccounts = enrichedAccounts.map(acct => {
        const vertical = acct.vertical || acct.mega_vertical || 'Unknown'
        const locs = acct.locations || []
        const market = (locs[0]?.market || locs[0]?.city || locs[0]?.name || 'Unknown').split(',')[0].trim()

        const vertMix = verticalProductMix[vertical] || {}
        const mktMix = marketProductMix[market] || {}
        const currentProducts = new Set((acct.products || []).map(p => p.toLowerCase()))
        // Also include products from active services
        for (const svc of (acct.services || [])) {
          if (svc.product) currentProducts.add(svc.product.toLowerCase())
        }

        const allProducts = new Set([...Object.keys(vertMix), ...Object.keys(mktMix)])
        const vertTotal = Object.values(vertMix).reduce((s, v) => s + v, 0) || 1
        const mktTotal = Object.values(mktMix).reduce((s, v) => s + v, 0) || 1

        const affinity = {}
        for (const p of allProducts) {
          if (currentProducts.has(p.toLowerCase())) continue
          const vertScore = (vertMix[p] || 0) / vertTotal
          const mktScore = (mktMix[p] || 0) / mktTotal
          const combined = vertScore * 0.6 + mktScore * 0.4
          if (combined > 0.05) {
            affinity[p] = Math.round(combined * 100) / 100
          }
        }

        return { ...acct, loc_product_affinity: affinity }
      })

      const enrichedDeals = finalAccounts.flatMap(a => a.deal_predictions || [])

      const data = {
        version: 1,
        generated_at: new Date().toISOString(),
        engine_versions: {
          prediction: 'bayesian_beta_v1',
          event_context: 'calibrated_v1',
          location_intel: 'heuristic_v1',
        },
        metadata: {
          total_accounts: finalAccounts.length,
          total_deals: enrichedDeals.length,
        },
        accounts: finalAccounts,
        deals: enrichedDeals,
        events,
        backtest: BACKTEST,
      }

      setSnapshot(data)
      setSnapshotInfo({ generated_at: data.generated_at, metadata: data.metadata, has_data: true })

      try { localStorage.setItem('revos_modeling_snapshot', JSON.stringify(data)) }
      catch { /* non-critical */ }

      return data
    } finally {
      setIsRunning(false)
    }
  }, [events, enrichAccount])

  // ---- Snapshot lookup helpers ----
  const getEnrichedAccount = useCallback((accountName) => {
    if (!snapshot?.accounts) return null
    return snapshot.accounts.find(a =>
      (a.name || a.account || a['Customer Account'] || '') === accountName
    ) || null
  }, [snapshot])

  const getEnrichedDeal = useCallback((dealId) => {
    if (!snapshot?.deals) return null
    return snapshot.deals.find(d =>
      (d.opportunity_id || d.Opportunity_Id || d.id) === dealId
    ) || null
  }, [snapshot])

  // ---- Staleness ----
  const lastRunAge = useMemo(() => {
    if (!snapshotInfo?.generated_at) return null
    const ms = Date.now() - new Date(snapshotInfo.generated_at).getTime()
    const hours = Math.floor(ms / 3600000)
    const mins = Math.floor((ms % 3600000) / 60000)
    if (hours > 24) return `${Math.floor(hours / 24)}d ago`
    if (hours > 0) return `${hours}h ${mins}m ago`
    return `${mins}m ago`
  }, [snapshotInfo])

  const isStale = useMemo(() => {
    if (!snapshotInfo?.generated_at) return true
    return Date.now() - new Date(snapshotInfo.generated_at).getTime() > 24 * 3600000
  }, [snapshotInfo])

  // ---- Context value ----
  const value = useMemo(() => ({
    // Core functions
    enrichDeal,
    enrichAccount,
    stageProb,
    computeEventModifier,

    // Snapshot data
    snapshot,
    snapshotInfo,
    getEnrichedAccount,
    getEnrichedDeal,

    // Engine controls
    runEngines,
    runEnginesLocal,
    isLoading,
    isRunning,
    isStale,
    lastRunAge,
    error,

    // Data
    events,
    setEvents,
    locations,
    setLocations,

    // Constants
    STAGE_WIN_PROB,
    EVENT_WEIGHTS,
    BACKTEST,

    // Utilities
    getActiveEvents: (lookbackDays = 90) => {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - lookbackDays)
      return events.filter(e => new Date(e.event_date) >= cutoff)
    },
  }), [enrichDeal, enrichAccount, computeEventModifier, events, locations,
       snapshot, snapshotInfo, getEnrichedAccount, getEnrichedDeal,
       runEngines, runEnginesLocal, isLoading, isRunning, isStale, lastRunAge, error])

  return (
    <ModelingContext.Provider value={value}>
      {children}
    </ModelingContext.Provider>
  )
}

// ---- Hooks for dashboards to consume ----

/** Full modeling context */
export const useModeling = () => {
  const ctx = useContext(ModelingContext)
  if (!ctx) throw new Error('useModeling must be used within ModelingProvider')
  return ctx
}

/** Get enriched deal data — use in deal cards, tables, detail views */
export const useDealPrediction = (deal) => {
  const { enrichDeal } = useModeling()
  return useMemo(() => deal ? enrichDeal(deal) : null, [deal, enrichDeal])
}

/** Get enriched account data — use in account overview, health scores */
export const useAccountIntel = (account, deals) => {
  const { enrichAccount } = useModeling()
  return useMemo(() => account ? enrichAccount(account, deals || []) : null, [account, deals, enrichAccount])
}

/** Get stage probability */
export const useStageProb = () => {
  const { stageProb: sp } = useModeling()
  return sp
}

/** Get event feed */
export const useEventFeed = (lookbackDays = 90) => {
  const { getActiveEvents } = useModeling()
  return useMemo(() => getActiveEvents(lookbackDays), [getActiveEvents, lookbackDays])
}

/** Get backtest results */
export const useBacktest = () => {
  const { BACKTEST: bt } = useModeling()
  return bt
}

/** Get engine run status and controls */
export const useEngineStatus = () => {
  const { isLoading, isRunning, isStale, lastRunAge, error, snapshotInfo,
          runEngines, runEnginesLocal } = useModeling()
  return { isLoading, isRunning, isStale, lastRunAge, error, snapshotInfo,
           runEngines, runEnginesLocal }
}

/** Get pre-computed account from last snapshot */
export const useCachedAccount = (accountName) => {
  const { getEnrichedAccount } = useModeling()
  return useMemo(() => getEnrichedAccount(accountName), [accountName, getEnrichedAccount])
}

/** Get pre-computed deal from last snapshot */
export const useCachedDeal = (dealId) => {
  const { getEnrichedDeal } = useModeling()
  return useMemo(() => getEnrichedDeal(dealId), [dealId, getEnrichedDeal])
}

/** Get all enriched accounts from snapshot */
export const useAllEnrichedAccounts = () => {
  const { snapshot } = useModeling()
  return snapshot?.accounts || []
}

/** Get all enriched deals from snapshot */
export const useAllEnrichedDeals = () => {
  const { snapshot } = useModeling()
  return snapshot?.deals || []
}

/** Get location intelligence for an account from the snapshot */
export const useAccountLocations = (accountName) => {
  const account = useCachedAccount(accountName)
  if (!account) return null
  return {
    locationCount: account.loc_location_count || 0,
    geographicSpread: account.loc_geographic_spread || 0,
    hasDataCenter: account.loc_has_data_center || false,
    metroDensity: account.loc_metro_density || 0,
    footprintScore: account.loc_footprint_score || 0,
    productAffinity: account.loc_product_affinity || {},
    locations: account.loc_locations || [],
    growthSignal: account.loc_growth_signal || 0,
  }
}

/** Get location-based product recommendations */
export const useLocationProductAffinity = (accountName) => {
  const locs = useAccountLocations(accountName)
  if (!locs) return []
  return Object.entries(locs.productAffinity)
    .sort(([, a], [, b]) => b - a)
    .map(([product, score]) => ({ product, score }))
}
