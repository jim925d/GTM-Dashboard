# Fix 404 — GitHub Pages checklist

Use **one** of these and complete every step.

---

## Method 1: GitHub Actions (recommended)

1. **Settings → Pages**
   - Open: https://github.com/jim925d/GTM-Dashboard/settings/pages  
   - Under **Build and deployment**, set **Source** to **GitHub Actions** (not "Deploy from a branch").  
   - Click **Save** if needed.

2. **Push the repo** so the workflow runs:
   ```powershell
   cd "c:\Users\james\OneDrive\Sales GTM"
   git add -A
   git status
   git commit -m "Deploy to GitHub Pages" 
   git push
   ```

3. **Actions tab**
   - Open: https://github.com/jim925d/GTM-Dashboard/actions  
   - Click the latest **"Deploy to GitHub Pages"** run.  
   - Wait until both **build** and **deploy** jobs are green (✓).

4. **Check the site**
   - After both jobs succeed, open: https://jim925d.github.io/GTM-Dashboard/  
   - If it still 404s, wait 1–2 minutes and refresh.

---

## Method 2: Deploy from branch (main / docs)

1. **Build and push the `docs` folder**
   ```powershell
   cd "c:\Users\james\OneDrive\Sales GTM"
   npm run build
   git add docs
   git status
   git commit -m "Add docs for GitHub Pages"
   git push
   ```

2. **Settings → Pages**
   - Open: https://github.com/jim925d/GTM-Dashboard/settings/pages  
   - **Source:** **Deploy from a branch**.  
   - **Branch:** **main**.  
   - **Folder:** **/docs** (if you don’t see it, wait a minute after pushing and refresh the Settings page).  
   - Click **Save**.

3. Wait 1–2 minutes, then open: https://jim925d.github.io/GTM-Dashboard/

---

## If it still 404s

- **Settings → Pages:** Confirm it says **"Your site is live at https://jim925d.github.io/GTM-Dashboard/"** (or similar). If it doesn’t, the source isn’t set correctly.
- **Private repo:** If the repo is private, GitHub Pages may be disabled or limited; try making the repo **Public** (Settings → General → Danger Zone) and then redeploy.
- **Cache:** Try a hard refresh (Ctrl+Shift+R) or another browser/incognito.
