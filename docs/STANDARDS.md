# Production Standards — the 25 checks this app is held to

Researched 2026-10-12 from primary sources (links under each group). Each
check states WHY it matters and HOW it is verified. Anything not yet
confirmed is marked **[UNCONFIRMED]**.

## Sources

- OWASP API Security Top 10 (2023): https://owasp.org/API-Security/ — API1 BOLA,
  API2 Broken Authentication, API3 BOPLA, API4 Unrestricted Resource Consumption,
  API5 BFLA, API6 Unrestricted Business Flows, API7 SSRF, API8 Security
  Misconfiguration, API9 Inventory Management, API10 Unsafe Consumption of APIs.
- OWASP Top 10 for LLM Applications (2025): https://genai.owasp.org/llm-top-10/ —
  LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Supply
  Chain, LLM04 Data/Model Poisoning, LLM05 Improper Output Handling, LLM06
  Excessive Agency, LLM07 System Prompt Leakage, LLM08 Vector/Embedding
  Weaknesses, LLM09 Misinformation, LLM10 Unbounded Consumption.
- Google SRE Book, Ch. 4 (SLI/SLO/SLA, percentiles, error budgets):
  https://sre.google/sre-book/service-level-objectives/
- AWS Well-Architected (6 pillars; reliability: auto-recover, test recovery,
  graceful degradation, statelessness):
  https://docs.aws.amazon.com/wellarchitected/latest/framework/the-pillars-of-the-framework.html
- The Twelve-Factor App (config in env, stateless processes, disposability,
  dev/prod parity, logs as streams, admin processes): https://12factor.net/
- DORA capabilities (CI, CD, test automation, monitoring, DB change mgmt,
  trunk-based, small batches, pervasive security, proactive alerting):
  https://dora.dev/capabilities/
- Neon free plan (quotas vary by docs generation — see check 24):
  https://neon.com/faqs/free-plan-limits-and-quotas and
  https://neon.com/docs/introduction/plans ; pooling:
  https://neon.com/docs/connect/connection-pooling ; PITR:
  https://neon.com/docs/guides/backup-restore (via docs index https://neon.com/docs/llms.txt)
- Vercel Functions limits (Hobby: 300s max duration, 2GB/1vCPU, 4.5MB body →
  413, 1024 FDs shared, single region `iad1` default, 30k concurrency):
  https://vercel.com/docs/functions/limitations

## Security — API (OWASP API Top 10 2023)

1. **BOLA: every object access checks ownership (API1).** WHY: #1 API risk;
   IDs are guessable. VERIFY: cross-user tests (B reads A's session/favorite/
   rating → 403/404), code review of each `:id` route.
2. **Authentication is unforgeable and expires (API2).** WHY: stolen tokens
   must die fast. VERIFY: JWT alg pinned, 15-min access, refresh rotation +
   reuse detection + revocation table; tests for expired/tampered/replayed tokens.
3. **No mass assignment / property overexposure (API3).** WHY: clients must
   not set `role`, ids, or server fields. VERIFY: zod schemas strip unknown
   keys; `role` never taken from body; tests post `role:'admin'` → ignored.
4. **Resource consumption is bounded (API4).** WHY: cost-DoS and quota burn.
   VERIFY: per-endpoint rate limits with 429 + `Retry-After`; 10kb/350kb body
   caps with honest 413; LLM 10/min on both mounts; maxOutputTokens + MAX_STEPS.
5. **Function-level authorization on every route (API5).** WHY: hidden
   endpoints (`/admin/*`) are probed. VERIFY: 401 anon + 403 non-admin tests
   for each protected route; no auth logic living only in the client.
6. **Sensitive flows are abuse-gated (API6).** WHY: OTP/password-reset and
   signup are attacker favorites. VERIFY: OTP cooldown + 5-attempt lockout +
   generic responses (no enumeration); throttled auth endpoints.
7. **No SSRF via user input (API7).** WHY: server-side fetches to
   attacker URLs exfiltrate cloud metadata. VERIFY: inventory every outbound
   fetch (Overpass, Gemini, SMTP, Commons); user input never becomes a URL;
   no `fetch(url)` where `url` derives from request data.
8. **Secure defaults, no debug in prod (API8).** WHY: misconfiguration is how
   dev_otp/CORS-open incidents happen. VERIFY: fail-closed boot (missing
   secrets, prod CORS/DATABASE_URL guards); helmet headers incl. CSP;
   `NODE_ENV=production` smoke test.
9. **Every route is inventoried (API9).** WHY: shadow endpoints rot
   unpatched. VERIFY: `/health` endpoint list matches router table; a test
   fails if a route exists without inventory + auth classification.
10. **Upstream data is validated (API10).** WHY: LLM/Overpass/Commons output
    is attacker-influenced. VERIFY: zod on LLM JSON, field masks on Places,
    Commons author attribution, OSM sourced behind verify; failure injection
    (bad upstream) → clean 502, never raw passthrough.

## Security — LLM (OWASP LLM Top 10 2025)

11. **Prompt injection is tested (LLM01).** WHY: chat input reaches the
    model every turn. VERIFY: injection battery (leak system prompt, exfiltrate
    other users, tool abuse) → refusals + no cross-user data; recorded in EVIDENCE.md.
12. **No sensitive disclosure via model or logs (LLM02).** WHY: PII/secrets
    leak through prompts, traces, and logs. VERIFY: redaction tests, trace
    payload review, `dev_otp`/emails absent from logs; prompt templates
    carry no secrets.
13. **Least-privilege tools + human gates (LLM06).** WHY: excessive agency
    turns prompt bugs into actions. VERIFY: tool inventory (read-only +
    preference-save only); booking/message actions require plan preview +
    Confirm; autonomy setting honored; action history with undo where possible.
14. **System prompt is not leakable (LLM07).** WHY: it encodes product logic.
    VERIFY: direct/indirect extraction attempts return refusals; prompt text
    absent from repo? **[UNCONFIRMED]** — prompts live in `src/prompts/` by
    design (needed for review); leakage is via model only.
15. **Consumption is capped (LLM10).** WHY: unbounded LLM spend kills free
    tiers. VERIFY: MAX_STEPS=6, maxOutputTokens, per-IP LLM limiter, monthly
    call counter with 70% warning; quota caps set in Google Cloud Console.

## Reliability & SLOs (SRE)

16. **SLOs exist and are measured in percentiles (SRE Ch.4).** WHY: averages
    hide tail pain; no SLO = no prioritization. VERIFY: `docs/SLO.md` +
    measured p50/p95/p99 from logs or k6; error budget tracked, not vibes.
17. **Graceful degradation on every dependency failure (AWS REL).**
    WHY: Gemini/Neon/SMTP *will* fail. VERIFY: failure drills (DB down,
    Gemini down/slow, SMTP down, bad deploy) → deterministic fallback +
    clear user message; recorded outputs.
18. **Disposability: fast boot, graceful shutdown (12factor IX).**
    WHY: deploys and crashes must not drop in-flight work. VERIFY: SIGTERM
    drain test; boot-to-healthy timing; no local state required to serve.
19. **Timeouts, retries with backoff, circuit breaker on Gemini.**
    WHY: slow upstream must not pin server threads or budgets. VERIFY:
    per-call timeout, exponential backoff, breaker opens after N failures and
    half-opens; drill output in EVIDENCE.md.

## Data & Operations (12factor, AWS, Neon)

20. **Backing services are attached resources (12factor IV); PITR works.**
    WHY: data loss is the unforgivable failure. VERIFY: Neon 6-hour instant-
    restore window + 1 manual snapshot (free plan) known; one REAL restore
    drill into a temp branch with steps + timings recorded. **[UNCONFIRMED]**:
    exact free quotas differ across Neon docs generations (0.5GB vs 1GB
    storage, 191.9 vs 100 CU-hours) — record the project's actual dashboard
    values during the drill.
21. **Config in environment, never in code (12factor III).**
    WHY: secrets in repo/history are burned forever. VERIFY: secret scan in
    CI (gitleaks) + `git log` audit; `.env` ignored; `.env.example` has
    placeholders only.
22. **Logs are streams with request IDs; alerts follow SLOs (12factor XI).**
    WHY: debugging without correlation is guessing. VERIFY: pino JSON +
    requestId on every request/error; Sentry captures 5xx; uptime check on
    `/health`; alert rules reference `docs/SLO.md` numbers.
23. **Runbooks + blameless postmortems exist (SRE Ch.15, AWS REL12).**
    WHY: incidents repeat without them. VERIFY: `docs/RUNBOOK.md` covers DB
    down / Gemini down / leaked secret / bad deploy + rollback; one real
    postmortem written for the worst bug found in review.

## Delivery & Platform (DORA, Vercel, Postgres)

24. **CI gates block merges; deploys are boring (DORA).** WHY: quality that
    isn't enforced isn't real. VERIFY: CI runs lint + tests + build +
    `npm audit` + secret scan + Playwright E2E + Lighthouse; branch protection
    blocks red merges. Vercel Hobby hard limits respected: 300s duration,
    4.5MB bodies, single region — LLM calls + retries budgeted inside them.
25. **Dev/prod parity + migrations as code (12factor X, DORA DB change mgmt).**
    WHY: "works locally" must predict production. VERIFY: same SQL on pg-mem
    and Neon; migrations ordered + idempotent (`--all` re-runnable); seed
    fixtures versioned; `ON CONFLICT DO NOTHING` proven by re-run output.
