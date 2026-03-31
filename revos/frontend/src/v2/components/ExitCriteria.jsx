import { useState } from 'react'
import { V2, V2_FONTS } from '../tokens'

/**
 * Stage exit criteria definitions.
 * Each stage has criteria the rep must satisfy to advance.
 * Fields marked with `auto` can be auto-checked from deal/contact data.
 */
const STAGE_CRITERIA = {
  'Discover': {
    next: 'Design Solution',
    criteria: [
      { name: 'Pain identified', question: 'Have you identified a quantified business pain?' },
      { name: 'Budget range confirmed', question: 'Is there budget allocated or allocatable?' },
      { name: 'Decision maker identified', question: 'Do you know who owns the budget?', auto: 'economic_buyer' },
      { name: 'Timeline established', question: 'Is there an event or deadline driving the timeline?' },
    ],
  },
  'Design Solution': {
    next: 'Propose',
    criteria: [
      { name: 'Technical requirements', question: 'Have you completed a design review or technical discovery?' },
      { name: 'Solution mapped to pain', question: 'Does your proposed solution directly address the identified pain?' },
      { name: 'Champion engaged', question: 'Is there an internal advocate pushing this forward?', auto: 'champion' },
      { name: 'Competition known', question: 'Do you know if other vendors are being evaluated?', auto: 'competitor' },
    ],
  },
  'Propose': {
    next: 'Negotiate',
    criteria: [
      { name: 'Proposal delivered', question: 'Has the formal proposal been presented (not just emailed)?' },
      { name: 'Pricing reviewed', question: 'Has the customer reviewed and responded to pricing?' },
      { name: 'Decision criteria confirmed', question: 'Do you know exactly how they\'ll evaluate?' },
      { name: 'Executive sponsor met', question: 'Has a VP+ been in at least one meeting?', auto: 'vp_plus' },
    ],
  },
  'Negotiate': {
    next: 'Verbal Agreement',
    criteria: [
      { name: 'Terms agreed', question: 'Are contract terms (length, SLA, pricing) agreed?' },
      { name: 'Legal engaged', question: 'Is legal or procurement reviewing the contract?' },
      { name: 'Paper process known', question: 'Do you know the signature path and expected timeline?' },
      { name: 'Objections resolved', question: 'Are all technical and commercial objections resolved?' },
    ],
  },
  'Verbal Agreement': {
    next: 'Closed Won',
    criteria: [
      { name: 'Verbal confirmed', question: 'Has the decision maker verbally committed?' },
      { name: 'Contract sent', question: 'Has the contract been sent for signature?' },
    ],
  },
}

/**
 * Resolve auto-check fields against deal data.
 */
function resolveAutoChecks(criteria, deal) {
  return criteria.map(c => {
    if (!c.auto) return { ...c, met: false }
    switch (c.auto) {
      case 'economic_buyer':
        return { ...c, met: !!(deal.has_economic_buyer || deal.hasEconomicBuyer) }
      case 'champion':
        return { ...c, met: !!(deal.has_champion || deal.hasChampion || deal.champion_identified) }
      case 'competitor':
        return { ...c, met: !!(deal.competitor || deal.competitive_threat) }
      case 'vp_plus':
        return { ...c, met: !!(deal.has_vp_plus || deal.hasVpPlus || deal.exec_sponsor) }
      default:
        return { ...c, met: false }
    }
  })
}

/**
 * ExitCriteria — collapsible checklist for current stage.
 *
 * Props:
 *   stage           — current deal stage string
 *   deal            — deal object (for auto-check resolution)
 *   exitCriteria    — optional override: [{ name, met }] from deal data (bypasses stage lookup)
 */
export default function ExitCriteria({ stage, deal = {}, exitCriteria }) {
  const [open, setOpen] = useState(false)

  const stageDef = STAGE_CRITERIA[stage]
  if (!stageDef && !exitCriteria) return null

  const items = exitCriteria || resolveAutoChecks(stageDef.criteria, deal)
  const met = items.filter(c => c.met).length
  const total = items.length
  const nextStage = stageDef?.next || 'Next'

  return (
    <div style={{ marginTop: 20 }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: V2.card, border: `1px solid ${V2.border}`,
          borderRadius: open ? '8px 8px 0 0' : 8,
          color: V2.textMid, fontSize: 12, cursor: 'pointer',
          fontFamily: V2_FONTS.sans, padding: '10px 16px',
          width: '100%', textAlign: 'left',
        }}
      >
        {/* Chevron */}
        <svg
          width="8" height="8" viewBox="0 0 8 8"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <path d="M2 0.5L5.5 4L2 7.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>

        <span style={{ fontWeight: 500, flex: 1 }}>Exit criteria · {stage}</span>

        {/* Mini status dots */}
        <div style={{ display: 'flex', gap: 3 }}>
          {items.map((c, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: 2,
              background: c.met ? V2.sage : V2.accent,
              opacity: c.met ? 0.5 : 0.9,
            }} />
          ))}
        </div>

        <span style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, marginLeft: 4 }}>
          {met}/{total}
        </span>
      </button>

      {/* Expanded checklist */}
      {open && (
        <div style={{
          background: V2.card,
          border: `1px solid ${V2.border}`,
          borderTop: `1px solid ${V2.ghost}`,
          borderRadius: '0 0 8px 8px',
          padding: '4px 16px 12px',
        }}>
          {items.map((c, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 0',
              borderBottom: i < items.length - 1 ? `1px solid ${V2.ghost}22` : 'none',
            }}>
              {/* Checkbox */}
              <div style={{
                width: 18, height: 18, borderRadius: 5,
                border: `2px solid ${c.met ? V2.sage : V2.accent}`,
                background: c.met ? `${V2.sage}18` : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: c.met ? V2.sage : V2.accent, fontWeight: 600,
                flexShrink: 0,
              }}>
                {c.met ? '✓' : ''}
              </div>

              {/* Label */}
              <div style={{ flex: 1 }}>
                <span style={{
                  fontSize: 13,
                  color: c.met ? V2.textDim : V2.text,
                  fontWeight: c.met ? 300 : 500,
                  fontFamily: V2_FONTS.sans,
                }}>
                  {c.name}
                </span>
                {c.question && !c.met && (
                  <div style={{ fontSize: 10, color: V2.textDim, fontWeight: 300, marginTop: 2, fontFamily: V2_FONTS.sans }}>
                    {c.question}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { STAGE_CRITERIA }
