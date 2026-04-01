# RevOS — Project Rules & Reference

This file is the source of truth for the RevOS analytics engine. It covers formulas, field definitions, calculation logic, and data import workflows. Read the relevant section before building or modifying any dashboard page, forecast model, pipeline calculation, or data pipeline.

---

# PART 1: Formulas & Calculation Logic

## Stage Win Probabilities

Derived from historical close rates in the 2026 funnel model. These represent the probability that a deal currently in a given stage will progress all the way to Closed Won. These values are the **sole determinant** of pipeline probability weighting — forecast categories (Best Case, Longshot, etc.) are no longer used for weighting.

| Stage              | Win Probability | Hex for Charts |
|--------------------|-----------------|----------------|
| Discover           | 0.3057 (30.57%) | `textDim` (muted) |
| Design Solution    | 0.5321 (53.21%) | `yellow`        |
| Propose            | 0.6623 (66.23%) | `orange`        |
| Negotiate          | 0.8467 (84.67%) | `green`         |
| Verbal Agreement   | 0.9249 (92.49%) | `teal`          |
| Closed / Accepted  | 1.0000 (100%)   | `cyan`          |

**Implementation constant:**
```js
const STAGE_WIN_PROB = {
  "Accepted": 1.0,
  "Closed": 1.0,
  "Verbal Agreement": 0.9249,
  "Negotiate": 0.8467,
  "Propose": 0.6623,
  "Design Solution": 0.5321,
  "Discover": 0.3057,
};
const stageProb = (stage) => STAGE_WIN_PROB[stage] || 0.1;
```

The fallback of `0.1` (10%) handles any unrecognized or unmapped stage name. This is intentionally conservative — flag unknown stages to the user rather than silently accepting the fallback.

**Stage order** (funnel top → bottom): Discover → Design Solution → Propose → Negotiate → Verbal Agreement → Accepted/Closed

After Verbal Agreement, a deal moves to Closed Won (Accepted). There is no intermediate stage between VA and Close.

---

## Probability-Weighted Pipeline

The core forecast formula. Replaces any legacy weighting by forecast category.

**Formula:**
```
Weighted Pipeline = SUM across stages( deal_count(stage) × stageProb(stage) × avg_mrr(stage) )
```

For each stage in the active pipeline:
1. Count the deals in that stage
2. Get the win probability for that stage
3. Calculate the average MRR of deals in that stage
4. Multiply all three: `expected_deals_to_close × avg_deal_size`
5. Sum across all stages for the total weighted pipeline

This framing surfaces three levers a manager can reason about: deal count, close probability, and average deal size — rather than an opaque per-deal weighted sum. It also mirrors the Pipeline Gap model, which uses the same three factors in reverse.

Note: Mathematically, `deal_count × prob × avg_mrr` = `prob × total_mrr_in_stage`, so the total is equivalent to weighting each deal individually. The difference is in how the components are displayed and reasoned about.

**Per-stage breakdown** (for the pipeline-by-stage UI card):
```js
const pipeByStage = {};
pipeline.forEach(deal => {
  const st = deal.stage;
  if (!pipeByStage[st]) {
    pipeByStage[st] = { stage: st, raw: 0, deals: 0, prob: stageProb(st) };
  }
  pipeByStage[st].raw += deal.mrr;
  pipeByStage[st].deals++;
});

// Calculate weighted using the stage-level formula
Object.values(pipeByStage).forEach(s => {
  s.avgMrr = s.deals > 0 ? s.raw / s.deals : 0;
  s.expectedDeals = s.deals * s.prob;           // how many deals expected to close
  s.weighted = s.expectedDeals * s.avgMrr;      // deal_count × prob × avg_mrr
});
```

**Display rules:**
- Raw MRR values use `cyan` coloring
- Probability-weighted values ALWAYS use `purple` — this is a strict design rule to prevent confusion between raw and adjusted numbers
- Stage rows show: `Stage Name (XX.X%)  |  N deals × avg $X,XXX  →  $weighted  |`
- Footer shows both raw total and weighted total

**What counts as "active pipeline":**
Deals where `stage` is NOT "Accepted", NOT "Close Lost", and MRR > 0. Negative MRR deals (downgrades, disconnects) are never pipeline — they're churn events.

---

## Pipeline Gap Model

The inverse of forecasting: given a quota target, what deals at what stages are needed to fill the gap?

### Inputs
- **Quota** (quarterly MRR target per rep) — defaults to 3× the rep's historical average monthly bookings
- **Current weighted pipeline** — from the probability-weighted calculation above
- **Gap** = `quota - currentWeightedPipeline` (if positive, there's a gap to fill)

### Coverage Ratio
```
coverage = currentWeightedPipeline / quota
```
- Green: coverage ≥ 100%
- Yellow: coverage ≥ 70%
- Red: coverage < 70%

### Single-Stage Fill Calculation

"If I could only add deals at one stage, how many would I need?"

```
dealsNeeded = gap / (avgDealMRR_at_stage × stageProb)
```

**Example:** Gap is $10,000 weighted. Discover deals average $3,000 MRR.
```
$10,000 / ($3,000 × 0.3057) = 10.9 → 11 deals needed in Discover
```
vs. Negotiate deals at $4,000 avg:
```
$10,000 / ($4,000 × 0.8467) = 2.95 → 3 deals needed in Negotiate
```

This makes stage efficiency immediately visible — fewer high-stage deals vs. many early-stage deals to cover the same gap.

### Blended Build Plan

Real-world version — distribute the gap across stages using adjustable percentage sliders.

Default mix: Propose 30%, Design Solution 25%, Discover 20%, Negotiate 15%, Verbal Agreement 10%

For each stage in the mix:
```
stageGapShare = gap × mixPercent
dealsNeeded = ceil(stageGapShare / (avgDealMRR_at_stage × stageProb))
```

The sliders are interactive — dragging updates deals-needed per stage in real time.

### What-If Simulator

Add hypothetical deals to specific stages with +/− buttons:
```
simWeighted = SUM( additionalDeals × avgDealMRR_at_stage × stageProb )
newCoverage = (currentWeighted + simWeighted) / quota
```

### Average Deal MRR Sources (priority order)
1. Rep's own average deal MRR at that stage (if they have deals there)
2. Team-wide average deal MRR at that stage
3. Global historical average deal size (last resort fallback)

---

## Forecast Projection Model

Projects bookings, churn, and net-new MRR into future quarters.

### Trailing Average Method
```
projectedBookings = avg(last 16 quarters of bookings) + trendAdjustment
projectedChurn = avg(last 16 quarters of churn) + trendAdjustment
```

**Trend adjustment:** Linear regression slope over the trailing 16 quarters, capped at ±30% of the average to prevent runaway extrapolation.

### Confidence Bands
```
low = projected × 0.7    (30% below)
high = projected × 1.3   (30% above)
```

These are displayed as shaded `Area` fills behind the bar chart projections.

### Net-New MRR Projection
```
netNew = projectedBookings - projectedChurn + projectedPriceIncreases
```

### Cumulative MRR Trajectory
- **Solid line**: Actual historical cumulative MRR (running sum of all bookings minus all churn, month by month)
- **Dashed purple line**: Projection from last actual data point forward, adding `(projectedBookings - projectedChurn) / 3` per month (dividing quarterly by 3 for monthly granularity)

---

## Deal Categorization

Every deal record gets assigned a `category` based on its `type` field and MRR value. This classification drives which analytics engine bucket the deal falls into.

| Category         | Detection Logic | MRR Sign |
|------------------|-----------------|----------|
| `new`            | Type contains "New Service" | Positive |
| `renewal`        | Type contains "Positive Re-Rate" AND not price increase | Positive |
| `price_increase` | Major Projects column contains "Price Increase" anywhere in the field | Positive |
| `close_lost`     | Type contains "Close Lost" | Zero or positive (represents missed revenue) |
| `disconnect`     | Type contains "Disconnect" OR (type contains "Negative Re-Rate" AND MRR = 0) | Zero |
| `downgrade`      | Type contains "Negative Re-Rate" AND MRR < 0 | Negative |

**Critical nuances:**
- A `disconnect` with $0 MRR is how the engine detects a fully churned service. Without these records, churn prediction breaks.
- `close_lost` deals stay in the dataset — they train the Bayesian model on loss patterns.
- `price_increase` is detected via the **Major Projects** column, NOT the Type column. The field is checked for the substring "Price Increase" anywhere in its value (it may contain other text alongside). A deal can have Type = "Positive Re-Rate" but be a price increase based on Major Projects.
- Negative MRR with "Negative Re-Rate" = downgrade (partial churn). Zero MRR with "Negative Re-Rate/Disconnect" = full disconnect.

**Implementation:**
```js
const typ = deal.type.toLowerCase();
const majorProject = (deal.majorProject || "").toLowerCase();
const isPI = majorProject.includes("price increase"); // substring match — field can contain other text

let category = isPI ? "price_increase"
  : typ.includes("close lost") ? "close_lost"
  : typ.includes("disconnect") ? "disconnect"
  : typ.includes("negative re-rate") ? (mrr < 0 ? "downgrade" : "disconnect")
  : typ.includes("positive re-rate") ? "renewal"
  : "new";
```

---

## Account Health Score

Composite score from 0–100 built from five factors. Displayed as a circular gauge per account with an SVG breakdown diagram showing the calculation.

**IMPORTANT:** The canonical formula is defined here. The frontend previously used a different "risk score" formula based on days_silent, losses, disconnects, velocity, and concentration. That formula drifted from this spec. The field should be named `health` (not `risk` or `riskScore`) everywhere — frontend, backend, and API responses. If you encounter the old risk score formula in the code, replace it with the one below.

### Factor Breakdown

| Factor | Max Points | Calculation |
|--------|-----------|-------------|
| NRR Score | 40 | `min(40, (nrr / 1.0) × 40)` — scales linearly up to 100% NRR |
| Churn Penalty | -20 | `min(20, churnRate × 200)` — subtracted from total |
| Product Diversity | 15 | `min(15, productCount × 3)` — more products = stickier |
| Pipeline Bonus | 15 | `pipelineValue > 0 ? min(15, pipelineValue / 10000 × 15) : 0` |
| Tenure Score | 10 | `min(10, tenureMonths / 24 × 10)` — maxes at 2 years |

```
healthScore = nrrScore - churnPenalty + productDiversity + pipelineBonus + tenureScore
```

Clamped to 0–100.

### Thresholds
- **Healthy** (≥70): Green
- **At Risk** (40–69): Yellow
- **Critical** (<40): Red

### NRR (Net Revenue Retention)
```
NRR = (currentMRR + expansions - churn) / startingMRR
```
Where `startingMRR` is the account's MRR at the beginning of the measurement period (trailing 12 months), `expansions` includes new services and renewals (positive re-rates), and `churn` includes disconnects and downgrades.

---

## Churn Metrics

Churn encompasses both **disconnects** (full service removal, $0 MRR) and **downgrades** (partial reduction, negative MRR). Both categories are churn events and both feed into churn rate calculations, churn timelines, and churn-by-product breakdowns.

### Gross Churn Rate
```
grossChurnRate = totalMRRlost / totalMRR
```
Where `totalMRRlost` = sum of absolute MRR from all disconnect + downgrade events. Both categories contribute — a $5,000 disconnect and a $1,200 downgrade together add $6,200 to the numerator.

### Churn Timeline
Monthly or quarterly view showing `mrrLost` per period with a 4-quarter forward projection using the trailing average method. Each bar in the timeline includes both disconnect and downgrade MRR. The KPI row shows separate counts: disconnect events, downgrade events (with MRR lost), and close-lost deals (with MRR missed).

### Churn by Product
Which products have the most churn events — aggregated by product group, showing both event count and MRR lost. Includes disconnects AND downgrades per product.

---

## Productivity Metrics

### Rep Productivity
```
avgDealsPerMonth = totalClosedDeals / monthsActive
avgMrrPerMonth = totalClosedMRR / monthsActive
```

### Productivity Trend (Overview page)
Time-series chart (trailing 18 months) with three series:
- Deals closed per month (green bars)
- Deals created per month (cyan line)
- Pipeline/quotes created (purple dashed)

Plus a rep leaderboard: avg deals/month, total closed, total created, MRR/month.

---

## Account Resolution Architecture

All CSV imports resolve account names through a two-layer system built from the hierarchy/registry CSV. The raw registry is uploaded once and processed client-side into two in-memory structures.

### Layer 1: Name Resolution Index

Built automatically when the registry CSV is uploaded. A dictionary mapping every known variant of an account name to its canonical `customer_account`.

```js
// Built from registry CSV on upload
// Key: lowercase variant name → Value: canonical customer_account
const NAME_INDEX = {
  "1life healthcare": "1Life Healthcare",           // exact match (customer_account)
  "1life healthcare inc": "1Life Healthcare",        // parent_account variant
  "1life healthcare, inc.": "1Life Healthcare",      // parent_account variant
  "1 life healthcare": "1Life Healthcare",           // parent_account variant
  "1life healthcare inc-zn": "1Life Healthcare",     // parent_account variant
  // ... every parent_account value from every row
};
```

**How it's built:**
```js
function buildNameIndex(registryRows) {
  const index = {};
  registryRows.forEach(row => {
    const canonical = row.customer_account?.trim();
    if (!canonical) return;
    // Add canonical name as exact match
    index[canonical.toLowerCase()] = canonical;
    // Add parent_account as variant
    const parent = row.parent_account?.trim();
    if (parent && parent.toLowerCase() !== canonical.toLowerCase()) {
      index[parent.toLowerCase()] = canonical;
    }
  });
  return index;
}
```

### Layer 2: Account Metadata

One row per canonical `customer_account` with display/engine fields. Built by grouping registry rows by `customer_account` and picking the mode (most frequent value) for each field.

```js
// One entry per unique customer_account
const ACCOUNT_METADATA = {
  "1Life Healthcare": {
    account_id: "0016000001EZ3CX",
    rep: "Lindsay Tujague",
    sales_manager: "Michael Kahn",
    sales_vp: "Hospitals & Physicians Group",
    vertical: "Healthcare",
    vertical_grouping: "IT / BPO Services",
    mega_vertical: "Software & Tech",
    child_count: 9
  },
};
```

**How it's built:**
```js
function buildAccountMetadata(registryRows) {
  const groups = {};
  registryRows.forEach(row => {
    const key = row.customer_account?.trim();
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });

  const metadata = {};
  Object.entries(groups).forEach(([acct, rows]) => {
    metadata[acct] = {
      account_id: pickFirst(rows, 'account_id'),
      rep: pickMode(rows, 'rep'),
      sales_manager: pickMode(rows, 'sales_manager'),
      sales_vp: pickMode(rows, 'sales_vp'),
      vertical: pickMode(rows, 'vertical'),
      vertical_grouping: pickMode(rows, 'vertical_grouping'),
      mega_vertical: pickMode(rows, 'mega_vertical'),
      child_count: rows.length
    };
  });
  return metadata;
}
```

### Universal Account Resolver

Every CSV import uses this single function to resolve account names. Called by all importers.

```js
function resolveAccount(rawName, nameIndex) {
  if (!rawName) return { canonical: null, method: 'empty' };
  const clean = rawName.trim();
  const lower = clean.toLowerCase();

  // Tier 1: Exact match against index
  if (nameIndex[lower]) {
    return { canonical: nameIndex[lower], method: 'exact' };
  }

  // Tier 2: Fuzzy — strip suffixes and retry
  const fuzzy = lower
    .replace(/[,.\-]/g, ' ')
    .replace(/\b(inc|llc|corp|co|ltd|limited|corporation|company)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (nameIndex[fuzzy]) {
    return { canonical: nameIndex[fuzzy], method: 'fuzzy' };
  }

  // Tier 3: Unresolved
  return { canonical: clean, method: 'unresolved' };
}
```

### Resolution flow for every CSV upload:
1. Read CSV with PapaParse
2. For each row, take the account name field
3. Call `resolveAccount(name, NAME_INDEX)` → get canonical `customer_account`
4. Attach `customer_account` to the row
5. Track resolution stats: { exact: N, fuzzy: N, unresolved: N }
6. After import, show resolution report to user
7. Unresolved rows are KEPT with original name — they just won't join to account metadata

### Storage pattern:
- `NAME_INDEX` stored in IndexedDB store `revos_name_index`
- `ACCOUNT_METADATA` stored in IndexedDB store `revos_account_metadata`
- Both rebuilt on registry CSV re-upload

### Registry CSV column mapping:
| Your CSV Header | Engine Field |
|---|---|
| customer_account | customer_account (canonical name) |
| parent_account | parent_account (variant name → lookup key) |
| account_id | account_id |
| rep | rep |
| sales_manager | sales_manager |
| sales_vp | sales_vp |
| vertical | vertical |
| vertical_grouping | vertical_grouping |
| mega_vertical | mega_vertical |

---

## Edge Cases & Gotchas

**Deal categorization label alignment:** The canonical category names are `new`, `renewal`, `price_increase`, `close_lost`, `disconnect`, `downgrade`. The frontend accountBuilder may use variant labels like `isPriceIncrease` as a boolean flag instead of the `price_increase` category string. Both approaches work, but the category field should use the canonical names from CLAUDE.md when categorizing deals for the analytics engine. The `isPriceIncrease` boolean is fine as an additional convenience field.

**MRR vs TCV confusion:** The pipeline weighting formula uses MRR exclusively. TCV is stored but never used for probability calculations. If a deal only has TCV, it must be converted: `MRR = TCV / contractTermMonths`.

**Mixed MRR signs in one account:** An account can have simultaneous positive pipeline deals and negative churn events. These are in different logical tables — never net them in the pipeline view. Only the Account Health NRR calculation nets them.

**Stage name exact matching:** `stageProb()` does an exact string match. "Negotiate" works but "Negotiation" falls through to the 0.1 fallback. Always flag unrecognized stages.

**Forecast categories still exist in data:** The CSV still has a Forecast Category column (Best Case, Longshot, Commit, Not In Forecast). These are displayed for reference but are NOT used in any weighting calculation. The stage is the sole probability driver.

**Demo data accounts:** Customer 1 through Customer 5 with verticals: Carrier, Software & Tech, Healthcare, Energy, Financial Services. Five reps: William Good, Jennifer Middleton, Katie Allen, Michael Kahn, Bernie Williams.

**Products in demo data:** Wavelengths - Long Haul, Dark Fiber - Metro, IP Services, Ethernet, zColo, SD-WAN, DDoS Protection.

**Verify & Approve:** The human-in-the-loop governance page allows managers to override deal stages (which changes the probability used in forecasts), adjust forecast projections, override health scores, and sign off on the data. All overrides are logged in an immutable audit trail with timestamps.

**SVG in React:** Never use `<animate>` elements inside React — they cause white-screen crashes. Use CSS animations on absolutely-positioned HTML divs over a static SVG background instead.

**Large array performance:** Never spread thousands of items: `Math.max(...largeArray)` freezes the UI. Use single-pass algorithms and batch with `setTimeout` to yield to the event loop.

---

# PART 2: Data Tables & Field Mappings

## Core Input Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `account` | string | ✓ | Customer name or alias (Customer 1, etc.) |
| `mrr` | number | ✓ | Monthly recurring revenue. Negative for downgrades, 0 for disconnects |
| `tcv` | number | | Total contract value. MRR × term. Not used for pipeline weighting |
| `forecast` | string | | Best Case, Longshot, Commit, etc. Legacy — no longer used for weighting |
| `stage` | string | ✓ | Must match stage probability table exactly |
| `close_date` | date | ✓ | When the deal closed or is expected to close |
| `type` | string | ✓ | Deal type — drives categorization (see above) |
| `product` | string | | Product name for mix analysis |
| `bizgroup` | string | | Internal business unit grouping |
| `segment` | string | | Market segment |
| `created` | date | | When the opportunity was created. Used for cycle time |
| `rep` | string | | Sales rep name. Used for productivity and pipeline gap |
| `vertical` | string | | Industry vertical (Carrier, Healthcare, Energy, etc.) |
| `majorProject` | string | | Substring-searched for "Price Increase" to detect PI deals |
| `service_exp` | date | | Current service expiration date. If `exp_period` is "1-MTM", the date is past due and the service is out of contract |
| `exp_period` | string | | Service expiration period. "1-MTM" = month-to-month = out of contract |
| `bandwidth` | string | | Bandwidth of the product in the associated Product Group |

### Derived / Calculated Fields

| Field | Formula | Used In |
|-------|---------|---------|
| `category` | See Deal Categorization above | All analytics |
| `weightedStage` | `deal_count(stage) × stageProb(stage) × avg_mrr(stage)` | Pipeline, forecasts |
| `cycleDays` | `close_date - created_date` (in days) | Product Intel, Overview |
| `isPriceIncrease` | `majorProject.includes("Price Increase")` | Bookings composition |
| `isOutOfContract` | `exp_period === "1-MTM"` | Account health, churn risk |

### Logical Table Views

**Won deals:** `stage === "Accepted"` — closed-won bookings
**Losses:** `category === "close_lost"` — deals that were lost
**Disconnects:** `category === "disconnect"` — fully churned services
**Downgrades:** `category === "downgrade"` — partial churn (negative MRR)
**Price Increases:** `category === "price_increase"` — contractual escalations
**Active Pipeline:** stage not in ["Accepted", "Close Lost"] AND MRR > 0 AND not a churn event

### Deal Cycle Time
```
cycleDays = (close_date - created_date) in days
```
**Exclude deals where cycleDays ≤ 2** — these are administrative entries (same-day bookings, renewals logged retroactively). They skew the average significantly downward.

---

## Column Alias Map (by source file)

Each engine field maps to different column headers depending on the source file. Case-insensitive matching.

| Engine Field | Generic / Salesforce Aliases | Funnel Data | Quotes File | Services File | Locations File |
|-------------|------------------------------|-------------|-------------|---------------|----------------|
| `account` | account name, customer, company, customer name, Account.Name | Customer Account | Account: Customer Account | Account: Customer Account | Customer Account |
| `mrr` | total mrr & mar (converted), total mrr, mrr, total_mrr, MRR__c, Amount | Total MRR | — | MRR (converted) | Loc Attributed MRR |
| `tcv` | total contract value (converted), total contract value, tcv, Amount | Total Contract Value (converted) | Total Contract Value | — | — |
| `forecast` | forecast category, forecast_category, forecast, ForecastCategoryName | Forecast Category | — | — | — |
| `stage` | stage, stagename, stage name, dealstage, pipeline stage, StageName | Stage | — | — | — |
| `close_date` | close date, close_date, closedate, CloseDate | Close Date | — | — | — |
| `type` | type, deal type, deal_type, Type | Type | — | — | — |
| `product` | product group, product_group, product, product family, Product_Family__c | Product Group | Product Group | Product Group | — |
| `bizgroup` | reporting business group, business_group, Business_Group__c | Reporting Business Group | — | — | — |
| `segment` | reporting segement, reporting segment, segment, Segment__c | Reporting Segment | — | — | — |
| `created` | created date, created_date, createddate, CreatedDate | Created Date | Quotes: Created Date | — | — |
| `rep` | created by, rep, created_by, owner, opportunity owner, CreatedBy.Name, Owner.Name | Opportunity Owner | Quotes: Owner Name | Account: Account Owner: Full Name | Global Account Manager |
| `vertical` | mega vertical grouping, mega vertical, vertical, industry, Account.Industry | Mega Vertical Grouping | — | — | Mega Vertical Grouping |
| `majorProject` | major projects, major_projects, major project, project type, Major_Projects__c | Major Projects | — | — | — |
| `service_exp` | current expiration date, service expiration date, expiration date, exp date, service_exp, contract_expiration | — | — | Current Expiration Date | — |
| `exp_period` | expiration period, exp period, contract period, exp_period, contract_term_type | — | — | Expiration Period | — |
| `bandwidth` | bandwidth, bw, circuit bandwidth, speed, capacity, bandwidth_mbps | — | — | Bandwidth | — |

Note: The alias `reporting segement` (misspelling) is intentional — it matches a known Salesforce report export typo.

## Implementation-Ready Alias Map

```js
const FM = {
  account: ["account name", "customer", "company", "customer name", "customer account", "account: customer account"],
  mrr: ["total mrr & mar (converted)", "total mrr", "mrr", "total_mrr", "mrr (converted)", "loc attributed mrr"],
  tcv: ["total contract value (converted)", "total contract value", "tcv", "total_contract_value"],
  forecast: ["forecast category", "forecast_category", "forecast"],
  stage: ["stage", "stagename", "stage name", "dealstage", "pipeline stage"],
  close: ["close date", "close_date", "closedate"],
  type: ["type", "deal type", "deal_type"],
  product: ["product group", "product_group", "product", "product family"],
  bizgroup: ["reporting business group", "business_group", "reporting_business_group"],
  segment: ["reporting segement", "reporting segment", "segment", "reporting_segment"],
  created: ["created date", "created_date", "createddate", "quotes: created date"],
  rep: ["created by", "rep", "created_by", "owner", "opportunity owner", "quotes: owner name", "account: account owner: full name", "global account manager"],
  vertical: ["mega vertical grouping", "mega vertical", "vertical", "mega_vertical_grouping", "industry"],
  majorProject: ["major projects", "major_projects", "major project", "project type", "major_project"],
  service_exp: ["current expiration date", "service expiration date", "expiration date", "exp date", "service_exp", "contract_expiration"],
  exp_period: ["expiration period", "exp period", "contract period", "exp_period", "contract_term_type"],
  bandwidth: ["bandwidth", "bw", "circuit bandwidth", "speed", "capacity", "bandwidth_mbps"],
};
```

## Stage Name Map

| Engine Stage | Known Variants |
|-------------|----------------|
| Discover | Discovery, Qualification, qualifiedtobuy, Prospecting, Initial Contact, Qual |
| Design Solution | Solution Design, Technical Design, presentationscheduled |
| Propose | Proposal, Proposal/Price Quote, RFP, Quote Sent |
| Negotiate | Negotiation, Contract Negotiation, Contract Review, contractsent |
| Verbal Agreement | VA, Verbal, Handshake, decisionmakerboughtin |
| Accepted | Closed Won, Closed, Won, closedwon |
| Close Lost | Lost, Closed Lost, closedlost |

## Deal Type Map

| RevOS Type | Salesforce Variants | Other Variants |
|-----------|-------------------|----------------|
| New Service | New Business, New, New Customer | New Deal, Land |
| Positive Re-Rate | Upsell, Expansion, Add-on, Cross-sell | Upgrade, Expand |
| Negative Re-Rate/Move/Change | Downgrade, Reduction | Decrease, Partial Churn |
| Negative Re-Rate/Disconnect | Churn, Cancellation, Termination | Disconnect, Full Churn |
| Close Lost | Closed Lost, Lost | Dead, No Decision |

## Product Type Map

| Engine Product | Variants |
|---------------|----------|
| Wavelengths - Long Haul | Wavelengths, Long Haul, DWDM, Wave |
| Dark Fiber - Metro | Dark Fiber, Metro Fiber, Lit Building, GPON, Fiber 1G, Fiber 10G |
| IP Services | IP Transit, DIA, Dedicated Internet, Internet |
| Ethernet | Ethernet, E-Line, E-LAN, VPLS, Metro Ethernet |
| zColo | Colocation, Colo, zColo, Data Center |
| SD-WAN | SD-WAN, Software Defined WAN, SDWAN |
| DDoS Protection | DDoS, DDoS Mitigation, Security, DDoS Protection |

## Expiration Period Values

| Value | Meaning | Engine Interpretation |
|-------|---------|----------------------|
| 1-MTM | Month-to-month | **Out of contract** — churn risk flag |
| Other values | Active contract term | In contract |

When `exp_period === "1-MTM"`, the `service_exp` date is effectively past-due and the service has no contractual protection against churn.

---

## Engagement-to-Customer Name Resolution

Engagement data (SalesLoft, Outreach, etc.) uses parent/child account names that don't match the canonical customer names used across RevOS. A **hierarchy file** bridges the two — it maps every parent/child account name to the canonical customer name.

This is a **many-to-one** mapping: a single customer can have dozens of parent/child entries (subsidiaries, divisions, billing accounts, legacy names).

### File Roles

| File | Key Column | Role |
|------|-----------|------|
| **hierarchy.csv** (uploaded fresh each time) | `Account Name` (col D) | Lookup table — maps parent/child → canonical |
| **hierarchy.csv** | `Customer Account` (col A) | The canonical customer name used everywhere in RevOS |
| **engagement_2026.csv** | `Company / Account` (col F) | Raw parent/child name that needs resolution (current year) |
| **engagements.csv** | `Company / Account` (col F) | Raw parent/child name that needs resolution (historical) |

Both engagement files have identical column structures — they just cover different time periods. Process them the same way, either separately or concatenated before resolution.

### Hierarchy File Structure

The hierarchy file is a Salesforce account hierarchy export. Key columns:

| Column | Header | Purpose |
|--------|--------|---------|
| A | Customer Account | **Canonical customer name** — this is the name used across all RevOS data |
| B | Customer Account Id | Salesforce ID of the parent customer |
| C | Account ID | Salesforce ID of this specific account record |
| D | Account Name | **Parent/child account name** — the lookup key |
| E | Billing Account Number | Billing reference |
| F | Agent/Partner/Alliance Type | Channel type |
| G | Account Owner: Full Name | Account owner |
| H | Account Owner: Sales Funnel Manager (Vertical) | Sales manager |
| I | Account Owner: Sales Vice President (Vertical) | VP |
| J | Account Owner: Sales Channel (Vertical) | Channel |
| K | Type | Account type |
| L-N | Overlay owners | Alliance, Sales, and general overlay owners |
| O | ZoomInfo Company ID | Enrichment key |

The hierarchy also carries metadata (Account Owner, VP, Channel) that can enrich engagement records.

### Engagement File Structure (engagement_2026.csv & engagements.csv)

Both files are SalesLoft engagement exports with identical columns. Key columns:

| Column | Header | Purpose |
|--------|--------|---------|
| A | Subject | Activity subject line |
| B | Date | Activity date |
| C | Priority | Priority level |
| D | Status | Activity status |
| E | Task | Task type |
| F | Company / Account | **Parent/child name to resolve** |
| G | Contact | Contact name |
| H | Lead | Lead name |
| I | Opportunity | Linked opportunity |
| J | Comments | Short comments |
| K | Full Comments | Full activity notes |
| L | Account ID | Salesforce Account ID |
| M | Assigned | Assigned rep |
| N | SalesLoft Type | Engagement type |

### Resolution Logic

```js
// Step 1: Build lookup from hierarchy.csv
const nameToCustomer = {};
hierarchy.forEach(row => {
  const parentChild = row["Account Name"]?.trim().toLowerCase();
  const canonical = row["Customer Account"]?.trim();
  if (parentChild && canonical) {
    nameToCustomer[parentChild] = canonical;
  }
});

// Step 2: Resolve each engagement file (same logic for both)
function resolveEngagement(engagement) {
  const resolved = [];
  const unmatched = [];

  engagement.forEach(row => {
    const rawName = row["Company / Account"]?.trim();
    if (!rawName) return; // skip empty rows

    const key = rawName.toLowerCase();
    const customer = nameToCustomer[key];

    if (customer) {
      row["Customer Account"] = customer;  // add canonical name
      resolved.push(row);
    } else {
      row["_unmatched_name"] = rawName;
      unmatched.push(row);
    }
  });

  return { resolved, unmatched };
}

// Process both files
const result2026 = resolveEngagement(engagement_2026);
const resultHist = resolveEngagement(engagements);
```

### Matching Rules

1. **Exact match** (case-insensitive) against `Account Name` in hierarchy → use the associated `Customer Account`
2. **No match** → flag the row as unmatched and skip it from the resolved output
3. **Never fuzzy match silently** — if exact match fails, the row goes to the unmatched report
4. The hierarchy file is uploaded fresh each session — do not cache or store it in the repo

### Output

After resolution, produce outputs per file:

1. **Resolved engagement files** — matched rows with a new `Customer Account` column containing the canonical name. Save as `revos_engagement2026_resolved_{YYYYMMDD}.csv` and `revos_engagements_resolved_{YYYYMMDD}.csv`
2. **Unmatched report** — all rows from both files where `Company / Account` didn't match any hierarchy entry, combined into one report. Save as `revos_engagement_unmatched_{YYYYMMDD}.csv`. Include the raw name and source file so the user can update the hierarchy or manually assign.

### Summary Stats to Show

After resolution, display per file and combined:
- Total engagement rows (non-empty) per file
- Matched: N rows → M unique customers (per file and combined)
- Unmatched: N rows → list the distinct unmatched names (combined across both files)
- Top 10 customers by engagement count (combined)

### How This Feeds RevOS

Once engagement rows have canonical customer names, they join with the rest of RevOS data (funnel, quotes, services, locations) on `Customer Account` / `account`. This powers:
- **Bayesian engine**: engagement frequency and recency as prediction signals
- **Account health**: engagement volume as a health factor
- **Rep productivity**: activity metrics per rep per account

---

# PART 3: CSV-to-Engine Mapper

Use this section when importing CSV, TSV, or Excel files containing CRM, sales, pipeline, quote, or deal data into RevOS.

## How It Works — Two Modes

### Mode 1: Initialize / Rescan
Discovers the current RevOS codebase structure, asks the user to confirm and fill gaps, then writes a hardcoded **Schema Manifest** (`references/schema-manifest.md`) that becomes the source of truth for all future imports.

**Trigger this mode when:**
- `references/schema-manifest.md` does not exist yet (first run)
- The user says "rescan", "update schema", "refresh mappings", or "the schema changed"
- The user reports mapping errors that suggest the manifest is stale

### Mode 2: Map Data
Reads the existing Schema Manifest and maps uploaded files against it. Fast, deterministic, no codebase scanning needed.

**Trigger this mode when:**
- `references/schema-manifest.md` exists AND the user uploads a data file
- This is the default mode for day-to-day imports

---

## MODE 1: Initialize / Rescan

### Step 1: Discover the Codebase

Scan the RevOS project to find what the engine currently expects:

1. **Schema definitions** — Database schemas (Prisma, Drizzle, SQL migrations), TypeScript/JS interfaces, Python models — anything defining deal, opportunity, quote, customer, pipeline, or service structures
2. **Existing ingestion logic** — CSV parsers (PapaParse, pandas), column mapping objects, transformation functions, import API routes
3. **Engine input expectations** — What fields the Bayesian prediction model, pricing engine, product engine, and engagement engine actually read
4. **Dashboard data props** — What the UI components expect as data shapes
5. **Existing data files** — Demo CSVs, seed data, fixtures — these reveal the expected shape by example
6. **Existing column alias maps** — Any mapping dictionaries already in the codebase (these get pulled directly into the manifest)

### Step 2: Present Findings and Ask Questions

Show the user everything discovered. For each table/type found, list every field with its type and whether it appears required. Flag anything ambiguous or missing.

**Ask the user to confirm or correct:**
- Are the discovered tables complete, or are there tables the engine expects that aren't defined in code yet?
- Are there fields the user knows the engine will need soon (upcoming features) that should be added now?
- Are close-lost deals a separate table or filtered from opportunities?
- Which fields are strictly required vs. nice-to-have for the prediction model?
- What CRM platforms will data come from? (Salesforce, HubSpot, custom exports — determines which aliases to include)

### Step 3: Generate the Schema Manifest

Based on discovery + user answers, generate `references/schema-manifest.md`. This file is hardcoded, human-editable, version-controlled, and re-generable.

### Step 4: Confirm with the User

Show the generated manifest before writing it. Only write the file after explicit confirmation.

---

## MODE 2: Map Data

### Step 1: Read the Manifest

Load `references/schema-manifest.md`. If the manifest doesn't exist, switch to Mode 1 and tell the user: "No schema manifest found — I need to scan the codebase first to set up mappings. This is a one-time step."

### Step 2: Read the Uploaded File

1. **Detect format**: CSV, TSV, XLSX, XLS (check delimiter, encoding, BOM)
2. **Read headers**: Extract all column names exactly as they appear
3. **Sample rows**: Read first 10-20 rows to understand data types and value patterns
4. **Basic stats**: Row count, column count, % null per column, date range

### Step 3: Map Columns Against the Manifest

**Matching priority:**
1. **Exact match** — column name matches an engine field name
2. **Alias match** — column name matches a known alias
3. **Semantic match** — column name clearly refers to the same concept but isn't in the alias list
4. **Ambiguous** — column could map to multiple fields
5. **No match** — column doesn't correspond to anything in the manifest

For new aliases found, ask: "Should I add this as an alias so it auto-maps next time?"
For unmatched columns, ask: "(a) add as new field, (b) map to existing field, or (c) drop?"

### Step 4: Validate Data Quality

| Check | What to Flag | Ask User If... |
|---|---|---|
| **Date formats** | Mixed formats in same column | Ambiguous format (01/02/24) |
| **Currency values** | Symbols, commas, text in numeric fields | Contains "$", "K", "M", or mixed formats |
| **Stage names** | Values not in the stage map | New stages appear — add or remap? |
| **Percentages** | Mix of 0-1 and 0-100 | Scale unclear |
| **Required nulls** | Required field has blanks | Skip row, default value, or flag? |
| **Duplicates** | Same ID appears multiple times | Keep latest, keep all, or dedup? |
| **Outliers** | Values 10x+ the column median | Real data or error? |
| **Table split** | Won + lost deals in same file | Split or keep combined? |

### Step 5: Generate Output

1. Rename columns to engine field names per manifest
2. Apply confirmed transformations (dates, currency, stages, etc.)
3. Add provenance columns: `_source_file`, `_mapped_at`, `_source_row`
4. Save to output directory
5. If the codebase has an import mechanism, explain how to load the file

### Step 6: Update the Manifest

If this import session added new aliases, new fields, new stage mappings, or new validation rules — write the updated manifest back so the next import inherits them.

---

## Critical Rules for Data Import

1. **Manifest is the source of truth for imports.** Don't re-scan the codebase on every import — read the manifest.
2. **Ask, don't assume.** Any ambiguous mapping, unclear value format, or new column → ask. Never proceed silently.
3. **Never silently drop data.** Every column and row must be accounted for in the report.
4. **Never silently transform.** Show transformations before applying.
5. **Preserve originals.** Output is always a new file.
6. **Stage names are sacred.** The Bayesian model learns per-stage. Confirm every stage mapping.
7. **MRR vs TCV must be explicit.** The pricing engine treats them differently. If unclear, ask.
8. **Date ambiguity must be resolved.** Never guess date formats. Ask if ambiguous.
9. **Track provenance.** Every output row traces back to source file + row number.
10. **Evolve the manifest over time.** Every import that discovers new aliases or fields should offer to update the manifest.

## Edge Cases for Data Import

- **Salesforce nested fields**: `Account.Name`, `Owner.Email` — split on "." and map child
- **HubSpot property format**: `dealname`, `closedate` — no spaces, match semantically
- **Pivot tables**: Warn that engine needs row-level records, not aggregated summaries
- **Multiple Excel sheets**: Describe each sheet, ask user which to import
- **Mixed won/lost**: Ask whether to split or keep combined
- **Stage history vs. current snapshot**: History is more valuable for the prediction model — note this
- **Anonymized data**: "Customer 1", "Customer 2" pattern — preserve aliases, note in report
- **Incremental imports**: If data overlaps with a previous import, flag and ask
