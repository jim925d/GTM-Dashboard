import { useState } from 'react'
import { V2, V2_FONTS, pc } from '../tokens'

/**
 * ProbTooltip — hover any probability % to see engine factor breakdown.
 *
 * Props:
 *   prob      — win probability 0-100
 *   factors   — array of [name, value, color, explanation] tuples
 *   size      — "sm" (inline) | "lg" (hero display)
 *   children  — optional custom render for the probability text
 */
export default function ProbTooltip({ prob, factors, size = 'sm', children }) {
  const [show, setShow] = useState(false)
  const color = pc(prob)
  const isLg = size === 'lg'

  // If no factors, render plain text
  if (!factors || !factors.length) {
    return (
      <span style={{
        fontFamily: isLg ? V2_FONTS.serif : V2_FONTS.mono,
        fontSize: isLg ? 48 : 12,
        color,
        fontWeight: isLg ? 400 : 500,
      }}>
        {children || `${prob}%`}
      </span>
    )
  }

  return (
    <span
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ position: 'relative', cursor: 'help' }}
    >
      {/* Trigger text */}
      <span style={{
        fontFamily: isLg ? V2_FONTS.serif : V2_FONTS.mono,
        fontSize: isLg ? 48 : 12,
        color,
        fontWeight: isLg ? 400 : 500,
        borderBottom: show ? `1px dashed ${color}50` : '1px dashed transparent',
        transition: 'border-color 0.15s',
      }}>
        {children || `${prob}%`}
      </span>

      {/* Tooltip */}
      {show && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: isLg ? '50%' : 0,
          transform: isLg ? 'translateX(-50%)' : 'none',
          marginTop: 10,
          zIndex: 100,
          width: 270,
          background: V2.popover,
          border: `1px solid ${V2.borderLight}`,
          borderRadius: 12,
          padding: '14px 16px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          pointerEvents: 'none',
        }}>
          {/* Arrow */}
          <div style={{
            position: 'absolute',
            top: -5,
            left: isLg ? '50%' : 20,
            transform: 'translateX(-50%) rotate(45deg)',
            width: 10, height: 10,
            background: V2.popover,
            border: `1px solid ${V2.borderLight}`,
            borderBottom: 'none',
            borderRight: 'none',
          }} />

          {/* Header */}
          <div style={{
            fontSize: 10, color: V2.textDim, textTransform: 'uppercase',
            letterSpacing: '0.06em', fontWeight: 500, marginBottom: 10,
            fontFamily: V2_FONTS.sans,
          }}>
            Probability breakdown
          </div>

          {/* Factor rows */}
          {factors.map(([name, value, factorColor, explanation], i) => (
            <div key={i} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                <span style={{ fontSize: 12, color: V2.textMid, fontFamily: V2_FONTS.sans }}>{name}</span>
                <span style={{ fontFamily: V2_FONTS.mono, fontSize: 12, color: factorColor || V2.textMid, fontWeight: 500 }}>{value}</span>
              </div>
              {explanation && (
                <div style={{ fontSize: 10, color: V2.textDim, fontWeight: 300, fontFamily: V2_FONTS.sans }}>{explanation}</div>
              )}
            </div>
          ))}

          {/* Footer total */}
          <div style={{
            borderTop: `1px solid ${V2.ghost}`,
            marginTop: 8, paddingTop: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, color: V2.text, fontWeight: 500, fontFamily: V2_FONTS.sans }}>Win probability</span>
            <span style={{ fontFamily: V2_FONTS.serif, fontSize: 20, color }}>{prob}%</span>
          </div>
        </div>
      )}
    </span>
  )
}
