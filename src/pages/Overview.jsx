import { memo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { T, FONT_MONO, FONT_SANS, STAGE_COLORS, RADIUS, CARD_SHADOW } from '../lib/constants'
import Stat from '../components/shared/Stat'
import Badge from '../components/shared/Badge'
import ProbBar from '../components/shared/ProbBar'
import Tip from '../components/shared/Tip'
import { chartTheme, $, $k, pc } from '../components/shared/ChartTheme'

export default memo(function Overview({ a }) {
  const stages = ['Discover', 'Design', 'Propose', 'Negotiate']
  const stageC = STAGE_COLORS

  return (
    <div>
      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '16px' }}>
        <Stat label="TOTAL ARR" value={$(a.arr)} color={T.cyan} />
        <Stat label="PIPELINE" value={`${$k(a.pipeline_mrr)}/mo`} sub={`${a.pipeline_count} deals`} color={T.blue} />
        <Stat label="WIN RATE" value={pc(a.win_rate)} sub={`${a.won}W / ${a.lost}L`} color={a.win_rate > 0.7 ? T.green : T.yellow} />
        <Stat label="LOST MRR" value={$(a.lost_mrr)} sub={`${a.lost} deals`} color={T.red} />
        <Stat label="NRR" value={pc(a.nrr)} color={a.nrr >= 1 ? T.green : a.nrr >= 0.9 ? T.yellow : T.red} />
        <Stat label="HEALTH" value={`${a.health ?? a.risk_score}/100`} sub={a.health_level ?? a.risk_level} color={(a.health ?? a.risk_score) >= 70 ? T.green : (a.health ?? a.risk_score) >= 40 ? T.yellow : T.red} />
      </div>

      {/* Pipeline + Risk */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '12px' }}>
            <Tip label="PIPELINE BY STAGE">PIPELINE BY STAGE</Tip>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '70px' }}>
            {stages.map((st) => {
              const d = a.pipeline_by_stage?.[st]
              const mx = Math.max(...Object.values(a.pipeline_by_stage || {}).map((x) => x.mrr), 1)
              const h = d ? Math.max(6, (d.mrr / mx) * 60) : 3
              return (
                <div key={st} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 600, color: stageC[st] || T.textDim }}>
                    {d ? $k(d.mrr) : '$0'}
                  </div>
                  <div style={{ width: '100%', height: `${h}px`, borderRadius: '3px', background: d ? `${stageC[st] || T.textDim}35` : T.border }} />
                  <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textDim }}>
                    {st} {d ? `(${d.count})` : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, border: (a.health ?? a.risk_score) < 40 ? `1px solid ${T.red}30` : 'none', padding: '14px' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: (a.health ?? a.risk_score) < 40 ? T.red : T.textDim, letterSpacing: '0.04em', marginBottom: '10px' }}>
            <Tip label="ACCOUNT HEALTH">ACCOUNT HEALTH</Tip>
          </div>
          {a.health_factors ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[
                { label: 'NRR Score', value: a.health_factors.nrrScore, max: 40, color: T.green },
                { label: 'Churn Penalty', value: -a.health_factors.churnPenalty, max: 20, color: T.red },
                { label: 'Product Diversity', value: a.health_factors.productDiversity, max: 15, color: T.teal },
                { label: 'Pipeline Bonus', value: a.health_factors.pipelineBonus, max: 15, color: T.blue },
                { label: 'Tenure Score', value: a.health_factors.tenureScore, max: 10, color: T.purple },
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim, width: '100px', flexShrink: 0 }}>{f.label}</div>
                  <div style={{ flex: 1, height: '5px', background: T.border, borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(0, (Math.abs(f.value) / f.max) * 100)}%`, height: '100%', borderRadius: '3px', background: f.color }} />
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '9px', fontWeight: 600, color: f.value < 0 ? T.red : f.color, width: '28px', textAlign: 'right' }}>{f.value > 0 ? '+' : ''}{f.value}</div>
                </div>
              ))}
              <div style={{ fontFamily: FONT_MONO, fontSize: '10px', fontWeight: 700, color: (a.health ?? a.risk_score) >= 70 ? T.green : (a.health ?? a.risk_score) >= 40 ? T.yellow : T.red, textAlign: 'right', marginTop: '4px' }}>
                = {a.health ?? a.risk_score}/100 {(a.health_level ?? a.risk_level).toUpperCase()}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {[
                a.days_silent > 90 && `${a.days_silent}d silent`,
                a.lost > 2 && `${a.lost} losses`,
                a.disconnects > 0 && `${a.disconnects} disconnects`,
                a.nrr < 0.9 && `NRR ${pc(a.nrr)}`,
              ]
                .filter(Boolean)
                .map((r, i) => (
                  <Badge key={i} color={T.red}>{r}</Badge>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Engagement Timeline */}
      {a.engagement && (
        <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em' }}>
              <Tip label="ENGAGEMENT TIMELINE">ENGAGEMENT TIMELINE</Tip>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '5px' }}>
                {Object.entries(a.engagement.byType).sort(([,a],[,b]) => b - a).slice(0, 5).map(([type, count]) => (
                  <span key={type} style={{
                    fontFamily: FONT_MONO, fontSize: '8px', padding: '2px 6px',
                    background: T.surface, borderRadius: '3px', color: T.textMid,
                  }}>
                    {type.toUpperCase()} {count}
                  </span>
                ))}
              </div>
              <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.cyan, fontWeight: 600 }}>
                {a.engagement.total} total · {a.engagement.contacts} contacts
              </span>
            </div>
          </div>

          {/* Monthly bar chart */}
          {a.engagement.timeline && a.engagement.timeline.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={a.engagement.timeline} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="month" tick={{ fontFamily: FONT_MONO, fontSize: 7, fill: T.textDim }} tickLine={false} axisLine={{ stroke: T.border }} />
                  <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} width={20} />
                  <Tooltip contentStyle={chartTheme.tooltip} />
                  <Bar dataKey="count" fill={T.purple} opacity={0.8} name="Engagements" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Rolling event timeline */}
          {a.engagement.events && a.engagement.events.length > 0 ? (
            <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {a.engagement.events.map((ev, i) => {
                const typeColors = { call: T.green, email: T.blue, meeting: T.purple, demo: T.pink, social: T.cyan, text: T.yellow, note: T.textDim, other: T.textDim }
                const color = typeColors[ev.t] || T.textDim
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '70px 60px 1fr',
                    gap: '8px', alignItems: 'center',
                    padding: '5px 8px', borderLeft: `2px solid ${color}`,
                    marginBottom: '1px', background: i % 2 === 0 ? T.surface : 'transparent',
                    borderRadius: '0 4px 4px 0',
                  }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>{ev.d}</span>
                    <span style={{
                      fontFamily: FONT_MONO, fontSize: '8px', fontWeight: 600,
                      color, textTransform: 'uppercase',
                    }}>{ev.t}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.s}
                      </div>
                      {ev.c && <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textMid }}>{ev.c}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim, textAlign: 'center', padding: '20px 0' }}>
              No event detail — rebuild engagement JSON to populate
            </div>
          )}
        </div>
      )}

      {/* Product Mix */}
      <div style={{ background: T.card, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: '14px' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: '10px', color: T.textDim, letterSpacing: '0.04em', marginBottom: '10px' }}>
          <Tip label="PRODUCT MIX">PRODUCT MIX</Tip>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {Object.entries(a.concentration).map(([p, d]) => (
            <div key={p} style={{ flex: 1, padding: '8px', background: T.surface, borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>{p}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '13px', fontWeight: 700, color: T.cyan }}>{$k(d.mrr)}/mo</div>
              <ProbBar value={d.pct} color={T.cyan} h={4} />
              <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: T.textMid, marginTop: '2px' }}>{pc(d.pct)} of revenue</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})
