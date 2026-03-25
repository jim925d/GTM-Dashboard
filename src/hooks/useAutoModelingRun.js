/**
 * Auto-triggers the modeling engine (local mode) when accounts are loaded
 * but no snapshot exists yet. Runs once per session.
 */
import { useEffect, useRef } from 'react'
import { useEngineStatus, useAllEnrichedAccounts } from '../lib/ModelingContext'

export default function useAutoModelingRun(accounts) {
  const { runEnginesLocal, isRunning, isLoading } = useEngineStatus()
  const enriched = useAllEnrichedAccounts()
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    if (isLoading || isRunning) return
    if (!accounts || accounts.length === 0) return
    if (enriched.length > 0) return // snapshot already exists

    hasRun.current = true
    const allDeals = accounts.flatMap(a => a.active_deals || [])
    runEnginesLocal(accounts, allDeals)
  }, [accounts, enriched, isLoading, isRunning, runEnginesLocal])
}
