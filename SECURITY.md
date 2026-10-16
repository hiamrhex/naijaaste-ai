# Security

Security architecture, threat model (STRIDE), controls inventory and bug-bounty posture live in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) and [`docs/SECURITY.md`](docs/SECURITY.md).

This file is the **root security pointer**. GitHub and most tooling look for `SECURITY.md` at the repo root; the authoritative content lives under `docs/`.

## Reporting a vulnerability

Open a **private** security advisory on GitHub (preferred) or email the maintainers. Do **not** open a public issue.

We aim to:
- Acknowledge within **72 hours**.
- Provide a fix or mitigation timeline within **14 days** for confirmed, exploitable issues.
- Credit reporters who want it (unless you prefer anonymity).

## Scope

**In scope:** any authenticated/unauthenticated path on the deployed API, auth flows, agent prompt-injection surface, data-isolation guarantees (cross-user access), secrets handling.

**Out of scope:** DoS/volumetric attacks, social engineering, physical attacks, findings against third-party dependencies already triaged in `docs/SECURITY.md`, issues requiring a compromised admin account.

## Known posture

We practice **defence in depth**: bcrypt-12 at rest, JWT access (15 min) + rotating refresh (jti, reuse-detection), ownership checks on every user-scoped resource, HMAC-hashed OTP with attempt caps, strict CSP + helmet, per-surface rate limits, redaction-tested logs, fail-closed prod env. Break-it battery (14 attacks) and agent-safety probes (5) are recorded in [`docs/EVIDENCE.md`](docs/EVIDENCE.md).

We do **not** currently run a paid bug-bounty program. Responsible disclosure is welcome and rewarded with credit and transparency, not cash.
