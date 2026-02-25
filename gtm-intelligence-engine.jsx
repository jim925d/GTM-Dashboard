import { useState, useCallback, useRef, useEffect } from "react";
import { loadUploadTablesFromSupabase, saveUploadTablesToSupabase } from "./supabase.js";

/* ═══════════════════ DATA ═══════════════════ */
const PRODUCTS = [
  {id:"p1",name:"SD-WAN Managed",cat:"Network",mrr:1200,desc:"Software-defined WAN with managed routing and traffic optimization across multi-site environments",fit_signals:"multiple locations, bandwidth, MPLS, network modernization, branch consolidation",value_props:"Single pane of glass; reduce MPLS spend; SLA-backed performance",use_cases:"Multi-site enterprises replacing MPLS; retail with PCI needs"},
  {id:"p2",name:"DDoS Protection",cat:"Security",mrr:800,desc:"Volumetric and application-layer DDoS mitigation with 24/7 SOC monitoring",fit_signals:"security, uptime, compliance, SOC, volumetric attack",value_props:"24/7 SOC; inline mitigation; compliance reporting",use_cases:"Financial services, healthcare, any uptime-critical operations"},
  {id:"p3",name:"Unified Comms",cat:"UCaaS",mrr:2500,desc:"Cloud PBX, video conferencing, team messaging, and contact center platform",fit_signals:"UCaaS, contact center, remote work, video, PBX replacement",value_props:"One platform for voice, video, messaging; easy management",use_cases:"Distributed teams; contact center consolidation; legacy PBX replacement"},
  {id:"p4",name:"Dedicated Internet",cat:"Network",mrr:950,desc:"Symmetric, SLA-backed internet access with guaranteed bandwidth and uptime",fit_signals:"internet, bandwidth, SLA, symmetric, uptime",value_props:"SLA-backed; symmetric bandwidth; dedicated (not shared)",use_cases:"Primary or backup internet; bandwidth-heavy applications"},
  {id:"p5",name:"Cloud Connect",cat:"Cloud",mrr:600,desc:"Private low-latency connectivity to AWS, Azure, and GCP environments",fit_signals:"cloud, AWS, Azure, GCP, migration, hybrid",value_props:"Private link; low latency; no public internet",use_cases:"Cloud migration; hybrid; multi-cloud"},
  {id:"p6",name:"Managed Firewall",cat:"Security",mrr:700,desc:"Next-gen firewall with 24/7 SOC, threat intelligence, and compliance reporting",fit_signals:"firewall, security, SOC, compliance, HIPAA, PCI",value_props:"24/7 SOC; compliance support; threat intelligence",use_cases:"Healthcare, financial, retail; lean IT teams needing managed security"},
  {id:"p7",name:"SIP Trunking",cat:"Voice",mrr:350,desc:"Scalable SIP trunks with automatic failover and nationwide number porting",fit_signals:"SIP, voice, PBX, trunks, number porting",value_props:"Scalable; failover; nationwide porting",use_cases:"Existing PBX modernization; voice consolidation"},
  {id:"p8",name:"Wavelength",cat:"Network",mrr:3500,desc:"High-capacity point-to-point optical transport for data center interconnect",fit_signals:"data center, DCI, wavelength, high capacity, low latency",value_props:"High capacity; low latency; dedicated fiber",use_cases:"Data center interconnect; financial trading; media"},
];

const ACCOUNTS = [
  {id:"c1",name:"Meridian Health Systems",ind:"Healthcare",tier:"Growth",
    loc:[{a:"450 Medical Center Dr, Chicago IL",s:"on-net",billing:1800,targetSpend:2400},{a:"1200 Lake Shore Blvd, Chicago IL",s:"on-net",billing:1200,targetSpend:1900},{a:"890 Prairie Ave, Naperville IL",s:"near-net",billing:950,targetSpend:1400},{a:"2100 Wellness Way, Milwaukee WI",s:"off-net",billing:250,targetSpend:1100}],
    cur:["Dedicated Internet","SIP Trunking"],
    qt:[{name:"SD-WAN Managed",date:"2024-11-20",closeDate:"2025-02-28",mrr:3600,st:"pending"},{name:"Managed Firewall",date:"2024-11-20",closeDate:"",mrr:2100,st:"pending"}],
    prior:["MPLS Network (churned 2023)","Legacy PBX (replaced 2022)"],mrr:4200,cEnd:"2025-09-30",
    eng:[
      {d:"2025-02-15",t:"QBR",n:"Discussed network modernization across all 4 sites. CTO Dr. Chen very interested in SD-WAN to replace legacy routing. Wants a pilot at Naperville."},
      {d:"2025-02-01",t:"Support Ticket",n:"Outage at Naperville — upstream ISP issue. Customer frustrated with 4-hour resolution time. Wants SLA review."},
      {d:"2024-11-20",t:"Quote Sent",n:"SD-WAN + Managed Firewall bundle for 3 locations. $5,700/mo. CTO favorable but procurement hasn't engaged."},
      {d:"2024-10-05",t:"Email",n:"VP of IT Mark Williams asked about HIPAA compliance capabilities for managed security."},
      {d:"2024-08-12",t:"Event",n:"Dr. Chen and Mark Williams attended Healthcare IT Summit. Strong interest in security + compliance roadmap."},
    ],
    con:[{name:"Dr. Sarah Chen",title:"CTO",eng:"champion",last:"2025-02-15"},{name:"Mark Williams",title:"VP of IT",eng:"engaged",last:"2024-10-05"},{name:"Lisa Park",title:"Dir. Procurement",eng:"cold",last:null}]},
  {id:"c2",name:"Atlas Manufacturing",ind:"Manufacturing",tier:"Win-Back",
    loc:[{a:"7800 Industrial Pkwy, Detroit MI",s:"on-net",billing:950,targetSpend:2200},{a:"3200 Factory Rd, Toledo OH",s:"near-net",billing:0,targetSpend:1800},{a:"550 Commerce Dr, Indianapolis IN",s:"off-net",billing:0,targetSpend:1200}],
    cur:["Dedicated Internet"],qt:[],
    prior:["Wavelength Services (churned 2024 — budget cuts)"],mrr:950,cEnd:"2025-06-15",
    eng:[
      {d:"2025-01-28",t:"Email",n:"Sent Q1 planning outreach to Tom Bradley. No response after 3 weeks."},
      {d:"2024-12-10",t:"Call",n:"IT Dir. Tom Bradley actively evaluating SD-WAN — Masergy and Aryaka in mix. Timeline Q1."},
      {d:"2024-09-15",t:"Churn Event",n:"Wavelength cancelled. Budget cuts forced consolidation. 'Maybe revisit next fiscal year' (July)."},
    ],
    con:[{name:"Tom Bradley",title:"IT Director",eng:"cooling",last:"2024-12-10"},{name:"Jennifer Walsh",title:"CFO",eng:"cold",last:null}]},
  {id:"c3",name:"Pinnacle Financial",ind:"Financial Services",tier:"Strategic",
    loc:[{a:"200 LaSalle St, Chicago IL",s:"on-net",billing:4200,targetSpend:5800},{a:"55 Wall St, New York NY",s:"on-net",billing:5100,targetSpend:6200},{a:"100 Peachtree St, Atlanta GA",s:"near-net",billing:1800,targetSpend:3400},{a:"800 Wilshire Blvd, Los Angeles CA",s:"near-net",billing:1700,targetSpend:3100},{a:"1500 Market St, Philadelphia PA",s:"off-net",billing:0,targetSpend:2600}],
    cur:["Dedicated Internet","DDoS Protection","Cloud Connect","SIP Trunking"],
    qt:[{name:"Wavelength",date:"2025-01-22",closeDate:"2025-02-28",mrr:3500,st:"pending-board"},{name:"Unified Comms",date:"2024-10-15",closeDate:"",mrr:7500,st:"stalled"}],
    icbs:[{createdDate:"2025-02-01"}],
    prior:[],mrr:12800,cEnd:"2026-03-31",
    eng:[
      {d:"2025-02-10",t:"QBR",n:"Excellent meeting. Confirmed expansion to Atlanta and LA in Q2. Need connectivity proposals by March 1."},
      {d:"2025-01-22",t:"Quote Sent",n:"Wavelength Chicago-NY. $3,500/mo. Board meeting Feb 28 for approval."},
      {d:"2025-01-05",t:"Call",n:"CISO Diana Morales concerned about ransomware. Wants managed firewall + enhanced DDoS for all 5 locations."},
      {d:"2024-12-18",t:"Support Ticket",n:"Minor Cloud Connect latency to Azure East. Resolved same day. Customer appreciated fast response."},
      {d:"2024-11-30",t:"Event",n:"CEO Robert Hayes keynoted at our FinServ Roundtable. Very aligned with product roadmap."},
      {d:"2024-10-15",t:"Email",n:"Kevin Patel asked about UCaaS for all 5 offices. Quote sent but stalled during holidays."},
    ],
    con:[{name:"Robert Hayes",title:"CEO",eng:"champion",last:"2025-02-10"},{name:"Diana Morales",title:"CISO",eng:"champion",last:"2025-01-05"},{name:"Kevin Patel",title:"VP Ops",eng:"engaged",last:"2024-10-15"},{name:"Amy Nguyen",title:"Head of Procurement",eng:"engaged",last:"2025-02-10"}]},
  {id:"c4",name:"Bright Horizons Edu",ind:"Education",tier:"Win-Back",
    loc:[{a:"1000 University Ave, Madison WI",s:"on-net",billing:350,targetSpend:1200},{a:"450 Campus Dr, Ann Arbor MI",s:"near-net",billing:0,targetSpend:950}],
    cur:["SIP Trunking"],
    qt:[{name:"Unified Comms",date:"2024-05-15",mrr:2500,st:"stalled"}],
    prior:["Dedicated Internet (churned 2023 — lost to competitor on price)"],mrr:350,cEnd:"2025-04-30",
    eng:[
      {d:"2024-11-01",t:"Call",n:"IT Manager Greg Foster unhappy with current ISP — frequent outages. DIA win-back opportunity."},
      {d:"2024-07-20",t:"Churn Event",n:"Lost DIA to competitor ($150/mo difference). Service was fine, purely budget."},
      {d:"2024-05-15",t:"Quote Sent",n:"UCaaS for both campuses. $2,500/mo. Stalled — budget freeze until July."},
    ],
    con:[{name:"Greg Foster",title:"IT Manager",eng:"engaged",last:"2024-11-01"},{name:"Patricia Moore",title:"VP Admin",eng:"cold",last:null}]},
  {id:"c5",name:"Velocity Logistics",ind:"Transportation",tier:"Growth",
    loc:[{a:"500 Distribution Way, Memphis TN",s:"on-net",billing:2200,targetSpend:3200},{a:"1200 Freight Blvd, Louisville KY",s:"on-net",billing:1900,targetSpend:2800},{a:"800 Cargo Rd, Nashville TN",s:"near-net",billing:1100,targetSpend:2100},{a:"300 Shipping Ln, Dallas TX",s:"near-net",billing:1200,targetSpend:2400},{a:"950 Logistics Dr, Phoenix AZ",s:"off-net",billing:600,targetSpend:1800},{a:"2200 Transport Ave, Denver CO",s:"off-net",billing:400,targetSpend:1500}],
    cur:["Dedicated Internet","SD-WAN Managed","SIP Trunking"],
    qt:[{name:"Cloud Connect",date:"2025-02-05",closeDate:"2025-02-15",mrr:1800,st:"pending"}],
    prior:[],mrr:7400,cEnd:"2026-01-15",
    eng:[
      {d:"2025-02-18",t:"Call",n:"CTO wants to accelerate Azure migration. SD-WAN performing well. Needs Cloud Connect all 6 sites by Q3."},
      {d:"2025-02-05",t:"Quote Sent",n:"Cloud Connect Memphis + Louisville. $1,800/mo. CTO reviewing."},
      {d:"2025-01-10",t:"QBR",n:"22% YoY growth driving bandwidth needs. Nashville/Dallas need upgrades. Mentioned 7th site in Atlanta."},
      {d:"2024-12-01",t:"Email",n:"Asked about managed security. Warehouse break-in attempts triggered interest in network security audit."},
    ],
    con:[{name:"Rachel Torres",title:"CTO",eng:"champion",last:"2025-02-18"},{name:"David Kim",title:"Network Mgr",eng:"champion",last:"2025-01-10"},{name:"Susan Blake",title:"VP Finance",eng:"engaged",last:"2025-01-10"}]},
];

/* ═══════════════════ CSV UPLOAD & DATA BUILD ═══════════════════ */
function parseCSV(text) {
  const p = parseCSVWithMeta(text);
  return p ? p.rows : [];
}

function normalizeHeader(s) {
  return String(s).toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function parseCSVWithMeta(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;
  const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const headers = rawHeaders.map(h => normalizeHeader(h));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let cur = "", inQuotes = false;
    for (let j = 0; j < lines[i].length; j++) {
      const ch = lines[i][j];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (!inQuotes && ch === ",") { values.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    values.push(cur.trim());
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] != null ? values[idx].replace(/^"|"$/g, "").trim() : ""; });
    rows.push(obj);
  }
  return { rawHeaders, normalizedHeaders: headers, rows };
}

function detectTableType(normalizedHeaders) {
  const set = new Set(normalizedHeaders);
  const has = (arr) => arr.some(k => set.has(k));
  if (has(["product_name", "category"]) && (set.has("mrr") || set.has("description"))) return "productCatalog";
  if (has(["account_id", "service_description"]) && normalizedHeaders.length <= 5) return "churned";
  if (has(["account_id", "contact_name"]) && (set.has("title") || set.has("engagement_level"))) return "contacts";
  if (has(["account_id", "date"]) && (set.has("type") || set.has("notes"))) return "engagement";
  if (has(["account_id", "address"]) && (set.has("net_status") || set.has("netstatus") || set.has("s"))) return "locations";
  if (has(["account_id", "product_name"])) {
    if (set.has("quoted_mrr") || set.has("quotedmrr") || set.has("quote_date") || set.has("quotedate") || set.has("status")) return "quotes";
    return "currentProducts";
  }
  if (has(["account_id", "account_name"]) && (set.has("industry") || set.has("ind") || set.has("tier") || set.has("mrr") || set.has("contract_end") || set.has("contractend"))) return "accounts";
  return null;
}

function buildProductsFromRows(rows) {
  if (!rows || rows.length === 0) return [];
  return rows.map((r, i) => ({
    id: "p" + (i + 1),
    name: (r.product_name || r.productname || "").trim() || "Unknown",
    cat: (r.category || r.cat || "").trim() || "Other",
    mrr: Math.round(parseFloat(r.mrr) || 0),
    desc: (r.description || r.desc || "").trim() || "",
    fit_signals: (r.fit_signals || r.fitsignals || "").trim() || "",
    value_props: (r.value_props || r.valueprops || "").trim() || "",
    use_cases: (r.use_cases || r.usecases || "").trim() || ""
  })).filter(p => p.name !== "Unknown");
}

function buildAccountsFromTables(accountsRows, locationsRows, currentProductsRows, quotesRows, contactsRows, engagementRows, churnedRows) {
  const accountMap = new Map();
  (accountsRows || []).forEach((r, i) => {
    const id = (r.account_id || r.accountid || "").trim() || "acc_" + (i + 1);
    accountMap.set(id, {
      id,
      name: (r.account_name || r.accountname || "").trim() || "Unknown",
      ind: (r.industry || r.ind || "").trim() || "Other",
      tier: (r.tier || "").trim() || "Growth",
      mrr: Math.round(parseFloat(r.mrr) || 0),
      cEnd: (r.contract_end || r.contractend || "").trim() || "",
      loc: [], cur: [], qt: [], prior: [], eng: [], con: []
    });
  });
  (locationsRows || []).forEach(r => {
    const aid = (r.account_id || r.accountid || "").trim();
    if (!aid) return;
    if (!accountMap.has(aid)) accountMap.set(aid, { id: aid, name: "Unknown", ind: "Other", tier: "Growth", mrr: 0, cEnd: "", loc: [], cur: [], qt: [], prior: [], eng: [], con: [] });
    const billing = Math.round(parseFloat(r.billing_amount || r.billingamount || r.billing || 0) || 0);
    const targetSpend = Math.round(parseFloat(r.target_addressable_spend || r.targetaddressablespend || r.target_spend || 0) || 0);
    accountMap.get(aid).loc.push({
      a: (r.address || r.a || "").trim() || "—",
      s: (r.net_status || r.netstatus || r.s || "off-net").trim().toLowerCase(),
      billing: billing || undefined,
      targetSpend: targetSpend || undefined
    });
  });
  (currentProductsRows || []).forEach(r => {
    const aid = (r.account_id || r.accountid || "").trim();
    const name = (r.product_name || r.productname || "").trim();
    if (!aid || !name) return;
    if (!accountMap.has(aid)) accountMap.set(aid, { id: aid, name: "Unknown", ind: "Other", tier: "Growth", mrr: 0, cEnd: "", loc: [], cur: [], qt: [], prior: [], eng: [], con: [] });
    const acc = accountMap.get(aid);
    if (!acc.cur.includes(name)) acc.cur.push(name);
  });
  (quotesRows || []).forEach(r => {
    const aid = (r.account_id || r.accountid || "").trim();
    if (!aid) return;
    if (!accountMap.has(aid)) accountMap.set(aid, { id: aid, name: "Unknown", ind: "Other", tier: "Growth", mrr: 0, cEnd: "", loc: [], cur: [], qt: [], prior: [], eng: [], con: [] });
    accountMap.get(aid).qt.push({
      name: (r.product_name || r.productname || "").trim() || "—",
      mrr: Math.round(parseFloat(r.quoted_mrr || r.quotedmrr || r.mrr) || 0),
      date: (r.quote_date || r.quotedate || r.date || "").trim() || "",
      closeDate: (r.close_date || r.closedate || "").trim() || "",
      st: (r.status || r.st || "pending").trim().toLowerCase(),
      notes: (r.notes || "").trim() || ""
    });
  });
  (contactsRows || []).forEach(r => {
    const aid = (r.account_id || r.accountid || "").trim();
    if (!aid) return;
    if (!accountMap.has(aid)) accountMap.set(aid, { id: aid, name: "Unknown", ind: "Other", tier: "Growth", mrr: 0, cEnd: "", loc: [], cur: [], qt: [], prior: [], eng: [], con: [] });
    accountMap.get(aid).con.push({
      name: (r.contact_name || r.contactname || r.name || "").trim() || "—",
      title: (r.title || "").trim() || "",
      eng: (r.engagement_level || r.engagementlevel || r.eng || "cold").trim().toLowerCase(),
      last: (r.last_touch || r.lasttouch || r.last || "").trim() || null
    });
  });
  (engagementRows || []).forEach(r => {
    const aid = (r.account_id || r.accountid || "").trim();
    if (!aid) return;
    if (!accountMap.has(aid)) accountMap.set(aid, { id: aid, name: "Unknown", ind: "Other", tier: "Growth", mrr: 0, cEnd: "", loc: [], cur: [], qt: [], prior: [], eng: [], con: [] });
    accountMap.get(aid).eng.push({
      d: (r.date || r.d || "").trim() || "",
      t: (r.type || r.t || "Call").trim(),
      n: (r.notes || r.n || "").trim() || ""
    });
  });
  (churnedRows || []).forEach(r => {
    const aid = (r.account_id || r.accountid || "").trim();
    const desc = (r.service_description || r.servicedescription || "").trim();
    if (!aid || !desc) return;
    if (!accountMap.has(aid)) accountMap.set(aid, { id: aid, name: "Unknown", ind: "Other", tier: "Growth", mrr: 0, cEnd: "", loc: [], cur: [], qt: [], prior: [], eng: [], con: [] });
    accountMap.get(aid).prior.push(desc);
  });
  const accounts = Array.from(accountMap.values());
  accounts.forEach(a => {
    a.eng.sort((x, y) => (y.d || "").localeCompare(x.d || ""));
  });
  return accounts;
}

/* ═══════════════════ AI ANALYSIS ENGINE ═══════════════════ */
const NOW = new Date("2025-02-23");
const daysAgo = d => Math.floor((NOW - new Date(d))/864e5);
const daysUntil = d => Math.floor((new Date(d) - NOW)/864e5);
const currentMonthKey = () => `${NOW.getFullYear()}-${String(NOW.getMonth()+1).padStart(2,"0")}`;
const isCloseDateInCurrentMonth = (closeDate) => !closeDate ? false : closeDate.startsWith(currentMonthKey());

/** Urgent triggers: returns list of concrete action items for the briefing. */
function getActionItems(accounts) {
  const items = [];
  accounts.forEach(c => {
    const ds = c.eng?.[0] ? daysAgo(c.eng[0].d) : 999;
    const hasOpenOpp = (c.qt?.length || 0) > 0;
    const hasStalledQuote = c.qt?.some(q => q.st === "stalled");
    const renewalDays = c.cEnd ? daysUntil(c.cEnd) : null;
    const renewalIn90 = renewalDays != null && renewalDays > 60 && renewalDays <= 90;
    const renewalIn60 = renewalDays != null && renewalDays > 0 && renewalDays <= 60;
    const hasStalledICB = (c.icbs || []).some(icb => {
      const created = icb.createdDate || icb.created_date || "";
      return created && daysAgo(created) >= 14;
    });
    if (ds >= 30) items.push({ accountId: c.id, accountName: c.name, reason: "No contact 30+ days", reasonKey: "gap_30" });
    if (ds >= 14 && hasOpenOpp) items.push({ accountId: c.id, accountName: c.name, reason: "No contact 14+ days (open opp)", reasonKey: "gap_14_opp" });
    if (hasStalledQuote) items.push({ accountId: c.id, accountName: c.name, reason: "Stalled quote", reasonKey: "stalled_quote" });
    if (hasStalledICB) items.push({ accountId: c.id, accountName: c.name, reason: "Stalled ICB (14+ days old)", reasonKey: "stalled_icb" });
    if (renewalIn90) items.push({ accountId: c.id, accountName: c.name, reason: "Renewal in 90 days", reasonKey: "renewal_90" });
    if (renewalIn60) items.push({ accountId: c.id, accountName: c.name, reason: "Renewal in 60 days", reasonKey: "renewal_60" });
  });
  return { count: items.length, items };
}

// Quick deterministic pre-score for initial render (before AI runs)
function quickScore(c) {
  let s=0;
  const ds = c.eng[0] ? daysAgo(c.eng[0].d) : 999;
  if(ds<=14) s+=20; else if(ds<=30) s+=10; else if(ds<=60) s+=5;
  s += c.qt.length * 15;
  s += c.loc.filter(l=>l.s==="on-net").length * 8;
  s += c.loc.filter(l=>l.s==="near-net").length * 5;
  s += c.con.filter(x=>x.eng==="champion").length * 10;
  if(c.cEnd){const de=daysAgo(c.cEnd)*-1;if(de<=90&&de>0) s+=8;}
  return {score:Math.min(100,Math.max(0,s)),ds,pending:true};
}

// Full AI analysis prompt — this is the brain
function buildAnalysisPrompt(c, products) {
  const ds = c.eng[0] ? daysAgo(c.eng[0].d) : 999;
  const prodCatalog = (products || []).filter(p=>!c.cur.includes(p.name)&&!c.qt.some(q=>q.name===p.name))
    .map(p=>{
      let block = `Product: ${p.name}. MRR: $${p.mrr}/mo. Category: ${p.cat}.\nDescription: ${p.desc}`;
      if (p.fit_signals) block += `\nFit signals (when to recommend): ${p.fit_signals}`;
      if (p.value_props) block += `\nValue props: ${p.value_props}`;
      if (p.use_cases) block += `\nUse cases: ${p.use_cases}`;
      return block;
    }).join("\n\n");

  return `You are an elite B2B sales intelligence analyst. Analyze this account with surgical precision. Read between the lines of engagement notes — detect sentiment, urgency, competitive threats, buying signals, organizational dynamics, and timing.

TODAY'S DATE: 2025-02-23
DAYS SINCE LAST ENGAGEMENT: ${ds}

═══ ACCOUNT DATA ═══
Company: ${c.name}
Industry: ${c.ind} | Tier: ${c.tier} | Current MRR: $${c.mrr}/mo
Contract End: ${c.cEnd}
Locations (${c.loc.length}): ${c.loc.map(l=>`${l.a} [${l.s}]`).join("; ")}

Current Products: ${c.cur.join(", ")||"None"}
Open Quotes: ${c.qt.map(q=>`${q.name} — $${q.mrr}/mo — status: ${q.st} — quoted: ${q.date}`).join("; ")||"None"}
Prior/Churned Services: ${c.prior.join("; ")||"None"}

Contacts:
${c.con.map(x=>`• ${x.name}, ${x.title} — engagement: ${x.eng} — last touch: ${x.last||"never"}`).join("\n")}

Engagement History (most recent first):
${c.eng.map(e=>`[${e.d}] ${e.t}: ${e.n}`).join("\n")}

═══ AVAILABLE PRODUCTS (not yet owned/quoted) ═══
${prodCatalog||"All products already owned or quoted."}

Use each product's fit signals, value props, and use cases to justify recommendations and to phrase outreach in the customer's language (reference their situation and use the product's value props where relevant).

═══ YOUR ANALYSIS ═══
Analyze everything above holistically. Consider:
- What buying signals exist in the engagement notes (explicit and implicit)?
- What is the customer's emotional state / satisfaction level?
- Are there competitive threats? If so, how urgent?
- What organizational dynamics are at play (champion vs. blocker, procurement involvement, budget authority)?
- What timing factors matter (fiscal years, contract dates, budget cycles, seasonal patterns)?
- Which products genuinely fit based on their situation — not keyword matching, but real business need?
- What risks could derail opportunities?
- What is the single most important thing to do THIS WEEK?
- For additionalOpportunities: identify any extra revenue potential as new-service (new product they don't have), upsell (more of same), upgrade (tier/plan upgrade), or cross-sell (related product to current usage). Omit categories with no clear opportunity.

Respond in this exact JSON (no markdown, no backticks, no extra text):
{
  "score": 0-100 integer,
  "scoreReasoning": "2 sentences explaining the score — what's driving it up or down",
  "accountSummary": "3 sentence executive summary of this account's situation right now. What would you brief a VP of Sales on?",
  "sentiment": "positive|neutral|at-risk|critical",
  "sentimentDetail": "1 sentence — how does this customer feel about us right now?",
  "immediateOpportunity": {
    "type": "close-deal|advance-quote|cross-sell|win-back|renewal|save-account|re-engage|expand-footprint",
    "description": "1-2 sentences — the #1 opportunity right now",
    "estimatedMRR": number,
    "confidence": "high|medium|low",
    "timeframe": "this-week|this-month|this-quarter|next-quarter"
  },
  "productRecommendations": [
    {"product": "product name", "mrr": number, "fitReason": "1-2 sentences — WHY this product, based on their specific situation, not generic fit", "priority": "primary|secondary|future"}
  ],
  "additionalOpportunities": [
    {"type": "new-service|upsell|upgrade|cross-sell", "description": "1 sentence — what additional opportunity exists", "estimatedMRR": number}
  ],
  "competitiveIntel": "What competitors are in play? How do we defend/win? Say 'None detected' if no signals.",
  "risks": ["specific risk 1", "specific risk 2"],
  "contactStrategy": {
    "primaryTarget": "Contact name",
    "approach": "1-2 sentences — how to approach this specific person given the relationship dynamics",
    "secondaryTarget": "Contact name or null",
    "multiThreadNote": "Do we need to engage additional stakeholders? Who and why?"
  },
  "engagementPlan": {
    "thisWeek": "THE specific action for this week — be precise: who, what, how",
    "channel": "email|call|meeting|linkedin",
    "talkingPoints": ["specific point referencing their data", "point 2", "point 3"],
    "avoid": "What NOT to do or say with this account right now"
  },
  "outreach": {
    "emailSubject": "compelling subject line personalized to their situation",
    "emailBody": "Full email, 4-6 sentences. Reference SPECIFIC details from their engagement history. Sound human, not templated. Sign as [Your Name].",
    "callOpener": "Exact words for the first 15 seconds of a phone call to this person — natural and specific to the relationship"
  },
  "ninetyDayTarget": "$X,XXX/mo — what's achievable and how"
}`;
}

async function runAIAnalysis(account, products) {
  const prompt = buildAnalysisPrompt(account, products);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,messages:[{role:"user",content:prompt}]})
    });
    const d = await r.json();
    const tx = (d.content||[]).map(i=>i.text||"").join("");
    return JSON.parse(tx.replace(/```json|```/g,"").trim());
  } catch(e) { console.error("AI analysis failed:",e); return null; }
}

// Batch AI analysis for all accounts
async function runBatchAnalysis(accounts, products, onUpdate) {
  const results = {};
  const queue = [...accounts];
  
  const runNext = async () => {
    if (queue.length === 0) return;
    const acct = queue.shift();
    const result = await runAIAnalysis(acct, products);
    if (result) {
      results[acct.id] = result;
      onUpdate(acct.id, result);
    }
    running.delete(acct.id);
    await runNext();
  };
  
  await Promise.all([runNext(), runNext()]);
  return results;
}

/* ═══════════════════ STYLES ═══════════════════ */
const CSS = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
:root{--b0:#090b10;--b1:#10131a;--b2:#161a24;--b3:#1c2030;--b4:#232840;--bd:#252a3a;--bd2:#2f364a;--t1:#e8eaf0;--t2:#8b92a8;--t3:#5a6178;--ac:#DE7231;--acd:rgba(222,114,49,.12);--gn:#34d399;--gnd:rgba(52,211,153,.1);--yl:#EBC677;--yld:rgba(235,198,119,.1);--rd:#D7372F;--rdd:rgba(215,55,47,.1);--og:#fb923c;--ogd:rgba(251,146,60,.1);--pr:#a78bfa;--prd:rgba(167,139,250,.1);--cy:#22d3ee;--cyd:rgba(34,211,238,.1)}
body,html,#root{font-family:'DM Sans',sans-serif;background:var(--b0);color:var(--t1);height:100%;overflow:hidden}
.app{display:flex;height:100vh}
.sb{width:268px;min-width:268px;background:var(--b1);border-right:1px solid var(--bd);display:flex;flex-direction:column}
.sb-h{padding:18px 16px 12px;border-bottom:1px solid var(--bd)}
.sb-lg{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:600}
.sb-ic{width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#DE7231,#D7372F);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff}
.sb-si{margin-top:10px;position:relative}
.sb-si input{width:100%;padding:7px 10px 7px 30px;background:var(--b2);border:1px solid var(--bd);border-radius:7px;color:var(--t1);font-size:12px;font-family:inherit;outline:none}
.sb-si input:focus{border-color:var(--ac)}
.sb-si span{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--t3);font-size:12px;pointer-events:none}
.sb-lb{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1.1px;color:var(--t3);padding:12px 16px 5px}
.sb-n{flex:1;overflow-y:auto;padding:0 8px}.sb-n::-webkit-scrollbar{width:3px}.sb-n::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}
.ni{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;cursor:pointer;font-size:12px;color:var(--t2);border:1px solid transparent;margin-bottom:1px;transition:all .12s}
.ni:hover{background:var(--b2);color:var(--t1)}.ni.on{background:var(--acd);color:var(--ac);border-color:rgba(222,114,49,.15)}
.ni .bd{margin-left:auto;font-size:9.5px;font-weight:600;padding:1px 5px;border-radius:8px;background:var(--rdd);color:var(--rd)}
.ai-i{display:flex;align-items:center;gap:8px;padding:6px 9px;border-radius:7px;cursor:pointer;font-size:12px;color:var(--t2);margin-bottom:1px;transition:all .12s}
.ai-i:hover{background:var(--b2);color:var(--t1)}.ai-i.on{background:var(--acd);color:var(--ac)}
.asc{width:24px;height:24px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;font-family:'JetBrains Mono',monospace;flex-shrink:0}
.mn{flex:1;overflow-y:auto}.mn::-webkit-scrollbar{width:5px}.mn::-webkit-scrollbar-thumb{background:var(--bd);border-radius:5px}
.mh{padding:16px 26px 12px;border-bottom:1px solid var(--bd);background:var(--b1);position:sticky;top:0;z-index:10}
.mh h1{font-size:17px;font-weight:600;letter-spacing:-.3px}.mh p{font-size:12px;color:var(--t2);margin-top:1px}
.ct{padding:20px 26px 44px;max-width:1140px}
.sr{display:flex;gap:9px;margin-bottom:16px;flex-wrap:wrap}
.st{flex:1;min-width:105px;background:var(--b2);border:1px solid var(--bd);border-radius:9px;padding:12px 13px}
.sl{font-size:9.5px;color:var(--t3);text-transform:uppercase;letter-spacing:.7px;font-weight:500}
.sv{font-size:19px;font-weight:700;font-family:'JetBrains Mono',monospace;margin-top:2px;letter-spacing:-.4px}
.ss{font-size:10px;color:var(--t2);margin-top:1px}
.cg{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}
.cd{background:var(--b2);border:1px solid var(--bd);border-radius:10px;padding:16px}
.cd.fw{grid-column:1/-1}
.ch{display:flex;align-items:center;gap:6px;margin-bottom:10px}
.ctit{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.7px;color:var(--t2)}
.act{display:flex;align-items:flex-start;gap:9px;padding:10px 12px;border-radius:8px;background:var(--b1);border:1px solid var(--bd);margin-bottom:5px;cursor:pointer;transition:all .15s}
.act:hover{border-color:var(--ac);transform:translateX(2px)}
.tg{display:inline-flex;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap}
.tg.on-net,.tg.positive,.tg.strong,.tg.high{background:var(--gnd);color:var(--gn)}
.tg.near-net,.tg.warning,.tg.moderate,.tg.medium{background:var(--yld);color:var(--yl)}
.tg.off-net,.tg.critical,.tg.at-risk,.tg.low{background:var(--rdd);color:var(--rd)}
.tg.opportunity{background:var(--prd);color:var(--pr)}
.tg.accent,.tg.neutral{background:var(--acd);color:var(--ac)}
.tg.info{background:var(--cyd);color:var(--cy)}
.btn{padding:6px 13px;border-radius:7px;border:none;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .12s}
.bp{background:var(--ac);color:#fff}.bp:hover{background:#c45f1f}.bp:disabled{opacity:.5;cursor:default}
.bg{background:transparent;color:var(--t2);border:1px solid var(--bd)}.bg:hover{background:var(--b2);color:var(--t1)}
.bsuccess{background:var(--gn);color:#000}.bsuccess:hover{background:#2db885}
.tabs{display:flex;gap:1px;margin-bottom:16px;border-bottom:1px solid var(--bd)}
.tab{padding:6px 13px;border:none;background:transparent;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;text-transform:capitalize;border-bottom:2px solid transparent;transition:all .12s}
.tab.on{color:var(--ac);border-bottom-color:var(--ac)}.tab:not(.on){color:var(--t3)}.tab:hover{color:var(--t1)}
.spin{width:14px;height:14px;border:2px solid var(--bd);border-top-color:var(--ac);border-radius:50%;animation:sp .7s linear infinite;display:inline-block}
@keyframes sp{to{transform:rotate(360deg)}}@keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
.ebox{background:var(--b2);border:1px solid var(--bd);border-radius:8px;padding:14px;margin-top:6px}
.ebox-s{font-size:11px;font-weight:600;margin-bottom:6px;color:var(--t1)}
.ebox-b{font-size:11.5px;color:var(--t2);line-height:1.55;white-space:pre-wrap}
.ap{background:linear-gradient(135deg,rgba(222,114,49,.05),rgba(235,198,119,.05));border:1px solid rgba(222,114,49,.18);border-radius:10px;padding:16px;margin-bottom:16px}
.ap h3{font-size:11px;font-weight:600;color:var(--ac);display:flex;align-items:center;gap:6px;margin-bottom:9px}
.skeleton{background:linear-gradient(90deg,var(--b3) 25%,var(--b4) 50%,var(--b3) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:6px;height:14px;margin-bottom:6px}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.eng-card{background:var(--b2);border:1px solid var(--bd);border-radius:10px;margin-bottom:10px;overflow:hidden;transition:border .2s}
.eng-card:hover{border-color:var(--bd2)}
.eng-card.ai-enriched{border-color:rgba(222,114,49,.25)}
.eng-top{padding:14px 16px;cursor:pointer;display:flex;align-items:center;gap:12px}
.eng-exp{padding:0 16px 16px;border-top:1px solid var(--bd);padding-top:14px}
.sentiment-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sentiment-dot.positive{background:var(--gn)}.sentiment-dot.neutral{background:var(--ac)}.sentiment-dot.at-risk{background:var(--yl)}.sentiment-dot.critical{background:var(--rd)}
.confidence-bar{height:3px;border-radius:2px;background:var(--b4);overflow:hidden;width:60px}
.confidence-fill{height:100%;border-radius:2px;transition:width .3s}
.confidence-fill.high{background:var(--gn);width:100%}.confidence-fill.medium{background:var(--yl);width:66%}.confidence-fill.low{background:var(--rd);width:33%}
.opp-type{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 7px;border-radius:4px}
.opp-type.close-deal,.opp-type.advance-quote{background:var(--gnd);color:var(--gn)}
.opp-type.cross-sell,.opp-type.expand-footprint{background:var(--prd);color:var(--pr)}
.opp-type.win-back,.opp-type.re-engage{background:var(--ogd);color:var(--og)}
.opp-type.renewal,.opp-type.save-account{background:var(--yld);color:var(--yl)}
.ai-badge{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;padding:2px 6px;border-radius:3px;background:linear-gradient(135deg,rgba(222,114,49,.15),rgba(235,198,119,.15));color:var(--ac);border:1px solid rgba(222,114,49,.2)}
.tl{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd)}.tl:last-child{border-bottom:none}
.td{width:58px;flex-shrink:0;font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--t3);padding-top:2px}
.tt{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;padding:2px 6px;border-radius:3px;display:inline-block;margin-bottom:2px}
.tt.QBR{background:var(--gnd);color:var(--gn)}.tt.Call{background:var(--acd);color:var(--ac)}.tt.Email{background:var(--prd);color:var(--pr)}.tt.Quote{background:var(--yld);color:var(--yl)}.tt.Support{background:var(--ogd);color:var(--og)}.tt.Event{background:var(--acd);color:var(--ac)}.tt.Churn{background:var(--rdd);color:var(--rd)}
.cr{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd)}.cr:last-child{border-bottom:none}
.cav{width:32px;height:32px;border-radius:50%;background:var(--b4);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--ac);flex-shrink:0}
.ce{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;padding:2px 6px;border-radius:3px}
.ce.champion{background:var(--gnd);color:var(--gn)}.ce.engaged{background:var(--acd);color:var(--ac)}.ce.cooling{background:var(--yld);color:var(--yl)}.ce.cold{background:var(--rdd);color:var(--rd)}
.pf{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:7px;background:var(--b1);margin-bottom:5px;border:1px solid var(--bd)}
.pfm{font-size:12px;font-weight:600;font-family:'JetBrains Mono',monospace;color:var(--gn);margin-left:auto;white-space:nowrap}
`;

/* ═══════════════ HELPERS ═══════════════ */
function scC(s){return s>=70?{b:"var(--gnd)",c:"var(--gn)"}:s>=45?{b:"var(--yld)",c:"var(--yl)"}:{b:"var(--rdd)",c:"var(--rd)"}}
function tlT(t){return t.includes("QBR")?"QBR":t.includes("Call")?"Call":t.includes("Email")?"Email":t.includes("Quote")?"Quote":t.includes("Support")?"Support":t.includes("Event")?"Event":t.includes("Churn")?"Churn":"Call"}
const oppLabels={"close-deal":"Close Deal","advance-quote":"Advance Quote","cross-sell":"Cross-Sell","win-back":"Win-Back","renewal":"Renewal","save-account":"Save Account","re-engage":"Re-Engage","expand-footprint":"Expand"};

function Skeleton({w,h}){return <div className="skeleton" style={{width:w||"100%",height:h||14}}/>}

function copyText(txt){navigator.clipboard?.writeText(txt)}

/* ═══════════════ ENGAGEMENT HUB (AI-Powered) ═══════════════ */
function EngagementHub({accounts,aiData,onSelect,onAnalyze,analyzing}) {
  const [expanded,setExpanded] = useState(null);
  const [filter,setFilter] = useState("all");
  const [copied,setCopied] = useState(null);

  // Build engagement list with AI data merged
  const items = accounts.map(c=>{
    const ai = aiData[c.id];
    const ds = c.eng[0]?daysAgo(c.eng[0].d):999;
    const qs = quickScore(c);
    return {
      ...c, ds, 
      score: ai?.score || qs.score,
      aiReady: !!ai, ai,
      oppType: ai?.immediateOpportunity?.type || (c.qt.some(q=>q.st==="stalled")?"advance-quote":ds>30?"re-engage":"check-in"),
      oppMRR: ai?.immediateOpportunity?.estimatedMRR || c.qt.reduce((s,q)=>s+q.mrr,0),
      sentiment: ai?.sentiment || "neutral",
    };
  }).sort((a,b)=>b.score-a.score);

  const gap30 = items.filter(e=>e.ds>30).length;
  const aiReady = items.filter(e=>e.aiReady).length;
  const totalOpp = items.reduce((s,e)=>s+e.oppMRR,0);
  const atRisk = items.filter(e=>e.sentiment==="at-risk"||e.sentiment==="critical").length;

  const filtered = filter==="all"?items : filter==="overdue"?items.filter(e=>e.ds>30) : filter==="at-risk"?items.filter(e=>e.sentiment==="at-risk"||e.sentiment==="critical") : items.filter(e=>e.aiReady);

  const doCopy = (id,txt) => {copyText(txt);setCopied(id);setTimeout(()=>setCopied(null),2000)};

  return (<div className="ct" style={{animation:"fi .3s ease"}}>
    <div className="sr">
      <div className="st"><div className="sl">30+ Day Gap</div><div className="sv" style={{color:"var(--rd)"}}>{gap30}</div><div className="ss">need outreach</div></div>
      <div className="st"><div className="sl">At-Risk</div><div className="sv" style={{color:"var(--yl)"}}>{atRisk}</div><div className="ss">sentiment flags</div></div>
      <div className="st"><div className="sl">Opportunity MRR</div><div className="sv" style={{color:"var(--gn)"}}>${totalOpp.toLocaleString()}</div><div className="ss">identified by AI</div></div>
      <div className="st"><div className="sl">AI Analyzed</div><div className="sv" style={{color:"var(--ac)"}}>{aiReady}/{items.length}</div><div className="ss">accounts</div></div>
    </div>

    <div style={{display:"flex",gap:6,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
      {[["all","All"],["overdue","30+ Day Gap"],["at-risk","At-Risk"],["ai","AI Analyzed"]].map(([k,l])=>(
        <button key={k} className={`btn ${filter===k?"bp":"bg"}`} onClick={()=>setFilter(k)} style={{fontSize:11,padding:"5px 11px"}}>{l}</button>
      ))}
      <div style={{marginLeft:"auto",display:"flex",gap:6}}>
        <button className="btn bp" onClick={()=>onAnalyze("all")} disabled={analyzing} style={{fontSize:11}}>
          {analyzing?<><span className="spin"/>Analyzing...</>:<>✨ Analyze All Accounts</>}
        </button>
      </div>
    </div>

    {filtered.map(e=>{
      const isOpen = expanded===e.id;
      const sc = scC(e.score);
      const ai = e.ai;
      return (<div key={e.id} className={`eng-card ${ai?"ai-enriched":""}`}>
        <div className="eng-top" onClick={()=>setExpanded(isOpen?null:e.id)}>
          <div className={`sentiment-dot ${e.sentiment}`}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
              <span style={{fontSize:13,fontWeight:600}}>{e.name}</span>
              <span className={`opp-type ${e.oppType}`}>{oppLabels[e.oppType]||e.oppType}</span>
              {e.ds>30&&<span className="tg critical">{e.ds}d gap</span>}
              {ai&&<span className="ai-badge">AI</span>}
            </div>
            <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>
              {ai ? ai.immediateOpportunity?.description?.slice(0,80) : `${e.ind} · $${e.mrr.toLocaleString()}/mo · Last: ${e.eng[0]?.t||"N/A"} ${e.eng[0]?.d?.slice(5)||""}`}
              {ai?.immediateOpportunity?.description?.length>80?"…":""}
            </div>
          </div>
          {e.oppMRR>0&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:600,color:"var(--gn)"}}>${e.oppMRR.toLocaleString()}<span style={{fontSize:9,color:"var(--t3)"}}>/mo</span></div>}
          <div className="asc" style={{background:sc.b,color:sc.c}}>{e.score}</div>
          <div style={{color:"var(--t3)",fontSize:10,transition:"transform .2s",transform:isOpen?"rotate(180deg)":""}}>▼</div>
        </div>

        {isOpen&&<div className="eng-exp" style={{animation:"fi .2s ease"}}>
          {!ai ? (
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{fontSize:12,color:"var(--t3)",marginBottom:10}}>Run AI analysis to get personalized strategy and outreach for this account</div>
              <button className="btn bp" onClick={()=>onAnalyze(e.id)} disabled={analyzing}>{analyzing?<><span className="spin"/>Analyzing...</>:<>✨ Analyze {e.name}</>}</button>
            </div>
          ) : (<>
            {/* AI Summary */}
            <div className="ap" style={{marginBottom:14}}>
              <h3>✨ AI Account Intelligence</h3>
              <div style={{fontSize:13,fontWeight:600,lineHeight:1.4,marginBottom:10}}>{ai.accountSummary}</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                <span className={`tg ${ai.sentiment}`}>Sentiment: {ai.sentiment}</span>
                <span className={`tg ${ai.immediateOpportunity?.confidence}`}>Confidence: {ai.immediateOpportunity?.confidence}</span>
                <span className="tg info">Timeframe: {ai.immediateOpportunity?.timeframe}</span>
                {ai.competitiveIntel&&!ai.competitiveIntel.includes("None")&&<span className="tg warning">Competitive threat</span>}
              </div>
              <div style={{fontSize:11,color:"var(--t2)",fontStyle:"italic",marginBottom:6}}>{ai.sentimentDetail}</div>
              <div style={{fontSize:11,color:"var(--t2)"}}><strong style={{color:"var(--t1)"}}>Score reasoning:</strong> {ai.scoreReasoning}</div>
            </div>

            {/* Strategy + Outreach side by side */}
            <div className="cg" style={{marginBottom:14}}>
              {/* Left: Strategy */}
              <div>
                <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".6px",color:"var(--t3)",marginBottom:8}}>🎯 Engagement Strategy</div>
                <div className="ebox" style={{marginTop:0,marginBottom:8}}>
                  <div className="ebox-s">This Week ({ai.engagementPlan?.channel})</div>
                  <div className="ebox-b">{ai.engagementPlan?.thisWeek}</div>
                </div>
                <div style={{fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:4}}>Talking Points</div>
                <ul style={{margin:"0 0 10px 14px"}}>{(ai.engagementPlan?.talkingPoints||[]).map((p,i)=><li key={i} style={{fontSize:11,color:"var(--t2)",lineHeight:1.5,marginBottom:3}}>{p}</li>)}</ul>
                {ai.engagementPlan?.avoid&&<div style={{fontSize:11,color:"var(--rd)",background:"var(--rdd)",padding:"6px 10px",borderRadius:6}}>⚠️ Avoid: {ai.engagementPlan.avoid}</div>}
                
                {/* Contact Strategy */}
                <div style={{marginTop:10,fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:4}}>Contact Strategy</div>
                <div style={{fontSize:11,color:"var(--t2)",lineHeight:1.5}}>
                  <strong style={{color:"var(--t1)"}}>Primary:</strong> {ai.contactStrategy?.primaryTarget} — {ai.contactStrategy?.approach}
                </div>
                {ai.contactStrategy?.multiThreadNote&&<div style={{fontSize:11,color:"var(--pr)",marginTop:4}}>{ai.contactStrategy.multiThreadNote}</div>}

                {/* Risks */}
                {ai.risks?.length>0&&<div style={{marginTop:10}}>
                  <div style={{fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:4}}>Risks</div>
                  {ai.risks.map((r,i)=><div key={i} style={{fontSize:11,color:"var(--rd)",lineHeight:1.4,marginBottom:2}}>• {r}</div>)}
                </div>}

                {/* Competitive */}
                {ai.competitiveIntel&&!ai.competitiveIntel.includes("None")&&<div style={{marginTop:10}}>
                  <div style={{fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:4}}>Competitive Intel</div>
                  <div style={{fontSize:11,color:"var(--og)",lineHeight:1.4}}>{ai.competitiveIntel}</div>
                </div>}
              </div>

              {/* Right: Ready-to-Send Outreach */}
              <div>
                <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".6px",color:"var(--t3)",marginBottom:8}}>📧 Ready-to-Send Outreach</div>
                <div className="ebox" style={{marginTop:0}}>
                  <div className="ebox-s">Subject: {ai.outreach?.emailSubject}</div>
                  <div className="ebox-b">{ai.outreach?.emailBody}</div>
                </div>
                <button className={`btn ${copied===e.id+"-email"?"bsuccess":"bp"}`} style={{fontSize:10,marginTop:6}} onClick={()=>doCopy(e.id+"-email",`Subject: ${ai.outreach?.emailSubject}\n\n${ai.outreach?.emailBody}`)}>
                  {copied===e.id+"-email"?"✓ Copied":"📋 Copy Email"}
                </button>

                <div style={{marginTop:12,fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:4}}>📞 Call Opener</div>
                <div className="ebox" style={{marginTop:0}}>
                  <div className="ebox-b">{ai.outreach?.callOpener}</div>
                </div>
                <button className={`btn ${copied===e.id+"-call"?"bsuccess":"bg"}`} style={{fontSize:10,marginTop:6}} onClick={()=>doCopy(e.id+"-call",ai.outreach?.callOpener)}>
                  {copied===e.id+"-call"?"✓ Copied":"📋 Copy Script"}
                </button>

                {/* Product Recommendations */}
                {ai.productRecommendations?.length>0&&<div style={{marginTop:12}}>
                  <div style={{fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:6}}>🧩 AI Product Recommendations</div>
                  {ai.productRecommendations.map((p,i)=><div key={i} className="pf" style={{marginBottom:4}}>
                    <span className={`tg ${p.priority==="primary"?"strong":"moderate"}`}>{p.priority}</span>
                    <div><div style={{fontSize:12,fontWeight:600}}>{p.product}</div><div style={{fontSize:10,color:"var(--t3)"}}>{p.fitReason}</div></div>
                    <div className="pfm">+${(p.mrr||0).toLocaleString()}/mo</div>
                  </div>)}
                </div>}

                {/* 90-day target */}
                {ai.ninetyDayTarget&&<div style={{marginTop:10,padding:"8px 10px",background:"var(--gnd)",borderRadius:6}}>
                  <div style={{fontSize:10,fontWeight:600,color:"var(--gn)",marginBottom:2}}>90-Day Target</div>
                  <div style={{fontSize:11,color:"var(--gn)"}}>{ai.ninetyDayTarget}</div>
                </div>}
              </div>
            </div>

            <div style={{display:"flex",gap:6}}>
              <button className="btn bg" style={{fontSize:11}} onClick={()=>onSelect(e.id)}>View Full Account →</button>
              <button className="btn bg" style={{fontSize:11}} onClick={()=>onAnalyze(e.id)}>🔄 Re-Analyze</button>
            </div>
          </>)}
        </div>}
      </div>);
    })}
  </div>);
}

/* ═══════════════ BRIEFING ═══════════════ */
function Briefing({accounts,aiData,onS,onAnalyze,onOppClick,analyzing}){
  const tM=accounts.reduce((s,c)=>s+c.mrr,0);
  const allPipeline=accounts.flatMap(c=>c.qt.map(q=>({...q,anm:c.name,aid:c.id})));
  const pipelineCurrentMonth=allPipeline.filter(q=>isCloseDateInCurrentMonth(q.closeDate));
  const tQAll=allPipeline.reduce((s,q)=>s+q.mrr,0);
  const tQMonth=pipelineCurrentMonth.reduce((s,q)=>s+q.mrr,0);
  const aiCount=Object.keys(aiData).length;
  const scored=accounts.map(c=>({...c,score:aiData[c.id]?.score||quickScore(c).score,ds:c.eng[0]?daysAgo(c.eng[0].d):999})).sort((a,b)=>b.score-a.score);
  const { count: actionCount, items: actionItems } = getActionItems(accounts);
  const avg=Math.round(scored.reduce((s,c)=>s+c.score,0)/scored.length);
  return(<div className="ct" style={{animation:"fi .3s ease"}}>
    <div className="sr">
      <div className="st"><div className="sl">Book of Business</div><div className="sv" style={{color:"var(--gn)"}}>${tM.toLocaleString()}</div><div className="ss">current MRR</div></div>
      <div className="st"><div className="sl">Pipeline</div><div className="sv" style={{color:"var(--yl)"}}>${tQMonth.toLocaleString()}</div><div className="ss">this month close</div></div>
      <div className="st"><div className="sl">Avg Score</div><div className="sv" style={{color:avg>=60?"var(--gn)":"var(--yl)"}}>{avg}</div><div className="ss">{aiCount>0?`${aiCount} AI-scored`:accounts.length+" accounts"}</div></div>
      <div className="st"><div className="sl">Action items</div><div className="sv" style={{color:actionCount>0?"var(--rd)":"var(--t3)"}}>{actionCount}</div><div className="ss">need attention</div></div>
      <div className="st" style={{display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",cursor:"pointer",border:analyzing?"1px solid var(--ac)":"1px solid var(--bd)"}} onClick={()=>!analyzing&&onAnalyze("all")}>
        {analyzing?<><span className="spin" style={{width:20,height:20}}/><div className="ss" style={{marginTop:4}}>Analyzing...</div></>:<><div style={{fontSize:16}}>✨</div><div className="ss">Run AI Analysis</div></>}
      </div>
    </div>
    <div className="cg">
      <div className="cd"><div className="ch"><span style={{fontSize:15}}>🎯</span><div className="ctit">Top Accounts</div></div>
        {scored.slice(0,10).map(c=>{const s=scC(c.score);const ai=aiData[c.id];
          return(<div key={c.id} className="act" onClick={()=>onS(c.id)}>
            <div className="asc" style={{background:s.b,color:s.c}}>{c.score}</div>
            <div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:12,fontWeight:600}}>{c.name}</span>{ai&&<span className="ai-badge">AI</span>}</div>
              <div style={{fontSize:10.5,color:"var(--t3)",marginTop:1}}>{ai?ai.immediateOpportunity?.description?.slice(0,60)+"…":`$${c.mrr.toLocaleString()}/mo · ${c.ind}`}</div></div>
            <div style={{fontSize:10,color:"var(--t3)"}}>→</div></div>)})}</div>
      <div className="cd"><div className="ch"><span style={{fontSize:15}}>💰</span><div className="ctit">Open Pipeline (current month)</div></div>
        {pipelineCurrentMonth.length===0?<div style={{fontSize:12,color:"var(--t3)",padding:8}}>No opportunities with close date this month. Add close_date to quotes in CSV.</div>
        :pipelineCurrentMonth.sort((a,b)=>b.mrr-a.mrr).map((q,i)=>(
          <div key={i} className="act" onClick={()=>onOppClick(q.aid,q)} style={{marginBottom:4}}>
            <div style={{width:3,minHeight:24,borderRadius:2,background:q.st==="stalled"?"var(--rd)":q.st==="pending-board"?"var(--yl)":"var(--ac)"}}/>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{q.name}</div><div style={{fontSize:10.5,color:"var(--t3)"}}>{q.anm} · <span style={{color:q.st==="stalled"?"var(--rd)":"var(--yl)"}}>{q.st}</span></div></div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:600,color:"var(--gn)"}}>${q.mrr.toLocaleString()}</div></div>))}</div>
      {actionCount>0&&<div className="cd fw"><div className="ch"><span style={{fontSize:15}}>⚠️</span><div className="ctit">Action items ({actionCount})</div></div>
        <div style={{fontSize:11,color:"var(--t3)",marginBottom:8}}>No contact 30+d (all) · No contact 14+d (open opp) · Stalled quote · Stalled ICB 14+d · Renewal in 90d · Renewal in 60d</div>
        {actionItems.slice(0,12).map((a,i)=>(<div key={i} className="act" onClick={()=>onS(a.accountId)} style={{marginBottom:4}}>
          <span className="tg critical" style={{fontSize:9}}>{a.reason}</span>
          <div style={{flex:1,minWidth:0}}><span style={{fontSize:12,fontWeight:600}}>{a.accountName}</span></div>
          <div style={{fontSize:10,color:"var(--t3)"}}>→</div></div>))}
        {actionItems.length>12&&<div style={{fontSize:11,color:"var(--t3)",padding:"6px 0"}}>+{actionItems.length-12} more — open Engagement Hub to see all</div>}
      </div>}
      <div className="cd fw"><div className="ch"><span style={{fontSize:15}}>🧠</span><div className="ctit">AI Insights {aiCount===0&&"— Run analysis to populate"}</div></div>
        {aiCount===0?<div style={{textAlign:"center",padding:"16px 0"}}><div style={{fontSize:12,color:"var(--t3)",marginBottom:8}}>Click "Run AI Analysis" above to get intelligent scoring, strategy, and outreach for every account</div>
          <button className="btn bp" onClick={()=>onAnalyze("all")} disabled={analyzing}>{analyzing?<><span className="spin"/>Running...</>:"✨ Analyze All Accounts"}</button></div>
        :scored.filter(c=>aiData[c.id]).slice(0,5).map(c=>{const ai=aiData[c.id];
          return(<div key={c.id} className="act" onClick={()=>onS(c.id)} style={{marginBottom:4}}>
            <div className={`sentiment-dot ${ai.sentiment}`}/>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{c.name}</div><div style={{fontSize:10.5,color:"var(--t3)"}}>{ai.engagementPlan?.thisWeek?.slice(0,70)}…</div></div>
            <span className={`opp-type ${ai.immediateOpportunity?.type}`}>{oppLabels[ai.immediateOpportunity?.type]||ai.immediateOpportunity?.type}</span></div>)})}</div>
    </div></div>);
}

/* ═══════════════ ACCOUNT DETAIL ═══════════════ */
function Detail({cu,ai,products,onAnalyze,analyzing}){
  const[tab,sTab]=useState("overview");
  const ds=cu.eng[0]?daysAgo(cu.eng[0].d):999;
  const score=ai?.score||quickScore(cu).score;
  const s=scC(score);
  const [copied,setCopied]=useState(null);
  const doCopy=(k,t)=>{copyText(t);setCopied(k);setTimeout(()=>setCopied(null),2000)};
  return(<div className="ct" style={{animation:"fi .3s ease"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div className="asc" style={{background:s.b,color:s.c,width:46,height:46,fontSize:18,borderRadius:10}}>{score}</div>
        <div><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20,fontWeight:700,letterSpacing:"-.4px"}}>{cu.name}</span>{ai&&<span className="ai-badge">AI Analyzed</span>}</div>
          <div style={{fontSize:12,color:"var(--t2)"}}>{cu.ind} · {cu.tier} · Ends {cu.cEnd}</div></div></div>
      <button className="btn bp" onClick={()=>onAnalyze(cu.id)} disabled={analyzing}>{analyzing?<><span className="spin"/>Analyzing...</>:ai?"🔄 Re-Analyze":"✨ Run AI Analysis"}</button>
    </div>
    <div className="sr">
      <div className="st"><div className="sl">Current MRR</div><div className="sv" style={{color:"var(--gn)"}}>${cu.mrr.toLocaleString()}</div><div className="ss">{cu.cur.length} products</div></div>
      <div className="st"><div className="sl">Quoted</div><div className="sv" style={{color:"var(--yl)"}}>${cu.qt.reduce((s,q)=>s+q.mrr,0).toLocaleString()}</div><div className="ss">{cu.qt.length} pending</div></div>
      <div className="st"><div className="sl">AI Opportunity</div><div className="sv" style={{color:"var(--ac)"}}>${(ai?.immediateOpportunity?.estimatedMRR||0).toLocaleString()}</div><div className="ss">{ai?.immediateOpportunity?.confidence||"--"} confidence</div></div>
      <div className="st"><div className="sl">Sentiment</div><div className="sv" style={{fontSize:14,color:ai?.sentiment==="positive"?"var(--gn)":ai?.sentiment==="at-risk"?"var(--yl)":ai?.sentiment==="critical"?"var(--rd)":"var(--ac)"}}>{ai?.sentiment||"Pending"}</div><div className="ss">{ai?.sentimentDetail?.slice(0,30)||"Run analysis"}…</div></div>
      <div className="st"><div className="sl">Last Touch</div><div className="sv" style={{fontSize:17,color:ds<=14?"var(--gn)":ds<=30?"var(--yl)":"var(--rd)"}}>{ds}d</div></div>
    </div>

    {/* AI Panel */}
    {ai&&<div className="ap" style={{animation:"fi .4s ease"}}>
      <h3>✨ AI Strategy Brief</h3>
      <div style={{fontSize:14,fontWeight:600,lineHeight:1.4,marginBottom:12}}>{ai.accountSummary}</div>
      <div className="cg" style={{marginBottom:10}}>
        <div>
          <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".6px",color:"var(--t3)",marginBottom:6}}>This Week's Action</div>
          <div className="ebox" style={{marginTop:0}}><div className="ebox-b">{ai.engagementPlan?.thisWeek}</div></div>
          {ai.engagementPlan?.talkingPoints&&<ul style={{margin:"8px 0 0 14px"}}>{ai.engagementPlan.talkingPoints.map((p,i)=><li key={i} style={{fontSize:11,color:"var(--t2)",lineHeight:1.5,marginBottom:2}}>{p}</li>)}</ul>}
          {ai.engagementPlan?.avoid&&<div style={{fontSize:11,color:"var(--rd)",background:"var(--rdd)",padding:"6px 10px",borderRadius:6,marginTop:8}}>⚠️ {ai.engagementPlan.avoid}</div>}
          {ai.competitiveIntel&&!ai.competitiveIntel.includes("None")&&<div style={{marginTop:8,fontSize:11,color:"var(--og)"}}><strong>Competitive:</strong> {ai.competitiveIntel}</div>}
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".6px",color:"var(--t3)",marginBottom:6}}>Ready-to-Send Email</div>
          <div className="ebox" style={{marginTop:0}}><div className="ebox-s">Subject: {ai.outreach?.emailSubject}</div><div className="ebox-b">{ai.outreach?.emailBody}</div></div>
          <div style={{display:"flex",gap:6,marginTop:6}}>
            <button className={`btn ${copied==="email"?"bsuccess":"bp"}`} style={{fontSize:10}} onClick={()=>doCopy("email",`Subject: ${ai.outreach?.emailSubject}\n\n${ai.outreach?.emailBody}`)}>{copied==="email"?"✓ Copied":"📋 Copy Email"}</button>
            <button className={`btn ${copied==="call"?"bsuccess":"bg"}`} style={{fontSize:10}} onClick={()=>doCopy("call",ai.outreach?.callOpener)}>{copied==="call"?"✓ Copied":"📋 Call Script"}</button>
          </div>
          {ai.ninetyDayTarget&&<div style={{marginTop:8,padding:"6px 10px",background:"var(--gnd)",borderRadius:6,fontSize:11,color:"var(--gn)"}}><strong>90-Day:</strong> {ai.ninetyDayTarget}</div>}
        </div>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
        {ai.risks?.map((r,i)=><span key={i} className="tg critical" style={{fontSize:9}}>⚠ {r}</span>)}
      </div>
    </div>}

    <div className="tabs">{["overview","timeline","contacts","products"].map(t=><button key={t} className={`tab ${tab===t?"on":""}`} onClick={()=>sTab(t)}>{t}</button>)}</div>

    {tab==="overview"&&<div className="cg">
      <div className="cd"><div className="ch"><span>📦</span><div className="ctit">Products & Quotes</div></div>
        {cu.cur.map((p,i)=>{const pr=(products||[]).find(x=>x.name===p);return(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:i<cu.cur.length-1?"1px solid var(--bd)":"none"}}><div><div style={{fontSize:12,fontWeight:600}}>{p}</div><div style={{fontSize:10,color:"var(--t3)"}}>{pr?.cat}</div></div>{pr&&<div className="pfm">${pr.mrr.toLocaleString()}/mo</div>}</div>)})}
        {cu.qt.length>0&&<div style={{borderTop:"1px solid var(--bd)",marginTop:8,paddingTop:8}}>{cu.qt.map((q,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0"}}><div><div style={{fontSize:12,fontWeight:600}}>{q.name} <span style={{color:q.st==="stalled"?"var(--rd)":"var(--yl)",fontSize:10}}>({q.st})</span></div><div style={{fontSize:10,color:"var(--t3)"}}>Quoted {q.date}</div></div><div className="pfm">${q.mrr.toLocaleString()}/mo</div></div>)}</div>}
        {cu.prior.length>0&&<div style={{borderTop:"1px solid var(--bd)",marginTop:8,paddingTop:8}}>{cu.prior.map((s,i)=><div key={i} style={{fontSize:11,color:"var(--rd)",marginBottom:2}}>↩ {s}</div>)}</div>}</div>
      <div className="cd"><div className="ch"><span>📍</span><div className="ctit">Locations</div></div>
        {cu.loc.map((l,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6,padding:"7px 0",borderBottom:i<cu.loc.length-1?"1px solid var(--bd)":"none"}}><div style={{fontSize:12,color:"var(--t2)",flex:1,minWidth:0}}><div>{l.a}</div>{(l.billing != null && l.billing > 0) || (l.targetSpend != null && l.targetSpend > 0) ? <div style={{fontSize:10,color:"var(--t3)",marginTop:2}}>{(l.billing != null && l.billing > 0) && <>Billing: ${l.billing.toLocaleString()}/mo</>}{(l.billing != null && l.billing > 0) && (l.targetSpend != null && l.targetSpend > 0) && " · "}{(l.targetSpend != null && l.targetSpend > 0) && <>Target addressable: ${l.targetSpend.toLocaleString()}</>}</div> : null}</div><span className={`tg ${l.s}`}>{l.s}</span></div>)}</div>
      {ai?.productRecommendations?.length>0&&<div className="cd fw"><div className="ch"><span>🧩</span><div className="ctit">AI Product Recommendations</div></div>
        {ai.productRecommendations.map((p,i)=><div key={i} className="pf"><span className={`tg ${p.priority==="primary"?"strong":"moderate"}`}>{p.priority}</span><div><div style={{fontSize:12,fontWeight:600}}>{p.product}</div><div style={{fontSize:10,color:"var(--t3)"}}>{p.fitReason}</div></div><div className="pfm">+${(p.mrr||0).toLocaleString()}/mo</div></div>)}</div>}
    </div>}
    {tab==="timeline"&&<div className="cd">{cu.eng.map((e,i)=><div key={i} className="tl"><div className="td">{e.d.slice(5)}</div><div style={{flex:1}}><span className={`tt ${tlT(e.t)}`}>{e.t}</span><div style={{fontSize:12,color:"var(--t2)",lineHeight:1.45,marginTop:2}}>{e.n}</div></div></div>)}</div>}
    {tab==="contacts"&&<div className="cd">{cu.con.map((c,i)=><div key={i} className="cr"><div className="cav">{c.name.split(" ").map(n=>n[0]).join("")}</div><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{c.name}</div><div style={{fontSize:10.5,color:"var(--t3)"}}>{c.title}</div></div><span className={`ce ${c.eng}`}>{c.eng}</span>{c.last&&<div style={{fontSize:10,color:"var(--t3)"}}>Last: {c.last}</div>}</div>)}
      {ai?.contactStrategy&&<div style={{marginTop:12,padding:12,background:"var(--b1)",borderRadius:8,border:"1px solid var(--bd)"}}><div style={{fontSize:10,fontWeight:600,color:"var(--t3)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>AI Contact Strategy</div><div style={{fontSize:11,color:"var(--t2)",lineHeight:1.5}}><strong style={{color:"var(--t1)"}}>Primary:</strong> {ai.contactStrategy.primaryTarget} — {ai.contactStrategy.approach}</div>{ai.contactStrategy.multiThreadNote&&<div style={{fontSize:11,color:"var(--pr)",marginTop:4}}>{ai.contactStrategy.multiThreadNote}</div>}</div>}</div>}
    {tab==="products"&&<div>
      {cu.qt.length>0&&<div className="cd" style={{marginBottom:14}}><div className="ch"><span>📝</span><div className="ctit">Open Quotes</div></div>{cu.qt.map((q,i)=><div key={i} className="pf"><div style={{width:3,minHeight:28,borderRadius:2,background:q.st==="stalled"?"var(--rd)":"var(--yl)"}}/><div><div style={{fontSize:12,fontWeight:600}}>{q.name}</div><div style={{fontSize:10,color:"var(--t3)"}}>Quoted {q.date} · <span style={{color:q.st==="stalled"?"var(--rd)":"var(--yl)"}}>{q.st}</span></div></div><div className="pfm">${q.mrr.toLocaleString()}/mo</div></div>)}</div>}
      {ai?.productRecommendations?.length>0?<div className="cd"><div className="ch"><span>🧩</span><div className="ctit">AI Product Recommendations</div></div>{ai.productRecommendations.map((p,i)=><div key={i} className="pf"><span className={`tg ${p.priority==="primary"?"strong":"moderate"}`}>{p.priority}</span><div><div style={{fontSize:12,fontWeight:600}}>{p.product}</div><div style={{fontSize:10,color:"var(--t3)"}}>{p.fitReason}</div></div><div className="pfm">+${(p.mrr||0).toLocaleString()}/mo</div></div>)}</div>
      :<div className="cd"><div style={{textAlign:"center",padding:16}}><div style={{fontSize:12,color:"var(--t3)",marginBottom:8}}>Run AI analysis for intelligent product recommendations</div><button className="btn bp" onClick={()=>onAnalyze(cu.id)} disabled={analyzing}>✨ Analyze</button></div></div>}
    </div>}
  </div>);
}

/* ═══════════════ OPPORTUNITY DETAIL (click-through from Pipeline) ═══════════════ */
function OpportunityDetail({ account, quote, ai, onBack, onGoToAccount }) {
  const lastTouch = account?.eng?.[0];
  const ds = lastTouch ? daysAgo(lastTouch.d) : null;
  return (
    <div className="ct" style={{ animation: "fi .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span onClick={onBack} style={{ cursor: "pointer", color: "var(--t3)", fontSize: 12 }}>← Back</span>
        <span style={{ color: "var(--bd)" }}>/</span>
        <span style={{ fontSize: 14, color: "var(--t2)" }}>Pipeline</span>
        <span style={{ color: "var(--bd)" }}>/</span>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{quote?.name}</span>
        <span style={{ fontSize: 12, color: "var(--t3)" }}>{account?.name}</span>
      </div>
      <div className="sr" style={{ marginBottom: 20 }}>
        <div className="st"><div className="sl">Current MRR</div><div className="sv" style={{ color: "var(--gn)" }}>${(account?.mrr || 0).toLocaleString()}</div><div className="ss">this account</div></div>
        <div className="st"><div className="sl">Quoted Amount</div><div className="sv" style={{ color: "var(--yl)" }}>${(quote?.mrr || 0).toLocaleString()}</div><div className="ss">/mo</div></div>
        <div className="st"><div className="sl">AI Opportunity</div><div className="sv" style={{ color: "var(--ac)" }}>${(ai?.immediateOpportunity?.estimatedMRR || 0).toLocaleString()}</div><div className="ss">{ai ? "AI-recommended" : "Run account AI"}</div></div>
        <div className="st"><div className="sl">Last Touch</div><div className="sv" style={{ color: ds != null && ds <= 30 ? "var(--gn)" : "var(--yl)" }}>{lastTouch ? `${lastTouch.t} · ${ds}d ago` : "—"}</div><div className="ss">{lastTouch?.d || ""}</div></div>
      </div>
      <div className="cd fw">
        <div className="ch"><span>📋</span><div className="ctit">Opportunity</div></div>
        <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 8 }}>{quote?.name} · ${(quote?.mrr || 0).toLocaleString()}/mo · {quote?.st} · Quoted {quote?.date}</div>
        {quote?.closeDate && <div style={{ fontSize: 11, color: "var(--t3)" }}>Expected close: {quote.closeDate}</div>}
        {quote?.notes && <div className="ebox" style={{ marginTop: 8 }}><div className="ebox-b">{quote.notes}</div></div>}
      </div>
      <div className="cd fw" style={{ marginTop: 12 }}>
        <div className="ch"><span>✨</span><div className="ctit">AI Opportunity — Additional potential</div></div>
        <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 10 }}>Where there could be more revenue: new service, up-sell, upgrade, or cross-sell.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {["new-service", "upsell", "upgrade", "cross-sell"].map(cat => {
            const label = { "new-service": "New service", "upsell": "Up-sell", "upgrade": "Upgrade", "cross-sell": "Cross-sell" }[cat];
            const item = ai?.additionalOpportunities?.find(o => o.type === cat);
            return (
              <div key={cat} className="ebox" style={{ padding: 12, background: "var(--b1)", borderColor: item ? "var(--ac)" : "var(--bd)" }}>
                <div style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--t3)", marginBottom: 4 }}>{label}</div>
                {item ? (
                  <>
                    <div style={{ fontSize: 12, color: "var(--t1)", marginBottom: 4 }}>{item.description}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "var(--ac)" }}>+${(item.estimatedMRR || 0).toLocaleString()}/mo</div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--t3)" }}>{ai ? "No specific opportunity" : "Run account AI"}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="cd fw" style={{ marginTop: 12 }}>
        <div className="ch"><span>📄</span><div className="ctit">Current ICBs</div></div>
        <div style={{ fontSize: 12, color: "var(--t3)" }}>ICB data will appear here when integrated with Salesforce.</div>
      </div>
      <div style={{ marginTop: 16 }}>
        <button className="btn bp" onClick={() => onGoToAccount(account?.id)}>View full account →</button>
      </div>
    </div>
  );
}

/* ═══════════════ DATA / UPLOAD VIEW ═══════════════ */
const TABLE_OPTIONS = [
  { key: "productCatalog", label: "Product Catalog", required: "product_name, category, mrr, description" },
  { key: "accounts", label: "Accounts", required: "account_id, account_name, industry, tier, mrr, contract_end" },
  { key: "locations", label: "Locations", required: "account_id, address, net_status", optional: "billing_amount, target_addressable_spend" },
  { key: "currentProducts", label: "Current Products", required: "account_id, product_name" },
  { key: "quotes", label: "Quotes / Pipeline", required: "account_id, product_name, quoted_mrr, quote_date, status" },
  { key: "contacts", label: "Contacts", required: "account_id, contact_name, title, engagement_level" },
  { key: "engagement", label: "Engagement History", required: "account_id, date, type, notes" },
  { key: "churned", label: "Prior / Churned Services", required: "account_id, service_description" },
];

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name, text: String(r.result) });
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsText(file, "UTF-8");
  });
}

function applyTables(next, setUploadTables, setProducts, setAccounts, onPersist) {
  setUploadTables(next);
  setProducts(buildProductsFromRows(next.productCatalog || []));
  setAccounts(buildAccountsFromTables(next.accounts, next.locations, next.currentProducts, next.quotes, next.contacts, next.engagement, next.churned));
  if (typeof onPersist === "function") onPersist(next);
}

function DataView({ uploadTables, setUploadTables, setProducts, setAccounts, onLoadSample, onPersist }) {
  const [tableKey, setTableKey] = useState("accounts");
  const [parseError, setParseError] = useState("");
  const [lastLoaded, setLastLoaded] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    setLastLoaded("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const meta = parseCSVWithMeta(text);
        if (!meta || meta.rows.length === 0) throw new Error("No rows found. Check that the file has a header row and at least one data row.");
        const next = { ...uploadTables, [tableKey]: meta.rows };
        applyTables(next, setUploadTables, setProducts, setAccounts, onPersist);
        setLastLoaded(`${TABLE_OPTIONS.find(t => t.key === tableKey)?.label}: ${meta.rows.length} rows → dashboard mapped`);
      } catch (err) {
        setParseError(err.message || "Failed to parse file.");
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handleMultiDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer?.files || []).filter(f => /\.(csv|txt)$/i.test(f.name));
    if (files.length === 0) return;
    Promise.all(files.map(readFileAsText)).then(results => {
      const pending = results.map(({ name, text }) => {
        const meta = parseCSVWithMeta(text);
        const rows = meta ? meta.rows : [];
        const detected = meta ? detectTableType(meta.normalizedHeaders) : null;
        const label = TABLE_OPTIONS.find(t => t.key === (detected || "accounts"))?.label || "Unknown";
        return { name, rows, detected, assignedTable: detected || "accounts", rawHeaders: meta?.rawHeaders || [], rowCount: rows.length };
      }).filter(p => p.rowCount > 0);
      setPendingFiles(prev => [...prev, ...pending]);
    }).catch(() => setParseError("Could not read one or more files."));
  };

  const setAssigned = (idx, key) => {
    setPendingFiles(prev => prev.map((p, i) => i === idx ? { ...p, assignedTable: key } : p));
  };

  const loadAllPending = () => {
    const next = { ...uploadTables };
    pendingFiles.forEach(p => { next[p.assignedTable] = p.rows; });
    applyTables(next, setUploadTables, setProducts, setAccounts, onPersist);
    setPendingFiles([]);
    setLastLoaded(`${pendingFiles.length} file(s) loaded and mapped to dashboard`);
  };

  return (
    <div className="ct" style={{ animation: "fi .3s ease", maxWidth: 720 }}>
      <div className="cd fw" style={{ marginBottom: 16 }}>
        <div className="ch"><span>📤</span><div className="ctit">Upload by function — auto-maps to dashboard</div></div>
        <p style={{ fontSize: 12, color: "var(--t2)", marginBottom: 12, lineHeight: 1.5 }}>
          Drop one or more CSVs here, or upload per function below. Column headers are auto-mapped (e.g. Account ID → account_id). First row must be headers. Excel: save as CSV (UTF-8) first.
        </p>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleMultiDrop}
          style={{
            border: "2px dashed " + (dragOver ? "var(--ac)" : "var(--bd)"),
            borderRadius: 10,
            padding: "20px 16px",
            textAlign: "center",
            background: dragOver ? "var(--acd)" : "var(--b2)",
            marginBottom: 12,
            fontSize: 12,
            color: "var(--t2)",
          }}
        >
          Drop CSV files here (multiple allowed)
        </div>
        {pendingFiles.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--t3)", marginBottom: 6, textTransform: "uppercase" }}>Detected — assign to dashboard function</div>
            {pendingFiles.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "6px 0", borderBottom: "1px solid var(--bd)", fontSize: 12 }}>
                <span style={{ color: "var(--t1)", minWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }} title={p.name}>{p.name}</span>
                <span style={{ color: "var(--t3)", fontSize: 11 }}>{p.rowCount} rows</span>
                <span style={{ color: "var(--ac)", fontSize: 11 }}>→</span>
                <select value={p.assignedTable} onChange={e => setAssigned(i, e.target.value)} style={{ padding: "4px 8px", background: "var(--b2)", border: "1px solid var(--bd)", borderRadius: 6, color: "var(--t1)", fontFamily: "inherit", fontSize: 11 }}>
                  {TABLE_OPTIONS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
            ))}
            <button className="btn bp" onClick={loadAllPending} style={{ marginTop: 8 }}>Load all and map to dashboard</button>
            <button className="btn bg" onClick={() => setPendingFiles([])} style={{ marginTop: 8, marginLeft: 8 }}>Clear</button>
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 12 }}>Or upload one function at a time:</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginBottom: 12 }}>
          {TABLE_OPTIONS.map(t => (
            <div
              key={t.key}
              onClick={() => { setTableKey(t.key); setParseError(""); fileRef.current?.click(); }}
              style={{
                padding: "10px 12px",
                background: tableKey === t.key ? "var(--acd)" : "var(--b2)",
                border: "1px solid " + (tableKey === t.key ? "var(--ac)" : "var(--bd)"),
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
                color: (uploadTables[t.key]?.length || 0) > 0 ? "var(--gn)" : "var(--t2)",
              }}
            >
              <div>{t.label}</div>
              <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{(uploadTables[t.key] || []).length || 0} rows</div>
            </div>
          ))}
        </div>
        <input type="file" ref={fileRef} accept=".csv,.txt" onChange={handleFile} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn bg" onClick={onLoadSample}>Load sample data</button>
        </div>
        {parseError && <div style={{ marginTop: 10, fontSize: 12, color: "var(--rd)", background: "var(--rdd)", padding: "8px 10px", borderRadius: 6 }}>{parseError}</div>}
        {lastLoaded && <div style={{ marginTop: 10, fontSize: 12, color: "var(--gn)" }}>✓ {lastLoaded}</div>}
      </div>
      <div className="cd fw">
        <div className="ch"><span>📋</span><div className="ctit">Dashboard mapping status</div></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {TABLE_OPTIONS.map(t => {
            const count = (uploadTables[t.key] || []).length;
            return (
              <div key={t.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--bd)", fontSize: 12 }}>
                <span style={{ color: "var(--t2)" }}>{t.label}</span>
                <span style={{ fontFamily: "JetBrains Mono", color: count ? "var(--gn)" : "var(--t3)" }}>{count ? `${count} rows` : "—"}</span>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 12 }}>
          Upload <strong>Accounts</strong> first for best results, then add other functions. Product Catalog is independent. Columns are auto-mapped from your headers (e.g. Account ID → account_id).
        </p>
      </div>
    </div>
  );
}

/* ═══════════════ APP ═══════════════ */
const INITIAL_UPLOAD_TABLES = { productCatalog: [], accounts: [], locations: [], currentProducts: [], quotes: [], contacts: [], engagement: [], churned: [] };

export default function App() {
  const[vw,sVw]=useState("brief");
  const[sel,sSel]=useState(null);
  const[srch,sSrch]=useState("");
  const[aiData,setAiData]=useState({});
  const[analyzing,setAnalyzing]=useState(false);
  const[progress,setProgress]=useState("");
  const[products,setProducts]=useState(PRODUCTS);
  const[accounts,setAccounts]=useState(ACCOUNTS);
  const[uploadTables,setUploadTables]=useState(INITIAL_UPLOAD_TABLES);
  const[selOpp,setSelOpp]=useState(null);
  const[dataHydrated,setDataHydrated]=useState(false);

  useEffect(() => {
    let cancelled = false;
    loadUploadTablesFromSupabase().then((tables) => {
      if (cancelled) return;
      if (tables != null) {
        setUploadTables(tables);
        setProducts(buildProductsFromRows(tables.productCatalog || []));
        setAccounts(buildAccountsFromTables(tables.accounts, tables.locations, tables.currentProducts, tables.quotes, tables.contacts, tables.engagement, tables.churned));
      }
      setDataHydrated(true);
    }).catch(() => setDataHydrated(true));
    return () => { cancelled = true; };
  }, []);

  const sorted=[...accounts].sort((a,b)=>{
    const sa=aiData[a.id]?.score||quickScore(a).score;
    const sb=aiData[b.id]?.score||quickScore(b).score;
    return sb-sa;
  });
  const filt=sorted.filter(c=>c.name.toLowerCase().includes(srch.toLowerCase()));
  const selC=accounts.find(c=>c.id===sel);
  const pick=id=>{sSel(id);sVw("det")};

  const gap30=accounts.filter(c=>{const ds=c.eng[0]?daysAgo(c.eng[0].d):999;return ds>30}).length;
  const aiCount=Object.keys(aiData).length;

  const handleAnalyze = useCallback(async(target)=>{
    setAnalyzing(true);
    if(target==="all"){
      setProgress(`Analyzing 0/${accounts.length}...`);
      let done=0;
      await runBatchAnalysis(accounts,products,(id,result)=>{
        done++;
        setProgress(`Analyzing ${done}/${accounts.length}...`);
        setAiData(prev=>({...prev,[id]:result}));
      });
    } else {
      const acct=accounts.find(c=>c.id===target);
      if(acct){
        setProgress(`Analyzing ${acct.name}...`);
        const result=await runAIAnalysis(acct,products);
        if(result) setAiData(prev=>({...prev,[target]:result}));
      }
    }
    setAnalyzing(false);setProgress("");
  },[accounts,products]);

  const handlePersist = useCallback((tables) => {
    saveUploadTablesToSupabase(tables);
  }, []);

  const handleLoadSample = useCallback(()=>{
    setProducts(PRODUCTS);
    setAccounts(ACCOUNTS);
    setUploadTables(INITIAL_UPLOAD_TABLES);
    saveUploadTablesToSupabase(INITIAL_UPLOAD_TABLES);
  },[]);

  const handleOppClick = useCallback((accountId, quote)=>{
    setSelOpp({ accountId, quote });
    sVw("opp");
    sSel(null);
  },[]);
  const oppAccount = selOpp ? accounts.find(c=>c.id===selOpp.accountId) : null;

  if (!dataHydrated) {
    return (<><style>{CSS}</style><div className="app" style={{ alignItems: "center", justifyContent: "center" }}><div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "var(--t2)", fontSize: 13 }}><span className="spin" style={{ width: 24, height: 24, borderWidth: 2 }}/><span>Loading data…</span></div></div></>);
  }

  return(<><style>{CSS}</style><div className="app">
    <div className="sb">
      <div className="sb-h"><div className="sb-lg"><div className="sb-ic">G</div>GTM Intelligence</div>
        <div className="sb-si"><span>🔍</span><input placeholder="Search accounts..." value={srch} onChange={e=>sSrch(e.target.value)}/></div></div>
      <div className="sb-lb">Navigation</div>
      <div style={{padding:"0 8px"}}>
        <div className={`ni ${vw==="brief"?"on":""}`} onClick={()=>{sVw("brief");sSel(null)}}><span>📊</span>Daily Briefing</div>
        <div className={`ni ${vw==="engage"?"on":""}`} onClick={()=>{sVw("engage");sSel(null)}}><span>🎯</span>Engagement Hub{gap30>0&&<span className="bd">{gap30}</span>}</div>
        <div className={`ni ${vw==="data"?"on":""}`} onClick={()=>{sVw("data");sSel(null)}}><span>📤</span>Upload Data</div>
      </div>
      {analyzing&&<div style={{padding:"8px 16px",fontSize:10,color:"var(--ac)",display:"flex",alignItems:"center",gap:6}}><span className="spin"/>{progress}</div>}
      <div className="sb-lb">Accounts {aiCount>0&&`(${aiCount} AI-scored)`}</div>
      <div className="sb-n">{filt.map(c=>{const score=aiData[c.id]?.score||quickScore(c).score;const s=scC(score);const hasAI=!!aiData[c.id];
        return(<div key={c.id} className={`ai-i ${sel===c.id?"on":""}`} onClick={()=>pick(c.id)}>
          <div className="asc" style={{background:s.b,color:s.c}}>{score}</div>
          <div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontSize:12}}>{c.name}</span>{hasAI&&<span className="ai-badge" style={{fontSize:7,padding:"1px 4px"}}>AI</span>}</div><div style={{fontSize:10,color:"var(--t3)"}}>${c.mrr.toLocaleString()}/mo · {c.ind}</div></div></div>)})}</div>
    </div>
    <div className="mn">
      <div className="mh">
        {vw==="brief"&&<><h1>☀️ Good Morning — Here's Your Day</h1><p>Your book of business, scored and strategized.{aiCount===0?" Hit ✨ to run AI analysis.":` ${aiCount} accounts AI-analyzed.`}</p></>}
        {vw==="engage"&&<><h1>🎯 Engagement Hub — AI-Powered Outreach</h1><p>Every account analyzed for opportunity, sentiment, and competitive risk. Outreach generated from your data.</p></>}
        {vw==="det"&&selC&&<><div style={{display:"flex",alignItems:"center",gap:7}}><span onClick={()=>{sVw("brief");sSel(null)}} style={{cursor:"pointer",color:"var(--t3)",fontSize:12}}>← Back</span><span style={{color:"var(--bd)"}}>/</span><h1 style={{fontSize:16}}>{selC.name}</h1><span className={`tg ${selC.tier==="Strategic"?"positive":selC.tier==="Growth"?"accent":"warning"}`}>{selC.tier}</span>{aiData[selC.id]&&<span className="ai-badge">AI</span>}</div><p>Account Intelligence</p></>}
        {vw==="data"&&<><h1>📤 Upload Data</h1><p>Load your CSV exports from Salesforce or Excel. See the how-to doc for column names.</p></>}
        {vw==="opp"&&selOpp&&<><div style={{display:"flex",alignItems:"center",gap:7}}><span onClick={()=>{sVw("brief");setSelOpp(null)}} style={{cursor:"pointer",color:"var(--t3)",fontSize:12}}>← Back</span><span style={{color:"var(--bd)"}}>/</span><h1 style={{fontSize:16}}>Opportunity: {selOpp.quote?.name}</h1></div><p>{oppAccount?.name}</p></>}
      </div>
      {vw==="brief"&&<Briefing accounts={accounts} aiData={aiData} onS={pick} onAnalyze={handleAnalyze} onOppClick={handleOppClick} analyzing={analyzing}/>}
      {vw==="engage"&&<EngagementHub accounts={accounts} aiData={aiData} onSelect={pick} onAnalyze={handleAnalyze} analyzing={analyzing}/>}
      {vw==="det"&&selC&&<Detail cu={selC} ai={aiData[selC.id]} products={products} onAnalyze={handleAnalyze} analyzing={analyzing}/>}
      {vw==="opp"&&selOpp&&oppAccount&&<OpportunityDetail account={oppAccount} quote={selOpp.quote} ai={aiData[oppAccount.id]} onBack={()=>{sVw("brief");setSelOpp(null)}} onGoToAccount={(id)=>{sSel(id);sVw("det");setSelOpp(null)}}/>}
      {vw==="data"&&<DataView uploadTables={uploadTables} setUploadTables={setUploadTables} setProducts={setProducts} setAccounts={setAccounts} onLoadSample={handleLoadSample} onPersist={handlePersist}/>}
    </div>
  </div></>);
}
