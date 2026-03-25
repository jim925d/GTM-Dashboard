import { useState, useEffect, useRef } from "react";

// Animated border card (Aceternity-style)
function AnimatedBorderCard({ children, style = {}, borderColor = "rgba(120,90,255,0.6)" }) {
  const id = useRef(`ab-${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <div style={{ position: "relative", borderRadius: 16, padding: 1, ...style }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "-50%",
            background: `conic-gradient(from 0deg, transparent, ${borderColor}, transparent 30%)`,
            animation: `spin-${id} 4s linear infinite`,
          }}
        />
        <style>{`@keyframes spin-${id} { to { transform: rotate(360deg); } }`}</style>
      </div>
      <div
        style={{
          position: "relative",
          background: "#161B22",
          borderRadius: 15,
          height: "100%",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Hover reveal card
function RevealCard({ children, style = {} }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        borderRadius: 16,
        border: `1px solid rgba(255,255,255,${hover ? 0.1 : 0.04})`,
        background: "#161B22",
        transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hover
          ? "0 8px 30px rgba(120,90,255,0.08), 0 0 0 1px rgba(120,90,255,0.15)"
          : "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Typing effect
function TypeWriter({ text, speed = 40, delay = 0 }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        setDisplayed(text.slice(0, i + 1));
        i++;
        if (i >= text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, speed, delay]);
  return <>{displayed}<span style={{ opacity: displayed.length < text.length ? 1 : 0, animation: "blink 1s step-end infinite" }}>▍</span></>;
}

// Score gauge
function ScoreGauge({ score, label, color, size = 72 }) {
  const [val, setVal] = useState(0);
  useEffect(() => { setTimeout(() => setVal(score), 300); }, [score]);
  const r = (size - 8) / 2;
  const circ = Math.PI * r;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
        <path
          d={`M 4,${size / 2 + 4} A ${r},${r} 0 0 1 ${size - 4},${size / 2 + 4}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round"
        />
        <path
          d={`M 4,${size / 2 + 4} A ${r},${r} 0 0 1 ${size - 4},${size / 2 + 4}`}
          fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - (val / 100) * circ}
          style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(0.16,1,0.3,1)" }}
        />
        <text x={size / 2} y={size / 2} textAnchor="middle" fill={color} fontSize="16" fontWeight="600" fontFamily="IBM Plex Sans">
          {val}
        </text>
      </svg>
      <span style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
    </div>
  );
}

// Timeline dot
function TimelineDot({ color, active }) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{
        width: 10, height: 10, borderRadius: "50%",
        background: active ? color : "rgba(255,255,255,0.1)",
        border: `2px solid ${active ? color : "rgba(255,255,255,0.15)"}`,
        transition: "all 0.3s",
      }} />
      {active && (
        <div style={{
          position: "absolute", inset: -4, borderRadius: "50%",
          border: `1px solid ${color}40`,
          animation: "pulseRing 2s ease infinite",
        }} />
      )}
    </div>
  );
}

export default function DealPrep() {
  const [loaded, setLoaded] = useState(false);
  const [activeInsight, setActiveInsight] = useState(0);

  useEffect(() => { setTimeout(() => setLoaded(true), 50); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveInsight((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const insights = [
    { icon: "⚡", text: "Metro Telecom's contract renewal is in 47 days. Historical pattern shows 73% of similar accounts expand SD-WAN during renewal windows.", color: "#f0883e" },
    { icon: "📊", text: "Deal velocity is 2.1x faster than median for this segment. Bayesian model suggests accelerating to Propose stage within 5 business days.", color: "#34d399" },
    { icon: "🎯", text: "Game theory alignment: Competitor likely to undercut by 12-15% on DIA. Recommend bundling with managed NOC to create switching cost barrier.", color: "#a78bfa" },
  ];

  const stages = [
    { name: "Discover", prob: "30.6%", done: true },
    { name: "Design Solution", prob: "53.2%", done: true },
    { name: "Propose", prob: "66.2%", active: true },
    { name: "Negotiate", prob: "84.7%", done: false },
    { name: "Verbal Agreement", prob: "92.5%", done: false },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#06080F",
      color: "#e6edf3",
      fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
      padding: "32px 28px",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeSlideRight { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes pulseRing { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.6); opacity: 0; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* Ambient */}
      <div style={{
        position: "absolute", top: -100, left: "30%", width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(96,165,250,0.04) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: 28,
        opacity: loaded ? 1 : 0, transition: "opacity 0.6s ease",
      }}>
        <div>
          <p style={{ fontSize: 12, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500, marginBottom: 6 }}>
            Deal Prep
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em", margin: 0 }}>
            Metro Telecom — SD-WAN + DIA Bundle
          </h1>
          <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
            <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 100, background: "rgba(192,132,252,0.12)", color: "#c084fc", border: "1px solid rgba(192,132,252,0.2)" }}>
              Negotiate Stage
            </span>
            <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 100, background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
              $18,400 MRR
            </span>
            <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 100, background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>
              47 Days to Renewal
            </span>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* AI Insight — Animated border card (hero) */}
        <AnimatedBorderCard style={{ gridColumn: "1 / -1", opacity: 0, animation: "fadeSlideIn 0.7s ease 0.2s forwards" }}>
          <div style={{ padding: "24px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "linear-gradient(135deg, #7c5aff, #60a5fa)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 600,
              }}>R</div>
              <span style={{ fontSize: 14, fontWeight: 500 }}>RevOS Intelligence</span>
              <span style={{
                fontSize: 11, padding: "2px 10px", borderRadius: 100,
                background: "linear-gradient(90deg, rgba(120,90,255,0.15), rgba(96,165,250,0.15))",
                backgroundSize: "200% 100%",
                animation: "shimmer 3s linear infinite",
                color: "#a78bfa", border: "1px solid rgba(120,90,255,0.2)",
              }}>
                AI-Powered
              </span>
            </div>
            <div style={{ minHeight: 48 }}>
              {insights.map((ins, i) => (
                <div
                  key={i}
                  style={{
                    display: activeInsight === i ? "flex" : "none",
                    gap: 12, alignItems: "flex-start",
                  }}
                >
                  <span style={{ fontSize: 18, marginTop: 2 }}>{ins.icon}</span>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: "#c9d1d9" }}>
                    {activeInsight === i && <TypeWriter text={ins.text} speed={25} />}
                  </p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
              {insights.map((_, i) => (
                <div
                  key={i}
                  onClick={() => setActiveInsight(i)}
                  style={{
                    width: activeInsight === i ? 24 : 6, height: 6, borderRadius: 3,
                    background: activeInsight === i ? "#7c5aff" : "rgba(255,255,255,0.1)",
                    cursor: "pointer", transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
                  }}
                />
              ))}
            </div>
          </div>
        </AnimatedBorderCard>

        {/* Score cards */}
        <RevealCard style={{ padding: "24px", opacity: 0, animation: "fadeSlideIn 0.7s ease 0.35s forwards" }}>
          <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 20 }}>Deal Health Scores</p>
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            <ScoreGauge score={85} label="Win Prob" color="#34d399" />
            <ScoreGauge score={72} label="Engagement" color="#60a5fa" />
            <ScoreGauge score={68} label="Alignment" color="#a78bfa" />
            <ScoreGauge score={91} label="Timing" color="#f0883e" />
          </div>
        </RevealCard>

        {/* Stage progression */}
        <RevealCard style={{ padding: "24px", opacity: 0, animation: "fadeSlideIn 0.7s ease 0.45s forwards" }}>
          <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 20 }}>Stage Progression</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {stages.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <TimelineDot
                    color={s.done ? "#34d399" : s.active ? "#60a5fa" : "#8b949e"}
                    active={s.active}
                  />
                  {i < stages.length - 1 && (
                    <div style={{
                      width: 1, height: 20,
                      background: s.done ? "#34d399" : "rgba(255,255,255,0.08)",
                      marginTop: 2,
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: s.active ? 500 : 400,
                    color: s.done ? "#34d399" : s.active ? "#e6edf3" : "#8b949e",
                  }}>
                    {s.name}
                    {s.done && " ✓"}
                  </span>
                  <span style={{
                    fontSize: 12,
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: s.active ? "#60a5fa" : "#484f58",
                  }}>
                    {s.prob}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </RevealCard>
      </div>

      {/* Bottom row: Negotiation strategy */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {[
          {
            title: "Recommended Discount",
            value: "8-12%",
            sub: "Below competitor's likely 15% floor",
            icon: "💰",
            color: "#34d399",
            detail: "Game theory optimal: bundle discount preserves margin while undercutting competitor switching cost",
          },
          {
            title: "Contract Term",
            value: "36 mo",
            sub: "2.3x higher retention vs 12 mo",
            icon: "📋",
            color: "#60a5fa",
            detail: "Survival analysis shows 36-month terms reduce churn probability by 67% in this segment",
          },
          {
            title: "Upsell Opportunity",
            value: "UCaaS Add-on",
            sub: "+$4,200 MRR potential",
            icon: "🚀",
            color: "#a78bfa",
            detail: "42% of SD-WAN customers in this vertical add UCaaS within 90 days of close",
          },
        ].map((card, i) => (
          <RevealCard
            key={i}
            style={{
              padding: "22px 24px",
              opacity: 0,
              animation: `fadeSlideIn 0.7s ease ${0.6 + i * 0.1}s forwards`,
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 16 }}>{card.icon}</span>
              <span style={{ fontSize: 12, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
                {card.title}
              </span>
            </div>
            <p style={{ fontSize: 24, fontWeight: 600, color: card.color, letterSpacing: "-0.02em", marginBottom: 4 }}>
              {card.value}
            </p>
            <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 12 }}>{card.sub}</p>
            <div style={{
              fontSize: 12, lineHeight: 1.6, color: "#484f58",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              paddingTop: 12,
            }}>
              {card.detail}
            </div>
          </RevealCard>
        ))}
      </div>
    </div>
  );
}
