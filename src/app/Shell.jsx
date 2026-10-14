import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { TabBar } from '../components/TabBar.jsx';
import { InstallSheet } from '../components/InstallSheet.jsx';
import { CheckInSheet } from '../components/CheckInSheet.jsx';
import { useTheme } from './useTheme.js';

/* Pure theme wrapper — auth gating now lives in route guards (guards.jsx),
   so public pages (login/signup) render without the app chrome. */
export function Shell({ children }) {
  const { t } = useTheme();
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

const loadingFallback = (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
    Loading…
  </div>
);

/* Public pages: theme only, no tab bar. */
export function PublicLayout() {
  return (
    <Shell>
      <Suspense fallback={loadingFallback}>
        <div className="app-main public">
          <Outlet />
        </div>
      </Suspense>
    </Shell>
  );
}

/* App pages: theme + tab bar. Guards (not Shell) decide who gets in. */
export function AppLayout() {
  return (
    <Shell>
      <Suspense fallback={loadingFallback}>
        <div className="app-main">
          <Outlet />
        </div>
        <TabBar />
        <InstallSheet />
        <CheckInSheet />
      </Suspense>
    </Shell>
  );
}
