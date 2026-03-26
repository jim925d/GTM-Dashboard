#!/usr/bin/env node
/**
 * Pre-processes locations_geocoded.csv into a compact locations.json
 * for fast browser loading. Run monthly after CSV update.
 *
 * Usage: node scripts/build-locations.cjs
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
const INPUT = path.join(DATA_DIR, 'locations_geocoded.csv')
const OUTPUT = path.join(DATA_DIR, 'locations.json')

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
      else if (ch === ',') { fields.push(current); current = '' }
      else current += ch
    }
  }
  fields.push(current)
  return fields
}

function normStatus(raw) {
  if (!raw) return 'off-net'
  const s = raw.toLowerCase().trim()
  // "Not on Zayo Network" must NOT match on-net
  if (s.includes('not on') || s === 'not on zayo network') return 'off-net'
  if (s.includes('on zayo') || s.includes('on-net') || s === 'on net') return 'on-net'
  if (s.includes('near')) return 'near-net'
  return 'off-net'
}

function parseMoney(raw) {
  if (!raw) return 0
  return parseFloat(String(raw).replace(/[$,\s]/g, '')) || 0
}

function main() {
  console.log('Reading', INPUT)
  const content = fs.readFileSync(INPUT, 'utf8')
  const lines = content.split('\n')
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase())

  // Find column indices
  const col = (name) => headers.findIndex(h => h.includes(name))
  const iAccount = col('customer account')
  const iAddress = col('street address')
  const iCity = col('city')
  const iState = headers.indexOf('state') !== -1 ? headers.indexOf('state') : col('state')
  const iPostal = col('postal code')
  const iCountry = headers.indexOf('country')
  const iBldgName = col('building name')
  const iBldgType = col('building type')
  const iMarket = col('market')
  const iNetStatus = headers.findIndex(h => h === 'on zayo network status')
  const iProxStatus = headers.findIndex(h => h === 'network proximity status')
  const iBldgClass = col('building classification')
  const iFeet = headers.findIndex(h => h.includes('building feet'))
  const iMRR = headers.findIndex(h => h === 'loc attributed mrr')
  const iAddrSpend = col('location addressable spend')
  const iLat = headers.indexOf('latitude')
  const iLng = headers.indexOf('longitude')
  const iSegment = col('segment')

  console.log(`Columns: account=${iAccount}, lat=${iLat}, lng=${iLng}, status=${iNetStatus}, mrr=${iMRR}`)
  console.log(`Total rows: ${lines.length - 1}`)

  // Group by account, deduplicate by address
  const byAccount = {}
  const seenByAccount = {} // track duplicates per account
  let total = 0, withCoords = 0, deduped = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const f = parseCSVLine(line)
    total++

    const account = (f[iAccount] || '').trim()
    if (!account) continue

    const lat = parseFloat(f[iLat]) || null
    const lng = parseFloat(f[iLng]) || null
    if (lat) withCoords++

    // Deduplicate by address within each account
    const addr = `${(f[iAddress] || '').trim()}|${(f[iCity] || '').trim()}|${(f[iPostal] || '').trim()}`
    if (!seenByAccount[account]) seenByAccount[account] = new Set()
    if (seenByAccount[account].has(addr)) { deduped++; continue }
    seenByAccount[account].add(addr)

    // Determine status: prefer On Zayo Network Status, fall back to Network Proximity Status
    const rawStatus = f[iNetStatus] || f[iProxStatus] || ''
    const status = normStatus(rawStatus)

    const mrr = Math.round(parseMoney(f[iMRR]) * 100) / 100

    const loc = {
      n: (f[iBldgName] || f[iAddress] || 'Unknown').trim(),
      t: (f[iBldgType] || 'Office').trim(),
      a: `${(f[iAddress] || '').trim()}, ${(f[iCity] || '').trim()}, ${(f[iState] || '').trim()} ${(f[iPostal] || '').trim()}`.trim(),
      s: status,
      mk: (f[iMarket] || '').trim(),
    }
    // Only include non-zero fields to save space
    const addrSpend = Math.round(parseMoney(f[iAddrSpend]) * 100) / 100
    if (addrSpend) loc.as = addrSpend
    if (mrr) loc.m = mrr
    if (lat && lng) { loc.la = Math.round(lat * 10000) / 10000; loc.lo = Math.round(lng * 10000) / 10000 }
    const ft = Math.round(parseFloat(f[iFeet]) || 0)
    if (ft) loc.ft = ft
    const cls = (f[iBldgClass] || '').trim()
    if (cls) loc.c = cls

    if (!byAccount[account]) byAccount[account] = []
    byAccount[account].push(loc)
  }

  const uniqueLocs = Object.values(byAccount).reduce((s, arr) => s + arr.length, 0)
  console.log(`\nAccounts: ${Object.keys(byAccount).length}`)
  console.log(`Total rows: ${total}, Unique locations: ${uniqueLocs}, Duplicates removed: ${deduped}`)
  console.log(`With coordinates: ${withCoords}`)

  // Write JSON
  fs.writeFileSync(OUTPUT, JSON.stringify(byAccount), 'utf8')
  const sizeMB = (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1)
  console.log(`Output: ${OUTPUT} (${sizeMB} MB)`)
}

main()
