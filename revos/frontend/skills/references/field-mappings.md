# RevOS Field Mappings
# Source of truth for column alias resolution across all data tables
# Used by: revos-csv-mapper (Mode 2), engagement-mapper (Step 2), Intelligence Readout (tab parsing)
# Last updated: 2026-03-27

All matching is **case-insensitive**. The engine field name (left column) is what the code expects. The aliases (right) are what CRM exports actually call them. When a user uploads data, the ingestion pipeline matches their column headers against these aliases to auto-map fields.

---

## Table 1: Deals / Funnel (Historical + Bookings + Pipeline)

The core deal table. Used by the Prediction Engine, Pipeline Gap, Forecast Projection, and Deal Categorization.

| Engine Field | Type | Required | Salesforce Aliases | HubSpot Aliases | Other Common Aliases |
|-------------|------|----------|-------------------|-----------------|---------------------|
| `account` | string | ✓ | Customer Account, Account Name, Account.Name | Associated Company, Company Name | Account, Customer, Customer Name, Client |
| `opportunity_name` | string | | Opportunity Name, Opportunity: Opportunity Name | Deal Name, dealname | Opp Name, Deal, Opportunity |
| `mrr` | number | ✓ | Total MRR, MRR, Monthly Recurring Revenue, Amount | Monthly Revenue, mrr, amount | MRR (converted), Monthly Amount, Contract MRR |
| `tcv` | number | | TCV, Total Contract Value, Contract Value | Total Contract Value, deal_amount | Total Value, Contract Amount |
| `stage` | string | ✓ | StageName, Stage, Opportunity Stage | Deal Stage, dealstage, Pipeline Stage | Status, Phase, Sales Stage, Opp Stage |
| `close_date` | date | ✓ | Close Date, CloseDate, Expected Close Date | Close Date, closedate | Closed Date, Expected Close, Target Close |
| `type` | string | ✓ | Type, Opportunity Type | Deal Type, dealtype | Opp Type, Record Type, Category |
| `product` | string | | Product, Product Family, Product Name | Product, Product Line | Product Group, Service, Product Type |
| `bizgroup` | string | | Business Group, BizGroup, Business Unit | — | BU, Division, Group |
| `segment` | string | | Segment, Market Segment | — | Territory, Region |
| `created` | date | | Created Date, CreatedDate | Create Date, createdate | Open Date, Opened, Date Created |
| `rep` | string | | Opportunity Owner, Owner, Owner Full Name | Deal Owner, hubspot_owner_id | Sales Rep, Rep, Account Executive, AE |
| `vertical` | string | | Vertical, Industry, Account.Industry | Industry | Market Vertical, Sector |
| `majorProject` | string | | Major Projects, Major Project | — | Project Name, Project |
| `forecast` | string | | Forecast Category, ForecastCategoryName | — | Forecast, Commit Category |

### Stage Name Aliases

The prediction engine requires exact stage names. Map incoming values:

| Engine Stage | Accepted Aliases |
|-------------|-----------------|
| Discover | Discover, Discovery, Qualification, Prospecting, Lead, MQL, SQL, Initial Contact |
| Design Solution | Design Solution, Design, Solution Design, Needs Analysis, Value Proposition, Demo |
| Propose | Propose, Proposal, Proposal Sent, Quote Sent, Pricing, RFP Response |
| Negotiate | Negotiate, Negotiation, Contract Negotiation, Legal Review, Contracting, Pending |
| Verbal Agreement | Verbal Agreement, Verbal, VA, Verbal Commit, Handshake, Pending Signature |
| Accepted | Accepted, Closed Won, Closed-Won, Won, Booked, Signed, Closed/Won |
| Close Lost | Close Lost, Closed Lost, Closed-Lost, Lost, Dead, Cancelled |

### Deal Type Aliases

Used for deal categorization (new, renewal, disconnect, etc.):

| Engine Type | Accepted Aliases |
|------------|-----------------|
| New Service | New Service, New, New Business, New Logo, New Deal, New Order |
| Positive Re-Rate | Positive Re-Rate, Upgrade, Expansion, Upsell, Add-On, Cross-Sell, Re-Rate (positive) |
| Negative Re-Rate | Negative Re-Rate, Downgrade, Reduction, Re-Rate (negative), Contraction |
| Disconnect | Disconnect, Disconnection, Cancel, Cancellation, Churn, Termination, Non-Renewal |
| Close Lost | Close Lost, Lost, Closed Lost, Dead Deal |

---

## Table 2: Services (Active service inventory)

Used by the Churn Probability Model (MTM detection, contract expiry) and Account Health.

| Engine Field | Type | Required | Salesforce Aliases | Other Common Aliases |
|-------------|------|----------|-------------------|---------------------|
| `account` | string | ✓ | Account: Customer Account, Customer Account, Account Name | Customer, Account, Client Name |
| `service_id` | string | | Service ID, Service Number | Circuit ID, Order ID, Service No |
| `product` | string | | Product, Product Family, Product Name | Service Type, Product Group, Service |
| `mrr` | number | | MRR (converted), Monthly Revenue, MRR | Service MRR, Monthly Charge, Monthly Amount |
| `service_exp` | date | | Current Expiration Date, Expiration Date, Contract End | Contract Expiry, Renewal Date, End Date, Exp Date |
| `exp_period` | string | | Expiration Period, Contract Period | Term Type, Contract Type, Billing Period |
| `bandwidth` | string | | Bandwidth, Bandwidth (Mbps) | Speed, Capacity, Circuit Speed |
| `rep` | string | | Account: Account Owner: Full Name, Account Owner | Account Manager, Rep, Global Account Manager |
| `status` | string | | Status, Service Status | Active/Inactive, State |
| `install_date` | date | | Install Date, Service Start, Activation Date | Start Date, Go-Live Date, Provisioned Date |
| `location` | string | | Location, Service Location, Site | Address, Site Name, Service Address |

### Expiration Period Values

| Engine Value | Accepted Aliases |
|-------------|-----------------|
| 1-MTM | 1-MTM, MTM, Month-to-Month, Monthly, M2M, No Contract |
| 12 | 12, 1 Year, 12 Months, Annual, 1-Year, 12-MO |
| 24 | 24, 2 Year, 24 Months, 2-Year, 24-MO |
| 36 | 36, 3 Year, 36 Months, 3-Year, 36-MO |
| 60 | 60, 5 Year, 60 Months, 5-Year, 60-MO |

**Critical:** `1-MTM` triggers the churn model's MTM exposure signal (base probability 0.35). Any service with this value has no contractual lock-in.

---

## Table 3: Engagement (Activity records)

Used by the Engagement Dashboard, Health Score (engagement decay), and Churn Model (days silent).

| Engine Field | Type | Required | Salesforce Aliases | HubSpot Aliases | Salesloft / Outreach Aliases |
|-------------|------|----------|-------------------|-----------------|------------------------------|
| `customer_account` | string | ✓ | Account Name, Account.Name, Related To | Associated Company, Company | Account, Company Name |
| `date` | date | ✓ | Activity Date, ActivityDate, Date | Activity Date, timestamp | Completed At, Date, Activity Date |
| `type` | string | ✓ | Type, Task Subtype, Activity Type | Engagement Type, type | Step Type, Activity Type, Action |
| `subject` | string | | Subject, Task Subject | Subject, title | Subject, Email Subject |
| `contact` | string | | Contact Name, Who.Name | Contact, Associated Contact | Recipient, To |
| `rep` | string | | Owner, Assigned To, Task Owner | Owner, hubspot_owner | User, Rep, Performed By |
| `direction` | string | | — | — | Direction, Inbound/Outbound |
| `notes` | string | | Description, Comments | Body, notes | Notes, Body, Description |

### Engagement Type Normalization

All activity types must resolve to one of three canonical values:

| Engine Type | Accepted Variants |
|------------|------------------|
| Email | email, e-mail, email sent, email received, email - outbound, email - inbound, outbound email, inbound email, message, correspondence |
| Call | call, phone, phone call, call - outbound, call - inbound, outbound call, inbound call, voicemail, telephone, dial |
| Meeting | meeting, meeting - in person, meeting - virtual, virtual meeting, in-person meeting, video call, zoom, teams meeting, webex, demo, presentation, site visit, onsite, on-site, face to face, f2f, in person |

---

## Table 4: Locations (Account physical footprint)

Used by the Location Intelligence Engine (footprint scoring, product affinity, geographic spread, on-net detection).

| Engine Field | Type | Required | Salesforce Aliases | Other Common Aliases |
|-------------|------|----------|-------------------|---------------------|
| `account` | string | ✓ | Customer Account, Account Name | Customer, Account, Client |
| `address` | string | | Street Address, Address, Service Address | Location Address, Street, Site Address |
| `city` | string | | City, Billing City | Metro, City/Town |
| `state` | string | | State, State/Province, Billing State | Province, Region |
| `zip` | string | | Zip, Postal Code, Zip Code | Zip/Postal, Postcode |
| `lat` | number | | Latitude, Lat | GPS Lat, Y |
| `lng` | number | | Longitude, Lng, Long | GPS Lng, X |
| `on_net` | boolean | | On Net, On-Net, OnNet, On Net Status | Lit, Connected, Serviceable, In Footprint |
| `location_type` | string | | Location Type, Site Type | Type, Facility Type |
| `mrr` | number | | Loc Attributed MRR, Location MRR | Site MRR, Location Revenue |
| `rep` | string | | Global Account Manager, Account Owner | Rep, Account Manager |

### On-Net Value Normalization

| Engine Value | Accepted Aliases |
|-------------|-----------------|
| true (on-net) | On Net, On-Net, Yes, Y, TRUE, 1, Lit, Connected, In Footprint, Serviceable, Active |
| false (off-net) | Off Net, Off-Net, No, N, FALSE, 0, Not Lit, Not Connected, Near Net, Out of Footprint |

---

## Table 5: Customers (Account master list)

Used by account resolution (all tables join on `customer_account`), Health Score, and NIB calculation.

| Engine Field | Type | Required | Salesforce Aliases | HubSpot Aliases | Other Common Aliases |
|-------------|------|----------|-------------------|-----------------|---------------------|
| `customer_account` | string | ✓ | Account Name, Account.Name | Company Name, name | Customer, Account, Client Name |
| `rep` | string | | Account Owner, Account Owner: Full Name | Owner, hubspot_owner_id | Rep, Account Manager, AE, Global Account Manager |
| `manager` | string | | Manager, Owner.Manager | — | Sales Manager, Team Lead |
| `vertical` | string | | Industry, Account.Industry | Industry | Vertical, Sector, Market Vertical |
| `segment` | string | | Segment, Territory | — | Market Segment, Territory, Region |
| `mega_vertical` | string | | Mega Vertical, Parent Vertical | — | Vertical Group |
| `total_brr` | number | | Total MRR, Account MRR, ARR | Revenue, Annual Revenue | Total Revenue, Account Revenue, BRR |

---

## Table 6: Quotes (Pricing proposals)

| Engine Field | Type | Required | Salesforce Aliases | Other Common Aliases |
|-------------|------|----------|-------------------|---------------------|
| `account` | string | ✓ | Account: Customer Account, Quote Account | Customer, Account Name |
| `quote_date` | date | ✓ | Quote Date, CreatedDate | Created, Date |
| `quote_id` | string | | Quote Number, Quote ID | ID, Quote No |
| `product` | string | | Product, Product Name | Service, Product Type |
| `mrr` | number | | MRR, Monthly Amount | Price, Monthly, Amount |
| `term` | number | | Term, Term (Months), Contract Length | Duration, Term Months |
| `rep` | string | | Quotes: Owner Name, Quote Owner | Rep, Owner |
| `status` | string | | Status, Quote Status | State, Stage |
| `opportunity` | string | | Opportunity, Related Opportunity | Deal, Opp Name |

---

## Table 7: Hierarchy (Parent/child account mapping)

Used by account name resolution (Step 3 in engagement-mapper). Maps alternate names, subsidiaries, and divisions to canonical customer names.

| Engine Field | Type | Required | Salesforce Aliases | Other Common Aliases |
|-------------|------|----------|-------------------|---------------------|
| `child_name` | string | ✓ | Child Account, Subsidiary, Account Name | Alternate Name, DBA, Alias |
| `parent_name` | string | ✓ | Parent Account, Parent, Ultimate Parent | Canonical Name, Master Account, Parent Company |

---

## Table 8: Markets (Metro/geographic definitions)

Used by the Event Context Engine (market-level modifiers) and GTM Premier (market aggregation).

| Engine Field | Type | Required | Other Common Aliases |
|-------------|------|----------|---------------------|
| `market` | string | ✓ | Market, Metro, City, MSA, Metro Area |
| `state` | string | | State, Region, State/Province |
| `lat` | number | | Latitude, Lat |
| `lng` | number | | Longitude, Lng, Long |
| `region` | string | | Region, Territory, Area |

---

## Data Type Coercion Rules

Applied after column mapping, before engine ingestion.

| Pattern | Rule |
|---------|------|
| Currency fields (`mrr`, `tcv`, `total_brr`, `amount`) | Strip `$`, `,`, whitespace → `parseFloat`. If contains `/mo` treat as monthly. Flag `$0` for disconnects (valid) vs data errors. |
| Date fields (`close_date`, `created`, `service_exp`, `date`, `quote_date`) | Normalize to `YYYY-MM-DD`. Handle: `MM/DD/YYYY`, `YYYY-MM-DD`, `M/D/YY`, `Mon DD, YYYY`, Excel serial dates. Flag ambiguous formats like `01/02/2024`. |
| Percentage fields | Detect scale: if max > 1 → already in 0-100, else multiply by 100. |
| Boolean fields (`on_net`) | Map: Yes/Y/TRUE/1/On Net → true, No/N/FALSE/0/Off Net → false. |
| Integer fields (`term`, `deals`) | Strip non-numeric → `parseInt`. |

---

## Product Name Normalization

CRM exports use inconsistent product names. Normalize to the engine's canonical names:

| Engine Product | Accepted Aliases |
|---------------|-----------------|
| Ethernet | Ethernet, Dedicated Internet, DIA, Internet Access, Broadband, Fiber Internet, EIA |
| Dark Fiber | Dark Fiber, DF, Unlit Fiber, Raw Fiber, Dark Fibre |
| Wavelengths | Wavelengths, WL, WL Metro, WL Long Haul, DWDM, Wave, Lambda, Optical Transport |
| zColo | zColo, Colocation, Colo, Co-Location, Data Center, Cage, Cabinet, Rack |
| IP Services | IP Services, IP Svc, IP Transit, BGP, Managed IP, Internet, IP |
| SD-WAN | SD-WAN, SDWAN, SD WAN, Software-Defined WAN, Managed SD-WAN |
| DDoS | DDoS, DDoS Protection, DDoS Mitigation, Anti-DDoS, Scrubbing |
| UCaaS | UCaaS, Unified Communications, UC, VoIP, Cloud Voice, Hosted PBX |
| MPLS | MPLS, MPLS VPN, Private Network, VPN |
| Managed Services | Managed Services, Managed Network, NOC, Monitoring |

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-27 | Initial generation from revos-formulas, engagement-mapper, and csv-mapper skills | Claude + Jim |
