import Tip from './Tip'
import { cn } from '@/lib/utils'

export default function Stat({ label, value, sub, color = 'text-revos-cyan', small, bare }) {
  const inner = (
    <>
      <div className="font-sans text-[8px] text-revos-text-dim tracking-wider mb-1 uppercase">
        <Tip label={label}>{label}</Tip>
      </div>
      <div className={cn('font-mono font-bold leading-none', color, small ? 'text-sm' : 'text-lg')}>
        {value}
      </div>
      {sub && (
        <div className="font-sans text-[9px] text-revos-text-dim mt-0.5">
          {sub}
        </div>
      )}
    </>
  )

  if (bare) return <div>{inner}</div>

  return (
    <div className={cn('bg-revos-card rounded-lg shadow-card', small ? 'p-2' : 'px-3 py-2.5')}>
      {inner}
    </div>
  )
}
