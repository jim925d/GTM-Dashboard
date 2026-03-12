import { useState, useMemo } from 'react'
import { T, FONT_MONO, FONT_SANS, RADIUS, CARD_SHADOW } from '../lib/constants'
import Badge from '../components/shared/Badge'
import { $, $k } from '../components/shared/ChartTheme'

const now = new Date()
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

function daysSince(dateStr) {
  if (!dateStr) return 999
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) {
    // Try MM/DD/YYYY
    const p = dateStr.split('/')
    if (p.length >= 3) {
      const parsed = new Date(p[2], p[0] - 1, p[1])
      if (!isNaN(parsed.getTime())) return Math.floor((now - parsed) / 86400000)
    }
    return 999
  }
  return Math.floor((now - d) / 86400000)
}

function engagedThisMonth(acc) {
  if (!acc.engagement?.timeline) return false
  return acc.engagement.timeline.some(t => t.month === thisMonth && t.count > 0)
}

function ytdEngagementCount(acc) {
  if (!acc.engagement?.timeline) return 0
  const yearPrefix = String(now.getFullYear())
  return acc.engagement.timeline
    .filter(t => t.month.startsWith(yearPrefix))
    .reduce((s, t) => s + t.count, 0)
}

function lastEngDate(acc) {
  return acc.engagement?.lastDate || ''
}

function hasActiveDeal(acc) {
  return (acc.active_deals || []).length > 0
}

function buildOutreachContext(acc) {
  const parts = []

  // Services
  const prods = acc.products || []
  if (prods.length > 0) parts.push(`Current services: ${prods.slice(0, 5).join(', ')}`)

  // Last engagement
  const lastEv = acc.engagement?.events?.[0]
  if (lastEv) {
    parts.push(`Last engagement: ${lastEv.d} — ${lastEv.t}${lastEv.s ? ': ' + lastEv.s : ''}`)
  }

  // Active deals
  const deals = acc.active_deals || []
  if (deals.length > 0) {
    const dealSummary = deals.map(d => `${d.product} (${d.stage}, ${$k(d.mrr)}/mo)`).join('; ')
    parts.push(`Active pipeline: ${dealSummary}`)
  }

  // Predictions context
  if (acc.pipeline_mrr > 0) parts.push(`Pipeline MRR: ${$k(acc.pipeline_mrr)}/mo`)

  // Risk
  if (acc.risk_score >= 30) parts.push(`Risk: ${acc.risk_level} (${acc.risk_score}/100)`)

  // Churn signals
  if (acc.disconnects > 0) parts.push(`Recent disconnects: ${acc.disconnects}`)
  if (acc.lost > 0) parts.push(`Deals lost: ${acc.lost}`)

  return parts.join('\n')
}

function draftEmail(acc) {
  const days = daysSince(lastEngDate(acc))
  const lastEv = acc.engagement?.events?.[0]
  const deals = acc.active_deals || []
  const prods = acc.products || []

  let subject = ''
  let body = ''

  if (deals.length > 0) {
    // Active deal follow-up
    const d = deals[0]
    subject = `Following up — ${d.product}`
    body = `Hi,\n\nI wanted to check in on the ${d.product} opportunity we've been discussing. `
    if (d.stage?.toLowerCase().includes('propose') || d.stage?.toLowerCase().includes('negotiate')) {
      body += `I know we're in the ${d.stage.toLowerCase()} phase and wanted to see if there are any questions or if you need anything from our side to move forward.`
    } else {
      body += `I'd love to find a time to discuss next steps and make sure we're aligned on the path forward.`
    }
  } else if (days > 60 && prods.length > 0) {
    // Re-engagement
    subject = `Checking in — ${acc.name}`
    body = `Hi,\n\nIt's been a while since we last connected and I wanted to check in. `
    if (acc.disconnects > 0) {
      body += `I noticed some changes to your services and would love to discuss how we can better support your needs going forward.`
    } else {
      body += `I'd like to make sure everything is running smoothly with your current ${prods[0]} service and discuss any upcoming needs.`
    }
  } else if (lastEv?.s) {
    // Follow up on last topic
    subject = `Re: ${lastEv.s.substring(0, 60)}`
    body = `Hi,\n\nFollowing up on our last conversation${lastEv.s ? ' regarding ' + lastEv.s.substring(0, 80) : ''}. `
    body += `I wanted to see if there's anything else you need or if we should schedule time to continue the discussion.`
  } else {
    subject = `Touching base — ${acc.name}`
    body = `Hi,\n\nI wanted to reach out and see how things are going. `
    body += `I'd love to schedule a quick call to discuss your current needs and how we can help.`
  }

  body += `\n\nLet me know what works best for your schedule.\n\nBest regards`

  return { subject, body }
}

const TAB_STYLE = (active, color) => ({
  padding: '5px 12px',
  fontFamily: FONT_SANS,
  fontSize: '10px',
  letterSpacing: '0.04em',
  cursor: 'pointer',
  border: 'none',
  borderRadius: '4px',
  background: active ? `${color}15` : T.surface,
  boxShadow: active ? `0 0 0 1px ${color}30` : 'none',
  color: active ? color : T.textDim,
  fontWeight: active ? 700 : 400,
})

export default function Engagement({ accounts, onSelect }) {
  const [tab, setTab] = useState('engaged')
  const [draftAcc, setDraftAcc] = useState(null)

  const { engaged, notEngaged, priority } = useMemo(() => {
    const eng = []
    const notEng = []
    const pri = []

    for (const acc of accounts) {
      const isEngaged = engagedThisMonth(acc)
      if (isEngaged) eng.push(acc)
      else notEng.push(acc)
      if (hasActiveDeal(acc)) pri.push(acc)
    }

    // Sort not-engaged by days since last engagement (most stale first)
    notEng.sort((a, b) => daysSince(lastEngDate(b)) - daysSince(lastEngDate(a)))
    // Sort priority by pipeline MRR descending
    pri.sort((a, b) => (b.pipeline_mrr || 0) - (a.pipeline_mrr || 0))
    // Sort engaged by recency
    eng.sort((a, b) => daysSince(lastEngDate(a)) - daysSince(lastEngDate(b)))

    return { engaged: eng, notEngaged: notEng, priority: pri }
  }, [accounts])

  const currentList = tab === 'engaged' ? engaged : tab === 'not_engaged' ? notEngaged : priority

  const draft = draftAcc ? draftEmail(draftAcc) : null

  return (
    <div>
      {/* Header stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatBox label="TOTAL ACCOUNTS" value={accounts.length} color={T.purple} />
        <StatBox label="ENGAGED THIS MONTH" value={engaged.length} color={T.green} />
        <StatBox label="NOT ENGAGED" value={notEngaged.length} color={T.red} />
        <StatBox label="PRIORITY (ACTIVE DEALS)" value={priority.length} color={T.cyan} />
      </div>

      {/* Tab filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        <button style={TAB_STYLE(tab === 'engaged', T.green)} onClick={() => setTab('engaged')}>
          ENGAGED ({engaged.length})
        </button>
        <button style={TAB_STYLE(tab === 'not_engaged', T.red)} onClick={() => setTab('not_engaged')}>
          NOT ENGAGED ({notEngaged.length})
        </button>
        <button style={TAB_STYLE(tab === 'priority', T.cyan)} onClick={() => setTab('priority')}>
          PRIORITY ({priority.length})
        </button>
      </div>

      {/* Draft modal */}
      {draftAcc && draft && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setDraftAcc(null)}>
          <div
            style={{
              background: T.card, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', borderRadius: '10px',
              padding: '20px', width: '560px', maxHeight: '80vh', overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Draft Outreach — {draftAcc.name}</div>
              <button
                onClick={() => setDraftAcc(null)}
                style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            {/* Context */}
            <div style={{
              fontFamily: FONT_MONO, fontSize: '9px', color: T.textMid,
              background: T.surface, borderRadius: '6px', padding: '10px', marginBottom: '12px',
              whiteSpace: 'pre-line', lineHeight: 1.6,
            }}>
              <div style={{ color: T.textMid, fontWeight: 600, marginBottom: '4px' }}>CONTEXT</div>
              {buildOutreachContext(draftAcc)}
            </div>

            {/* Subject */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, marginBottom: '3px' }}>SUBJECT</div>
              <input
                type="text"
                defaultValue={draft.subject}
                style={{
                  width: '100%', padding: '8px', fontFamily: FONT_MONO, fontSize: '11px',
                  background: T.surface, border: `1px solid ${T.border}`, borderRadius: '5px',
                  color: T.text, outline: 'none',
                }}
              />
            </div>

            {/* Body */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, marginBottom: '3px' }}>BODY</div>
              <textarea
                defaultValue={draft.body}
                rows={10}
                style={{
                  width: '100%', padding: '8px', fontFamily: FONT_MONO, fontSize: '11px',
                  background: T.surface, border: `1px solid ${T.border}`, borderRadius: '5px',
                  color: T.text, outline: 'none', resize: 'vertical', lineHeight: 1.6,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  // Copy to clipboard
                  const subject = document.querySelector('input[type="text"]')?.value || draft.subject
                  const body = document.querySelector('textarea')?.value || draft.body
                  navigator.clipboard?.writeText(`Subject: ${subject}\n\n${body}`)
                }}
                style={{
                  padding: '6px 16px', borderRadius: '5px', cursor: 'pointer',
                  fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600,
                  background: `${T.cyan}18`, border: `1px solid ${T.cyan}`, color: T.cyan,
                }}
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setDraftAcc(null)}
                style={{
                  padding: '6px 16px', borderRadius: '5px', cursor: 'pointer',
                  fontFamily: FONT_MONO, fontSize: '10px',
                  background: 'transparent', border: `1px solid ${T.border}`, color: T.textDim,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account list table */}
      <div style={{ background: T.card, boxShadow: CARD_SHADOW, borderRadius: RADIUS, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 1fr 0.6fr 100px',
          gap: '4px', padding: '8px 12px',
          background: T.surface, borderBottom: `1px solid ${T.border}`,
          fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim, letterSpacing: '0.06em',
        }}>
          <div>ACCOUNT</div>
          <div style={{ textAlign: 'right' }}>ARR</div>
          <div style={{ textAlign: 'right' }}>PIPELINE</div>
          <div style={{ textAlign: 'right' }}>YTD ACTIVITY</div>
          <div>LAST ENGAGEMENT</div>
          <div>STATUS</div>
          <div></div>
        </div>

        {/* Rows */}
        <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          {currentList.length === 0 && (
            <div style={{ padding: '30px', textAlign: 'center', fontFamily: FONT_MONO, fontSize: '11px', color: T.textDim }}>
              No accounts in this category
            </div>
          )}
          {currentList.map((acc, i) => {
            const days = daysSince(lastEngDate(acc))
            const dayColor = days <= 7 ? T.green : days <= 25 ? T.yellow : T.red
            const ytd = ytdEngagementCount(acc)
            const accIdx = accounts.findIndex(a => a.name === acc.name)
            const lastEv = acc.engagement?.events?.[0]

            return (
              <div
                key={acc.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 1fr 0.6fr 100px',
                  gap: '4px', padding: '8px 12px',
                  borderBottom: `1px solid ${T.border}`,
                  fontSize: '11px',
                  background: i % 2 === 0 ? 'transparent' : T.surface + '40',
                  alignItems: 'center',
                }}
              >
                {/* Account name */}
                <div>
                  <span
                    style={{ fontWeight: 600, cursor: 'pointer', borderBottom: `1px solid transparent` }}
                    onClick={() => onSelect(accIdx >= 0 ? accIdx : 0)}
                    onMouseEnter={e => e.currentTarget.style.color = T.cyan}
                    onMouseLeave={e => e.currentTarget.style.color = T.text}
                  >
                    {acc.name}
                  </span>
                  {hasActiveDeal(acc) && (
                    <Badge color={T.cyan} size="sm" style={{ marginLeft: '6px' }}>
                      {acc.active_deals.length} DEAL{acc.active_deals.length > 1 ? 'S' : ''}
                    </Badge>
                  )}
                </div>

                {/* ARR */}
                <div style={{ textAlign: 'right', fontFamily: FONT_MONO, fontSize: '10px', color: T.cyan }}>
                  {$(acc.arr)}
                </div>

                {/* Pipeline */}
                <div style={{ textAlign: 'right', fontFamily: FONT_MONO, fontSize: '10px', color: acc.pipeline_mrr > 0 ? T.purple : T.textDim }}>
                  {acc.pipeline_mrr > 0 ? `${$k(acc.pipeline_mrr)}/mo` : '---'}
                </div>

                {/* YTD activity count */}
                <div style={{ textAlign: 'right', fontFamily: FONT_MONO, fontSize: '10px', color: ytd > 10 ? T.green : ytd > 3 ? T.yellow : T.red }}>
                  {ytd > 0 ? ytd : '0'}
                </div>

                {/* Last engagement */}
                <div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: dayColor }}>
                    {lastEngDate(acc) || 'Never'}
                    {days < 999 && <span style={{ color: T.textDim, marginLeft: '4px' }}>({days}d)</span>}
                  </div>
                  {lastEv?.s && (
                    <div style={{ fontSize: '9px', color: T.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                      {lastEv.s}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div>
                  <Badge color={dayColor} size="sm">
                    {days <= 7 ? 'ACTIVE' : days <= 25 ? 'WARM' : days <= 90 ? 'COLD' : 'DARK'}
                  </Badge>
                </div>

                {/* Draft outreach button */}
                <div>
                  <button
                    onClick={() => setDraftAcc(acc)}
                    style={{
                      padding: '3px 8px', borderRadius: '4px', cursor: 'pointer',
                      fontFamily: FONT_MONO, fontSize: '8px', fontWeight: 600,
                      background: `${T.purple}15`, border: `1px solid ${T.purple}50`, color: T.purple,
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${T.purple}30`; e.currentTarget.style.borderColor = T.purple }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${T.purple}15`; e.currentTarget.style.borderColor = `${T.purple}50` }}
                  >
                    Draft Outreach
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background: T.card, boxShadow: CARD_SHADOW, borderRadius: RADIUS,
      padding: '12px 14px', textAlign: 'center',
    }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '20px', fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  )
}
