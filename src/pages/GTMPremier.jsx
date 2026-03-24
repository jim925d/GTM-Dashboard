/**
 * GTM Premier — Target Account Intelligence
 *
 * Two views:
 *   1. Today's Targets — morning briefing with scored, ranked accounts
 *   2. Market Review — market-level KPIs, map, charts, expandable market cards
 *
 * All data from ModelingContext snapshot hooks — zero direct computation.
 */

import { useState, useMemo, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { T, FONT_MONO, FONT_SANS } from '../lib/constants'
import { chartTheme, $k } from '../components/shared/ChartTheme'
import {
  useAllEnrichedAccounts,
  useAccountLocations,
  useLocationProductAffinity,
  useEngineStatus,
  useEventFeed,
} from '../lib/ModelingContext'

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

// ─── Main Component ──────────────────────────────────────────────────────────
export default function GTMPremier({ accounts = [] }) {
  const enrichedAccounts = useAllEnrichedAccounts()
  const { isLoading, isStale, lastRunAge } = useEngineStatus()
  const eventFeed = useEventFeed(90)

  // Use enriched accounts if available, fall back to raw accounts
  const accts = enrichedAccounts.length > 0 ? enrichedAccounts : accounts

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

    for (const acct of accts) {
      // Determine market city from locations or use a fallback
      const locs = acct.locations || []
      let city = 'Unknown'
      let state = ''
      let lat = null
      let lng = null

      if (locs.length > 0) {
        // Use the first location's market or derive from address
        const loc = locs[0]
        city = loc.market || loc.city || loc.name || 'Unknown'
        lat = loc.lat
        lng = loc.lng
        state = loc.state || ''
      }

      // Extract key from market/city
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
      const deals = acct.deal_predictions || acct.active_deals || []
      const closedDeals = acct.funnel_closed || []

      for (const d of closedDeals) {
        if ((d.stage || '').toLowerCase().includes('won') || (d.type || '').toLowerCase() === 'won') {
          m.closedDeals++
          m.closedMRR += d.mrr || 0
        }
      }

      for (const d of deals) {
        const prob = d.adjusted_probability || d.stage_probability || 0.3
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
      // Compute whitespace/gaps
      const currentProducts = new Set((acct.products || []).map(p => p.toLowerCase()))
      const affinity = acct.loc_product_affinity || {}
      const gaps = Object.entries(affinity)
        .filter(([prod]) => !currentProducts.has(prod.toLowerCase()))
        .sort(([, a], [, b]) => b - a)
        .map(([product, score]) => ({ product, score }))

      const totalGapMrr = gaps.reduce((s, g) => s + (g.score || 0) * 100, 0)
      const enrichedAcct = { ...acct, _gaps: gaps, total_gap_mrr: totalGapMrr }
      const { score, breakdown, tags } = scoreAccount(enrichedAcct)

      // Find market
      const locs = acct.locations || []
      const marketCity = locs.length > 0 ? (locs[0].market || locs[0].city || locs[0].name || 'Unknown').split(',')[0].trim() : 'Unknown'

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

    // KPIs
    const totalClosed12m = marketArr.reduce((s, m) => s + m.closedMRR, 0)
    const totalPipeline = marketArr.reduce((s, m) => s + m.pipelineWeighted, 0)
    const totalWhitespace = scored.reduce((s, a) => s + (a.total_gap_mrr || 0), 0)
    const totalOnNet = marketArr.reduce((s, m) => s + m.onNetAccounts, 0)
    const totalAccts = marketArr.reduce((s, m) => s + m.totalAccounts, 0)
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

  // Bookings trend (mock 6/12mo from closed deals by month)
  const bookingsTrend = useMemo(() => {
    const months = trendExpanded ? 12 : 6
    const now = new Date()
    const data = []
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('en-US', { month: 'short' })
      let mrr = 0
      for (const a of accts) {
        for (const deal of (a.funnel_closed || [])) {
          if (!deal.close) continue
          const cd = new Date(deal.close)
          if (cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear()) {
            if ((deal.stage || '').toLowerCase().includes('won') || (deal.type || '').toLowerCase() === 'won') {
              mrr += deal.mrr || 0
            }
          }
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

  // Score breakdown for tooltip
  const breakdownLines = Object.entries(t._breakdown || {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}: +${v}`)
    .join('\n')
  const tooltipText = `${breakdownLines}\n──────\nTotal: ${t._score}`

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
        <div className="text-right shrink-0 min-w-[60px]">
          <div className="font-mono text-sm font-bold" style={{ color: CS.purple }}>{fmt(whitespace)}</div>
          <div className="font-mono text-[9px]" style={{ color: CS.textFaint }}>/mo</div>
        </div>

        {/* Score */}
        <div
          className="w-9 h-9 flex items-center justify-center rounded-lg font-mono text-sm font-bold border shrink-0"
          style={{ color: scoreColor, borderColor: scoreColor + '60', background: scoreColor + '10' }}
          title={tooltipText}
        >
          {t._score}
        </div>

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
        <div className="grid grid-cols-2 gap-4 px-4 pb-4 pt-2 border-t" style={{ background: CS.cardAlt, borderColor: CS.border }}>
          {/* Left column */}
          <div className="space-y-3">
            {/* Stats row */}
            <div className="flex gap-4 font-mono text-[10px]">
              <div><span style={{ color: CS.textFaint }}>TMR</span> <span className="font-semibold" style={{ color: CS.cyan }}>{fmt(tmr)}</span></div>
              <div><span style={{ color: CS.textFaint }}>Deals</span> <span className="font-semibold" style={{ color: CS.text }}>{deals}</span></div>
              <div><span style={{ color: CS.textFaint }}>NRR</span> <span className="font-semibold" style={{ color: nrr >= 1 ? CS.green : CS.red }}>{(nrr * 100).toFixed(0)}%</span></div>
              <div><span style={{ color: CS.textFaint }}>Health</span> <span className="font-semibold" style={{ color: health >= 70 ? CS.green : health >= 40 ? CS.amber : CS.red }}>{health}</span></div>
              <div><span style={{ color: CS.textFaint }}>Silent</span> <span className="font-semibold" style={{ color: daysSilent > 14 ? CS.amber : CS.textMuted }}>{daysSilent}d</span></div>
            </div>

            {/* Products */}
            <div>
              <div className="font-mono text-[9px] uppercase tracking-wider mb-1" style={{ color: CS.textFaint }}>Products</div>
              <div className="flex flex-wrap gap-1">
                {(t.products || []).map(p => (
                  <span key={p} className="font-mono text-[10px] px-2 py-0.5 rounded" style={{ background: CS.surface, color: CS.textMuted }}>
                    {p}
                  </span>
                ))}
                {gaps.slice(0, 4).map(g => (
                  <span key={g.product} className="font-mono text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: CS.purple + '15', color: CS.purple, border: `1px solid ${CS.purple}30` }}>
                    + {g.product}
                  </span>
                ))}
              </div>
            </div>

            {/* Conversation Strategy */}
            <div className="rounded-lg p-3 border-l-[3px]" style={{ background: CS.purple + '08', borderColor: CS.purple }}>
              <div className="font-mono text-[9px] uppercase tracking-wider mb-1 font-semibold" style={{ color: CS.purple }}>Conversation Strategy</div>
              <div className="text-[12px] leading-relaxed" style={{ color: CS.textMuted }}>
                {t._talkTrack}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-3">
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
      )}
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
          markets={markets}
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
                    contentStyle={{ background: CS.card, border: `1px solid ${CS.border}`, borderRadius: 8, fontSize: 11, fontFamily: FONT_MONO, color: CS.text }}
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

// ─── SVG Map View ────────────────────────────────────────────────────────────

function MapView({ markets, onMarketClick }) {
  const maxDeals = Math.max(...markets.map(m => m.closedDeals || 1), 1)

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: CS.card, borderColor: CS.border }}>
      <svg viewBox="0 0 800 520" className="w-full" style={{ background: CS.card }}>
        {/* US outline (simplified) */}
        <rect x="40" y="20" width="720" height="440" rx="4" fill="none" stroke={CS.border} strokeWidth="0.5" opacity="0.3" />

        {/* Market bubbles */}
        {markets.filter(m => m.lat && m.lng).map(m => {
          const [x, y] = proj(m.lat, m.lng)
          const r = Math.max(12, Math.min(32, (m.closedDeals / maxDeals) * 32))
          const glowColor = m.hasOutage ? CS.red : m.avgModifier > 1.05 ? CS.green : CS.cyan
          const circumference = 2 * Math.PI * (r + 4)
          const arcs = donutArcs(m.products, r + 4)

          return (
            <g key={m.city} onClick={() => onMarketClick(m.city)} className="cursor-pointer" style={{ transition: 'opacity 0.15s' }}>
              {/* Glow */}
              <circle cx={x} cy={y} r={r + 8} fill={glowColor} opacity={0.08} />

              {/* Donut ring */}
              {arcs.map((arc, i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={r + 4}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={4}
                  strokeDasharray={`${arc.dashLength} ${circumference - arc.dashLength}`}
                  strokeDashoffset={arc.dashOffset}
                  transform={`rotate(-90 ${x} ${y})`}
                />
              ))}

              {/* Center bg */}
              <circle cx={x} cy={y} r={r - 2} fill={CS.card} />

              {/* Deal count */}
              <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill={CS.text} fontSize={r > 18 ? 11 : 9} fontFamily={FONT_MONO} fontWeight="600">
                {m.closedDeals}
              </text>

              {/* Outage indicator */}
              {m.hasOutage && (
                <text x={x + r} y={y - r} textAnchor="middle" fontSize="10" fill={CS.red}>⚠</text>
              )}

              {/* Label */}
              <text x={x} y={y + r + 14} textAnchor="middle" fill={CS.textFaint} fontSize="8" fontFamily={FONT_MONO}>
                {m.city}
              </text>
              <text x={x} y={y + r + 24} textAnchor="middle" fill={CS.textFaint} fontSize="7" fontFamily={FONT_MONO} opacity="0.6">
                {fmt(m.closedMRR)}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t" style={{ borderColor: CS.border }}>
        {Object.entries(PRODUCT_COLORS).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
            <span className="font-mono text-[9px]" style={{ color: CS.textFaint }}>{name}</span>
          </div>
        ))}
        <span className="font-mono text-[9px] ml-auto" style={{ color: CS.textFaint }}>
          Bubble size = deals · Ring segments = product mix · Click to drill in
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
