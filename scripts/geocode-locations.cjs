#!/usr/bin/env node
/**
 * Geocode locations.csv using free GeoNames postal code data.
 * Adds Latitude and Longitude columns based on postal code lookup.
 *
 * Usage: node scripts/geocode-locations.js
 *
 * Downloads US + CA + international postal code data from GeoNames (free, CC-BY),
 * builds a postal-code → lat/lng lookup, then writes an updated locations.csv.
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')
const { createUnzip } = require('zlib')

const DATA_DIR = path.join(__dirname, '..', 'data')
const INPUT = path.join(DATA_DIR, 'locations.csv')
const OUTPUT = path.join(DATA_DIR, 'locations_geocoded.csv')
const CACHE_DIR = path.join(__dirname, '.geocache')

// US state names → abbreviations (for fixing country field with state names)
const STATE_ABBR = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
}

const US_STATES = new Set(Object.keys(STATE_ABBR))

// Country code mapping
const COUNTRY_MAP = {
  'usa': 'US', 'us': 'US', 'united states': 'US', 'united states of america': 'US',
  'canada': 'CA', 'ca': 'CA',
  'uk': 'GB', 'united kingdom': 'GB', 'great britain': 'GB', 'england': 'GB',
  'germany': 'DE', 'deutschland': 'DE',
  'france': 'FR', 'japan': 'JP', 'australia': 'AU',
  'netherlands': 'NL', 'holland': 'NL',
  'spain': 'ES', 'italy': 'IT', 'brazil': 'BR', 'mexico': 'MX',
  'india': 'IN', 'china': 'CN', 'singapore': 'SG',
  'ireland': 'IE', 'switzerland': 'CH', 'sweden': 'SE', 'norway': 'NO',
  'denmark': 'DK', 'finland': 'FI', 'belgium': 'BE', 'austria': 'AT',
  'portugal': 'PT', 'poland': 'PL', 'czech republic': 'CZ', 'czechia': 'CZ',
  'hong kong': 'HK', 'south korea': 'KR', 'korea': 'KR',
  'new zealand': 'NZ', 'south africa': 'ZA',
  'puerto rico': 'PR', 'colombia': 'CO', 'chile': 'CL', 'argentina': 'AR',
  'peru': 'PE', 'costa rica': 'CR', 'panama': 'PA',
  'philippines': 'PH', 'thailand': 'TH', 'indonesia': 'ID', 'malaysia': 'MY',
  'taiwan': 'TW', 'vietnam': 'VN',
  'uae': 'AE', 'united arab emirates': 'AE', 'israel': 'IL', 'turkey': 'TR',
  'romania': 'RO', 'hungary': 'HU', 'bulgaria': 'BG', 'croatia': 'HR',
  'slovakia': 'SK', 'luxembourg': 'LU', 'greece': 'GR',
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    proto.get(url, { headers: { 'User-Agent': 'geocode-script/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve, reject)
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function downloadPostalCodes() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })

  const allCodesFile = path.join(CACHE_DIR, 'allCountries.txt')

  if (fs.existsSync(allCodesFile)) {
    console.log('Using cached postal code data...')
    return fs.readFileSync(allCodesFile, 'utf8')
  }

  // Download allCountries.zip from GeoNames
  console.log('Downloading postal code database from GeoNames (this may take a minute)...')
  const url = 'https://download.geonames.org/export/zip/allCountries.zip'
  const zipData = await fetch(url)

  // Save zip and extract
  const zipFile = path.join(CACHE_DIR, 'allCountries.zip')
  fs.writeFileSync(zipFile, zipData)

  // Extract using built-in tools
  console.log('Extracting postal codes...')
  const { execSync } = require('child_process')
  try {
    execSync(`cd "${CACHE_DIR}" && unzip -o allCountries.zip`, { stdio: 'pipe' })
  } catch {
    // Try PowerShell extraction on Windows
    execSync(`powershell -Command "Expand-Archive -Path '${zipFile}' -DestinationPath '${CACHE_DIR}' -Force"`, { stdio: 'pipe' })
  }

  if (!fs.existsSync(allCodesFile)) {
    throw new Error('Failed to extract allCountries.txt from zip')
  }

  return fs.readFileSync(allCodesFile, 'utf8')
}

function buildPostalLookup(rawData) {
  console.log('Building postal code lookup...')
  const lookup = {} // key: "CC:POSTAL" → { lat, lng }

  const lines = rawData.split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    if (parts.length < 10) continue

    const countryCode = parts[0].toUpperCase()
    const postalCode = parts[1].trim()
    const lat = parseFloat(parts[9])
    const lng = parseFloat(parts[10])

    if (!postalCode || isNaN(lat) || isNaN(lng)) continue

    const key = `${countryCode}:${postalCode}`
    if (!lookup[key]) {
      lookup[key] = { lat, lng }
    }

    // Also store without country for fuzzy matching
    const plainKey = `*:${postalCode}`
    if (!lookup[plainKey]) {
      lookup[plainKey] = { lat, lng, cc: countryCode }
    }
  }

  console.log(`Loaded ${Object.keys(lookup).length} postal code entries`)
  return lookup
}

function normalizeCountry(raw) {
  if (!raw) return null
  const cleaned = raw.trim().toLowerCase()
  if (!cleaned || cleaned === 'null') return null

  // Check if it's a US state name used in the country field
  if (US_STATES.has(cleaned)) return 'US'

  // Check country map
  if (COUNTRY_MAP[cleaned]) return COUNTRY_MAP[cleaned]

  // Already a 2-letter code?
  if (cleaned.length === 2) return cleaned.toUpperCase()

  return cleaned.toUpperCase().slice(0, 2)
}

function normalizePostalCode(raw) {
  if (!raw) return null
  let pc = raw.trim()
  if (!pc || pc === 'null') return null
  // US: take first 5 digits of ZIP+4
  if (/^\d{5}(-\d{4})?$/.test(pc)) return pc.slice(0, 5)
  // Canadian: normalize spacing
  if (/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(pc)) return pc.toUpperCase().replace(/\s/g, '')
  return pc.trim()
}

function parseCSVLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current)
  return fields
}

function escapeCSVField(val) {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

async function main() {
  console.log('=== Location Geocoder ===\n')

  // 1. Download/load postal code database
  const rawPostal = await downloadPostalCodes()
  const lookup = buildPostalLookup(rawPostal)

  // 2. Read locations CSV
  console.log(`\nReading ${INPUT}...`)
  const csvContent = fs.readFileSync(INPUT, 'utf8')
  const lines = csvContent.split('\n')
  const header = parseCSVLine(lines[0])

  // Find column indices
  const postalIdx = header.findIndex(h => h.trim().toLowerCase() === 'postal code')
  const countryIdx = header.findIndex(h => h.trim().toLowerCase() === 'country')
  const stateIdx = header.findIndex(h => h.trim().toLowerCase() === 'state')
  const cityIdx = header.findIndex(h => h.trim().toLowerCase() === 'city')

  console.log(`Columns: Postal Code=${postalIdx}, Country=${countryIdx}, State=${stateIdx}, City=${cityIdx}`)
  console.log(`Total rows: ${lines.length - 1}`)

  // 3. Add Latitude and Longitude columns
  const newHeader = header.concat(['Latitude', 'Longitude'])
  const outputLines = [newHeader.map(escapeCSVField).join(',')]

  let matched = 0
  let unmatched = 0
  let total = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const fields = parseCSVLine(line)
    total++

    const rawPostalCode = postalIdx >= 0 ? fields[postalIdx] : null
    const rawCountry = countryIdx >= 0 ? fields[countryIdx] : null
    const rawState = stateIdx >= 0 ? fields[stateIdx] : null

    const postalCode = normalizePostalCode(rawPostalCode)
    let countryCode = normalizeCountry(rawCountry)

    // If country is null but state looks like a US state, assume US
    if (!countryCode && rawState) {
      const stateLower = rawState.trim().toLowerCase()
      if (US_STATES.has(stateLower)) countryCode = 'US'
    }

    let coords = null

    if (postalCode) {
      // Try exact match with country code
      if (countryCode) {
        coords = lookup[`${countryCode}:${postalCode}`]
      }

      // Try without country (fuzzy)
      if (!coords) {
        coords = lookup[`*:${postalCode}`]
      }

      // For Canadian postal codes, try FSA (first 3 chars)
      if (!coords && countryCode === 'CA' && postalCode.length >= 3) {
        const fsa = postalCode.slice(0, 3)
        coords = lookup[`CA:${fsa}`]
      }
    }

    if (coords) {
      matched++
      fields.push(String(coords.lat), String(coords.lng))
    } else {
      unmatched++
      fields.push('', '')
    }

    outputLines.push(fields.map(escapeCSVField).join(','))

    if (total % 25000 === 0) {
      console.log(`  Processed ${total} rows (${matched} matched, ${unmatched} unmatched)...`)
    }
  }

  // 4. Write output
  console.log(`\nWriting geocoded CSV...`)
  fs.writeFileSync(OUTPUT, outputLines.join('\n'), 'utf8')

  console.log(`\n=== Done ===`)
  console.log(`Total: ${total} rows`)
  console.log(`Matched: ${matched} (${(matched / total * 100).toFixed(1)}%)`)
  console.log(`Unmatched: ${unmatched} (${(unmatched / total * 100).toFixed(1)}%)`)
  console.log(`Output: ${OUTPUT}`)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
