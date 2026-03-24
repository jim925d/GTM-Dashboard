#!/usr/bin/env node
/**
 * Pre-processes engagement_2026.csv into compact engagements_2026.json
 * Re-run this after each new 2026 engagement CSV upload.
 *
 * Usage: node scripts/build-engagements-2026.cjs
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
const INPUT = path.join(DATA_DIR, 'engagement_2026.csv')
const OUTPUT = path.join(DATA_DIR, 'engagements_2026.json')

function findRowEnd(content, start) {
  let pos = start
  let inQuotes = false
  while (pos < content.length) {
    const ch = content[pos]
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && (ch === '\n' || ch === '\r')) return pos
    pos++
  }
  return pos
}

function parseRow(line) {
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

function* parseCSVStream(content) {
  // Skip header
  let pos = findRowEnd(content, 0)
  while (pos < content.length && (content[pos] === '\n' || content[pos] === '\r')) pos++

  let rowCount = 0
  while (pos < content.length) {
    const rowEnd = findRowEnd(content, pos)
    if (rowEnd <= pos) { pos++; continue }
    const row = content.substring(pos, rowEnd)
    pos = rowEnd
    while (pos < content.length && (content[pos] === '\n' || content[pos] === '\r')) pos++
    if (!row.trim()) continue
    rowCount++
    yield parseRow(row)
    if (rowCount % 100000 === 0) console.log(`  Processed ${rowCount} rows...`)
  }
}

function extractEngType(subject) {
  if (!subject) return 'other'
  const s = subject.toLowerCase()
  if (s.includes('call')) return 'call'
  if (s.includes('email') || s.includes('e-mail')) return 'email'
  if (s.includes('meeting') || s.includes('meet')) return 'meeting'
  if (s.includes('demo') || s.includes('presentation')) return 'demo'
  if (s.includes('linkedin') || s.includes('social')) return 'social'
  if (s.includes('text') || s.includes('sms')) return 'text'
  if (s.includes('note') || s.includes('log')) return 'note'
  return 'other'
}

function parseMMDDYYYY(str) {
  if (!str) return 0
  const parts = str.split('/')
  if (parts.length < 3) return 0
  return new Date(parts[2], parts[0] - 1, parts[1]).getTime() || 0
}

function main() {
  console.log('=== 2026 Engagement Builder ===')
  console.log('Reading', INPUT)
  console.log(`File size: ${(fs.statSync(INPUT).size / 1024 / 1024).toFixed(0)} MB`)

  const content = fs.readFileSync(INPUT, 'utf8')
  console.log('File loaded, parsing...')

  const byAccount = {}
  let total = 0, matched = 0

  for (const fields of parseCSVStream(content)) {
    total++
    const account = (fields[5] || '').trim()
    if (!account) continue
    matched++

    const date = (fields[1] || '').trim()
    const subject = (fields[0] || '').trim()
    const contact = (fields[6] || '').trim()
    const assigned = (fields[12] || '').trim()
    const slType = (fields[13] || '').trim()

    let monthKey = ''
    if (date) {
      const parts = date.split('/')
      if (parts.length >= 3) monthKey = `${parts[2]}-${parts[0].padStart(2, '0')}`
    }

    const engType = slType ? slType.toLowerCase() : extractEngType(subject)

    if (!byAccount[account]) {
      byAccount[account] = { total: 0, byType: {}, byMonth: {}, contacts: new Set(), reps: new Set(), lastDate: '', events: [] }
    }

    const acct = byAccount[account]
    acct.total++
    acct.byType[engType] = (acct.byType[engType] || 0) + 1
    if (monthKey) {
      if (!acct.byMonth[monthKey]) acct.byMonth[monthKey] = 0
      acct.byMonth[monthKey]++
      if (monthKey > acct.lastDate) acct.lastDate = monthKey
    }
    if (contact) acct.contacts.add(contact)
    if (assigned) acct.reps.add(assigned)

    if (date && subject) {
      acct.events.push({ d: date, s: subject.substring(0, 120), t: engType, c: contact || '' })
    }
  }

  console.log(`\nTotal rows: ${total}`)
  console.log(`Matched to accounts: ${matched}`)
  console.log(`Unique accounts: ${Object.keys(byAccount).length}`)

  const output = {}
  for (const [name, data] of Object.entries(byAccount)) {
    const sortedEvents = data.events.sort((a, b) => {
      const da = parseMMDDYYYY(a.d), db = parseMMDDYYYY(b.d)
      return db - da
    }).slice(0, 50)

    output[name] = {
      t: data.total,
      tp: data.byType,
      m: data.byMonth,
      c: data.contacts.size,
      r: data.reps.size,
      l: data.lastDate,
      e: sortedEvents,
    }
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(output), 'utf8')
  const sizeMB = (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1)
  console.log(`\nOutput: ${OUTPUT} (${sizeMB} MB)`)
}

main()
