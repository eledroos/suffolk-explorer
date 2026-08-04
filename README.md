# Suffolk DA Explorer

A client-only, Tableau-style explorer for Suffolk County (MA) District
Attorney charge-level data, 2022–2025, assembled from public records
requests. 200,630 charges; adult courts only. React + Vite + TypeScript;
no server, no telemetry — the parquet loads into the browser and every
aggregation runs locally.

Built around three ideas:

- **A lens, not a date picker.** Filings and dispositions are different
  cohorts. The lens toggle selects the correct date axis and window filter so
  the two cannot be mixed by accident.
- **User-defined categories.** Group disposition values (or any categorical)
  into named buckets — build your own "declination" composite, save it
  locally, export it as JSON, and argue about it in the open.
- **The data warns about itself.** Views that touch known holes (Suffolk
  Superior dispositions after Sep 2024, right-censored recent cohorts, the
  2025 sealing attrition) show a notice explaining the limitation. These come
  from a documented source-verification effort, not vibes.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine tests assert verified ground-truth counts
npm run build      # typecheck + production bundle in dist/
```

## Data

`public/data/hayden.parquet` (3.2 MB, zstd) ships in the repo. It is built by
`scripts/prepare_data.py` from `hayden-era-charges-2022-2025.csv`, which is
itself assembled from the original SCDAO deliveries (see the data dictionary
in the source project). Column types are baked into `src/contract.ts`.

To serve the data from Cloudflare R2 instead of the repo:

1. Upload `hayden.parquet` to an R2 bucket.
2. Allow CORS on the bucket for your Pages domain:
   `[{"AllowedOrigins":["https://<your-app>.pages.dev"],"AllowedMethods":["GET"],"AllowedHeaders":["*"]}]`
3. Set the Pages env var `VITE_DATA_URL=https://<bucket-public-url>/hayden.parquet`
   and redeploy. Nothing else changes.

## Deploy to Cloudflare Pages

- Framework preset: Vite. Build command: `npm run build`. Output dir: `dist`.
- The app itself is fully static; the only server-side piece is the optional
  password gate below.

### Password protection (optional)

`functions/_middleware.ts` gates every request — the app, its assets, and the
parquet — behind a password when the env var **`APP_PASSWORD`** is set in the
Pages project (Settings → Environment variables; set it for Production and
Preview). Successful login stores a 30-day HttpOnly cookie holding a SHA-256
token; the password itself never reaches the client or the bundle.

- No `APP_PASSWORD` set → the site is open. Local `npm run dev` never runs
  the gate (Vite doesn't execute Pages Functions).
- To test the gate locally:
  `npm run build && npx wrangler pages dev dist --binding APP_PASSWORD=yourpassword`
  (a plain shell env var is not a Worker binding and will not arm the gate).
- Changing the password invalidates existing cookies automatically, since the
  cookie token is derived from it.
- Caveat: if you move the parquet to a public R2 bucket via `VITE_DATA_URL`,
  the data file itself is no longer behind the gate — keep it in the repo (or
  a private bucket proxied through the same Pages project) if the gate should
  cover the data.

## Provenance, in one paragraph

The dataset merges five SCDAO public-records deliveries (Oct 2024, Feb 2025,
two of Mar 2026, Jul 2026), deduplicated on charge identity with per-row
source columns. Yearly totals were verified against independent deliveries
(agreement 98.35–99.99% where two sources overlap). Known limitations are
listed in the in-app About panel; the two material ones are missing Suffolk
Superior dispositions from Oct 2024 through Dec 2025 (records request
pending) and ~2–3% undercount of 2025 filings from case sealing. Judge and
sentencing fields are absent or unusable in the underlying productions.
