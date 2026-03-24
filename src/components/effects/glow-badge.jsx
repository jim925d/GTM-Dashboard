import { cn } from '@/lib/utils'

export function GlowBadge({ children, color = '#7c5aff', className = '' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
        className
      )}
      style={{
        color: color,
        background: `${color}18`,
        border: `1px solid ${color}30`,
        boxShadow: `0 0 12px ${color}15`,
      }}
    >
      {children}
    </span>
  )
}
