import { useState, useRef, useMemo, useCallback } from 'react'
import { T } from '../lib/constants'

/* ── Demo data (used when no live engine data available) ── */
const TABS = [
  { n: 'Historical', r: 3842, i: '\uD83D\uDCCA' },
  { n: 'Bookings', r: 1206, i: '\uD83D\uDCB0' },
  { n: 'Engagement', r: 8421, i: '\uD83D\uDCE7' },
  { n: 'Churn', r: 486, i: '\u26A0' },
  { n: 'Markets', r: 42, i: '\uD83D\uDDFA' },
  { n: 'Locations', r: 318, i: '\uD83D\uDCCD' },
  { n: 'Services', r: 2104, i: '\u26A1' },
]

const TEAM = [
  { n: 'Sarah Chen', reps: ['Jose Banales', 'Katie Allen', 'Michael Kahn'] },
  { n: 'Marcus Webb', reps: ['Jennifer Middleton', 'William Good', 'David Park'] },
]
const ALL_REPS = TEAM.flatMap(m => m.reps.map(r => ({ name: r, mgr: m.n })))

const DEMO = {
  summary: {
    closed: 842600, closedSub: '+$62K vs prior 12m',
    pipeActive: 63000, pipeSub: '48 deals \u00B7 52.7% avg prob',
    locSpend: 134200, atRiskMRR: 48200, pipeWtd: 98200,
    headline: '$843K closed in trailing 12 months with $63K still in active pipeline. $134K/mo in location addressable spend identified across 28 accounts. $48K at risk from 14 expiring contracts. 5 accounts have outage or intel urgency signals right now.',
  },
  actions: [
    { p: 1, a: 'Desert Health', m: 'Phoenix', tags: [{ l: 'Outage', cl: 'rd' }, { l: 'New Intel', cl: 'bl' }], prod: 'SD-WAN + DDoS', v: 9200, sc: 156, ps: { u: 52.9, o: 20.6, c: 82.5 }, hasPipe: true, pipeDeals: 2,
      tk: "Cox outage hit 3 clinics. They're running single-carrier with no failover \u2014 this is the redundancy pitch you've been waiting for. Lead with failover architecture, close with bundled DDoS.",
      stats: { tmr: 1533, deals: 2, nibAll: 42800, nib24: 18200, health: 62, mod: 1.14, ds: 1 },
      churn: { prob: 0.42, risk: 644, signals: [{ s: 'Engagement (1d)', p: .15 }, { s: 'Health watch', p: .10 }, { s: 'Single-carrier', p: .25 }] },
      intel: 'Cox Phoenix outage ongoing since Mar 18 \u2014 15K+ business customers impacted', gaps: ['Dark Fiber', 'SD-WAN', 'DDoS'],
      engines: {
        outage: { active: true, event: 'Cox Phoenix outage \u2014 15K+ affected', signal: 'Single-carrier Ethernet, no failover. Redundancy products (SD-WAN, DDoS) have 3\u00D7 urgency.', products: ['SD-WAN', 'DDoS'], urgency: 'critical' },
        location: { footprint: 3, onNet: true, spread: 'single-metro', affinity: [{ p: 'Dark Fiber', score: 88 }, { p: 'SD-WAN', score: 82 }, { p: 'DDoS', score: 78 }], reason: '3 clinic locations on-net in Phoenix metro. Footprint matches Dark Fiber + SD-WAN + DDoS bundle pattern.' },
        prediction: { similar: 'Healthcare accounts in Phoenix close SD-WAN at 62% win rate, 38-day avg cycle. Recommended entry: Design Solution.', winRate: 62, cycle: 38, entry: 'Design Solution' },
        event: { modifier: 1.14, context: 'Cox outage creating 14% uplift on redundancy deals in AZ. Accounts exposed closing 3\u00D7 faster than baseline.' },
      } },
    { p: 2, a: 'TerraWave Comm', m: 'Dallas', tags: [{ l: 'New Intel', cl: 'bl' }, { l: 'Tailwind', cl: 'gn' }], prod: 'WL Long Haul', v: 37600, sc: 191, ps: { u: 15.4, o: 87.6, c: 88.2 }, hasPipe: true, pipeDeals: 3,
      tk: "Your biggest metro fiber customer is buying long-haul from someone else. Lumen may exit enterprise \u2014 lock them in now with a bundled Dallas-Chicago-Atlanta rate that beats their current carrier by 25%.",
      stats: { tmr: 15533, deals: 8, nibAll: 386200, nib24: -12400, health: 52, mod: 1.08, ds: 12 },
      churn: { prob: 0.38, risk: 5903, signals: [{ s: 'Negative NIB (24m)', p: .33 }, { s: 'Health watch', p: .10 }] },
      intel: 'Lumen exploring strategic alternatives \u2014 their long-haul provider may exit enterprise', gaps: ['WL Long Haul', 'DDoS'],
      engines: {
        outage: { active: false },
        location: { footprint: 12, onNet: true, spread: 'multi-metro', affinity: [{ p: 'WL Long Haul', score: 95 }, { p: 'DDoS', score: 72 }], reason: '12 locations across Dallas-Chicago-Atlanta. Metro fiber maxed \u2014 long-haul wavelengths are the natural next product for this footprint.' },
        prediction: { similar: 'Carrier accounts with 8+ deals close WL Long Haul at 71% win rate, 52-day cycle. Their metro spend predicts $37K+ long-haul addressable.', winRate: 71, cycle: 52, entry: 'Propose' },
        event: { modifier: 1.08, context: 'Lumen strategic review creating switching opportunity. M&A event gives 8% uplift on carrier displacement deals.' },
      } },
    { p: 3, a: 'Apex Financial', m: 'New York', tags: [{ l: 'Tailwind', cl: 'gn' }, { l: '14d silent', cl: 'am' }], prod: 'zColo + DDoS', v: 22400, sc: 151, ps: { u: 7.7, o: 55.6, c: 88.1 }, hasPipe: true, pipeDeals: 1,
      tk: "SD-WAN across 6 states but NYC HQ has no colo or DDoS \u2014 for a financial firm, that's a compliance conversation. Fed easing means budgets are loosening. Bundle at preferred rate.",
      stats: { tmr: 2408, deals: 3, nibAll: 68400, nib24: 8200, health: 65, mod: 1.18, ds: 14 },
      churn: { prob: 0.10, risk: 241, signals: [{ s: 'Health watch', p: .10 }] },
      intel: 'Fed easing signal \u2014 financial budgets unlocking this quarter', gaps: ['zColo', 'DDoS', 'Dark Fiber'],
      engines: {
        outage: { active: false },
        location: { footprint: 6, onNet: true, spread: 'multi-state', affinity: [{ p: 'zColo', score: 92 }, { p: 'DDoS', score: 89 }, { p: 'Dark Fiber', score: 74 }], reason: "6 locations across 4 states with NYC HQ. Financial vertical + no colo = compliance gap. Location profile is 92% match for zColo." },
        prediction: { similar: 'Financial accounts in NYC close zColo at 74% win rate. Compliance-driven deals have 28-day avg cycle \u2014 faster than avg.', winRate: 74, cycle: 28, entry: 'Propose' },
        event: { modifier: 1.18, context: 'Fed easing + AI fiber demand creating strongest NYC tailwind in 18 months. 18% uplift on financial infrastructure deals.' },
      } },
    { p: 4, a: 'Broadleaf Energy', m: 'Houston', tags: [{ l: 'Churn Risk', cl: 'rd' }, { l: '24d silent', cl: 'am' }], prod: 'SD-WAN', v: 7800, sc: 134, ps: { u: 41.7, o: 16.8, c: 75.2 }, hasPipe: false, pipeDeals: 0,
      tk: "NIB is -$18K over 24 months \u2014 3 services month-to-month. This is a save play \u2014 lead with MPLS-to-SD-WAN cost savings across their 24 locations. Retention first, expansion second.",
      stats: { tmr: 1900, deals: 2, nibAll: 24600, nib24: -18400, health: 38, mod: 0.96, ds: 24 },
      churn: { prob: 0.79, risk: 1501, signals: [{ s: 'MTM (3 svc)', p: .35 }, { s: 'Negative NIB', p: .40 }, { s: 'Silent 24d', p: .15 }, { s: 'Critical health', p: .30 }, { s: 'Headwind', p: .08 }] },
      intel: 'Brightspeed transition disruptions \u2014 former Lumen customers seeking alternatives', gaps: ['SD-WAN', 'Dark Fiber'],
      engines: {
        outage: { active: false },
        location: { footprint: 24, onNet: true, spread: 'multi-state', affinity: [{ p: 'SD-WAN', score: 94 }, { p: 'Dark Fiber', score: 68 }], reason: '24 warehouse/office locations across TX and LA. MPLS-to-SD-WAN migration pattern \u2014 this footprint is a 94% match for SD-WAN.' },
        prediction: { similar: 'Energy vertical accounts with declining NIB respond to cost-savings positioning. SD-WAN save deals close at 58% when led with TCO comparison.', winRate: 58, cycle: 42, entry: 'Discover' },
        event: { modifier: 0.96, context: 'Brightspeed transition creating 4% headwind in SE markets. But Lumen migration pain is creating switching opportunity on legacy circuits.' },
      } },
    { p: 5, a: 'CloudNexus Inc', m: 'Denver', tags: [{ l: 'NIB +$48K', cl: 'gn' }, { l: 'Tailwind', cl: 'gn' }], prod: 'Wavelengths', v: 18000, sc: 135, ps: { u: 0.7, o: 45.4, c: 88.5 }, hasPipe: true, pipeDeals: 2,
      tk: "Fastest growing account in your patch. DC bandwidth will double within 12 months \u2014 get them on wavelengths before they outgrow lit services. AI buildout in Denver is driving their demand curve.",
      stats: { tmr: 5600, deals: 6, nibAll: 142800, nib24: 48200, health: 88, mod: 1.09, ds: 2 },
      churn: { prob: 0.0, risk: 0, signals: [] },
      intel: 'AI data center buildout accelerating in Denver metro', gaps: ['Wavelengths'],
      engines: {
        outage: { active: false },
        location: { footprint: 4, onNet: true, spread: 'single-metro', affinity: [{ p: 'Wavelengths', score: 91 }], reason: '4 DC locations in Denver metro running Dark Fiber at capacity. Bandwidth growth trajectory predicts wavelength need within 6 months.' },
        prediction: { similar: 'Tech accounts with NRR >1.15 close Wavelengths at 76% win rate. High-growth accounts accept 15-20% premium for capacity guarantees.', winRate: 76, cycle: 35, entry: 'Design Solution' },
        event: { modifier: 1.09, context: 'AI DC buildout creating 9% uplift on high-bandwidth products in Denver. Wavelengths and Dark Fiber deals closing 2\u00D7 faster than 2024.' },
      } },
    { p: 6, a: 'Summit Manufacturing', m: 'Chicago', tags: [{ l: 'No Pipeline', cl: 'am' }, { l: 'Location Match', cl: 'pu' }], prod: 'Ethernet + SD-WAN', v: 14200, sc: 118, ps: { u: 0, o: 32.4, c: 86.0 }, hasPipe: false, pipeDeals: 0,
      tk: "No active pipeline but the engines say sell here. 8 manufacturing locations went on-net in Q4, footprint is a 90% match for Ethernet + SD-WAN. Similar accounts in this vertical buy within 60 days of going on-net.",
      stats: { tmr: 0, deals: 0, nibAll: 0, nib24: 0, health: null, mod: 1.04, ds: null },
      churn: { prob: 0, risk: 0, signals: [] },
      intel: null, gaps: ['Ethernet', 'SD-WAN', 'IP Svc'],
      engines: {
        outage: { active: false },
        location: { footprint: 8, onNet: true, spread: 'multi-state', affinity: [{ p: 'Ethernet', score: 96 }, { p: 'SD-WAN', score: 88 }, { p: 'IP Svc', score: 72 }], reason: '8 manufacturing/warehouse locations across IL, IN, OH newly on-net. This footprint is a 96% match for Ethernet \u2014 no services yet. Pure greenfield.' },
        prediction: { similar: 'Manufacturing greenfield accounts that go on-net convert to Ethernet within 58 days at 64% rate. SD-WAN follows within 90 days at 48%.', winRate: 64, cycle: 58, entry: 'Discover' },
        event: { modifier: 1.04, context: 'Neutral market. No significant event tailwind, but on-net activation is the trigger \u2014 similar accounts convert quickly post-activation.' },
      } },
  ],
  health: { score: 68, ok: 96, watch: 28, risk: 18, accts: 142,
    risks: [{ n: 'Peachtree Health', s: 44, why: 'NIB -$8K (24m), 2 disconnects in 90d' }, { n: 'Broadleaf Energy', s: 38, why: '3 services MTM, no renewal activity' }, { n: 'Cascade Telecom', s: 42, why: 'Primary contact left, engagement -80%' }, { n: 'Summit Industries', s: 48, why: 'Contract expires 45d, no renewal in pipe' }],
    up: [{ n: 'CloudNexus Inc', s: 88, d: '+12' }, { n: 'Meridian Health', s: 78, d: '+6' }] },
  churn: { mrr: 48200, exp: 14,
    reasons: [{ r: 'Contract expiry', w: 38 }, { r: 'Competitor', w: 29 }, { r: 'Service quality', w: 18 }, { r: 'Budget', w: 15 }],
    expiring: [{ n: 'Broadleaf Energy', mrr: 4200, ex: 'Apr 2026' }, { n: 'Summit Industries', mrr: 3800, ex: 'May 2026' }, { n: 'Pacific Retail', mrr: 2600, ex: 'Apr 2026' }] },
  pipe: { deals: 48, raw: 186400, wtd: 98200, avg: 52.7,
    stages: [{ s: 'Discover', p: 31, d: 12 }, { s: 'Design', p: 53, d: 10 }, { s: 'Propose', p: 66, d: 11 }, { s: 'Negotiate', p: 85, d: 9 }, { s: 'Verbal', p: 92, d: 6 }] },
  mkts: { grow: [{ c: 'New York', d: '+18%', md: 1.10 }, { c: 'Dallas', d: '+14%', md: 1.08 }, { c: 'Denver', d: '+22%', md: 1.12 }],
    down: [{ c: 'Atlanta', d: '-6%', md: 0.96 }],
    events: [{ t: 'tech', h: 'AI DC buildout \u2014 Denver, Dallas', dl: 12 }, { t: 'reg', h: 'BEAD $42.45B allocations live', dl: 8 }, { t: 'ma', h: 'Lumen strategic alternatives', dl: 4 }, { t: 'outage', h: 'Cox Phoenix \u2014 15K+ affected', dl: 6 }] },
}

/* ── Color helpers ── */
const CL = { rd: T.red, gn: T.green, am: T.yellow, bl: T.blue, pu: T.purple, cy: T.cyan }
const CLbg = { rd: 'rgba(248,113,113,.1)', gn: 'rgba(52,211,153,.1)', am: 'rgba(251,191,36,.1)', bl: 'rgba(96,165,250,.1)', pu: 'rgba(167,139,250,.1)', cy: 'rgba(34,211,238,.1)' }
const ecBg = { tech: CLbg.gn, reg: CLbg.bl, ma: CLbg.pu, outage: CLbg.rd }
const ecFg = { tech: T.green, reg: T.blue, ma: T.purple, outage: T.red }

function Bar({ w, color = T.cyan }) {
  return (
    <div style={{ height: 6, background: T.bg, borderRadius: 4, flex: 1, minWidth: 50 }}>
      <div style={{ height: '100%', borderRadius: 4, opacity: 0.7, width: `${w}%`, background: color, transition: 'width .5s' }} />
    </div>
  )
}

function Accordion({ title, sub, id, state, set, children }) {
  const open = state === id
  return (
    <div style={{ background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, marginBottom: 8, overflow: 'hidden' }}>
      <button
        onClick={() => set(open ? null : id)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer', background: 'transparent', border: 'none', color: T.text, fontFamily: "'IBM Plex Sans', sans-serif", textAlign: 'left' }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="font-mono text-[11px]" style={{ color: T.textDim }}>{sub}</span>
          <span style={{ fontSize: 12, color: T.textDim }}>{open ? '\u25B2' : '\u25BC'}</span>
        </span>
      </button>
      {open && <div style={{ padding: 18, borderTop: `1px solid ${T.border}`, background: T.cardHover }}>{children}</div>}
    </div>
  )
}

/* ── Prompt builder ── */
function buildPrompt(c) {
  const e = c.engines
  const pipeStatus = c.hasPipe
    ? `${c.pipeDeals} active deals in pipeline`
    : 'NO active pipeline \u2014 this is a greenfield/engine-driven recommendation'

  return `You are a B2B telecom sales strategist. I need a complete execution plan for ${c.a} (${c.m} market). All data below comes from 4 analytics engines cross-referenced against ${c.a}'s profile.

## Account Overview
- Account: ${c.a}
- Market: ${c.m}
- Pipeline Status: ${pipeStatus}
- Current TMR: $${c.stats.tmr > 0 ? c.stats.tmr.toLocaleString() : '0'}/mo
- Historical Deals: ${c.stats.deals}
- NIB (All-Time): $${c.stats.nibAll ? c.stats.nibAll.toLocaleString() : '0'} (bookings minus churn/disconnects)
- NIB (24m): $${c.stats.nib24 ? c.stats.nib24.toLocaleString() : '0'}${c.stats.nib24 && c.stats.nib24 < 0 ? ' (contracting \u2014 churn risk)' : c.stats.nib24 && c.stats.nib24 > 20000 ? ' (strong growth)' : ''}
- Health: ${c.stats.health || 'N/A'}/100${c.stats.health && c.stats.health < 50 ? ' (at risk)' : ''}
- Churn Probability: ${Math.round(c.churn.prob * 100)}% ($${c.churn.risk.toLocaleString()}/mo at risk)
- Days Since Contact: ${c.stats.ds || 'No history'}
- Premier Score: ${c.sc}/300 (Urgency: ${c.ps.u.toFixed(0)}, Opportunity: ${c.ps.o.toFixed(0)}, Confidence: ${c.ps.c.toFixed(0)})

## Engine 1: Location Intelligence
- Footprint: ${e.location.footprint} locations, ${e.location.spread}, ${e.location.onNet ? 'on-net' : 'off-net'}
- Analysis: ${e.location.reason}
- Product Affinity:
${e.location.affinity.map(a => `  - ${a.p}: ${a.score}% match`).join('\n')}

## Engine 2: Prediction Engine (Bayesian)
- ${e.prediction.similar}
- Win Rate: ${e.prediction.winRate}% | Avg Cycle: ${e.prediction.cycle} days
- Recommended Entry Stage: ${e.prediction.entry}

## Engine 3: Event Context
- Deal Climate: ${e.event.modifier > 1.05 ? 'Favorable' : 'Headwind'} ${e.event.modifier.toFixed(2)}x
- ${e.event.context}

${e.outage.active ? `## Engine 4: Outage Detection
- Event: ${e.outage.event}
- Signal: ${e.outage.signal}
- Urgency Products: ${e.outage.products.join(', ')}
- Urgency Level: ${e.outage.urgency}

` : ''}## Overnight Intel
${c.intel || 'No new signals'}

## What to Sell
- Recommended Products: ${c.prod}
- Product Gaps: ${c.gaps.join(', ')}
- Addressable Spend: $${(c.v / 1000).toFixed(1)}K/mo

## Conversation Strategy
${c.tk}

---

Deliver:
1. Week 1-2 Execution Plan \u2014 outreach sequence with 3 email drafts (initial, follow-up, break-up). Include who to contact by title/role.
2. 8-10 Discovery Questions tailored to: ${c.tags.map(t => t.l).join(', ')}
3. Top 5 Objection Handlers based on their profile${c.stats.nib24 && c.stats.nib24 < 0 ? " (they're shrinking \u2014 budget is tight)" : ''}${c.stats.health && c.stats.health < 50 ? ' (service issues top of mind)' : ''}
4. Competitive Positioning with ROI for $${(c.v / 1000).toFixed(0)}K/mo opportunity
5. Close Plan \u2014 timeline from ${e.prediction.entry} to signed contract (${e.prediction.cycle}-day target)
6. Risk Mitigation

${!c.hasPipe ? `IMPORTANT: There is NO active pipeline on ${c.a}. Your plan should start from zero \u2014 cold outreach to ${c.a}, explain why we're reaching out now (reference the engine signals above), and build the case from scratch.\n\n` : ''}Be specific to ${c.a}. Reference their location footprint (${e.location.footprint} sites), NIB trend, engine predictions, and market conditions directly. No generic playbooks.`
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function IntelReadout({ onBack }) {
  const [phase, setPhase] = useState('upload')
  const [tabs, setTabs] = useState([])
  const [secs, setSecs] = useState(0)
  const [fname, setFname] = useState('')
  const [scope, setScope] = useState('all')
  const [sType, setSType] = useState('all')
  const [openAcc, setOpenAcc] = useState(null)
  const [expAct, setExpAct] = useState(0)
  const [promptOpen, setPromptOpen] = useState(null)
  const [copied, setCopied] = useState(false)
  const readoutRef = useRef(null)
  const timerRef = useRef(null)

  const D = DEMO

  const setS = useCallback((t, n) => { setSType(t); setScope(n) }, [])
  const sLabel = sType === 'all' ? 'All Teams' : scope

  const sortedActions = useMemo(() =>
    [...D.actions].sort((a, b) => b.sc - a.sc),
    [D.actions]
  )

  function copyPrompt(c) {
    navigator.clipboard.writeText(buildPrompt(c)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function startDemo() {
    setFname('RevOS-Data-Template.xlsx')
    setPhase('parsing')
    setTabs([])
    setSecs(0)
    let i = 0
    function nextTab() {
      if (i >= TABS.length) {
        setPhase('analyzing')
        let s = 0
        function nextSec() {
          s++
          setSecs(s)
          if (s >= 3) setPhase('complete')
          else timerRef.current = setTimeout(nextSec, 700)
        }
        timerRef.current = setTimeout(nextSec, 400)
        return
      }
      const t = TABS[i]
      i++
      setTabs(p => [...p, t])
      timerRef.current = setTimeout(nextTab, 180)
    }
    timerRef.current = setTimeout(nextTab, 300)
  }

  function handleFileDrop(e) {
    e.preventDefault()
    // For now, trigger demo mode on any drop
    startDemo()
  }

  function exportHTML() {
    const el = readoutRef.current
    if (!el) return
    const css = document.querySelector('style')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>RevOS Readout \u2014 ${sLabel}</title><style>${css ? css.textContent : ''}</style></head><body style="background:#06080F;color:#e6edf3;font-family:'IBM Plex Sans',sans-serif;padding:24px 28px;max-width:1120px;margin:0 auto">${el.innerHTML}</body></html>`
    const b = new Blob([html], { type: 'text/html' })
    const u = URL.createObjectURL(b)
    const a = document.createElement('a')
    a.href = u
    a.download = `RevOS-Readout-${sLabel.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.html`
    a.click()
    URL.revokeObjectURL(u)
  }

  const vis = (n) => secs >= n

  /* ── Tag component ── */
  const Tag = ({ cl, children }) => (
    <span style={{
      padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace",
      background: CLbg[cl] || CLbg.pu, color: CL[cl] || T.purple,
    }}>{children}</span>
  )

  /* ── Badge component ── */
  const Bdg = ({ cl, children }) => (
    <span style={{
      padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace",
      background: CLbg[cl] || 'transparent', color: CL[cl] || T.textDim,
    }}>{children}</span>
  )

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "'IBM Plex Sans', sans-serif", WebkitFontSmoothing: 'antialiased' }}>
      {/* HEADER */}
      <div style={{ padding: '18px 28px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textDim, marginBottom: 4 }}>
            {onBack && (
              <button onClick={onBack} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 14, marginRight: 6 }}>{'\u2190'}</button>
            )}
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.purple, boxShadow: '0 0 10px rgba(167,139,250,.4)' }} />
            RevOS \u00B7 Intelligence Readout
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>
            {phase === 'upload' ? 'Drop Your Data' : phase === 'complete' ? `${sLabel} \u2014 Battle Plan` : 'Processing...'}
          </h1>
        </div>
        {phase !== 'upload' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.textDim }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: phase === 'complete' ? T.green : T.yellow, animation: phase === 'complete' ? 'none' : 'ir-pulse 1.2s infinite' }} />
              <span>{phase === 'parsing' ? 'Parsing...' : phase === 'analyzing' ? `Analyzing ${secs}/3...` : 'Ready'}</span>
            </div>
            {phase === 'complete' && (
              <button onClick={exportHTML} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid rgba(167,139,250,.25)`, background: 'rgba(167,139,250,.08)', color: T.purple }}>
                {'\u2B07'} Export HTML
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '24px 28px', maxWidth: 1120, margin: '0 auto' }}>
        {/* UPLOAD DROP ZONE */}
        {phase === 'upload' && (
          <div
            onClick={startDemo}
            onDrop={handleFileDrop}
            onDragOver={e => e.preventDefault()}
            style={{ border: `2px dashed ${T.border}`, borderRadius: 16, padding: '80px 48px', textAlign: 'center', cursor: 'pointer', background: T.card, transition: 'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.background = T.cardHover }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.card }}
          >
            <div style={{ fontSize: 48, marginBottom: 20 }}>{'\uD83D\uDCC1'}</div>
            <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>Drop your Excel workbook here</p>
            <p style={{ fontSize: 13, color: T.textDim }}>Historical \u00B7 Bookings \u00B7 Engagement \u00B7 Churn \u00B7 Markets \u00B7 Locations \u00B7 Services</p>
            <p style={{ fontSize: 11, color: T.textDim, marginTop: 8 }}>.xlsx \u00B7 Auto-detects tabs and maps columns \u00B7 Click for demo</p>
          </div>
        )}

        {/* TAB PARSING STRIP */}
        {phase !== 'upload' && (
          <div style={{ background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, padding: '16px 18px', marginBottom: 18, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginBottom: 12 }}>
              {'\uD83D\uDCC4'} <b>{fname}</b> <span style={{ fontSize: 11, color: T.textDim }}>{tabs.length}/{TABS.length} tabs</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TABS.map((t, i) => {
                const ok = tabs.some(x => x.n === t.n)
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 12,
                    border: `1px solid ${ok ? 'rgba(52,211,153,.2)' : T.border}`,
                    background: ok ? 'rgba(52,211,153,.05)' : T.surface,
                    opacity: ok ? 1 : 0.3, transition: 'all .3s',
                  }}>
                    <span>{t.i}</span>
                    <b>{t.n}</b>
                    {ok
                      ? <span className="font-mono" style={{ fontSize: 11, color: T.green }}>{t.r.toLocaleString()}</span>
                      : <span style={{ fontSize: 11, color: T.textDim }}>{'\u00B7\u00B7\u00B7'}</span>
                    }
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div ref={readoutRef}>

          {/* ═══ LAYER 1: SUMMARY ═══ */}
          {vis(1) && (
            <div className="ir-fade-up" style={{ marginBottom: 20 }}>
              {/* 5-metric grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: T.border, borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                {[
                  ['Closed (12m)', `$${(D.summary.closed / 1000).toFixed(0)}K`, D.summary.closedSub, 'cy', 'gn'],
                  ['Active Pipeline', `$${(D.summary.pipeActive / 1000).toFixed(0)}K`, D.summary.pipeSub, 'cy', ''],
                  ['Location Addressable Spend', `$${(D.summary.locSpend / 1000).toFixed(0)}K/mo`, '28 accounts', 'pu', ''],
                  ['At-Risk MRR', `$${(D.summary.atRiskMRR / 1000).toFixed(1)}K`, 'probability-weighted \u00B7 7 signals', 'rd', ''],
                  ['Pipeline (Bayesian)', `$${(D.summary.pipeWtd / 1000).toFixed(0)}K`, `${D.pipe.deals} deals \u00B7 ${D.pipe.avg}% avg`, 'pu', ''],
                ].map((s, i) => (
                  <div key={i} style={{ background: T.card, padding: '22px 18px', textAlign: 'center' }}>
                    <span style={{ fontSize: 10, color: T.textDim, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{s[0]}</span>
                    <b style={{ fontSize: 28, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, display: 'block', lineHeight: 1.1, color: CL[s[3]] }}>{s[1]}</b>
                    <span style={{ fontSize: 11, color: s[4] ? CL[s[4]] : T.textDim, display: 'block', marginTop: 6 }}>{s[2]}</span>
                  </div>
                ))}
              </div>
              {/* Headline paragraph */}
              <p style={{ fontSize: 14, color: T.textDim, lineHeight: 1.8, padding: '18px 22px', background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.purple}` }}>
                {D.summary.headline}
              </p>
            </div>
          )}

          {/* SCOPE FILTER BAR */}
          {vis(1) && (
            <div className="ir-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 22, flexWrap: 'wrap', animationDelay: '.1s' }}>
              <button onClick={() => setS('all', 'all')} style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                border: sType === 'all' ? `1px solid rgba(167,139,250,.2)` : '1px solid transparent',
                background: sType === 'all' ? CLbg.pu : T.surface,
                color: sType === 'all' ? T.purple : T.textDim, transition: 'all .15s',
              }}>All Teams</button>
              <span style={{ width: 1, height: 18, background: T.border, margin: '0 4px' }} />
              {TEAM.map(m => (
                <button key={m.n} onClick={() => setS('mgr', m.n)} style={{
                  padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  border: sType === 'mgr' && scope === m.n ? `1px solid rgba(167,139,250,.2)` : '1px solid transparent',
                  background: sType === 'mgr' && scope === m.n ? CLbg.pu : T.surface,
                  color: sType === 'mgr' && scope === m.n ? T.purple : T.textDim, transition: 'all .15s',
                }}>{m.n}</button>
              ))}
              <span style={{ width: 1, height: 18, background: T.border, margin: '0 4px' }} />
              {ALL_REPS.filter(r => sType !== 'mgr' || r.mgr === scope).map(r => (
                <button key={r.name} onClick={() => setS('rep', r.name)} style={{
                  padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  border: sType === 'rep' && scope === r.name ? `1px solid rgba(167,139,250,.2)` : '1px solid transparent',
                  background: sType === 'rep' && scope === r.name ? CLbg.pu : T.surface,
                  color: sType === 'rep' && scope === r.name ? T.purple : T.textDim, transition: 'all .15s',
                }}>{r.name}</button>
              ))}
            </div>
          )}

          {/* ═══ LAYER 2: WHERE TO TARGET ═══ */}
          {vis(2) && (
            <div className="ir-fade-up" style={{ animationDelay: '.15s', marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Where to Target</h2>
                <span style={{ fontSize: 11, color: T.textDim }}>{D.actions.length} accounts \u00B7 ranked by Premier Score (urgency \u00D7 opportunity \u00D7 confidence)</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sortedActions.map((c, i) => {
                  const open = expAct === i
                  return (
                    <div key={i} style={{ background: T.card, borderRadius: 10, border: `1px solid ${open ? 'rgba(167,139,250,.25)' : T.border}`, overflow: 'hidden', transition: 'border-color .15s' }}>
                      {/* Collapsed row */}
                      <div
                        onClick={() => setExpAct(open ? -1 : i)}
                        style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', cursor: 'pointer', transition: 'background .1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = T.cardHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Rank */}
                        <div style={{
                          width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0,
                          background: i < 3 ? CLbg.pu : T.surface, color: i < 3 ? T.purple : T.textDim,
                        }}>{i + 1}</div>

                        {/* Account info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <b style={{ fontSize: 15 }}>{c.a}</b>
                            <span style={{ fontSize: 11, color: T.textDim }}>{c.m}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {c.tags.map((t, j) => <Tag key={j} cl={t.cl}>{t.l}</Tag>)}
                          </div>
                        </div>

                        {/* Product gaps */}
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap' }}>
                          {c.gaps.slice(0, 2).map((g, j) => <Tag key={j} cl="pu">+ {g}</Tag>)}
                          {c.gaps.length > 2 && <span style={{ fontSize: 11, color: T.textDim }}>+{c.gaps.length - 2}</span>}
                        </div>

                        {/* Pipeline badge */}
                        <div style={{ flexShrink: 0, width: 68, textAlign: 'center' }}>
                          {c.hasPipe
                            ? <span className="font-mono" style={{ fontSize: 11, color: T.cyan }}>{c.pipeDeals}d in pipe</span>
                            : <span className="font-mono" style={{ fontSize: 11, color: T.yellow }}>No pipeline</span>
                          }
                        </div>

                        {/* Addressable spend */}
                        <div style={{ textAlign: 'right', width: 72, flexShrink: 0 }}>
                          <b style={{ fontSize: 18, fontFamily: "'IBM Plex Mono', monospace", color: T.purple, display: 'block', lineHeight: 1 }}>${(c.v / 1000).toFixed(0)}K</b>
                          <span style={{ fontSize: 9, color: T.textDim }}>/mo</span>
                        </div>

                        {/* Score box */}
                        <div
                          title={`Premier Score: ${c.sc}/300\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nUrgency:      ${c.ps.u.toFixed(0)}  ${c.ps.u >= 40 ? '(outage)' : c.ps.u >= 20 ? '(churn risk)' : c.ps.u >= 5 ? '(mild)' : '(none)'}\nOpportunity:  ${c.ps.o.toFixed(0)}  ($${(c.v / 1000).toFixed(0)}K spend)\nConfidence:   ${c.ps.c.toFixed(0)}  (engines)`}
                          style={{
                            width: 40, height: 40, borderRadius: 9, background: T.surface,
                            border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, cursor: 'help',
                          }}
                        >
                          <b style={{ fontSize: 14, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: c.sc >= 200 ? T.red : c.sc >= 150 ? T.purple : c.sc >= 100 ? T.cyan : T.textDim }}>{c.sc}</b>
                        </div>

                        <span style={{ fontSize: 12, color: T.textDim, flexShrink: 0, width: 16, textAlign: 'center' }}>{open ? '\u25B2' : '\u25BC'}</span>
                      </div>

                      {/* Expanded detail */}
                      {open && (
                        <div style={{ borderTop: `1px solid ${T.border}`, padding: 20, background: T.cardHover }}>
                          {/* Talk track */}
                          <div style={{ fontSize: 14, color: T.text, lineHeight: 1.8, padding: '18px 22px', borderRadius: 10, borderLeft: `3px solid ${T.purple}`, background: 'rgba(167,139,250,.04)', marginBottom: 16 }}>
                            {c.tk}
                          </div>

                          {/* Stat chips + intel */}
                          <div style={{ display: 'flex', gap: 16, alignItems: 'start', flexWrap: 'wrap', marginBottom: 12 }}>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: T.textDim }}>
                              {[
                                ['TMR', c.stats.tmr > 0 ? `$${c.stats.tmr.toLocaleString()}` : '\u2014', 'cy'],
                                ['Deals', `${c.stats.deals}`, ''],
                                ['NIB (all)', `$${(c.stats.nibAll / 1000).toFixed(1)}K`, c.stats.nibAll >= 0 ? 'gn' : 'rd'],
                                ['NIB (24m)', `$${(c.stats.nib24 / 1000).toFixed(1)}K`, c.stats.nib24 >= 0 ? 'gn' : 'rd'],
                                ['Health', `${c.stats.health}`, c.stats.health >= 70 ? 'gn' : c.stats.health >= 40 ? 'am' : 'rd'],
                                ['Climate', c.stats.mod > 1.05 ? `Favorable ${c.stats.mod.toFixed(2)}\u00D7` : c.stats.mod < 0.98 ? `Headwind ${c.stats.mod.toFixed(2)}\u00D7` : 'Neutral', c.stats.mod > 1.05 ? 'gn' : c.stats.mod < 0.98 ? 'am' : ''],
                                ['Silent', `${c.stats.ds}d`, ''],
                              ].map((s, j) => (
                                <span key={j} style={{ fontSize: 12, color: T.textDim }}>
                                  {s[0]} <b style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, marginLeft: 3, color: s[2] ? CL[s[2]] : T.text }}>{s[1]}</b>
                                </span>
                              ))}
                            </div>
                            {c.intel && (
                              <div style={{ flex: 1, minWidth: 220, padding: '12px 16px', borderRadius: 10, borderLeft: `3px solid rgba(96,165,250,.5)`, background: 'rgba(96,165,250,.06)', fontSize: 13, color: T.textDim, lineHeight: 1.6 }}>
                                <span style={{ fontSize: 10, fontWeight: 600, color: T.blue, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Overnight Intel</span>
                                {c.intel}
                              </div>
                            )}
                          </div>

                          {/* Churn bar */}
                          {c.churn.prob > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,.04)', border: '1px solid rgba(248,113,113,.1)', marginBottom: 14, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: T.red, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Churn Risk</span>
                              <b style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 700, color: c.churn.prob >= 0.5 ? T.red : c.churn.prob >= 0.2 ? T.yellow : T.text }}>{Math.round(c.churn.prob * 100)}%</b>
                              <span style={{ fontSize: 11, color: T.textDim }}>{'\u00B7'}</span>
                              <span className="font-mono" style={{ fontSize: 11, color: T.red }}>${(c.churn.risk / 1000).toFixed(1)}K/mo</span>
                              <span style={{ fontSize: 11, color: T.textDim }}>{'\u00B7'}</span>
                              {c.churn.signals.map((s, j) => (
                                <span key={j} style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", padding: '3px 8px', borderRadius: 5, background: T.surface }}>
                                  {s.s} <b style={{ fontSize: 10, color: T.yellow }}>{Math.round(s.p * 100)}%</b>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Engine signals 2x2 grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                            {/* No pipeline alert */}
                            {!c.hasPipe && (
                              <div style={{ gridColumn: '1 / -1', padding: '12px 16px', borderRadius: 10, background: CLbg.am, border: '1px solid rgba(251,191,36,.15)' }}>
                                <b style={{ display: 'block', fontSize: 12, color: T.yellow, marginBottom: 4 }}>{'\u26A1'} No active pipeline \u2014 engine-driven recommendation</b>
                                <span style={{ fontSize: 11, color: T.textDim }}>These product recommendations come from cross-referencing 4 engines against this account's profile, footprint, and market conditions.</span>
                              </div>
                            )}

                            {/* Location Intelligence */}
                            <div style={{ padding: '14px 16px', borderRadius: 10, background: T.surface, border: `1px solid ${T.border}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                <span style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: CLbg.pu, color: T.purple }}>{'\uD83D\uDCCD'}</span>
                                <b style={{ fontSize: 12, flex: 1 }}>Location Intelligence</b>
                                <span className="font-mono" style={{ fontSize: 11, color: T.textDim }}>{c.engines.location.footprint} locations \u00B7 {c.engines.location.spread}</span>
                              </div>
                              <p style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6, marginBottom: 8 }}>{c.engines.location.reason}</p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {c.engines.location.affinity.map((a, j) => (
                                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Tag cl="pu">{a.p}</Tag>
                                    <Bar w={a.score} color={T.purple} />
                                    <span className="font-mono" style={{ fontSize: 11, color: T.purple }}>{a.score}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Prediction Engine */}
                            <div style={{ padding: '14px 16px', borderRadius: 10, background: T.surface, border: `1px solid ${T.border}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                <span style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: CLbg.cy, color: T.cyan }}>{'\uD83C\uDFAF'}</span>
                                <b style={{ fontSize: 12, flex: 1 }}>Prediction Engine</b>
                                <span className="font-mono" style={{ fontSize: 11, color: T.textDim }}>{c.engines.prediction.winRate}% win \u00B7 {c.engines.prediction.cycle}d cycle</span>
                              </div>
                              <p style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6, marginBottom: 8 }}>{c.engines.prediction.similar}</p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11, color: T.textDim }}>Recommended entry:</span>
                                <Tag cl="cy">{c.engines.prediction.entry}</Tag>
                              </div>
                            </div>

                            {/* Event Context */}
                            <div style={{ padding: '14px 16px', borderRadius: 10, background: T.surface, border: `1px solid ${T.border}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                <span style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: CLbg.gn, color: T.green }}>{'\uD83D\uDCE1'}</span>
                                <b style={{ fontSize: 12, flex: 1 }}>Event Context</b>
                                <span className="font-mono" style={{ fontSize: 11, color: c.engines.event.modifier > 1.05 ? T.green : c.engines.event.modifier < 0.98 ? T.yellow : T.textDim }}>
                                  {c.engines.event.modifier > 1.05 ? 'Favorable' : 'Headwind'} {c.engines.event.modifier.toFixed(2)}{'\u00D7'}
                                </span>
                              </div>
                              <p style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6 }}>{c.engines.event.context}</p>
                            </div>

                            {/* Outage Detection */}
                            {c.engines.outage.active && (
                              <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(248,113,113,.04)', border: '1px solid rgba(248,113,113,.2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                  <span style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: CLbg.rd, color: T.red }}>{'\u26A0'}</span>
                                  <b style={{ fontSize: 12, flex: 1 }}>Outage Detection</b>
                                  <Bdg cl="rd">{c.engines.outage.urgency}</Bdg>
                                </div>
                                <p style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6, marginBottom: 8 }}>{c.engines.outage.signal}</p>
                                <div style={{ display: 'flex', gap: 5 }}>
                                  {c.engines.outage.products.map((p, j) => <Tag key={j} cl="rd">{p}</Tag>)}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* AI Prompt Generator */}
                          <button
                            onClick={() => setPromptOpen(promptOpen === i ? null : i)}
                            style={{
                              width: '100%', padding: 12, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              border: '1px solid rgba(167,139,250,.2)', background: 'rgba(167,139,250,.06)', color: T.purple, textAlign: 'center', transition: 'all .15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,.12)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,.35)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167,139,250,.06)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,.2)' }}
                          >
                            {promptOpen === i ? '\u25B2 Hide Prompt' : '\uD83E\uDD16 Generate Execution Prompt'}
                          </button>
                          {promptOpen === i && (
                            <div style={{ marginTop: 12, borderRadius: 10, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: T.surface, fontSize: 11, color: T.textDim }}>
                                <span>Ready to paste into ChatGPT, Claude, or any AI</span>
                                <button
                                  onClick={() => copyPrompt(c)}
                                  style={{ padding: '6px 14px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: T.purple, color: T.bg }}
                                >{copied ? '\u2713 Copied' : '\uD83D\uDCCB Copy'}</button>
                              </div>
                              <pre style={{ padding: 18, background: T.bg, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.textDim, lineHeight: 1.75, whiteSpace: 'pre-wrap', wordWrap: 'break-word', maxHeight: 420, overflowY: 'auto', margin: 0 }}>
                                {buildPrompt(c)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ═══ LAYER 3: SUPPORTING EVIDENCE ═══ */}
          {vis(3) && (
            <div className="ir-fade-up" style={{ animationDelay: '.3s' }}>
              <p style={{ fontSize: 11, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, fontWeight: 600 }}>Supporting Detail</p>

              <Accordion title="Health & Churn Risk" sub={`${D.health.ok} healthy \u00B7 ${D.health.risk} at-risk \u00B7 $${(D.churn.mrr / 1000).toFixed(0)}K at-risk MRR`} id="hc" state={openAcc} set={setOpenAcc}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Health Distribution</p>
                    {[['Healthy (70+)', D.health.ok, 'gn'], ['Watch (50-69)', D.health.watch, 'am'], ['At Risk (<50)', D.health.risk, 'rd']].map((r, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0', fontSize: 12 }}>
                        <span style={{ width: 105, color: T.textDim, flexShrink: 0 }}>{r[0]}</span>
                        <Bar w={r[1] / D.health.accts * 100} color={CL[r[2]]} />
                        <b style={{ color: CL[r[2]] }}>{r[1]}</b>
                      </div>
                    ))}
                    <div style={{ marginTop: 16 }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Improving</p>
                      {D.health.up.map((a, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: T.surface, borderRadius: 8, marginBottom: 5, fontSize: 12 }}>
                          <b style={{ flex: 1 }}>{a.n}</b>
                          <span className="font-mono" style={{ color: T.green }}>{a.s}</span>
                          <Bdg cl="gn">{a.d}</Bdg>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Churn by Reason</p>
                    {D.churn.reasons.map((r, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0', fontSize: 12 }}>
                        <span style={{ width: 105, color: T.textDim, flexShrink: 0 }}>{r.r}</span>
                        <Bar w={r.w} color={T.red} />
                        <span className="font-mono" style={{ fontSize: 11, color: T.textDim }}>{r.w}%</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 16 }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Expiring Soon</p>
                      {D.churn.expiring.map((e, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: T.surface, borderRadius: 8, marginBottom: 5, fontSize: 12 }}>
                          <b style={{ flex: 1 }}>{e.n}</b>
                          <span style={{ fontSize: 11, color: T.textDim }}>exp {e.ex}</span>
                          <Bdg cl="rd">${(e.mrr / 1000).toFixed(1)}K</Bdg>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Accordion>

              <Accordion title="Bayesian Pipeline" sub={`${D.pipe.deals} deals \u00B7 $${(D.pipe.raw / 1000).toFixed(0)}K \u2192 $${(D.pipe.wtd / 1000).toFixed(0)}K weighted`} id="pipe" state={openAcc} set={setOpenAcc}>
                <p style={{ fontSize: 10, fontWeight: 600, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Win Probability by Stage</p>
                {D.pipe.stages.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0', fontSize: 12 }}>
                    <span style={{ width: 105, color: T.textDim, flexShrink: 0 }}>{s.s}</span>
                    <Bar w={s.p} color={T.purple} />
                    <span className="font-mono" style={{ fontSize: 11, color: T.purple }}>{s.p}%</span>
                    <span className="font-mono" style={{ fontSize: 11, color: T.textDim }}>{s.d}d</span>
                  </div>
                ))}
              </Accordion>

              <Accordion title="Markets & Events" sub={`${D.mkts.grow.length} growing \u00B7 ${D.mkts.down.length} declining \u00B7 ${D.mkts.events.length} events`} id="mkt" state={openAcc} set={setOpenAcc}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Momentum</p>
                    {D.mkts.grow.map((m, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: T.surface, borderRadius: 8, marginBottom: 5, fontSize: 12 }}>
                        <b style={{ flex: 1 }}>{m.c}</b>
                        <Bdg cl="gn">{m.d}</Bdg>
                        <span className="font-mono" style={{ fontSize: 11, color: T.textDim }}>{m.md.toFixed(2)}{'\u00D7'}</span>
                      </div>
                    ))}
                    {D.mkts.down.map((m, i) => (
                      <div key={`d${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: T.surface, borderRadius: 8, marginBottom: 5, fontSize: 12 }}>
                        <b style={{ flex: 1 }}>{m.c}</b>
                        <Bdg cl="rd">{m.d}</Bdg>
                        <span className="font-mono" style={{ fontSize: 11, color: T.textDim }}>{m.md.toFixed(2)}{'\u00D7'}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Active Events</p>
                    {D.mkts.events.map((ev, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: T.surface, borderRadius: 8, marginBottom: 5, fontSize: 12 }}>
                        <span style={{ padding: '3px 9px', borderRadius: 5, fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, flexShrink: 0, textTransform: 'uppercase', background: ecBg[ev.t], color: ecFg[ev.t] }}>{ev.t}</span>
                        <span style={{ flex: 1 }}>{ev.h}</span>
                        <span className="font-mono" style={{ fontSize: 11, color: T.textDim }}>{ev.dl}d</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Accordion>
            </div>
          )}

        </div>

        {/* CTA BAR */}
        {phase === 'complete' && (
          <div className="ir-fade-up" style={{
            background: T.card, borderRadius: 10, border: '1px solid rgba(167,139,250,.15)',
            padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24,
          }}>
            <span style={{ fontSize: 13, color: T.textDim }}>{sLabel} \u00B7 {D.health.accts} accounts \u00B7 ${(D.summary.locSpend / 1000).toFixed(0)}K/mo addressable spend</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {onBack && (
                <button onClick={onBack} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: T.purple, color: T.bg }}>
                  Open in GTM Premier {'\u2192'}
                </button>
              )}
              <button onClick={exportHTML} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: T.blue, color: T.bg }}>
                {'\u2B07'} Export
              </button>
              <button onClick={() => { setPhase('upload'); setSecs(0); setTabs([]); setSType('all'); setScope('all') }} style={{
                padding: '9px 20px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                border: `1px solid ${T.border}`, background: 'transparent', color: T.textDim,
              }}>Upload New</button>
            </div>
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        .ir-fade-up { animation: irFadeUp .45s ease-out both }
        @keyframes irFadeUp { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes ir-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .3 } }
      `}</style>
    </div>
  )
}
