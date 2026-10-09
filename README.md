# NaijaTaste AI

Nigerian restaurant discovery engine. A guest chats in English or Pidgin; the app
extracts a dining persona, recommends from a curated catalogue of 63 restaurants
across 8 Nigerian cities, generates reviews, and remembers the session.

One repo, two processes:

- **API** — Express 4 (`src/server.js`): persona extraction, preferences, recommendations, review generation, and chat, with Groq (llama-3.3-70b-versatile) behind `src/services/llm.service.js`.
- **UI** — React 19 + Vite single-page app (`src/NaijaTasteAI.jsx`).

## Quickstart

Prerequisites: Node 20.19+ (or 22 LTS), npm.

```bash
cp .env.example .env      # then set GROQ_API_KEY
npm install

npm run dev:server        # API on http://localhost:3000
npm run dev               # UI on http://localhost:5173 (separate terminal)
```

> **UI → API base URL:** `src/constants/index.js` exports `API`, which defaults to
> the deployed Railway URL. Point it at `http://localhost:3000` to use your local API.

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

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/health` | Health check + endpoint list |
| POST | `/extract-persona` | Free-text chat log → structured dining persona |
| POST | `/update-preference` | Record a preference signal (dimension/value/rating) |
| POST | `/recommend` | Persona → ranked restaurant recommendations |
| POST | `/generate-review` | Persona + restaurant → realistic review |
| POST | `/chat` | Stateful session chat (persona extraction → review → recommend) |
| GET | `/chat/:sessionId` | Fetch a stored session |
| DELETE | `/chat/:sessionId` | Clear a session |

## Configuration

| Variable | Required | Notes |
|----------|----------|-------|
| `GROQ_API_KEY` | yes | Groq API key — `.env` is git-ignored, never commit it |
| `PORT` | no | Defaults to 3000 |

## Testing & CI

`npm run lint` and `npm test` are the merge gate. CI
(`.github/workflows/ci.yml`) runs install → lint → test → build on every push.

## Docker

```bash
docker compose up --build    # API on http://localhost:3000
```

The image runs `node src/server.js` directly; pass `GROQ_API_KEY` via the
environment (compose reads it from your shell).

## Project structure

```
src/
  server.js          entry: boot + listen
  app.js             Express app: middleware, routes, 404/error handlers
  routes/            chat, persona, recommend, review
  services/          llm, chat, persona, recommend, review
  prompts/           LLM prompt builders
  data/              restaurants.json catalogue, sessions.json (runtime)
  lib/ utils/        helpers
  NaijaTasteAI.jsx   UI root; components/, constants/, styles/
tests/               Vitest + Supertest API tests
plans/               Hardening implementation plans (see plans/README.md)
```

## Status

Verification baseline is in place (lint gate, test suite, CI). Remaining
hardening plans are recorded in [`plans/README.md`](plans/README.md) and are
deferred until after product pilots.
