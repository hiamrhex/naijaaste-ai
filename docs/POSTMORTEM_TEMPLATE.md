# Postmortem: <one-line title>

- **Date of incident:** YYYY-MM-DD
- **Date of postmortem:** YYYY-MM-DD
- **Severity:** S1 (user-visible outage) / S2 (degraded) / S3 (internal only)
- **Duration:** X min/h (detect → mitigate → resolve)
- **Author(s):** <names>
- **Status:** open / mitigated / resolved / actions pending

## Impact (who was hurt, how many)

<Numbers only. "All chat users received HTTP 500 instead of 502 for N hours,
affecting X% of turns" — not "some users may have noticed". If unknown, say
unknown and list how it would be counted.>

## Timeline (UTC, with evidence links)

| Time | Event |
|---|---|
| HH:MM | <first user-visible effect> |
| HH:MM | <detection — how, by whom, what signal> |
| HH:MM | <root cause identified> |
| HH:MM | <mitigation applied> |
| HH:MM | <verified resolved> |

## Root cause

<The causal chain, not the symptom. "Circuit-breaker errors were classified as
parse-retry inputs" not "Gemini was down".>

## What went wrong in detection/response

<Gaps: no alert, slow reproduction, missing runbook entry.>

## What went right

<Things that limited the blast radius: breaker, fallback, logs with request IDs.>

## Action items

| # | Action | Owner | Due | Status |
|---|---|---|---|---|
| 1 | <fix> | | | open |
| 2 | <test that would have caught it> | | | open |
| 3 | <monitor/alert> | | | open |

## Blamelessness check

<One paragraph: what about the system made this mistake *rational* at the time,
and what is being changed about the system (not the people) so the same mistake
is harder next time.>
