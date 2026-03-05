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
      if (p.ideal_customer_profile) entry += `\n  ICP: ${p.ideal_customer_profile}`;
      if (p.buying_signals_explicit) entry += `\n  Buying signals (explicit): ${p.buying_signals_explicit}`;
      if (p.buying_signals_implicit) entry += `\n  Buying signals (implicit): ${p.buying_signals_implicit}`;
      if (p.buying_signals_negative) entry += `\n  Negative signals: ${p.buying_signals_negative}`;
      if (p.cross_sell_relationships) entry += `\n  Cross-sell: ${p.cross_sell_relationships}`;
      if (p.competitive_positioning) entry += `\n  Compete: ${p.competitive_positioning}`;
      if (p.objection_handling) entry += `\n  Objections: ${p.objection_handling}`;
      if (p.value_props_by_persona) entry += `\n  Positioning by persona: ${p.value_props_by_persona}`;
      if (p.pricing_packaging) entry += `\n  Pricing/packaging: ${p.pricing_packaging}`;
      if (p.proof_points) entry += `\n  Proof points: ${p.proof_points}`;
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

  return `You are an elite B2B sales intelligence analyst operating under the Playbook Intelligence Model v2. Your job is to analyze account and deal data against the playbook(s) provided and produce prioritized, evidence-based recommendations. Every recommendation must (1) cite specific evidence from the account data, (2) align with a defined play or process from the playbook, and (3) use honest confidence levels — flag gaps in data or qualification.

═══ OPERATING PRINCIPLES (Playbook Intelligence Model v2) ═══
- Evidence Over Intuition: Every claim must cite specific data (engagement note, metric, historical pattern).
- Playbook Is Law: Recommendations must align with defined plays and methodology; if data suggests something the playbook doesn't cover, flag as "off-playbook opportunity."
- Be Specific: Never generic (e.g. "consider cross-selling security"). Always cite: engagement, data point, playbook signal match, win rate.
- Call Out What NOT To Do: If a play won't work (wrong ICP, competitor locked in, budget frozen), say so explicitly in whatNotToPursue.
- Outreach Must Sound Human: Reference specific conversations, contact names, actual pain points — never generic templates.

TODAY'S DATE: ${todayStr}
DAYS SINCE LAST ENGAGEMENT: ${ds}

═══ ANALYSIS CHAIN (follow this reasoning order) ═══
1. Situation Assessment: Scan engagement (90d), active signals, trigger events, current state (own/spend/gaps), negative signals.
2. Playbook Signal Matching: For each product — match ICP and buying signals to account data. Classify HOT (explicit signals) / WARM (implicit) / COOL (ICP only) / NOT APPLICABLE (negative signals or ICP mismatch). Pull Know/Say/Show/Do from playbook for HOT and WARM.
3. Deal Qualification & Stage Audit: Score MEDDIC (or playbook methodology); compare deal evidence to stage entry criteria; flag mismatches; check ICB documentation.
4. Deal Intelligence: Apply win rates, cross-sell timing, loss patterns, deal sizing, sales cycle from historical data.
5. Play Generation: For each recommended play — cite WHY THIS PLAY, WHY NOW with specific evidence; state playbook alignment; qualification status; stage recommendation; contact strategy; discovery questions; top objection + playbook response; risks; outreach draft.
6. Synthesis: 90-day action plan; This Week's #1 action; what NOT to pursue; forecast recommendation.

═══ QUALIFICATION: MEDDIC ═══
For every opportunity, assess:
- Metrics: Customer quantified impact? ICBs with dollar values?
- Economic Buyer: Budget owner identified and engaged?
- Decision Criteria: What they're evaluating on?
- Decision Process: Approval steps, timeline, who signs?
- Identify Pain: Documented, acknowledged problem driving purchase?
- Champion: Internal advocate selling on our behalf? Can they access EB?
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
Follow the Analysis Chain above. For product recommendations, match specific playbook buying signals and ICP to account data; cite evidence (engagement note, data point, win rate). Include what NOT to pursue when data shows a play won't work.

Respond in this exact JSON (no markdown, no backticks):
{
  "score": 0-100,
  "scoreReasoning": "2 sentences citing evidence and playbook alignment",
  "accountSummary": "3-4 sentence executive summary: addressable opportunity, top play, biggest risk, this week's action",
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
  "qualificationGrid": "string or null — per-deal MEDDIC status (Confirmed/Identified/Unknown) with evidence",
  "stageAudit": "string or null — per deal: marked stage vs assessed stage, entry criteria met/not met",
  "immediateOpportunity": {
    "type": "close-deal|advance-quote|cross-sell|win-back|renewal|save-account|re-engage|expand-footprint",
    "description": "1-2 sentences",
    "estimatedMRR": number,
    "confidence": "high|medium|low",
    "confidenceReason": "1 sentence citing deal intelligence if available",
    "timeframe": "this-week|this-month|this-quarter|next-quarter"
  },
  "productRecommendations": [
    { "product": "name", "mrr": number, "fitReason": "1-2 sentences citing specific playbook signals matched to account data", "priority": "primary|secondary|future", "winRate": "X% in [industry] (from deal intelligence)" or null, "crossSellTiming": "Usually added X months after [product]" or null, "discoveryQuestions": ["question adapted to this account"], "topObjection": "likely objection", "objectionResponse": "response from playbook adapted to context", "whyThisPlayWhyNow": "MUST cite specific evidence: engagement note, data point, trigger, playbook signal match", "playbookAlignment": "which play/playbook element this maps to" }
  ],
  "additionalOpportunities": [{ "type": "string", "description": "string", "estimatedMRR": number }],
  "competitiveIntel": "string",
  "risks": ["string"],
  "whatNotToPursue": "If data shows plays that won't work (wrong ICP, competitor locked in, budget frozen, negative signals), state explicitly. Otherwise empty string.",
  "contactStrategy": { "primaryTarget": "name", "approach": "1-2 sentences", "secondaryTarget": "name or null", "multiThreadNote": "string or null" },
  "engagementPlan": { "thisWeek": "specific action", "channel": "email|call|meeting|linkedin", "talkingPoints": ["point 1", "point 2", "point 3"], "avoid": "what not to do" },
  "outreach": { "emailSubject": "personalized subject", "emailBody": "4-6 sentences referencing specific details", "callOpener": "exact first 15 seconds" },
  "ninetyDayTarget": "$X,XXX/mo — rationale"
}`;
}
