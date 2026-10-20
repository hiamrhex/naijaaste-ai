// ─── Password policy ─────────────────────────────────────────────────────────
// Length-first (NIST SP 800-63B shape): 8+ characters, no composition rules.
// Composition rules ("one upper, one symbol") push users toward predictable
// `Passw0rd!` patterns, while length + bcrypt cost-12 do the real work.
//
// What this adds on top of the length check:
//   1. A denylist of passwords that are guessed first in every wordlist.
//   2. A check that the password is not derived from the account's email.
//
// The check returns a human-readable reason (null = acceptable) so signup
// and reset can surface the same wording to the user.

export const MIN_PASSWORD_LENGTH = 8;

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123',
  'passw0rd', 'passw0rd!', 'p@ssw0rd', 'p@ssword',
  'qwerty', 'qwerty12', 'qwerty123', 'qwertyuiop',
  '12345678', '123456789', '1234567890', '012345678',
  'letmein', 'letmein123', 'welcome', 'welcome1', 'welcome123',
  'admin', 'admin123', 'administrator', 'iloveyou', 'sunshine',
  'princess', 'football', 'baseball', 'trustno1', 'superman',
  'starwars', 'monkey', 'dragon', 'abc12345', 'abcd1234',
  'naijataste', 'naijatasteai', 'lagos', 'nigeria',
]);

/**
 * @param {unknown} password
 * @param {string} [email] the account's email — used to reject self-derived secrets
 * @returns {string|null} the reason it is unacceptable, or null when it is fine
 */
export const passwordProblem = (password, email) => {
  if (typeof password !== 'string' || password.length === 0) {
    return 'password is required';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'that password is too easy to guess — pick a longer, less common one';
  }
  const local = (email || '').toLowerCase().split('@')[0];
  if (local.length >= 3 && password.toLowerCase().includes(local)) {
    return 'password must not contain your email address';
  }
  return null;
};
