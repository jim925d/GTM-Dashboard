import { useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { T, FONT_MONO } from '../lib/constants'
import Stat from '../components/shared/Stat'
import Badge from '../components/shared/Badge'
import Tip from '../components/shared/Tip'
import { chartTheme, $k, pc } from '../components/shared/ChartTheme'

export default function Backtest({ a }) {
  const bt = a.backtest
  if (!bt?.length) return null

  const [selQ, setSelQ] = useState(0)
  const avg = Math.round(bt.reduce((s, b) => s + b.score, 0) / bt.length)
  const outcomeHits = bt.filter((b) => b.predicted.outcome === b.actual.outcome).length

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
        <Stat label="AVG ACCURACY" value={`${avg}%`} color={avg >= 60 ? T.green : T.yellow} />
        <Stat label="OUTCOME HIT" value={`${outcomeHits}/${bt.length}`} color={T.cyan} />
        <Stat label="QUARTERS TESTED" value={bt.length} color={T.purple} />
      </div>

      {/* Chart */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={bt.map((b) => ({ q: b.q, won: b.actual.won_mrr, lost: -(b.actual.lost_mrr || 0), acc: b.score }))}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="q" tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} tickLine={false} />
            <YAxis yAxisId="m" tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <YAxis yAxisId="a" orientation="right" domain={[0, 100]} tick={{ fontFamily: FONT_MONO, fontSize: 8, fill: T.purple }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={chartTheme.tooltip} />
            <ReferenceLine y={0} yAxisId="m" stroke={T.borderLight} />
            <Bar yAxisId="m" dataKey="won" fill={T.green} opacity={0.6} radius={[2, 2, 0, 0]} />
            <Bar yAxisId="m" dataKey="lost" fill={T.red} opacity={0.6} radius={[0, 0, 2, 2]} />
            <Line yAxisId="a" type="monotone" dataKey="acc" stroke={T.purple} strokeWidth={2} dot={{ fill: T.purple, r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Quarter detail */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '10px' }}>
        <div>
          {bt.map((b, i) => {
            const sc = b.score >= 80 ? T.green : b.score >= 50 ? T.yellow : T.red
            return (
              <div
                key={i}
                onClick={() => setSelQ(i)}
                style={{
                  padding: '8px 10px',
                  cursor: 'pointer',
                  borderBottom: `1px solid ${T.border}`,
                  borderLeft: `3px solid ${i === selQ ? T.purple : 'transparent'}`,
                  background: i === selQ ? T.cardHover : 'transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 600 }}>{b.q}</span>
                  <Badge color={sc}>{b.score}%</Badge>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>
                  Actual: {b.actual.outcome} · AI: {b.predicted.outcome}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {/* AI predicted */}
          <div style={{ background: T.card, border: `1px solid ${T.purple}30`, borderRadius: '8px', padding: '14px', borderTop: `3px solid ${T.purple}` }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.purple, marginBottom: '8px' }}><Tip label="AI PREDICTED">AI PREDICTED</Tip></div>
            <Badge color={T.purple}>{bt[selQ].predicted.outcome?.toUpperCase()}</Badge>
            <div style={{ marginTop: '6px' }}>
              <Badge color={bt[selQ].predicted.churn === 'high' ? T.red : bt[selQ].predicted.churn === 'medium' ? T.orange : T.green}>
                CHURN: {bt[selQ].predicted.churn?.toUpperCase()}
              </Badge>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: T.textDim, marginTop: '6px' }}>
              {pc(bt[selQ].predicted.confidence)} confidence
            </div>
          </div>

          {/* Actual */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', padding: '14px', borderTop: `3px solid ${bt[selQ].actual.net >= 0 ? T.green : T.red}` }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: bt[selQ].actual.net >= 0 ? T.green : T.red, marginBottom: '8px' }}><Tip label="ACTUAL">ACTUAL</Tip></div>
            <Badge color={bt[selQ].actual.outcome === 'expanded' ? T.green : bt[selQ].actual.outcome.includes('churn') ? T.red : T.yellow}>
              {bt[selQ].actual.outcome?.toUpperCase()}
            </Badge>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <div style={{ flex: 1, padding: '6px', background: T.surface, borderRadius: '4px' }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: '7px', color: T.green }}>WON</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 700, color: T.green }}>{$k(bt[selQ].actual.won_mrr)}</div>
              </div>
              <div style={{ flex: 1, padding: '6px', background: T.surface, borderRadius: '4px' }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: '7px', color: T.red }}>LOST</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 700, color: T.red }}>{$k(bt[selQ].actual.lost_mrr)}</div>
              </div>
            </div>
            <div style={{ marginTop: '6px', padding: '6px', background: bt[selQ].actual.net >= 0 ? `${T.green}12` : `${T.red}12`, borderRadius: '4px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: '15px', fontWeight: 700, color: bt[selQ].actual.net >= 0 ? T.green : T.red }}>
                {bt[selQ].actual.net >= 0 ? '+' : ''}{$k(bt[selQ].actual.net)} NET
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
