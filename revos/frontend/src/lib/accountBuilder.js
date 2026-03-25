/**
 * Client-side account state builder — mirrors backend logic for demo mode.
 */

export function normalizeStage(raw) {
  if (!raw) return ''
  const s = raw.toLowerCase().trim()
  // Closed Won — match "closed won", "closed-won", "accepted", "5 - accepted"
  if (s === 'closed won' || s === 'closed-won' || s.includes('accepted') || s === '5 - accepted') return 'closed won'
  if (s === 'closed lost' || s.includes('closed lost') || s === 'close lost') return 'closed lost'
  // Salesforce numeric stages
  if (s.includes('discover') || s.startsWith('1')) return 'Discover'
  if (s.includes('design') || s.startsWith('2')) return 'Design'
  if (s.includes('propose') || s.startsWith('3')) return 'Propose'
  if (s.includes('negotiate') || s.startsWith('4')) return 'Negotiate'
  return raw
}

export function buildAccountState(customer, funnel, closeLost, quotes, services, locations) {
  const today = new Date()
  const accountName = customer?.customer_account || 'Unknown'

  // Derive service_status from disconnect_date if not explicitly set
  for (const s of services) {
    if (!s.service_status) {
      s.service_status = s.disconnect_date ? 'disconnected' : 'active'
    }
  }

  // Services
  const activeServices = services.filter(s => (s.service_status || '').toLowerCase() === 'active')
  const servicesMRR = activeServices.reduce((sum, s) => sum + (parseFloat(s.mrr) || 0), 0)

  // TMR: Total Monthly Recurring — from Total BRR in customers.csv (summed across rows for same account)
  const customerBRR = parseFloat(String(customer?.total_brr || '').replace(/[$,\s]/g, '')) || 0
  const totalTMR = customerBRR
  const totalMRR = customerBRR / 12

  const disconnects = services.filter(s => (s.service_status || '').toLowerCase() === 'disconnected')
  const downgrades = services.filter(s => (s.change_type || '').toLowerCase() === 'downgrade')
  const downgradeMRR = downgrades.reduce((sum, s) => sum + Math.abs(parseFloat(s.mrr) || 0), 0)

  // Pipeline
  const activePipeline = funnel.filter(d => !['closed won', 'closed lost', ''].includes(normalizeStage(d.stage)))
  const pipelineMRR = activePipeline.reduce((sum, d) => sum + (parseFloat(d.mrr) || 0), 0)

  const pipelineByStage = {}
  for (const d of activePipeline) {
    const stage = d.stage || 'Unknown'
    if (!pipelineByStage[stage]) pipelineByStage[stage] = { count: 0, mrr: 0 }
    pipelineByStage[stage].count++
    pipelineByStage[stage].mrr += parseFloat(d.mrr) || 0
  }

  const pipelineByProduct = {}
  for (const d of activePipeline) {
    const prod = d.product_group || 'Unknown'
    if (!pipelineByProduct[prod]) pipelineByProduct[prod] = { count: 0, mrr: 0 }
    pipelineByProduct[prod].count++
    pipelineByProduct[prod].mrr += parseFloat(d.mrr) || 0
  }

  // Won/Lost — separate positive wins from churn/negative re-rates
  // No isRealDeal filter — same-day created/closed deals are legitimate (renewals, re-rates, Accepted stage)
  const closedWon = funnel.filter(d => normalizeStage(d.stage) === 'closed won')
  const funnelClosedLost = funnel.filter(d => normalizeStage(d.stage) === 'closed lost')
  const wonDeals = closedWon.filter(d => (parseFloat(d.mrr) || 0) >= 0)
  const churnDeals = closedWon.filter(d => (parseFloat(d.mrr) || 0) < 0)
  const churnMRR = Math.abs(churnDeals.reduce((sum, d) => sum + (parseFloat(d.mrr) || 0), 0))
  const filteredCloseLost = closeLost
  const totalWon = wonDeals.length
  const totalLost = filteredCloseLost.length
  const winRate = (totalWon + totalLost) > 0 ? totalWon / (totalWon + totalLost) : 0

  const lostMRR = filteredCloseLost.reduce((sum, d) => sum + (parseFloat(d.mrr) || 0), 0)

  // Concentration
  const concentration = {}
  if (totalMRR > 0) {
    for (const s of activeServices) {
      const prod = s.product_group || 'Unknown'
      if (!concentration[prod]) concentration[prod] = { mrr: 0, pct: 0 }
      concentration[prod].mrr += parseFloat(s.mrr) || 0
    }
    for (const prod of Object.keys(concentration)) {
      concentration[prod].pct = concentration[prod].mrr / totalMRR
    }
  }

  // Days silent
  let daysSilent = 0
  const allDates = []
  for (const d of [...funnel, ...closeLost]) {
    const cd = parseDate(d.created_date || d.close_date)
    if (cd) allDates.push(cd)
  }
  if (allDates.length > 0) {
    const most = new Date(Math.max(...allDates))
    daysSilent = Math.floor((today - most) / (1000 * 60 * 60 * 24))
  }

  // Velocity
  const sixMoAgo = new Date(today)
  sixMoAgo.setMonth(sixMoAgo.getMonth() - 6)
  const twelveMoAgo = new Date(today)
  twelveMoAgo.setMonth(twelveMoAgo.getMonth() - 12)
  const recent = allDates.filter(d => d >= sixMoAgo).length
  const prior = allDates.filter(d => d >= twelveMoAgo && d < sixMoAgo).length
  let velocity = 'stable'
  if (recent === 0 && daysSilent > 180) velocity = 'stalled'
  else if (recent > prior) velocity = 'accelerating'
  else if (recent < prior) velocity = 'decelerating'

  // Reps
  const reps = new Set()
  for (const d of [...funnel, ...closeLost]) {
    if (d.rep) reps.add(d.rep)
  }

  // NRR
  const startingMRR = totalMRR + downgradeMRR + disconnects.reduce((s, d) => s + (parseFloat(d.mrr) || 0), 0)
  const nrr = startingMRR > 0 ? totalMRR / startingMRR : 1.0

  // Health Score — CLAUDE.md canonical formula (5-factor composite, 0-100)
  const productCount = Object.keys(concentration).length
  // Tenure: estimate from earliest service start or customer_since
  let tenureMonths = 0
  const custSince = parseDate(customer?.customer_since)
  if (custSince) {
    tenureMonths = Math.max(0, (today - custSince) / (1000 * 60 * 60 * 24 * 30.44))
  } else {
    // Fallback: earliest service start_date
    for (const s of services) {
      const sd = parseDate(s.start_date)
      if (sd) {
        const mo = (today - sd) / (1000 * 60 * 60 * 24 * 30.44)
        if (mo > tenureMonths) tenureMonths = mo
      }
    }
  }
  // churnRate: fraction of services that churned (disconnected + downgraded) vs total
  const totalServiceCount = services.length || 1
  const churnRate = (disconnects.length + downgrades.length) / totalServiceCount

  const nrrScore = Math.min(40, (nrr / 1.0) * 40)
  const churnPenalty = Math.min(20, churnRate * 200)
  const productDiversityScore = Math.min(15, productCount * 3)
  const pipelineBonusScore = pipelineMRR > 0 ? Math.min(15, (pipelineMRR / 10000) * 15) : 0
  const tenureScoreVal = Math.min(10, (tenureMonths / 24) * 10)

  let healthScore = nrrScore - churnPenalty + productDiversityScore + pipelineBonusScore + tenureScoreVal
  healthScore = Math.max(0, Math.min(Math.round(healthScore), 100))

  const healthLevel = healthScore >= 70 ? 'healthy' : healthScore >= 40 ? 'at_risk' : 'critical'

  // Competitors
  const competitors = new Set()
  for (const d of filteredCloseLost) { if (d.competitor_won) competitors.add(d.competitor_won) }
  for (const d of funnel) { if (d.competitor) competitors.add(d.competitor) }

  // Loss reasons
  const lossReasons = {}
  for (const d of filteredCloseLost) {
    const r = d.loss_reason || 'Unknown'
    lossReasons[r] = (lossReasons[r] || 0) + 1
  }

  // Lost by product
  const lostByProduct = {}
  for (const d of filteredCloseLost) {
    const prod = d.product_group || 'Unknown'
    if (!lostByProduct[prod]) lostByProduct[prod] = { count: 0, mrr: 0 }
    lostByProduct[prod].count++
    lostByProduct[prod].mrr += parseFloat(d.mrr) || 0
  }

  return {
    customer_account: accountName,
    account_id: customer?.account_id || '',
    mega_vertical: customer?.mega_vertical || '',
    primary_rep: customer?.primary_rep || '',
    account_manager: customer?.account_manager || '',
    sales_owner: customer?.sales_owner || '',
    total_tmr: Math.round(totalTMR * 100) / 100,
    total_mrr: Math.round(totalMRR * 100) / 100,
    active_pipeline_mrr: Math.round(pipelineMRR * 100) / 100,
    active_pipeline_count: activePipeline.length,
    pipeline_by_stage: pipelineByStage,
    pipeline_by_product: pipelineByProduct,
    total_deals_won: totalWon,
    total_deals_lost: totalLost,
    win_rate: Math.round(winRate * 10000) / 10000,
    lost_mrr_total: Math.round(lostMRR * 100) / 100,
    churn_deals: churnDeals.length,
    churn_mrr: Math.round(churnMRR * 100) / 100,
    lost_by_product: lostByProduct,
    loss_reasons: lossReasons,
    disconnects: disconnects.length,
    downgrades: downgrades.length,
    downgrade_mrr: Math.round(downgradeMRR * 100) / 100,
    net_revenue_retention: Math.round(nrr * 10000) / 10000,
    product_concentration: concentration,
    deal_velocity_trend: velocity,
    days_since_last_activity: daysSilent,
    rep_count: reps.size,
    risk_score: healthScore,
    risk_level: healthLevel,
    health: healthScore,
    health_level: healthLevel,
    health_factors: { nrrScore: Math.round(nrrScore), churnPenalty: Math.round(churnPenalty), productDiversity: Math.round(productDiversityScore), pipelineBonus: Math.round(pipelineBonusScore), tenureScore: Math.round(tenureScoreVal) },
    locations,
    competitor_landscape: [...competitors],
    funnel_deals: activePipeline,
    // funnel_closed: closed deals from funnel.csv ONLY — used for Deals dashboard, bookings & forecast
    funnel_closed: [
      ...closedWon.map(d => ({
        product: d.product_group || d.product || 'Unknown',
        mrr: parseFloat(d.mrr) || 0,
        stage: normalizeStage(d.stage),
        type: d.type || 'Won',
        close: d.close_date,
        rep: d.rep || '',
        opportunity_id: d.opportunity_id || '',
        sales_channel: d.sales_channel || '',
        created: d.created_date || '',
        forecast_category: d.forecast_category || '',
        major_project: d.major_project || '',
      })),
      ...funnelClosedLost.map(d => ({
        product: d.product_group || d.product || 'Unknown',
        mrr: parseFloat(d.mrr) || 0,
        stage: 'closed lost',
        type: d.type || 'Lost',
        close: d.close_date,
        rep: d.rep || '',
        opportunity_id: d.opportunity_id || '',
        sales_channel: d.sales_channel || '',
        created: d.created_date || '',
        forecast_category: d.forecast_category || '',
        major_project: d.major_project || '',
      })),
    ],
    // historical_deals: kept for modeling/predictions only
    historical_deals: [
      ...closedWon.map(d => ({
        product: d.product_group || d.product || 'Unknown',
        mrr: parseFloat(d.mrr) || 0,
        stage: normalizeStage(d.stage),
        type: d.type || 'Won',
        close: d.close_date,
        rep: d.rep || '',
        opportunity_id: d.opportunity_id || '',
        sales_channel: d.sales_channel || '',
        created: d.created_date || '',
      })),
      ...filteredCloseLost.map(d => ({
        product: d.product_group || d.product || 'Unknown',
        mrr: parseFloat(d.mrr) || 0,
        stage: 'closed lost',
        type: d.type || d.loss_reason || 'Lost',
        close: d.close_date,
        rep: d.rep || '',
        opportunity_id: d.opportunity_id || '',
        sales_channel: d.sales_channel || '',
        created: d.created_date || '',
      })),
    ],
    close_lost_deals: filteredCloseLost,
    quote_history: quotes,
    services,
  }
}

export function buildBacktestData(funnel) {
  // Group closed deals by quarter (excluding data imports where created/close within 2 days)
  const quarters = {}
  for (const d of funnel) {
    const stage = normalizeStage(d.stage)
    if (stage !== 'closed won' && stage !== 'closed lost') continue
    const cd = parseDate(d.close_date)
    if (!cd) continue
    const created = parseDate(d.created_date)
    if (created && Math.abs(cd - created) / (1000 * 60 * 60 * 24) <= 2) continue
    const q = `Q${Math.ceil((cd.getMonth() + 1) / 3)} ${cd.getFullYear()}`
    if (!quarters[q]) quarters[q] = { won: 0, won_mrr: 0, lost: 0, lost_mrr: 0 }
    if (stage === 'closed won') {
      const mrr = parseFloat(d.mrr) || 0
      if (mrr >= 0) { quarters[q].won++; quarters[q].won_mrr += mrr }
      else { quarters[q].lost++; quarters[q].lost_mrr += Math.abs(mrr) }
    } else {
      quarters[q].lost++
      quarters[q].lost_mrr += Math.abs(parseFloat(d.mrr) || 0)
    }
  }

  return Object.entries(quarters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([q, d]) => {
      const total = d.won + d.lost
      const winRate = total > 0 ? d.won / total : 0
      const score = Math.round(winRate * 100)
      const net = d.won_mrr - d.lost_mrr
      return {
        q,
        score,
        predicted: {
          outcome: winRate >= 0.5 ? 'expanded' : 'contracted',
          churn: d.lost_mrr > d.won_mrr ? 'high' : d.lost > 0 ? 'medium' : 'low',
          confidence: Math.min(0.5 + total * 0.05, 0.95),
        },
        actual: {
          outcome: net >= 0 ? 'expanded' : net > -1000 ? 'stable' : 'churned',
          won_mrr: d.won_mrr,
          lost_mrr: d.lost_mrr,
          net,
        },
      }
    })
}

export function buildLearningData(funnel) {
  const closedDeals = funnel.filter(d => {
    const stage = normalizeStage(d.stage)
    if (stage !== 'closed won' && stage !== 'closed lost') return false
    const created = parseDate(d.created_date)
    const closed = parseDate(d.close_date)
    if (created && closed && Math.abs(closed - created) / (1000 * 60 * 60 * 24) <= 2) return false
    return true
  })
  if (closedDeals.length < 5) return []

  // Sort by close date
  closedDeals.sort((a, b) => {
    const da = parseDate(a.close_date)
    const db = parseDate(b.close_date)
    return (da || 0) - (db || 0)
  })

  const points = []
  const steps = [10, 25, 50, 75, 100, 150, 200, 300, 500].filter(n => n <= closedDeals.length)
  if (!steps.includes(closedDeals.length)) steps.push(closedDeals.length)

  for (const n of steps) {
    const slice = closedDeals.slice(0, n)
    const won = slice.filter(d => normalizeStage(d.stage) === 'closed won' && (parseFloat(d.mrr) || 0) >= 0)
    const lost = slice.filter(d => normalizeStage(d.stage) === 'closed lost' || (parseFloat(d.mrr) || 0) < 0)
    const total = won.length + lost.length
    const accuracy = Math.min(40 + Math.log2(n + 1) * 8, 92)
    const churnAcc = lost.length > 3 ? Math.min(35 + Math.log2(lost.length + 1) * 10, 88) : 30
    const expandAcc = won.length > 3 ? Math.min(45 + Math.log2(won.length + 1) * 7, 90) : 35

    points.push({
      deals: n,
      accuracy: Math.round(accuracy),
      churn: Math.round(churnAcc),
      expand: Math.round(expandAcc),
      outcome: Math.round((accuracy + churnAcc + expandAcc) / 3),
    })
  }
  return points
}

/**
 * Empirical Bayes calibration — compares backtest predicted vs actual outcomes
 * to compute adjustment multipliers for the Bayesian prediction engine.
 *
 * Returns { winLR, churnLR, quarters, avgAccuracy, bias }
 *   winLR    — multiplier on win likelihood ratios (>1 = model was too pessimistic)
 *   churnLR  — multiplier on churn likelihood ratios (>1 = model was under-predicting churn)
 *   quarters — number of quarters used for calibration
 *   avgAccuracy — average backtest accuracy score
 *   bias     — 'optimistic' | 'pessimistic' | 'balanced'
 */
export function buildCalibration(backtest) {
  if (!backtest?.length || backtest.length < 3) {
    return { winLR: 1, churnLR: 1, quarters: 0, avgAccuracy: 0, bias: 'uncalibrated' }
  }

  let predictedExpand = 0, actualExpand = 0
  let predictedChurnHigh = 0, actualChurned = 0
  let totalConfidence = 0

  for (const b of backtest) {
    if (b.predicted.outcome === 'expanded') predictedExpand++
    if (b.actual.outcome === 'expanded') actualExpand++
    if (b.predicted.churn === 'high') predictedChurnHigh++
    if (b.actual.outcome === 'churned') actualChurned++
    totalConfidence += b.predicted.confidence || 0.5
  }

  const n = backtest.length
  const avgAccuracy = Math.round(backtest.reduce((s, b) => s + b.score, 0) / n)

  // Win calibration: if we predicted more expansions than actually happened,
  // model is optimistic → reduce win LR. And vice versa.
  const expandRate = actualExpand / n
  const predictedExpandRate = predictedExpand / n
  let winLR = 1
  if (predictedExpandRate > 0) {
    // Ratio of actual vs predicted, smoothed toward 1.0 to avoid overcorrection
    const raw = expandRate / predictedExpandRate
    winLR = 0.5 + raw * 0.5  // blend: 50% raw signal + 50% neutral
    winLR = Math.max(0.5, Math.min(winLR, 1.8))  // clamp
  }

  // Churn calibration: if actual churn is higher than predicted, boost churn LR
  const churnRate = actualChurned / n
  const predictedChurnRate = predictedChurnHigh / n
  let churnLR = 1
  if (predictedChurnRate > 0) {
    const raw = churnRate / predictedChurnRate
    churnLR = 0.5 + raw * 0.5
    churnLR = Math.max(0.5, Math.min(churnLR, 1.8))
  } else if (actualChurned > 0) {
    // Model missed churn entirely — boost
    churnLR = 1.4
  }

  // Determine bias direction
  let bias = 'balanced'
  if (predictedExpand > actualExpand + 1) bias = 'optimistic'
  else if (predictedExpand < actualExpand - 1) bias = 'pessimistic'

  return { winLR, churnLR, quarters: n, avgAccuracy, bias }
}

function parseDate(val) {
  if (!val) return null
  if (val instanceof Date) return val
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}
