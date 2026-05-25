# HDSI Profdle

Daily Wordle-style guess for a UCSD DSC faculty profile (Vite + React).

## Scripts

```bash
npm install
npm run dev      # develops; runs hire-year populate first
npm run build    # production build
npm run lint
```

**Canonical hire-year pipeline:** roster `yearsAtHdsi` → `years:populate` writes `hdsi-start-years.json` and syncs `hdsiStartYear` on each professor row. Details: [`scripts/README.md`](./scripts/README.md).

Course stats: **`npm run sunset:classes`**. Curated hubs/appointments: **`npm run research:patch`** (see **`scripts/patchresearchareas.mjs`**).

**In-house roster CSV** (review / planning): **`npm run roster:spreadsheet`** → [`roster/professors-roster.csv`](./roster/professors-roster.csv) (regenerate after editing `professors.json`).

## GitHub Pages

1. In the GitHub repo: **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
2. Push to **`main`** or **`master`**. The workflow **`.github/workflows/deploy-github-pages.yml`** (repo root) builds **`profdle/`** and deploys **`profdle/dist`**.
3. Project-site URL: **`https://<user>.github.io/<repo>/`** — e.g. repo `tritondle` → `/tritondle/`.

**`vite.config.js`** uses **`BASE_PATH`** for Vite **`base`**. CI sets it to the repo name; locally leave it unset (`/`).

**`username.github.io` user site** (served at domain root): delete the **`BASE_PATH`** line in the workflow build step’s **`env`** so **`base`** stays **`/`**.

**Preview a subpath build**

```bash
cd profdle && BASE_PATH=myrepo npm run build && npx vite preview --base /myrepo/
```
