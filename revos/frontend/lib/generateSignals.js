/**
 * RevOS Signal Generation Engine
 * Reads all input tables, computes per-account signals for Prospecting, Growth, Retention.
 * Output: { generatedAt, source, accountCount, signals: { [accountName]: { ... } } }
 */

// ─── Column name mappings (Salesforce-style → internal) ─────────────────────

function col(row, ...candidates) {
  for (const c of candidates) {
    if (row[c] !== undefined) return row[c]
  }
  return null
}

function acctName(row) {
  return (
    col(row,
      'Customer Account',
      'Account: Customer Account',
      'Account Global Region : Account : Customer Account',
      'Company / Account',
    ) || ''
  ).trim()
}

function parseMRR(val) {
  if (val == null) return 0
  if (typeof val === 'number') return val
  const s = String(val).replace(/[$,()USD\s]/g, '').trim()
  return parseFloat(s) || 0
}

function parseDate(val) {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function daysBetween(d1, d2) {
  if (!d1 || !d2) return Infinity
  return Math.round((d2 - d1) / 86400000)
}

function normalizeStage(s) {
  if (!s) return ''
  const lower = s.toLowerCase().trim()
  if (lower.includes('closed won') || lower.includes('accepted') || lower.startsWith('5')) return 'closed_won'
  if (lower.includes('closed lost') || lower.includes('close lost')) return 'closed_lost'
  if (lower.includes('discover') || lower.startsWith('1')) return 'discover'
  if (lower.includes('design') || lower.startsWith('2')) return 'design_solution'
  if (lower.includes('propose') || lower.startsWith('3')) return 'propose'
  if (lower.includes('negotiate') || lower.startsWith('4')) return 'negotiate'
  if (lower.includes('verbal')) return 'verbal_agreement'
  return lower
}

// ─── Signal computation ─────────────────────────────────────────────────────

export async function generateSignals(tableData) {
  const {
    customers = [],
    funnel = [],
    closeLost = [],
    quotes = [],
    services = [],
    locations = [],
    activity = [],
  } = tableData

  const NOW = new Date()

  // ── Index data by account name ──────────────────────────────────────────

  function groupBy(rows, keyFn) {
    const map = {}
    for (const row of rows) {
      const key = keyFn(row)
      if (!key) continue
      if (!map[key]) map[key] = []
      map[key].push(row)
    }
    return map
  }

  const funnelByAcct = groupBy(funnel, acctName)
  const lostByAcct = groupBy(closeLost, acctName)
  const servicesByAcct = groupBy(services, acctName)
  const locationsByAcct = groupBy(locations, acctName)
  const activityByAcct = groupBy(activity, acctName)
  const quotesByAcct = groupBy(quotes, acctName)

  // ── Compute segment-level win rates for product recommendations ─────────

  const segmentProductWins = {} // segment -> product -> { won, total }
  for (const row of funnel) {
    const stage = normalizeStage(col(row, 'Stage', 'stage'))
    if (stage !== 'closed_won' && stage !== 'closed_lost') continue
    const segment = col(row, 'Vertical', 'Reporting Segement', 'vertical', 'segment') || 'Unknown'
    const product = col(row, 'Product Group', 'product_group') || 'Unknown'
    if (!segmentProductWins[segment]) segmentProductWins[segment] = {}
    if (!segmentProductWins[segment][product]) segmentProductWins[segment][product] = { won: 0, total: 0 }
    segmentProductWins[segment][product].total++
    if (stage === 'closed_won') segmentProductWins[segment][product].won++
  }

  // ── Segment-level renewal patterns ──────────────────────────────────────

  const segmentRenewalPatterns = {} // segment -> { renewed, total, topProduct }
  for (const row of funnel) {
    const type = (col(row, 'Type', 'type') || '').toLowerCase()
    if (!type.includes('renew') && !type.includes('re-rate')) continue
    const stage = normalizeStage(col(row, 'Stage', 'stage'))
    const segment = col(row, 'Vertical', 'Reporting Segement', 'vertical') || 'Unknown'
    if (!segmentRenewalPatterns[segment]) segmentRenewalPatterns[segment] = { renewed: 0, total: 0, products: {} }
    segmentRenewalPatterns[segment].total++
    if (stage === 'closed_won') {
      segmentRenewalPatterns[segment].renewed++
      const product = col(row, 'Product Group', 'product_group') || 'Unknown'
      segmentRenewalPatterns[segment].products[product] = (segmentRenewalPatterns[segment].products[product] || 0) + 1
    }
  }

  // ── Won deals index for similarWin ──────────────────────────────────────

  const wonDeals = funnel.filter(r => normalizeStage(col(r, 'Stage', 'stage')) === 'closed_won')

  // ── Build signals per account ───────────────────────────────────────────

  const signals = {}
  let accountCount = 0

  for (const cust of customers) {
    const name = (
      col(cust,
        'Account Global Region : Account : Customer Account',
        'Customer Account',
      ) || ''
    ).trim()
    if (!name) continue

    const segment = col(cust,
      'Account Global Region : Account : Vertical',
      'Vertical',
      'vertical',
    ) || 'Unknown'

    const custMRR = parseMRR(col(cust,
      'Account Global Region : Account : Total BRR',
      'Total BRR',
    ))

    const acctFunnel = funnelByAcct[name] || []
    const acctLost = lostByAcct[name] || []
    const acctServices = servicesByAcct[name] || []
    const acctLocations = locationsByAcct[name] || []
    const acctActivity = activityByAcct[name] || []
    const acctQuotes = quotesByAcct[name] || []

    // ── PROSPECTING signals ───────────────────────────────────────────

    // newLocations: on-net/near-net locations
    const onNearNetLocs = acctLocations.filter(l => {
      const status = (col(l, 'On Zayo Network Status', 'Network Proximity Status', 'net_status') || '').toLowerCase()
      return status.includes('on') || status.includes('near')
    })

    const newLocationCities = [...new Set(
      onNearNetLocs.map(l => col(l, 'City', 'Building City', 'city')).filter(Boolean)
    )].slice(0, 5)

    // netStatusShift: on-net locations (simplified - no historical tracking)
    const onNetLocs = acctLocations.filter(l => {
      const status = (col(l, 'On Zayo Network Status', 'Network Proximity Status') || '').toLowerCase()
      return status.includes('on-net') || status === 'on net' || status === 'on zayo network'
    })

    // recentLoss
    const sortedLosses = acctLost
      .map(r => ({
        product: col(r, 'Product Group', 'product_group') || 'Unknown',
        mrr: parseMRR(col(r, 'Total MRR & MAR (converted)', 'mrr')),
        closeDate: parseDate(col(r, 'Date Closed Lost', 'Close Date', 'close_date')),
        lossReason: col(r, 'Stage Group', 'loss_reason') || 'Unknown',
      }))
      .filter(r => r.closeDate)
      .sort((a, b) => b.closeDate - a.closeDate)

    const recentLoss = sortedLosses.length > 0 ? {
      product: sortedLosses[0].product,
      lossReason: sortedLosses[0].lossReason,
      mrr: sortedLosses[0].mrr,
      daysAgo: daysBetween(sortedLosses[0].closeDate, NOW),
    } : null

    // historicalPriceRange (from won funnel deals for this account)
    const wonForAcct = acctFunnel.filter(r => normalizeStage(col(r, 'Stage', 'stage')) === 'closed_won')
    const wonMRRs = wonForAcct.map(r => parseMRR(col(r, 'Total MRR & MAR (converted)', 'mrr'))).filter(v => v > 0)
    const historicalPriceRange = wonMRRs.length > 0 ? {
      min: Math.round(Math.min(...wonMRRs)),
      max: Math.round(Math.max(...wonMRRs)),
      avg: Math.round(wonMRRs.reduce((a, b) => a + b, 0) / wonMRRs.length),
      count: wonMRRs.length,
    } : null

    // lastContact
    const sortedActivity = acctActivity
      .map(r => ({
        date: parseDate(col(r, 'Date', 'activity_date')),
        type: col(r, 'SalesLoft Type', 'activity_type') || col(r, 'Task', 'task') || 'Unknown',
        contact: col(r, 'Contact', 'contact_name') || '',
      }))
      .filter(r => r.date)
      .sort((a, b) => b.date - a.date)

    const lastContact = sortedActivity.length > 0 ? {
      daysAgo: daysBetween(sortedActivity[0].date, NOW),
      activityType: sortedActivity[0].type,
      contactName: sortedActivity[0].contact,
    } : null

    // nearNetOpportunity
    const nearNetLocs = acctLocations.filter(l => {
      const status = (col(l, 'On Zayo Network Status', 'Network Proximity Status') || '').toLowerCase()
      return status.includes('near')
    })
    const nearNetCities = [...new Set(
      nearNetLocs.map(l => col(l, 'City', 'Building City', 'city')).filter(Boolean)
    )].slice(0, 5)

    // ── GROWTH signals ────────────────────────────────────────────────

    // underservedLocations: on-net with no attributed MRR
    const underserved = onNetLocs.filter(l => {
      const mrr = parseMRR(col(l, 'Loc Attributed MRR', 'active_services'))
      return !mrr || mrr === 0
    })
    const underservedCities = [...new Set(
      underserved.map(l => col(l, 'City', 'Building City', 'city')).filter(Boolean)
    )].slice(0, 5)

    // competitorDisplacement: placeholder
    const competitorDisplacement = { count: 0, providers: [] }

    // productRecommendation
    const segProducts = segmentProductWins[segment] || {}
    const productRanking = Object.entries(segProducts)
      .filter(([_, stats]) => stats.total >= 3)
      .map(([product, stats]) => ({
        product,
        winRate: stats.won / stats.total,
        similarDeals: stats.total,
      }))
      .sort((a, b) => b.winRate - a.winRate)

    const productRecommendation = productRanking.length > 0 ? {
      product: productRanking[0].product,
      winRate: Math.round(productRanking[0].winRate * 100) / 100,
      similarDeals: productRanking[0].similarDeals,
    } : null

    // similarWin
    const mrrRange = custMRR || (wonMRRs.length > 0 ? wonMRRs[wonMRRs.length - 1] : 5000)
    const mrrLow = mrrRange * 0.6
    const mrrHigh = mrrRange * 1.4
    const similarWins = wonDeals
      .filter(r => {
        const rSeg = col(r, 'Vertical', 'Reporting Segement', 'vertical') || ''
        const rMRR = parseMRR(col(r, 'Total MRR & MAR (converted)', 'mrr'))
        const rAcct = acctName(r)
        return rSeg === segment && rMRR >= mrrLow && rMRR <= mrrHigh && rAcct !== name
      })
      .map(r => {
        const created = parseDate(col(r, 'Created Date', 'created_date'))
        const closed = parseDate(col(r, 'Close Date', 'close_date'))
        return {
          product: col(r, 'Product Group', 'product_group') || 'Unknown',
          mrr: Math.round(parseMRR(col(r, 'Total MRR & MAR (converted)', 'mrr'))),
          daysToClose: created && closed ? daysBetween(created, closed) : null,
        }
      })
      .filter(r => r.daysToClose != null && r.daysToClose > 0)
      .sort((a, b) => b.mrr - a.mrr)

    const similarWin = similarWins.length > 0 ? {
      account: `Similar account in ${segment}`,
      product: similarWins[0].product,
      mrr: similarWins[0].mrr,
      daysToClose: similarWins[0].daysToClose,
    } : null

    // priceAnchor (from won deals in same segment for recommended product)
    const recProduct = productRecommendation?.product
    const anchorDeals = recProduct
      ? wonDeals.filter(r => {
          const rSeg = col(r, 'Vertical', 'Reporting Segement', 'vertical') || ''
          const rProd = col(r, 'Product Group', 'product_group') || ''
          return rSeg === segment && rProd === recProduct
        }).map(r => parseMRR(col(r, 'Total MRR & MAR (converted)', 'mrr'))).filter(v => v > 0)
      : []

    const priceAnchor = anchorDeals.length >= 2 ? {
      min: Math.round(Math.min(...anchorDeals)),
      max: Math.round(Math.max(...anchorDeals)),
      median: Math.round(anchorDeals.sort((a, b) => a - b)[Math.floor(anchorDeals.length / 2)]),
    } : null

    // ── RETENTION signals ─────────────────────────────────────────────

    // Parse services
    const parsedServices = acctServices.map(s => ({
      product: col(s, 'Product Group', 'product_group') || 'Unknown',
      mrr: parseMRR(col(s, 'MRR (converted)', 'mrr')),
      expiryDate: parseDate(col(s, 'Current Expiration Date', 'contract_end')),
      disconnectDate: parseDate(col(s, 'Disconnect Date', 'disconnect_date')),
      isActive: !col(s, 'Disconnect Date', 'disconnect_date'),
    }))

    const activeServices = parsedServices.filter(s => s.isActive && s.mrr > 0)

    // mtmServices: active services past expiration
    const mtm = activeServices.filter(s => s.expiryDate && s.expiryDate < NOW)
    const mtmServices = mtm.length > 0 ? {
      count: mtm.length,
      products: [...new Set(mtm.map(s => s.product))].slice(0, 5),
      mrrSum: Math.round(mtm.reduce((sum, s) => sum + s.mrr, 0)),
      maxMtmDays: Math.max(...mtm.map(s => daysBetween(s.expiryDate, NOW))),
    } : { count: 0, products: [], mrrSum: 0, maxMtmDays: 0 }

    // expiringServices: active services expiring within 90 days
    const expiring = activeServices.filter(s => {
      if (!s.expiryDate) return false
      const daysUntil = daysBetween(NOW, s.expiryDate)
      return daysUntil >= 0 && daysUntil <= 90
    })
    const expiringServices = expiring.length > 0 ? {
      count: expiring.length,
      products: [...new Set(expiring.map(s => s.product))].slice(0, 5),
      mrrSum: Math.round(expiring.reduce((sum, s) => sum + s.mrr, 0)),
      soonestExpiryDays: Math.min(...expiring.map(s => daysBetween(NOW, s.expiryDate))),
    } : { count: 0, products: [], mrrSum: 0, soonestExpiryDays: null }

    // openRenewalOpportunity
    const openRenewals = acctFunnel.filter(r => {
      const stage = normalizeStage(col(r, 'Stage', 'stage'))
      if (stage === 'closed_won' || stage === 'closed_lost') return false
      const type = (col(r, 'Type', 'type') || '').toLowerCase()
      return type.includes('renew') || type.includes('re-rate')
    })
    const openRenewalOpportunity = {
      hasOpenRenewal: openRenewals.length > 0,
      stage: openRenewals.length > 0 ? col(openRenewals[0], 'Stage', 'stage') : null,
    }

    // mrrAtRisk
    const mrrAtRisk = mtmServices.mrrSum + expiringServices.mrrSum

    // renewalStrategy
    const segRenewalData = segmentRenewalPatterns[segment]
    let renewalStrategy = null
    if (segRenewalData && segRenewalData.total >= 3) {
      const rate = Math.round((segRenewalData.renewed / segRenewalData.total) * 100)
      const topProducts = Object.entries(segRenewalData.products)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([p]) => p)

      renewalStrategy = `${topProducts.join(', ')} renewals closed ${rate}% of the time in ${segment} segment (${segRenewalData.renewed} of ${segRenewalData.total})`
    }

    // daysSinceContact (same as lastContact but for retention context)
    const daysSinceContact = lastContact ? {
      daysAgo: lastContact.daysAgo,
      activityType: lastContact.activityType,
    } : { daysAgo: null, activityType: null }

    // ── Assemble ──────────────────────────────────────────────────────

    signals[name] = {
      accountName: name,
      segment,
      prospecting: {
        newLocations: { count: onNearNetLocs.length, cities: newLocationCities },
        netStatusShift: { count: onNetLocs.length, locations: onNetLocs.slice(0, 3).map(l => col(l, 'Building Name', 'City', 'city') || 'Unknown') },
        recentLoss,
        historicalPriceRange,
        lastContact,
        nearNetOpportunity: { count: nearNetLocs.length, cities: nearNetCities },
      },
      growth: {
        underservedLocations: { count: underserved.length, cities: underservedCities },
        competitorDisplacement,
        productRecommendation,
        similarWin,
        priceAnchor,
      },
      retention: {
        mtmServices,
        expiringServices,
        openRenewalOpportunity,
        mrrAtRisk,
        renewalStrategy,
        daysSinceContact,
      },
    }

    accountCount++
  }

  return {
    generatedAt: NOW.toISOString(),
    source: 'batch',
    accountCount,
    signals,
  }
}
