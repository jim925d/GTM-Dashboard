# How to Upload CSV or Excel Data to the GTM Intelligence Engine

This guide explains how to get your Salesforce (or other CRM) data into the app using CSV files. The app accepts **CSV only** in the upload UI; if your data is in Excel, save each sheet as CSV first.

---

## What You Need

The engine expects up to **8 data tables**. You can upload one file per table. Column names (headers) in your file should match the names below so the app can map them correctly. The app accepts common variants (e.g. `account_id` or `Account ID` — spaces and case are normalized).

| Table | Purpose | Required columns (examples) |
|-------|---------|-----------------------------|
| **Product Catalog** | Your sellable products and fit signals | `product_name`, `category`, `mrr`, `description`; optional: `fit_signals`, `value_props`, `use_cases` (for AI recommendations and outreach) |
| **Accounts** | Account master list | `account_id`, `account_name`, `industry`, `tier`, `mrr`, `contract_end` |
| **Locations** | Sites/addresses per account | `account_id`, `address`, `net_status` |
| **Current Products** | What each account already has | `account_id`, `product_name` |
| **Quotes / Pipeline** | Open opportunities | `account_id`, `product_name`, `quoted_mrr`, `quote_date`, `status`; optional: `close_date` (YYYY-MM-DD for current-month filter), `notes` |
| **Contacts** | People and engagement level | `account_id`, `contact_name`, `title`, `engagement_level`, `email`, `last_touch` |
| **Engagement History** | Activities and notes | `account_id`, `date`, `type`, `notes` |
| **Prior / Churned Services** | Churned or prior services | `account_id`, `service_description` |

**Important:** Use the **same `account_id`** in every table for the same account (e.g. Salesforce 18-character Account ID). This is how the app joins data.

---

## Step 1: Export from Salesforce (or Your CRM)

1. Create reports that include the columns in the table above (see **GTM-Intelligence-Data-Spec-and-Prompt-Template.md** for full Salesforce report guidance).
2. Run each report and export:
   - **Salesforce:** Report → **Export** → choose **Comma Delimited (.csv)** (or **Excel** if you prefer; see Step 2).
   - Ensure the first row is the **header row** with column names.
   - Use a consistent date format (e.g. **YYYY-MM-DD**).

---

## Step 2: Get CSV Files

- **If you exported CSV from Salesforce:** Use the file as-is. If it has extra columns, that’s fine; the app only uses the columns it recognizes.
- **If you exported Excel:**  
  1. Open the workbook in Excel.  
  2. For each sheet you need (Accounts, Locations, etc.): **File → Save As**.  
  3. Choose **CSV (Comma delimited) (*.csv)** or **CSV UTF-8**.  
  4. Save with a clear name (e.g. `accounts.csv`, `locations.csv`).

**Tips:**

- Avoid commas inside cell values, or wrap the whole value in double quotes (e.g. `"Acme, Inc."`).
- Keep notes/descriptions short (1–2 sentences).
- Use the same product names and account IDs across all files.

---

## Step 3: Upload in the App

1. Open the GTM Intelligence Engine app.
2. In the left sidebar, click **Upload Data**.
3. **Option A:** Drop multiple CSVs in the drop zone — the app detects type and lets you assign each to a function, then **Load all and map to dashboard**. **Option B:** Click a function card (Accounts, Locations, etc.) and choose the table that matches your file (e.g. **Accounts**, **Locations**, **Product Catalog**).
4. Click **Choose CSV file** and select your file.
5. The app parses the file and shows either:
   - **✓ [Table name]: N rows loaded**, or  
   - An error message (e.g. “No rows found” — usually means no header row or empty file).
6. Repeat for each table you have. You can upload in any order, but:
   - **Accounts** should usually be uploaded first (or at least before Locations, Quotes, Contacts, Engagement, Churned), so the app can attach the other data to the right accounts.
   - **Product Catalog** can be uploaded anytime; it’s independent.

After each successful upload, **Dashboard mapping status** shows how many rows are loaded per function. Column headers are auto-mapped (e.g. Account ID to account_id). Uploading the same table again **replaces** that table’s data (e.g. uploading Accounts again replaces all account rows and rebuilds accounts from the new file plus any already-loaded Locations, Quotes, etc.).

---

## Step 4: Use Your Data

- Switch to **Daily Briefing** or **Engagement Hub** to see your accounts and run AI analysis.
- To go back to the built-in sample data, click **Load sample data** on the Upload Data screen. This resets all tables and reloads the demo accounts and products.

---

## Optional: Persist data with Supabase

If you configure **Supabase**, the app saves your uploaded tables to the cloud and restores them when you reload the page (or open the app on another device). Without Supabase, data is in-memory only and is lost on refresh.

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is fine).
2. **Run the migration**: In the Supabase Dashboard → **SQL Editor**, run the SQL in `supabase/migrations/20250225000000_gtm_upload_store.sql` to create the `gtm_upload_store` table and policies.
3. **Get your API keys**: Dashboard → **Project Settings** → **API** — copy the **Project URL** and **anon public** key.
4. **Configure the app**: In the project root, copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL` = your Project URL  
   - `VITE_SUPABASE_ANON_KEY` = your anon key  
   Restart the dev server after changing `.env`.
5. **Build/deploy**: For production (e.g. GitHub Pages), set the same env vars in your host’s environment or build config so they are available at build time.

Once configured, every CSV upload (and **Load sample data**) is persisted to Supabase and loaded on next visit.

---

## Column Name Reference (for your CSV headers)

Use these (or close variants; the app normalizes spaces and case):

**Product Catalog**

- `product_name`, `category`, `mrr`, `description` (required)
- `fit_signals` — comma-separated keywords that indicate when to recommend (e.g. "multiple locations, MPLS, bandwidth")
- `value_props` — short value propositions for outreach (e.g. "Single pane of glass; reduce MPLS spend")
- `use_cases` — when/for whom this product fits (e.g. "Multi-site enterprises replacing MPLS")

**Accounts**

- `account_id`, `account_name`, `industry`, `tier`, `mrr`, `contract_end`

**Locations**

- `account_id`, `address`, `net_status` (e.g. `on-net`, `near-net`, `off-net`)

**Current Products**

- `account_id`, `product_name` (optional: `mrr`)

**Quotes / Pipeline**

- `account_id`, `product_name`, `quoted_mrr`, `quote_date`, `status` (e.g. `pending`, `stalled`, `pending-board`, `closed-lost`), `notes`. Optional: `close_date` (YYYY-MM-DD) — used to show “Open Pipeline (current month)” in the briefing.

**Contacts**

- `account_id`, `contact_name`, `title`, `engagement_level` (`champion`, `engaged`, `cooling`, `cold`), `email`, `last_touch`

**Engagement History**

- `account_id`, `date`, `type` (e.g. QBR, Call, Email, Quote Sent, Support Ticket, Event, Churn Event), `notes`

**Prior / Churned Services**

- `account_id`, `service_description`

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| “No rows found” | Ensure the file has a header row and at least one data row. Save as CSV UTF-8 if using Excel. |
| Accounts missing locations or quotes | Upload **Accounts** first, then **Locations**, **Quotes**, etc. Each table is merged by `account_id`. |
| Wrong numbers or missing data | Check that `account_id` is identical across files for the same account (no extra spaces, same ID in every table). |
| Excel file not accepted | The upload only accepts CSV. In Excel use **File → Save As → CSV (Comma delimited)** or **CSV UTF-8**. |
| Product names don’t match | Use the exact same product names in **Product Catalog**, **Current Products**, and **Quotes** (e.g. “SD-WAN Managed” everywhere). |

For full report definitions and the prompt template used to build the app, see **GTM-Intelligence-Data-Spec-and-Prompt-Template.md**. For how to use marketing material (value props, use cases, fit signals) so the AI recommends and pitches products in your language, see **PRODUCT-AI-DESIGN.md**.
