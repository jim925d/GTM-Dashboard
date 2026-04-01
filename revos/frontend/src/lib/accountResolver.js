/**
 * Account Resolution — two-layer name resolution system.
 *
 * Layer 1: NAME_INDEX — maps every known variant of an account name to its canonical customer_account.
 * Layer 2: ACCOUNT_METADATA — one row per canonical account with display/engine fields.
 *
 * Built from the registry/hierarchy CSV. Persisted in IndexedDB.
 */

import { dbGet, dbPut } from './persistenceLayer'

const IDB_KEY_INDEX = 'revos_name_index'
const IDB_KEY_META = 'revos_account_metadata'

// ── Helpers ──────────────────────────────────────────────────────────────────

function pickMode(rows, field) {
  const counts = {}
  rows.forEach(r => {
    const v = r[field]?.toString().trim()
    if (v) counts[v] = (counts[v] || 0) + 1
  })
  let best = null, bestCount = 0
  Object.entries(counts).forEach(([v, c]) => {
    if (c > bestCount) { best = v; bestCount = c }
  })
  return best
}

function pickFirst(rows, field) {
  for (const r of rows) {
    const v = r[field]?.toString().trim()
    if (v) return v
  }
  return null
}

// ── Build functions ──────────────────────────────────────────────────────────

/**
 * Build a name index from registry rows.
 * Maps every known variant (lowercase) → canonical customer_account.
 */
export function buildNameIndex(registryRows) {
  const index = {}
  registryRows.forEach(row => {
    const canonical = (row.customer_account || '').trim()
    if (!canonical) return
    index[canonical.toLowerCase()] = canonical
    const parent = (row.parent_account || '').trim()
    if (parent && parent.toLowerCase() !== canonical.toLowerCase()) {
      index[parent.toLowerCase()] = canonical
    }
  })
  return index
}

/**
 * Build account metadata: one entry per canonical customer_account.
 * Groups registry rows and picks mode for each field.
 */
export function buildAccountMetadata(registryRows) {
  const groups = {}
  registryRows.forEach(row => {
    const key = (row.customer_account || '').trim()
    if (!key) return
    if (!groups[key]) groups[key] = []
    groups[key].push(row)
  })

  const metadata = {}
  Object.entries(groups).forEach(([acct, rows]) => {
    metadata[acct] = {
      account_id: pickFirst(rows, 'account_id'),
      rep: pickMode(rows, 'rep'),
      sales_manager: pickMode(rows, 'sales_manager'),
      sales_vp: pickMode(rows, 'sales_vp'),
      vertical: pickMode(rows, 'vertical'),
      vertical_grouping: pickMode(rows, 'vertical_grouping'),
      mega_vertical: pickMode(rows, 'mega_vertical'),
      child_count: rows.length,
    }
  })
  return metadata
}

// ── Universal Resolver ───────────────────────────────────────────────────────

/**
 * Resolve a raw account name to its canonical form using the name index.
 * Three tiers: exact → fuzzy (strip suffixes) → unresolved.
 */
export function resolveAccount(rawName, nameIndex) {
  if (!rawName) return { canonical: null, method: 'empty' }
  const clean = rawName.trim()
  const lower = clean.toLowerCase()

  // Tier 1: Exact match
  if (nameIndex[lower]) {
    return { canonical: nameIndex[lower], method: 'exact' }
  }

  // Tier 2: Fuzzy — strip legal suffixes and punctuation
  const fuzzy = lower
    .replace(/[,.\-]/g, ' ')
    .replace(/\b(inc|llc|corp|co|ltd|limited|corporation|company)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (nameIndex[fuzzy]) {
    return { canonical: nameIndex[fuzzy], method: 'fuzzy' }
  }

  // Tier 3: Unresolved — keep original name
  return { canonical: clean, method: 'unresolved' }
}

/**
 * Resolve account names across an array of records.
 * Mutates each record's customer_account field in-place.
 * Returns resolution stats.
 */
export function resolveRecords(records, nameIndex, accountField = 'customer_account') {
  const stats = { exact: 0, fuzzy: 0, unresolved: 0, empty: 0, total: records.length }

  for (const r of records) {
    const rawName = r[accountField]
    const { canonical, method } = resolveAccount(rawName, nameIndex)
    if (canonical) r.customer_account = canonical
    stats[method]++
  }

  return stats
}

// ── Persistence ──────────────────────────────────────────────────────────────

export async function saveNameIndex(index) {
  await dbPut('meta', IDB_KEY_INDEX, index)
}

export async function loadNameIndex() {
  return (await dbGet('meta', IDB_KEY_INDEX)) || null
}

export async function saveAccountMetadata(metadata) {
  await dbPut('meta', IDB_KEY_META, metadata)
}

export async function loadAccountMetadata() {
  return (await dbGet('meta', IDB_KEY_META)) || null
}
