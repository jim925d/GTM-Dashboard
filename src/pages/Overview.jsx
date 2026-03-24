import { useState, useRef, useEffect, memo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { T, STAGE_COLORS } from '../lib/constants'
import { cn } from '@/lib/utils'
import Stat from '../components/shared/Stat'
import Badge from '../components/shared/Badge'
import ProbBar from '../components/shared/ProbBar'
import Tip from '../components/shared/Tip'
import { chartTheme, $, $k, pc } from '../components/shared/ChartTheme'
import { SpotlightCard, Sparkline, ProgressRing, GlowBadge, AnimatedBorderCard } from '../components/effects'
import { useAnimatedCounter } from '../components/effects/use-animated-counter'

// Placeholder sparkline data for KPI trend accents
const SPARK_TMR     = [60, 65, 62, 70, 75, 78, 82, 88, 85, 90, 95, 100]
const SPARK_PIPE    = [30, 35, 25, 40, 38, 45, 50, 48, 55, 60, 58, 65]
const SPARK_WIN     = [55, 60, 58, 65, 70, 68, 72, 75, 78, 80, 82, 85]
const SPARK_HEALTH  = [45, 50, 55, 60, 58, 65, 70, 68, 72, 75, 78, 80]

// --- Section (progressive disclosure) ---
function Section({ title, color = T.cyan, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyRef = useRef(null)
  const [h, setH] = useState(0)
  useEffect(() => {
    if (bodyRef.current) setH(bodyRef.current.scrollHeight)
  }, [open, children])
  return (
    <div className="bg-revos-card rounded-xl shadow-card mb-3 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-transparent border-none cursor-pointer text-left"
      >
        <span
          className="text-[10px] transition-transform duration-200"
          style={{ color, transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >▶</span>
        <span className="font-sans text-[11px] font-semibold text-revos-text flex-1">{title}</span>
        {count != null && <span className="font-mono text-[10px] text-revos-text-dim">{count}</span>}
      </button>
      <div
        style={{ maxHeight: open ? h : 0, opacity: open ? 1 : 0 }}
        className="transition-all duration-300 ease-out overflow-hidden"
      >
        <div ref={bodyRef} className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// --- Services Table ---
function ServicesTable({ services }) {
  if (!services || services.length === 0) {
    return <div className="font-mono text-[10px] text-revos-text-dim text-center py-4">No services data available</div>
  }

  const now = new Date()
  const daysDiff = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return Math.floor((d - now) / 86400000)
  }

  return (
    <div>
      <div
        className="grid gap-2 px-2 py-1.5 font-sans text-[9px] text-revos-text-dim tracking-wider uppercase border-b border-revos-border"
        style={{ gridTemplateColumns: '2fr 1fr 1.2fr 0.8fr' }}
      >
        <div>Product</div>
        <div className="text-right">MRR</div>
        <div className="text-right">Exp Date</div>
        <div className="text-right">Term</div>
      </div>
      {services.map((s, i) => {
        const days = daysDiff(s.expDate)
        const expiryColor = days != null && days <= 30 ? T.red : days != null && days <= 90 ? T.orange : null
        const isMtm = s.term && String(s.term).toLowerCase().includes('mtm') || String(s.term) === '0' || String(s.term).toLowerCase() === 'month-to-month'
        return (
          <div
            key={i}
            className="grid gap-2 px-2 py-1.5 text-[11px] border-b border-revos-border last:border-b-0"
            style={{
              gridTemplateColumns: '2fr 1fr 1.2fr 0.8fr',
              background: i % 2 === 0 ? 'transparent' : `${T.surface}40`,
            }}
          >
            <div className="font-semibold text-revos-text">{s.product}</div>
            <div className="text-right font-mono text-[10px] text-revos-cyan">{$k(s.mrr)}/mo</div>
            <div className="text-right font-mono text-[10px] flex items-center justify-end gap-1">
              {expiryColor && <span className="w-1.5 h-1.5 rounded-full" style={{ background: expiryColor }} />}
              <span style={{ color: expiryColor || T.textMid }}>
                {s.expDate || '—'}
                {days != null && days <= 90 && days > 0 && <span className="text-[8px] ml-0.5">({days}d)</span>}
              </span>
            </div>
            <div className="text-right font-mono text-[10px]">
              {isMtm ? (
                <GlowBadge color={T.orange} className="text-[9px] px-1.5 py-[1px]">MtM</GlowBadge>
              ) : (
                <span className="text-revos-text-mid">{s.term ? `${s.term} mo` : '—'}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// --- Locations List ---
function LocationsList({ locations }) {
  if (!locations || locations.length === 0) {
    return <div className="font-mono text-[10px] text-revos-text-dim text-center py-4">No location data available</div>
  }

  const counts = { 'on-net': 0, 'near-net': 0, 'off-net': 0 }
  locations.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1 })

  const statusColor = s => s === 'on-net' ? T.green : s === 'near-net' ? T.yellow : T.red

  return (
    <div>
      {/* Summary strip */}
      <div className="flex gap-3 mb-3">
        {[
          { label: 'On-Net', key: 'on-net', color: T.green },
          { label: 'Near-Net', key: 'near-net', color: T.yellow },
          { label: 'Off-Net', key: 'off-net', color: T.red },
        ].map(s => (
          <div key={s.key} className="flex items-center gap-1.5 bg-revos-surface rounded-lg px-3 py-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}60` }} />
            <span className="font-sans text-[10px] text-revos-text-mid">{s.label}</span>
            <span className="font-mono text-[11px] font-bold" style={{ color: s.color }}>{counts[s.key] || 0}</span>
          </div>
        ))}
      </div>

      {/* Location rows */}
      <div className="max-h-60 overflow-y-auto">
        {locations.map((l, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5 border-b border-revos-border last:border-b-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor(l.status), boxShadow: `0 0 6px ${statusColor(l.status)}50` }} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-revos-text font-medium truncate">{l.name || l.address || 'Unknown'}</div>
              {l.address && l.name && <div className="text-[9px] text-revos-text-dim truncate">{l.address}</div>}
              {l.type && <span className="text-[8px] text-revos-text-dim font-mono">{l.type}</span>}
            </div>
            <span className="font-mono text-[9px] shrink-0" style={{ color: statusColor(l.status) }}>{l.status}</span>
            {l.mrr > 0 && <span className="font-mono text-[9px] text-revos-cyan shrink-0">{$k(l.mrr)}/mo</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Active Deals ---
function ActiveDeals({ deals }) {
  if (!deals || deals.length === 0) {
    return <div className="font-mono text-[10px] text-revos-text-dim text-center py-4">No active deals</div>
  }

  return (
    <div>
      {deals.map((d, i) => {
        const stageColor = STAGE_COLORS[d.stage] || T.textDim
        return (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5 border-b border-revos-border last:border-b-0" style={{ background: i % 2 === 0 ? 'transparent' : `${T.surface}40` }}>
            <GlowBadge color={stageColor} className="text-[8px] px-1.5 py-[1px] shrink-0">{d.stage}</GlowBadge>
            <span className="flex-1 text-[11px] font-semibold text-revos-text truncate">{d.product}</span>
            <span className="font-mono text-[10px] text-revos-cyan shrink-0">{$k(d.mrr)}/mo</span>
            {d.close && <span className="font-mono text-[9px] text-revos-text-dim shrink-0">{d.close}</span>}
          </div>
        )
      })}
    </div>
  )
}

export default memo(function Overview({ a }) {
  const stages = ['Discover', 'Design', 'Propose', 'Negotiate']
  const stageC = STAGE_COLORS

  const healthScore = a.health ?? a.risk_score ?? 0
  const healthColor = healthScore >= 70 ? T.green : healthScore >= 40 ? T.yellow : T.red

  return (
    <div>
      {/* Top stats — 4 KPIs */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: 'TOTAL TMR', value: $(a.tmr), color: T.cyan, spark: SPARK_TMR, sparkColor: T.cyan },
          { label: 'PIPELINE', value: `${$k(a.pipeline_mrr)}/mo`, sub: `${a.pipeline_count} deals`, color: a.pipeline_mrr > 0 ? T.purple : T.textDim, spark: SPARK_PIPE, sparkColor: T.purple },
          { label: 'WIN RATE', value: pc(a.win_rate), sub: `${a.won}W / ${a.lost}L`, color: a.win_rate > 0.7 ? T.green : a.win_rate > 0.4 ? T.yellow : T.red, spark: SPARK_WIN, sparkColor: T.green },
          { label: 'HEALTH', value: `${healthScore}/100`, sub: (a.health_level ?? a.risk_level), color: healthColor, ring: healthScore, ringColor: healthColor },
        ].map((s, i) => (
          <SpotlightCard
            key={s.label}
            className="opacity-0 animate-fade-slide-in"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="px-3 py-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Stat label={s.label} value={s.value} sub={s.sub} color={s.color} bare />
              </div>
              {s.ring != null ? (
                <ProgressRing value={s.ring} size={40} color={s.ringColor} strokeWidth={3} />
              ) : s.spark ? (
                <Sparkline data={s.spark} color={s.sparkColor} width={64} height={24} />
              ) : null}
            </div>
          </SpotlightCard>
        ))}
      </div>

      {/* Active Deals section */}
      <Section
        title="Active Deals"
        color={T.blue}
        count={a.active_deals?.length > 0 ? `${a.active_deals.length} deals · ${$k(a.pipeline_mrr)}/mo` : '0 deals'}
        defaultOpen={true}
      >
        <ActiveDeals deals={a.active_deals} />
      </Section>

      {/* Pipeline + Health side by side */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-revos-card rounded-xl shadow-card p-3.5">
          <div className="font-sans text-[10px] text-revos-text-dim tracking-wide mb-3">
            <Tip label="PIPELINE BY STAGE">PIPELINE BY STAGE</Tip>
          </div>
          <div className="flex gap-1.5 items-end h-[70px]">
            {stages.map((st) => {
              const d = a.pipeline_by_stage?.[st]
              const mx = Math.max(...Object.values(a.pipeline_by_stage || {}).map((x) => x.mrr), 1)
              const h = d ? Math.max(6, (d.mrr / mx) * 60) : 3
              return (
                <div key={st} className="flex-1 flex flex-col items-center gap-[3px]">
                  <div className="font-mono text-[10px] font-semibold" style={{ color: stageC[st] || T.textDim }}>
                    {d ? $k(d.mrr) : '$0'}
                  </div>
                  <div className="w-full rounded-[3px]" style={{ height: `${h}px`, background: d ? `${stageC[st] || T.textDim}35` : T.border }} />
                  <div className="font-mono text-[8px] text-revos-text-dim">
                    {st} {d ? `(${d.count})` : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <AnimatedBorderCard className={cn('bg-revos-card rounded-xl shadow-card p-3.5')} borderColor={healthScore < 40 ? T.red : T.accent}>
          <div className={cn('font-sans text-[10px] tracking-wide mb-2.5', healthScore < 40 ? 'text-revos-red' : 'text-revos-text-dim')}>
            <Tip label="ACCOUNT HEALTH">ACCOUNT HEALTH</Tip>
          </div>
          {a.health_factors ? (
            <div className="flex flex-col gap-[5px]">
              {[
                { label: 'Churn Penalty', value: -a.health_factors.churnPenalty, max: 20, color: T.red },
                { label: 'Product Diversity', value: a.health_factors.productDiversity, max: 15, color: T.teal },
                { label: 'Pipeline Bonus', value: a.health_factors.pipelineBonus, max: 15, color: T.blue },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-1.5">
                  <div className="font-mono text-[9px] text-revos-text-dim w-[100px] shrink-0">{f.label}</div>
                  <div className="flex-1 h-[5px] rounded-[3px] overflow-hidden" style={{ background: T.border }}>
                    <div className="h-full rounded-[3px]" style={{ width: `${Math.max(0, (Math.abs(f.value) / f.max) * 100)}%`, background: f.color }} />
                  </div>
                  <div className="font-mono text-[9px] font-semibold w-7 text-right" style={{ color: f.value < 0 ? T.red : f.color }}>{f.value > 0 ? '+' : ''}{f.value}</div>
                </div>
              ))}
              <div className={cn('font-mono text-[10px] font-bold text-right mt-1', healthScore >= 70 ? 'text-revos-green' : healthScore >= 40 ? 'text-revos-yellow' : 'text-revos-red')}>
                = {healthScore}/100 {(a.health_level ?? a.risk_level).toUpperCase()}
              </div>
            </div>
          ) : (
            <div className="flex gap-[5px] flex-wrap">
              {[
                a.days_silent > 90 && `${a.days_silent}d silent`,
                a.lost > 2 && `${a.lost} losses`,
                a.disconnects > 0 && `${a.disconnects} disconnects`,
              ]
                .filter(Boolean)
                .map((r, i) => (
                  <Badge key={i} color={T.red}>{r}</Badge>
                ))}
            </div>
          )}
        </AnimatedBorderCard>
      </div>

      {/* Services section */}
      <Section
        title="Services"
        color={T.teal}
        count={a.services?.length > 0 ? `${a.services.length} active` : a.products?.length > 0 ? `${a.products.length} products` : undefined}
        defaultOpen={false}
      >
        {a.services?.length > 0 ? (
          <ServicesTable services={a.services} />
        ) : a.products?.length > 0 ? (
          /* Fallback: derive from products array + concentration */
          <ServicesTable services={a.products.map(p => ({
            product: p,
            mrr: a.concentration?.[p]?.mrr || 0,
            expDate: '',
            term: '',
          }))} />
        ) : (
          <div className="font-mono text-[10px] text-revos-text-dim text-center py-4">No services data — upload services CSV to populate</div>
        )}
      </Section>

      {/* Locations section */}
      <Section
        title="Locations"
        color={T.green}
        count={a.locations?.length > 0 ? `${a.locations.length} sites` : undefined}
        defaultOpen={false}
      >
        <LocationsList locations={a.locations} />
      </Section>

      {/* Engagement Timeline */}
      {a.engagement && (
        <div className="bg-revos-card rounded-xl shadow-card p-3.5 mb-3">
          <div className="flex justify-between items-center mb-3">
            <div className="font-sans text-[10px] text-revos-text-dim tracking-wide">
              <Tip label="ENGAGEMENT TIMELINE">ENGAGEMENT TIMELINE</Tip>
            </div>
            <div className="flex gap-2.5 items-center">
              <div className="flex gap-[5px]">
                {Object.entries(a.engagement.byType).sort(([,a],[,b]) => b - a).slice(0, 5).map(([type, count]) => (
                  <span key={type} className="font-mono text-[8px] px-1.5 py-0.5 rounded-[3px]" style={{ background: T.surface, color: T.textMid }}>
                    {type.toUpperCase()} {count}
                  </span>
                ))}
              </div>
              <span className="font-mono text-[9px] text-revos-cyan font-semibold">
                {a.engagement.total} total · {a.engagement.contacts} contacts
              </span>
            </div>
          </div>

          {/* Monthly bar chart */}
          {a.engagement.timeline && a.engagement.timeline.length > 0 && (
            <div className="mb-3">
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={a.engagement.timeline} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="month" tick={{ fontFamily: 'var(--font-mono)', fontSize: 7, fill: T.textDim }} tickLine={false} axisLine={{ stroke: T.border }} />
                  <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} width={20} />
                  <Tooltip contentStyle={chartTheme.tooltip} />
                  <Bar dataKey="count" fill={T.purple} opacity={0.8} name="Engagements" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Rolling event timeline */}
          {a.engagement.events && a.engagement.events.length > 0 ? (
            <div className="max-h-60 overflow-y-auto">
              {a.engagement.events.map((ev, i) => {
                const typeColors = { call: T.green, email: T.blue, meeting: T.purple, demo: T.pink, social: T.cyan, text: T.yellow, note: T.textDim, other: T.textDim }
                const color = typeColors[ev.t] || T.textDim
                return (
                  <div key={i} className="grid grid-cols-[70px_60px_1fr] gap-2 items-center px-2 py-[5px] rounded-r mb-px" style={{ borderLeft: `2px solid ${color}`, background: i % 2 === 0 ? T.surface : 'transparent' }}>
                    <span className="font-mono text-[9px] text-revos-text-dim">{ev.d}</span>
                    <span className="font-mono text-[8px] font-semibold uppercase" style={{ color }}>{ev.t}</span>
                    <div className="min-w-0">
                      <div className="text-[11px] text-revos-text whitespace-nowrap overflow-hidden text-ellipsis">
                        {ev.s}
                      </div>
                      {ev.c && <span className="font-mono text-[8px]" style={{ color: T.textMid }}>{ev.c}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="font-mono text-[10px] text-revos-text-dim text-center py-5">
              No event detail — rebuild engagement JSON to populate
            </div>
          )}
        </div>
      )}

      {/* Product Mix */}
      <div className="bg-revos-card rounded-xl shadow-card p-3.5">
        <div className="font-sans text-[10px] text-revos-text-dim tracking-wide mb-2.5">
          <Tip label="PRODUCT MIX">PRODUCT MIX</Tip>
        </div>
        <div className="flex gap-2">
          {Object.entries(a.concentration).map(([p, d]) => (
            <div key={p} className="flex-1 p-2 rounded-md" style={{ background: T.surface }}>
              <div className="text-[11px] font-semibold mb-1">{p}</div>
              <div className="font-mono text-[13px] font-bold text-revos-cyan">{$k(d.mrr)}/mo</div>
              <ProbBar value={d.pct} color={T.cyan} h={4} />
              <div className="font-mono text-[8px] mt-0.5" style={{ color: T.textMid }}>{pc(d.pct)} of revenue</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})
