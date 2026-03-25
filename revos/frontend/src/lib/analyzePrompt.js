import { pc } from '../components/shared/ChartTheme'

/**
 * Builds a compact prompt for Claude to analyze an account and return
 * structured strategy recommendations.
 */
export function buildAnalyzePrompt(a) {
  const lines = []

  lines.push(`Analyze this B2B telecom/connectivity account and provide strategic recommendations.`)
  lines.push(``)
  lines.push(`ACCOUNT: ${a.name}`)
  lines.push(`Vertical: ${a.vertical} | TMR: $${Math.round(a.tmr).toLocaleString()} | NRR: ${pc(a.nrr)}`)
  lines.push(`Risk: ${a.risk_score}/100 (${a.risk_level}) | Win Rate: ${pc(a.win_rate)} (${a.won}W/${a.lost}L)`)
  lines.push(`Rep: ${a.rep} | Manager: ${a.manager}`)
  lines.push(``)

  // Pipeline
  if (a.active_deals?.length > 0) {
    lines.push(`ACTIVE PIPELINE (${a.active_deals.length} deals, $${Math.round(a.pipeline_mrr).toLocaleString()}/mo):`)
    for (const d of a.active_deals.slice(0, 10)) {
      lines.push(`  - ${d.product}: $${Math.round(d.mrr)}/mo @ ${d.stage} (${d.forecast}) close ${d.close || 'TBD'}`)
    }
    lines.push(``)
  }

  // Products installed
  if (a.products?.length > 0) {
    lines.push(`INSTALLED PRODUCTS: ${a.products.join(', ')}`)
    const conc = Object.entries(a.concentration || {})
    if (conc.length > 0) {
      lines.push(`Product mix: ${conc.map(([p, d]) => `${p} $${Math.round(d.mrr)}/mo (${pc(d.pct)})`).join(', ')}`)
    }
    lines.push(``)
  }

  // Historical wins/losses summary
  if (a.historical_deals?.length > 0) {
    const won = a.historical_deals.filter(d => d.stage === 'closed won' && d.mrr >= 0)
    const lost = a.historical_deals.filter(d => d.stage === 'closed lost')
    const churn = a.historical_deals.filter(d => d.mrr < 0)
    lines.push(`DEAL HISTORY: ${a.historical_deals.length} total | ${won.length} won | ${lost.length} lost | ${churn.length} churn/downgrade`)
    if (lost.length > 0) {
      const lostProducts = {}
      for (const d of lost) lostProducts[d.product] = (lostProducts[d.product] || 0) + 1
      lines.push(`Lost by product: ${Object.entries(lostProducts).map(([p, c]) => `${p}(${c})`).join(', ')}`)
    }
    if (churn.length > 0) {
      lines.push(`Churn MRR: -$${Math.round(churn.reduce((s, d) => s + Math.abs(d.mrr), 0))}/mo across ${churn.length} events`)
    }
    lines.push(``)
  }

  // Engagement
  if (a.engagement) {
    const eng = a.engagement
    lines.push(`ENGAGEMENT: ${eng.total} total activities | ${eng.contacts} contacts | Last: ${eng.lastDate || 'unknown'}`)
    if (eng.byType) {
      lines.push(`By type: ${Object.entries(eng.byType).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}(${c})`).join(', ')}`)
    }
    // Trend
    if (eng.timeline?.length >= 4) {
      const recent = eng.timeline.slice(-2).reduce((s, t) => s + t.count, 0)
      const earlier = eng.timeline.slice(-4, -2).reduce((s, t) => s + t.count, 0)
      if (recent > earlier * 1.5) lines.push(`Trend: INCREASING engagement`)
      else if (recent < earlier * 0.5) lines.push(`Trend: DECLINING engagement`)
      else lines.push(`Trend: Stable engagement`)
    }
    lines.push(``)
  }

  // Locations summary
  if (a.locations?.length > 0) {
    const onNet = a.locations.filter(l => l.status === 'on-net').length
    const nearNet = a.locations.filter(l => l.status === 'near-net').length
    const offNet = a.locations.filter(l => l.status === 'off-net').length
    lines.push(`LOCATIONS: ${a.locations.length} total | ${onNet} on-net | ${nearNet} near-net | ${offNet} off-net`)
    lines.push(``)
  }

  // Engagement urgency signals
  const urgencySignals = []
  if (a.engagement) {
    const eng = a.engagement
    const daysSinceLast = eng.lastDate ? Math.floor((new Date() - new Date(eng.lastDate)) / (1000 * 60 * 60 * 24)) : null
    if (daysSinceLast !== null) {
      if (daysSinceLast > 180) urgencySignals.push(`CRITICAL: No engagement in ${daysSinceLast} days`)
      else if (daysSinceLast > 90) urgencySignals.push(`WARNING: ${daysSinceLast} days since last engagement`)
      else if (daysSinceLast > 30) urgencySignals.push(`${daysSinceLast} days since last engagement`)
    }
    if (eng.total < 5) urgencySignals.push(`Very low engagement volume (${eng.total} total activities)`)
    if (eng.contacts <= 1) urgencySignals.push(`Single-threaded (only ${eng.contacts} contact${eng.contacts === 1 ? '' : 's'})`)
  } else {
    urgencySignals.push(`NO ENGAGEMENT DATA — account may be unmanaged`)
  }
  // Combine with pipeline/service signals
  if (a.active_deals?.length > 0 && (!a.engagement || a.engagement.total < 3)) {
    urgencySignals.push(`Active pipeline ($${Math.round(a.pipeline_mrr)}/mo) with minimal engagement — deals at risk`)
  }
  if (a.disconnects > 0 && (!a.engagement || !a.engagement.lastDate || (new Date() - new Date(a.engagement.lastDate)) / (1000 * 60 * 60 * 24) > 60)) {
    urgencySignals.push(`${a.disconnects} disconnect(s) with no recent follow-up engagement`)
  }

  if (urgencySignals.length > 0) {
    lines.push(`ENGAGEMENT URGENCY: ${urgencySignals.join(' | ')}`)
    lines.push(``)
  }

  // Risk signals
  const risks = []
  if (a.days_silent > 90) risks.push(`${a.days_silent}d silent`)
  if (a.disconnects > 0) risks.push(`${a.disconnects} disconnects`)
  if (a.downgrades > 0) risks.push(`${a.downgrades} downgrades (-$${a.downgrade_mrr}/mo)`)
  if (a.nrr < 0.9) risks.push(`Low NRR ${pc(a.nrr)}`)
  if (a.velocity === 'stalled') risks.push('Stalled velocity')
  if (risks.length > 0) {
    lines.push(`RISK SIGNALS: ${risks.join(' | ')}`)
    lines.push(``)
  }

  lines.push(`Respond with ONLY a JSON object (no markdown, no explanation) in this exact format:`)
  lines.push(`{`)
  lines.push(`  "summary": "2-3 sentence strategic assessment of this account",`)
  lines.push(`  "health": "growing|stable|contracting|at_risk",`)
  lines.push(`  "actions": [`)
  lines.push(`    {`)
  lines.push(`      "title": "Short action title",`)
  lines.push(`      "detail": "Specific, actionable recommendation with reasoning",`)
  lines.push(`      "type": "expand|protect|recover|coach",`)
  lines.push(`      "urgency": "immediate|this_quarter|next_quarter",`)
  lines.push(`      "impact_mrr": estimated monthly revenue impact as number`)
  lines.push(`    }`)
  lines.push(`  ],`)
  lines.push(`  "cross_sell": [`)
  lines.push(`    {`)
  lines.push(`      "product": "Product name they should buy",`)
  lines.push(`      "reason": "Why this product fits based on their data",`)
  lines.push(`      "confidence": 0.0 to 1.0`)
  lines.push(`    }`)
  lines.push(`  ],`)
  lines.push(`  "risks": [`)
  lines.push(`    {`)
  lines.push(`      "signal": "Risk description",`)
  lines.push(`      "severity": "high|medium|low",`)
  lines.push(`      "mitigation": "What to do about it"`)
  lines.push(`    }`)
  lines.push(`  ]`)
  lines.push(`}`)
  lines.push(``)
  lines.push(`Generate 3-5 actions, 1-3 cross-sell opportunities, and 1-3 risks. Be specific to THIS account's data — no generic advice. Reference actual products, MRR values, and patterns from the data above.`)
  lines.push(``)
  lines.push(`IMPORTANT: Factor engagement frequency into urgency. Accounts with low/no engagement AND active pipeline or recent disconnects should have "immediate" urgency actions. Combine engagement recency, pipeline activity, and service health when setting urgency levels.`)

  return lines.join('\n')
}
