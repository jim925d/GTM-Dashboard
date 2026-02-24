# Product-Aware AI Design — GTM Intelligence Engine

How to build the AI system around products so recommendations and outreach use your real product story (marketing material, fit signals, pitch angles).

---

## Goal

Today the AI sees **product name, category, MRR, and a short description**. It recommends products and writes outreach based on that plus account data. To get better recommendations and more on-brand, product-specific outreach:

- Give the AI **why and when** to recommend each product (fit signals, use cases, industries).
- Give the AI **how to talk about** each product (value props, pitch angles, objection handlers) so emails and call scripts sound like your sales playbook, not generic.

---

## Product Data Model (Current + Extended)

### Current (already in app / CSV)

| Field | Purpose |
|-------|---------|
| product_name | Name used in quotes and recommendations |
| category | Grouping; AI can use for “expand in Security” etc. |
| mrr | Typical/listed MRR for opportunity sizing |
| description | 1–2 sentences; AI uses for fit and outreach |

### In spec but not yet in app

| Field | Purpose |
|-------|---------|
| **fit_signals** | Keywords/signals that indicate this product is relevant (e.g. “multiple locations”, “MPLS”, “HIPAA”). AI uses these to justify “why this product for this account” and to match engagement notes + industry. |

### Recommended extensions (for product-aware AI)

| Field | Purpose | Example / source |
|-------|---------|-------------------|
| **value_props** | 2–4 short value propositions. | “Single pane of glass”, “Reduce MPLS spend”, “SLA-backed”. From one-pagers, positioning docs. |
| **use_cases** | When / for whom this product is sold. | “Multi-site enterprises replacing MPLS”, “Retail with PCI needs”. From sales playbooks. |
| **pitch_angles** | Suggested opening angles for outreach. | “Given your 4 sites and Naperville pilot interest…” — can be 1–2 template lines or bullets. |
| **industries** | Industries where this product is a strong fit (optional). | “Healthcare, Financial Services”. From GTM/segment docs. |
| **objection_handlers** | Short answers to common objections (optional). | “Pricing: we match to 3-year TCO.” From battle cards. |

You don’t need all of these at once. **Minimum for “product AI”:** description + **fit_signals**. **Next step:** add **value_props** (and optionally **use_cases**) so the AI can use marketing language in recommendations and outreach.

---

## How the AI Uses This

### Single prompt (current pattern)

Account analysis is one prompt per account. The **AVAILABLE PRODUCTS** section in that prompt is where product context lives.

**Today:**  
`ProductName ($X/mo, Category): description`

**With product AI:**  
For each available product, send something like:

```
Product: SD-WAN Managed. MRR: $1,200/mo. Category: Network.
Description: Software-defined WAN with managed routing and optimization.
Fit signals (when to recommend): multiple locations, bandwidth, MPLS, network modernization, branch consolidation.
Value props: Single pane of glass; reduce MPLS spend; SLA-backed performance.
Use cases: Multi-site enterprises replacing MPLS; retail with PCI needs.
```

The AI then:

- Uses **fit_signals** + engagement notes/industry to decide **which** products to recommend and to write **fitReason**.
- Uses **value_props** and **use_cases** to phrase **fitReason** and to draft **email body** and **call opener** in your language (e.g. “Single pane of glass” instead of generic “better visibility”).

No new API calls are required: same single account-analysis call, richer product block in the prompt.

### Optional: product-only “match” step

You could add a separate “product match” step that, given an account, returns ranked products + reasons. That could use the same product fields and feed into the main analysis or into a “recommended products” widget. For most teams, **enriching the single account prompt** is enough to start; a separate product-match call can be added later if needed.

---

## Where the Content Comes From

| Source | What to pull | How to get it into the app |
|--------|----------------|----------------------------|
| **Marketing one-pagers / web** | Value props, use cases, 1-line description | Copy into CSV columns (value_props, use_cases, description) or a simple product admin. |
| **Sales playbooks / battle cards** | Pitch angles, objection handlers, fit signals | Summarize into pitch_angles, objection_handlers, fit_signals in CSV or product table. |
| **GTM / segment docs** | Industries, typical deal size | industries column; mrr you have already. |
| **Win/loss or competitive** | “Why we win” vs. alternatives | Optional: differentiators or a short competitive_notes field. |

Start with one product and one doc (e.g. one-pager + playbook). Turn that into the extra columns (fit_signals, value_props, use_cases), then replicate for other products.

---

## Implementation Checklist

- [ ] **Product catalog:** Add optional columns for fit_signals, value_props, use_cases (and optionally industries, pitch_angles, objection_handlers).
- [ ] **CSV upload:** Support these columns in Product Catalog upload; parser maps them into product objects.
- [ ] **Prompt:** In `buildAnalysisPrompt`, format the “AVAILABLE PRODUCTS” block with the new fields when present (so existing CSVs without them still work).
- [ ] **Sample data:** Add fit_signals (and optionally value_props) to a couple of sample products so the AI uses them in the demo.
- [ ] **Docs:** Update HOW-TO-UPLOAD and the data spec with the new Product Catalog columns and where to get the content (marketing material, playbooks).

---

## Summary

- **Yes, use marketing material on the products.** Map it into structured fields (value_props, use_cases, fit_signals, etc.) and pass those into the **same** account-analysis prompt so the AI can recommend the right products and talk about them in your language.
- **Fit signals** are the main lever for “when to recommend”; **value_props** and **use_cases** are the main levers for “how to say it” in outreach.
- Keep one source of truth (e.g. CSV or product table) that you refresh when marketing or playbooks change; no need for a separate “AI product layer” unless you add a dedicated product-match API later.
