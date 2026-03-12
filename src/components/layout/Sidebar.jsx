import { FONT_MONO, FONT_SANS, T } from '../../lib/constants'
import Badge from '../shared/Badge'
import Tip from '../shared/Tip'
import { $ } from '../shared/ChartTheme'

const RISK_TIPS = {
  low: 'Low Risk — Stable account with healthy engagement, strong win rate, and minimal churn signals.',
  moderate: 'Moderate Risk — Some warning signs present: declining engagement, recent losses, or slowing pipeline velocity.',
  elevated: 'Elevated Risk — Multiple risk factors detected: significant losses, disconnects, or prolonged silence.',
  critical: 'Critical Risk — Immediate attention needed: high churn probability, major disconnects, or extended disengagement.',
  at_risk: 'At Risk — Account health score indicates significant exposure: declining revenue, active churn, or stalled deals.',
}

export default function Sidebar({ accounts, selectedIndex, onSelect }) {
  return (
    <div>
      <div
        style={{
          padding: '10px 12px',
          fontFamily: FONT_SANS,
          fontSize: '9px',
          color: T.textDim,
          letterSpacing: '0.04em',
          borderBottom: `1px solid ${T.border}`,
          textTransform: 'uppercase',
        }}
      >
        Accounts ({accounts.length})
      </div>
      {accounts.map((acc, i) => {
        const isSel = i === selectedIndex
        const rc = acc.risk_score >= 50 ? T.red : acc.risk_score >= 30 ? T.orange : T.green
        const riskKey = (acc.risk_level || 'low').toLowerCase().replace(/[\s_-]/g, '_')
        const riskTip = RISK_TIPS[riskKey] || RISK_TIPS['moderate']
        return (
          <div
            key={acc.id || acc.name}
            onClick={() => onSelect(i)}
            style={{
              padding: '10px 12px',
              cursor: 'pointer',
              borderBottom: `1px solid ${T.border}`,
              borderLeft: `3px solid ${isSel ? T.cyan : 'transparent'}`,
              background: isSel ? T.card : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontWeight: 600, fontSize: '12px' }}>{acc.name}</span>
              <Tip tip={riskTip} style={{ borderBottom: 'none' }}>
                <Badge color={rc} size="sm">
                  {acc.risk_level.toUpperCase()}
                </Badge>
              </Tip>
            </div>
            <div style={{ fontFamily: FONT_SANS, fontSize: '9px', color: T.textMid, marginBottom: '3px' }}>
              {acc.vertical}
            </div>
            <div style={{ display: 'flex', gap: '6px', fontFamily: FONT_MONO, fontSize: '9px', flexWrap: 'wrap' }}>
              <span style={{ color: T.cyan }}>{$(acc.arr)}</span>
              {acc.lost > 0 && <span style={{ color: T.red }}>{acc.lost}L</span>}
              {acc.disconnects > 0 && <span style={{ color: T.orange }}>{acc.disconnects}D</span>}
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: '8px',
                color: acc.velocity === 'accelerating' ? T.green : acc.velocity === 'stalled' ? T.red : T.yellow,
                marginTop: '2px',
              }}
            >
              {acc.velocity === 'accelerating' ? '▲' : acc.velocity === 'stalled' ? '▼' : '●'} {acc.velocity} ·{' '}
              {acc.days_silent}d
            </div>
          </div>
        )
      })}
    </div>
  )
}
