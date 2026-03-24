import { useState, useMemo, useCallback, useRef } from "react";
import {
  Area, Bar, ComposedChart, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Line,
} from "recharts";
import * as Papa from "papaparse";

// ─── Design Tokens ────────────────────────────────────────────────
const T = {
  bg: "#06080F", card: "#161B22", cardHover: "#1C2129",
  border: "#21262D", borderLight: "#30363D",
  text: "#E6EDF3", textMuted: "#8B949E", textDim: "#484F58",
  email: "#58A6FF", call: "#3FB950", meeting: "#D29922",
  pipeline: "#79C0FF", quote: "#BC8CFF",
  accent: "#58A6FF", accentGlow: "rgba(88,166,255,0.15)",
  danger: "#F85149", success: "#3FB950",
  heatNone: "#161B22", heatLow: "#0e4429", heatMed: "#006d32", heatHigh: "#26a641", heatMax: "#39d353",
};
const FONTS = {
  mono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
  body: "'Inter', -apple-system, sans-serif",
};
const ENG_TYPES = [
  { key: "emails", type: "Email", label: "Emails", color: T.email },
  { key: "calls", type: "Call", label: "Calls", color: T.call },
  { key: "meetings", type: "Meeting", label: "Meetings", color: T.meeting },
];
const MEGA_VERTICALS = ["Finance", "Media & Internet", "Software & Tech", "Data Centers", "Business & Consumer Services", "Carrier", "Retail", "Healthcare", "Manufacturing", "Transportation", "Hospitality & Entertainment", "Public Sector", "Education"];

// ─── Column Alias Definitions ─────────────────────────────────────
// Exact Salesforce report headers are listed FIRST in each alias array.
// Generic CRM aliases follow for portability.
const SCHEMA = {
  accounts: {
    label: "Customers",
    fields: {
      customer_account: { label: "Customer Account", required: true,  aliases: [
        "account global region : account : customer account",
        "customer account", "account name", "account.name", "name", "customer name", "customer", "company", "company name", "account"] },
      total_brr:        { label: "Total BRR",         required: false, aliases: [
        "account global region : account : total brr",
        "total brr", "total_brr", "brr", "arr", "annual revenue", "annual recurring revenue", "revenue"] },
      rep:              { label: "Rep",               required: true,  aliases: [
        "sales owner",
        "rep", "owner", "owner.name", "sales rep", "account owner", "rep name", "owner name", "assigned to", "salesperson"] },
      mega_vertical:    { label: "Mega Vertical",    required: false, aliases: [
        "account global region : account : mega vertical grouping",
        "mega vertical grouping", "mega vertical", "mega_vertical", "vertical", "industry", "segment", "market", "market vertical", "category"] },
    },
  },
  engagements: {
    label: "Engagements",
    fields: {
      customer_account: { label: "Customer Account", required: true,  aliases: [
        "company / account", "company/account",
        "customer account", "account name", "account.name", "customer name", "company", "company name", "account",
        "account id", "accountid", "account.id", "customer_id", "company id", "id"] },
      date:       { label: "Date",              required: true,  aliases: [
        "date",
        "activity date", "event date", "timestamp", "created date", "createdate", "activity_date", "engagement date", "interaction date"] },
      type:       { label: "Engagement Type",   required: true,  aliases: [
        "salesloft type",
        "type", "activity type", "event type", "engagement type", "task type", "activity", "engagement", "interaction type", "channel"] },
      rep:        { label: "Rep",               required: false, aliases: [
        "assigned",
        "rep", "owner", "owner.name", "sales rep", "rep name", "assigned to", "user", "created by"] },
    },
  },
  pipeline: {
    label: "Pipeline",
    fields: {
      customer_account: { label: "Customer Account", required: true,  aliases: [
        "customer account",
        "account name", "account.name", "customer name", "company", "company name", "account"] },
      opportunity_name: { label: "Opportunity Name",  required: true,  aliases: [
        "opportunity name",
        "opp name", "deal name", "dealname", "name", "opportunity", "deal"] },
      stage:            { label: "Stage",             required: true,  aliases: [
        "stage",
        "stagename", "stage name", "dealstage", "pipeline stage", "sales stage", "phase", "stage group"] },
      amount:           { label: "Amount",            required: true,  aliases: [
        "total mrr & mar (converted)",
        "amount", "deal amount", "value", "total", "mrr", "tcv", "deal value", "revenue", "opp amount", "npv (converted)"] },
      close_date:       { label: "Close Date",        required: true,  aliases: [
        "close date",
        "closedate", "expected close", "close_date", "expected close date", "target close", "close month"] },
      rep:              { label: "Rep",               required: false, aliases: [
        "opportunity owner",
        "rep", "owner", "owner.name", "sales rep", "rep name", "opportunity owner", "deal owner", "account owner"] },
      created_date:     { label: "Created Date",      required: false, aliases: [
        "created date",
        "createddate", "createdate", "open date", "created", "date opened"] },
    },
  },
  quotes: {
    label: "Quotes",
    fields: {
      customer_account: { label: "Customer Account", required: true,  aliases: [
        "account: customer account",
        "customer account", "account name", "account: account name", "account.name", "customer name", "company", "company name", "account"] },
      quote_date:       { label: "Quote Date",    required: true,  aliases: [
        "quotes: created date",
        "quote date", "date", "created date", "createdate", "quote_date", "created", "date created"] },
      product:          { label: "Product",       required: false, aliases: [
        "product",
        "product name", "service", "service name", "item", "sku", "product type", "offering", "product group"] },
      term_months:      { label: "Term (Months)", required: false, aliases: [
        "term", "term months", "term_months", "contract term", "duration", "contract length", "months"] },
      rep:              { label: "Rep",           required: false, aliases: [
        "quotes: owner name",
        "rep", "owner", "owner.name", "sales rep", "rep name", "quote owner", "created by", "assigned to", "quotes: created by"] },
    },
  },
  hierarchy: {
    label: "Hierarchy",
    fields: {
      child_name:  { label: "Child Name",  required: true,  aliases: [
        "account name",
        "child name", "child", "child account", "subsidiary", "division", "sub-account", "billing name", "location name", "site name"] },
      child_id:    { label: "Child ID",    required: false, aliases: [
        "account id", "accountid",
        "child id", "child_id", "account record id", "sf id", "salesforce id", "record id", "billing account number"] },
      parent_name: { label: "Parent Name", required: true,  aliases: [
        "customer account",
        "parent name", "parent", "parent account", "master account", "headquarters", "hq", "parent company", "customer name", "canonical name"] },
    },
  },
};

// ─── Auto-map: match CSV headers to schema fields ─────────────────
function autoMapColumns(csvHeaders, tableKey) {
  const schema = SCHEMA[tableKey];
  const mapping = {};
  const lowerHeaders = csvHeaders.map((h) => h.toLowerCase().trim());

  Object.entries(schema.fields).forEach(([fieldKey, fieldDef]) => {
    // 1. Exact match on field key
    let idx = lowerHeaders.indexOf(fieldKey);
    if (idx >= 0) { mapping[fieldKey] = csvHeaders[idx]; return; }
    // 2. Alias match
    for (const alias of fieldDef.aliases) {
      idx = lowerHeaders.indexOf(alias);
      if (idx >= 0) { mapping[fieldKey] = csvHeaders[idx]; return; }
    }
    // 3. Fuzzy: header contains field key
    idx = lowerHeaders.findIndex((h) => h.includes(fieldKey.replace(/_/g, " ")) || h.includes(fieldKey.replace(/_/g, "")));
    if (idx >= 0) { mapping[fieldKey] = csvHeaders[idx]; return; }
    mapping[fieldKey] = "";
  });
  return mapping;
}

// ─── Engagement Type Normalization ───────────────────────────────
const ENG_TYPE_MAP = {};
[
  ["Email", ["email", "e-mail", "email sent", "email received", "email - outbound", "email - inbound", "outbound email", "inbound email", "message", "correspondence", "email outbound", "email inbound"]],
  ["Call", ["call", "phone", "phone call", "call - outbound", "call - inbound", "outbound call", "inbound call", "voicemail", "telephone", "dial", "phone - outbound", "phone - inbound"]],
  ["Meeting", ["meeting", "meeting - in person", "meeting - virtual", "virtual meeting", "in-person meeting", "video call", "zoom", "teams meeting", "webex", "demo", "presentation", "site visit", "onsite", "on-site", "face to face", "f2f", "in person"]],
].forEach(([canonical, variants]) => variants.forEach((v) => { ENG_TYPE_MAP[v] = canonical; }));

function normalizeEngType(raw) {
  if (!raw) return raw;
  const lower = raw.toLowerCase().trim();
  return ENG_TYPE_MAP[lower] || raw; // Keep original if no match (flag in UI)
}

// ─── Date Normalization ─────────────────────────────────────────
// Handles: M/D/YYYY, MM/DD/YYYY, YYYY-MM-DD, YYYY/MM/DD, Mon DD YYYY, DD-Mon-YYYY
function normalizeDate(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // YYYY/MM/DD
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // M/D/YYYY or MM/DD/YYYY (US format — most common in CRM exports)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [m, d, y] = s.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // M-D-YYYY or MM-DD-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
    const [m, d, y] = s.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Try native Date parse as last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return s; // Return as-is if unparseable
}

// ─── Transform mapped CSV rows into engine-ready objects ──────────
function transformRows(rows, mapping, tableKey) {
  // Which fields are dates that need normalization
  const dateFields = ["date", "close_date", "created_date", "quote_date"];

  return rows.map((row) => {
    const out = {};
    Object.entries(mapping).forEach(([fieldKey, csvCol]) => {
      if (csvCol) out[fieldKey] = row[csvCol]?.toString().trim() ?? "";
    });
    // Normalize all date fields
    dateFields.forEach((f) => { if (out[f]) out[f] = normalizeDate(out[f]); });
    // Coerce types
    if (tableKey === "accounts" && out.total_brr) out.total_brr = parseFloat(String(out.total_brr).replace(/[$,]/g, "")) || 0;
    if (tableKey === "pipeline" && out.amount) out.amount = parseFloat(String(out.amount).replace(/[$,]/g, "")) || 0;
    if (tableKey === "quotes") {
      if (out.term_months) out.term_months = parseInt(String(out.term_months).replace(/[^0-9]/g, "")) || 0;
    }
    // Normalize engagement types
    if (tableKey === "engagements" && out.type) out.type = normalizeEngType(out.type);
    return out;
  }).filter((r) => {
    const fields = SCHEMA[tableKey].fields;
    return Object.entries(fields).filter(([, f]) => f.required).every(([k]) => r[k] && r[k] !== "");
  });
}

// ─── Account Resolution ──────────────────────────────────────────
// Resolution order: 1) Hierarchy lookup (source of truth) → 2) Direct customer name → 3) Fuzzy name → 4) Unresolved
// The hierarchy maps engagement "Account Name" → canonical "Customer Account" name.
function resolveAccountIds(rows, accounts, hierarchy) {
  if (!accounts || !accounts.length || !rows.length) return { resolved: rows, stats: null };

  // Customer name set (for tier 2 direct match and tier 3 fuzzy)
  const custNameSet = new Set(accounts.map((a) => a.customer_account?.toLowerCase()));
  const nameFuzzy = {};
  accounts.forEach((a) => {
    if (a.customer_account) {
      const fuzzy = a.customer_account.toLowerCase().replace(/[,.\-]/g, " ").replace(/\b(inc|llc|corp|co|ltd|limited|corporation|company)\b/gi, "").trim().replace(/\s+/g, " ");
      nameFuzzy[fuzzy] = a.customer_account;
    }
  });

  // Tier 1: hierarchy — index by BOTH child_name (Account Name) AND child_id (Account ID)
  // Maps engagement account references → canonical Customer Account name
  const childToParent = {};
  if (hierarchy && hierarchy.length) {
    hierarchy.forEach((h) => {
      const parent = h.parent_name?.trim();
      if (!parent) return;
      if (h.child_name) childToParent[h.child_name.toLowerCase().trim()] = parent;
      if (h.child_id) childToParent[h.child_id.toLowerCase().trim()] = parent;
    });
  }

  let hierarchyMatch = 0, directMatch = 0, fuzzyMatch = 0, unresolved = 0;

  const resolved = rows.map((row) => {
    const val = row.customer_account;
    if (!val) return row;
    const lower = val.toLowerCase().trim();

    // 1. Hierarchy lookup FIRST (Account Name or Account ID → Customer Account)
    const parent = childToParent[lower];
    if (parent) { hierarchyMatch++; return { ...row, customer_account: parent, _original_account_ref: val }; }

    // 2. Direct customer name match (engagement name already IS the customer name)
    if (custNameSet.has(lower)) { directMatch++; return row; }

    // 3. Fuzzy name match (strip suffixes like Inc, LLC, Corp)
    const fuzzy = lower.replace(/[,.\-]/g, " ").replace(/\b(inc|llc|corp|co|ltd|limited|corporation|company)\b/gi, "").trim().replace(/\s+/g, " ");
    const byFuzzy = nameFuzzy[fuzzy];
    if (byFuzzy) { fuzzyMatch++; return { ...row, customer_account: byFuzzy, _original_account_ref: val }; }

    // 4. Unresolved
    unresolved++;
    return row;
  });

  return {
    resolved,
    stats: { total: rows.length, hierarchyMatch, directMatch, fuzzyMatch, unresolved },
  };
}

// ─── Demo Data ────────────────────────────────────────────────────
function generateDemoData() {
  const reps = ["Sarah Chen", "Marcus Johnson", "Elena Rodriguez", "James Park"];
  const stages = ["Discover", "Qualify", "Propose", "Negotiate", "Verbal Agreement"];
  const stageProb = { Discover: 0.10, Qualify: 0.25, Propose: 0.50, Negotiate: 0.70, "Verbal Agreement": 0.90 };
  const months = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"];
  const accounts = [], engagements = [], pipeline = [], quotes = [];
  const acctNames = [
    "Meridian Telecom", "Apex Wireless", "Northstar Fiber", "Cascade Networks",
    "Summit Communications", "Horizon Cable", "Pinnacle Broadband", "Atlas Tower Co",
    "Vantage MVNO", "Crestline Wireless", "BluePeak Networks", "Ironridge Fiber",
    "Clearwater Comms", "Stonebridge Cable", "Ridgeline Towers", "Oakmont Wireless",
    "Silverlake Broadband", "Westfield Networks", "Copperline Fiber", "Granite Telecom",
    "Evergreen Comms", "Redwood Wireless", "Lakeview Cable", "Mountainview Networks",
  ];
  acctNames.forEach((name, i) => {
    const rep = reps[i % reps.length];
    const mv = MEGA_VERTICALS[i % MEGA_VERTICALS.length];
    const brr = Math.round((50 + Math.random() * 450) * 1000);
    accounts.push({ customer_account: name, mega_vertical: mv, rep, total_brr: brr });
    months.forEach((m) => {
      const base = i % 3 === 0 ? 6 : i % 3 === 1 ? 4 : 2;
      if (Math.random() < 0.15) return;
      [...Array(Math.floor(Math.random() * base * 2) + 1).fill("Email"),
       ...Array(Math.floor(Math.random() * base) + (i % 3 === 0 ? 2 : 0)).fill("Call"),
       ...Array(Math.floor(Math.random() * (base / 2)) + (i % 4 === 0 ? 1 : 0)).fill("Meeting"),
      ].forEach((type) => {
        const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
        engagements.push({ customer_account: name, date: `${m}-${day}`, type, rep });
      });
    });
    if (Math.random() > 0.25) {
      const stage = stages[Math.floor(Math.random() * stages.length)];
      const amount = Math.round((20 + Math.random() * 200) * 1000);
      pipeline.push({ customer_account: name, opportunity_name: `${name} - ${["Upgrade", "Expansion", "New Logo", "Renewal"][i % 4]}`, stage, amount, weighted_amount: Math.round(amount * stageProb[stage]), close_date: `${months[Math.floor(Math.random() * 3) + 3]}-15`, rep, created_date: months[Math.floor(Math.random() * 2)] + "-01" });
    }
    if (Math.random() > 0.7) {
      const stage = stages[Math.floor(Math.random() * 3)];
      const amount = Math.round((10 + Math.random() * 80) * 1000);
      pipeline.push({ customer_account: name, opportunity_name: `${name} - Add-on`, stage, amount, weighted_amount: Math.round(amount * stageProb[stage]), close_date: `${months[4]}-28`, rep, created_date: months[1] + "-15" });
    }
    const products = ["DIA 100M", "SD-WAN Pro", "UCaaS 50-seat", "Dark Fiber 2-strand", "MPLS Gold", "SIP Trunk 24ch"];
    const qc = Math.random() > 0.3 ? Math.floor(Math.random() * 3) + 1 : 0;
    for (let q = 0; q < qc; q++) {
      const qm = months[Math.floor(Math.random() * months.length)];
      quotes.push({ customer_account: name, quote_date: `${qm}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}`, product: products[Math.floor(Math.random() * products.length)], term_months: [12, 24, 36, 60][Math.floor(Math.random() * 4)], rep });
    }
  });
  return { accounts, engagements, pipeline, quotes };
}

// ─── Utilities ────────────────────────────────────────────────────
const fmt = (n) => { if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`; if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`; return `$${n}`; };
const fmtNum = (n) => n?.toLocaleString() ?? "0";
const monthLabel = (m) => { if (!m || !m.includes("-")) return m || ""; const [y, mo] = m.split("-"); const names = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${names[parseInt(mo)] || "?"} '${(y || "").slice(2)}`; };

// ─── Shared Components ────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  // Format YYYY-MM-DD → "Week of Jan 22, 2026"
  let displayLabel = label;
  if (label && label.length === 10 && label[4] === "-") {
    const mo = parseInt(label.slice(5, 7));
    const dy = parseInt(label.slice(8, 10));
    const yr = label.slice(0, 4);
    const names = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    displayLabel = `Week of ${names[mo]} ${dy}, ${yr}`;
  }
  return (
    <div style={{ background: T.card, border: `1px solid ${T.borderLight}`, borderRadius: 8, padding: "12px 16px", fontFamily: FONTS.mono, fontSize: 11, color: T.text, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      <div style={{ color: T.textMuted, marginBottom: 8, fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}>{displayLabel}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
          <span style={{ color: T.textMuted, flex: 1 }}>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{p.name === "Pipeline MRR" ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 150, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color || T.accent}, transparent)` }} />
      <div style={{ fontSize: 11, color: T.textMuted, fontFamily: FONTS.mono, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>{icon && <span style={{ marginRight: 6 }}>{icon}</span>}{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: T.text, fontFamily: FONTS.mono, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function TabBtn({ active, children, onClick }) {
  return <button onClick={onClick} style={{ background: active ? T.accent : "transparent", color: active ? "#fff" : T.textMuted, border: `1px solid ${active ? T.accent : T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, fontFamily: FONTS.body, fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.2s ease" }}>{children}</button>;
}

function PillSelect({ options, value, onChange, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {label && <span style={{ fontSize: 11, color: T.textMuted, fontFamily: FONTS.mono, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>}
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{ background: value === o.value ? "rgba(88,166,255,0.15)" : "transparent", color: value === o.value ? T.accent : T.textMuted, border: `1px solid ${value === o.value ? "rgba(88,166,255,0.3)" : T.border}`, borderRadius: 6, padding: "5px 12px", fontSize: 12, fontFamily: FONTS.body, cursor: "pointer", transition: "all 0.15s" }}>{o.label}</button>
      ))}
    </div>
  );
}

function CountModeToggle({ value, onChange }) {
  return (
    <div style={{ display: "inline-flex", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
      {[{ key: "total", label: "Total" }, { key: "unique", label: "Unique Accounts" }].map((m) => (
        <button key={m.key} onClick={() => onChange(m.key)} style={{ background: value === m.key ? "rgba(88,166,255,0.2)" : "transparent", color: value === m.key ? T.accent : T.textMuted, border: "none", borderRight: m.key === "total" ? `1px solid ${T.border}` : "none", padding: "7px 16px", fontSize: 12, fontFamily: FONTS.mono, cursor: "pointer", transition: "all 0.15s", fontWeight: value === m.key ? 600 : 400 }}>{m.label}</button>
      ))}
    </div>
  );
}

// ─── CSV Column Mapper Modal ──────────────────────────────────────
function ColumnMapper({ tableKey, csvHeaders, csvRows, onConfirm, onCancel }) {
  const schema = SCHEMA[tableKey];
  const [mapping, setMapping] = useState(() => autoMapColumns(csvHeaders, tableKey));
  const unmappedRequired = Object.entries(schema.fields).filter(([k, f]) => f.required && !mapping[k]);
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const totalFields = Object.keys(schema.fields).length;
  const sampleRows = csvRows.slice(0, 3);

  const updateMapping = (fieldKey, csvCol) => setMapping((prev) => ({ ...prev, [fieldKey]: csvCol }));

  // Status badge
  const statusFor = (fieldKey) => {
    const csvCol = mapping[fieldKey];
    if (!csvCol) return schema.fields[fieldKey].required ? { color: T.danger, label: "REQUIRED" } : { color: T.textDim, label: "unmapped" };
    const lowerCol = csvCol.toLowerCase().trim();
    if (lowerCol === fieldKey) return { color: T.success, label: "exact" };
    if (schema.fields[fieldKey].aliases.includes(lowerCol)) return { color: T.accent, label: "alias" };
    return { color: T.meeting, label: "manual" };
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 16, maxWidth: 800, width: "100%", maxHeight: "90vh", overflow: "auto", padding: 32 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Map Columns — {schema.label}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{csvHeaders.length} columns detected · {csvRows.length} rows · {mappedCount}/{totalFields} fields mapped</div>
          </div>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 20, cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        {/* Mapping Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONTS.mono, fontSize: 12, marginBottom: 20 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              <th style={{ padding: "8px 12px", textAlign: "left", color: T.textMuted, fontSize: 10, textTransform: "uppercase", fontWeight: 500, width: "30%" }}>Engine Field</th>
              <th style={{ padding: "8px 12px", textAlign: "left", color: T.textMuted, fontSize: 10, textTransform: "uppercase", fontWeight: 500, width: "35%" }}>Your CSV Column</th>
              <th style={{ padding: "8px 12px", textAlign: "left", color: T.textMuted, fontSize: 10, textTransform: "uppercase", fontWeight: 500, width: "15%" }}>Status</th>
              <th style={{ padding: "8px 12px", textAlign: "left", color: T.textMuted, fontSize: 10, textTransform: "uppercase", fontWeight: 500, width: "20%" }}>Sample</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(schema.fields).map(([fieldKey, fieldDef]) => {
              const status = statusFor(fieldKey);
              const sampleVal = mapping[fieldKey] && sampleRows[0] ? sampleRows[0][mapping[fieldKey]] : "—";
              return (
                <tr key={fieldKey} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ color: T.text, fontWeight: 500 }}>{fieldDef.label}</div>
                    <div style={{ fontSize: 10, color: T.textDim }}>{fieldKey}</div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <select
                      value={mapping[fieldKey] || ""}
                      onChange={(e) => updateMapping(fieldKey, e.target.value)}
                      style={{
                        width: "100%", background: T.card, color: T.text, border: `1px solid ${mapping[fieldKey] ? T.borderLight : T.danger + "66"}`,
                        borderRadius: 6, padding: "6px 10px", fontSize: 12, fontFamily: FONTS.mono, cursor: "pointer",
                        outline: "none",
                      }}>
                      <option value="">— select column —</option>
                      {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 10, fontFamily: FONTS.mono, color: status.color, background: `${status.color}15`, padding: "2px 8px", borderRadius: 4 }}>{status.label}</span>
                  </td>
                  <td style={{ padding: "10px 12px", color: T.textMuted, fontSize: 11, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sampleVal}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Validation warnings */}
        {unmappedRequired.length > 0 && (
          <div style={{ background: `${T.danger}10`, border: `1px solid ${T.danger}33`, borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: T.danger, fontFamily: FONTS.mono }}>
            ⚠ Required fields missing: {unmappedRequired.map(([k]) => k).join(", ")}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ background: "transparent", color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontFamily: FONTS.body }}>Cancel</button>
          <button
            onClick={() => onConfirm(mapping)}
            disabled={unmappedRequired.length > 0}
            style={{
              background: unmappedRequired.length > 0 ? T.textDim : T.accent,
              color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px",
              fontSize: 13, fontWeight: 600, cursor: unmappedRequired.length > 0 ? "not-allowed" : "pointer",
              fontFamily: FONTS.body, opacity: unmappedRequired.length > 0 ? 0.5 : 1,
            }}>
            Confirm Mapping ({mappedCount} fields)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Coverage Heatmap ─────────────────────────────────────────────
function CoverageHeatmap({ accounts, engagements, pipeline, months, onAccountClick }) {
  const heatColor = (count) => {
    if (count === 0) return T.heatNone;
    if (count <= 2) return T.heatLow;
    if (count <= 5) return T.heatMed;
    if (count <= 10) return T.heatHigh;
    return T.heatMax;
  };

  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      const aTotal = engagements.filter((e) => e.customer_account === a.customer_account).length;
      const bTotal = engagements.filter((e) => e.customer_account === b.customer_account).length;
      return bTotal - aTotal;
    });
  }, [accounts, engagements]);

  const pipeAcctMonths = useMemo(() => {
    const set = new Set();
    pipeline.forEach((p) => { if (p.created_date) set.add(`${p.customer_account}|${p.created_date.slice(0, 7)}`); });
    return set;
  }, [pipeline]);

  const [hoveredCell, setHoveredCell] = useState(null);

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Engagement Coverage</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>Accounts × months · color = engagement intensity · ◈ = pipeline created</div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 10, fontFamily: FONTS.mono, color: T.textMuted }}>
          <span>Less</span>
          {[T.heatNone, T.heatLow, T.heatMed, T.heatHigh, T.heatMax].map((c, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c, border: `1px solid ${T.border}` }} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 500 }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 2, fontFamily: FONTS.mono, fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ position: "sticky", left: 0, background: T.card, zIndex: 2, padding: "4px 12px 4px 0", textAlign: "left", color: T.textMuted, fontSize: 10, fontWeight: 500, minWidth: 160 }}>Account</th>
              {months.map((m) => (
                <th key={m} style={{ padding: "4px 6px", color: T.textMuted, fontSize: 10, fontWeight: 500, textAlign: "center", minWidth: 56 }}>{monthLabel(m)}</th>
              ))}
              <th style={{ padding: "4px 8px", color: T.textMuted, fontSize: 10, fontWeight: 500, textAlign: "center" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedAccounts.map((acct) => {
              const acctTotal = engagements.filter((e) => e.customer_account === acct.customer_account).length;
              return (
                <tr key={acct.customer_account}>
                  <td
                    onClick={() => onAccountClick(acct.customer_account)}
                    style={{ position: "sticky", left: 0, background: T.card, zIndex: 1, padding: "4px 12px 4px 0", color: T.text, fontWeight: 500, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}
                    title={acct.customer_account}>
                    {acct.customer_account}
                  </td>
                  {months.map((m) => {
                    const count = engagements.filter((e) => e.customer_account === acct.customer_account && e.date.startsWith(m)).length;
                    const hasPipe = pipeAcctMonths.has(`${acct.customer_account}|${m}`);
                    const isHovered = hoveredCell === `${acct.customer_account}|${m}`;
                    return (
                      <td key={m} style={{ padding: 0, textAlign: "center" }}
                        onMouseEnter={() => setHoveredCell(`${acct.customer_account}|${m}`)}
                        onMouseLeave={() => setHoveredCell(null)}>
                        <div style={{
                          width: 48, height: 28, borderRadius: 3, background: heatColor(count),
                          display: "flex", alignItems: "center", justifyContent: "center",
                          position: "relative", cursor: "default",
                          outline: isHovered ? `2px solid ${T.accent}` : "none",
                          transition: "outline 0.1s",
                        }}>
                          {count > 0 && <span style={{ fontSize: 10, color: count > 5 ? "#fff" : T.textMuted, fontWeight: 600 }}>{count}</span>}
                          {hasPipe && <span style={{ position: "absolute", top: 1, right: 2, fontSize: 8, color: T.pipeline }}>◈</span>}
                        </div>
                        {isHovered && (
                          <div style={{
                            position: "absolute", zIndex: 10, background: T.card, border: `1px solid ${T.borderLight}`,
                            borderRadius: 6, padding: "8px 12px", fontSize: 10, color: T.text, whiteSpace: "nowrap",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.4)", marginTop: 4, transform: "translateX(-25%)",
                          }}>
                            <div style={{ fontWeight: 600 }}>{acct.customer_account}</div>
                            <div style={{ color: T.textMuted }}>{monthLabel(m)}</div>
                            <div style={{ marginTop: 4 }}>
                              {ENG_TYPES.map((t) => {
                                const tc = engagements.filter((e) => e.customer_account === acct.customer_account && e.date.startsWith(m) && e.type === t.type).length;
                                return tc > 0 ? <div key={t.key} style={{ color: t.color }}>{t.label}: {tc}</div> : null;
                              })}
                              {count === 0 && <div style={{ color: T.danger }}>No engagement</div>}
                            </div>
                            {hasPipe && <div style={{ color: T.pipeline, marginTop: 2 }}>◈ Pipeline created</div>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ padding: "4px 8px", textAlign: "center", color: acctTotal > 0 ? T.text : T.textDim, fontWeight: 600 }}>{acctTotal}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Gap summary */}
      {(() => {
        const totalCells = sortedAccounts.length * months.length;
        const zeroCells = sortedAccounts.reduce((sum, a) => sum + months.filter((m) => engagements.filter((e) => e.customer_account === a.customer_account && e.date.startsWith(m)).length === 0).length, 0);
        const gapPct = totalCells ? Math.round((zeroCells / totalCells) * 100) : 0;
        return (
          <div style={{ marginTop: 12, display: "flex", gap: 20, fontSize: 11, fontFamily: FONTS.mono, color: T.textMuted }}>
            <span><span style={{ color: gapPct > 30 ? T.danger : T.success, fontWeight: 600 }}>{gapPct}%</span> coverage gaps ({zeroCells} of {totalCells} account-months with zero engagement)</span>
            <span><span style={{ color: T.pipeline }}>◈</span> = pipeline created in that month</span>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────
export default function EngagementDashboard() {
  const [view, setView] = useState("rep");
  const [dataMode, setDataMode] = useState("demo");
  const [countMode, setCountMode] = useState("total");
  const [timeRange, setTimeRange] = useState("all");
  const [selectedRep, setSelectedRep] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [liveData, setLiveData] = useState({ accounts: null, engagements: null, pipeline: null, quotes: null, hierarchy: null });
  // Column mapper state
  const [mapperState, setMapperState] = useState(null); // { tableKey, csvHeaders, csvRows }
  const [resolveReport, setResolveReport] = useState(null); // { tableKey, stats }
  const [showDiag, setShowDiag] = useState(false);

  const demo = useMemo(() => generateDemoData(), []);
  const data = useMemo(() => {
    if (dataMode === "demo") return demo;
    // Merge live uploads with demo fallback for missing tables
    return {
      accounts: liveData.accounts || demo.accounts,
      engagements: liveData.engagements || demo.engagements,
      pipeline: liveData.pipeline || demo.pipeline,
      quotes: liveData.quotes || demo.quotes,
    };
  }, [dataMode, liveData, demo]);

  const reps = useMemo(() => [...new Set(data.accounts.map((a) => a.rep))], [data]);
  // Derived active selections — always have a valid value on first render
  const activeRep = selectedRep && reps.includes(selectedRep) ? selectedRep : reps[0] || null;
  const activeAccount = selectedAccount && data.accounts.some((a) => a.customer_account === selectedAccount) ? selectedAccount : data.accounts[0]?.customer_account || null;

  // ─── Month list (for heatmap) ────────────────────────────────
  const allMonths = useMemo(() =>
    [...new Set(data.engagements.map((e) => (e.date || "").slice(0, 7)).filter((m) => m && m.length === 7 && m.includes("-")))].sort()
  , [data]);

  // ─── Day list (for charts) ─────────────────────────────────
  const allDays = useMemo(() => {
    const engDays = data.engagements.map((e) => e.date).filter((d) => d && d.length === 10);
    const pipeDays = data.pipeline.map((p) => p.created_date).filter((d) => d && d.length === 10);
    return [...new Set([...engDays, ...pipeDays])].sort();
  }, [data]);

  // Derive "latest" from data for time range anchoring
  const latestDay = allDays.length ? allDays[allDays.length - 1] : "2026-03-31";
  const latestMonth = latestDay.slice(0, 7);
  const [latestYear] = latestMonth.split("-");
  const latestQuarterStart = (() => {
    const mo = parseInt(latestMonth.split("-")[1]);
    const qStart = Math.floor((mo - 1) / 3) * 3 + 1;
    return `${latestYear}-${String(qStart).padStart(2, "0")}`;
  })();

  // Filtered months (for heatmap)
  const months = useMemo(() => {
    if (timeRange === "month") return allMonths.filter((m) => m === latestMonth);
    if (timeRange === "qtd") return allMonths.filter((m) => m >= latestQuarterStart && m <= latestMonth);
    if (timeRange === "ytd") return allMonths.filter((m) => m.startsWith(latestYear) && m <= latestMonth);
    // "all" — extend back to Jan 2025
    return allMonths.filter((m) => m >= "2025-01");
  }, [allMonths, timeRange, latestMonth, latestYear, latestQuarterStart]);

  // ─── Week helper: get Monday of the week for any YYYY-MM-DD ──
  const getWeekStart = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday = 1
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // Filtered weeks (for charts) — derived from allDays
  const weeks = useMemo(() => {
    let filtered;
    if (timeRange === "month") filtered = allDays.filter((d) => d.startsWith(latestMonth));
    else if (timeRange === "qtd") filtered = allDays.filter((d) => d.slice(0, 7) >= latestQuarterStart && d.slice(0, 7) <= latestMonth);
    else if (timeRange === "ytd") filtered = allDays.filter((d) => d.startsWith(latestYear) && d <= latestDay);
    else filtered = allDays.filter((d) => d >= "2025-01-01");
    return [...new Set(filtered.map(getWeekStart))].sort();
  }, [allDays, timeRange, latestMonth, latestDay, latestYear, latestQuarterStart]);

  // Date-aware filter for raw data arrays
  const inRange = useCallback((dateStr) => {
    if (!dateStr) return false;
    if (timeRange === "month") return dateStr.startsWith(latestMonth);
    if (timeRange === "qtd") { const m = dateStr.slice(0, 7); return m >= latestQuarterStart && m <= latestMonth; }
    if (timeRange === "ytd") return dateStr.startsWith(latestYear) && dateStr <= latestDay;
    return dateStr >= "2025-01-01";
  }, [timeRange, latestMonth, latestDay, latestYear, latestQuarterStart]);

  // ─── Positive pipeline helper (amount > 0, 2026 only) ──────
  const isPosP = (p) => (p.amount || 0) > 0 && (p.created_date || "").startsWith("2026");

  // ─── Weekly chart data builder ─────────────────────────────
  const buildWeeklyData = useCallback((filterFn) => {
    // Pre-index engagements, pipeline, and quotes by week start
    const engByWeek = {};
    const pipeByWeek = {};
    const quoteByWeek = {};
    data.engagements.forEach((e) => {
      if (!e.date || e.date.length < 10 || !filterFn(e)) return;
      const w = getWeekStart(e.date);
      (engByWeek[w] = engByWeek[w] || []).push(e);
    });
    data.pipeline.forEach((p) => {
      if (!p.created_date || p.created_date.length < 10 || !isPosP(p) || !filterFn(p)) return;
      const w = getWeekStart(p.created_date);
      (pipeByWeek[w] = pipeByWeek[w] || []).push(p);
    });
    data.quotes.forEach((q) => {
      if (!q.quote_date || q.quote_date.length < 10 || !filterFn(q)) return;
      const w = getWeekStart(q.quote_date);
      (quoteByWeek[w] = quoteByWeek[w] || []).push(q);
    });

    return weeks.map((w) => {
      const wEngs = engByWeek[w] || [];
      const wPipe = pipeByWeek[w] || [];
      const wQuotes = quoteByWeek[w] || [];
      if (countMode === "total") {
        return { week: w, emails: wEngs.filter((e) => e.type === "Email").length, calls: wEngs.filter((e) => e.type === "Call").length, meetings: wEngs.filter((e) => e.type === "Meeting").length, total: wEngs.length, pipeline: wPipe.reduce((s, p) => s + p.amount, 0), quotes: wQuotes.length };
      }
      const uniqueByType = (type) => new Set(wEngs.filter((e) => e.type === type).map((e) => e.customer_account)).size;
      return { week: w, emails: uniqueByType("Email"), calls: uniqueByType("Call"), meetings: uniqueByType("Meeting"), total: new Set(wEngs.map((e) => e.customer_account)).size, pipeline: wPipe.reduce((s, p) => s + p.amount, 0), quotes: wQuotes.length };
    });
  }, [data, weeks, countMode]);

  // Week label formatter for X axis — "Jan 6" for the Monday
  const weekLabel = (w) => {
    if (!w || w.length < 10) return w || "";
    const mo = parseInt(w.slice(5, 7));
    const dy = parseInt(w.slice(8, 10));
    const names = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${names[mo]} ${dy}`;
  };

  // ─── CSV Upload → Column Mapper ───────────────────────────────
  const handleFileSelect = (tableKey) => (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields || [];
        setMapperState({ tableKey, csvHeaders: headers, csvRows: result.data });
      },
    });
    e.target.value = "";
  };

  const handleMappingConfirm = (mapping) => {
    const { tableKey, csvRows } = mapperState;
    let transformed = transformRows(csvRows, mapping, tableKey);

    // For data tables (not accounts or hierarchy), resolve account references
    if (tableKey !== "accounts" && tableKey !== "hierarchy" && transformed.length > 0) {
      const accountsList = liveData.accounts || demo.accounts;
      const hierarchyList = liveData.hierarchy || [];
      const { resolved, stats } = resolveAccountIds(transformed, accountsList, hierarchyList);
      transformed = resolved;
      if (stats && (stats.hierarchyMatch > 0 || stats.directMatch > 0 || stats.fuzzyMatch > 0 || stats.unresolved > 0)) {
        setResolveReport({ tableKey, stats });
        setTimeout(() => setResolveReport(null), 8000);
      }
    }

    setLiveData((prev) => ({ ...prev, [tableKey]: transformed }));
    setDataMode("live");
    setMapperState(null);
  };

  const yLabel = countMode === "unique" ? "Unique Accounts" : "Engagements";
  const chartSubtitle = countMode === "unique" ? "Distinct accounts engaged per type each week · pipeline MRR overlay" : "Weekly engagement count by type · pipeline MRR overlay";

  // ─── Rep View ─────────────────────────────────────────────────
  function RepView() {
    const repData = buildWeeklyData((e) => e.rep === activeRep);
    const repAccounts = data.accounts.filter((a) => a.rep === activeRep);
    const repPipeline = data.pipeline.filter((p) => p.rep === activeRep && inRange(p.created_date) && isPosP(p));
    const repQuotes = data.quotes.filter((q) => q.rep === activeRep && inRange(q.quote_date));
    const repEngs = data.engagements.filter((e) => e.rep === activeRep && inRange(e.date));
    const totalEng = repEngs.length;
    const totalPipe = repPipeline.reduce((s, p) => s + (p.amount || 0), 0);
    const uniqueAcctsEngaged = new Set(repEngs.map((e) => e.customer_account)).size;
    const pipePerEng = totalEng ? Math.round(totalPipe / totalEng) : 0;

    const acctBreakdown = repAccounts.map((a) => {
      const engs = data.engagements.filter((e) => e.customer_account === a.customer_account && inRange(e.date));
      const pipe = data.pipeline.filter((p) => p.customer_account === a.customer_account && inRange(p.created_date) && isPosP(p));
      const monthsEngaged = new Set(engs.map((e) => e.date.slice(0, 7))).size;
      return {
        name: a.customer_account, mega_vertical: a.mega_vertical,
        emails: countMode === "total" ? engs.filter((e) => e.type === "Email").length : new Set(engs.filter((e) => e.type === "Email").map((e) => e.date.slice(0, 7))).size,
        calls: countMode === "total" ? engs.filter((e) => e.type === "Call").length : new Set(engs.filter((e) => e.type === "Call").map((e) => e.date.slice(0, 7))).size,
        meetings: countMode === "total" ? engs.filter((e) => e.type === "Meeting").length : new Set(engs.filter((e) => e.type === "Meeting").map((e) => e.date.slice(0, 7))).size,
        total: countMode === "total" ? engs.length : monthsEngaged,
        pipeline: pipe.reduce((s, p) => s + (p.amount || 0), 0),
        opps: pipe.length,
      };
    }).sort((a, b) => b.total - a.total);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <PillSelect label="Rep:" options={reps.map((r) => ({ value: r, label: r }))} value={activeRep} onChange={setSelectedRep} />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Stat label="Total Engagements" value={fmtNum(totalEng)} color={T.accent} icon="⚡" />
          <Stat label="Pipeline MRR (2026)" value={fmt(totalPipe)} sub={`${repPipeline.length} opportunities`} color={T.pipeline} icon="◈" />
          <Stat label="Quotes Created" value={repQuotes.length} color={T.quote} icon="☰" />
          <Stat label="Unique Accounts Engaged" value={uniqueAcctsEngaged} sub={`of ${repAccounts.length} assigned`} color={T.meeting} icon="◉" />
          <Stat label="MRR / Engagement" value={fmt(pipePerEng)} color={T.success} icon="△" />
        </div>

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Engagement Activity & Pipeline Created</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 20 }}>{chartSubtitle}</div>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={repData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="week" tickFormatter={weekLabel} tick={{ fill: T.textMuted, fontSize: 11, fontFamily: FONTS.mono }} stroke={T.border} interval={Math.max(0, Math.floor(weeks.length / 12) - 1)} />
              <YAxis yAxisId="eng" tick={{ fill: T.textMuted, fontSize: 11, fontFamily: FONTS.mono }} stroke={T.border} label={{ value: yLabel, angle: -90, position: "insideLeft", fill: T.textDim, fontSize: 10, fontFamily: FONTS.mono }} />
              <YAxis yAxisId="pipe" orientation="right" tick={{ fill: T.textMuted, fontSize: 11, fontFamily: FONTS.mono }} stroke={T.border} tickFormatter={fmt} />
              <Tooltip content={<ChartTooltip />} />
              <Area yAxisId="eng" type="monotone" dataKey="emails" stackId="1" fill={T.email} fillOpacity={0.3} stroke={T.email} strokeWidth={1.5} name="Emails" />
              <Area yAxisId="eng" type="monotone" dataKey="calls" stackId="1" fill={T.call} fillOpacity={0.3} stroke={T.call} strokeWidth={1.5} name="Calls" />
              <Area yAxisId="eng" type="monotone" dataKey="meetings" stackId="1" fill={T.meeting} fillOpacity={0.3} stroke={T.meeting} strokeWidth={1.5} name="Meetings" />
              <Bar yAxisId="eng" dataKey="quotes" fill={T.quote} fillOpacity={0.7} name="Quotes" radius={[2, 2, 0, 0]} barSize={8} />
              <Line yAxisId="pipe" type="monotone" dataKey="pipeline" stroke={T.pipeline} strokeWidth={2.5} dot={{ fill: T.pipeline, r: 4, strokeWidth: 0 }} name="Pipeline MRR" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Coverage Heatmap */}
        <CoverageHeatmap accounts={repAccounts} engagements={repEngs} pipeline={repPipeline} months={months} onAccountClick={(id) => { setSelectedAccount(id); setView("account"); }} />

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Account Engagement Breakdown</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 16 }}>{countMode === "unique" ? "Columns show # of months with that engagement type" : "Columns show total count of each engagement type"}</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONTS.mono, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Account", "Mega Vertical", "Emails", "Calls", "Meetings", "Total", "Pipeline", "Opps"].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: h === "Account" || h === "Mega Vertical" ? "left" : "right", color: T.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {acctBreakdown.map((a, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer" }} onClick={() => { setSelectedAccount(data.accounts.find((ac) => ac.customer_account === a.name)?.customer_account); setView("account"); }}>
                    <td style={{ padding: "10px 12px", color: T.text, fontWeight: 500 }}>{a.name}</td>
                    <td style={{ padding: "10px 12px", color: T.textMuted, fontSize: 11 }}>{a.mega_vertical}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: T.email }}>{a.emails}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: T.call }}>{a.calls}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: T.meeting }}>{a.meetings}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: T.text, fontWeight: 600 }}>{a.total}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: T.pipeline }}>{fmt(a.pipeline)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: T.textMuted }}>{a.opps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ─── Team View ────────────────────────────────────────────────
  function TeamView() {
    const repStats = reps.map((rep) => {
      const engs = data.engagements.filter((e) => e.rep === rep && inRange(e.date));
      const pipe = data.pipeline.filter((p) => p.rep === rep && inRange(p.created_date) && isPosP(p));
      const accts = data.accounts.filter((a) => a.rep === rep);
      const rQuotes = data.quotes.filter((q) => q.rep === rep && inRange(q.quote_date));
      const uniqueEngaged = new Set(engs.map((e) => e.customer_account)).size;
      return { name: rep.split(" ")[0], fullName: rep, emails: engs.filter((e) => e.type === "Email").length, calls: engs.filter((e) => e.type === "Call").length, meetings: engs.filter((e) => e.type === "Meeting").length, total: engs.length, pipeline: pipe.reduce((s, p) => s + (p.amount || 0), 0), opps: pipe.length, quotes: rQuotes.length, accounts: accts.length, uniqueEngaged, coverage: accts.length ? Math.round((uniqueEngaged / accts.length) * 100) : 0, pipePerEng: engs.length ? Math.round(pipe.reduce((s, p) => s + (p.amount || 0), 0) / engs.length) : 0 };
    });
    const teamWeekly = buildWeeklyData(() => true);
    const rangedEngs = data.engagements.filter((e) => inRange(e.date));
    const rangedPipe = data.pipeline.filter((p) => inRange(p.created_date) && isPosP(p));
    const rangedQuotes = data.quotes.filter((q) => inRange(q.quote_date));
    const totalEng = rangedEngs.length;
    const totalPipe = rangedPipe.reduce((s, p) => s + (p.amount || 0), 0);
    const totalQuotes = rangedQuotes.length;
    const totalUniqueEngaged = new Set(rangedEngs.map((e) => e.customer_account)).size;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Stat label="Team Engagements" value={fmtNum(totalEng)} color={T.accent} icon="⚡" />
          <Stat label="Pipeline MRR (2026)" value={fmt(totalPipe)} sub={`${rangedPipe.length} opportunities`} color={T.pipeline} icon="◈" />
          <Stat label="Quotes Created" value={totalQuotes} color={T.quote} icon="☰" />
          <Stat label="Unique Accounts Engaged" value={totalUniqueEngaged} sub={`of ${data.accounts.length} total`} color={T.meeting} icon="◉" />
          <Stat label="Avg MRR/Eng" value={fmt(totalEng ? Math.round(totalPipe / totalEng) : 0)} color={T.success} icon="△" />
        </div>

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Team Engagement Trend</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 20 }}>{chartSubtitle}</div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={teamWeekly} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="week" tickFormatter={weekLabel} tick={{ fill: T.textMuted, fontSize: 11, fontFamily: FONTS.mono }} stroke={T.border} interval={Math.max(0, Math.floor(weeks.length / 12) - 1)} />
              <YAxis yAxisId="eng" tick={{ fill: T.textMuted, fontSize: 11, fontFamily: FONTS.mono }} stroke={T.border} label={{ value: yLabel, angle: -90, position: "insideLeft", fill: T.textDim, fontSize: 10, fontFamily: FONTS.mono }} />
              <YAxis yAxisId="pipe" orientation="right" tick={{ fill: T.textMuted, fontSize: 11, fontFamily: FONTS.mono }} stroke={T.border} tickFormatter={fmt} />
              <Tooltip content={<ChartTooltip />} />
              <Area yAxisId="eng" type="monotone" dataKey="emails" stackId="1" fill={T.email} fillOpacity={0.25} stroke={T.email} strokeWidth={1.5} name="Emails" />
              <Area yAxisId="eng" type="monotone" dataKey="calls" stackId="1" fill={T.call} fillOpacity={0.25} stroke={T.call} strokeWidth={1.5} name="Calls" />
              <Area yAxisId="eng" type="monotone" dataKey="meetings" stackId="1" fill={T.meeting} fillOpacity={0.25} stroke={T.meeting} strokeWidth={1.5} name="Meetings" />
              <Bar yAxisId="eng" dataKey="quotes" fill={T.quote} fillOpacity={0.7} name="Quotes" radius={[2, 2, 0, 0]} barSize={8} />
              <Line yAxisId="pipe" type="monotone" dataKey="pipeline" stroke={T.pipeline} strokeWidth={2.5} dot={{ fill: T.pipeline, r: 4, strokeWidth: 0 }} name="Pipeline MRR" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Team-wide heatmap */}
        <CoverageHeatmap accounts={data.accounts} engagements={rangedEngs} pipeline={rangedPipe} months={months} onAccountClick={(id) => { setSelectedAccount(id); setView("account"); }} />

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Rep Comparison</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 20 }}>Engagement mix by rep</div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={repStats} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
              <XAxis type="number" tick={{ fill: T.textMuted, fontSize: 11, fontFamily: FONTS.mono }} stroke={T.border} />
              <YAxis dataKey="name" type="category" tick={{ fill: T.text, fontSize: 12, fontFamily: FONTS.body }} stroke={T.border} width={70} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="emails" stackId="1" fill={T.email} fillOpacity={0.8} name="Emails" radius={0} />
              <Bar dataKey="calls" stackId="1" fill={T.call} fillOpacity={0.8} name="Calls" radius={0} />
              <Bar dataKey="meetings" stackId="1" fill={T.meeting} fillOpacity={0.8} name="Meetings" radius={[0, 4, 4, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {repStats.map((r) => (
            <div key={r.fullName} onClick={() => { setSelectedRep(r.fullName); setView("rep"); }}
              style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = T.accent}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = T.border}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 12 }}>{r.fullName}</div>
              <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                <div><div style={{ fontSize: 10, color: T.textMuted, fontFamily: FONTS.mono, textTransform: "uppercase" }}>Engagements</div><div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: FONTS.mono }}>{r.total}</div></div>
                <div><div style={{ fontSize: 10, color: T.textMuted, fontFamily: FONTS.mono, textTransform: "uppercase" }}>Pipeline MRR</div><div style={{ fontSize: 20, fontWeight: 700, color: T.pipeline, fontFamily: FONTS.mono }}>{fmt(r.pipeline)}</div></div>
                <div><div style={{ fontSize: 10, color: T.textMuted, fontFamily: FONTS.mono, textTransform: "uppercase" }}>Coverage</div><div style={{ fontSize: 20, fontWeight: 700, color: r.coverage >= 80 ? T.success : r.coverage >= 50 ? T.meeting : T.danger, fontFamily: FONTS.mono }}>{r.coverage}%</div></div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ENG_TYPES.map((t) => (
                  <span key={t.key} style={{ fontSize: 11, fontFamily: FONTS.mono, color: t.color, background: `${t.color}15`, padding: "2px 8px", borderRadius: 4 }}>{t.label.charAt(0)}: {r[t.key]}</span>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: T.textMuted }}>
                <span style={{ fontFamily: FONTS.mono, color: T.success }}>{fmt(r.pipePerEng)}</span> pipeline/eng · <span style={{ fontFamily: FONTS.mono, color: T.quote }}>{r.quotes}</span> quotes · {r.uniqueEngaged}/{r.accounts} accounts · {r.opps} opps
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Account View ─────────────────────────────────────────────
  function AccountView() {
    const acct = data.accounts.find((a) => a.customer_account === activeAccount);
    if (!acct) return <div style={{ color: T.textMuted }}>Select an account</div>;
    const acctEngs = data.engagements.filter((e) => e.customer_account === activeAccount && inRange(e.date));
    const acctPipe = data.pipeline.filter((p) => p.customer_account === activeAccount && inRange(p.created_date) && isPosP(p));
    const acctQuotes = data.quotes.filter((q) => q.customer_account === activeAccount && inRange(q.quote_date));
    const acctWeekly = buildWeeklyData((e) => e.customer_account === activeAccount);
    const timeline = [...acctEngs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
    const typeIcons = { email: "✉", call: "☏", meeting: "◎" };
    const typeColors = { email: T.email, call: T.call, meeting: T.meeting };
    const stages = ["Discover", "Qualify", "Propose", "Negotiate", "Verbal Agreement"];
    const monthsEngaged = new Set(acctEngs.map((e) => e.date.slice(0, 7))).size;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <PillSelect label="Account:" options={data.accounts.map((a) => ({ value: a.customer_account, label: a.customer_account }))} value={activeAccount} onChange={setSelectedAccount} />

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.text }}>{acct.customer_account}</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>{acct.mega_vertical} · Rep: <span style={{ color: T.accent }}>{acct.rep}</span></div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: T.textMuted, fontFamily: FONTS.mono, textTransform: "uppercase" }}>Total BRR</div><div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: FONTS.mono }}>{fmt(acct.total_brr || 0)}</div></div>
            <div style={{ width: 1, height: 36, background: T.border }} />
            <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: T.textMuted, fontFamily: FONTS.mono, textTransform: "uppercase" }}>Pipeline MRR</div><div style={{ fontSize: 20, fontWeight: 700, color: T.pipeline, fontFamily: FONTS.mono }}>{fmt(acctPipe.reduce((s, p) => s + (p.amount || 0), 0))}</div></div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Stat label="Total Touchpoints" value={acctEngs.length} color={T.accent} icon="⚡" />
          <Stat label="Open Opportunities" value={acctPipe.length} color={T.pipeline} icon="◈" />
          <Stat label="Quotes Created" value={acctQuotes.length} color={T.quote} icon="☰" />
          <Stat label="Months Engaged" value={`${monthsEngaged} of ${months.length}`} color={T.meeting} icon="◉" />
          <Stat label="Engagement Mix" value={`${ENG_TYPES.map((t) => acctEngs.filter((e) => e.type === t.type).length).join(" / ")}`} sub="E / C / M" color={T.call} icon="◧" />
        </div>

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Engagement Over Time</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 20 }}>{chartSubtitle}</div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={acctWeekly} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="week" tickFormatter={weekLabel} tick={{ fill: T.textMuted, fontSize: 11, fontFamily: FONTS.mono }} stroke={T.border} interval={Math.max(0, Math.floor(weeks.length / 12) - 1)} />
              <YAxis yAxisId="eng" tick={{ fill: T.textMuted, fontSize: 11, fontFamily: FONTS.mono }} stroke={T.border} label={{ value: yLabel, angle: -90, position: "insideLeft", fill: T.textDim, fontSize: 10, fontFamily: FONTS.mono }} />
              <YAxis yAxisId="pipe" orientation="right" tick={{ fill: T.textMuted, fontSize: 11, fontFamily: FONTS.mono }} stroke={T.border} tickFormatter={fmt} />
              <Tooltip content={<ChartTooltip />} />
              <Bar yAxisId="eng" dataKey="emails" stackId="1" fill={T.email} fillOpacity={0.7} name="Emails" />
              <Bar yAxisId="eng" dataKey="calls" stackId="1" fill={T.call} fillOpacity={0.7} name="Calls" />
              <Bar yAxisId="eng" dataKey="meetings" stackId="1" fill={T.meeting} fillOpacity={0.7} name="Meetings" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="eng" dataKey="quotes" fill={T.quote} fillOpacity={0.7} name="Quotes" radius={[2, 2, 0, 0]} barSize={8} />
              <Line yAxisId="pipe" type="monotone" dataKey="pipeline" stroke={T.pipeline} strokeWidth={2.5} dot={{ fill: T.pipeline, r: 5, strokeWidth: 2, stroke: T.card }} name="Pipeline MRR" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 16 }}>Pipeline Opportunities</div>
            {acctPipe.length === 0 ? <div style={{ color: T.textDim, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No open opportunities</div> : acctPipe.map((p, i) => {
              const stageIdx = stages.indexOf(p.stage);
              return (
                <div key={i} style={{ padding: "12px 0", borderBottom: i < acctPipe.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>{p.opportunity_name}</div>
                  <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>{stages.map((s, si) => <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: si <= stageIdx ? T.accent : T.border, opacity: si <= stageIdx ? 1 : 0.3 }} />)}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: FONTS.mono }}><span style={{ color: T.accent }}>{p.stage}</span><span style={{ color: T.pipeline }}>{fmt(p.amount || 0)}</span><span style={{ color: T.textMuted }}>Close: {p.close_date}</span></div>
                </div>
              );
            })}
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 16 }}>Recent Activity</div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {timeline.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: `${typeColors[e.type]}15`, color: typeColors[e.type], fontSize: 14, flexShrink: 0 }}>{typeIcons[e.type]}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: T.text, fontWeight: 500, textTransform: "capitalize" }}>{e.type}</div><div style={{ fontSize: 11, color: T.textMuted, fontFamily: FONTS.mono }}>{e.date}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Layout ───────────────────────────────────────────────────
  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: FONTS.body, padding: "24px 28px" }}>
      {/* Column Mapper Modal */}
      {mapperState && (
        <ColumnMapper
          tableKey={mapperState.tableKey}
          csvHeaders={mapperState.csvHeaders}
          csvRows={mapperState.csvRows}
          onConfirm={handleMappingConfirm}
          onCancel={() => setMapperState(null)}
        />
      )}

      {/* Account Resolution Report */}
      {resolveReport && resolveReport.stats && (
        <div style={{
          background: T.card, border: `1px solid ${T.borderLight}`, borderRadius: 10,
          padding: "14px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16,
          fontSize: 12, fontFamily: FONTS.mono, position: "relative",
        }}>
          <div style={{ fontSize: 14 }}>🔗</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: T.text, marginBottom: 4 }}>Account Resolution — {SCHEMA[resolveReport.tableKey]?.label}</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11 }}>
              {resolveReport.stats.hierarchyMatch > 0 && <span style={{ color: T.quote }}>✓ {resolveReport.stats.hierarchyMatch} via hierarchy</span>}
              {resolveReport.stats.directMatch > 0 && <span style={{ color: T.success }}>✓ {resolveReport.stats.directMatch} direct match</span>}
              {resolveReport.stats.fuzzyMatch > 0 && <span style={{ color: T.meeting }}>~ {resolveReport.stats.fuzzyMatch} fuzzy matched</span>}
              {resolveReport.stats.unresolved > 0 && <span style={{ color: T.danger }}>✗ {resolveReport.stats.unresolved} unresolved</span>}
            </div>
            {resolveReport.stats.unresolved > 0 && (
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>Unresolved rows kept with original account value — import Customers and Hierarchy first for best results</div>
            )}
          </div>
          <button onClick={() => setResolveReport(null)} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 16, cursor: "pointer", padding: 4 }}>✕</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: FONTS.mono, color: T.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>RevOS</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>Engagement Dashboard</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>Activity coverage & pipeline overlay</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Time Range */}
          <div style={{ display: "inline-flex", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
            {[{ key: "all", label: "All Time" }, { key: "ytd", label: "YTD" }, { key: "qtd", label: "QTD" }, { key: "month", label: "This Month" }].map((m, i, arr) => (
              <button key={m.key} onClick={() => setTimeRange(m.key)} style={{
                background: timeRange === m.key ? "rgba(88,166,255,0.2)" : "transparent",
                color: timeRange === m.key ? T.accent : T.textMuted,
                border: "none", borderRight: i < arr.length - 1 ? `1px solid ${T.border}` : "none",
                padding: "7px 14px", fontSize: 12, fontFamily: FONTS.mono,
                cursor: "pointer", transition: "all 0.15s", fontWeight: timeRange === m.key ? 600 : 400,
              }}>{m.label}</button>
            ))}
          </div>
          <CountModeToggle value={countMode} onChange={setCountMode} />
          <div style={{ display: "flex", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
            {["demo", "live"].map((m) => (
              <button key={m} onClick={() => setDataMode(m)} style={{ background: dataMode === m ? T.accent : "transparent", color: dataMode === m ? "#fff" : T.textMuted, border: "none", padding: "6px 14px", fontSize: 11, fontFamily: FONTS.mono, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m}</button>
            ))}
          </div>
        </div>
      </div>

      {/* CSV Upload Bar (always visible) */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontFamily: FONTS.mono, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Import:</span>
        {Object.entries(SCHEMA).map(([key, schema]) => {
          const isLoaded = liveData[key] !== null;
          const rowCount = liveData[key]?.length;
          return (
            <label key={key} style={{
              fontSize: 11, fontFamily: FONTS.mono, color: isLoaded ? T.success : T.textMuted,
              padding: "6px 12px", border: `1px solid ${isLoaded ? T.success + "44" : T.border}`,
              borderRadius: 6, cursor: "pointer", background: isLoaded ? `${T.success}10` : "transparent",
              transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>{isLoaded ? "✓" : "↑"}</span>
              <span>{schema.label}</span>
              {isLoaded && <span style={{ color: T.textDim, fontSize: 10 }}>({rowCount})</span>}
              <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileSelect(key)} style={{ display: "none" }} />
            </label>
          );
        })}
        {(liveData.accounts || liveData.engagements || liveData.pipeline || liveData.quotes || liveData.hierarchy) && (
          <button onClick={() => { setLiveData({ accounts: null, engagements: null, pipeline: null, quotes: null, hierarchy: null }); setDataMode("demo"); }} style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.danger, background: "transparent", border: `1px solid ${T.danger}33`, borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>Clear All</button>
        )}
        <button onClick={() => setShowDiag((p) => !p)} style={{ fontSize: 10, fontFamily: FONTS.mono, color: showDiag ? T.accent : T.textDim, background: showDiag ? `${T.accent}15` : "transparent", border: `1px solid ${showDiag ? T.accent + "44" : T.border}`, borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>
          {showDiag ? "▼ Diagnostics" : "▶ Diagnostics"}
        </button>
      </div>

      {/* ─── Diagnostics Panel ──────────────────────────────────── */}
      {showDiag && (() => {
        const S = { hd: { fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 8 }, row: { fontSize: 11, fontFamily: FONTS.mono, color: T.textMuted, lineHeight: 1.8 }, val: { color: T.text, fontWeight: 500 }, ok: { color: T.success }, warn: { color: T.meeting }, err: { color: T.danger }, pill: { display: "inline-block", fontSize: 10, fontFamily: FONTS.mono, padding: "1px 6px", borderRadius: 4, marginRight: 4 } };
        const tables = [
          { key: "accounts", label: "Customers", src: liveData.accounts, fields: ["customer_account", "rep", "mega_vertical", "total_brr"] },
          { key: "hierarchy", label: "Hierarchy", src: liveData.hierarchy, fields: ["child_name", "child_id", "parent_name"] },
          { key: "engagements", label: "Engagements", src: liveData.engagements, fields: ["customer_account", "date", "type", "rep"] },
          { key: "pipeline", label: "Pipeline", src: liveData.pipeline, fields: ["customer_account", "opportunity_name", "stage", "amount", "close_date"] },
          { key: "quotes", label: "Quotes", src: liveData.quotes, fields: ["customer_account", "quote_date", "product"] },
        ];
        // Cross-check: which engagement customer_accounts DON'T match any customer
        const custNames = new Set((data.accounts || []).map((a) => a.customer_account?.toLowerCase()));
        const engUnmatched = data.engagements
          ? [...new Set(data.engagements.map((e) => e.customer_account).filter((n) => n && !custNames.has(n.toLowerCase())))]
          : [];
        const pipeUnmatched = data.pipeline
          ? [...new Set(data.pipeline.map((p) => p.customer_account).filter((n) => n && !custNames.has(n.toLowerCase())))]
          : [];
        // Engagement type distribution
        const typeDist = {};
        (data.engagements || []).forEach((e) => { typeDist[e.type || "(empty)"] = (typeDist[e.type || "(empty)"] || 0) + 1; });

        return (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 16 }}>Data Diagnostics</div>

            {/* Active filters */}
            <div style={{ ...S.row, marginBottom: 16, padding: "10px 14px", background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <span style={S.val}>Mode:</span> {dataMode} &nbsp;·&nbsp;
              <span style={S.val}>Time:</span> {timeRange} ({months.length} months: {months.map(monthLabel).join(", ") || "none"}) &nbsp;·&nbsp;
              <span style={S.val}>Count:</span> {countMode} &nbsp;·&nbsp;
              <span style={S.val}>Rep:</span> {activeRep || "—"} &nbsp;·&nbsp;
              <span style={S.val}>Account:</span> {activeAccount || "—"} &nbsp;·&nbsp;
              <span style={S.val}>Latest month:</span> {latestMonth}
            </div>

            {/* Per-table status */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, marginBottom: 16 }}>
              {tables.map(({ key, label, src, fields }) => {
                const isDemo = !src;
                const rows = isDemo ? (key === "hierarchy" ? [] : demo[key] || []) : src;
                const count = rows?.length || 0;
                return (
                  <div key={key} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ ...S.hd, marginBottom: 0 }}>{label}</span>
                      <span style={{ ...S.pill, background: isDemo ? `${T.textDim}20` : `${T.success}15`, color: isDemo ? T.textDim : T.success }}>
                        {isDemo ? "demo" : `live · ${count} rows`}
                      </span>
                    </div>
                    {count > 0 ? (
                      <div>
                        <div style={S.row}>
                          <span style={S.val}>Fields present:</span>{" "}
                          {fields.map((f) => {
                            const hasIt = rows[0] && rows[0][f] !== undefined && rows[0][f] !== "";
                            return <span key={f} style={{ ...S.pill, background: hasIt ? `${T.success}15` : `${T.danger}15`, color: hasIt ? T.success : T.danger }}>{f}</span>;
                          })}
                        </div>
                        <div style={{ ...S.row, marginTop: 6 }}>
                          <span style={S.val}>Sample (row 1):</span>
                          <div style={{ marginTop: 4, fontSize: 10, color: T.textDim, wordBreak: "break-all", maxHeight: 60, overflow: "hidden" }}>
                            {fields.map((f) => `${f}: "${rows[0]?.[f] ?? ""}"`).join(" · ")}
                          </div>
                        </div>
                        {count > 1 && (
                          <div style={{ ...S.row, marginTop: 4 }}>
                            <span style={S.val}>Sample (row 2):</span>
                            <div style={{ marginTop: 4, fontSize: 10, color: T.textDim, wordBreak: "break-all", maxHeight: 60, overflow: "hidden" }}>
                              {fields.map((f) => `${f}: "${rows[1]?.[f] ?? ""}"`).join(" · ")}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ ...S.row, color: T.textDim }}>No data</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cross-checks */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Unmatched accounts */}
              <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 }}>
                <div style={S.hd}>Account Resolution Check</div>
                <div style={S.row}>
                  <span style={S.val}>Customers loaded:</span> <span style={custNames.size > 0 ? S.ok : S.err}>{custNames.size} unique names</span>
                </div>
                <div style={S.row}>
                  <span style={S.val}>Hierarchy loaded:</span> <span style={(liveData.hierarchy?.length || 0) > 0 ? S.ok : S.warn}>{liveData.hierarchy?.length || 0} rows</span>
                  {liveData.hierarchy?.length > 0 && (() => {
                    const names = liveData.hierarchy.filter((h) => h.child_name).length;
                    const ids = liveData.hierarchy.filter((h) => h.child_id).length;
                    return <span style={{ fontSize: 10, color: T.textMuted }}> ({names} name lookups + {ids} ID lookups)</span>;
                  })()}
                </div>
                <div style={S.row}>
                  <span style={S.val}>Engagement accounts not in Customers:</span>{" "}
                  <span style={engUnmatched.length === 0 ? S.ok : S.err}>{engUnmatched.length}</span>
                  {engUnmatched.length > 0 && engUnmatched.length <= 10 && (
                    <div style={{ marginTop: 4, fontSize: 10, color: T.danger }}>{engUnmatched.join(", ")}</div>
                  )}
                  {engUnmatched.length > 10 && (
                    <div style={{ marginTop: 4, fontSize: 10, color: T.danger }}>First 10: {engUnmatched.slice(0, 10).join(", ")}...</div>
                  )}
                </div>
                <div style={S.row}>
                  <span style={S.val}>Pipeline accounts not in Customers:</span>{" "}
                  <span style={pipeUnmatched.length === 0 ? S.ok : S.err}>{pipeUnmatched.length}</span>
                  {pipeUnmatched.length > 0 && pipeUnmatched.length <= 10 && (
                    <div style={{ marginTop: 4, fontSize: 10, color: T.danger }}>{pipeUnmatched.join(", ")}</div>
                  )}
                </div>
              </div>

              {/* Type & date checks */}
              <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 }}>
                <div style={S.hd}>Engagement Type & Date Check</div>
                <div style={S.row}>
                  <span style={S.val}>Type distribution:</span>
                  {Object.entries(typeDist).map(([t, c]) => {
                    const isValid = ["Email", "Call", "Meeting"].includes(t);
                    return <span key={t} style={{ ...S.pill, background: isValid ? `${T.success}15` : `${T.danger}15`, color: isValid ? T.success : T.danger }}>{t}: {c}</span>;
                  })}
                  {Object.keys(typeDist).length === 0 && <span style={S.warn}>No engagements</span>}
                </div>
                <div style={{ ...S.row, marginTop: 6 }}>
                  <span style={S.val}>Date range in data:</span>{" "}
                  {allMonths.length > 0
                    ? <span style={S.ok}>{monthLabel(allMonths[0])} → {monthLabel(allMonths[allMonths.length - 1])} ({allMonths.length} months)</span>
                    : <span style={S.err}>No valid dates found</span>
                  }
                </div>
                <div style={{ ...S.row, marginTop: 6 }}>
                  <span style={S.val}>Filtered months ({timeRange}):</span>{" "}
                  {months.length > 0
                    ? <span style={S.ok}>{months.map(monthLabel).join(", ")}</span>
                    : <span style={S.err}>None — chart will be empty</span>
                  }
                </div>
                <div style={{ ...S.row, marginTop: 6 }}>
                  <span style={S.val}>Engagements in range:</span>{" "}
                  <span style={S.val}>{data.engagements.filter((e) => inRange(e.date)).length}</span> of {data.engagements.length} total
                </div>
                <div style={{ ...S.row, marginTop: 4 }}>
                  <span style={S.val}>Pipeline in range:</span>{" "}
                  <span style={S.val}>{data.pipeline.filter((p) => inRange(p.created_date)).length}</span> of {data.pipeline.length} total
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* View Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <TabBtn active={view === "rep"} onClick={() => setView("rep")}>Rep View</TabBtn>
        <TabBtn active={view === "team"} onClick={() => setView("team")}>Team Roll-up</TabBtn>
        <TabBtn active={view === "account"} onClick={() => setView("account")}>Account Deep Dive</TabBtn>
      </div>

      {view === "rep" && RepView()}
      {view === "team" && TeamView()}
      {view === "account" && AccountView()}

      <div style={{ marginTop: 32, paddingTop: 16, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textDim, fontFamily: FONTS.mono }}>
        <span>RevOS Engagement Dashboard v1.3</span>
        <span>{dataMode === "demo" ? "Demo Data" : "Live Data"} · {{ all: "All Time", ytd: `YTD ${latestYear}`, qtd: `Q${Math.ceil(parseInt(latestMonth.split("-")[1]) / 3)} ${latestYear}`, month: monthLabel(latestMonth) }[timeRange]} · {countMode === "unique" ? "Unique Accounts" : "Total"} · {months.length} months · {data.accounts.length} accounts</span>
      </div>
    </div>
  );
}
