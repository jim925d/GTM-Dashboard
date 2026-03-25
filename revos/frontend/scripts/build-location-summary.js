/**
 * Pre-aggregates locations.csv + customers.csv into a small JSON summary
 * for the Locations page to consume.
 *
 * Usage: node scripts/build-location-summary.js
 */
import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'

const DATA_DIR = path.resolve(
  decodeURIComponent(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))),
  '..', 'data'
)

function loadCSV(filename) {
  const filePath = path.join(DATA_DIR, filename)
  if (!fs.existsSync(filePath)) {
    console.log(`  [skip] ${filename} not found`)
    return []
  }
  const raw = fs.readFileSync(filePath, 'latin1')
  const result = Papa.parse(raw, { header: true, skipEmptyLines: true })
  console.log(`  [load] ${filename}: ${result.data.length} rows`)
  return result.data
}

function main() {
  console.log('Building location summary...')
  console.log(`Data directory: ${DATA_DIR}\n`)

  const locRows = loadCSV('locations.csv')
  const custRows = loadCSV('customers.csv')

  // Build manager/segment lookup from customers.csv
  const managerMap = {}
  const segmentMap = {}
  const verticalMap = {}
  for (const row of custRows) {
    const name = (row['Account Global Region : Account : Customer Account'] || '').trim()
    const mgr = (row['Account Global Region : Sales Owner : Sales Funnel Manager'] || '').trim()
    const seg = (row['Segment'] || '').trim()
    const vert = (row['Account Global Region : Account : Vertical'] || '').trim()
    if (name) {
      if (mgr) managerMap[name] = mgr
      if (seg) segmentMap[name] = seg
      if (vert) verticalMap[name] = vert
    }
  }

  // Aggregate locations per account
  const acctMap = {}
  for (const row of locRows) {
    const name = (row['Customer Account'] || '').trim()
    if (!name) continue

    if (!acctMap[name]) {
      acctMap[name] = {
        name,
        on: 0,
        near: 0,
        off: 0,
        total: 0,
        manager: managerMap[name] || '',
        segment: segmentMap[name] || '',
        vertical: verticalMap[name] || '',
        hq: '',
        website: (row['Customer Account Website'] || '').trim(),
        states: new Set(),
        markets: new Set(),
      }
    }

    const a = acctMap[name]
    const nps = (row['Network Proximity Status'] || '').trim()
    const state = (row['Building State'] || row['State'] || '').trim()
    const market = (row['Market'] || '').trim()
    const bldgType = (row['Building Type'] || '').trim()
    const city = (row['Building City'] || row['City'] || '').trim()

    a.total++
    if (nps === 'On-Net' || nps === 'On-Net ICB') a.on++
    else if (nps === 'Near-Net') a.near++
    else a.off++

    if (state) a.states.add(state)
    if (market) a.markets.add(market)

    if (!a.hq && city && state) {
      a.hq = `${city}, ${state}`
    }
  }

  // Convert to array, remove Sets, sort by total desc
  const accounts = Object.values(acctMap)
    .map(a => ({
      ...a,
      states: [...a.states],
      markets: [...a.markets],
    }))
    .sort((a, b) => b.total - a.total)

  const outPath = path.join(DATA_DIR, 'location-summary.json')
  fs.writeFileSync(outPath, JSON.stringify({ accounts, generatedAt: new Date().toISOString() }, null, 2))

  console.log(`\nDone — ${accounts.length} accounts written to ${outPath}`)

  // Stats
  const withOnNet = accounts.filter(a => a.on > 0).length
  const withNearNet = accounts.filter(a => a.near > 0).length
  console.log(`  On-Net accounts: ${withOnNet}`)
  console.log(`  Near-Net accounts: ${withNearNet}`)
  console.log(`  Total locations: ${accounts.reduce((s, a) => s + a.total, 0)}`)
}

main()
