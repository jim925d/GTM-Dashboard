/**
 * OutageMonitor — Clean Slate light-themed operational dashboard.
 *
 * Shows US ISP outages from Cloudflare Radar + IODA on an SVG map
 * with a sidebar incident feed and stats bar. Distinct from the dark
 * GTM dashboards — this is an operational utility.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useOutageData } from '../lib/OutageContext'
import { projectAlbersUsa } from '../lib/outageGeo'
import { US_STATES, STATE_BORDERS } from '../lib/usStatesGeo'

// ── Clean Slate palette ─────────────────────────────────────────────────────

const CS = {
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  text: '#0f172a',
  textMid: '#475569',
  textDim: '#94a3b8',
  textFaint: '#cbd5e1',
  red: '#dc2626', redBg: '#fef2f2', redText: '#991b1b',
  amber: '#d97706', amberBg: '#fffbeb', amberText: '#92400e',
  green: '#16a34a', greenBg: '#f0fdf4', greenText: '#166534',
  blue: '#2563eb', blueBg: '#eff6ff', blueText: '#1e40af',
  slate100: '#f1f5f9', slate200: '#e2e8f0', slate300: '#cbd5e1',
  slate900: '#0f172a',
}

const SEV = {
  high:   { color: CS.red,   bg: CS.redBg,   text: CS.redText,   label: 'Major',    dot: '#ef4444', halo: 'rgba(239,68,68,0.2)' },
  medium: { color: CS.amber, bg: CS.amberBg, text: CS.amberText, label: 'Moderate', dot: '#f59e0b', halo: 'rgba(245,158,11,0.2)' },
  low:    { color: CS.green, bg: CS.greenBg, text: CS.greenText, label: 'Minor',    dot: '#22c55e', halo: 'rgba(34,197,94,0.2)' },
}

// ── Time formatting ─────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

// ═════════════════════════════════════════════════════════════════════════════
// OUTAGE STATS BAR
// ═════════════════════════════════════════════════════════════════════════════

function OutageStats({ outages, timeFilter }) {
  const active = useMemo(() => outages.filter(o => o.status === 'active'), [outages])
  const resolved = useMemo(() => outages.filter(o => o.status === 'resolved'), [outages])

  const highCount = active.filter(o => o.severity === 'high').length
  const medCount = active.filter(o => o.severity === 'medium').length
  const lowCount = active.filter(o => o.severity === 'low').length

  const sources = useMemo(() => {
    const cf = outages.filter(o => o.source === 'cloudflare' || o.source === 'both').length
    const ioda = outages.filter(o => o.source === 'ioda' || o.source === 'both').length
    return { cloudflare: cf, ioda }
  }, [outages])

  const stats = [
    { label: 'Active', value: active.length, color: CS.red },
    { label: 'Major', value: highCount, color: SEV.high.color },
    { label: 'Moderate', value: medCount, color: SEV.medium.color },
    { label: 'Minor', value: lowCount, color: SEV.low.color },
    { label: 'Resolved', value: resolved.length, color: CS.textDim },
    { label: 'Sources', value: `CF:${sources.cloudflare} IODA:${sources.ioda}`, color: CS.blue },
  ]

  return (
    <div style={{ background: CS.surface, borderBottom: `1px solid ${CS.border}`, padding: '10px 28px' }}
      className="flex items-center gap-6">
      {stats.map(s => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span style={{ color: CS.textDim, fontSize: 11, fontFamily: 'system-ui, sans-serif' }}>{s.label}</span>
          <span style={{ color: s.color, fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', 'IBM Plex Mono', monospace" }}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// OUTAGE MAP (SVG)
// ═════════════════════════════════════════════════════════════════════════════

function OutageMap({ outages, selected, hovered, onSelect, onHover }) {
  const containerRef = useRef(null)
  const [dims, setDims] = useState({ w: 800, h: 500 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setDims({ w: width, h: height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const { w, h } = dims
  // Scale factor to fit 960x600 paths into the container
  const scaleX = w / 960
  const scaleY = h / 600
  const scale = Math.min(scaleX, scaleY)
  const offsetX = (w - 960 * scale) / 2
  const offsetY = (h - 600 * scale) / 2

  // Project outage markers into the 960x600 space, then scale
  const markers = useMemo(() => {
    return outages
      .filter(o => o.lat && o.lng)
      .map(o => {
        const p = projectAlbersUsa(o.lat, o.lng)
        return {
          ...o,
          x: p.x * scale + offsetX,
          y: p.y * scale + offsetY,
        }
      })
  }, [outages, scale, offsetX, offsetY])

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ minHeight: 300 }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', inset: 0 }}>
        {/* State fills + borders */}
        <g transform={`translate(${offsetX},${offsetY}) scale(${scale})`}>
          {US_STATES.map(s => (
            <path key={s.id} d={s.path} fill={CS.slate100} stroke={CS.slate200} strokeWidth={0.5} strokeLinejoin="round" />
          ))}
          <path d={STATE_BORDERS} fill="none" stroke={CS.slate300} strokeWidth={0.5} strokeLinejoin="round" />
        </g>

        {/* Outage markers */}
        {markers.map(m => {
          const sev = SEV[m.severity] || SEV.low
          const isResolved = m.status === 'resolved'
          const isSelected = m.id === selected
          const isHovered = m.id === hovered
          const scale = isHovered ? 1.4 : isSelected ? 1.2 : 1
          const baseR = m.severity === 'high' ? 7 : m.severity === 'medium' ? 5.5 : 4

          return (
            <g
              key={m.id}
              transform={`translate(${m.x}, ${m.y})`}
              style={{ cursor: 'pointer', opacity: isResolved ? 0.45 : 1 }}
              onClick={() => onSelect(m.id === selected ? null : m.id)}
              onMouseEnter={() => onHover(m.id)}
              onMouseLeave={() => onHover(null)}
            >
              {/* Halo */}
              {!isResolved && (
                <circle r={baseR * scale * 2.5} fill={sev.halo} opacity={0.6}>
                  {(m.severity === 'high' || m.severity === 'medium') && (
                    <animate attributeName="r" values={`${baseR * scale * 2};${baseR * scale * 3};${baseR * scale * 2}`}
                      dur={m.severity === 'high' ? '2s' : '3s'} repeatCount="indefinite" />
                  )}
                </circle>
              )}

              {/* Resolved dashed ring */}
              {isResolved && (
                <circle r={baseR * scale * 1.8} fill="none"
                  stroke={CS.slate300} strokeWidth={1} strokeDasharray="3 2" />
              )}

              {/* Main dot */}
              <circle
                r={baseR * scale}
                fill={isResolved ? CS.slate300 : sev.dot}
                stroke={isSelected ? CS.slate900 : CS.surface}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />

              {/* Hover tooltip */}
              {isHovered && (
                <g>
                  <rect x={-60} y={-baseR * scale - 28} width={120} height={22}
                    rx={6} fill={CS.slate900} opacity={0.92} />
                  <text x={0} y={-baseR * scale - 13} textAnchor="middle"
                    fill={CS.surface} fontSize={10} fontFamily="system-ui, sans-serif" fontWeight={500}>
                    {(m.provider || m.location || '').slice(0, 20)}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>

      {/* Empty state */}
      {markers.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div style={{ background: CS.greenBg, borderRadius: 12, width: 48, height: 48 }}
            className="flex items-center justify-center mb-3">
            <span style={{ color: CS.green, fontSize: 24 }}>✓</span>
          </div>
          <div style={{ color: CS.text, fontSize: 16, fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>All clear</div>
          <div style={{ color: CS.textDim, fontSize: 12, marginTop: 4, fontFamily: 'system-ui, sans-serif' }}>No outages detected</div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// OUTAGE LIST (SIDEBAR)
// ═════════════════════════════════════════════════════════════════════════════

function OutageList({ outages, selected, onSelect }) {
  return (
    <div style={{ width: 360, background: CS.surface, borderLeft: `1px solid ${CS.border}`, overflowY: 'auto' }}
      className="shrink-0">
      <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${CS.border}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: CS.text, fontFamily: 'system-ui, sans-serif' }}>
          Incidents
        </span>
        <span style={{ fontSize: 11, color: CS.textDim, marginLeft: 8, fontFamily: "'DM Mono', 'IBM Plex Mono', monospace" }}>
          {outages.length}
        </span>
      </div>

      {outages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <div style={{ background: CS.greenBg, borderRadius: 10, width: 40, height: 40 }}
            className="flex items-center justify-center mb-2">
            <span style={{ color: CS.green, fontSize: 20 }}>✓</span>
          </div>
          <div style={{ color: CS.textDim, fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>No incidents</div>
        </div>
      )}

      {outages.map(o => {
        const sev = SEV[o.severity] || SEV.low
        const isResolved = o.status === 'resolved'
        const isSelected = o.id === selected

        return (
          <div
            key={o.id}
            onClick={() => onSelect(o.id === selected ? null : o.id)}
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${CS.borderLight}`,
              cursor: 'pointer',
              background: isSelected ? CS.bg : CS.surface,
              borderLeft: isSelected ? `3px solid ${sev.color}` : '3px solid transparent',
              opacity: isResolved ? 0.55 : 1,
              transition: 'all 150ms',
            }}
          >
            {/* Top row: provider + severity badge */}
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 13, fontWeight: 600, color: CS.text, fontFamily: 'system-ui, sans-serif' }}>
                {o.provider || o.location}
              </span>
              <div className="flex items-center gap-1.5">
                {isResolved && (
                  <span style={{
                    fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 999,
                    background: CS.slate100, color: CS.textDim, fontFamily: 'system-ui, sans-serif',
                  }}>
                    Resolved
                  </span>
                )}
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 999,
                  background: sev.bg, color: sev.text, fontFamily: 'system-ui, sans-serif',
                }}>
                  {sev.label}
                </span>
              </div>
            </div>

            {/* Location */}
            <div style={{ fontSize: 11, color: CS.textMid, fontFamily: 'system-ui, sans-serif', marginBottom: 3 }}>
              {o.location}
              {o.source === 'both' && (
                <span style={{ fontSize: 9, color: CS.blue, marginLeft: 6, fontWeight: 600 }}>CF+IODA</span>
              )}
              {o.source === 'cloudflare' && (
                <span style={{ fontSize: 9, color: CS.textDim, marginLeft: 6 }}>Cloudflare</span>
              )}
              {o.source === 'ioda' && (
                <span style={{ fontSize: 9, color: CS.textDim, marginLeft: 6 }}>IODA</span>
              )}
            </div>

            {/* Description */}
            <div style={{ fontSize: 11, color: CS.textDim, fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
              {o.description}
            </div>

            {/* Timing */}
            <div style={{
              fontSize: 10, color: CS.textFaint, marginTop: 4,
              fontFamily: "'DM Mono', 'IBM Plex Mono', monospace",
            }}>
              {isResolved
                ? `${formatDate(o.startDate)} → ${formatDate(o.endDate)}`
                : `Started ${timeAgo(o.startDate)} · ${formatDate(o.startDate)}`
              }
              {o.score && (
                <span style={{ marginLeft: 8, color: CS.textDim }}>score: {Math.round(o.score)}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// OUTAGE MONITOR PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function OutageMonitor() {
  const [timeFilter, setTimeFilter] = useState('current')
  const { getFiltered, isLoading, error, lastRunAge, meta, refreshOutages, isStale } = useOutageData()
  const outages = useMemo(() => getFiltered(timeFilter), [getFiltered, timeFilter])
  const [selected, setSelected] = useState(null)
  const [hovered, setHovered] = useState(null)

  return (
    <div style={{ background: CS.bg, fontFamily: "'DM Sans', 'IBM Plex Sans', system-ui, sans-serif" }}
      className="h-full flex flex-col">

      {/* ── Header ── */}
      <header style={{ background: CS.surface, borderBottom: `1px solid ${CS.border}` }}
        className="px-7 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          {/* Logo mark */}
          <div className="flex items-center gap-2">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: CS.red }}
              className="relative">
              <div style={{
                position: 'absolute', inset: -3, borderRadius: '50%',
                border: `2px solid ${CS.red}`, opacity: 0.3,
              }} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: CS.text, letterSpacing: '-0.02em' }}>
              Outage Monitor
            </span>
          </div>

          {/* Freshness badge */}
          {lastRunAge && (
            <span style={{
              fontSize: 10, color: isStale ? CS.amber : CS.textDim,
              fontFamily: "'DM Mono', 'IBM Plex Mono', monospace",
            }}>
              Updated {lastRunAge}
            </span>
          )}

          {/* Error badge */}
          {error && (
            <span style={{ fontSize: 10, color: CS.red, fontFamily: 'system-ui, sans-serif' }}>
              ⚠ {error}
            </span>
          )}

          {meta.errors?.length > 0 && !error && (
            <span style={{ fontSize: 10, color: CS.amber, fontFamily: 'system-ui, sans-serif' }}>
              ⚠ Partial: {meta.errors.join(', ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Filter toggle */}
          <div style={{ background: CS.slate100, borderRadius: 8, padding: 2 }} className="flex">
            {[
              { key: 'current', label: 'Current' },
              { key: '30d', label: 'Last 30 days' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setTimeFilter(f.key)}
                style={{
                  padding: '5px 14px', fontSize: 11, fontWeight: 500, borderRadius: 6,
                  border: 'none', cursor: 'pointer', transition: 'all 150ms',
                  fontFamily: 'system-ui, sans-serif',
                  background: timeFilter === f.key ? CS.surface : 'transparent',
                  color: timeFilter === f.key ? CS.text : CS.textDim,
                  boxShadow: timeFilter === f.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={refreshOutages}
            disabled={isLoading}
            style={{
              padding: '5px 14px', fontSize: 11, fontWeight: 600, borderRadius: 8,
              border: 'none', cursor: isLoading ? 'wait' : 'pointer',
              background: CS.slate900, color: CS.surface,
              opacity: isLoading ? 0.5 : 1, transition: 'opacity 150ms',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {isLoading ? 'Scanning…' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* ── Stats bar ── */}
      <OutageStats outages={outages} timeFilter={timeFilter} />

      {/* ── Main layout: map + sidebar ── */}
      <div className="flex flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 p-4">
          <OutageMap
            outages={outages}
            selected={selected}
            hovered={hovered}
            onSelect={setSelected}
            onHover={setHovered}
          />
        </div>

        {/* Sidebar */}
        <OutageList
          outages={outages}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    </div>
  )
}
