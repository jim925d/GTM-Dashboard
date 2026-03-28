import { V2, V2_FONTS } from '../tokens'

export default function V2TargetList() {
  const columns = ['Account', 'Premier Score', 'Churn Risk', 'Pipeline', 'Last Engagement', 'Action']

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
          Targets
        </h1>
        <p style={{ fontSize: 13, color: V2.textDim }}>
          Priority-ranked account target list with engine-powered scoring.
        </p>
      </div>

      {/* Filter bar placeholder */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 20,
        }}
      >
        {['All Accounts', 'High Priority', 'At Risk', 'Expansion'].map((filter) => (
          <div
            key={filter}
            style={{
              padding: '6px 14px',
              borderRadius: V2.radiusFull,
              border: `1px solid ${V2.border}`,
              fontSize: 12,
              color: V2.textDim,
              fontFamily: V2_FONTS.sans,
              cursor: 'pointer',
            }}
          >
            {filter}
          </div>
        ))}
      </div>

      {/* Table placeholder */}
      <div
        style={{
          background: V2.surface,
          border: `1px solid ${V2.border}`,
          borderRadius: V2.radiusLg,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
            padding: '12px 20px',
            borderBottom: `1px solid ${V2.border}`,
            background: V2.bgSubtle,
          }}
        >
          {columns.map((col) => (
            <div
              key={col}
              style={{
                fontFamily: V2_FONTS.mono,
                fontSize: 10,
                color: V2.textDim,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {col}
            </div>
          ))}
        </div>

        {/* Empty rows */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
              padding: '14px 20px',
              borderBottom: `1px solid ${V2.border}`,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 140 + Math.random() * 60,
                height: 12,
                background: V2.surfaceHover,
                borderRadius: 4,
              }}
            />
            {[...Array(5)].map((_, j) => (
              <div
                key={j}
                style={{
                  width: 40 + Math.random() * 30,
                  height: 12,
                  background: V2.surfaceHover,
                  borderRadius: 4,
                }}
              />
            ))}
          </div>
        ))}

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: V2_FONTS.mono,
              fontSize: 10,
              color: V2.accent,
              letterSpacing: '0.08em',
            }}
          >
            CONNECT DATA TO POPULATE TARGET LIST
          </div>
        </div>
      </div>
    </div>
  )
}
