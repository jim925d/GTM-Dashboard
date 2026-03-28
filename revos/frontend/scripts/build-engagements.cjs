#!/usr/bin/env node
/**
 * Pre-processes engagements.csv (2025) into compact engagements.json
 * Groups by account, aggregates engagement counts by type and month.
 *
 * Usage: node scripts/build-engagements.cjs
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
const INPUT = path.join(DATA_DIR, 'engagements.csv')
const OUTPUT = path.join(DATA_DIR, 'engagements.json')

// Stream-based CSV parser that handles quoted multiline fields
function* parseCSVStream(content) {
  let pos = 0
  const len = content.length

  // Parse header
  const headerEnd = findRowEnd(content, 0)
  const headers = parseRow(content.substring(0, headerEnd))
  pos = headerEnd + 1
  if (content[pos - 1] === '\r' && content[pos] === '\n') pos++
  else if (content[headerEnd] === '\r') pos = headerEnd + 2

  // Skip past line ending properly
  while (pos < len && (content[pos] === '\n' || content[pos] === '\r')) pos++
  pos = headerEnd
  while (pos < len && content[pos] !== '\n') pos++
  pos++ // skip \n

  let rowCount = 0
  while (pos < len) {
    const rowEnd = findRowEnd(content, pos)
    if (rowEnd <= pos) { pos++; continue }
    const row = content.substring(pos, rowEnd)
    pos = rowEnd
    while (pos < len && (content[pos] === '\n' || content[pos] === '\r')) pos++

    if (!row.trim()) continue
    const fields = parseRow(row)
    rowCount++
    yield fields

    if (rowCount % 500000 === 0) {
      console.log(`  Processed ${(rowCount / 1000000).toFixed(1)}M rows...`)
    }
  }
}

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
  console.log('=== Engagement Builder ===')
  console.log('Reading', INPUT)
  console.log(`File size: ${(fs.statSync(INPUT).size / 1024 / 1024).toFixed(0)} MB`)

  const content = fs.readFileSync(INPUT, 'utf8')
  console.log('File loaded, parsing...')

  // Columns: Subject(0), Date(1), Priority(2), Status(3), Task(4),
  //          Company/Account(5), Contact(6), Lead(7), Opportunity(8),
  //          Comments(9), Full Comments(10), Account ID(11), Assigned(12), SalesLoft Type(13)

  const byAccount = {}
  let total = 0, matched = 0

  for (const fields of parseCSVStream(content)) {
    total++
    const account = (fields[5] || '').trim()
    if (!account) continue
    matched++

    const date = (fields[1] || '').trim()
    const subject = (fields[0] || '').trim()
    const status = (fields[3] || '').trim()
    const contact = (fields[6] || '').trim()
    const assigned = (fields[12] || '').trim()
    const slType = (fields[13] || '').trim()

    // Parse date to month key
    let monthKey = ''
    if (date) {
      const parts = date.split('/')
      if (parts.length >= 3) {
        monthKey = `${parts[2]}-${parts[0].padStart(2, '0')}`
      }
    }

    const engType = slType ? slType.toLowerCase() : extractEngType(subject)

    if (!byAccount[account]) {
      byAccount[account] = {
        total: 0,
        byType: {},
        byMonth: {},
        contacts: new Set(),
        reps: new Set(),
        lastDate: '',
        events: [],  // recent engagement events with subjects
      }
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

    // Store event for timeline (subject, date, type, contact)
    if (date && subject) {
      acct.events.push({ d: date, s: subject.substring(0, 120), t: engType, c: contact || '' })
    }
  }

  console.log(`\nTotal rows: ${total}`)
  console.log(`Matched to accounts: ${matched}`)
  console.log(`Unique accounts: ${Object.keys(byAccount).length}`)

  // Convert Sets to counts for JSON serialization
  const output = {}
  for (const [name, data] of Object.entries(byAccount)) {
    // Sort events by date descending
    const sortedEvents = data.events.sort((a, b) => {
      const da = parseMMDDYYYY(a.d), db = parseMMDDYYYY(b.d)
      return db - da
    })

    output[name] = {
      t: data.total,                              // total engagements
      tp: data.byType,                            // by type
      m: data.byMonth,                            // by month
      c: data.contacts.size,                      // unique contacts engaged
      r: data.reps.size,                           // unique reps
      l: data.lastDate,                            // last engagement month
      e: sortedEvents,                             // recent events [{d,s,t,c}]
    }
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(output), 'utf8')
  const sizeMB = (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1)
  console.log(`\nOutput: ${OUTPUT} (${sizeMB} MB)`)
}

main()
