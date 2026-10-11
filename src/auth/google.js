import { OAuth2Client } from 'google-auth-library';
import { env } from '../env.js';

let client = null;
const getClient = () => {
  if (!env.GOOGLE_CLIENT_ID) return null;
  if (!client) client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  return client;
};

export const googleAuthEnabled = () => !!env.GOOGLE_CLIENT_ID;

// Verifies a Google ID token (identity-services credential) and returns the
// normalized profile. Throws Error with code GOOGLE_NOT_CONFIGURED or
// GOOGLE_INVALID_TOKEN — never echoes token material.
export const verifyGoogleCredential = async (credential) => {
  const oauth = getClient();
  if (!oauth) {
    const err = new Error('Google sign-in is not configured on this server');
    err.code = 'GOOGLE_NOT_CONFIGURED';
    throw err;
  }
  let payload;
  try {
    const ticket = await oauth.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    const err = new Error('Invalid Google credential');
    err.code = 'GOOGLE_INVALID_TOKEN';
    throw err;
  }
  if (!payload?.email || payload.email_verified === false) {
    const err = new Error('Invalid Google credential');
    err.code = 'GOOGLE_INVALID_TOKEN';
    throw err;
  }
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture || null,
  };
};
