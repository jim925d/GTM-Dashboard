import { V2, V2_FONTS } from '../tokens'

export default function V2Pipeline() {
  const stages = ['Discover', 'Design', 'Propose', 'Negotiate', 'Closed Won']

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
          Pipeline
        </h1>
        <p style={{ fontSize: 13, color: V2.textDim }}>
          Deal flow, stage progression, and pipeline health analytics.
        </p>
      </div>

      {/* Stage funnel placeholder */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 32,
        }}
      >
        {stages.map((stage, i) => (
          <div
            key={stage}
            style={{
              flex: 1,
              background: V2.surface,
              border: `1px solid ${V2.border}`,
              borderRadius: V2.radiusSm,
              padding: '16px 12px',
              textAlign: 'center',
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
              {stage.toUpperCase()}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: V2.textMid,
              }}
            >
              --
            </div>
            <div
              style={{
                fontFamily: V2_FONTS.mono,
                fontSize: 10,
                color: V2.textDim,
                marginTop: 4,
              }}
            >
              deals
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder chart area */}
      <div
        style={{
          background: V2.surface,
          border: `1px solid ${V2.border}`,
          borderRadius: V2.radiusLg,
          padding: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>&#128202;</div>
          <div style={{ fontSize: 14, color: V2.textDim, marginBottom: 4 }}>
            Pipeline waterfall chart
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
