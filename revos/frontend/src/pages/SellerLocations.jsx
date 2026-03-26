import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import { saveLocations, loadLocations, saveEngineResult, loadEngineResult } from "../lib/engineStore";

const MANAGERS = ["DCosta", "Kahn", "Ochoa", "McGuirk"];

// ── Map-only color constants (kept for Leaflet dynamic fills) ────
const MAP_COLORS = {
  bg: "#06080F",
  surface: "#161B22",
  border: "#21262D",
  text: "#e6edf3",
  textMuted: "#8b949e",
  accent: "#60a5fa",
  accentDim: "rgba(96,165,250,0.12)",
  green: "#34d399",
  greenDim: "rgba(52,211,153,0.12)",
  yellow: "#fbbf24",
  red: "#f87171",
  teal: "#2dd4bf",
  purple: "#a78bfa",
  textDim: "#8b949e",
  orange: "#f0883e",
};

// ─── SHARED COMPONENTS ──────────────────────────────────────────
function Badge({ children, color = "blue" }) {
  const colorMap = {
    blue: "text-revos-blue bg-revos-blue/10",
    green: "text-revos-green bg-revos-green/10",
    yellow: "text-revos-yellow bg-revos-yellow/10",
    red: "text-revos-red bg-revos-red/10",
    orange: "text-revos-orange bg-revos-orange/10",
    purple: "text-revos-purple bg-revos-purple/10",
    teal: "text-revos-teal bg-revos-teal/10",
    cyan: "text-revos-cyan bg-revos-cyan/10",
    accent: "text-revos-blue bg-revos-blue/10",
  };
  return (
    <span className={cn(
      "inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase",
      colorMap[color] || colorMap.blue
    )}>{children}</span>
  );
}

function Card({ children, onClick, className }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-revos-card border border-revos-border rounded-lg p-5 transition-colors duration-150",
        onClick && "cursor-pointer hover:border-revos-border-light",
        className
      )}
    >{children}</div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="text-[10px] font-bold text-revos-text-dim tracking-[0.1em] uppercase mb-3">
      {children}
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed, badge }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full rounded-md border-none text-[13px] cursor-pointer transition-all duration-[120ms] font-sans",
        collapsed ? "py-2.5 px-0 justify-center" : "py-2 px-3 justify-start",
        active
          ? "bg-revos-blue/10 text-revos-blue font-semibold"
          : "bg-transparent text-revos-text-dim hover:bg-revos-card-hover hover:text-revos-text font-normal",
      )}
    >
      <span className="text-[15px] shrink-0 w-5 text-center">{icon}</span>
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
      {!collapsed && badge > 0 && (
        <span className="min-w-[18px] h-[18px] rounded-full bg-revos-red/10 text-revos-red text-[10px] font-bold flex items-center justify-center">
          {badge}
        </span>
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
    if (loc.isNew) return MAP_COLORS.accent;
    if (loc.netStatus === "On-Net" || loc.netStatus === "On-Net ICB") return MAP_COLORS.green;
    if (loc.netStatus === "Near-Net") return MAP_COLORS.yellow;
    return MAP_COLORS.red;
  };

  return (
    <div className="rounded-lg overflow-hidden border border-revos-border">
      <MapContainer
        center={center}
        zoom={4}
        style={{ height: 320, width: "100%", background: MAP_COLORS.bg }}
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
                {loc.isNew && <><br /><span style={{ color: MAP_COLORS.accent }}>Newly discovered</span></>}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="flex gap-4 px-3.5 py-2 bg-revos-card text-[10px] text-revos-text-dim">
        <span><span className="inline-block w-2 h-2 rounded-full bg-revos-green mr-1 align-middle" />On-Net</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-revos-yellow mr-1 align-middle" />Near-Net</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-revos-red mr-1 align-middle" />Off-Net</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-revos-blue mr-1 align-middle" />Discovered</span>
      </div>
    </div>
  );
}

// ─── SOURCE ROW ─────────────────────────────────────────────────

function SourceRow({ name, icon, status, message }) {
  return (
    <div className={cn(
      "flex items-center gap-3 px-3.5 py-2.5 bg-revos-card rounded-md border transition-colors duration-300",
      status === "done" ? "border-revos-teal/30" : "border-revos-border"
    )}>
      <span className="text-base w-6 text-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-revos-text">{name}</div>
        <div className="text-[11px] text-revos-text-dim whitespace-nowrap overflow-hidden text-ellipsis">
          {message || "Ready"}
        </div>
      </div>
      <span className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase",
        status === "done" && "bg-revos-green/10 text-revos-green",
        status === "running" && "bg-revos-blue/10 text-revos-blue",
        status !== "done" && status !== "running" && "bg-revos-border/40 text-revos-text-dim",
      )}>
        {status === "running" && (
          <span className="w-[5px] h-[5px] rounded-full bg-revos-blue animate-pulse" />
        )}
        {status === "done" ? "done" : status === "running" ? "scanning" : "idle"}
      </span>
    </div>
  );
}

function SignalCard({ label, value, color, sub }) {
  return (
    <div className="px-3.5 py-3 bg-revos-card rounded-lg border border-revos-border">
      <div className="text-[10px] text-revos-text-dim font-semibold uppercase tracking-[0.08em] mb-1.5">{label}</div>
      <div className="text-[22px] font-bold leading-none" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-revos-text-dim mt-1">{sub}</div>}
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

  // Reset locations when switching accounts + restore any persisted enrichment
  useEffect(() => {
    setExistingLocations([]);
    setLocationsLoaded(false);
    resetEnrichment();
    if (selectedAccount) {
      loadLocations().then(stored => {
        const saved = stored?.[selectedAccount];
        if (saved?.discoveredLocations?.length) {
          setDiscoveredLocations(saved.discoveredLocations);
          setBayesianSignals(saved.bayesianSignals || null);
          setEnrichmentComplete(true);
          setSourceStatus({
            google_places: { status: "done", message: "Loaded from saved results" },
            claude_ai: { status: "done", message: "Loaded from saved results" },
          });
        }
      });
    }
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
    const signals = computeBayesianSignals(existingLocs.length, unique.length, all);
    setBayesianSignals(signals);
    setEnriching(false); setEnrichmentComplete(true);

    // Persist enrichment results keyed by account name
    loadLocations().then(stored => {
      const updated = { ...(stored || {}), [account.name]: { discoveredLocations: unique, bayesianSignals: signals, timestamp: Date.now() } };
      saveLocations(updated);
    });
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
      <div className="p-10 text-center text-revos-text-dim">
        Loading location data...
      </div>
    );
  }

  // ─── Account List View ─────
  if (!selectedAccount) {
    return (
      <div>
        {/* Manager filter pills */}
        <div className="mb-4">
          <div className="text-[9px] font-bold text-revos-text-dim tracking-wide mb-1.5">MANAGER</div>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setManagerFilter("all")}
              className={cn(
                "px-2.5 py-1 text-[10px] font-mono border-none rounded cursor-pointer",
                managerFilter === "all"
                  ? "bg-revos-cyan/10 text-revos-cyan shadow-[0_0_0_1px_rgba(110,200,228,0.2)]"
                  : "bg-revos-card text-revos-text-dim"
              )}
            >ALL</button>
            {MANAGERS.map((m) => (
              <button
                key={m}
                onClick={() => setManagerFilter(m)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-mono border-none rounded cursor-pointer",
                  managerFilter === m
                    ? "bg-revos-cyan/10 text-revos-cyan shadow-[0_0_0_1px_rgba(110,200,228,0.2)]"
                    : "bg-revos-card text-revos-text-dim"
                )}
              >{m.toUpperCase()}</button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="mb-3">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts..."
            className="w-full px-3 py-2 rounded-md border border-revos-border bg-revos-bg text-revos-text text-xs outline-none font-sans placeholder:text-revos-text-dim"
          />
        </div>

        <SectionLabel>{filteredAccounts.length.toLocaleString()} accounts</SectionLabel>

        {/* Account list */}
        <div ref={listRef} className="flex flex-col gap-1 max-h-[calc(100vh-260px)] overflow-y-auto">
          {filteredAccounts.slice(0, 200).map((acct) => (
            <div
              key={acct.name}
              onClick={() => { setSelectedAccount(acct.name); resetEnrichment(); setActiveTab("all"); }}
              className="flex items-center gap-3 px-3.5 py-2.5 bg-revos-card rounded-md border border-revos-border cursor-pointer transition-colors duration-150 hover:border-revos-border-light"
            >
              <div className="w-8 h-8 rounded-md shrink-0 bg-revos-blue/10 flex items-center justify-center text-[13px] font-bold text-revos-blue">
                {acct.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-revos-text whitespace-nowrap overflow-hidden text-ellipsis">{acct.name}</div>
                <div className="text-[10px] text-revos-text-dim mt-px">
                  {acct.vertical || acct.segment || ""}{acct.hq ? ` · ${acct.hq}` : ""}
                </div>
              </div>
              <div className="flex gap-3 shrink-0 items-center">
                <div className="text-center">
                  <div className="text-sm font-bold text-revos-green">{acct.on}</div>
                  <div className="text-[8px] text-revos-text-dim uppercase tracking-wide">On-Net</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-revos-yellow">{acct.near}</div>
                  <div className="text-[8px] text-revos-text-dim uppercase tracking-wide">Near-Net</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-revos-text-dim">{acct.total}</div>
                  <div className="text-[8px] text-revos-text-dim uppercase tracking-wide">Total</div>
                </div>
              </div>
              <span className="text-revos-text-dim text-sm">&rarr;</span>
            </div>
          ))}
          {filteredAccounts.length > 200 && (
            <div className="p-3 text-center text-[11px] text-revos-text-dim">
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
      <div className="flex items-center gap-2.5 mb-5">
        <button
          onClick={() => { setSelectedAccount(null); resetEnrichment(); }}
          className="bg-transparent border border-revos-border rounded-md px-2.5 py-1 text-revos-text-dim cursor-pointer text-xs font-sans"
        >&larr; Back</button>
        <div className="flex-1">
          <div className="text-base font-bold text-revos-text">{account.name}</div>
          <div className="text-[11px] text-revos-text-dim">
            {account.vertical || account.segment || ""}{account.hq ? ` · ${account.hq}` : ""}
            {account.manager ? ` · ${account.manager}` : ""}
          </div>
        </div>
        <div className="flex gap-2">
          <Badge color="green">{account.on} On-Net</Badge>
          <Badge color="yellow">{account.near} Near-Net</Badge>
        </div>
      </div>

      {/* Load existing + Enrich buttons */}
      <div className="flex gap-2 mb-4">
        {!locationsLoaded ? (
          <button
            onClick={handleLoadLocations}
            disabled={loadingLocations}
            className={cn(
              "flex-1 px-4 py-3 rounded-lg border border-revos-green/30 bg-revos-green/10 text-revos-green text-[13px] font-semibold font-sans tracking-tight transition-all duration-200",
              loadingLocations ? "cursor-not-allowed opacity-70" : "cursor-pointer opacity-100"
            )}
          >
            {loadingLocations ? "Loading..." : `Load ${account.total} existing locations`}
          </button>
        ) : (
          <div className="flex-1 px-4 py-3 rounded-lg bg-revos-green/10 border border-revos-green/20 flex items-center justify-center gap-2 text-[13px] font-semibold text-revos-green font-sans">
            <span>&check;</span> {existingLocations.length} locations loaded
          </div>
        )}
        <button
          onClick={runEnrichment}
          disabled={enriching}
          className={cn(
            "flex-1 px-4 py-3 rounded-lg border-none text-[13px] font-semibold font-sans tracking-tight transition-all duration-200",
            enriching
              ? "bg-revos-blue/10 text-revos-blue cursor-not-allowed opacity-70"
              : "bg-revos-blue text-revos-bg cursor-pointer opacity-100"
          )}
        >
          {enriching ? "Enriching..." : enrichmentComplete ? "\u21bb Re-run enrichment" : "\u26a1  Enrich locations"}
        </button>
      </div>

      {/* Source progress */}
      {(enriching || enrichmentComplete) && (
        <div className="mb-4">
          <SectionLabel>Data sources</SectionLabel>
          <div className="flex flex-col gap-1.5">
            <SourceRow name="Google Places API" icon="📍" status={sourceStatus.google_places.status} message={sourceStatus.google_places.message} />
            <SourceRow name="Claude AI Research" icon="🤖" status={sourceStatus.claude_ai.status} message={sourceStatus.claude_ai.message} />
          </div>
        </div>
      )}

      {/* Bayesian signals */}
      {bayesianSignals && (
        <div className="mb-4">
          <SectionLabel>Bayesian engine signals</SectionLabel>
          <div className="grid grid-cols-5 gap-2">
            <SignalCard label="Footprint" value={bayesianSignals.footprintSize} color={MAP_COLORS.teal} sub="total locations" />
            <SignalCard label="Geo spread" value={`${bayesianSignals.geographicSpread}`} color={MAP_COLORS.accent} sub="unique states" />
            <SignalCard label="Growth" value={`${bayesianSignals.growthSignal}x`} color={bayesianSignals.growthSignal > 1 ? MAP_COLORS.green : MAP_COLORS.yellow} sub="new / existing" />
            <SignalCard label="Data centers" value={bayesianSignals.hasDataCenters ? "Yes" : "No"} color={bayesianSignals.hasDataCenters ? MAP_COLORS.green : MAP_COLORS.textDim} sub="infra signal" />
            <SignalCard label="Expansion" value={`${Math.round(bayesianSignals.expansionProbability * 100)}%`} color={MAP_COLORS.purple} sub="probability" />
          </div>
        </div>
      )}

      {/* Map */}
      {allLocations.length > 0 && (
        <div className="mb-4">
          <SectionLabel>Location map</SectionLabel>
          <LocationMap locations={allLocations} />
        </div>
      )}

      {/* Location table */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex gap-0.5">
            {[
              { key: "all", label: `All (${allLocations.length})` },
              { key: "existing", label: `Existing (${existingLocations.length})` },
              ...(discoveredLocations.length ? [{ key: "new", label: `New (${discoveredLocations.length})` }] : []),
            ].map((tab) => (
              <button
                key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-3 py-1 rounded-md border-none text-[11px] font-semibold cursor-pointer font-sans",
                  activeTab === tab.key
                    ? "bg-revos-blue/10 text-revos-blue"
                    : "bg-transparent text-revos-text-dim"
                )}
              >{tab.label}</button>
            ))}
          </div>
          {enrichmentComplete && discoveredLocations.length > 0 && !merged && (
            <button
              onClick={() => setConfirmMerge(true)}
              className="px-3.5 py-1 rounded-md border border-revos-green/25 bg-revos-green/10 text-revos-green text-[11px] font-semibold cursor-pointer font-sans"
            >Merge {discoveredLocations.length} into account</button>
          )}
          {merged && <span className="text-[11px] text-revos-green font-semibold">&check; Merged into account</span>}
        </div>

        {/* Confirm merge */}
        {confirmMerge && (
          <div className="p-3.5 bg-revos-blue/10 rounded-lg border border-revos-blue/20 mb-2.5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-revos-text mb-0.5">Confirm merge</div>
              <div className="text-[11px] text-revos-text-dim">Add {discoveredLocations.length} locations to {account.name} and update Bayesian priors.</div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setConfirmMerge(false)} className="px-3 py-1 rounded-md border border-revos-border bg-transparent text-revos-text-dim text-[11px] cursor-pointer font-sans">Cancel</button>
              <button onClick={async () => {
                setMerged(true); setConfirmMerge(false);
                // Merge discovered locations into locations.json
                try {
                  const locJSON = await loadEngineResult('locations.json') || {};
                  const acctName = account.name;
                  const existing = locJSON[acctName] || [];
                  // Convert discovered locations to compact format matching locations.json
                  const newLocs = discoveredLocations.map(l => {
                    const loc = {
                      n: String(l.name || 'Unknown'),
                      t: String(l.type || 'Office'),
                      a: String(l.address || ''),
                      s: 'off-net',
                      mk: '',
                    };
                    if (l.lat && l.lng) {
                      loc.la = Math.round(l.lat * 10000) / 10000;
                      loc.lo = Math.round(l.lng * 10000) / 10000;
                    }
                    return loc;
                  });
                  // Deduplicate by lat/lng against existing
                  const seenCoords = new Set(existing.filter(e => e.la && e.lo).map(e => `${e.la},${e.lo}`));
                  const unique = newLocs.filter(l => {
                    if (!l.la || !l.lo) return true;
                    const key = `${l.la},${l.lo}`;
                    if (seenCoords.has(key)) return false;
                    seenCoords.add(key);
                    return true;
                  });
                  locJSON[acctName] = [...existing, ...unique];
                  await saveEngineResult('locations.json', locJSON);
                  console.log(`[LocationIntel] Merged ${unique.length} new locations into locations.json for ${acctName}`);
                } catch (e) {
                  console.warn('[LocationIntel] Failed to merge into locations.json:', e);
                }
              }} className="px-3 py-1 rounded-md border-none bg-revos-green text-revos-bg text-[11px] font-semibold cursor-pointer font-sans">Confirm</button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border border-revos-border overflow-hidden max-h-[400px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-7 text-center text-revos-text-dim text-xs">
              {enrichmentComplete ? "No locations in this filter" : !locationsLoaded ? "Click \"Load existing locations\" to view this account's sites" : "Locations loaded — run enrichment to discover new ones"}
            </div>
          ) : filtered.slice(0, 100).map((loc, i) => (
            <div key={loc.id || i} className={cn(
              "flex items-center gap-2.5 px-3.5 py-2",
              loc.isNew && "bg-revos-blue/[0.04]"
            )} style={{
              borderBottom: i < Math.min(filtered.length, 100) - 1 ? "1px solid var(--tw-revos-border, #21262D)" : "none",
            }}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
                background: loc.isNew ? MAP_COLORS.accent : loc.netStatus === "On-Net" || loc.netStatus === "On-Net ICB" ? MAP_COLORS.green : loc.netStatus === "Near-Net" ? MAP_COLORS.yellow : MAP_COLORS.red,
              }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-revos-text whitespace-nowrap overflow-hidden text-ellipsis">{loc.address || "Unknown"}</div>
                <div className="text-[10px] text-revos-text-dim mt-px">
                  {loc.type}{loc.netStatus ? ` · ${loc.netStatus}` : ""} · {loc.source}
                  {loc.confidence != null && (
                    <span className="ml-2" style={{
                      color: loc.confidence >= 0.85 ? MAP_COLORS.green : loc.confidence >= 0.7 ? MAP_COLORS.yellow : MAP_COLORS.orange,
                    }}>
                      {Math.round(loc.confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>
              {loc.isNew && <Badge color="accent">new</Badge>}
            </div>
          ))}
          {filtered.length > 100 && (
            <div className="p-2 text-center text-[10px] text-revos-text-dim">
              Showing 100 of {filtered.length} locations
            </div>
          )}
        </div>
      </div>

      {/* API route info */}
      {enrichmentComplete && (
        <Card className="p-3.5">
          <div className="text-[10px] text-revos-text-dim font-bold uppercase tracking-[0.08em] mb-2">Integration endpoint</div>
          <div className="text-[11px] text-revos-text-dim leading-relaxed font-mono">
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
    <div className="p-10 text-center text-revos-text-dim">
      <div className="text-sm mb-2">Dashboard</div>
      <div className="text-xs">Use the Locations tab to explore account locations</div>
    </div>
  );
}

function DealPrepScreen() {
  return (
    <div className="p-10 text-center text-revos-text-dim">
      <div className="text-sm mb-2">Deal Prep</div>
      <div className="text-xs">Select a deal from Dashboard</div>
    </div>
  );
}

function AskScreen() {
  const [input, setInput] = useState("");
  return (
    <div>
      <SectionLabel>Ask RevOS</SectionLabel>
      <Card className="p-3.5 mb-4">
        <div className="flex gap-2">
          <input
            value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about deals, playbooks, competitors..."
            className="flex-1 bg-revos-bg border border-revos-border rounded-md px-3 py-2 text-revos-text text-[13px] outline-none font-sans placeholder:text-revos-text-dim"
          />
          <button className="px-4 py-2 rounded-md border-none bg-revos-blue text-revos-bg text-xs font-semibold cursor-pointer font-sans">Ask</button>
        </div>
      </Card>
      <div className="text-xs text-revos-text-dim text-center p-10">AI-powered Q&A against your playbooks and deal history</div>
    </div>
  );
}

function DocumentsScreen() {
  return (
    <div>
      <SectionLabel>Documents</SectionLabel>
      <Card className="p-3.5 mb-3">
        <div className="border-2 border-dashed border-revos-border rounded-lg p-8 text-center">
          <div className="text-[13px] text-revos-text-dim mb-1">Drop files here or click to upload</div>
          <div className="text-[11px] text-revos-text-dim">PDF, PPTX, XLSX, DOCX</div>
        </div>
      </Card>
      <SectionLabel>Processed documents</SectionLabel>
      <div className="rounded-lg border border-revos-border overflow-hidden">
        {[
          { name: "Q1 Sales Playbook v3.2.pdf", pages: 47, status: "processed", chunks: 124 },
          { name: "Enterprise Pricing Matrix.xlsx", pages: 8, status: "processed", chunks: 32 },
          { name: "Competitor X Battle Card.pptx", pages: 12, status: "processed", chunks: 28 },
        ].map((doc, i) => (
          <div key={i} className={cn(
            "flex items-center gap-2.5 px-3.5 py-2",
            i < 2 && "border-b border-revos-border"
          )}>
            <span className="text-revos-text-dim">📄</span>
            <div className="flex-1">
              <div className="text-xs text-revos-text">{doc.name}</div>
              <div className="text-[10px] text-revos-text-dim">{doc.pages} pages · {doc.chunks} chunks</div>
            </div>
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
    <div className="flex h-screen bg-revos-bg text-revos-text font-sans overflow-hidden">
      {/* Sidebar */}
      <div className={cn(
        "shrink-0 flex flex-col border-r border-revos-border bg-revos-card transition-[width] duration-200 ease-in-out overflow-hidden",
        navCollapsed ? "w-[60px]" : "w-[220px]"
      )}>
        {/* Logo */}
        <div
          onClick={() => setNavCollapsed(!navCollapsed)}
          className={cn(
            "flex items-center gap-2.5 cursor-pointer border-b border-revos-border",
            navCollapsed ? "py-4 px-0 justify-center" : "py-4 px-4 justify-start"
          )}
        >
          <div className="w-7 h-7 rounded-md bg-revos-blue/10 flex items-center justify-center text-revos-blue font-extrabold text-sm shrink-0">R</div>
          {!navCollapsed && <span className="font-bold text-sm text-revos-text tracking-tight">RevOS</span>}
        </div>

        {/* Nav items */}
        <div className={cn(
          "flex flex-col gap-0.5 flex-1",
          navCollapsed ? "p-3 px-2" : "p-3"
        )}>
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
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Top bar */}
        <div className="px-6 py-2.5 border-b border-revos-border flex items-center justify-between bg-revos-card shrink-0">
          <div className="text-[13px] font-semibold text-revos-text">
            {NAV_ITEMS.find((n) => n.id === currentScreen)?.label || "RevOS"}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-revos-text-dim">
              {!loading && `${accounts.length.toLocaleString()} accounts`}
            </span>
            <div className="w-7 h-7 rounded-full bg-revos-blue/10 flex items-center justify-center text-[10px] font-bold text-revos-blue">JR</div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[920px] mx-auto">
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
        ::-webkit-scrollbar-thumb { background: #21262D; border-radius: 3px; }
        ::placeholder { color: #8b949e; }
        .leaflet-container { background: #06080F !important; }
        .leaflet-popup-content-wrapper { background: #161B22; color: #e6edf3; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.5); }
        .leaflet-popup-tip { background: #161B22; }
        .leaflet-popup-close-button { color: #8b949e !important; }
      `}</style>
    </div>
  );
}
