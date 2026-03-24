import { useState, memo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { T } from '../lib/constants'
import { cn } from '@/lib/utils'
import Stat from '../components/shared/Stat'
import Badge from '../components/shared/Badge'
import Tip from '../components/shared/Tip'
import { chartTheme, $k, pc } from '../components/shared/ChartTheme'

export default memo(function Backtest({ a, backtestResults }) {
  const bt = a.backtest
  const [selQ, setSelQ] = useState(0)

  // If no per-account backtest data but engine results exist, show engine summary
  if (!bt?.length && backtestResults) {
    const best = backtestResults.B.auc >= backtestResults.A.auc ? 'B' : 'A'
    const m = backtestResults[best]
    return (
      <div>
        <div className="rounded-lg p-4 mb-3.5" style={{ background: `linear-gradient(135deg, ${T.purple}10, ${T.cyan}08)`, border: `1px solid ${T.purple}30` }}>
          <div className="font-mono text-[10px] text-revos-purple mb-2 tracking-wide">ENGINE BACKTEST RESULTS (SESSION)</div>
          <div className="font-mono text-[11px] text-revos-text-mid">
            Model {best} selected · {backtestResults.trainSize} train / {backtestResults.testSize} test deals · {backtestResults.verticalModelCount} vertical models
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3.5">
          <Stat label="ACCURACY" value={pc(m.acc)} color={m.acc >= 0.6 ? T.green : T.yellow} />
          <Stat label="AUC" value={m.auc.toFixed(3)} color={m.auc >= 0.65 ? T.green : T.yellow} />
          <Stat label="BRIER SCORE" value={m.brier.toFixed(3)} color={m.brier <= 0.25 ? T.green : T.yellow} />
          <Stat label="BASE WIN RATE" value={pc(backtestResults.overallWinRate)} color={T.cyan} />
        </div>
        {backtestResults.byVertical?.length > 0 && (
          <div className="bg-revos-card border border-revos-border rounded-lg p-3.5">
            <div className="font-mono text-[9px] text-revos-text-dim mb-2 tracking-wide">BY VERTICAL</div>
            {backtestResults.byVertical.map(v => (
              <div key={v.vertical} className="flex justify-between py-1 border-b border-revos-border">
                <span className="font-mono text-[11px]">{v.vertical}</span>
                <span className="font-mono text-[10px] text-revos-text-mid">{v.count} deals · WR {pc(v.winRate)} · AUC {v[`auc${best}`].toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!bt?.length) return null

  const avg = Math.round(bt.reduce((s, b) => s + b.score, 0) / bt.length)
  const outcomeHits = bt.filter((b) => b.predicted.outcome === b.actual.outcome).length

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-3.5">
        <Stat label="AVG ACCURACY" value={`${avg}%`} color={avg >= 60 ? T.green : T.yellow} />
        <Stat label="OUTCOME HIT" value={`${outcomeHits}/${bt.length}`} color={T.cyan} />
        <Stat label="QUARTERS TESTED" value={bt.length} color={T.purple} />
      </div>

      {/* Chart */}
      <div className="bg-revos-card border border-revos-border rounded-lg p-3.5 mb-3.5">
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={bt.map((b) => ({ q: b.q, won: b.actual.won_mrr, lost: -(b.actual.lost_mrr || 0), acc: b.score }))}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="q" tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fill: T.textDim }} tickLine={false} />
            <YAxis yAxisId="m" tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fill: T.textDim }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <YAxis yAxisId="a" orientation="right" domain={[0, 100]} tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fill: T.purple }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={chartTheme.tooltip} />
            <ReferenceLine y={0} yAxisId="m" stroke={T.borderLight} />
            <Bar yAxisId="m" dataKey="won" fill={T.green} opacity={0.6} radius={[2, 2, 0, 0]} />
            <Bar yAxisId="m" dataKey="lost" fill={T.red} opacity={0.6} radius={[0, 0, 2, 2]} />
            <Line yAxisId="a" type="monotone" dataKey="acc" stroke={T.purple} strokeWidth={2} dot={{ fill: T.purple, r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Quarter detail */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: '220px 1fr' }}>
        <div>
          {bt.map((b, i) => {
            const sc = b.score >= 80 ? T.green : b.score >= 50 ? T.yellow : T.red
            return (
              <div
                key={i}
                onClick={() => setSelQ(i)}
                className={cn(
                  'px-2.5 py-2 cursor-pointer border-b border-revos-border',
                  i === selQ ? 'bg-revos-card-hover' : 'bg-transparent'
                )}
                style={{ borderLeft: `3px solid ${i === selQ ? T.purple : 'transparent'}` }}
              >
                <div className="flex justify-between">
                  <span className="font-mono text-[11px] font-semibold">{b.q}</span>
                  <Badge color={sc}>{b.score}%</Badge>
                </div>
                <div className="font-mono text-[9px] text-revos-text-dim">
                  Actual: {b.actual.outcome} · AI: {b.predicted.outcome}
                </div>
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {/* AI predicted */}
          <div className="bg-revos-card rounded-lg p-3.5" style={{ border: `1px solid ${T.purple}30`, borderTop: `3px solid ${T.purple}` }}>
            <div className="font-mono text-[9px] text-revos-purple mb-2"><Tip label="AI PREDICTED">AI PREDICTED</Tip></div>
            <Badge color={T.purple}>{bt[selQ].predicted.outcome?.toUpperCase()}</Badge>
            <div className="mt-1.5">
              <Badge color={bt[selQ].predicted.churn === 'high' ? T.red : bt[selQ].predicted.churn === 'medium' ? T.orange : T.green}>
                CHURN: {bt[selQ].predicted.churn?.toUpperCase()}
              </Badge>
            </div>
            <div className="font-mono text-[10px] text-revos-text-dim mt-1.5">
              {pc(bt[selQ].predicted.confidence)} confidence
            </div>
          </div>

          {/* Actual */}
          <div className="bg-revos-card border border-revos-border rounded-lg p-3.5" style={{ borderTop: `3px solid ${bt[selQ].actual.net >= 0 ? T.green : T.red}` }}>
            <div className="font-mono text-[9px] mb-2" style={{ color: bt[selQ].actual.net >= 0 ? T.green : T.red }}><Tip label="ACTUAL">ACTUAL</Tip></div>
            <Badge color={bt[selQ].actual.outcome === 'expanded' ? T.green : bt[selQ].actual.outcome.includes('churn') ? T.red : T.yellow}>
              {bt[selQ].actual.outcome?.toUpperCase()}
            </Badge>
            <div className="flex gap-1.5 mt-2">
              <div className="flex-1 p-1.5 bg-revos-surface rounded">
                <div className="font-mono text-[7px] text-revos-green">WON</div>
                <div className="font-mono text-sm font-bold text-revos-green">{$k(bt[selQ].actual.won_mrr)}</div>
              </div>
              <div className="flex-1 p-1.5 bg-revos-surface rounded">
                <div className="font-mono text-[7px] text-revos-red">LOST</div>
                <div className="font-mono text-sm font-bold text-revos-red">{$k(bt[selQ].actual.lost_mrr)}</div>
              </div>
            </div>
            <div className="mt-1.5 p-1.5 rounded" style={{ background: bt[selQ].actual.net >= 0 ? `${T.green}12` : `${T.red}12` }}>
              <div className="font-mono text-[15px] font-bold" style={{ color: bt[selQ].actual.net >= 0 ? T.green : T.red }}>
                {bt[selQ].actual.net >= 0 ? '+' : ''}{$k(bt[selQ].actual.net)} NET
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
