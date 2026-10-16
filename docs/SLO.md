# Service Level Objectives

> Written 2026-10-16. Percentile targets follow Google SRE Book ch.4
> (https://sre.google/sre-book/service-level-objectives/): SLOs are measured
> in percentiles over a rolling window, and an error budget exists so
> reliability work is prioritised by numbers, not vibes.

## The four SLOs

| # | SLI | Target | Window | Error budget |
|---|---|---|---|---|
| 1 | **Availability** — `GET /health` returns 200 | 99.5% of requests | 30 days | 3.6 h/month |
| 2 | **Latency (non-AI)** — `GET /api/v1/nearby` p95 | < 500 ms (same-region caller) | 7 days | budget spent on every p95 breach day |
| 3 | **Latency (AI)** — `POST /api/v1/chat` p95 | < 10 s end-to-end | 7 days | same |
| 4 | **AI success rate** — `POST /api/v1/chat` returns 2xx (502 counts as failure) | ≥ 95% | 7 days | 5% of turns may fail before action |

### Why these numbers

- **99.5%, not 99.9%:** the service runs on a single Vercel Hobby function and
  a Neon free-tier database with no multi-region failover. 99.9% (43 min/month)
  would be a promise the architecture cannot keep; 3.6 h/month is honest for
  the current shape. Raising it requires paid tier + health-check automation.
- **500 ms non-AI p95:** the measured local→Neon round trip is 175–230 ms per
  query (`docs/EVIDENCE.md`, load-ramp section). A same-region caller (Vercel
  `iad1` → Neon us-east-2) should sit far below 500 ms; if p95 exceeds it, the
  pool (`max: 3` in `src/db/pool.js:18`) or a cold start is the cause.
- **10 s AI p95:** the LLM path has a 20 s per-attempt timeout plus up to 2
  retries with backoff (`src/services/llm.service.js`). 10 s p95 means the
  typical turn succeeds on first attempt; the 20 s tail is allowed to exist
  but must stay rare.
- **95% AI success:** a deterministic fallback exists for `/recommend`
  (`src/services/recommend.service.js`) but not for `/chat`. 5% of chat turns
  may return 502 before the budget forces a chat fallback to be built.

## How each is measured (and the honest gap)

| SLI | Measurement method | Status |
|---|---|---|
| Availability | Uptime probe on `GET /health` | **Tooling missing** — no monitor configured. Until one exists, availability is only observable by manual checks. Candidate free tools: UptimeRobot, BetterStack free tier. |
| Latency non-AI | pino structured logs carry `duration_ms` per request (`request completed` lines) | Collected, **not aggregated** — no pipeline computes rolling p95 yet. One-off numbers exist only from the local autocannon run (labelled not representative). |
| Latency AI | same log lines on `/chat` | same gap |
| AI success rate | same, filtered by path + status class | same gap |

**The gap is the point:** four SLOs are defined, but no aggregation pipeline
or alerting exists to enforce them. Until that lands, these are targets the
system is *held to by review*, not *enforced by machinery*. Tracked as gap
G-3 in `docs/AUDIT.md`.

## Error budget policy

1. Budget = (1 − target) × window. E.g. availability: 0.5% × 30 days ≈ 3.6 h.
2. When 50% of the budget is spent in a window, freeze feature work and fix
   the cause of the burn (postmortem required).
3. When the budget is exhausted, only reliability work ships until the rolling
   window recovers.
4. Every budget breach gets a blameless postmortem using
   `docs/POSTMORTEM_TEMPLATE.md`.

## Non-goals (explicitly not promised)

- Multi-region failover, 99.99% availability, sub-100 ms global latency.
- Correctness of LLM recommendations (quality, not reliability — out of SLO
  scope; measured separately via check-in ratings).
- Email delivery SLO — SMTP is optional and fail-closed; the app must work
  with it down.
