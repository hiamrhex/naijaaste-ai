# ADR 002 — Same-origin API on Vercel (`/api` rewrite)

- Status: accepted. Date: 2026-10-11.
- Context: SPA + API needed one deploy with working cookies and no CORS dance.

## Options considered

1. **Same-origin rewrite (chosen)** — `vercel.json` maps `/api/*` → serverless function; SPA uses relative `/api/…`.
2. Separate API host + CORS allowlist — extra host to babysit, preflight latency, cookie `SameSite=None; Secure` complexity.
3. Railway/Render persistent host — viable, but user constraint is Vercel-only.

## Decision

`api/index.js` strips the `/api` mount prefix and dispatches to the Express app; `maxDuration: 60` for slow Gemini calls. Dev parity via Vite proxy (`/api` → `:3000`, prefix rewritten).

## Why

- Cookies (root-path refresh token) just work; no CORS in the hot path.
- One deploy, one domain, one env surface.

## Consequences

- Good: no preflight, no cookie partitioning issues.
- Bad: bound to Vercel Hobby ceilings (300s, 4.5MB bodies, single region).
- Wrong if: traffic needs multi-region or websockets — then split the API out.
