// RevOS V2 Design Tokens — SITREP theme from design reference
// DM Sans / DM Serif Display / JetBrains Mono

export const V2 = {
  // Backgrounds
  bg: '#0D0D10',
  card: '#151518',
  elevated: '#1B1B20',
  popover: '#202025',
  surface: '#151518',
  surfaceHover: '#1B1B20',

  // Text
  text: '#E8E0D4',
  textMid: '#9BA4B5',
  textDim: '#6B7689',
  textMuted: '#3A3A42',

  // Ghost / structural
  ghost: '#2A2A32',
  dim: '#3A3A42',

  // Borders
  border: '#2A2A32',
  borderLight: '#3A3A42',
  borderFocus: '#C87941',

  // Copper — primary accent
  accent: '#C87941',
  accentLight: '#E8A66A',
  accentDim: '#8B5A2B',
  accentBg: 'rgba(200,121,65,0.10)',
  accentBorder: 'rgba(200,121,65,0.25)',
  accentHover: '#E8A66A',

  // Sage — positive / success
  sage: '#6B8F71',
  sageLight: '#8FB996',
  sageDim: '#4A6B4F',
  sageBg: 'rgba(107,143,113,0.10)',
  sageBd: 'rgba(107,143,113,0.22)',
  green: '#6B8F71',       // alias
  greenDim: 'rgba(107,143,113,0.10)',
  teal: '#6B8F71',        // alias for compatibility
  tealDim: 'rgba(107,143,113,0.10)',

  // Purple — weighted/probability
  purple: '#9B7EC8',
  purpleLight: '#B89DE0',
  purpleBg: 'rgba(155,126,200,0.10)',
  purpleBd: 'rgba(155,126,200,0.22)',
  purpleDim: 'rgba(155,126,200,0.10)',

  // Amber — warning / mid-range
  amber: '#D4A34A',
  amberBg: 'rgba(212,163,74,0.10)',
  amberBd: 'rgba(212,163,74,0.22)',
  amberDim: 'rgba(212,163,74,0.10)',
  yellow: '#D4A34A',

  // Danger — risk / critical
  red: '#C75050',
  redDim: 'rgba(199,80,80,0.10)',
  dangerBg: 'rgba(199,80,80,0.10)',
  dangerBd: 'rgba(199,80,80,0.22)',

  // Blue
  blue: '#5B8CB8',
  blueBg: 'rgba(91,140,184,0.10)',
  blueDim: 'rgba(91,140,184,0.10)',

  // Misc
  orange: '#E8A66A',
  orangeDim: 'rgba(232,166,106,0.10)',
  cyan: '#5B8CB8',
  cyanDim: 'rgba(91,140,184,0.10)',
  pink: '#C75050',

  // Shadows
  shadow: '0 1px 3px rgba(0,0,0,0.4)',
  shadowLg: '0 4px 12px rgba(0,0,0,0.5)',
  shadowGlow: '0 0 24px rgba(200,121,65,0.12)',

  // Radius
  radius: '12px',
  radiusSm: '8px',
  radiusLg: '16px',
  radiusFull: '9999px',
}

// Typography
export const V2_FONTS = {
  sans: "'DM Sans', system-ui, sans-serif",
  serif: "'DM Serif Display', Georgia, serif",
  mono: "'JetBrains Mono', monospace",
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
  { id: 'v2-dashboard', label: 'Dashboard' },
  { id: 'v2-pipeline', label: 'Pipeline' },
  { id: 'v2-targets', label: 'Targets' },
  { id: 'v2-forecast', label: 'Forecast' },
]

// Stage progression order and weights
export const STAGES = ['Discover', 'Design Solution', 'Propose', 'Negotiate', 'Verbal Agreement']
export const STAGE_WEIGHTS = {
  'Discover': 0.10,
  'Design': 0.25,
  'Design Solution': 0.25,
  'Propose': 0.50,
  'Negotiate': 0.75,
  'Verbal Agreement': 0.90,
  'Closed Won': 1.00,
}

// Engine tag colors
export const ENGINE_COLORS = {
  prediction: { text: V2.purple, bg: V2.purpleBg, border: V2.purpleBd },
  location:   { text: V2.sage, bg: V2.sageBg, border: V2.sageBd },
  outage:     { text: V2.red, bg: V2.dangerBg, border: V2.dangerBd },
  backtest:   { text: V2.amber, bg: V2.amberBg, border: V2.amberBd },
  event:      { text: V2.blue, bg: V2.blueBg, border: 'rgba(91,140,184,0.22)' },
  competitive:{ text: V2.orange, bg: V2.orangeDim, border: 'rgba(232,166,106,0.22)' },
}

// Probability color helper
export const pc = (p) => p >= 70 ? V2.sage : p >= 45 ? V2.amber : V2.red

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
  backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)',
  backgroundSize: '56px 56px',
}
