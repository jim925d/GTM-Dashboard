/**
 * Outage Engine — fetches US ISP outage data from Cloudflare Radar + IODA,
 * normalizes into a unified schema, deduplicates, and resolves coordinates.
 *
 * Pure function module — no React, no hooks, no state.
 * Called by OutageContext.jsx which manages the store lifecycle.
 *
 * Data sources:
 *   1. Cloudflare Radar API (requires free token — VITE_CF_RADAR_TOKEN)
 *   2. IODA / Georgia Tech (no auth required)
 *
 * If Cloudflare token is missing, engine still works using IODA data alone.
 */

import { resolveCoordinates } from './outageGeo'

// ═══════════════════════════════════════════════════════════════════════════
// CLOUDFLARE RADAR
// ═══════════════════════════════════════════════════════════════════════════

const CF_BASE = 'https://api.cloudflare.com/client/v4/radar'

async function fetchCloudflare() {
  const token = import.meta.env.VITE_CF_RADAR_TOKEN
  if (!token) {
    console.warn('[OutageEngine] No VITE_CF_RADAR_TOKEN — skipping Cloudflare Radar.')
    return []
  }

  const results = []
  const headers = { Authorization: `Bearer ${token}` }
  const now = new Date()

  // 1) Verified outages (30 days, US only)
  try {
    const res = await fetch(
      `${CF_BASE}/annotations/outages?limit=100&offset=0&dateRange=30d&location=US&format=json`,
      { headers }
    )
    if (res.ok) {
      const json = await res.json()
      for (const a of (json.result?.annotations || [])) {
        results.push({
          id: `cf-${a.startDate}-${a.asns?.[0] || a.locations?.[0] || 'us'}`,
          source: 'cloudflare',
          provider: a.asns?.length ? `AS${a.asns[0]}` : undefined,
          asn: a.asns?.[0],
          location: a.scope || 'United States',
          locationCode: a.locations?.[0] || 'US',
          severity: a.outage?.outageType === 'NATIONWIDE' ? 'high'
            : a.outage?.outageType === 'REGIONAL' ? 'medium' : 'low',
          status: (a.endDate && new Date(a.endDate) < now) ? 'resolved' : 'active',
          cause: a.outage?.outageCause,
          outageType: a.outage?.outageType,
          description: a.description ||
            `${a.outage?.outageType || 'Network'} outage — ${(a.outage?.outageCause || 'unknown').replace(/_/g, ' ').toLowerCase()}`,
          startDate: a.startDate,
          endDate: a.endDate,
          linkedUrl: a.linkedUrl || undefined,
        })
      }
    }
  } catch (e) {
    console.error('[OutageEngine] CF outages fetch failed:', e)
  }

  // 2) Traffic anomalies (7 days, US)
  try {
    const res = await fetch(
      `${CF_BASE}/traffic_anomalies?limit=50&dateRange=7d&location=US&format=json`,
      { headers }
    )
    if (res.ok) {
      const json = await res.json()
      for (const a of (json.result?.trafficAnomalies || [])) {
        results.push({
          id: `cf-anom-${a.startDate}-${a.asn || a.location || 'us'}`,
          source: 'cloudflare',
          provider: a.asnDetails?.name || (a.asn ? `AS${a.asn}` : undefined),
          asn: a.asn,
          location: a.locationDetails?.name || a.location || 'United States',
          locationCode: a.location || 'US',
          severity: a.status === 'VERIFIED' ? 'medium' : 'low',
          status: (a.endDate && new Date(a.endDate) < now) ? 'resolved' : 'active',
          description: `Traffic anomaly${a.asnDetails?.name ? ` on ${a.asnDetails.name}` : ''}`,
          startDate: a.startDate,
          endDate: a.endDate,
        })
      }
    }
  } catch (e) {
    console.error('[OutageEngine] CF anomalies fetch failed:', e)
  }

  return results
}

// ═══════════════════════════════════════════════════════════════════════════
// IODA (Georgia Tech) — no auth required
// ═══════════════════════════════════════════════════════════════════════════

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

  // 1) Country-level events (US, 30d)
  try {
    const res = await fetch(
      `${IODA_BASE}/outages/events/country/US?from=${thirtyDaysAgo}&until=${now}&format=codf`
    )
    if (res.ok) {
      const data = await res.json()
      for (const evt of (data?.data || [])) {
        results.push({
          id: `ioda-country-${evt.datasource}-${evt.start}`,
          source: 'ioda',
          location: 'United States',
          locationCode: 'US',
          severity: evt.score > 500 ? 'high' : evt.score > 100 ? 'medium' : 'low',
          status: evt.duration ? 'resolved' : 'active',
          score: evt.score,
          description: `${(evt.datasource || '').toUpperCase()} signal drop (score: ${Math.round(evt.score)})`,
          startDate: new Date(evt.start * 1000).toISOString(),
          endDate: evt.duration
            ? new Date((evt.start + evt.duration) * 1000).toISOString()
            : null,
        })
      }
    }
  } catch (e) {
    console.error('[OutageEngine] IODA country fetch failed:', e)
  }

  // 2) ASN-level alerts for major US ISPs (24h)
  try {
    const res = await fetch(
      `${IODA_BASE}/outages/alerts/asn?from=${oneDayAgo}&until=${now}&relatedTo=country/US`
    )
    if (res.ok) {
      const data = await res.json()
      for (const alert of (data?.data || [])) {
        if (alert.level === 'normal') continue
        const asnNum = parseInt(alert.entity?.code, 10)
        const ispName = US_ISP_ASNS[asnNum] || alert.entity?.name || `AS${asnNum}`
        results.push({
          id: `ioda-asn-${alert.datasource}-${asnNum}-${alert.time}`,
          source: 'ioda',
          provider: ispName,
          asn: asnNum,
          location: 'United States',
          severity: alert.level === 'critical' ? 'high' : 'medium',
          status: 'active',
          score: alert.value,
          description: `${(alert.datasource || '').toUpperCase()} alert on ${ispName}: value ${alert.value} vs historical ${alert.historyValue}`,
          startDate: new Date(alert.time * 1000).toISOString(),
        })
      }
    }
  } catch (e) {
    console.error('[OutageEngine] IODA ASN alerts failed:', e)
  }

  // 3) Region-level events (state granularity, 30d)
  try {
    const res = await fetch(
      `${IODA_BASE}/outages/events/region?from=${thirtyDaysAgo}&until=${now}&relatedTo=country/US&format=codf`
    )
    if (res.ok) {
      const data = await res.json()
      for (const evt of (data?.data || [])) {
        results.push({
          id: `ioda-region-${evt.datasource}-${evt.location}-${evt.start}`,
          source: 'ioda',
          location: evt.location_name || evt.location || 'US Region',
          locationCode: evt.location?.replace('region/', ''),
          severity: evt.score > 500 ? 'high' : evt.score > 100 ? 'medium' : 'low',
          status: evt.duration ? 'resolved' : 'active',
          score: evt.score,
          description: `Regional ${(evt.datasource || '').toUpperCase()} outage in ${evt.location_name || 'US region'} (score: ${Math.round(evt.score)})`,
          startDate: new Date(evt.start * 1000).toISOString(),
          endDate: evt.duration
            ? new Date((evt.start + evt.duration) * 1000).toISOString()
            : null,
        })
      }
    }
  } catch (e) {
    console.error('[OutageEngine] IODA region fetch failed:', e)
  }

  return results
}

// ═══════════════════════════════════════════════════════════════════════════
// MERGE + NORMALIZE
// ═══════════════════════════════════════════════════════════════════════════

function deduplicateAndMerge(cfData, iodaData) {
  const all = [...cfData, ...iodaData]
  const merged = []
  const seen = new Set()

  for (const o of all) {
    const timeKey = o.startDate?.slice(0, 13) // hourly granularity
    const entityKey = o.asn ? `asn-${o.asn}` : `loc-${o.location}`
    const key = `${entityKey}-${timeKey}`

    if (seen.has(key)) {
      // Merge sources if both CF and IODA report same event
      const existing = merged.find(m => {
        const mk = `${m.asn ? `asn-${m.asn}` : `loc-${m.location}`}-${m.startDate?.slice(0, 13)}`
        return mk === key
      })
      if (existing && existing.source !== o.source) {
        existing.source = 'both'
        if (o.severity === 'high') existing.severity = 'high'
        else if (o.severity === 'medium' && existing.severity === 'low')
          existing.severity = 'medium'
      }
      continue
    }
    seen.add(key)

    // Resolve coordinates for map rendering
    const coords = resolveCoordinates(o.location, o.locationCode)
    if (coords) {
      o.lat = coords.lat
      o.lng = coords.lng
    }

    merged.push(o)
  }

  // Sort: high severity first, then newest
  merged.sort((a, b) => {
    const sev = { high: 0, medium: 1, low: 2 }
    const d = (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2)
    return d !== 0 ? d : new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  })

  return merged
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch from both Cloudflare Radar and IODA, merge, deduplicate, and return.
 * Called by OutageContext.refreshOutages().
 *
 * @returns {{ outages: Array, meta: { cloudflareCount, iodaCount, totalCount, errors } }}
 */
export async function fetchAndNormalizeOutages() {
  const errors = []
  let cfData = []
  let iodaData = []

  try {
    cfData = await fetchCloudflare()
  } catch (e) {
    errors.push(`Cloudflare: ${e.message}`)
  }

  try {
    iodaData = await fetchIODA()
  } catch (e) {
    errors.push(`IODA: ${e.message}`)
  }

  const merged = deduplicateAndMerge(cfData, iodaData)

  return {
    outages: merged,
    meta: {
      cloudflareCount: cfData.length,
      iodaCount: iodaData.length,
      totalCount: merged.length,
      errors,
    },
  }
}
