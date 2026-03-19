import { FONT_MONO, FONT_SANS, T, RADIUS } from '../../lib/constants'

export default function Header({ accountCount, onLogoClick }) {
  return (
    <div
      style={{
        padding: '8px 16px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: T.surface,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: onLogoClick ? 'pointer' : 'default' }} onClick={onLogoClick}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: RADIUS,
            background: `linear-gradient(135deg, ${T.cyan}, ${T.purple})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT_MONO,
            fontWeight: 700,
            fontSize: '12px',
            color: T.bg,
          }}
        >
          R
        </div>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: '13px', letterSpacing: '-0.01em' }}>
            RevOS
          </div>
          <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim, letterSpacing: '0.02em' }}>
            Bayesian Prediction · Game Theory · Signal Intelligence
          </div>
        </div>
      </div>
      <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textDim }}>
        Live · {accountCount} accounts
      </div>
    </div>
  )
}
