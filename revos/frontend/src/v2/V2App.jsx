import { useState } from 'react'
import V2Layout from './V2Layout'
import V2Dashboard from './pages/V2Dashboard'
import V2Pipeline from './pages/V2Pipeline'
import V2TargetList from './pages/V2TargetList'
import V2Forecast from './pages/V2Forecast'

/**
 * V2 shell — manages sub-page routing within the V2 experience.
 * Receives accounts from the parent App so shared hooks can consume them.
 */
export default function V2App({ accounts = [], rawData = {}, onBack }) {
  const [activePage, setActivePage] = useState('v2-dashboard')

  const renderPage = () => {
    switch (activePage) {
      case 'v2-pipeline':
        return <V2Pipeline accounts={accounts} rawData={rawData} />
      case 'v2-targets':
        return <V2TargetList accounts={accounts} rawData={rawData} />
      case 'v2-forecast':
        return <V2Forecast accounts={accounts} rawData={rawData} />
      case 'v2-dashboard':
      default:
        return <V2Dashboard accounts={accounts} rawData={rawData} />
    }
  }

  return (
    <V2Layout activePage={activePage} onNavigate={setActivePage} onBack={onBack}>
      {renderPage()}
    </V2Layout>
  )
}
