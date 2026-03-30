#!/usr/bin/env node
/**
 * Diagnose why deals end up as "Unknown" mega vertical in the backtest.
 * Run: node scripts/diagnose-verticals.cjs
 *
 * Copy the output and paste into Claude Desktop for analysis.
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')

// ── Quote-aware CSV parser (same logic as BacktestEngine) ──────────────────
function parseCSV(text) {
  const parseRow = (str, start) => {
    const fields = []
    let cur = '', inQ = false, i = start
    while (i < str.length) {
      const ch = str[i]
      if (inQ) {
        if (ch === '"') {
          if (i + 1 < str.length && str[i + 1] === '"') { cur += '"'; i += 2; continue }
          inQ = false
        } else { cur += ch }
      } else {
        if (ch === '"') { inQ = true }
        else if (ch === ',') { fields.push(cur.trim()); cur = '' }
        else if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && i + 1 < str.length && str[i + 1] === '\n') i++
          fields.push(cur.trim())
          return { fields, next: i + 1 }
        } else { cur += ch }
      }
      i++
    }
    fields.push(cur.trim())
    return { fields, next: i }
  }

  const content = text.replace(/^\uFEFF/, '')
  const { fields: headers, next } = parseRow(content, 0)
  const rows = []
  let pos = next
  while (pos < content.length) {
    if (content[pos] === '\n' || content[pos] === '\r') { pos++; continue }
    const { fields, next: nxt } = parseRow(content, pos)
    pos = nxt
    if (fields.length === 1 && !fields[0]) continue
    rows.push(Object.fromEntries(headers.map((h, i) => [h, fields[i] || ''])))
  }
  return { headers, rows }
}

// ── Naive CSV parser (the old buggy one) ───────────────────────────────────
function parseCSVNaive(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
  const rows = lines.slice(1).map(line => {
    const vals = []; let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') inQ = !inQ
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = '' }
      else cur += ch
    }
    vals.push(cur.trim())
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || '').replace(/^"|"$/g, '')]))
  })
  return { headers, rows }
}

// ── Auto-detect (same as BacktestEngine) ───────────────────────────────────
function autoDetect(headers) {
  const map = { outcome: '', product: '', segment: '', deal_value: '', created_date: '', close_date: '' }
  const exact = {
    outcome: ['stage', 'stage group', 'deal stage', 'opportunity stage'],
    product: ['product group', 'product family', 'product name', 'product'],
    segment: ['mega vertical grouping', 'mega vertical', 'mega_vertical', 'vertical', 'industry'],
    deal_value: ['total mrr & mar (converted)', 'mrr', 'total mrr', 'amount', 'total contract value'],
    created_date: ['created date', 'created_date', 'create date'],
    close_date: ['close date', 'close_date'],
  }
  const hints = {
    outcome: ['stagegroup', 'stage', 'outcome', 'result', 'status'],
    product: ['productgroup', 'product'],
    segment: ['megavertical', 'vertical', 'industry'],
    deal_value: ['mrr', 'revenue', 'amount', 'tcv', 'value'],
    created_date: ['createddate', 'createdate'],
    close_date: ['closedate'],
  }
  const lowerHeaders = headers.map(h => h.toLowerCase().trim())
  for (const [field, aliases] of Object.entries(exact)) {
    if (map[field]) continue
    for (const alias of aliases) {
      const idx = lowerHeaders.indexOf(alias)
      if (idx !== -1) { map[field] = headers[idx]; break }
    }
  }
  for (const [field, hintList] of Object.entries(hints)) {
    if (map[field]) continue
    const match = headers.find(h => {
      const clean = h.toLowerCase().replace(/[_ ]/g, '')
      if (h.includes(':') && clean.length > 30) return false
      return hintList.some(hint => clean.includes(hint))
    })
    if (match) map[field] = match
  }
  return map
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log('='.repeat(80))
console.log('BACKTEST VERTICAL DIAGNOSTIC')
console.log('='.repeat(80))

// Parse both files with BOTH parsers
const histText = fs.readFileSync(path.join(DATA_DIR, 'historical.csv'), 'utf8')
const lostText = fs.readFileSync(path.join(DATA_DIR, 'close_lost.csv'), 'utf8')

const histNew = parseCSV(histText)
const histOld = parseCSVNaive(histText)
const lostNew = parseCSV(lostText)
const lostOld = parseCSVNaive(lostText)

console.log('\n── FILE PARSING ──')
console.log(`historical.csv: NEW parser ${histNew.rows.length} rows, OLD parser ${histOld.rows.length} rows`)
console.log(`close_lost.csv: NEW parser ${lostNew.rows.length} rows, OLD parser ${lostOld.rows.length} rows`)
console.log(`historical.csv headers (NEW): ${histNew.headers.length}`)
console.log(`historical.csv headers (OLD): ${histOld.headers.length}`)

// Auto-detect
const histDetected = autoDetect(histNew.headers)
console.log('\n── AUTO-DETECT (historical.csv) ──')
for (const [k, v] of Object.entries(histDetected)) {
  console.log(`  ${k} → ${JSON.stringify(v)}`)
}

const lostDetected = autoDetect(lostNew.headers)
console.log('\n── AUTO-DETECT (close_lost.csv) ──')
for (const [k, v] of Object.entries(lostDetected)) {
  console.log(`  ${k} → ${JSON.stringify(v)}`)
}

// Check mega vertical column
const megaCol = histDetected.segment
console.log('\n── MEGA VERTICAL ANALYSIS ──')
console.log(`Segment column detected: ${JSON.stringify(megaCol)}`)

// Forecast Category filter
const fcCol = histNew.headers.find(h => h.toLowerCase().replace(/[_ ]/g, '').includes('forecastcategory'))
console.log(`Forecast Category column: ${JSON.stringify(fcCol)}`)

// FC value distribution
const fcVals = {}
for (const r of histNew.rows) {
  const fc = (r[fcCol] || '').trim()
  fcVals[fc] = (fcVals[fc] || 0) + 1
}
console.log('\nForecast Category values (top 10):')
Object.entries(fcVals).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => {
  console.log(`  ${JSON.stringify(k)}: ${v}`)
})

// Filter to Closed only
const closedRows = fcCol
  ? histNew.rows.filter(r => {
      const fc = (r[fcCol] || '').toLowerCase().trim()
      return fc === 'closed' || fc === 'close'
    })
  : histNew.rows
console.log(`\nClosed rows (won deals): ${closedRows.length}`)

// Mega vertical in closed rows
const megaVals = {}
let closedEmpty = 0
for (const r of closedRows) {
  const v = (r[megaCol] || '').trim()
  if (!v) { closedEmpty++ }
  else { megaVals[v] = (megaVals[v] || 0) + 1 }
}
console.log(`Empty mega vertical in closed: ${closedEmpty}`)
console.log('Mega vertical values in closed:')
Object.entries(megaVals).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${JSON.stringify(k)}: ${v}`)
})

// Close lost mega vertical
const lostMegaCol = lostDetected.segment
const lostMegaVals = {}
let lostEmpty = 0
for (const r of lostNew.rows) {
  const v = (r[lostMegaCol] || '').trim()
  if (!v) { lostEmpty++ }
  else { lostMegaVals[v] = (lostMegaVals[v] || 0) + 1 }
}
console.log(`\n── CLOSE LOST MEGA VERTICAL ──`)
console.log(`Segment column: ${JSON.stringify(lostMegaCol)}`)
console.log(`Empty: ${lostEmpty}`)
console.log('Values:')
Object.entries(lostMegaVals).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${JSON.stringify(k)}: ${v}`)
})

// Simulate combine
console.log('\n── SIMULATED COMBINE ──')
const vertCol = histNew.headers.find(h => h.toLowerCase().trim() === 'vertical')
const vertToMega = {}
if (megaCol && vertCol) {
  for (const r of histNew.rows) {
    const vert = (r[vertCol] || '').trim()
    const mega = (r[megaCol] || '').trim()
    if (vert && mega && !vertToMega[vert]) vertToMega[vert] = mega
  }
}
console.log(`Vertical→Mega lookup: ${Object.keys(vertToMega).length} mappings`)

// Enrich and combine
const enrichRow = (r, fileHeaders) => {
  if (!megaCol || !vertCol) return r
  const existing = (r[megaCol] || '').trim()
  if (existing && existing.toLowerCase() !== 'unknown') return r
  const vCol = fileHeaders ? fileHeaders.find(h => h.toLowerCase().trim() === 'vertical') : vertCol
  const vert = vCol ? (r[vCol] || '').trim() : ''
  if (vert && vertToMega[vert]) return { ...r, [megaCol]: vertToMega[vert] }
  return r
}

const enrichedWon = closedRows.map(r => enrichRow(r, histNew.headers))
const enrichedLost = lostNew.rows.map(r => enrichRow(r, lostNew.headers))

const combined = [
  ...enrichedWon.map(r => ({ ...r, _outcome: 'Won' })),
  ...enrichedLost.map(r => ({ ...r, _outcome: 'Closed Lost' })),
]

console.log(`Combined: ${combined.length} deals (${enrichedWon.length} won + ${enrichedLost.length} lost)`)

// Final mega vertical counts
const finalVals = {}
for (const r of combined) {
  const v = (r[megaCol] || '').trim() || 'Unknown'
  finalVals[v] = (finalVals[v] || 0) + 1
}
console.log('\nFinal mega vertical distribution:')
Object.entries(finalVals).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k}: ${v}`)
})

// Show sample Unknown deals
console.log('\n── SAMPLE UNKNOWN DEALS ──')
let shown = 0
for (const r of combined) {
  const v = (r[megaCol] || '').trim()
  if (!v || v.toLowerCase() === 'unknown') {
    shown++
    if (shown <= 10) {
      console.log(`\nUnknown deal #${shown}:`)
      console.log(`  _outcome: ${r._outcome}`)
      console.log(`  ${megaCol}: ${JSON.stringify(r[megaCol])}`)
      if (vertCol) console.log(`  Vertical: ${JSON.stringify(r[vertCol] || r['Vertical'])}`)
      console.log(`  ${fcCol || 'Forecast Category'}: ${JSON.stringify(r[fcCol] || r['Forecast Category'])}`)
      console.log(`  Customer Account: ${JSON.stringify(r['Customer Account'])}`)
      console.log(`  Stage: ${JSON.stringify(r['Stage'] || r['Stage Group'])}`)
      console.log(`  Product Group: ${JSON.stringify(r['Product Group'])}`)
      // Show all non-empty fields for first 3
      if (shown <= 3) {
        console.log('  All non-empty fields:')
        for (const [k, val] of Object.entries(r)) {
          if (val && val.trim()) console.log(`    ${k}: ${JSON.stringify(val.slice(0, 100))}`)
        }
      }
    }
  }
}
console.log(`\nTotal Unknown: ${shown}`)

// Compare old vs new parser on a misaligned row
console.log('\n── PARSER COMPARISON (first 5 rows with different field counts) ──')
let diffCount = 0
for (let i = 0; i < Math.min(histNew.rows.length, histOld.rows.length); i++) {
  const newMega = (histNew.rows[i][megaCol] || '').trim()
  const oldMega = (histOld.rows[i]?.[megaCol] || '').trim()
  if (newMega !== oldMega) {
    diffCount++
    if (diffCount <= 5) {
      console.log(`\nRow ${i}: NEW mega=${JSON.stringify(newMega)}, OLD mega=${JSON.stringify(oldMega)}`)
      console.log(`  Account: ${histNew.rows[i]['Customer Account']}`)
    }
  }
}
console.log(`\nTotal rows where parsers disagree on mega vertical: ${diffCount}`)
