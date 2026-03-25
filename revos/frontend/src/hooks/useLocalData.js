import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { parseCSV } from '../lib/normalize'
import { buildAccountState, buildBacktestData, buildLearningData, buildCalibration, normalizeStage } from '../lib/accountBuilder'

/**
 * Auto-loads CSV files from the local data/ folder.
 *
 * FILE NAMING CONVENTION — place CSVs in frontend/data/:
 *   customers.csv    → Customer master data
 *   funnel.csv       → Active pipeline deals
 *   close_lost.csv   → Deals lost
 *   quotes.csv       → Proposals
 *   services.csv     → Installed base
 *   locations.csv    → Customer sites
 *
 * Or use any filename — the system auto-detects the table type from column headers.
 *
 * Polls every 5 seconds for file changes (Xappex updates → instant refresh).
 * ALL DATA STAYS LOCAL — served by Vite dev server from your filesystem.
 */

const KNOWN_TABS = ['customers', 'funnel', 'close_lost', 'quotes', 'services', 'locations', 'icb', 'rep_profiles']

function tabTypeFromFileName(name) {
  const base = name.replace('.csv', '').toLowerCase().replace(/[^a-z_]/g, '')
  if (KNOWN_TABS.includes(base)) return base
  if (base.includes('customer') || base.includes('account')) return 'customers'
  if (base.includes('funnel') || base.includes('pipeline') || base.includes('opportunity')) return 'funnel'
  if (base.includes('historical') || base.includes('closed_won') || base.includes('won') || base.includes('history')) return 'funnel'
  if (base.includes('lost') || base.includes('loss')) return 'close_lost'
  if (base.includes('quote') || base.includes('proposal')) return 'quotes'
  if (base.includes('service') || base.includes('circuit') || base.includes('install')) return 'services'
  if (base.includes('location') || base.includes('site')) return 'locations'
  if (base.includes('icb')) return 'icb'
  if (base.includes('rep_profile') || base.includes('rep_quota')) return 'rep_profiles'
  return null // will auto-detect from columns
}

function detectTabTypeFromRecord(record) {
  const fields = new Set(Object.keys(record))
  if (fields.has('loss_reason') || fields.has('stage_lost_from')) return 'close_lost'
  if (fields.has('stage') && fields.has('forecast_category')) return 'funnel'
  if (fields.has('quoted_mrr') || fields.has('quote_status')) return 'quotes'
  if (fields.has('service_status') || fields.has('service_id') || fields.has('disconnect_date')) return 'services'
  if (fields.has('on_net_status') || fields.has('location_type')) return 'locations'
  if (fields.has('icb_id')) return 'icb'
  if (fields.has('annual_quota') || fields.has('q1_quota') || fields.has('rep_id')) return 'rep_profiles'
  if (fields.has('mega_vertical') || fields.has('primary_rep') || fields.has('account_tier')) return 'customers'
  return 'funnel'
}

// ── XLSX sheet name → data type mapping ──────────────────────────────────────
const XLSX_SHEET_MAP = {
  'customers': 'customers',
  'historicals': 'funnel',        // contains both active pipeline + closed deals
  'churn': 'close_lost',          // churn deals map to close_lost
  'closed lost': 'close_lost',
  'services': 'services',
  'quotes': 'quotes',
  'engagement': 'engagements',
  'engagement_2026': 'engagements_2026',
  'hiearchy': 'hierarchy',
  'hierarchy': 'hierarchy',
}

function xlsxSheetToTabType(sheetName) {
  const key = sheetName.trim().toLowerCase().replace(/\s+/g, ' ')
  if (XLSX_SHEET_MAP[key]) return XLSX_SHEET_MAP[key]
  // Fuzzy match
  if (key.includes('customer')) return 'customers'
  if (key.includes('historical') || key.includes('funnel') || key.includes('pipeline')) return 'funnel'
  if (key.includes('churn') || key.includes('lost') || key.includes('loss')) return 'close_lost'
  if (key.includes('service')) return 'services'
  if (key.includes('quote')) return 'quotes'
  if (key.includes('engagement') && key.includes('2026')) return 'engagements_2026'
  if (key.includes('engagement')) return 'engagements'
  if (key.includes('hierarch')) return 'hierarchy'
  return null
}

async function parseXlsxFile(url) {
  const res = await fetch(url)
  if (!res.ok) return {}
  const buf = await res.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const result = {}
  for (const sheetName of wb.SheetNames) {
    const tabType = xlsxSheetToTabType(sheetName)
    if (!tabType) continue
    const ws = wb.Sheets[sheetName]
    // Convert sheet to CSV text, then use existing parseCSV for field normalization
    const csvText = XLSX.utils.sheet_to_csv(ws)
    const records = parseCSV(csvText)
    if (!records.length) continue
    if (!result[tabType]) result[tabType] = []
    result[tabType].push(...records)
  }
  return result
}

export default function useLocalData() {
  const [localFiles, setLocalFiles] = useState([])
  const [localAccounts, setLocalAccounts] = useState(null) // null = not loaded yet
  const [localRawData, setLocalRawData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dataDir, setDataDirState] = useState('')

  // On mount, restore saved data dir from localStorage and send to server
  useEffect(() => {
    const saved = localStorage.getItem('revos_data_dir')
    if (saved) {
      fetch('/local-data/data-dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: saved }),
      }).then(r => r.json()).then(d => {
        if (d.ok) setDataDirState(d.dataDir)
        else localStorage.removeItem('revos_data_dir')
      }).catch(() => {})
    }
    // Also fetch the current server data dir
    fetch('/local-data/data-dir').then(r => r.json()).then(d => {
      if (d.dataDir && !saved) setDataDirState(d.dataDir)
    }).catch(() => {})
  }, [])

  const loadAllFiles = useCallback(async (files) => {
    setLoading(true)
    setError(null)
    try {
      const raw = { customers: [], funnel: [], close_lost: [], quotes: [], services: [], locations: [], icb: [], rep_profiles: [], engagements: [], engagements_2026: [], hierarchy: [] }

      // Track which data types were loaded from XLSX (these take priority)
      const xlsxTypes = new Set()

      // 1) Load XLSX files first — they take priority over individual CSVs
      const xlsxFiles = files.filter(f => f.name.endsWith('.xlsx') || f.type === 'xlsx')
      for (const file of xlsxFiles) {
        const xlsxData = await parseXlsxFile(`/local-data/file?name=${encodeURIComponent(file.realName || file.name)}`)
        for (const [tabType, records] of Object.entries(xlsxData)) {
          if (raw[tabType]) {
            raw[tabType] = [...raw[tabType], ...records]
            xlsxTypes.add(tabType)
          }
        }
      }

      // 2) Load CSV files — skip types already loaded from XLSX
      const csvFiles = files.filter(f => f.name.endsWith('.csv'))
      for (const file of csvFiles) {
        let tabType = tabTypeFromFileName(file.name)
        // Skip CSVs whose data type was already loaded from XLSX
        if (tabType && xlsxTypes.has(tabType)) continue

        const res = await fetch(`/local-data/file?name=${encodeURIComponent(file.name)}`)
        if (!res.ok) continue
        const text = await res.text()
        const records = parseCSV(text)
        if (!records.length) continue

        if (!tabType) {
          tabType = detectTabTypeFromRecord(records[0])
        }
        // Skip if XLSX already provided this type
        if (xlsxTypes.has(tabType)) continue

        raw[tabType] = [...raw[tabType], ...records]
      }

      // Load pre-built JSON files (locations + historical + engagements)
      // Only load JSON if XLSX didn't provide the data
      let locationsJSON = {}
      let historicalJSON = {}
      let engagements2025 = {}
      let engagements2026 = {}
      try {
        const locRes = await fetch('/local-data/locations.json')
        if (locRes.ok) locationsJSON = await locRes.json()
      } catch {}
      if (!xlsxTypes.has('funnel')) {
        try {
          const histRes = await fetch('/local-data/historical.json')
          if (histRes.ok) historicalJSON = await histRes.json()
        } catch {}
      }
      if (!xlsxTypes.has('engagements')) {
        try {
          const eng25Res = await fetch('/local-data/engagements.json')
          if (eng25Res.ok) engagements2025 = await eng25Res.json()
        } catch {}
      }
      if (!xlsxTypes.has('engagements_2026')) {
        try {
          const eng26Res = await fetch('/local-data/engagements_2026.json')
          if (eng26Res.ok) engagements2026 = await eng26Res.json()
        } catch {}
      }

      setLocalRawData(raw)
      const accounts = buildAccountsFromRaw(raw, locationsJSON, historicalJSON, engagements2025, engagements2026)
      setLocalAccounts(accounts)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load data from the current data folder (called once on mount + on manual refresh)
  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/local-data/manifest')
      if (!res.ok) return
      const { files } = await res.json()
      setLocalFiles(files || [])

      if (!files || files.length === 0) return

      await loadAllFiles(files)
    } catch {
      // Vite plugin not running (production build) — that's fine
    }
  }, [loadAllFiles])

  const setDataDir = useCallback(async (dir) => {
    try {
      const res = await fetch('/local-data/data-dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir }),
      })
      const data = await res.json()
      if (!res.ok) return { error: data.error }
      setDataDirState(data.dataDir)
      localStorage.setItem('revos_data_dir', dir)
      setLocalAccounts(null)
      // Small delay so server registers the new dir before we fetch manifest
      await new Promise(r => setTimeout(r, 100))
      await loadData()
      return { ok: true, dataDir: data.dataDir }
    } catch (err) {
      return { error: err.message }
    }
  }, [loadData])

  // Load once on mount
  useEffect(() => {
    loadData()
  }, [loadData])

  // Track whether the local server is available
  const [serverAvailable, setServerAvailable] = useState(null) // null = unknown

  // Detect server availability on mount
  useEffect(() => {
    fetch('/local-data/manifest')
      .then(r => { if (r.ok) setServerAvailable(true); else setServerAvailable(false) })
      .catch(() => setServerAvailable(false))
  }, [])

  return {
    localFiles,
    localAccounts,
    localRawData,
    loading,
    error,
    dataDir,
    setDataDir,
    refresh: loadData,
    serverAvailable,
  }
}

function buildAccountsFromRaw(raw, locationsJSON = {}, historicalJSON = {}, engagements2025 = {}, engagements2026 = {}) {
  // Only customers.csv defines the account list
  const customerMap = {}
  for (const c of raw.customers) {
    if (!c.customer_account) continue
    if (!customerMap[c.customer_account]) {
      customerMap[c.customer_account] = { ...c }
    } else {
      // Sum total_brr across multiple rows for the same account
      const existing = customerMap[c.customer_account]
      const prevBRR = parseFloat(String(existing.total_brr || '').replace(/[$,\s]/g, '')) || 0
      const addBRR = parseFloat(String(c.total_brr || '').replace(/[$,\s]/g, '')) || 0
      existing.total_brr = prevBRR + addBRR
    }
  }

  const accountNames = new Set(Object.keys(customerMap))

  if (accountNames.size === 0) return []

  // Build ICB lookup: opportunity_name → full ICB record
  const icbByOppName = {}
  for (const rec of (raw.icb || [])) {
    if (rec.opportunity_name) {
      icbByOppName[String(rec.opportunity_name).trim()] = {
        icb_id: String(rec.icb_id || ''),
        stage: rec.icb_stage || rec.stage || '',
        created_date: rec.icb_created_date || rec.created_date || '',
        se_review_date: rec.icb_se_review_date || '',
        se_review_time: rec.icb_se_review_time || '',
        status: rec.icb_status || rec.service_status || '',
        se_name: rec.icb_se_name || '',
      }
    }
  }

  // Build indices once — O(M) total instead of O(N×M) filtering
  const index = {}
  for (const [table, records] of Object.entries(raw)) {
    if (!Array.isArray(records)) continue
    index[table] = new Map()
    for (const r of records) {
      const key = r.customer_account
      if (!key) continue
      if (!index[table].has(key)) index[table].set(key, [])
      index[table].get(key).push(r)
    }
  }

  const built = []
  for (const name of accountNames) {
    const customer = customerMap[name]
    const funnel = index.funnel?.get(name) || []
    const closeLost = index.close_lost?.get(name) || []
    const quotes = index.quotes?.get(name) || []
    const services = index.services?.get(name) || []
    const locations = index.locations?.get(name) || []

    // Get pre-built location, historical, and engagement data from JSON
    const jsonLocations = locationsJSON[name] || []
    const jsonHistorical = historicalJSON[name] || []
    // Engagement: prefer raw XLSX/CSV rows over pre-built JSON
    const engRows25 = index.engagements?.get(name) || []
    const engRows26 = index.engagements_2026?.get(name) || []
    const eng25 = engRows25.length > 0 ? buildEngagementFromRows(engRows25) : (engagements2025[name] || null)
    const eng26 = engRows26.length > 0 ? buildEngagementFromRows(engRows26) : (engagements2026[name] || null)

    const state = buildAccountState(customer, funnel, closeLost, quotes, services, locations)

    built.push({
      id: name,
      name,
      account_id: state.account_id,
      vertical: state.mega_vertical,
      tmr: state.total_tmr,
      mrr: state.total_mrr,
      pipeline_mrr: state.active_pipeline_mrr,
      pipeline_count: state.active_pipeline_count,
      won: state.total_deals_won,
      lost: state.total_deals_lost,
      win_rate: state.win_rate,
      avg_cycle: 0,
      nrr: state.net_revenue_retention,
      days_silent: state.days_since_last_activity,
      velocity: state.deal_velocity_trend,
      risk_score: state.risk_score,
      risk_level: state.risk_level,
      health: state.health,
      health_level: state.health_level,
      health_factors: state.health_factors,
      rep: state.primary_rep,
      manager: state.account_manager,
      sales_owner: state.sales_owner,
      reps: state.rep_count,
      tenure_mo: 0,
      disconnects: state.disconnects,
      downgrades: state.downgrades,
      downgrade_mrr: state.downgrade_mrr,
      churn_deals: state.churn_deals,
      churn_mrr: state.churn_mrr,
      lost_mrr: state.lost_mrr_total,
      products: Object.keys(state.product_concentration),
      concentration: state.product_concentration,
      pipeline_by_stage: state.pipeline_by_stage,
      predictions: [],
      cross_sell: [],
      churn_preds: [],
      portfolio_health: state.health < 40 ? 'at_risk' : state.net_revenue_retention >= 1 ? 'growing' : 'contracting',
      arr_12mo_change: '',
      active_deals: state.funnel_deals.map((d) => {
        const oppName = (d.opportunity_name || '').trim()
        return {
          product: d.product_group,
          mrr: parseFloat(d.mrr) || 0,
          stage: d.stage,
          forecast: d.forecast_category,
          close: d.close_date,
          rep: d.rep,
          opportunity_id: d.opportunity_id || '',
          sales_channel: d.sales_channel || '',
          created: d.created_date || '',
          major_project: d.major_project || '',
          icb: icbByOppName[oppName] || null,
          icb_id: icbByOppName[oppName]?.icb_id || '',
        }
      }),
      // funnel_closed: closed deals from funnel.csv — used for bookings & forecast
      funnel_closed: (state.funnel_closed || []).map(d => ({
        product: d.product || 'Unknown',
        mrr: d.mrr || 0,
        stage: d.stage || '',
        type: d.type || '',
        close: d.close || '',
        rep: d.rep || '',
        opportunity_id: d.opportunity_id || '',
        sales_channel: d.sales_channel || '',
        created: d.created || '',
        forecast: d.forecast_category || '',
        major_project: d.major_project || '',
      })),
      historical_deals: jsonHistorical.length > 0
        ? jsonHistorical.map(d => ({
            product: d.p || 'Unknown', mrr: d.m || 0, stage: d.s || '',
            type: d.t || '', close: d.c || '', rep: d.r || '', manager: d.mg || '',
            forecast: d.f || '', term: d.tm || 0, npv: d.v || 0,
          }))
        : (state.historical_deals || []),
      churn_deals_list: jsonHistorical.length > 0
        ? jsonHistorical.filter(d => normalizeStage(d.s || '') === 'closed won' && (d.m || 0) < 0).map(d => ({
            product: d.p || 'Unknown', mrr: d.m || 0, stage: d.s || '', close: d.c || '',
          }))
        : (state.historical_deals || []).filter(d => d.mrr < 0),
      game_theory: null,
      signals: null,
      backtest: buildBacktestData([...funnel, ...closeLost]),
      calibration: buildCalibration(buildBacktestData([...funnel, ...closeLost])),
      losses: {
        deals: state.close_lost_deals.map((d) => ({
          product: d.product_group || 'Unknown',
          mrr: parseFloat(d.mrr) || 0,
          date: d.close_date,
          type: d.type || d.loss_reason || '',
          rep: d.rep || '',
          days_pipe: 0,
          opportunity_id: d.opportunity_id || '',
        })),
        disconnects: state.services
          .filter(s => (s.service_status || '').toLowerCase() === 'disconnected')
          .map(s => ({
            product: s.product_group || 'Unknown',
            mrr: parseFloat(s.mrr) || 0,
            date: s.disconnect_date || '',
          })),
        downgrades: [],
        by_product: state.lost_by_product,
        timeline: [],
      },
      revenue_tl: buildRevenueTL(jsonHistorical),
      engagement: mergeEngagement(eng25, eng26),
      learning: buildLearningData([...funnel, ...closeLost]),
      locations: jsonLocations.length > 0
        ? jsonLocations.map(l => ({
            name: l.n || 'Unknown',
            type: l.t || 'Office',
            address: l.a || '',
            lat: l.la || null,
            lng: l.lo || null,
            status: l.s || 'off-net',
            mrr: l.m || 0,
            classification: l.c || '',
            feet_from_network: l.ft || 0,
            market: l.mk || '',
          }))
        : state.locations.map((l) => {
            let netStatus = (l.on_net_status || l.status || 'off-net').toLowerCase()
            // "Not on Zayo Network" must NOT match as on-net — check for negation first
            if (netStatus.includes('not on') || netStatus.includes('not connected')) netStatus = 'off-net'
            else if (netStatus.includes('on zayo') || netStatus.includes('on-net') || netStatus === 'on net') netStatus = 'on-net'
            else if (netStatus.includes('near') || netStatus.includes('near-net')) netStatus = 'near-net'
            else netStatus = 'off-net'
            return {
              name: l.location_name || l.name || 'Unknown',
              type: l.location_type || l.type || 'Office',
              address: '',
              lat: parseFloat(l.latitude || l.lat) || null,
              lng: parseFloat(l.longitude || l.lng) || null,
              status: netStatus,
              mrr: parseFloat(l.monthly_revenue || l.mrr) || 0,
              classification: '',
              feet_from_network: 0,
              market: '',
            }
          }),
    })
  }

  built.sort((a, b) => b.tmr - a.tmr)
  return built
}

// Build engagement object from raw CSV/XLSX engagement rows for a given account
function buildEngagementFromRows(rows) {
  if (!rows || rows.length === 0) return null
  const byType = {}
  const byMonth = {}
  let total = 0, contacts = new Set(), reps = new Set(), lastDate = ''
  const events = []

  for (const r of rows) {
    total++
    const task = r.task || r.subject || ''
    if (task) byType[task] = (byType[task] || 0) + 1
    if (r.contact) contacts.add(r.contact)
    if (r.assigned) reps.add(r.assigned)
    const dateStr = r.date || ''
    if (dateStr) {
      if (dateStr > lastDate) lastDate = dateStr
      // Extract YYYY-MM for monthly grouping
      const d = new Date(dateStr)
      if (!isNaN(d.getTime())) {
        const mo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        byMonth[mo] = (byMonth[mo] || 0) + 1
      }
    }
    events.push({ d: dateStr, t: task, s: r.status || '', c: r.contact || '' })
  }

  // Sort events by date descending, keep most recent 50
  events.sort((a, b) => (b.d || '').localeCompare(a.d || ''))
  const timeline = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }))

  return { total, byType, timeline, contacts: contacts.size, reps: reps.size, lastDate, events: events.slice(0, 50) }
}

function mergeEngagement(eng25, eng26) {
  if (!eng25 && !eng26) return null
  const byType = {}
  const byMonth = {}
  let total = 0, contacts = 0, reps = 0, lastDate = ''
  let events = []

  for (const eng of [eng25, eng26]) {
    if (!eng) continue
    total += eng.t || 0
    contacts = Math.max(contacts, eng.c || 0)
    reps = Math.max(reps, eng.r || 0)
    if (eng.l && eng.l > lastDate) lastDate = eng.l
    if (eng.tp) for (const [k, v] of Object.entries(eng.tp)) byType[k] = (byType[k] || 0) + v
    if (eng.m) for (const [k, v] of Object.entries(eng.m)) byMonth[k] = (byMonth[k] || 0) + v
    if (eng.e) events = events.concat(eng.e)
  }

  // Sort events by date descending, keep most recent 50
  const parseD = (s) => { if (!s) return 0; const p = s.split('/'); return p.length >= 3 ? new Date(p[2], p[0] - 1, p[1]).getTime() : 0 }
  events.sort((a, b) => parseD(b.d) - parseD(a.d))
  events = events.slice(0, 50)

  // Build monthly timeline sorted
  const timeline = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }))

  return { total, byType, timeline, contacts, reps, lastDate, events }
}

function buildRevenueTL(jsonHistorical) {
  if (!jsonHistorical || jsonHistorical.length === 0) return []

  // Group deals by quarter from close date
  const quarters = {}
  for (const d of jsonHistorical) {
    const closeDate = d.c || ''
    if (!closeDate) continue
    const date = new Date(closeDate)
    if (isNaN(date.getTime())) continue
    const q = `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`
    if (!quarters[q]) quarters[q] = { new: 0, rr_up: 0, lost: 0 }

    const mrr = d.m || 0
    const stage = normalizeStage(d.s || '')
    const type = (d.t || '').toLowerCase()

    if (stage === 'closed won') {
      if (mrr < 0) {
        // Negative re-rate / churn
        quarters[q].lost += mrr
      } else if (type.includes('re-rate') || type.includes('rerate') || type.includes('upgrade') || type.includes('renewal')) {
        quarters[q].rr_up += mrr
      } else {
        quarters[q].new += mrr
      }
    } else if (stage === 'closed lost') {
      // Don't add to revenue timeline (these weren't won)
    }
  }

  // Sort by quarter and compute cumulative
  const sorted = Object.entries(quarters).sort(([a], [b]) => a.localeCompare(b))
  let cum = 0
  return sorted.map(([q, d]) => {
    cum += d.new + d.rr_up + d.lost
    return {
      q,
      new: Math.round(d.new),
      rr_up: Math.round(d.rr_up),
      lost: Math.round(d.lost),
      cum: Math.round(cum),
    }
  })
}
