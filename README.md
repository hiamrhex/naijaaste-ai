# NaijaTaste AI

Nigerian restaurant discovery engine. A guest chats in English or Pidgin; the app
extracts a dining persona, recommends from a curated catalogue of 63 restaurants
across 8 Nigerian cities, generates reviews, and remembers the session.

One repo, two processes:

- **API** — Express 4 (`src/server.js`): JWT auth (signup/signin/refresh), an
  autonomous tool-calling agent, persona extraction, preferences, recommendations,
  review generation, and chat, with Gemini (`gemini-3.8-flash`) behind
  `src/services/llm.service.js`.
- **UI** — React 19 + Vite single-page app (`src/NaijaTasteAI.jsx`) with an
  auth gate, dark/light design tokens, and agent tool traces.

## Quickstart

Prerequisites: Node 22.12+ (Node 24 recommended), npm.

```bash
cp .env.example .env      # then set GEMINI_API_KEY + JWT secrets
npm install

npm run dev:server        # API on http://localhost:3000
npm run dev               # UI on http://localhost:5173 (separate terminal)
```

Generate JWT secrets:

```bash
node -e "console.log('JWT_ACCESS_SECRET='+require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET='+require('crypto').randomBytes(32).toString('hex'))"
```

> **UI → API base URL:** `src/constants/index.js` exports `API`, which points at
> `http://localhost:3000` in dev and the deployed Railway URL in production.
> Override with `VITE_API_URL`.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm start` | Run the API (serves `public/`) on `PORT`, default 3000 |
| `npm run dev:server` | Run the API with `node --watch` (restart on change) |
| `npm run dev` | Vite dev server with HMR for the UI |
| `npm run build` | Production UI bundle → `dist/` |
| `npm run preview` | Preview the built UI locally |
| `npm run lint` | ESLint across the repo (Node + browser contexts split) |
| `npm test` | Vitest + Supertest API tests (`tests/`) |
| `npm run evaluate` | Recommendation quality metrics: NDCG@5 and RMSE vs `src/data/restaurants.json` |

## API

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/health` | — | Health check + endpoint list |
| POST | `/auth/signup` | — | Create account (bcrypt-12, returns JWT pair, rate-limited) |
| POST | `/auth/signin` | — | Sign in (generic 401 on bad credentials) |
| POST | `/auth/refresh` | cookie | Rotate refresh token → new access token |
| POST | `/auth/signout` | cookie | Revoke refresh token, clear cookie |
| GET | `/auth/me` | Bearer | Current user profile |
| POST | `/agent` | Bearer | **Autonomous agent**: ReAct loop with typed tools (search restaurants, recommend, generate review, save preference), 6-step guardrail, per-run trace |
| POST | `/extract-persona` | — | Free-text chat log → structured dining persona |
| POST | `/update-preference` | — | Record a preference signal (dimension/value/rating) |
| POST | `/recommend` | — | Persona → ranked restaurant recommendations |
| POST | `/generate-review` | — | Persona + restaurant → realistic review |
| POST | `/chat` | — | Stateful session chat (persona extraction → review → recommend) |
| GET | `/chat/:sessionId` | — | Fetch a stored session |
| DELETE | `/chat/:sessionId` | — | Clear a session |

## Architecture

Production-grade posture, per current best practice:

- **AuthN/AuthZ** — short-lived HS256 access tokens (15 min) + rotating refresh
  tokens (7 d) stored server-side and delivered in `httpOnly; SameSite=Strict`
  cookies scoped to `/auth`. bcrypt cost 12, algorithm allowlists on every
  `jwt.verify`, generic credential errors (no user enumeration), in-memory
  rate limiting on auth routes.
- **Autonomous agent** — cognition is separated from execution: the model only
  proposes typed `functionCall`s (`src/agent/tools.js`), the harness validates
  and executes them, feeds `functionResponse`s back, and enforces a 6-step
  ceiling. Every run returns an observable `trace` (tool, ok, ms) surfaced in
  the UI as chips.
- **Hardening** — `helmet` headers, `compression`, payload limit 10 kb,
  global rate limit (600/15 min), structured request logs, graceful SIGTERM
  drain with a 10 s timeout, `unhandledRejection`/`uncaughtException` traps.
- **Scale path** — auth is stateless (JWT), so the API is horizontally
  scalable behind a load balancer today; file-based stores are the dev
  default and swap for Postgres/Redis (plan 007) before multi-instance
  deploys. Compression + rate limiting + gzip offload keep p99 flat.

## Configuration

| Variable | Required | Notes |
|----------|----------|-------|
| `GEMINI_API_KEY` | yes | Google AI Studio key — `.env` is git-ignored, never commit it |
| `JWT_ACCESS_SECRET` | yes | 32-byte random hex (see Quickstart) |
| `JWT_REFRESH_SECRET` | yes | 32-byte random hex, different from access |
| `GEMINI_MODEL` | no | Defaults to `gemini-3.8-flash` |
| `PORT` | no | Defaults to 3000 |
| `VITE_API_URL` | no | UI override for the API base URL |

## Testing & CI

`npm run lint` and `npm test` are the merge gate. CI
(`.github/workflows/ci.yml`) runs install → lint → test → build on every push.
The suite covers the legacy API baseline plus the full auth flow
(signup/signin/me/refresh rotation/signout, agent 401/400).

## Docker

```bash
docker compose up --build    # API on http://localhost:3000
```

The image runs `node src/server.js` directly; pass `GEMINI_API_KEY`,
`JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` via the environment (compose
reads them from your shell).

## Project structure

```
src/
  server.js          entry: boot + listen + graceful shutdown
  app.js             Express app: security middleware, routes, 404/error handlers
  auth/              users store, JWT tokens, requireAuth middleware
  agent/             ReAct loop (agent.js) + typed tool registry (tools.js)
  routes/            auth, agent, chat, persona, recommend, review
  services/          llm, chat, persona, recommend, review
  prompts/           LLM prompt builders
  data/              restaurants.json catalogue, sessions.json/users.json (runtime)
  lib/               auth client (browser)
  utils/             helpers
  NaijaTasteAI.jsx   UI root; components/ (AuthGate, GithubIcon, cards), constants/, styles/
tests/               Vitest + Supertest API tests
plans/               Hardening implementation plans (see plans/README.md)
```

## Status

Elite upgrade shipped: JWT auth, autonomous agent, security middleware,
graceful shutdown, and a full test suite (17 tests). Remaining hardening
plans are recorded in [`plans/README.md`](plans/README.md) and are deferred
until after product pilots.
