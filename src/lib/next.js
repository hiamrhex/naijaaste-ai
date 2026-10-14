// Post-login redirect target sanitizer (open-redirect lockdown).
// Only same-origin absolute paths are allowed. Everything else → '/'.
export const sanitizeNext = (value) => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) return '/';
  let path = value;
  // Reject protocol-relative, backslash, scheme, and non-ASCII-control tricks.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(path)) return '/';
  if (path.startsWith('//') || path.startsWith('\\\\')) return '/';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return '/';
  if (!path.startsWith('/')) return '/';
  if (path.startsWith('/api/') || path === '/api') return '/';
  return path;
};
