# GTM Intelligence Dashboard — Full Architecture Document

This document describes the complete architecture of the GTM Intelligence Engine application so you can plan changes externally before implementing them.

---

## 1. PROJECT STRUCTURE

### 1.1 File Tree with Descriptions

```
Sales GTM/
├── api/                    # Vercel serverless functions (Phase 2)
│   ├── analyze.js          # POST: Run AI analysis for one account; persists to ai_results
│   ├── analyze-batch.js    # POST: Run AI analysis for multiple accounts
│   ├── ai-results.js       # GET: Load persisted AI results; POST: save results
│   └── _lib/
│       ├── buildPrompt.js  # AI prompt builder (MEDDIC + deal intel + playbook)
│       ├── hashAccount.js  # Staleness detection (same as client)
│       └── supabase.js     # Supabase admin client (server-side)
├── index.html              # Entry HTML; mounts #root, loads /main.jsx
├── main.jsx                # React root: renders <App /> from gtm-intelligence-engine.jsx
├── gtm-intelligence-engine.jsx   # Single-file app: data, CSV parsing, AI engine, all React components, CSS
├── supabase.js             # Supabase client + loadUploadTablesFromSupabase, saveUploadTablesToSupabase
├── vercel.json             # Vercel config (build, functions memory/duration)
├── package.json            # npm scripts; deps include @anthropic-ai/sdk, mapbox-gl
├── package-lock.json       # Locked dependency versions
├── vite.config.js          # Vite + React plugin; base: /GTM-Dashboard/; outDir: docs (for GitHub Pages)
├── .env                    # Local secrets: VITE_SUPABASE_*, VITE_MAPBOX_TOKEN; server-side: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
├── .env.example            # Template for .env (Supabase placeholders)
├── .gitignore              # node_modules, dist, .env*, .DS_Store, IDE, *.log
├── supabase/
│   └── migrations/
│       ├── 20250225000000_gtm_upload_store.sql   # Creates gtm_upload_store (table_key, data JSONB, RLS)
│       └── 20250225100000_ai_results.sql         # Creates ai_results (account_id, result JSONB, data_hash, analyzed_at)
├── .github/
│   └── workflows/
│       └── deploy-pages.yml   # On push to main: npm ci, build, upload docs/, deploy to GitHub Pages
├── README.md               # (if present) Project overview
├── GTM-Intelligence-Data-Spec-and-Prompt-Template.md   # Data spec, SF report mapping, prompt template
├── PROMPT-GTM-Intelligence-Engine.md   # Shorter prompt copy for building the app
├── PRODUCT-AI-DESIGN.md    # Product-aware AI: fit_signals, value_props, use_cases
├── IMPLEMENTATION-ROADMAP.md   # Feedback roadmap: quick wins, new views, data extensions, blocked
├── FEEDBACK-FRAMEWORK-v1.md    # (if present) Feedback framework
├── HOW-TO-UPLOAD.md        # (if present) Upload instructions
├── PAGES-CHECKLIST.md      # (if present) Pages checklist
└── DEPLOY.md               # (if present) Deploy instructions
```

**Note:** All React UI, state, analysis logic, and inline CSS live in **one file**: `gtm-intelligence-engine.jsx`. There are no separate component files or CSS files.

### 1.2 Dependencies and Versions

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.2.0 | UI components |
| react-dom | ^18.2.0 | React DOM renderer |
| @supabase/supabase-js | ^2.45.0 | Load/save upload tables (JSONB rows) |
| vite | ^5.0.0 | Build tool (dev server, build) |
| @vitejs/plugin-react | ^4.2.1 | React Fast Refresh for Vite |

No router, no state library (Redux/Zustand), no UI library (Tailwind/MUI). No explicit Anthropic SDK — raw `fetch` to `https://api.anthropic.com/v1/messages`.

### 1.3 Build / Run Configuration

- **Dev:** `npm run dev` → Vite dev server (default port, hot reload).
- **Build:** `npm run build` → Vite build; output in `docs/` (see `vite.config.js`).
- **Preview:** `npm run preview` → Serve `docs/` locally.
- **Deploy:** `npm run deploy` → same as `npm run build`. Actual deploy is via GitHub Actions: push to `main` runs workflow, builds, uploads `docs/` artifact, deploys to GitHub Pages. Site base path: `/GTM-Dashboard/` (e.g. `https://<user>.github.io/GTM-Dashboard/`).

---

## 2. DATA MODEL

### 2.1 Entities and Schemas

All entities are plain JavaScript objects. Types below are the effective shapes used in code.

#### Product (catalog)

| Field | Type | Required | Source |
|-------|------|----------|--------|
| id | string | yes | Generated: `"p" + (i+1)` |
| name | string | yes | CSV: product_name / productname |
| cat | string | yes | CSV: category / cat; default "Other" |
| mrr | number | yes | CSV: mrr (parsed float, rounded) |
| desc | string | no | CSV: description / desc |
| fit_signals | string | no | CSV: fit_signals / fitsignals |
| value_props | string | no | CSV: value_props / valueprops |
| use_cases | string | no | CSV: use_cases / usecases |

**Defined:** Hardcoded `PRODUCTS` array in `gtm-intelligence-engine.jsx`; or built from CSV upload via `buildProductsFromRows()` (Product Catalog table).

#### Account

| Field | Type | Required | Source |
|-------|------|----------|--------|
| id | string | yes | CSV: account_id / accountid; or generated "acc_N" |
| name | string | yes | CSV: account_name / accountname; default "Unknown" |
| ind | string | yes | CSV: industry / ind; default "Other" |
| tier | string | yes | CSV: tier; default "Growth" |
| mrr | number | yes | CSV: mrr (rounded) |
| cEnd | string | no | CSV: contract_end / contractend |
| loc | Location[] | yes | From Locations CSV rows |
| cur | string[] | yes | Product names from Current Products CSV |
| qt | Quote[] | yes | From Quotes CSV |
| prior | string[] | yes | From Churned CSV (service_description) |
| eng | Engagement[] | yes | From Engagement CSV; sorted by date desc |
| con | Contact[] | yes | From Contacts CSV |
| icbs | { createdDate?: string }[] | no | Optional; used for "stalled ICB" action items |

**Relations:** `loc`, `cur`, `qt`, `prior`, `eng`, `con` are all keyed by `account_id` in CSV and merged in `buildAccountsFromTables()`.

#### Location

| Field | Type | Required | Source |
|-------|------|----------|--------|
| a | string | yes | CSV: address / a |
| s | string | yes | CSV: net_status / netstatus / s; normalized lower; default "off-net" |
| billing | number | no | CSV: billing_amount / billingamount / billing |
| targetSpend | number | no | CSV: target_addressable_spend / target_spend |

#### Quote (open opportunity)

| Field | Type | Required | Source |
|-------|------|----------|--------|
| name | string | yes | CSV: product_name / productname |
| mrr | number | yes | CSV: quoted_mrr / quotedmrr / mrr |
| date | string | no | CSV: quote_date / quotedate / date |
| closeDate | string | no | CSV: close_date / closedate |
| st | string | yes | CSV: status / st; default "pending" |
| notes | string | no | CSV: notes |

#### Contact

| Field | Type | Required | Source |
|-------|------|----------|--------|
| name | string | yes | CSV: contact_name / contactname / name |
| title | string | no | CSV: title |
| eng | string | yes | CSV: engagement_level / eng; normalized lower; default "cold" |
| last | string \| null | no | CSV: last_touch / last |

#### Engagement (activity)

| Field | Type | Required | Source |
|-------|------|----------|--------|
| d | string | yes | CSV: date / d |
| t | string | yes | CSV: type / t; default "Call" |
| n | string | yes | CSV: notes / n |

### 2.2 Upload Tables (Supabase / in-memory)

Eight logical “tables” stored as key-value:

- **Keys:** `productCatalog`, `accounts`, `locations`, `currentProducts`, `quotes`, `contacts`, `engagement`, `churned`
- **Value per key:** Array of row objects (CSV rows with normalized headers, e.g. `account_id`, `account_name`).
- **Persistence:** Supabase table `gtm_upload_store`: columns `table_key` (text PK), `data` (jsonb), `updated_at` (timestamptz). One row per table key.

Data flow: CSV → `parseCSVWithMeta` → rows stored in `uploadTables[key]` → `buildProductsFromRows` (productCatalog only) and `buildAccountsFromTables` (other seven) → `products` and `accounts` state.

### 2.3 AI Result Shape (per account)

Returned by Claude and stored in `aiData[accountId]`:

```ts
{
  score: number;                    // 0-100
  scoreReasoning: string;
  accountSummary: string;
  sentiment: "positive" | "neutral" | "at-risk" | "critical";
  sentimentDetail: string;
  immediateOpportunity: {
    type: "close-deal" | "advance-quote" | "cross-sell" | "win-back" | "renewal" | "save-account" | "re-engage" | "expand-footprint";
    description: string;
    estimatedMRR: number;
    confidence: "high" | "medium" | "low";
    timeframe: string;
  };
  productRecommendations: Array<{ product: string; mrr: number; fitReason: string; priority: string }>;
  additionalOpportunities?: Array<{ type: string; description: string; estimatedMRR: number }>;
  competitiveIntel: string;
  risks: string[];
  contactStrategy: { primaryTarget: string; approach: string; secondaryTarget?: string; multiThreadNote?: string };
  engagementPlan: { thisWeek: string; channel: string; talkingPoints: string[]; avoid?: string };
  outreach: { emailSubject: string; emailBody: string; callOpener: string };
  ninetyDayTarget?: string;
}
```

### 2.4 Sample Data (one complete example)

**Product:**

```json
{
  "id": "p1",
  "name": "SD-WAN Managed",
  "cat": "Network",
  "mrr": 1200,
  "desc": "Software-defined WAN with managed routing and traffic optimization across multi-site environments",
  "fit_signals": "multiple locations, bandwidth, MPLS, network modernization, branch consolidation",
  "value_props": "Single pane of glass; reduce MPLS spend; SLA-backed performance",
  "use_cases": "Multi-site enterprises replacing MPLS; retail with PCI needs"
}
```

**Account (Meridian Health Systems):**

```json
{
  "id": "c1",
  "name": "Meridian Health Systems",
  "ind": "Healthcare",
  "tier": "Growth",
  "mrr": 4200,
  "cEnd": "2025-09-30",
  "loc": [
    { "a": "450 Medical Center Dr, Chicago IL", "s": "on-net", "billing": 1800, "targetSpend": 2400 },
    { "a": "1200 Lake Shore Blvd, Chicago IL", "s": "on-net", "billing": 1200, "targetSpend": 1900 }
  ],
  "cur": ["Dedicated Internet", "SIP Trunking"],
  "qt": [
    { "name": "SD-WAN Managed", "date": "2024-11-20", "closeDate": "2025-02-28", "mrr": 3600, "st": "pending" },
    { "name": "Managed Firewall", "date": "2024-11-20", "closeDate": "", "mrr": 2100, "st": "pending" }
  ],
  "prior": ["MPLS Network (churned 2023)", "Legacy PBX (replaced 2022)"],
  "eng": [
    { "d": "2025-02-15", "t": "QBR", "n": "Discussed network modernization across all 4 sites. CTO Dr. Chen very interested in SD-WAN..." }
  ],
  "con": [
    { "name": "Dr. Sarah Chen", "title": "CTO", "eng": "champion", "last": "2025-02-15" },
    { "name": "Mark Williams", "title": "VP of IT", "eng": "engaged", "last": "2024-10-05" }
  ]
}
```

---

## 3. STATE MANAGEMENT

### 3.1 All React State (App and Children)

| Variable | Component | Type | What it controls |
|----------|-----------|------|------------------|
| vw | App | string | Current view: "brief" \| "engage" \| "det" \| "data" \| "opp" |
| sel | App | string \| null | Selected account id (sidebar + detail view) |
| srch | App | string | Search filter for sidebar account list |
| aiData | App | Record<string, AIResult> | AI analysis result per account id |
| analyzing | App | boolean | True while any AI analysis is in progress |
| progress | App | string | Progress message (e.g. "Analyzing 3/5...") |
| products | App | Product[] | Product catalog (initial PRODUCTS or from upload) |
| accounts | App | Account[] | Account list (initial ACCOUNTS or from upload) |
| uploadTables | App | Record<string, unknown[]> | Raw rows per table key (for Data view + persist) |
| selOpp | App | { accountId, quote } \| null | Selected pipeline opportunity (Opportunity Detail view) |
| dataHydrated | App | boolean | True after Supabase load attempt (or failure) |
| expanded | EngagementHub | string \| null | Account id of expanded card |
| filter | EngagementHub | string | "all" \| "overdue" \| "at-risk" \| "ai" |
| copied | EngagementHub | string \| null | Id used for "Copied" feedback (e.g. "c1-email") |
| tab | Detail | string | "overview" \| "timeline" \| "contacts" \| "products" |
| copied | Detail | string \| null | "email" \| "call" for copy feedback |
| tableKey | DataView | string | Which table type to upload (e.g. "accounts") |
| parseError | DataView | string | CSV parse error message |
| lastLoaded | DataView | string | Success message after load |
| pendingFiles | DataView | Array of { name, rows, detected, assignedTable, ... } | Files dropped, not yet applied |
| dragOver | DataView | boolean | Drag-over state for drop zone |
| fileRef | DataView | ref | Hidden file input for single-file upload |

### 3.2 State Flow

- **Props down:** `accounts`, `products`, `aiData`, `onSelect`, `onAnalyze`, `analyzing`, etc. are passed from App to Briefing, EngagementHub, Detail, OpportunityDetail, DataView.
- **Callbacks up:** `onS`/`onSelect`/`pick` set `sel` and switch to "det"; `onAnalyze` runs AI and updates `aiData`; `onOppClick` sets `selOpp` and switches to "opp"; `onLoadSample` resets products/accounts/uploadTables and persists empty tables; `onPersist` calls `saveUploadTablesToSupabase`.
- **No context:** All shared state lives in App and is passed as props. No React Context.

### 3.3 Global / Shared State

- **App state is global for the SPA:** view, selection, aiData, accounts, products, uploadTables. Sidebar and main content both read from the same state.
- **Persistence:** Only `uploadTables` (and thus derived `products` and `accounts`) are persisted, via Supabase. `aiData` is in-memory only and lost on refresh.

---

## 4. COMPONENT ARCHITECTURE

### 4.1 Component List

| Component | File location | Props | Internal state | Children | Events / callbacks |
|-----------|----------------|-------|----------------|-----------|--------------------|
| App | gtm-intelligence-engine.jsx | — | vw, sel, srch, aiData, analyzing, progress, products, accounts, uploadTables, selOpp, dataHydrated | Sidebar (nav + account list), mh (header), Briefing / EngagementHub / Detail / OpportunityDetail / DataView | Nav click → set vw/sel; pick → set sel, vw="det"; handleAnalyze → set aiData; handleOppClick → set selOpp, vw="opp" |
| (Sidebar) | inline in App | — | — | sb-h (logo + search), ni (nav items), sb-n (account list) | Search input → set srch; ni click → set vw/sel; account click → pick(id) |
| Briefing | same file | accounts, aiData, onS, onAnalyze, onOppClick, analyzing | — | sr (KPI tiles), cg (cards: Top Accounts, Pipeline, Action items, AI Insights) | Tile click → onAnalyze("all"); account row → onS(id); pipeline row → onOppClick(aid, quote) |
| EngagementHub | same file | accounts, aiData, onSelect, onAnalyze, analyzing | expanded, filter, copied | sr, filter buttons, eng-card per account | Filter → setFilter; Expand → setExpanded; Analyze → onAnalyze(id or "all"); Copy → doCopy; View Full Account → onSelect(id) |
| Detail | same file | cu (account), ai, products, onAnalyze, analyzing | tab, copied | sr, ap (AI panel), tabs, tab content (overview/timeline/contacts/products) | Tab → sTab; Copy → doCopy; Re-Analyze → onAnalyze(cu.id) |
| OpportunityDetail | same file | account, quote, ai, onBack, onGoToAccount | — | sr, cd (opportunity + AI additional opportunities + ICB placeholder) | Back → onBack; View full account → onGoToAccount(id) |
| DataView | same file | uploadTables, setUploadTables, setProducts, setAccounts, onLoadSample, onPersist | tableKey, parseError, lastLoaded, pendingFiles, dragOver, fileRef | Drop zone, pending list, table type grid, file input, status, mapping status list | Drop → handleMultiDrop; Assign → setAssigned; Load all → loadAllPending; Table click → setTableKey + fileRef.click; File → handleFile; Load sample → onLoadSample |
| Skeleton | same file | w, h | — | — | — |

### 4.2 Component Tree (parent → child)

```
App
├── <style>{CSS}</style>
├── .app
│   ├── .sb (sidebar)
│   │   ├── .sb-h (logo + search input)
│   │   ├── Navigation: .ni × 3 (Briefing, Engagement Hub, Upload Data)
│   │   ├── [analyzing progress]
│   │   ├── .sb-lb "Accounts"
│   │   └── .sb-n → .ai-i × N (account list)
│   └── .mn (main)
│       ├── .mh (page title / breadcrumb)
│       └── [view content]
│           ├── Briefing (vw === "brief")
│           │   ├── .sr (KPI .st × 5)
│           │   └── .cg
│           │       ├── .cd Top Accounts → .act × 10
│           │       ├── .cd Open Pipeline → .act × pipeline
│           │       ├── .cd.fw Action items → .act × items
│           │       └── .cd.fw AI Insights → .act or CTA
│           ├── EngagementHub (vw === "engage")
│           │   ├── .sr, filter buttons, Analyze All
│           │   └── .eng-card × N (each: eng-top, eng-exp with AI summary, strategy, outreach, copy buttons)
│           ├── Detail (vw === "det" && selC)
│           │   ├── .sr, AI panel .ap, .tabs
│           │   └── tab content (overview / timeline / contacts / products)
│           ├── OpportunityDetail (vw === "opp")
│           │   ├── breadcrumb, .sr, .cd × 3, button
│           │   └── (ICB placeholder)
│           └── DataView (vw === "data")
│               ├── .cd.fw (drop zone, pending, table grid, Load sample)
│               └── .cd.fw (mapping status)
```

### 4.3 What Each Section of the UI Is

- **Sidebar:** Logo "GTM Intelligence", search, nav (Daily Briefing, Engagement Hub, Upload Data), optional progress text, account list sorted by score with AI badge. Clicking an account sets `sel` and shows Detail in main.
- **Main header:** Title and subtitle depend on `vw` (brief / engage / det / data / opp); breadcrumb for det and opp.
- **Briefing:** KPIs (Book of Business MRR, Pipeline this month, Avg Score, Action count, Run AI); Top 10 accounts; Pipeline (current month close date); Action items (from getActionItems); AI Insights (top 5 AI-analyzed or CTA).
- **Engagement Hub:** Same KPIs plus filters (All, 30+ Day Gap, At-Risk, AI Analyzed); list of account cards sorted by score; expand to see AI strategy + outreach + copy buttons.
- **Detail:** Account header (score, name, tier, Re-Analyze); KPIs; AI panel (if ai); tabs: Overview (products + locations + AI recs), Timeline (eng), Contacts (+ AI contact strategy), Products (quotes + AI recs).
- **Opportunity Detail:** Breadcrumb, KPIs, opportunity block, AI additional opportunities grid, ICB placeholder, "View full account" button.
- **Data/Upload:** Drop zone, pending files with table assignment, per-function upload grid, Load sample, mapping status.

---

## 5. ANALYSIS ENGINE

### 5.1 Account Scoring

**Quick (deterministic) pre-score — `quickScore(c)`:**

- Days since last engagement `ds`: ≤14 → +20; ≤30 → +10; ≤60 → +5.
- +15 per open quote.
- +8 per on-net location, +5 per near-net.
- +10 per champion contact.
- If contract end in next 90 days (renewal): +8.
- Score clamped 0–100. Returns `{ score, ds, pending: true }`.

**Full score:** From AI only. AI returns 0–100 in `score` and `scoreReasoning`. No separate formula; prompt asks for "0-100 integer" and "2 sentences explaining the score."

### 5.2 Engagement Gaps

- **Days since last touch:** `daysAgo(c.eng[0].d)` (or 999 if no engagement). Used in quickScore, filters ("30+ Day Gap"), and display.
- **Action items (`getActionItems(accounts)`):** Deterministic rules; each account can contribute multiple items:
  - No contact 30+ days → "No contact 30+ days" (reasonKey: gap_30).
  - No contact 14+ days and has open opp → "No contact 14+ days (open opp)" (gap_14_opp).
  - Any stalled quote → "Stalled quote" (stalled_quote).
  - Stalled ICB: any `icbs[]` with `createdDate` ≥ 14 days ago → "Stalled ICB (14+ days old)" (stalled_icb).
  - Renewal in 90 days (cEnd 60–90 days out) → "Renewal in 90 days" (renewal_90).
  - Renewal in 60 days (cEnd 0–60 days out) → "Renewal in 60 days" (renewal_60).

### 5.3 Opportunity Identification and Classification

- **Deterministic fallback (no AI):** If no AI result, Engagement Hub uses: stalled quote → "advance-quote"; else ds > 30 → "re-engage"; else "check-in". Opportunity MRR = sum of quote MRRs.
- **AI:** Classifies `immediateOpportunity.type` (close-deal, advance-quote, cross-sell, win-back, renewal, save-account, re-engage, expand-footprint), plus description, estimatedMRR, confidence, timeframe.

### 5.4 Product Matching

- **Deterministic:** No explicit keyword product-matching in code. "Available products" in the prompt = products not in `c.cur` and not in `c.qt[].name`. All such products are sent to the AI with name, MRR, category, description, fit_signals, value_props, use_cases.
- **AI:** Chooses which products to recommend and returns `productRecommendations[]` with product name, mrr, fitReason, priority (primary/secondary/future). Matching is entirely AI-driven from the prompt text.

### 5.5 Outreach Generation

- **Fully AI:** No templates in code. Prompt asks for exact JSON fields: `outreach.emailSubject`, `outreach.emailBody`, `outreach.callOpener`. AI is instructed to reference specific engagement details and use product value props. No variable substitution in app; copy buttons send the AI string to clipboard.

### 5.6 Deterministic vs AI

- **Deterministic:** quickScore, getActionItems, "current month" pipeline filter (`isCloseDateInCurrentMonth`), table type detection and CSV → account/product build, sorting and filtering in UI.
- **AI-only:** Score reasoning, sentiment, opportunity type/description/MRR/confidence/timeframe, product recommendations with fitReason, competitive intel, risks, contact strategy, engagement plan, outreach (email + call), ninetyDayTarget, additionalOpportunities.

---

## 6. AI INTEGRATION

### 6.1 API Call

- **Endpoint:** `POST https://api.anthropic.com/v1/messages`
- **Headers in code:** `Content-Type: application/json`. **Note:** Anthropic requires `x-api-key` and `anthropic-version`; the current code does not send them, so unauthenticated requests will fail unless proxied or using a different backend.
- **Body:** `{ model: "claude-sonnet-4-20250514", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }`. No system message; full instructions are in the user prompt.

### 6.2 Prompt (buildAnalysisPrompt)

**System-like instruction (in user prompt):**  
"You are an elite B2B sales intelligence analyst. Analyze this account with surgical precision. Read between the lines of engagement notes — detect sentiment, urgency, competitive threats, buying signals, organizational dynamics, and timing."

**Data included:**

- TODAY'S DATE: 2025-02-23 (hardcoded)
- DAYS SINCE LAST ENGAGEMENT
- Account: name, industry, tier, MRR, contract end
- Locations (address, net status)
- Current products, open quotes (name, MRR, status, date), prior/churned
- Contacts (name, title, engagement, last touch)
- Full engagement history (date, type, notes)
- "AVAILABLE PRODUCTS" block: each product not in cur/qt with name, MRR, category, description, fit_signals, value_props, use_cases

**Instructions:** Analyze holistically (buying signals, sentiment, competitive threats, org dynamics, timing, product fit, risks, single most important action this week); use product fit/value props in outreach; respond with exact JSON (no markdown).

**Required JSON shape:** score, scoreReasoning, accountSummary, sentiment, sentimentDetail, immediateOpportunity (type, description, estimatedMRR, confidence, timeframe), productRecommendations[], additionalOpportunities[], competitiveIntel, risks[], contactStrategy, engagementPlan, outreach (emailSubject, emailBody, callOpener), ninetyDayTarget.

### 6.3 Response Parsing and Use

- Response: `d.content` array of content blocks; `text` from each block concatenated.
- Strip markdown code fences (e.g. ```json) and parse as JSON. On parse failure or API error, `runAIAnalysis` returns `null`.
- Result stored in `aiData[accountId]` and used by Briefing, EngagementHub, Detail, OpportunityDetail for score, sentiment, strategy, outreach, product recs, etc.

### 6.4 Error Handling

- `try/catch` in `runAIAnalysis`; on error logs to console and returns `null`. No user-visible error toast; UI simply shows no AI data for that account (and quickScore/fallback copy).
- Batch analysis: if one account fails, others continue; failed account has no entry in `aiData`.

### 6.5 Where AI Results Are Stored and Shown

- **Stored:** In memory only, `aiData` (App state). Not persisted to Supabase; refresh clears AI.
- **Shown:** Briefing (top accounts, pipeline, AI Insights), Engagement Hub (cards, expand for full strategy + copy), Detail (AI panel, tabs), Opportunity Detail (AI opportunity + additional opportunities). "AI" badge appears when `aiData[id]` exists.

---

## 7. VIEWS & NAVIGATION

### 7.1 Views

| View | Trigger | Sections / panels | Data dependencies | Main interactions |
|------|---------|-------------------|--------------------|--------------------|
| **Daily Briefing** | Nav "Daily Briefing" or initial load (brief) | KPI row, Top Accounts, Open Pipeline (current month), Action items, AI Insights | accounts, aiData, products (for display only in pipeline) | Click Top Account → Detail; Click pipeline row → Opportunity Detail; Click "Run AI Analysis" / "Analyze All" → batch AI |
| **Engagement Hub** | Nav "Engagement Hub" | KPI row, filter buttons, Analyze All, list of account cards (expandable) | accounts, aiData | Filter; Expand card; Analyze one / Analyze All; Copy email/call; "View Full Account" → Detail; "Re-Analyze" → single AI |
| **Account Detail** | Sidebar account click or "View Full Account" from Engagement Hub / Briefing | Header (score, name, Re-Analyze), KPI row, AI panel (if ai), tabs: Overview / Timeline / Contacts / Products | selC (account), aiData[sel], products | Tab switch; Copy email/call; Re-Analyze |
| **Opportunity Detail** | Click pipeline row on Briefing | Breadcrumb, KPI row, opportunity block, AI additional opportunities, ICB placeholder, "View full account" | selOpp (accountId + quote), oppAccount, aiData[oppAccount.id] | Back → Briefing; View full account → Detail |
| **Upload Data** | Nav "Upload Data" | Drop zone, pending files + table assignment, per-table upload grid, Load sample, mapping status | uploadTables | Drop files; assign table; Load all; click table type + choose file; Load sample |

### 7.2 Navigation Flow

```
[App load] → Briefing (vw="brief", sel=null)
  ├── Nav "Engagement Hub" → vw="engage"
  ├── Nav "Upload Data" → vw="data"
  ├── Sidebar account click → vw="det", sel=id
  ├── Briefing Top Account / Action item click → vw="det", sel=id
  ├── Briefing pipeline row click → vw="opp", selOpp={ accountId, quote }
  ├── Engagement Hub "View Full Account" → vw="det", sel=id
  └── Opportunity Detail "View full account" → vw="det", sel=id, selOpp=null

From Detail / Opportunity:
  ├── "← Back" (in header) → vw="brief", sel=null (and clear selOpp if opp)
  └── Opportunity Detail "Back" → vw="brief", selOpp=null
```

No URL routing; all navigation is state-driven (vw, sel, selOpp).

---

## 8. STYLING & DESIGN SYSTEM

### 8.1 Approach

- Single global CSS string in `gtm-intelligence-engine.jsx` injected as `<style>{CSS}</style>`. No CSS modules, no Tailwind, no separate stylesheet.

### 8.2 Theme Variables (:root)

- **Backgrounds:** --b0 (#090b10) page, --b1 (#10131a) sidebar/header, --b2 (#161a24) cards/inputs, --b3, --b4 gradients/skeleton.
- **Borders:** --bd (#252a3a), --bd2 (#2f364a).
- **Text:** --t1 (#e8eaf0) primary, --t2 (#8b92a8) secondary, --t3 (#5a6178) muted.
- **Accent:** --ac (#DE7231), --acd (accent dim).
- **Semantic:** --gn/gnd (success), --yl/yld (warning), --rd/rdd (critical), --og/ogd (orange), --pr/prd (purple), --cy/cyd (info).

### 8.3 Typography

- **Fonts:** DM Sans (body, UI), JetBrains Mono (numbers, code). Loaded via Google Fonts import in CSS.
- **Sizes:** Mix of 9–20px; labels often 9–10px uppercase, values 12–19px, mono for MRR/scores.

### 8.4 Patterns

- **Cards:** .cd, .cd.fw (full width); .ebox for content blocks; .ap for AI highlight panel.
- **Badges/tags:** .tg with modifiers (.on-net, .positive, .critical, .opportunity, etc.) for status and sentiment.
- **Buttons:** .btn, .bp (primary), .bg (ghost), .bsuccess (copy success); .tab for tabs.
- **Lists:** .act (clickable row), .tl (timeline row), .cr (contact row), .pf (product/quote row).
- **Score pill:** .asc with background/color from scC(score). Sentiment: .sentiment-dot with .positive/.neutral/.at-risk/.critical.

### 8.5 Responsive

- Flex and grid used (e.g. .cg two columns, .sr flex wrap). No explicit breakpoints; layout can wrap. Sidebar fixed width (268px); main area scrolls. No dedicated mobile layout.

---

## 9. DATA FLOW DIAGRAMS

### 9.1 App Initialization

```
1. App mounts
2. dataHydrated = false → show "Loading data…" spinner
3. loadUploadTablesFromSupabase() runs (useEffect [])
4. On success: setUploadTables(tables), setProducts(buildProductsFromRows(tables.productCatalog)),
   setAccounts(buildAccountsFromTables(...)); setDataHydrated(true)
5. On fail/null: setDataHydrated(true) (no tables → keep initial PRODUCTS/ACCOUNTS from state init)
6. Render: sidebar + main; if vw==="brief" show Briefing with current accounts/products/aiData (empty)
```

### 9.2 User Clicks "Analyze Account" (single)

```
1. User clicks "✨ Analyze [Name]" (Engagement Hub or Detail)
2. onAnalyze(accountId) → handleAnalyze(target) in App
3. setAnalyzing(true); setProgress("Analyzing [Name]...")
4. acct = accounts.find(c => c.id === target)
5. runAIAnalysis(acct, products) → buildAnalysisPrompt(acct, products) → fetch(POST api.anthropic.com/...)
6. Response parsed as JSON; on success setAiData(prev => ({ ...prev, [target]: result }))
7. setAnalyzing(false); setProgress("")
8. Re-render: Briefing, EngagementHub, Detail show new aiData[id] (score, strategy, outreach, copy buttons)
```

### 9.3 User Clicks "Analyze All" (batch)

```
1. User clicks "✨ Analyze All Accounts" (Briefing or Engagement Hub)
2. onAnalyze("all") → handleAnalyze("all")
3. setAnalyzing(true); setProgress("Analyzing 0/N...")
4. runBatchAnalysis(accounts, products, (id, result) => { ... setAiData(prev => ({ ...prev, [id]: result })); setProgress(...) })
   - Queue = [...accounts]; two concurrent runners (Promise.all([runNext(), runNext()]))
   - Each runNext: shift account, runAIAnalysis(acct, products), onUpdate(acct.id, result), then runNext() again
5. When queue empty, Promise.all resolves
6. setAnalyzing(false); setProgress("")
7. All accounts that succeeded now have aiData[id]; UI updates progressively during batch
```

### 9.4 Navigation: Engagement Hub → Account Detail

```
1. User clicks "View Full Account" on an Engagement Hub card (or clicks account in sidebar)
2. onSelect(id) or pick(id) → sSel(id); sVw("det")
3. selC = accounts.find(c => c.id === sel) — same account object; no extra fetch
4. Main area renders Detail with cu=selC, ai=aiData[selC.id], products, onAnalyze, analyzing
5. Data "carries over" via React state (sel, accounts, aiData); no URL or persistence of selection
```

### 9.5 User Clicks "Copy Email"

```
1. User clicks "📋 Copy Email" (Engagement Hub or Detail)
2. doCopy(id+"-email", `Subject: ${ai.outreach.emailSubject}\n\n${ai.outreach.emailBody}`) or doCopy("email", ...)
3. copyText(txt) → navigator.clipboard.writeText(txt)
4. setCopied(id+"-email") or setCopied("email"); setTimeout 2s → setCopied(null)
5. Button text toggles to "✓ Copied" for 2 seconds
```

---

## 10. EXTERNAL DEPENDENCIES

### 10.1 API Endpoints

| Endpoint | Method | Payload | Purpose |
|----------|--------|---------|---------|
| https://api.anthropic.com/v1/messages | POST | JSON: model, max_tokens, messages | Claude account analysis. **Auth:** API key not sent in current code (see §6.1). |
| Supabase (VITE_SUPABASE_URL) | — | Via @supabase/supabase-js | .from("gtm_upload_store").select() and .upsert(table_key, data, updated_at) for load/save of upload tables. |

### 10.2 External Libraries

| Library | Purpose |
|---------|---------|
| react | Components, hooks (useState, useCallback, useRef, useEffect) |
| react-dom | createRoot, render |
| @supabase/supabase-js | createClient, from().select(), upsert() |
| vite | Dev server, build, env (import.meta.env.VITE_*) |
| @vitejs/plugin-react | JSX transform, HMR |

### 10.3 Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| VITE_SUPABASE_URL | No (optional) | If set, upload tables are loaded/saved from Supabase |
| VITE_SUPABASE_ANON_KEY | No (optional) | Supabase anon key; if missing, supabase client is null and persist/load no-op |

No Anthropic key is read from env in the current code; the API call would need to be updated to send `x-api-key` (and optionally `anthropic-version`) for real use.

### 10.4 Browser APIs

- **Clipboard:** `navigator.clipboard.writeText(txt)` for Copy Email / Copy Script. No fallback if unavailable.
- **FileReader:** `FileReader.readAsText(file, "UTF-8")` for CSV uploads.

---

## 11. KNOWN LIMITATIONS & HARDCODED VALUES

### 11.1 Hardcoded Dates

- **TODAY'S DATE:** `const NOW = new Date("2025-02-23")` used for daysAgo, daysUntil, and "current month" pipeline filter. All engagement gap and renewal logic uses this fixed date.

### 11.2 Hardcoded / Sample Data

- **PRODUCTS** and **ACCOUNTS** are large default arrays in code; used as initial state and when "Load sample data" is clicked. Upload or Supabase load overwrites them.
- **INITIAL_UPLOAD_TABLES** is all empty arrays; "Load sample data" resets to this and then setProducts(PRODUCTS), setAccounts(ACCOUNTS), setUploadTables(INITIAL_UPLOAD_TABLES) (so upload tables are cleared but displayed data is sample).

### 11.3 TODOs / Incomplete

- **Opportunity Detail — ICB:** "ICB data will appear here when integrated with Salesforce." Placeholder only.
- **Product matching:** No deterministic keyword match; product recommendations are AI-only. PRODUCT-AI-DESIGN.md suggests optional product-only "match" step — not implemented.
- **Batch analysis:** Concurrency is 2 via `Promise.all([runNext(), runNext()])`. (A previous bug — `running.delete(acct.id)` referencing undefined `running` — has been removed.)

### 11.4 Context / Rate Limits

- **Prompt size:** One account + full engagement history + full available product catalog per request. Large accounts or huge catalogs could approach model context limits; no truncation in code.
- **Concurrency:** Batch runs 2 analyses in parallel; no configurable limit or rate handling for Anthropic.
- **No retries** on API failure.

### 11.5 Other

- **Anthropic auth:** Docs say "no API key needed"; implementation does not send API key. Production use requires adding auth (e.g. env-based key or server proxy).
- **Supabase RLS:** Policies allow anon read/insert/update for `gtm_upload_store`; no per-user isolation. Multi-user would require auth and RLS by user.

---

## 12. CURRENT vs. TARGET ARCHITECTURE

### 12.1 Data: Hardcoded vs Dynamic

- **Current:** Default data is hardcoded PRODUCTS and ACCOUNTS. Dynamic data: CSV upload and Supabase load (same eight tables). Supabase stores one blob per table key (no per-user); on load, products and accounts are rebuilt from those tables.
- **Target (live Salesforce):** Would require replacing "upload tables" with sync or API from Salesforce (Accounts, Contacts, Opportunities, Activities, etc.) and mapping to the same in-app shapes (Account, Contact, Quote, Engagement, etc.). Product catalog could remain upload or come from Salesforce Products/Price Books.

### 12.2 Analysis: Deterministic vs AI

- **Current:** Pre-score and action items are deterministic; opportunity type fallback is rule-based when AI is missing. All rich analysis (sentiment, strategy, outreach, product recs) is AI. No hybrid "rule + AI" product match in code.
- **Target:** Could add deterministic product matching (e.g. fit_signals vs. engagement text) for instant recs and use AI to refine or add narrative; or keep AI-only and improve prompt/context.

### 12.3 Changes for Live Salesforce Data

- **Data layer:** Replace or complement `loadUploadTablesFromSupabase` / `buildAccountsFromTables` with Salesforce API (REST or JS SDK) or a backend that syncs SF → same JSON shapes. Keep `products` and `accounts` state shape so existing components and AI prompt stay valid.
- **Writes:** Today there are no writes to CRM. Any "mark as contacted" or activity logging would need new API calls or backend.
- **Refresh:** Add periodic or on-demand refresh from Salesforce instead of one-time Supabase load on init.

### 12.4 Changes for Multiple Users

- **Auth:** Add Supabase Auth (or other) and require login. Pass user id or session to backend/Supabase.
- **Data isolation:** Supabase: add `user_id` (or similar) to `gtm_upload_store` or to a new table; RLS policies filter by `auth.uid()`. Then load/save only that user’s tables.
- **AI:** If AI runs client-side with a shared API key, results are still in-memory per browser. To share AI results across users or devices, persist `aiData` keyed by account id (and optionally user id) and load it from backend/Supabase.
- **Concurrency:** Batch analysis is per-session; no shared queue. Multi-user would not change that unless you add a server-side job queue.

---

*End of architecture document. Use this for planning features and refactors; if something is ambiguous in the codebase, it is noted above rather than assumed.*
