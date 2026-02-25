import Anthropic from "@anthropic-ai/sdk";
import { buildAnalysisPrompt } from "./_lib/buildPrompt.js";
import { hashAccountData } from "./_lib/hashAccount.js";
import { supabaseAdmin, AI_RESULTS_TABLE } from "./_lib/supabase.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { account, products, dealIntelligence, playbookBriefs } = req.body || {};
  if (!account?.id) {
    return res.status(400).json({ error: "Missing account or account.id" });
  }

  try {
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
        {
          account_id: account.id,
          result,
          data_hash: dataHash,
          analyzed_at: analyzedAt,
        },
        { onConflict: "account_id" }
      );
    }

    res.status(200).json({ result, dataHash, analyzedAt });
  } catch (err) {
    console.error("Analysis failed:", err);
    res.status(500).json({ error: err.message || "Analysis failed" });
  }
}
