import { useState, useCallback, useMemo } from 'react'
import V2Layout from './V2Layout'
import V2Dashboard from './pages/V2Dashboard'
import V2Pipeline from './pages/V2Pipeline'
import V2DealDetail from './pages/V2DealDetail'
import V2TargetList from './pages/V2TargetList'
import V2Forecast from './pages/V2Forecast'
import { DEMO_ACCOUNTS, DEMO_DEALS, DEMO_TEAM, DEMO_REPS, DEMO_QUOTA } from './demoData'
import useDeals from './hooks/useDeals'

/**
 * V2 shell — manages sub-page routing, team filter, and quota within the V2 experience.
 * Receives accounts from the parent App so shared hooks can consume them.
 */
export default function V2App({ accounts = [], rawData = {}, onBack }) {
  const [activePage, setActivePage] = useState('v2-dashboard')
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [dealBackLabel, setDealBackLabel] = useState('Pipeline')

  // ── Team filter state ──────────────────────────────────────────
  // scope: 'team' (all) | '1lm' | 'rep'
  const [filterScope, setFilterScope] = useState('team')
  const [filterValue, setFilterValue] = useState(null)

  // ── Quota state (editable) ─────────────────────────────────────
  const [quota, setQuota] = useState(DEMO_QUOTA)

  // ── Determine real vs demo ─────────────────────────────────────
  const { deals: realDeals } = useDeals(accounts)
  const isDemo = !realDeals.length
  const baseAccounts = isDemo ? DEMO_ACCOUNTS : accounts

  // ── Derive team hierarchy ──────────────────────────────────────
  const team = useMemo(() => {
    if (isDemo) return DEMO_TEAM
    // Build from real accounts: unique managers grouped (treat each manager as a rep, all under one team)
    const mgrs = [...new Set(baseAccounts.map(a => a.manager).filter(Boolean))]
    return [{ name: 'All Managers', role: '1lm', reps: mgrs }]
  }, [isDemo, baseAccounts])

  const reps = useMemo(() => {
    if (isDemo) return DEMO_REPS
    return [...new Set(baseAccounts.map(a => a.manager).filter(Boolean))]
  }, [isDemo, baseAccounts])

  // Also get rep list from deals for demo deals that have a rep field
  const dealReps = useMemo(() => {
    const allDeals = isDemo ? DEMO_DEALS : realDeals
    return [...new Set(allDeals.map(d => d.rep).filter(Boolean))]
  }, [isDemo, realDeals])

  // Merge reps from accounts + deals
  const allReps = useMemo(() => [...new Set([...reps, ...dealReps])], [reps, dealReps])

  // ── Filter accounts ────────────────────────────────────────────
  const filteredAccounts = useMemo(() => {
    if (filterScope === 'team') return baseAccounts
    if (filterScope === '1lm' && filterValue) {
      const mgr = team.find(t => t.name === filterValue)
      if (!mgr) return baseAccounts
      return baseAccounts.filter(a => mgr.reps.includes(a.manager))
    }
    if (filterScope === 'rep' && filterValue) {
      return baseAccounts.filter(a => a.manager === filterValue)
    }
    return baseAccounts
  }, [baseAccounts, filterScope, filterValue, team])

  const handleSelectDeal = useCallback((deal, fromLabel) => {
    setSelectedDeal(deal)
    setDealBackLabel(fromLabel || 'Pipeline')
    setActivePage('v2-deal-detail')
  }, [])

  const handleBackFromDeal = useCallback(() => {
    setSelectedDeal(null)
    setActivePage(dealBackLabel === 'Dashboard' ? 'v2-dashboard' : 'v2-pipeline')
  }, [dealBackLabel])

  const handleNavigate = useCallback((page) => {
    setSelectedDeal(null)
    setActivePage(page)
  }, [])

  const handleFilterChange = useCallback((scope, value) => {
    setFilterScope(scope)
    setFilterValue(value)
  }, [])

  const renderPage = () => {
    if (activePage === 'v2-deal-detail' && selectedDeal) {
      return <V2DealDetail deal={selectedDeal} accounts={filteredAccounts} onBack={handleBackFromDeal} backLabel={dealBackLabel} />
    }
    switch (activePage) {
      case 'v2-pipeline':
        return <V2Pipeline accounts={filteredAccounts} rawData={rawData} onSelectDeal={handleSelectDeal} />
      case 'v2-targets':
        return <V2TargetList accounts={filteredAccounts} rawData={rawData} />
      case 'v2-forecast':
        return <V2Forecast accounts={filteredAccounts} rawData={rawData} quota={quota} onQuotaChange={setQuota} />
      case 'v2-dashboard':
      default:
        return <V2Dashboard accounts={filteredAccounts} rawData={rawData} onNavigate={handleNavigate} onSelectDeal={handleSelectDeal} />
    }
  }

  return (
    <V2Layout
      activePage={activePage}
      onNavigate={handleNavigate}
      onBack={onBack}
      filterScope={filterScope}
      filterValue={filterValue}
      onFilterChange={handleFilterChange}
      team={team}
      reps={allReps}
    >
      {renderPage()}
    </V2Layout>
  )
}
