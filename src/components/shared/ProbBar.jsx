export default function ProbBar({ value, color, h = 5 }) {
  return (
    <div
      className="bg-border overflow-hidden"
      style={{ height: `${h}px`, borderRadius: `${h}px` }}
    >
      <div
        className="h-full transition-[width] duration-700 ease-out"
        style={{
          width: `${Math.min(value * 100, 100)}%`,
          background: color,
          borderRadius: `${h}px`,
        }}
      />
    </div>
  )
}
