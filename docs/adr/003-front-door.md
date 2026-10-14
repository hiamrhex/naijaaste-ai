# ADR 003 — Landing at `/`, app at `/app`

- Status: accepted. Date: 2026-10-14.
- Context: one URL served the app directly; there was no shareable front door, and auth deep-links need real paths.

## Options considered

1. **Static landing at `/` + SPA under `/app` (chosen)** — multi-page Vite build (`index.html` + `app.html`), router `basename: '/app'`.
2. SPA at root + landing at `/landing.html` — keeps build simple, but `/` opens the product, not the story; shared links land mid-app.
3. Subdomain split (`app.` vs root) — needs DNS + second Vercel project; overkill pre-launch.

## Decision

Root serves the zero-dependency landing page; vercel.json maps `/app` + `/app/*` to the SPA shell; React Router carries `basename: '/app'` so every Link/navigate stays correct.

## Why

- Marketing front door with 29KB first paint; product URLs stay clean (`/app/login`, `/app/map`).
- Single deploy, single domain.

## Consequences

- Good: OG/social previews point at landing; auth links are shareable.
- Bad: dev serves the app at `/app.html` (Vite multi-page), prod at `/app/` — one documented deviation.
- Wrong if: the SPA needs SSR/SEO — then revisit with a framework router.
