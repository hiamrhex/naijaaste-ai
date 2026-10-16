import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.js';

const checkingFallback = (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
    Checking session…
  </div>
);

/* Protected pages: logged-out visitors go to /login?next=<here>.
   Waits for boot validation — never trusts the stale stored user. */
export function RequireAuth({ children }) {
  const { user, authReady } = useAuth();
  const location = useLocation();
  if (!authReady) return checkingFallback;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

/* Login/signup/forgot: logged-in visitors bounce home (no dead-end auth pages). */
export function GuestOnly({ children }) {
  const { user, authReady } = useAuth();
  if (!authReady) return checkingFallback;
  if (user) return <Navigate to="/" replace />;
  return children;
}

/* Admin pages: logged-out → login; non-admin → 403 screen (never the admin UI). */
export function AdminOnly({ children }) {
  const { user, authReady } = useAuth();
  const location = useLocation();
  if (!authReady) return checkingFallback;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (user.role !== 'admin') return <Navigate to="/403" replace />;
  return children;
}
