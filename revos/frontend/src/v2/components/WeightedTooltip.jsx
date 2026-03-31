import { useState } from 'react'
import { V2, V2_FONTS, fmt, fmtPct } from '../tokens'

/**
 * WeightedTooltip — hover a purple weighted MRR value to see the math.
 *
 * Props:
 *   value     — the weighted MRR to display (number)
 *   deals     — array of { accountName, mrr, winProb, stage } for stage-level view
 *   deal      — single { mrr, winProb } for deal-level view
 *   label     — optional label prefix
 */
export default function WeightedTooltip({ value, deals, deal, label }) {
  const [show, setShow] = useState(false)

  const displayVal = fmt(value)

  return (
    <span
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ position: 'relative', cursor: 'help' }}
    >
      {/* Trigger */}
      <span style={{
        fontFamily: V2_FONTS.mono,
        fontSize: 12,
        color: V2.purple,
        fontWeight: 500,
        borderBottom: show ? `1px dashed ${V2.purple}50` : '1px dashed transparent',
        transition: 'border-color 0.15s',
      }}>
        {label}{displayVal}
      </span>

      {/* Tooltip */}
      {show && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 10,
          zIndex: 100,
          width: deals ? 320 : 240,
          background: V2.popover,
          border: `1px solid ${V2.borderLight}`,
          borderRadius: 12,
          padding: '14px 16px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          pointerEvents: 'none',
        }}>
          {/* Arrow */}
          <div style={{
            position: 'absolute', top: -5, left: 20,
            transform: 'translateX(-50%) rotate(45deg)',
            width: 10, height: 10, background: V2.popover,
            border: `1px solid ${V2.borderLight}`,
            borderBottom: 'none', borderRight: 'none',
          }} />

          <div style={{
            fontSize: 10, color: V2.textDim, textTransform: 'uppercase',
            letterSpacing: '0.06em', fontWeight: 500, marginBottom: 10,
            fontFamily: V2_FONTS.sans,
          }}>
            Weighted MRR breakdown
          </div>

          {/* Deal-level: single deal math */}
          {deal && !deals && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: V2.textMid, fontFamily: V2_FONTS.sans }}>Deal MRR</span>
                <span style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: V2.text }}>{fmt(deal.mrr)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: V2.textMid, fontFamily: V2_FONTS.sans }}>Win prob</span>
                <span style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: V2.purple }}>{fmtPct(deal.winProb)}</span>
              </div>
              <div style={{
                borderTop: `1px solid ${V2.ghost}`, marginTop: 8, paddingTop: 8,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 11, color: V2.textDim, fontFamily: V2_FONTS.sans }}>
                  {fmt(deal.mrr)} × {fmtPct(deal.winProb)}
                </span>
                <span style={{ fontFamily: V2_FONTS.serif, fontSize: 18, color: V2.purple }}>{displayVal}</span>
              </div>
            </div>
          )}

          {/* Stage-level: multiple deals */}
          {deals && deals.length > 0 && (
            <div>
              <div style={{
                fontSize: 10, color: V2.textDim, marginBottom: 6,
                fontFamily: V2_FONTS.sans,
              }}>
                {deals.length} deals · avg {fmt(deals.reduce((s, d) => s + (d.mrr || 0), 0) / deals.length)}/mo
              </div>

              {deals.slice(0, 6).map((d, i) => {
                const weighted = (d.mrr || 0) * (d.winProb || 0)
                return (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: i < Math.min(deals.length, 6) - 1 ? `1px solid ${V2.ghost}22` : 'none',
                  }}>
                    <span style={{ fontSize: 11, color: V2.textMid, fontFamily: V2_FONTS.sans, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                      {d.accountName || d.account || 'Deal'}
                    </span>
                    <span style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim, whiteSpace: 'nowrap' }}>
                      {fmt(d.mrr)} × {fmtPct(d.winProb)}
                    </span>
                    <span style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.purple, fontWeight: 500, minWidth: 44, textAlign: 'right' }}>
                      {fmt(weighted)}
                    </span>
                  </div>
                )
              })}
              {deals.length > 6 && (
                <div style={{ fontSize: 10, color: V2.textDim, fontFamily: V2_FONTS.sans, marginTop: 4 }}>
                  +{deals.length - 6} more deals
                </div>
              )}

              <div style={{
                borderTop: `1px solid ${V2.ghost}`, marginTop: 8, paddingTop: 8,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: V2.text, fontWeight: 500, fontFamily: V2_FONTS.sans }}>Total weighted</span>
                <span style={{ fontFamily: V2_FONTS.serif, fontSize: 18, color: V2.purple }}>{displayVal}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </span>
  )
}
