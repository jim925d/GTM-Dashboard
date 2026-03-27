/**
 * fetch-outages.cjs — Scrapes US ISP outage data from Cloudflare Radar + IODA,
 * normalizes and deduplicates, then saves to data/outages.json.
 *
 * Designed to run on a daily schedule (e.g., Windows Task Scheduler, cron).
 * Usage: node scripts/fetch-outages.cjs
 *
 * Environment variables (optional):
 *   CF_RADAR_TOKEN — Cloudflare Radar API token (free). If missing, only IODA is used.
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.resolve(__dirname, '..', 'data')

// ── HTTP helper ─────────────────────────────────────────────────────────────

function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${url}\n${body.slice(0, 200)}`))
          return
        }
        try { resolve(JSON.parse(body)) }
        catch (e) { reject(new Error(`JSON parse error for ${url}: ${e.message}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)) })
  })
}

// ── State centroids (for coordinate resolution) ─────────────────────────────

const STATE_COORDS = {
  'Alabama': { lat: 32.32, lng: -86.90 }, 'Alaska': { lat: 64.20, lng: -152.49 },
  'Arizona': { lat: 34.05, lng: -111.09 }, 'Arkansas': { lat: 34.75, lng: -92.29 },
  'California': { lat: 36.78, lng: -119.42 }, 'Colorado': { lat: 39.55, lng: -105.78 },
  'Connecticut': { lat: 41.60, lng: -73.09 }, 'Delaware': { lat: 38.91, lng: -75.53 },
  'Florida': { lat: 27.66, lng: -81.52 }, 'Georgia': { lat: 32.17, lng: -83.51 },
  'Hawaii': { lat: 19.90, lng: -155.58 }, 'Idaho': { lat: 44.07, lng: -114.74 },
  'Illinois': { lat: 40.63, lng: -89.40 }, 'Indiana': { lat: 40.27, lng: -86.13 },
  'Iowa': { lat: 41.88, lng: -93.10 }, 'Kansas': { lat: 39.01, lng: -98.48 },
  'Kentucky': { lat: 37.84, lng: -84.27 }, 'Louisiana': { lat: 30.98, lng: -91.96 },
  'Maine': { lat: 45.25, lng: -69.45 }, 'Maryland': { lat: 39.05, lng: -76.64 },
  'Massachusetts': { lat: 42.41, lng: -71.38 }, 'Michigan': { lat: 44.31, lng: -85.60 },
  'Minnesota': { lat: 46.73, lng: -94.69 }, 'Mississippi': { lat: 32.35, lng: -89.40 },
  'Missouri': { lat: 37.96, lng: -91.83 }, 'Montana': { lat: 46.88, lng: -110.36 },
  'Nebraska': { lat: 41.49, lng: -99.90 }, 'Nevada': { lat: 38.80, lng: -116.42 },
  'New Hampshire': { lat: 43.19, lng: -71.57 }, 'New Jersey': { lat: 40.06, lng: -74.41 },
  'New Mexico': { lat: 34.52, lng: -105.87 }, 'New York': { lat: 42.17, lng: -74.95 },
  'North Carolina': { lat: 35.76, lng: -79.02 }, 'North Dakota': { lat: 47.55, lng: -101.00 },
  'Ohio': { lat: 40.42, lng: -82.91 }, 'Oklahoma': { lat: 35.47, lng: -97.52 },
  'Oregon': { lat: 43.80, lng: -120.55 }, 'Pennsylvania': { lat: 41.20, lng: -77.19 },
  'Rhode Island': { lat: 41.58, lng: -71.48 }, 'South Carolina': { lat: 33.84, lng: -81.16 },
  'South Dakota': { lat: 43.97, lng: -99.90 }, 'Tennessee': { lat: 35.52, lng: -86.58 },
  'Texas': { lat: 31.97, lng: -99.90 }, 'Utah': { lat: 39.32, lng: -111.09 },
  'Vermont': { lat: 44.56, lng: -72.58 }, 'Virginia': { lat: 37.43, lng: -78.66 },
  'Washington': { lat: 47.75, lng: -120.74 }, 'West Virginia': { lat: 38.60, lng: -80.45 },
  'Wisconsin': { lat: 43.78, lng: -88.79 }, 'Wyoming': { lat: 43.08, lng: -107.29 },
  'District of Columbia': { lat: 38.91, lng: -77.04 },
}

const STATE_CODE_TO_NAME = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
  MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
}

function resolveCoordinates(location, locationCode) {
  if (!location) return null
  const loc = location.trim()
  if (STATE_COORDS[loc]) return STATE_COORDS[loc]
  if (locationCode) {
    const code = locationCode.replace('US-', '').replace('region/', '').replace('US/', '')
    const name = STATE_CODE_TO_NAME[code]
    if (name && STATE_COORDS[name]) return STATE_COORDS[name]
  }
  const lower = loc.toLowerCase()
  for (const [name, coords] of Object.entries(STATE_COORDS)) {
    if (lower.includes(name.toLowerCase())) return coords
  }
  return { lat: 39.83, lng: -98.58 } // US center fallback
}

// ── Cloudflare Radar ────────────────────────────────────────────────────────

const CF_BASE = 'https://api.cloudflare.com/client/v4/radar'

async function fetchCloudflare(token) {
  if (!token) return []
  const headers = { Authorization: `Bearer ${token}` }
  const results = []
  const now = new Date()

  // Verified outages (30d, US)
  try {
    const json = await fetch(`${CF_BASE}/annotations/outages?limit=100&offset=0&dateRange=30d&location=US&format=json`, headers)
    for (const a of (json.result?.annotations || [])) {
      results.push({
        id: `cf-${a.startDate}-${a.asns?.[0] || a.locations?.[0] || 'us'}`,
        source: 'cloudflare', provider: a.asns?.length ? `AS${a.asns[0]}` : undefined,
        asn: a.asns?.[0], location: a.scope || 'United States',
        locationCode: a.locations?.[0] || 'US',
        severity: a.outage?.outageType === 'NATIONWIDE' ? 'high' : a.outage?.outageType === 'REGIONAL' ? 'medium' : 'low',
        status: (a.endDate && new Date(a.endDate) < now) ? 'resolved' : 'active',
        cause: a.outage?.outageCause, outageType: a.outage?.outageType,
        description: a.description || `${a.outage?.outageType || 'Network'} outage — ${(a.outage?.outageCause || 'unknown').replace(/_/g, ' ').toLowerCase()}`,
        startDate: a.startDate, endDate: a.endDate, linkedUrl: a.linkedUrl || undefined,
      })
    }
  } catch (e) { console.error('[fetch-outages] CF outages failed:', e.message) }

  // Traffic anomalies (7d, US)
  try {
    const json = await fetch(`${CF_BASE}/traffic_anomalies?limit=50&dateRange=7d&location=US&format=json`, headers)
    for (const a of (json.result?.trafficAnomalies || [])) {
      results.push({
        id: `cf-anom-${a.startDate}-${a.asn || a.location || 'us'}`,
        source: 'cloudflare', provider: a.asnDetails?.name || (a.asn ? `AS${a.asn}` : undefined),
        asn: a.asn, location: a.locationDetails?.name || a.location || 'United States',
        locationCode: a.location || 'US',
        severity: a.status === 'VERIFIED' ? 'medium' : 'low',
        status: (a.endDate && new Date(a.endDate) < now) ? 'resolved' : 'active',
        description: `Traffic anomaly${a.asnDetails?.name ? ` on ${a.asnDetails.name}` : ''}`,
        startDate: a.startDate, endDate: a.endDate,
      })
    }
  } catch (e) { console.error('[fetch-outages] CF anomalies failed:', e.message) }

  return results
}

// ── IODA (Georgia Tech) ─────────────────────────────────────────────────────

const IODA_BASE = 'https://api.ioda.inetintel.cc.gatech.edu/v2'
const US_ISP_ASNS = {
  7922: 'Comcast', 7018: 'AT&T', 701: 'Verizon', 20115: 'Charter/Spectrum',
  22773: 'Cox', 209: 'CenturyLink/Lumen', 5650: 'Frontier',
  21928: 'T-Mobile', 22394: 'Verizon Wireless', 14593: 'Windstream',
  6128: 'Cablevision/Altice', 10796: 'Charter', 6389: 'BellSouth/AT&T',
}

async function fetchIODA() {
  const now = Math.floor(Date.now() / 1000)
  const thirtyDaysAgo = now - 30 * 86400
  const oneDayAgo = now - 86400
  const results = []

  // Country-level events (US, 30d)
  try {
    const data = await fetch(`${IODA_BASE}/outages/events?from=${thirtyDaysAgo}&until=${now}&entityType=country&entityCode=US&format=codf`)
    for (const evt of (data?.data || [])) {
      results.push({
        id: `ioda-country-${evt.datasource}-${evt.start}`, source: 'ioda',
        location: 'United States', locationCode: 'US',
        severity: evt.score > 500 ? 'high' : evt.score > 100 ? 'medium' : 'low',
        status: evt.duration ? 'resolved' : 'active', score: evt.score,
        description: `${(evt.datasource || '').toUpperCase()} signal drop (score: ${Math.round(evt.score)})`,
        startDate: new Date(evt.start * 1000).toISOString(),
        endDate: evt.duration ? new Date((evt.start + evt.duration) * 1000).toISOString() : null,
      })
    }
  } catch (e) { console.error('[fetch-outages] IODA country failed:', e.message) }

  // ASN-level alerts for major US ISPs (24h)
  try {
    const data = await fetch(`${IODA_BASE}/outages/alerts?from=${oneDayAgo}&until=${now}&entityType=asn&relatedTo=country/US`)
    for (const alert of (data?.data || [])) {
      if (alert.level === 'normal') continue
      const asnNum = parseInt(alert.entity?.code, 10)
      const ispName = US_ISP_ASNS[asnNum] || alert.entity?.name || `AS${asnNum}`
      results.push({
        id: `ioda-asn-${alert.datasource}-${asnNum}-${alert.time}`, source: 'ioda',
        provider: ispName, asn: asnNum, location: 'United States',
        severity: alert.level === 'critical' ? 'high' : 'medium', status: 'active',
        score: alert.value,
        description: `${(alert.datasource || '').toUpperCase()} alert on ${ispName}: value ${alert.value} vs historical ${alert.historyValue}`,
        startDate: new Date(alert.time * 1000).toISOString(),
      })
    }
  } catch (e) { console.error('[fetch-outages] IODA ASN alerts failed:', e.message) }

  // Region-level events (state granularity, 30d)
  try {
    const data = await fetch(`${IODA_BASE}/outages/events?from=${thirtyDaysAgo}&until=${now}&entityType=region&relatedTo=country/US&format=codf`)
    for (const evt of (data?.data || [])) {
      results.push({
        id: `ioda-region-${evt.datasource}-${evt.location}-${evt.start}`, source: 'ioda',
        location: evt.location_name || evt.location || 'US Region',
        locationCode: evt.location?.replace('region/', ''),
        severity: evt.score > 500 ? 'high' : evt.score > 100 ? 'medium' : 'low',
        status: evt.duration ? 'resolved' : 'active', score: evt.score,
        description: `Regional ${(evt.datasource || '').toUpperCase()} outage in ${evt.location_name || 'US region'} (score: ${Math.round(evt.score)})`,
        startDate: new Date(evt.start * 1000).toISOString(),
        endDate: evt.duration ? new Date((evt.start + evt.duration) * 1000).toISOString() : null,
      })
    }
  } catch (e) { console.error('[fetch-outages] IODA region failed:', e.message) }

  return results
}

// ── Merge + deduplicate ─────────────────────────────────────────────────────

function deduplicateAndMerge(cfData, iodaData) {
  const all = [...cfData, ...iodaData]
  const merged = []
  const seen = new Set()

  for (const o of all) {
    const timeKey = o.startDate?.slice(0, 13)
    const entityKey = o.asn ? `asn-${o.asn}` : `loc-${o.location}`
    const key = `${entityKey}-${timeKey}`

    if (seen.has(key)) {
      const existing = merged.find((m) => {
        const mk = `${m.asn ? `asn-${m.asn}` : `loc-${m.location}`}-${m.startDate?.slice(0, 13)}`
        return mk === key
      })
      if (existing && existing.source !== o.source) {
        existing.source = 'both'
        if (o.severity === 'high') existing.severity = 'high'
        else if (o.severity === 'medium' && existing.severity === 'low') existing.severity = 'medium'
      }
      continue
    }
    seen.add(key)

    const coords = resolveCoordinates(o.location, o.locationCode)
    if (coords) { o.lat = coords.lat; o.lng = coords.lng }
    merged.push(o)
  }

  merged.sort((a, b) => {
    const sev = { high: 0, medium: 1, low: 2 }
    const d = (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2)
    return d !== 0 ? d : new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  })

  return merged
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const start = Date.now()
  console.log(`[fetch-outages] Starting at ${new Date().toISOString()}`)

  const cfToken = process.env.CF_RADAR_TOKEN || process.env.VITE_CF_RADAR_TOKEN || ''

  let cfData = []
  let iodaData = []

  try { cfData = await fetchCloudflare(cfToken) }
  catch (e) { console.error('[fetch-outages] Cloudflare fetch error:', e.message) }

  try { iodaData = await fetchIODA() }
  catch (e) { console.error('[fetch-outages] IODA fetch error:', e.message) }

  const outages = deduplicateAndMerge(cfData, iodaData)

  const snapshot = {
    outages,
    lastFetched: new Date().toISOString(),
    meta: {
      cloudflareCount: cfData.length,
      iodaCount: iodaData.length,
      totalCount: outages.length,
    },
  }

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  const outPath = path.join(DATA_DIR, 'outages.json')
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf-8')

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[fetch-outages] Done in ${elapsed}s — ${outages.length} outages (CF: ${cfData.length}, IODA: ${iodaData.length})`)
  console.log(`[fetch-outages] Saved to ${outPath}`)
}

main().catch((e) => { console.error('[fetch-outages] Fatal:', e); process.exit(1) })
