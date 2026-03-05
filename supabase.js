import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  url && anonKey
    ? createClient(url, anonKey)
    : null;

export const TABLE_NAME = "gtm_upload_store";

/** @returns {Promise<Record<string, unknown[]>>} upload tables from Supabase, or null if disabled/error */
export async function loadUploadTablesFromSupabase() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("table_key, data")
      .in("table_key", [
        "productCatalog",
        "accounts",
        "locations",
        "currentProducts",
        "quotes",
        "icbs",
        "contacts",
        "engagement",
        "churned",
        "closedWon",
        "closedLost",
      ]);
    if (error) {
      console.warn("Supabase load error:", error.message);
      return null;
    }
    const out = {
      productCatalog: [],
      accounts: [],
      locations: [],
      currentProducts: [],
      quotes: [],
      icbs: [],
      contacts: [],
      engagement: [],
      churned: [],
      closedWon: [],
      closedLost: [],
    };
    (data || []).forEach((row) => {
      if (row.table_key && Array.isArray(row.data)) {
        out[row.table_key] = row.data;
      }
    });
    return out;
  } catch (e) {
    console.warn("Supabase load error:", e);
    return null;
  }
}

/**
 * Persist upload tables to Supabase (upserts each table key).
 * @param {Record<string, unknown[]>} tables
 */
export async function saveUploadTablesToSupabase(tables) {
  if (!supabase) return;
  const keys = [
    "productCatalog",
    "accounts",
    "locations",
    "currentProducts",
    "quotes",
    "icbs",
    "contacts",
    "engagement",
    "churned",
    "closedWon",
    "closedLost",
  ];
  try {
    for (const key of keys) {
      const rows = Array.isArray(tables[key]) ? tables[key] : [];
      const { error } = await supabase.from(TABLE_NAME).upsert(
        {
          table_key: key,
          data: rows,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "table_key" }
      );
      if (error) console.warn("Supabase save error for", key, error.message);
    }
  } catch (e) {
    console.warn("Supabase save error:", e);
  }
}

const PLAYBOOK_EXTRACTION_KEY = "playbook_extraction";

/** @returns {Promise<object | null>} Load saved playbook extraction from Supabase, or null */
export async function loadPlaybookExtractionFromSupabase() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("data")
      .eq("table_key", PLAYBOOK_EXTRACTION_KEY)
      .maybeSingle();
    if (error || !data?.data) return null;
    const arr = Array.isArray(data.data) ? data.data : [data.data];
    return arr.length > 0 && arr[0] != null ? arr[0] : null;
  } catch (e) {
    console.warn("Supabase load playbook extraction error:", e);
    return null;
  }
}

/** @param {object | null} extraction Save playbook extraction to Supabase; pass null to clear */
export async function savePlaybookExtractionToSupabase(extraction) {
  if (!supabase) return;
  try {
    await supabase.from(TABLE_NAME).upsert(
      {
        table_key: PLAYBOOK_EXTRACTION_KEY,
        data: extraction ? [extraction] : [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "table_key" }
    );
  } catch (e) {
    console.warn("Supabase save playbook extraction error:", e);
  }
}
