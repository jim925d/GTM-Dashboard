import { useState, useEffect } from 'react'

export function ProgressRing({
  value,
  size = 52,
  color = '#34d399',
  strokeWidth = 4,
}) {
  const [animated, setAnimated] = useState(0)
  const r = (size - strokeWidth * 2) / 2
  const circ = 2 * Math.PI * r

  useEffect(() => {
    setTimeout(() => setAnimated(value), 100)
  }, [value])

  return (
    <svg
      width={size}
      height={size}
      style={{ transform: 'rotate(-90deg)', display: 'block' }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - (animated / 100) * circ}
        style={{
          transition: 'stroke-dashoffset 1.8s cubic-bezier(0.16,1,0.3,1)',
        }}
      />
    </svg>
  )
}
