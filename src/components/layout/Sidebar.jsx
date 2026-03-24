import { Badge as UiBadge } from '@/components/ui/badge'
import Tip from '../shared/Tip'
import { $ } from '../shared/ChartTheme'
import { cn } from '@/lib/utils'

const RISK_TIPS = {
  low: 'Low Risk — Stable account with healthy engagement, strong win rate, and minimal churn signals.',
  moderate: 'Moderate Risk — Some warning signs present: declining engagement, recent losses, or slowing pipeline velocity.',
  elevated: 'Elevated Risk — Multiple risk factors detected: significant losses, disconnects, or prolonged silence.',
  critical: 'Critical Risk — Immediate attention needed: high churn probability, major disconnects, or extended disengagement.',
  at_risk: 'At Risk — Account health score indicates significant exposure: declining revenue, active churn, or stalled deals.',
}

const riskColor = (score) =>
  score >= 50 ? 'text-revos-red bg-revos-red/10 border-revos-red/15'
    : score >= 30 ? 'text-revos-orange bg-revos-orange/10 border-revos-orange/15'
    : 'text-revos-green bg-revos-green/10 border-revos-green/15'

const velocityIcon = (v) =>
  v === 'accelerating' ? '▲' : v === 'stalled' ? '▼' : '●'

const velocityColor = (v) =>
  v === 'accelerating' ? 'text-revos-green' : v === 'stalled' ? 'text-revos-red' : 'text-revos-yellow'

export default function Sidebar({ accounts, selectedIndex, onSelect }) {
  return (
    <div>
      <div className="px-3 py-2.5 font-sans text-[9px] text-revos-text-dim tracking-wider border-b border-border uppercase">
        Accounts ({accounts.length})
      </div>
      {accounts.map((acc, i) => {
        const isSel = i === selectedIndex
        const riskKey = (acc.risk_level || 'low').toLowerCase().replace(/[\s_-]/g, '_')
        const riskTip = RISK_TIPS[riskKey] || RISK_TIPS['moderate']
        return (
          <div
            key={acc.id || acc.name}
            onClick={() => onSelect(i)}
            className={cn(
              'px-3 py-2.5 cursor-pointer border-b border-border transition-all duration-150',
              isSel ? 'border-l-[3px] border-l-revos-cyan bg-revos-card' : 'border-l-[3px] border-l-transparent'
            )}
          >
            <div className="flex justify-between mb-0.5">
              <span className="font-semibold text-xs">{acc.name}</span>
              <Tip tip={riskTip} style={{ borderBottom: 'none' }}>
                <span className={cn('inline-flex px-2 py-0.5 rounded-full font-mono text-[9px] font-semibold tracking-wide border', riskColor(acc.risk_score))}>
                  {acc.risk_level.toUpperCase()}
                </span>
              </Tip>
            </div>
            <div className="font-sans text-[9px] text-revos-text-mid mb-0.5">
              {acc.vertical}
            </div>
            <div className="flex gap-1.5 font-mono text-[9px] flex-wrap">
              <span className="text-revos-cyan">{$(acc.tmr)}</span>
              {acc.lost > 0 && <span className="text-revos-red">{acc.lost}L</span>}
              {acc.disconnects > 0 && <span className="text-revos-orange">{acc.disconnects}D</span>}
            </div>
            <div className={cn('font-mono text-[8px] mt-0.5', velocityColor(acc.velocity))}>
              {velocityIcon(acc.velocity)} {acc.velocity} · {acc.days_silent}d
            </div>
          </div>
        )
      })}
    </div>
  )
}
