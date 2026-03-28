import { useState } from 'react'
import { V2, V2_FONTS, V2_NAV } from './tokens'

// Grid pattern SVG for background
const gridBg = `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40V0h40' fill='none' stroke='%23ffffff' stroke-opacity='0.03' stroke-width='1'/%3E%3C/svg%3E")`

// Icon components (inline SVG to avoid extra deps)
const icons = {
  grid: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  'trending-up': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  target: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  'bar-chart-2': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
}

export default function V2Layout({ activePage, onNavigate, onBack, children }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: `${V2.bg}`,
        backgroundImage: gridBg,
        color: V2.text,
        fontFamily: V2_FONTS.sans,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Top Nav ── */}
      <nav
        style={{
          height: 56,
          borderBottom: `1px solid ${V2.border}`,
          background: V2.bgSubtle,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: 32,
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: V2_FONTS.mono,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: V2.accent,
            }}
          >
            REVOS
          </span>
          <span
            style={{
              fontFamily: V2_FONTS.mono,
              fontSize: 9,
              fontWeight: 600,
              color: V2.textDim,
              background: V2.accentDim,
              border: `1px solid ${V2.accentBorder}`,
              padding: '2px 8px',
              borderRadius: V2.radiusFull,
              letterSpacing: '0.08em',
            }}
          >
            V2 PREVIEW
          </span>
        </div>

        {/* Nav items */}
        <div style={{ display: 'flex', gap: 4 }}>
          {V2_NAV.map((item) => {
            const active = activePage === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: V2.radiusSm,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  fontFamily: V2_FONTS.sans,
                  color: active ? V2.text : V2.textDim,
                  background: active ? V2.accentDim : 'transparent',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.target.style.background = V2.surfaceHover
                }}
                onMouseLeave={(e) => {
                  if (!active) e.target.style.background = 'transparent'
                }}
              >
                {icons[item.icon]}
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Spacer + Back link */}
        <div style={{ flex: 1 }} />
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: V2.radiusSm,
            border: `1px solid ${V2.border}`,
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: V2_FONTS.sans,
            color: V2.textDim,
            background: 'transparent',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => { e.target.style.borderColor = V2.accent; e.target.style.color = V2.text }}
          onMouseLeave={(e) => { e.target.style.borderColor = V2.border; e.target.style.color = V2.textDim }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Back to classic
        </button>
      </nav>

      {/* ── Content ── */}
      <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
