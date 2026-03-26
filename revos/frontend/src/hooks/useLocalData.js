import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { parseCSV } from '../lib/normalize'
import { buildAccountState, buildBacktestData, buildLearningData, buildCalibration, normalizeStage } from '../lib/accountBuilder'

/**
 * Auto-loads CSV/XLSX/JSON files from local data.
 *
 * DATA SOURCES (in priority order):
 *   1. File System Access API — user picks a local folder via browser prompt
 *      (works on Vercel / any static host, Chrome/Edge only)
 *   2. Local server — Vite dev plugin or serve.js serves /local-data/* endpoints
 *   3. Drag-and-drop upload — fallback for other browsers
 *
 * ALL DATA STAYS LOCAL — nothing is uploaded to any server.
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
  if (base.includes('engagement') && base.includes('2026')) return 'engagements_2026'
  if (base.includes('engagement')) return 'engagements'
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
  'in': 'locations',              // locations tab (On Zayo Network Status, Market, etc.)
  'locations': 'locations',
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
  if (key.includes('location') || key === 'in') return 'locations'
  return null
}

// Sheets to skip during XLSX parsing — too large for browser, use pre-built JSON instead
const XLSX_SKIP_SHEETS = new Set(['locations'])

async function parseXlsxFromBuffer(buf) {
  // First pass: read only sheet names to determine which to parse
  const wbMeta = XLSX.read(buf, { type: 'array', bookSheets: true })
  const sheetsToLoad = wbMeta.SheetNames.filter(name => {
    const tabType = xlsxSheetToTabType(name)
    return tabType && !XLSX_SKIP_SHEETS.has(tabType)
  })
  // Second pass: parse only the sheets we need
  const wb = XLSX.read(buf, { type: 'array', sheets: sheetsToLoad })
  const result = {}
  for (const sheetName of sheetsToLoad) {
    const tabType = xlsxSheetToTabType(sheetName)
    if (!tabType) continue
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const csvText = XLSX.utils.sheet_to_csv(ws)
    const records = parseCSV(csvText)
    if (!records.length) continue
    if (!result[tabType]) result[tabType] = []
    result[tabType].push(...records)
  }
  return result
}

async function parseXlsxFile(url) {
  const res = await fetch(url)
  if (!res.ok) return {}
  const buf = await res.arrayBuffer()
  return parseXlsxFromBuffer(buf)
}

// ── File System Access API helpers ──────────────────────────────────────────
// Persist the directory handle in IndexedDB so users don't re-pick every session

const IDB_NAME = 'revos-fs'
const IDB_STORE = 'handles'
const IDB_KEY = 'dataDir'

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveHandleToIDB(handle) {
  const db = await openIDB()
  const tx = db.transaction(IDB_STORE, 'readwrite')
  tx.objectStore(IDB_STORE).put(handle, IDB_KEY)
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject })
}

async function loadHandleFromIDB() {
  try {
    const db = await openIDB()
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
    return new Promise((resolve) => { req.onsuccess = () => resolve(req.result || null); req.onerror = () => resolve(null) })
  } catch { return null }
}

async function clearHandleFromIDB() {
  try {
    const db = await openIDB()
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(IDB_KEY)
  } catch {}
}

async function verifyPermission(handle) {
  if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true
  if ((await handle.requestPermission({ mode: 'readwrite' })) === 'granted') return true
  return false
}

// ── IndexedDB Account Cache — stores built accounts keyed by a file fingerprint ─
const CACHE_STORE = 'cache'
const CACHE_KEY = 'accounts'

function computeFingerprint(files) {
  // Create a stable fingerprint from file metadata (name + size + modified)
  const parts = files
    .filter(f => f.type !== 'json') // only fingerprint source data files
    .map(f => `${f.name}:${f.size || 0}:${Math.floor(f.modified || 0)}`)
    .sort()
  return parts.join('|')
}

function openCacheDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('revos-cache', 1)
    req.onupgradeneeded = () => req.result.createObjectStore(CACHE_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getCachedAccounts(fingerprint) {
  try {
    const db = await openCacheDB()
    const tx = db.transaction(CACHE_STORE, 'readonly')
    const req = tx.objectStore(CACHE_STORE).get(CACHE_KEY)
    return new Promise((resolve) => {
      req.onsuccess = () => {
        const cached = req.result
        if (cached && cached.fingerprint === fingerprint) {
          console.log('[RevOS] Cache HIT — loading accounts from IndexedDB')
          resolve(cached)
        } else {
          console.log('[RevOS] Cache MISS — will parse data files')
          resolve(null)
        }
      }
      req.onerror = () => resolve(null)
    })
  } catch { return null }
}

async function setCachedAccounts(fingerprint, accounts, rawData) {
  try {
    const db = await openCacheDB()
    const tx = db.transaction(CACHE_STORE, 'readwrite')
    tx.objectStore(CACHE_STORE).put({ fingerprint, accounts, rawData, ts: Date.now() }, CACHE_KEY)
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject })
    console.log('[RevOS] Accounts cached to IndexedDB')
  } catch (err) {
    console.warn('[RevOS] Failed to cache accounts:', err.message)
  }
}

async function clearAccountCache() {
  try {
    const db = await openCacheDB()
    const tx = db.transaction(CACHE_STORE, 'readwrite')
    tx.objectStore(CACHE_STORE).delete(CACHE_KEY)
  } catch {}
}

// ── Data Bundle helpers — expands columnar format back to record objects ─────
function expandBundle(bundle) {
  if (!bundle || bundle._v !== 2 || !bundle.tables) return null
  const raw = {}
  for (const [tabType, table] of Object.entries(bundle.tables)) {
    const records = []
    const { h: headers, r: rows, extra } = table
    // Primary rows
    for (const row of rows) {
      const record = {}
      for (let i = 0; i < headers.length; i++) {
        if (row[i]) record[headers[i]] = row[i]
      }
      if (Object.keys(record).length > 0) records.push(record)
    }
    // Extra rows (different column set merged into same tabType)
    if (extra) {
      for (const { h: xHeaders, r: xRows } of extra) {
        for (const row of xRows) {
          const record = {}
          for (let i = 0; i < xHeaders.length; i++) {
            if (row[i]) record[xHeaders[i]] = row[i]
          }
          if (Object.keys(record).length > 0) records.push(record)
        }
      }
    }
    raw[tabType] = records
  }
  return raw
}

// List data files from a directory handle
async function listFilesFromHandle(dirHandle) {
  const files = []
  // JSON fallback files — loaded separately, not via manifest
  const jsonFallbacks = new Set(['locations', 'historical', 'engagements', 'engagements_2026', 'data-bundle'])
  // CSVs too large for browser parsing — always use pre-built JSON instead
  const csvTooBig = new Set(['locations', 'locations_geocoded'])
  for await (const entry of dirHandle.values()) {
    if (entry.kind !== 'file') continue
    const name = entry.name
    const isCSV = name.endsWith('.csv')
    const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls')
    const isJSON = name.endsWith('.json')
    if (!isCSV && !isXlsx && !isJSON) continue
    // Skip temp files
    if (name.startsWith('~$')) continue
    // Skip JSON fallback files (loaded separately only if CSV not present)
    if (isJSON && jsonFallbacks.has(name.replace('.json', '').toLowerCase())) continue
    // Skip locations CSVs — too large for browser, always use locations.json
    if (isCSV && csvTooBig.has(name.replace('.csv', '').toLowerCase())) continue
    const file = await entry.getFile()
    files.push({
      name: name.replace('_geocoded', ''),
      realName: name,
      modified: file.lastModified,
      size: file.size,
      type: isXlsx ? 'xlsx' : isJSON ? 'json' : 'csv',
      _handle: entry,
    })
  }
  return files
}

// Read a file's content from a file handle
async function readFileFromHandle(fileHandle, asBuffer = false) {
  const file = await fileHandle.getFile()
  if (asBuffer) return file.arrayBuffer()
  return file.text()
}

// Read a JSON file from the directory handle
async function readJSONFromDir(dirHandle, filename) {
  try {
    const fh = await dirHandle.getFileHandle(filename)
    const text = await readFileFromHandle(fh)
    return JSON.parse(text)
  } catch { return {} }
}

export default function useLocalData() {
  const [localFiles, setLocalFiles] = useState([])
  const [localAccounts, setLocalAccounts] = useState(null) // null = not loaded yet
  const [localRawData, setLocalRawData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dataDir, setDataDirState] = useState('')
  const [fsMode, setFsMode] = useState(null) // 'fs-api' | 'server' | null
  const dirHandleRef = useRef(null)

  // ── File System Access API: load files directly from user's folder ────────
  const loadFromFSHandle = useCallback(async (dirHandle) => {
    setLoading(true)
    setError(null)
    try {
      const files = await listFilesFromHandle(dirHandle)
      setLocalFiles(files)
      setDataDirState(dirHandle.name)

      // ── Cache check: skip all parsing if file fingerprint matches ──
      const fingerprint = computeFingerprint(files)
      const cached = await getCachedAccounts(fingerprint)
      if (cached) {
        setLocalRawData(cached.rawData)
        setLocalAccounts(cached.accounts)
        return
      }

      // ── Try data-bundle.json first (pre-built, much faster than CSV parsing) ──
      let raw = null
      try {
        const bundleJSON = await readJSONFromDir(dirHandle, 'data-bundle.json')
        if (bundleJSON && bundleJSON._v === 2) {
          const expanded = expandBundle(bundleJSON)
          if (expanded && expanded.customers && expanded.customers.length > 0) {
            raw = { customers: [], funnel: [], close_lost: [], quotes: [], services: [], locations: [], icb: [], rep_profiles: [], engagements: [], engagements_2026: [], hierarchy: [], ...expanded }
            console.log('[RevOS] Loaded data from pre-built bundle')
          }
        }
      } catch {}

      // ── Fallback: parse individual CSV/XLSX files ──
      if (!raw) {
        raw = { customers: [], funnel: [], close_lost: [], quotes: [], services: [], locations: [], icb: [], rep_profiles: [], engagements: [], engagements_2026: [], hierarchy: [] }
        const xlsxTypes = new Set()

        // 1) Load XLSX files — skip if CSVs are available (lighter on memory)
        const csvFiles = files.filter(f => f.type === 'csv' || f.name.endsWith('.csv'))
        const xlsxFiles = files.filter(f => f.type === 'xlsx')
        const hasCsvData = csvFiles.length >= 2
        if (!hasCsvData) {
          for (const file of xlsxFiles) {
            if (file.size > 50 * 1024 * 1024) {
              console.warn(`[RevOS] Skipping ${file.name} (${Math.round(file.size / 1024 / 1024)}MB) — too large for browser.`)
              continue
            }
            const buf = await readFileFromHandle(file._handle, true)
            const xlsxData = await parseXlsxFromBuffer(buf)
            for (const [tabType, records] of Object.entries(xlsxData)) {
              if (raw[tabType]) { raw[tabType] = [...raw[tabType], ...records]; xlsxTypes.add(tabType) }
            }
          }
        }

        // 2) Load CSV files
        for (const file of csvFiles) {
          let tabType = tabTypeFromFileName(file.name)
          if (tabType && xlsxTypes.has(tabType)) continue
          const text = await readFileFromHandle(file._handle)
          const records = parseCSV(text)
          if (!records.length) continue
          if (!tabType) tabType = detectTabTypeFromRecord(records[0])
          if (xlsxTypes.has(tabType)) continue
          raw[tabType] = [...raw[tabType], ...records]
        }
      }

      // 3) Locations always use pre-built JSON (CSV too large for browser)
      const locationsJSON = await readJSONFromDir(dirHandle, 'locations.json')

      // 4) Other JSON fallbacks — only when CSV/XLSX didn't provide the data
      const hasCSVFunnel = raw.funnel.length > 0
      const hasCSVEngagements = raw.engagements.length > 0
      const hasCSVEngagements2026 = raw.engagements_2026.length > 0
      const historicalJSON = hasCSVFunnel ? {} : await readJSONFromDir(dirHandle, 'historical.json')
      const engagements2025 = hasCSVEngagements ? {} : await readJSONFromDir(dirHandle, 'engagements.json')
      const engagements2026 = hasCSVEngagements2026 ? {} : await readJSONFromDir(dirHandle, 'engagements_2026.json')

      setLocalRawData(raw)
      const accounts = buildAccountsFromRaw(raw, locationsJSON, historicalJSON, engagements2025, engagements2026)
      setLocalAccounts(accounts)

      // ── Cache the result for next load ──
      await setCachedAccounts(fingerprint, accounts, raw)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Connect a local folder via File System Access API
  const connectFolder = useCallback(async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
      dirHandleRef.current = dirHandle
      await saveHandleToIDB(dirHandle)
      setFsMode('fs-api')
      await loadFromFSHandle(dirHandle)
      return { ok: true }
    } catch (err) {
      if (err.name === 'AbortError') return { error: 'cancelled' }
      return { error: err.message }
    }
  }, [loadFromFSHandle])

  // Disconnect the local folder
  const disconnectFolder = useCallback(async () => {
    dirHandleRef.current = null
    await clearHandleFromIDB()
    await clearAccountCache()
    setFsMode(null)
    setLocalAccounts(null)
    setLocalFiles([])
    setLocalRawData(null)
    setDataDirState('')
  }, [])

  // ── Server mode: load files via fetch from /local-data/* ──────────────────
  const loadAllFilesFromServer = useCallback(async (files) => {
    setLoading(true)
    setError(null)
    try {
      // ── Cache check ──
      const fingerprint = computeFingerprint(files)
      const cached = await getCachedAccounts(fingerprint)
      if (cached) {
        setLocalRawData(cached.rawData)
        setLocalAccounts(cached.accounts)
        return
      }

      // ── Try data-bundle.json first ──
      let raw = null
      try {
        const r = await fetch('/local-data/file?name=data-bundle.json')
        if (r.ok) {
          const bundleJSON = await r.json()
          if (bundleJSON && bundleJSON._v === 2) {
            const expanded = expandBundle(bundleJSON)
            if (expanded && expanded.customers && expanded.customers.length > 0) {
              raw = { customers: [], funnel: [], close_lost: [], quotes: [], services: [], locations: [], icb: [], rep_profiles: [], engagements: [], engagements_2026: [], hierarchy: [], ...expanded }
              console.log('[RevOS] Loaded data from pre-built bundle')
            }
          }
        }
      } catch {}

      // ── Fallback: individual CSV/XLSX files ──
      if (!raw) {
        raw = { customers: [], funnel: [], close_lost: [], quotes: [], services: [], locations: [], icb: [], rep_profiles: [], engagements: [], engagements_2026: [], hierarchy: [] }
        const xlsxTypes = new Set()

        const csvFiles = files.filter(f => f.name.endsWith('.csv'))
        const xlsxFiles = files.filter(f => f.name.endsWith('.xlsx') || f.type === 'xlsx')
        const hasCsvData = csvFiles.length >= 2
        if (!hasCsvData) {
          for (const file of xlsxFiles) {
            if (file.size > 50 * 1024 * 1024) {
              console.warn(`[RevOS] Skipping ${file.name} (${Math.round(file.size / 1024 / 1024)}MB) — too large for browser.`)
              continue
            }
            const xlsxData = await parseXlsxFile(`/local-data/file?name=${encodeURIComponent(file.realName || file.name)}`)
            for (const [tabType, records] of Object.entries(xlsxData)) {
              if (raw[tabType]) { raw[tabType] = [...raw[tabType], ...records]; xlsxTypes.add(tabType) }
            }
          }
        }

        for (const file of csvFiles) {
          let tabType = tabTypeFromFileName(file.name)
          if (tabType && xlsxTypes.has(tabType)) continue
          const res = await fetch(`/local-data/file?name=${encodeURIComponent(file.name)}`)
          if (!res.ok) continue
          const text = await res.text()
          const records = parseCSV(text)
          if (!records.length) continue
          if (!tabType) tabType = detectTabTypeFromRecord(records[0])
          if (xlsxTypes.has(tabType)) continue
          raw[tabType] = [...raw[tabType], ...records]
        }
      }

      // Locations always use pre-built JSON
      let locationsJSON = {}
      try { const r = await fetch('/local-data/locations.json'); if (r.ok) locationsJSON = await r.json() } catch {}

      // Other JSON fallbacks
      const hasFunnel = raw.funnel.length > 0
      const hasEngagements = raw.engagements.length > 0
      const hasEngagements2026 = raw.engagements_2026.length > 0
      let historicalJSON = {}
      let engagements2025 = {}
      let engagements2026 = {}
      if (!hasFunnel) { try { const r = await fetch('/local-data/historical.json'); if (r.ok) historicalJSON = await r.json() } catch {} }
      if (!hasEngagements) { try { const r = await fetch('/local-data/engagements.json'); if (r.ok) engagements2025 = await r.json() } catch {} }
      if (!hasEngagements2026) { try { const r = await fetch('/local-data/engagements_2026.json'); if (r.ok) engagements2026 = await r.json() } catch {} }

      setLocalRawData(raw)
      const accounts = buildAccountsFromRaw(raw, locationsJSON, historicalJSON, engagements2025, engagements2026)
      setLocalAccounts(accounts)

      // ── Cache the result ──
      await setCachedAccounts(fingerprint, accounts, raw)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDataFromServer = useCallback(async () => {
    try {
      const res = await fetch('/local-data/manifest')
      if (!res.ok) return false
      const { files } = await res.json()
      setLocalFiles(files || [])
      if (files && files.length > 0) await loadAllFilesFromServer(files)
      return true
    } catch {
      return false
    }
  }, [loadAllFilesFromServer])

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
      await new Promise(r => setTimeout(r, 100))
      await loadDataFromServer()
      return { ok: true, dataDir: data.dataDir }
    } catch (err) {
      return { error: err.message }
    }
  }, [loadDataFromServer])

  // ── Unified refresh ───────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    // Clear cache so refresh always re-parses
    await clearAccountCache()
    if (dirHandleRef.current) {
      await loadFromFSHandle(dirHandleRef.current)
    } else {
      await loadDataFromServer()
    }
  }, [loadFromFSHandle, loadDataFromServer])

  // ── Rebuild data bundle (runs Node build script via local server) ────────
  const [rebuilding, setRebuilding] = useState(false)
  const rebuildBundle = useCallback(async () => {
    setRebuilding(true)
    try {
      const res = await fetch('/local-data/rebuild-bundle', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) {
        console.error('[RevOS] Bundle rebuild failed:', data.error)
        return { error: data.error || 'Rebuild failed' }
      }
      console.log('[RevOS] Bundle rebuilt:', data)
      // Clear cache and reload with new bundle
      await clearAccountCache()
      if (dirHandleRef.current) {
        await loadFromFSHandle(dirHandleRef.current)
      } else {
        await loadDataFromServer()
      }
      return { ok: true, ...data }
    } catch (err) {
      return { error: err.message }
    } finally {
      setRebuilding(false)
    }
  }, [loadFromFSHandle, loadDataFromServer])

  // Track whether the local server is available
  const [serverAvailable, setServerAvailable] = useState(null) // null = unknown

  // ── On mount: try restoring saved handle, then fall back to server ────────
  useEffect(() => {
    let cancelled = false
    async function init() {
      // 1) Try restoring File System Access handle from IndexedDB
      const savedHandle = await loadHandleFromIDB()
      if (savedHandle && !cancelled) {
        try {
          const hasPermission = await verifyPermission(savedHandle)
          if (hasPermission && !cancelled) {
            dirHandleRef.current = savedHandle
            setFsMode('fs-api')
            setServerAvailable(false)
            await loadFromFSHandle(savedHandle)
            return
          }
        } catch {
          // Permission denied or handle invalid — fall through to server
        }
      }

      // 2) Try local server
      if (!cancelled) {
        const saved = localStorage.getItem('revos_data_dir')
        if (saved) {
          fetch('/local-data/data-dir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dir: saved }),
          }).then(r => r.json()).then(d => {
            if (d.ok && !cancelled) setDataDirState(d.dataDir)
            else localStorage.removeItem('revos_data_dir')
          }).catch(() => {})
        }

        try {
          const res = await fetch('/local-data/manifest')
          if (res.ok && !cancelled) {
            setServerAvailable(true)
            setFsMode('server')
            const { files } = await res.json()
            setLocalFiles(files || [])
            if (files && files.length > 0) await loadAllFilesFromServer(files)
            // Also get data dir
            fetch('/local-data/data-dir').then(r => r.json()).then(d => {
              if (d.dataDir && !cancelled) setDataDirState(d.dataDir)
            }).catch(() => {})
            return
          }
        } catch {}

        // 3) No data source available
        if (!cancelled) setServerAvailable(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [loadFromFSHandle, loadAllFilesFromServer])

  // Check if File System Access API is supported
  const fsApiSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window

  return {
    localFiles,
    localAccounts,
    localRawData,
    loading,
    error,
    dataDir,
    setDataDir,
    refresh,
    serverAvailable,
    // File System Access API
    fsApiSupported,
    fsMode,
    connectFolder,
    disconnectFolder,
    // Bundle rebuild
    rebuildBundle,
    rebuilding,
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
            name: String(l.n || 'Unknown'),
            type: String(l.t || 'Office'),
            address: String(l.a || ''),
            lat: l.la || null,
            lng: l.lo || null,
            status: String(l.s || 'off-net'),
            mrr: l.m || 0,
            addressable_spend: l.as || 0,
            classification: String(l.c || ''),
            feet_from_network: l.ft || 0,
            market: String(l.mk || ''),
          }))
        : state.locations.map((l) => {
            let netStatus = String(l.on_net_status || l.status || 'off-net').toLowerCase()
            if (netStatus.includes('not on') || netStatus.includes('not connected')) netStatus = 'off-net'
            else if (netStatus.includes('on zayo') || netStatus.includes('on-net') || netStatus === 'on net') netStatus = 'on-net'
            else if (netStatus.includes('near') || netStatus.includes('near-net')) netStatus = 'near-net'
            else netStatus = 'off-net'
            return {
              name: String(l.location_name || l.name || 'Unknown'),
              type: String(l.location_type || l.type || 'Office'),
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
