const fs = require("fs");
const Papa = require("./node_modules/papaparse");
const { normalizeColumnName } = require("./src/lib/normalize.js");

// Can't import ESM, so reimplement normalizeStage
function normalizeStage(raw) {
  if (!raw) return ''
  const s = raw.toLowerCase().trim()
  if (s.includes('accepted') || s === '5 - accepted' || s === 'closed-won') return 'closed won'
  if (s.includes('closed lost') || s === 'closed lost') return 'closed lost'
  if (s.includes('discover') || s.startsWith('1')) return 'Discover'
  if (s.includes('design') || s.startsWith('2')) return 'Design'
  if (s.includes('propose') || s.startsWith('3')) return 'Propose'
  if (s.includes('negotiate') || s.startsWith('4')) return 'Negotiate'
  return raw
}

const text = fs.readFileSync("data/funnel.csv", "utf-8");
const result = Papa.parse(text, {header: true, skipEmptyLines: true});

let inClosedWon = 0, inActive = 0, inNeither = 0;
let mrrClosedWon = 0, mrrActive = 0;
const issues = [];

for (const row of result.data) {
  const fc = (row["Forecast Category"] || "").trim();
  const cd = (row["Close Date"] || "").trim();
  const mrr = parseFloat(row["Total MRR & MAR (converted)"]) || 0;
  const mp = (row["Major Project Name"] || "").trim();
  const stage = (row["Stage"] || "").trim();
  const ch = (row["Account : Account Owner : Sales Channel"] || "").trim();

  if (fc === "Closed" && cd.match(/^3\/.*\/2026/) && mp === "" && mrr > 0) {
    const ns = normalizeStage(stage);
    const isWon = ns === 'closed won';
    const isLost = ns === 'closed lost';
    const isActiveP = !['closed won', 'closed lost', ''].includes(ns);

    if (isWon) { inClosedWon++; mrrClosedWon += mrr; }
    else if (isActiveP) { inActive++; mrrActive += mrr; }
    else { inNeither++; }

    if (!isWon) {
      issues.push(`Stage=[${stage}] normalized=[${ns}] isActive=${isActiveP} MRR=$${mrr.toFixed(2)} Ch=[${ch}]`);
    }
  }
}

console.log("March Closed, MRR>0, MP blank deals:");
console.log("  In closedWon (funnel_closed):", inClosedWon, "deals, $" + mrrClosedWon.toFixed(2));
console.log("  In activePipeline (active_deals):", inActive, "deals, $" + mrrActive.toFixed(2));
console.log("  In neither:", inNeither);
console.log("  Total:", "$" + (mrrClosedWon + mrrActive).toFixed(2));
console.log("\nDeals NOT in closedWon:");
issues.forEach(i => console.log("  ", i));
