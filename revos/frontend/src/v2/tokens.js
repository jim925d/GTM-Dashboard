// RevOS V2 Design Tokens
// Dark theme — spec-aligned palette, typography, and spacing

export const V2 = {
  // Backgrounds
  bg: '#111318',
  bgSubtle: '#161A21',
  surface: '#1A1F27',
  surfaceHover: '#1F2530',
  card: '#1A1F27',
  cardHover: '#222830',

  // Borders
  border: '#2A2F3A',
  borderLight: 'rgba(255,255,255,0.06)',
  borderFocus: '#C4895A',

  // Text
  text: '#F0F2F5',
  textMid: '#B0B8C4',
  textDim: '#6B7280',
  textMuted: '#4B5563',

  // Brand / Accent (warm copper)
  accent: '#C4895A',
  accentHover: '#D49A6B',
  accentDim: 'rgba(196,137,90,0.10)',
  accentBorder: 'rgba(196,137,90,0.25)',

  // Semantic — spec palette
  purple: '#B8A5F0',     // probability-weighted values
  purpleDim: 'rgba(184,165,240,0.10)',
  teal: '#5DCAA5',       // positive indicators
  tealDim: 'rgba(93,202,165,0.10)',
  red: '#E09090',        // risk/urgency
  redDim: 'rgba(224,144,144,0.10)',
  amber: '#E0B060',      // warnings/mid-range
  amberDim: 'rgba(224,176,96,0.10)',
  green: '#5DCAA5',      // alias for teal
  greenDim: 'rgba(93,202,165,0.10)',
  blue: '#60A5FA',
  blueDim: 'rgba(96,165,250,0.10)',
  orange: '#FB923C',
  orangeDim: 'rgba(251,146,60,0.10)',
  cyan: '#22D3EE',
  cyanDim: 'rgba(34,211,238,0.10)',
  pink: '#F472B6',

  // Shadows
  shadow: '0 1px 3px rgba(0,0,0,0.4)',
  shadowLg: '0 4px 12px rgba(0,0,0,0.5)',
  shadowGlow: '0 0 24px rgba(196,137,90,0.12)',

  // Radius
  radius: '12px',
  radiusSm: '8px',
  radiusLg: '16px',
  radiusFull: '9999px',
}

// Typography
export const V2_FONTS = {
  sans: "'Plus Jakarta Sans', 'Inter', -apple-system, system-ui, sans-serif",
  serif: "'Instrument Serif', Georgia, serif",
  mono: "'JetBrains Mono', 'IBM Plex Mono', 'SF Mono', monospace",
}

// Spacing scale (px)
export const V2_SPACE = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
  '4xl': '64px',
}

// V2 Navigation items
export const V2_NAV = [
  { id: 'v2-dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'v2-pipeline', label: 'Pipeline', icon: 'trending-up' },
  { id: 'v2-targets', label: 'Targets', icon: 'target' },
  { id: 'v2-forecast', label: 'Forecast', icon: 'bar-chart-2' },
]

// Stage progression order and weights
export const STAGES = ['Discover', 'Design', 'Propose', 'Negotiate', 'Closed Won']
export const STAGE_WEIGHTS = {
  'Discover': 0.10,
  'Design': 0.25,
  'Design Solution': 0.25,
  'Propose': 0.50,
  'Negotiate': 0.75,
  'Closed Won': 1.00,
}

// Engine tag colors
export const ENGINE_COLORS = {
  prediction: { text: V2.purple, bg: V2.purpleDim, border: 'rgba(184,165,240,0.25)' },
  location:   { text: V2.teal, bg: V2.tealDim, border: 'rgba(93,202,165,0.25)' },
  outage:     { text: V2.red, bg: V2.redDim, border: 'rgba(224,144,144,0.25)' },
  backtest:   { text: V2.amber, bg: V2.amberDim, border: 'rgba(224,176,96,0.25)' },
  event:      { text: V2.blue, bg: V2.blueDim, border: 'rgba(96,165,250,0.25)' },
  competitive:{ text: V2.orange, bg: V2.orangeDim, border: 'rgba(251,146,60,0.25)' },
}

// Helpers
export const fmt = (n) => {
  if (n == null || isNaN(n)) return '--'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

export const fmtPct = (n) => {
  if (n == null || isNaN(n)) return '--%'
  return `${Math.round(n * 100)}%`
}

// CSS grid background as inline style
export const gridBgStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='48' height='48' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 48V0h48' fill='none' stroke='%23ffffff' stroke-opacity='0.02' stroke-width='1'/%3E%3C/svg%3E")`,
}
