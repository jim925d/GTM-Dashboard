import { useState } from 'react'
import { V2, V2_FONTS, V2_NAV, gridBgStyle, fmt } from './tokens'

export default function V2Layout({ activePage, onNavigate, onBack, children, filterScope, filterValue, onFilterChange, team, reps }) {
  const [repDrop, setRepDrop] = useState(false)

  // Build rep display info
  const currentRep = filterScope === 'rep' && filterValue
    ? { name: filterValue, initials: filterValue.slice(0, 2).toUpperCase() }
    : filterScope === '1lm' && filterValue
    ? { name: filterValue, initials: filterValue.split(' ').map(n => n[0]).join('').toUpperCase() }
    : { name: 'Entire Team', initials: 'ALL' }

  // Build dropdown options
  const dropdownOptions = [
    { id: 'team', name: 'Entire Team', initials: 'ALL', scope: 'team', value: null },
    ...(team || []).map(t => ({ id: `1lm-${t.name}`, name: t.name, initials: t.name.split(' ').map(n => n[0]).join(''), scope: '1lm', value: t.name, sub: `${t.reps.length} reps` })),
    ...(reps || []).map(r => ({ id: `rep-${r}`, name: r, initials: r.slice(0, 2).toUpperCase(), scope: 'rep', value: r })),
  ]

  const activeKey = filterScope === 'team' ? 'team' : `${filterScope}-${filterValue}`

  return (
    <div
      style={{
        minHeight: '100vh',
        background: V2.bg,
        ...gridBgStyle,
        color: V2.text,
        fontFamily: V2_FONTS.sans,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Top Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 28px',
          borderBottom: `1px solid ${V2.border}`,
          background: V2.card,
          flexShrink: 0,
        }}
      >
        {/* Left: Logo + badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: V2.accentBg, border: `1px solid ${V2.accentBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: V2_FONTS.mono, fontSize: 10, fontWeight: 600, color: V2.accent,
            }}>
              R
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: V2.text }}>RevOS</span>
          </div>
          <span style={{
            fontSize: 9, color: V2.accent, padding: '3px 9px', borderRadius: 4,
            background: V2.accentBg, border: `1px solid ${V2.accentBorder}`,
            fontWeight: 600, letterSpacing: '0.04em', fontFamily: V2_FONTS.mono,
          }}>
            GTM PREMIER
          </span>
        </div>

        {/* Center: Nav pills */}
        <div style={{ display: 'flex', gap: 1, background: V2.elevated, borderRadius: 8, padding: 2, border: `1px solid ${V2.ghost}` }}>
          {V2_NAV.map(item => {
            const active = activePage === item.id || (activePage === 'v2-deal-detail' && item.id === 'v2-pipeline') || (activePage === 'v2-target-detail' && item.id === 'v2-targets')
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                style={{
                  padding: '6px 16px', borderRadius: 6, fontSize: 11,
                  fontWeight: active ? 500 : 400,
                  color: active ? V2.accent : V2.textDim,
                  background: active ? V2.accentBg : 'transparent',
                  border: active ? `1px solid ${V2.accentBorder}` : '1px solid transparent',
                  cursor: 'pointer', fontFamily: V2_FONTS.sans,
                  transition: 'all 0.15s',
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Right: Avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: V2.elevated, border: `1px solid ${V2.ghost}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: V2.textDim, fontWeight: 500,
        }}>
          JM
        </div>
      </div>

      {/* ── Rep Selector Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 28px',
          borderBottom: `1px solid ${V2.border}`,
          background: V2.card,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 10, color: V2.dim, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Viewing</span>

          {/* Rep dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setRepDrop(!repDrop)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '6px 14px', borderRadius: 8,
                background: V2.elevated, border: `1px solid ${V2.ghost}`,
                cursor: 'pointer', fontFamily: V2_FONTS.sans, minWidth: 190,
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: V2.accentBg, border: `1px solid ${V2.accentBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: V2.accent, fontWeight: 600,
              }}>
                {currentRep.initials}
              </div>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontSize: 12, color: V2.text, fontWeight: 500 }}>{currentRep.name}</div>
              </div>
              <svg width="9" height="9" viewBox="0 0 10 10" style={{ color: V2.dim, transform: repDrop ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.2" fill="none" />
              </svg>
            </button>

            {repDrop && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 10,
                background: V2.elevated, border: `1px solid ${V2.borderLight}`,
                borderRadius: 10, padding: 3, minWidth: 240,
                boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              }}>
                {dropdownOptions.map(opt => {
                  const isActive = opt.id === activeKey
                  return (
                    <button
                      key={opt.id}
                      onClick={() => { onFilterChange(opt.scope, opt.value); setRepDrop(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        width: '100%', padding: '8px 12px', borderRadius: 6,
                        background: isActive ? V2.accentBg : 'transparent',
                        border: 'none', cursor: 'pointer', fontFamily: V2_FONTS.sans, textAlign: 'left',
                      }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: 5,
                        background: isActive ? V2.accentBg : V2.card,
                        border: `1px solid ${isActive ? V2.accentBorder : V2.ghost}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, color: isActive ? V2.accent : V2.dim, fontWeight: 600,
                      }}>
                        {opt.initials}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: isActive ? V2.accent : V2.text, fontWeight: 500 }}>{opt.name}</div>
                        {opt.sub && <div style={{ fontSize: 10, color: V2.dim }}>{opt.sub}</div>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Export button */}
        <button style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '7px 16px', borderRadius: 8,
          background: V2.elevated, border: `1px solid ${V2.ghost}`,
          cursor: 'pointer', fontFamily: V2_FONTS.sans,
        }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V9M7 9L4 6.5M7 9L10 6.5M2 11H12" stroke={V2.textDim} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 11, color: V2.textDim }}>Export briefing</span>
        </button>
      </div>

      {/* ── Content ── */}
      <main style={{ flex: 1, padding: '24px 28px', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
