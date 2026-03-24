// RevOS Design System Constants — Aceternity Dark Theme

export const T = {
  bg: '#06080F',
  surface: '#161B22',
  card: '#161B22',
  cardHover: '#1C2128',
  border: '#21262D',
  borderLight: 'rgba(255,255,255,0.06)',
  text: '#e6edf3',
  textMid: '#c9d1d9',
  textDim: '#8b949e',
  cyan: '#60a5fa',
  green: '#34d399',
  red: '#f87171',
  yellow: '#fbbf24',
  orange: '#f0883e',
  purple: '#a78bfa',
  blue: '#60a5fa',
  teal: '#2dd4bf',
  pink: '#f472b6',
  lime: '#a3e635',
  accent: '#7c5aff',
  accentDim: 'rgba(120,90,255,0.08)',
  accentBorder: 'rgba(120,90,255,0.15)',
  tertiary: '#484f58',
}

export const RADIUS = '16px'
export const CARD_SHADOW = '0 1px 4px rgba(0,0,0,0.4)'
export const BADGE_RADIUS = '100px'

export const FONT_MONO = "'IBM Plex Mono', 'SF Mono', 'Cascadia Code', monospace"
export const FONT_SANS = "'IBM Plex Sans', -apple-system, system-ui, sans-serif"

export const PAGES = [
  { id: 'priority', label: 'Priority', icon: '⚡' },
  { id: 'overview', label: 'Overview', icon: '◉' },
  { id: 'engagement', label: 'Engagement', icon: '💬' },
  { id: 'locations', label: 'Locations', icon: '📍' },
  { id: 'predict', label: 'Predictions', icon: '📊' },
  { id: 'deals', label: 'Deals', icon: '♟' },
  { id: 'signals', label: 'Signals', icon: '📡' },
  { id: 'losses', label: 'Losses', icon: '⚠' },
]

export const MODELING_PAGES = [
  { id: 'backtest', label: 'Backtest', icon: '⏪' },
  { id: 'learning', label: 'Learning', icon: '📈' },
]

export const API_BASE = '/api'

export const STAGE_COLORS = {
  Discover: '#60a5fa',
  Design: '#818cf8',
  'Design Solution': '#818cf8',
  Propose: '#a78bfa',
  Negotiate: '#c084fc',
  'Verbal Agreement': '#34d399',
  Accepted: '#34d399',
  '5 - Accepted': '#34d399',
  'Closed Won': '#34d399',
  'Closed-Won': '#34d399',
  Closed: '#34d399',
  'Closed Lost': T.red,
  'Close Lost': T.red,
}

// Stage win probabilities from 2026 Funnel Model (validated historical win rates)
export const STAGE_WIN_PROB = {
  'Closed Won': 1.0,
  Accepted: 1.0,
  Closed: 1.0,
  'Verbal Agreement': 0.9249,
  Negotiate: 0.8467,
  Propose: 0.6623,
  'Design Solution': 0.5321,
  Discover: 0.3057,
}

// Stage progression order (lowest to highest probability)
export const STAGE_ORDER = ['Discover', 'Design Solution', 'Propose', 'Negotiate', 'Verbal Agreement', 'Accepted', 'Closed Won']

export function stageProb(stage) {
  if (STAGE_WIN_PROB[stage] !== undefined) return STAGE_WIN_PROB[stage]
  // Normalize common variants
  const l = (stage || '').toLowerCase().trim()
  if (l.includes('accepted') || l === 'closed won' || l === 'closed-won' || l === '5 - accepted') return 1.0
  if (l.includes('verbal')) return STAGE_WIN_PROB['Verbal Agreement']
  if (l.includes('negotiat')) return STAGE_WIN_PROB['Negotiate']
  if (l.includes('propos')) return STAGE_WIN_PROB['Propose']
  if (l.includes('design')) return STAGE_WIN_PROB['Design Solution']
  if (l.includes('discover')) return STAGE_WIN_PROB['Discover']
  return 0.1
}

export const STATUS_COLORS = {
  'on-net': T.green,
  'near-net': T.yellow,
  'off-net': T.red,
}

export const STATUS_LABELS = {
  'on-net': 'On-Net',
  'near-net': 'Near-Net',
  'off-net': 'Off-Net',
}

export const URGENCY_COLORS = {
  act_now: T.red,
  this_week: T.orange,
  this_month: T.yellow,
  monitor: T.textDim,
}

export const SIGNAL_TYPE_COLORS = {
  funding: T.green,
  expansion: T.cyan,
  leadership: T.purple,
  acquisition: T.blue,
  technology: T.orange,
  regulatory: T.yellow,
  financial: T.lime,
  risk: T.red,
}
