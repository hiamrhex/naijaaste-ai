# API reference

> Last verified: 2026-10-14 against `src/routes/` + live `/health` (27 endpoints).
> All errors: `{ error: { code, message, details?, requestId } }`. All 429s add `Retry-After`.

Conventions: legacy `/` + canonical `/api/v1` serve identical handlers (use `/api/v1`).
`POST /agent` and LLM routes cost model calls — guarded at 10/min per client.

## Auth

### POST /auth/signup → 201
```json
// request
{ "name": "Ada Obi", "email": "ada@example.com", "password": "Str0ng!Passw0rd" }
// response: { "success": true, "user": { "id": "uuid", "email": "…", "role": "user" }, "accessToken": "…" }
// + Set-Cookie: refreshToken=…; Path=/; HttpOnly
// errors: 400 VALIDATION_ERROR · 409 EMAIL_TAKEN · 429 RATE_LIMITED
```

### POST /auth/signin → 200
Same shape as signup. Wrong password and unknown email both return
`401 INVALID_CREDENTIALS / "Invalid email or password"` (no enumeration).

### POST /auth/refresh → 200 · POST /auth/signout → 200
Cookie-based rotation: old `jti` revoked, reused tokens → `401 INVALID_REFRESH`,
missing cookie → `401 NO_REFRESH_TOKEN`. Signout revokes + clears with mirrored attrs.

### POST /auth/forgot-password → 200 (always, for known AND unknown emails)
```json
// request
{ "email": "ada@example.com" }
// response: { "success": true, "message": "If that account exists, a reset code has been sent." }
// + dev_otp ONLY when DEV_OTP_ENABLED=true and not production
// errors: 400 VALIDATION_ERROR · 429 RESEND_COOLDOWN (with retry_after_ms)
```

### POST /auth/reset-password → 200
`{ email, otp: "609157", new_password: "…" }` — 6-digit code, 5 attempts, 10-min TTL.
Success revokes ALL refresh tokens. Wrong code → `400 INVALID_OTP` (reason-specific message).

### POST /auth/google → 200 · GET /auth/me → 200
Google ID-token in, same JWT session out. Unconfigured server → `503 GOOGLE_NOT_CONFIGURED`.
`me` needs `Authorization: Bearer …` → `{ user }` incl. role; stale token → 401.

## Taste + discovery

- `POST /agent` (JWT) → `{ session_id, stage, message, extracted_persona, recommendations, trace, meta }`. Sessions owner-bound: foreign id → 403.
- `POST /chat` → `{ session_id, message, … }` (400 on `{}`, 400 over 500 chars).
- `GET /chat/:sessionId` (UUID, else 400) · `DELETE /chat/:sessionId` → 404 `SESSION_NOT_FOUND` when unknown.
- `GET /nearby?lat=6.52&lng=3.38&limit=8&radius_km=25` → `{ origin, radius_km, count, results[] }` with `distance_km` + `directions_url`. Bad/missing coords → 400.
- `GET /restaurants/geo?ids=r001,r002` → `{ geo: { r001: { lat, lng, directions_url } } }`.
- `POST /extract-persona` (`raw_text`, min 10 chars) · `POST /update-preference` (`signal.rating` integer 1–5) · `POST /recommend` (`persona` with city/budget/spice/ambience/cuisines/dietary) · `POST /generate-review` (`persona` + full `restaurant`).
- LLM failures → `502 UPSTREAM_FAILURE` (no provider message leaked).

## Engagement + admin

- `POST /ratings` (JWT, 201): `{ restaurant_id, stars 1–5, note?, context? }`.
- `GET /ratings` (JWT): own history only.
- `POST /reports` (JWT, 201): `{ type: bug|wrong-info|idea|other, message 3–2000 chars, screen?, device?, app_version?, restaurant_id?, screenshot? }` → `{ ticket: "NT-XXXXXX", status: "open" }`. Screenshots: image data-URL ≤ ~300KB.
- `GET /admin/stats` · `GET /admin/reports?status=` · `PATCH /admin/reports/:ticket` (admin role): 401 anon, 403 non-admin.
