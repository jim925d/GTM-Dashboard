import { V2, V2_FONTS } from '../tokens'

const PlaceholderCard = ({ title, description, icon }) => (
  <div
    style={{
      background: V2.surface,
      border: `1px solid ${V2.border}`,
      borderRadius: V2.radiusLg,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}
  >
    <div style={{ fontSize: 28 }}>{icon}</div>
    <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
    <div style={{ fontSize: 13, color: V2.textDim, lineHeight: 1.5 }}>{description}</div>
    <div
      style={{
        fontFamily: V2_FONTS.mono,
        fontSize: 10,
        color: V2.accent,
        letterSpacing: '0.08em',
        marginTop: 8,
      }}
    >
      COMING SOON
    </div>
  </div>
)

export default function V2Dashboard() {
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
          Dashboard
        </h1>
        <p style={{ fontSize: 13, color: V2.textDim }}>
          Unified account intelligence at a glance.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}
      >
        <PlaceholderCard
          icon="&#9678;"
          title="Account Health"
          description="Aggregate health scores, churn risk distribution, and engagement velocity across your portfolio."
        />
        <PlaceholderCard
          icon="&#128200;"
          title="Pipeline Summary"
          description="Stage-weighted pipeline value, conversion rates, and velocity metrics with period comparisons."
        />
        <PlaceholderCard
          icon="&#9889;"
          title="Engine Signals"
          description="Cross-engine signal aggregation: outage, location, prediction, and event engine highlights."
        />
        <PlaceholderCard
          icon="&#127919;"
          title="Today's Actions"
          description="Priority-ranked seller actions, follow-up reminders, and engagement recommendations."
        />
        <PlaceholderCard
          icon="&#128202;"
          title="Revenue Trend"
          description="TMR trajectory, bookings pace, and forecast confidence intervals over time."
        />
        <PlaceholderCard
          icon="&#128161;"
          title="Insights Feed"
          description="AI-generated insights from engine outputs, surfacing the most actionable opportunities."
        />
      </div>
    </div>
  )
}
