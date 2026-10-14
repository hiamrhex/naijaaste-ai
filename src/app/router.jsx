import { createBrowserRouter } from 'react-router-dom';
import { PublicLayout, AppLayout } from './Shell.jsx';
import { RequireAuth, GuestOnly, AdminOnly } from './guards.jsx';
import { SessionExpiryRoot } from './SessionExpiry.jsx';

const homeRoute = {
  lazy: async () => ({ Component: (await import('../screens/HomeScreen.jsx')).default }),
};

const authRoute = (mode) => ({
  lazy: async () => {
    const { default: AuthScreen } = await import('../screens/AuthScreen.jsx');
    const GuardedAuth = () => (
      <GuestOnly>
        <AuthScreen mode={mode} />
      </GuestOnly>
    );
    return { Component: GuardedAuth };
  },
});

const adminRoute = {
  lazy: async () => {
    const { default: Soon } = await import('../screens/Soon.jsx');
    const GuardedAdmin = () => (
      <AdminOnly>
        <Soon title="Admin" />
      </AdminOnly>
    );
    return { Component: GuardedAdmin };
  },
};

const soonRoute = (title) => ({
  lazy: async () => {
    const { default: Soon } = await import('../screens/Soon.jsx');
    const SoonWithTitle = () => <Soon title={title} />;
    return { Component: SoonWithTitle };
  },
});

const errorRoute = (which) => ({
  lazy: async () => {
    const mod = await import('../screens/ErrorScreens.jsx');
    const C = which === '403' ? mod.Forbidden : mod.NotFound;
    return { Component: C };
  },
});

/* Expired/invalid sessions land on /login — see SessionExpiry.jsx. */

// BrowserRouter: real shareable URLs (/app/login, /app/settings…) instead of
// hash fragments — required for shared links, auth deep-links and social
// previews. The app is served under /app (landing owns /); basename keeps
// every Link/navigate correct. Served via vercel.json SPA fallback for /app/*
// (and vite preview/dev fallback locally).
export const router = createBrowserRouter([
  {
    element: <SessionExpiryRoot />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: 'login', ...authRoute('signin') },
          { path: 'signup', ...authRoute('signup') },
          { path: 'forgot-password', ...authRoute('forgot') },
        ],
      },
      {
        element: <RequireAuth><AppLayout /></RequireAuth>,
        children: [
          { index: true, ...homeRoute },
          { path: 'dashboard', ...homeRoute },
          { path: 'map', ...soonRoute('Map') },
          { path: 'plan', ...soonRoute('Plan') },
          { path: 'history', ...soonRoute('History') },
          { path: 'settings', ...soonRoute('Settings') },
          { path: 'admin', ...adminRoute },
        ],
      },
      {
        element: <PublicLayout />,
        children: [
          { path: '403', ...errorRoute('403') },
          { path: '*', ...errorRoute('404') },
        ],
      },
    ],
  },
], { basename: '/app' });
