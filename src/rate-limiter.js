// One bucket per flow. A shared bucket meant a signup loop could lock a user
// out of sign-in and refresh (and vice versa) - the limit protected the
// server, but the user paid for it.
//
// The bucket is keyed on the IP captured before the body was read: the
// default keyGenerator reads req.ip, which throws on the serverless runtime
// once the body has been consumed (see src/lib/clientIp.js).
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from './env.js';
import { clientIp } from './lib/clientIp.js';
import { fail } from './lib/respond.js';

export const limiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = clientIp(req);
    if (!ip || ip === 'unknown') return 'unknown';
    try {
      return ipKeyGenerator(ip);
    } catch {
      return ip;
    }
  },
  handler: (req, res) => fail(res, {
    status: 429,
    code: 'RATE_LIMITED',
    message,
    requestId: req.id,
    retryAfterSec: Math.ceil(windowMs / 1000),
  }),
});
 
// Limits are per client IP. They are generous on purpose: Nigerian mobile
// carriers put whole neighbourhoods behind one address (carrier-grade NAT), so
// a tight IP budget locks out innocent neighbours. The precise control is the
// per-(email, ip) lockout below, which cannot be used to lock a victim out.
export const signupLimiter = limiter(15 * 60 * 1000, env.AUTH_RATE_LIMIT_SIGNUP_MAX, 'Too many accounts created from this network. Try again in 15 minutes.');
export const signinLimiter = limiter(15 * 60 * 1000, env.AUTH_RATE_LIMIT_SIGNIN_MAX, 'Too many sign-in attempts. Try again in 15 minutes.');
export const refreshLimiter = limiter(15 * 60 * 1000, env.AUTH_RATE_LIMIT_REFRESH_MAX, 'Too many session refreshes. Try again in 15 minutes.');
export const googleLimiter = limiter(15 * 60 * 1000, env.AUTH_RATE_LIMIT_GOOGLE_MAX, 'Too many Google sign-in attempts. Try again in 15 minutes.');
export const forgotLimiter = limiter(15 * 60 * 1000, env.AUTH_RATE_LIMIT_FORGOT_MAX, 'Too many reset codes requested. Try again in 15 minutes.');
export const resetLimiter = limiter(15 * 60 * 1000, env.AUTH_RATE_LIMIT_RESET_MAX, 'Too many reset attempts. Try again in 15 minutes.');