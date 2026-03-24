# RevOS GTM Platform — Schema Reference

Last updated: 2026-03-20
Built from: 9 actual Salesforce/SalesLoft CSV exports (95,735 total rows)

This file supplements SKILL.md with complete alias lists for auto-mapping and engine I/O schemas.

## Table of Contents

1. [Complete Alias Lists](#complete-alias-lists)
2. [Stage Name Map](#stage-name-map)
3. [Mega Vertical Map](#mega-vertical-map)
4. [Prediction Engine Schema](#prediction-engine-schema)
5. [Backtest Engine Schema](#backtest-engine-schema)
6. [Game Theory Engine Schema](#game-theory-engine-schema)

---

## Complete Alias Lists

For each canonical field, the FIRST alias is the exact Salesforce/SalesLoft header. The rest are generic CRM aliases for HubSpot, Outreach, and other exports.

### customer_account

Exact SF headers: `Account Global Region : Account : Customer Account`, `Customer Account`, `Company / Account`, `Account: Customer Account`

All aliases: `account global region : account : customer account`, `customer account`, `company / account`, `company/account`, `account: customer account`, `account name`, `account.name`, `customer name`, `company`, `company name`, `account`, `name`

### child_name

Exact SF header: `Account Name`

All aliases: `account name`, `child name`, `child`, `child account`, `subsidiary`, `division`, `sub-account`, `billing name`, `location name`, `site name`

### child_id

Exact SF header: `Account ID`

All aliases: `account id`, `accountid`, `child id`, `child_id`, `account record id`, `sf id`, `salesforce id`, `record id`, `billing account number`

### parent_name

Exact SF header: `Customer Account` (in Hierarchy context)

All aliases: `customer account`, `parent name`, `parent`, `parent account`, `master account`, `headquarters`, `hq`, `parent company`, `customer name`, `canonical name`

### rep

Exact SF headers: `Sales Owner`, `Opportunity Owner`, `Assigned`, `Quotes: Owner Name`, `Account: Account Owner: Full Name`, `Account Owner: Full Name`, `Opportunity Owner: Full Name`

All aliases: `sales owner`, `opportunity owner`, `assigned`, `quotes: owner name`, `account: account owner: full name`, `account owner: full name`, `opportunity owner: full name`, `rep`, `owner`, `owner.name`, `sales rep`, `account owner`, `rep name`, `owner name`, `assigned to`, `salesperson`, `user`, `created by`

### mega_vertical

Exact SF header: `Account Global Region : Account : Mega Vertical Grouping`, `Mega Vertical Grouping`

All aliases: `account global region : account : mega vertical grouping`, `mega vertical grouping`, `mega vertical`, `mega_vertical`

### vertical

Exact SF headers: `Account Global Region : Account : Vertical`, `Vertical`

All aliases: `account global region : account : vertical`, `vertical`, `sub-vertical`

### industry

Exact SF header: `Industry`

All aliases: `industry`, `sector`

### total_brr

Exact SF header: `Account Global Region : Account : Total BRR`

All aliases: `account global region : account : total brr`, `total brr`, `total_brr`, `brr`, `arr`, `annual revenue`, `annual recurring revenue`, `revenue`

### amount

Exact SF header: `Total MRR & MAR (converted)`

All aliases: `total mrr & mar (converted)`, `amount`, `deal amount`, `value`, `total`, `mrr`, `tcv`, `deal value`, `revenue`, `opp amount`, `npv (converted)`

### total_contract_value

Exact SF header: `Total Contract Value (converted)`

All aliases: `total contract value (converted)`, `total contract value`, `tcv`, `contract value`

### npv

Exact SF header: `NPV (converted)`

All aliases: `npv (converted)`, `npv`, `net present value`

### service_mrr

Exact SF header: `MRR (converted)`

All aliases: `mrr (converted)`, `mrr`, `service_mrr`, `monthly revenue`, `monthly recurring revenue`, `monthly amount`, `revenue`, `price`, `rate`

### opportunity_name

Exact SF header: `Opportunity Name`

All aliases: `opportunity name`, `opp name`, `deal name`, `dealname`, `opportunity`, `deal`

### stage

Exact SF header: `Stage`

All aliases: `stage`, `stagename`, `stage name`, `dealstage`, `pipeline stage`, `sales stage`, `phase`, `stage group`

### close_date

Exact SF header: `Close Date`

All aliases: `close date`, `closedate`, `expected close`, `close_date`, `expected close date`, `target close`, `close month`

### created_date

Exact SF header: `Created Date`

All aliases: `created date`, `createddate`, `createdate`, `open date`, `created`, `date opened`

### date_closed_lost

Exact SF header: `Date Closed Lost`

All aliases: `date closed lost`, `date_closed_lost`, `lost date`, `closed lost date`

### date (Engagements)

Exact SF header: `Date`

All aliases: `date`, `activity date`, `event date`, `timestamp`, `created date`, `createdate`, `activity_date`, `engagement date`, `interaction date`

### type (Engagements)

Exact SF header: `SalesLoft Type`

All aliases: `salesloft type`, `type`, `activity type`, `event type`, `engagement type`, `task type`, `activity`, `engagement`, `interaction type`, `channel`

### quote_date

Exact SF header: `Quotes: Created Date`

All aliases: `quotes: created date`, `quote date`, `date`, `created date`, `createdate`, `quote_date`, `created`, `date created`

### product_group

Exact SF headers: `Product Group`, `Product` (in quotes context)

All aliases: `product group`, `product`, `product name`, `service`, `service name`, `item`, `sku`, `product type`, `offering`

### service_name

Exact SF header: `Service Name`

All aliases: `service name`, `service_name`, `service id`, `circuit id`, `service identifier`

### contract_end

Exact SF header: `Current Expiration Date`

All aliases: `current expiration date`, `contract end`, `contract end date`, `contract_end`, `expiration date`, `renewal date`, `term end`

### disconnect_date

Exact SF header: `Disconnect Date`

All aliases: `disconnect date`, `disconnect_date`, `disconnected`, `disconnect`

### term_months

Exact SF header: `Term in Months`

All aliases: `term in months`, `term`, `term months`, `term_months`, `contract term`, `duration`, `contract length`, `months`

### sales_channel

Exact SF headers: `Account Global Region : Sales Owner : Sales Channel`, `Account : Account Owner : Sales Channel`, `Account: Owner's Sales Channel`, `Account Owner: Sales Channel (Vertical)`, `Sales Channel`

All aliases: `sales channel`, `channel`, `sales_channel`, `owner's sales channel`

### bandwidth

Exact SF header: `Bandwidth`

All aliases: `bandwidth`, `bw`, `speed`, `circuit bandwidth`

### deal_type

Exact SF header: `Type` (in deal context)

All aliases: `type`, `deal type`, `opportunity type`, `deal_type`

### forecast_category

Exact SF header: `Forecast Category`

All aliases: `forecast category`, `forecast`, `forecast_category`

---

## Stage Name Map

| Canonical Stage | Win Probability | Salesforce Variants | HubSpot Variants | Other Variants |
|---|---|---|---|---|
| `Discover` | 30.57% | Discovery, Qualification, Prospecting | qualifiedtobuy, appointmentscheduled | Initial Contact, Qual, Research, Prospect, New |
| `Design Solution` | 53.21% | Needs Analysis, Value Proposition | decisionmakerboughtin | Needs Assessment, Scoping, Requirements, Solution Design |
| `Propose` | 66.23% | Proposal, Proposal/Price Quote, Quote | presentationscheduled, contractsent | RFP, Quote Sent, Proposal Sent |
| `Negotiate` | 84.67% | Negotiation, Negotiation/Review | — | Contract Review, Legal Review, Pricing, Final Review |
| `Verbal Agreement` | 92.49% | Closed Won (verbal), Commit | — | Verbal, Handshake, Committed, Won - Pending |

---

## Mega Vertical Map

| Canonical Mega Vertical | Variants |
|---|---|
| `Finance` | finance, financial, financial services, banking, insurance, fintech |
| `Media & Internet` | media, internet, media & internet, digital media, publishing, broadcasting |
| `Software & Tech` | software, tech, software & tech, technology, SaaS, IT |
| `Data Centers` | data center, data centers, colocation, colo, hosting, cloud infrastructure |
| `Business & Consumer Services` | business services, consumer services, professional services, consulting |
| `Carrier` | carrier, telecom, telecommunications, telco, wireless carrier, ISP, MSO |
| `Retail` | retail, ecommerce, e-commerce, wholesale, consumer goods |
| `Healthcare` | healthcare, health, medical, pharma, pharmaceutical, biotech, life sciences |
| `Manufacturing` | manufacturing, industrial, factory, production, assembly |
| `Transportation` | transportation, logistics, shipping, freight, supply chain, aviation |
| `Hospitality & Entertainment` | hospitality, entertainment, hotel, gaming, travel, restaurant |
| `Public Sector` | public sector, government, federal, state, local, municipal, military, defense |
| `Education` | education, university, college, school, K-12, higher ed, edtech |

---

## Prediction Engine Schema

Python FastAPI (port 8001). Consumes all seven tables.

### Input: Evidence Factors

| Factor | Source Table(s) | Fields | Measurement |
|---|---|---|---|
| `stage_timing` | Deals | `stage`, `created_date`, `close_date` | Days in stage vs historical norm |
| `product_type` | Deals, Services | `product_group` | Win rate by product category |
| `rep_performance` | Deals, Customers | `rep`, `stage`, `amount` | Rep win rate vs team avg |
| `deal_size` | Deals | `amount` | Win rate by MRR band |
| `activity_recency` | Engagements | `customer_account`, `date` | Days since last engagement |
| `purchase_cadence` | Services | `customer_account`, `product_group`, `contract_end` | Time between purchases — overdue? |
| `adoption_sequence` | Services | `customer_account`, `product_group` | Product buy order → cross-sell paths |
| `churn_signals` | Services | `disconnect_date`, `contract_end`, `service_mrr` | Disconnects, expirations |

### Output: Prediction

```json
{
  "customer_account": "string",
  "predictions": [{
    "product_group": "string",
    "prior": 0.35,
    "posterior": 0.72,
    "evidence": ["string"],
    "timing": "next_30_days | next_60_days | next_90_days | next_6_months",
    "confidence": 0.81
  }],
  "cross_sell": [{
    "product_group": "string",
    "probability": 0.45,
    "rationale": "string"
  }],
  "churn_risk": [{
    "product_group": "string",
    "risk": "high | medium | low | none",
    "signals": ["string"]
  }]
}
```

---

## Backtest Engine Schema

Replays history quarter-by-quarter.

### Snapshot (per quarter boundary)

| Field | Source | Description |
|---|---|---|
| `cutoff` | Computed | Quarter boundary date |
| `customer_account` | Customers | Account being tested |
| `total_deals_won` | Deals (Won) | Count before cutoff |
| `total_deals_lost` | Deals (Lost) | Count before cutoff |
| `total_mrr_won` | Deals (Won) | Sum of `amount` |
| `total_mrr_lost` | Deals (Lost) | Sum of `amount` |
| `active_pipeline` | Deals (Open) | Deals open at cutoff |
| `services_active` | Services | Installed before cutoff |
| `disconnects` | Services | `disconnect_date` before cutoff |
| `days_since_activity` | Engagements | Days from cutoff to last `date` |
| `velocity` | Deals | `accelerating` / `steady` / `stalled` |

### Prediction Output

| Field | Type | Values |
|---|---|---|
| `predicted_outcome` | string | `expanded`, `grew_modestly`, `stable`, `churned/contracted`, `dormant` |
| `predicted_strategy` | string | `aggressive_expand`, `strategic_nurture`, `defensive_protect`, `retention_emergency`, `winback`, `patience` |
| `churn_risk` | string | `high`, `medium`, `low`, `none` |
| `expansion_opportunity` | string | `high`, `medium`, `low`, `none` |
| `confidence` | float | 0-1 |
| `key_signals` | string[] | 3-5 signals |

---

## Game Theory Engine Schema

Fires on individual active deals.

### Input

| Source | Fields Used |
|---|---|
| Deals (the deal) | `opportunity_name`, `stage`, `amount`, `close_date`, `rep` |
| Customers | `customer_account`, `total_brr`, `mega_vertical` |
| Services | `product_group`, `service_mrr` |
| Prediction | `posterior`, `confidence` |

### Output

```json
{
  "alignment_score": 78,
  "nash_equilibrium": "string",
  "pricing_strategy": { "anchor": 5000, "target": 4200, "floor": 3500 },
  "negotiation_playbook": [{ "move": 1, "seller": "string", "expected_buyer_response": "string" }],
  "concession_playbook": [{ "if_buyer_says": "string", "respond_with": "string", "cost_to_seller": "string" }],
  "closing_signals": ["string"],
  "walk_away_triggers": ["string"]
}
```

---

## Changelog

| Date | Change |
|---|---|
| 2026-03-20 | Complete rebuild from actual CSV headers (9 files, 95K rows). Unified Deals table (funnel + historical + close_lost). ICB as enrichment. Product Group as canonical product. Three-level segmentation hierarchy. |
