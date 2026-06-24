# Deploying the Data & Calculations prototype

This folder is a **static site** (HTML/CSS/JS + `dataset.json`). No build step — any
static host works. The repo's `.gitignore` excludes `dataset.json` and the big CSV;
the `.vercelignore` here re-includes `dataset.json` (the app needs it) and drops the
113 MB `data-anonymized.csv`. If `dataset.json` is missing, regenerate it:

```bash
python3 ../scripts/anonymize_client_data.py   # raw → data-anonymized.csv
python3 ../scripts/build_dataset.py            # → dataset.json (~19 MB)
```

## Option A — GitHub → Vercel (this repo, auto-deploys on push)

Repo: **https://github.com/DanDannDannn/datatabfw**

The app + `dataset.json` are committed. The repo root is the `prototypes` folder, so the
app lives in the `design_handoff_calculations_app` subfolder — point Vercel at it.

1. **Push the latest** (includes `dataset.json`, force-added past `.gitignore`):
   ```bash
   cd /Users/danwu/Forward-Earth/prototypes
   git push -u origin main      # if rejected: git pull origin main --rebase, then push
   ```
2. On **vercel.com → Add New → Project → Import** `DanDannDannn/datatabfw`.
3. Set **Root Directory** = `design_handoff_calculations_app`.
4. **Framework Preset** = `Other` (no build command, no output dir — it's static).
5. **Deploy.** Every future `git push` auto-redeploys.

The root `index.html` redirects to the app entry, so the share link is just the bare domain.

> Note: `dataset.json` is ~18 MB (fine for GitHub, under the 100 MB limit). The 113 MB
> `data-anonymized.csv` stays git-ignored — never commit it (it would exceed the limit).

## Option B — Vercel CLI (no GitHub, deploys local files)

```bash
npm i -g vercel
cd design_handoff_calculations_app
vercel        # → preview URL ;  vercel --prod → production URL
```

## Option C — Netlify Drop (fastest, no CLI)

Drag the `design_handoff_calculations_app` folder onto **app.netlify.com/drop** (make
sure `dataset.json` is in it). Instant link.

---

## Password

A lightweight client-side gate protects the link. Default password: **`forward-earth`**.

To change it, run this in the browser console and paste the result into
`PROTO_PASSWORD_SHA256` in `index.html`:

```js
crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR_NEW_PASSWORD'))
  .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('')))
```

⚠️ **This is a deterrent, not real security** — the page assets are still downloadable
and the gate is bypassable by anyone technical. For genuine protection use the host's
built-in auth: **Vercel** Deployment Protection → Password (Pro), **Netlify** site
password (Pro), or **Cloudflare Access** (has a free tier, email-based login).
