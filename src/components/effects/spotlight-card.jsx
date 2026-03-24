import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export function SpotlightCard({ children, className = '', style }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [hovering, setHovering] = useState(false)

  const handleMouseMove = (e) => {
    const rect = ref.current.getBoundingClientRect()
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={cn(
        'relative overflow-hidden rounded-xl border border-revos-border bg-revos-card',
        className
      )}
      style={style}
    >
      {/* Spotlight gradient */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-400"
        style={{
          opacity: hovering ? 1 : 0,
          background: `radial-gradient(600px circle at ${pos.x}px ${pos.y}px, rgba(120,90,255,0.08), transparent 40%)`,
        }}
      />
      {/* Border glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-400"
        style={{
          opacity: hovering ? 1 : 0,
          boxShadow: `inset 0 0 0 1px rgba(120,90,255,${hovering ? 0.3 : 0})`,
        }}
      />
      {children}
    </div>
  )
}
