import { V2, V2_FONTS } from '../tokens'

export default function V2Forecast() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: V2_FONTS.serif,
            fontSize: 28,
            fontWeight: 400,
            marginBottom: 6,
          }}
        >
          Forecast
        </h1>
        <p style={{ fontSize: 13, color: V2.textDim }}>
          Revenue forecasting with confidence intervals and scenario modeling.
        </p>
      </div>

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 32,
        }}
      >
        {[
          { label: 'FORECAST TMR', value: '--', sub: 'stage-weighted' },
          { label: 'COMMIT', value: '--', sub: 'high confidence' },
          { label: 'BEST CASE', value: '--', sub: 'upside included' },
          { label: 'ATTAINMENT', value: '--%', sub: 'vs quota' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              background: V2.surface,
              border: `1px solid ${V2.border}`,
              borderRadius: V2.radiusSm,
              padding: '16px 20px',
            }}
          >
            <div
              style={{
                fontFamily: V2_FONTS.mono,
                fontSize: 10,
                color: V2.textDim,
                letterSpacing: '0.06em',
                marginBottom: 8,
              }}
            >
              {kpi.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: V2.textMid, marginBottom: 4 }}>
              {kpi.value}
            </div>
            <div style={{ fontFamily: V2_FONTS.mono, fontSize: 10, color: V2.textDim }}>
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div
        style={{
          background: V2.surface,
          border: `1px solid ${V2.border}`,
          borderRadius: V2.radiusLg,
          padding: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 320,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>&#128200;</div>
          <div style={{ fontSize: 14, color: V2.textDim, marginBottom: 4 }}>
            Forecast waterfall with confidence bands
          </div>
          <div
            style={{
              fontFamily: V2_FONTS.mono,
              fontSize: 10,
              color: V2.accent,
              letterSpacing: '0.08em',
            }}
          >
            WILL CONNECT TO SHARED DATA HOOKS
          </div>
        </div>
      </div>
    </div>
  )
}
