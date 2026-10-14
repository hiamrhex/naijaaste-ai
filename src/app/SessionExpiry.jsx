import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

/* Expired/invalid sessions land on /login with a safe return path,
   instead of silently dropping the user at a dead gate. */
export function SessionExpiryRoot() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const onExpired = () => {
      const next = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?next=${next}`, { replace: true });
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [navigate, location.pathname, location.search]);
  return <Outlet />;
}
