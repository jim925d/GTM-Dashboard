import { useState, useMemo, useCallback, useRef } from "react";
import {
  Area, Bar, ComposedChart, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Line,
} from "recharts";
import * as Papa from "papaparse";
import { cn } from "@/lib/utils";
import { T } from "../lib/constants";

// ─── Semantic color aliases for Recharts & dynamic inline styles ──
const COLORS = {
  email: T.cyan, call: T.green, meeting: T.yellow,
  pipeline: T.blue, quote: T.purple, accent: T.cyan,
  success: T.green, danger: T.red, text: T.text,
  textMuted: T.textDim, textDim: T.borderLight, card: T.card,
  bg: T.bg, border: T.border, borderLight: T.borderLight,
  heatNone: '#161B22', heatLow: '#0d3320', heatMed: '#0f5132', heatHigh: '#238636', heatMax: '#2ea043',
};

const ENG_TYPES = [
  { key: "emails", type: "Email", label: "Emails", color: COLORS.email },
  { key: "calls", type: "Call", label: "Calls", color: COLORS.call },
  { key: "meetings", type: "Meeting", label: "Meetings", color: COLORS.meeting },
];

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
    <div className="bg-revos-card border border-revos-border-light rounded-lg px-4 py-3 font-mono text-[11px] text-revos-text shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <div className="text-revos-text-dim mb-2 text-[10px] tracking-wider uppercase">{displayLabel}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-revos-text-dim flex-1">{p.name}</span>
          <span className="font-semibold">{p.name === "Pipeline MRR" ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, sub, color, icon }) {
  return (
    <div className="bg-revos-card border border-revos-border rounded-[10px] px-5 py-4 flex-1 min-w-[150px] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${color || COLORS.accent}, transparent)` }} />
      <div className="text-[11px] text-revos-text-dim font-mono tracking-wide uppercase mb-1.5">{icon && <span className="mr-1.5">{icon}</span>}{label}</div>
      <div className="text-2xl font-bold text-revos-text font-mono leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-revos-text-dim mt-1">{sub}</div>}
    </div>
  );
}

function SalesFunnel({ engagements, pipeline, quotes, accounts }) {
  const uniqueReached = new Set(engagements.map((e) => e.customer_account)).size;
  const quotedAccounts = new Set(quotes.map((q) => q.customer_account)).size;
  const oppsCreated = pipeline.length;
  const closedWon = pipeline.filter((p) => {
    const s = (p.stage || "").toLowerCase();
    return s === "closed won" || s === "accepted";
  });
  const closedLost = pipeline.filter((p) => (p.stage || "").toLowerCase().includes("lost")).length;
  const closedTotal = closedWon.length + closedLost;
  const winRate = closedTotal > 0 ? closedWon.length / closedTotal : 0;
  const closedMRR = closedWon.reduce((s, p) => s + (p.amount || 0), 0);

  const steps = [
    { label: "Accounts Reached", value: uniqueReached, color: COLORS.accent, sub: "unique outreaches" },
    { label: "Quotes Sent", value: quotedAccounts, color: COLORS.quote, sub: quotes.length + " total quotes", rate: uniqueReached ? quotedAccounts / uniqueReached : 0 },
    { label: "Opps Created", value: oppsCreated, color: COLORS.pipeline, sub: fmt(pipeline.reduce((s, p) => s + (p.amount || 0), 0)) + " pipeline", rate: quotedAccounts ? oppsCreated / quotedAccounts : 0 },
    { label: "Win Rate", value: closedTotal > 0 ? (winRate * 100).toFixed(0) + "%" : "—", color: COLORS.success, sub: closedWon.length + " of " + closedTotal + " decided", rate: null },
    { label: "Closed Won", value: closedWon.length, color: COLORS.success, sub: fmt(closedMRR) + " MRR", rate: oppsCreated ? closedWon.length / oppsCreated : 0 },
  ];

  const maxVal = Math.max(...steps.map((s) => typeof s.value === "number" ? s.value : 0), 1);

  return (
    <div className="bg-revos-card border border-revos-border rounded-xl p-6">
      <div className="text-sm font-semibold text-revos-text mb-1">Sales Funnel Conversion</div>
      <div className="text-[11px] text-revos-text-dim mb-5">Unique account outreaches → quotes → opps → closed deals</div>
      <div className="flex items-end gap-0.5">
        {steps.map((step, i) => {
          const barHeight = typeof step.value === "number" ? Math.max(24, (step.value / maxVal) * 140) : 60;
          return (
            <div key={step.label} className="flex-1 flex flex-col items-center gap-1.5">
              {/* Value */}
              <div className="font-mono text-[22px] font-bold" style={{ color: step.color }}>{typeof step.value === "number" ? fmtNum(step.value) : step.value}</div>
              {/* Bar */}
              <div className="w-full max-w-[120px] relative rounded-t-md" style={{ height: barHeight, background: `${step.color}20`, border: `1px solid ${step.color}40`, borderBottom: `3px solid ${step.color}` }}>
                {step.rate != null && step.rate > 0 && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[11px] font-semibold opacity-90" style={{ color: step.color }}>
                    {(step.rate * 100).toFixed(0)}%
                  </div>
                )}
              </div>
              {/* Label */}
              <div className="font-mono text-[10px] text-revos-text-dim uppercase tracking-wide text-center">{step.label}</div>
              <div className="text-[10px] text-revos-border-light text-center">{step.sub}</div>
              {/* Arrow between steps */}
              {i < steps.length - 1 && (
                <div className="absolute" />
              )}
            </div>
          );
        })}
      </div>
      {/* Conversion arrow row */}
      <div className="flex gap-0.5 mt-3">
        {steps.slice(1).map((step, i) => (
          <div key={i} className="flex-1 flex items-center justify-center">
            {step.rate != null && (
              <div className="font-mono text-[10px] rounded px-2 py-[2px]" style={{ color: step.rate >= 0.3 ? COLORS.success : step.rate >= 0.1 ? COLORS.meeting : COLORS.danger, background: `${step.rate >= 0.3 ? COLORS.success : step.rate >= 0.1 ? COLORS.meeting : COLORS.danger}15` }}>
                {(step.rate * 100).toFixed(0)}% conv
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TabBtn({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "border rounded-lg px-[18px] py-2 text-[13px] font-sans cursor-pointer transition-all duration-200",
        active
          ? "bg-revos-cyan text-white border-revos-cyan font-semibold"
          : "bg-transparent text-revos-text-dim border-revos-border font-normal"
      )}
    >
      {children}
    </button>
  );
}

function PillSelect({ options, value, onChange, label }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {label && <span className="text-[11px] text-revos-text-dim font-mono uppercase tracking-wider">{label}</span>}
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "border rounded-md px-3 py-[5px] text-xs font-sans cursor-pointer transition-all duration-150",
            value === o.value
              ? "bg-revos-cyan/15 text-revos-cyan border-revos-cyan/30"
              : "bg-transparent text-revos-text-dim border-revos-border"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CountModeToggle({ value, onChange }) {
  return (
    <div className="inline-flex bg-revos-card border border-revos-border rounded-lg overflow-hidden">
      {[{ key: "total", label: "Total" }, { key: "unique", label: "Unique Accounts" }].map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={cn(
            "px-4 py-[7px] text-xs font-mono cursor-pointer transition-all duration-150 border-none",
            m.key === "total" && "border-r border-revos-border",
            value === m.key
              ? "bg-revos-cyan/20 text-revos-cyan font-semibold"
              : "bg-transparent text-revos-text-dim font-normal"
          )}
          style={m.key === "total" ? { borderRight: `1px solid ${COLORS.border}` } : undefined}
        >
          {m.label}
        </button>
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
    if (!csvCol) return schema.fields[fieldKey].required ? { color: COLORS.danger, label: "REQUIRED" } : { color: COLORS.textDim, label: "unmapped" };
    const lowerCol = csvCol.toLowerCase().trim();
    if (lowerCol === fieldKey) return { color: COLORS.success, label: "exact" };
    if (schema.fields[fieldKey].aliases.includes(lowerCol)) return { color: COLORS.accent, label: "alias" };
    return { color: COLORS.meeting, label: "manual" };
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-5">
      <div className="bg-revos-bg border border-revos-border rounded-2xl max-w-[800px] w-full max-h-[90vh] overflow-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-lg font-bold text-revos-text">Map Columns — {schema.label}</div>
            <div className="text-xs text-revos-text-dim mt-1">{csvHeaders.length} columns detected · {csvRows.length} rows · {mappedCount}/{totalFields} fields mapped</div>
          </div>
          <button onClick={onCancel} className="bg-transparent border-none text-revos-text-dim text-xl cursor-pointer p-1">✕</button>
        </div>

        {/* Mapping Table */}
        <table className="w-full border-collapse font-mono text-xs mb-5">
          <thead>
            <tr className="border-b border-revos-border">
              <th className="px-3 py-2 text-left text-revos-text-dim text-[10px] uppercase font-medium w-[30%]">Engine Field</th>
              <th className="px-3 py-2 text-left text-revos-text-dim text-[10px] uppercase font-medium w-[35%]">Your CSV Column</th>
              <th className="px-3 py-2 text-left text-revos-text-dim text-[10px] uppercase font-medium w-[15%]">Status</th>
              <th className="px-3 py-2 text-left text-revos-text-dim text-[10px] uppercase font-medium w-[20%]">Sample</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(schema.fields).map(([fieldKey, fieldDef]) => {
              const status = statusFor(fieldKey);
              const sampleVal = mapping[fieldKey] && sampleRows[0] ? sampleRows[0][mapping[fieldKey]] : "—";
              return (
                <tr key={fieldKey} className="border-b border-revos-border">
                  <td className="px-3 py-2.5">
                    <div className="text-revos-text font-medium">{fieldDef.label}</div>
                    <div className="text-[10px] text-revos-border-light">{fieldKey}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={mapping[fieldKey] || ""}
                      onChange={(e) => updateMapping(fieldKey, e.target.value)}
                      className="w-full bg-revos-card text-revos-text rounded-md px-2.5 py-1.5 text-xs font-mono cursor-pointer outline-none"
                      style={{ border: `1px solid ${mapping[fieldKey] ? COLORS.borderLight : COLORS.danger + "66"}` }}
                    >
                      <option value="">— select column —</option>
                      {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10px] font-mono rounded px-2 py-[2px]" style={{ color: status.color, background: `${status.color}15` }}>{status.label}</span>
                  </td>
                  <td className="px-3 py-2.5 text-revos-text-dim text-[11px] max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">{sampleVal}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Validation warnings */}
        {unmappedRequired.length > 0 && (
          <div className="rounded-lg px-4 py-2.5 mb-4 text-xs font-mono text-revos-red" style={{ background: `${COLORS.danger}10`, border: `1px solid ${COLORS.danger}33` }}>
            ⚠ Required fields missing: {unmappedRequired.map(([k]) => k).join(", ")}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="bg-transparent text-revos-text-dim border border-revos-border rounded-lg px-5 py-2.5 text-[13px] cursor-pointer font-sans">Cancel</button>
          <button
            onClick={() => onConfirm(mapping)}
            disabled={unmappedRequired.length > 0}
            className={cn(
              "text-white border-none rounded-lg px-6 py-2.5 text-[13px] font-semibold font-sans",
              unmappedRequired.length > 0
                ? "bg-revos-border-light cursor-not-allowed opacity-50"
                : "bg-revos-cyan cursor-pointer opacity-100"
            )}
          >
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
    if (count === 0) return COLORS.heatNone;
    if (count <= 2) return COLORS.heatLow;
    if (count <= 5) return COLORS.heatMed;
    if (count <= 10) return COLORS.heatHigh;
    return COLORS.heatMax;
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
    pipeline.forEach((p) => { if (p.close_date) set.add(`${p.customer_account}|${p.close_date.slice(0, 7)}`); });
    return set;
  }, [pipeline]);

  const [hoveredCell, setHoveredCell] = useState(null);

  return (
    <div className="bg-revos-card border border-revos-border rounded-xl p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-sm font-semibold text-revos-text mb-1">Engagement Coverage</div>
          <div className="text-[11px] text-revos-text-dim">Accounts × months · color = engagement intensity · ◈ = pipeline created</div>
        </div>
        <div className="flex gap-1 items-center text-[10px] font-mono text-revos-text-dim">
          <span>Less</span>
          {[COLORS.heatNone, COLORS.heatLow, COLORS.heatMed, COLORS.heatHigh, COLORS.heatMax].map((c, i) => (
            <div key={i} className="w-3 h-3 rounded-sm border border-revos-border" style={{ background: c }} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
        <table className="font-mono text-[11px] border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="sticky left-0 bg-revos-card z-[2] py-1 px-3 pr-3 text-left text-revos-text-dim text-[10px] font-medium min-w-[160px]">Account</th>
              {months.map((m) => (
                <th key={m} className="py-1 px-1.5 text-revos-text-dim text-[10px] font-medium text-center min-w-[56px]">{monthLabel(m)}</th>
              ))}
              <th className="py-1 px-2 text-revos-text-dim text-[10px] font-medium text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedAccounts.map((acct) => {
              const acctTotal = engagements.filter((e) => e.customer_account === acct.customer_account).length;
              return (
                <tr key={acct.customer_account}>
                  <td
                    onClick={() => onAccountClick(acct.customer_account)}
                    className="sticky left-0 bg-revos-card z-[1] py-1 pr-3 text-revos-text font-medium cursor-pointer text-[11px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[160px]"
                    title={acct.customer_account}>
                    {acct.customer_account}
                  </td>
                  {months.map((m) => {
                    const count = engagements.filter((e) => e.customer_account === acct.customer_account && e.date.startsWith(m)).length;
                    const hasPipe = pipeAcctMonths.has(`${acct.customer_account}|${m}`);
                    const isHovered = hoveredCell === `${acct.customer_account}|${m}`;
                    return (
                      <td key={m} className="p-0 text-center"
                        onMouseEnter={() => setHoveredCell(`${acct.customer_account}|${m}`)}
                        onMouseLeave={() => setHoveredCell(null)}>
                        <div
                          className="w-12 h-7 rounded-sm flex items-center justify-center relative cursor-default transition-[outline] duration-100"
                          style={{
                            background: heatColor(count),
                            outline: isHovered ? `2px solid ${COLORS.accent}` : "none",
                          }}
                        >
                          {count > 0 && <span className="text-[10px] font-semibold" style={{ color: count > 5 ? "#fff" : COLORS.textMuted }}>{count}</span>}
                          {hasPipe && <span className="absolute top-[1px] right-[2px] text-[8px]" style={{ color: COLORS.pipeline }}>◈</span>}
                        </div>
                        {isHovered && (
                          <div className="absolute z-10 bg-revos-card border border-revos-border-light rounded-md px-3 py-2 text-[10px] text-revos-text whitespace-nowrap shadow-[0_4px_16px_rgba(0,0,0,0.4)] mt-1 -translate-x-1/4">
                            <div className="font-semibold">{acct.customer_account}</div>
                            <div className="text-revos-text-dim">{monthLabel(m)}</div>
                            <div className="mt-1">
                              {ENG_TYPES.map((t) => {
                                const tc = engagements.filter((e) => e.customer_account === acct.customer_account && e.date.startsWith(m) && e.type === t.type).length;
                                return tc > 0 ? <div key={t.key} style={{ color: t.color }}>{t.label}: {tc}</div> : null;
                              })}
                              {count === 0 && <div className="text-revos-red">No engagement</div>}
                            </div>
                            {hasPipe && <div className="mt-0.5" style={{ color: COLORS.pipeline }}>◈ Pipeline created</div>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className={cn("py-1 px-2 text-center font-semibold", acctTotal > 0 ? "text-revos-text" : "text-revos-border-light")}>{acctTotal}</td>
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
          <div className="mt-3 flex gap-5 text-[11px] font-mono text-revos-text-dim">
            <span><span className={cn("font-semibold", gapPct > 30 ? "text-revos-red" : "text-revos-green")}>{gapPct}%</span> coverage gaps ({zeroCells} of {totalCells} account-months with zero engagement)</span>
            <span><span style={{ color: COLORS.pipeline }}>◈</span> = pipeline created in that month</span>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────
export default function EngagementDashboard({ accounts: externalAccounts = [], rawData = null }) {
  const [view, setView] = useState("rep");
  const [countMode, setCountMode] = useState("total");
  const [timeRange, setTimeRange] = useState("all");
  const [selectedRep, setSelectedRep] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [liveData, setLiveData] = useState({ accounts: null, engagements: null, pipeline: null, quotes: null, hierarchy: null });
  // Column mapper state
  const [mapperState, setMapperState] = useState(null); // { tableKey, csvHeaders, csvRows }
  const [resolveReport, setResolveReport] = useState(null); // { tableKey, stats }
  const [showDiag, setShowDiag] = useState(false);

  // ── Build live data from loaded accounts + rawData ──────────────
  const folderData = useMemo(() => {
    if (!externalAccounts || externalAccounts.length === 0) return null;

    // Accounts → { customer_account, mega_vertical, rep, total_brr }
    const accounts = externalAccounts.map(a => ({
      customer_account: a.name || a.customer_account || '',
      mega_vertical: a.vertical || a.mega_vertical || '',
      rep: a.sales_owner || a.rep || '',
      total_brr: a.tmr || a.total_brr || 0,
    })).filter(a => a.customer_account);

    // Pipeline → from active_deals + funnel_closed on each account
    const pipeline = [];
    for (const a of externalAccounts) {
      const acctName = a.name || '';
      const rep = a.sales_owner || a.rep || '';
      for (const d of (a.active_deals || [])) {
        pipeline.push({
          customer_account: acctName,
          opportunity_name: d.product || 'Unknown',
          stage: d.stage || '',
          amount: parseFloat(d.mrr) || 0,
          close_date: normalizeDate(d.close || ''),
          rep: d.rep || rep,
          created_date: normalizeDate(d.created || ''),
        });
      }
      for (const d of (a.funnel_closed || [])) {
        pipeline.push({
          customer_account: acctName,
          opportunity_name: d.product || 'Unknown',
          stage: d.stage || '',
          amount: parseFloat(d.mrr) || 0,
          close_date: normalizeDate(d.close || ''),
          rep: d.rep || rep,
          created_date: normalizeDate(d.created || ''),
        });
      }
    }

    // Quotes → from rawData.quotes if available
    let quotes = [];
    if (rawData && rawData.quotes && rawData.quotes.length > 0) {
      quotes = rawData.quotes.map(q => ({
        customer_account: q.customer_account || '',
        quote_date: normalizeDate(q.created_date || q.quote_date || ''),
        product: q.product_group || q.product || '',
        term_months: parseInt(q.term_months) || 0,
        rep: q.primary_rep || q.created_by || q.rep || '',
      })).filter(q => q.customer_account);
    }

    // Engagements → reconstruct from account engagement events
    const engagements = [];
    for (const a of externalAccounts) {
      const acctName = a.name || '';
      const rep = a.sales_owner || a.rep || '';
      if (a.engagement && a.engagement.events) {
        for (const ev of a.engagement.events) {
          const dateStr = normalizeDate(ev.d || '');
          if (!dateStr) continue;
          engagements.push({
            customer_account: acctName,
            date: dateStr,
            type: normalizeEngType(ev.t || ev.s || ''),
            rep: rep,
          });
        }
      }
    }

    // Hierarchy → from rawData.hierarchy if available
    let hierarchy = [];
    if (rawData && rawData.hierarchy && rawData.hierarchy.length > 0) {
      hierarchy = rawData.hierarchy.map(h => ({
        child_name: h.type === 'Parent' ? '' : (h.customer_account || ''),
        child_id: h.account_id || '',
        parent_name: h.type === 'Parent' ? (h.customer_account || '') : '',
      })).filter(h => h.child_name || h.parent_name);
    }

    return { accounts, engagements, pipeline, quotes, hierarchy };
  }, [externalAccounts, rawData]);

  // Data: prefer CSV overrides (liveData) → folder data → empty
  const data = useMemo(() => {
    const base = folderData || { accounts: [], engagements: [], pipeline: [], quotes: [] };
    return {
      accounts: liveData.accounts || base.accounts,
      engagements: liveData.engagements || base.engagements,
      pipeline: liveData.pipeline || base.pipeline,
      quotes: liveData.quotes || base.quotes,
    };
  }, [liveData, folderData]);

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
    const pipeDays = data.pipeline.flatMap((p) => [p.created_date, p.close_date]).filter((d) => d && d.length === 10);
    const quoteDays = data.quotes.map((q) => q.quote_date).filter((d) => d && d.length === 10);
    return [...new Set([...engDays, ...pipeDays, ...quoteDays])].sort();
  }, [data]);

  // Anchor time ranges to today — never let future close dates shift "This Month" or "QTD"
  const todayStr = new Date().toISOString().slice(0, 10);
  const latestDataDay = allDays.length ? allDays[allDays.length - 1] : todayStr;
  const latestDay = latestDataDay > todayStr ? latestDataDay : todayStr;
  // For time-range anchoring (QTD, This Month), always use today — not future pipeline dates
  const anchorMonth = todayStr.slice(0, 7);
  const [anchorYear] = anchorMonth.split("-");
  const anchorQuarterStart = (() => {
    const mo = parseInt(anchorMonth.split("-")[1]);
    const qStart = Math.floor((mo - 1) / 3) * 3 + 1;
    return `${anchorYear}-${String(qStart).padStart(2, "0")}`;
  })();

  // Filtered months (for heatmap)
  const months = useMemo(() => {
    if (timeRange === "month") return allMonths.filter((m) => m === anchorMonth);
    if (timeRange === "qtd") return allMonths.filter((m) => m >= anchorQuarterStart && m <= anchorMonth);
    if (timeRange === "ytd") return allMonths.filter((m) => m.startsWith(anchorYear) && m <= anchorMonth);
    // "all" — extend back to Jan 2025
    return allMonths.filter((m) => m >= "2025-01");
  }, [allMonths, timeRange, anchorMonth, anchorYear, anchorQuarterStart]);

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
    if (timeRange === "month") filtered = allDays.filter((d) => d.startsWith(anchorMonth));
    else if (timeRange === "qtd") filtered = allDays.filter((d) => d.slice(0, 7) >= anchorQuarterStart && d.slice(0, 7) <= anchorMonth);
    else if (timeRange === "ytd") filtered = allDays.filter((d) => d.startsWith(anchorYear) && d <= todayStr);
    else filtered = allDays.filter((d) => d >= "2025-01-01");
    return [...new Set(filtered.map(getWeekStart))].sort();
  }, [allDays, timeRange, anchorMonth, todayStr, anchorYear, anchorQuarterStart]);

  // Date-aware filter for raw data arrays
  const inRange = useCallback((dateStr) => {
    if (!dateStr) return false;
    if (timeRange === "month") return dateStr.startsWith(anchorMonth);
    if (timeRange === "qtd") { const m = dateStr.slice(0, 7); return m >= anchorQuarterStart && m <= anchorMonth; }
    if (timeRange === "ytd") return dateStr.startsWith(anchorYear) && dateStr <= todayStr;
    return dateStr >= "2025-01-01";
  }, [timeRange, anchorMonth, todayStr, anchorYear, anchorQuarterStart]);

  // ─── Pipeline helpers ──────────────────────────────────────
  // Pipeline MRR = closed won + active pipeline, filtered by close_date in range
  const isPipelineDeal = (p) => (p.amount || 0) > 0;
  const pipeInRange = useCallback((p) => inRange(p.close_date), [inRange]);

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
      if (!p.close_date || p.close_date.length < 10 || !isPipelineDeal(p) || !filterFn(p)) return;
      const w = getWeekStart(p.close_date);
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
      const accountsList = liveData.accounts || folderData?.accounts || [];
      const hierarchyList = liveData.hierarchy || [];
      const { resolved, stats } = resolveAccountIds(transformed, accountsList, hierarchyList);
      transformed = resolved;
      if (stats && (stats.hierarchyMatch > 0 || stats.directMatch > 0 || stats.fuzzyMatch > 0 || stats.unresolved > 0)) {
        setResolveReport({ tableKey, stats });
        setTimeout(() => setResolveReport(null), 8000);
      }
    }

    setLiveData((prev) => ({ ...prev, [tableKey]: transformed }));
    setMapperState(null);
  };

  const yLabel = countMode === "unique" ? "Unique Accounts" : "Engagements";
  const chartSubtitle = countMode === "unique" ? "Distinct accounts engaged per type each week · pipeline MRR overlay" : "Weekly engagement count by type · pipeline MRR overlay";

  // ─── Rep View ─────────────────────────────────────────────────
  function RepView() {
    const repData = buildWeeklyData((e) => e.rep === activeRep);
    const repAccounts = data.accounts.filter((a) => a.rep === activeRep);
    const repPipeline = data.pipeline.filter((p) => p.rep === activeRep && pipeInRange(p) && isPipelineDeal(p));
    const repQuotes = data.quotes.filter((q) => q.rep === activeRep && inRange(q.quote_date));
    const repEngs = data.engagements.filter((e) => e.rep === activeRep && inRange(e.date));
    const totalEng = repEngs.length;
    const totalPipe = repPipeline.reduce((s, p) => s + (p.amount || 0), 0);
    const uniqueAcctsEngaged = new Set(repEngs.map((e) => e.customer_account)).size;
    const closedMRR = data.pipeline.filter((p) => p.rep === activeRep && inRange(p.close_date) && (p.stage || '').toLowerCase().includes('closed won') && (p.amount || 0) > 0).reduce((s, p) => s + (p.amount || 0), 0);
    const mrrPerEngaged = uniqueAcctsEngaged ? Math.round(closedMRR / uniqueAcctsEngaged) : 0;

    const acctBreakdown = repAccounts.map((a) => {
      const engs = data.engagements.filter((e) => e.customer_account === a.customer_account && inRange(e.date));
      const pipe = data.pipeline.filter((p) => p.customer_account === a.customer_account && pipeInRange(p) && isPipelineDeal(p));
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
      <div className="flex flex-col gap-5">
        <PillSelect label="Rep:" options={reps.map((r) => ({ value: r, label: r }))} value={activeRep} onChange={setSelectedRep} />
        <div className="flex gap-3 flex-wrap">
          <Stat label="Total Engagements" value={fmtNum(totalEng)} color={COLORS.accent} icon="⚡" />
          <Stat label="Pipeline MRR (2026)" value={fmt(totalPipe)} sub={`${repPipeline.length} opportunities`} color={COLORS.pipeline} icon="◈" />
          <Stat label="Quotes Created" value={repQuotes.length} color={COLORS.quote} icon="☰" />
          <Stat label="Unique Accounts Engaged" value={uniqueAcctsEngaged} sub={`of ${repAccounts.length} assigned`} color={COLORS.meeting} icon="◉" />
          <Stat label="MRR / Engagement" value={fmt(mrrPerEngaged)} color={COLORS.success} icon="△" />
        </div>

        <SalesFunnel engagements={repEngs} pipeline={repPipeline} quotes={repQuotes} accounts={repAccounts} />

        <div className="bg-revos-card border border-revos-border rounded-xl p-6">
          <div className="text-sm font-semibold text-revos-text mb-1">Engagement Activity & Pipeline Created</div>
          <div className="text-[11px] text-revos-text-dim mb-5">{chartSubtitle}</div>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={repData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="week" tickFormatter={weekLabel} tick={{ fill: COLORS.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} stroke={COLORS.border} interval={Math.max(0, Math.floor(weeks.length / 12) - 1)} />
              <YAxis yAxisId="eng" tick={{ fill: COLORS.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} stroke={COLORS.border} label={{ value: yLabel, angle: -90, position: "insideLeft", fill: COLORS.textDim, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} />
              <YAxis yAxisId="quote" hide domain={[0, (d) => Math.max(d * 3, 5)]} />
              <YAxis yAxisId="pipe" orientation="right" tick={{ fill: COLORS.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} stroke={COLORS.border} tickFormatter={fmt} />
              <Tooltip content={<ChartTooltip />} />
              <Area yAxisId="eng" type="monotone" dataKey="emails" stackId="1" fill={COLORS.email} fillOpacity={0.3} stroke={COLORS.email} strokeWidth={1.5} name="Emails" />
              <Area yAxisId="eng" type="monotone" dataKey="calls" stackId="1" fill={COLORS.call} fillOpacity={0.3} stroke={COLORS.call} strokeWidth={1.5} name="Calls" />
              <Area yAxisId="eng" type="monotone" dataKey="meetings" stackId="1" fill={COLORS.meeting} fillOpacity={0.3} stroke={COLORS.meeting} strokeWidth={1.5} name="Meetings" />
              <Bar yAxisId="quote" dataKey="quotes" fill={COLORS.quote} fillOpacity={0.85} name="Quotes" radius={[2, 2, 0, 0]} barSize={12} />
              <Line yAxisId="pipe" type="monotone" dataKey="pipeline" stroke={COLORS.pipeline} strokeWidth={2.5} dot={{ fill: COLORS.pipeline, r: 4, strokeWidth: 0 }} name="Pipeline MRR" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Coverage Heatmap */}
        <CoverageHeatmap accounts={repAccounts} engagements={repEngs} pipeline={repPipeline} months={months} onAccountClick={(id) => { setSelectedAccount(id); setView("account"); }} />

        <div className="bg-revos-card border border-revos-border rounded-xl p-6">
          <div className="text-sm font-semibold text-revos-text mb-1">Account Engagement Breakdown</div>
          <div className="text-[11px] text-revos-text-dim mb-4">{countMode === "unique" ? "Columns show # of months with that engagement type" : "Columns show total count of each engagement type"}</div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b border-revos-border">
                  {["Account", "Mega Vertical", "Emails", "Calls", "Meetings", "Total", "Pipeline", "Opps"].map((h) => (
                    <th key={h} className={cn("px-3 py-2.5 text-revos-text-dim text-[10px] uppercase tracking-wider font-medium", h === "Account" || h === "Mega Vertical" ? "text-left" : "text-right")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {acctBreakdown.map((a, i) => (
                  <tr key={i} className="border-b border-revos-border cursor-pointer" onClick={() => { setSelectedAccount(data.accounts.find((ac) => ac.customer_account === a.name)?.customer_account); setView("account"); }}>
                    <td className="px-3 py-2.5 text-revos-text font-medium">{a.name}</td>
                    <td className="px-3 py-2.5 text-revos-text-dim text-[11px]">{a.mega_vertical}</td>
                    <td className="px-3 py-2.5 text-right text-revos-cyan">{a.emails}</td>
                    <td className="px-3 py-2.5 text-right text-revos-green">{a.calls}</td>
                    <td className="px-3 py-2.5 text-right text-revos-yellow">{a.meetings}</td>
                    <td className="px-3 py-2.5 text-right text-revos-text font-semibold">{a.total}</td>
                    <td className="px-3 py-2.5 text-right text-revos-blue">{fmt(a.pipeline)}</td>
                    <td className="px-3 py-2.5 text-right text-revos-text-dim">{a.opps}</td>
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
      const pipe = data.pipeline.filter((p) => p.rep === rep && pipeInRange(p) && isPipelineDeal(p));
      const accts = data.accounts.filter((a) => a.rep === rep);
      const rQuotes = data.quotes.filter((q) => q.rep === rep && inRange(q.quote_date));
      const uniqueEngaged = new Set(engs.map((e) => e.customer_account)).size;
      const closedMRR = data.pipeline.filter((p) => p.rep === rep && inRange(p.close_date) && (p.stage || '').toLowerCase().includes('closed won') && (p.amount || 0) > 0).reduce((s, p) => s + (p.amount || 0), 0);
      return { name: rep.split(" ")[0], fullName: rep, emails: engs.filter((e) => e.type === "Email").length, calls: engs.filter((e) => e.type === "Call").length, meetings: engs.filter((e) => e.type === "Meeting").length, total: engs.length, pipeline: pipe.reduce((s, p) => s + (p.amount || 0), 0), opps: pipe.length, quotes: rQuotes.length, accounts: accts.length, uniqueEngaged, coverage: accts.length ? Math.round((uniqueEngaged / accts.length) * 100) : 0, closedMRR, mrrPerEngaged: uniqueEngaged ? Math.round(closedMRR / uniqueEngaged) : 0 };
    });
    const teamWeekly = buildWeeklyData(() => true);
    const rangedEngs = data.engagements.filter((e) => inRange(e.date));
    const rangedPipe = data.pipeline.filter((p) => pipeInRange(p) && isPipelineDeal(p));
    const rangedQuotes = data.quotes.filter((q) => inRange(q.quote_date));
    const totalEng = rangedEngs.length;
    const totalPipe = rangedPipe.reduce((s, p) => s + (p.amount || 0), 0);
    const totalQuotes = rangedQuotes.length;
    const totalUniqueEngaged = new Set(rangedEngs.map((e) => e.customer_account)).size;
    const teamClosedMRR = data.pipeline.filter((p) => inRange(p.close_date) && (p.stage || '').toLowerCase().includes('closed won') && (p.amount || 0) > 0).reduce((s, p) => s + (p.amount || 0), 0);
    const teamMRRperEngaged = totalUniqueEngaged ? Math.round(teamClosedMRR / totalUniqueEngaged) : 0;

    return (
      <div className="flex flex-col gap-5">
        <div className="flex gap-3 flex-wrap">
          <Stat label="Team Engagements" value={fmtNum(totalEng)} color={COLORS.accent} icon="⚡" />
          <Stat label="Pipeline MRR (2026)" value={fmt(totalPipe)} sub={`${rangedPipe.length} opportunities`} color={COLORS.pipeline} icon="◈" />
          <Stat label="Quotes Created" value={totalQuotes} color={COLORS.quote} icon="☰" />
          <Stat label="Unique Accounts Engaged" value={totalUniqueEngaged} sub={`of ${data.accounts.length} total`} color={COLORS.meeting} icon="◉" />
          <Stat label="Closed MRR/Engaged" value={fmt(teamMRRperEngaged)} color={COLORS.success} icon="△" />
        </div>

        <SalesFunnel engagements={rangedEngs} pipeline={rangedPipe} quotes={rangedQuotes} accounts={data.accounts} />

        <div className="bg-revos-card border border-revos-border rounded-xl p-6">
          <div className="text-sm font-semibold text-revos-text mb-1">Team Engagement Trend</div>
          <div className="text-[11px] text-revos-text-dim mb-5">{chartSubtitle}</div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={teamWeekly} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="week" tickFormatter={weekLabel} tick={{ fill: COLORS.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} stroke={COLORS.border} interval={Math.max(0, Math.floor(weeks.length / 12) - 1)} />
              <YAxis yAxisId="eng" tick={{ fill: COLORS.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} stroke={COLORS.border} label={{ value: yLabel, angle: -90, position: "insideLeft", fill: COLORS.textDim, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} />
              <YAxis yAxisId="quote" hide domain={[0, (d) => Math.max(d * 3, 5)]} />
              <YAxis yAxisId="pipe" orientation="right" tick={{ fill: COLORS.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} stroke={COLORS.border} tickFormatter={fmt} />
              <Tooltip content={<ChartTooltip />} />
              <Area yAxisId="eng" type="monotone" dataKey="emails" stackId="1" fill={COLORS.email} fillOpacity={0.25} stroke={COLORS.email} strokeWidth={1.5} name="Emails" />
              <Area yAxisId="eng" type="monotone" dataKey="calls" stackId="1" fill={COLORS.call} fillOpacity={0.25} stroke={COLORS.call} strokeWidth={1.5} name="Calls" />
              <Area yAxisId="eng" type="monotone" dataKey="meetings" stackId="1" fill={COLORS.meeting} fillOpacity={0.25} stroke={COLORS.meeting} strokeWidth={1.5} name="Meetings" />
              <Bar yAxisId="quote" dataKey="quotes" fill={COLORS.quote} fillOpacity={0.85} name="Quotes" radius={[2, 2, 0, 0]} barSize={12} />
              <Line yAxisId="pipe" type="monotone" dataKey="pipeline" stroke={COLORS.pipeline} strokeWidth={2.5} dot={{ fill: COLORS.pipeline, r: 4, strokeWidth: 0 }} name="Pipeline MRR" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Team-wide heatmap */}
        <CoverageHeatmap accounts={data.accounts} engagements={rangedEngs} pipeline={rangedPipe} months={months} onAccountClick={(id) => { setSelectedAccount(id); setView("account"); }} />

        <div className="bg-revos-card border border-revos-border rounded-xl p-6">
          <div className="text-sm font-semibold text-revos-text mb-1">Rep Comparison</div>
          <div className="text-[11px] text-revos-text-dim mb-5">Engagement mix by rep</div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={repStats} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} horizontal={false} />
              <XAxis type="number" tick={{ fill: COLORS.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} stroke={COLORS.border} />
              <YAxis dataKey="name" type="category" tick={{ fill: COLORS.text, fontSize: 12, fontFamily: "'Inter', sans-serif" }} stroke={COLORS.border} width={70} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="emails" stackId="1" fill={COLORS.email} fillOpacity={0.8} name="Emails" radius={0} />
              <Bar dataKey="calls" stackId="1" fill={COLORS.call} fillOpacity={0.8} name="Calls" radius={0} />
              <Bar dataKey="meetings" stackId="1" fill={COLORS.meeting} fillOpacity={0.8} name="Meetings" radius={[0, 4, 4, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {repStats.map((r) => (
            <div key={r.fullName} onClick={() => { setSelectedRep(r.fullName); setView("rep"); }}
              className="bg-revos-card border border-revos-border rounded-[10px] p-5 cursor-pointer transition-all duration-200 hover:border-revos-cyan">
              <div className="text-[15px] font-semibold text-revos-text mb-3">{r.fullName}</div>
              <div className="flex gap-4 mb-3">
                <div><div className="text-[10px] text-revos-text-dim font-mono uppercase">Engagements</div><div className="text-xl font-bold text-revos-text font-mono">{r.total}</div></div>
                <div><div className="text-[10px] text-revos-text-dim font-mono uppercase">Pipeline MRR</div><div className="text-xl font-bold text-revos-blue font-mono">{fmt(r.pipeline)}</div></div>
                <div><div className="text-[10px] text-revos-text-dim font-mono uppercase">Coverage</div><div className={cn("text-xl font-bold font-mono", r.coverage >= 80 ? "text-revos-green" : r.coverage >= 50 ? "text-revos-yellow" : "text-revos-red")}>{r.coverage}%</div></div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {ENG_TYPES.map((t) => (
                  <span key={t.key} className="text-[11px] font-mono rounded px-2 py-[2px]" style={{ color: t.color, background: `${t.color}15` }}>{t.label.charAt(0)}: {r[t.key]}</span>
                ))}
              </div>
              <div className="mt-2.5 text-[11px] text-revos-text-dim">
                <span className="font-mono text-revos-green">{fmt(r.mrrPerEngaged)}</span> MRR/engaged · <span className="font-mono text-revos-purple">{r.quotes}</span> quotes · {r.uniqueEngaged}/{r.accounts} accounts · {r.opps} opps
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
    if (!acct) return <div className="text-revos-text-dim">Select an account</div>;
    const acctEngs = data.engagements.filter((e) => e.customer_account === activeAccount && inRange(e.date));
    const acctPipe = data.pipeline.filter((p) => p.customer_account === activeAccount && pipeInRange(p) && isPipelineDeal(p));
    const acctQuotes = data.quotes.filter((q) => q.customer_account === activeAccount && inRange(q.quote_date));
    const acctWeekly = buildWeeklyData((e) => e.customer_account === activeAccount);
    const timeline = [...acctEngs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
    const typeIcons = { email: "✉", call: "☏", meeting: "◎" };
    const typeColors = { email: COLORS.email, call: COLORS.call, meeting: COLORS.meeting };
    const stages = ["Discover", "Qualify", "Propose", "Negotiate", "Verbal Agreement"];
    const monthsEngaged = new Set(acctEngs.map((e) => e.date.slice(0, 7))).size;

    return (
      <div className="flex flex-col gap-5">
        <PillSelect label="Account:" options={data.accounts.map((a) => ({ value: a.customer_account, label: a.customer_account }))} value={activeAccount} onChange={setSelectedAccount} />

        <div className="bg-revos-card border border-revos-border rounded-xl p-6 flex justify-between items-start flex-wrap gap-5">
          <div>
            <div className="text-[22px] font-bold text-revos-text">{acct.customer_account}</div>
            <div className="text-[13px] text-revos-text-dim mt-1">{acct.mega_vertical} · Rep: <span className="text-revos-cyan">{acct.rep}</span></div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="text-right"><div className="text-[10px] text-revos-text-dim font-mono uppercase">Total BRR</div><div className="text-xl font-bold text-revos-text font-mono">{fmt(acct.total_brr || 0)}</div></div>
            <div className="w-px h-9 bg-revos-border" />
            <div className="text-right"><div className="text-[10px] text-revos-text-dim font-mono uppercase">Pipeline MRR</div><div className="text-xl font-bold text-revos-blue font-mono">{fmt(acctPipe.reduce((s, p) => s + (p.amount || 0), 0))}</div></div>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Stat label="Total Touchpoints" value={acctEngs.length} color={COLORS.accent} icon="⚡" />
          <Stat label="Open Opportunities" value={acctPipe.length} color={COLORS.pipeline} icon="◈" />
          <Stat label="Quotes Created" value={acctQuotes.length} color={COLORS.quote} icon="☰" />
          <Stat label="Months Engaged" value={`${monthsEngaged} of ${months.length}`} color={COLORS.meeting} icon="◉" />
          <Stat label="Engagement Mix" value={`${ENG_TYPES.map((t) => acctEngs.filter((e) => e.type === t.type).length).join(" / ")}`} sub="E / C / M" color={COLORS.call} icon="◧" />
        </div>

        <div className="bg-revos-card border border-revos-border rounded-xl p-6">
          <div className="text-sm font-semibold text-revos-text mb-1">Engagement Over Time</div>
          <div className="text-[11px] text-revos-text-dim mb-5">{chartSubtitle}</div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={acctWeekly} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="week" tickFormatter={weekLabel} tick={{ fill: COLORS.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} stroke={COLORS.border} interval={Math.max(0, Math.floor(weeks.length / 12) - 1)} />
              <YAxis yAxisId="eng" tick={{ fill: COLORS.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} stroke={COLORS.border} label={{ value: yLabel, angle: -90, position: "insideLeft", fill: COLORS.textDim, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} />
              <YAxis yAxisId="quote" hide domain={[0, (d) => Math.max(d * 3, 5)]} />
              <YAxis yAxisId="pipe" orientation="right" tick={{ fill: COLORS.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} stroke={COLORS.border} tickFormatter={fmt} />
              <Tooltip content={<ChartTooltip />} />
              <Bar yAxisId="eng" dataKey="emails" stackId="1" fill={COLORS.email} fillOpacity={0.7} name="Emails" />
              <Bar yAxisId="eng" dataKey="calls" stackId="1" fill={COLORS.call} fillOpacity={0.7} name="Calls" />
              <Bar yAxisId="eng" dataKey="meetings" stackId="1" fill={COLORS.meeting} fillOpacity={0.7} name="Meetings" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="quote" dataKey="quotes" fill={COLORS.quote} fillOpacity={0.85} name="Quotes" radius={[2, 2, 0, 0]} barSize={12} />
              <Line yAxisId="pipe" type="monotone" dataKey="pipeline" stroke={COLORS.pipeline} strokeWidth={2.5} dot={{ fill: COLORS.pipeline, r: 5, strokeWidth: 2, stroke: COLORS.card }} name="Pipeline MRR" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-revos-card border border-revos-border rounded-xl p-6">
            <div className="text-sm font-semibold text-revos-text mb-4">Pipeline Opportunities</div>
            {acctPipe.length === 0 ? <div className="text-revos-border-light text-[13px] py-5 text-center">No open opportunities</div> : acctPipe.map((p, i) => {
              const stageIdx = stages.indexOf(p.stage);
              return (
                <div key={i} className={cn("py-3", i < acctPipe.length - 1 && "border-b border-revos-border")}>
                  <div className="text-[13px] font-semibold text-revos-text mb-1.5">{p.opportunity_name}</div>
                  <div className="flex gap-1 mb-2">{stages.map((s, si) => <div key={s} className="flex-1 h-1 rounded-sm" style={{ background: si <= stageIdx ? COLORS.accent : COLORS.border, opacity: si <= stageIdx ? 1 : 0.3 }} />)}</div>
                  <div className="flex justify-between text-[11px] font-mono"><span className="text-revos-cyan">{p.stage}</span><span className="text-revos-blue">{fmt(p.amount || 0)}</span><span className="text-revos-text-dim">Close: {p.close_date}</span></div>
                </div>
              );
            })}
          </div>
          <div className="bg-revos-card border border-revos-border rounded-xl p-6">
            <div className="text-sm font-semibold text-revos-text mb-4">Recent Activity</div>
            <div className="max-h-80 overflow-y-auto">
              {timeline.map((e, i) => (
                <div key={i} className="flex gap-3 py-2 border-b border-revos-border">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0" style={{ background: `${typeColors[e.type]}15`, color: typeColors[e.type] }}>{typeIcons[e.type]}</div>
                  <div className="flex-1"><div className="text-xs text-revos-text font-medium capitalize">{e.type}</div><div className="text-[11px] text-revos-text-dim font-mono">{e.date}</div></div>
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
    <div className="bg-revos-bg min-h-screen text-revos-text font-sans px-7 py-6">
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
        <div className="bg-revos-card border border-revos-border-light rounded-[10px] px-5 py-3.5 mb-4 flex items-center gap-4 text-xs font-mono relative">
          <div className="text-sm">🔗</div>
          <div className="flex-1">
            <div className="font-semibold text-revos-text mb-1">Account Resolution — {SCHEMA[resolveReport.tableKey]?.label}</div>
            <div className="flex gap-4 flex-wrap text-[11px]">
              {resolveReport.stats.hierarchyMatch > 0 && <span className="text-revos-purple">✓ {resolveReport.stats.hierarchyMatch} via hierarchy</span>}
              {resolveReport.stats.directMatch > 0 && <span className="text-revos-green">✓ {resolveReport.stats.directMatch} direct match</span>}
              {resolveReport.stats.fuzzyMatch > 0 && <span className="text-revos-yellow">~ {resolveReport.stats.fuzzyMatch} fuzzy matched</span>}
              {resolveReport.stats.unresolved > 0 && <span className="text-revos-red">✗ {resolveReport.stats.unresolved} unresolved</span>}
            </div>
            {resolveReport.stats.unresolved > 0 && (
              <div className="text-[10px] text-revos-text-dim mt-1">Unresolved rows kept with original account value — import Customers and Hierarchy first for best results</div>
            )}
          </div>
          <button onClick={() => setResolveReport(null)} className="bg-transparent border-none text-revos-text-dim text-base cursor-pointer p-1">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
        <div>
          <div className="text-[11px] font-mono text-revos-cyan uppercase tracking-widest mb-1">RevOS</div>
          <h1 className="m-0 text-2xl font-bold text-revos-text leading-tight">Engagement Dashboard</h1>
          <p className="mt-1 mb-0 text-[13px] text-revos-text-dim">Activity coverage & pipeline overlay</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Time Range */}
          <div className="inline-flex bg-revos-card border border-revos-border rounded-lg overflow-hidden">
            {[{ key: "all", label: "All Time" }, { key: "ytd", label: "YTD" }, { key: "qtd", label: "QTD" }, { key: "month", label: "This Month" }].map((m, i, arr) => (
              <button
                key={m.key}
                onClick={() => setTimeRange(m.key)}
                className={cn(
                  "border-none px-3.5 py-[7px] text-xs font-mono cursor-pointer transition-all duration-150",
                  timeRange === m.key ? "bg-revos-cyan/20 text-revos-cyan font-semibold" : "bg-transparent text-revos-text-dim font-normal"
                )}
                style={i < arr.length - 1 ? { borderRight: `1px solid ${COLORS.border}` } : undefined}
              >
                {m.label}
              </button>
            ))}
          </div>
          <CountModeToggle value={countMode} onChange={setCountMode} />
        </div>
      </div>

      {/* CSV Upload Bar (always visible) */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <span className="text-[11px] font-mono text-revos-text-dim uppercase tracking-wider">Import:</span>
        {Object.entries(SCHEMA).map(([key, schema]) => {
          const isLoaded = liveData[key] !== null;
          const rowCount = liveData[key]?.length;
          return (
            <label
              key={key}
              className={cn(
                "text-[11px] font-mono px-3 py-1.5 rounded-md cursor-pointer transition-all duration-150 flex items-center gap-1.5",
                isLoaded
                  ? "text-revos-green border border-revos-green/25 bg-revos-green/[0.06]"
                  : "text-revos-text-dim border border-revos-border bg-transparent"
              )}
            >
              <span>{isLoaded ? "✓" : "↑"}</span>
              <span>{schema.label}</span>
              {isLoaded && <span className="text-revos-border-light text-[10px]">({rowCount})</span>}
              <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileSelect(key)} className="hidden" />
            </label>
          );
        })}
        {(liveData.accounts || liveData.engagements || liveData.pipeline || liveData.quotes || liveData.hierarchy) && (
          <button onClick={() => { setLiveData({ accounts: null, engagements: null, pipeline: null, quotes: null, hierarchy: null }); }} className="text-[10px] font-mono text-revos-red bg-transparent border border-revos-red/20 rounded-md px-2.5 py-1.5 cursor-pointer">Clear Overrides</button>
        )}
        <button
          onClick={() => setShowDiag((p) => !p)}
          className={cn(
            "text-[10px] font-mono rounded-md px-2.5 py-1.5 cursor-pointer border",
            showDiag
              ? "text-revos-cyan bg-revos-cyan/[0.08] border-revos-cyan/25"
              : "text-revos-border-light bg-transparent border-revos-border"
          )}
        >
          {showDiag ? "▼ Diagnostics" : "▶ Diagnostics"}
        </button>
      </div>

      {/* ─── Diagnostics Panel ──────────────────────────────────── */}
      {showDiag && (() => {
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
          <div className="bg-revos-card border border-revos-border rounded-xl p-5 mb-5">
            <div className="text-sm font-semibold text-revos-text mb-4">Data Diagnostics</div>

            {/* Active filters */}
            <div className="text-[11px] font-mono text-revos-text-dim leading-relaxed mb-4 px-3.5 py-2.5 bg-revos-bg rounded-lg border border-revos-border">
              <span className="text-revos-text font-medium">Mode:</span> live &nbsp;·&nbsp;
              <span className="text-revos-text font-medium">Time:</span> {timeRange} ({months.length} months: {months.map(monthLabel).join(", ") || "none"}) &nbsp;·&nbsp;
              <span className="text-revos-text font-medium">Count:</span> {countMode} &nbsp;·&nbsp;
              <span className="text-revos-text font-medium">Rep:</span> {activeRep || "—"} &nbsp;·&nbsp;
              <span className="text-revos-text font-medium">Account:</span> {activeAccount || "—"} &nbsp;·&nbsp;
              <span className="text-revos-text font-medium">Anchor month:</span> {anchorMonth}
            </div>

            {/* Per-table status */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 mb-4">
              {tables.map(({ key, label, src, fields }) => {
                const rows = src || [];
                const count = rows?.length || 0;
                const hasData = count > 0;
                return (
                  <div key={key} className="bg-revos-bg border border-revos-border rounded-lg p-3.5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-revos-text">{label}</span>
                      <span className="inline-block text-[10px] font-mono px-1.5 py-[1px] rounded mr-1" style={{ background: hasData ? `${COLORS.success}15` : `${COLORS.textDim}20`, color: hasData ? COLORS.success : COLORS.textDim }}>
                        {hasData ? `${count} rows` : "no data"}
                      </span>
                    </div>
                    {count > 0 ? (
                      <div>
                        <div className="text-[11px] font-mono text-revos-text-dim leading-relaxed">
                          <span className="text-revos-text font-medium">Fields present:</span>{" "}
                          {fields.map((f) => {
                            const hasIt = rows[0] && rows[0][f] !== undefined && rows[0][f] !== "";
                            return <span key={f} className="inline-block text-[10px] font-mono px-1.5 py-[1px] rounded mr-1" style={{ background: hasIt ? `${COLORS.success}15` : `${COLORS.danger}15`, color: hasIt ? COLORS.success : COLORS.danger }}>{f}</span>;
                          })}
                        </div>
                        <div className="text-[11px] font-mono text-revos-text-dim leading-relaxed mt-1.5">
                          <span className="text-revos-text font-medium">Sample (row 1):</span>
                          <div className="mt-1 text-[10px] text-revos-border-light break-all max-h-[60px] overflow-hidden">
                            {fields.map((f) => `${f}: "${rows[0]?.[f] ?? ""}"`).join(" · ")}
                          </div>
                        </div>
                        {count > 1 && (
                          <div className="text-[11px] font-mono text-revos-text-dim leading-relaxed mt-1">
                            <span className="text-revos-text font-medium">Sample (row 2):</span>
                            <div className="mt-1 text-[10px] text-revos-border-light break-all max-h-[60px] overflow-hidden">
                              {fields.map((f) => `${f}: "${rows[1]?.[f] ?? ""}"`).join(" · ")}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] font-mono text-revos-border-light leading-relaxed">No data</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cross-checks */}
            <div className="grid grid-cols-2 gap-3">
              {/* Unmatched accounts */}
              <div className="bg-revos-bg border border-revos-border rounded-lg p-3.5">
                <div className="text-xs font-semibold text-revos-text mb-2">Account Resolution Check</div>
                <div className="text-[11px] font-mono text-revos-text-dim leading-relaxed">
                  <span className="text-revos-text font-medium">Customers loaded:</span> <span className={custNames.size > 0 ? "text-revos-green" : "text-revos-red"}>{custNames.size} unique names</span>
                </div>
                <div className="text-[11px] font-mono text-revos-text-dim leading-relaxed">
                  <span className="text-revos-text font-medium">Hierarchy loaded:</span> <span className={(liveData.hierarchy?.length || 0) > 0 ? "text-revos-green" : "text-revos-yellow"}>{liveData.hierarchy?.length || 0} rows</span>
                  {liveData.hierarchy?.length > 0 && (() => {
                    const names = liveData.hierarchy.filter((h) => h.child_name).length;
                    const ids = liveData.hierarchy.filter((h) => h.child_id).length;
                    return <span className="text-[10px] text-revos-text-dim"> ({names} name lookups + {ids} ID lookups)</span>;
                  })()}
                </div>
                <div className="text-[11px] font-mono text-revos-text-dim leading-relaxed">
                  <span className="text-revos-text font-medium">Engagement accounts not in Customers:</span>{" "}
                  <span className={engUnmatched.length === 0 ? "text-revos-green" : "text-revos-red"}>{engUnmatched.length}</span>
                  {engUnmatched.length > 0 && engUnmatched.length <= 10 && (
                    <div className="mt-1 text-[10px] text-revos-red">{engUnmatched.join(", ")}</div>
                  )}
                  {engUnmatched.length > 10 && (
                    <div className="mt-1 text-[10px] text-revos-red">First 10: {engUnmatched.slice(0, 10).join(", ")}...</div>
                  )}
                </div>
                <div className="text-[11px] font-mono text-revos-text-dim leading-relaxed">
                  <span className="text-revos-text font-medium">Pipeline accounts not in Customers:</span>{" "}
                  <span className={pipeUnmatched.length === 0 ? "text-revos-green" : "text-revos-red"}>{pipeUnmatched.length}</span>
                  {pipeUnmatched.length > 0 && pipeUnmatched.length <= 10 && (
                    <div className="mt-1 text-[10px] text-revos-red">{pipeUnmatched.join(", ")}</div>
                  )}
                </div>
              </div>

              {/* Type & date checks */}
              <div className="bg-revos-bg border border-revos-border rounded-lg p-3.5">
                <div className="text-xs font-semibold text-revos-text mb-2">Engagement Type & Date Check</div>
                <div className="text-[11px] font-mono text-revos-text-dim leading-relaxed">
                  <span className="text-revos-text font-medium">Type distribution:</span>
                  {Object.entries(typeDist).map(([t, c]) => {
                    const isValid = ["Email", "Call", "Meeting"].includes(t);
                    return <span key={t} className="inline-block text-[10px] font-mono px-1.5 py-[1px] rounded mr-1" style={{ background: isValid ? `${COLORS.success}15` : `${COLORS.danger}15`, color: isValid ? COLORS.success : COLORS.danger }}>{t}: {c}</span>;
                  })}
                  {Object.keys(typeDist).length === 0 && <span className="text-revos-yellow">No engagements</span>}
                </div>
                <div className="text-[11px] font-mono text-revos-text-dim leading-relaxed mt-1.5">
                  <span className="text-revos-text font-medium">Date range in data:</span>{" "}
                  {allMonths.length > 0
                    ? <span className="text-revos-green">{monthLabel(allMonths[0])} → {monthLabel(allMonths[allMonths.length - 1])} ({allMonths.length} months)</span>
                    : <span className="text-revos-red">No valid dates found</span>
                  }
                </div>
                <div className="text-[11px] font-mono text-revos-text-dim leading-relaxed mt-1.5">
                  <span className="text-revos-text font-medium">Filtered months ({timeRange}):</span>{" "}
                  {months.length > 0
                    ? <span className="text-revos-green">{months.map(monthLabel).join(", ")}</span>
                    : <span className="text-revos-red">None — chart will be empty</span>
                  }
                </div>
                <div className="text-[11px] font-mono text-revos-text-dim leading-relaxed mt-1.5">
                  <span className="text-revos-text font-medium">Engagements in range:</span>{" "}
                  <span className="text-revos-text font-medium">{data.engagements.filter((e) => inRange(e.date)).length}</span> of {data.engagements.length} total
                </div>
                <div className="text-[11px] font-mono text-revos-text-dim leading-relaxed mt-1">
                  <span className="text-revos-text font-medium">Pipeline in range:</span>{" "}
                  <span className="text-revos-text font-medium">{data.pipeline.filter((p) => pipeInRange(p)).length}</span> of {data.pipeline.length} total
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* View Tabs */}
      <div className="flex gap-2 mb-6">
        <TabBtn active={view === "rep"} onClick={() => setView("rep")}>Rep View</TabBtn>
        <TabBtn active={view === "team"} onClick={() => setView("team")}>Team Roll-up</TabBtn>
        <TabBtn active={view === "account"} onClick={() => setView("account")}>Account Deep Dive</TabBtn>
      </div>

      {view === "rep" && RepView()}
      {view === "team" && TeamView()}
      {view === "account" && AccountView()}

      <div className="mt-8 pt-4 border-t border-revos-border flex justify-between text-[11px] text-revos-border-light font-mono">
        <span>RevOS Engagement Dashboard v1.3</span>
        <span>Live Data · {{ all: "All Time", ytd: `YTD ${anchorYear}`, qtd: `Q${Math.ceil(parseInt(anchorMonth.split("-")[1]) / 3)} ${anchorYear}`, month: monthLabel(anchorMonth) }[timeRange]} · {countMode === "unique" ? "Unique Accounts" : "Total"} · {months.length} months · {data.accounts.length} accounts</span>
      </div>
    </div>
  );
}
