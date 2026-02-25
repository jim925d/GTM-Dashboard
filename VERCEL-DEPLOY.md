# Deploy GTM Intelligence Dashboard to Vercel

## 1. Push your project to Git

Make sure your code is in a Git repo (GitHub, GitLab, or Bitbucket) that Vercel can access.

## 2. Create a Vercel project

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub/GitLab/Bitbucket).
2. Click **Add New…** → **Project**.
3. **Import** your repository (e.g. the one containing this Sales GTM folder).
4. Set the **Root Directory** to the folder that contains `package.json`, `vercel.json`, and `api/` (e.g. `Sales GTM` or `.` if the repo root is this project).

## 3. Configure build (usually auto-detected)

Vercel should use `vercel.json`:

- **Build Command:** `npm run build`
- **Output Directory:** `docs`
- **Framework Preset:** Vite

No need to change these unless you use a monorepo or different root.

## 4. Set environment variables

In the Vercel project: **Settings → Environment Variables**. Add:

### Client (exposed to the browser)

| Name | Value | Notes |
|------|--------|------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | From [Supabase](https://supabase.com/dashboard) → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Same place, anon public key |
| `VITE_MAPBOX_TOKEN` | `pk....` | From [Mapbox Access Tokens](https://account.mapbox.com/access-tokens/) (public token) |

### Server (API routes only, not exposed)

| Name | Value | Notes |
|------|--------|------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | From [Anthropic Console](https://console.anthropic.com/) |
| `SUPABASE_URL` | `https://your-project.supabase.co` | Same as above |
| `SUPABASE_SERVICE_KEY` | `eyJ...` | Supabase **service_role** key (Project Settings → API), keep secret |

Apply to **Production**, **Preview**, and **Development** as needed.

## 5. Deploy

- Click **Deploy** (or push to the connected branch).
- Vercel will run `npm run build` and deploy the `docs/` output plus the `api/` serverless functions.

## 6. Base path

The app defaults to `base: '/'` so it works at the root URL on Vercel (e.g. `https://gtm-dashboard.vercel.app/`). No env var needed for a normal Vercel deploy.

**If you use GitHub Pages** at `username.github.io/GTM-Dashboard/`, set **Build** env var `VITE_BASE_PATH=/GTM-Dashboard/` when building that site.

## 7. Supabase: run the AI results migration

If you haven’t already, run the migration that creates the `ai_results` table:

1. Supabase Dashboard → **SQL Editor**.
2. Run the contents of `supabase/migrations/20250225100000_ai_results.sql`.

## 8. Test

- Open your Vercel URL.
- Upload data or load sample data, then run **Run AI Analysis**. If the API and env vars are correct, analysis runs and results are stored in Supabase.

## Troubleshooting

- **White screen:** The app is built with `base: '/'` by default, so it should load at your Vercel root URL. If you still see a blank page, open the browser **Developer Tools → Console** and check for errors (e.g. failed to fetch chunks = path issue; red errors = runtime bug).
- **404 on /api/analyze:** Ensure the repo root (or Root Directory) contains the `api/` folder and that the deployment finished without errors.
- **Analysis fails / 500:** Check Vercel **Functions** logs; confirm `ANTHROPIC_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_KEY` are set for the environment you’re using.
- **No map:** Add `VITE_MAPBOX_TOKEN` and ensure locations have `lat`/`lng` in your data.
