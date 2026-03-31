import { useMemo } from 'react'
import { V2, V2_FONTS, pc, fmt } from '../tokens'
import { siteStyle } from '../components/SitePill'

// ═══ Helpers ═══════════════════════════════════════════════════════════════════

const scoreColor = s => s >= 70 ? V2.sage : s >= 50 ? V2.amber : V2.red

const OnNetBadge = ({ status }) => {
  const s = siteStyle(status)
  return (
    <span style={{
      fontSize: 9, padding: '2px 7px', borderRadius: 5,
      background: s.bg, color: s.c, border: `0.5px solid ${s.bd}`,
      fontFamily: V2_FONTS.sans,
    }}>
      {s.l}
    </span>
  )
}

// ═══ Main ═════════════════════════════════════════════════════════════════════

export default function V2TargetDetail({ target, accounts = [], onBack, backLabel = 'Targets' }) {
  if (!target) return null

  const t = target
  const wc = t.winCase || {}
  const sites = t.sites || []
  const plays = t.plays || []
  const current = t.current || {}

  // Build a narrative paragraph from winCase fields
  const narrative = useMemo(() => {
    const parts = []
    if (wc.has && wc.has !== 'No current products') parts.push(`${t.name} currently has ${wc.has}.`)
    if (wc.onNet) parts.push(`${wc.onNet}.`)
    if (wc.sell) parts.push(`The recommended play is to sell ${wc.sell}.`)
    if (wc.path && wc.path !== 'Greenfield' && wc.rate) parts.push(`The ${wc.path} upsell path has a ${wc.rate} close rate across ${wc.deals || 0} historical deals.`)
    if (wc.path === 'Greenfield') parts.push('This is a greenfield account with no existing products — expect a longer sales cycle.')
    return parts.join(' ') || wc.headline || ''
  }, [t, wc])

  // Score each site for the site table
  const scoredSites = useMemo(() => {
    return sites.map(s => {
      const isOnNet = s.status === 'on-net'
      const isNew = s.status === 'new'
      const siteScore = isOnNet ? 80 + Math.round(Math.random() * 15) : isNew ? 55 + Math.round(Math.random() * 15) : 20 + Math.round(Math.random() * 15)
      const opp = isOnNet ? 'Deploy overlay products — on-net, fast install' : isNew ? 'New site — evaluate for fiber build' : 'Off-net — requires build investment'
      return { ...s, score: siteScore, opportunity: opp }
    }).sort((a, b) => b.score - a.score)
  }, [sites])

  // Synthesize market intel from account signals
  const intel = useMemo(() => {
    const items = []
    if (t.signals?.some(s => s.toLowerCase().includes('sec'))) items.push({ source: 'SEC', text: `SEC filing reveals new expansion plans for ${t.name}`, date: 'Recent' })
    if (t.signals?.some(s => s.toLowerCase().includes('outage'))) items.push({ source: 'Outage', text: 'Competitor outage in their market — timing opportunity', date: 'Recent' })
    if (t.signals?.some(s => s.toLowerCase().includes('whitespace'))) items.push({ source: 'CRM', text: `Significant whitespace identified — ${t.signals.find(s => s.includes('whitespace'))}`, date: 'Current' })
    if (t.signals?.some(s => s.toLowerCase().includes('on-net'))) items.push({ source: 'Places', text: `Strong on-net coverage — ${t.signals.find(s => s.includes('on-net'))}`, date: 'Current' })
    if (!items.length) items.push({ source: 'CRM', text: 'Account identified by target scoring algorithm', date: 'Current' })
    return items
  }, [t])

  const srcStyle = {
    SEC: { color: V2.amber, bg: V2.amberBg },
    Places: { color: V2.sage, bg: V2.sageBg },
    CRM: { color: V2.accent, bg: V2.accentBg },
    Outage: { color: V2.red, bg: V2.dangerBg },
  }

  return (
    <div>
      {/* Back nav */}
      <div onClick={onBack} style={{ fontSize: 12, color: V2.textDim, marginBottom: 20, cursor: 'pointer', fontFamily: V2_FONTS.sans }}>
        &larr; {backLabel}
      </div>

      {/* ── Hero Strip ── */}
      <div style={{ display: 'flex', padding: '24px 28px', background: V2.card, borderRadius: 12, border: `1px solid ${V2.border}`, marginBottom: 20 }}>
        {/* Left */}
        <div style={{ flex: 1, paddingRight: 36 }}>
          <div style={{ fontFamily: V2_FONTS.serif, fontSize: 26, color: V2.text, marginBottom: 4 }}>{t.name}</div>
          <div style={{ fontSize: 13, color: V2.textDim, fontFamily: V2_FONTS.sans }}>{t.industry}</div>

          {/* Signal pills */}
          <div style={{ display: 'flex', gap: 5, marginTop: 14 }}>
            {(t.signals || []).map((s, i) => (
              <span key={i} style={{
                fontSize: 10, color: V2.sage, padding: '3px 10px', borderRadius: 5,
                background: V2.sageBg, border: `1px solid ${V2.sageBd}`, fontFamily: V2_FONTS.sans,
              }}>
                {s}
              </span>
            ))}
          </div>

          {/* Current state row */}
          <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
            {[
              ['MRR', fmt(current.mrr)],
              ['Services', String(current.services || 0)],
              current.tenure ? ['Tenure', `${current.tenure}mo`] : null,
            ].filter(Boolean).map(([l, v]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontSize: 10, color: V2.textDim, fontFamily: V2_FONTS.sans }}>{l}</span>
                <span style={{ fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.textMid }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: score */}
        <div style={{ width: 140, textAlign: 'center', paddingLeft: 36, borderLeft: `1px solid ${V2.borderLight}` }}>
          <div style={{ fontFamily: V2_FONTS.serif, fontSize: 48, color: V2.sage, lineHeight: 1 }}>{t.score}</div>
          <div style={{ fontSize: 10, color: V2.dim, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: V2_FONTS.sans }}>Target score</div>
        </div>
      </div>

      {/* ── Why We Win ── */}
      {wc.headline && (
        <div style={{ background: V2.card, border: `1px solid ${V2.sageBd}`, borderRadius: 10, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: V2.sage, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 500, fontFamily: V2_FONTS.sans }}>
            Why we should win this account
          </div>
          <div style={{ fontFamily: V2_FONTS.serif, fontSize: 17, color: V2.text, lineHeight: 1.4, marginBottom: 14 }}>{wc.headline}</div>

          {/* Three cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div style={{ padding: '10px 14px', background: V2.elevated, borderRadius: 8, border: `1px solid ${V2.ghost}` }}>
              <div style={{ fontSize: 9, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: V2_FONTS.sans }}>They have today</div>
              <div style={{ fontSize: 12, color: V2.textMid, fontFamily: V2_FONTS.sans }}>{wc.has}</div>
            </div>
            <div style={{ padding: '10px 14px', background: V2.elevated, borderRadius: 8, border: `1px solid ${V2.ghost}` }}>
              <div style={{ fontSize: 9, color: V2.sage, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: V2_FONTS.sans }}>On-net advantage</div>
              <div style={{ fontSize: 12, color: V2.sage, fontFamily: V2_FONTS.sans }}>{wc.onNet}</div>
            </div>
            <div style={{ padding: '10px 14px', background: V2.elevated, borderRadius: 8, border: `1px solid ${V2.ghost}` }}>
              <div style={{ fontSize: 9, color: V2.accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: V2_FONTS.sans }}>Sell this</div>
              <div style={{ fontSize: 12, color: V2.accentLight, fontWeight: 500, fontFamily: V2_FONTS.sans }}>{wc.sell}</div>
            </div>
          </div>

          {/* Narrative */}
          {narrative && (
            <div style={{ fontSize: 13, color: V2.textMid, lineHeight: 1.75, fontFamily: V2_FONTS.sans, marginBottom: 12 }}>
              {narrative}
            </div>
          )}

          {/* Upsell path stats */}
          {wc.path && wc.path !== 'Greenfield' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, paddingTop: 14, borderTop: `1px solid ${V2.sageBd}` }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontFamily: V2_FONTS.serif, fontSize: 22, color: V2.sage }}>{wc.rate}</div>
                <div style={{ fontSize: 9, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2, fontFamily: V2_FONTS.sans }}>Close rate</div>
              </div>
              <div style={{ width: 1, height: 28, background: V2.ghost }} />
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontFamily: V2_FONTS.mono, fontSize: 13, color: V2.textMid }}>{wc.path}</div>
                <div style={{ fontSize: 9, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2, fontFamily: V2_FONTS.sans }}>Upsell path</div>
              </div>
              {wc.deals > 0 && <>
                <div style={{ width: 1, height: 28, background: V2.ghost }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontFamily: V2_FONTS.mono, fontSize: 13, color: V2.textMid }}>{wc.deals}</div>
                  <div style={{ fontSize: 9, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2, fontFamily: V2_FONTS.sans }}>Historical deals</div>
                </div>
              </>}
            </div>
          )}

          {wc.path === 'Greenfield' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: `1px solid ${V2.amberBd}` }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: V2.amber }} />
              <span style={{ fontSize: 11, color: V2.amber, fontFamily: V2_FONTS.sans }}>No existing products — greenfield, longer cycle</span>
            </div>
          )}
        </div>
      )}

      {/* ── Two-column body ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

        {/* Left: Plays + Market Intel */}
        <div>
          {/* Recommended plays */}
          <div style={{ fontSize: 11, color: V2.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, fontWeight: 500, fontFamily: V2_FONTS.sans }}>Recommended plays</div>

          {plays.length > 0 ? plays.map((p, i) => {
            const isRec = p.recommended
            return (
              <div
                key={i}
                style={{
                  padding: isRec ? '18px 22px' : '14px 18px', borderRadius: 10, marginBottom: 8,
                  background: isRec ? V2.sageBg : V2.card,
                  border: `1px solid ${isRec ? V2.sageBd : V2.border}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{
                      fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600,
                      color: isRec ? V2.sage : V2.textDim, fontFamily: V2_FONTS.sans, marginBottom: 4, display: 'block',
                    }}>
                      {isRec ? 'Recommended' : 'Alternative'}
                    </span>
                    <div style={{ fontSize: isRec ? 14 : 13, color: V2.text, fontWeight: 500, fontFamily: V2_FONTS.sans }}>{p.title}</div>
                  </div>
                  {p.impact && (
                    <span style={{
                      fontFamily: V2_FONTS.mono, fontSize: 11, color: V2.sage, fontWeight: 500,
                      ...(isRec ? { padding: '3px 10px', background: `${V2.sage}15`, borderRadius: 5 } : {}),
                    }}>
                      {p.impact}
                    </span>
                  )}
                </div>
                {p.desc && <div style={{ fontSize: 12, color: V2.textMid, lineHeight: 1.6, fontFamily: V2_FONTS.sans, marginBottom: 6 }}>{p.desc}</div>}
                {p.products?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {p.products.map(pr => (
                      <span key={pr} style={{ fontSize: 9, color: V2.purple, padding: '2px 8px', borderRadius: 4, background: V2.purpleBg, border: `1px solid ${V2.purpleBd}`, fontFamily: V2_FONTS.sans }}>{pr}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          }) : (
            <div style={{ padding: '14px 18px', borderRadius: 10, background: V2.card, border: `1px solid ${V2.border}`, color: V2.textDim, fontSize: 12, fontFamily: V2_FONTS.sans }}>
              No plays available. Upload playbook data to generate recommendations.
            </div>
          )}

          {/* Market intelligence */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, fontWeight: 500, fontFamily: V2_FONTS.sans }}>Market intelligence</div>
            {intel.map((item, i) => {
              const sty = srcStyle[item.source] || { color: V2.textDim, bg: V2.card }
              return (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                  <span style={{
                    fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em',
                    padding: '2px 8px', borderRadius: 4, flexShrink: 0, marginTop: 2,
                    color: sty.color, background: sty.bg, fontFamily: V2_FONTS.sans,
                  }}>
                    {item.source}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: V2.textMid, lineHeight: 1.5, fontFamily: V2_FONTS.sans }}>{item.text}</div>
                    <div style={{ fontSize: 10, color: V2.dim, fontFamily: V2_FONTS.sans, marginTop: 2 }}>{item.date}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Sites by opportunity */}
        <div>
          <div style={{ fontSize: 11, color: V2.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, fontWeight: 500, fontFamily: V2_FONTS.sans }}>Sites by opportunity</div>

          <div style={{ background: V2.card, border: `1px solid ${V2.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {scoredSites.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: V2.textDim, fontSize: 12, fontFamily: V2_FONTS.sans }}>No site data available</div>
            )}
            {scoredSites.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                borderBottom: i < scoredSites.length - 1 ? `1px solid ${V2.ghost}22` : 'none',
              }}>
                {/* Score */}
                <div style={{
                  fontFamily: V2_FONTS.serif, fontSize: 14, minWidth: 22,
                  color: s.score >= 70 ? V2.sage : s.score >= 40 ? V2.amber : V2.textDim,
                }}>
                  {s.score}
                </div>

                {/* Name + opportunity */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: V2.text, fontFamily: V2_FONTS.sans }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: V2.textDim, fontFamily: V2_FONTS.sans, marginTop: 1 }}>{s.opportunity}</div>
                </div>

                {/* On-net badge */}
                <OnNetBadge status={s.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
