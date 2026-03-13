// RevOS Design System Constants — Editorial Theme

export const T = {
  bg: '#111111',
  surface: '#161616',
  card: '#1C1C1C',
  cardHover: '#222222',
  border: '#2A2A2A',
  borderLight: '#3A3A3A',
  text: '#F5F0E8',
  textMid: '#D8D0C4',
  textDim: '#A89888',
  cyan: '#6EC8E4',
  green: '#6ED8A0',
  red: '#E87070',
  yellow: '#E8C868',
  orange: '#E8A050',
  purple: '#B090E0',
  blue: '#70A8E0',
  teal: '#50D0B8',
  pink: '#E888B0',
  lime: '#B0E050',
}

export const RADIUS = '12px'
export const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.3)'
export const BADGE_RADIUS = '16px'

export const FONT_MONO = "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace"
export const FONT_SANS = "'Inter', system-ui, sans-serif"

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
  Discover: T.blue,
  Design: T.purple,
  'Design Solution': T.purple,
  Propose: T.yellow,
  Negotiate: T.green,
  'Verbal Agreement': T.teal,
  Accepted: T.cyan,
  '5 - Accepted': T.cyan,
  'Closed Won': T.cyan,
  'Closed-Won': T.cyan,
  Closed: T.cyan,
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
