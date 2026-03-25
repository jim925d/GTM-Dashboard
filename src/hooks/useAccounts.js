import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { parseCSV } from '../lib/normalize'
import { buildAccountState, normalizeStage } from '../lib/accountBuilder'

/**
 * All data stays in browser memory only.
 * Nothing is sent to any server. CSV files are read via FileReader API,
 * parsed in-browser, and stored in React state.
 */
export default function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [isDemo, setIsDemo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Raw table data — stored in memory only, never transmitted
  const [rawData, setRawData] = useState({
    customers: [],
    funnel: [],
    close_lost: [],
    quotes: [],
    services: [],
    locations: [],
    icb: [],
  })
  const [jsonData, setJsonData] = useState({
    locations: {},
    historical: {},
    engagements: {},
    engagements_2026: {},
  })

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
      reader.readAsText(file)
    })
  }

  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
      reader.readAsArrayBuffer(file)
    })
  }

  // XLSX sheet name → data type mapping (mirrors useLocalData.js)
  const xlsxSheetToTabType = (sheetName) => {
    const key = sheetName.trim().toLowerCase().replace(/\s+/g, ' ')
    const map = {
      'customers': 'customers', 'historicals': 'funnel', 'churn': 'close_lost',
      'closed lost': 'close_lost', 'services': 'services', 'quotes': 'quotes',
      'engagement': 'engagements', 'engagement_2026': 'engagements_2026',
      'hiearchy': 'hierarchy', 'hierarchy': 'hierarchy',
    }
    if (map[key]) return map[key]
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

  const detectTabType = (record) => {
    const fields = new Set(Object.keys(record))
    if (fields.has('loss_reason') || fields.has('stage_lost_from')) return 'close_lost'
    if (fields.has('stage') && fields.has('forecast_category')) return 'funnel'
    if (fields.has('quoted_mrr') || fields.has('quote_status')) return 'quotes'
    if (fields.has('service_status') || fields.has('service_id') || fields.has('disconnect_date')) return 'services'
    if (fields.has('on_net_status') || fields.has('location_type')) return 'locations'
    if (fields.has('icb_id')) return 'icb'
    if (fields.has('mega_vertical') || fields.has('primary_rep') || fields.has('account_tier')) return 'customers'
    return 'funnel'
  }

  const tabTypeFromFileName = (name) => {
    const base = name.replace('.csv', '').toLowerCase().replace(/[^a-z_]/g, '')
    const KNOWN = ['customers', 'funnel', 'close_lost', 'quotes', 'services', 'locations', 'icb']
    if (KNOWN.includes(base)) return base
    if (base.includes('customer') || base.includes('account')) return 'customers'
    if (base.includes('funnel') || base.includes('pipeline') || base.includes('opportunity')) return 'funnel'
    if (base.includes('historical') || base.includes('closed_won') || base.includes('won') || base.includes('history')) return 'funnel'
    if (base.includes('lost') || base.includes('loss')) return 'close_lost'
    if (base.includes('quote') || base.includes('proposal')) return 'quotes'
    if (base.includes('service') || base.includes('circuit') || base.includes('install')) return 'services'
    if (base.includes('location') || base.includes('site')) return 'locations'
    if (base.includes('icb')) return 'icb'
    return null
  }

  /**
   * Ingest a single CSV file. Processes entirely in-browser.
   * Returns { accounts_count, records_ingested, tab_type }
   */
  const ingestLocalCSV = useCallback(async (file, tabType = 'auto') => {
    setLoading(true)
    setError(null)
    try {
      const text = await readFileAsText(file)
      const records = parseCSV(text)

      if (!records.length) {
        throw new Error('No records found. Check that columns match expected names.')
      }

      const detectedType = tabType === 'auto' ? detectTabType(records[0]) : tabType

      setRawData((prev) => {
        const updated = { ...prev, [detectedType]: [...prev[detectedType], ...records] }
        // Rebuild accounts from raw data
        rebuildAccounts(updated)
        return updated
      })

      return {
        accounts_count: new Set(records.map((r) => r.customer_account).filter(Boolean)).size,
        records_ingested: { [detectedType]: records.length },
        tab_type: detectedType,
      }
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Ingest multiple CSV files at once, one per table type.
   */
  const ingestMultiCSV = useCallback(async (files) => {
    setLoading(true)
    setError(null)
    try {
      const results = {}
      const newRaw = { customers: [], funnel: [], close_lost: [], quotes: [], services: [], locations: [] }

      for (const [tabType, file] of Object.entries(files)) {
        if (!file) continue
        const text = await readFileAsText(file)
        const records = parseCSV(text)
        newRaw[tabType] = records
        results[tabType] = records.length
      }

      setRawData(newRaw)
      rebuildAccounts(newRaw)

      const allAccounts = new Set()
      for (const records of Object.values(newRaw)) {
        for (const r of records) {
          if (r.customer_account) allAccounts.add(r.customer_account)
        }
      }

      return { accounts_count: allAccounts.size, records_ingested: results }
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const rebuildAccounts = useCallback((raw, json) => {
    const jd = json || { locations: {}, historical: {}, engagements: {}, engagements_2026: {} }

    // Collect all unique customer account names
    const accountNames = new Set()
    for (const records of Object.values(raw)) {
      if (!Array.isArray(records)) continue
      for (const r of records) {
        if (r.customer_account) accountNames.add(r.customer_account)
      }
    }

    if (accountNames.size === 0) return

    // Build customer map with BRR aggregation
    const customerMap = {}
    for (const c of raw.customers) {
      if (!c.customer_account) continue
      if (!customerMap[c.customer_account]) {
        customerMap[c.customer_account] = { ...c }
      } else {
        const existing = customerMap[c.customer_account]
        const prevBRR = parseFloat(String(existing.total_brr || '').replace(/[$,\s]/g, '')) || 0
        const addBRR = parseFloat(String(c.total_brr || '').replace(/[$,\s]/g, '')) || 0
        existing.total_brr = prevBRR + addBRR
      }
    }

    // Build ICB lookup by opportunity name
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
      const customer = customerMap[name] || {
        customer_account: name,
        mega_vertical: 'Unknown',
        primary_rep: 'Unknown',
      }
      const funnel = index.funnel?.get(name) || []
      const closeLost = index.close_lost?.get(name) || []
      const quotes = index.quotes?.get(name) || []
      const services = index.services?.get(name) || []
      const locations = index.locations?.get(name) || []

      const jsonLocations = jd.locations[name] || []
      const jsonHistorical = jd.historical[name] || []
      const eng25 = jd.engagements[name] || null
      const eng26 = jd.engagements_2026[name] || null

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
        // funnel_closed: closed deals from funnel.csv ONLY — used for bookings & forecast
        // NEVER replaced by JSON historical data
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
        // historical_deals: from JSON historical (for modeling/predictions only)
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
        backtest: [],
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
        revenue_tl: [],
        engagement: mergeEngagement(eng25, eng26),
        learning: [],
        locations: jsonLocations.length > 0
          ? jsonLocations.map(l => ({
              name: l.n || 'Unknown', type: l.t || 'Office', address: l.a || '',
              lat: l.la || null, lng: l.lo || null, status: l.s || 'off-net',
              mrr: l.m || 0, classification: l.c || '', feet_from_network: l.ft || 0, market: l.mk || '',
            }))
          : state.locations.map((l) => {
              let netStatus = (l.on_net_status || l.status || 'off-net').toLowerCase()
              if (netStatus.includes('on zayo') || netStatus.includes('on-net') || netStatus === 'on net') netStatus = 'on-net'
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
                classification: '', feet_from_network: 0, market: '',
              }
            }),
        services: state.services
          .filter(s => (s.service_status || '').toLowerCase() === 'active')
          .map(s => ({
            product: s.product_group || s.product || 'Unknown',
            mrr: parseFloat(s.mrr) || 0,
            expDate: s.exp_date || s.contract_end_date || s.term_end || '',
            term: s.term_months || s.term || '',
            status: s.service_status || 'active',
            locationA: s.location_a || '',
            locationZ: s.location_z || '',
            bandwidth: s.bandwidth || '',
          })),
      })
    }

    built.sort((a, b) => b.tmr - a.tmr)
    setAccounts(built)
    setIsDemo(false)
  }, [])

  /**
   * Ingest all dropped files at once — CSV and JSON.
   * This is the primary path for hosted/browser-only mode.
   */
  const ingestAllFiles = useCallback(async (fileList, onProgress) => {
    setLoading(true)
    setError(null)
    try {
      const newRaw = { customers: [], funnel: [], close_lost: [], quotes: [], services: [], locations: [], icb: [] }
      const newJson = { locations: {}, historical: {}, engagements: {}, engagements_2026: {} }
      const results = {}
      const total = fileList.length

      const tick = () => new Promise(r => setTimeout(r, 0))

      for (let i = 0; i < total; i++) {
        const file = fileList[i]
        const name = file.name.toLowerCase()
        if (onProgress) { onProgress({ current: i, total, fileName: file.name, phase: 'reading' }); await tick() }

        // Handle XLSX files first (need ArrayBuffer, not text)
        if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
          if (onProgress) { onProgress({ current: i, total, fileName: file.name, phase: 'parsing' }); await tick() }
          const buf = await readFileAsArrayBuffer(file)
          const wb = XLSX.read(buf, { type: 'array' })
          for (const sheetName of wb.SheetNames) {
            const tabType = xlsxSheetToTabType(sheetName)
            if (!tabType) continue
            const ws = wb.Sheets[sheetName]
            const csvText = XLSX.utils.sheet_to_csv(ws)
            const sheetRecords = parseCSV(csvText)
            if (!sheetRecords.length) continue
            if (!newRaw[tabType]) newRaw[tabType] = []
            newRaw[tabType] = [...newRaw[tabType], ...sheetRecords]
            results[tabType] = (results[tabType] || 0) + sheetRecords.length
          }
          continue
        }

        const text = await readFileAsText(file)

        // Handle JSON files
        if (name.endsWith('.json')) {
          try {
            if (onProgress) { onProgress({ current: i, total, fileName: file.name, phase: 'parsing' }); await tick() }
            const parsed = JSON.parse(text)
            if (name.includes('location')) newJson.locations = parsed
            else if (name.includes('historical')) newJson.historical = parsed
            else if (name.includes('engagement') && name.includes('2026')) newJson.engagements_2026 = parsed
            else if (name.includes('engagement')) newJson.engagements = parsed
            results[name] = Object.keys(parsed).length + ' entries'
          } catch {}
          continue
        }

        // Handle CSV files
        if (!name.endsWith('.csv')) continue
        if (onProgress) { onProgress({ current: i, total, fileName: file.name, phase: 'parsing' }); await tick() }
        const records = parseCSV(text)
        if (!records.length) continue

        let tabType = tabTypeFromFileName(file.name)
        if (!tabType) tabType = detectTabType(records[0])
        if (!newRaw[tabType]) newRaw[tabType] = []
        newRaw[tabType] = [...newRaw[tabType], ...records]
        results[tabType] = (results[tabType] || 0) + records.length
      }

      if (onProgress) { onProgress({ current: total, total, fileName: '', phase: 'building' }); await tick() }
      setRawData(newRaw)
      setJsonData(newJson)
      rebuildAccounts(newRaw, newJson)

      const allAccounts = new Set()
      for (const records of Object.values(newRaw)) {
        for (const r of records) {
          if (r.customer_account) allAccounts.add(r.customer_account)
        }
      }

      return { accounts_count: allAccounts.size, records_ingested: results }
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const clearData = useCallback(() => {
    setRawData({ customers: [], funnel: [], close_lost: [], quotes: [], services: [], locations: [], icb: [] })
    setJsonData({ locations: {}, historical: {}, engagements: {}, engagements_2026: {} })
    setAccounts([])
    setIsDemo(false)
    setError(null)
  }, [])

  return { accounts, isDemo, loading, error, rawData, ingestLocalCSV, ingestMultiCSV, ingestAllFiles, clearData }
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

  const parseD = (s) => { if (!s) return 0; const p = s.split('/'); return p.length >= 3 ? new Date(p[2], p[0] - 1, p[1]).getTime() : 0 }
  events.sort((a, b) => parseD(b.d) - parseD(a.d))
  events = events.slice(0, 50)

  const timeline = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }))

  return { total, byType, timeline, contacts, reps, lastDate, events }
}
