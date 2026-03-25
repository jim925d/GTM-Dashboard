import { cn } from '@/lib/utils'

export function GradientText({ children, className = '' }) {
  return (
    <span
      className={cn(
        'bg-clip-text text-transparent font-semibold animate-shimmer',
        className
      )}
      style={{
        backgroundImage:
          'linear-gradient(135deg, #c084fc, #60a5fa, #34d399, #c084fc)',
        backgroundSize: '300% 300%',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}
    >
      {children}
    </span>
  )
}
