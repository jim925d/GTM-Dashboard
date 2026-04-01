import { useMemo, useState, useEffect } from 'react'
import useDeals from './useDeals'
import useLocations from './useLocations'
import usePredictions from './usePredictions'

/**
 * Bridge hook: enriches accounts into scored targets with winCase, plays, signals, sites.
 *
 * Loads playbook_snapshot.json for upsell paths and product fit.
 * Falls back to empty plays when playbook isn't available.
 *
 * @param {Array} accounts
 * @returns {{ targets: Array, loading: boolean }}
 */

// ═══ Playbook loader (singleton) ═════════════════════════════════════════════

let _playbook = null
let _playbookPromise = null

function loadPlaybook() {
  if (_playbook) return Promise.resolve(_playbook)
  if (_playbookPromise) return _playbookPromise
  _playbookPromise = fetch('/local-data/playbook_snapshot.json')
    .then(r => r.ok ? r.json() : null)
    .catch(() => null)
    .then(data => {
      _playbook = data
      return data
    })
  return _playbookPromise
}

function findProductConfig(playbook, productName) {
  if (!playbook || !productName) return null
  const norm = productName.toLowerCase().replace(/-/g, ' ').trim()
  for (const p of (playbook.products || [])) {
    const pid = (p.product_id || '').replace(/_/g, ' ').toLowerCase()
    const pname = (p.display_name || '').toLowerCase()
    if (pid === norm || pname === norm || norm.includes(pname) || pname.includes(norm)) return p
  }
  return null
}

function findBestUpsellPath(playbook, currentProducts) {
  if (!playbook || !currentProducts.length) return null
  const currentLower = currentProducts.map(p => p.toLowerCase().replace(/-/g, ' ').trim())

  let bestPath = null
  let bestRate = 0

  for (const prod of (playbook.products || [])) {
    const fromPaths = prod.upsell_paths?.from || []
    for (const path of fromPaths) {
      if (!path || typeof path !== 'object') continue
      const fromProd = (path.product || '').toLowerCase().replace(/_/g, ' ')
      if (currentLower.some(c => c.includes(fromProd) || fromProd.includes(c))) {
        const rate = path.historical_close_rate || path.fit_score / 100 || 0
        if (rate > bestRate) {
          bestRate = rate
          bestPath = {
            from: path.product,
            to: prod.display_name || prod.product_id,
            rate,
            fitScore: path.fit_score || 0,
            deals: path.historical_deals || 0,
            avgCycle: path.avg_cycle_days || null,
            pitch: path.pitch || '',
          }
        }
      }
    }
  }

  return bestPath
}

// ═══ Target scoring ══════════════════════════════════════════════════════════

function scoreTarget(acct) {
  const locs = acct.locations || []
  const onNet = locs.filter(l => l.onNet).length
  const total = locs.length || 1
  const onNetPct = onNet / total

  const ps = acct.premierScore || 0
  const churn = acct.churnProbability || 0
  const pipeline = (acct.pipeline || acct.active_deals || []).length
  const hasNew = locs.some(l => l.isNew)
  const ws = Math.max(0, (acct.totalTMR || 0) - (acct.servicesMRR || 0) * 12)

  return Math.round(
    ps * 0.35 +
    (1 - churn) * 60 +
    onNetPct * 30 +
    (pipeline > 0 ? 15 : 0) +
    (hasNew ? 10 : 0) +
    (ws > 50000 ? 10 : 0)
  )
}

function buildSignals(acct) {
  const signals = []
  const locs = acct.locations || []
  const onNet = locs.filter(l => l.onNet).length
  const total = locs.length

  if (onNet > 0 && total > 0) signals.push(`${onNet}/${total} on-net`)
  const ws = Math.max(0, (acct.totalTMR || 0) - (acct.servicesMRR || 0) * 12)
  if (ws > 10000) signals.push(`$${Math.round(ws / 1000)}K whitespace`)
  if (locs.some(l => l.isNew)) signals.push('New sites')
  if ((acct.churnProbability || 0) > 0.2) signals.push('Churn risk')
  if ((acct.signals || []).some(s => (s.text || '').toLowerCase().includes('outage'))) signals.push('Competitor outage')
  if ((acct.signals || []).some(s => (s.text || '').toLowerCase().includes('sec'))) signals.push('SEC filing')

  return signals
}

function buildWinCase(acct, playbook) {
  const currentProducts = (acct.services || []).map(s => s.product_group).filter(Boolean)
  const locs = acct.locations || []
  const onNet = locs.filter(l => l.onNet).length
  const total = locs.length || 1

  const upsell = findBestUpsellPath(playbook, currentProducts)

  const has = currentProducts.length
    ? currentProducts.join(', ')
    : 'No current products'

  const onNetStr = onNet > 0
    ? `${onNet} of ${total} on-net — deploy in days`
    : total > 0 ? `${total} sites — build required` : 'No site data'

  let sell, path, rate, deals, headline
  if (upsell) {
    sell = `${upsell.to} overlay on existing ${upsell.from}`
    path = `${upsell.from} → ${upsell.to}`
    rate = `${Math.round(upsell.rate * 100)}%`
    deals = upsell.deals
    headline = `Sell ${upsell.to} across ${onNet} on-net sites. ${rate} close rate for this path.`
  } else if (currentProducts.length) {
    sell = 'Expand existing footprint'
    path = 'Greenfield'
    rate = null
    deals = 0
    headline = `Expand ${currentProducts[0]} footprint — ${onNetStr}.`
  } else {
    sell = 'New customer acquisition'
    path = 'Greenfield'
    rate = null
    deals = 0
    headline = `Greenfield opportunity — ${onNetStr}.`
  }

  return { headline, has, onNet: onNetStr, sell, path, rate, deals }
}

function buildPlays(acct, playbook) {

  // Synthesize from playbook upsell paths
  if (!playbook) return []
  const currentProducts = (acct.services || []).map(s => s.product_group).filter(Boolean)
  const plays = []

  for (const prod of (playbook.products || [])) {
    const fromPaths = prod.upsell_paths?.from || []
    for (const path of fromPaths) {
      if (!path || typeof path !== 'object') continue
      const fromProd = (path.product || '').toLowerCase().replace(/_/g, ' ')
      const isMatch = currentProducts.some(c => c.toLowerCase().replace(/-/g, ' ').includes(fromProd))
      if (isMatch) {
        plays.push({
          title: `${path.product} → ${prod.display_name || prod.product_id}`,
          desc: path.pitch || `Upsell from ${path.product} to ${prod.display_name}`,
          impact: path.fit_score ? `${path.fit_score} fit` : '',
          recommended: (path.fit_score || 0) >= 80,
          products: [prod.display_name || prod.product_id],
        })
      }
    }
  }

  return plays.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0)).slice(0, 3)
}

function buildSites(acct) {
  return (acct.locations || []).map(loc => ({
    name: `${loc.city || ''}${loc.state ? ', ' + loc.state : ''}`.trim() || 'Unknown',
    status: loc.onNet ? 'on-net' : loc.isNew ? 'new' : 'off-net',
  }))
}

// ═══ Main hook ═══════════════════════════════════════════════════════════════

export default function useV2Targets(accounts = []) {
  const [playbook, setPlaybook] = useState(_playbook)
  const [loading, setLoading] = useState(!_playbook)

  useEffect(() => {
    if (_playbook) { setPlaybook(_playbook); setLoading(false); return }
    loadPlaybook().then(pb => { setPlaybook(pb); setLoading(false) })
  }, [])

  const targets = useMemo(() => {
    return accounts
      .filter(a => (a.locations || []).length > 0 || (a.premierScore || 0) > 100 || (a.services || []).length > 0)
      .map(acct => {
        const locs = acct.locations || []
        const services = acct.services || []
        const servicesMRR = services.reduce((s, svc) => s + (parseFloat(svc.mrr) || 0), 0)

        return {
          id: acct.name,
          name: acct.name,
          industry: `${acct.mega_vertical || acct.vertical || ''} · ${locs.length} sites`,
          score: scoreTarget(acct),
          signals: buildSignals(acct),
          winCase: buildWinCase(acct, playbook),
          plays: buildPlays(acct, playbook),
          sites: buildSites(acct),
          current: {
            mrr: servicesMRR || acct.servicesMRR || 0,
            services: services.length,
            tenure: acct.relationship_tenure_months || null,
            products: services.map(s => s.product_group).filter(Boolean),
          },
        }
      })
      .sort((a, b) => b.score - a.score)
  }, [accounts, playbook])

  return { targets, loading }
}
