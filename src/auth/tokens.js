import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const getSecrets = () => {
  const access = process.env.JWT_ACCESS_SECRET;
  const refresh = process.env.JWT_REFRESH_SECRET;
  if (!access || !refresh) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set');
  }
  return { access, refresh };
};

export const signAccessToken = (user) => {
  const { access } = getSecrets();
  return jwt.sign(
    { sub: user.id, email: user.email, type: 'access' },
    access,
    { algorithm: 'HS256', expiresIn: ACCESS_TTL, issuer: 'naijataste', audience: 'naijataste-client' }
  );
};

export const signRefreshToken = (user) => {
  const { refresh } = getSecrets();
  const jti = randomUUID();
  const token = jwt.sign(
    { sub: user.id, jti, type: 'refresh' },
    refresh,
    { algorithm: 'HS256', expiresIn: REFRESH_TTL, issuer: 'naijataste', audience: 'naijataste-client' }
  );
  return { token, jti, expiresAt: new Date(Date.now() + REFRESH_TTL_MS).toISOString() };
};

export const verifyAccessToken = (token) => {
  const { access } = getSecrets();
  return jwt.verify(token, access, {
    algorithms: ['HS256'], issuer: 'naijataste', audience: 'naijataste-client',
  });
};

export const verifyRefreshToken = (token) => {
  const { refresh } = getSecrets();
  return jwt.verify(token, refresh, {
    algorithms: ['HS256'], issuer: 'naijataste', audience: 'naijataste-client',
  });
};
