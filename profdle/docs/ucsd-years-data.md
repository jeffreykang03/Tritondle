# HDSI tenure column (data & how we maintain it)

This document is the **source of truth for humans** on how the game’s **HDSI tenure** column is produced (internal field **`ucsdStartYear`**). Code paths: `src/utils/ucsdYears.js` and `scripts/years.mjs`.

**Current state:** if automated scraping misses someone, **`ucsdStartYear`** may be absent; those rows show **—** for HDSI tenure until filled. Run **`npm run years:populate`** after changing years.

_(Older link: **`dsc-tenure-data.md`** redirects here.)_

## What the column means

The puzzle column counts **whole calendar years at UC San Diego** derived from **`ucsdStartYear`** (formerly `hdsiStartYear`), **not** a separate “DSC-only” tenure product:

- **HDSI tenure** (display) = **`puzzle calendar year − ucsdStartYear`**, floored at 0. **`ucsdStartYear`** is the **earliest calendar year we store** where the person is on **UC San Diego** in an academic/faculty-relevant capacity we could extract, using automated passes over:
  - **HDSI** **`/people/`** bios on `datascience.ucsd.edu` (e.g. joined UCSD, rank + year, sometimes SDSC when that’s what the bio gives);
  - **`profiles.ucsd.edu`** rows pairing **UC San Diego** with **Halıcıoğlu Data Science Institute / HDSI** when we need another source.
- It is **not** HR tenure, payroll, promotion year, or a guarantee about any single official job title — just “years since **our** scraped/list **start year** at UCSD.” Tight interpretations need **`ucsd-start-years.manual.json`** or edits to **`professors.json`**.

## Canonical field in `professors.json`

Each active row may include:

| Field | Type | Meaning |
|--------|------|---------|
| **`ucsdStartYear`** | integer (calendar year) | **Start calendar year at UC San Diego for this roster** as scraped/edited (**approximate**). Not “HDSI brand launch” semantics. |

Displayed duration comes from **`getUcsdYears`** (`src/utils/ucsdYears.js`): **`puzzleYear − ucsdStartYear`** (floored at 0). There is no separate “years counted” roster field.

## Manual overrides

Optional file: **`src/data/hdsi/ucsd-start-years.manual.json`**

- JSON object: **`"professor-id": startYear`**
- **`years:populate`** merges these **after** inline **`ucsdStartYear`**, so manual entries **win** for those ids.

## Scripts (`npm` → `scripts/years.mjs`)

| Command | What it does |
|---------|----------------|
| **`npm run years:populate`** (default) | Reads **`ucsdStartYear`** on active rows + **`ucsd-start-years.manual.json`**, writes **`ucsd-start-years.json`**, **`ucsd-start-years.roster-provenance.json`**, syncs **`professors.json`**. Warns when start year is missing. |
| **`npm run years:sync`** | Applies an existing **`ucsd-start-years.json`** to **`professors.json`** only. |
| **`npm run years:wipe`** | Strips **`ucsdStartYear`** (and legacy **`hdsiStartYear`**) from every professor row. |
| **`npm run years:draft-site`** | Scrapes **`/faculty/`** (name→slug), **`/people/{slug}`** bios + heuristic + optional **`profiles.ucsd.edu`**. Overrides: **`hdsi-people-slug-overrides.json`**, **`hdsi-profiles-slug-overrides.json`**. **`PROFDLE_SKIP_PROFILES=1`** skips Profiles. Dry-run. |
| **`npm run years:draft-site:apply`** | Same crawl, writes matched **`ucsdStartYear`**; then run **`years:populate`**. |

`predev` / `prebuild` run **`years:populate`**.

## TLS (`draft-site` only)

Some networks fail TLS verification against `datascience.ucsd.edu`; you can run:

`PROFDLE_FETCH_INSECURE_TLS=1 npm run years:draft-site`

That disables certificate verification **only for that crawler** — use caution on untrusted networks.

## Semi-automatic draft (`draft-dsc-start-years-from-site.mjs`)

1. **`npm run years:draft-site`** (optional **`-- --limit=N`**).
2. Review **`ucsd-start-years.web-draft.json`** vs **`ucsd-start-years.web-draft.unmatched.json`**.
3. Slug tweaks: **`hdsi-people-slug-overrides.json`** (HDSI site). **`hdsi-profiles-slug-overrides.json`** (**`profiles.ucsd.edu`** usernames).
4. **`npm run years:draft-site:apply`**, then **`npm run years:populate`**.

The crawler prefers explicit hire phrases on HDSI bios (“joined UC San Diego in …”, employment “**2020 – Present** … HDSI”, etc.). If missing, it follows the **Website** / **CV** link on the people page, pulls **`cv.pdf`** (or an HTML CV), and reads employment lines like “**2020 – Present** … Halıcıoğlu / UC San Diego”. Then **UCSD Profiles**, then **English Wikipedia** when available. Ph.D.-year guessing is **off** unless you set `PROFDLE_ALLOW_PHD_PROXY=1`. Spot‑check outliers—CVs and Wikipedia can disagree or be missing.

## How to add or fix a professor

1. Set **`ucsdStartYear`** on the row or in **`ucsd-start-years.manual.json`** from public sources you trust for **UCSD start**.
2. **`npm run years:populate`**.

## Accuracy & limitations

- Scrapers can confuse **grant years**, **PhD years**, **SDSC** vs departmental hire — spot-check outliers.
- **Profiles** fellowship rows may predate ladder rank in the narrative sense.
- Re-run drafts after big bio edits.

## Historical note

Earlier versions stored a derived **`yearsAtHdsi`** counter; later we standardized on **calendar start year**. The JSON field **`hdsiStartYear`** was renamed **`ucsdStartYear`** while the UI column label is **HDSI tenure**.
