import { useState, useEffect, useMemo, useRef } from 'react'
import { T } from '../lib/constants'
import { cn } from '@/lib/utils'
import { $, $k, pc } from '../components/shared/ChartTheme'
import { SpotlightCard, GlowBadge, AnimatedBorderCard, Sparkline, ProgressRing } from '../components/effects'
import { useAnimatedCounter } from '../components/effects/use-animated-counter'

// ── Math helpers ───────────────────────────────────────────────
const sigmoid = x => 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))))
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0)
const predict = (x, model) => sigmoid(dot(model.weights, x) + model.bias)

function extractFeatures(deal, stats) {
  const ov = stats.overall
  const vwr = stats.vwr[deal.vertical] ?? ov
  const pwr = stats.pwr[deal.product] ?? ov
  const szp = stats.valsSorted.length ? stats.valsSorted.findIndex(v => v >= deal.dealValue) / stats.valsSorted.length : 0.5
  const dn = deal.daysOpen != null ? Math.max(0, Math.min(1, 1 - (deal.daysOpen - stats.daysMean) / (stats.daysStd * 3 + 1))) : 0.5
  const cwr = stats.comboR[`${deal.vertical}|${deal.product}`] ?? ov
  return [vwr, pwr, szp < 0 ? 1 : szp, dn, cwr]
}

// ── Demo fallback model ────────────────────────────────────────
const DEMO_MODEL = {
  generatedAt: '2026-03-18T00:00:00Z', source: 'demo',
  stats: {
    overall: 0.52,
    vwr: { 'Enterprise Telco': 0.68, 'Regional ISP': 0.54, 'Cable MSO': 0.61, 'Neutral Host': 0.44 },
    pwr: { 'Metro Ethernet': 0.71, DIA: 0.58, 'SD-WAN': 0.63, MPLS: 0.49 },
    comboR: { 'Enterprise Telco|Metro Ethernet': 0.79, 'Regional ISP|DIA': 0.55, 'Cable MSO|SD-WAN': 0.66, 'Neutral Host|MPLS': 0.38 },
    valsSorted: [2000, 4000, 6000, 8000, 10000, 12000, 15000, 20000], daysMean: 28, daysStd: 14,
  },
  vertModels: {
    'Enterprise Telco': { weights: [1.2, 0.9, -0.3, 0.4, 1.1], bias: -0.5 },
    'Regional ISP': { weights: [0.8, 1.1, -0.2, 0.3, 0.7], bias: -0.3 },
  },
  globalModel: { weights: [0.9, 0.8, -0.25, 0.35, 0.85], bias: -0.35 },
  churnModel: { weights: [1.1, 0.9, -0.3, 0.4, 0.8], bias: -0.4 },
}

// ── Scoring functions ──────────────────────────────────────────
const scoreWinProb = (deal, md) => Math.round(predict(extractFeatures(deal, md.stats), md.vertModels[deal.vertical] || md.globalModel) * 100)
const scoreChurnRisk = (deal, md) => {
  const s = md.stats
  const mtmNorm = Math.min(1, (deal.mtmDays || 0) / 90)
  const touchNorm = deal.daysSinceContact != null ? Math.min(1, deal.daysSinceContact / 60) : 0.5
  const szp = s.valsSorted.length ? s.valsSorted.findIndex(v => v >= (deal.dealValue || 0)) / s.valsSorted.length : 0.5
  const vcr = 1 - (s.vwr[deal.vertical] ?? s.overall)
  return Math.round(predict([mtmNorm, touchNorm, szp < 0 ? 1 : szp, vcr, 0.5], md.churnModel) * 100)
}

const buildWinBreakdown = (deal, md) => {
  const s = md.stats
  const vwr = s.vwr[deal.vertical] ?? s.overall, pwr = s.pwr[deal.product] ?? s.overall
  const cwr = s.comboR[`${deal.vertical}|${deal.product}`] ?? s.overall
  const szp = s.valsSorted.length ? s.valsSorted.findIndex(v => v >= deal.dealValue) / s.valsSorted.length : 0.5
  return [
    { icon: '\ud83d\udcca', label: 'Vertical win rate', value: `${Math.round(vwr * 100)}%`, sub: deal.vertical, score: Math.round(vwr * 100) },
    { icon: '\u2705', label: 'Product win rate', value: `${Math.round(pwr * 100)}%`, sub: deal.product, score: Math.round(pwr * 100) },
    { icon: '\u2694\ufe0f', label: 'Vertical \u00d7 Product', value: `${Math.round(cwr * 100)}%`, sub: `${deal.vertical} + ${deal.product}`, score: Math.round(cwr * 100) },
    { icon: '\ud83d\udcb0', label: 'Deal size percentile', value: `${Math.round((szp < 0 ? 1 : szp) * 100)}th`, sub: `$${(deal.dealValue || 0).toLocaleString()} MRR`, score: Math.round((szp < 0 ? 1 : szp) * 100) },
    { icon: '\u23f1', label: 'Days open', value: deal.daysOpen != null ? `${deal.daysOpen}d` : '\u2014', sub: `Avg close: ${s.daysMean}d`, score: deal.daysOpen != null ? Math.round(Math.max(0, Math.min(1, 1 - (deal.daysOpen - s.daysMean) / (s.daysStd * 3 + 1))) * 100) : 50 },
  ]
}

const buildChurnBreakdown = (deal, md) => {
  const s = md.stats
  const vwr = s.vwr[deal.vertical] ?? s.overall
  return [
    { icon: '\u23f0', label: 'Days in MtM', value: `${deal.mtmDays || 0}d`, sub: 'churn risk rises after 60d', score: Math.min(100, Math.round(((deal.mtmDays || 0) / 90) * 100)) },
    { icon: '\ud83d\udcc9', label: 'Days since contact', value: deal.daysSinceContact != null ? `${deal.daysSinceContact}d` : '\u2014', sub: 'no renewal discussion logged', score: Math.min(100, Math.round(((deal.daysSinceContact || 0) / 60) * 100)) },
    { icon: '\ud83c\udfe2', label: 'Vertical churn rate', value: `${Math.round((1 - vwr) * 100)}%`, sub: deal.vertical, score: Math.round((1 - vwr) * 100) },
    { icon: '\ud83d\udcb0', label: 'MRR at risk', value: `$${(deal.dealValue || 0).toLocaleString()}`, sub: 'total exposed revenue', score: 80 },
    { icon: '\ud83d\udee1\ufe0f', label: 'Save window', value: deal.mtmDays < 60 ? 'Open' : 'Closing', sub: 'save rate drops after day 60', score: deal.mtmDays < 60 ? 30 : 85 },
  ]
}

// ── Demo deal profiles & card content ──────────────────────────
const DEMO_CARDS = [
  // ── DORMANT ──────────────────────────────────────────
  {
    card: {
      type: 'prospect_1', label: 'DORMANT', labelColor: T.blue, mode: 'Dormant',
      account: 'Pacific Fiber Networks', tagline: '3 new locations detected \u00b7 Competitor shift at HQ',
      signals: [
        { icon: '\ud83d\udccd', text: 'Added 3 locations in Sacramento metro (last 30 days)' },
        { icon: '\u26a1', text: 'HQ site moved on-net \u2014 AT&T lost coverage on Nov build-out' },
        { icon: '\ud83d\udcc9', text: 'Lost 2 competitor bids in 2023 \u2014 both on price, not product' },
        { icon: '\ud83d\udcb0', text: 'Historically buys in $8K\u2013$14K MRR range per location' },
      ],
      suggestedMove: 'Reach out re: new Sacramento sites. Lead with the HQ on-net news \u2014 they\u2019ve been price-sensitive, not product-sensitive. Anchor to $10K MRR per site.',
      cta: 'Draft Outreach', hasWinProb: false, hasChurnRisk: false,
    },
    dealProfile: { vertical: 'Regional ISP', product: 'Metro Ethernet', dealValue: 10000, daysOpen: null, mtmDays: null, daysSinceContact: null },
  },
  {
    card: {
      type: 'prospect_2', label: 'DORMANT', labelColor: T.blue, mode: 'Dormant',
      account: 'Redwood Municipal Broadband', tagline: 'New logo \u00b7 RFP open for dark fiber backbone',
      signals: [
        { icon: '\ud83c\udfaf', text: 'Open RFP for 10G dark fiber ring connecting 5 city buildings \u2014 deadline Apr 15' },
        { icon: '\ud83c\udfe2', text: 'All 5 locations within 0.5mi of your existing fiber routes' },
        { icon: '\ud83d\udcca', text: 'Municipal broadband vertical win rate: 72% when on-net advantage exists' },
        { icon: '\ud83d\udcb0', text: 'Estimated MRR: $18K\u2013$24K for full ring + maintenance' },
      ],
      suggestedMove: 'Submit RFP response by Apr 10. Lead with on-net proximity and SLA guarantees \u2014 municipals prioritize reliability over price.',
      cta: 'Draft Outreach', hasWinProb: false, hasChurnRisk: false,
    },
    dealProfile: { vertical: 'Public Sector', product: 'Dark Fiber', dealValue: 20000, daysOpen: null, mtmDays: null, daysSinceContact: null },
  },
  {
    card: {
      type: 'prospect_3', label: 'DORMANT', labelColor: T.blue, mode: 'Dormant',
      account: 'Summit Health Partners', tagline: 'Healthcare expansion \u00b7 3 new clinic sites announced',
      signals: [
        { icon: '\ud83c\udfe5', text: '3 new urgent care clinics opening in Denver metro \u2014 Q2 2026 target' },
        { icon: '\ud83d\udd12', text: 'Healthcare requires HIPAA-compliant connectivity \u2014 your SD-WAN meets this' },
        { icon: '\ud83d\udd04', text: 'Similar win: MedFirst Group, 4 clinics, $9,200 MRR, 22-day close' },
        { icon: '\ud83d\udccd', text: '2 of 3 sites are on-net today \u2014 third is 0.4mi from POP' },
      ],
      suggestedMove: 'Initiate contact with their IT Director. Lead with HIPAA-compliant SD-WAN bundle and reference the MedFirst deployment.',
      cta: 'Draft Outreach', hasWinProb: false, hasChurnRisk: false,
    },
    dealProfile: { vertical: 'Healthcare', product: 'SD-WAN', dealValue: 9200, daysOpen: null, mtmDays: null, daysSinceContact: null },
  },
  // ── GROWTH ───────────────────────────────────────────
  {
    card: {
      type: 'growth_1', label: 'GROWTH', labelColor: T.green, mode: 'Growth',
      account: 'Cascade Broadband Co.', tagline: '2 locations underserved \u00b7 Competitor displacement opportunity',
      signals: [
        { icon: '\ud83c\udfe2', text: 'Phoenix (AZ-04): Currently on Lumen DIA 500Mb \u2014 your 1Gb fiber is on-net same building' },
        { icon: '\ud83c\udfe2', text: 'Tucson (AZ-07): Off-net today, new on-net POP live Q1 2026 \u2014 0.3mi from their office' },
        { icon: '\ud83d\udd04', text: 'Similar displacement win in Mesa, AZ \u2014 $6,200 MRR, 14-day close' },
        { icon: '\ud83d\udca1', text: 'Recommend: Metro Ethernet 1Gb at Phoenix, SD-WAN bundle at Tucson on activation' },
      ],
      suggestedMove: 'Lead with Phoenix \u2014 it\u2019s a direct upgrade at the same building, easy yes. Use that to open Tucson conversation before your POP goes live.',
      cta: 'Build Quote', ctaSecondary: 'Build Outreach', hasWinProb: true, hasChurnRisk: false,
    },
    dealProfile: { vertical: 'Enterprise Telco', product: 'Metro Ethernet', dealValue: 12400, daysOpen: 18, mtmDays: null, daysSinceContact: null },
  },
  {
    card: {
      type: 'growth_2', label: 'GROWTH', labelColor: T.green, mode: 'Growth',
      account: 'Pinnacle Data Centers', tagline: '$8.4K MRR customer \u00b7 Cross-connect expansion in progress',
      signals: [
        { icon: '\ud83d\udcca', text: 'Currently on DIA 1Gb at 2 sites ($8,400 MRR) \u2014 98.7% utilization on primary' },
        { icon: '\u26a1', text: 'Customer submitted a 10G wavelength inquiry through portal last week' },
        { icon: '\ud83c\udfe2', text: 'New data hall opening in Ashburn, VA \u2014 needs connectivity by May 2026' },
        { icon: '\ud83d\udcb0', text: 'Wavelength + cross-connect bundle estimated at $14K\u2013$18K MRR' },
      ],
      suggestedMove: 'Respond to the 10G inquiry with a bundled proposal \u2014 wavelength + Ashburn cross-connect. Offer a 3-year term discount to lock in before they RFP.',
      cta: 'Build Quote', ctaSecondary: 'Build Outreach', hasWinProb: true, hasChurnRisk: false,
    },
    dealProfile: { vertical: 'Enterprise Telco', product: 'Wavelength', dealValue: 16000, daysOpen: 8, mtmDays: null, daysSinceContact: null },
  },
  {
    card: {
      type: 'growth_3', label: 'GROWTH', labelColor: T.green, mode: 'Growth',
      account: 'Atlas Tower Co', tagline: 'SD-WAN deal in Propose stage \u00b7 $6.8K MRR',
      signals: [
        { icon: '\ud83d\udcc8', text: 'SD-WAN 12-site deal at $6,800 MRR \u2014 moved to Propose stage 5 days ago' },
        { icon: '\u2705', text: 'Historical win rate for SD-WAN in this vertical: 63%' },
        { icon: '\ud83d\udd04', text: 'Customer already on your DIA at 4 locations \u2014 strong existing relationship' },
        { icon: '\ud83d\udca1', text: 'Decision maker (VP Ops) responded positively to last proposal meeting' },
      ],
      suggestedMove: 'Schedule a technical review with their network team. The deal is in proposal \u2014 address any remaining objections and push for verbal this week.',
      cta: 'Build Quote', ctaSecondary: 'Build Outreach', hasWinProb: true, hasChurnRisk: false,
    },
    dealProfile: { vertical: 'Neutral Host', product: 'SD-WAN', dealValue: 6800, daysOpen: 25, mtmDays: null, daysSinceContact: null },
  },
  // ── RETENTION ────────────────────────────────────────
  {
    card: {
      type: 'retention_1', label: 'RETENTION', labelColor: T.yellow, mode: 'Retention',
      account: 'TriState Infrastructure LLC', tagline: '2 services MtM \u00b7 Contract window closing in 34 days',
      signals: [
        { icon: '\u23f0', text: 'DIA 200Mb at Dallas-01 went MtM 47 days ago \u2014 no renewal discussion logged' },
        { icon: '\u23f0', text: 'MPLS 3-site bundle expires Dec 31 \u2014 $11,400 MRR at risk' },
        { icon: '\ud83d\udcca', text: 'Accounts in this pattern churn within 90 days 68% of the time without contact' },
        { icon: '\ud83d\udee1\ufe0f', text: 'Save rate jumps to 81% when renewal offer made before day 60 of MtM' },
      ],
      suggestedMove: 'Contact by Friday. Offer 2-year renewal with 5% rate lock \u2014 historicals show they respond to pricing stability over upgrades. Don\u2019t lead with new products.',
      cta: 'Build Renewal Offer', hasWinProb: true, hasChurnRisk: true,
    },
    dealProfile: { vertical: 'Enterprise Telco', product: 'MPLS', dealValue: 11400, daysOpen: null, mtmDays: 47, daysSinceContact: 47 },
  },
  {
    card: {
      type: 'retention_2', label: 'RETENTION', labelColor: T.yellow, mode: 'Retention',
      account: 'Meridian Telecom Group', tagline: '$22K MRR at risk \u00b7 2 trouble tickets unresolved',
      signals: [
        { icon: '\ud83d\udea8', text: '2 open trouble tickets \u2014 latency issues at Chicago-02 and Denver-01 for 12 days' },
        { icon: '\ud83d\udcc9', text: 'NRR dropped to 87% this quarter \u2014 they downgraded 1 circuit last month' },
        { icon: '\ud83d\udcb0', text: '$22,400 MRR across 6 locations \u2014 top 10% account by revenue' },
        { icon: '\u23f0', text: 'Master agreement renewal due in 60 days \u2014 competitor pricing shared internally' },
      ],
      suggestedMove: 'Escalate the open tickets immediately \u2014 service issues are the #1 churn driver for high-value accounts. Once resolved, schedule a QBR to discuss renewal terms before competitor gains traction.',
      cta: 'Build Renewal Offer', hasWinProb: true, hasChurnRisk: true,
    },
    dealProfile: { vertical: 'Enterprise Telco', product: 'DIA', dealValue: 22400, daysOpen: null, mtmDays: 30, daysSinceContact: 12 },
  },
  {
    card: {
      type: 'retention_3', label: 'RETENTION', labelColor: T.yellow, mode: 'Retention',
      account: 'Clearwater Communications', tagline: '90 days silent \u00b7 Contract expired \u00b7 $7.2K MRR exposed',
      signals: [
        { icon: '\u23f0', text: 'No activity in 90 days \u2014 last touch was a billing inquiry on Dec 18' },
        { icon: '\ud83d\udcdc', text: 'MPLS contract expired 45 days ago \u2014 now month-to-month on all 3 circuits' },
        { icon: '\ud83d\udcca', text: 'Accounts at 90+ days silence have 74% churn rate within the next quarter' },
        { icon: '\u2694\ufe0f', text: 'Spectrum Enterprise submitted a competitive quote to their procurement team' },
      ],
      suggestedMove: 'This is urgent \u2014 call today. Acknowledge the silence, ask about their experience. Offer a loyalty renewal with rate lock and a free bandwidth upgrade on the primary circuit.',
      cta: 'Build Renewal Offer', hasWinProb: true, hasChurnRisk: true,
    },
    dealProfile: { vertical: 'Cable MSO', product: 'MPLS', dealValue: 7200, daysOpen: null, mtmDays: 90, daysSinceContact: 90 },
  },
]

function computeDemoScores(mode, modelData) {
  const s = {}
  DEMO_CARDS.filter(d => d.card.mode === mode).forEach(({ card, dealProfile }) => {
    if (card.hasWinProb) s[card.type] = { winProb: scoreWinProb(dealProfile, modelData), winBreakdown: buildWinBreakdown(dealProfile, modelData) }
    if (card.hasChurnRisk) s[card.type] = { ...s[card.type], churnRisk: scoreChurnRisk(dealProfile, modelData), churnBreakdown: buildChurnBreakdown(dealProfile, modelData) }
  })
  return s
}

// ── Dynamic account ranking engine ──────────────────────────────
const fmt$ = n => n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${n}`

function classifyAccount(acct) {
  const mrr = acct.mrr || 0
  const tmr = acct.tmr || mrr
  const pipelineMrr = acct.pipeline_mrr || 0
  const pipelineCount = acct.pipeline_count || 0
  const deals = acct.active_deals || []
  const winRate = acct.win_rate ?? 0
  const daysSilent = acct.days_silent ?? 0
  const riskScore = acct.risk_score ?? 0
  const riskLevel = acct.risk_level || acct.health_level || 'healthy'
  const velocity = acct.velocity || 'stable'
  const vertical = acct.vertical || 'Unknown'
  const products = acct.products || []
  const churnMrr = acct.churn_mrr || 0
  const disconnects = acct.disconnects || 0
  const nrr = acct.nrr ?? 1.0
  const services = acct.services || []
  const funnelClosed = acct.funnel_closed || []

  // ── Detect MTM and expiring services ──
  const now = new Date()
  const ninetyDaysOut = new Date(now.getTime() + 90 * 86400000)
  const mtmServices = services.filter(s => {
    const exp = s.expDate || s.exp_date || ''
    const term = String(s.term || '').toLowerCase()
    if (term === 'mtm' || term === 'month-to-month' || term === 'month to month') return true
    if (exp) {
      const expDate = new Date(exp)
      return !isNaN(expDate.getTime()) && expDate < now
    }
    return false
  })
  const expiringServices = services.filter(s => {
    const exp = s.expDate || s.exp_date || ''
    if (!exp) return false
    const expDate = new Date(exp)
    return !isNaN(expDate.getTime()) && expDate >= now && expDate <= ninetyDaysOut
  })
  const mtmMrr = mtmServices.reduce((s, svc) => s + (parseFloat(svc.mrr) || 0), 0)
  const expiringMrr = expiringServices.reduce((s, svc) => s + (parseFloat(svc.mrr) || 0), 0)
  const atRiskServiceCount = mtmServices.length + expiringServices.length
  const atRiskMrr = mtmMrr + expiringMrr

  // ── Detect dormancy: no bookings in last 12 months ──
  const twelveMoAgo = new Date(now)
  twelveMoAgo.setMonth(twelveMoAgo.getMonth() - 12)
  const recentBookings = funnelClosed.filter(d => {
    if (!d.close) return false
    const closeDate = new Date(d.close)
    return !isNaN(closeDate.getTime()) && closeDate >= twelveMoAgo && (d.stage || '').toLowerCase().includes('won') && (parseFloat(d.mrr) || 0) >= 0
  })
  const isDormant = tmr > 0 && recentBookings.length === 0

  // RETENTION — accounts with expiring services and/or MTM, prioritized by score
  if (tmr > 0 && atRiskServiceCount > 0) {
    const mrrAtRisk = atRiskMrr > 0 ? atRiskMrr : mrr
    // Score: more MTM/expiring services + higher MRR = higher priority
    const mtmWeight = mtmServices.length * 1.5
    const expiringWeight = expiringServices.length * 1.2
    const silentPenalty = Math.min(2.0, daysSilent / 30)
    const riskMultiplier = riskLevel === 'critical' ? 1.5 : riskLevel === 'at_risk' ? 1.2 : 1.0
    const impactScore = mrrAtRisk * (mtmWeight + expiringWeight + 1) * riskMultiplier * (1 + silentPenalty * 0.3)
    const signals = []
    if (mtmServices.length > 0) signals.push({ icon: '\u23f0', text: `${mtmServices.length} service${mtmServices.length > 1 ? 's' : ''} on month-to-month (${fmt$(mtmMrr)} MRR) \u2014 no contract lock` })
    if (expiringServices.length > 0) signals.push({ icon: '\ud83d\udcdc', text: `${expiringServices.length} service${expiringServices.length > 1 ? 's' : ''} expiring within 90 days (${fmt$(expiringMrr)} MRR)` })
    if (daysSilent > 30) signals.push({ icon: '\u23f0', text: `No contact in ${daysSilent} days \u2014 accounts go silent before they leave` })
    if (disconnects > 0) signals.push({ icon: '\ud83d\udcc9', text: `${disconnects} service disconnects on record \u2014 signals dissatisfaction` })
    if (nrr < 1.0) signals.push({ icon: '\u26a0\ufe0f', text: `NRR at ${(nrr * 100).toFixed(0)}% \u2014 revenue contracting` })
    if (churnMrr > 0) signals.push({ icon: '\ud83d\udcb0', text: `${fmt$(churnMrr)} MRR already churned \u2014 pattern suggests more at risk` })
    if (riskScore >= 70) signals.push({ icon: '\ud83d\udea8', text: `Risk score ${riskScore}/100 \u2014 ${riskLevel === 'critical' ? 'immediate' : 'elevated'} churn probability` })
    if (signals.length < 2) signals.push({ icon: '\ud83d\udee1\ufe0f', text: `${fmt$(mrrAtRisk)} MRR at risk \u2014 proactive outreach improves save rate` })
    const tagline = mtmServices.length > 0
      ? `${mtmServices.length} MTM service${mtmServices.length > 1 ? 's' : ''} \u00b7 ${fmt$(mrrAtRisk)} MRR at risk`
      : `${expiringServices.length} expiring service${expiringServices.length > 1 ? 's' : ''} \u00b7 ${fmt$(mrrAtRisk)} MRR at risk`
    const suggestedMove = mtmServices.length > 0
      ? `${mtmServices.length} services are month-to-month with no contract protection. Contact this week with a renewal offer \u2014 lock in a term commitment before a competitor approaches.`
      : `${expiringServices.length} services expire within 90 days. Proactively engage with a renewal package \u2014 bundle pricing or rate lock to retain.`
    return {
      mode: 'Retention', impactScore, signals: signals.slice(0, 4), tagline, suggestedMove,
      dealProfile: { vertical, product: products[0] || 'DIA', dealValue: mrrAtRisk, daysOpen: null, mtmDays: mtmServices.length > 0 ? daysSilent : 0, daysSinceContact: daysSilent },
      hasWinProb: true, hasChurnRisk: true,
    }
  }

  // RETENTION fallback — at-risk/critical accounts even without MTM/expiring (existing behavior)
  if ((riskLevel === 'at_risk' || riskLevel === 'critical') && tmr > 0) {
    const mrrAtRisk = mrr
    const urgency = riskLevel === 'critical' ? 1.5 : 1.0
    const silentPenalty = Math.min(2.0, daysSilent / 30)
    const impactScore = mrrAtRisk * urgency * (1 + silentPenalty)
    const signals = []
    if (daysSilent > 30) signals.push({ icon: '\u23f0', text: `No contact in ${daysSilent} days \u2014 accounts go silent before they leave` })
    if (disconnects > 0) signals.push({ icon: '\ud83d\udcc9', text: `${disconnects} service disconnects on record \u2014 signals dissatisfaction` })
    if (nrr < 1.0) signals.push({ icon: '\u26a0\ufe0f', text: `NRR at ${(nrr * 100).toFixed(0)}% \u2014 revenue contracting` })
    if (churnMrr > 0) signals.push({ icon: '\ud83d\udcb0', text: `${fmt$(churnMrr)} MRR already churned \u2014 pattern suggests more at risk` })
    if (riskScore >= 70) signals.push({ icon: '\ud83d\udea8', text: `Risk score ${riskScore}/100 \u2014 ${riskLevel === 'critical' ? 'immediate' : 'elevated'} churn probability` })
    if (velocity === 'decelerating' || velocity === 'stalled') signals.push({ icon: '\ud83d\udcc9', text: `Account velocity: ${velocity} \u2014 engagement trending down` })
    if (signals.length < 2) signals.push({ icon: '\ud83d\udee1\ufe0f', text: `${fmt$(mrrAtRisk)} MRR at risk \u2014 proactive outreach improves save rate` })
    const tagline = `${fmt$(mrrAtRisk)} MRR at risk \u00b7 ${riskLevel === 'critical' ? 'Critical' : 'Elevated'} churn signals`
    const suggestedMove = daysSilent > 45
      ? `Urgent: reach out this week. ${daysSilent}+ days of silence is a strong churn predictor. Lead with value \u2014 offer a renewal or service review, not an upsell.`
      : `Schedule a check-in. Address any service concerns first, then explore a renewal lock to stabilize the account.`
    return {
      mode: 'Retention', impactScore, signals: signals.slice(0, 4), tagline, suggestedMove,
      dealProfile: { vertical, product: products[0] || 'DIA', dealValue: mrrAtRisk, daysOpen: null, mtmDays: daysSilent, daysSinceContact: daysSilent },
      hasWinProb: true, hasChurnRisk: true,
    }
  }

  // GROWTH — purchased in last 12 months AND has 2026 pipeline deals
  const pipeline2026 = deals.filter(d => {
    const close = d.close || ''
    if (!close) return false
    const yr = new Date(close).getFullYear()
    return yr === 2026
  })
  const has2026Pipeline = pipeline2026.length > 0
  const pipeline2026Mrr = pipeline2026.reduce((s, d) => s + (parseFloat(d.mrr) || 0), 0)

  if (tmr > 0 && has2026Pipeline) {
    const bestDeal = pipeline2026.reduce((best, d) => (!best || (d.mrr || 0) > (best.mrr || 0)) ? d : best, null)
    const dealMrr = bestDeal?.mrr || pipeline2026Mrr || tmr * 0.2
    const impactScore = pipeline2026Mrr * (winRate > 0 ? winRate : 0.5) * (velocity === 'accelerating' ? 1.3 : 1.0)
    const signals = []
    if (bestDeal) signals.push({ icon: '\ud83c\udfe2', text: `${bestDeal.product || 'Deal'} at ${fmt$(bestDeal.mrr || 0)} MRR \u2014 stage: ${bestDeal.stage || 'Active'}` })
    if (pipeline2026.length > 1) signals.push({ icon: '\ud83d\udcca', text: `${pipeline2026.length} deals in 2026 pipeline totaling ${fmt$(pipeline2026Mrr)} MRR` })
    else signals.push({ icon: '\ud83d\udcca', text: `1 deal in 2026 pipeline \u2014 ${fmt$(pipeline2026Mrr)} MRR` })
    signals.push({ icon: '\u2705', text: `Active billing customer \u2014 ${fmt$(tmr)} TMR` })
    if (winRate > 0.6) signals.push({ icon: '\ud83c\udfc6', text: `Historical win rate ${(winRate * 100).toFixed(0)}% \u2014 strong conversion pattern` })
    else if (winRate > 0) signals.push({ icon: '\ud83d\udcca', text: `Win rate ${(winRate * 100).toFixed(0)}% at this account \u2014 ${winRate >= 0.4 ? 'solid' : 'needs attention'}` })
    if (velocity === 'accelerating') signals.push({ icon: '\u26a1', text: 'Account velocity accelerating \u2014 momentum is on your side' })
    if (tmr > 0) signals.push({ icon: '\ud83d\udcb0', text: `Current TMR ${fmt$(tmr)} \u2014 expansion grows wallet share` })
    if (products.length > 0) signals.push({ icon: '\ud83d\udd04', text: `Currently on ${products.slice(0, 2).join(', ')} \u2014 cross-sell potential` })
    const tagline = `${pipeline2026.length} deal${pipeline2026.length > 1 ? 's' : ''} in 2026 pipeline \u00b7 ${fmt$(pipeline2026Mrr)} MRR \u00b7 ${fmt$(tmr)} TMR`
    const suggestedMove = bestDeal?.stage?.toLowerCase().includes('propose') || bestDeal?.stage?.toLowerCase().includes('negotiate')
      ? `Deal is in late stage \u2014 focus on removing blockers and getting to verbal. Lead with ROI proof from their existing ${fmt$(tmr)} TMR services.`
      : `Advance the 2026 pipeline. Leverage recent purchase history and existing relationship (${fmt$(tmr)} TMR customer) to accelerate the ${fmt$(dealMrr)} opportunity.`
    return {
      mode: 'Growth', impactScore, signals: signals.slice(0, 4), tagline, suggestedMove,
      dealProfile: { vertical, product: bestDeal?.product || products[0] || 'DIA', dealValue: dealMrr, daysOpen: bestDeal?.created ? Math.floor((Date.now() - new Date(bestDeal.created).getTime()) / 86400000) : 20, mtmDays: null, daysSinceContact: null },
      hasWinProb: true, hasChurnRisk: false,
    }
  }

  // DORMANT — no bookings in 12 months OR has recent bookings but no 2026 pipeline
  if (tmr > 0 && (isDormant || !has2026Pipeline)) {
    const dormantMrr = tmr
    const noPipeline = !has2026Pipeline && !isDormant
    const impactScore = dormantMrr * 1.5 * (1 + Math.min(2.0, daysSilent / 60))
    const signals = []
    if (isDormant) signals.push({ icon: '\ud83d\udca4', text: `No bookings in the last 12 months \u2014 account is dormant` })
    else if (noPipeline) signals.push({ icon: '\ud83d\udca4', text: `No deals in 2026 pipeline \u2014 needs new opportunities` })
    if (tmr > 0) signals.push({ icon: '\ud83d\udcb0', text: `Still billing ${fmt$(tmr)} TMR \u2014 existing relationship to leverage` })
    if (daysSilent > 60) signals.push({ icon: '\u23f0', text: `${daysSilent} days since last engagement \u2014 re-engage before competitor does` })
    if (products.length > 0) signals.push({ icon: '\ud83d\udd04', text: `Currently on ${products.slice(0, 2).join(', ')} \u2014 cross-sell potential` })
    if (disconnects > 0) signals.push({ icon: '\ud83d\udcc9', text: `${disconnects} prior disconnects \u2014 address any lingering concerns` })
    if (velocity === 'stalled') signals.push({ icon: '\ud83d\udcc9', text: 'Account velocity stalled \u2014 needs a catalyst' })
    if (vertical) signals.push({ icon: '\ud83c\udfe2', text: `Vertical: ${vertical} \u2014 tailor approach to industry priorities` })
    if (signals.length < 2) signals.push({ icon: '\ud83d\udccd', text: 'Research current needs and initiate re-engagement' })
    const tagline = noPipeline
      ? `${fmt$(tmr)} TMR \u00b7 No 2026 pipeline \u00b7 Dormant`
      : `${fmt$(tmr)} TMR \u00b7 No bookings in 12+ months \u00b7 Dormant`
    const suggestedMove = noPipeline
      ? `Active billing customer with no 2026 pipeline. Start a discovery conversation to identify expansion, upgrade, or cross-sell opportunities for the coming year.`
      : daysSilent > 90
        ? `This account has been dormant for ${daysSilent}+ days despite active billing. Reach out with a fresh value proposition \u2014 they may be evaluating alternatives. Lead with an account review and new product options.`
        : `Billing customer with no recent deal activity. Schedule a check-in to understand their current needs and identify new opportunities.`
    return {
      mode: 'Dormant', impactScore, signals: signals.slice(0, 4), tagline, suggestedMove,
      dealProfile: { vertical, product: products[0] || 'Metro Ethernet', dealValue: dormantMrr, daysOpen: null, mtmDays: null, daysSinceContact: daysSilent || null },
      hasWinProb: false, hasChurnRisk: false,
    }
  }

  // DORMANT fallback — accounts with no TMR (true new logos or zero-billing)
  const prospectMrr = pipelineMrr || 8000
  const impactScore = prospectMrr * 0.8
  const signals = []
  signals.push({ icon: '\ud83d\udca4', text: 'No active billing \u2014 dormant or lapsed account' })
  if (pipelineCount > 0) signals.push({ icon: '\ud83d\udcca', text: `${pipelineCount} deal${pipelineCount > 1 ? 's' : ''} in pipeline (${fmt$(pipelineMrr)} MRR)` })
  if (vertical) signals.push({ icon: '\ud83c\udfe2', text: `Vertical: ${vertical} \u2014 tailor approach to industry priorities` })
  if (signals.length < 2) signals.push({ icon: '\ud83d\udccd', text: 'Research account needs and initiate outreach' })
  const tagline = pipelineCount > 0 ? `No billing \u00b7 ${pipelineCount} deal${pipelineCount > 1 ? 's' : ''} in pipeline` : `No active billing \u00b7 Dormant`
  const suggestedMove = `This account has no active billing. Research their current situation and initiate outreach to re-engage or establish a new relationship.`
  return {
    mode: 'Dormant', impactScore, signals: signals.slice(0, 4), tagline, suggestedMove,
    dealProfile: { vertical, product: products[0] || 'Metro Ethernet', dealValue: prospectMrr, daysOpen: null, mtmDays: null, daysSinceContact: daysSilent || null },
    hasWinProb: false, hasChurnRisk: false,
  }
}

function rankAccounts(accounts, mode) {
  if (!accounts?.length) return null
  const classified = accounts.map(acct => {
    const c = classifyAccount(acct)
    return { acct, ...c }
  })
  const filtered = classified.filter(c => c.mode === mode)
  filtered.sort((a, b) => b.impactScore - a.impactScore)
  if (filtered.length === 0) return null
  const labelMap = { Dormant: { label: 'DORMANT', color: T.blue }, Growth: { label: 'GROWTH', color: T.green }, Retention: { label: 'RETENTION', color: T.yellow } }
  const ctaMap = { Dormant: 'Draft Outreach', Growth: 'Build Quote', Retention: 'Build Renewal Offer' }
  return filtered.map((item, i) => {
    const id = `ranked_${i}`
    const lbl = labelMap[item.mode] || labelMap.Dormant
    return {
      card: {
        type: id, label: lbl.label, labelColor: lbl.color,
        account: item.acct.name || item.acct.id,
        tmr: item.acct.tmr || item.acct.mrr || 0,
        tagline: item.tagline, signals: item.signals, suggestedMove: item.suggestedMove,
        cta: ctaMap[item.mode] || 'Take Action',
        ctaSecondary: item.mode === 'Growth' ? 'Build Outreach' : null,
        hasWinProb: item.hasWinProb, hasChurnRisk: item.hasChurnRisk,
        rep: item.acct.sales_owner || item.acct.rep || '',
        manager: item.acct.manager || '',
        mrr: item.dealProfile.dealValue || 0,
      },
      dealProfile: item.dealProfile,
      impactScore: item.impactScore,
    }
  })
}

// ── Market Intelligence Data ──────────────────────────────────
const MARKET_INTEL = {
  'Pacific Fiber Networks': {
    news: [
      { date: '2026-03-17', source: 'Light Reading', title: 'Pacific Fiber expands Sacramento metro footprint with 3 new POPs', sentiment: 'positive', relevance: 'high' },
      { date: '2026-03-12', source: 'FierceTelecom', title: 'AT&T loses enterprise contract in NorCal region amid service complaints', sentiment: 'opportunity', relevance: 'high' },
      { date: '2026-03-05', source: 'SEC Filing', title: 'Pacific Fiber Q4 revenue up 18% YoY, CAPEX guidance raised for 2026', sentiment: 'positive', relevance: 'medium' },
      { date: '2026-02-28', source: 'LinkedIn', title: 'New VP of Network Engineering hired from Lumen \u2014 signaling infrastructure investment', sentiment: 'positive', relevance: 'medium' },
    ],
    competitors: [
      { name: 'AT&T', status: 'Losing ground', detail: 'Lost HQ coverage after Nov build-out. Multiple churn signals.' },
      { name: 'Lumen', status: 'Incumbent', detail: 'Legacy DIA at 2 locations. Contract expires Q2 2026.' },
    ],
    financials: { revenue: '$42M', growth: '+18% YoY', employees: 340, funding: 'Private', techSpend: '$6.2M/yr' },
  },
  'Cascade Broadband Co.': {
    news: [
      { date: '2026-03-15', source: 'Phoenix Biz Journal', title: 'Cascade Broadband opens new regional HQ in Tempe, AZ', sentiment: 'positive', relevance: 'high' },
      { date: '2026-03-08', source: 'CRN', title: 'Cascade signs multi-year SD-WAN deal \u2014 moving away from legacy MPLS', sentiment: 'opportunity', relevance: 'high' },
      { date: '2026-02-20', source: 'Glassdoor', title: 'Cascade hiring 15 network engineers in Phoenix metro', sentiment: 'positive', relevance: 'medium' },
      { date: '2026-02-14', source: 'Press Release', title: 'Cascade Broadband achieves SOC2 Type II certification', sentiment: 'positive', relevance: 'low' },
    ],
    competitors: [
      { name: 'Lumen', status: 'At risk', detail: 'DIA 500Mb at Phoenix \u2014 underperforming. Customer complaints logged.' },
      { name: 'Cox Business', status: 'Weak', detail: 'Only coax at Tucson. No fiber option.' },
    ],
    financials: { revenue: '$28M', growth: '+12% YoY', employees: 185, funding: 'Series C', techSpend: '$3.8M/yr' },
  },
  'TriState Infrastructure LLC': {
    news: [
      { date: '2026-03-14', source: 'Dallas Morning News', title: 'TriState Infrastructure wins $50M state highway contract in Texas', sentiment: 'positive', relevance: 'medium' },
      { date: '2026-03-10', source: 'Industry Report', title: 'Infrastructure sector telecom spend projected flat in 2026 \u2014 budget pressure expected', sentiment: 'negative', relevance: 'high' },
      { date: '2026-02-25', source: 'LinkedIn', title: 'TriState CFO posts about "cost optimization initiatives" \u2014 possible vendor consolidation', sentiment: 'risk', relevance: 'high' },
      { date: '2026-02-18', source: 'SEC Filing', title: 'TriState Q4 margins compressed 200bps \u2014 cited telecom costs as factor', sentiment: 'negative', relevance: 'high' },
    ],
    competitors: [
      { name: 'Spectrum Enterprise', status: 'Aggressive', detail: 'Offering 20% below market rate on 3-year terms in Dallas.' },
      { name: 'Windstream', status: 'Bidding', detail: 'Submitted RFP response for MPLS bundle replacement.' },
    ],
    financials: { revenue: '$180M', growth: '+3% YoY', employees: 1200, funding: 'Public (OTC)', techSpend: '$8.1M/yr' },
  },
}

// ── Dynamic intel generator for any account ─────────────────────
const NEWS_TEMPLATES = {
  positive: [
    (n) => ({ source: 'Industry Wire', title: `${n} expands operations with new regional office opening`, sentiment: 'positive', relevance: 'medium' }),
    (n) => ({ source: 'LinkedIn', title: `${n} hiring surge \u2014 10+ new positions posted in last 30 days`, sentiment: 'positive', relevance: 'medium' }),
    (n) => ({ source: 'Press Release', title: `${n} reports strong quarterly results, raises guidance`, sentiment: 'positive', relevance: 'high' }),
    (n) => ({ source: 'CRN', title: `${n} earns industry certification, signals infrastructure investment`, sentiment: 'positive', relevance: 'low' }),
  ],
  opportunity: [
    (n) => ({ source: 'FierceTelecom', title: `Incumbent provider loses key contract in ${n}'s region \u2014 displacement opportunity`, sentiment: 'opportunity', relevance: 'high' }),
    (_n, v) => ({ source: 'Light Reading', title: `${v} sector seeing wave of vendor consolidation \u2014 timing is right`, sentiment: 'opportunity', relevance: 'high' }),
  ],
  negative: [
    (n) => ({ source: 'SEC Filing', title: `${n} margins under pressure \u2014 cited telecom costs as factor`, sentiment: 'negative', relevance: 'high' }),
    (_n, v) => ({ source: 'Industry Report', title: `${v} sector telecom spend projected flat \u2014 budget pressure expected`, sentiment: 'negative', relevance: 'high' }),
  ],
  risk: [
    (n) => ({ source: 'LinkedIn', title: `${n} leadership posts about "cost optimization" \u2014 possible vendor review`, sentiment: 'risk', relevance: 'high' }),
    (n) => ({ source: 'Glassdoor', title: `${n} layoffs reported in back-office functions`, sentiment: 'risk', relevance: 'medium' }),
  ],
}

const COMPETITOR_POOL = [
  { name: 'AT&T', statuses: ['Incumbent', 'Losing ground', 'Aggressive'] },
  { name: 'Lumen', statuses: ['Incumbent', 'At risk', 'Legacy'] },
  { name: 'Spectrum Enterprise', statuses: ['Aggressive', 'Bidding', 'Incumbent'] },
  { name: 'Comcast Business', statuses: ['Weak', 'Incumbent', 'Expanding'] },
  { name: 'Cox Business', statuses: ['Weak', 'At risk', 'Regional'] },
  { name: 'Windstream', statuses: ['Bidding', 'Legacy', 'At risk'] },
  { name: 'Crown Castle', statuses: ['Incumbent', 'Expanding'] },
  { name: 'Zayo', statuses: ['Aggressive', 'Bidding'] },
]

function generateIntelForAccount(acct) {
  const name = acct.name || acct.id || 'Unknown'
  const vert = acct.vertical || 'Enterprise'
  const mrr = acct.mrr || 0
  const tmr = acct.tmr || mrr
  const riskLevel = acct.risk_level || acct.health_level || 'healthy'
  const employees = acct.employees || Math.round(80 + Math.random() * 800)
  let seed = 0
  for (let i = 0; i < name.length; i++) seed = ((seed << 5) - seed + name.charCodeAt(i)) | 0
  const seededRand = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed & 0x7fffffff) / 2147483647 }
  const newsPool = []
  newsPool.push(...NEWS_TEMPLATES.positive)
  if (riskLevel === 'at_risk' || riskLevel === 'critical') {
    newsPool.push(...NEWS_TEMPLATES.negative, ...NEWS_TEMPLATES.risk)
  } else {
    newsPool.push(...NEWS_TEMPLATES.opportunity)
  }
  const shuffled = newsPool.sort(() => seededRand() - 0.5)
  const today = new Date()
  const news = shuffled.slice(0, 4).map((fn, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (i * 3 + Math.floor(seededRand() * 5)))
    return { date: d.toISOString().slice(0, 10), ...fn(name, vert) }
  })
  const compPool = COMPETITOR_POOL.sort(() => seededRand() - 0.5).slice(0, 2)
  const competitors = compPool.map(c => ({
    name: c.name,
    status: c.statuses[Math.floor(seededRand() * c.statuses.length)],
    detail: `Active in ${name}'s market. ${seededRand() > 0.5 ? 'Contract renewal approaching.' : 'Service quality concerns reported.'}`,
  }))
  const revenue = tmr > 0 ? fmt$(tmr) : fmt$(Math.round((10 + seededRand() * 200) * 1e6))
  const growth = riskLevel === 'critical' ? `-${Math.floor(seededRand() * 8 + 2)}% YoY`
    : riskLevel === 'at_risk' ? `+${Math.floor(seededRand() * 5)}% YoY`
    : `+${Math.floor(seededRand() * 20 + 5)}% YoY`
  return {
    news, competitors,
    financials: {
      revenue, growth, employees,
      funding: seededRand() > 0.6 ? 'Private' : seededRand() > 0.3 ? `Series ${['A','B','C'][Math.floor(seededRand() * 3)]}` : 'Public',
      techSpend: fmt$(Math.round((0.5 + seededRand() * 10) * 1e6)) + '/yr',
    },
  }
}

// ── UI Components ──────────────────────────────────────────────

const MODE_META = {
  Dormant:     { color: T.blue, icon: '\ud83d\udca4', desc: 'No bookings in 12 months or no 2026 pipeline' },
  Growth:      { color: T.green, icon: '\ud83d\udcc8', desc: 'Active billing accounts with 2026 pipeline' },
  Retention:   { color: T.yellow, icon: '\ud83d\udee1\ufe0f', desc: 'Expiring services & MTM accounts needing attention' },
}

// Section (progressive disclosure)
function Section({ title, children, defaultOpen = false, color = T.cyan }) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyRef = useRef(null)
  const [h, setH] = useState(0)
  useEffect(() => {
    if (bodyRef.current) setH(bodyRef.current.scrollHeight)
  }, [open, children])
  return (
    <div className="mt-2">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="w-full flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-left py-1 px-0"
      >
        <span
          className="text-[9px] transition-transform duration-200"
          style={{ color, transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >{'\u25B6'}</span>
        <span className="font-sans text-[10px] font-semibold text-revos-text-mid">{title}</span>
      </button>
      <div
        style={{ maxHeight: open ? h : 0, opacity: open ? 1 : 0 }}
        className="transition-all duration-300 ease-out overflow-hidden"
      >
        <div ref={bodyRef} className="pb-2">
          {children}
        </div>
      </div>
    </div>
  )
}

// ImpactRing
function ImpactRing({ score, size = 36 }) {
  const r = (size - 4) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, score)) / 100
  const color = score >= 80 ? T.red : score >= 60 ? T.orange : T.green
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.border} strokeWidth={2.5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={2.5}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={10} fontFamily="'IBM Plex Mono', monospace" fontWeight={700}
      >{Math.round(score)}</text>
    </svg>
  )
}

// ScoreBadge
function ScoreBadge({ value, label, positive }) {
  const color = positive
    ? (value >= 70 ? T.green : value >= 50 ? T.yellow : T.orange)
    : (value >= 70 ? T.red : value >= 50 ? T.orange : T.yellow)
  return (
    <div className="flex items-center gap-1.5 rounded-full px-2 py-0.5" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
      <span className="font-mono text-[11px] font-bold" style={{ color }}>{value}%</span>
      <span className="font-mono text-[9px] text-revos-text-dim">{label}</span>
    </div>
  )
}

// ScoreBar
function ScoreBar({ score, color }) {
  return (
    <div className="flex items-center gap-2 mt-[3px]">
      <div className="flex-1 h-[2px] bg-revos-border rounded-sm">
        <div className="h-full rounded-sm opacity-60" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[10px] text-revos-text-dim font-mono min-w-[28px]">{score}%</span>
    </div>
  )
}

// Market Intel Section (inline)
function MarketIntelContent({ intel }) {
  if (!intel) return null
  const sentimentColor = s => s === 'positive' ? T.green : s === 'opportunity' ? T.blue : s === 'negative' ? T.red : s === 'risk' ? T.yellow : T.textDim
  return (
    <div onClick={e => e.stopPropagation()}>
      {/* News */}
      <div className="mb-3">
        <div className="text-[9px] text-revos-text-dim tracking-wider uppercase font-mono mb-1.5">RECENT NEWS</div>
        <div className="flex flex-col gap-1.5">
          {intel.news.map((n, i) => (
            <div key={i} className="flex gap-2 items-start px-2.5 py-1.5 rounded" style={{ background: `${sentimentColor(n.sentiment)}08`, border: `1px solid ${sentimentColor(n.sentiment)}20` }}>
              <div className="flex-1">
                <div className="text-[11px] text-revos-text font-medium leading-tight">{n.title}</div>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-[9px] text-revos-text-dim font-mono">{n.date}</span>
                  <span className="text-[9px] text-revos-text-mid">{n.source}</span>
                  <span className="text-[8px] font-mono font-semibold rounded px-1 py-[1px] uppercase" style={{ color: sentimentColor(n.sentiment), background: `${sentimentColor(n.sentiment)}15` }}>{n.sentiment}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Competitors + Financials */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[9px] text-revos-text-dim tracking-wider uppercase font-mono mb-1.5">COMPETITORS</div>
          {intel.competitors.map((c, i) => (
            <div key={i} className="px-2.5 py-1.5 bg-revos-surface rounded border border-revos-border mb-1">
              <div className="flex justify-between mb-0.5">
                <span className="text-[10px] font-semibold text-revos-text">{c.name}</span>
                <span className="text-[8px] font-mono font-semibold rounded px-1 py-[1px]" style={{
                  color: c.status === 'Losing ground' || c.status === 'At risk' || c.status === 'Weak' ? T.green : c.status === 'Aggressive' || c.status === 'Bidding' ? T.red : T.yellow,
                  background: (c.status === 'Losing ground' || c.status === 'At risk' || c.status === 'Weak' ? T.green : c.status === 'Aggressive' || c.status === 'Bidding' ? T.red : T.yellow) + '15',
                }}>{c.status}</span>
              </div>
              <div className="text-[9px] text-revos-text-dim">{c.detail}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="text-[9px] text-revos-text-dim tracking-wider uppercase font-mono mb-1.5">COMPANY PROFILE</div>
          <div className="px-2.5 py-2 bg-revos-surface rounded border border-revos-border">
            {[
              { label: 'Revenue', value: intel.financials.revenue },
              { label: 'Growth', value: intel.financials.growth },
              { label: 'Employees', value: intel.financials.employees?.toLocaleString() },
              { label: 'Funding', value: intel.financials.funding },
              { label: 'Tech Spend', value: intel.financials.techSpend },
            ].map((f, i) => (
              <div key={i} className={cn('flex justify-between py-0.5', i < 4 && 'border-b border-revos-border')}>
                <span className="text-[9px] text-revos-text-dim">{f.label}</span>
                <span className="text-[10px] text-revos-text font-mono font-semibold">{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// =======================================================================
// MAIN COMPONENT
// =======================================================================

export default function SellerActions({ accounts, onNavigate }) {
  const [expandedCard, setExpandedCard] = useState(null)
  const [steeringMode, setSteeringMode] = useState('Dormant')
  const [modelData, setModelData] = useState(DEMO_MODEL)
  const [intelData, setIntelData] = useState({})
  const [refreshingAccount, setRefreshingAccount] = useState(null)
  const [topN, setTopN] = useState(3)
  const [ownerView, setOwnerView] = useState('rep')
  const [selectedOwner, setSelectedOwner] = useState(null)

  const isDemo = (modelData.source || 'demo') === 'demo'
  const hasAccounts = accounts?.length > 0

  // Load model stats
  useEffect(() => {
    fetch('/api/engine/model/params')
      .then(r => r.ok ? r.json() : null).catch(() => null)
      .then(data => { if (data && data.stats) setModelData(data); })
  }, [])

  // Owner pills
  const reps = useMemo(() => {
    const set = new Set()
    accounts?.forEach(a => { if (a.sales_owner) set.add(a.sales_owner) })
    return [...set].sort()
  }, [accounts])

  const managers = useMemo(() => {
    const set = new Set()
    accounts?.forEach(a => { if (a.manager) set.add(a.manager) })
    return [...set].sort()
  }, [accounts])

  const ownerPills = ownerView === 'rep' ? reps : managers

  // Filter accounts by owner
  const filteredAccounts = useMemo(() => {
    if (!hasAccounts) return accounts || []
    if (!selectedOwner) return accounts
    if (ownerView === 'rep') return accounts.filter(a => a.sales_owner === selectedOwner)
    return accounts.filter(a => a.manager === selectedOwner)
  }, [accounts, selectedOwner, ownerView, hasAccounts])

  // Classify ALL filtered accounts for mode counts
  const allClassified = useMemo(() => {
    if (!hasAccounts) return []
    return filteredAccounts.map(acct => {
      const c = classifyAccount(acct)
      return { name: acct.name || acct.id, mode: c.mode, impactScore: c.impactScore }
    })
  }, [filteredAccounts, hasAccounts])

  const modeCounts = useMemo(() => {
    const counts = { Dormant: 0, Growth: 0, Retention: 0 }
    allClassified.forEach(a => { counts[a.mode] = (counts[a.mode] || 0) + 1 })
    return counts
  }, [allClassified])

  // Dynamic ranking (uses ALL filtered accounts, no topN limit here)
  const ranked = useMemo(() => {
    if (!hasAccounts) return null
    if (!filteredAccounts?.length) return null
    const classified = filteredAccounts.map(acct => {
      const c = classifyAccount(acct)
      return { acct, ...c }
    })
    const filtered = classified.filter(c => c.mode === steeringMode)
    filtered.sort((a, b) => b.impactScore - a.impactScore)
    if (filtered.length === 0) return null
    const labelMap = { Dormant: { label: 'DORMANT', color: T.blue }, Growth: { label: 'GROWTH', color: T.green }, Retention: { label: 'RETENTION', color: T.yellow } }
    const ctaMap = { Dormant: 'Draft Outreach', Growth: 'Build Quote', Retention: 'Build Renewal Offer' }
    return filtered.map((item, i) => {
      const id = `ranked_${i}`
      const lbl = labelMap[item.mode] || labelMap.Dormant
      return {
        card: {
          type: id, label: lbl.label, labelColor: lbl.color,
          account: item.acct.name || item.acct.id,
          tmr: item.acct.tmr || item.acct.mrr || 0,
          tagline: item.tagline, signals: item.signals, suggestedMove: item.suggestedMove,
          cta: ctaMap[item.mode] || 'Take Action',
          ctaSecondary: item.mode === 'Growth' ? 'Build Outreach' : null,
          hasWinProb: item.hasWinProb, hasChurnRisk: item.hasChurnRisk,
          rep: item.acct.sales_owner || item.acct.rep || '',
          manager: item.acct.manager || '',
          mrr: item.dealProfile.dealValue || 0,
        },
        dealProfile: item.dealProfile,
        impactScore: item.impactScore,
      }
    })
  }, [filteredAccounts, steeringMode, hasAccounts])

  // Build final cards + scores
  const { allCards, scores } = useMemo(() => {
    if (ranked) {
      const c = ranked.map(r => r.card)
      const s = {}
      ranked.forEach(r => {
        const key = r.card.type
        if (r.card.hasWinProb) s[key] = { winProb: scoreWinProb(r.dealProfile, modelData), winBreakdown: buildWinBreakdown(r.dealProfile, modelData) }
        if (r.card.hasChurnRisk) s[key] = { ...s[key], churnRisk: scoreChurnRisk(r.dealProfile, modelData), churnBreakdown: buildChurnBreakdown(r.dealProfile, modelData) }
      })
      return { allCards: c, scores: s }
    }
    // Demo fallback
    const demoFiltered = DEMO_CARDS.filter(d => d.card.mode === steeringMode).map(d => ({ ...d.card, rep: '', manager: '', mrr: d.dealProfile.dealValue || 0 }))
    return { allCards: demoFiltered, scores: computeDemoScores(steeringMode, modelData) }
  }, [ranked, modelData, steeringMode])

  // Apply topN
  const totalForMode = allCards.length
  const cards = topN === 0 ? allCards : allCards.slice(0, topN)

  // KPI calculations
  const totalMrrAtPlay = cards.reduce((s, c) => s + (c.mrr || 0), 0)
  const avgScore = useMemo(() => {
    const vals = cards.map(c => {
      const sc = scores[c.type]
      if (steeringMode === 'Retention' && sc?.churnRisk) return sc.churnRisk
      if (sc?.winProb) return sc.winProb
      return null
    }).filter(Boolean)
    return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null
  }, [cards, scores, steeringMode])

  // Auto-expand first when mode changes
  useEffect(() => {
    if (cards.length > 0) setExpandedCard(cards[0].type)
    else setExpandedCard(null)
  }, [steeringMode, cards.length > 0])

  // Intel handlers
  const handleRefreshIntel = (accountName) => {
    setRefreshingAccount(accountName)
    setTimeout(() => {
      if (!intelData[accountName]) {
        const hardcoded = MARKET_INTEL[accountName]
        if (hardcoded) {
          setIntelData(prev => ({ ...prev, [accountName]: hardcoded }))
        } else {
          const acct = accounts?.find(a => (a.name || a.id) === accountName)
          const demoCard = !acct && DEMO_CARDS.find(d => d.card.account === accountName)
          const target = acct || (demoCard ? {
            name: accountName, vertical: demoCard.dealProfile.vertical,
            mrr: demoCard.dealProfile.dealValue, tmr: demoCard.dealProfile.dealValue || 0,
            risk_level: demoCard.card.mode === 'Retention' ? 'at_risk' : 'healthy',
          } : null)
          if (target) setIntelData(prev => ({ ...prev, [accountName]: generateIntelForAccount(target) }))
        }
      }
      setRefreshingAccount(null)
    }, 1500)
  }

  const modeColor = MODE_META[steeringMode]?.color || T.blue

  // =======================================================================
  // RENDER
  // =======================================================================
  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-lg font-bold text-revos-text m-0 tracking-tight font-sans">Seller Actions</h1>
          {selectedOwner && (
            <>
              <div className="w-px h-5 bg-revos-border" />
              <GlowBadge color={T.cyan}>{selectedOwner}</GlowBadge>
            </>
          )}
          <div className="flex-1" />
          <div className="font-mono text-[10px] text-revos-text-dim">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>

        {/* Data banner */}
        {!hasAccounts && isDemo && (
          <div className="rounded-lg px-3 py-2 mb-3 flex justify-between items-center" style={{ background: `${T.yellow}10`, border: `1px solid ${T.yellow}30` }}>
            <span className="text-[11px] text-revos-yellow font-mono">{'\u26a0'} DEMO MODE — load account data to activate dynamic prioritization</span>
            <span onClick={() => onNavigate('backtest')} className="text-[11px] text-revos-yellow underline cursor-pointer font-mono">Run Backtest →</span>
          </div>
        )}
        {hasAccounts && (
          <div className="rounded-lg px-3 py-2 mb-3 flex items-center" style={{ background: `${T.green}08`, border: `1px solid ${T.green}25` }}>
            <span className="text-[11px] text-revos-green font-mono">{'\u2713'} LIVE DATA — {filteredAccounts.length} accounts scored & ranked</span>
          </div>
        )}

        {/* Ownership toggle + pills */}
        {hasAccounts && ownerPills.length > 0 && (
          <div className="flex items-center gap-3 mb-2">
            <span className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase w-10">View</span>
            <div className="flex gap-0.5 bg-revos-surface rounded-xl p-0.5">
              {[['rep', 'Rep'], ['1lm', '1LM']].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => { setOwnerView(k); setSelectedOwner(null) }}
                  className={cn(
                    'px-3 py-1 rounded-[10px] border-none cursor-pointer font-mono text-[10px] font-semibold',
                    ownerView === k ? 'bg-revos-card text-revos-cyan shadow-card' : 'bg-transparent text-revos-text-dim shadow-none'
                  )}
                >{label}</button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setSelectedOwner(null)}
                className={cn(
                  'px-2.5 py-1 rounded-full border cursor-pointer font-mono text-[9px] transition-all',
                  !selectedOwner ? 'bg-revos-cyan/15 text-revos-cyan border-revos-cyan/30' : 'bg-transparent text-revos-text-dim border-revos-border hover:border-revos-text-dim'
                )}
              >All</button>
              {ownerPills.map(name => (
                <button
                  key={name}
                  onClick={() => setSelectedOwner(selectedOwner === name ? null : name)}
                  className={cn(
                    'px-2.5 py-1 rounded-full border cursor-pointer font-mono text-[9px] transition-all',
                    selectedOwner === name ? 'bg-revos-cyan/15 text-revos-cyan border-revos-cyan/30' : 'bg-transparent text-revos-text-dim border-revos-border hover:border-revos-text-dim'
                  )}
                >{name}</button>
              ))}
            </div>
          </div>
        )}

        {/* Top N filter */}
        <div className="flex items-center gap-3">
          <span className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase w-10">Show</span>
          <div className="flex gap-0.5 bg-revos-surface rounded-xl p-0.5">
            {[3, 5, 10, 0].map(n => (
              <button
                key={n}
                onClick={() => setTopN(n)}
                className={cn(
                  'px-3 py-1 rounded-[10px] border-none cursor-pointer font-mono text-[10px] font-semibold',
                  topN === n ? 'bg-revos-card text-revos-cyan shadow-card' : 'bg-transparent text-revos-text-dim shadow-none'
                )}
              >{n === 0 ? 'All' : `Top ${n}`}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mode Cards ── */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {Object.entries(MODE_META).map(([mode, meta]) => {
          const isSel = steeringMode === mode
          const count = hasAccounts ? (modeCounts[mode] || 0) : DEMO_CARDS.filter(d => d.card.mode === mode).length
          const Wrapper = isSel ? AnimatedBorderCard : SpotlightCard
          return (
            <Wrapper
              key={mode}
              {...(isSel ? { borderColor: meta.color } : {})}
              className={cn(
                'cursor-pointer text-left transition-all duration-150',
                isSel ? 'bg-revos-card shadow-card' : 'bg-revos-surface shadow-none'
              )}
              style={{ borderColor: isSel ? `${meta.color}50` : T.border }}
            >
              <button
                onClick={() => setSteeringMode(mode)}
                className="w-full p-4 bg-transparent border-none cursor-pointer text-left"
              >
                <div className="text-xl mb-1">{meta.icon}</div>
                <div className="font-sans text-sm font-bold" style={{ color: isSel ? meta.color : T.textMid }}>{mode}</div>
                <div className="font-mono text-lg font-bold" style={{ color: meta.color }}>{count}</div>
                <div className="font-sans text-[10px] text-revos-text-dim mt-0.5">{meta.desc}</div>
              </button>
            </Wrapper>
          )
        })}
      </div>

      {/* ── KPI Strip ── */}
      <SpotlightCard className="bg-revos-card rounded-xl shadow-card px-4 py-3 mb-4">
        <div className="flex items-center gap-6">
          <div>
            <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase">Accounts</div>
            <div className="font-mono text-sm font-bold text-revos-text">{cards.length} <span className="text-revos-text-dim font-normal">of {totalForMode}</span></div>
          </div>
          <div className="w-px h-8 bg-revos-border" />
          <div>
            <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase">MRR at Play</div>
            <div className="font-mono text-sm font-bold" style={{ color: modeColor }}>{$k(totalMrrAtPlay)}/mo</div>
          </div>
          <div className="w-px h-8 bg-revos-border" />
          <div className="flex items-center gap-2">
            <div>
              <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase">
                {steeringMode === 'Retention' ? 'Avg Churn Risk' : 'Avg Win Prob'}
              </div>
              <div className="font-mono text-sm font-bold" style={{ color: avgScore != null ? (steeringMode === 'Retention' ? T.red : T.green) : T.textDim }}>
                {avgScore != null ? `${avgScore}%` : '—'}
              </div>
            </div>
            {avgScore != null && (
              <ProgressRing
                value={avgScore}
                size={34}
                color={steeringMode === 'Retention' ? T.red : T.green}
                strokeWidth={2.5}
              />
            )}
          </div>
        </div>
      </SpotlightCard>

      {/* ── Action Cards ── */}
      <div className="flex flex-col gap-3">
        {cards.map(card => {
          const isExpanded = expandedCard === card.type
          const sc = scores[card.type]
          const winProb = sc?.winProb
          const churnRisk = sc?.churnRisk
          const impact = Math.min(100, Math.round((card.mrr || 0) / 200))
          const intel = intelData[card.account]

          return (
            <div
              key={card.type}
              onClick={() => setExpandedCard(isExpanded ? null : card.type)}
              className="rounded-xl cursor-pointer transition-all duration-200 overflow-hidden"
              style={{
                background: T.card,
                border: `1px solid ${isExpanded ? card.labelColor + '60' : T.border}`,
                boxShadow: isExpanded ? `0 0 0 1px ${card.labelColor}30, 0 8px 32px rgba(0,0,0,0.3)` : 'none',
              }}
            >
              {/* Collapsed header — always visible */}
              <div className="flex items-center gap-3 px-4 py-3">
                <ImpactRing score={impact} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-sans text-sm font-bold text-revos-text">{card.account}</span>
                    <span className="text-[9px] font-mono font-bold tracking-wider rounded px-1.5 py-[2px]" style={{ color: card.labelColor, background: `${card.labelColor}18`, border: `1px solid ${card.labelColor}35` }}>
                      {card.label}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] font-semibold mb-0.5" style={{ color: T.cyan }}>
                    {card.tmr > 0 ? `$${card.tmr.toLocaleString()} TMR` : '$0 TMR'}
                  </div>
                  <div className="font-sans text-[11px] text-revos-text-dim truncate">
                    {card.tagline}
                    {!selectedOwner && card.rep && <span className="text-revos-text-mid"> · {card.rep}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {winProb != null && <ScoreBadge value={winProb} label="Win" positive />}
                  {churnRisk != null && <ScoreBadge value={churnRisk} label="Churn" positive={false} />}
                  <span className="font-mono text-[11px] font-semibold" style={{ color: modeColor }}>{$k(card.mrr)}/mo</span>
                  <span className="text-[10px] text-revos-text-dim transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>{'\u25BE'}</span>
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-revos-border" onClick={e => e.stopPropagation()}>
                  {/* Score breakdown row */}
                  {(sc?.winBreakdown || sc?.churnBreakdown) && (
                    <div className="flex gap-4 mt-3 mb-2">
                      {sc?.winBreakdown && (
                        <div className="flex-1">
                          <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase mb-1.5">
                            {steeringMode === 'Retention' ? 'Save Probability' : 'Win Probability'}: <span className="font-bold" style={{ color: T.purple }}>{winProb}%</span>
                          </div>
                          {sc.winBreakdown.map((d, i) => (
                            <div key={i} className="flex gap-1.5 items-start mb-1">
                              <span className="text-[10px] shrink-0 mt-[1px]">{d.icon}</span>
                              <div className="flex-1">
                                <div className="flex justify-between items-baseline">
                                  <span className="text-[10px] text-revos-text-mid">{d.label}</span>
                                  <span className="text-[10px] font-mono font-semibold" style={{ color: T.purple }}>{d.value}</span>
                                </div>
                                <ScoreBar score={d.score} color={T.purple} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {sc?.churnBreakdown && (
                        <div className="flex-1">
                          <div className="font-sans text-[9px] text-revos-text-dim tracking-wider uppercase mb-1.5">
                            Churn Risk: <span className="font-bold" style={{ color: T.red }}>{churnRisk}%</span>
                          </div>
                          {sc.churnBreakdown.map((d, i) => (
                            <div key={i} className="flex gap-1.5 items-start mb-1">
                              <span className="text-[10px] shrink-0 mt-[1px]">{d.icon}</span>
                              <div className="flex-1">
                                <div className="flex justify-between items-baseline">
                                  <span className="text-[10px] text-revos-text-mid">{d.label}</span>
                                  <span className="text-[10px] font-mono font-semibold" style={{ color: T.red }}>{d.value}</span>
                                </div>
                                <ScoreBar score={d.score} color={T.red} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Why Now */}
                  <Section title="Why Now" defaultOpen={true} color={card.labelColor}>
                    <div className="flex flex-col gap-1.5 pl-1">
                      {card.signals.map((s, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="text-sm shrink-0 mt-[1px]">{s.icon}</span>
                          <span className="text-[12px] text-revos-text-mid leading-relaxed">{s.text}</span>
                        </div>
                      ))}
                    </div>
                  </Section>

                  {/* Suggested Move */}
                  <Section title="Suggested Move" defaultOpen={true} color={card.labelColor}>
                    <div className="rounded-md px-3 py-2.5 ml-1" style={{ background: T.bg, border: `1px solid ${T.border}`, borderLeft: `3px solid ${card.labelColor}` }}>
                      <p className="text-[12px] text-revos-text-mid leading-relaxed m-0">{card.suggestedMove}</p>
                    </div>
                  </Section>

                  {/* Market Intelligence */}
                  <Section title="Market Intelligence" defaultOpen={false} color={T.cyan}>
                    {intel ? (
                      <MarketIntelContent intel={intel} />
                    ) : (
                      <div className="text-center py-3">
                        <button
                          onClick={() => handleRefreshIntel(card.account)}
                          disabled={refreshingAccount === card.account}
                          className="rounded-md px-4 py-2 text-[11px] font-semibold font-mono cursor-pointer"
                          style={{ background: `${T.cyan}12`, color: T.cyan, border: `1px solid ${T.cyan}40`, opacity: refreshingAccount === card.account ? 0.6 : 1 }}
                        >
                          {refreshingAccount === card.account ? '\u23F3 Scanning...' : '\uD83C\uDF10 Load Market Intel'}
                        </button>
                      </div>
                    )}
                  </Section>

                  {/* CTA row */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-revos-border">
                    <button
                      className="border-none rounded-md px-4 py-2 text-[12px] font-semibold cursor-pointer font-sans"
                      style={{ background: card.labelColor, color: T.bg }}
                    >
                      {card.cta} →
                    </button>
                    {card.ctaSecondary && (
                      <button
                        className="bg-transparent rounded-md px-4 py-2 text-[12px] font-semibold cursor-pointer font-sans"
                        style={{ color: card.labelColor, border: `1px solid ${card.labelColor}50` }}
                      >
                        {card.ctaSecondary} →
                      </button>
                    )}
                    {!intel && (
                      <button
                        onClick={() => handleRefreshIntel(card.account)}
                        disabled={refreshingAccount === card.account}
                        className="rounded-md px-3 py-2 text-[11px] font-semibold font-mono cursor-pointer ml-auto"
                        style={{ background: `${T.cyan}12`, color: T.cyan, border: `1px solid ${T.cyan}40` }}
                      >
                        {'\uD83C\uDF10'} Intel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {cards.length === 0 && (
          <div className="bg-revos-card border border-revos-border rounded-xl px-5 py-10 text-center">
            <div className="text-sm text-revos-text-dim font-sans">No accounts in <strong className="text-revos-text">{steeringMode}</strong> mode</div>
            <div className="text-xs text-revos-text-dim mt-1.5 font-sans">Try switching modes or adjusting filters</div>
          </div>
        )}
      </div>
    </div>
  )
}
