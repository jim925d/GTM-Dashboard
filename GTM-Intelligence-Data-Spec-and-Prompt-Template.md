# GTM Intelligence Engine — Data Specification & Prompt Template

## Overview

This document gives you everything you need to take your Salesforce report exports and turn them into a fully functional GTM Intelligence Engine. It covers:

1. **Which Salesforce reports to pull** (and how to structure them)
2. **The 6 data tables** the engine needs
3. **How to format each table** for pasting into the prompt
4. **The complete prompt template** with placeholders for your data
5. **Field mapping reference** — what each field powers in the app

---

## Step 1: Salesforce Reports to Pull

You need 6 exports. Each maps to a data table the engine consumes. Here's exactly what to pull:

### Report 1: Account Master
**SF Report Type:** Accounts with Custom Fields
**Key Fields to Include:**

| Column | SF Field | Example | Required |
|--------|----------|---------|----------|
| account_id | Account ID (18-char) | 001Xx000003ABCD | Yes |
| account_name | Account Name | Meridian Health Systems | Yes |
| industry | Industry | Healthcare | Yes |
| tier | Account Tier / Segment | Strategic, Growth, Win-Back | Yes |
| mrr | MRR (custom field) | 4200 | Yes |
| contract_end | Contract End Date | 2025-09-30 | Yes |
| account_manager | Account Owner | Your Name | No |
| parent_account | Parent Account Name | (if hierarchy exists) | No |

### Report 2: Locations / Sites
**SF Report Type:** Account Locations (custom object) or Service Addresses
**Key Fields:**

| Column | SF Field | Example | Required |
|--------|----------|---------|----------|
| account_id | Parent Account ID | 001Xx000003ABCD | Yes |
| address | Service Address | 450 Medical Center Dr, Chicago IL | Yes |
| net_status | Building Status | on-net, near-net, off-net | Yes |
| site_type | Location Type | HQ, Branch, Data Center | No |

### Report 3: Current Products
**SF Report Type:** Assets or Active Subscriptions
**Key Fields:**

| Column | SF Field | Example | Required |
|--------|----------|---------|----------|
| account_id | Account ID | 001Xx000003ABCD | Yes |
| product_name | Product Name | SD-WAN Managed | Yes |
| product_category | Product Family | Network, Security, Voice | No |
| mrr | Monthly Recurring | 1200 | No |
| install_date | Start Date | 2024-03-15 | No |

### Report 4: Quotes / Pipeline
**SF Report Type:** Opportunities with Products
**Key Fields:**

| Column | SF Field | Example | Required |
|--------|----------|---------|----------|
| account_id | Account ID | 001Xx000003ABCD | Yes |
| product_name | Product Name | SD-WAN Managed | Yes |
| quoted_mrr | MRR Amount | 3600 | Yes |
| quote_date | Created Date | 2024-11-20 | Yes |
| status | Stage / Status | pending, stalled, pending-board, closed-lost | Yes |
| close_date | Expected Close | 2025-03-15 | No |
| notes | Description / Next Steps | CTO favorable, procurement not engaged | No |

### Report 5: Contacts
**SF Report Type:** Contacts on Accounts
**Key Fields:**

| Column | SF Field | Example | Required |
|--------|----------|---------|----------|
| account_id | Account ID | 001Xx000003ABCD | Yes |
| contact_name | Full Name | Dr. Sarah Chen | Yes |
| title | Title | CTO | Yes |
| engagement_level | Engagement (custom) | champion, engaged, cooling, cold | Yes |
| email | Email | schen@meridian.com | No |
| last_touch | Last Activity Date | 2025-02-15 | No |

**Note on engagement_level:** If you don't have this as a custom field, you can manually assign it based on your knowledge of each contact. The categories are:
- **champion** — actively advocates for you internally
- **engaged** — responds consistently, positive relationship
- **cooling** — was engaged but becoming less responsive
- **cold** — no meaningful interaction, or new/unknown contact

### Report 6: Engagement / Activity History
**SF Report Type:** Activities (Tasks + Events) on Accounts
**Key Fields:**

| Column | SF Field | Example | Required |
|--------|----------|---------|----------|
| account_id | Account ID | 001Xx000003ABCD | Yes |
| date | Activity Date | 2025-02-15 | Yes |
| type | Activity Type | QBR, Call, Email, Quote Sent, Support Ticket, Event, Churn Event | Yes |
| notes | Description / Comments | Discussed network modernization. CTO interested in SD-WAN. | Yes |

### Report 7: Product Catalog (Your Sellable Products)
**Not from a report** — this is your product catalog with selling signals.

| Column | Example | Required |
|--------|---------|----------|
| product_name | SD-WAN Managed | Yes |
| category | Network | Yes |
| mrr | 1200 | Yes |
| description | Software-defined WAN with managed routing and optimization | Yes |
| fit_signals | multiple locations, bandwidth, MPLS, network modernization | Yes |

**fit_signals** are keywords that, when found in a customer's engagement history, industry, or prior services, indicate this product is relevant to them. List 3-6 per product.

### Optional: Prior/Churned Services
If you track churned services, include them. Otherwise, note them manually per account.

| Column | Example | Required |
|--------|---------|----------|
| account_id | 001Xx000003ABCD | Yes |
| service_description | MPLS Network (churned 2023) | Yes |

---

## Step 2: Format Your Data as Paste-Ready Tables

Once you have your exports, format each as a simple table. You can use either **CSV format** or **pipe-delimited tables**. The prompt accepts both.

### CSV Format Example:
```
account_id,account_name,industry,tier,mrr,contract_end
001Xx000003ABCD,Meridian Health Systems,Healthcare,Growth,4200,2025-09-30
001Xx000003EFGH,Atlas Manufacturing,Manufacturing,Win-Back,950,2025-06-15
```

### Pipe Table Format Example:
```
account_id | account_name | industry | tier | mrr | contract_end
001Xx000003ABCD | Meridian Health Systems | Healthcare | Growth | 4200 | 2025-09-30
001Xx000003EFGH | Atlas Manufacturing | Manufacturing | Win-Back | 950 | 2025-06-15
```

**Tips for clean data:**
- Remove any commas inside field values (or wrap in quotes for CSV)
- Keep notes/descriptions concise — 1-2 sentences max
- Use consistent date format: YYYY-MM-DD
- Use consistent product names across all tables
- Use consistent account_id across all tables (this is how they join)
- If you have more than ~30 accounts, prioritize the top 30 by MRR or strategic importance

---

## Step 3: The Prompt Template

Copy everything below the line, replace the `[PASTE TABLE X]` placeholders with your actual data, and send it to Claude.

---

## ✂️ — COPY FROM HERE — ✂️

```
Build me an AI-Powered Sales GTM Intelligence Engine as an interactive React application. This is a sales rep's command center where AI analyzes my entire book of business holistically — reading engagement notes for sentiment, competitive threats, and buying signals — then tells me exactly how to engage each account, what to sell, and generates ready-to-send personalized outreach.

CRITICAL: The AI does the analysis, not rules. Use the Claude API (claude-sonnet-4-20250514 model, POST to https://api.anthropic.com/v1/messages, no API key needed) to analyze each account. AI should read between the lines of engagement notes to detect sentiment, urgency, competitive dynamics, organizational politics, and timing. Product recommendations should be based on genuine business need understanding, not keyword matching.

The app should have three main views:

1. DAILY BRIEFING — KPI summary (total MRR, pipeline, avg score, urgent count), top priority accounts, open pipeline, and an AI Insights section. Include a prominent "✨ Analyze All Accounts" button that batch-runs AI analysis across all accounts (2 concurrent, with progress indicator).

2. ENGAGEMENT HUB — The core feature. For each account, AI determines:
   - Opportunity type (close-deal, advance-quote, cross-sell, win-back, renewal, save-account, re-engage, expand-footprint)
   - Customer sentiment (positive, neutral, at-risk, critical) with detail
   - Confidence level and timeframe
   - Competitive intelligence
   - Contact strategy (who to target, how to approach them, multi-threading needs)
   - Product recommendations with specific fit reasoning (not generic)
   - Risks and landmines to avoid
   - READY-TO-SEND email with personalized subject line and body referencing specific details from their engagement history
   - Call opener script — exact words for the first 15 seconds
   - 90-day MRR target with rationale
   Filters: All, 30+ Day Gap, At-Risk, AI Analyzed
   Each card expands to show full AI strategy + outreach with Copy buttons
   Accounts can be analyzed individually or in batch

3. ACCOUNT DETAIL — Click any account for deep-dive with:
   - AI-scored opportunity score with reasoning
   - Sentiment indicator and detail
   - MRR breakdown (current, quoted, AI-identified opportunity)
   - AI Strategy panel with: this week's action, talking points, things to avoid, competitive intel, contact strategy, ready-to-send email + call script, product recommendations with fit reasoning, 90-day target
   - Tabbed views: Overview (products + locations), Timeline, Contacts (with AI contact strategy), Products (quotes + AI recommendations)

AI ANALYSIS APPROACH:
For each account, send ALL available data to the AI in a single prompt:
- Account details (name, industry, tier, MRR, contract end)
- All locations with net status
- Current products owned
- Open quotes with status and dates
- Prior/churned services
- All contacts with engagement levels and last touch dates
- Full engagement history with notes
- Available product catalog (products not yet owned/quoted)

The AI should holistically analyze:
- Buying signals (explicit and implicit) in engagement notes
- Customer emotional state and satisfaction level
- Competitive threats and urgency
- Organizational dynamics (champion vs. blocker, procurement involvement)
- Timing factors (fiscal years, contract dates, budget cycles)
- Which products genuinely fit based on real business need
- Risk factors that could derail opportunities
- The single most important action for this week

Use a quick deterministic pre-score for initial render speed, then AI enriches on-demand. Show "AI" badges on accounts that have been analyzed. Show skeleton/loading states during analysis.

DESIGN:
- Dark theme, premium dashboard aesthetic
- DM Sans + JetBrains Mono fonts
- Sidebar with navigation + account list sorted by score, AI badges
- Color-coded scores (green 70+, yellow 45-69, red <45)
- Sentiment dots (green=positive, blue=neutral, yellow=at-risk, red=critical)
- AI-enriched cards get a subtle blue border glow
- Expandable cards with smooth animations
- Copy buttons with "✓ Copied" feedback
- Progress indicator during batch analysis

Below is my actual data. Use it to populate the application.

=== PRODUCT CATALOG ===
[PASTE YOUR PRODUCT CATALOG HERE]

Example format:
product_name | category | mrr | description | fit_signals
SD-WAN Managed | Network | 1200 | Software-defined WAN with managed routing | multiple locations, bandwidth, MPLS, network modernization


=== ACCOUNTS ===
[PASTE YOUR ACCOUNTS TABLE HERE]

Example format:
account_id | account_name | industry | tier | mrr | contract_end
001 | Meridian Health | Healthcare | Growth | 4200 | 2025-09-30


=== LOCATIONS ===
[PASTE YOUR LOCATIONS TABLE HERE]

Example format:
account_id | address | net_status
001 | 450 Medical Center Dr, Chicago IL | on-net


=== CURRENT PRODUCTS ===
[PASTE YOUR CURRENT PRODUCTS TABLE HERE]

Example format:
account_id | product_name | mrr
001 | Dedicated Internet | 950


=== QUOTES / PIPELINE ===
[PASTE YOUR QUOTES TABLE HERE]

Example format:
account_id | product_name | quoted_mrr | quote_date | status | notes
001 | SD-WAN Managed | 3600 | 2024-11-20 | pending | CTO favorable


=== CONTACTS ===
[PASTE YOUR CONTACTS TABLE HERE]

Example format:
account_id | contact_name | title | engagement_level | email | last_touch
001 | Dr. Sarah Chen | CTO | champion | schen@meridian.com | 2025-02-15


=== ENGAGEMENT HISTORY ===
[PASTE YOUR ENGAGEMENT HISTORY TABLE HERE]

Example format:
account_id | date | type | notes
001 | 2025-02-15 | QBR | Discussed network modernization. CTO interested in SD-WAN.


=== PRIOR / CHURNED SERVICES (if applicable) ===
[PASTE YOUR CHURNED SERVICES TABLE HERE]

Example format:
account_id | service_description
001 | MPLS Network (churned 2023)
```

## ✂️ — END COPY — ✂️

---

## Field Mapping Reference: What Powers What

This section explains exactly how each data point flows into the analysis and outreach engine, so you know which fields matter most.

### Opportunity Score (0-100)

| Data Source | What It Powers | Points |
|-------------|---------------|--------|
| Engagement dates | Recency scoring — recent = higher | 5-20 pts |
| Open quotes | Each quote adds priority | 15 pts each |
| Quote status | "stalled" triggers urgent action | +urgency |
| Locations (on/near-net) | Expansion potential | 5-8 pts each |
| Products owned vs. catalog | Whitespace = cross-sell room | 4-10 pts per fit |
| Contact engagement levels | Champions = deal velocity | 10 pts each |
| Prior/churned services | Win-back signal | 5 pts |
| Contract end date | Renewal urgency if <90 days | 8 pts |

### Engagement Hub Prioritization

| Signal | Priority Impact |
|--------|----------------|
| Stalled quote exists | Highest base priority (90-100) |
| 30+ day engagement gap | +25 to any account |
| 60+ day engagement gap | +45 to any account |
| Pending-board quote | High priority (80) |
| Strong product fit match | Medium (60) |
| Contract <120 days | Medium-high (70) |
| Win-back opportunity | Medium (50) |

### Outreach Personalization

| Data Point | How It's Used in Outreach |
|------------|--------------------------|
| Engagement notes | Referenced directly — "you mentioned X in our last conversation" |
| Quote details (product, MRR, date) | "Circling back on the SD-WAN proposal from November" |
| Contact name + title | Personalized greeting, role-appropriate framing |
| Prior churn reason | "I know budget was a factor — we've restructured pricing" |
| Product fit signals | "Given your multi-site footprint, SD-WAN is a strong fit" |
| Last engagement type | Determines channel — if email failed, suggests call |
| Industry | Industry-specific talking points and compliance references |
| Location net status | "Your Naperville site is near-net — fast deployment timeline" |

### Product Fit Matching

The engine matches each product's `fit_signals` against the combined text of:
- All engagement notes
- Prior/churned services
- Account industry

**Strong fit** = 2+ signal matches → shown as recommendation
**Moderate fit** = 1 signal match → shown as secondary option

This is why your engagement notes are so important — the richer and more specific they are, the better the product matching works.

---

## Tips for Best Results

1. **Engagement notes are the highest-leverage field.** The more specific your notes are, the more personalized the outreach and the more accurate the product fit analysis. "Had a call" is useless. "CTO concerned about ransomware, wants to evaluate managed firewall for all 5 locations" is gold.

2. **Start with your top 20-30 accounts.** The prompt has practical limits. Prioritize accounts where you have the most data and the highest potential.

3. **Keep product fit_signals specific.** Generic signals like "technology" match everything and help nothing. Use signals that actually appear in customer conversations: "MPLS", "bandwidth complaints", "HIPAA compliance", "cloud migration".

4. **Refresh monthly.** Pull fresh exports and rebuild. The engagement gap analysis only works with current data.

5. **The AI buttons call Claude's API.** They generate hyper-personalized outreach that goes beyond the template-based auto-generation. Use these for your highest-priority accounts.

6. **Account_id is the join key.** Make sure it's consistent across ALL tables. One typo breaks the data linkage for that account.
