import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FONT_MONO, T } from '../../lib/constants'
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
      // Center horizontally on the element, clamp to viewport
      let left = r.left + r.width / 2 - tipW / 2
      left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8))
      // Position above by default; flip below if too close to top
      let top = r.top - 8
      const above = top > 400 // enough room above for tall tooltips
      if (!above) top = r.bottom + 8
      setPos({ left, top, above })
    }
  }, [show])

  return (
    <span
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{ position: 'relative', cursor: 'help', borderBottom: `1px dotted ${T.textDim}40`, ...style }}
    >
      {children}
      {show && pos && createPortal(
        <span style={{
          position: 'fixed',
          left: pos.left,
          top: pos.above ? undefined : pos.top,
          bottom: pos.above ? `${window.innerHeight - pos.top}px` : undefined,
          padding: '12px 16px',
          background: '#1C2333',
          border: `1px solid ${T.border}`,
          borderRadius: '6px',
          fontFamily: FONT_MONO,
          fontSize: '11px',
          fontWeight: 400,
          lineHeight: 1.6,
          color: T.textMid,
          whiteSpace: 'pre-wrap',
          width: '440px',
          maxWidth: 'calc(100vw - 16px)',
          textTransform: 'none',
          letterSpacing: 'normal',
          zIndex: 99999,
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          {text}
        </span>,
        document.body
      )}
    </span>
  )
}
