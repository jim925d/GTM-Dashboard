import { memo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { T } from '../lib/constants'
import Stat from '../components/shared/Stat'
import Tip from '../components/shared/Tip'
import { chartTheme } from '../components/shared/ChartTheme'

export default memo(function Learning({ a }) {
  const lc = a.learning
  if (!lc?.length) return null

  const above80 = lc.find((d) => d.accuracy >= 80)
  const best = lc.reduce((a, b) => (a.accuracy > b.accuracy ? a : b), lc[0])

  return (
    <div>
      {/* Chart */}
      <div className="bg-revos-card border border-revos-border rounded-lg p-4 mb-4">
        <div className="font-mono text-[9px] text-revos-text-dim tracking-wide mb-3.5">
          <Tip label="ACCURACY vs. TRAINING DATA VOLUME">ACCURACY vs. TRAINING DATA VOLUME</Tip>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={lc} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis
              dataKey="deals"
              tick={{ fontFamily: "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace", fontSize: 10, fill: T.textDim }}
              label={{ value: 'Deals in Training Set', position: 'insideBottom', offset: -2, style: { fontFamily: "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace", fontSize: 10, fill: T.textDim } }}
            />
            <YAxis domain={[0, 100]} tick={{ fontFamily: "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace", fontSize: 10, fill: T.textDim }} tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={chartTheme.tooltip} formatter={(v, n) => [`${v}%`, n]} />
            <Legend wrapperStyle={{ fontFamily: "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace", fontSize: 10 }} />
            <Line type="monotone" dataKey="accuracy" stroke={T.cyan} strokeWidth={3} dot={{ fill: T.cyan, r: 4 }} name="Overall" />
            <Line type="monotone" dataKey="churn" stroke={T.red} strokeWidth={2} dot={{ fill: T.red, r: 3 }} name="Churn Detection" strokeDasharray="5 5" />
            <Line type="monotone" dataKey="expand" stroke={T.green} strokeWidth={2} dot={{ fill: T.green, r: 3 }} name="Expansion" strokeDasharray="5 5" />
            <Line type="monotone" dataKey="outcome" stroke={T.purple} strokeWidth={2} dot={{ fill: T.purple, r: 3 }} name="Outcome Match" />
            <ReferenceLine
              y={80}
              stroke={T.lime}
              strokeDasharray="8 4"
              label={{ value: '80% Target', position: 'right', style: { fontFamily: "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace", fontSize: 9, fill: T.lime } }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <Stat label="MIN VIABLE DATASET" value={above80 ? `${above80.deals} deals` : 'TBD'} color={above80 ? T.green : T.yellow} />
        <Stat label="PEAK ACCURACY" value={`${best.accuracy}%`} sub={`at ${best.deals} deals`} color={T.cyan} />
        <Stat
          label="TREND"
          value={lc.length >= 2 && lc[lc.length - 1].accuracy > lc[lc.length - 2].accuracy ? '↗ Improving' : '→ Plateau'}
          color={T.green}
        />
      </div>

      {/* Analysis */}
      <div style={{ background: `${T.lime}08`, border: `1px solid ${T.lime}22` }} className="rounded-lg p-3.5">
        <div className="font-mono text-[9px] tracking-wide mb-1.5" style={{ color: T.lime }}>
          <Tip label="DATA EFFICIENCY ANALYSIS">DATA EFFICIENCY ANALYSIS</Tip>
        </div>
        <div className="text-[13px] text-revos-text leading-[1.7]">
          {above80 ? (
            <>
              <span className="font-bold text-revos-green">80% accuracy reached at {above80.deals} deals.</span> This is the minimum viable
              dataset. Peak accuracy of {best.accuracy}% at {best.deals} deals. Beyond this point, additional data yields diminishing returns — focus
              shifts to data quality (richer loss/churn detail) rather than volume.
            </>
          ) : (
            <>
              <span className="font-bold text-revos-yellow">80% accuracy not yet reached.</span> Current best is {best.accuracy}% at{' '}
              {best.deals} deals. The curve is still rising — more historical data will improve predictions. Target: 2+ years of deal history including
              losses and disconnects.
            </>
          )}
        </div>
      </div>
    </div>
  )
})
