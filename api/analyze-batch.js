/**
 * POST: Run AI analysis for multiple accounts.
 * Body: { accounts: Account[], products: Product[], dealIntelligence?: object }
 * Returns: { results: { [account_id]: { result, dataHash, analyzedAt } } }
 */
import { buildAnalysisPrompt } from "./_lib/buildPrompt.js";
import { hashAccountData } from "./_lib/hashAccount.js";
import { supabaseAdmin, AI_RESULTS_TABLE } from "./_lib/supabase.js";

// Dynamic import so batch only loads Anthropic when needed
async function runOne(account, products, dealIntelligence, playbookBriefs, anthropic) {
  const prompt = buildAnalysisPrompt(account, products || [], dealIntelligence || null, playbookBriefs || {});
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });
  const text = (response.content || []).map((b) => (b.type === "text" ? b.text : "")).join("");
  const raw = text.replace(/```json|```/g, "").trim();
  const result = JSON.parse(raw);
  const dataHash = hashAccountData(account);
  const analyzedAt = new Date().toISOString();
  if (supabaseAdmin) {
    await supabaseAdmin.from(AI_RESULTS_TABLE).upsert(
      { account_id: account.id, result, data_hash: dataHash, analyzed_at: analyzedAt },
      { onConflict: "account_id" }
    );
  }
  return { result, dataHash, analyzedAt };
}

function getRelevantDealIntel(dealIntelligence, account, availableProducts) {
  if (!dealIntelligence) return null;
  const industry = account.ind;
  const availableNames = (availableProducts || []).map((p) => p.name);
  return {
    totalDeals: dealIntelligence.totalDeals,
    relevantWinRates: Object.fromEntries(
      availableNames
        .filter((p) => dealIntelligence.winRates?.byProductIndustry?.[p]?.[industry])
        .map((p) => [p, dealIntelligence.winRates.byProductIndustry[p][industry]])
    ),
    relevantCrossSells: (dealIntelligence.crossSellSequences || []).filter(
      (s) => (account.cur || []).includes(s.fromProduct) && availableNames.includes(s.toProduct)
    ).slice(0, 5),
    relevantLossPatterns: Object.fromEntries(
      availableNames
        .filter((p) => dealIntelligence.lossPatterns?.byProduct?.[p])
        .map((p) => [p, dealIntelligence.lossPatterns.byProduct[p]])
    ),
    competitiveRecord: dealIntelligence.lossPatterns?.byCompetitor || {},
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { accounts, products, dealIntelligence } = req.body || {};
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return res.status(400).json({ error: "Missing or empty accounts array" });
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const playbookBriefs = (products || []).reduce((acc, p) => {
    if (p.playbookBrief) acc[p.name] = p.playbookBrief;
    return acc;
  }, {});

  const results = {};
  const concurrency = 2;
  let idx = 0;

  async function next() {
    if (idx >= accounts.length) return;
    const account = accounts[idx++];
    const availableProducts = (products || []).filter(
      (p) => !(account.cur || []).includes(p.name) && !(account.qt || []).some((q) => q.name === p.name)
    );
    const relevantDeal = getRelevantDealIntel(dealIntelligence, account, availableProducts);
    try {
      const out = await runOne(account, products, relevantDeal, playbookBriefs, anthropic);
      results[account.id] = out;
    } catch (err) {
      console.error("Batch analyze failed for", account.id, err);
    }
    await next();
  }

  try {
    await Promise.all(Array.from({ length: concurrency }, next));
    res.status(200).json({ results });
  } catch (err) {
    console.error("Batch analysis failed:", err);
    res.status(500).json({ error: err.message || "Batch failed" });
  }
}
