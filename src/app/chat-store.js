// The chat conversation, kept OUTSIDE React so it survives a tab switch and
// a reload - the way every AI chat keeps one continuous history.
//
// The bug this fixes: the conversation lived in useState inside HomeScreen, so
// navigating to Settings unmounted the screen and the chat was gone when the
// user came back. The state now lives in this module (a tiny external store)
// and is mirrored into localStorage, so:
//   - switching tabs keeps the conversation, the persona and the results
//   - reloading the app brings the same conversation back
//   - it is ONE history, not a fragment per visit
//
// The server side keeps the real session (session_id) in the same store, so
// the restored conversation continues the same server-side session.

const STORAGE_KEY = 'nt.chat.v1';
const WELCOME = "Welcome! I'm NaijaTaste AI — your personal guide to the best restaurants across Nigeria. Tell me about yourself — your city, your budget, what you're craving — and I'll find the perfect spot for you.";

const EMPTY = {
  messages: [{ role: 'assistant', content: WELCOME }],
  sessionId: null,
  persona: null,
  recs: null,
  meta: null,
  stage: 'gather',
  showQuickPrompts: true,
};

const readStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.messages) || !parsed.messages.length) return { ...EMPTY };
    return {
      ...EMPTY,
      ...parsed,
      // Never restore a half-finished request or a stale error bubble.
      messages: parsed.messages.filter((m) => m && typeof m.content === 'string'),
    };
  } catch {
    return { ...EMPTY };
  }
};

let state = readStored();
const listeners = new Set();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* private mode / quota */ }
};

const emit = () => {
  persist();
  for (const listener of listeners) listener();
};

export const chatStore = {
  get: () => state,
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  set: (patch) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...next };
    emit();
  },
  reset: () => {
    state = { ...EMPTY, messages: [{ role: 'assistant', content: WELCOME }] };
    emit();
  },
  clear: () => {
    state = { ...EMPTY };
    emit();
  },
};

export { WELCOME, STORAGE_KEY };
export default chatStore;
