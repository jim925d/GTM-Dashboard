/**
 * GTM Premier — Target Account Intelligence
 *
 * Two views:
 *   1. Today's Targets — morning briefing with scored, ranked accounts
 *   2. Market Review — market-level KPIs, map, charts, expandable market cards
 *
 * All data from ModelingContext snapshot hooks — zero direct computation.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { T, FONT_MONO, FONT_SANS } from '../lib/constants'
import { chartTheme, $k } from '../components/shared/ChartTheme'
import {
  useAllEnrichedAccounts,
  useAccountLocations,
  useLocationProductAffinity,
  useEngineStatus,
  useEventFeed,
} from '../lib/ModelingContext'
import useAutoModelingRun from '../hooks/useAutoModelingRun'
import useOutageEnrichedAccounts from '../hooks/useOutageEnrichedAccounts'
import { normalizeStage } from '../lib/accountBuilder'

// ─── Theme tokens (Shreyu-dark) ─────────────────────────────────────────────
const CS = {
  bg: '#0B0F19',
  card: '#111827',
  cardAlt: '#1A2035',
  surface: '#1F2A40',
  border: '#1F2937',
  borderLight: '#374151',
  text: '#E5E7EB',
  textMuted: '#9CA3AF',
  textFaint: '#6B7280',
  cyan: '#22D3EE',
  green: '#34D399',
  purple: '#A78BFA',
  red: '#F87171',
  amber: '#FBBF24',
  blue: '#60A5FA',
}

const PRODUCT_COLORS = {
  'Ethernet': '#22D3EE',
  'Dark Fiber': '#34D399',
  'Wavelengths': '#A78BFA',
  'zColo': '#FBBF24',
  'IP Services': '#60A5FA',
  'SD-WAN': '#F87171',
}

const EVENT_CAT_COLORS = {
  Technology: { text: CS.green, bg: 'rgba(52,211,153,0.2)' },
  Regulatory: { text: CS.blue, bg: 'rgba(96,165,250,0.2)' },
  'M&A': { text: CS.purple, bg: 'rgba(167,139,250,0.2)' },
  Outage: { text: CS.red, bg: 'rgba(248,113,113,0.2)' },
  Macro: { text: CS.amber, bg: 'rgba(251,191,36,0.2)' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}K`
  return `$${Math.round(n)}`
}

const fmtK = (n) => {
  if (n >= 1000) return `$${Math.round(n / 1000)}K`
  return `$${Math.round(n)}`
}

const proj = (lat, lng, w = 800, h = 480) => [
  (lng + 125) / 58 * w,
  (49 - lat) / 24 * h,
]

function donutArcs(products, radius) {
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return products.map(p => {
    const length = circumference * p.pct / 100
    const arc = { dashOffset: circumference - offset, dashLength: length, color: PRODUCT_COLORS[p.name] || CS.textFaint, name: p.name }
    offset += length
    return arc
  })
}

// ─── Score a single account for Today's Targets ─────────────────────────────
function scoreAccount(account) {
  let score = 0
  const breakdown = {}
  const tags = []

  if (account.outage_impacted) {
    score += 100
    breakdown.outage = 100
    tags.push({ label: 'Outage', color: CS.red })
  }

  if (account.latest_intel) {
    score += 40
    breakdown.intel = 40
    tags.push({ label: 'New Intel', color: CS.blue })
  }

  if ((account.avg_event_modifier || 1) > 1.05) {
    score += 25
    breakdown.tailwind = 25
    tags.push({ label: 'Tailwind', color: CS.green })
  }

  const gapMrr = account.total_gap_mrr || 0
  const gapPts = Math.min(gapMrr / 1000, 30)
  score += gapPts
  breakdown.whitespace = Math.round(gapPts)

  const nrr = account.nrr || account.net_revenue_retention || 1.0
  if (nrr > 1.10) {
    score += 15
    breakdown.nrrGrowth = 15
    tags.push({ label: `NRR ${nrr.toFixed(2)}`, color: CS.green })
  }

  const daysSilent = account.days_silent || account.days_since_last_activity || 0
  if (daysSilent > 14) {
    score += 10
    breakdown.stale = 10
    tags.push({ label: `${daysSilent}d silent`, color: CS.amber })
  }

  const onNet = (account.locations || []).some(l => l.status === 'on-net')
  if (onNet) {
    score += 5
    breakdown.onNet = 5
  }

  return { score: Math.round(score), breakdown, tags }
}

// Build talk track from account data
function buildTalkTrack(account) {
  const mod = account.avg_event_modifier || 1
  const nrr = account.nrr || account.net_revenue_retention || 1
  const products = account.products || []
  const gaps = account._gaps || []

  if (account.outage_impacted) {
    return `${account.name} is experiencing active outage impact. Lead with reliability and redundancy — position ${gaps[0]?.product || 'backup connectivity'} as risk mitigation. Time-sensitive opportunity.`
  }
  if (mod > 1.05) {
    return `Favorable market context (${mod.toFixed(2)}×) creates a tailwind for ${account.name}. ${gaps.length > 0 ? `Cross-sell opportunity: ${gaps.map(g => g.product).join(', ')}. ` : ''}Reference market momentum in your outreach.`
  }
  if (nrr > 1.10) {
    return `${account.name} is growing at ${(nrr * 100 - 100).toFixed(0)}% NRR — expanding footprint. ${gaps.length > 0 ? `Whitespace in ${gaps[0].product} aligns with growth trajectory.` : 'Focus on capacity planning conversations.'}`
  }
  if (gaps.length > 0) {
    return `${account.name} has whitespace in ${gaps.map(g => g.product).join(', ')}. Location intelligence suggests product affinity — lead with infrastructure consolidation.`
  }
  return `Review ${account.name}'s current portfolio (${products.join(', ')}) and explore expansion opportunities based on usage patterns.`
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ModBadge({ value }) {
  if (!value || value === 1) return null
  const color = value > 1.02 ? CS.green : value < 0.98 ? CS.amber : CS.textMuted
  return (
    <span
      className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ color, background: color + '20' }}
    >
      {value.toFixed(2)}×
    </span>
  )
}

function TagPill({ label, color }) {
  return (
    <span
      className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ color, background: color + '20', border: `1px solid ${color}40` }}
    >
      {label}
    </span>
  )
}

function ScoreBox({ score }) {
  const color = score >= 100 ? CS.red : score >= 60 ? CS.purple : CS.cyan
  const breakdownText = `Score: ${score}`
  return (
    <div
      className="w-9 h-9 flex items-center justify-center rounded-lg font-mono text-sm font-bold border"
      style={{ color, borderColor: color + '60', background: color + '10' }}
      title={breakdownText}
    >
      {score}
    </div>
  )
}

function KPICard({ label, value, accent, trend, trendColor }) {
  return (
    <div className="rounded-xl p-4 border" style={{ background: CS.card, borderColor: CS.border }}>
      <div className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: CS.textFaint }}>{label}</div>
      <div className="flex items-end gap-2">
        <div className="font-mono text-xl font-bold" style={{ color: accent }}>{value}</div>
        {trend && (
          <span className="font-mono text-[10px] font-semibold pb-0.5" style={{ color: trendColor || CS.green }}>
            {trend}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Hover Info Tooltip ──────────────────────────────────────────────────────
function InfoTip({ children, tip, side = 'right' }) {
  const [show, setShow] = useState(false)
  const posStyle = side === 'left'
    ? { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 }
    : { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 }
  return (
    <span className="relative inline-block cursor-help" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute z-50 px-2.5 py-1.5 rounded-lg text-[10px] leading-tight whitespace-pre-line max-w-[260px] font-mono pointer-events-none"
          style={{ ...posStyle, background: CS.bg, color: CS.text, border: `1px solid ${CS.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
          {tip}
        </span>
      )}
    </span>
  )
}

// ─── Fit map bounds to markers ───────────────────────────────────────────────
function FitBounds({ locations }) {
  const map = useMap()
  useEffect(() => {
    const valid = locations.filter(l => l.lat && l.lng)
    if (valid.length === 0) return
    const bounds = valid.map(l => [l.lat, l.lng])
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 12 })
  }, [locations, map])
  return null
}

// ─── Customer Location Map ───────────────────────────────────────────────────
const NET_COLORS = { 'on-net': CS.green, 'near-net': CS.amber, 'off-net': '#4B5563' }

function CustomerLocationMap({ locations }) {
  const valid = locations.filter(l => l.lat && l.lng)
  if (valid.length === 0) return (
    <div className="rounded-lg flex items-center justify-center h-[200px]" style={{ background: CS.surface }}>
      <span className="font-mono text-[10px]" style={{ color: CS.textFaint }}>No geocoded locations</span>
    </div>
  )
  const center = [valid[0].lat, valid[0].lng]
  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: CS.border }}>
      <MapContainer center={center} zoom={4} style={{ height: 220, width: '100%', background: CS.bg }} zoomControl={false} attributionControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <FitBounds locations={valid} />
        {valid.map((loc, i) => (
          <CircleMarker key={i} center={[loc.lat, loc.lng]}
            radius={loc.status === 'on-net' ? 6 : 4}
            pathOptions={{ fillColor: NET_COLORS[loc.status] || '#4B5563', color: NET_COLORS[loc.status] || '#4B5563', fillOpacity: 0.85, weight: 1, opacity: 0.6 }}>
            <Popup>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>
                <div style={{ fontWeight: 600 }}>{loc.name}</div>
                {loc.market && <div style={{ color: '#9CA3AF' }}>{loc.market}</div>}
                <div style={{ color: NET_COLORS[loc.status], fontWeight: 600, textTransform: 'uppercase', fontSize: 10, marginTop: 2 }}>{loc.status}</div>
                {loc.mrr > 0 && <div style={{ color: '#22D3EE' }}>MRR: ${loc.mrr.toLocaleString()}</div>}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {/* Legend */}
      <div className="flex items-center gap-3 px-2.5 py-1.5" style={{ background: CS.surface }}>
        {[['on-net', CS.green], ['near-net', CS.amber], ['off-net', '#4B5563']].map(([label, color]) => {
          const count = valid.filter(l => l.status === label).length
          if (count === 0) return null
          return (
            <span key={label} className="flex items-center gap-1 font-mono text-[9px]">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span style={{ color: CS.textMuted }}>{label}</span>
              <span style={{ color: CS.text, fontWeight: 600 }}>{count}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function GTMPremier({ accounts = [] }) {
  const enrichedAccounts = useAllEnrichedAccounts()
  const { isLoading, isStale, lastRunAge } = useEngineStatus()
  const eventFeed = useEventFeed(90)

  // Auto-run modeling engine if accounts loaded but no snapshot yet
  useAutoModelingRun(accounts)

  // Bridge outage data onto accounts
  const baseAccts = enrichedAccounts.length > 0 ? enrichedAccounts : accounts
  const accts = useOutageEnrichedAccounts(baseAccts)

  const [view, setView] = useState('targets') // 'targets' | 'market'
  const [targetCount, setTargetCount] = useState(10)
  const [expandedTarget, setExpandedTarget] = useState(null)
  const [mapMode, setMapMode] = useState('list') // 'map' | 'list'
  const [chartExpanded, setChartExpanded] = useState(false)
  const [trendExpanded, setTrendExpanded] = useState(false)
  const [chartFilter, setChartFilter] = useState(null) // city name or null
  const [verticalFilter, setVerticalFilter] = useState('All')
  const [activityFilter, setActivityFilter] = useState('All')
  const [outageFilter, setOutageFilter] = useState(false)
  const [expandedMarket, setExpandedMarket] = useState(null)
  const [marketAcctFilter, setMarketAcctFilter] = useState('All')
  const [marketAcctSort, setMarketAcctSort] = useState('gap')

  // ─── Derive markets by grouping accounts by primary city/location ────────
  const { markets, allTargets, kpis } = useMemo(() => {
    const marketMap = {}
    const now = new Date()

    for (const acct of accts) {
      // Determine market city from locations or use a fallback
      const locs = acct.locations || []
      let city = 'Unknown'
      let state = ''
      let lat = null
      let lng = null

      if (locs.length > 0) {
        // Use the first location's market or city — never fall back to street address
        const loc = locs[0]
        city = String(loc.market || loc.city || loc.state || 'Unknown')
        lat = loc.lat
        lng = loc.lng
        state = loc.state || ''
        // If city looks like a street address (starts with a number), use state instead
        if (/^\d/.test(city) && state) city = state
      }

      // Extract key from market/city — strip state suffix if present (e.g. "Denver, CO" → "Denver")
      const key = city.split(',')[0].trim()

      if (!marketMap[key]) {
        marketMap[key] = {
          city: key,
          state,
          lat,
          lng,
          accounts: [],
          closedDeals: 0,
          closedMRR: 0,
          pipelineWeighted: 0,
          onNetAccounts: 0,
          totalAccounts: 0,
          productMix: {},
          verticals: {},
          events: [],
          hasOutage: false,
        }
      }

      const m = marketMap[key]
      m.accounts.push(acct)
      m.totalAccounts++

      // Check on-net
      const hasOnNet = locs.some(l => l.status === 'on-net')
      if (hasOnNet) m.onNetAccounts++

      // Aggregate deals
      const deals = acct.active_deals || []

      // Closed MRR — Closed Won / Accepted, positive MRR, last 12 months
      // Sources: historical_deals (historical.json) + funnel_closed (funnel.csv current year)
      const allClosed = [...(acct.historical_deals || []), ...(acct.funnel_closed || [])]
      const seenClose = new Set()
      for (const d of allClosed) {
        if (normalizeStage(d.stage) !== 'closed won') continue
        const dealMrr = d.mrr || 0
        if (dealMrr <= 0) continue
        if (!d.close) continue
        const cd = new Date(d.close)
        if (isNaN(cd.getTime())) continue
        const monthsAgo = (now.getFullYear() - cd.getFullYear()) * 12 + (now.getMonth() - cd.getMonth())
        if (monthsAgo > 12 || monthsAgo < 0) continue
        // Deduplicate by close date + mrr (same deal may appear in both sources)
        const key = `${d.close}|${dealMrr}`
        if (seenClose.has(key)) continue
        seenClose.add(key)
        m.closedDeals++
        m.closedMRR += dealMrr
      }

      // Stage win probabilities — 2026 Funnel Model
      const STAGE_PROB = { 'discover': 0.3057, 'design solution': 0.5321, 'design': 0.5321, 'propose': 0.6623, 'negotiate': 0.8467, 'verbal agreement': 0.9249 }
      for (const d of deals) {
        const stageKey = (d.stage || '').toLowerCase().trim()
        const prob = d.adjusted_probability || d.stage_probability || STAGE_PROB[stageKey] || 0.3
        const mrr = parseFloat(d.mrr || d.MRR || 0)
        m.pipelineWeighted += mrr * prob
        const prod = d.product || d.product_type || 'Other'
        m.productMix[prod] = (m.productMix[prod] || 0) + 1
      }

      // Verticals
      const vert = acct.vertical || acct.mega_vertical || 'Unknown'
      if (!m.verticals[vert]) m.verticals[vert] = { deals: 0, mrr: 0 }
      m.verticals[vert].deals += (acct.active_pipeline_count || deals.length)
      m.verticals[vert].mrr += (acct.pipeline_mrr || acct.active_pipeline_mrr || 0)

      // Outage
      if (acct.outage_impacted) m.hasOutage = true
    }

    // Convert to array and compute avg modifier
    const marketArr = Object.values(marketMap)
      .filter(m => m.city !== 'Unknown')
      .map(m => {
        const mods = m.accounts
          .map(a => a.avg_event_modifier || 1)
          .filter(v => v !== 1)
        const avgMod = mods.length ? mods.reduce((s, v) => s + v, 0) / mods.length : 1.0

        // Product mix as percentages
        const totalProd = Object.values(m.productMix).reduce((s, v) => s + v, 0)
        const products = Object.entries(m.productMix)
          .map(([name, count]) => ({ name, count, pct: totalProd ? (count / totalProd * 100) : 0 }))
          .sort((a, b) => b.count - a.count)

        // Top verticals
        const topVerticals = Object.entries(m.verticals)
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.mrr - a.mrr)

        return { ...m, avgModifier: Math.round(avgMod * 10000) / 10000, products, topVerticals }
      })
      .sort((a, b) => b.closedMRR - a.closedMRR)

    // Score all accounts for targets
    const scored = accts.map(acct => {
      // Compute whitespace: addressable spend minus current MRR per location
      const acctLocs = acct.locations || []
      const totalAddressable = acctLocs.reduce((s, l) => s + (l.addressable_spend || 0), 0)
      const totalLocMrr = acctLocs.reduce((s, l) => s + (l.mrr || 0), 0)
      const totalGapMrr = Math.max(0, totalAddressable - totalLocMrr)

      // Product affinity gaps (for talk track / gap product recommendations)
      const currentProducts = new Set((acct.products || []).map(p => p.toLowerCase()))
      const affinity = acct.loc_product_affinity || {}
      const gaps = Object.entries(affinity)
        .filter(([prod]) => !currentProducts.has(prod.toLowerCase()))
        .sort(([, a], [, b]) => b - a)
        .map(([product, score]) => ({ product, score }))
      const enrichedAcct = { ...acct, _gaps: gaps, total_gap_mrr: totalGapMrr }
      const { score, breakdown, tags } = scoreAccount(enrichedAcct)

      // Find market
      const locs = acct.locations || []
      const marketCity = locs.length > 0 ? String(locs[0].market || locs[0].city || locs[0].name || 'Unknown').split(',')[0].trim() : 'Unknown'

      return {
        ...enrichedAcct,
        _score: score,
        _breakdown: breakdown,
        _tags: tags,
        _market: marketCity,
        _onNet: locs.some(l => l.status === 'on-net'),
        _talkTrack: buildTalkTrack(enrichedAcct),
      }
    }).sort((a, b) => b._score - a._score)

    // KPIs — aggregate from scored accounts (all accounts) so values don't
    // drop to zero when accounts lack location/market data for market grouping.
    const totalClosed12m = scored.reduce((s, a) => {
      const closed = a.funnel_closed || []
      return s + closed.reduce((cs, d) => {
        if ((d.stage || '').toLowerCase().includes('won') || (d.type || '').toLowerCase() === 'won') {
          return cs + (d.mrr || 0)
        }
        return cs
      }, 0)
    }, 0)
    const totalPipeline = scored.reduce((s, a) => {
      const deals = a.active_deals || []
      const STAGE_PROB = { 'discover': 0.3057, 'design solution': 0.5321, 'design': 0.5321, 'propose': 0.6623, 'negotiate': 0.8467, 'verbal agreement': 0.9249 }
      return s + deals.reduce((ps, d) => {
        const stageKey = (d.stage || '').toLowerCase().trim()
        const prob = d.adjusted_probability || d.stage_probability || STAGE_PROB[stageKey] || 0.3
        const mrr = parseFloat(d.mrr || d.MRR || 0)
        return ps + mrr * prob
      }, 0)
    }, 0)
    const totalWhitespace = scored.reduce((s, a) => s + (a.total_gap_mrr || 0), 0)
    const totalOnNet = scored.filter(a => a._onNet).length
    const totalAccts = scored.length
    const outageCount = scored.filter(a => a.outage_impacted).length

    return {
      markets: marketArr,
      allTargets: scored,
      kpis: {
        closed12m: totalClosed12m,
        pipeline: totalPipeline,
        whitespace: totalWhitespace,
        onNet: totalOnNet,
        totalAccounts: totalAccts,
        outages: outageCount,
      },
    }
  }, [accts])

  // ─── Filter markets for Market Review ──────────────────────────────────────
  const filteredMarkets = useMemo(() => {
    let filtered = markets

    if (chartFilter) {
      filtered = filtered.filter(m => m.city === chartFilter)
    }

    if (verticalFilter !== 'All') {
      filtered = filtered.filter(m =>
        m.accounts.some(a => (a.vertical || a.mega_vertical || '') === verticalFilter)
      )
    }

    if (activityFilter === 'High Volume') {
      filtered = filtered.filter(m => m.closedDeals >= 40)
    } else if (activityFilter === 'Tailwind') {
      filtered = filtered.filter(m => m.avgModifier > 1.05)
    } else if (activityFilter === 'Headwind') {
      filtered = filtered.filter(m => m.avgModifier < 1.0)
    }

    if (outageFilter) {
      filtered = filtered.filter(m => m.hasOutage)
    }

    return filtered
  }, [markets, chartFilter, verticalFilter, activityFilter, outageFilter])

  // Unique verticals for filter
  const verticals = useMemo(() => {
    const set = new Set()
    for (const a of accts) {
      const v = a.vertical || a.mega_vertical
      if (v) set.add(v)
    }
    return ['All', ...Array.from(set).sort()]
  }, [accts])

  // Chart data
  const chartData = useMemo(() => {
    const top = chartExpanded ? markets : markets.slice(0, 5)
    return top.map(m => ({
      name: m.city,
      closed: Math.round(m.closedMRR),
      pipeline: Math.round(m.pipelineWeighted),
    }))
  }, [markets, chartExpanded])

  // Bookings trend — Closed Won / Accepted, positive MRR, from historical_deals + funnel_closed
  const bookingsTrend = useMemo(() => {
    const months = trendExpanded ? 12 : 6
    const now = new Date()
    const data = []
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('en-US', { month: 'short' })
      let mrr = 0
      const seen = new Set()
      for (const a of accts) {
        const allDeals = [...(a.historical_deals || []), ...(a.funnel_closed || [])]
        for (const deal of allDeals) {
          if (!deal.close) continue
          const cd = new Date(deal.close)
          if (isNaN(cd.getTime())) continue
          if (cd.getMonth() !== d.getMonth() || cd.getFullYear() !== d.getFullYear()) continue
          if (normalizeStage(deal.stage) !== 'closed won') continue
          const dealMrr = deal.mrr || 0
          if (dealMrr <= 0) continue
          // Deduplicate
          const key = `${a.name}|${deal.close}|${dealMrr}`
          if (seen.has(key)) continue
          seen.add(key)
          mrr += dealMrr
        }
      }
      data.push({ month: label, mrr: Math.round(mrr) })
    }
    return data
  }, [accts, trendExpanded])

  // Product mix aggregate
  const productMixData = useMemo(() => {
    const mix = {}
    for (const a of accts) {
      for (const p of (a.products || [])) {
        mix[p] = (mix[p] || 0) + 1
      }
    }
    const total = Object.values(mix).reduce((s, v) => s + v, 0)
    return Object.entries(mix)
      .map(([name, count]) => ({ name, value: count, pct: total ? Math.round(count / total * 100) : 0 }))
      .sort((a, b) => b.value - a.value)
  }, [accts])

  // Intel signal count
  const intelCount = useMemo(() => {
    return allTargets.filter(t => t._tags.length > 0).length
  }, [allTargets])

  // Has any outage
  const hasOutage = allTargets.some(t => t.outage_impacted)

  // Navigate to market from target
  const navigateToMarket = useCallback((marketCity) => {
    setView('market')
    setMapMode('list')
    setChartFilter(marketCity)
    setExpandedMarket(marketCity)
  }, [])

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full" style={{ background: CS.bg, color: CS.text, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: CS.border }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] tracking-wider" style={{ color: CS.textMuted }}>RevOS</span>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: CS.purple }} />
            <span className="font-mono text-[11px] tracking-wider font-semibold" style={{ color: CS.purple }}>GTM Premier</span>
          </div>
          <span className="text-sm font-semibold" style={{ color: CS.text }}>Market Intelligence</span>
        </div>

        {/* View toggle pills */}
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: CS.border }}>
          <button
            onClick={() => setView('targets')}
            className="px-4 py-1.5 font-mono text-[11px] font-semibold transition-all duration-150 flex items-center gap-1.5"
            style={{
              background: view === 'targets' ? CS.purple + '25' : 'transparent',
              color: view === 'targets' ? CS.purple : CS.textMuted,
              borderRight: `1px solid ${CS.border}`,
            }}
          >
            <span>◎</span>
            Today's Targets
            {hasOutage && (
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: CS.red }} />
            )}
          </button>
          <button
            onClick={() => setView('market')}
            className="px-4 py-1.5 font-mono text-[11px] font-semibold transition-all duration-150 flex items-center gap-1.5"
            style={{
              background: view === 'market' ? CS.cyan + '25' : 'transparent',
              color: view === 'market' ? CS.cyan : CS.textMuted,
            }}
          >
            <span>◫</span>
            Market Review
          </button>
        </div>
      </div>

      {/* ═══ VIEW CONTENT ═══ */}
      <div className="px-6 py-5">
        {view === 'targets' ? (
          <TargetsView
            targets={allTargets}
            targetCount={targetCount}
            setTargetCount={setTargetCount}
            expandedTarget={expandedTarget}
            setExpandedTarget={setExpandedTarget}
            intelCount={intelCount}
            navigateToMarket={navigateToMarket}
            eventFeed={eventFeed}
          />
        ) : (
          <MarketView
            kpis={kpis}
            markets={markets}
            filteredMarkets={filteredMarkets}
            mapMode={mapMode}
            setMapMode={setMapMode}
            chartExpanded={chartExpanded}
            setChartExpanded={setChartExpanded}
            trendExpanded={trendExpanded}
            setTrendExpanded={setTrendExpanded}
            chartFilter={chartFilter}
            setChartFilter={setChartFilter}
            chartData={chartData}
            bookingsTrend={bookingsTrend}
            productMixData={productMixData}
            verticals={verticals}
            verticalFilter={verticalFilter}
            setVerticalFilter={setVerticalFilter}
            activityFilter={activityFilter}
            setActivityFilter={setActivityFilter}
            outageFilter={outageFilter}
            setOutageFilter={setOutageFilter}
            expandedMarket={expandedMarket}
            setExpandedMarket={setExpandedMarket}
            marketAcctFilter={marketAcctFilter}
            setMarketAcctFilter={setMarketAcctFilter}
            marketAcctSort={marketAcctSort}
            setMarketAcctSort={setMarketAcctSort}
            allTargets={allTargets}
            eventFeed={eventFeed}
          />
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TODAY'S TARGETS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function TargetsView({ targets, targetCount, setTargetCount, expandedTarget, setExpandedTarget, intelCount, navigateToMarket, eventFeed }) {
  const visible = targetCount === 'all' ? targets : targets.slice(0, targetCount)

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-base font-bold" style={{ color: CS.text }}>Priority Accounts</div>
          <div className="font-mono text-[10px]" style={{ color: CS.textFaint }}>
            Ranked: outage → intel → tailwind → whitespace
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="font-mono text-[10px]" style={{ color: CS.textMuted }}>
            Updated 6:00 AM · {intelCount} intel signals
          </div>
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: CS.border }}>
            {[5, 10, 'all'].map(n => (
              <button
                key={n}
                onClick={() => setTargetCount(n)}
                className="px-3 py-1 font-mono text-[10px] font-semibold transition-all"
                style={{
                  background: targetCount === n ? CS.purple + '25' : 'transparent',
                  color: targetCount === n ? CS.purple : CS.textMuted,
                  borderRight: n !== 'all' ? `1px solid ${CS.border}` : 'none',
                }}
              >
                {n === 'all' ? 'All' : `Top ${n}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Target rows */}
      <div className="space-y-1.5">
        {visible.map((t, idx) => (
          <TargetRow
            key={t.name || t.id || idx}
            target={t}
            rank={idx + 1}
            expanded={expandedTarget === idx}
            onToggle={() => setExpandedTarget(expandedTarget === idx ? null : idx)}
            navigateToMarket={navigateToMarket}
            eventFeed={eventFeed}
          />
        ))}
      </div>

      {visible.length === 0 && (
        <div className="text-center py-16 font-mono text-xs" style={{ color: CS.textFaint }}>
          No accounts loaded. Run the Modeling Engine to populate targets.
        </div>
      )}
    </div>
  )
}

// ─── Target Row (Collapsed + Expandable) ─────────────────────────────────────

function TargetRow({ target: t, rank, expanded, onToggle, navigateToMarket, eventFeed }) {
  const gaps = t._gaps || []
  const topGap = gaps[0]
  const gapCount = gaps.length
  const mod = t.avg_event_modifier || 1
  const whitespace = t.total_gap_mrr || 0
  const scoreColor = t._score >= 100 ? CS.red : t._score >= 60 ? CS.purple : CS.cyan
  const nrr = t.nrr || t.net_revenue_retention || 1
  const health = t.health || t.risk_score || 0
  const tmr = t.tmr || t.total_tmr || 0
  const deals = (t.deal_predictions || t.active_deals || []).length
  const daysSilent = t.days_silent || t.days_since_last_activity || 0

  // Recent events for this account's market
  const recentEvents = useMemo(() => {
    return (eventFeed || [])
      .filter(e => e.market === t._market || e.vertical === (t.vertical || t.mega_vertical))
      .slice(0, 3)
  }, [eventFeed, t._market, t.vertical, t.mega_vertical])

  return (
    <div className="rounded-xl border overflow-hidden transition-all" style={{ background: CS.card, borderColor: expanded ? scoreColor + '40' : CS.border }}>
      {/* Collapsed row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer"
        style={{ background: 'transparent' }}
      >
        {/* Rank */}
        <div
          className="w-7 h-7 flex items-center justify-center rounded-lg font-mono text-xs font-bold shrink-0"
          style={{
            background: rank <= 3 ? CS.purple + '25' : CS.surface,
            color: rank <= 3 ? CS.purple : CS.textMuted,
          }}
        >
          {rank}
        </div>

        {/* Account name + market */}
        <div className="min-w-[180px] flex-shrink-0">
          <div className="text-sm font-semibold truncate" style={{ color: CS.text }}>{t.name || t.id}</div>
          <div className="font-mono text-[10px]" style={{ color: CS.textFaint }}>
            {t._market} · {t.vertical || t.mega_vertical || ''}
            {t._onNet && (
              <span className="ml-1.5 font-semibold" style={{ color: CS.green }}>ON-NET</span>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
          {t._tags.map((tag, i) => <TagPill key={i} label={tag.label} color={tag.color} />)}
        </div>

        {/* Top product gap */}
        <div className="flex items-center gap-1 shrink-0">
          {topGap && (
            <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: CS.purple, background: CS.purple + '15', border: `1px solid ${CS.purple}30` }}>
              + {topGap.product}
            </span>
          )}
          {gapCount > 1 && (
            <span className="font-mono text-[9px]" style={{ color: CS.textFaint }}>+{gapCount - 1}</span>
          )}
        </div>

        {/* Whitespace MRR */}
        <InfoTip tip="Whitespace — total addressable spend across all locations minus current billed MRR">
          <div className="text-right shrink-0 min-w-[60px]">
            <div className="font-mono text-sm font-bold" style={{ color: CS.purple }}>{fmt(whitespace)}</div>
            <div className="font-mono text-[9px]" style={{ color: CS.textFaint }}>/mo</div>
          </div>
        </InfoTip>

        {/* Score */}
        <InfoTip tip={`Priority score — higher = more actionable\n${Object.entries(t._breakdown || {}).filter(([,v]) => v > 0).map(([k,v]) => `${k}: +${v}`).join(', ')}`}>
          <div
            className="w-9 h-9 flex items-center justify-center rounded-lg font-mono text-sm font-bold border shrink-0"
            style={{ color: scoreColor, borderColor: scoreColor + '60', background: scoreColor + '10' }}
          >
            {t._score}
          </div>
        </InfoTip>

        {/* Event modifier */}
        <div className="shrink-0">
          <ModBadge value={mod} />
        </div>

        {/* Chevron */}
        <div className="font-mono text-xs shrink-0" style={{ color: CS.textFaint }}>
          {expanded ? '▲' : '▼'}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <ExpandedTargetDetail target={t} tmr={tmr} deals={deals} nrr={nrr} health={health} daysSilent={daysSilent} mod={mod} gaps={gaps} recentEvents={recentEvents} navigateToMarket={navigateToMarket} />
      )}
    </div>
  )
}

// ─── Expanded Target Detail (with Location Intelligence) ─────────────────────

function ExpandedTargetDetail({ target: t, tmr, deals, nrr, health, daysSilent, mod, gaps, recentEvents, navigateToMarket }) {
  const locations = t.locations || []
  const services = t.services || []
  const onNetLocs = locations.filter(l => l.status === 'on-net')
  const nearNetLocs = locations.filter(l => l.status === 'near-net')
  const offNetLocs = locations.filter(l => l.status === 'off-net')

  // Build a map of location → services billing there
  // Match services to locations via locationA/locationZ fields
  const locServiceMap = useMemo(() => {
    const map = {}
    for (const loc of locations) {
      const key = (loc.name || '').toLowerCase()
      map[key] = { loc, services: [], totalMrr: 0 }
    }
    for (const svc of services) {
      const locA = (svc.locationA || '').toLowerCase()
      const locZ = (svc.locationZ || '').toLowerCase()
      // Try to match service to a location
      for (const key of Object.keys(map)) {
        if (key && (locA.includes(key) || key.includes(locA) || locZ.includes(key) || key.includes(locZ) ||
            locA === key || locZ === key)) {
          map[key].services.push(svc)
          map[key].totalMrr += svc.mrr || 0
          break
        }
      }
    }
    return map
  }, [locations, services])

  // Products billed (from services)
  const billedProducts = useMemo(() => {
    const prod = {}
    for (const svc of services) {
      const p = svc.product || 'Unknown'
      if (!prod[p]) prod[p] = { count: 0, mrr: 0 }
      prod[p].count++
      prod[p].mrr += svc.mrr || 0
    }
    return Object.entries(prod).sort(([,a], [,b]) => b.mrr - a.mrr)
  }, [services])

  // Whitespace: products in loc_product_affinity not in current services
  const currentProductSet = new Set(services.map(s => (s.product || '').toLowerCase()))
  const whitespaceProducts = gaps.filter(g => !currentProductSet.has(g.product.toLowerCase()))

  return (
    <div className="px-4 pb-4 pt-2 border-t space-y-3" style={{ background: CS.cardAlt, borderColor: CS.border }}>
      {/* Stats row */}
      <div className="flex gap-4 font-mono text-[10px]">
        <InfoTip tip="Total Monthly Recurring — sum of all active service MRR for this account">
          <span style={{ color: CS.textFaint }}>TMR</span> <span className="font-semibold" style={{ color: CS.cyan }}>{fmt(tmr)}</span>
        </InfoTip>
        <InfoTip tip="Active pipeline deals in Discover through Verbal Agreement stages">
          <span style={{ color: CS.textFaint }}>Deals</span> <span className="font-semibold" style={{ color: CS.text }}>{deals}</span>
        </InfoTip>
        <InfoTip tip="Net Revenue Retention — current MRR vs starting MRR (accounts for churn/downgrades)">
          <span style={{ color: CS.textFaint }}>NRR</span> <span className="font-semibold" style={{ color: nrr >= 1 ? CS.green : CS.red }}>{(nrr * 100).toFixed(0)}%</span>
        </InfoTip>
        <InfoTip tip="Account health score (0-100) — composite of NRR, churn risk, product diversity, pipeline, tenure">
          <span style={{ color: CS.textFaint }}>Health</span> <span className="font-semibold" style={{ color: health >= 70 ? CS.green : health >= 40 ? CS.amber : CS.red }}>{health}</span>
        </InfoTip>
        <InfoTip tip="Days since last deal or engagement activity on this account">
          <span style={{ color: CS.textFaint }}>Silent</span> <span className="font-semibold" style={{ color: daysSilent > 14 ? CS.amber : CS.textMuted }}>{daysSilent}d</span>
        </InfoTip>
        <InfoTip tip="Total building locations for this account across all markets">
          <span style={{ color: CS.textFaint }}>Locations</span> <span className="font-semibold" style={{ color: CS.text }}>{locations.length}</span>
        </InfoTip>
        <InfoTip tip="Locations on Zayo's network — ready for service with no construction needed">
          <span style={{ color: CS.textFaint }}>On-Net</span> <span className="font-semibold" style={{ color: CS.green }}>{onNetLocs.length}</span>
        </InfoTip>
        <InfoTip tip="Active service circuits currently billing on this account">
          <span style={{ color: CS.textFaint }}>Services</span> <span className="font-semibold" style={{ color: CS.cyan }}>{services.length}</span>
        </InfoTip>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* ─── Left: Location List ─── */}
        <div className="col-span-2 space-y-2">
          <div className="font-mono text-[9px] uppercase tracking-wider font-semibold" style={{ color: CS.textFaint }}>
            Locations · Billing · Whitespace
          </div>

          {/* Location table */}
          <div className="rounded-lg overflow-hidden border" style={{ borderColor: CS.border }}>
            {/* Header */}
            <div className="grid gap-2 px-3 py-1.5 font-mono text-[8px] uppercase tracking-wider" style={{ background: CS.surface, color: CS.textFaint, gridTemplateColumns: '2fr 70px 90px 90px 90px' }}>
              <InfoTip tip="Building name and market for each customer location" side="right"><div>Location</div></InfoTip>
              <InfoTip tip="Network proximity: On-Net (on Zayo fiber), Near-Net (close to network), Off-Net (requires construction)" side="right"><div>Status</div></InfoTip>
              <InfoTip tip="Total estimated spend this building could support based on size, type, and market — from location intelligence data" side="right"><div className="text-right">Addressable</div></InfoTip>
              <InfoTip tip="MRR currently being billed at this location from active services" side="right"><div className="text-right">Current MRR</div></InfoTip>
              <InfoTip tip="Whitespace gap = Addressable Spend minus Current MRR — the untapped revenue opportunity at this location" side="left"><div className="text-right">Gap</div></InfoTip>
            </div>

            {/* Location rows — on-net first, then near-net, then off-net */}
            {[
              ...onNetLocs.map((loc, i) => ({ loc, key: `on-${i}`, statusLabel: 'On-Net', statusColor: CS.green, dim: false })),
              ...nearNetLocs.map((loc, i) => ({ loc, key: `near-${i}`, statusLabel: 'Near-Net', statusColor: CS.amber, dim: false })),
              ...offNetLocs.slice(0, 5).map((loc, i) => ({ loc, key: `off-${i}`, statusLabel: 'Off-Net', statusColor: CS.textFaint, dim: true })),
            ].map(({ loc, key, statusLabel, statusColor, dim }) => {
              const svcKey = (loc.name || '').toLowerCase()
              const entry = locServiceMap[svcKey] || { services: [], totalMrr: 0 }
              const currentMrr = entry.totalMrr || loc.mrr || 0
              const addressable = loc.addressable_spend || 0
              const gap = Math.max(0, addressable - currentMrr)
              return (
                <div key={key} className="grid gap-2 px-3 py-2 border-t items-center" style={{ borderColor: CS.border, gridTemplateColumns: '2fr 70px 90px 90px 90px', opacity: dim ? 0.5 : 1 }}>
                  <div>
                    <div className="text-[11px] font-semibold truncate" style={{ color: CS.text }}>{loc.name}</div>
                    {loc.market && <div className="font-mono text-[9px]" style={{ color: CS.textFaint }}>{loc.market}</div>}
                  </div>
                  <div>
                    <span className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ color: statusColor, background: statusColor + '15' }}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="text-right font-mono text-[10px]" style={{ color: addressable > 0 ? CS.textMuted : CS.textFaint }}>
                    {addressable > 0 ? fmt(addressable) : '—'}
                  </div>
                  <div className="text-right font-mono text-[10px] font-semibold" style={{ color: currentMrr > 0 ? CS.cyan : CS.textFaint }}>
                    {currentMrr > 0 ? fmt(currentMrr) : '—'}
                  </div>
                  <div className="text-right font-mono text-[10px] font-semibold" style={{ color: gap > 0 ? CS.purple : CS.textFaint }}>
                    {gap > 0 ? fmt(gap) : '—'}
                  </div>
                </div>
              )
            })}
            {offNetLocs.length > 5 && (
              <div className="px-3 py-1.5 border-t font-mono text-[9px]" style={{ borderColor: CS.border, color: CS.textFaint }}>
                +{offNetLocs.length - 5} more off-net locations
              </div>
            )}

            {locations.length === 0 && (
              <div className="px-3 py-4 text-center font-mono text-[10px]" style={{ color: CS.textFaint }}>
                No location data available
              </div>
            )}
          </div>

          {/* Active billing summary */}
          {billedProducts.length > 0 && (
            <div>
              <div className="font-mono text-[9px] uppercase tracking-wider mb-1" style={{ color: CS.textFaint }}>Active Billing Summary</div>
              <div className="flex flex-wrap gap-1.5">
                {billedProducts.map(([prod, data]) => (
                  <div key={prod} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: CS.surface }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRODUCT_COLORS[prod] || CS.cyan }} />
                    <span className="font-mono text-[10px]" style={{ color: CS.text }}>{prod}</span>
                    <span className="font-mono text-[10px] font-semibold" style={{ color: CS.cyan }}>{fmt(data.mrr)}</span>
                    <span className="font-mono text-[9px]" style={{ color: CS.textFaint }}>×{data.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── Right: Strategy + Context ─── */}
        <div className="space-y-3">
          {/* Whitespace summary */}
          {whitespaceProducts.length > 0 && (
            <div className="rounded-lg p-3" style={{ background: CS.purple + '08', border: `1px solid ${CS.purple}20` }}>
              <div className="font-mono text-[9px] uppercase tracking-wider mb-1.5 font-semibold" style={{ color: CS.purple }}>Whitespace Opportunity</div>
              <div className="space-y-1">
                {whitespaceProducts.map(g => (
                  <div key={g.product} className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-semibold" style={{ color: CS.purple }}>+ {g.product}</span>
                    <span className="font-mono text-[9px]" style={{ color: CS.textMuted }}>affinity {(g.score * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversation Strategy */}
          <div className="rounded-lg p-3 border-l-[3px]" style={{ background: CS.purple + '08', borderColor: CS.purple }}>
            <div className="font-mono text-[9px] uppercase tracking-wider mb-1 font-semibold" style={{ color: CS.purple }}>Conversation Strategy</div>
            <div className="text-[12px] leading-relaxed" style={{ color: CS.textMuted }}>
              {t._talkTrack}
            </div>
          </div>

          {/* Overnight Intel */}
          {t.latest_intel && (
            <div className="rounded-lg p-3 border-l-[3px]" style={{ background: CS.blue + '08', borderColor: CS.blue }}>
              <div className="font-mono text-[9px] uppercase tracking-wider mb-1 font-semibold" style={{ color: CS.blue }}>Overnight Intel</div>
              <div className="text-[12px] leading-relaxed" style={{ color: CS.textMuted }}>
                {t.latest_intel}
              </div>
            </div>
          )}

          {/* Market Context */}
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider mb-1" style={{ color: CS.textFaint }}>Market Context</div>
            <div className="text-[12px] mb-1" style={{ color: CS.text }}>{t._market}</div>
            <div className="text-[11px]" style={{ color: mod > 1.05 ? CS.green : mod < 0.98 ? CS.amber : CS.textFaint }}>
              {t.event_context_summary || (mod > 1.05 ? 'Favorable market conditions' : mod < 0.98 ? 'Headwind market conditions' : 'Neutral market context')}
            </div>
          </div>

          {/* Recent events */}
          {recentEvents.length > 0 && (
            <div>
              <div className="font-mono text-[9px] uppercase tracking-wider mb-1" style={{ color: CS.textFaint }}>Recent Events</div>
              <div className="space-y-1">
                {recentEvents.map((e, i) => {
                  const cat = EVENT_CAT_COLORS[e.category] || EVENT_CAT_COLORS.Macro
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ color: cat.text, background: cat.bg }}>{e.category}</span>
                      <span className="font-mono text-[9px]" style={{ color: CS.textFaint }}>{e.date}</span>
                      <span className="text-[11px] truncate" style={{ color: CS.textMuted }}>{e.headline || e.description}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Customer Location Map */}
          {locations.length > 0 && (
            <div>
              <div className="font-mono text-[9px] uppercase tracking-wider mb-1" style={{ color: CS.textFaint }}>Location Footprint</div>
              <CustomerLocationMap locations={locations} />
            </div>
          )}

          {/* View market button */}
          <button
            onClick={() => navigateToMarket(t._market)}
            className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{ color: CS.cyan, background: CS.surface, border: `1px solid ${CS.border}` }}
          >
            View full {t._market} market →
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET REVIEW VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function MarketView({
  kpis, markets, filteredMarkets, mapMode, setMapMode,
  chartExpanded, setChartExpanded, trendExpanded, setTrendExpanded,
  chartFilter, setChartFilter, chartData, bookingsTrend, productMixData,
  verticals, verticalFilter, setVerticalFilter,
  activityFilter, setActivityFilter, outageFilter, setOutageFilter,
  expandedMarket, setExpandedMarket,
  marketAcctFilter, setMarketAcctFilter, marketAcctSort, setMarketAcctSort,
  allTargets, eventFeed,
}) {
  const onNetPct = kpis.totalAccounts ? Math.round(kpis.onNet / kpis.totalAccounts * 100) : 0

  return (
    <div className="space-y-5">
      {/* ─── KPI Row ─── */}
      <div className="grid grid-cols-5 gap-3">
        <KPICard label="CLOSED 12M" value={fmt(kpis.closed12m)} accent={CS.cyan} />
        <KPICard label="PIPELINE WTD" value={fmt(kpis.pipeline)} accent={CS.purple} />
        <KPICard label="WHITESPACE" value={fmt(kpis.whitespace)} accent={CS.purple} />
        <KPICard label="ON-NET" value={`${kpis.onNet}`} accent={CS.green} trend={`${onNetPct}% coverage`} trendColor={CS.green} />
        <KPICard label="OUTAGE ALERTS" value={`${kpis.outages}`} accent={kpis.outages > 0 ? CS.red : CS.textFaint} />
      </div>

      {/* ─── Map/List toggle ─── */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: CS.border }}>
          <button
            onClick={() => setMapMode('map')}
            className="px-3 py-1 font-mono text-[10px] font-semibold transition-all"
            style={{ background: mapMode === 'map' ? CS.cyan + '25' : 'transparent', color: mapMode === 'map' ? CS.cyan : CS.textMuted }}
          >
            ◉ Map View
          </button>
          <button
            onClick={() => setMapMode('list')}
            className="px-3 py-1 font-mono text-[10px] font-semibold transition-all"
            style={{ background: mapMode === 'list' ? CS.cyan + '25' : 'transparent', color: mapMode === 'list' ? CS.cyan : CS.textMuted }}
          >
            ☰ List View
          </button>
        </div>
      </div>

      {mapMode === 'map' ? (
        <MapView
          markets={markets.slice(0, 5)}
          onMarketClick={(city) => {
            setMapMode('list')
            setChartFilter(city)
            setExpandedMarket(city)
          }}
        />
      ) : (
        <>
          {/* ─── Charts grid ─── */}
          <div className="grid gap-4" style={{ gridTemplateColumns: chartExpanded ? '1fr' : '2fr 1fr' }}>
            {/* Revenue by Market */}
            <div className="rounded-xl p-4 border" style={{ background: CS.card, borderColor: CS.border }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold" style={{ color: CS.text }}>Revenue by Market</div>
                  <div className="font-mono text-[10px]" style={{ color: CS.textFaint }}>
                    {chartExpanded ? `All ${markets.length}` : 'Top 5'} — closed vs pipeline
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 font-mono text-[9px]">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: CS.cyan }} /> Closed 12m</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: CS.purple }} /> Pipeline</span>
                  </div>
                  <button
                    onClick={() => setChartExpanded(!chartExpanded)}
                    className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded"
                    style={{ color: CS.cyan, background: CS.surface }}
                  >
                    {chartExpanded ? '▲ Top 5' : `All ${markets.length} →`}
                  </button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={chartExpanded ? 300 : 240}>
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CS.border} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: CS.textFaint, fontSize: 10, fontFamily: FONT_MONO }}
                    angle={chartExpanded ? -35 : 0}
                    textAnchor={chartExpanded ? 'end' : 'middle'}
                    height={chartExpanded ? 60 : 30}
                  />
                  <YAxis tick={{ fill: CS.textFaint, fontSize: 10, fontFamily: FONT_MONO }} tickFormatter={v => fmtK(v)} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                    contentStyle={{ background: CS.bg, border: `1px solid ${CS.border}`, borderRadius: 8, fontSize: 11, fontFamily: FONT_MONO, color: CS.text }}
                    formatter={(v) => [`$${v.toLocaleString()}`, '']}
                  />
                  <Bar dataKey="closed" fill={CS.cyan} radius={[4, 4, 0, 0]} barSize={chartExpanded ? 16 : 28}
                    onClick={(data) => {
                      setChartFilter(chartFilter === data.name ? null : data.name)
                      if (chartFilter !== data.name) setExpandedMarket(data.name)
                    }}
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} opacity={chartFilter && chartFilter !== entry.name ? 0.2 : 1} cursor="pointer" />
                    ))}
                  </Bar>
                  <Bar dataKey="pipeline" fill={CS.purple} radius={[4, 4, 0, 0]} barSize={chartExpanded ? 16 : 28}
                    onClick={(data) => {
                      setChartFilter(chartFilter === data.name ? null : data.name)
                      if (chartFilter !== data.name) setExpandedMarket(data.name)
                    }}
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} opacity={chartFilter && chartFilter !== entry.name ? 0.2 : 1} cursor="pointer" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Right column: Bookings Trend + Product Mix */}
            {!chartExpanded && (
              <div className="flex flex-col gap-4">
                {/* Bookings Trend */}
                <div className="flex-1 rounded-xl p-4 border" style={{ background: CS.card, borderColor: CS.border }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: CS.text }}>Bookings Trend</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ color: CS.green, background: CS.green + '20' }}>
                        {bookingsTrend.length >= 2 && bookingsTrend[bookingsTrend.length - 1].mrr > 0
                          ? `+${Math.round((bookingsTrend[bookingsTrend.length - 1].mrr / Math.max(bookingsTrend[0].mrr, 1) - 1) * 100)}%`
                          : '—'}
                      </span>
                    </div>
                    <button
                      onClick={() => setTrendExpanded(!trendExpanded)}
                      className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded"
                      style={{ color: CS.cyan, background: CS.surface }}
                    >
                      {trendExpanded ? '▲ Collapse' : '12m →'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={100}>
                    <AreaChart data={bookingsTrend}>
                      <defs>
                        <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CS.green} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CS.green} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fill: CS.textFaint, fontSize: 9, fontFamily: FONT_MONO }} />
                      <Area type="monotone" dataKey="mrr" stroke={CS.green} fill="url(#greenGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Product Mix */}
                <div className="flex-1 rounded-xl p-4 border" style={{ background: CS.card, borderColor: CS.border }}>
                  <div className="text-sm font-semibold mb-2" style={{ color: CS.text }}>Product Mix</div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-24">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={productMixData}
                            innerRadius={25}
                            outerRadius={40}
                            dataKey="value"
                            stroke="none"
                          >
                            {productMixData.map((entry, i) => (
                              <Cell key={i} fill={PRODUCT_COLORS[entry.name] || CS.textFaint} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-1">
                      {productMixData.slice(0, 6).map(p => (
                        <div key={p.name} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: PRODUCT_COLORS[p.name] || CS.textFaint }} />
                          <span className="text-[11px] flex-1 truncate" style={{ color: CS.textMuted }}>{p.name}</span>
                          <span className="font-mono text-[10px] font-semibold" style={{ color: CS.text }}>{p.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Trend expanded below charts */}
          {trendExpanded && (
            <div className="rounded-xl p-4 border" style={{ background: CS.card, borderColor: CS.border }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-semibold" style={{ color: CS.text }}>Bookings Trend — 12 Months</span>
                  {bookingsTrend.length >= 2 && (
                    <span className="font-mono text-[11px] ml-3" style={{ color: CS.textMuted }}>
                      {fmt(bookingsTrend[0].mrr)} → {fmt(bookingsTrend[bookingsTrend.length - 1].mrr)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setTrendExpanded(false)}
                  className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded"
                  style={{ color: CS.cyan, background: CS.surface }}
                >
                  ▲ Collapse
                </button>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={bookingsTrend}>
                  <defs>
                    <linearGradient id="greenGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CS.green} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CS.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CS.border} />
                  <XAxis dataKey="month" tick={{ fill: CS.textFaint, fontSize: 10, fontFamily: FONT_MONO }} />
                  <YAxis tick={{ fill: CS.textFaint, fontSize: 10, fontFamily: FONT_MONO }} tickFormatter={v => fmtK(v)} />
                  <Tooltip contentStyle={{ background: CS.card, border: `1px solid ${CS.border}`, borderRadius: 8, fontSize: 11, fontFamily: FONT_MONO, color: CS.text }} />
                  <Area type="monotone" dataKey="mrr" stroke={CS.green} fill="url(#greenGrad2)" strokeWidth={2} dot={{ fill: CS.green, r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ─── Filter bar ─── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Chart filter badge */}
            {chartFilter && (
              <span
                className="flex items-center gap-1 font-mono text-[10px] font-semibold px-2.5 py-1 rounded-full cursor-pointer"
                style={{ color: CS.cyan, border: `1px solid ${CS.cyan}`, background: CS.cyan + '10' }}
              >
                ◎ {chartFilter}
                <span onClick={() => { setChartFilter(null); setExpandedMarket(null) }} style={{ marginLeft: 4 }}>✕</span>
              </span>
            )}

            <span className="font-mono text-[9px]" style={{ color: CS.textFaint }}>|</span>

            {/* Vertical filters */}
            {verticals.slice(0, 6).map(v => (
              <button
                key={v}
                onClick={() => setVerticalFilter(verticalFilter === v ? 'All' : v)}
                className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all"
                style={{
                  background: verticalFilter === v ? CS.purple + '25' : 'transparent',
                  color: verticalFilter === v ? CS.purple : CS.textMuted,
                  border: `1px solid ${verticalFilter === v ? CS.purple + '50' : CS.border}`,
                }}
              >
                {v}
              </button>
            ))}

            <span className="font-mono text-[9px]" style={{ color: CS.textFaint }}>|</span>

            {/* Activity filters */}
            {['All', 'High Volume', 'Tailwind', 'Headwind'].map(f => (
              <button
                key={f}
                onClick={() => setActivityFilter(activityFilter === f ? 'All' : f)}
                className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all"
                style={{
                  background: activityFilter === f ? CS.cyan + '25' : 'transparent',
                  color: activityFilter === f ? CS.cyan : CS.textMuted,
                  border: `1px solid ${activityFilter === f ? CS.cyan + '50' : CS.border}`,
                }}
              >
                {f}
              </button>
            ))}

            <span className="font-mono text-[9px]" style={{ color: CS.textFaint }}>|</span>

            {/* Outage toggle */}
            <button
              onClick={() => setOutageFilter(!outageFilter)}
              className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all flex items-center gap-1"
              style={{
                background: outageFilter ? CS.red + '25' : 'transparent',
                color: outageFilter ? CS.red : CS.textMuted,
                border: `1px solid ${outageFilter ? CS.red + '50' : CS.border}`,
              }}
            >
              {outageFilter && <span>⚡</span>}
              Outage Impact
            </button>
          </div>

          {/* ─── Market Cards ─── */}
          <div className="space-y-2">
            {filteredMarkets.map(m => (
              <MarketCard
                key={m.city}
                market={m}
                expanded={expandedMarket === m.city}
                onToggle={() => setExpandedMarket(expandedMarket === m.city ? null : m.city)}
                allTargets={allTargets}
                marketAcctFilter={marketAcctFilter}
                setMarketAcctFilter={setMarketAcctFilter}
                marketAcctSort={marketAcctSort}
                setMarketAcctSort={setMarketAcctSort}
                eventFeed={eventFeed}
              />
            ))}
            {filteredMarkets.length === 0 && (
              <div className="text-center py-10 font-mono text-xs" style={{ color: CS.textFaint }}>
                No markets match the current filters.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Leaflet Clustered Map View ──────────────────────────────────────────────

function makeMarketIcon(m, maxDeals) {
  const size = Math.max(28, Math.min(52, 20 + (m.closedDeals / maxDeals) * 32))
  const color = m.hasOutage ? CS.red : m.avgModifier > 1.05 ? CS.green : CS.cyan
  const mrrLabel = m.closedMRR >= 1000 ? `$${Math.round(m.closedMRR / 1000)}K` : `$${Math.round(m.closedMRR)}`

  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      background:radial-gradient(circle, ${color}35 0%, ${color}10 60%, transparent 100%);
      border:2px solid ${color}80;border-radius:50%;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      color:${CS.text};font-family:${FONT_MONO};cursor:pointer;
    ">
      <span style="font-size:${size > 36 ? 13 : 10}px;font-weight:700;line-height:1">${m.closedDeals}</span>
      <span style="font-size:7px;color:${CS.textFaint};line-height:1;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:${size + 10}px;text-align:center">${m.city}</span>
    </div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function MapView({ markets, onMarketClick }) {
  const maxDeals = Math.max(...markets.map(m => m.closedDeals || 1), 1)
  const validMarkets = markets.filter(m => m.lat && m.lng)

  // Lookup for cluster aggregation — keyed by "lat,lng"
  const marketLookup = useMemo(() => {
    const lookup = {}
    for (const m of validMarkets) {
      lookup[`${m.lat},${m.lng}`] = m
    }
    return lookup
  }, [validMarkets])

  const clusterIcon = useCallback((cluster) => {
    const childLatLngs = cluster.getAllChildMarkers().map(mk => mk.getLatLng())
    let totalDeals = 0, totalMRR = 0, hasOutage = false
    for (const ll of childLatLngs) {
      const m = marketLookup[`${ll.lat},${ll.lng}`]
      if (m) {
        totalDeals += m.closedDeals || 0
        totalMRR += m.closedMRR || 0
        if (m.hasOutage) hasOutage = true
      }
    }
    const count = childLatLngs.length
    const size = Math.min(70, Math.max(40, 30 + count * 2))
    const color = hasOutage ? CS.red : CS.cyan
    const mrrLabel = totalMRR >= 1000 ? `$${Math.round(totalMRR / 1000)}K` : `$${Math.round(totalMRR)}`

    return L.divIcon({
      html: `<div style="
        width:${size}px;height:${size}px;
        background:radial-gradient(circle, ${color}30 0%, ${color}08 70%, transparent 100%);
        border:2px solid ${color}50;border-radius:50%;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        color:${CS.text};font-family:${FONT_MONO};cursor:pointer;
      ">
        <span style="font-size:14px;font-weight:700;line-height:1">${totalDeals}</span>
        <span style="font-size:8px;color:${CS.textFaint};line-height:1;margin-top:2px">${count} mkts</span>
        <span style="font-size:8px;color:${color};line-height:1;margin-top:1px">${mrrLabel}</span>
      </div>`,
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    })
  }, [marketLookup])

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: CS.card, borderColor: CS.border }}>
      <MapContainer
        center={[39.5, -98.35]}
        zoom={4}
        style={{ height: 520, width: '100%', background: CS.bg }}
        zoomControl={true}
        attributionControl={false}
        maxZoom={18}
        minZoom={3}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={80}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          iconCreateFunction={clusterIcon}
          animate={true}
        >
          {validMarkets.map(m => (
            <Marker
              key={m.city}
              position={[m.lat, m.lng]}
              icon={makeMarketIcon(m, maxDeals)}
              eventHandlers={{
                click: () => onMarketClick(m.city),
              }}
            >
              <Popup>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: '#111', minWidth: 140 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{m.city}</div>
                  <div>{m.closedDeals} deals · {fmt(m.closedMRR)}</div>
                  <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>{m.totalAccounts} accounts · {m.onNetAccounts || 0} on-net</div>
                  {m.hasOutage && <div style={{ color: '#ef4444', marginTop: 2 }}>⚠ Active outage</div>}
                  <div style={{ color: '#666', fontSize: 9, marginTop: 4 }}>Click to drill in</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t" style={{ borderColor: CS.border }}>
        {Object.entries(PRODUCT_COLORS).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
            <span className="font-mono text-[9px]" style={{ color: CS.textFaint }}>{name}</span>
          </div>
        ))}
        <span className="font-mono text-[9px] ml-auto" style={{ color: CS.textFaint }}>
          Zoom in to see individual markets · Click a market to drill in
        </span>
      </div>
    </div>
  )
}

// ─── Expandable Market Card ──────────────────────────────────────────────────

function MarketCard({ market: m, expanded, onToggle, allTargets, marketAcctFilter, setMarketAcctFilter, marketAcctSort, setMarketAcctSort, eventFeed }) {
  const mod = m.avgModifier || 1
  const dealBg = m.hasOutage ? CS.red : mod > 1.05 ? CS.green : mod < 1.0 ? CS.amber : CS.surface
  const onNetPct = m.totalAccounts ? Math.round(m.onNetAccounts / m.totalAccounts * 100) : 0

  // Accounts in this market from allTargets (already scored)
  const marketAccounts = useMemo(() => {
    let accts = allTargets.filter(a => a._market === m.city)

    if (marketAcctFilter === 'On-Net') accts = accts.filter(a => a._onNet)
    else if (marketAcctFilter === 'New Logo') accts = accts.filter(a => (a.tmr || a.total_tmr || 0) === 0)
    else if (marketAcctFilter === 'At Risk') accts = accts.filter(a => (a.health || a.risk_score || 100) < 40)
    else if (marketAcctFilter === 'Outage') accts = accts.filter(a => a.outage_impacted)

    if (marketAcctSort === 'gap') accts.sort((a, b) => (b.total_gap_mrr || 0) - (a.total_gap_mrr || 0))
    else if (marketAcctSort === 'tmr') accts.sort((a, b) => (b.tmr || b.total_tmr || 0) - (a.tmr || a.total_tmr || 0))
    else if (marketAcctSort === 'deals') accts.sort((a, b) => (b.deal_predictions || b.active_deals || []).length - (a.deal_predictions || a.active_deals || []).length)
    else if (marketAcctSort === 'context') accts.sort((a, b) => (b.avg_event_modifier || 1) - (a.avg_event_modifier || 1))

    return accts
  }, [allTargets, m.city, marketAcctFilter, marketAcctSort])

  // Recent events for this market
  const recentEvents = useMemo(() => {
    return (eventFeed || [])
      .filter(e => e.market === m.city)
      .slice(0, 4)
  }, [eventFeed, m.city])

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: CS.card, borderColor: expanded ? CS.cyan + '30' : CS.border }}>
      {/* Collapsed header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer"
        style={{ background: 'transparent' }}
      >
        {/* Deal count box */}
        <div
          className="w-12 h-12 flex flex-col items-center justify-center rounded-lg shrink-0"
          style={{ background: dealBg + '20', color: dealBg }}
        >
          <div className="font-mono text-lg font-bold leading-none">{m.closedDeals}</div>
          <div className="font-mono text-[8px]">deals</div>
        </div>

        {/* City/State */}
        <div className="min-w-[140px]">
          <div className="text-sm font-bold" style={{ color: CS.text }}>{m.city}{m.state ? `, ${m.state}` : ''}</div>
          {m.hasOutage && (
            <span className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ color: CS.red, background: CS.red + '20' }}>
              ⚠ OUTAGE
            </span>
          )}
        </div>

        {/* Modifier badge */}
        <div className="shrink-0">
          <ModBadge value={mod} />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-1 font-mono text-[10px]">
          <div><span style={{ color: CS.textFaint }}>Closed</span> <span className="font-semibold" style={{ color: CS.cyan }}>{fmt(m.closedMRR)}</span></div>
          <div><span style={{ color: CS.textFaint }}>Pipeline</span> <span className="font-semibold" style={{ color: CS.purple }}>{fmt(m.pipelineWeighted)}</span></div>
          <div><span style={{ color: CS.textFaint }}>On-net</span> <span className="font-semibold" style={{ color: CS.green }}>{onNetPct}%</span></div>
          <div><span style={{ color: CS.textFaint }}>Accounts</span> <span className="font-semibold" style={{ color: CS.text }}>{m.totalAccounts}</span></div>
        </div>

        {/* Chevron */}
        <div className="font-mono text-xs shrink-0" style={{ color: CS.textFaint }}>
          {expanded ? '▲' : '▼'}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t space-y-4" style={{ background: CS.cardAlt, borderColor: CS.border }}>
          {/* Outage alert */}
          {m.hasOutage && (
            <div className="rounded-lg p-3 border-l-[3px]" style={{ background: CS.red + '10', borderColor: CS.red }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: CS.red }}>⚠</span>
                <span className="font-mono text-[10px] font-semibold" style={{ color: CS.red }}>Active Outage Impact</span>
              </div>
              <div className="text-[11px]" style={{ color: CS.textMuted }}>
                Outage detected in {m.city} market. {m.accounts.filter(a => a.outage_impacted).length} account(s) impacted — prioritize reliability-focused outreach.
              </div>
            </div>
          )}

          {/* 3-column intel grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Top Verticals */}
            <div className="rounded-lg p-3" style={{ background: CS.surface }}>
              <div className="font-mono text-[9px] uppercase tracking-wider mb-2" style={{ color: CS.textFaint }}>Top Verticals</div>
              <div className="space-y-1.5">
                {m.topVerticals.slice(0, 4).map(v => (
                  <div key={v.name} className="flex items-center justify-between">
                    <span className="text-[11px] truncate" style={{ color: CS.textMuted }}>{v.name}</span>
                    <span className="font-mono text-[10px] font-semibold" style={{ color: CS.cyan }}>{v.deals}d · {fmt(v.mrr)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Product Mix */}
            <div className="rounded-lg p-3" style={{ background: CS.surface }}>
              <div className="font-mono text-[9px] uppercase tracking-wider mb-2" style={{ color: CS.textFaint }}>Product Mix</div>
              <div className="space-y-1.5">
                {m.products.slice(0, 5).map(p => (
                  <div key={p.name}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px]" style={{ color: CS.textMuted }}>{p.name}</span>
                      <span className="font-mono text-[10px] font-semibold" style={{ color: CS.text }}>{Math.round(p.pct)}%</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: CS.border }}>
                      <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: `linear-gradient(90deg, ${PRODUCT_COLORS[p.name] || CS.cyan}80, ${PRODUCT_COLORS[p.name] || CS.cyan})` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Market Intel */}
            <div className="rounded-lg p-3" style={{ background: CS.surface }}>
              <div className="font-mono text-[9px] uppercase tracking-wider mb-2" style={{ color: CS.textFaint }}>Market Intel</div>
              {recentEvents.length > 0 ? (
                <div className="space-y-1.5">
                  {recentEvents.map((e, i) => {
                    const cat = EVENT_CAT_COLORS[e.category] || EVENT_CAT_COLORS.Macro
                    return (
                      <div key={i}>
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="font-mono text-[8px] px-1 py-0.5 rounded" style={{ color: cat.text, background: cat.bg }}>{e.category}</span>
                          <span className="font-mono text-[8px]" style={{ color: CS.textFaint }}>{e.date}</span>
                        </div>
                        <div className="text-[10px] leading-snug truncate" style={{ color: CS.textMuted }}>{e.headline || e.description}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="font-mono text-[10px]" style={{ color: CS.textFaint }}>No recent events</div>
              )}
            </div>
          </div>

          {/* Account filter + sort bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-semibold" style={{ color: CS.text }}>Accounts ({marketAccounts.length})</span>
              {['All', 'On-Net', 'New Logo', 'At Risk', 'Outage'].map(f => {
                if (f === 'Outage' && !m.hasOutage) return null
                if (f === 'At Risk' && !m.accounts.some(a => (a.health || a.risk_score || 100) < 40)) return null
                return (
                  <button
                    key={f}
                    onClick={() => setMarketAcctFilter(f)}
                    className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded transition-all"
                    style={{
                      background: marketAcctFilter === f ? CS.cyan + '20' : 'transparent',
                      color: marketAcctFilter === f ? CS.cyan : CS.textFaint,
                    }}
                  >
                    {f}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9px]" style={{ color: CS.textFaint }}>Sort</span>
              {[['gap', 'Gap $'], ['tmr', 'TMR'], ['deals', 'Deals'], ['context', 'Context']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setMarketAcctSort(id)}
                  className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded transition-all"
                  style={{
                    background: marketAcctSort === id ? CS.purple + '20' : 'transparent',
                    color: marketAcctSort === id ? CS.purple : CS.textFaint,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Account cards */}
          <div className="space-y-1.5">
            {marketAccounts.slice(0, 15).map((a, i) => (
              <AccountCard key={a.name || i} account={a} />
            ))}
            {marketAccounts.length > 15 && (
              <div className="font-mono text-[10px] text-center py-2" style={{ color: CS.textFaint }}>
                +{marketAccounts.length - 15} more accounts
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Account Card (inside market) ────────────────────────────────────────────

function AccountCard({ account: a }) {
  const tmr = a.tmr || a.total_tmr || 0
  const nrr = a.nrr || a.net_revenue_retention || 1
  const health = a.health || a.risk_score || 0
  const mod = a.avg_event_modifier || 1
  const deals = (a.deal_predictions || a.active_deals || []).length
  const gaps = a._gaps || []
  const whitespace = a.total_gap_mrr || 0

  return (
    <div className="rounded-lg p-3 border" style={{ background: CS.card, borderColor: CS.border }}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold" style={{ color: CS.text }}>{a.name || a.id}</span>
            {(a.vertical || a.mega_vertical) && (
              <span className="font-mono text-[8px] px-1 py-0.5 rounded" style={{ background: CS.surface, color: CS.textFaint }}>
                {a.vertical || a.mega_vertical}
              </span>
            )}
            <span className="font-mono text-[8px] px-1 py-0.5 rounded font-semibold" style={{
              color: a._onNet ? CS.green : CS.amber,
              background: a._onNet ? CS.green + '15' : CS.amber + '15',
            }}>
              {a._onNet ? 'On-Net' : 'Off-Net'}
            </span>
            {a.outage_impacted && (
              <span className="font-mono text-[8px] px-1 py-0.5 rounded font-semibold" style={{ color: CS.red, background: CS.red + '15' }}>
                ⚠ Outage
              </span>
            )}
          </div>
          {/* Stats row */}
          <div className="flex gap-3 mt-1 font-mono text-[9px]">
            <span><span style={{ color: CS.textFaint }}>TMR</span> <span className="font-semibold" style={{ color: CS.cyan }}>{fmt(tmr)}</span></span>
            <span><span style={{ color: CS.textFaint }}>Deals</span> <span className="font-semibold">{deals}</span></span>
            <span><span style={{ color: CS.textFaint }}>NRR</span> <span className="font-semibold" style={{ color: nrr >= 1 ? CS.green : CS.red }}>{(nrr * 100).toFixed(0)}%</span></span>
            <span><span style={{ color: CS.textFaint }}>Health</span> <span className="font-semibold" style={{ color: health >= 70 ? CS.green : health >= 40 ? CS.amber : CS.red }}>{health}</span></span>
            <ModBadge value={mod} />
          </div>
        </div>

        {/* Whitespace */}
        <div className="text-right shrink-0">
          <div className="font-mono text-base font-bold" style={{ color: CS.purple }}>{fmt(whitespace)}</div>
          <div className="font-mono text-[8px]" style={{ color: CS.textFaint }}>whitespace/mo</div>
        </div>
      </div>

      {/* Product pills */}
      <div className="flex flex-wrap gap-1 mb-2">
        {(a.products || []).map(p => (
          <span key={p} className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: CS.surface, color: CS.textMuted }}>
            {p}
          </span>
        ))}
        {gaps.slice(0, 3).map(g => (
          <span key={g.product} className="font-mono text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: CS.purple + '15', color: CS.purple }}>
            + {g.product}
          </span>
        ))}
      </div>

      {/* Talk track */}
      {a._talkTrack && (
        <div className="rounded p-2 border-l-[3px]" style={{ background: CS.purple + '06', borderColor: CS.purple }}>
          <div className="text-[11px] leading-relaxed" style={{ color: CS.textMuted }}>
            {a._talkTrack}
          </div>
        </div>
      )}
    </div>
  )
}
