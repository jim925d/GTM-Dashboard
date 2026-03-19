import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

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
  cyan: "#22d3ee",
};

const MANAGERS = ["DCosta", "Kahn", "Ochoa", "McGuirk"];

// ─── SHARED COMPONENTS ──────────────────────────────────────────
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

// ─── ENRICHMENT ENGINE (live API calls) ──────────────────────────

async function enrichFromGooglePlaces(account, onProgress) {
  onProgress("google_places", "running", "Searching Google Places API...");
  try {
    const resp = await fetch("/api/engine/enrich/google-places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_name: account.name, hq: account.hq }),
    });
    if (!resp.ok) {
      onProgress("google_places", "error", `API returned ${resp.status} ${resp.statusText}`);
      return [];
    }
    const data = await resp.json();
    if (data.error && !data.results?.length) {
      onProgress("google_places", "error", data.error);
      return [];
    }
    const results = data.results || [];
    onProgress("google_places", "done", `Found ${results.length} locations`);
    return results;
  } catch (e) {
    onProgress("google_places", "error", e.message);
    return [];
  }
}

async function enrichFromClaude(account, onProgress) {
  onProgress("claude_ai", "running", "Claude AI researching locations...");
  try {
    const resp = await fetch("/api/engine/enrich/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: account.name,
        industry: account.industry,
        hq: account.hq,
        website: account.website,
      }),
    });
    if (!resp.ok) {
      onProgress("claude_ai", "error", `API returned ${resp.status} ${resp.statusText}`);
      return [];
    }
    const data = await resp.json();
    if (data.error && !data.results?.length) {
      onProgress("claude_ai", "error", data.error);
      return [];
    }
    const results = data.results || [];
    onProgress("claude_ai", "done", `Found ${results.length} locations`);
    return results;
  } catch (e) {
    onProgress("claude_ai", "error", e.message);
    return [];
  }
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

// ─── DATA LOADING ────────────────────────────────────────────────

function useLocationData() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const locCacheRef = useRef(null); // cached locations.json keyed by account name

  useEffect(() => {
    async function load() {
      try {
        const resp = await fetch("/local-data/file?name=location-summary.json");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const accts = (data.accounts || []).map(a => ({ ...a, locations: [] }));
        setAccounts(accts);
      } catch (e) {
        console.error("Failed to load location data:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Lazy-load locations.json on first call, then pull account's locations from cache
  const loadAccountLocations = useCallback(async (accountName) => {
    if (!locCacheRef.current) {
      try {
        const resp = await fetch("/local-data/locations.json");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        locCacheRef.current = await resp.json();
      } catch (e) {
        console.error("Failed to load locations.json:", e);
        locCacheRef.current = {};
      }
    }
    const raw = locCacheRef.current[accountName] || [];
    // Map short keys to the shape LocationsScreen expects
    return raw.map(l => ({
      address: l.a || "",
      type: l.t || "",
      netStatus: l.c || (l.s === "on-net" ? "On-Net" : l.s === "near-net" ? "Near-Net" : "Off-Net"),
      status: l.s || "off-net",
      market: l.mk || "",
      lat: l.la || 0,
      lng: l.lo || 0,
      mrr: l.m || 0,
      feet_from_network: l.ft || 0,
      name: l.n || l.a || "",
      source: "locations.csv",
    }));
  }, []);

  return { accounts, loading, loadAccountLocations };
}

// ─── LEAFLET MAP COMPONENT ──────────────────────────────────────

function FitBounds({ locations }) {
  const map = useMap();
  useEffect(() => {
    if (locations.length === 0) return;
    const lats = locations.map((l) => l.lat);
    const lngs = locations.map((l) => l.lng);
    const bounds = [
      [Math.min(...lats) - 0.5, Math.min(...lngs) - 0.5],
      [Math.max(...lats) + 0.5, Math.max(...lngs) + 0.5],
    ];
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 12 });
  }, [locations, map]);
  return null;
}

function LocationMap({ locations }) {
  if (!locations.length) return null;

  const center = [
    locations.reduce((s, l) => s + l.lat, 0) / locations.length,
    locations.reduce((s, l) => s + l.lng, 0) / locations.length,
  ];

  const getColor = (loc) => {
    if (loc.isNew) return C.accent;
    if (loc.netStatus === "On-Net" || loc.netStatus === "On-Net ICB") return C.green;
    if (loc.netStatus === "Near-Net") return C.yellow;
    return C.red;
  };

  return (
    <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
      <MapContainer
        center={center}
        zoom={4}
        style={{ height: 320, width: "100%", background: C.bg }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds locations={locations} />
        {locations.map((loc, i) => (
          <CircleMarker
            key={i}
            center={[loc.lat, loc.lng]}
            radius={loc.isNew ? 6 : 5}
            pathOptions={{
              fillColor: getColor(loc),
              fillOpacity: 0.8,
              color: getColor(loc),
              weight: 1,
              opacity: 0.6,
            }}
          >
            <Popup>
              <div style={{ fontSize: 12 }}>
                <strong>{loc.address || "Unknown address"}</strong>
                <br />
                {loc.type} {loc.netStatus ? `· ${loc.netStatus}` : ""}
                {loc.isNew && <><br /><span style={{ color: C.accent }}>Newly discovered</span></>}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div style={{ display: "flex", gap: 16, padding: "8px 14px", background: C.surface, fontSize: 10, color: C.textDim }}>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: C.green, marginRight: 4, verticalAlign: "middle" }} />On-Net</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: C.yellow, marginRight: 4, verticalAlign: "middle" }} />Near-Net</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: C.red, marginRight: 4, verticalAlign: "middle" }} />Off-Net</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: C.accent, marginRight: 4, verticalAlign: "middle" }} />Discovered</span>
      </div>
    </div>
  );
}

// ─── SOURCE ROW ─────────────────────────────────────────────────

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

// ─── LOCATIONS SCREEN ───────────────────────────────────────────
function LocationsScreen({ accounts, loading, loadAccountLocations }) {
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [managerFilter, setManagerFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [sourceStatus, setSourceStatus] = useState({ google_places: { status: "idle", message: "" }, claude_ai: { status: "idle", message: "" } });
  const [discoveredLocations, setDiscoveredLocations] = useState([]);
  const [enrichmentComplete, setEnrichmentComplete] = useState(false);
  const [bayesianSignals, setBayesianSignals] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [merged, setMerged] = useState(false);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [existingLocations, setExistingLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const listRef = useRef(null);

  const account = accounts.find((a) => a.name === selectedAccount);

  // Load existing locations from locations.csv data
  const handleLoadLocations = useCallback(async () => {
    if (!account || !loadAccountLocations) return;
    setLoadingLocations(true);
    try {
      const locs = await loadAccountLocations(account.name);
      setExistingLocations(locs);
      setLocationsLoaded(true);
    } catch (e) {
      console.error("Failed to load locations:", e);
    } finally {
      setLoadingLocations(false);
    }
  }, [account, loadAccountLocations]);

  // Reset locations when switching accounts
  useEffect(() => {
    setExistingLocations([]);
    setLocationsLoaded(false);
  }, [selectedAccount]);

  const filteredAccounts = useMemo(() => {
    let list = accounts;
    if (managerFilter !== "all") {
      list = list.filter((a) => (a.manager || "").toLowerCase().includes(managerFilter.toLowerCase()));
    }
    if (searchQuery) {
      list = list.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return list;
  }, [accounts, managerFilter, searchQuery]);

  const resetEnrichment = useCallback(() => {
    setSourceStatus({ google_places: { status: "idle", message: "" }, claude_ai: { status: "idle", message: "" } });
    setDiscoveredLocations([]); setEnrichmentComplete(false); setBayesianSignals(null); setConfirmMerge(false); setMerged(false);
  }, []);

  const runEnrichment = useCallback(async () => {
    if (!account) return;
    resetEnrichment(); setEnriching(true);
    const onProgress = (src, status, message) => setSourceStatus((p) => ({ ...p, [src]: { status, message } }));
    const [gp, ai] = await Promise.all([
      enrichFromGooglePlaces(account, onProgress),
      enrichFromClaude(account, onProgress),
    ]);
    const existingLocs = existingLocations.map((l) => ({ ...l, lat: l.lat, lng: l.lng }));
    const unique = deduplicateLocations(existingLocs, [...gp, ...ai]);
    setDiscoveredLocations(unique);
    const all = [...existingLocs, ...unique];
    setBayesianSignals(computeBayesianSignals(existingLocs.length, unique.length, all));
    setEnriching(false); setEnrichmentComplete(true);
  }, [account, existingLocations, resetEnrichment]);

  const allLocations = account
    ? [...existingLocations.map((l) => ({ ...l, isNew: false })), ...discoveredLocations]
    : [];
  const filtered = activeTab === "all"
    ? allLocations
    : activeTab === "new"
      ? discoveredLocations
      : existingLocations.map((l) => ({ ...l, isNew: false }));

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: C.textDim }}>
        Loading location data...
      </div>
    );
  }

  // ─── Account List View ─────
  if (!selectedAccount) {
    return (
      <div>
        {/* Manager filter pills */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: "0.04em", marginBottom: 6 }}>MANAGER</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button
              onClick={() => setManagerFilter("all")}
              style={{
                padding: "4px 10px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace",
                border: "none", borderRadius: 4,
                background: managerFilter === "all" ? `${C.cyan}15` : C.surface,
                boxShadow: managerFilter === "all" ? `0 0 0 1px ${C.cyan}30` : "none",
                color: managerFilter === "all" ? C.cyan : C.textDim,
                cursor: "pointer",
              }}
            >ALL</button>
            {MANAGERS.map((m) => (
              <button
                key={m}
                onClick={() => setManagerFilter(m)}
                style={{
                  padding: "4px 10px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace",
                  border: "none", borderRadius: 4,
                  background: managerFilter === m ? `${C.cyan}15` : C.surface,
                  boxShadow: managerFilter === m ? `0 0 0 1px ${C.cyan}30` : "none",
                  color: managerFilter === m ? C.cyan : C.textDim,
                  cursor: "pointer",
                }}
              >{m.toUpperCase()}</button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 12 }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts..."
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 6,
              border: `1px solid ${C.border}`, background: C.bg, color: C.text,
              fontSize: 12, outline: "none", fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          />
        </div>

        <SectionLabel>{filteredAccounts.length.toLocaleString()} accounts</SectionLabel>

        {/* Account list */}
        <div ref={listRef} style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
          {filteredAccounts.slice(0, 200).map((acct) => (
            <div
              key={acct.name}
              onClick={() => { setSelectedAccount(acct.name); resetEnrichment(); setActiveTab("all"); }}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                background: C.surface, borderRadius: 6, border: `1px solid ${C.border}`,
                cursor: "pointer", transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = C.borderLight}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = C.border}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: C.accent,
              }}>
                {acct.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acct.name}</div>
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 1 }}>
                  {acct.vertical || acct.segment || ""}{acct.hq ? ` · ${acct.hq}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, flexShrink: 0, alignItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{acct.on}</div>
                  <div style={{ fontSize: 8, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>On-Net</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.yellow }}>{acct.near}</div>
                  <div style={{ fontSize: 8, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>Near-Net</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.textMuted }}>{acct.total}</div>
                  <div style={{ fontSize: 8, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total</div>
                </div>
              </div>
              <span style={{ color: C.textDim, fontSize: 14 }}>&rarr;</span>
            </div>
          ))}
          {filteredAccounts.length > 200 && (
            <div style={{ padding: 12, textAlign: "center", fontSize: 11, color: C.textDim }}>
              Showing 200 of {filteredAccounts.length.toLocaleString()} accounts. Use search to narrow results.
            </div>
          )}
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
        >&larr; Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{account.name}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>
            {account.vertical || account.segment || ""}{account.hq ? ` · ${account.hq}` : ""}
            {account.manager ? ` · ${account.manager}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Badge color="green">{account.on} On-Net</Badge>
          <Badge color="yellow">{account.near} Near-Net</Badge>
        </div>
      </div>

      {/* Load existing + Enrich buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {!locationsLoaded ? (
          <button
            onClick={handleLoadLocations}
            disabled={loadingLocations}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 8,
              border: `1px solid ${C.green}50`,
              background: loadingLocations ? C.greenDim : C.greenDim,
              color: C.green,
              fontSize: 13, fontWeight: 600, cursor: loadingLocations ? "not-allowed" : "pointer",
              opacity: loadingLocations ? 0.7 : 1, transition: "all 0.2s",
              fontFamily: "'IBM Plex Sans', sans-serif", letterSpacing: "0.01em",
            }}
          >
            {loadingLocations ? "Loading..." : `Load ${account.total} existing locations`}
          </button>
        ) : (
          <div style={{
            flex: 1, padding: "12px 16px", borderRadius: 8,
            background: C.greenDim, border: `1px solid ${C.green}30`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontSize: 13, fontWeight: 600, color: C.green,
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}>
            <span>&check;</span> {existingLocations.length} locations loaded
          </div>
        )}
        <button
          onClick={runEnrichment}
          disabled={enriching}
          style={{
            flex: 1, padding: "12px 16px", borderRadius: 8, border: "none",
            background: enriching ? C.accentDim : C.accent,
            color: enriching ? C.accent : C.bg,
            fontSize: 13, fontWeight: 600, cursor: enriching ? "not-allowed" : "pointer",
            opacity: enriching ? 0.7 : 1, transition: "all 0.2s",
            fontFamily: "'IBM Plex Sans', sans-serif", letterSpacing: "0.01em",
          }}
        >
          {enriching ? "Enriching..." : enrichmentComplete ? "\u21bb Re-run enrichment" : "\u26a1  Enrich locations"}
        </button>
      </div>

      {/* Source progress */}
      {(enriching || enrichmentComplete) && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>Data sources</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <SourceRow name="Google Places API" icon="\ud83d\udccd" status={sourceStatus.google_places.status} message={sourceStatus.google_places.message} />
            <SourceRow name="Claude AI Research" icon="\ud83e\udd16" status={sourceStatus.claude_ai.status} message={sourceStatus.claude_ai.message} />
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
          <LocationMap locations={allLocations} />
        </div>
      )}

      {/* Location table */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 2 }}>
            {[
              { key: "all", label: `All (${allLocations.length})` },
              { key: "existing", label: `Existing (${existingLocations.length})` },
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
          {merged && <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>&check; Merged into account</span>}
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
        <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden", maxHeight: 400, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", color: C.textDim, fontSize: 12 }}>
              {enrichmentComplete ? "No locations in this filter" : !locationsLoaded ? "Click \"Load existing locations\" to view this account's sites" : "Locations loaded — run enrichment to discover new ones"}
            </div>
          ) : filtered.slice(0, 100).map((loc, i) => (
            <div key={loc.id || i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
              borderBottom: i < Math.min(filtered.length, 100) - 1 ? `1px solid ${C.border}` : "none",
              background: loc.isNew ? "rgba(74,158,255,0.04)" : "transparent",
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                background: loc.isNew ? C.accent : loc.netStatus === "On-Net" || loc.netStatus === "On-Net ICB" ? C.green : loc.netStatus === "Near-Net" ? C.yellow : C.red,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{loc.address || "Unknown"}</div>
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 1 }}>
                  {loc.type}{loc.netStatus ? ` · ${loc.netStatus}` : ""} · {loc.source}
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
          {filtered.length > 100 && (
            <div style={{ padding: 8, textAlign: "center", fontSize: 10, color: C.textDim }}>
              Showing 100 of {filtered.length} locations
            </div>
          )}
        </div>
      </div>

      {/* API route info */}
      {enrichmentComplete && (
        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Integration endpoint</div>
          <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.7, fontFamily: "monospace" }}>
            POST /api/enrich &mdash; Google Places + Claude AI<br />
            Returns deduplicated locations with confidence scores
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── PLACEHOLDER SCREENS ────────────────────────────────────────
function DashboardScreen() {
  return (
    <div style={{ padding: 40, textAlign: "center", color: C.textDim }}>
      <div style={{ fontSize: 14, marginBottom: 8 }}>Dashboard</div>
      <div style={{ fontSize: 12 }}>Use the Locations tab to explore account locations</div>
    </div>
  );
}

function DealPrepScreen() {
  return (
    <div style={{ padding: 40, textAlign: "center", color: C.textDim }}>
      <div style={{ fontSize: 14, marginBottom: 8 }}>Deal Prep</div>
      <div style={{ fontSize: 12 }}>Select a deal from Dashboard</div>
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
  { id: "dashboard", icon: "\u25fb", label: "Dashboard" },
  { id: "locations", icon: "\u25c8", label: "Locations" },
];

export default function SellerLocations() {
  const [currentScreen, setCurrentScreen] = useState("locations");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const { accounts, loading, loadAccountLocations } = useLocationData();

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
            <span style={{ fontSize: 11, color: C.textDim }}>
              {!loading && `${accounts.length.toLocaleString()} accounts`}
            </span>
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
            {currentScreen === "dashboard" && <DashboardScreen />}
            {currentScreen === "deal-prep" && <DealPrepScreen />}
            {currentScreen === "locations" && <LocationsScreen accounts={accounts} loading={loading} loadAccountLocations={loadAccountLocations} />}
            {currentScreen === "ask" && <AskScreen />}
            {currentScreen === "documents" && <DocumentsScreen />}
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        ::placeholder { color: ${C.textDim}; }
        .leaflet-container { background: ${C.bg} !important; }
        .leaflet-popup-content-wrapper { background: ${C.surface}; color: ${C.text}; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
        .leaflet-popup-tip { background: ${C.surface}; }
        .leaflet-popup-close-button { color: ${C.textMuted} !important; }
      `}</style>
    </div>
  );
}
