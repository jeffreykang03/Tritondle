# HDSI Profdle

Daily Wordle-style guess for a UCSD DSC faculty profile (Vite + React).

## Scripts

```bash
cd profdle
npm install
npm run dev      # http://localhost:5173 (runs years:populate first)
npm run serve    # production build + preview at http://localhost:4173
npm run lint
```

`npm run build` alone only writes `dist/` — it does not open a server. Use **`dev`** or **`serve`**.

Local builds always use site root `/`. GitHub Pages uses `npm run build:pages` in CI (`/tritondle/` when the repo is named `tritondle`).

**HDSI tenure (`ucsdStartYear`):** Each professor row stores a roster-listed **start calendar year** (shown as years at UCSD in-game). **`npm run years:populate`** merges `professors.json` + **`src/data/hdsi/ucsd-start-years.manual.json`**, refreshes **`ucsd-start-years.json`**, and syncs rows. Full process: **[`docs/ucsd-years-data.md`](./docs/ucsd-years-data.md)** (older **`docs/dsc-tenure-data.md`** redirects).

```bash
npm run years:populate   # run alone or via prebuild / predev
npm run years:sync       # apply existing ucsd-start-years.json only
npm run years:wipe       # remove start year field from every row (hard reset; clears legacy keys too)
```

Course stats: **`npm run sunset:classes`**. Curated hubs/appointments: **`npm run research:patch`** (see **`scripts/patchresearchareas.mjs`**).

**In-house roster CSV** (review / planning): **`npm run roster:spreadsheet`** → [`roster/professors-roster.csv`](./roster/professors-roster.csv) (regenerate after editing `professors.json`).

## GitHub Pages

1. In the GitHub repo: **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
2. Push to **`main`** or **`master`**. The workflow **`.github/workflows/deploy-github-pages.yml`** (repo root) builds **`profdle/`** and deploys **`profdle/dist`**.
3. Project-site URL: **`https://<user>.github.io/<repo>/`** — e.g. repo `tritondle` → `/tritondle/`.

**`vite.config.js`** uses subpath **`base`** only when **`GH_PAGES=1`** (set in CI). Ordinary **`npm run build`** / **`npm run dev`** always use **`/`**.

**`username.github.io` user site** (served at domain root): remove **`GH_PAGES`** / **`BASE_PATH`** from the workflow build **`env`**.

**Preview a Pages-style subpath build**

```bash
cd profdle && npm run build:pages && npx vite preview --open --base /tritondle/
```
