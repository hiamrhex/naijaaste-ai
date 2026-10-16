# Threat Model (STRIDE)

> Written 2026-10-16. Companion to `docs/SECURITY.md` (controls inventory) and
> `docs/STANDARDS.md` (the 25 checks). Method: STRIDE per entry point
> (https://owasp.org/www-community/STRIDE).

## System boundary

```
[Browser SPA /app] ──https──▶ [Vercel serverless: Express api/index.js]
                                     │
                                     ├──▶ [Neon Postgres — pooled URL]
                                     ├──▶ [Google Gemini API]
                                     ├──▶ [Gmail SMTP (optional)]
                                     └──▶ [Google OIDC (token verify)]
[Anonymous user] ──https──▶ [static landing at /]
```

Trust levels: **T0** unauthenticated visitor, **T1** authenticated user,
**T2** admin (`ADMIN_EMAILS`), **T3** operator (Vercel/Neon/Google consoles).

## Assets

| Asset | Sensitivity | Where it lives |
|---|---|---|
| Password hashes (bcrypt-12) | high | Neon `users` |
| Refresh tokens (hashed jti) | high | Neon `sessions` |
| Access tokens (JWT, 15 min) | medium | client memory only (never localStorage) |
| OTP codes (HMAC-hashed, 10 min) | high | Neon `otp_codes` |
| Conversations / persona | medium | Neon `sessions` |
| GEMINI_API_KEY, JWT secrets, SMTP pass | critical | env only (Vercel encrypted / local `.env` gitignored) |
| Catalogue (OSM + curated) | low | Neon, rebuildable from `scripts/` |

## Entry points and STRIDE analysis

### E1 — Public HTTP API (`/api/v1/*`)

| Threat | STRIDE | Mitigation | Evidence |
|---|---|---|---|
| SQL injection via query/body params | Tampering | Parameterised queries everywhere (`$1…$n`); break-it: SQLi payloads → generic 401 | `scripts/break-it.mjs` rows 3–4 |
| Forged/replayed JWT | Repudiation / Elevation | HS256 pinned, issuer+audience pinned, 15-min expiry; tampered + forged-sig → 401 | break-it rows 5–6 |
| Refresh-token replay after theft | Elevation | Rotation with reuse detection → old jti revoked → 401 | break-it row 7 |
| Cross-user object access (BOLA) | Elevation | Ownership check on every `:id`; B cannot read/delete A's favorites | break-it rows 8–9 |
| Resource exhaustion (cost DoS) | Denial of service | Body caps 10kb, per-endpoint rate limits with 429+Retry-After, LLM 10/min, MAX_STEPS=6 | `limits.test.js`, `limits-llm.test.js` |
| Admin route probing | Elevation | `requireAuth, requireAdmin` on `/admin` mount; non-admin → 403 | break-it row 10 |
| Response splitting / cache poisoning | Tampering | JSON-only responses, `nosniff`, helmet | header scan in EVIDENCE |

### E2 — Browser SPA (`/app`, static assets)

| Threat | STRIDE | Mitigation | Evidence |
|---|---|---|---|
| Stored/reflected XSS | Tampering | CSP (`script-src 'self'` + Google only), no `dangerouslySetInnerHTML`, `escapeHtml` in email HTML | `tests/xss.test.js`; CSP header scan |
| Token theft from storage | Information disclosure | Access token memory-only; refresh in httpOnly cookie, root path | `tests/auth-client.test.js` |
| Clickjacking | Elevation of privilege | `frame-ancestors 'self'`, X-Frame-Options SAMEORIGIN | header scan |
| Open redirect | Phishing | No user-supplied redirect targets; router basename fixed at `/app` | code review — no `redirect=` param exists |

### E3 — LLM surface (chat, agent tools, recommend, review, persona)

| Threat | STRIDE | Mitigation | Evidence |
|---|---|---|---|
| Prompt injection → system-prompt leak | Information disclosure | Injection probes return refusals; system prompt never concatenated into tool results | `scripts/agent-safety.mjs` probe 1 (PASS) |
| Prompt injection → cross-user data | Information disclosure | Model never receives other users' rows; tools scoped to session owner | probe 2 (PASS); tool args carry session_id only |
| Excessive agency (destructive tool calls) | Elevation of privilege | Tool set is read-only + preference-save; no email/booking/destructive tools exist | probe 3 (PASS); `src/agent/tools.js` inventory |
| Unbounded consumption (quota burn) | Denial of service | 10/min per-client LLM limiter ×2 mounts, token caps, MAX_STEPS=6, 20 s timeout, circuit breaker | `resilience.test.js`, `limits-llm.test.js` |
| Injection via tool-returned fields | Tampering | Tool output treated as data, not instructions; probe containment | probe 5 (PASS) |
| Upstream failure presented as server bug | Repudiation | CIRCUIT_OPEN/timeout → clean 502 UPSTREAM_FAILURE | 8/8 drill, `resilience.test.js` |

### E4 — Email flows (OTP, password reset)

| Threat | STRIDE | Mitigation | Evidence |
|---|---|---|---|
| Reset bombing / mailbox abuse | Denial of service | 10/min limiter, 60 s resend cooldown, fail-closed without SMTP | auth route tests |
| OTP brute force | Elevation of privilege | 5-attempt lockout, 10-min TTL, timing-safe compare, HMAC at rest | auth tests |
| Account enumeration | Information disclosure | Generic responses for signup/reset regardless of account existence | auth tests |
| HTML injection into email body | Tampering | `escapeHtml` on all interpolated values in OTP templates | `tests/xss.test.js` |

### E5 — Supply chain and platform

| Threat | STRIDE | Mitigation | Evidence |
|---|---|---|---|
| Malicious/compromised npm dependency | Tampering | `npm audit --omit=dev --audit-level=critical` + secret scan gate CI | `ci.yml` audit job |
| Secret committed to repo | Information disclosure | `scan-secrets.mjs` in CI + history check for known key prefixes | audit job; history scan clean |
| Env misconfiguration (open CORS, missing DB) | Elevation of privilege | Fail-closed boot: prod without `CORS_ORIGIN` or `DATABASE_URL` refuses to start | `src/env.js:40-54`, `env-guard.test.js` |

## Residual risks (accepted or deferred)

1. **No WAF / DDoS absorption** — provider edge (Vercel) is assumed; out of scope.
2. **Device compromise** — stolen browser session is out of scope.
3. **Gemini-side data handling** — prompts necessarily leave our boundary;
   mitigated only by not sending PII beyond what the turn needs.
4. **Neon free-tier single region** — regional outage takes the app down;
   accepted at current scale (see `docs/SLO.md` non-goals).
5. **Prompt-injection battery is 5 probes, not exhaustive** — gap G-7 in AUDIT.
