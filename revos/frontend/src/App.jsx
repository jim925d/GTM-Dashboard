import { useState, useCallback, useEffect } from 'react'
import { T } from './lib/constants'
import { cn } from '@/lib/utils'
import useAccounts from './hooks/useAccounts'
import useLocalData from './hooks/useLocalData'
import { saveBacktest, loadBacktest } from './lib/engineStore'
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
import EngagementDashboard from './pages/EngagementDashboard'
import PlaybookEngine from './pages/PlaybookEngine'
import PricingEngine from './pages/PricingEngine'
import OutageMonitor from './pages/OutageMonitor'
import GTMPremier from './pages/GTMPremier'

export default function App() {
  const { accounts: uploadedAccounts, rawData, ingestLocalCSV, ingestAllFiles, clearData } = useAccounts()
  const { localAccounts, localFiles, localRawData, loading: localLoading, dataDir, setDataDir, refresh, serverAvailable, fsApiSupported, fsMode, connectFolder, disconnectFolder } = useLocalData()
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
  const [backtestResults, setBacktestResults] = useState(null)

  // Load persisted backtest results on mount
  useEffect(() => {
    loadBacktest().then(data => { if (data) setBacktestResults(data) })
  }, [])

  // Save backtest results whenever they change
  const handleBacktestResults = useCallback((results) => {
    setBacktestResults(results)
    if (results) saveBacktest(results)
  }, [])

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
      <div className="h-screen bg-revos-bg text-revos-text font-sans flex flex-col items-center justify-center p-10">
        <div className="font-mono text-[11px] tracking-[0.15em] text-revos-cyan mb-2">
          REVOS
        </div>
        <h1 className="text-[28px] font-bold mb-1.5 text-center">
          Account Intelligence Platform
        </h1>
        <p className="text-revos-text-mid text-[13px] mb-10 text-center max-w-[440px]">
          Select a dashboard to get started.
        </p>

        {/* ── Sales Dashboards ── */}
        <div className="max-w-[1200px] w-full mb-8">
          <div className="font-mono text-[10px] tracking-[0.12em] text-revos-text-dim mb-3 uppercase">
            Sales Dashboards
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            {/* GTM Premier */}
            <div
              onClick={() => setMode('premier')}
              className="px-7 py-8 bg-revos-card rounded-xl shadow-card cursor-pointer transition-all duration-200 border border-revos-border hover:border-revos-purple hover:shadow-[0_0_20px_rgba(167,139,250,0.12)]"
            >
              <div className="text-[32px] mb-3.5">◎</div>
              <div className="font-sans text-base font-bold mb-1.5">
                GTM Premier
              </div>
              <div className="font-mono text-[11px] text-revos-text-dim leading-[1.6]">
                Target account intelligence, market analysis, priority scoring, and whitespace detection powered by the modeling layer.
              </div>
              <div className="mt-[18px] font-mono text-[10px] font-semibold text-revos-purple tracking-[0.04em]">
                MARKET INTELLIGENCE
              </div>
            </div>

            {/* GTM Dashboard */}
            <div
              onClick={() => setMode('gtm')}
              className="px-7 py-8 bg-revos-card rounded-xl shadow-card cursor-pointer transition-all duration-200 border border-revos-border hover:border-revos-cyan hover:shadow-[0_0_20px_rgba(110,200,228,0.08)]"
            >
              <div className="text-[32px] mb-3.5">◉</div>
              <div className="font-sans text-base font-bold mb-1.5">
                GTM Dashboard
              </div>
              <div className="font-mono text-[11px] text-revos-text-dim leading-[1.6]">
                Account-level intelligence, pipeline analytics, risk signals, engagement tracking, and predictive modeling.
              </div>
              <div className="mt-[18px] font-mono text-[10px] font-semibold text-revos-cyan tracking-[0.04em]">
                {accounts.length} ACCOUNTS LOADED
              </div>
            </div>

            {/* Seller Dashboard */}
            <div
              onClick={() => setMode('seller')}
              className="px-7 py-8 bg-revos-card rounded-xl shadow-card cursor-pointer transition-all duration-200 border border-revos-border hover:border-revos-purple hover:shadow-[0_0_20px_rgba(176,144,224,0.08)]"
            >
              <div className="text-[32px] mb-3.5">👤</div>
              <div className="font-sans text-base font-bold mb-1.5">
                Seller Dashboard
              </div>
              <div className="font-mono text-[11px] text-revos-text-dim leading-[1.6]">
                Rep-level view with quota attainment, pipeline management, KPI scorecard, and bookings tracking.
              </div>
              <div className="mt-[18px] font-mono text-[10px] font-semibold text-revos-purple tracking-[0.04em]">
                SELECT A SELLER TO VIEW
              </div>
            </div>

            {/* Seller Actions */}
            <div
              onClick={() => setMode('seller-actions')}
              className="px-7 py-8 bg-revos-card rounded-xl shadow-card cursor-pointer transition-all duration-200 border border-revos-border hover:border-revos-pink hover:shadow-[0_0_20px_rgba(232,136,176,0.08)]"
            >
              <div className="text-[32px] mb-3.5">🎯</div>
              <div className="font-sans text-base font-bold mb-1.5">
                Seller Actions
              </div>
              <div className="font-mono text-[11px] text-revos-text-dim leading-[1.6]">
                Priority accounts, expansion signals & churn alerts with AI-powered win probability scoring.
              </div>
              <div className="mt-[18px] font-mono text-[10px] font-semibold text-revos-pink tracking-[0.04em]">
                3 ACTIONS TODAY
              </div>
            </div>

            {/* Forecast Dashboard */}
            <div
              onClick={() => setMode('forecast')}
              className="px-7 py-8 bg-revos-card rounded-xl shadow-card cursor-pointer transition-all duration-200 border border-revos-border hover:border-revos-green hover:shadow-[0_0_20px_rgba(110,216,160,0.08)]"
            >
              <div className="text-[32px] mb-3.5">📊</div>
              <div className="font-sans text-base font-bold mb-1.5">
                Forecast Dashboard
              </div>
              <div className="font-mono text-[11px] text-revos-text-dim leading-[1.6]">
                Revenue forecasting, bookings composition, churn modeling, win rate trends, and rep productivity analytics.
              </div>
              <div className="mt-[18px] font-mono text-[10px] font-semibold text-revos-green tracking-[0.04em]">
                STAGE-WEIGHTED MODELING
              </div>
            </div>

            {/* Engagement Dashboard */}
            <div
              onClick={() => setMode('engagement')}
              className="px-7 py-8 bg-revos-card rounded-xl shadow-card cursor-pointer transition-all duration-200 border border-revos-border hover:border-revos-blue hover:shadow-[0_0_20px_rgba(112,168,224,0.08)]"
            >
              <div className="text-[32px] mb-3.5">📈</div>
              <div className="font-sans text-base font-bold mb-1.5">
                Engagement Dashboard
              </div>
              <div className="font-mono text-[11px] text-revos-text-dim leading-[1.6]">
                Rep-level engagement analytics, coverage heatmaps, pipeline correlation, and account deep dives with CSV import.
              </div>
              <div className="mt-[18px] font-mono text-[10px] font-semibold text-revos-blue tracking-[0.04em]">
                ENGAGEMENT ANALYTICS
              </div>
            </div>
          </div>
        </div>

        {/* ── Data Engines ── */}
        <div className="max-w-[1200px] w-full">
          <div className="font-mono text-[10px] tracking-[0.12em] text-revos-text-dim mb-3 uppercase">
            Data Engines
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            {/* Backtest Engine */}
            <div
              onClick={() => setMode('backtest')}
              className="px-7 py-8 bg-revos-card rounded-xl shadow-card cursor-pointer transition-all duration-200 border border-revos-border hover:border-revos-orange hover:shadow-[0_0_20px_rgba(232,160,80,0.08)]"
            >
              <div className="text-[32px] mb-3.5">🔬</div>
              <div className="font-sans text-base font-bold mb-1.5">
                Backtest Engine
              </div>
              <div className="font-mono text-[11px] text-revos-text-dim leading-[1.6]">
                Upload historical deal data, train a logistic model, and validate prediction accuracy with cross-validation.
              </div>
              <div className="mt-[18px] font-mono text-[10px] font-semibold text-revos-orange tracking-[0.04em]">
                MODEL VALIDATION
              </div>
            </div>

            {/* Location Intelligence */}
            <div
              onClick={() => setMode('locations')}
              className="px-7 py-8 bg-revos-card rounded-xl shadow-card cursor-pointer transition-all duration-200 border border-revos-border hover:border-revos-purple hover:shadow-[0_0_20px_rgba(176,144,224,0.08)]"
            >
              <div className="text-[32px] mb-3.5">◈</div>
              <div className="font-sans text-base font-bold mb-1.5">
                Location Intelligence
              </div>
              <div className="font-mono text-[11px] text-revos-text-dim leading-[1.6]">
                Account location enrichment, multi-source discovery, Bayesian expansion signals, and geographic footprint mapping.
              </div>
              <div className="mt-[18px] font-mono text-[10px] font-semibold text-revos-purple tracking-[0.04em]">
                ENRICHMENT ENGINE
              </div>
            </div>

            {/* Prediction Engine */}
            <div
              onClick={() => setMode('engine')}
              className="px-7 py-8 bg-revos-card rounded-xl shadow-card cursor-pointer transition-all duration-200 border border-revos-border hover:border-revos-teal hover:shadow-[0_0_20px_rgba(80,208,184,0.08)]"
            >
              <div className="text-[32px] mb-3.5">⚡</div>
              <div className="font-sans text-base font-bold mb-1.5">
                Prediction Engine
              </div>
              <div className="font-mono text-[11px] text-revos-text-dim leading-[1.6]">
                AI-powered deal scoring, strategy recommendations, pricing optimization, and model calibration.
              </div>
              <div className="mt-[18px] font-mono text-[10px] font-semibold text-revos-teal tracking-[0.04em]">
                ML-POWERED SCORING
              </div>
            </div>

            {/* Playbook Engine */}
            <div
              onClick={() => setMode('playbook')}
              className="px-7 py-8 bg-revos-card rounded-xl shadow-card cursor-pointer transition-all duration-200 border border-revos-border hover:border-revos-pink hover:shadow-[0_0_20px_rgba(244,114,182,0.08)]"
            >
              <div className="text-[32px] mb-3.5">📋</div>
              <div className="font-sans text-base font-bold mb-1.5">
                Playbook Engine
              </div>
              <div className="font-mono text-[11px] text-revos-text-dim leading-[1.6]">
                AI-extracted sales rules, qualification frameworks, competitive intelligence, and deal pattern matching.
              </div>
              <div className="mt-[18px] font-mono text-[10px] font-semibold text-revos-pink tracking-[0.04em]">
                SALES INTELLIGENCE
              </div>
            </div>

            {/* Pricing Engine */}
            <div
              onClick={() => setMode('pricing')}
              className="px-7 py-8 bg-revos-card rounded-xl shadow-card cursor-pointer transition-all duration-200 border border-revos-border hover:border-revos-lime hover:shadow-[0_0_20px_rgba(163,230,53,0.08)]"
            >
              <div className="text-[32px] mb-3.5">💲</div>
              <div className="font-sans text-base font-bold mb-1.5">
                Pricing Engine
              </div>
              <div className="font-mono text-[11px] text-revos-text-dim leading-[1.6]">
                Product pricing tables, vertical adjustments, discount rules, and rate card upload management.
              </div>
              <div className="mt-[18px] font-mono text-[10px] font-semibold text-revos-lime tracking-[0.04em]">
                RATE MANAGEMENT
              </div>
            </div>

            {/* Outage Monitor */}
            <div
              onClick={() => setMode('outages')}
              className="px-7 py-8 bg-revos-card rounded-xl shadow-card cursor-pointer transition-all duration-200 border border-revos-border hover:border-revos-red hover:shadow-[0_0_20px_rgba(248,113,113,0.08)]"
            >
              <div className="text-[32px] mb-3.5">⚡</div>
              <div className="font-sans text-base font-bold mb-1.5">
                Outage Monitor
              </div>
              <div className="font-mono text-[11px] text-revos-text-dim leading-[1.6]">
                Live US ISP outage tracking from Cloudflare Radar and IODA with SVG map and incident feed.
              </div>
              <div className="mt-[18px] font-mono text-[10px] font-semibold text-revos-red tracking-[0.04em]">
                OUTAGE INTELLIGENCE
              </div>
            </div>
          </div>
        </div>

        {dataSource === 'local' && (
          <div className="mt-6 font-mono text-[9px] text-revos-green">
            LIVE DATA FROM data/
          </div>
        )}
        {dataSource === 'uploaded' && (
          <div className="mt-6 font-mono text-[9px] text-revos-text-dim">
            YOUR DATA · LOCAL ONLY
          </div>
        )}
      </div>
    )
  }

  // ---------- GTM Premier mode ----------
  if (mode === 'premier') {
    return (
      <div className="h-screen bg-revos-bg text-revos-text font-sans flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-revos-border bg-revos-surface flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMode(null)}
            className="bg-transparent border border-revos-border rounded-md px-2.5 py-1 cursor-pointer font-mono text-[10px] text-revos-text-dim transition-all duration-150 hover:border-revos-cyan hover:text-revos-cyan"
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} className="font-mono text-[11px] tracking-[0.12em] text-revos-cyan font-semibold cursor-pointer">
            REVOS
          </div>
          <div className="font-sans text-xs text-revos-text-mid">
            GTM Premier
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <GTMPremier accounts={accounts} />
        </div>
      </div>
    )
  }

  // ---------- Playbook Engine mode ----------
  if (mode === 'playbook') {
    return (
      <div className="h-screen bg-revos-bg text-revos-text font-sans flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-revos-border bg-revos-surface flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMode(null)}
            className="bg-transparent border border-revos-border rounded-md px-2.5 py-1 cursor-pointer font-mono text-[10px] text-revos-text-dim transition-all duration-150 hover:border-revos-cyan hover:text-revos-cyan"
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} className="font-mono text-[11px] tracking-[0.12em] text-revos-cyan font-semibold cursor-pointer">
            REVOS
          </div>
          <div className="font-sans text-xs text-revos-text-mid">
            Playbook Engine
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <PlaybookEngine accounts={accounts} backtestResults={backtestResults} />
        </div>
      </div>
    )
  }

  // ---------- Pricing Engine mode ----------
  if (mode === 'pricing') {
    return (
      <div className="h-screen bg-revos-bg text-revos-text font-sans flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-revos-border bg-revos-surface flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMode(null)}
            className="bg-transparent border border-revos-border rounded-md px-2.5 py-1 cursor-pointer font-mono text-[10px] text-revos-text-dim transition-all duration-150 hover:border-revos-cyan hover:text-revos-cyan"
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} className="font-mono text-[11px] tracking-[0.12em] text-revos-cyan font-semibold cursor-pointer">
            REVOS
          </div>
          <div className="font-sans text-xs text-revos-text-mid">
            Pricing Engine
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <PricingEngine accounts={accounts} />
        </div>
      </div>
    )
  }

  // ---------- Outage Monitor mode ----------
  if (mode === 'outages') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-revos-border bg-revos-surface flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMode(null)}
            className="bg-transparent border border-revos-border rounded-md px-2.5 py-1 cursor-pointer font-mono text-[10px] text-revos-text-dim transition-all duration-150 hover:border-revos-cyan hover:text-revos-cyan"
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} className="font-mono text-[11px] tracking-[0.12em] text-revos-cyan font-semibold cursor-pointer">
            REVOS
          </div>
          <div className="font-sans text-xs text-revos-text-mid">
            Outage Monitor
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <OutageMonitor />
        </div>
      </div>
    )
  }

  // ---------- Engagement Dashboard mode ----------
  if (mode === 'engagement') {
    return (
      <div className="h-screen bg-revos-bg text-revos-text font-sans flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-revos-border bg-revos-surface flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMode(null)}
            className="bg-transparent border border-revos-border rounded-md px-2.5 py-1 cursor-pointer font-mono text-[10px] text-revos-text-dim transition-all duration-150 hover:border-revos-cyan hover:text-revos-cyan"
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} className="font-mono text-[11px] tracking-[0.12em] text-revos-cyan font-semibold cursor-pointer">
            REVOS
          </div>
          <div className="font-sans text-xs text-revos-text-mid">
            Engagement Dashboard
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <EngagementDashboard accounts={accounts} />
        </div>
      </div>
    )
  }

  // ---------- Seller Dashboard mode ----------
  if (mode === 'seller') {
    return (
      <div className="h-screen bg-revos-bg text-revos-text font-sans flex flex-col overflow-hidden">
        {/* Seller header bar */}
        <div className="px-4 py-2 border-b border-revos-border bg-revos-surface flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMode(null)}
            className="bg-transparent border border-revos-border rounded-md px-2.5 py-1 cursor-pointer font-mono text-[10px] text-revos-text-dim transition-all duration-150 hover:border-revos-cyan hover:text-revos-cyan"
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} className="font-mono text-[11px] tracking-[0.12em] text-revos-cyan font-semibold cursor-pointer">
            REVOS
          </div>
          <div className="font-sans text-xs text-revos-text-mid">
            Seller Dashboard
          </div>
        </div>

        {/* RepDashboard fills the rest */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
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
      <div className="h-screen bg-revos-bg text-revos-text font-sans flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-revos-border bg-revos-surface flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMode(null)}
            className="bg-transparent border border-revos-border rounded-md px-2.5 py-1 cursor-pointer font-mono text-[10px] text-revos-text-dim transition-all duration-150 hover:border-revos-cyan hover:text-revos-cyan"
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} className="font-mono text-[11px] tracking-[0.12em] text-revos-cyan font-semibold cursor-pointer">
            REVOS
          </div>
          <div className="font-sans text-xs text-revos-text-mid">
            Seller Actions
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SellerActions
            accounts={accounts}
            onNavigate={setMode}
          />
        </div>
      </div>
    )
  }

  // ---------- Forecast Dashboard mode ----------
  if (mode === 'forecast') {
    return (
      <div className="h-screen bg-revos-bg text-revos-text font-sans flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-revos-border bg-revos-surface flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMode(null)}
            className="bg-transparent border border-revos-border rounded-md px-2.5 py-1 cursor-pointer font-mono text-[10px] text-revos-text-dim transition-all duration-150 hover:border-revos-cyan hover:text-revos-cyan"
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} className="font-mono text-[11px] tracking-[0.12em] text-revos-cyan font-semibold cursor-pointer">
            REVOS
          </div>
          <div className="font-sans text-xs text-revos-text-mid">
            Forecast Dashboard
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
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
      <div className="h-screen bg-revos-bg text-revos-text font-sans flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-revos-border bg-revos-surface flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMode(null)}
            className="bg-transparent border border-revos-border rounded-md px-2.5 py-1 cursor-pointer font-mono text-[10px] text-revos-text-dim transition-all duration-150 hover:border-revos-cyan hover:text-revos-cyan"
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} className="font-mono text-[11px] tracking-[0.12em] text-revos-cyan font-semibold cursor-pointer">
            REVOS
          </div>
          <div className="font-sans text-xs text-revos-text-mid">
            Prediction Engine
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <EngineDashboard accounts={accounts} backtestResults={backtestResults} />
        </div>
      </div>
    )
  }

  // ---------- Backtest Engine mode ----------
  if (mode === 'backtest') {
    return (
      <div className="h-screen bg-revos-bg text-revos-text font-sans flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-revos-border bg-revos-surface flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMode(null)}
            className="bg-transparent border border-revos-border rounded-md px-2.5 py-1 cursor-pointer font-mono text-[10px] text-revos-text-dim transition-all duration-150 hover:border-revos-cyan hover:text-revos-cyan"
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} className="font-mono text-[11px] tracking-[0.12em] text-revos-cyan font-semibold cursor-pointer">
            REVOS
          </div>
          <div className="font-sans text-xs text-revos-text-mid">
            Backtest Engine
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <BacktestEngine onResults={handleBacktestResults} savedResults={backtestResults} />
        </div>
      </div>
    )
  }

  // ---------- Location Intelligence mode ----------
  if (mode === 'locations') {
    return (
      <div className="h-screen bg-revos-bg text-revos-text font-sans flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-revos-border bg-revos-surface flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMode(null)}
            className="bg-transparent border border-revos-border rounded-md px-2.5 py-1 cursor-pointer font-mono text-[10px] text-revos-text-dim transition-all duration-150 hover:border-revos-cyan hover:text-revos-cyan"
          >
            ← Back
          </button>
          <div onClick={() => setMode(null)} className="font-mono text-[11px] tracking-[0.12em] text-revos-cyan font-semibold cursor-pointer">
            REVOS
          </div>
          <div className="font-sans text-xs text-revos-text-mid">
            Location Intelligence
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
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
        className="h-screen bg-revos-bg text-revos-text font-sans flex flex-col items-center justify-center p-10"
      >
        <div className="font-mono text-[11px] tracking-[0.15em] text-revos-cyan mb-2">
          REVOS
        </div>
        <h1 className="text-[28px] font-bold mb-2 text-center">
          Account Intelligence Platform
        </h1>
        <p className="text-revos-text-mid text-sm mb-8 text-center max-w-[500px]">
          Connect your local data folder to get started. All processing happens in your browser — nothing is uploaded to any server.
        </p>

        {fsApiSupported && (
          <button
            onClick={async () => {
              setDropStatus({ type: 'loading', message: 'Connecting folder...' })
              const result = await connectFolder()
              if (result.error === 'cancelled') setDropStatus(null)
              else if (result.error) setDropStatus({ type: 'error', message: result.error })
              else setDropStatus({ type: 'success', message: 'Data folder connected' })
            }}
            className="mb-6 px-8 py-3 rounded-lg cursor-pointer font-mono text-sm font-semibold bg-revos-cyan/10 border-2 border-revos-cyan text-revos-cyan hover:bg-revos-cyan/20 transition-all duration-200"
          >
            Connect Data Folder
          </button>
        )}

        <div className="font-mono text-[10px] text-revos-text-dim mb-4">
          {fsApiSupported ? 'or drop individual files below' : 'Drop files below or click to select'}
        </div>

        <div
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.multiple = true
            input.accept = '.csv,.json,.xlsx,.xls'
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
          className={cn(
            "w-full max-w-[600px] px-10 py-[60px] rounded-xl cursor-pointer text-center transition-all duration-200 border-2 border-dashed",
            dropping
              ? "border-revos-cyan bg-revos-cyan/[0.03]"
              : "border-revos-border bg-revos-surface"
          )}
        >
          {dropStatus?.type === 'loading' && uploadProgress ? (
            <div className="w-full max-w-[400px] mx-auto">
              {/* File counter */}
              <div className="font-mono text-xs text-revos-text-mid mb-3 text-center">
                {uploadProgress.phase === 'building'
                  ? 'Building accounts...'
                  : `${uploadProgress.phase === 'reading' ? 'Reading' : 'Parsing'} ${uploadProgress.fileName}`}
              </div>
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-revos-border rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-revos-cyan transition-[width] duration-150 ease-linear"
                  style={{
                    width: `${Math.round(((uploadProgress.current + (uploadProgress.phase === 'parsing' ? 0.5 : 0)) / uploadProgress.total) * 100)}%`,
                  }}
                />
              </div>
              {/* Counter text */}
              <div className="font-mono text-[10px] text-revos-text-dim text-center">
                {uploadProgress.phase === 'building'
                  ? 'Aggregating records into accounts'
                  : `${uploadProgress.current + 1} of ${uploadProgress.total} files`}
              </div>
            </div>
          ) : (
            <>
              <div className="text-[48px] mb-4 opacity-60">
                {dropStatus?.type === 'loading' ? '...' : ''}
              </div>
              <div className="font-mono text-sm text-revos-text-mid mb-2">
                {dropStatus?.type === 'loading' ? 'Processing...' : 'Drop all files here or click to select'}
              </div>
              <div className="font-mono text-[10px] text-revos-text-dim leading-[1.6]">
                Select all CSV + JSON files from your data folder<br/>
                customers.csv, funnel.csv, close_lost.csv, services.csv, ICB.csv,<br/>
                locations.json, historical.json, engagements.json, etc.
              </div>
            </>
          )}
        </div>

        {dropStatus && dropStatus.type !== 'loading' && (
          <div
            className={cn(
              "mt-4 px-5 py-3 rounded-lg font-mono text-[11px] max-w-[600px] w-full border",
              dropStatus.type === 'error'
                ? "bg-revos-red/10 text-revos-red border-revos-red/20"
                : "bg-revos-green/10 text-revos-green border-revos-green/20"
            )}
          >
            {dropStatus.message}
          </div>
        )}

        <div className="mt-6 font-mono text-[9px] text-revos-text-dim text-center">
          YOUR DATA NEVER LEAVES YOUR COMPUTER
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-revos-bg text-revos-text font-sans flex flex-col overflow-hidden">
      <Header accountCount={searchedAccounts.length} onLogoClick={() => setMode(null)} />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[220px] border-r border-revos-border bg-revos-surface flex flex-col shrink-0 min-h-0 overflow-hidden">
          {/* Data source panel */}
          <div className="p-2 border-b border-revos-border shrink-0">
            {/* Data folder selector — prefer FS API, fall back to server path input */}
            <div className="mb-1.5">
              {fsApiSupported ? (
                <button
                  onClick={async () => {
                    const result = await connectFolder()
                    if (result.error && result.error !== 'cancelled') setDirError(result.error)
                  }}
                  className="w-full px-2 py-1.5 rounded-[5px] cursor-pointer font-mono text-[9px] font-semibold bg-revos-card border border-revos-border text-revos-cyan flex items-center gap-1.5 transition-[border-color] duration-150 hover:border-revos-cyan"
                >
                  <span className="text-xs">📂</span>
                  {fsMode === 'fs-api' ? 'Change Data Folder' : 'Connect Data Folder'}
                </button>
              ) : (
                <button
                  onClick={() => { setShowDirPicker(!showDirPicker); setDirError(''); if (!dirInput && dataDir) setDirInput(dataDir) }}
                  className="w-full px-2 py-1.5 rounded-[5px] cursor-pointer font-mono text-[9px] font-semibold bg-revos-card border border-revos-border text-revos-cyan flex items-center gap-1.5 transition-[border-color] duration-150 hover:border-revos-cyan"
                >
                  <span className="text-xs">📂</span>
                  {dataDir ? 'Change Data Folder' : 'Select Data Folder'}
                </button>
              )}
              {dataDir && !showDirPicker && (
                <div className="font-mono text-[8px] text-revos-text-dim mt-[3px] break-all">
                  {fsMode === 'fs-api' ? `Local: ${dataDir}` : dataDir}
                </div>
              )}
              {showDirPicker && (
                <div className="mt-1.5 p-2 bg-revos-surface border border-revos-border rounded-md">
                  <div className="font-mono text-[8px] text-revos-text-dim mb-1">
                    Paste the full path to your data folder:
                  </div>
                  <input
                    type="text"
                    value={dirInput}
                    onChange={(e) => setDirInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSetDir()}
                    placeholder="C:\Users\...\data"
                    className="w-full px-1.5 py-[5px] font-mono text-[9px] bg-revos-card border border-revos-border rounded-[4px] text-revos-text outline-none mb-1 focus:border-revos-cyan"
                    autoFocus
                  />
                  {dirError && (
                    <div className="font-mono text-[8px] text-revos-red mb-1">
                      {dirError}
                    </div>
                  )}
                  <div className="flex gap-1">
                    <button
                      onClick={handleSetDir}
                      className="flex-1 py-1 rounded-[4px] cursor-pointer font-mono text-[9px] font-semibold bg-revos-cyan/10 border border-revos-cyan text-revos-cyan"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => { setShowDirPicker(false); setDirError('') }}
                      className="px-2 py-1 rounded-[4px] cursor-pointer font-mono text-[9px] bg-transparent border border-revos-border text-revos-text-dim"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Show local file status if files exist in data/ */}
            {localFiles.length > 0 && (
              <div className="px-2 py-1.5 rounded-md mb-1.5 font-mono text-[9px] bg-revos-green/[0.03] border border-revos-green/[0.13]">
                <div className="text-revos-green mb-[3px] flex justify-between items-center">
                  <span>{localFiles.length} FILES LOADED</span>
                  <button
                    onClick={() => refresh()}
                    disabled={localLoading}
                    className={cn(
                      "px-1.5 py-0.5 rounded-[3px] font-mono text-[8px] font-semibold bg-transparent text-revos-cyan border border-revos-cyan/[0.27]",
                      localLoading ? "cursor-default opacity-50" : "cursor-pointer"
                    )}
                  >
                    {localLoading ? 'LOADING...' : 'REFRESH'}
                  </button>
                </div>
                {localFiles.map((f) => (
                  <div key={f.name} className="text-revos-text-dim text-[8px]">
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
          <div className="p-2 border-b border-revos-border shrink-0">
            <div className="font-sans text-[9px] text-revos-text-dim tracking-[0.04em] mb-1"><Tip label="MANAGER">MANAGER</Tip></div>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => { setManagerFilter('all'); setSelAcct(0) }}
                className={cn(
                  "px-2 py-[3px] text-[10px] font-mono border-none rounded-[4px] cursor-pointer",
                  managerFilter === 'all'
                    ? "bg-revos-cyan/[0.08] shadow-[0_0_0_1px_rgba(110,200,228,0.19)] text-revos-cyan"
                    : "bg-revos-surface text-revos-text-dim"
                )}
              >
                ALL
              </button>
              {MANAGERS.map(m => (
                <button
                  key={m}
                  onClick={() => { setManagerFilter(m); setSelAcct(0) }}
                  className={cn(
                    "px-2 py-[3px] text-[10px] font-mono border-none rounded-[4px] cursor-pointer",
                    managerFilter === m
                      ? "bg-revos-cyan/[0.08] shadow-[0_0_0_1px_rgba(110,200,228,0.19)] text-revos-cyan"
                      : "bg-revos-surface text-revos-text-dim"
                  )}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {/* Sales Owner filter */}
          {salesOwners.length > 0 && (
            <div className="p-2 border-b border-revos-border shrink-0">
              <div className="font-sans text-[9px] text-revos-text-dim tracking-[0.04em] mb-1">
                <Tip label="SALES OWNER">SALES OWNER</Tip>
              </div>
              <select
                value={ownerFilter}
                onChange={(e) => { setOwnerFilter(e.target.value); setSelAcct(0) }}
                className={cn(
                  "w-full px-1.5 py-[5px] font-mono text-[10px] bg-revos-card rounded-[4px] outline-none cursor-pointer appearance-auto border",
                  ownerFilter !== 'all'
                    ? "border-revos-cyan text-revos-cyan"
                    : "border-revos-border text-revos-text"
                )}
              >
                <option value="all">All Sales Owners</option>
                {salesOwners.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}
          {/* Account search */}
          <div className="px-2 py-1.5 border-b border-revos-border shrink-0 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSelAcct(0) }}
              placeholder="Search accounts..."
              className="w-full py-[5px] pl-2 pr-[22px] font-mono text-[10px] bg-revos-card border border-revos-border rounded-[4px] text-revos-text outline-none box-border focus:border-revos-cyan"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSelAcct(0) }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer px-0.5 py-0 font-mono text-xs text-revos-text-dim leading-none"
              >
                x
              </button>
            )}
          </div>
          {/* Account list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <Sidebar accounts={searchedAccounts} selectedIndex={selAcct} onSelect={setSelAcct} />
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <TopNav activePage={page} onPageChange={setPage} />

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {page === 'premier' ? (
              <GTMPremier accounts={searchedAccounts} />
            ) : page === 'priority' ? (
              <Priority
                accounts={searchedAccounts}
                onSelect={(idx) => { setSelAcct(idx); setPage('overview') }}
                backtestResults={backtestResults}
              />
            ) : page === 'engagement' ? (
              <Engagement
                accounts={searchedAccounts}
                onSelect={(idx) => { setSelAcct(idx); setPage('overview') }}
              />
            ) : !a ? (
              <div className="text-center px-5 py-[60px] text-revos-text-dim">
                <div className="font-mono text-xs mb-2">NO ACCOUNTS FOUND</div>
                <div className="text-[11px]">No accounts match this manager filter. Check that your customers.csv has a "Sales Funnel Manager" column.</div>
              </div>
            ) : (
            <>
            {/* Page header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-[3px]">
                  <h2 className="text-lg font-bold m-0">{a.name}</h2>
                  {a.account_id && (
                    <a
                      href={`https://zayo.lightning.force.com/lightning/r/Opportunity/${a.account_id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[9px] font-semibold px-2 py-[3px] rounded-xl text-revos-cyan no-underline cursor-pointer bg-revos-cyan/10 border border-revos-cyan"
                    >
                      SFDC ↗
                    </a>
                  )}
                  <Badge color={a.risk_score >= 50 ? T.red : a.risk_score >= 30 ? T.orange : T.green}>
                    {a.risk_level.toUpperCase()}
                  </Badge>
                  {a.risk_score >= 30 && <Badge color={T.red}>RISK {a.risk_score}/100</Badge>}
                </div>
                <div className="font-mono text-[10px] text-revos-text-mid">
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
            {page === 'predict' && <Predictions a={a} backtestResults={backtestResults} />}
            {page === 'deals' && <Deals a={a} />}
            {page === 'signals' && <Signals a={a} />}
            {page === 'losses' && <Losses a={a} />}
            {page === 'backtest' && <Backtest a={a} backtestResults={backtestResults} />}
            {page === 'learning' && <Learning a={a} />}
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
