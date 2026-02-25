# GTM Intelligence Engine

AI-powered sales command center: daily briefing, engagement hub with AI strategy and outreach, account detail, and CSV upload. Uploaded data can be persisted with **Supabase** (optional).

## Demo locally

1. **Install dependencies** (one time):
   ```bash
   cd "c:\Users\james\OneDrive\Sales GTM"
   npm install
   ```

2. **Start the dev server**:
   ```bash
   npm run dev
   ```

3. Open the URL Vite prints (usually **http://localhost:5173**) in your browser.

**Optional — persist data:** Copy `.env.example` to `.env` and add your Supabase URL and anon key. Run the SQL in `supabase/migrations/20250225000000_gtm_upload_store.sql` in the Supabase SQL Editor. See **HOW-TO-UPLOAD.md** for details.

To stop the server, press `Ctrl+C` in the terminal.

## Build for production

```bash
npm run build
```

Output is in the `dist` folder. Serve it with any static host, or run `npm run preview` to preview the build locally.

## Docs

- **HOW-TO-UPLOAD.md** — Uploading CSV/Excel data (column names, steps, Supabase persistence, troubleshooting).
- **GTM-Intelligence-Data-Spec-and-Prompt-Template.md** — Full data spec and prompt template.
- **PROMPT-GTM-Intelligence-Engine.md** — Copy-paste prompt with placeholders for your data.
- **PRODUCT-AI-DESIGN.md** — Using product marketing material (fit signals, value props, use cases) so the AI recommends and pitches products in your language.
