#!/usr/bin/env node
/**
 * Pre-bundles all small CSV data into a single data-bundle.json file.
 * Uses columnar format (headers + row arrays) to avoid repeating column names.
 * JSON.parse is 5-10x faster than CSV parsing, and one fetch beats 7 sequential ones.
 *
 * Reads:  customers.csv, funnel.csv, close_lost.csv, services.csv, quotes.csv, ICB.csv, historical.csv
 * Skips:  locations*.csv (use locations.json), engagements*.csv (use engagements*.json) — too large
 * Output: data/data-bundle.json
 *
 * Usage: node scripts/build-data-bundle.cjs
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
const OUTPUT = path.join(DATA_DIR, 'data-bundle.json')

// CSVs to include in the bundle (small enough for fast parsing)
const CSV_FILES = [
  'customers.csv',
  'funnel.csv',
  'close_lost.csv',
  'services.csv',
  'quotes.csv',
  'ICB.csv',
  'historical.csv',
  'Hierarchy.csv',
  'rep_profiles.csv',
]

function parseCSVLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = false
      } else current += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { fields.push(current.trim()); current = '' }
      else current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

function splitCSVLines(content) {
  const records = []
  let current = ''
  let inQuotes = false

  for (const line of content.split('\n')) {
    if (!current && !inQuotes) {
      current = line
    } else {
      current += '\n' + line
    }
    let quotes = 0
    for (let i = 0; i < current.length; i++) {
      if (current[i] === '"') {
        if (i + 1 < current.length && current[i + 1] === '"') { i++; continue }
        quotes++
      }
    }
    inQuotes = quotes % 2 !== 0
    if (!inQuotes) {
      records.push(current)
      current = ''
    }
  }
  if (current.trim()) records.push(current)
  return records
}

function mapTabType(csvFile) {
  const base = csvFile.replace('.csv', '').toLowerCase().replace(/[^a-z_0-9]/g, '')
  if (base.includes('customer') || base.includes('account')) return 'customers'
  if (base === 'funnel' || base.includes('pipeline') || base.includes('opportunity')) return 'funnel'
  if (base.includes('historical') || base.includes('closed_won') || base.includes('history')) return 'funnel'
  if (base.includes('close_lost') || base.includes('lost') || base.includes('churn')) return 'close_lost'
  if (base.includes('quote') || base.includes('proposal')) return 'quotes'
  if (base.includes('service') || base.includes('circuit')) return 'services'
  if (base.includes('icb')) return 'icb'
  if (base.includes('hierarchy') || base.includes('hiearchy')) return 'hierarchy'
  if (base.includes('rep_profile') || base.includes('rep_quota')) return 'rep_profiles'
  return base
}

function main() {
  console.log('Building data bundle (columnar format)...\n')

  // bundle format: { _v: 2, _built: "...", _sources: {...}, tables: { tabType: { h: [...headers], r: [[...row], ...] } } }
  const bundle = { _v: 2, _built: new Date().toISOString(), _sources: {}, tables: {} }
  let totalRecords = 0

  for (const csvFile of CSV_FILES) {
    const filePath = path.join(DATA_DIR, csvFile)
    if (!fs.existsSync(filePath)) {
      console.log(`  SKIP ${csvFile} (not found)`)
      continue
    }

    const stat = fs.statSync(filePath)
    const sizeMB = (stat.size / 1024 / 1024).toFixed(1)
    console.log(`  Reading ${csvFile} (${sizeMB} MB)...`)

    const content = fs.readFileSync(filePath, 'utf8')
    const lines = splitCSVLines(content)
    if (lines.length < 2) {
      console.log(`    → 0 records (empty)`)
      continue
    }

    const headers = parseCSVLine(lines[0])
    const rows = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line.trim()) continue
      const fields = parseCSVLine(line)
      // Store as sparse array — only non-empty values (indexed by column position)
      const row = []
      let hasData = false
      for (let j = 0; j < headers.length; j++) {
        const val = fields[j] || ''
        row.push(val)
        if (val) hasData = true
      }
      if (hasData) rows.push(row)
    }

    const tabType = mapTabType(csvFile)
    bundle._sources[csvFile] = { modified: stat.mtimeMs, size: stat.size, records: rows.length }

    // Merge into existing table if tabType already exists (e.g., historical → funnel)
    if (bundle.tables[tabType]) {
      // Headers must match — if not, store separately with suffix
      const existing = bundle.tables[tabType]
      if (JSON.stringify(existing.h) === JSON.stringify(headers)) {
        existing.r.push(...rows)
        console.log(`    → ${rows.length} records → "${tabType}" (merged)`)
      } else {
        // Different columns — store both sets, browser merges by record
        if (!existing.extra) existing.extra = []
        existing.extra.push({ h: headers, r: rows })
        console.log(`    → ${rows.length} records → "${tabType}" (extra columns)`)
      }
    } else {
      bundle.tables[tabType] = { h: headers, r: rows }
      console.log(`    → ${rows.length} records → "${tabType}"`)
    }
    totalRecords += rows.length
  }

  // Write output
  const json = JSON.stringify(bundle)
  fs.writeFileSync(OUTPUT, json, 'utf8')
  const outSize = (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1)
  console.log(`\nTotal: ${totalRecords} records across ${Object.keys(bundle._sources).length} files`)
  console.log(`Output: ${OUTPUT} (${outSize} MB)`)
  console.log('Done!')
}

main()
