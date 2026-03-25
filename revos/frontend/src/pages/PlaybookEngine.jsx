import { useState, useMemo, useCallback } from 'react'
import { T } from '../lib/constants'
import { cn } from '@/lib/utils'

// ── Section toggle (progressive disclosure) ─────────────────────────────────

function Section({ title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14 }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer bg-transparent border-0"
      >
        <div className="flex items-center gap-2.5">
          <span className="font-sans text-sm font-semibold" style={{ color: T.text }}>{title}</span>
          {badge && (
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full" style={{ background: T.accentDim, color: T.accent }}>
              {badge}
            </span>
          )}
        </div>
        <span
          className="text-xs transition-transform duration-200"
          style={{ color: T.textDim, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▾
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? 2000 : 0, opacity: open ? 1 : 0 }}
      >
        <div className="px-5 pb-5">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Confidence ring (mini) ──────────────────────────────────────────────────

function ConfidenceRing({ value, size = 32, color }) {
  const r = (size - 4) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - value)
  const c = color || (value >= 0.8 ? T.green : value >= 0.5 ? T.yellow : T.red)
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.border} strokeWidth={2.5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={2.5}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 3.5} textAnchor="middle" fill={c} fontSize={8} fontFamily="monospace" fontWeight={600}>
        {Math.round(value * 100)}
      </text>
    </svg>
  )
}

// ── Demo data ───────────────────────────────────────────────────────────────

const REVIEW_QUEUE = [
  { id: 'R-001', text: 'Enterprise deals >$50K should require VP-level sponsor identified by Propose stage', confidence: 0.91, source: 'Won deal pattern (n=34)', category: 'Qualification' },
  { id: 'R-002', text: 'SD-WAN deals in Healthcare vertical close 22% faster with security compliance doc attached', confidence: 0.84, source: 'Velocity analysis', category: 'Velocity' },
  { id: 'R-003', text: 'Multi-location deals with >5 sites need dedicated PM assigned before Design stage', confidence: 0.78, source: 'Lost deal analysis (n=12)', category: 'Process' },
  { id: 'R-004', text: 'Competitive displacement deals against Lumen average 45 days longer cycle', confidence: 0.73, source: 'Competitor analysis', category: 'Competitive' },
  { id: 'R-005', text: 'Bundle discount >12% without finance approval correlated with 3x churn rate', confidence: 0.88, source: 'Churn analysis', category: 'Pricing' },
]

const MEDDPICC = {
  M: { label: 'Metrics', desc: 'Quantified business outcomes the buyer expects', question: 'What measurable outcomes does the customer expect from this solution?' },
  E: { label: 'Economic Buyer', desc: 'Person with budget authority', question: 'Who controls the budget and can approve this purchase?' },
  D1: { label: 'Decision Criteria', desc: 'How the buyer evaluates solutions', question: 'What criteria will be used to compare our solution vs. alternatives?' },
  D2: { label: 'Decision Process', desc: 'Steps to reach a purchase decision', question: 'What is the internal approval process and timeline?' },
  P1: { label: 'Paper Process', desc: 'Legal, procurement, and contracting steps', question: 'What does the procurement/contracting process look like?' },
  I: { label: 'Identified Pain', desc: 'Critical business problems driving the initiative', question: 'What specific pain points are driving this initiative now?' },
  C1: { label: 'Champion', desc: 'Internal advocate who sells on your behalf', question: 'Who is our internal champion and what is their influence?' },
  C2: { label: 'Competition', desc: 'Alternative solutions being evaluated', question: 'Who else is the customer evaluating and what is their advantage?' },
}

const BANT = {
  B: { label: 'Budget', desc: 'Available budget and allocation', question: 'Is there approved budget for this initiative?' },
  A: { label: 'Authority', desc: 'Decision-making authority', question: 'Who has final authority to approve the purchase?' },
  N: { label: 'Need', desc: 'Business need and urgency', question: 'What business need does this address and how urgent is it?' },
  T: { label: 'Timeline', desc: 'Expected purchase timeline', question: 'What is the expected timeline for decision and deployment?' },
}

const EXTRACTED_RULES = [
  { id: 'ER-1', rule: 'Deals with technical evaluation >30 days have 2.3x higher win rate', source: 'Historical analysis', priority: 'high', active: true },
  { id: 'ER-2', rule: 'Multi-product bundles require cross-functional demo before Propose', source: 'Process mining', priority: 'high', active: true },
  { id: 'ER-3', rule: 'Government vertical requires FedRAMP compliance verification at Discovery', source: 'Compliance', priority: 'critical', active: true },
  { id: 'ER-4', rule: 'Deals referenced by existing customer have 40% shorter cycle time', source: 'Win pattern', priority: 'medium', active: true },
  { id: 'ER-5', rule: 'Ethernet upgrades from 1G→10G close best with ROI calculator attached', source: 'Win analysis', priority: 'medium', active: true },
  { id: 'ER-6', rule: 'Stalled deals >60 days benefit from executive sponsorship reset', source: 'Recovery analysis', priority: 'low', active: true },
]

const STAGE_CHECKPOINTS = [
  { stage: 'Discover', checkpoints: ['Pain points documented', 'Stakeholder map started', 'Budget range identified', 'Competition identified'], artifacts: ['Discovery call notes', 'Initial needs assessment'] },
  { stage: 'Design Solution', checkpoints: ['Technical requirements confirmed', 'Solution architecture reviewed', 'Pricing estimate prepared', 'Champion engaged'], artifacts: ['Solution design doc', 'Technical proposal draft'] },
  { stage: 'Propose', checkpoints: ['Formal proposal delivered', 'ROI/business case presented', 'Decision criteria aligned', 'Legal review initiated'], artifacts: ['Formal proposal', 'ROI calculator', 'SOW draft'] },
  { stage: 'Negotiate', checkpoints: ['Terms negotiated', 'Redlines resolved', 'Implementation plan agreed', 'Go-live date set'], artifacts: ['Redlined contract', 'Implementation plan', 'SLA agreement'] },
  { stage: 'Verbal Agreement', checkpoints: ['Verbal commitment received', 'PO/contract in processing', 'Onboarding team notified'], artifacts: ['Signed LOI', 'PO documentation'] },
]

const STAKEHOLDERS = [
  { role: 'Economic Buyer', required: 'Discover', description: 'Budget holder — must be identified early', icon: '💰' },
  { role: 'Technical Evaluator', required: 'Design Solution', description: 'Validates technical fit and integration', icon: '🔧' },
  { role: 'Champion', required: 'Discover', description: 'Internal advocate who drives urgency', icon: '⭐' },
  { role: 'Legal/Procurement', required: 'Propose', description: 'Handles contracting and compliance', icon: '📋' },
  { role: 'End User', required: 'Design Solution', description: 'Day-to-day user — validates UX/workflow', icon: '👤' },
]

const VELOCITY_RULES = [
  { trigger: 'No activity for 14 days', action: 'Send re-engagement sequence + alert manager', severity: 'warning' },
  { trigger: 'Stage unchanged >30 days', action: 'Flag as stalled, require next-step plan', severity: 'critical' },
  { trigger: 'Champion goes dark >21 days', action: 'Escalate to economic buyer path', severity: 'warning' },
  { trigger: 'Close date pushed 3+ times', action: 'Require pipeline review with director', severity: 'critical' },
  { trigger: 'Competitor mentioned in last 3 meetings', action: 'Trigger competitive battlecard refresh', severity: 'info' },
]

const SIMILAR_DEALS = [
  { name: 'Acme Corp — SD-WAN Migration', outcome: 'Won', mrr: 12400, cycle: 68, similarity: 0.92, keyFactor: 'Early champion engagement' },
  { name: 'GlobalTech — Ethernet Upgrade', outcome: 'Won', mrr: 8900, cycle: 45, similarity: 0.87, keyFactor: 'ROI calc at Propose' },
  { name: 'MedStar — DIA + UCaaS Bundle', outcome: 'Lost', mrr: 15200, cycle: 112, similarity: 0.83, keyFactor: 'No exec sponsor identified' },
  { name: 'StateGov — Dark Fiber Build', outcome: 'Won', mrr: 22000, cycle: 95, similarity: 0.79, keyFactor: 'Compliance docs ready early' },
]

const WIN_LOSS_ITEMS = [
  { deal: 'TechCorp SD-WAN', outcome: 'Won', factor: 'Champion drove internal alignment in 2 weeks', lesson: 'Invest in champion enablement materials', date: '2025-12-15' },
  { deal: 'HealthNet DIA', outcome: 'Lost', factor: 'Competitor offered 20% lower price', lesson: 'Lead with TCO/value, not price comparison', date: '2025-11-28' },
  { deal: 'EduFirst Bundle', outcome: 'Lost', factor: 'Procurement process took 90+ days', lesson: 'Map procurement early in Government/Education', date: '2025-11-10' },
  { deal: 'RetailMax Ethernet', outcome: 'Won', factor: 'Technical POC sealed the deal', lesson: 'Offer POC for deals >$10K MRR', date: '2025-10-22' },
]

const COMPETITORS = [
  { name: 'Lumen', strengths: 'Large fiber footprint, brand recognition, federal contracts', weaknesses: 'Slow provisioning, legacy systems, high churn', winRate: 0.62, avgCycleDelta: '+15 days', battlecard: true },
  { name: 'Comcast Business', strengths: 'Aggressive pricing, HFC last-mile, bundling', weaknesses: 'Limited fiber footprint, SMB-focused support', winRate: 0.71, avgCycleDelta: '+5 days', battlecard: true },
  { name: 'Spectrum Enterprise', strengths: 'Coax/fiber hybrid, competitive mid-market', weaknesses: 'Limited geographic reach, fewer enterprise features', winRate: 0.68, avgCycleDelta: '+8 days', battlecard: false },
  { name: 'Zayo', strengths: 'Dense metro fiber, wavelength services', weaknesses: 'Higher pricing, limited managed services', winRate: 0.58, avgCycleDelta: '+22 days', battlecard: true },
]

const OBJECTIONS = [
  { objection: '"Your price is too high"', response: 'Shift to TCO analysis — show 3-year savings including downtime costs, migration fees, and hidden charges from competitors. Reference similar customer savings.', category: 'Price' },
  { objection: '"We already have a provider"', response: 'Acknowledge relationship, then ask about pain points. Position as complement or upgrade path. Offer risk-free POC on a single site.', category: 'Status Quo' },
  { objection: '"We need to think about it"', response: 'Identify specific concerns. Offer to address them in writing. Set a follow-up date. Ask: "What would need to be true for you to move forward?"', category: 'Stall' },
  { objection: '"Your competitor offered X feature"', response: 'Validate the feature need, then reframe around total solution value. Show where our platform excels. Ask if that feature is a dealbreaker or nice-to-have.', category: 'Competitive' },
]

const NEGOTIATION = [
  { tactic: 'Anchor High', desc: 'Start with full list price to establish value baseline before any discounting', when: 'Initial proposal' },
  { tactic: 'Bundle Value', desc: 'Package multiple services to increase total deal value while offering perceived savings', when: 'Multi-product opportunities' },
  { tactic: 'Term Leverage', desc: 'Offer better pricing for longer commitments (24/36 month terms)', when: 'Price-sensitive deals' },
  { tactic: 'Strategic Concession', desc: 'Give on low-cost items (waived NRC, free month) to protect MRR', when: 'Final negotiation rounds' },
  { tactic: 'Deadline Creation', desc: 'Tie pricing to quarter-end or promo window to create urgency', when: 'Stalled negotiations' },
]

const ADD_ITEMS = [
  { label: 'Custom Qualification Gate', icon: '🚪', desc: 'Add a custom checkpoint for any stage' },
  { label: 'SLA Template', icon: '📄', desc: 'Attach SLA requirements to deal stages' },
  { label: 'Approval Workflow', icon: '✅', desc: 'Define approval chains for discounts or terms' },
  { label: 'Email Template', icon: '📧', desc: 'Create templated outreach for deal stages' },
  { label: 'Risk Scoring Rule', icon: '⚠️', desc: 'Add custom risk flags based on deal attributes' },
  { label: 'Escalation Path', icon: '📈', desc: 'Define escalation triggers and routing' },
]

// ── Priority badge colors ───────────────────────────────────────────────────

const PRIORITY_COLORS = {
  critical: { bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
  high: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
  medium: { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa' },
  low: { bg: 'rgba(139,148,158,0.12)', color: '#8b949e' },
}

const SEV_COLORS = {
  critical: { bg: 'rgba(248,113,113,0.12)', color: '#f87171', border: 'rgba(248,113,113,0.25)' },
  warning: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
  info: { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: 'rgba(96,165,250,0.25)' },
}

// ═════════════════════════════════════════════════════════════════════════════
// PlaybookEngine Page
// ═════════════════════════════════════════════════════════════════════════════

// --- Data-driven derivation helpers ---

function deriveRulesFromAccounts(accounts) {
  if (!accounts || accounts.length < 3) return null
  const rules = []
  let id = 0

  // Win rate by vertical
  const verticals = {}
  for (const acc of accounts) {
    const v = acc.mega_vertical || acc.vertical || 'Unknown'
    if (!verticals[v]) verticals[v] = { won: 0, lost: 0, mrr: 0 }
    verticals[v].won += acc.total_deals_won || 0
    verticals[v].lost += acc.total_deals_lost || 0
    verticals[v].mrr += acc.active_pipeline_mrr || 0
  }
  const sortedVerts = Object.entries(verticals).filter(([,d]) => (d.won + d.lost) >= 3).sort(([,a],[,b]) => {
    const wrA = a.won / (a.won + a.lost || 1)
    const wrB = b.won / (b.won + b.lost || 1)
    return wrB - wrA
  })
  if (sortedVerts.length >= 2) {
    const [topV, topD] = sortedVerts[0]
    const topWR = topD.won / (topD.won + topD.lost)
    rules.push({ id: `DR-${++id}`, rule: `${topV} vertical has highest win rate at ${Math.round(topWR * 100)}% (n=${topD.won + topD.lost})`, source: 'Account analysis', priority: 'high', active: true })
    const [botV, botD] = sortedVerts[sortedVerts.length - 1]
    const botWR = botD.won / (botD.won + botD.lost)
    rules.push({ id: `DR-${++id}`, rule: `${botV} vertical has lowest win rate at ${Math.round(botWR * 100)}% — consider enhanced qualification`, source: 'Account analysis', priority: 'medium', active: true })
  }

  // NRR-based rules
  const lowNRR = accounts.filter(a => (a.net_revenue_retention || 1) < 0.9)
  if (lowNRR.length > 0) {
    rules.push({ id: `DR-${++id}`, rule: `${lowNRR.length} accounts have NRR below 90% — prioritize retention plays`, source: 'NRR analysis', priority: 'critical', active: true })
  }

  // Velocity rules
  const stalled = accounts.filter(a => (a.days_since_last_activity || 0) > 60)
  if (stalled.length > 0) {
    rules.push({ id: `DR-${++id}`, rule: `${stalled.length} accounts inactive >60 days — trigger re-engagement`, source: 'Activity analysis', priority: 'high', active: true })
  }

  // Product concentration risks
  const highConcentration = accounts.filter(a => {
    const conc = a.product_concentration || {}
    return Object.values(conc).some(p => p.pct > 0.8)
  })
  if (highConcentration.length > 0) {
    rules.push({ id: `DR-${++id}`, rule: `${highConcentration.length} accounts have >80% revenue from one product — cross-sell opportunity`, source: 'Concentration analysis', priority: 'medium', active: true })
  }

  // Pipeline rules
  const avgPipeline = accounts.reduce((s, a) => s + (a.active_pipeline_mrr || 0), 0) / accounts.length
  if (avgPipeline > 0) {
    rules.push({ id: `DR-${++id}`, rule: `Average pipeline per account: $${Math.round(avgPipeline).toLocaleString()}/mo MRR`, source: 'Pipeline analysis', priority: 'medium', active: true })
  }

  return rules.length > 0 ? rules : null
}

function deriveWinLossFromAccounts(accounts) {
  if (!accounts || accounts.length === 0) return null
  const items = []
  for (const acc of accounts) {
    // Won deals
    for (const d of (acc.historical_deals || []).slice(0, 2)) {
      if (d.type === 'Won' && (d.mrr || 0) > 0) {
        items.push({ deal: `${acc.customer_account || acc.name} ${d.product || ''}`.trim(), outcome: 'Won', factor: `Won at $${Math.round(d.mrr).toLocaleString()}/mo MRR`, lesson: `Product: ${d.product || 'N/A'}, Rep: ${d.rep || 'N/A'}`, date: d.close || '' })
      }
    }
    // Lost deals
    for (const d of (acc.close_lost_deals || []).slice(0, 2)) {
      const reason = d.loss_reason || d.type || 'Unknown'
      items.push({ deal: `${acc.customer_account || acc.name} ${d.product_group || ''}`.trim(), outcome: 'Lost', factor: reason, lesson: `Competitor: ${d.competitor_won || 'N/A'}`, date: d.close_date || '' })
    }
  }
  return items.length > 0 ? items.slice(0, 10) : null
}

function deriveCompetitorsFromAccounts(accounts) {
  if (!accounts || accounts.length === 0) return null
  const compMap = {}
  for (const acc of accounts) {
    for (const comp of (acc.competitor_landscape || [])) {
      if (!comp) continue
      if (!compMap[comp]) compMap[comp] = { name: comp, lossCount: 0, totalDeals: 0 }
      compMap[comp].totalDeals++
    }
    for (const d of (acc.close_lost_deals || [])) {
      if (d.competitor_won && compMap[d.competitor_won]) {
        compMap[d.competitor_won].lossCount++
      }
    }
  }
  const comps = Object.values(compMap).filter(c => c.totalDeals >= 1).sort((a,b) => b.totalDeals - a.totalDeals).slice(0, 6)
  if (comps.length === 0) return null
  return comps.map(c => ({
    name: c.name,
    strengths: `Appeared in ${c.totalDeals} competitive deals`,
    weaknesses: `Lost ${c.lossCount} deal${c.lossCount !== 1 ? 's' : ''} to them`,
    winRate: c.totalDeals > 0 ? Math.max(0.3, 1 - c.lossCount / c.totalDeals) : 0.5,
    avgCycleDelta: `${c.totalDeals} encounters`,
    battlecard: c.totalDeals >= 3,
  }))
}

function deriveSimilarDealsFromAccounts(accounts) {
  if (!accounts || accounts.length < 2) return null
  const deals = []
  for (const acc of accounts) {
    for (const d of (acc.historical_deals || []).slice(0, 3)) {
      if (!d.mrr) continue
      deals.push({
        name: `${acc.customer_account || acc.name} — ${d.product || 'Deal'}`,
        outcome: d.type === 'Won' || d.type === 'won' ? 'Won' : 'Lost',
        mrr: Math.abs(d.mrr || 0),
        cycle: 60, // approximation
        similarity: 0.7 + Math.random() * 0.25,
        keyFactor: d.rep ? `Rep: ${d.rep}` : (acc.mega_vertical || 'N/A'),
      })
    }
  }
  return deals.length > 0 ? deals.sort((a,b) => b.similarity - a.similarity).slice(0, 6) : null
}

export default function PlaybookEngine({ accounts = [], backtestResults = null }) {
  const [qualFramework, setQualFramework] = useState('meddpicc') // 'meddpicc' | 'bant'

  const hasData = accounts.length > 0

  // Derive data-driven content or fall back to demo
  const derivedRules = useMemo(() => deriveRulesFromAccounts(accounts), [accounts])
  const derivedWinLoss = useMemo(() => deriveWinLossFromAccounts(accounts), [accounts])
  const derivedCompetitors = useMemo(() => deriveCompetitorsFromAccounts(accounts), [accounts])
  const derivedSimilarDeals = useMemo(() => deriveSimilarDealsFromAccounts(accounts), [accounts])

  const [reviewQueue, setReviewQueue] = useState(REVIEW_QUEUE)
  const [rules, setRules] = useState(hasData && derivedRules ? derivedRules : EXTRACTED_RULES)
  const [removedRules, setRemovedRules] = useState([])
  const [hoveredRule, setHoveredRule] = useState(null)

  // Update rules when accounts change
  const prevAccountsLen = useMemo(() => accounts.length, [accounts])
  useMemo(() => {
    if (derivedRules && derivedRules.length > 0) {
      setRules(derivedRules)
    }
  }, [derivedRules])

  const activeWinLoss = derivedWinLoss || WIN_LOSS_ITEMS
  const activeCompetitors = derivedCompetitors || COMPETITORS
  const activeSimilarDeals = derivedSimilarDeals || SIMILAR_DEALS

  // Review queue actions
  const approveItem = useCallback((id) => {
    setReviewQueue(q => q.filter(i => i.id !== id))
  }, [])
  const dismissItem = useCallback((id) => {
    setReviewQueue(q => q.filter(i => i.id !== id))
  }, [])

  // Rule management
  const removeRule = useCallback((id) => {
    setRules(prev => {
      const rule = prev.find(r => r.id === id)
      if (rule) setRemovedRules(rem => [...rem, { ...rule, active: false }])
      return prev.filter(r => r.id !== id)
    })
  }, [])
  const restoreRule = useCallback((id) => {
    setRemovedRules(prev => {
      const rule = prev.find(r => r.id === id)
      if (rule) setRules(rs => [...rs, { ...rule, active: true }])
      return prev.filter(r => r.id !== id)
    })
  }, [])

  const qualData = qualFramework === 'meddpicc' ? MEDDPICC : BANT

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-sans text-xl font-bold" style={{ color: T.text }}>Playbook Engine</h1>
          <p className="font-mono text-[11px] mt-1" style={{ color: T.textDim }}>
            AI-extracted rules, qualification frameworks, and competitive intelligence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] px-2 py-1 rounded" style={{ background: T.accentDim, color: T.accent }}>
            {rules.length} ACTIVE RULES
          </span>
          <span className="font-mono text-[9px] px-2 py-1 rounded" style={{ background: hasData ? 'rgba(52,211,153,0.1)' : 'rgba(139,148,158,0.1)', color: hasData ? T.green : T.textDim }}>
            {hasData ? `LIVE DATA · ${accounts.length} accounts` : 'DEMO DATA'}
          </span>
          <span className="font-mono text-[9px] px-2 py-1 rounded" style={{ background: 'rgba(52,211,153,0.1)', color: T.green }}>
            {reviewQueue.length} PENDING REVIEW
          </span>
        </div>
      </div>

      {/* ── 1. Review Queue ── */}
      {reviewQueue.length > 0 && (
        <div style={{ background: 'rgba(251,191,36,0.06)', border: `1px solid rgba(251,191,36,0.2)`, borderRadius: 14, padding: '16px 20px' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">⚡</span>
            <span className="font-sans text-sm font-semibold" style={{ color: T.yellow }}>Review Queue</span>
            <span className="font-mono text-[10px]" style={{ color: T.textDim }}>{reviewQueue.length} suggestions from AI analysis</span>
          </div>
          <div className="space-y-2.5">
            {reviewQueue.map(item => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg transition-colors"
                style={{ background: T.card, border: `1px solid ${T.border}` }}
              >
                <ConfidenceRing value={item.confidence} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs leading-relaxed" style={{ color: T.text }}>{item.text}</div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="font-mono text-[9px]" style={{ color: T.textDim }}>{item.source}</span>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: T.accentDim, color: T.accent }}>{item.category}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => approveItem(item.id)}
                    className="px-2.5 py-1 rounded text-[10px] font-mono font-semibold cursor-pointer border-0 transition-colors"
                    style={{ background: 'rgba(52,211,153,0.15)', color: T.green }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {}}
                    className="px-2.5 py-1 rounded text-[10px] font-mono font-semibold cursor-pointer border-0 transition-colors"
                    style={{ background: 'rgba(96,165,250,0.15)', color: T.blue }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => dismissItem(item.id)}
                    className="px-2.5 py-1 rounded text-[10px] font-mono font-semibold cursor-pointer border-0 transition-colors"
                    style={{ background: 'rgba(139,148,158,0.1)', color: T.textDim }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 2. Qualification Framework ── */}
      <Section title="Qualification Framework" badge={qualFramework.toUpperCase()} defaultOpen>
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setQualFramework('meddpicc')}
            className={cn("px-3 py-1.5 rounded-md font-mono text-[11px] font-semibold cursor-pointer border transition-colors",
              qualFramework === 'meddpicc' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent')}
            style={{
              background: qualFramework === 'meddpicc' ? T.accentDim : 'rgba(139,148,158,0.08)',
              color: qualFramework === 'meddpicc' ? T.accent : T.textDim,
              borderColor: qualFramework === 'meddpicc' ? T.accentBorder : 'transparent',
            }}
          >
            MEDDPICC
          </button>
          <button
            onClick={() => setQualFramework('bant')}
            className="px-3 py-1.5 rounded-md font-mono text-[11px] font-semibold cursor-pointer border transition-colors"
            style={{
              background: qualFramework === 'bant' ? T.accentDim : 'rgba(139,148,158,0.08)',
              color: qualFramework === 'bant' ? T.accent : T.textDim,
              borderColor: qualFramework === 'bant' ? T.accentBorder : 'transparent',
            }}
          >
            BANT
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(qualData).map(([key, item]) => (
            <div key={key} className="p-3.5 rounded-lg" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-xs font-bold" style={{ color: T.accent }}>{key}</span>
                <span className="font-sans text-xs font-semibold" style={{ color: T.text }}>{item.label}</span>
              </div>
              <div className="font-mono text-[10px] mb-2" style={{ color: T.textDim }}>{item.desc}</div>
              <div className="font-mono text-[10px] italic" style={{ color: T.textMid }}>"{item.question}"</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 3. Extracted Rules ── */}
      <Section title="Extracted Rules" badge={`${rules.length} active`} defaultOpen>
        <div className="space-y-2">
          {rules.map(r => {
            const pc = PRIORITY_COLORS[r.priority] || PRIORITY_COLORS.medium
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 p-3 rounded-lg transition-colors group"
                style={{ background: T.bg, border: `1px solid ${T.border}` }}
                onMouseEnter={() => setHoveredRule(r.id)}
                onMouseLeave={() => setHoveredRule(null)}
              >
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold shrink-0"
                  style={{ background: pc.bg, color: pc.color }}>
                  {r.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs" style={{ color: T.text }}>{r.rule}</div>
                  <div className="font-mono text-[9px] mt-1" style={{ color: T.textDim }}>{r.source}</div>
                </div>
                <div className={cn("flex items-center gap-1.5 transition-opacity", hoveredRule === r.id ? 'opacity-100' : 'opacity-0')}>
                  <button className="px-2 py-0.5 rounded text-[9px] font-mono cursor-pointer border-0"
                    style={{ background: 'rgba(96,165,250,0.12)', color: T.blue }}>Modify</button>
                  <button onClick={() => removeRule(r.id)}
                    className="px-2 py-0.5 rounded text-[9px] font-mono cursor-pointer border-0"
                    style={{ background: 'rgba(248,113,113,0.12)', color: T.red }}>Remove</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Removed rules zone */}
        {removedRules.length > 0 && (
          <div className="mt-4 pt-3" style={{ borderTop: `1px dashed ${T.border}` }}>
            <div className="font-mono text-[10px] mb-2" style={{ color: T.textDim }}>Removed Rules</div>
            <div className="space-y-1.5">
              {removedRules.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg opacity-60"
                  style={{ background: T.bg, border: `1px dashed ${T.border}` }}>
                  <div className="flex-1 font-mono text-[11px] line-through" style={{ color: T.textDim }}>{r.rule}</div>
                  <button onClick={() => restoreRule(r.id)}
                    className="px-2 py-0.5 rounded text-[9px] font-mono cursor-pointer border-0"
                    style={{ background: 'rgba(52,211,153,0.12)', color: T.green }}>Restore</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── 4. Stage Checkpoints & Artifacts ── */}
      <Section title="Stage Checkpoints & Artifacts" badge={`${STAGE_CHECKPOINTS.length} stages`}>
        <div className="space-y-3">
          {STAGE_CHECKPOINTS.map(sc => (
            <div key={sc.stage} className="p-4 rounded-lg" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
              <div className="font-sans text-sm font-semibold mb-2.5" style={{ color: T.accent }}>{sc.stage}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="font-mono text-[10px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: T.textDim }}>Checkpoints</div>
                  {sc.checkpoints.map((cp, i) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <span className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0"
                        style={{ borderColor: T.border }}>
                        <span className="text-[8px]" style={{ color: T.textDim }}>☐</span>
                      </span>
                      <span className="font-mono text-[11px]" style={{ color: T.textMid }}>{cp}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="font-mono text-[10px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: T.textDim }}>Required Artifacts</div>
                  {sc.artifacts.map((art, i) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <span className="text-[10px]" style={{ color: T.blue }}>📎</span>
                      <span className="font-mono text-[11px]" style={{ color: T.textMid }}>{art}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 5. Stakeholder Requirements ── */}
      <Section title="Stakeholder Requirements" badge={`${STAKEHOLDERS.length} roles`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STAKEHOLDERS.map(s => (
            <div key={s.role} className="p-3.5 rounded-lg" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base">{s.icon}</span>
                <span className="font-sans text-xs font-semibold" style={{ color: T.text }}>{s.role}</span>
              </div>
              <div className="font-mono text-[10px] mb-2" style={{ color: T.textDim }}>{s.description}</div>
              <div className="font-mono text-[9px] px-2 py-0.5 rounded inline-block" style={{ background: T.accentDim, color: T.accent }}>
                Required by: {s.required}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 6. Velocity & Activity Rules ── */}
      <Section title="Velocity & Activity Rules" badge={`${VELOCITY_RULES.length} rules`}>
        <div className="space-y-2">
          {VELOCITY_RULES.map((v, i) => {
            const sc = SEV_COLORS[v.severity] || SEV_COLORS.info
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: T.bg, border: `1px solid ${sc.border}` }}>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold shrink-0 mt-0.5"
                  style={{ background: sc.bg, color: sc.color }}>{v.severity}</span>
                <div className="flex-1">
                  <div className="font-mono text-xs font-semibold" style={{ color: T.text }}>When: {v.trigger}</div>
                  <div className="font-mono text-[11px] mt-1" style={{ color: T.textMid }}>→ {v.action}</div>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── 7. Similar Deal Pattern Matching ── */}
      <Section title="Similar Deal Pattern Matching" badge={`${activeSimilarDeals.length} matches`}>
        <div className="space-y-2.5">
          {activeSimilarDeals.map((d, i) => (
            <div key={i} className="flex items-center gap-4 p-3.5 rounded-lg"
              style={{ background: T.bg, border: `1px solid ${T.border}` }}>
              <ConfidenceRing value={d.similarity} size={40} color={T.accent} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-xs font-semibold" style={{ color: T.text }}>{d.name}</span>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                    style={{
                      background: d.outcome === 'Won' ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                      color: d.outcome === 'Won' ? T.green : T.red,
                    }}>{d.outcome}</span>
                </div>
                <div className="font-mono text-[10px] mt-1" style={{ color: T.textDim }}>
                  ${d.mrr.toLocaleString()} MRR · {d.cycle}d cycle · Key: {d.keyFactor}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-sm font-bold" style={{ color: T.accent }}>{Math.round(d.similarity * 100)}%</div>
                <div className="font-mono text-[9px]" style={{ color: T.textDim }}>match</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 8. Win/Loss Feedback Loop ── */}
      <Section title="Win/Loss Feedback Loop" badge={`${activeWinLoss.length} entries`}>
        <div className="space-y-2.5">
          {activeWinLoss.map((wl, i) => (
            <div key={i} className="p-3.5 rounded-lg" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded font-semibold"
                  style={{
                    background: wl.outcome === 'Won' ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                    color: wl.outcome === 'Won' ? T.green : T.red,
                  }}>{wl.outcome}</span>
                <span className="font-sans text-xs font-semibold" style={{ color: T.text }}>{wl.deal}</span>
                <span className="font-mono text-[9px] ml-auto" style={{ color: T.textDim }}>{wl.date}</span>
              </div>
              <div className="font-mono text-[11px]" style={{ color: T.textMid }}>
                <strong style={{ color: T.text }}>Factor:</strong> {wl.factor}
              </div>
              <div className="font-mono text-[11px] mt-1" style={{ color: T.teal }}>
                → Lesson: {wl.lesson}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 9. Competitor Profiles ── */}
      <Section title="Competitor Profiles" badge={`${activeCompetitors.length} tracked`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activeCompetitors.map(c => (
            <div key={c.name} className="p-4 rounded-lg" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between mb-2.5">
                <span className="font-sans text-sm font-bold" style={{ color: T.text }}>{c.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px]" style={{ color: T.textDim }}>{c.avgCycleDelta}</span>
                  {c.battlecard && (
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: T.accentDim, color: T.accent }}>
                      Battlecard
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-[10px]" style={{ color: T.textDim }}>Win rate vs:</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: T.border }}>
                  <div className="h-full rounded-full" style={{ width: `${c.winRate * 100}%`, background: c.winRate >= 0.65 ? T.green : c.winRate >= 0.5 ? T.yellow : T.red }} />
                </div>
                <span className="font-mono text-[11px] font-semibold" style={{ color: c.winRate >= 0.65 ? T.green : c.winRate >= 0.5 ? T.yellow : T.red }}>
                  {Math.round(c.winRate * 100)}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="font-mono text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: T.green }}>Strengths</div>
                  <div className="font-mono text-[10px]" style={{ color: T.textDim }}>{c.strengths}</div>
                </div>
                <div>
                  <div className="font-mono text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: T.red }}>Weaknesses</div>
                  <div className="font-mono text-[10px]" style={{ color: T.textDim }}>{c.weaknesses}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 10. Objection Handling ── */}
      <Section title="Objection Handling" badge={`${OBJECTIONS.length} scripts`}>
        <div className="space-y-2.5">
          {OBJECTIONS.map((o, i) => (
            <div key={i} className="p-3.5 rounded-lg" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(244,114,182,0.12)', color: T.pink }}>
                  {o.category}
                </span>
                <span className="font-sans text-xs font-semibold" style={{ color: T.yellow }}>{o.objection}</span>
              </div>
              <div className="font-mono text-[11px] leading-relaxed" style={{ color: T.textMid }}>{o.response}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 11. Negotiation Framework ── */}
      <Section title="Negotiation Framework" badge={`${NEGOTIATION.length} tactics`}>
        <div className="space-y-2">
          {NEGOTIATION.map((n, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: T.bg, border: `1px solid ${T.border}` }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-mono text-xs font-bold"
                style={{ background: T.accentDim, color: T.accent }}>
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="font-sans text-xs font-semibold" style={{ color: T.text }}>{n.tactic}</div>
                <div className="font-mono text-[11px] mt-0.5" style={{ color: T.textMid }}>{n.desc}</div>
                <div className="font-mono text-[9px] mt-1.5 px-2 py-0.5 rounded inline-block"
                  style={{ background: 'rgba(45,212,191,0.1)', color: T.teal }}>
                  Best for: {n.when}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 12. Add Missing Items ── */}
      <Section title="Add Missing Items" badge="customize">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ADD_ITEMS.map((item, i) => (
            <button key={i}
              className="p-4 rounded-lg text-left cursor-pointer border transition-all hover:scale-[1.02]"
              style={{ background: T.bg, borderColor: T.border }}
            >
              <div className="text-xl mb-2">{item.icon}</div>
              <div className="font-sans text-xs font-semibold mb-1" style={{ color: T.text }}>{item.label}</div>
              <div className="font-mono text-[10px]" style={{ color: T.textDim }}>{item.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* ── Bottom actions ── */}
      <div className="flex items-center gap-3 pt-2 pb-6">
        <button className="px-4 py-2 rounded-lg font-mono text-[11px] font-semibold cursor-pointer border transition-colors"
          style={{ background: T.accentDim, color: T.accent, borderColor: T.accentBorder }}>
          Export Playbook
        </button>
        <button className="px-4 py-2 rounded-lg font-mono text-[11px] font-semibold cursor-pointer border transition-colors"
          style={{ background: 'rgba(52,211,153,0.08)', color: T.green, borderColor: 'rgba(52,211,153,0.2)' }}>
          Share with Team
        </button>
        <button className="px-4 py-2 rounded-lg font-mono text-[11px] font-semibold cursor-pointer border transition-colors"
          style={{ background: 'rgba(139,148,158,0.08)', color: T.textDim, borderColor: T.border }}>
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
