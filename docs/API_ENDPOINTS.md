# API Endpoints Reference

> Verified 2026-11-17 against the route table in `src/app.js` (34 endpoints) and
> the live `/health` inventory.
>
> **Base path.** The canonical mount is `/api/v1` (`POST /api/v1/auth/signin`,
> …). Every route is also mounted unprefixed (`POST /auth/signin`, …) for older
> clients. `/health`, `/health/ready` and `/metrics` are never versioned —
> probes must keep working across API versions.
>
> **Errors** are always `{ error: { code, message, details?, requestId } }`.
> Rate-limited responses add `Retry-After`.
>
> **Success envelopes.** Routes that use the shared responder return
> `{ data, meta? }` (admin, recommend, ratings, saved places). Routes that predate
> it return `{ success: true, ...fields }` (auth, chat, agent, persona, review,
> favorites, reports). Both are shown below; the shape is part of the contract.

## Health & Status

### GET /health
Liveness plus the endpoint inventory. Never touches the database, so it stays up
during an outage.

**Response `200`:**
```json
{
  "status": "ok",
  "service": "NaijaTaste AI",
  "version": "2.0.0",
  "api": "/api/v1",
  "timestamp": "2026-11-17T09:00:00.000Z",
  "features": { "google_auth": true },
  "endpoints": ["GET  /health", "GET  /health/ready", "... 34 entries"]
}
```

`endpoints` is an array of strings, not a count. `features.google_auth` is
`false` when `GOOGLE_CLIENT_ID` is unset.

### GET /health/ready
Readiness probe. Runs `SELECT 1` bounded to 2 s; answers `503` while the
database is unreachable so a deploy gate can act.

**Response `200` / `503`:**
```json
{
  "status": "ok",
  "service": "NaijaTaste AI",
  "ready": true,
  "db": "up",
  "timestamp": "2026-11-17T09:00:00.000Z"
}
```
`status` is `"unavailable"`, `ready` is `false` and `db` is `"down"` on the 503
path.

### GET /metrics
Prometheus text format (`text/plain; version=0.0.4`). Process-local counters;
aggregate with `sum()` across instances. Requires an admin session **or**
`Authorization: Bearer $METRICS_TOKEN` (timing-safe compare). Anonymous callers
get `401`; a signed-in non-admin gets `403`.

## Authentication

Tokens: a 15-minute access token is returned in the body. The refresh token is
set as an `httpOnly`, `SameSite=Strict` cookie named `refreshToken` — it is
never returned in JSON.

### POST /auth/signup → 201
```json
{ "name": "Ada Obi", "email": "ada@example.com", "password": "Str0ng!Passw0rd" }
```
**Response:** `{ "success": true, "user": { "id", "email", "role" }, "accessToken": "…" }`

Errors: `400 VALIDATION_ERROR`, `409 EMAIL_TAKEN`, `429 RATE_LIMITED`.

### POST /auth/signin → 200
```json
{ "email": "ada@example.com", "password": "Str0ng!Passw0rd" }
```
**Response:** same shape as signup. Errors: `401 INVALID_CREDENTIALS`,
`429 ACCOUNT_LOCKED` (repeated failures for the same email + IP).

### POST /auth/refresh → 200
No request body. The browser sends the `refreshToken` cookie. The token is
consumed before a new pair is issued, so two concurrent refreshes cannot both
mint a family.

**Response:** `{ "success": true, "user": { … }, "accessToken": "…" }` and a new
`refreshToken` cookie. Errors: `401 NO_REFRESH_TOKEN`, `401 INVALID_REFRESH`,
`401 UNAUTHENTICATED`.

### POST /auth/signout → 200
No body. Revokes the refresh token from the cookie and clears it.
**Response:** `{ "success": true }`.

### GET /auth/me → 200
**Response:** `{ "success": true, "user": { "id", "email", "role" } }`.

### DELETE /auth/me → 200
Deletes the account and every user-scoped row in one transaction, then clears
the cookie. **Response:** `{ "success": true, "deleted": true }`.

### POST /auth/google → 200
```json
{ "credential": "<Google Identity Services ID token>" }
```
**Response:** same as signin. Errors: `400 VALIDATION_ERROR`,
`503 GOOGLE_NOT_CONFIGURED`, `401 GOOGLE_INVALID_TOKEN`.

### POST /auth/forgot-password → 200
```json
{ "email": "ada@example.com" }
```
**Response:** `{ "success": true, "message": "If that account exists, a reset code has been sent." }`
The body is identical for known and unknown addresses. With `DEV_OTP_ENABLED=true`
and no SMTP, the response also contains `dev_otp`.

### POST /auth/reset-password → 200
```json
{ "email": "ada@example.com", "otp": "609157", "new_password": "New!Passw0rd" }
```
`otp` is the 6-digit code (10-minute TTL, 5 attempts). Success revokes every
refresh token. Errors: `400 INVALID_OTP`, `400 VALIDATION_ERROR`.

## Discovery

### GET /nearby → 200
Public (no auth).

| Query | Required | Meaning |
|---|---|---|
| `lat` | yes | −90…90 |
| `lng` | yes | −180…180 |
| `limit` | no | 1–50, default `10` |
| `radius_km` | no | 1–500, default `50` |

**Response:**
```json
{
  "success": true,
  "origin": { "lat": 6.52, "lng": 3.38 },
  "radius_km": 25,
  "count": 1,
  "results": [
    {
      "restaurant_id": "r001",
      "name": "Restaurant Name",
      "city": "Lagos",
      "area": "Yaba",
      "lat": 6.5244,
      "lng": 3.3792,
      "cuisine_tags": ["nigerian"],
      "price_tier": "low",
      "average_rating": 4.5,
      "review_count": 12,
      "spice_profile": "medium",
      "distance_km": 1.2,
      "directions_url": "https://www.google.com/maps/dir/?api=1&destination=6.5244,3.3792"
    }
  ]
}
```
Errors: `400 VALIDATION_ERROR` when `lat`/`lng` are missing or out of range.

### GET /restaurants/geo → 200
Geo lookup for recommendation cards, which do not carry coordinates.

| Query | Required | Meaning |
|---|---|---|
| `ids` | yes | comma-separated restaurant ids (max 50) |

**Response:**
```json
{
  "success": true,
  "geo": {
    "r001": { "lat": 6.5244, "lng": 3.3792, "directions_url": "…" }
  }
}
```
Errors: `400 VALIDATION_ERROR` when `ids` is empty.

## Agent & Chat

### POST /agent → 200
Authenticated ReAct agent. LLM failure never dead-ends: the route answers with
deterministic catalogue picks and `meta.fallback: true`.

**Request:**
```json
{ "message": "Spicy amala in Yaba, tight budget", "session_id": "uuid (optional)" }
```
`message` is 1–500 characters. Omit `session_id` to start a session.

**Response:**
```json
{
  "success": true,
  "session_id": "uuid",
  "stage": "recommend",
  "message": "I found some great spicy amala options in Yaba…",
  "extracted_persona": { "city": "Lagos", "preference_history": [] },
  "recommendations": { "success": true, "recommendations": [ … ] },
  "trace": [{ "step": 0, "tool": "search_restaurants", "ok": true, "ms": 412 }],
  "meta": { "latency_ms": 1200, "steps": 3, "agent": true, "fallback": false, "fallback_reason": null }
}
```
Errors: `400 VALIDATION_ERROR`, `403 FORBIDDEN` (session owned by someone else —
including an anonymous session, whose capability this route cannot verify),
`429 LLM_QUOTA_EXCEEDED` (monthly cap, one unit per turn), `504 AI_TIMEOUT`,
`503 AI_UNAVAILABLE`, `502 UPSTREAM_FAILURE`.

### POST /chat → 200
Simple chat. Anonymous callers receive a session capability and must send it as
`Authorization: Bearer <capability>` on later calls.

**Request:**
```json
{ "message": "Hello", "session_id": "uuid (optional)" }
```
**Response:** the chat service result (`success`, `session_id`, reply fields).
Errors: `400 VALIDATION_ERROR`, `404 SESSION_NOT_FOUND` (wrong owner).

### GET /chat/:sessionId → 200
**Response:** `{ "success": true, "session": { … } }`.
Errors: `400 VALIDATION_ERROR` (not a UUID), `404 SESSION_NOT_FOUND` — also for
a session you do not own, so the endpoint never confirms existence.

### DELETE /chat/:sessionId → 200
**Response:** the clear result (`{ "success": true, … }`). Same 404 rule.

## Taste & Preferences

### POST /extract-persona → 200
**Request:**
```json
{ "raw_text": "I like spicy food and cheap places" }
```
`raw_text` must be at least 10 characters.

**Response:**
```json
{
  "success": true,
  "persona": {
    "persona_id": "uuid",
    "city": "Lagos",
    "budget_level": "low",
    "spice_tolerance": "high",
    "ambience_preference": "casual",
    "preferred_cuisines": [],
    "dietary_flags": []
  },
  "meta": { "extracted_from": "…", "preference_history": [], "ready_for": ["recommend", "generate-review"] }
}
```

### POST /update-preference → 200
**Request:**
```json
{
  "persona": { "persona_id": "uuid", "preference_history": [] },
  "signal": { "dimension": "spice", "value": "high", "rating": 5, "restaurant_id": "r001" }
}
```
`signal.rating` is an integer 1–5. The route keeps the last 10 signals.

**Response:**
```json
{
  "success": true,
  "updatedPersona": { "…": "persona with preference_history" },
  "meta": {
    "signals_count": 1,
    "previous_state": "cold_start",
    "current_state": "warm",
    "state_transition": "cold_start → warm",
    "latest_signal": { "…": "signal" }
  }
}
```

### POST /recommend → 200
Optional auth: a signed-in caller is metered against their user id, an anonymous
caller against `persona.persona_id`.

**Request:**
```json
{
  "persona": {
    "persona_id": "uuid",
    "city": "Lagos",
    "budget_level": "low",
    "spice_tolerance": "high",
    "ambience_preference": "casual",
    "preferred_cuisines": [],
    "dietary_flags": []
  }
}
```
All seven persona keys are required (extra keys pass through).

**Response:** `{ "data": { "recommendations": [ … ] }, "meta": { … } }`.
Errors: `404 NO_MATCHES`, `429 LLM_QUOTA_EXCEEDED` (monthly LLM quota exhausted).

### POST /generate-review → 200
Only two things are required: where the persona is and which restaurant the app
is showing. `review.service` resolves the canonical catalogue row by id and fills
the remaining profile fields with documented defaults.

**Request:**
```json
{
  "persona": { "city": "Lagos" },
  "restaurant": { "restaurant_id": "r001", "google_place_id": "ChIJ… (optional)" }
}
```
**Response:** the review result (`success`, generated review fields).
Errors: `400 VALIDATION_ERROR`, `404 RESTAURANT_NOT_FOUND`.

## Engagement

### POST /ratings → 201
**Request:**
```json
{
  "restaurant_id": "r001",
  "stars": 5,
  "note": "Great food! (max 500 chars)",
  "context": "saved"
}
```
`stars` is an integer 1–5. `context` is one of `saved`, `planned`, `shared`
(default `saved`). The restaurant must exist.

**Response:** `{ "data": { "id", "user_id", "restaurant_id", "stars", "note", "context", "at" } }`.
Errors: `400 VALIDATION_ERROR`, `404 NOT_FOUND` (unknown restaurant).

### GET /ratings → 200
**Response:** `{ "data": [ { "stars": 5, "note": "…", "at": "…" } ] }` — newest
first.

### POST /reports → 201
**Request:**
```json
{
  "type": "bug",
  "message": "App crashed when searching",
  "screen": "/app/map",
  "device": "Pixel 8 / Android 15",
  "app_version": "2.0.0",
  "restaurant_id": "r001",
  "request_id": "the X-Request-Id of the request that failed (optional)",
  "screenshot": "data:image/png;base64,…"
}
```
`type` is one of `bug`, `wrong-info`, `idea`, `other`. `message` is 3–2000
characters. `request_id` is optional and, when it matches
`^[A-Za-z0-9-]{8,64}$`, is stored as the report's `request_id`; otherwise the
submission's own request id is used. `screenshot` is optional, must be an image
data URL, and is capped at ~300 KB (the route gets a 350 KB body parser;
everything else is 10 KB).

**Response:** `{ "success": true, "report": { "ticket": "NT-…", … } }` (the
screenshot blob is not echoed). Errors: `400 VALIDATION_ERROR`,
`413 PAYLOAD_TOO_LARGE`.

## Favorites

### GET /auth/favorites → 200
**Response:** `{ "success": true, "favorites": ["r001"], "items": [ { …restaurant } ] }`.

### POST /auth/favorites → 201 (added) / 200 (already present)
```json
{ "restaurant_id": "r001" }
```
**Response:** `{ "success": true, "favorites": ["r001"], "added": true }`.
Errors: `400 VALIDATION_ERROR`, `404 NOT_FOUND` (unknown restaurant),
`409 FAVORITES_FULL` (50-item cap).

### DELETE /auth/favorites/:restaurant_id → 200
**Response:** `{ "success": true, "favorites": [], "removed": true }`.
Removing something absent is still `200` with `"removed": false`.

## Saved Places

### GET /auth/saved-places → 200
**Response:** `{ "success": true, "places": [ { "id", "name", "created_at" } ] }`.

### POST /auth/saved-places → 201
```json
{ "name": "Home" }
```
`name` is required and at most 100 characters. **Response:**
`{ "success": true, "place": { "id", "name", "created_at" } }`.
Errors: `400 VALIDATION_ERROR`, `409 SAVED_FULL`, `404 NOT_FOUND`.

### DELETE /auth/saved-places/:id → 200
Owner-only; a bogus id and another user's id are both `404`.
**Response:** `{ "success": true, "removed": true, "id": "uuid" }`.

## Admin

All three require an authenticated user with `role = "admin"`.

### GET /admin/stats → 200
**Response:**
```json
{
  "data": {
    "users": 100,
    "favorites": 240,
    "ratings": 310,
    "reports": { "open": 4, "in_review": 1, "resolved": 27 }
  }
}
```

### GET /admin/reports → 200
Optional `?status=open|in_review|resolved`. **Response:** `{ "data": [ …reports ] }`.
Errors: `400 VALIDATION_ERROR` for an unknown status.

### PATCH /admin/reports/:ticket → 200
```json
{ "status": "resolved" }
```
**Response:** `{ "data": { …updated report } }`.
Errors: `400 VALIDATION_ERROR`, `404 NOT_FOUND` (unknown ticket).

## Error Responses

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { "additional": "context, when present" },
    "requestId": "unique_request_id"
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` — invalid request format
- `INVALID_CREDENTIALS` — wrong email/password
- `ACCOUNT_LOCKED` — too many failed sign-ins (email + IP)
- `UNAUTHORIZED` / `UNAUTHENTICATED` — missing or invalid token
- `FORBIDDEN` — insufficient permissions
- `NOT_FOUND` — resource doesn't exist
- `SESSION_NOT_FOUND` — chat session missing or not yours
- `EMAIL_TAKEN` — signup email already registered
- `FAVORITES_FULL` / `SAVED_FULL` — per-user list cap reached
- `RATE_LIMITED` — too many requests
- `PAYLOAD_TOO_LARGE` — request too large
- `UPSTREAM_FAILURE` / `UPSTREAM_AUTH` — LLM request failed
- `AI_UNAVAILABLE` / `AI_TIMEOUT` — LLM unavailable or too slow
- `SERVICE_UNAVAILABLE` — database or service down

## Rate Limiting

| Endpoint | Limit | Window |
|---|---|---|
| `/auth/signup` | 25 | 15 minutes |
| `/auth/signin` | 50 | 15 minutes |
| `/auth/refresh` | 60 | 15 minutes |
| `/auth/google` | 10 | 15 minutes |
| `/auth/forgot-password` | 10 | 15 minutes |
| `/auth/reset-password` | 20 | 15 minutes |
| LLM endpoints (POST `/agent`, `/chat`, `/extract-persona`, `/update-preference`, `/recommend`, `/generate-review`) | 10 | minute |
| General API | 600 | 15 minutes |

Rate-limited responses include:
- `429` status code
- `Retry-After` header
- `RateLimit` headers showing the limit, remaining and reset

Monthly quota (`LLM_MONTHLY_MAX`, default 100): `/chat`, `/agent` and
`/recommend` charge one unit per call or turn (a free-tier API-key burn guard).
`/extract-persona` and `/generate-review` have no monthly subject and are
bounded only by the 10/min limiter — a known gap, recorded in
[`EVIDENCE.md`](EVIDENCE.md).
