// Push-notification opt-in logic (I): pure, tested, no browser APIs at import.
// Delivery itself needs a push service + scheduler (queued); this module owns
// the WHEN and WHETHER: only after a good moment, never on first load,
// mutable mute, iOS-installed-PWA requirement surfaced to the UI.

export const PUSH_KEY = 'nt.push.v1'; // { status, muted, decidedAt }

export const loadPush = () => {
  try {
    return JSON.parse(localStorage.getItem(PUSH_KEY) || 'null') || { status: 'unasked', muted: false, decidedAt: null };
  } catch { return { status: 'unasked', muted: false, decidedAt: null }; }
};

const savePush = (v) => {
  try { localStorage.setItem(PUSH_KEY, JSON.stringify(v)); } catch { /* noop */ }
  return v;
};

export const allowPush = () => savePush({ status: 'allowed', muted: false, decidedAt: Date.now() });
export const denyPush = () => savePush({ status: 'denied', muted: false, decidedAt: Date.now() });
export const setPushMuted = (muted) => {
  const cur = loadPush();
  return savePush({ ...cur, muted: !!muted });
};

// May we show the opt-in prompt right now?
// Rules: good moment happened, not first load (visits >= 2), never asked,
// not muted, notifications API exists. Pure except storage reads.
export const shouldPromptPush = ({ goodMoment, visits, permission = 'default' } = {}) => {
  if (!goodMoment) return false;
  if ((visits || 0) < 2) return false;
  const cur = loadPush();
  if (cur.status !== 'unasked') return false;
  if (cur.muted) return false;
  if (permission === 'denied') return false;
  return true;
};

// Only these notification kinds may ever be sent (spec).
export const ALLOWED_PUSH_KINDS = ['thursday-suggestion', 'rating-check-in'];

export const isPushKindAllowed = (kind) => ALLOWED_PUSH_KINDS.includes(kind);
