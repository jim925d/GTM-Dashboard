import { useState, useEffect, useRef } from 'react'
import { T, STATUS_COLORS, STATUS_LABELS } from '../lib/constants'
import { cn } from '@/lib/utils'
import Stat from '../components/shared/Stat'
import Badge from '../components/shared/Badge'
import Tip from '../components/shared/Tip'
import { $, $k } from '../components/shared/ChartTheme'

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

const FILTERS = ['all', 'on-net', 'near-net', 'off-net']

export default function Locations({ a }) {
  const [selLoc, setSelLoc] = useState(null)
  const [filter, setFilter] = useState('all')
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const highlightRef = useRef(null)

  const allLocs = a.locations || []
  const locs = filter === 'all' ? allLocs : allLocs.filter(l => l.status === filter)
  const onNet = allLocs.filter(l => l.status === 'on-net')
  const nearNet = allLocs.filter(l => l.status === 'near-net')
  const offNet = allLocs.filter(l => l.status === 'off-net')
  const totalLocMRR = allLocs.reduce((s, l) => s + (l.mrr || 0), 0)

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    const L = window.L
    if (!L) return

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([39.0, -98.0], 4)

    L.tileLayer(TILE_URL, {
      attribution: '&copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markersRef.current = []
      highlightRef.current = null
    }
  }, [a.id || a.name])

  // Update markers when filter or data changes
  useEffect(() => {
    const map = mapInstanceRef.current
    const L = window.L
    if (!map || !L) return

    // Clear old markers
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []
    if (highlightRef.current) { map.removeLayer(highlightRef.current); highlightRef.current = null }

    const validLocs = locs.filter(l => l.lat && l.lng)

    validLocs.forEach((loc, i) => {
      const color = STATUS_COLORS[loc.status] || T.textDim
      const radius = loc.mrr > 0 ? Math.min(5 + Math.log10(loc.mrr + 1) * 2, 12) : 4

      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius,
        fillColor: color,
        color: color,
        weight: 1.5,
        opacity: 0.85,
        fillOpacity: 0.5,
      }).addTo(map)

      marker.bindTooltip(
        `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600">${loc.name}</div>
         <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#8B949E">${loc.type} &middot; ${STATUS_LABELS[loc.status] || loc.status}</div>
         ${loc.address ? `<div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:#6E7681">${loc.address}</div>` : ''}
         ${loc.mrr > 0 ? `<div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${T.cyan};font-weight:700">${$k(loc.mrr)}/mo</div>` : ''}`,
        { className: 'revos-tooltip', direction: 'top', offset: [0, -8] }
      )

      // Find matching index in allLocs for selection
      const allIdx = allLocs.indexOf(loc)
      marker.on('click', () => {
        setSelLoc(allIdx)
        setFilter('all') // show all when clicking on map
      })
      markersRef.current.push(marker)
    })

    // Fit bounds
    if (validLocs.length > 0) {
      const bounds = L.latLngBounds(validLocs.map(l => [l.lat, l.lng]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
    }
  }, [filter, a.id || a.name, locs.length])

  // Highlight selected location
  useEffect(() => {
    const map = mapInstanceRef.current
    const L = window.L
    if (!map || !L) return

    if (highlightRef.current) {
      map.removeLayer(highlightRef.current)
      highlightRef.current = null
    }

    if (selLoc !== null && allLocs[selLoc]) {
      const loc = allLocs[selLoc]
      if (loc.lat && loc.lng) {
        const color = STATUS_COLORS[loc.status] || T.cyan
        highlightRef.current = L.circleMarker([loc.lat, loc.lng], {
          radius: 18,
          fillColor: color,
          color: '#ffffff',
          weight: 3,
          opacity: 1,
          fillOpacity: 0.3,
        }).addTo(map)

        map.setView([loc.lat, loc.lng], Math.max(map.getZoom(), 10), { animate: true })
      }
    }
  }, [selLoc])

  const sel = selLoc !== null ? allLocs[selLoc] : null

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-5 gap-2 mb-3.5">
        <Stat label="TOTAL LOCATIONS" value={allLocs.length} color={T.cyan} />
        <Stat label="LOCATION MRR" value={`${$(totalLocMRR)}/mo`} color={T.cyan} />
        <Stat label="ON-NET" value={onNet.length} sub={`${$(onNet.reduce((s, l) => s + (l.mrr || 0), 0))}/mo`} color={T.green} />
        <Stat label="NEAR-NET" value={nearNet.length} sub={`${$(nearNet.reduce((s, l) => s + (l.mrr || 0), 0))}/mo`} color={T.yellow} />
        <Stat label="OFF-NET" value={offNet.length} sub={`${$(offNet.reduce((s, l) => s + (l.mrr || 0), 0))}/mo`} color={T.red} />
      </div>

      {/* Filter buttons */}
      <div className="flex gap-1.5 mb-3">
        {FILTERS.map(f => {
          const color = f === 'all' ? T.cyan : STATUS_COLORS[f] || T.cyan
          return (
            <button
              key={f}
              onClick={() => { setFilter(f); setSelLoc(null) }}
              style={{
                background: filter === f ? `${color}15` : T.surface,
                boxShadow: filter === f ? `0 0 0 1px ${color}30` : 'none',
                color: filter === f ? color : T.textDim,
              }}
              className={cn(
                'border-none rounded-md px-3.5 py-1.5 font-sans text-[10px] tracking-wide uppercase cursor-pointer',
                filter === f ? 'font-bold' : 'font-medium'
              )}
            >
              {f === 'all' ? `ALL (${allLocs.length})` : `${STATUS_LABELS[f]} (${allLocs.filter(l => l.status === f).length})`}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-3">
        {/* Map */}
        <div className="bg-revos-card rounded-xl shadow-card p-4">
          <div className="font-sans text-[10px] text-revos-text-dim tracking-wide mb-2.5">
            <Tip label="LOCATION MAP">LOCATION MAP</Tip> — {locs.filter(l => l.lat && l.lng).length} MAPPED
          </div>
          <div ref={mapRef} style={{ height: '480px', borderRadius: '8px', border: `1px solid ${T.border}` }} />
        </div>

        {/* Location list + detail panel */}
        <div className="flex flex-col gap-2.5" style={{ maxHeight: '560px' }}>
          {/* Detail panel (shown when a location is selected) */}
          {sel && (
            <div
              className="bg-revos-card rounded-lg shadow-card p-3.5"
              style={{ borderLeft: `4px solid ${STATUS_COLORS[sel.status]}` }}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-[13px]">{sel.name}</span>
                <Badge color={STATUS_COLORS[sel.status]}>{STATUS_LABELS[sel.status]}</Badge>
              </div>
              {sel.address && (
                <div className="font-mono text-[10px] text-revos-text-mid mb-1.5">
                  {sel.address}
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <div className="bg-revos-surface rounded p-2">
                  <div className="font-sans text-[10px] text-revos-text-dim tracking-wide"><Tip label="TYPE">TYPE</Tip></div>
                  <div className="font-mono text-[11px] font-semibold mt-0.5">{sel.type}</div>
                </div>
                <div className="bg-revos-surface rounded p-2">
                  <div className="font-sans text-[10px] text-revos-text-dim tracking-wide"><Tip label="MRR">MRR</Tip></div>
                  <div className="font-mono text-[11px] font-bold text-revos-cyan mt-0.5">
                    {sel.mrr > 0 ? `${$(sel.mrr)}/mo` : '—'}
                  </div>
                </div>
                {sel.market && (
                  <div className="bg-revos-surface rounded p-2">
                    <div className="font-sans text-[10px] text-revos-text-dim tracking-wide"><Tip label="MARKET">MARKET</Tip></div>
                    <div className="font-mono text-[11px] font-semibold mt-0.5">{sel.market}</div>
                  </div>
                )}
                {sel.classification && (
                  <div className="bg-revos-surface rounded p-2">
                    <div className="font-sans text-[10px] text-revos-text-dim tracking-wide"><Tip label="CLASS">CLASS</Tip></div>
                    <div className="font-mono text-[11px] font-semibold mt-0.5">{sel.classification}</div>
                  </div>
                )}
                {sel.feet_from_network > 0 && (
                  <div className="bg-revos-surface rounded p-2 col-span-2">
                    <div className="font-sans text-[10px] text-revos-text-dim tracking-wide"><Tip label="DISTANCE FROM NETWORK">DISTANCE FROM NETWORK</Tip></div>
                    <div className="font-mono text-[11px] font-semibold mt-0.5">
                      {sel.feet_from_network.toLocaleString()} ft
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelLoc(null)}
                className="mt-2 w-full bg-revos-surface border border-revos-border rounded p-1 font-mono text-[9px] text-revos-text-dim cursor-pointer tracking-widest"
              >CLOSE</button>
            </div>
          )}

          {/* Location card list */}
          <div className="overflow-y-auto flex-1">
            <div className="font-sans text-[10px] text-revos-text-dim tracking-wide mb-2">
              {locs.length} LOCATIONS
            </div>
            {locs.length === 0 && (
              <div className="p-5 text-center font-mono text-[11px] text-revos-text-dim">
                No locations found
              </div>
            )}
            {locs.map((l, i) => {
              const allIdx = allLocs.indexOf(l)
              const isSel = selLoc === allIdx
              const c = STATUS_COLORS[l.status] || T.textDim
              return (
                <div
                  key={i}
                  onClick={() => setSelLoc(isSel ? null : allIdx)}
                  className="rounded-md p-2.5 mb-1 cursor-pointer transition-all duration-150"
                  style={{
                    background: isSel ? T.cardHover : T.card,
                    boxShadow: isSel ? `0 0 8px ${c}30` : undefined,
                    borderLeft: `3px solid ${c}`,
                  }}
                >
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-semibold text-[11px] max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {l.name}
                    </span>
                    <Badge color={c} size="sm">{STATUS_LABELS[l.status]}</Badge>
                  </div>
                  <div className="font-mono text-[9px] text-revos-text-mid">
                    {l.type}
                    {l.market ? ` · ${l.market}` : ''}
                  </div>
                  {l.mrr > 0 && (
                    <div className="font-mono text-[10px] font-bold text-revos-cyan mt-0.5">
                      {$k(l.mrr)}/mo
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`
        .revos-tooltip {
          background: ${T.card} !important;
          border: 1px solid ${T.border} !important;
          border-radius: 6px !important;
          padding: 6px 10px !important;
          color: ${T.text} !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
        }
        .revos-tooltip::before { border-top-color: ${T.border} !important; }
        .leaflet-control-zoom a {
          background: ${T.card} !important;
          color: ${T.text} !important;
          border-color: ${T.border} !important;
        }
      `}</style>
    </div>
  )
}
