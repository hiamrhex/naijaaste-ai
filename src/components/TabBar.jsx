import { NavLink } from 'react-router-dom';
import { Home, Map, ClipboardList, History, Settings, ShieldCheck } from 'lucide-react';
import { useAuth } from '../app/useAuth.js';

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/map', label: 'Map', icon: Map },
  { to: '/plan', label: 'Plan', icon: ClipboardList },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function TabBar() {
  const { user } = useAuth();
  return (
    <nav className="tabbar" aria-label="Main sections">
      <div className="tabbar-brand" aria-hidden="true">
        <span className="tabbar-brand-mark">N</span>
        <span className="tabbar-brand-name">NaijaTaste <em>AI</em></span>
      </div>
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `tab-link${isActive ? ' tab-active' : ''}`}
          aria-label={label}
        >
          <Icon size={20} aria-hidden="true" />
          <span className="tab-label">{label}</span>
        </NavLink>
      ))}
      {user?.role === 'admin' && (
        <NavLink to="/admin" className={({ isActive }) => `tab-link${isActive ? ' tab-active' : ''}`} aria-label="Admin dashboard">
          <ShieldCheck size={20} aria-hidden="true" />
          <span className="tab-label">Admin</span>
        </NavLink>
      )}
    </nav>
  );
}
