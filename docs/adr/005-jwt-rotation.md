# ADR 005 — JWT access + rotating refresh with jti revocation

- Status: accepted. Date: 2026-10-11 (auth wave; recorded here).
- Context: stateless API needs sessions that survive restart, revoke on logout/reset, and work across devices.

## Options considered

1. **Short access + rotating refresh in DB (chosen)** — 15-min HS256 access, 7-day refresh with `jti` row, rotation + reuse detection, root-path httpOnly cookie.
2. Server sessions table + opaque tokens — simpler revocation, but stateful lookup per request and custom client handling.
3. Long-lived JWT only — no server state, but theft window is the token lifetime; no clean logout.

## Decision

Access in memory (client), refresh in httpOnly root-path cookie; every rotation revokes the old `jti`; reuse of a revoked `jti` → 401; password reset revokes all; signout revokes + clears with mirrored attributes.

## Why

- 15-minute theft window; logout/reset actually kill sessions (tested).
- Works same-origin without `SameSite=None` complexity.

## Consequences

- Good: per-token revocation, cross-device favorites/auth.
- Bad: refresh lookup per rotation (indexed, cheap); cookie + Bearer dual mechanism to understand.
- Wrong if: true SSO/federation arrives — then OIDC session management replaces parts of this.
