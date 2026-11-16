import { useState, useEffect, useMemo, useCallback } from 'react';
import { AuthContext } from './auth-context.js';
import { getAuth, signout, authFetch, setAuth } from '../lib/auth.js';
import { readJson } from '../lib/api.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getAuth()?.user || null);
  // No stored user → already ready (no validation needed). Stored user →
  // guards wait until boot validation finishes; never trust stale storage.
  const [authReady, setAuthReady] = useState(() => !getAuth()?.user);

  useEffect(() => {
    if (!getAuth()?.user) return;
    let live = true;
    authFetch('/auth/me')
      .then((res) => readJson(res))
      .then((data) => {
        if (!live) return;
        if (data?.user) setAuth({ user: data.user, accessToken: getAuth()?.accessToken });
        else setUser(null);
      })
      .catch(() => { if (live) setUser(null); })
      .finally(() => { if (live) setAuthReady(true); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const onCleared = () => setUser(null);
    // 'auth:expired' comes from a rejected refresh; 'auth:cleared' from an
    // explicit sign-out or account deletion. Both must drop the React copy of
    // the user, not just the stored token.
    window.addEventListener('auth:expired', onCleared);
    window.addEventListener('auth:cleared', onCleared);
    return () => {
      window.removeEventListener('auth:expired', onCleared);
      window.removeEventListener('auth:cleared', onCleared);
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    await signout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, signOut: handleSignOut, authReady }),
    [user, handleSignOut, authReady]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
