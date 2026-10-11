import { createHashRouter } from 'react-router-dom';
import { AuthedOutlet } from './Shell.jsx';

const homeRoute = {
  lazy: async () => ({ Component: (await import('../screens/HomeScreen.jsx')).default }),
};

const soonRoute = (title) => ({
  lazy: async () => {
    const { default: Soon } = await import('../screens/Soon.jsx');
    const SoonWithTitle = () => <Soon title={title} />;
    return { Component: SoonWithTitle };
  },
});

// HashRouter: works from any static host with zero server rewrites,
// keeps the back button working, and suits the installable PWA.
// Screens load lazily via the route `lazy` property (loading, empty and
// error states live in each screen).
export const router = createHashRouter([
  {
    element: <AuthedOutlet />,
    children: [
      { index: true, ...homeRoute },
      { path: 'map', ...soonRoute('Map') },
      { path: 'plan', ...soonRoute('Plan') },
      { path: 'history', ...soonRoute('History') },
      { path: 'settings', ...soonRoute('Settings') },
      { path: 'admin', ...soonRoute('Admin') },
      { path: '*', ...soonRoute('Not found') },
    ],
  },
]);
