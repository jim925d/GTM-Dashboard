/**
 * Auto-triggers the modeling engine (local mode) when:
 *   - Accounts are loaded but no snapshot exists yet, OR
 *   - The snapshot was produced by an older engine version (stale)
 * Runs once per session.
 */
import { useEffect, useRef } from 'react'
import { useEngineStatus, useAllEnrichedAccounts } from '../lib/ModelingContext'
import { ENGINE_VERSION } from '../lib/persistenceLayer'

export default function useAutoModelingRun(accounts) {
  const { runEnginesLocal, isRunning, isLoading, snapshotInfo } = useEngineStatus()
  const enriched = useAllEnrichedAccounts()
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    if (isLoading || isRunning) return
    if (!accounts || accounts.length === 0) return

    // Check if snapshot exists and is fresh
    const hasSnapshot = enriched.length > 0
    const engineStale = snapshotInfo?.metadata?.engine_version &&
      snapshotInfo.metadata.engine_version !== ENGINE_VERSION

    if (hasSnapshot && !engineStale) return // snapshot exists and engine version matches

    hasRun.current = true
    const allDeals = accounts.flatMap(a => a.active_deals || [])
    runEnginesLocal(accounts, allDeals)
  }, [accounts, enriched, isLoading, isRunning, runEnginesLocal, snapshotInfo])
}
