# Contributing

Setup is designed to take under 10 minutes. If it doesn't, that's a bug — open an issue.

## Setup

```bash
git clone https://github.com/hiamrhex/naijaaste-ai.git
cd naijaaste-ai
npm ci                    # Node 24
cp .env.example .env      # Windows: copy .env.example .env
# fill GEMINI_API_KEY + JWT_* (see README env table)
npm test                  # full suite, ~40s, no Docker needed (pg-mem)
npm run dev               # SPA :5173  (API: npm start → :3000)
```

## Rules

1. **Conventional commits** (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) — one logical change per commit.
2. **Never push red** — `npm run lint`, `npm test`, `npm run build` must all pass. CI enforces the same.
3. **Tests for behavior changes** — bug fixes arrive with a failing-first test; new endpoints arrive with contract tests (status + shape + auth cases).
4. **No secrets, ever** — `.env` is gitignored; secret-looking strings fail CI. If you leak one: rotate first, then purge history.
5. **Same SQL both drivers** — no Postgres extensions/CITEXT/arrays; dynamic `IN (...)` lists, never `= ANY($1)` (pg-mem gap, proven by test).
6. **Error contract** — failures go through `fail()` → `{ error: { code, message, details?, requestId } }`; new codes get a test in `tests/errors.test.js`.
7. **Docs stay true** — if you change behavior, update README/docs in the same PR; the drift job (`npm run check:docs`) fails the build otherwise.

## Security reports

Private only — see [SECURITY.md](SECURITY.md). Never open a public issue for a vulnerability.
