/* ── HELPERS ──────────────────────────────────────────────────── */

export const cls = (...args) => args.filter(Boolean).join(" ");

export const naira = (n) => `₦${n}`;

export const starsFilled = (n) => Math.round(Math.min(5, Math.max(0, n)));
