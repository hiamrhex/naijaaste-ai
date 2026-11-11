import { ChefHat, LogOut, User, Crosshair, Sun, Moon, RefreshCw } from 'lucide-react';
import GithubIcon from './GithubIcon.jsx';
import { useTheme } from '../app/useTheme.js';
import { GITHUB_REPO_URL } from '../constants/index.js';

export function Header({ user, onSignOut, onNearMe, nearbyLoading, showNearby, onReset }) {
  const { dark, toggle } = useTheme();
  return (
    <header className="nt-header">
      <div className="brand">
        <div className="brand-mark">
          <ChefHat size={17} color="var(--orange)" aria-hidden="true" />
        </div>
        <span className="brand-name">
          NaijaTaste <em>AI</em>
        </span>
      </div>

      <div className="header-actions">
        <span className="header-user" title={user?.email}>
          <User size={12} color="var(--orange)" aria-hidden="true" />
          <span>{user?.name?.split(' ')[0] || 'Foodie'}</span>
        </span>
        <a
          className="icon-btn header-github"
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="View on GitHub"
          aria-label="View source on GitHub"
        >
          <GithubIcon size={15} />
        </a>
        <button
          type="button"
          className={`pill-btn${showNearby ? ' is-on' : ''}`}
          onClick={onNearMe}
          title="Find restaurants near me"
          aria-label="Find restaurants near me"
        >
          <Crosshair size={14} className={nearbyLoading ? 'spin' : undefined} aria-hidden="true" />
          <span className="pill-label">{nearbyLoading ? 'Locating…' : 'Near me'}</span>
        </button>
        <button
          type="button"
          className="icon-btn header-reset"
          onClick={onReset}
          title="Start over"
          aria-label="Start over"
        >
          <RefreshCw size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={toggle}
          title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {dark ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onSignOut}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={14} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border)',
        padding: '16px 20px calc(16px + env(safe-area-inset-bottom))',
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: 12, color: 'var(--text-hint)', margin: '0 0 3px' }}>
        Developed by{' '}
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--orange)', letterSpacing: '-0.01em' }}>
          Team PRiME
        </span>
        {' '}·{' '}
        <span style={{ color: 'var(--text-hint)' }}>DSN × BCT LLM Agent Challenge 3.0 · 2026</span>
      </p>
      <p style={{ fontSize: 11, color: 'var(--text-hint)', margin: 0, opacity: 0.6 }}>
        60 Nigerian restaurants across 8 cities
      </p>
    </footer>
  );
}
