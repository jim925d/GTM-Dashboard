import { useState } from 'react'
import { cn } from '@/lib/utils'

export function RevealCard({ children, className = '', style }) {
  const [hover, setHover] = useState(false)

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        'relative rounded-xl border bg-revos-card transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]',
        hover
          ? 'border-white/10 -translate-y-0.5 shadow-[0_8px_30px_rgba(120,90,255,0.08),0_0_0_1px_rgba(120,90,255,0.15)]'
          : 'border-revos-border translate-y-0 shadow-none',
        className
      )}
      style={style}
    >
      {children}
    </div>
  )
}
