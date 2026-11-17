import { describe, it, expect, vi, beforeEach } from 'vitest';

// requireAuth used to run verifyAccessToken and findUserById inside one try, so
// a database error was reported as 401 INVALID_TOKEN. The SPA treats 401 as an
// expired session, so a single Neon blip signed every user out and the real
// cause never reached errorHandler or Sentry.

const store = vi.hoisted(() => ({ findUserById: vi.fn() }));
const tokens = vi.hoisted(() => ({ verifyAccessToken: vi.fn() }));

vi.mock('../src/auth/store.js', () => ({
  findUserById: store.findUserById,
  sanitize: (user) => ({ id: user.id, email: user.email, role: user.role, email_verified: user.email_verified }),
}));

vi.mock('../src/auth/tokens.js', () => ({
  verifyAccessToken: tokens.verifyAccessToken,
}));

const { requireAuth } = await import('../src/auth/middleware.js');

const makeRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return res;
};

const run = async (token = 'token') => {
  const req = { id: 'req-1', headers: { authorization: `Bearer ${token}` } };
  const res = makeRes();
  const next = vi.fn();
  await requireAuth(req, res, next);
  return { req, res, next };
};

beforeEach(() => {
  store.findUserById.mockReset();
  tokens.verifyAccessToken.mockReset();
});

describe('requireAuth', () => {
  it('passes a database failure to next() instead of answering 401', async () => {
    tokens.verifyAccessToken.mockReturnValue({ sub: 'user-1' });
    store.findUserById.mockRejectedValue(Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }));

    const { res, next } = await run();

    expect(res.statusCode).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].code).toBe('ECONNRESET');
  });

  it('answers 401 INVALID_TOKEN for a bad token', async () => {
    const err = new Error('jwt malformed');
    err.name = 'JsonWebTokenError';
    tokens.verifyAccessToken.mockImplementation(() => {
      throw err;
    });

    const { res, next } = await run();

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
    expect(store.findUserById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 401 TOKEN_EXPIRED for an expired token', async () => {
    const err = new Error('expired');
    err.name = 'TokenExpiredError';
    tokens.verifyAccessToken.mockImplementation(() => {
      throw err;
    });

    const { res } = await run();

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('answers 401 when the user row is gone', async () => {
    tokens.verifyAccessToken.mockReturnValue({ sub: 'user-1' });
    store.findUserById.mockResolvedValue(null);

    const { res, next } = await run();

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the sanitized user and continues on success', async () => {
    tokens.verifyAccessToken.mockReturnValue({ sub: 'user-1' });
    store.findUserById.mockResolvedValue({ id: 'user-1', email: 'a@b.c', role: 'user', email_verified: true, password_hash: 'secret' });

    const { req, res, next } = await run();

    expect(res.statusCode).toBeNull();
    expect(req.user).toEqual({ id: 'user-1', email: 'a@b.c', role: 'user', email_verified: true });
    expect(next).toHaveBeenCalledWith();
  });

  it('answers 403 EMAIL_NOT_VERIFIED for a valid token on an unproven mailbox', async () => {
    tokens.verifyAccessToken.mockReturnValue({ sub: 'user-1' });
    store.findUserById.mockResolvedValue({ id: 'user-1', email: 'a@b.c', role: 'user', email_verified: false });

    const { res, next } = await run();

    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(next).not.toHaveBeenCalled();
  });
});
