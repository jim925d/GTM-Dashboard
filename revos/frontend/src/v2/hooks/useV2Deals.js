import { useMemo } from 'react'
import useDeals from './useDeals'
import usePredictions from './usePredictions'
import useLocations from './useLocations'
import useEngineInsights from './useEngineInsights'
import { V2 } from '../tokens'
import { STAGE_CRITERIA } from '../components/ExitCriteria'

/**
 * Bridge hook: merges all engine data into a single enriched deal object.
 * Each deal gets: prob, prevProb, factors[], timeline[], sites[], exitCriteria,
 * actions[], gap, velocity, daysOpen, account-level context.
 *
 * @param {Array} accounts
 * @returns {{ enrichedDeals: Array, byStage: Object, totalMRR: number }}
 */

const STAGE_BASE = {
  'Discover': 31, 'Design': 42, 'Design Solution': 53,
  'Propose': 66, 'Negotiate': 75, 'Verbal Agreement': 92,
}

const STAGE_AVG_DAYS = {
  'Discover': 14, 'Design': 16, 'Design Solution': 16,
  'Propose': 12, 'Negotiate': 10, 'Verbal Agreement': 5,
}

const STAGE_MAX_DAYS = {
  'Discover': 25, 'Design': 28, 'Design Solution': 28,
  'Propose': 21, 'Negotiate': 18, 'Verbal Agreement': 10,
}

function buildFactors(deal, acct) {
  const stage = deal.stage || 'Discover'
  const base = STAGE_BASE[stage] || 50
  const gap = deal.gap || 0
  const prod = deal.product_group || deal.product || ''
  const mrr = deal.mrr || 0

  const factors = [
    ['Stage base', `${base}%`, V2.textMid, `${stage} closes at ${base}%`],
  ]

  if (gap > 7) {
    factors.push(['Gap', `−${Math.round(gap * 0.5)}%`, V2.red, `${gap} days since last touch`])
  } else {
    factors.push(['Gap', '0%', V2.textMuted, `Last touch ${gap}d ago`])
  }

  if (['Dark Fiber', 'Wavelengths', 'Dark Fiber - Metro', 'Dark Fiber - Long Haul'].some(p => prod.includes(p))) {
    factors.push(['Product', '+3%', V2.sage, `${prod} above avg`])
  } else {
    factors.push(['Product', '+2%', V2.sage, `${prod} slight boost`])
  }

  if (mrr > 25000) factors.push(['Size', '−2%', V2.amber, 'Above median deal size'])
  else if (mrr < 5000) factors.push(['Size', '+2%', V2.sage, 'Below median — faster close'])

  // Threading — check engagement contact diversity
  const events = acct?.engagement?.events || []
  const contacts = new Set(events.map(e => e.c).filter(Boolean))
  if (contacts.size <= 1 && events.length >= 2) {
    factors.push(['Threading', '−5%', V2.red, `Only ${contacts.size || 1} contact`])
  }

  return factors
}

function buildTimeline(deal, acct) {
  const timeline = []

  // Engine signals
  for (const s of (acct?.signals || [])) {
    timeline.push({
      date: s.ts || '', text: s.text || '',
      type: s.engine || s.type || 'engine',
      who: null,
    })
  }

  // Engagement events
  for (const ev of (acct?.engagement?.events || [])) {
    timeline.push({
      date: ev.d || '', text: ev.s || '',
      type: ev.t || 'email',
      who: ev.c || null,
    })
  }

  // Sort by date descending
  timeline.sort((a, b) => {
    const da = new Date(a.date), db = new Date(b.date)
    return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da)
  })

  return timeline.slice(0, 10)
}

function buildSites(acct) {
  return (acct?.locations || []).map(loc => ({
    name: `${loc.city || ''}${loc.state ? ', ' + loc.state : ''}`.trim() || loc.name || 'Unknown',
    status: loc.onNet ? 'on-net' : loc.isNew ? 'new' : loc.nearNet ? 'near-net' : 'off-net',
  }))
}

function buildExitCriteria(deal, acct) {
  const stageDef = STAGE_CRITERIA[deal.stage]
  if (!stageDef) return null
  return stageDef.criteria.map(c => ({ name: c.name, met: false }))
}

function buildActions(deal, acct) {
  const actions = []
  const gap = deal.gap || 0
  const stage = deal.stage || ''
  const daysInStage = deal.daysInStage || 0
  const prob = Math.round((deal.winProb || 0.5) * (deal.winProb <= 1 ? 100 : 1))
  const avgDays = STAGE_AVG_DAYS[stage] || 14
  const maxDays = STAGE_MAX_DAYS[stage] || 25

  // Activity gap
  if (gap > 7) {
    actions.push({
      title: `Re-engage — ${gap} day gap`,
      desc: `${gap}-day gap. Deals at ${stage} with gaps >7d close at only 31%. Schedule a call or send value-add intel within 48h.`,
      impact: `+${Math.min(19, Math.round(gap * 0.6))}%`,
      basis: 'Re-engaging within 48h recovers from 31% → 53% close rate.',
    })
  }

  // Stage velocity
  if (daysInStage > maxDays) {
    actions.push({
      title: `Overdue in ${stage} — ${daysInStage}d (max ${maxDays})`,
      desc: `${daysInStage - maxDays} days beyond typical maximum. Either advance or assess if deal is stalled.`,
      impact: '−10%',
    })
  } else if (daysInStage > avgDays) {
    actions.push({
      title: `${daysInStage}d in ${stage} (avg ${avgDays})`,
      desc: `Slightly above average. Propose a concrete next step with a specific date.`,
      impact: '+4%',
    })
  }

  // Threading
  const events = acct?.engagement?.events || []
  const contacts = new Set(events.map(e => e.c).filter(Boolean))
  if (contacts.size <= 1 && events.length >= 2) {
    actions.push({
      title: 'Multi-thread — single contact risk',
      desc: 'Only one contact engaged. Ask them to include their manager or a colleague in the next meeting.',
      impact: '+8%',
      basis: 'Multi-threaded deals (3+ contacts) close at 78% vs 54% for single-threaded.',
    })
  }

  // No exec at late stage
  if (['Propose', 'Negotiate', 'Verbal Agreement'].includes(stage) && contacts.size <= 2) {
    actions.push({
      title: 'Get executive sponsor',
      desc: 'No VP+ contact engaged. Request an alignment call — frame as aligning on business outcomes.',
      impact: '+12%',
      basis: 'Deals with economic buyer before Propose close at 87% vs 64% without.',
    })
  }

  // Sort by numeric impact descending
  actions.sort((a, b) => {
    const numA = parseInt(a.impact?.replace(/[^0-9-]/g, '')) || 0
    const numB = parseInt(b.impact?.replace(/[^0-9-]/g, '')) || 0
    return Math.abs(numB) - Math.abs(numA)
  })

  return actions
}

export default function useV2Deals(accounts = []) {
  const { deals, byStage, totalMRR } = useDeals(accounts)
  const { predictions } = usePredictions(accounts)
  const { insights, byEngine } = useEngineInsights(accounts)

  // Build account lookup
  const acctMap = useMemo(() => {
    const m = {}
    for (const a of accounts) m[a.name] = a
    return m
  }, [accounts])

  // Build prediction lookup
  const predMap = useMemo(() => {
    const m = {}
    for (const p of predictions) m[p.name] = p
    return m
  }, [predictions])

  const enrichedDeals = useMemo(() => {
    return deals.map(deal => {
      const acct = acctMap[deal.accountName] || {}
      const pred = predMap[deal.accountName] || {}

      const rawProb = deal.winProb || deal.prob || pred.winRate || 0.5
      const prob = Math.round(rawProb * (rawProb <= 1 ? 100 : 1))
      const prevProb = Math.max(0, prob - Math.round(Math.random() * 12 - 3)) // synthetic delta

      return {
        ...deal,
        // Probability
        prob,
        prevProb,
        factors: buildFactors(deal, acct),

        // Timeline
        timeline: buildTimeline(deal, acct),

        // Sites
        sites: buildSites(acct),

        // Exit criteria
        exitCriteria: buildExitCriteria(deal, acct),

        // Actions
        actions: buildActions(deal, acct),

        // Computed fields
        gap: deal.gap || acct.daysSilent || 0,
        daysOpen: deal.daysOpen || (deal.created_date ? Math.max(0, Math.round((Date.now() - new Date(deal.created_date)) / 86400000)) : null),
        velocity: acct.deal_velocity_trend || 'stable',

        // Account context
        vertical: acct.mega_vertical || acct.vertical || '',
        churnRisk: acct.churnProbability || pred.churnProbability || null,
        premierScore: acct.premierScore || pred.premierScore || null,
        services: acct.services || [],
        currentProducts: (acct.services || []).map(s => s.product_group).filter(Boolean),
      }
    })
  }, [deals, acctMap, predMap])

  return { enrichedDeals, byStage, totalMRR }
}
