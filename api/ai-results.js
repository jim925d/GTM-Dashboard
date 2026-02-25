import { supabaseAdmin, AI_RESULTS_TABLE } from "./_lib/supabase.js";

/**
 * GET: Load all persisted AI results. Returns { [account_id]: { result, dataHash, analyzedAt } }
 */
export async function getHandler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  if (!supabaseAdmin) return res.status(200).json({});

  try {
    const { data, error } = await supabaseAdmin
      .from(AI_RESULTS_TABLE)
      .select("account_id, result, data_hash, analyzed_at");
    if (error) throw error;

    const out = {};
    (data || []).forEach((row) => {
      out[row.account_id] = {
        result: row.result,
        dataHash: row.data_hash,
        analyzedAt: row.analyzed_at,
      };
    });
    res.status(200).json(out);
  } catch (err) {
    console.error("ai-results GET failed:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST: Save one or more AI results. Body: { results: [ { account_id, result, dataHash } ] } or single { account_id, result, dataHash }
 */
export async function postHandler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!supabaseAdmin) return res.status(200).json({ ok: true });

  try {
    const body = req.body || {};
    const items = body.results ? body.results : body.account_id ? [body] : [];
    const analyzedAt = new Date().toISOString();

    for (const item of items) {
      if (!item.account_id || !item.result) continue;
      await supabaseAdmin.from(AI_RESULTS_TABLE).upsert(
        {
          account_id: item.account_id,
          result: item.result,
          data_hash: item.dataHash || "",
          analyzed_at: item.analyzedAt || analyzedAt,
        },
        { onConflict: "account_id" }
      );
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("ai-results POST failed:", err);
    res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") return getHandler(req, res);
  if (req.method === "POST") return postHandler(req, res);
  return res.status(405).end();
}
