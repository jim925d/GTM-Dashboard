/**
 * CSV column mapping model: maps any CSV header (normalized) to the site's canonical fields.
 * Aligns with UPLOAD-COLUMNS.md. Use mapRowToCanonical(row, tableKey) after parsing to
 * convert rows to canonical keys so builders and detection work with any user column names.
 */

/** For each table: canonical field name → list of accepted normalized header names (aliases). */
export const TABLE_FIELD_ALIASES = {
  productCatalog: {
    product_name: ["product_name", "productname"],
    category: ["category", "cat"],
    mrr: ["mrr"],
    description: ["description", "desc"],
    fit_signals: ["fit_signals", "fitsignals"],
    value_props: ["value_props", "valueprops"],
    use_cases: ["use_cases", "usecases"],
    playbook_brief: ["playbook_brief", "playbookbrief"],
    // Playbook Intelligence Model v2 optional fields
    ideal_customer_profile: ["ideal_customer_profile", "icp", "idealcustomerprofile"],
    buying_signals_explicit: ["buying_signals_explicit", "buyingsignalsexplicit"],
    buying_signals_implicit: ["buying_signals_implicit", "buyingsignalsimplicit"],
    buying_signals_negative: ["buying_signals_negative", "buyingsignalsnegative"],
    cross_sell_relationships: ["cross_sell_relationships", "crosssell", "cross_sell"],
    competitive_positioning: ["competitive_positioning", "competitivepositioning", "compete"],
    objection_handling: ["objection_handling", "objectionhandling", "objections"],
    value_props_by_persona: ["value_props_by_persona", "valuepropsbypersona", "positioning"],
    pricing_packaging: ["pricing_packaging", "pricingpackaging"],
    proof_points: ["proof_points", "proofpoints"],
  },
  accounts: {
    account_id: ["account_id", "accountid", "id"],
    account_name: ["account_name", "accountname", "company", "company_name", "companyname", "customer", "customer_name"],
    industry: ["industry", "ind"],
    tier: ["tier"],
    mrr: ["mrr"],
    contract_end: ["contract_end", "contractend"],
  },
  locations: {
    account_id: ["account_id", "accountid"],
    account_name: ["account_name", "accountname", "company", "company_name", "customer", "customer_name"],
    address: ["address", "a"],
    net_status: ["net_status", "netstatus", "s"],
    billing_amount: ["billing_amount", "billingamount", "billing"],
    target_addressable_spend: ["target_addressable_spend", "targetaddressablespend", "target_spend", "targetspend"],
    latitude: ["latitude", "lat"],
    longitude: ["longitude", "lng", "lon"],
    products: ["products", "products_at_site", "productsatsite"],
  },
  currentProducts: {
    account_id: ["account_id", "accountid"],
    account_name: ["account_name", "accountname", "company", "company_name", "customer", "customer_name"],
    product_name: ["product_name", "productname", "product"],
  },
  quotes: {
    account_id: ["account_id", "accountid", "account"],
    account_name: ["account_name", "accountname", "company", "company_name", "customer", "customer_name"],
    product_name: ["product_name", "productname", "product"],
    quoted_mrr: ["quoted_mrr", "quotedmrr", "mrr"],
    quote_date: ["quote_date", "quotedate", "date"],
    close_date: ["close_date", "closedate"],
    status: ["status", "st"],
    notes: ["notes"],
    opportunity_id: ["opportunity_id", "opportunityid", "quote_id", "quoteid", "opp_id", "oppid"],
  },
  icbs: {
    opportunity_id: ["opportunity_id", "opportunityid", "quote_id", "quoteid", "opp_id", "oppid"],
    description: ["description", "icb_description", "icbdescription"],
    value: ["value", "icb_value", "icbvalue"],
    stakeholder: ["stakeholder"],
  },
  contacts: {
    account_id: ["account_id", "accountid"],
    account_name: ["account_name", "accountname", "company", "company_name", "customer", "customer_name"],
    contact_name: ["contact_name", "contactname", "name", "contact", "full_name", "fullname"],
    title: ["title"],
    engagement_level: ["engagement_level", "engagementlevel", "eng"],
    last_touch: ["last_touch", "lasttouch", "last"],
  },
  engagement: {
    account_id: ["account_id", "accountid"],
    account_name: ["account_name", "accountname", "company", "company_name", "customer", "customer_name"],
    date: ["date", "d"],
    type: ["type", "t"],
    notes: ["notes", "n"],
  },
  churned: {
    account_id: ["account_id", "accountid"],
    account_name: ["account_name", "accountname", "company", "company_name", "customer", "customer_name"],
    service_description: ["service_description", "servicedescription"],
  },
  closedWon: {
    opp_id: ["opp_id", "oppid"],
    account_id: ["account_id", "accountid"],
    account_name: ["account_name", "accountname"],
    industry: ["industry"],
    product_name: ["product_name", "productname"],
    product_category: ["product_category", "productcategory", "category", "cat"],
    mrr: ["mrr"],
    close_date: ["close_date", "closedate"],
    opp_type: ["opp_type", "opptype"],
  },
  closedLost: {
    opp_id: ["opp_id", "oppid"],
    account_id: ["account_id", "accountid"],
    account_name: ["account_name", "accountname"],
    industry: ["industry"],
    product_name: ["product_name", "productname"],
    mrr: ["mrr"],
    close_date: ["close_date", "closedate"],
    loss_reason: ["loss_reason", "lossreason"],
    competitor: ["competitor"],
  },
};

/** All table keys that accept CSV/Excel data. */
export const TABLE_KEYS = Object.keys(TABLE_FIELD_ALIASES);

/**
 * Link keys: columns that match rows across CSV files so data joins correctly.
 * - account_id / account_name (customer name): same value across Accounts, Locations, Quotes, Contacts, etc. → same account
 * - opportunity_id: same value in Quotes and ICBs → ICBs attach to that opportunity
 * Use the same Account ID and Customer Name across files to link locations, quotes, contacts to accounts.
 */
export const LINK_KEYS = {
  account: {
    column: "account_id",
    fallbackColumn: "account_name",
    description: "Links Accounts, Locations, Quotes, Current Products, Contacts, Engagement, Churned, Closed Won/Lost. Use same Account ID (or same Customer/Account Name) in every file.",
    tables: ["accounts", "locations", "currentProducts", "quotes", "contacts", "engagement", "churned", "closedWon", "closedLost"],
  },
  opportunity: {
    column: "opportunity_id",
    fallbackColumn: null,
    description: "Links Quotes to ICBs. Use same Opportunity ID in Quotes and ICB files so benefits attach to the right deal.",
    tables: ["quotes", "icbs"],
  },
};

/**
 * Map a single row (object with normalized header keys) to canonical keys for the given table.
 * Uses first matching alias per canonical field. Preserves only recognized fields.
 * @param {Record<string, string>} row - Row object keyed by normalized headers
 * @param {string} tableKey - One of TABLE_KEYS
 * @returns {Record<string, string>} Row with only canonical keys (values from first matching alias)
 */
export function mapRowToCanonical(row, tableKey) {
  const aliases = TABLE_FIELD_ALIASES[tableKey];
  if (!aliases) return { ...row };

  const out = {};
  for (const [canonical, variants] of Object.entries(aliases)) {
    for (const alias of variants) {
      if (row.hasOwnProperty(alias) && (row[alias] !== undefined && row[alias] !== null && row[alias] !== "")) {
        out[canonical] = typeof row[alias] === "string" ? row[alias].trim() : String(row[alias]).trim();
        break;
      }
    }
    if (!out.hasOwnProperty(canonical)) out[canonical] = "";
  }
  return out;
}

/**
 * Map many rows to canonical keys for the given table.
 * @param {Record<string, string>[]} rows
 * @param {string} tableKey
 * @returns {Record<string, string>[]}
 */
export function mapRowsToCanonical(rows, tableKey) {
  if (!rows || !Array.isArray(rows)) return [];
  return rows.map((r) => mapRowToCanonical(r, tableKey));
}

/**
 * Score how well normalized headers match a table: count of canonical fields that have at least one matching header.
 * @param {Set<string>} headerSet - Normalized headers from CSV
 * @param {string} tableKey
 * @returns {number}
 */
function scoreTableMatch(headerSet, tableKey) {
  const aliases = TABLE_FIELD_ALIASES[tableKey];
  if (!aliases) return 0;
  let score = 0;
  for (const variants of Object.values(aliases)) {
    if (variants.some((a) => headerSet.has(a))) score += 1;
  }
  return score;
}

/**
 * Detect which table type best matches the given normalized headers (e.g. from first row of CSV).
 * Uses alias-aware scoring. Returns tableKey or null if no good match.
 * @param {string[]} normalizedHeaders - Headers after normalizeHeader()
 * @returns {string | null}
 */
export function detectTableType(normalizedHeaders) {
  if (!normalizedHeaders || normalizedHeaders.length === 0) return null;
  const set = new Set(normalizedHeaders);

  const scores = TABLE_KEYS.map((key) => ({ key, score: scoreTableMatch(set, key) })).filter((s) => s.score > 0);
  if (scores.length === 0) return null;

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];

  // Require at least 2 matching fields so we don't map random CSVs to a table
  if (best.score < 2) return null;

  // Tie-break: prefer tables with more required-ish fields matched; and disambiguate quotes vs currentProducts, closedWon vs closedLost
  if (best.key === "quotes" && second?.key === "currentProducts" && best.score === second.score) {
    const quoteSignals = ["quoted_mrr", "quotedmrr", "quote_date", "quotedate", "status", "st", "close_date", "closedate"];
    const hasQuote = quoteSignals.some((h) => set.has(h));
    return hasQuote ? "quotes" : "currentProducts";
  }
  if (best.key === "currentProducts" && second?.key === "quotes" && best.score === second.score) {
    const quoteSignals = ["quoted_mrr", "quotedmrr", "quote_date", "quotedate", "status", "st"];
    return quoteSignals.some((h) => set.has(h)) ? "quotes" : "currentProducts";
  }
  if (best.key === "closedWon" && second?.key === "closedLost" && best.score === second.score) {
    return set.has("loss_reason") || set.has("lossreason") || set.has("competitor") ? "closedLost" : "closedWon";
  }
  if (best.key === "closedLost" && second?.key === "closedWon" && best.score === second.score) {
    return set.has("loss_reason") || set.has("lossreason") || set.has("competitor") ? "closedLost" : "closedWon";
  }

  return best.key;
}
