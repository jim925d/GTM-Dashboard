import { FONT_MONO, T, BADGE_RADIUS } from '../../lib/constants'

export default function Badge({ children, color = T.cyan, size = 'sm' }) {
  return (
    <span style={{
      display: 'inline-flex',
      padding: size === 'sm' ? '2px 9px' : '3px 12px',
      borderRadius: BADGE_RADIUS,
      fontFamily: FONT_MONO,
      fontSize: size === 'sm' ? '9px' : '10px',
      fontWeight: 600,
      letterSpacing: '0.03em',
      color,
      background: `${color}15`,
      border: `1px solid ${color}25`,
    }}>
      {children}
    </span>
  )
}
