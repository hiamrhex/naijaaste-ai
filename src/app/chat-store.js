// Persistent chat store (survives tab switches, reloads, unmounts)
// Key: 'nt.chat.v1' in localStorage
// - messages, sessionId, persona, recs, meta, stage, showQuickPrompts

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
    // Restore messages; never restore a half-finished request or stale error bubble.
    return {
      ...EMPTY,
      ...parsed,
      messages: parsed.messages.filter(m => m && typeof m.content === 'string'),
    };
  } catch { return { ...EMPTY }; }
};

let state = readStored();
const listeners = new Set();

const persist = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode / quota */ }
};

const emit = () => {
  persist();
  for (const l of listeners) l();
};

export const chatStore = {
  get: () => state,
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  set: (patch) => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }; emit(); },
  reset: () => { state = { ...EMPTY, messages: [{ role: 'assistant', content: WELCOME }] }; emit(); },
  clear: () => { state = { ...EMPTY }; emit(); },
};

export { WELCOME, STORAGE_KEY };
export default chatStore;