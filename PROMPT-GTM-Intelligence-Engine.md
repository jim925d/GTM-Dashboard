# GTM Intelligence Engine — Prompt (fill data, then copy all below the line)

**How to use:** Replace each `[PASTE...]` section below with your Salesforce export data (CSV or pipe-delimited). Then copy **everything from the first line of the prompt through the last data table** and paste into Claude/Cursor to build the app.

Data spec and field mapping: see `GTM-Intelligence-Data-Spec-and-Prompt-Template.md`.

---

## ✂️ — COPY FROM HERE (after filling in your data) — ✂️

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
