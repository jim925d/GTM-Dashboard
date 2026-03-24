---
name: revos-data-mapper
description: Map CSV/Excel files for the RevOS GTM Platform. Handles eight data tables — Customers, Hierarchy, Deals (funnel + historical + close_lost), Engagements, Quotes, Services, ICB, and Locations — with auto-column-mapping, account resolution via parent/child hierarchy, type normalization, and data coercion. This skill applies to ALL dashboards and all three engines (Bayesian prediction, backtest, game theory). Use this skill whenever the user uploads CSV data, asks about field names or data formats, needs CRM export mapping, or reports data not showing up. Trigger on: "map this data", "import data", "field names", "column mapping", "accounts aren't matching", "CSV isn't working", or any data table reference. Even if the user just drops a CSV, use this skill.
---

# RevOS GTM Platform Data Mapper

Single source of truth for how data flows into every dashboard and engine in RevOS. Built from the actual Salesforce/SalesLoft export headers used in production.

## Platform Data Flow

```
CSV / CRM EXPORTS
  Customers · Hierarchy · Engagements · Deals (funnel + historical + close_lost)
  Quotes · Services · ICB · Locations
       │
       ▼
┌─────────────────────────────┐
│  INGESTION LAYER            │
│  • Column auto-mapping      │
│  • Date normalization       │
│  • Type/stage normalization │
│  • Numeric coercion         │
│  • Account resolution       │
│    (Hierarchy FIRST)        │
└──────────┬──────────────────┘
           │
     ┌─────┼─────┬─────┬─────┬─────┬─────┬─────┐
     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼
   Engage  Fore  Pipe  Deal  Dash  Loca  Mana  Ask
   ment    cast  line  Prep  board tions ger   RevOS
   Dash    Dash  Gap                View
           │
     ┌─────┼─────┐
     ▼     ▼     ▼
  Bayesian Backtest Game
  Engine   Engine  Theory
```

## File → Table Mapping

| File | → Table | Rows | Status |
|---|---|---|---|
| `customers.csv` | Customers | 5,355 | Account master list |
| `Hierarchy.csv` | Hierarchy | 21,089 | Parent/child account mapping |
| `engagement_2026a.csv` | Engagements | 10,117 | SalesLoft activity events |
| `funnel.csv` | Deals (status=Open) | 6,844 | Active pipeline |
| `historical.csv` | Deals (status=Won) | 34,316 | Closed-won deals |
| `close_lost.csv` | Deals (status=Lost) | 6,847 | Closed-lost deals |
| `quotes.csv` | Quotes | 4,950 | Pricing quotes |
| `services.csv` | Services | 10,986 | Installed base |
| `ICB.csv` | ICB (enrichment on Deals) | 31 | Special pricing approvals |

## Import Order

1. **Customers** → establishes account master list
2. **Hierarchy** → maps CRM names/IDs to canonical customer names
3. **Services** → installed base
4. **Deals** → funnel + historical + close_lost (all three into one table)
5. **Engagements** → activity data
6. **Quotes** → pricing quotes
7. **ICB** → enriches Deals via `opportunity_name` join

---

# Table Schemas — From Actual File Headers

**All tables join on `customer_account` — the account name string.**

## Table: Customers

Source: `customers.csv` (12 columns, 5,355 rows)

| Canonical Field | Type | Req | Salesforce Header | Description |
|---|---|---|---|---|
| `customer_account` | string | ✓ | `Account Global Region : Account : Customer Account` | Primary account join key |
| `total_brr` | number | | `Account Global Region : Account : Total BRR` | Monthly base recurring revenue |
| `rep` | string | ✓ | `Sales Owner` | Assigned sales rep |
| `mega_vertical` | string | | `Account Global Region : Account : Mega Vertical Grouping` | Top-level industry grouping |
| `vertical` | string | | `Account Global Region : Account : Vertical` | Sub-level under mega vertical |
| `sales_channel` | string | | `Account Global Region : Sales Owner : Sales Channel` | Premier, House, BDR, etc. |
| `sales_funnel_manager` | string | | `Account Global Region : Sales Owner : Sales Funnel Manager` | Manager of the sales owner |
| `sales_vp` | string | | `Account Global Region : Sales Owner : Sales Vice President` | VP over the sales team |
| `account_type` | string | | `Type` | Direct, Indirect, etc. |
| `provisioning_system` | string | | `Account Global Region : Account : Provisioning System` | Provisioning system ID |

**Ignored columns:** `Total BRR Currency` (always USD), `Sales Funnel Manager` (duplicate of the prefixed version).

### Segmentation Hierarchy

`Mega Vertical` → `Vertical` → `Industry`

| Level | Canonical Field | Source Column | Example Values |
|---|---|---|---|
| **Mega Vertical** | `mega_vertical` | `Mega Vertical Grouping` | Finance, Carrier, Healthcare, Software & Tech |
| **Vertical** | `vertical` | `Vertical` | Proprietary Trading, Managed Service Provider |
| **Industry** | `industry` | `Industry` | (appears in deal files only) |

---

## Table: Hierarchy

Source: `Hierarchy.csv` (15 columns, 21,089 rows)

| Canonical Field | Type | Req | Salesforce Header | Description |
|---|---|---|---|---|
| `parent_name` | string | ✓ | `Customer Account` | Canonical customer account name (maps to Customers) |
| `customer_account_id` | string | | `Customer Account Id` | SF record ID for the parent account |
| `child_id` | string | ✓ | `Account ID` | SF record ID for the child/billing account |
| `child_name` | string | ✓ | `Account Name` | CRM-facing account name |
| `billing_account_number` | string | | `Billing Account Number` | Billing system account number |
| `partner_type` | string | | `Agent/Partner/Alliance Type` | Partner classification |
| `rep` | string | | `Account Owner: Full Name` | Account owner |
| `sales_funnel_manager` | string | | `Account Owner: Sales Funnel Manager (Vertical)` | Manager |
| `sales_vp` | string | | `Account Owner: Sales Vice President (Vertical)` | VP |
| `sales_channel` | string | | `Account Owner: Sales Channel (Vertical)` | Channel |
| `account_type` | string | | `Type` | Parent, Child, etc. |
| `zoominfo_id` | string | | `ZoomInfo Company ID` | ZoomInfo enrichment ID |

### Account Resolution Flow

1. **Hierarchy FIRST** — look up `child_name` (account name) OR `child_id` (SF record ID) → rewrite to `parent_name`
2. **Direct customer match** — value already exists in Customers table
3. **Fuzzy match** — strip Inc/LLC/Corp suffixes, normalize punctuation
4. **Unresolved** — keep original, flag in diagnostics

---

## Table: Deals (Unified)

Source: `funnel.csv` (Open) + `historical.csv` (Won) + `close_lost.csv` (Lost)

Merged into one table with a derived `deal_status` field.

### Core Fields (All Three Files)

| Canonical Field | Type | Req | Salesforce Header | Description |
|---|---|---|---|---|
| `customer_account` | string | ✓ | `Customer Account` | Account name |
| `opportunity_name` | string | ✓ | `Opportunity Name` | Deal name — also ICB join key |
| `stage` | string | ✓ | `Stage` | Sales stage (normalized) |
| `stage_group` | string | | `Stage Group` | Stage grouping |
| `amount` | number | ✓ | `Total MRR & MAR (converted)` | Monthly recurring revenue — NOT annualized |
| `close_date` | date | ✓ | `Close Date` | Expected or actual close date |
| `rep` | string | | `Opportunity Owner` | Deal owner |
| `account_owner` | string | | `Account Owner` | Account-level owner |
| `deal_status` | string | ✓ | *(derived)* | `Open` / `Won` / `Lost` |
| `deal_type` | string | | `Type` | New Service, Renewal, Upgrade |
| `product_group` | string | | `Product Group` | Canonical product classification |
| `vertical` | string | | `Vertical` | Vertical sub-level |
| `industry` | string | | `Industry` | Granular industry |
| `customer_type` | string | | `Customer Type` | Customer classification |
| `term_months` | integer | | `Term in Months` | Contract term |
| `npv` | number | | `NPV (converted)` | Net present value |
| `sales_channel` | string | | `Account : Account Owner : Sales Channel` | Channel |
| `opportunity_id` | string | | `Opportunity ID` or `Opportunity_Id` | SF record ID |
| `reporting_business_group` | string | | `Reporting Business Group` | Higher-level product rollup |
| `reporting_segment` | string | | `Reporting Segement` | *(note: SF typo "Segement")* |
| `workflow_type` | string | | `Opportunity Workflow Type` | Custom Solution, Standard |
| `business_unit_owner` | string | | `Business Unit Owner` | BU ownership |
| `major_project` | string | | `Major Project Name` | Project name |

### Funnel + Historical Only

| Canonical Field | Type | Salesforce Header |
|---|---|---|
| `created_date` | date | `Created Date` |
| `close_month` | string | `Close Month` |
| `forecast_category` | string | `Forecast Category` |
| `mega_vertical` | string | `Mega Vertical Grouping` |
| `total_contract_value` | number | `Total Contract Value (converted)` |
| `sales_funnel_manager` | string | `Account : Account Owner : Sales Funnel Manager` |
| `next_step` | string | `Next Step` |
| `rep_notes` | string | `Customer or Rep Notes` |
| `why_now` | string | `Why now?` |
| `why_need` | string | `Why the need?` |
| `why_zayo` | string | `Why Zayo?` |

### Close Lost Only

| Canonical Field | Type | Salesforce Header |
|---|---|---|
| `date_closed_lost` | date | `Date Closed Lost` |
| `product_category` | string | `Product Category` |
| `product_family` | string | `Product Family` |
| `partner` | string | `Agent/Partner/Alliance` |
| `order_stage` | string | `Order Stage` |
| `legacy_opportunity_id` | string | `Legacy Opportunity Id` |

### Stage Win Probabilities (2026 Funnel Model)

| Stage | Win Probability |
|---|---|
| `Discover` | 30.57% |
| `Design Solution` | 53.21% |
| `Propose` | 66.23% |
| `Negotiate` | 84.67% |
| `Verbal Agreement` | 92.49% |

---

## Table: Engagements

Source: `engagement_2026a.csv` (SalesLoft, ~10,117 rows)

| Canonical Field | Type | Req | SalesLoft Header | Description |
|---|---|---|---|---|
| `customer_account` | string | ✓ | `Company / Account` | Account name (resolved via hierarchy) |
| `date` | date | ✓ | `Date` | Engagement date |
| `type` | string | ✓ | `SalesLoft Type` | Normalized to Email / Call / Meeting |
| `rep` | string | | `Assigned` | Engagement performer |
| `subject` | string | | `Subject` | Activity subject line |
| `contact` | string | | `Contact` | Contact name |
| `account_id` | string | | `Account ID` | SF record ID (NOT the join key) |

### Engagement Type Normalization

| Canonical Type | Accepted Variants |
|---|---|
| `Email` | email, e-mail, email sent, email received, email - outbound/inbound, outbound/inbound email, message, correspondence |
| `Call` | call, phone, phone call, call - outbound/inbound, outbound/inbound call, voicemail, telephone, dial |
| `Meeting` | meeting, meeting - in person/virtual, virtual meeting, in-person meeting, video call, zoom, teams meeting, webex, demo, presentation, site visit, onsite, on-site, face to face, f2f, in person |

---

## Table: Quotes

Source: `quotes.csv` (14 columns, 4,950 rows)

| Canonical Field | Type | Req | Salesforce Header | Description |
|---|---|---|---|---|
| `customer_account` | string | ✓ | `Account: Customer Account` | Account name |
| `quote_date` | date | ✓ | `Quotes: Created Date` | When quote was created |
| `product_group` | string | | `Product` | Product quoted |
| `quote_product_group` | string | | `Product Group` | Higher-level product grouping |
| `rep` | string | | `Quotes: Owner Name` | Quote owner |
| `quote_name` | string | | `Quotes: Quote Name` | Quote identifier |
| `opportunity` | string | | `Opportunity` | Related opportunity name |
| `account_owner` | string | | `Account: Account Owner` | Account-level owner |
| `quote_status` | string | | `Quote Status` | Approved, Draft, etc. |
| `sales_channel` | string | | `Account: Owner's Sales Channel` | Sales channel |
| `created_by` | string | | `Quotes: Created By` | Creator |
| `bandwidth` | string | | `Bandwidth` | Bandwidth tier |
| `account_name` | string | | `Account: Account Name` | Fallback account name |

---

## Table: Services

Source: `services.csv` (14 columns, 10,986 rows)

| Canonical Field | Type | Req | Salesforce Header | Description |
|---|---|---|---|---|
| `customer_account` | string | ✓ | `Account: Customer Account` | Account name |
| `service_mrr` | number | ✓ | `MRR (converted)` | Monthly recurring revenue for this service |
| `service_name` | string | ✓ | `Service Name` | Specific service identifier |
| `product_group` | string | | `Product Group` | Canonical product classification |
| `contract_end` | date | | `Current Expiration Date` | Contract expiration |
| `disconnect_date` | date | | `Disconnect Date` | When service was disconnected |
| `expiration_period` | string | | `Expiration Period` | Expiration bucket |
| `rep` | string | | `Account: Account Owner: Full Name` | Account owner |
| `sales_channel` | string | | `Account: Owner's Sales Channel` | Sales channel |
| `bandwidth` | string | | `Bandwidth` | Bandwidth tier |
| `partner_name` | string | | `Agent/Partner/Alliance: Account Name` | Partner |
| `partner_contact` | string | | `Agent/Partner/Alliance Contact: Full Name` | Partner contact |
| `reporting_business_group` | string | | `Reporting Business Group` | Higher-level product rollup |

---

## Table: ICB (Enrichment on Deals)

Source: `ICB.csv` (17 columns, 31 rows). Joins to Deals via `opportunity_name`.

| Canonical Field | Type | Salesforce Header | Description |
|---|---|---|---|
| `opportunity_name` | string | `Opportunity Name` | **Join key** to Deals |
| `icb_category` | string | `ICB Category` | Pricing category |
| `icb_id` | string | `Special Pricing / ICB ID` | ICB record ID |
| `icb_number` | string | `Special Pricing/ICB Number` | Reference number |
| `icb_status` | string | `Status` (col 6) | Request status |
| `icb_approval_status` | string | `Status` (col 16) | Approval status |
| `icb_age` | number | `ICB Age` | Days since created |
| `icb_review_time` | number | `ICB SE Review Time` | Days for SE review |
| `se_review_date` | date | `Date SE Review` | SE review date |
| `se_assignment_date` | date | `SE Assignment Date` | SE assignment date |
| `solution_engineer` | string | `Solution Engineer: Full Name` | Assigned SE |
| `cor_form_name` | string | `Cor Form Name` | COR form reference |
| `rep` | string | `Opportunity Owner: Full Name` | Opp owner |
| `stage` | string | `Stage` | Deal stage at ICB time |
| `created_date` | date | `Created Date` | ICB creation date |
| `sales_channel` | string | `Sales Channel` | Channel |

**Note:** Duplicate `Status` headers at positions 6 and 16. Handle by column position during import.

---

# Revenue Concepts — Three Distinct Fields

| Canonical Field | Table | SF Header | Meaning |
|---|---|---|---|
| `total_brr` | Customers | `Account Global Region : Account : Total BRR` | Account-level monthly revenue |
| `amount` | Deals | `Total MRR & MAR (converted)` | Single deal monthly MRR — NOT annualized |
| `service_mrr` | Services | `MRR (converted)` | Single service line monthly revenue |
| `total_contract_value` | Deals | `Total Contract Value (converted)` | Total contract value |
| `npv` | Deals | `NPV (converted)` | Net present value |

---

# Deprecated Names — Do Not Use

| Deprecated | Use Instead | Why |
|---|---|---|
| `accountName` | `customer_account` | JS camelCase — use snake_case |
| `account_name` | `customer_account` | Ambiguous with hierarchy child_name |
| `sales_owner` | `rep` | Legacy SF label |
| `rep_name` | `rep` | Redundant suffix |
| `segment` | `mega_vertical` | Different CRM concept |
| `deal_value` | `amount` | Not canonical |
| `close` | `close_date` | Too terse |
| `name` | *(context-specific)* | Ambiguous |
| `mrr` (unqualified) | `total_brr` / `amount` / `service_mrr` | Must specify domain |
| `arr` (in code) | `total_brr` | CSV alias only |

---

# Cross-File Concept Map

### Account Name (→ `customer_account`)

| File | Header |
|---|---|
| customers.csv | `Account Global Region : Account : Customer Account` |
| Hierarchy.csv | `Customer Account` (PARENT name) |
| Hierarchy.csv | `Account Name` (CHILD name → `child_name`) |
| funnel / historical | `Customer Account` |
| close_lost.csv | `Customer Account` |
| engagement_2026a.csv | `Company / Account` |
| quotes.csv | `Account: Customer Account` |
| services.csv | `Account: Customer Account` |

### Sales Rep (→ `rep`)

| File | Header |
|---|---|
| customers.csv | `Sales Owner` |
| Hierarchy.csv | `Account Owner: Full Name` |
| funnel / historical / close_lost | `Opportunity Owner` |
| engagement_2026a.csv | `Assigned` |
| quotes.csv | `Quotes: Owner Name` |
| services.csv | `Account: Account Owner: Full Name` |
| ICB.csv | `Opportunity Owner: Full Name` |

### Product (→ `product_group`)

| File | Header | Notes |
|---|---|---|
| funnel / historical / close_lost | `Product Group` | Canonical |
| quotes.csv | `Product` | Maps to product_group |
| services.csv | `Product Group` | Matches deals |
| services.csv | `Service Name` | Specific service → `service_name` |

### Sales Channel (→ `sales_channel`)

| File | Header |
|---|---|
| customers.csv | `Account Global Region : Sales Owner : Sales Channel` |
| Hierarchy.csv | `Account Owner: Sales Channel (Vertical)` |
| funnel / historical / close_lost | `Account : Account Owner : Sales Channel` |
| quotes.csv | `Account: Owner's Sales Channel` |
| services.csv | `Account: Owner's Sales Channel` |
| ICB.csv | `Sales Channel` |

---

# Date Normalization

All date fields auto-normalize to `YYYY-MM-DD`. Handles: `M/D/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`, `YYYY/MM/DD`, `M-D-YYYY`, native Date-parseable strings.

Applies to: `date`, `close_date`, `created_date`, `date_closed_lost`, `quote_date`, `contract_end`, `disconnect_date`, `se_review_date`, `se_assignment_date`, `close_month`.

---

# Ingestion Workflow

### Step 1: Detect the Table

| Signal in Headers | → Table |
|---|---|
| `SalesLoft Type` / `Company / Account` / `Assigned` | Engagements |
| `Stage` + `Opportunity Name` + `Total MRR & MAR` | Deals |
| `Quote Status` / `Quotes: Created Date` | Quotes |
| `Account Name` + `Account ID` + `Customer Account` (all 3) | Hierarchy |
| `Service Name` / `MRR (converted)` / `Disconnect Date` | Services |
| `ICB Category` / `Special Pricing` / `ICB Age` | ICB |
| `Mega Vertical Grouping` / `Total BRR` (no stage/opp cols) | Customers |

For Deals, detect `deal_status`:
- Has `Date Closed Lost` → `Lost`
- Has `Forecast Category` but no `Date Closed Lost` → check stages for "Closed Won" → `Won`, else → `Open`

### Step 2: Auto-Map Columns

Match CSV headers against the exact Salesforce headers in each table schema above.

### Step 3: Account Resolution

Hierarchy FIRST → Direct match → Fuzzy → Unresolved.

### Step 4: Normalize & Coerce

| Rule | Fields |
|---|---|
| Date normalization | All date fields |
| Engagement type → Email/Call/Meeting | `type` in Engagements |
| Stage normalization | `stage` in Deals |
| Strip $, commas → parseFloat | `amount`, `total_brr`, `service_mrr`, `npv`, `total_contract_value` |
| Strip non-numeric → parseInt | `term_months`, `icb_age`, `icb_review_time` |

### Step 5: Validate & Report

Show: rows imported, rows dropped, account resolution tier counts, unmatched accounts, type normalization failures, date parse failures.
