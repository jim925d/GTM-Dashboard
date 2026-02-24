# GTM Intelligence Dashboard — Feedback Framework v1

**Source:** Initial Cursor Mockup Scrub  
**Date:** February 23, 2025

---

## VIEW 1: DAILY BRIEFING

### 1.1 KPI Bar (Top Row)

| KPI | Current State | Target State | Data Needed |
|-----|--------------|--------------|-------------|
| **Book of Business** | Shows total MRR across accounts | Total REVENUE (not just MRR) across all accounts assigned to this rep | Total billed revenue per account (SF: Account.Total_Revenue__c or sum of billing records) |
| **Pipeline** | Shows all quoted MRR | Filter to **current month only** — everything in the funnel for this month | Opportunity.CloseDate filtered to current month + Opportunity.Amount/MRR |
| **Urgent** | Shows count of high-priority actions | **Needed action items** — clearly defined as action items, not just a count | Needs definition: overdue tasks, stalled opps, upcoming renewals, unanswered outreach? |
| **Avg Score** | Composite opportunity score | **TBD — revisit scoring system** (see section 1.3 below) | Dependent on new scoring model |

**Open Questions:**
- "Book of Business" — is this total MRR, total annual revenue, or total contract value? Need to confirm which revenue metric.
- "Pipeline current month" — is this opportunities with close date in current month, or all open pipeline regardless of expected close?
- "Urgent" — need to define the specific triggers that make something an action item (e.g., quote expiring, no response in X days, contract renewal within 30d, support ticket open).

---

### 1.2 Top Accounts Section

| Element | Current State | Target State |
|---------|--------------|--------------|
| **Count** | Shows top 3 | Show **top 10 accounts** |
| **Scoring Logic** | Rule-based (engagement recency, quotes, locations, champions) | **New scoring system based on addressable spend gap** (see 1.3) |
| **Display** | Score + name + MRR + basic signal | Score + name + revenue + addressable spend gap + location coverage |

**New Scoring System (Section 1.3):**

The top 10 should be determined by a composite that weighs:

| Factor | Description | Weight (TBD) |
|--------|-------------|------|
| **White Space** | Products/services they DON'T have that they could buy — the gap between what they own and what's available for their profile | High |
| **Current Billing** | What they're currently billing with us — accounts spending more have more expansion potential | Medium |
| **Target Addressable Spend** | Total estimated IT/telecom spend for this customer vs. what they spend with us. The DIFFERENCE is the opportunity. | High |
| **Location Coverage** | How many locations are we serving vs. their total locations? (On-net/near-net serviced vs. total sites) | Medium |

**Formula concept:**
```
Top Account Score = f(
  Target Addressable Spend − Current Spend with Us,    // The gap
  White Space Product Count × Avg Product MRR,          // Product opportunity
  (Total Locations − Serviced Locations) / Total Locations,  // Location gap
  Current Billing with Us                                // Base weight
)
```

**Data Needed for New Scoring:**
- Total estimated spend per account (may need to be a manual/estimated field, or derived from industry benchmarks + employee count + location count)
- Current billed revenue per account (sum of all active services)
- Total locations per account (not just the ones we know about — their full site footprint)
- Locations currently serviced by us vs. total
- Product catalog coverage per account (what they have vs. what exists)

**Open Questions:**
- Where does "Target Addressable Spend" come from? Options: Manual entry per account, derived from industry benchmarks, third-party data enrichment.
- Do we have "total locations" for customers beyond just the ones in our system?

---

### 1.3 Open Pipeline Section

| Element | Current State | Target State |
|---------|--------------|--------------|
| **Filter** | Shows all open quotes regardless of date | **Filtered to current month** close dates only |
| **Click-through** | Goes to account detail | Goes to **opportunity detail** (see section 1.4) |

---

### 1.4 Opportunity Detail (Click-through from Pipeline)

**NEW VIEW — does not exist in current mockup.**

When clicking into an opportunity from the Open Pipeline section, show:

| Element | Description | Data Source |
|---------|-------------|-------------|
| **Current MRR** | What this account is currently billing with us | Account.MRR or sum of active subscriptions |
| **Quoted Amount** | What's been quoted on this specific opportunity | Opportunity.Amount / Opportunity.MRR__c |
| **AI Opportunity** | AI-calculated opportunity value | AI analysis output |
| **Last Touch** | Last meeting, call, or email engagement | Last Activity Date (filtered to meetings, calls, emails — NOT automated/system touches) |
| **Current ICBs** | Any active ICBs (Internal Cost Builds / proposals) tied to this opportunity | ICB custom object or related records on Opportunity |

**AI Opportunity** = dollar amount of additional products/services the AI recommends based on holistic analysis (current billing, historical quotes, current opportunity products, customer ecosystem).

**Open Questions:**
- ICB structure in SF? What fields?
- "Quoted in the past" — historical closed-lost accessible? How far back?
- Does "AI Opportunity" replace or supplement quoted amount? (Likely supplements.)

---

## VIEW 2: ACCOUNT DETAIL (Click-through from Top Accounts)

### 2.1 Account Header / KPI Bar

| Element | Description | Data Source |
|---------|-------------|-------------|
| **Current Total MRR** | Total MRR for this account across all products/locations | Sum of all active subscriptions/services |
| **Opportunities in Funnel** | Count + value of all open opportunities | Open Opportunities where Account = this account |
| **Purchased (Last 12mo)** | Products/services won in the last 12 months | Closed-Won Opportunities, Close Date ≥ 12 months ago |
| **Churned (Last 12mo)** | Products/services lost in the last 12 months | Churn records or Closed-Lost with churn reason |
| **Near-Term Opportunity** | Immediate opportunity + estimated value | AI analysis |
| **Last Touch Point** | Most recent meeting, call, or email | Last Activity filtered to human engagement |

### 2.2 Location Map

**NEW — visual map of their on-net locations.**

| Element | Description |
|---------|-------------|
| **Map Display** | Visual map showing all customer locations (on-net; optionally on/near/off color-coded) |
| **Products at Each Location** | Each location pin shows what products are active at that site |
| **Location Detail** | Click a location: address, net status, products installed, MRR at that site |

**Data Needed:** Location addresses (geocodable or lat/long), net status per location, products per location, MRR per location if available.

**Open Questions:**
- Product-to-location mapping in SF? Or products only at account level?
- Map scope: all locations or only on-net? (Recommendation: all, color-coded.)

### 2.3 AI-Powered Best Next Step & Opportunity Analysis

- **Best Next Engagement Step** — AI recommends: who to contact, what to discuss, channel, what to reference from past conversations.
- **Additional Product/Service Opportunities** — Based on current products, locations, industry, engagement history, competitor mentions, pain points — what to sell and why.

---

## DATA REQUIREMENTS SUMMARY

### Must-Have Fields

| Table | Field | Status | Notes |
|-------|-------|--------|-------|
| Accounts | Total Revenue / Billed Amount | ❓ | Different from MRR if one-time charges |
| Accounts | Target Addressable Spend | ❓ | May need manual or estimation model |
| Accounts | Total Location Count (full footprint) | ❓ | May only have our sites |
| Opportunities | Close Date (current month filter) | ✅ | Standard SF |
| Opportunities | Related ICBs | ❓ | Confirm object structure |
| Locations | Products at Location | ❓ | Product-to-site relationship |
| Activity | Type (meeting/call/email only) | ✅ | Exclude automated |
| Opportunities | Historical (Closed-Won + Closed-Lost) | ✅ | 12+ months |
| Churn | Churned services last 12mo | ❓ | Churn object or opps? |

### Nice-to-Have

- Accounts: Employee Count, Annual IT Budget
- Contacts: Decision Authority Level
- Opportunities: Loss Reason, Competitor (on Closed-Lost)
- Locations: Lat/Long

---

## OPEN ITEMS FOR DISCUSSION

1. **Scoring System** — Where does "Target Addressable Spend" come from? Manual? Industry benchmark? Third-party?
2. **ICB Integration** — ICB object structure in SF.
3. **Location-Level Product Mapping** — Available in SF today?
4. **"Last Touch" Definition** — Most recent Task/Event Type = Meeting, Call, or Email; exclude automated/system.
5. **"Urgent" Triggers** — Proposed: no activity 14+ days, quote expiring 7d, renewal within 60d, support escalation, no response 10+ days, stalled 30+ days.
6. **Historical Data Depth** — 12 / 24 months / all time for "quoted in the past"?
7. **Map View Scope** — All locations color-coded by status, or only on-net?
