import { cn } from '@/lib/utils'

export default function Badge({ children, color, className, size = 'sm' }) {
  // If a hex color is passed (legacy), use inline styles for backward compatibility
  if (color && color.startsWith('#')) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full font-mono font-semibold tracking-wide',
          size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-0.5 text-[10px]',
          className
        )}
        style={{
          color,
          background: `${color}15`,
          border: `1px solid ${color}25`,
        }}
      >
        {children}
      </span>
    )
  }

  // Tailwind class-based usage
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-mono font-semibold tracking-wide border',
        size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-0.5 text-[10px]',
        color || 'text-revos-cyan bg-revos-cyan/10 border-revos-cyan/15',
        className
      )}
    >
      {children}
    </span>
  )
}
