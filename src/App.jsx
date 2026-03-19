import { useState, useCallback } from 'react'
import { T, FONT_MONO, FONT_SANS, RADIUS, CARD_SHADOW } from './lib/constants'
import useAccounts from './hooks/useAccounts'
import useLocalData from './hooks/useLocalData'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import TopNav from './components/layout/TopNav'
import CSVUploader from './components/upload/CSVUploader'
import Badge from './components/shared/Badge'
import Tip from './components/shared/Tip'
import { pc } from './components/shared/ChartTheme'
import Overview from './pages/Overview'
import Locations from './pages/Locations'
import Predictions from './pages/Predictions'
import Deals from './pages/Deals'
import Signals from './pages/Signals'
import Losses from './pages/Losses'
import Backtest from './pages/Backtest'
import Learning from './pages/Learning'
import Priority from './pages/Priority'
import Engagement from './pages/Engagement'
import RepDashboard from './pages/RepDashboard'
import ForecastDashboard from './pages/ForecastDashboard'
import EngineDashboard from './pages/EngineDashboard'
import BacktestEngine from './pages/BacktestEngine'
import SellerLocations from './pages/SellerLocations'
import SellerActions from './pages/SellerActions'

export default function App() {
  const { accounts: uploadedAccounts, rawData, ingestLocalCSV, ingestAllFiles, clearData } = useAccounts()
  const { localAccounts, localFiles, localRawData, loading: localLoading, dataDir, setDataDir, refresh, serverAvailable } = useLocalData()
  const [showDirPicker, setShowDirPicker] = useState(false)
  const [dirInput, setDirInput] = useState('')
  const [dirError, setDirError] = useState('')

  const handleSetDir = useCallback(async () => {
    if (!dirInput.trim()) return
    setDirError('')
    const result = await setDataDir(dirInput.trim())
    if (result.error) {
      setDirError(result.error)
    } else {
      setShowDirPicker(false)
      setDirInput('')
    }
  }, [dirInput, setDataDir])

  // Priority: local data/ folder files > uploaded CSVs > demo data
  const hasLocalData = localAccounts && localAccounts.length > 0
  const accounts = hasLocalData ? localAccounts : uploadedAccounts
  const dataSource = hasLocalData ? 'local' : 'uploaded'

  const [mode, setMode] = useState(null) // null = landing, 'gtm', 'seller'
  const [selAcct, setSelAcct] = useState(0)
  const [page, setPage] = useState('priority')
  const [managerFilter, setManagerFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const MANAGERS = ['DCosta', 'Kahn', 'Ochoa']

  // Build unique sorted list of Sales Owners from accounts
  const salesOwners = [...new Set(
    accounts.map(acc => (acc.sales_owner || '').trim()).filter(Boolean)
  )].sort((a, b) => {
    // Sort by last name
    const aLast = a.split(/\s+/).pop().toLowerCase()
    const bLast = b.split(/\s+/).pop().toLowerCase()
    return aLast.localeCompare(bLast)
  })

  const filteredAccounts = accounts.filter(acc => {
    if (managerFilter !== 'all' && !(acc.manager || '').toLowerCase().includes(managerFilter.toLowerCase())) return false
    if (ownerFilter !== 'all' && (acc.sales_owner || '').trim() !== ownerFilter) return false
    return true
  })

  const searchedAccounts = searchQuery
    ? filteredAccounts.filter(acc => acc.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : filteredAccounts

  const a = searchedAccounts.length > 0
    ? searchedAccounts[Math.min(selAcct, searchedAccounts.length - 1)]
    : null

  // Hosted mode: no server, no uploaded data yet → show full-screen drop zone
  const [dropping, setDropping] = useState(false)
  const [dropStatus, setDropStatus] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(null) // { current, total, fileName, phase }
  const dropRef = useCallback((node) => {
    if (!node) return
    const prevent = (e) => e.preventDefault()
    node.addEventListener('dragover', prevent)
    node.addEventListener('drop', prevent)
    return () => { node.removeEventListener('dragover', prevent); node.removeEventListener('drop', prevent) }
  }, [])

  const hasNoData = accounts.length === 0

  // ---------- Landing page (mode === null) ----------
  if (!hasNoData && mode === null) {
    return (
      <div style={{
        height: '100vh', background: T.bg, color: T.text,
        fontFamily: "'Inter', system-ui, sans-serif",
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px',
      }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '0.15em', color: T.cyan, marginBottom: '8px' }}>
          REVOS
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '6px', textAlign: 'center' }}>
          Account Intelligence Platform
        </h1>
        <p style={{ color: T.textMid, fontSize: '13px', marginBottom: '40px', textAlign: 'center', maxWidth: '440px' }}>
          Select a dashboard to get started.
        </p>

        <div style={{ display: 'flex', gap: '20px', maxWidth: '960px', width: '100%' }}>
          {/* GTM Dashboard card */}
          <div
            onClick={() => setMode('gtm')}
            style={{
              flex: 1, padding: '32px 28px', background: T.card, borderRadius: RADIUS,
              boxShadow: CARD_SHADOW, cursor: 'pointer', transition: 'all 0.2s',
              border: `1px solid ${T.border}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.cyan; e.currentTarget.style.boxShadow = `0 0 20px ${T.cyan}15` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = CARD_SHADOW }}
          >
            <div style={{ fontSize: '32px', marginBottom: '14px' }}>◉</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              GTM Dashboard
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim, lineHeight: 1.6 }}>
              Account-level intelligence, pipeline analytics, risk signals, engagement tracking, and predictive modeling.
            </div>
            <div style={{
              marginTop: '18px', fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600,
              color: T.cyan, letterSpacing: '0.04em',
            }}>
              {accounts.length} ACCOUNTS LOADED
            </div>
          </div>

          {/* Seller Dashboard card */}
          <div
            onClick={() => setMode('seller')}
            style={{
              flex: 1, padding: '32px 28px', background: T.card, borderRadius: RADIUS,
              boxShadow: CARD_SHADOW, cursor: 'pointer', transition: 'all 0.2s',
              border: `1px solid ${T.border}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.boxShadow = `0 0 20px ${T.purple}15` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = CARD_SHADOW }}
          >
            <div style={{ fontSize: '32px', marginBottom: '14px' }}>👤</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              Seller Dashboard
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim, lineHeight: 1.6 }}>
              Rep-level view with quota attainment, pipeline management, KPI scorecard, and bookings tracking.
            </div>
            <div style={{
              marginTop: '18px', fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600,
              color: T.purple, letterSpacing: '0.04em',
            }}>
              SELECT A SELLER TO VIEW
            </div>
          </div>

          {/* Seller Actions card */}
          <div
            onClick={() => setMode('seller-actions')}
            style={{
              flex: 1, padding: '32px 28px', background: T.card, borderRadius: RADIUS,
              boxShadow: CARD_SHADOW, cursor: 'pointer', transition: 'all 0.2s',
              border: `1px solid ${T.border}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.pink; e.currentTarget.style.boxShadow = `0 0 20px ${T.pink}15` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = CARD_SHADOW }}
          >
            <div style={{ fontSize: '32px', marginBottom: '14px' }}>🎯</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              Seller Actions
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim, lineHeight: 1.6 }}>
              Priority accounts, expansion signals & churn alerts with AI-powered win probability scoring.
            </div>
            <div style={{
              marginTop: '18px', fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600,
              color: T.pink, letterSpacing: '0.04em',
            }}>
              3 ACTIONS TODAY
            </div>
          </div>

          {/* Forecast Dashboard card */}
          <div
            onClick={() => setMode('forecast')}
            style={{
              flex: 1, padding: '32px 28px', background: T.card, borderRadius: RADIUS,
              boxShadow: CARD_SHADOW, cursor: 'pointer', transition: 'all 0.2s',
              border: `1px solid ${T.border}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.green; e.currentTarget.style.boxShadow = `0 0 20px ${T.green}15` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = CARD_SHADOW }}
          >
            <div style={{ fontSize: '32px', marginBottom: '14px' }}>📊</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              Forecast Dashboard
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim, lineHeight: 1.6 }}>
              Revenue forecasting, bookings composition, churn modeling, win rate trends, and rep productivity analytics.
            </div>
            <div style={{
              marginTop: '18px', fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600,
              color: T.green, letterSpacing: '0.04em',
            }}>
              STAGE-WEIGHTED MODELING
            </div>
          </div>

          {/* Prediction Engine card */}
          <div
            onClick={() => setMode('engine')}
            style={{
              flex: 1, padding: '32px 28px', background: T.card, borderRadius: RADIUS,
              boxShadow: CARD_SHADOW, cursor: 'pointer', transition: 'all 0.2s',
              border: `1px solid ${T.border}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.teal; e.currentTarget.style.boxShadow = `0 0 20px ${T.teal}15` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = CARD_SHADOW }}
          >
            <div style={{ fontSize: '32px', marginBottom: '14px' }}>⚡</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              Prediction Engine
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim, lineHeight: 1.6 }}>
              AI-powered deal scoring, strategy recommendations, pricing optimization, and model calibration.
            </div>
            <div style={{
              marginTop: '18px', fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600,
              color: T.teal, letterSpacing: '0.04em',
            }}>
              ML-POWERED SCORING
            </div>
          </div>

          {/* Backtest Engine card */}
          <div
            onClick={() => setMode('backtest')}
            style={{
              flex: 1, padding: '32px 28px', background: T.card, borderRadius: RADIUS,
              boxShadow: CARD_SHADOW, cursor: 'pointer', transition: 'all 0.2s',
              border: `1px solid ${T.border}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.boxShadow = `0 0 20px ${T.orange}15` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = CARD_SHADOW }}
          >
            <div style={{ fontSize: '32px', marginBottom: '14px' }}>🔬</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              Backtest Engine
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim, lineHeight: 1.6 }}>
              Upload historical deal data, train a logistic model, and validate prediction accuracy with cross-validation.
            </div>
            <div style={{
              marginTop: '18px', fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600,
              color: T.orange, letterSpacing: '0.04em',
            }}>
              MODEL VALIDATION
            </div>
          </div>

          {/* Seller Locations card */}
          <div
            onClick={() => setMode('locations')}
            style={{
              flex: 1, padding: '32px 28px', background: T.card, borderRadius: RADIUS,
              boxShadow: CARD_SHADOW, cursor: 'pointer', transition: 'all 0.2s',
              border: `1px solid ${T.border}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.boxShadow = `0 0 20px ${T.purple}15` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = CARD_SHADOW }}
          >
            <div style={{ fontSize: '32px', marginBottom: '14px' }}>◈</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              Location Intelligence
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim, lineHeight: 1.6 }}>
              Account location enrichment, multi-source discovery, Bayesian expansion signals, and geographic footprint mapping.
            </div>
            <div style={{
              marginTop: '18px', fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600,
              color: T.purple, letterSpacing: '0.04em',
            }}>
              ENRICHMENT ENGINE
            </div>
          </div>
        </div>

        {dataSource === 'local' && (
          <div style={{ marginTop: '24px', fontFamily: FONT_MONO, fontSize: '9px', color: T.green }}>
            LIVE DATA FROM data/
          </div>
        )}
        {dataSource === 'uploaded' && (
          <div style={{ marginTop: '24px', fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>
            YOUR DATA · LOCAL ONLY
          </div>
        )}
      </div>
    )
  }

  // ---------- Seller Dashboard mode ----------
  if (mode === 'seller') {
    return (
      <div style={{ height: '100vh', background: T.bg, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Seller header bar */}
        <div style={{
          padding: '8px 16px', borderBottom: `1px solid ${T.border}`, background: T.surface,
          display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        }}>
          <button
            onClick={() => setMode(null)}
            style={{
              background: 'none', border: `1px solid ${T.border}`, borderRadius: '6px',
              padding: '4px 10px', cursor: 'pointer', fontFamily: FONT_MONO, fontSize: '10px',
              color: T.textDim, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.cyan; e.currentTarget.style.color = T.cyan }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textDim }}
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} style={{ fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '0.12em', color: T.cyan, fontWeight: 600, cursor: 'pointer' }}>
            REVOS
          </div>
          <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: T.textMid }}>
            Seller Dashboard
          </div>
        </div>

        {/* RepDashboard fills the rest */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <RepDashboard
            accounts={accounts}
            rawData={hasLocalData ? localRawData : rawData}
          />
        </div>
      </div>
    )
  }

  // ---------- Seller Actions mode ----------
  if (mode === 'seller-actions') {
    return (
      <div style={{ height: '100vh', background: T.bg, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '8px 16px', borderBottom: `1px solid ${T.border}`, background: T.surface,
          display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        }}>
          <button
            onClick={() => setMode(null)}
            style={{
              background: 'none', border: `1px solid ${T.border}`, borderRadius: '6px',
              padding: '4px 10px', cursor: 'pointer', fontFamily: FONT_MONO, fontSize: '10px',
              color: T.textDim, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.cyan; e.currentTarget.style.color = T.cyan }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textDim }}
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} style={{ fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '0.12em', color: T.cyan, fontWeight: 600, cursor: 'pointer' }}>
            REVOS
          </div>
          <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: T.textMid }}>
            Seller Actions
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <SellerActions
            accounts={accounts}
            rawData={hasLocalData ? localRawData : rawData}
            onNavigate={setMode}
          />
        </div>
      </div>
    )
  }

  // ---------- Forecast Dashboard mode ----------
  if (mode === 'forecast') {
    return (
      <div style={{ height: '100vh', background: T.bg, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '8px 16px', borderBottom: `1px solid ${T.border}`, background: T.surface,
          display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        }}>
          <button
            onClick={() => setMode(null)}
            style={{
              background: 'none', border: `1px solid ${T.border}`, borderRadius: '6px',
              padding: '4px 10px', cursor: 'pointer', fontFamily: FONT_MONO, fontSize: '10px',
              color: T.textDim, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.cyan; e.currentTarget.style.color = T.cyan }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textDim }}
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} style={{ fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '0.12em', color: T.cyan, fontWeight: 600, cursor: 'pointer' }}>
            REVOS
          </div>
          <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: T.textMid }}>
            Forecast Dashboard
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <ForecastDashboard
            accounts={accounts}
            rawData={hasLocalData ? localRawData : rawData}
          />
        </div>
      </div>
    )
  }

  // ---------- Prediction Engine mode ----------
  if (mode === 'engine') {
    return (
      <div style={{ height: '100vh', background: T.bg, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '8px 16px', borderBottom: `1px solid ${T.border}`, background: T.surface,
          display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        }}>
          <button
            onClick={() => setMode(null)}
            style={{
              background: 'none', border: `1px solid ${T.border}`, borderRadius: '6px',
              padding: '4px 10px', cursor: 'pointer', fontFamily: FONT_MONO, fontSize: '10px',
              color: T.textDim, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.cyan; e.currentTarget.style.color = T.cyan }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textDim }}
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} style={{ fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '0.12em', color: T.cyan, fontWeight: 600, cursor: 'pointer' }}>
            REVOS
          </div>
          <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: T.textMid }}>
            Prediction Engine
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <EngineDashboard />
        </div>
      </div>
    )
  }

  // ---------- Backtest Engine mode ----------
  if (mode === 'backtest') {
    return (
      <div style={{ height: '100vh', background: T.bg, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '8px 16px', borderBottom: `1px solid ${T.border}`, background: T.surface,
          display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        }}>
          <button
            onClick={() => setMode(null)}
            style={{
              background: 'none', border: `1px solid ${T.border}`, borderRadius: '6px',
              padding: '4px 10px', cursor: 'pointer', fontFamily: FONT_MONO, fontSize: '10px',
              color: T.textDim, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.cyan; e.currentTarget.style.color = T.cyan }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textDim }}
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} style={{ fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '0.12em', color: T.cyan, fontWeight: 600, cursor: 'pointer' }}>
            REVOS
          </div>
          <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: T.textMid }}>
            Backtest Engine
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <BacktestEngine />
        </div>
      </div>
    )
  }

  // ---------- Location Intelligence mode ----------
  if (mode === 'locations') {
    return (
      <div style={{ height: '100vh', background: T.bg, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '8px 16px', borderBottom: `1px solid ${T.border}`, background: T.surface,
          display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        }}>
          <button
            onClick={() => setMode(null)}
            style={{
              background: 'none', border: `1px solid ${T.border}`, borderRadius: '6px',
              padding: '4px 10px', cursor: 'pointer', fontFamily: FONT_MONO, fontSize: '10px',
              color: T.textDim, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.cyan; e.currentTarget.style.color = T.cyan }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textDim }}
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} style={{ fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '0.12em', color: T.cyan, fontWeight: 600, cursor: 'pointer' }}>
            REVOS
          </div>
          <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: T.textMid }}>
            Location Intelligence
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <SellerLocations />
        </div>
      </div>
    )
  }

  // ---------- No data yet: show upload screen ----------
  if (hasNoData) {
    return (
      <div
        ref={dropRef}
        onDragOver={(e) => { e.preventDefault(); setDropping(true) }}
        onDragLeave={() => setDropping(false)}
        onDrop={async (e) => {
          e.preventDefault()
          setDropping(false)
          setUploadProgress(null)
          setDropStatus({ type: 'loading', message: 'Processing files...' })
          try {
            const result = await ingestAllFiles(Array.from(e.dataTransfer.files), (p) => setUploadProgress(p))
            setUploadProgress(null)
            setDropStatus({ type: 'success', message: `Loaded ${result.accounts_count} accounts` })
          } catch (err) {
            setUploadProgress(null)
            setDropStatus({ type: 'error', message: err.message })
          }
        }}
        style={{
          height: '100vh', background: T.bg, color: T.text,
          fontFamily: "'Inter', system-ui, sans-serif",
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '40px',
        }}
      >
        <div style={{ fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '0.15em', color: T.cyan, marginBottom: '8px' }}>
          REVOS
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>
          Account Intelligence Platform
        </h1>
        <p style={{ color: T.textMid, fontSize: '14px', marginBottom: '32px', textAlign: 'center', maxWidth: '500px' }}>
          Drop your data folder contents below to get started. All processing happens in your browser — nothing is uploaded to any server.
        </p>

        <div
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.multiple = true
            input.accept = '.csv,.json'
            input.onchange = async (e) => {
              setUploadProgress(null)
              setDropStatus({ type: 'loading', message: 'Processing files...' })
              try {
                const result = await ingestAllFiles(Array.from(e.target.files), (p) => setUploadProgress(p))
                setUploadProgress(null)
                setDropStatus({ type: 'success', message: `Loaded ${result.accounts_count} accounts` })
              } catch (err) {
                setUploadProgress(null)
                setDropStatus({ type: 'error', message: err.message })
              }
            }
            input.click()
          }}
          style={{
            width: '100%', maxWidth: '600px', padding: '60px 40px',
            border: `2px dashed ${dropping ? T.cyan : T.border}`,
            borderRadius: RADIUS,
            background: dropping ? `${T.cyan}08` : T.surface,
            cursor: 'pointer', textAlign: 'center',
            transition: 'all 0.2s',
          }}
        >
          {dropStatus?.type === 'loading' && uploadProgress ? (
            <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
              {/* File counter */}
              <div style={{ fontFamily: FONT_MONO, fontSize: '12px', color: T.textMid, marginBottom: '12px', textAlign: 'center' }}>
                {uploadProgress.phase === 'building'
                  ? 'Building accounts...'
                  : `${uploadProgress.phase === 'reading' ? 'Reading' : 'Parsing'} ${uploadProgress.fileName}`}
              </div>
              {/* Progress bar */}
              <div style={{
                width: '100%', height: '6px', background: T.border, borderRadius: '3px',
                overflow: 'hidden', marginBottom: '8px',
              }}>
                <div style={{
                  height: '100%', borderRadius: '3px', background: T.cyan,
                  width: `${Math.round(((uploadProgress.current + (uploadProgress.phase === 'parsing' ? 0.5 : 0)) / uploadProgress.total) * 100)}%`,
                  transition: 'width 0.15s ease',
                }} />
              </div>
              {/* Counter text */}
              <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim, textAlign: 'center' }}>
                {uploadProgress.phase === 'building'
                  ? 'Aggregating records into accounts'
                  : `${uploadProgress.current + 1} of ${uploadProgress.total} files`}
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.6 }}>
                {dropStatus?.type === 'loading' ? '...' : ''}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '14px', color: T.textMid, marginBottom: '8px' }}>
                {dropStatus?.type === 'loading' ? 'Processing...' : 'Drop all files here or click to select'}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim, lineHeight: 1.6 }}>
                Select all CSV + JSON files from your data folder<br/>
                customers.csv, funnel.csv, close_lost.csv, services.csv, ICB.csv,<br/>
                locations.json, historical.json, engagements.json, etc.
              </div>
            </>
          )}
        </div>

        {dropStatus && dropStatus.type !== 'loading' && (
          <div style={{
            marginTop: '16px', padding: '12px 20px', borderRadius: '8px',
            fontFamily: FONT_MONO, fontSize: '11px', maxWidth: '600px', width: '100%',
            background: dropStatus.type === 'error' ? `${T.red}18` : `${T.green}18`,
            color: dropStatus.type === 'error' ? T.red : T.green,
            border: `1px solid ${dropStatus.type === 'error' ? T.red : T.green}30`,
          }}>
            {dropStatus.message}
          </div>
        )}

        <div style={{ marginTop: '24px', fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim, textAlign: 'center' }}>
          YOUR DATA NEVER LEAVES YOUR COMPUTER
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', background: T.bg, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header accountCount={searchedAccounts.length} onLogoClick={() => setMode(null)} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: '220px', borderRight: `1px solid ${T.border}`, background: T.surface, display: 'flex', flexDirection: 'column', flexShrink: 0, minHeight: 0, overflow: 'hidden' }}>
          {/* Data source panel */}
          <div style={{ padding: '8px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            {/* Data folder selector */}
            <div style={{ marginBottom: '6px' }}>
              <button
                onClick={() => { setShowDirPicker(!showDirPicker); setDirError(''); if (!dirInput && dataDir) setDirInput(dataDir) }}
                style={{
                  width: '100%', padding: '6px 8px', borderRadius: '5px', cursor: 'pointer',
                  fontFamily: FONT_MONO, fontSize: '9px', fontWeight: 600,
                  background: T.card, border: `1px solid ${T.border}`, color: T.cyan,
                  display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = T.cyan}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
              >
                <span style={{ fontSize: '12px' }}>📂</span>
                {dataDir ? 'Change Data Folder' : 'Select Data Folder'}
              </button>
              {dataDir && !showDirPicker && (
                <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, marginTop: '3px', wordBreak: 'break-all' }}>
                  {dataDir}
                </div>
              )}
              {showDirPicker && (
                <div style={{ marginTop: '6px', padding: '8px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: '6px' }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, marginBottom: '4px' }}>
                    Paste the full path to your data folder:
                  </div>
                  <input
                    type="text"
                    value={dirInput}
                    onChange={(e) => setDirInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSetDir()}
                    placeholder="C:\Users\...\data"
                    style={{
                      width: '100%', padding: '5px 6px', fontFamily: FONT_MONO, fontSize: '9px',
                      background: T.card, border: `1px solid ${T.border}`, borderRadius: '4px',
                      color: T.text, outline: 'none', marginBottom: '4px',
                    }}
                    onFocus={(e) => e.target.style.borderColor = T.cyan}
                    onBlur={(e) => e.target.style.borderColor = T.border}
                    autoFocus
                  />
                  {dirError && (
                    <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.red, marginBottom: '4px' }}>
                      {dirError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={handleSetDir}
                      style={{
                        flex: 1, padding: '4px', borderRadius: '4px', cursor: 'pointer',
                        fontFamily: FONT_MONO, fontSize: '9px', fontWeight: 600,
                        background: `${T.cyan}18`, border: `1px solid ${T.cyan}`, color: T.cyan,
                      }}
                    >
                      Load
                    </button>
                    <button
                      onClick={() => { setShowDirPicker(false); setDirError('') }}
                      style={{
                        padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
                        fontFamily: FONT_MONO, fontSize: '9px',
                        background: 'transparent', border: `1px solid ${T.border}`, color: T.textDim,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Show local file status if files exist in data/ */}
            {localFiles.length > 0 && (
              <div style={{
                padding: '6px 8px',
                background: `${T.green}08`,
                border: `1px solid ${T.green}22`,
                borderRadius: '6px',
                marginBottom: '6px',
                fontFamily: FONT_MONO,
                fontSize: '9px',
              }}>
                <div style={{ color: T.green, marginBottom: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{localFiles.length} FILES LOADED</span>
                  <button
                    onClick={() => refresh()}
                    disabled={localLoading}
                    style={{
                      padding: '2px 6px', borderRadius: '3px', cursor: localLoading ? 'default' : 'pointer',
                      fontFamily: FONT_MONO, fontSize: '8px', fontWeight: 600,
                      background: 'transparent', border: `1px solid ${T.cyan}44`, color: T.cyan,
                      opacity: localLoading ? 0.5 : 1,
                    }}
                  >
                    {localLoading ? 'LOADING...' : 'REFRESH'}
                  </button>
                </div>
                {localFiles.map((f) => (
                  <div key={f.name} style={{ color: T.textDim, fontSize: '8px' }}>
                    {f.name} ({(f.size / 1024).toFixed(0)}KB)
                  </div>
                ))}
              </div>
            )}
            <CSVUploader
              onUpload={ingestLocalCSV}
              onClear={clearData}
              rawData={rawData}
            />
          </div>
          {/* Manager filter */}
          <div style={{ padding: '8px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '4px' }}><Tip label="MANAGER">MANAGER</Tip></div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button
                onClick={() => { setManagerFilter('all'); setSelAcct(0) }}
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  fontFamily: FONT_MONO,
                  border: 'none',
                  borderRadius: '4px',
                  background: managerFilter === 'all' ? `${T.cyan}15` : T.surface,
                  boxShadow: managerFilter === 'all' ? `0 0 0 1px ${T.cyan}30` : 'none',
                  color: managerFilter === 'all' ? T.cyan : T.textDim,
                  cursor: 'pointer',
                }}
              >
                ALL
              </button>
              {MANAGERS.map(m => (
                <button
                  key={m}
                  onClick={() => { setManagerFilter(m); setSelAcct(0) }}
                  style={{
                    padding: '3px 8px',
                    fontSize: '10px',
                    fontFamily: FONT_MONO,
                    border: 'none',
                    borderRadius: '4px',
                    background: managerFilter === m ? `${T.cyan}15` : T.surface,
                    boxShadow: managerFilter === m ? `0 0 0 1px ${T.cyan}30` : 'none',
                    color: managerFilter === m ? T.cyan : T.textDim,
                    cursor: 'pointer',
                  }}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {/* Sales Owner filter */}
          {salesOwners.length > 0 && (
            <div style={{ padding: '8px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '4px' }}>
                <Tip label="SALES OWNER">SALES OWNER</Tip>
              </div>
              <select
                value={ownerFilter}
                onChange={(e) => { setOwnerFilter(e.target.value); setSelAcct(0) }}
                style={{
                  width: '100%',
                  padding: '5px 6px',
                  fontFamily: FONT_MONO,
                  fontSize: '10px',
                  background: T.card,
                  border: `1px solid ${ownerFilter !== 'all' ? T.cyan : T.border}`,
                  borderRadius: '4px',
                  color: ownerFilter !== 'all' ? T.cyan : T.text,
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'auto',
                }}
              >
                <option value="all">All Sales Owners</option>
                {salesOwners.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}
          {/* Account search */}
          <div style={{ padding: '6px 8px', borderBottom: `1px solid ${T.border}`, flexShrink: 0, position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSelAcct(0) }}
              placeholder="Search accounts..."
              style={{
                width: '100%',
                padding: '5px 22px 5px 8px',
                fontFamily: FONT_MONO,
                fontSize: '10px',
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: '4px',
                color: T.text,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.target.style.borderColor = T.cyan}
              onBlur={(e) => e.target.style.borderColor = T.border}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSelAcct(0) }}
                style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
                  fontFamily: FONT_MONO, fontSize: '12px', color: T.textDim, lineHeight: 1,
                }}
              >
                x
              </button>
            )}
          </div>
          {/* Account list */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <Sidebar accounts={searchedAccounts} selectedIndex={selAcct} onSelect={setSelAcct} />
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopNav activePage={page} onPageChange={setPage} />

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {page === 'priority' ? (
              <Priority
                accounts={searchedAccounts}
                onSelect={(idx) => { setSelAcct(idx); setPage('overview') }}
              />
            ) : page === 'engagement' ? (
              <Engagement
                accounts={searchedAccounts}
                onSelect={(idx) => { setSelAcct(idx); setPage('overview') }}
              />
            ) : !a ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: T.textDim }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: '12px', marginBottom: '8px' }}>NO ACCOUNTS FOUND</div>
                <div style={{ fontSize: '11px' }}>No accounts match this manager filter. Check that your customers.csv has a "Sales Funnel Manager" column.</div>
              </div>
            ) : (
            <>
            {/* Page header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{a.name}</h2>
                  {a.account_id && (
                    <a
                      href={`https://zayo.lightning.force.com/lightning/r/Opportunity/${a.account_id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: FONT_MONO, fontSize: '9px', fontWeight: 600,
                        padding: '3px 8px', borderRadius: RADIUS,
                        background: `${T.cyan}18`, border: `1px solid ${T.cyan}`,
                        color: T.cyan, textDecoration: 'none', cursor: 'pointer',
                      }}
                    >
                      SFDC ↗
                    </a>
                  )}
                  <Badge color={a.risk_score >= 50 ? T.red : a.risk_score >= 30 ? T.orange : T.green}>
                    {a.risk_level.toUpperCase()}
                  </Badge>
                  {a.risk_score >= 30 && <Badge color={T.red}>RISK {a.risk_score}/100</Badge>}
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textMid }}>
                  {a.vertical} · {a.rep} · {a.tenure_mo}mo tenure · NRR: {pc(a.nrr)} · {a.products.join(', ')}
                </div>
              </div>
              {dataSource === 'local' && (
                <Badge color={T.green} size="md">LIVE · AUTO-SYNC FROM data/</Badge>
              )}
              {dataSource === 'uploaded' && (
                <Badge color={T.green} size="md">YOUR DATA · LOCAL ONLY</Badge>
              )}
            </div>

            {/* Page content */}
            {page === 'overview' && <Overview a={a} />}
            {page === 'locations' && <Locations a={a} />}
            {page === 'predict' && <Predictions a={a} />}
            {page === 'deals' && <Deals a={a} />}
            {page === 'signals' && <Signals a={a} />}
            {page === 'losses' && <Losses a={a} />}
            {page === 'backtest' && <Backtest a={a} />}
            {page === 'learning' && <Learning a={a} />}
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
