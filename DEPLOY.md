# How to get the site live (fix 404)

Pick **one** of these.

---

## Option A: Publish from the `main` branch (no gh-pages needed)

1. **Build the site** (creates a `docs` folder):
   ```bash
   npm run deploy
   ```
   or `npm run build`

2. **Commit and push the `docs` folder:**
   ```bash
   git add docs
   git commit -m "Add built site for GitHub Pages"
   git push
   ```

3. **Turn on GitHub Pages and use `main` / `docs`:**
   - Repo: https://github.com/jim925d/GTM-Dashboard
   - **Settings** → **Pages**
   - Under **Build and deployment**:
     - **Source:** Deploy from a **branch**
     - **Branch:** `main` → **/docs** → **Save**

4. Wait 1–2 minutes. The site will be at:
   **https://jim925d.github.io/GTM-Dashboard/**

---

## Option B: Publish with GitHub Actions

1. **Enable Pages from Actions:**
   - Repo: https://github.com/jim925d/GTM-Dashboard
   - **Settings** → **Pages**
   - **Source:** **GitHub Actions** (not “Deploy from a branch”)

2. **Push the latest code** (including `.github/workflows/deploy-pages.yml`):
   ```bash
   git add -A
   git commit -m "Fix GitHub Pages deployment"
   git push
   ```

3. **Check the workflow:** **Actions** tab → “Deploy to GitHub Pages” should finish successfully.

4. The site will be at:
   **https://jim925d.github.io/GTM-Dashboard/**

---

If you still see 404, double-check **Settings → Pages**: Source is **Deploy from a branch** with **main** and **/docs** (Option A), or **GitHub Actions** (Option B).
