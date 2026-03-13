/**
 * CSV parsing + field mapping for browser-side processing.
 */

import Papa from 'papaparse'

const FIELD_MAP = {
  // === ACCOUNT / CUSTOMER ===
  customer_account: ['customer account', 'account name', 'company', 'customer_account', 'account', 'customer name', 'company name', 'client', 'client name'],
  account_id: ['account id', 'account_id', 'crm id', 'salesforce id', 'sf id', 'account number'],
  mega_vertical: ['mega vertical', 'vertical', 'industry', 'mega_vertical', 'sector', 'mega vertical grouping'],
  sub_vertical: ['sub vertical', 'sub_vertical', 'sub-vertical', 'sub industry', 'sub-industry'],
  primary_rep: ['primary rep', 'primary_rep', 'assigned rep', 'account owner', 'account executive', 'ae'],
  rep_email: ['rep email', 'rep_email', 'owner email', 'ae email'],
  account_manager: ['account manager', 'account_manager', 'am', 'customer success manager', 'csm', 'sales funnel manager', 'funnel manager'],
  sales_owner: ['sales owner', 'sales_owner', 'sales rep owner', 'account sales owner'],
  executive_sponsor: ['executive sponsor', 'executive_sponsor', 'champion', 'sponsor'],
  customer_since: ['customer since', 'customer_since', 'since', 'became customer', 'first purchase date'],
  annual_revenue: ['annual revenue', 'annual_revenue', 'revenue', 'company revenue', 'annual sales'],
  total_brr: ['total brr', 'total_brr', 'brr', 'billing recurring revenue', 'annual recurring revenue', 'arr', 'total arr', 'custacct total brr'],
  employee_count: ['employee count', 'employee_count', 'employees', 'headcount', 'number of employees', '# employees'],
  parent_company: ['parent company', 'parent_company', 'parent', 'parent account'],
  territory: ['territory', 'region', 'sales territory', 'geo'],
  segment: ['segment', 'reporting segment', 'reporting_segment', 'market segment', 'account segment', 'reporting segement'],
  account_tier: ['account tier', 'account_tier', 'tier', 'account level', 'priority'],

  // === DEAL / OPPORTUNITY ===
  opportunity_id: ['opportunity id', 'opportunity_id', 'opp id', 'opp_id', 'salesforce opportunity id', 'sfdc opportunity id', 'sfdc opp id'],
  icb_id: ['icb id', 'icb_id', 'icb number', 'icb_number', 'special pricing icb id'],
  icb_stage: ['icb stage', 'icb_stage', 'special pricing stage', 'special pricing icb stage'],
  icb_created_date: ['icb created date', 'icb_created_date', 'special pricing created date', 'special pricing icb created date'],
  icb_se_review_date: ['date se review', 'date_se_review', 'data se review', 'data_se_review', 'se review date', 'se_review_date', 'icb se review date'],
  icb_se_review_time: ['icb se review time', 'icb_se_review_time', 'se review time', 'se_review_time', 'special pricing icb se review time'],
  icb_status: ['icb status', 'icb_status', 'special pricing status', 'special pricing icb status'],
  icb_se_name: ['solution engineer name', 'solution_engineer_name', 'se name', 'se_name', 'solution engineer', 'solution engineer full name'],
  opportunity_name: ['opportunity name', 'opportunity_name', 'deal name', 'opp name', 'opportunity'],
  mrr: ['total mrr', 'mrr', 'monthly recurring revenue', 'total mrr & mar (converted)', 'monthly revenue', 'total mrr & mar', 'monthly amount', 'mrr converted', 'mrr (converted)'],
  total_contract_value: ['total contract value', 'amount', 'tcv', 'total_contract_value', 'deal amount', 'contract value', 'total value', 'opportunity amount', 'npv', 'npv (converted)'],
  stage: ['stage', 'deal stage', 'opportunity stage', 'sales stage', 'stage name', 'stage group'],
  forecast_category: ['forecast category', 'forecast', 'forecast_category', 'forecast stage'],
  close_date: ['close date', 'close_date', 'expected close', 'expected close date', 'close_date__c', 'date closed lost'],
  created_date: ['created date', 'create date', 'created_date', 'date created', 'created', 'open date'],
  type: ['type', 'deal type', 'opportunity type', 'deal_type', 'opp type'],
  rep: ['created by', 'rep', 'owner', 'deal owner', 'sales rep', 'representative', 'opportunity owner', 'opp owner', 'account owner', 'full name'],
  competitor: ['competitor', 'competition', 'competitive threat'],
  next_step: ['next step', 'next_step', 'next action', 'next steps'],
  sales_channel: ['sales channel', 'opportunity owner sales channel', 'account owner sales channel', 'opp owner sales channel'],
  major_project: ['major project name', 'major project', 'major_project', 'major_project_name'],

  // === CLOSE LOST ===
  loss_reason: ['loss reason', 'loss_reason', 'close lost reason', 'reason lost', 'closed lost reason', 'reason', 'lost reason'],
  competitor_won: ['competitor won', 'competitor_won', 'winning competitor', 'lost to', 'won by'],
  stage_lost_from: ['stage lost from', 'stage_lost_from', 'lost from stage', 'stage when lost'],
  loss_notes: ['loss notes', 'loss_notes', 'notes', 'close lost notes', 'closed lost notes', 'loss detail', 'description'],

  // === QUOTES ===
  quote_number: ['quote number', 'quote_number', 'quote id', 'quote_id', 'proposal number', 'proposal id'],
  quoted_mrr: ['quoted mrr', 'quoted_mrr', 'quote mrr', 'quoted price', 'price', 'quoted amount'],
  quoted_tcv: ['quoted tcv', 'quoted_tcv', 'quote tcv', 'quote amount', 'total quoted'],
  quote_date: ['quote date', 'quote_date', 'date quoted', 'proposal date'],
  expiration_date: ['expiration date', 'expiration_date', 'expires', 'expiry', 'quote expiration', 'valid until'],
  quote_status: ['quote status', 'quote_status', 'proposal status'],
  discount_pct: ['discount pct', 'discount_pct', 'discount', 'discount %', 'discount percent', 'discount rate'],
  list_mrr: ['list mrr', 'list_mrr', 'list price', 'rack rate', 'standard price', 'msrp'],
  competitor_quote: ['competitor quote', 'competitor_quote', 'competitive price', 'competitor price'],

  // === SERVICES / INSTALLED BASE ===
  service_id: ['service id', 'service_id', 'circuit id', 'circuit_id', 'order id', 'service number', 'service name'],
  product_group: ['product group', 'product family', 'product', 'product_group', 'product name', 'product category', 'service type'],
  product_detail: ['product detail', 'product_detail', 'product description', 'description', 'service description'],
  service_status: ['service status', 'service_status', 'status', 'circuit status', 'order status'],
  start_date: ['start date', 'start_date', 'service start', 'install date', 'activation date', 'live date'],
  contract_end_date: ['contract end date', 'contract_end_date', 'end date', 'expiration', 'contract expiry', 'term end', 'current expiration date'],
  disconnect_date: ['disconnect date', 'disconnect_date', 'date disconnected'],
  term_months: ['term months', 'term_months', 'term', 'contract term', 'term length', 'term in months'],
  auto_renew: ['auto renew', 'auto_renew', 'auto-renew', 'autorenewal'],
  location_a: ['location a', 'location_a', 'a-side', 'a side', 'a_location', 'site a', 'loc a'],
  location_z: ['location z', 'location_z', 'z-side', 'z side', 'z_location', 'site z', 'loc z'],
  bandwidth: ['bandwidth', 'capacity', 'speed', 'port speed', 'circuit speed'],
  last_change_date: ['last change date', 'last_change_date', 'last modified', 'last updated', 'modified date'],
  change_type: ['change type', 'change_type', 'modification type', 'change reason'],

  // === LOCATIONS ===
  location_name: ['location name', 'location_name', 'site name', 'site', 'building name', 'facility'],
  location_type: ['location type', 'location_type', 'site type', 'facility type', 'building type'],
  address: ['address', 'street address', 'street', 'address line 1', 'address1'],
  city: ['city', 'town'],
  state: ['state', 'province', 'state/province', 'region'],
  zip: ['zip', 'zip code', 'postal code', 'zipcode', 'postal'],
  on_net_status: ['on-net status', 'on net status', 'on_net_status', 'net status', 'network status', 'onnet status', 'on zayo network status', 'network proximity status', 'network proximity final (ft)'],
  building_access: ['building access', 'building_access', 'access', 'site access'],
  active_services: ['active services', 'active_services', 'service count', 'services', '# services'],
  monthly_revenue: ['monthly revenue', 'monthly_revenue', 'site mrr', 'location mrr', 'site revenue', 'loc attributed mrr', 'location attributed mrr'],
  fiber_lit: ['fiber lit', 'fiber_lit', 'lit', 'fiber', 'lit building', 'fiber available'],
  location_notes: ['location notes', 'location_notes', 'site notes', 'location description'],
  latitude: ['latitude', 'lat', 'geo latitude'],
  longitude: ['longitude', 'lng', 'lon', 'long', 'geo longitude'],

  // === REP PROFILES ===
  rep_name: ['rep name', 'rep_name', 'seller name', 'seller', 'sales rep name'],
  rep_id: ['rep id', 'rep_id', 'seller id'],
  annual_quota: ['annual quota', 'annual_quota', 'yearly quota', 'quota annual'],
  q1_quota: ['q1 quota', 'q1_quota'],
  q2_quota: ['q2 quota', 'q2_quota'],
  q3_quota: ['q3 quota', 'q3_quota'],
  q4_quota: ['q4 quota', 'q4_quota'],
  team: ['team', 'sales team', 'team name'],
  products_certified: ['products certified', 'products_certified', 'certifications'],
}

// Build reverse map
const REVERSE = {}
for (const [canonical, aliases] of Object.entries(FIELD_MAP)) {
  for (const alias of aliases) {
    REVERSE[alias.toLowerCase().trim()] = canonical
  }
}

export function normalizeColumnName(raw) {
  // Salesforce/Xappex headers use "Object : Field" format
  // Try full string (colon removed) first for compound names like "Solution Engineer: Full Name"
  let input = raw
  if (input.includes(':')) {
    const full = input.replace(/:/g, '').replace(/[^\w\s&()-]/g, '').replace(/\s+/g, ' ').toLowerCase().trim()
    if (REVERSE[full] || REVERSE[full.replace(/\s+/g, '_')]) {
      return REVERSE[full] || REVERSE[full.replace(/\s+/g, '_')]
    }
    // Fall back to last segment only
    input = input.split(':').pop()
  }
  let cleaned = input.replace(/[^\w\s&()-]/g, '').replace(/\s+/g, ' ').toLowerCase().trim()
  // Strip Salesforce export suffixes
  cleaned = cleaned.replace(/\s*\(converted\)\s*/g, '').trim()
  cleaned = cleaned.replace(/^custacct[_\s]*/i, '').trim()
  // Skip pure currency columns
  if (cleaned === 'currency') return null
  return REVERSE[cleaned] || REVERSE[cleaned.replace(/\s+/g, '_')] || null
}

export function detectHeaderRow(lines) {
  let bestRow = 0
  let bestCount = 0
  const check = Math.min(lines.length, 20)

  for (let i = 0; i < check; i++) {
    if (!lines[i].trim()) continue
    const cols = lines[i].split(',')
    let matches = 0
    for (const col of cols) {
      if (normalizeColumnName(col)) matches++
    }
    if (matches > bestCount) {
      bestCount = matches
      bestRow = i
    }
  }
  return bestRow
}

export function parseCSV(content) {
  const result = Papa.parse(content, {
    header: false,
    skipEmptyLines: true,
    dynamicTyping: true,
  })

  if (!result.data || result.data.length < 2) return []

  // Find header row
  const lines = result.data.map(r => r.join(','))
  const headerIdx = detectHeaderRow(lines)
  const headers = result.data[headerIdx]

  // Map headers
  const colMap = {}
  headers.forEach((h, i) => {
    if (h) {
      const canonical = normalizeColumnName(String(h))
      if (canonical) colMap[i] = canonical
    }
  })

  if (Object.keys(colMap).length === 0) return []

  // Parse data
  const records = []
  for (let i = headerIdx + 1; i < result.data.length; i++) {
    const row = result.data[i]
    if (!row || row.every(c => c === null || c === '')) continue
    const record = {}
    for (const [idx, field] of Object.entries(colMap)) {
      let val = row[parseInt(idx)]
      if (val === '' || val === null || val === undefined) val = null
      // Don't overwrite a real value with null (handles duplicate columns)
      if (val !== null || !(field in record)) record[field] = val
    }
    // Keep record if it has at least one meaningful field
    if (Object.keys(record).length > 0) records.push(record)
  }

  return records
}
