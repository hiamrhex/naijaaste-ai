import { badRequest } from '../lib/errors.js';

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    // Single issue → surface its message directly (parity with pre-zod messages)
    return next(
      badRequest(issues.length === 1 ? issues[0].message : 'Request validation failed', issues)
    );
  }
  req.body = result.data; // trimmed/coerced values replace the raw body
  next();
};
