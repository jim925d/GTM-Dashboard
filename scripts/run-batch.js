/**
 * RevOS Signal Batch Generator
 * Usage: node --experimental-vm-modules scripts/run-batch.js
 * Or:    npm run batch
 */
import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import { generateSignals } from '../lib/generateSignals.js'

const DATA_DIR = path.resolve(decodeURIComponent(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))), '..', 'data')

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

async function main() {
  console.log('RevOS Signal Batch — starting...')
  console.log(`Data directory: ${DATA_DIR}\n`)

  const tableData = {
    customers: loadCSV('customers.csv'),
    funnel: loadCSV('funnel.csv'),
    closeLost: loadCSV('close_lost.csv'),
    quotes: loadCSV('quotes.csv'),
    services: loadCSV('services.csv'),
    locations: loadCSV('locations.csv'),
    activityYTD: loadCSV('engagement_2026.csv'),
    activityHistorical: loadCSV('engagements.csv'),
  }

  // Merge both engagement files — YTD first for recency
  tableData.activity = [
    ...tableData.activityYTD,
    ...tableData.activityHistorical,
  ].sort((a, b) => {
    const da = new Date(b['Date'] || b['activity_date'] || 0)
    const db = new Date(a['Date'] || a['activity_date'] || 0)
    return da - db
  })

  console.log(`\nActivity: ${tableData.activityYTD.length} YTD + ${tableData.activityHistorical.length} historical = ${tableData.activity.length} total`)
  console.log(`Accounts: ${tableData.customers.length}\n`)

  const output = await generateSignals(tableData)

  const outPath = path.join(DATA_DIR, 'revos-signals.json')
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))

  console.log(`Done — ${output.accountCount} accounts written to ${outPath}`)
  console.log(`Generated at: ${output.generatedAt}`)

  // Summary stats
  let withSignals = 0
  let totalMTM = 0
  let totalExpiring = 0
  for (const [, sig] of Object.entries(output.signals)) {
    const hasAny = sig.prospecting.recentLoss || sig.retention.mtmServices.count > 0 ||
      sig.retention.expiringServices.count > 0 || sig.growth.underservedLocations.count > 0
    if (hasAny) withSignals++
    totalMTM += sig.retention.mtmServices.count
    totalExpiring += sig.retention.expiringServices.count
  }
  console.log(`\nSignal coverage:`)
  console.log(`  Accounts with actionable signals: ${withSignals}`)
  console.log(`  Total MTM services: ${totalMTM}`)
  console.log(`  Total expiring (90d): ${totalExpiring}`)
}

main().catch(err => { console.error('Batch failed:', err); process.exit(1) })
