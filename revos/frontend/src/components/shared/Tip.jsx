import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { DEFS } from '../../lib/definitions'

/**
 * Hover tooltip wrapper. Looks up definition by label text automatically.
 * Renders via portal so it's never clipped by overflow containers.
 */
export default function Tip({ children, label, tip, delay, style }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const timerRef = useRef(null)

  const childKey = typeof children === 'string' ? children : ''
  const text = tip || DEFS[label] || DEFS[childKey] || DEFS[childKey.toUpperCase()] || label
  if (!text) return <span style={style}>{children}</span>

  const handleEnter = () => {
    if (delay) {
      timerRef.current = setTimeout(() => setShow(true), delay)
    } else {
      setShow(true)
    }
  }
  const handleLeave = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setShow(false)
  }

  useEffect(() => {
    if (show && ref.current) {
      const r = ref.current.getBoundingClientRect()
      const tipW = 440
      let left = r.left + r.width / 2 - tipW / 2
      left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8))
      let top = r.top - 8
      const above = top > 400
      if (!above) top = r.bottom + 8
      setPos({ left, top, above })
    }
  }, [show])

  return (
    <span
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="relative cursor-help"
      style={{ borderBottom: '1px dotted rgba(168,152,136,0.25)', ...style }}
    >
      {children}
      {show && pos && createPortal(
        <span
          className="fixed p-3 px-4 bg-revos-card-hover border border-border rounded-md font-mono text-[11px] font-normal leading-relaxed text-revos-text-mid whitespace-pre-wrap w-[440px] max-w-[calc(100vw-16px)] normal-case tracking-normal z-[99999] pointer-events-none shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
          style={{
            left: pos.left,
            top: pos.above ? undefined : pos.top,
            bottom: pos.above ? `${window.innerHeight - pos.top}px` : undefined,
          }}
        >
          {text}
        </span>,
        document.body
      )}
    </span>
  )
}
