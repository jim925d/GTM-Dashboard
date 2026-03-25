import { useState, useCallback, useEffect, useRef } from "react";

// ─── DESIGN TOKENS (matching existing seller view) ──────────────
const C = {
  bg: "#0f1117",
  surface: "#181b23",
  surfaceHover: "#1e2231",
  border: "#2a2e3b",
  borderLight: "#363b4a",
  text: "#e2e4e9",
  textMuted: "#8b8f9a",
  textDim: "#5a5e6b",
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
  teal: "#2dd4bf",
  tealDim: "rgba(45,212,191,0.12)",
};

// ─── MOCK DATA: Accounts with locations ─────────────────────────
const ACCOUNTS = [
  {
    id: "acct_001", name: "Meridian Telecom", industry: "Telecommunications",
    revenue: "$2.4B", employees: 12000, hq: "Dallas, TX", ticker: "MRDN",
    website: "meridiantelecom.example.com",
    existingLocations: [
      { id: "l01", address: "2100 McKinney Ave, Dallas, TX 75201", type: "HQ", lat: 32.7942, lng: -96.8005, source: "CRM", confidence: 1.0 },
      { id: "l02", address: "500 W 2nd St, Austin, TX 78701", type: "Regional Office", lat: 30.2672, lng: -97.7431, source: "CRM", confidence: 1.0 },
    ],
  },
  {
    id: "acct_002", name: "Pacific Networks Inc.", industry: "Network Infrastructure",
    revenue: "$890M", employees: 4200, hq: "Seattle, WA", ticker: "PNET",
    website: "pacificnetworks.example.com",
    existingLocations: [
      { id: "l10", address: "1200 3rd Ave, Seattle, WA 98101", type: "HQ", lat: 47.6062, lng: -122.3321, source: "CRM", confidence: 1.0 },
    ],
  },
  {
    id: "acct_003", name: "Stratos Communications", industry: "Fiber Optic Services",
    revenue: "$1.7B", employees: 8500, hq: "Denver, CO", ticker: "STRC",
    website: "stratoscom.example.com",
    existingLocations: [
      { id: "l20", address: "1801 California St, Denver, CO 80202", type: "HQ", lat: 39.7479, lng: -104.9872, source: "CRM", confidence: 1.0 },
      { id: "l21", address: "100 S Charles St, Baltimore, MD 21201", type: "NOC", lat: 39.2871, lng: -76.6148, source: "CRM", confidence: 1.0 },
      { id: "l22", address: "311 S Wacker Dr, Chicago, IL 60606", type: "Regional Office", lat: 41.8781, lng: -87.6298, source: "CRM", confidence: 1.0 },
    ],
  },
];

const ENRICHMENT_RESULTS = {
  acct_001: {
    google_places: [
      { address: "4055 Valley View Ln, Dallas, TX 75244", type: "Data Center", lat: 32.9185, lng: -96.8394, confidence: 0.92, source: "Google Places" },
      { address: "1700 Pacific Ave, Dallas, TX 75201", type: "Office", lat: 32.7839, lng: -96.7969, confidence: 0.88, source: "Google Places" },
      { address: "10100 Reunion Place, San Antonio, TX 78216", type: "Field Office", lat: 29.5193, lng: -98.4823, confidence: 0.76, source: "Google Places" },
      { address: "3300 N A St, Midland, TX 79705", type: "Field Office", lat: 32.0345, lng: -102.1077, confidence: 0.68, source: "Google Places" },
    ],
    web_scrape: [
      { address: "600 Congress Ave, Austin, TX 78701", type: "Regional Sales", lat: 30.2687, lng: -97.7404, confidence: 0.85, source: "Web Scrape" },
      { address: "1 Galleria Tower, Houston, TX 77056", type: "Office", lat: 29.7358, lng: -95.4613, confidence: 0.82, source: "Web Scrape" },
      { address: "100 Peach St, El Paso, TX 79901", type: "Warehouse", lat: 31.7587, lng: -106.4869, confidence: 0.71, source: "Web Scrape" },
    ],
    sec_edgar: [
      { address: "5001 LBJ Freeway, Dallas, TX 75244", type: "Leased Property", lat: 32.9300, lng: -96.8200, confidence: 0.95, source: "SEC/EDGAR" },
      { address: "9442 Capital of TX Hwy, Austin, TX 78759", type: "Leased Property", lat: 30.3882, lng: -97.7466, confidence: 0.90, source: "SEC/EDGAR" },
    ],
  },
  acct_002: {
    google_places: [
      { address: "700 5th Ave, Seattle, WA 98104", type: "Office", lat: 47.6048, lng: -122.3299, confidence: 0.91, source: "Google Places" },
      { address: "1100 Dexter Ave N, Seattle, WA 98109", type: "Lab", lat: 47.6315, lng: -122.3429, confidence: 0.84, source: "Google Places" },
      { address: "121 SW Morrison St, Portland, OR 97204", type: "Office", lat: 45.5187, lng: -122.6787, confidence: 0.79, source: "Google Places" },
    ],
    web_scrape: [
      { address: "400 S 4th St, San Jose, CA 95112", type: "Engineering", lat: 37.3352, lng: -121.8919, confidence: 0.86, source: "Web Scrape" },
      { address: "2001 6th Ave, Seattle, WA 98121", type: "Data Center", lat: 47.6149, lng: -122.3401, confidence: 0.80, source: "Web Scrape" },
    ],
    sec_edgar: [
      { address: "500 Yale Ave N, Seattle, WA 98109", type: "Leased Property", lat: 47.6267, lng: -122.3316, confidence: 0.93, source: "SEC/EDGAR" },
    ],
  },
  acct_003: {
    google_places: [
      { address: "1600 Stout St, Denver, CO 80202", type: "Office", lat: 39.7469, lng: -104.9945, confidence: 0.94, source: "Google Places" },
      { address: "8000 E Maplewood Ave, Greenwood Village, CO 80111", type: "Data Center", lat: 39.6166, lng: -104.8988, confidence: 0.89, source: "Google Places" },
      { address: "200 Vesey St, New York, NY 10281", type: "Office", lat: 40.7128, lng: -74.0162, confidence: 0.83, source: "Google Places" },
      { address: "2600 Michelson Dr, Irvine, CA 92612", type: "Office", lat: 33.6778, lng: -117.8395, confidence: 0.77, source: "Google Places" },
    ],
    web_scrape: [
      { address: "1 Federal St, Boston, MA 02110", type: "Sales Office", lat: 42.3554, lng: -71.0566, confidence: 0.81, source: "Web Scrape" },
      { address: "555 11th St NW, Washington, DC 20004", type: "Gov Sales", lat: 38.8977, lng: -77.0268, confidence: 0.78, source: "Web Scrape" },
      { address: "191 Peachtree St, Atlanta, GA 30303", type: "Regional Office", lat: 33.7590, lng: -84.3880, confidence: 0.85, source: "Web Scrape" },
    ],
    sec_edgar: [
      { address: "7900 Westpark Dr, McLean, VA 22102", type: "Leased Property", lat: 38.9233, lng: -77.2280, confidence: 0.96, source: "SEC/EDGAR" },
      { address: "125 S Wacker Dr, Chicago, IL 60606", type: "Leased Property", lat: 41.8783, lng: -87.6365, confidence: 0.91, source: "SEC/EDGAR" },
    ],
  },
};

// ─── MOCK DATA: Deals, Playbook, Q&A (existing pages) ──────────
const MOCK_DEALS = [
  { id: 1, name: "Meridian — Enterprise SD-WAN", account: "Meridian Telecom", stage: "Propose", value: 42000, score: 78, trend: [62, 65, 70, 74, 78], risk: "medium", daysInStage: 14 },
  { id: 2, name: "Pacific — Dark Fiber Buildout", account: "Pacific Networks Inc.", stage: "Negotiate", value: 128000, score: 85, trend: [71, 75, 80, 83, 85], risk: "low", daysInStage: 7 },
  { id: 3, name: "Stratos — Managed NOC Expansion", account: "Stratos Communications", stage: "Discover", value: 67000, score: 45, trend: [50, 52, 48, 46, 45], risk: "high", daysInStage: 31 },
  { id: 4, name: "Meridian — UCaaS Migration", account: "Meridian Telecom", stage: "Design", value: 35000, score: 62, trend: [55, 58, 60, 61, 62], risk: "medium", daysInStage: 21 },
  { id: 5, name: "Pacific — DIA Refresh", account: "Pacific Networks Inc.", stage: "Propose", value: 18000, score: 71, trend: [60, 63, 66, 69, 71], risk: "low", daysInStage: 10 },
];

// ─── SHARED COMPONENTS (matching seller view) ───────────────────
function Badge({ children, color = "accent" }) {
  const c = C[color] || C.accent;
  const bg = C[color + "Dim"] || C.accentDim;
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 4,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.03em",
      color: c, background: bg, textTransform: "uppercase",
    }}>{children}</span>
  );
}

function ScoreRing({ score, size = 48 }) {
  const color = score >= 80 ? C.green : score >= 60 ? C.yellow : C.red;
  const r = (size - 8) / 2;
  const circumference = Math.PI * 2 * r;
  const offset = circumference * (1 - score / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.3, fontWeight: 700, color }}>{score}</div>
    </div>
  );
}

function Card({ children, onClick, style: s }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: C.surface, border: `1px solid ${hov && onClick ? C.borderLight : C.border}`,
        borderRadius: 8, padding: 20, cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s", ...s,
      }}
    >{children}</div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>{children}</div>;
}

function NavItem({ icon, label, active, onClick, collapsed, badge }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%",
        padding: collapsed ? "10px 0" : "9px 12px",
        justifyContent: collapsed ? "center" : "flex-start",
        border: "none", borderRadius: 6,
        background: active ? C.accentDim : hov ? C.surfaceHover : "transparent",
        color: active ? C.accent : hov ? C.text : C.textMuted,
        fontSize: 13, fontWeight: active ? 600 : 400,
        cursor: "pointer", transition: "all 0.12s",
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      <span style={{ fontSize: 15, flexShrink: 0, width: 20, textAlign: "center" }}>{icon}</span>
      {!collapsed && <span style={{ flex: 1, textAlign: "left" }}>{label}</span>}
      {!collapsed && badge > 0 && (
        <span style={{
          minWidth: 18, height: 18, borderRadius: 99, background: C.redDim,
          color: C.red, fontSize: 10, fontWeight: 700, display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>{badge}</span>
      )}
    </button>
  );
}

function Spark({ data, width = 60, height = 20, color = C.accent }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  return <svg width={width} height={height}><polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

// ─── ENRICHMENT ENGINE (simulated async) ────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function enrichFromGooglePlaces(accountId, onProgress) {
  onProgress("google_places", "running", "Searching Google Places API...");
  await sleep(1200 + Math.random() * 800);
  const results = ENRICHMENT_RESULTS[accountId]?.google_places || [];
  onProgress("google_places", "done", `Found ${results.length} locations`);
  return results;
}

async function enrichFromWebScrape(accountId, onProgress) {
  onProgress("web_scrape", "running", "Crawling company website...");
  await sleep(1800 + Math.random() * 1200);
  const results = ENRICHMENT_RESULTS[accountId]?.web_scrape || [];
  onProgress("web_scrape", "done", `Extracted ${results.length} locations`);
  return results;
}

async function enrichFromSEC(accountId, onProgress) {
  onProgress("sec_edgar", "running", "Querying SEC EDGAR filings...");
  await sleep(2200 + Math.random() * 1000);
  const results = ENRICHMENT_RESULTS[accountId]?.sec_edgar || [];
  onProgress("sec_edgar", "done", `Found ${results.length} property disclosures`);
  return results;
}

function deduplicateLocations(existing, discovered) {
  const seen = new Set(existing.map((l) => `${l.lat.toFixed(2)},${l.lng.toFixed(2)}`));
  const unique = [];
  for (const loc of discovered) {
    const key = `${loc.lat.toFixed(2)},${loc.lng.toFixed(2)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({ ...loc, id: `loc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, isNew: true });
    }
  }
  return unique;
}

function computeBayesianSignals(existingCount, newCount, locations) {
  const total = existingCount + newCount;
  const states = new Set(locations.map((l) => l.address?.match(/,\s*([A-Z]{2})\s/)?.[1]).filter(Boolean));
  const hasDataCenter = locations.some((l) => l.type?.toLowerCase().includes("data center"));
  return {
    footprintSize: total,
    geographicSpread: states.size,
    growthSignal: newCount > 0 ? +(newCount / Math.max(existingCount, 1)).toFixed(2) : 0,
    hasDataCenters: hasDataCenter,
    expansionProbability: Math.min(0.95, 0.3 + states.size * 0.08 + (hasDataCenter ? 0.15 : 0) + newCount * 0.03),
  };
}

// ─── LOCATIONS SCREEN ───────────────────────────────────────────
function SourceRow({ name, icon, status, message }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
      background: C.surface, borderRadius: 6, border: `1px solid ${status === "done" ? C.tealDim.replace("0.12", "0.3") : C.border}`,
      transition: "border-color 0.3s",
    }}>
      <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{name}</div>
        <div style={{ fontSize: 11, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {message || "Ready"}
        </div>
      </div>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 10px", borderRadius: 99, fontSize: 10, fontWeight: 600,
        letterSpacing: "0.03em", textTransform: "uppercase",
        background: status === "done" ? C.greenDim : status === "running" ? C.accentDim : C.border + "60",
        color: status === "done" ? C.green : status === "running" ? C.accent : C.textDim,
      }}>
        {status === "running" && <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.accent, animation: "pulse 1s ease-in-out infinite" }} />}
        {status === "done" ? "done" : status === "running" ? "scanning" : "idle"}
      </span>
    </div>
  );
}

function SignalCard({ label, value, color, sub }) {
  return (
    <div style={{ padding: "12px 14px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function MiniMap({ locations }) {
  if (!locations.length) return null;
  const lats = locations.map((l) => l.lat);
  const lngs = locations.map((l) => l.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const padLat = Math.max((maxLat - minLat) * 0.15, 0.5);
  const padLng = Math.max((maxLng - minLng) * 0.15, 0.5);
  const W = 600, H = 220;
  const toX = (lng) => ((lng - (minLng - padLng)) / ((maxLng + padLng) - (minLng - padLng))) * W;
  const toY = (lat) => H - ((lat - (minLat - padLat)) / ((maxLat + padLat) - (minLat - padLat))) * H;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ borderRadius: 8, background: C.bg, border: `1px solid ${C.border}` }}>
      {[0.25, 0.5, 0.75].map((f) => (
        <g key={f}>
          <line x1={0} y1={H * f} x2={W} y2={H * f} stroke={C.border} strokeWidth={0.5} />
          <line x1={W * f} y1={0} x2={W * f} y2={H} stroke={C.border} strokeWidth={0.5} />
        </g>
      ))}
      {locations.map((loc, i) => (
        <g key={i}>
          {loc.isNew && <circle cx={toX(loc.lng)} cy={toY(loc.lat)} r={10} fill={C.accent} opacity={0.15} />}
          <circle cx={toX(loc.lng)} cy={toY(loc.lat)} r={loc.isNew ? 4.5 : 3.5}
            fill={loc.isNew ? C.accent : C.teal} stroke={C.bg} strokeWidth={1.5} />
        </g>
      ))}
      <circle cx={14} cy={H - 16} r={3.5} fill={C.teal} />
      <text x={22} y={H - 12} fill={C.textDim} fontSize={9} fontFamily="'IBM Plex Sans', sans-serif">Existing</text>
      <circle cx={80} cy={H - 16} r={4.5} fill={C.accent} />
      <text x={88} y={H - 12} fill={C.textDim} fontSize={9} fontFamily="'IBM Plex Sans', sans-serif">Discovered</text>
    </svg>
  );
}

function LocationsScreen() {
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [sourceStatus, setSourceStatus] = useState({ google_places: { status: "idle", message: "" }, web_scrape: { status: "idle", message: "" }, sec_edgar: { status: "idle", message: "" } });
  const [discoveredLocations, setDiscoveredLocations] = useState([]);
  const [enrichmentComplete, setEnrichmentComplete] = useState(false);
  const [bayesianSignals, setBayesianSignals] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [merged, setMerged] = useState(false);
  const [confirmMerge, setConfirmMerge] = useState(false);

  const account = ACCOUNTS.find((a) => a.id === selectedAccount);

  const resetEnrichment = useCallback(() => {
    setSourceStatus({ google_places: { status: "idle", message: "" }, web_scrape: { status: "idle", message: "" }, sec_edgar: { status: "idle", message: "" } });
    setDiscoveredLocations([]); setEnrichmentComplete(false); setBayesianSignals(null); setConfirmMerge(false); setMerged(false);
  }, []);

  const runEnrichment = useCallback(async () => {
    if (!account) return;
    resetEnrichment(); setEnriching(true);
    const onProgress = (src, status, message) => setSourceStatus((p) => ({ ...p, [src]: { status, message } }));
    const [gp, ws, sec] = await Promise.all([
      enrichFromGooglePlaces(account.id, onProgress),
      enrichFromWebScrape(account.id, onProgress),
      enrichFromSEC(account.id, onProgress),
    ]);
    const unique = deduplicateLocations(account.existingLocations, [...gp, ...ws, ...sec]);
    setDiscoveredLocations(unique);
    const all = [...account.existingLocations, ...unique];
    setBayesianSignals(computeBayesianSignals(account.existingLocations.length, unique.length, all));
    setEnriching(false); setEnrichmentComplete(true);
  }, [account, resetEnrichment]);

  const allLocations = account ? [...account.existingLocations.map((l) => ({ ...l, isNew: false })), ...discoveredLocations] : [];
  const filtered = activeTab === "all" ? allLocations : activeTab === "new" ? discoveredLocations : account?.existingLocations.map((l) => ({ ...l, isNew: false })) || [];

  // ─── Account List ─────
  if (!selectedAccount) {
    return (
      <div>
        <SectionLabel>Select an account to enrich</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ACCOUNTS.map((acct) => (
            <Card key={acct.id} onClick={() => { setSelectedAccount(acct.id); resetEnrichment(); setActiveTab("all"); }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                  background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, color: C.accent,
                }}>
                  {acct.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>{acct.name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{acct.industry} · {acct.hq} · {acct.revenue}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.teal }}>{acct.existingLocations.length}</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>locations</div>
                </div>
                <span style={{ color: C.textDim, fontSize: 16 }}>→</span>
              </div>
            </Card>
          ))}
        </div>

        {/* Deal cross-reference */}
        <div style={{ marginTop: 24 }}>
          <SectionLabel>Active deals by account</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {MOCK_DEALS.map((deal) => (
              <div key={deal.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "8px 14px",
                background: C.surface, borderRadius: 6, border: `1px solid ${C.border}`,
              }}>
                <ScoreRing score={deal.score} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{deal.name}</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>${(deal.value / 1000).toFixed(0)}K MRR · {deal.daysInStage}d in {deal.stage}</div>
                </div>
                <Badge color={deal.risk === "high" ? "red" : deal.risk === "medium" ? "yellow" : "green"}>{deal.risk}</Badge>
                <Spark data={deal.trend} color={deal.trend[4] > deal.trend[0] ? C.green : C.red} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Account Detail + Enrichment ─────
  return (
    <div>
      {/* Back + header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => { setSelectedAccount(null); resetEnrichment(); }}
          style={{
            background: "none", border: `1px solid ${C.border}`, borderRadius: 6,
            padding: "5px 10px", color: C.textMuted, cursor: "pointer", fontSize: 12,
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        >← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{account.name}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>{account.industry} · {account.hq} · {account.revenue} · {account.employees.toLocaleString()} employees</div>
        </div>
        <Badge color="accent">{account.ticker}</Badge>
      </div>

      {/* Enrich button */}
      <button
        onClick={runEnrichment}
        disabled={enriching}
        style={{
          width: "100%", padding: "12px 16px", borderRadius: 8, border: "none",
          background: enriching ? C.accentDim : C.accent,
          color: enriching ? C.accent : C.bg,
          fontSize: 13, fontWeight: 600, cursor: enriching ? "not-allowed" : "pointer",
          opacity: enriching ? 0.7 : 1, transition: "all 0.2s",
          fontFamily: "'IBM Plex Sans', sans-serif", letterSpacing: "0.01em",
          marginBottom: 16,
        }}
      >
        {enriching ? "Enrichment in progress..." : enrichmentComplete ? "↻ Re-run enrichment" : "⚡  Enrich locations"}
      </button>

      {/* Source progress */}
      {(enriching || enrichmentComplete) && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>Data sources</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <SourceRow name="Google Places API" icon="📍" status={sourceStatus.google_places.status} message={sourceStatus.google_places.message} />
            <SourceRow name="Web scraper (Claude)" icon="🕸" status={sourceStatus.web_scrape.status} message={sourceStatus.web_scrape.message} />
            <SourceRow name="SEC / EDGAR" icon="📄" status={sourceStatus.sec_edgar.status} message={sourceStatus.sec_edgar.message} />
          </div>
        </div>
      )}

      {/* Bayesian signals */}
      {bayesianSignals && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>Bayesian engine signals</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
            <SignalCard label="Footprint" value={bayesianSignals.footprintSize} color={C.teal} sub="total locations" />
            <SignalCard label="Geo spread" value={`${bayesianSignals.geographicSpread}`} color={C.accent} sub="unique states" />
            <SignalCard label="Growth" value={`${bayesianSignals.growthSignal}x`} color={bayesianSignals.growthSignal > 1 ? C.green : C.yellow} sub="new / existing" />
            <SignalCard label="Data centers" value={bayesianSignals.hasDataCenters ? "Yes" : "No"} color={bayesianSignals.hasDataCenters ? C.green : C.textDim} sub="infra signal" />
            <SignalCard label="Expansion" value={`${Math.round(bayesianSignals.expansionProbability * 100)}%`} color={C.purple} sub="probability" />
          </div>
        </div>
      )}

      {/* Map */}
      {allLocations.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>Location map</SectionLabel>
          <MiniMap locations={allLocations} />
        </div>
      )}

      {/* Location table */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 2 }}>
            {[
              { key: "all", label: `All (${allLocations.length})` },
              { key: "existing", label: `Existing (${account.existingLocations.length})` },
              ...(discoveredLocations.length ? [{ key: "new", label: `New (${discoveredLocations.length})` }] : []),
            ].map((tab) => (
              <button
                key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "5px 12px", borderRadius: 6, border: "none",
                  background: activeTab === tab.key ? C.accentDim : "transparent",
                  color: activeTab === tab.key ? C.accent : C.textMuted,
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                }}
              >{tab.label}</button>
            ))}
          </div>
          {enrichmentComplete && discoveredLocations.length > 0 && !merged && (
            <button
              onClick={() => setConfirmMerge(true)}
              style={{
                padding: "5px 14px", borderRadius: 6, border: `1px solid ${C.green}40`,
                background: C.greenDim, color: C.green, fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >Merge {discoveredLocations.length} into account</button>
          )}
          {merged && <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>✓ Merged into account</span>}
        </div>

        {/* Confirm merge */}
        {confirmMerge && (
          <div style={{
            padding: 14, background: C.accentDim, borderRadius: 8,
            border: `1px solid ${C.accent}30`, marginBottom: 10,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 2 }}>Confirm merge</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>Add {discoveredLocations.length} locations to {account.name} and update Bayesian priors.</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setConfirmMerge(false)} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 11, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>Cancel</button>
              <button onClick={() => { setMerged(true); setConfirmMerge(false); }} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: C.green, color: C.bg, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>Confirm</button>
            </div>
          </div>
        )}

        {/* Table */}
        <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", color: C.textDim, fontSize: 12 }}>
              {enrichmentComplete ? "No locations in this filter" : "Run enrichment to discover new locations"}
            </div>
          ) : filtered.map((loc, i) => (
            <div key={loc.id || i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
              borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none",
              background: loc.isNew ? "rgba(74,158,255,0.04)" : "transparent",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: loc.isNew ? C.accent : C.teal, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{loc.address}</div>
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 1 }}>
                  {loc.type} · {loc.source}
                  {loc.confidence != null && (
                    <span style={{ marginLeft: 8, color: loc.confidence >= 0.85 ? C.green : loc.confidence >= 0.7 ? C.yellow : C.orange }}>
                      {Math.round(loc.confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>
              {loc.isNew && <Badge color="accent">new</Badge>}
            </div>
          ))}
        </div>
      </div>

      {/* API route info */}
      {enrichmentComplete && (
        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Integration endpoint</div>
          <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.7, fontFamily: "monospace" }}>
            POST /api/accounts/{account.id}/enrich-locations<br />
            → Google Places (BYOK) + Web Scrape (Claude) + SEC/EDGAR<br />
            → PATCH /api/accounts/{account.id}/locations
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── PLACEHOLDER SCREENS ────────────────────────────────────────
function DashboardScreen({ onDealClick }) {
  return (
    <div>
      <SectionLabel>Pipeline overview</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Pipeline", value: "$290K", color: C.accent },
          { label: "Avg score", value: "68", color: C.yellow },
          { label: "Win rate", value: "62%", color: C.green },
          { label: "At risk", value: "1", color: C.red },
        ].map((kpi) => (
          <Card key={kpi.label} style={{ padding: 14 }}>
            <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </Card>
        ))}
      </div>

      <SectionLabel>Active deals</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {MOCK_DEALS.map((deal) => (
          <Card key={deal.id} onClick={() => onDealClick(deal)} style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ScoreRing score={deal.score} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{deal.name}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>${(deal.value / 1000).toFixed(0)}K MRR · {deal.stage} · {deal.daysInStage}d</div>
              </div>
              <Spark data={deal.trend} width={50} height={18} color={deal.trend[4] > deal.trend[0] ? C.green : C.red} />
              <Badge color={deal.risk === "high" ? "red" : deal.risk === "medium" ? "yellow" : "green"}>{deal.risk}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DealPrepScreen({ deal, onBack }) {
  if (!deal) return <div style={{ padding: 40, textAlign: "center", color: C.textDim }}>Select a deal from Dashboard</div>;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 10px", color: C.textMuted, cursor: "pointer", fontSize: 12, fontFamily: "'IBM Plex Sans', sans-serif" }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{deal.name}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>${(deal.value / 1000).toFixed(0)}K MRR · {deal.stage} · {deal.daysInStage} days</div>
        </div>
        <ScoreRing score={deal.score} size={44} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Card style={{ padding: 14 }}><SectionLabel>Alignment analysis</SectionLabel><div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>Game theory analysis and alignment scoring would render here — connected to the Bayesian engine priors for this account.</div></Card>
        <Card style={{ padding: 14 }}><SectionLabel>Next best actions</SectionLabel><div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>AI-recommended next steps based on deal stage, risk signals, and playbook compliance patterns.</div></Card>
      </div>
    </div>
  );
}

function AskScreen() {
  const [input, setInput] = useState("");
  return (
    <div>
      <SectionLabel>Ask RevOS</SectionLabel>
      <Card style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about deals, playbooks, competitors..."
            style={{
              flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: "8px 12px", color: C.text, fontSize: 13, outline: "none",
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          />
          <button style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: C.accent, color: C.bg, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" }}>Ask</button>
        </div>
      </Card>
      <div style={{ fontSize: 12, color: C.textDim, textAlign: "center", padding: 40 }}>AI-powered Q&A against your playbooks and deal history</div>
    </div>
  );
}

function DocumentsScreen() {
  return (
    <div>
      <SectionLabel>Documents</SectionLabel>
      <Card style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ border: `2px dashed ${C.border}`, borderRadius: 8, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>Drop files here or click to upload</div>
          <div style={{ fontSize: 11, color: C.textDim }}>PDF, PPTX, XLSX, DOCX</div>
        </div>
      </Card>
      <SectionLabel>Processed documents</SectionLabel>
      <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        {[
          { name: "Q1 Sales Playbook v3.2.pdf", pages: 47, status: "processed", chunks: 124 },
          { name: "Enterprise Pricing Matrix.xlsx", pages: 8, status: "processed", chunks: 32 },
          { name: "Competitor X Battle Card.pptx", pages: 12, status: "processed", chunks: 28 },
        ].map((doc, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: i < 2 ? `1px solid ${C.border}` : "none" }}>
            <span style={{ color: C.textDim }}>📄</span>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: C.text }}>{doc.name}</div><div style={{ fontSize: 10, color: C.textDim }}>{doc.pages} pages · {doc.chunks} chunks</div></div>
            <Badge color="green">{doc.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP SHELL ─────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard", icon: "◻", label: "Dashboard" },
  { id: "deal-prep", icon: "◎", label: "Deal Prep" },
  { id: "locations", icon: "◈", label: "Locations" },
  { id: "ask", icon: "◇", label: "Ask RevOS" },
  { id: "documents", icon: "▤", label: "Documents" },
];

export default function RevOSSellerView() {
  const [currentScreen, setCurrentScreen] = useState("dashboard");
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [navCollapsed, setNavCollapsed] = useState(false);

  const handleDealClick = (deal) => { setSelectedDeal(deal); setCurrentScreen("deal-prep"); };
  const handleDealBack = () => { setCurrentScreen("dashboard"); };

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.text, fontFamily: "'IBM Plex Sans', sans-serif", overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{
        width: navCollapsed ? 60 : 220, flexShrink: 0,
        display: "flex", flexDirection: "column",
        borderRight: `1px solid ${C.border}`,
        background: C.surface, transition: "width 0.2s ease",
        overflow: "hidden",
      }}>
        {/* Logo */}
        <div
          onClick={() => setNavCollapsed(!navCollapsed)}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: navCollapsed ? "16px 0" : "16px 16px",
            justifyContent: navCollapsed ? "center" : "flex-start",
            cursor: "pointer", borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 6, background: C.accentDim,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: C.accent, fontWeight: 800, fontSize: 14, flexShrink: 0,
          }}>R</div>
          {!navCollapsed && <span style={{ fontWeight: 700, fontSize: 14, color: C.text, letterSpacing: "-0.02em" }}>RevOS</span>}
        </div>

        {/* Nav items */}
        <div style={{ padding: navCollapsed ? "12px 8px" : "12px", display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id} icon={item.icon} label={item.label}
              active={currentScreen === item.id}
              collapsed={navCollapsed}
              onClick={() => setCurrentScreen(item.id)}
            />
          ))}
        </div>

        {/* Bottom */}
        {!navCollapsed && (
          <div style={{ padding: "0 12px 16px" }}>
            <div style={{ background: C.accentDim, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.accent, marginBottom: 2 }}>Free Plan</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>5/5 documents used</div>
              <div style={{ fontSize: 10, color: C.accent, cursor: "pointer" }}>Upgrade to Pro →</div>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div style={{
          padding: "10px 24px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: C.surface, flexShrink: 0,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {NAV_ITEMS.find((n) => n.id === currentScreen)?.label || "RevOS"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: C.textDim }}>Demo Mode</span>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", background: C.accentDim,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: C.accent,
            }}>JR</div>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ maxWidth: 920, margin: "0 auto" }}>
            {currentScreen === "dashboard" && <DashboardScreen onDealClick={handleDealClick} />}
            {currentScreen === "deal-prep" && <DealPrepScreen deal={selectedDeal} onBack={handleDealBack} />}
            {currentScreen === "locations" && <LocationsScreen />}
            {currentScreen === "ask" && <AskScreen />}
            {currentScreen === "documents" && <DocumentsScreen />}
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        ::placeholder { color: ${C.textDim}; }
      `}</style>
    </div>
  );
}
