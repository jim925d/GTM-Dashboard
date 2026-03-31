import { V2, V2_FONTS, STAGES } from '../tokens'

/**
 * StageProgress — horizontal stage bar segments showing deal progression.
 * Matches the design reference: colored bar segments (sage done, copper current, ghost future).
 *
 * Props:
 *   stage       — current stage string (e.g. "Negotiate")
 *   daysInStage — optional days in current stage
 *   compact     — if true, render without label row (for inline use)
 */
export default function StageProgress({ stage, daysInStage, compact = false }) {
  const stageIdx = STAGES.indexOf(stage)

  return (
    <div>
      {/* Bar segments */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
        {STAGES.map((s, i) => {
          const done = i < stageIdx
          const current = i === stageIdx
          return (
            <div
              key={s}
              style={{
                width: current ? 32 : 18,
                height: 4,
                borderRadius: 2,
                background: done ? V2.sage : current ? V2.accent : V2.ghost,
                transition: 'all 0.3s ease',
              }}
            />
          )
        })}
      </div>

      {/* Label */}
      {!compact && (
        <div style={{
          fontSize: 10, color: V2.dim, marginTop: 5,
          fontFamily: V2_FONTS.sans, textAlign: 'center',
        }}>
          {stage}{daysInStage != null ? ` · ${daysInStage}d` : ''}
        </div>
      )}
    </div>
  )
}
