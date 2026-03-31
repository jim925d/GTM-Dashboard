import { V2, V2_FONTS } from '../tokens'

/**
 * Site status → color mapping.
 * Returns { c: text color, bg: background, bd: border, l: label }
 */
export function siteStyle(status) {
  const map = {
    'on-net':  { c: V2.sage, bg: V2.sageBg, bd: V2.sageBd, l: 'On-net' },
    'near-net': { c: V2.amber, bg: V2.amberBg, bd: V2.amberBd, l: 'Near-net' },
    'off-net': { c: V2.red, bg: V2.dangerBg, bd: V2.dangerBd, l: 'Off-net' },
    'new':     { c: V2.purple, bg: V2.purpleBg, bd: V2.purpleBd, l: 'New' },
  }
  return map[(status || '').toLowerCase()] || { c: V2.textDim, bg: V2.card, bd: V2.border, l: status || '' }
}

/**
 * SitePill — location pill with on-net status dot + name + badge.
 *
 * Props:
 *   site — { name: string, status: 'on-net' | 'near-net' | 'off-net' | 'new' }
 */
export default function SitePill({ site }) {
  const s = siteStyle(site.status)
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 11,
      color: s.c,
      padding: '4px 11px',
      borderRadius: 6,
      border: `1px solid ${s.bd}`,
      background: s.bg,
      fontFamily: V2_FONTS.sans,
    }}>
      {/* Status dot with glow */}
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: s.c,
        boxShadow: `0 0 4px ${s.c}40`,
      }} />

      {/* Site name */}
      {site.name}

      {/* Status badge */}
      <span style={{
        fontSize: 8, fontWeight: 600, textTransform: 'uppercase',
        padding: '1px 4px', borderRadius: 3,
        background: `${s.c}15`,
        letterSpacing: '0.03em',
      }}>
        {s.l}
      </span>
    </span>
  )
}
