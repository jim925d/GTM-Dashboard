/**
 * Build the AI analysis prompt (server-side). Must match client logic for prompt structure.
 * Uses MEDDIC + deal intelligence + playbook briefs.
 */

const NOW = new Date();
const daysAgo = (d) => Math.floor((NOW - new Date(d)) / 864e5);

export function buildAnalysisPrompt(account, products, dealIntelligence, playbookBriefs) {
  const ds = account.eng?.[0] ? daysAgo(account.eng[0].d) : 999;
  const availableProducts = (products || []).filter(
    (p) => !(account.cur || []).includes(p.name) && !(account.qt || []).some((q) => q.name === p.name)
  );
  const todayStr = NOW.toISOString().split("T")[0];
  const locLines = (account.loc || [])
    .map((l) => {
      let s = `${l.a} [${l.s}]`;
      if (l.billing) s += ` billing:$${l.billing}/mo`;
      if (l.targetSpend) s += ` target:$${l.targetSpend}/mo`;
      return s;
    })
    .join("; ");
  const addressableGap =
    (account.loc || []).reduce((s, l) => s + (l.targetSpend || 0), 0) - account.mrr;
  const prodBlock = availableProducts
    .map((p) => {
      let entry = `${p.name} ($${p.mrr}/mo, ${p.cat}): ${p.desc || ""}`;
      if (playbookBriefs?.[p.name]) entry += `\n  PLAYBOOK: ${playbookBriefs[p.name]}`;
      else {
        if (p.fit_signals) entry += `\n  Signals: ${p.fit_signals}`;
        if (p.value_props) entry += `\n  Value: ${p.value_props}`;
        if (p.use_cases) entry += `\n  Use cases: ${p.use_cases}`;
      }
      return entry;
    })
    .join("\n\n") || "All products owned or quoted.";
  const dealIntelBlock = dealIntelligence
    ? `
═══ DEAL INTELLIGENCE (from ${dealIntelligence.totalDeals || "historical"} closed deals) ═══
Win Rates: ${JSON.stringify(dealIntelligence.relevantWinRates || {})}
Cross-Sell Patterns: ${JSON.stringify(dealIntelligence.relevantCrossSells || [])}
Loss Patterns: ${JSON.stringify(dealIntelligence.relevantLossPatterns || {})}
Competitive Record: ${JSON.stringify(dealIntelligence.competitiveRecord || {})}
Use these patterns to inform your recommendations. Cite specific win rates and benchmarks.
`
    : "";

  return `You are an elite B2B sales intelligence analyst who uses MEDDIC to qualify opportunities and product playbook intelligence to match solutions to customer needs. Analyze this account with surgical precision.

TODAY'S DATE: ${todayStr}
DAYS SINCE LAST ENGAGEMENT: ${ds}

═══ METHODOLOGY: MEDDIC ═══
For every opportunity you identify, assess:
- Metrics: How does the customer measure success? What KPIs matter?
- Economic Buyer: Who has budget authority? Do we have access?
- Decision Criteria: How will they evaluate? Technical? Price? Relationship?
- Decision Process: What are the steps to a PO? Timeline?
- Identify Pain: What business pain is compelling enough to drive action?
- Champion: Who is selling internally for us? How strong?
Score each: Strong / Partial / Gap. Flag critical gaps.
${dealIntelBlock}
═══ ACCOUNT DATA ═══
Company: ${account.name}
Industry: ${account.ind} | Tier: ${account.tier} | Current MRR: $${account.mrr}/mo
Contract End: ${account.cEnd || "Unknown"}
Locations (${account.loc?.length || 0}): ${locLines}
${account.totalLocationCount ? `Total customer locations (estimated): ${account.totalLocationCount} (we serve ${account.loc?.length || 0})` : ""}
Addressable Spend Gap: $${addressableGap}/mo uncaptured

Current Products: ${(account.cur || []).join(", ") || "None"}
Open Quotes: ${(account.qt || [])
    .map((q) => `${q.name} — $${q.mrr}/mo — ${q.st} — quoted ${q.date}${q.closeDate ? " close: " + q.closeDate : ""}`)
    .join("; ") || "None"}
Prior/Churned: ${(account.prior || []).join("; ") || "None"}
${
  account.dealHistory
    ? `Past Deals with This Account:
Won: ${(account.dealHistory.won || []).map((d) => `${d.product} $${d.mrr}/mo (${d.closeDate})`).join("; ") || "None"}
Lost: ${(account.dealHistory.lost || [])
        .map(
          (d) =>
            `${d.product} $${d.mrr}/mo (${d.closeDate}) reason:${d.lossReason}${d.competitor ? " vs " + d.competitor : ""}`
        )
        .join("; ") || "None"}`
    : ""
}

Contacts:
${(account.con || []).map((x) => `• ${x.name}, ${x.title} — engagement: ${x.eng} — last: ${x.last || "never"}`).join("\n")}

Engagement History (recent first):
${(account.eng || []).map((e) => `[${e.d}] ${e.t}: ${e.n}`).join("\n")}

═══ AVAILABLE PRODUCTS (not owned/quoted) ═══
${prodBlock}

═══ INSTRUCTIONS ═══
Analyze holistically. Consider buying signals (explicit + implicit), customer sentiment, competitive threats, org dynamics, timing, product fit based on playbook criteria, and risks.
For product recommendations, use the PLAYBOOK intelligence above — match specific buying signals and ICP criteria, not generic assumptions. If deal intelligence is available, cite relevant win rates and patterns.

Respond in this exact JSON (no markdown, no backticks):
{
  "score": 0-100,
  "scoreReasoning": "2 sentences",
  "accountSummary": "3 sentence executive summary",
  "sentiment": "positive|neutral|at-risk|critical",
  "sentimentDetail": "1 sentence",
  "addressableSpendAnalysis": "1-2 sentences on where the spend gap is and what drives it",
  "meddic": {
    "metrics": { "status": "strong|partial|gap", "note": "1 sentence" },
    "economicBuyer": { "status": "strong|partial|gap", "note": "1 sentence" },
    "decisionCriteria": { "status": "strong|partial|gap", "note": "1 sentence" },
    "decisionProcess": { "status": "strong|partial|gap", "note": "1 sentence" },
    "pain": { "status": "strong|partial|gap", "note": "1 sentence" },
    "champion": { "status": "strong|partial|gap", "note": "1 sentence" },
    "criticalGaps": ["gap that needs immediate attention"]
  },
  "immediateOpportunity": {
    "type": "close-deal|advance-quote|cross-sell|win-back|renewal|save-account|re-engage|expand-footprint",
    "description": "1-2 sentences",
    "estimatedMRR": number,
    "confidence": "high|medium|low",
    "confidenceReason": "1 sentence citing deal intelligence if available",
    "timeframe": "this-week|this-month|this-quarter|next-quarter"
  },
  "productRecommendations": [
    { "product": "name", "mrr": number, "fitReason": "1-2 sentences citing specific playbook signals matched to account data", "priority": "primary|secondary|future", "winRate": "X% in [industry] (from deal intelligence)" or null, "crossSellTiming": "Usually added X months after [product]" or null, "discoveryQuestions": ["question adapted to this account"], "topObjection": "likely objection", "objectionResponse": "response from playbook adapted to context" }
  ],
  "additionalOpportunities": [{ "type": "string", "description": "string", "estimatedMRR": number }],
  "competitiveIntel": "string",
  "risks": ["string"],
  "contactStrategy": { "primaryTarget": "name", "approach": "1-2 sentences", "secondaryTarget": "name or null", "multiThreadNote": "string or null" },
  "engagementPlan": { "thisWeek": "specific action", "channel": "email|call|meeting|linkedin", "talkingPoints": ["point 1", "point 2", "point 3"], "avoid": "what not to do" },
  "outreach": { "emailSubject": "personalized subject", "emailBody": "4-6 sentences referencing specific details", "callOpener": "exact first 15 seconds" },
  "ninetyDayTarget": "$X,XXX/mo — rationale"
}`;
}
