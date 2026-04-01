/**
 * IndexedDB persistence layer for RevOS.
 *
 * Three object stores:
 *   raw_tables  — parsed CSV/XLSX records by table type (customers, funnel, etc.)
 *   enriched    — modeling engine output (enriched accounts, deals, events)
 *   meta        — bookkeeping (source files, record counts, timestamps)
 *
 * All data stays local — nothing leaves the browser.
 */

const DB_NAME = 'revos_platform'
const DB_VERSION = 1

const STORES = {
  RAW: 'raw_tables',
  JSON: 'json_data',
  ENRICHED: 'enriched',
  META: 'meta',
}

// Current engine version — bump when engine logic changes to trigger re-run
export const ENGINE_VERSION = 'v2_affinity'

// ── Open / upgrade DB ──────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORES.RAW)) {
        db.createObjectStore(STORES.RAW)
      }
      if (!db.objectStoreNames.contains(STORES.JSON)) {
        db.createObjectStore(STORES.JSON)
      }
      if (!db.objectStoreNames.contains(STORES.ENRICHED)) {
        db.createObjectStore(STORES.ENRICHED)
      }
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META)
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ── Generic get/put helpers ────────────────────────────────────────────────────

export function dbGet(storeName, key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  }))
}

export function dbPut(storeName, key, value) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).put(value, key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  }))
}

function dbClear(storeName) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).clear()
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  }))
}

// ── Raw Tables ─────────────────────────────────────────────────────────────────

/**
 * Save all raw table data at once.
 * @param {Object} tables - { customers: [], funnel: [], services: [], ... }
 */
export async function saveRawTables(tables) {
  const db = await openDB()
  const tx = db.transaction(STORES.RAW, 'readwrite')
  const store = tx.objectStore(STORES.RAW)
  for (const [type, rows] of Object.entries(tables)) {
    store.put(rows, type)
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/**
 * Load all raw tables. Returns same shape as rawData state.
 */
export async function loadRawTables() {
  const db = await openDB()
  const tx = db.transaction(STORES.RAW, 'readonly')
  const store = tx.objectStore(STORES.RAW)

  const types = ['customers', 'funnel', 'close_lost', 'quotes', 'services', 'locations', 'icb', 'registry']
  const result = {}

  const gets = types.map(type => new Promise((resolve) => {
    const req = store.get(type)
    req.onsuccess = () => resolve([type, req.result || []])
    req.onerror = () => resolve([type, []])
  }))

  const entries = await Promise.all(gets)
  for (const [type, rows] of entries) {
    result[type] = rows
  }

  db.close()
  return result
}

/**
 * Merge new records into existing raw tables (upsert).
 * For customers/services/locations: match by customer_account + a secondary key.
 * For deals: match by opportunity_id or append.
 */
export async function mergeRawTables(newTables) {
  const existing = await loadRawTables()

  for (const [type, newRows] of Object.entries(newTables)) {
    if (!newRows || newRows.length === 0) continue
    const prev = existing[type] || []

    if (prev.length === 0) {
      existing[type] = newRows
      continue
    }

    // Build index of existing records for dedup
    const keyFn = getKeyFn(type)
    const index = new Map()
    for (let i = 0; i < prev.length; i++) {
      const k = keyFn(prev[i])
      if (k) index.set(k, i)
    }

    const merged = [...prev]
    for (const row of newRows) {
      const k = keyFn(row)
      if (k && index.has(k)) {
        // Update existing record
        merged[index.get(k)] = row
      } else {
        merged.push(row)
        if (k) index.set(k, merged.length - 1)
      }
    }
    existing[type] = merged
  }

  await saveRawTables(existing)
  return existing
}

function getKeyFn(type) {
  switch (type) {
    case 'customers':
      return (r) => r.customer_account || null
    case 'funnel':
    case 'close_lost':
    case 'quotes':
      return (r) => r.opportunity_id || r.opportunity_name || null
    case 'services':
      return (r) => r.service_id || (r.customer_account && r.product_group ? `${r.customer_account}|${r.product_group}|${r.location_a || ''}` : null)
    case 'locations':
      return (r) => r.customer_account && r.location_name ? `${r.customer_account}|${r.location_name}` : null
    case 'icb':
      return (r) => r.icb_id || r.opportunity_name || null
    default:
      return () => null
  }
}

// ── JSON Data (locations, historical, engagements) ─────────────────────────────

export async function saveJsonData(jsonData) {
  const db = await openDB()
  const tx = db.transaction(STORES.JSON, 'readwrite')
  const store = tx.objectStore(STORES.JSON)
  for (const [key, value] of Object.entries(jsonData)) {
    store.put(value, key)
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function loadJsonData() {
  const db = await openDB()
  const tx = db.transaction(STORES.JSON, 'readonly')
  const store = tx.objectStore(STORES.JSON)

  const keys = ['locations', 'historical', 'engagements', 'engagements_2026']
  const result = {}

  const gets = keys.map(key => new Promise((resolve) => {
    const req = store.get(key)
    req.onsuccess = () => resolve([key, req.result || {}])
    req.onerror = () => resolve([key, {}])
  }))

  const entries = await Promise.all(gets)
  for (const [key, value] of entries) {
    result[key] = value
  }

  db.close()
  return result
}

// ── Enriched Data (modeling engine output) ─────────────────────────────────────

export async function saveEnriched(snapshot) {
  await dbPut(STORES.ENRICHED, 'snapshot', {
    ...snapshot,
    _persisted_at: new Date().toISOString(),
    _engine_version: ENGINE_VERSION,
  })
}

export async function loadEnriched() {
  return dbGet(STORES.ENRICHED, 'snapshot') || null
}

/**
 * Check if enriched data is stale (engine version mismatch or too old).
 */
export async function isEnrichedStale() {
  const data = await loadEnriched()
  if (!data) return true
  if (data._engine_version !== ENGINE_VERSION) return true
  // Stale if older than 24 hours
  if (data._persisted_at) {
    const age = Date.now() - new Date(data._persisted_at).getTime()
    if (age > 24 * 60 * 60 * 1000) return true
  }
  return false
}

// ── Meta ───────────────────────────────────────────────────────────────────────

export async function saveMeta(meta) {
  await dbPut(STORES.META, 'info', {
    ...meta,
    updatedAt: new Date().toISOString(),
  })
}

export async function loadMeta() {
  return dbGet(STORES.META, 'info') || null
}

// ── Clear Everything ───────────────────────────────────────────────────────────

export async function clearAll() {
  await Promise.all([
    dbClear(STORES.RAW),
    dbClear(STORES.JSON),
    dbClear(STORES.ENRICHED),
    dbClear(STORES.META),
  ])
  // Also clear legacy localStorage
  try {
    localStorage.removeItem('revos_modeling_snapshot')
  } catch { /* ok */ }
}

/**
 * Check if any persisted data exists (for auto-load on startup).
 */
export async function hasPersistedData() {
  const raw = await loadRawTables()
  return Object.values(raw).some(arr => arr.length > 0)
}
