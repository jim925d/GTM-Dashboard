import { useState, useMemo } from 'react'
import { V2, V2_FONTS, STAGES, STAGE_WEIGHTS, pc, fmt } from '../tokens'
import ProbTooltip from '../components/ProbTooltip'
import SitePill from '../components/SitePill'
import ExitCriteria from '../components/ExitCriteria'
import StageProgress from '../components/StageProgress'
import useDeals from '../hooks/useDeals'

// ═══ Helpers ═══════════════════════════════════════════════════════════════════

function dealProb(d) {
  const p = d.prob || d.winProb || 0.5
  return Math.round(p <= 1 ? p * 100 : p)
}

function getDealFactors(deal) {
  if (deal.factors?.length) return deal.factors
  const base = { 'Discover': 31, 'Design': 42, 'Design Solution': 53, 'Propose': 66, 'Negotiate': 75, 'Verbal Agreement': 92 }[deal.stage] || 50
  const result = [['Stage base', `${base}%`, V2.textMid, `${deal.stage} closes at ${base}%`]]
  const gap = deal.gap || 0
  if (gap > 7) result.push(['Gap', `\u2212${Math.round(gap * 0.5)}%`, V2.red, `${gap} days since last touch`])
  else result.push(['Gap', '0%', V2.textMuted, `Last touch ${gap}d ago`])
  const prod = deal.product_group || deal.product || ''
  if (['Dark Fiber', 'Wavelengths'].includes(prod)) result.push(['Product', '+3%', V2.sage, `${prod} above avg`])
  else result.push(['Product', '+2%', V2.sage, `${prod} slight boost`])
  if ((deal.mrr || 0) > 25000) result.push(['Size', '\u22122%', V2.amber, 'Above median'])
  return result
}

const tColor = t => ({ call: V2.sage, email: V2.blue, meeting: V2.accent, engine: V2.purple, location: V2.amber, prediction: V2.purple, outage: V2.red, event: V2.blue }[t] || V2.textDim)

// ═══ Actions builder ═════════════════════════════════════════════════════════

function buildActions(deal, acct) {
  const actions = []
  const gap = deal.gap || 0
  const stage = deal.stage || ''
  const daysInStage = deal.daysInStage || 0
  const avgDays = { 'Discover': 14, 'Design Solution': 16, 'Propose': 12, 'Negotiate': 10, 'Verbal Agreement': 5 }[stage] || 14

  if (gap > 7) {
    actions.push({
      title: `Re-engage \u2014 ${gap} day gap`,
      desc: `${gap}-day gap at ${stage}. Deals with gaps >7d close at 31%. Schedule a call or send value-add intel within 48h.`,
      impact: `+${Math.min(19, Math.round(gap * 0.6))}%`,
      basis: 'Re-engaging within 48h recovers from 31% \u2192 53% close rate.',
    })
  }

  if (daysInStage > avgDays * 1.5) {
    actions.push({
      title: `${daysInStage}d in ${stage} (avg ${avgDays})`,
      desc: `Above average. Propose a concrete next step with a specific date \u2014 design review or technical workshop.`,
      impact: '+4%',
      basis: `Setting a firm next-step meeting within 1 week halves the stall risk.`,
    })
  }

  const events = acct?.engagement?.events || []
  const contacts = new Set(events.map(e => e.c).filter(Boolean))
  if (contacts.size <= 1 && events.length >= 2) {
    actions.push({
      title: 'Multi-thread \u2014 single contact risk',
      desc: 'Only one contact engaged. Ask them to include their manager or a colleague in the next meeting.',
      impact: '+8%',
      basis: 'Multi-threaded deals (3+ contacts) close at 78% vs 54% for single-threaded.',
    })
  }

  if (['Propose', 'Negotiate', 'Verbal Agreement'].includes(stage)) {
    actions.push({
      title: 'Get executive sponsor',
      desc: `No VP+ contact at ${stage}. Request an alignment call \u2014 frame as aligning on business outcomes before finalizing.`,
      impact: '+12%',
      basis: 'Deals with economic buyer before Propose close at 87% vs 64% without.',
    })
  }

  if (['Negotiate', 'Verbal Agreement'].includes(stage) && gap <= 3) {
    actions.push({
      title: stage === 'Verbal Agreement' ? 'Send contract' : 'Advance to Verbal Agreement',
      desc: stage === 'Verbal Agreement'
        ? 'Verbal committed. Get paperwork moving \u2014 every day of delay adds risk.'
        : 'Strong momentum. All exit criteria should be met \u2014 push for verbal commitment.',
      impact: '+4%',
    })
  }

  return actions.sort((a, b) => {
    const numA = parseInt(a.impact?.replace(/[^0-9]/g, '')) || 0
    const numB = parseInt(b.impact?.replace(/[^0-9]/g, '')) || 0
    return numB - numA
  })
}

// ═══ Build timeline ══════════════════════════════════════════════════════════

function buildTimeline(acct) {
  const items = []
  for (const s of (acct?.signals || [])) {
    items.push({ date: s.ts || '', text: s.text || '', type: s.engine || s.type || 'engine', who: null })
  }
  for (const ev of (acct?.engagement?.events || [])) {
    items.push({ date: ev.d || '', text: ev.s || '', type: ev.t || 'email', who: ev.c || null })
  }
  items.sort((a, b) => {
    const da = new Date(a.date), db = new Date(b.date)
    return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da)
  })
  return items.slice(0, 8)
}

// ═══ Build sites ═════════════════════════════════════════════════════════════

function buildSites(acct) {
  return (acct?.locations || []).map(loc => ({
    name: `${loc.city || ''}${loc.state ? ', ' + loc.state : ''}`.trim() || 'Unknown',
    status: loc.onNet ? 'on-net' : loc.isNew ? 'new' : 'off-net',
  }))
}

// ═══ Build exit criteria ═════════════════════════════════════════════════════

function buildExitCriteria(deal) {
  const defs = {
    'Discover': [{ name: 'Pain identified', met: false }, { name: 'Budget confirmed', met: false }, { name: 'Decision maker ID\'d', met: false }, { name: 'Timeline set', met: false }],
    'Design Solution': [{ name: 'Technical requirements', met: false }, { name: 'Solution mapped to pain', met: false }, { name: 'Champion engaged', met: false }, { name: 'Competition known', met: false }],
    'Propose': [{ name: 'Proposal delivered', met: false }, { name: 'Pricing reviewed', met: false }, { name: 'Decision criteria', met: false }, { name: 'Exec sponsor', met: false }],
    'Negotiate': [{ name: 'Terms agreed', met: false }, { name: 'Legal engaged', met: false }, { name: 'Paper process known', met: false }, { name: 'Objections resolved', met: false }],
    'Verbal Agreement': [{ name: 'Verbal confirmed', met: false }, { name: 'Contract sent', met: false }],
  }
  return defs[deal.stage] || deal.exitCriteria || null
}

// ═══ Main ═════════════════════════════════════════════════════════════════════

export default function V2DealDetail({ deal, accounts = [], onBack, backLabel = 'Pipeline' }) {
  const [showEC, setShowEC] = useState(false)
  if (!deal) return null

  const { deals: realDeals } = useDeals(accounts)
  const accts = accounts

  const account = useMemo(() => accts.find(a => a.name === deal.accountName) || {}, [accts, deal.accountName])

  const prob = dealProb(deal)
  const prevProb = deal.prevProb || Math.max(0, prob - Math.round(Math.random() * 12 - 3))
  const probDelta = prob - prevProb
  const factors = getDealFactors(deal)
  const sites = buildSites(account)
  const onNet = sites.filter(s => s.status === 'on-net').length
  const actions = useMemo(() => buildActions(deal, account), [deal, account])
  const timeline = useMemo(() => buildTimeline(account), [account])
  const exitCriteria = buildExitCriteria(deal)
  const met = exitCriteria ? exitCriteria.filter(c => c.met).length : 0

  const daysOpen = deal.daysOpen || (deal.created_date ? Math.max(0, Math.round((Date.now() - new Date(deal.created_date)) / 86400000)) : null)

  return (
    <div>
      {/* Back nav */}
      <div onClick={onBack} style={{ fontSize: 12, color: V2.textDim, marginBottom: 20, cursor: 'pointer', fontFamily: V2_FONTS.sans }}>
        &larr; {backLabel}
      </div>

      {/* ── Hero Strip ── */}
      <div style={{ display: 'flex', padding: '24px 28px', background: V2.card, borderRadius: 12, border: `1px solid ${V2.border}`, marginBottom: 24 }}>
        {/* Left: account info + sites */}
        <div style={{ flex: 1, paddingRight: 36 }}>
          <div style={{ fontFamily: V2_FONTS.serif, fontSize: 26, color: V2.text, marginBottom: 4 }}>{deal.accountName}</div>
          <div style={{ fontSize: 13, color: V2.textDim, fontFamily: V2_FONTS.sans }}>
            {deal.product_group || deal.product} · {fmt(deal.mrr)}/mo · {deal.term || ''}
          </div>

          {sites.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, fontFamily: V2_FONTS.sans }}>Locations</span>
                <span style={{ fontSize: 10, color: V2.textMid, fontFamily: V2_FONTS.mono }}>{onNet}/{sites.length} on-net</span>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {sites.map(s => <SitePill key={s.name} site={s} />)}
              </div>
            </div>
          )}
        </div>

        {/* Right: probability + stage */}
        <div style={{ width: 170, textAlign: 'center', paddingLeft: 36, borderLeft: `1px solid ${V2.borderLight}` }}>
          <ProbTooltip prob={prob} factors={factors} size="lg">
            {prob}<span style={{ fontSize: 22, color: V2.textDim }}>%</span>
          </ProbTooltip>

          <div style={{ fontSize: 11, color: V2.textDim, marginTop: 6, fontFamily: V2_FONTS.sans }}>
            <span style={{ color: probDelta >= 0 ? V2.sage : V2.red, fontWeight: 500 }}>
              {probDelta >= 0 ? '\u2191' : '\u2193'}{Math.abs(probDelta)}
            </span>{' '}
            from last month
          </div>

          <div style={{ marginTop: 12 }}>
            <StageProgress stage={deal.stage} daysInStage={deal.daysInStage} />
          </div>
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>

        {/* Left: Actions + Exit criteria */}
        <div>
          <div style={{ fontSize: 11, color: V2.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, fontWeight: 500, fontFamily: V2_FONTS.sans }}>What to do next</div>

          {actions.map((a, i) => (
            <div
              key={i}
              style={{
                padding: i === 0 ? '20px 24px' : '16px 20px',
                borderRadius: 10, marginBottom: 8,
                background: i === 0 ? V2.sageBg : V2.card,
                border: `1px solid ${i === 0 ? V2.sageBd : V2.border}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ fontSize: i === 0 ? 15 : 13, color: V2.text, fontWeight: 500, flex: 1, paddingRight: 14, fontFamily: V2_FONTS.sans }}>
                  {a.title}
                </div>
                <span style={{
                  fontFamily: V2_FONTS.mono, fontSize: i === 0 ? 12 : 11, color: V2.sage, fontWeight: 500,
                  ...(i === 0 ? { padding: '3px 10px', background: `${V2.sage}15`, borderRadius: 5 } : {}),
                }}>
                  {a.impact}
                </span>
              </div>
              <div style={{ fontSize: i === 0 ? 13 : 12, color: V2.textMid, lineHeight: 1.7, fontFamily: V2_FONTS.sans }}>
                {a.desc}
              </div>
              {i === 0 && a.basis && (
                <div style={{ fontSize: 11, color: V2.textDim, marginTop: 12, fontStyle: 'italic', paddingTop: 12, borderTop: `1px solid ${V2.sageBd}`, fontFamily: V2_FONTS.sans }}>
                  {a.basis}
                </div>
              )}
            </div>
          ))}

          {actions.length === 0 && (
            <div style={{ padding: '16px 20px', borderRadius: 10, background: V2.card, border: `1px solid ${V2.border}`, color: V2.textDim, fontSize: 12, fontFamily: V2_FONTS.sans }}>
              No prescriptive actions. Deal is progressing normally.
            </div>
          )}

          {/* Exit criteria */}
          {exitCriteria && (
            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => setShowEC(!showEC)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: V2.card, border: `1px solid ${V2.border}`,
                  borderRadius: showEC ? '8px 8px 0 0' : 8,
                  color: V2.textMid, fontSize: 12, cursor: 'pointer',
                  fontFamily: V2_FONTS.sans, padding: '10px 16px',
                  width: '100%', textAlign: 'left',
                }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" style={{ transform: showEC ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <path d="M2 0.5L5.5 4L2 7.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
                <span style={{ fontWeight: 500, flex: 1 }}>Exit criteria · {deal.stage}</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {exitCriteria.map((c, i) => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: c.met ? V2.sage : V2.accent, opacity: c.met ? 0.5 : 0.9 }} />
                  ))}
                </div>
                <span style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, marginLeft: 4 }}>{met}/{exitCriteria.length}</span>
              </button>
              {showEC && (
                <div style={{ background: V2.card, border: `1px solid ${V2.border}`, borderTop: `1px solid ${V2.ghost}`, borderRadius: '0 0 8px 8px', padding: '4px 16px 12px' }}>
                  {exitCriteria.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < exitCriteria.length - 1 ? `1px solid ${V2.ghost}22` : 'none' }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 5,
                        border: `2px solid ${c.met ? V2.sage : V2.accent}`,
                        background: c.met ? `${V2.sage}18` : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: c.met ? V2.sage : V2.accent, fontWeight: 600, flexShrink: 0,
                      }}>
                        {c.met ? '\u2713' : ''}
                      </div>
                      <span style={{ fontSize: 13, color: c.met ? V2.textDim : V2.text, fontWeight: c.met ? 300 : 500, fontFamily: V2_FONTS.sans }}>{c.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Deal details + Activity */}
        <div>
          {/* Deal details */}
          <div style={{ background: V2.card, border: `1px solid ${V2.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, fontWeight: 500, fontFamily: V2_FONTS.sans }}>Deal details</div>
            {[
              ['MRR', fmt(deal.mrr), V2_FONTS.mono],
              ['Term', deal.term || '\u2014'],
              ['Product', deal.product_group || deal.product || '\u2014'],
              ['Close', deal.close_date || deal.closeDate || '\u2014'],
              ['In stage', deal.daysInStage != null ? `${deal.daysInStage}d` : '\u2014'],
              ['Open', daysOpen != null ? `${daysOpen}d` : '\u2014'],
              ['Rep', deal.rep || '\u2014'],
            ].map(([l, v, font], i, a) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < a.length - 1 ? `1px solid ${V2.ghost}22` : 'none' }}>
                <span style={{ fontSize: 12, color: V2.textDim, fontFamily: V2_FONTS.sans }}>{l}</span>
                <span style={{ fontSize: 12, color: V2.text, fontWeight: 500, fontFamily: font || V2_FONTS.sans }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Activity */}
          <div style={{ background: V2.card, border: `1px solid ${V2.border}`, borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 10, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, fontWeight: 500, fontFamily: V2_FONTS.sans }}>Activity</div>
            {timeline.map((t, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: i < timeline.length - 1 ? `1px solid ${V2.ghost}22` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: tColor(t.type), boxShadow: `0 0 5px ${tColor(t.type)}35`, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: V2.textMid, fontFamily: V2_FONTS.sans }}>{t.text}</span>
                </div>
                <div style={{ fontSize: 10, color: V2.dim, paddingLeft: 14, fontFamily: V2_FONTS.sans }}>
                  {t.date}{t.who ? ` \u00b7 ${t.who}` : ''}
                </div>
              </div>
            ))}
            {timeline.length === 0 && (
              <div style={{ fontSize: 12, color: V2.textDim, fontFamily: V2_FONTS.sans }}>No activity recorded.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
