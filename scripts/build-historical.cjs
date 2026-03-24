#!/usr/bin/env node
/**
 * Pre-processes historical.csv into compact historical.json
 * Run after CSV update (data doesn't change frequently).
 *
 * Usage: node scripts/build-historical.cjs
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
const INPUT = path.join(DATA_DIR, 'historical.csv')
const OUTPUT = path.join(DATA_DIR, 'historical.json')

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

function parseMoney(raw) {
  if (!raw) return 0
  return parseFloat(String(raw).replace(/[$,\s]/g, '')) || 0
}

function normStage(raw) {
  if (!raw) return ''
  const s = raw.toLowerCase().trim()
  if (s.includes('accepted') || s === '5 - accepted' || s === 'closed-won') return 'Closed Won'
  if (s.includes('closed lost')) return 'Closed Lost'
  return raw.trim()
}

function main() {
  console.log('Reading', INPUT)
  const content = fs.readFileSync(INPUT, 'utf8')
  const lines = content.split('\n')
  const headers = parseCSVLine(lines[0]).map(h => h.trim())

  // Build header index
  const idx = {}
  headers.forEach((h, i) => { idx[h.toLowerCase()] = i })

  const col = (name) => {
    // Try exact match first
    const lname = name.toLowerCase()
    if (idx[lname] !== undefined) return idx[lname]
    // Try includes
    const key = Object.keys(idx).find(k => k.includes(lname))
    return key !== undefined ? idx[key] : -1
  }

  const iAccount = col('customer account')
  const iMRR = col('total mrr')
  const iStage = col('stage group') !== -1 ? col('stage group') : col('stage')
  const iClose = col('close date')
  const iOpp = col('opportunity name')
  const iProduct = col('product group')
  const iNPV = col('npv')
  const iForecast = col('forecast category')
  const iRep = col('account owner')
  const iManager = col('sales funnel manager')
  const iTerm = col('term in months')
  const iType = headers.findIndex(h => h.toLowerCase() === 'type')
  const iSegment = col('reporting segement')

  console.log(`Columns: account=${iAccount}, mrr=${iMRR}, stage=${iStage}, close=${iClose}`)

  const byAccount = {}
  let total = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const f = parseCSVLine(line)
    total++

    const account = (f[iAccount] || '').trim()
    if (!account) continue

    const mrr = parseMoney(f[iMRR])
    const stage = normStage(f[iStage] || f[col('stage')])

    const deal = {
      o: (f[iOpp] || '').trim(),           // opportunity name
      p: (f[iProduct] || '').trim(),        // product
      s: stage,                              // stage
      c: (f[iClose] || '').trim(),          // close date
    }
    if (mrr) deal.m = Math.round(mrr * 100) / 100
    const npv = parseMoney(f[iNPV])
    if (npv) deal.v = Math.round(npv * 100) / 100
    const rep = (f[iRep] || '').trim()
    if (rep) deal.r = rep
    const fc = (f[iForecast] || '').trim()
    if (fc) deal.f = fc
    const type = iType >= 0 ? (f[iType] || '').trim() : ''
    if (type) deal.t = type
    const mgr = (f[iManager] || '').trim()
    if (mgr) deal.mg = mgr.split(/\s+/).pop() // last name only
    const term = parseInt(f[iTerm]) || 0
    if (term) deal.tm = term

    if (!byAccount[account]) byAccount[account] = []
    byAccount[account].push(deal)
  }

  console.log(`\nAccounts: ${Object.keys(byAccount).length}`)
  console.log(`Deals: ${total}`)

  fs.writeFileSync(OUTPUT, JSON.stringify(byAccount), 'utf8')
  const sizeMB = (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1)
  console.log(`Output: ${OUTPUT} (${sizeMB} MB)`)
}

main()
