import { T, FONT_MONO, FONT_SANS } from '../../lib/constants'

export const chartTheme = {
  bg: T.card,
  grid: T.border,
  text: T.textDim,
  font: FONT_MONO,
  tooltip: {
    background: T.card,
    border: 'none',
    borderRadius: 12,
    fontSize: 11,
    fontFamily: FONT_SANS,
    color: T.text,
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
}

// Formatters
export const $ = (n) => `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
export const $k = (n) => `$${Math.round(n).toLocaleString()}`
export const pc = (n) => `${(n * 100).toFixed(0)}%`
export const pc1 = (n) => `${(n * 100).toFixed(1)}%`
