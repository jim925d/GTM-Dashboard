import { useState, useRef, useEffect } from 'react'
import { FONT_SANS, FONT_MONO, T, PAGES, MODELING_PAGES, RADIUS, CARD_SHADOW } from '../../lib/constants'

export default function TopNav({ activePage, onPageChange }) {
  const [modelOpen, setModelOpen] = useState(false)
  const dropRef = useRef(null)

  const isModelingPage = MODELING_PAGES.some(p => p.id === activePage)

  useEffect(() => {
    if (!modelOpen) return
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setModelOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [modelOpen])

  const btnStyle = (active) => ({
    padding: '6px 14px',
    borderRadius: RADIUS,
    border: 'none',
    background: active ? T.card : 'transparent',
    color: active ? T.text : T.textDim,
    fontFamily: FONT_SANS,
    fontSize: '10px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.15s',
    boxShadow: active ? CARD_SHADOW : 'none',
  })

  return (
    <div
      style={{
        padding: '6px 16px',
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
        display: 'flex',
        gap: '2px',
        flexShrink: 0,
      }}
    >
      {PAGES.map((p) => (
        <button
          key={p.id}
          onClick={() => onPageChange(p.id)}
          style={btnStyle(activePage === p.id)}
        >
          <span style={{ fontSize: '11px' }}>{p.icon}</span>
          {p.label}
        </button>
      ))}

      <div style={{ flex: 1 }} />

      <div ref={dropRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setModelOpen(!modelOpen)}
          style={{ ...btnStyle(isModelingPage), gap: '4px' }}
        >
          <span style={{ fontSize: '11px' }}>🧪</span>
          Modeling
          <span style={{ fontSize: '8px', marginLeft: '2px' }}>{modelOpen ? '▲' : '▼'}</span>
        </button>
        {modelOpen && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: '4px',
            background: T.card, borderRadius: RADIUS, overflow: 'hidden',
            zIndex: 100, minWidth: '140px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}>
            {MODELING_PAGES.map((p) => (
              <button
                key={p.id}
                onClick={() => { onPageChange(p.id); setModelOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  width: '100%', padding: '8px 12px', border: 'none',
                  background: activePage === p.id ? T.cardHover : 'transparent',
                  color: activePage === p.id ? T.text : T.textMid,
                  fontFamily: FONT_SANS, fontSize: '10px',
                  fontWeight: activePage === p.id ? 600 : 400,
                  cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.background = T.cardHover}
                onMouseLeave={e => e.currentTarget.style.background = activePage === p.id ? T.cardHover : 'transparent'}
              >
                <span style={{ fontSize: '11px' }}>{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
