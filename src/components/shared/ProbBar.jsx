import { T } from '../../lib/constants'

export default function ProbBar({ value, color, h = 5 }) {
  return (
    <div
      style={{
        height: `${h}px`,
        background: T.border,
        borderRadius: `${h}px`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.min(value * 100, 100)}%`,
          height: '100%',
          background: color,
          borderRadius: `${h}px`,
          transition: 'width 0.8s ease',
        }}
      />
    </div>
  )
}
