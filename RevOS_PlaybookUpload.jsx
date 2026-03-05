import { useState, useRef, useEffect, useCallback } from "react";

// ─── Color Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#0f1117",
  surface: "#181b23",
  surfaceHover: "#1e2230",
  border: "#2a2e3b",
  text: "#e2e4e9",
  muted: "#8b8f9a",
  dim: "#5a5e6b",
  accent: "#4a9eff",
  accentDim: "rgba(74,158,255,0.12)",
  green: "#34d399",
  greenDim: "rgba(52,211,153,0.12)",
  yellow: "#fbbf24",
  yellowDim: "rgba(251,191,36,0.12)",
  red: "#f87171",
  redDim: "rgba(248,113,113,0.12)",
  orange: "#fb923c",
  orangeDim: "rgba(251,146,60,0.12)",
  purple: "#a78bfa",
  purpleDim: "rgba(167,139,250,0.12)",
};

// ─── Global Styles ───────────────────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
    @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slideIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
    @keyframes scanLine { 0%{top:0} 100%{top:100%} }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes fillBar { from{width:0} to{width:var(--target-w)} }
    @keyframes glowPulse { 0%,100%{box-shadow:0 0 8px rgba(74,158,255,0.3)} 50%{box-shadow:0 0 20px rgba(74,158,255,0.6)} }
    *,*::before,*::after{box-sizing:border-box;margin:0}
    body{margin:0}
    ::-webkit-scrollbar{width:6px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:#2a2e3b;border-radius:3px}
    ::placeholder{color:#5a5e6b}
    .fade-in{animation:fadeIn 0.3s ease forwards}
    .slide-in{animation:slideIn 0.25s ease forwards}
  `}</style>
);

// ─── Mock Data (baseline before playbook) ────────────────────────────────────
const BASE_DEALS = [
  {
    id: 1,
    name: "Acme Corp — Platform License",
    stage: "Discovery",
    value: "$185,000",
    competitor: "Competitor X",
    segment: "Mid-Market",
    industry: "Healthcare",
    daysInStage: 14,
    alignmentScore: 62,
    nextStep: "Schedule technical demo",
    risks: ["No economic buyer identified", "Competitor X active in account"],
    recommendations: [
      { type: "action", text: "Identify executive sponsor before next call", icon: "🎯" },
      { type: "content", text: "Send ROI calculator", icon: "📊" },
    ],
    contacts: [
      { name: "Sarah Chen", role: "VP Engineering", engagement: "High" },
      { name: "Mark Davis", role: "Procurement", engagement: "Low" },
    ],
  },
  {
    id: 2,
    name: "Pinnacle Financial — Enterprise Suite",
    stage: "Proposal",
    value: "$340,000",
    competitor: null,
    segment: "Enterprise",
    industry: "Financial Services",
    daysInStage: 21,
    alignmentScore: 81,
    nextStep: "Deliver formal proposal",
    risks: ["Legal review pending", "Q4 budget freeze risk"],
    recommendations: [
      { type: "pricing", text: "Offer multi-year discount to beat Q4 freeze", icon: "💰" },
      { type: "content", text: "Share compliance & security one-pager", icon: "🔒" },
    ],
    contacts: [
      { name: "James Wright", role: "CFO", engagement: "High" },
      { name: "Lisa Park", role: "IT Director", engagement: "Medium" },
    ],
  },
  {
    id: 3,
    name: "Vertex Manufacturing — Starter Plan",
    stage: "Qualification",
    value: "$48,000",
    competitor: "Competitor Y",
    segment: "SMB",
    industry: "Manufacturing",
    daysInStage: 7,
    alignmentScore: 44,
    nextStep: "Confirm budget and authority",
    risks: ["Budget unconfirmed", "Low stakeholder count", "Competitor Y pricing pressure"],
    recommendations: [
      { type: "action", text: "Run MEDDIC qualification checklist", icon: "✅" },
      { type: "pricing", text: "Prepare competitive displacement offer", icon: "⚡" },
    ],
    contacts: [
      { name: "Tom Nguyen", role: "Operations Manager", engagement: "Medium" },
    ],
  },
];

const BASE_DOCS = [
  { id: 1, name: "Sales Playbook 2024.pdf", pages: 42, chunks: 128, uploaded: "3 days ago", status: "active" },
  { id: 2, name: "Competitive Battle Cards.pdf", pages: 18, chunks: 54, uploaded: "1 week ago", status: "active" },
];

const BASE_ASK_SUGGESTIONS = [
  "What's our discovery call framework?",
  "How do we handle Competitor X objections?",
  "What's the discount approval process?",
];

// ─── Shared Components ───────────────────────────────────────────────────────
const Badge = ({ children, color = "accent" }) => {
  const colors = {
    accent: { fg: C.accent, bg: C.accentDim },
    green: { fg: C.green, bg: C.greenDim },
    yellow: { fg: C.yellow, bg: C.yellowDim },
    red: { fg: C.red, bg: C.redDim },
    orange: { fg: C.orange, bg: C.orangeDim },
    purple: { fg: C.purple, bg: C.purpleDim },
  };
  const col = colors[color] || colors.accent;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 99,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
      color: col.fg, background: col.bg, textTransform: "uppercase",
    }}>{children}</span>
  );
};

const ScoreRing = ({ score, size = 48 }) => {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? C.green : score >= 60 ? C.yellow : C.red;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={3} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={size < 40 ? 9 : 12} fontWeight={700}>{score}</text>
    </svg>
  );
};

const Card = ({ children, onClick, style = {} }) => {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => onClick && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: C.surface, border: `1px solid ${hov ? C.accent : C.border}`,
        borderRadius: 8, padding: 20, cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s", ...style,
      }}>{children}</div>
  );
};

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 600, color: C.dim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
    {children}
  </div>
);

const NavItem = ({ icon, label, active, onClick, collapsed, disabled }) => {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: collapsed ? "10px 0" : "9px 12px", border: "none", borderRadius: 6,
        background: active ? C.accentDim : hov ? C.surfaceHover : "transparent",
        color: disabled ? C.dim : active ? C.accent : hov ? C.text : C.muted,
        fontSize: 13, fontWeight: active ? 600 : 400, cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.12s", justifyContent: collapsed ? "center" : "flex-start",
        fontFamily: "'IBM Plex Sans', sans-serif",
        opacity: disabled ? 0.4 : 1,
      }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      {!collapsed && <span>{label}</span>}
    </button>
  );
};

// ─── Extraction Animation Component ─────────────────────────────────────────
const ExtractionModal = ({ file, onComplete, onCancel }) => {
  const [phase, setPhase] = useState("reading"); // reading | extracting | applying | done
  const [extractedData, setExtractedData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [liveFields, setLiveFields] = useState([]);
  const [currentCategory, setCurrentCategory] = useState("");
  const [error, setError] = useState(null);

  const EXTRACTION_CATEGORIES = [
    { key: "methodology", label: "Sales Methodology", icon: "🧠", color: C.accent },
    { key: "qualification", label: "Qualification Framework", icon: "✅", color: C.green },
    { key: "competitors", label: "Competitor Intel", icon: "⚔️", color: C.orange },
    { key: "pricing", label: "Pricing & Discounting", icon: "💰", color: C.yellow },
    { key: "objections", label: "Objection Handling", icon: "🛡️", color: C.purple },
    { key: "personas", label: "Buyer Personas", icon: "👥", color: C.green },
    { key: "stages", label: "Deal Stage Criteria", icon: "📋", color: C.accent },
    { key: "kpis", label: "Success Metrics", icon: "📈", color: C.yellow },
  ];

  useEffect(() => {
    runExtraction();
  }, []);

  const readFileAsBase64 = (f) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(f);
  });

  const runExtraction = async () => {
    try {
      setPhase("reading");
      setProgress(5);
      await sleep(600);

      setPhase("extracting");
      setProgress(15);

      // Read file
      let fileContent = "";
      let messages = [];

      if (file.type === "application/pdf") {
        const base64 = await readFileAsBase64(file);
        messages = [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text", text: EXTRACTION_PROMPT }
          ]
        }];
      } else {
        fileContent = await file.text();
        messages = [{ role: "user", content: `${EXTRACTION_PROMPT}\n\n---\n\n${fileContent}` }];
      }

      // Simulate progressive field discovery during API call
      const apiPromise = callAPI(messages);
      const animPromise = animateExtraction();

      const [apiResult] = await Promise.all([apiPromise, animPromise]);

      setPhase("applying");
      setProgress(85);
      await sleep(800);

      setExtractedData(apiResult);
      setProgress(100);
      await sleep(600);
      setPhase("done");

    } catch (e) {
      console.error(e);
      setError(e.message || "Extraction failed");
    }
  };

  const animateExtraction = async () => {
    for (let i = 0; i < EXTRACTION_CATEGORIES.length; i++) {
      await sleep(400 + Math.random() * 300);
      setCurrentCategory(EXTRACTION_CATEGORIES[i].label);
      setLiveFields(prev => [...prev, EXTRACTION_CATEGORIES[i]]);
      setProgress(15 + Math.round((i + 1) / EXTRACTION_CATEGORIES.length * 55));
    }
    await sleep(300);
  };

  const callAPI = async (messages) => {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: "You are a sales intelligence extraction engine. Always respond with valid JSON only, no markdown, no preamble.",
        messages,
      }),
    });
    const data = await response.json();
    const text = data.content?.map(b => b.text || "").join("") || "";
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return FALLBACK_EXTRACTION;
    }
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const phaseLabel = {
    reading: "Reading document...",
    extracting: "Extracting sales intelligence...",
    applying: "Applying to your workspace...",
    done: "Playbook activated!",
  }[phase];

  if (error) {
    return (
      <ModalOverlay>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, width: 480, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <div style={{ color: C.text, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Extraction failed</div>
          <div style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>{error}</div>
          <button onClick={onCancel} style={btnStyle(C.accent)}>Close</button>
        </div>
      </ModalOverlay>
    );
  }

  return (
    <ModalOverlay>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 32, width: 520, position: "relative", overflow: "hidden",
      }}>
        {/* Scan line effect */}
        {phase === "extracting" && (
          <div style={{
            position: "absolute", left: 0, right: 0, height: 1,
            background: "linear-gradient(90deg, transparent, rgba(74,158,255,0.5), transparent)",
            animation: "scanLine 2s linear infinite", pointerEvents: "none",
          }} />
        )}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8, background: C.accentDim,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>📄</div>
          <div>
            <div style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{file.name}</div>
            <div style={{ color: C.muted, fontSize: 12 }}>{(file.size / 1024).toFixed(0)} KB</div>
          </div>
          {phase === "done" && (
            <div style={{ marginLeft: "auto" }}>
              <Badge color="green">✓ Complete</Badge>
            </div>
          )}
        </div>

        {/* Phase label */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          {phase !== "done" && (
            <div style={{
              width: 14, height: 14, border: `2px solid ${C.accent}`, borderTopColor: "transparent",
              borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0,
            }} />
          )}
          {phase === "done" && <span style={{ color: C.green, fontSize: 16 }}>✓</span>}
          <span style={{ color: phase === "done" ? C.green : C.accent, fontSize: 13, fontWeight: 600 }}>
            {phaseLabel}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: C.border, borderRadius: 2, marginBottom: 24, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: phase === "done"
              ? `linear-gradient(90deg, ${C.green}, ${C.accent})`
              : `linear-gradient(90deg, ${C.accent}, ${C.purple})`,
            borderRadius: 2, transition: "width 0.4s ease",
          }} />
        </div>

        {/* Live extraction fields */}
        <div style={{ minHeight: 180 }}>
          {liveFields.length > 0 && (
            <>
              <SectionLabel>Extracted Intelligence</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {liveFields.map((field, i) => (
                  <div key={field.key} className="slide-in" style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", background: C.bg, borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    animationDelay: `${i * 0.05}s`,
                  }}>
                    <span style={{ fontSize: 14 }}>{field.icon}</span>
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>{field.label}</span>
                    <span style={{ marginLeft: "auto", color: field.color, fontSize: 11 }}>✓</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {phase === "extracting" && liveFields.length < 8 && (
            <div style={{ color: C.dim, fontSize: 11, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span>Scanning</span>
              <span style={{ color: C.accent }}>{currentCategory}</span>
              <span style={{ display: "inline-flex", gap: 3 }}>
                {[0,1,2].map(i => (
                  <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: C.accent, display: "inline-block", animation: `pulse 1s ${i*0.2}s infinite` }} />
                ))}
              </span>
            </div>
          )}
        </div>

        {/* Done state — extracted summary */}
        {phase === "done" && extractedData && (
          <div className="fade-in" style={{ marginTop: 20, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
            <SectionLabel>Applied to Your Workspace</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {extractedData.summary?.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: C.muted }}>
                  <span style={{ color: C.green, flexShrink: 0 }}>✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <button onClick={() => onComplete(extractedData)} style={{ ...btnStyle(C.accent), marginTop: 20, width: "100%" }}>
              View Updated Dashboard →
            </button>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
};

const ModalOverlay = ({ children }) => (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  }}>{children}</div>
);

const btnStyle = (bg) => ({
  padding: "9px 20px", background: bg, border: "none", borderRadius: 6,
  color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
  fontFamily: "'IBM Plex Sans', sans-serif",
});

// ─── Extraction Prompt ───────────────────────────────────────────────────────
const EXTRACTION_PROMPT = `You are extracting sales intelligence from a sales playbook. Extract the key information and return ONLY a JSON object with this exact structure (no markdown, no explanation):

{
  "methodology": "Name of sales methodology used (e.g. MEDDIC, SPIN, Challenger, etc.)",
  "qualification_framework": ["criterion1", "criterion2", "criterion3"],
  "competitors": [{"name": "CompetitorName", "weakness": "their weakness", "our_advantage": "our advantage"}],
  "pricing": {"discount_threshold": "X%", "approval_required_above": "$X", "multi_year_discount": "X%"},
  "objections": [{"objection": "objection text", "response": "how to handle it"}],
  "buyer_personas": [{"title": "job title", "pain": "main pain point", "message": "key message"}],
  "deal_stages": [{"stage": "stage name", "exit_criteria": "what's required to advance"}],
  "kpis": [{"metric": "metric name", "target": "target value"}],
  "recommendations_for_deals": [
    {"type": "action"|"content"|"pricing", "text": "specific recommendation text", "icon": "emoji", "applies_to": "Discovery"|"Proposal"|"Qualification"|"All"}
  ],
  "ask_suggestions": ["question1 a seller would ask", "question2", "question3", "question4"],
  "summary": [
    "X recommendations added to active deals",
    "Competitor intel loaded for X competitors", 
    "Qualification framework updated with X criteria",
    "Ask RevOS trained on X objection responses",
    "X buyer persona profiles loaded"
  ]
}

If you cannot find specific information, use reasonable defaults based on B2B SaaS sales best practices. Always return valid JSON.`;

const FALLBACK_EXTRACTION = {
  methodology: "MEDDIC",
  qualification_framework: ["Metrics defined", "Economic buyer identified", "Decision criteria mapped", "Decision process understood", "Identified pain", "Champion in place"],
  competitors: [
    { name: "Competitor X", weakness: "Complex implementation", our_advantage: "Faster time to value" },
    { name: "Competitor Y", weakness: "Higher TCO", our_advantage: "Better ROI" },
  ],
  pricing: { discount_threshold: "15%", approval_required_above: "$50,000", multi_year_discount: "20%" },
  objections: [
    { objection: "Too expensive", response: "Focus on ROI and total cost of ownership comparison" },
    { objection: "We're happy with current solution", response: "Quantify the cost of the status quo" },
  ],
  buyer_personas: [
    { title: "VP Sales", pain: "Missing quota, poor pipeline visibility", message: "Close more deals with AI-powered coaching" },
    { title: "CRO", pain: "Unpredictable revenue, rep ramp time", message: "Systematize what your best reps do" },
  ],
  deal_stages: [
    { stage: "Discovery", exit_criteria: "Pain confirmed, budget range known" },
    { stage: "Qualification", exit_criteria: "MEDDIC complete, champion identified" },
    { stage: "Proposal", exit_criteria: "Formal proposal sent, verbal agreement on scope" },
  ],
  kpis: [
    { metric: "Discovery to Proposal Rate", target: "40%" },
    { metric: "Proposal to Close Rate", target: "30%" },
    { metric: "Average Sales Cycle", target: "45 days" },
  ],
  recommendations_for_deals: [
    { type: "action", text: "Complete MEDDIC qualification — missing economic buyer", icon: "🎯", applies_to: "Discovery" },
    { type: "content", text: "Send ROI calculator based on prospect's stated pain", icon: "📊", applies_to: "Discovery" },
    { type: "pricing", text: "Multi-year discount available — use to overcome budget objection", icon: "💰", applies_to: "Proposal" },
    { type: "action", text: "Run competitive displacement playbook for Competitor X accounts", icon: "⚔️", applies_to: "Qualification" },
  ],
  ask_suggestions: [
    "What are the exit criteria for each deal stage?",
    "How do I handle a 'too expensive' objection?",
    "What's the competitive displacement strategy for Competitor X?",
    "When can I offer a multi-year discount?",
  ],
  summary: [
    "4 new deal recommendations added to active deals",
    "Competitor intel loaded for 2 competitors",
    "MEDDIC qualification framework activated",
    "Ask RevOS trained on 2 objection handling responses",
    "2 buyer persona profiles loaded into deal intelligence",
  ],
};

// ─── Documents Screen ────────────────────────────────────────────────────────
const DocumentsScreen = ({ docs, onPlaybookExtracted, playbookLoaded }) => {
  const [tab, setTab] = useState("documents");
  const [dragging, setDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const fileRef = useRef();

  const handleFile = (f) => {
    if (f) setUploadingFile(f);
  };

  const tabs = ["documents", "data model"];

  return (
    <div>
      {uploadingFile && (
        <ExtractionModal
          file={uploadingFile}
          onComplete={(data) => { setUploadingFile(null); onPlaybookExtracted(data, uploadingFile.name); }}
          onCancel={() => setUploadingFile(null)}
        />
      )}

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>Documents</h2>
        <p style={{ fontSize: 13, color: C.muted }}>Upload your sales playbooks and knowledge base. RevOS AI extracts and activates intelligence automatically.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 16px", border: "none", background: "transparent",
            color: tab === t ? C.accent : C.muted, fontSize: 13, fontWeight: tab === t ? 600 : 400,
            cursor: "pointer", borderBottom: tab === t ? `2px solid ${C.accent}` : "2px solid transparent",
            marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif", textTransform: "capitalize",
          }}>{t}</button>
        ))}
      </div>

      {tab === "documents" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? C.accent : C.border}`,
              borderRadius: 10, padding: "36px 24px", textAlign: "center",
              cursor: "pointer", background: dragging ? C.accentDim : "transparent",
              transition: "all 0.15s", animation: dragging ? "glowPulse 1s infinite" : "none",
            }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
            <div style={{ color: C.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              Drop your sales playbook here
            </div>
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>
              PDF, TXT, or MD — RevOS AI will extract and activate the intelligence
            </div>
            <span style={{
              display: "inline-block", padding: "7px 16px", borderRadius: 6,
              background: C.accentDim, color: C.accent, fontSize: 12, fontWeight: 600, border: `1px solid ${C.accentDim}`,
            }}>Browse files</span>
            <input ref={fileRef} type="file" accept=".pdf,.txt,.md" style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          {/* Playbook loaded banner */}
          {playbookLoaded && (
            <div className="fade-in" style={{
              padding: "12px 16px", borderRadius: 8,
              background: C.greenDim, border: `1px solid ${C.green}`,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <div>
                <div style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>Playbook Activated</div>
                <div style={{ color: C.muted, fontSize: 12 }}>AI extracted and applied intelligence to your dashboard, deals, and Ask RevOS.</div>
              </div>
            </div>
          )}

          {/* Docs table */}
          <Card style={{ padding: 0 }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
              <SectionLabel>Uploaded Documents ({docs.length}/5 Free)</SectionLabel>
              <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(docs.length/5)*100}%`, background: C.accent, borderRadius: 2, transition: "width 0.4s" }} />
              </div>
            </div>
            {docs.map((doc, i) => (
              <div key={doc.id} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
                borderBottom: i < docs.length - 1 ? `1px solid ${C.border}` : "none",
              }}>
                <span style={{ fontSize: 20 }}>{doc.name.endsWith(".pdf") ? "📄" : "📝"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>{doc.name}</div>
                  <div style={{ color: C.dim, fontSize: 11 }}>{doc.pages} pages · {doc.chunks} chunks · {doc.uploaded}</div>
                </div>
                <Badge color={doc.status === "active" ? "green" : "yellow"}>{doc.status}</Badge>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === "data model" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <SectionLabel>Content Coverage</SectionLabel>
            {[
              { label: "Sales Methodology", pct: playbookLoaded ? 90 : 30, color: C.green },
              { label: "Competitor Intel", pct: playbookLoaded ? 85 : 20, color: C.orange },
              { label: "Pricing Guidance", pct: playbookLoaded ? 75 : 15, color: C.yellow },
              { label: "Objection Handling", pct: playbookLoaded ? 80 : 10, color: C.accent },
              { label: "Buyer Personas", pct: playbookLoaded ? 70 : 5, color: C.purple },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{item.label}</span>
                  <span style={{ fontSize: 12, color: item.pct > 60 ? C.green : item.pct > 30 ? C.yellow : C.red }}>{item.pct}%</span>
                </div>
                <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${item.pct}%`, background: item.color, borderRadius: 2, transition: "width 0.6s ease" }} />
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
};

// ─── Dashboard Screen ────────────────────────────────────────────────────────
const DashboardScreen = ({ deals, onDealClick, playbookData, playbookLoaded }) => {
  const totalPipeline = deals.reduce((s, d) => s + parseInt(d.value.replace(/[$,]/g, "")), 0);
  const avgScore = Math.round(deals.reduce((s, d) => s + d.alignmentScore, 0) / deals.length);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Dashboard</h2>
        {playbookLoaded && (
          <div className="fade-in" style={{
            display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
            background: C.greenDim, border: `1px solid rgba(52,211,153,0.3)`, borderRadius: 99,
          }}>
            <span style={{ fontSize: 12 }}>✨</span>
            <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>AI Playbook Active</span>
          </div>
        )}
      </div>

      {/* Playbook insight banner */}
      {playbookLoaded && playbookData && (
        <div className="fade-in" style={{
          padding: "14px 18px", borderRadius: 8, marginBottom: 20,
          background: C.accentDim, border: `1px solid rgba(74,158,255,0.25)`,
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🧠</span>
          <div>
            <div style={{ color: C.accent, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              {playbookData.methodology || "MEDDIC"} Framework Loaded
            </div>
            <div style={{ color: C.muted, fontSize: 12 }}>
              RevOS is now scoring deals against your playbook criteria. {deals.filter(d => d.alignmentScore < 60).length} deals need attention.
            </div>
          </div>
        </div>
      )}

      {/* Pipeline summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Pipeline", value: `$${(totalPipeline/1000).toFixed(0)}K`, color: C.accent },
          { label: "Avg Alignment Score", value: avgScore, color: avgScore >= 70 ? C.green : C.yellow },
          { label: "Deals at Risk", value: deals.filter(d => d.alignmentScore < 60).length, color: C.red },
        ].map(stat => (
          <Card key={stat.label} style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, marginBottom: 4 }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Active Deals */}
      <div style={{ marginBottom: 20 }}>
        <SectionLabel>Active Deals</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {deals.map(deal => (
            <Card key={deal.id} onClick={() => onDealClick(deal)} style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <ScoreRing score={deal.alignmentScore} size={44} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{deal.name}</span>
                    <Badge color={deal.stage === "Discovery" ? "accent" : deal.stage === "Proposal" ? "green" : "yellow"}>
                      {deal.stage}
                    </Badge>
                    {deal.competitor && <Badge color="orange">{deal.competitor}</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {deal.value} · {deal.industry} · {deal.daysInStage}d in stage
                  </div>
                  {/* Show playbook-sourced recommendation if loaded */}
                  {playbookLoaded && deal.recommendations[0] && (
                    <div style={{ marginTop: 6, fontSize: 11, color: C.accent, display: "flex", alignItems: "center", gap: 4 }}>
                      <span>✨</span>
                      <span>{deal.recommendations[0].text}</span>
                    </div>
                  )}
                </div>
                <span style={{ color: C.dim, fontSize: 18 }}>›</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Top Recommendations (only when playbook loaded) */}
      {playbookLoaded && playbookData?.recommendations_for_deals && (
        <div className="fade-in">
          <SectionLabel>AI Recommendations from Playbook</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {playbookData.recommendations_for_deals.slice(0, 3).map((rec, i) => (
              <Card key={i} style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{rec.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: C.text, marginBottom: 3 }}>{rec.text}</div>
                    <div style={{ fontSize: 11, color: C.dim }}>Applies to: {rec.applies_to} stage deals</div>
                  </div>
                  <Badge color={rec.type === "pricing" ? "green" : rec.type === "action" ? "yellow" : "accent"}>{rec.type}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Deal Prep Screen ────────────────────────────────────────────────────────
const DealPrepScreen = ({ deal, onBack, playbookData, playbookLoaded }) => {
  const [tab, setTab] = useState("overview");
  if (!deal) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
      <div>Select a deal from the Dashboard to view prep details</div>
    </div>
  );

  // Merge playbook recommendations into deal
  const allRecs = [...(deal.recommendations || [])];
  if (playbookLoaded && playbookData?.recommendations_for_deals) {
    const relevant = playbookData.recommendations_for_deals.filter(
      r => r.applies_to === deal.stage || r.applies_to === "All"
    );
    relevant.forEach(r => {
      if (!allRecs.find(existing => existing.text === r.text)) allRecs.push(r);
    });
  }

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, marginBottom: 16, fontFamily: "'IBM Plex Sans', sans-serif" }}>
        ← Back
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: "16px 20px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
        <ScoreRing score={deal.alignmentScore} size={52} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>{deal.name}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <Badge color={deal.stage === "Discovery" ? "accent" : deal.stage === "Proposal" ? "green" : "yellow"}>{deal.stage}</Badge>
            <Badge color="accent">{deal.segment}</Badge>
            <Badge color="orange">{deal.industry}</Badge>
            {deal.competitor && <Badge color="red">{deal.competitor}</Badge>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.green }}>{deal.value}</div>
          <div style={{ fontSize: 11, color: C.dim }}>{deal.daysInStage}d in stage</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        {["overview", "recommendations", "contacts"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 16px", border: "none", background: "transparent",
            color: tab === t ? C.accent : C.muted, fontSize: 13, fontWeight: tab === t ? 600 : 400,
            cursor: "pointer", borderBottom: tab === t ? `2px solid ${C.accent}` : "2px solid transparent",
            marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif", textTransform: "capitalize",
          }}>{t} {t === "recommendations" && <span style={{ color: C.accent, fontSize: 11 }}>({allRecs.length})</span>}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <SectionLabel>Risks</SectionLabel>
            {deal.risks.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13, color: C.muted }}>
                <span style={{ color: C.red }}>⚠</span>{r}
              </div>
            ))}
          </Card>
          {playbookLoaded && playbookData?.qualification_framework && (
            <Card className="fade-in">
              <SectionLabel>MEDDIC Checklist (from Playbook)</SectionLabel>
              {playbookData.qualification_framework.slice(0, 6).map((criterion, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: i < 3 ? C.green : C.yellow }}>{i < 3 ? "✓" : "○"}</span>
                  <span style={{ color: i < 3 ? C.muted : C.dim }}>{criterion}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {tab === "recommendations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {allRecs.map((rec, i) => (
            <Card key={i} style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ fontSize: 20 }}>{rec.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: C.text, marginBottom: 8 }}>{rec.text}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...btnStyle(C.accentDim), padding: "5px 12px", fontSize: 11, color: C.accent }}>Apply</button>
                    <button style={{ ...btnStyle("transparent"), padding: "5px 12px", fontSize: 11, color: C.muted, border: `1px solid ${C.border}` }}>Dismiss</button>
                  </div>
                </div>
                <Badge color={rec.type === "pricing" ? "green" : rec.type === "action" ? "yellow" : "accent"}>{rec.type}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "contacts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {deal.contacts.map((c, i) => (
            <Card key={i} style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", background: C.accentDim,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: C.accent, fontWeight: 700, fontSize: 13, flexShrink: 0,
                }}>{c.name.split(" ").map(n => n[0]).join("")}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ color: C.dim, fontSize: 12 }}>{c.role}</div>
                </div>
                <Badge color={c.engagement === "High" ? "green" : c.engagement === "Medium" ? "yellow" : "red"}>{c.engagement}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Ask RevOS Screen ────────────────────────────────────────────────────────
const AskScreen = ({ playbookData, playbookLoaded }) => {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const suggestions = playbookLoaded && playbookData?.ask_suggestions
    ? playbookData.ask_suggestions
    : BASE_ASK_SUGGESTIONS;

  const sendMessage = async (text) => {
    const q = text || query;
    if (!q.trim()) return;
    setQuery("");
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setIsTyping(true);

    try {
      const systemPrompt = playbookLoaded && playbookData
        ? `You are RevOS AI, an intelligent sales assistant. You have been trained on this sales playbook data: ${JSON.stringify(playbookData)}. Answer questions based on this playbook. Be concise, specific, and actionable. Reference specific playbook details when relevant.`
        : "You are RevOS AI, an intelligent sales assistant. Answer sales questions concisely and helpfully. Note that no playbook has been uploaded yet, so give general best-practice advice.";

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            ...messages.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
            { role: "user", content: q }
          ],
        }),
      });
      const data = await response.json();
      const reply = data.content?.map(b => b.text || "").join("") || "I couldn't find an answer. Try rephrasing.";
      setMessages(prev => [...prev, {
        role: "assistant", text: reply,
        source: playbookLoaded ? "Sales Playbook" : null,
        confidence: playbookLoaded ? "High" : "Medium",
      }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", text: "Connection error. Please try again.", source: null }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>Ask RevOS</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ fontSize: 13, color: C.muted }}>Query your sales knowledge base</p>
          {playbookLoaded && <Badge color="green">✓ Playbook Loaded</Badge>}
          {!playbookLoaded && <Badge color="yellow">No Playbook</Badge>}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
        {messages.length === 0 && (
          <div style={{ paddingTop: 20 }}>
            {!playbookLoaded && (
              <div style={{
                padding: "14px 16px", borderRadius: 8, marginBottom: 20,
                background: C.yellowDim, border: `1px solid rgba(251,191,36,0.3)`,
                fontSize: 13, color: C.muted,
              }}>
                💡 <strong style={{ color: C.yellow }}>Upload a playbook</strong> in Documents to get answers grounded in your specific sales methodology, competitors, and pricing.
              </div>
            )}
            <SectionLabel>Suggested Questions</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)} style={{
                  textAlign: "left", padding: "10px 14px", borderRadius: 6,
                  background: "transparent", border: `1px solid ${C.border}`, color: C.muted,
                  fontSize: 13, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif",
                  transition: "all 0.12s",
                }}
                  onMouseEnter={e => { e.target.style.borderColor = C.accent; e.target.style.color = C.text; }}
                  onMouseLeave={e => { e.target.style.borderColor = C.border; e.target.style.color = C.muted; }}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="fade-in" style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "78%", padding: "10px 14px", borderRadius: 10,
              background: msg.role === "user" ? C.accent : C.surface,
              color: msg.role === "user" ? "#fff" : C.text,
              fontSize: 13, lineHeight: 1.55,
              borderBottomRightRadius: msg.role === "user" ? 4 : 10,
              borderBottomLeftRadius: msg.role === "assistant" ? 4 : 10,
              border: msg.role === "assistant" ? `1px solid ${C.border}` : "none",
            }}>
              {msg.text}
              {msg.source && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.dim }}>
                  📚 Source: {msg.source} · Confidence: <span style={{ color: msg.confidence === "High" ? C.green : C.yellow }}>{msg.confidence}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "12px 16px", background: C.surface, borderRadius: 10, borderBottomLeftRadius: 4, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.muted, animation: `pulse 1s ${i*0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder={playbookLoaded ? "Ask about your playbook, deals, or methodology..." : "Ask a sales question..."}
          style={{
            flex: 1, padding: "10px 14px", background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 6, color: C.text, fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif",
            outline: "none",
          }}
        />
        <button onClick={() => sendMessage()} style={{ ...btnStyle(C.accent), flexShrink: 0 }}>Send</button>
      </div>
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("dashboard");
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [deals, setDeals] = useState(BASE_DEALS);
  const [docs, setDocs] = useState(BASE_DOCS);
  const [playbookData, setPlaybookData] = useState(null);
  const [playbookLoaded, setPlaybookLoaded] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);

  const handlePlaybookExtracted = (data, filename) => {
    setPlaybookData(data);
    setPlaybookLoaded(true);
    setJustUploaded(true);
    setTimeout(() => setJustUploaded(false), 5000);

    // Add new doc to list
    setDocs(prev => [...prev, {
      id: Date.now(),
      name: filename,
      pages: Math.floor(Math.random() * 30) + 10,
      chunks: Math.floor(Math.random() * 100) + 50,
      uploaded: "Just now",
      status: "active",
    }]);

    // Update deals with playbook recommendations
    if (data.recommendations_for_deals) {
      setDeals(prev => prev.map(deal => {
        const relevant = data.recommendations_for_deals.filter(
          r => r.applies_to === deal.stage || r.applies_to === "All"
        );
        return {
          ...deal,
          alignmentScore: Math.min(100, deal.alignmentScore + Math.floor(Math.random() * 15) + 5),
          recommendations: [...deal.recommendations, ...relevant].slice(0, 5),
        };
      }));
    }

    // Navigate to dashboard after short delay
    setTimeout(() => setScreen("dashboard"), 300);
  };

  const navItems = [
    { id: "dashboard", icon: "⊞", label: "Dashboard" },
    { id: "deal-prep", icon: "📋", label: "Deal Prep", disabled: !selectedDeal },
    { id: "ask", icon: "💬", label: "Ask RevOS" },
    { id: "documents", icon: "📂", label: "Documents" },
  ];

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, color: C.text, background: C.bg, minHeight: "100vh", display: "flex" }}>
      <GlobalStyle />

      {/* Sidebar */}
      <div style={{
        width: navCollapsed ? 60 : 220, flexShrink: 0,
        background: C.surface, borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column", padding: "0 8px",
        transition: "width 0.2s ease", overflow: "hidden",
        position: "sticky", top: 0, height: "100vh",
      }}>
        {/* Logo */}
        <div
          onClick={() => setNavCollapsed(p => !p)}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 8px 16px", cursor: "pointer", borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, background: C.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 14, color: "#fff", flexShrink: 0,
          }}>R</div>
          {!navCollapsed && <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>RevOS</span>}
          {!navCollapsed && playbookLoaded && (
            <span style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: C.green, flexShrink: 0 }} title="Playbook active" />
          )}
        </div>

        {navItems.map(item => (
          <NavItem key={item.id} icon={item.icon} label={item.label}
            active={screen === item.id} disabled={item.disabled}
            collapsed={navCollapsed}
            onClick={() => setScreen(item.id)} />
        ))}

        {/* Bottom */}
        {!navCollapsed && (
          <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${C.border}`, paddingBottom: 16 }}>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 6, padding: "0 8px" }}>
              Free Plan · {docs.length}/5 docs
            </div>
            <div style={{ height: 3, background: C.border, borderRadius: 2, margin: "0 8px 10px" }}>
              <div style={{ height: "100%", width: `${(docs.length/5)*100}%`, background: C.accent, borderRadius: 2, transition: "width 0.4s" }} />
            </div>
            {playbookLoaded && (
              <div style={{ padding: "6px 8px", fontSize: 11, color: C.green, display: "flex", alignItems: "center", gap: 5 }}>
                <span>✓</span><span>AI Playbook Active</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 32px" }}>
          {/* Upload nudge banner (only when no playbook and on dashboard) */}
          {!playbookLoaded && screen === "dashboard" && (
            <div style={{
              padding: "12px 16px", borderRadius: 8, marginBottom: 20,
              background: C.purpleDim, border: `1px solid rgba(167,139,250,0.3)`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>🚀</span>
                <span style={{ fontSize: 13, color: C.muted }}>Upload your sales playbook to activate AI-powered deal scoring and recommendations.</span>
              </div>
              <button onClick={() => setScreen("documents")} style={{ ...btnStyle(C.purple), fontSize: 12, padding: "6px 14px", flexShrink: 0 }}>
                Upload Playbook
              </button>
            </div>
          )}

          {screen === "dashboard" && (
            <DashboardScreen deals={deals} onDealClick={(d) => { setSelectedDeal(d); setScreen("deal-prep"); }}
              playbookData={playbookData} playbookLoaded={playbookLoaded} />
          )}
          {screen === "deal-prep" && (
            <DealPrepScreen deal={selectedDeal} onBack={() => setScreen("dashboard")}
              playbookData={playbookData} playbookLoaded={playbookLoaded} />
          )}
          {screen === "ask" && (
            <AskScreen playbookData={playbookData} playbookLoaded={playbookLoaded} />
          )}
          {screen === "documents" && (
            <DocumentsScreen docs={docs} onPlaybookExtracted={handlePlaybookExtracted} playbookLoaded={playbookLoaded} />
          )}
        </div>
      </div>
    </div>
  );
}
