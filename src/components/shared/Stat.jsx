import { FONT_MONO, FONT_SANS, T, RADIUS, CARD_SHADOW } from '../../lib/constants'
import Tip from './Tip'

export default function Stat({ label, value, sub, color = T.cyan, small }) {
  return (
    <div style={{
      padding: small ? '8px' : '10px 12px',
      background: T.card,
      borderRadius: RADIUS,
      boxShadow: CARD_SHADOW,
    }}>
      <div style={{
        fontFamily: FONT_SANS,
        fontSize: '8px',
        color: T.textDim,
        letterSpacing: '0.04em',
        marginBottom: '4px',
        textTransform: 'uppercase',
      }}>
        <Tip label={label}>{label}</Tip>
      </div>
      <div style={{
        fontFamily: FONT_MONO,
        fontSize: small ? '14px' : '18px',
        fontWeight: 700,
        color,
        lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontFamily: FONT_SANS,
          fontSize: '9px',
          color: T.textDim,
          marginTop: '3px',
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}
