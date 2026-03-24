import { cn } from '@/lib/utils'

export function AnimatedBorderCard({
  children,
  className = '',
  borderColor = 'rgba(120,90,255,0.6)',
}) {
  return (
    <div className={cn('relative rounded-xl p-px', className)}>
      {/* Spinning gradient border */}
      <div className="absolute inset-0 overflow-hidden rounded-xl">
        <div
          className="absolute inset-[-50%] animate-spin-slow"
          style={{
            background: `conic-gradient(from 0deg, transparent, ${borderColor}, transparent 30%)`,
          }}
        />
      </div>
      {/* Inner content */}
      <div className="relative rounded-[11px] bg-revos-card h-full">
        {children}
      </div>
    </div>
  )
}
