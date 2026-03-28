// RevOS V2 Design Tokens
// Dark theme with updated palette, typography, and spacing

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
  borderFocus: '#7C5AFF',

  // Text
  text: '#F0F2F5',
  textMid: '#B0B8C4',
  textDim: '#6B7280',
  textMuted: '#4B5563',

  // Brand / Accent
  accent: '#7C5AFF',
  accentHover: '#6B4AEE',
  accentDim: 'rgba(124,90,255,0.10)',
  accentBorder: 'rgba(124,90,255,0.20)',

  // Semantic
  green: '#34D399',
  greenDim: 'rgba(52,211,153,0.10)',
  red: '#F87171',
  redDim: 'rgba(248,113,113,0.10)',
  yellow: '#FBBF24',
  yellowDim: 'rgba(251,191,36,0.10)',
  blue: '#60A5FA',
  blueDim: 'rgba(96,165,250,0.10)',
  orange: '#FB923C',
  orangeDim: 'rgba(251,146,60,0.10)',
  purple: '#A78BFA',
  purpleDim: 'rgba(167,139,250,0.10)',
  cyan: '#22D3EE',
  cyanDim: 'rgba(34,211,238,0.10)',
  pink: '#F472B6',
  teal: '#2DD4BF',

  // Shadows
  shadow: '0 1px 3px rgba(0,0,0,0.4)',
  shadowLg: '0 4px 12px rgba(0,0,0,0.5)',
  shadowGlow: '0 0 24px rgba(124,90,255,0.12)',

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
