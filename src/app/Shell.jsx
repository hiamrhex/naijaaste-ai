import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import AuthGate from '../components/AuthGate.jsx';
import { useAuth } from './useAuth.js';
import { useTheme } from './useTheme.js';

export function Shell({ children }) {
  const { user, setUser } = useAuth();
  const { t } = useTheme();
  if (!user) return <AuthGate onAuth={(u) => setUser(u)} />;
  return (
    <div style={{
      ...t,
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      background: 'var(--bg-primary)',
      minHeight: '100vh',
      color: 'var(--text-primary)',
      transition: 'background 0.3s, color 0.3s',
      width: '100%',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {children}
    </div>
  );
}

export function AuthedOutlet() {
  return (
    <Shell>
      <Suspense
        fallback={(
          <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading…
          </div>
        )}
      >
        <Outlet />
      </Suspense>
    </Shell>
  );
}
