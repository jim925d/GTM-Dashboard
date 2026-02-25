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
        "contacts",
        "engagement",
        "churned",
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
      contacts: [],
      engagement: [],
      churned: [],
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
    "contacts",
    "engagement",
    "churned",
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
