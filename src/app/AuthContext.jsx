import { useState, useEffect, useMemo, useCallback } from 'react';
import { AuthContext } from './auth-context.js';
import { getAuth, signout } from '../lib/auth.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getAuth()?.user || null);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, setUser, signOut: handleSignOut }), [user, handleSignOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
