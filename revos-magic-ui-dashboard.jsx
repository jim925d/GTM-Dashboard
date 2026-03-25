import { useState, useEffect, useRef } from "react";

// Animated counter hook
function useCounter(target, duration = 1800, delay = 0) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const tick = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        setCount(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);
  return count;
}

// Spotlight card component
function SpotlightCard({ children, className = "", style = {} }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  const handleMouseMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "#161B22",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: hovering ? 1 : 0,
          transition: "opacity 0.4s ease",
          background: `radial-gradient(600px circle at ${pos.x}px ${pos.y}px, rgba(120,90,255,0.08), transparent 40%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: hovering ? 1 : 0,
          transition: "opacity 0.4s ease",
          borderRadius: 16,
          boxShadow: `inset 0 0 0 1px rgba(120,90,255,${hovering ? 0.3 : 0})`,
          pointerEvents: "none",
        }}
      />
      {children}
    </div>
  );
}

// Animated gradient text
function GradientText({ children, style = {} }) {
  return (
    <span
      style={{
        background: "linear-gradient(135deg, #c084fc, #60a5fa, #34d399, #c084fc)",
        backgroundSize: "300% 300%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        animation: "gradientShift 6s ease infinite",
        fontWeight: 600,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// Glowing badge
function GlowBadge({ children, color = "#7c5aff" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: 100,
        fontSize: 12,
        fontWeight: 500,
        color: color,
        background: `${color}18`,
        border: `1px solid ${color}30`,
        boxShadow: `0 0 12px ${color}15`,
      }}
    >
      {children}
    </span>
  );
}

// Mini sparkline
function Sparkline({ data, color = "#7c5aff", width = 80, height = 28 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`
    )
    .join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#sg-${color.replace("#", "")})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Progress ring
function ProgressRing({ value, size = 52, color = "#34d399" }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimated(value), 100);
    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - (animated / 100) * circ}
        style={{ transition: "stroke-dashoffset 1.8s cubic-bezier(0.16,1,0.3,1)" }}
      />
    </svg>
  );
}

// Stage pipeline bar
function StagePipeline({ stages }) {
  const total = stages.reduce((a, b) => a + b.value, 0);
  return (
    <div style={{ display: "flex", gap: 2, height: 8, borderRadius: 4, overflow: "hidden" }}>
      {stages.map((s, i) => (
        <div
          key={i}
          style={{
            flex: s.value / total,
            background: s.color,
            borderRadius: i === 0 ? "4px 0 0 4px" : i === stages.length - 1 ? "0 4px 4px 0" : 0,
            opacity: 0,
            animation: `fadeSlideIn 0.6s ease ${0.8 + i * 0.1}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

export default function RevOSDashboard() {
  const mrr = useCounter(287450, 2000, 200);
  const pipeline = useCounter(1842, 2000, 400);
  const nrr = useCounter(112, 1800, 600);
  const deals = useCounter(47, 1200, 300);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setTimeout(() => setLoaded(true), 50);
  }, []);

  const stageData = [
    { name: "Discover", value: 32, color: "#60a5fa" },
    { name: "Design", value: 24, color: "#818cf8" },
    { name: "Propose", value: 18, color: "#a78bfa" },
    { name: "Negotiate", value: 12, color: "#c084fc" },
    { name: "Verbal", value: 8, color: "#34d399" },
  ];

  const topDeals = [
    { name: "Metro Telecom", product: "SD-WAN + DIA Bundle", mrr: "$18,400", stage: "Negotiate", prob: "84.7%", probColor: "#c084fc" },
    { name: "Pacific Fiber Co", product: "Dark Fiber IRU", mrr: "$42,200", stage: "Propose", prob: "66.2%", probColor: "#a78bfa" },
    { name: "CityLink Networks", product: "UCaaS Migration", mrr: "$8,750", stage: "Verbal", prob: "92.5%", probColor: "#34d399" },
    { name: "NorthStar Wireless", product: "NOC Managed Svc", mrr: "$12,100", stage: "Design", prob: "53.2%", probColor: "#818cf8" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#06080F",
        color: "#e6edf3",
        fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
        padding: "32px 28px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* Ambient background glow */}
      <div
        style={{
          position: "absolute",
          top: -200,
          right: -200,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(120,90,255,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
          animation: "pulseGlow 8s ease infinite",
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 32,
          opacity: loaded ? 1 : 0,
          transform: loaded ? "translateY(0)" : "translateY(-10px)",
          transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #7c5aff, #60a5fa)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 600,
            }}>R</div>
            <GradientText style={{ fontSize: 22, letterSpacing: "-0.02em" }}>RevOS</GradientText>
          </div>
          <p style={{ fontSize: 13, color: "#8b949e", marginTop: 4 }}>
            Seller Dashboard — Q1 2026 Pipeline
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <GlowBadge color="#34d399">
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", animation: "pulseGlow 2s ease infinite" }} />
            Live
          </GlowBadge>
          <GlowBadge color="#60a5fa">Demo Mode</GlowBadge>
        </div>
      </div>

      {/* KPI row - Bento grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: "Monthly Recurring Revenue",
            value: `$${mrr.toLocaleString()}`,
            sub: "+12.3% vs LM",
            subColor: "#34d399",
            spark: [22, 28, 25, 35, 30, 38, 42, 40, 48, 52, 50, 58],
            sparkColor: "#34d399",
            delay: 0,
          },
          {
            label: "Weighted Pipeline",
            value: `$${pipeline.toLocaleString()}K`,
            sub: "47 active deals",
            subColor: "#8b949e",
            spark: [40, 38, 45, 42, 50, 48, 52, 55, 60, 58, 65, 62],
            sparkColor: "#a78bfa",
            delay: 0.1,
          },
          {
            label: "Net Revenue Retention",
            value: `${nrr}%`,
            sub: "↑ 3.2pts QoQ",
            subColor: "#34d399",
            ring: true,
            ringValue: 112,
            ringColor: "#60a5fa",
            delay: 0.2,
          },
          {
            label: "Active Deals",
            value: deals.toString(),
            sub: "8 closing this month",
            subColor: "#f0883e",
            spark: [8, 12, 10, 15, 18, 14, 20, 22, 25, 28, 30, 35],
            sparkColor: "#f0883e",
            delay: 0.3,
          },
        ].map((kpi, i) => (
          <SpotlightCard
            key={i}
            style={{
              padding: "20px 22px",
              opacity: 0,
              animation: `fadeSlideIn 0.7s ease ${0.2 + kpi.delay}s forwards`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
                  {kpi.label}
                </p>
                <p style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {kpi.value}
                </p>
                <p style={{ fontSize: 12, color: kpi.subColor, marginTop: 8 }}>{kpi.sub}</p>
              </div>
              <div style={{ marginTop: 4 }}>
                {kpi.ring ? (
                  <div style={{ position: "relative" }}>
                    <ProgressRing value={Math.min(kpi.ringValue, 100)} color={kpi.ringColor} />
                    <span style={{
                      position: "absolute", inset: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 500, color: kpi.ringColor,
                      transform: "rotate(0deg)",
                    }}>
                      {kpi.ringValue > 100 ? "↑" : ""}
                    </span>
                  </div>
                ) : (
                  <Sparkline data={kpi.spark} color={kpi.sparkColor} />
                )}
              </div>
            </div>
          </SpotlightCard>
        ))}
      </div>

      {/* Two-column: Pipeline stages + Top deals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }}>
        {/* Pipeline stages */}
        <SpotlightCard
          style={{
            padding: "22px 24px",
            opacity: 0,
            animation: "fadeSlideIn 0.7s ease 0.5s forwards",
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 18 }}>
            Pipeline by Stage
          </p>
          <StagePipeline stages={stageData} />
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            {stageData.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                  <span style={{ fontSize: 13, color: "#c9d1d9" }}>{s.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 13, color: "#8b949e" }}>{s.value} deals</span>
                  <div style={{
                    width: 60, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                  }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 2,
                        background: s.color,
                        width: `${(s.value / 32) * 100}%`,
                        opacity: 0,
                        animation: `fadeIn 0.6s ease ${1 + i * 0.1}s forwards`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SpotlightCard>

        {/* Top deals table */}
        <SpotlightCard
          style={{
            padding: "22px 24px",
            opacity: 0,
            animation: "fadeSlideIn 0.7s ease 0.6s forwards",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <p style={{ fontSize: 14, fontWeight: 500 }}>Top Deals</p>
            <GlowBadge color="#a78bfa">Bayesian Scored</GlowBadge>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1.2fr 0.7fr 0.8fr 0.6fr",
                padding: "8px 0",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                fontSize: 11,
                color: "#8b949e",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 500,
              }}
            >
              <span>Account</span>
              <span>Product</span>
              <span>MRR</span>
              <span>Stage</span>
              <span style={{ textAlign: "right" }}>Win %</span>
            </div>
            {/* Rows */}
            {topDeals.map((deal, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1.2fr 0.7fr 0.8fr 0.6fr",
                  padding: "14px 0",
                  borderBottom: i < topDeals.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  alignItems: "center",
                  fontSize: 13,
                  opacity: 0,
                  animation: `fadeSlideIn 0.5s ease ${0.8 + i * 0.12}s forwards`,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(120,90,255,0.04)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ fontWeight: 500, color: "#e6edf3" }}>{deal.name}</span>
                <span style={{ color: "#8b949e", fontSize: 12 }}>{deal.product}</span>
                <span style={{ color: "#e6edf3", fontWeight: 500 }}>{deal.mrr}</span>
                <span>
                  <span style={{
                    fontSize: 11, padding: "3px 10px", borderRadius: 100,
                    background: `${deal.probColor}15`,
                    color: deal.probColor,
                    border: `1px solid ${deal.probColor}25`,
                  }}>
                    {deal.stage}
                  </span>
                </span>
                <span style={{
                  textAlign: "right",
                  fontWeight: 600,
                  fontFamily: "'IBM Plex Sans', monospace",
                  color: deal.probColor,
                  textShadow: `0 0 20px ${deal.probColor}30`,
                }}>
                  {deal.prob}
                </span>
              </div>
            ))}
          </div>
        </SpotlightCard>
      </div>

      {/* Bottom nav mockup */}
      <div
        style={{
          marginTop: 24,
          display: "flex",
          gap: 2,
          padding: "6px",
          background: "#0d1117",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.04)",
          opacity: 0,
          animation: "fadeSlideIn 0.7s ease 1s forwards",
        }}
      >
        {["Dashboard", "Deal Prep", "Ask RevOS", "Documents", "Locations", "Pipeline Gap"].map(
          (tab, i) => (
            <div
              key={tab}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "10px 0",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s",
                color: i === 0 ? "#e6edf3" : "#8b949e",
                background: i === 0 ? "rgba(120,90,255,0.12)" : "transparent",
                border: i === 0 ? "1px solid rgba(120,90,255,0.2)" : "1px solid transparent",
              }}
            >
              {tab}
            </div>
          )
        )}
      </div>
    </div>
  );
}
