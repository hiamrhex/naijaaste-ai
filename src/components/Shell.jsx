import { ChefHat, LogOut, User, Crosshair, Sun, Moon, RefreshCw } from 'lucide-react';
import GithubIcon from './GithubIcon.jsx';
import { useTheme } from '../app/useTheme.js';

export function Header({ user, onSignOut, onNearMe, nearbyLoading, showNearby, onReset }) {
  const { dark, toggle } = useTheme();
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'var(--header-bg)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      padding: '0 20px', height: 56,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'var(--orange-light)',
          border: '1px solid rgba(249,115,22,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ChefHat size={17} color="var(--orange)" />
        </div>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
          NaijaTaste <span style={{ color: 'var(--orange)' }}>AI</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 11, color: 'var(--text-muted)',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          padding: '4px 10px', borderRadius: 20,
          display: 'none',
        }} className="badge-desktop">
          DSN × BCT Challenge 3.0
        </span>
        <a
          href="https://github.com/hiamrhex/naijaaste-ai"
          target="_blank"
          rel="noopener noreferrer"
          title="View on GitHub"
          aria-label="View source on GitHub"
          style={{
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 8, padding: 7, cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            textDecoration: 'none', transition: 'all 0.2s',
          }}
        >
          <GithubIcon size={15} />
        </a>
        <span style={{
          fontSize: 12, color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          padding: '5px 11px', borderRadius: 20, maxWidth: 160,
        }} title={user?.email}>
          <User size={12} color="var(--orange)" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name?.split(' ')[0] || 'Foodie'}
          </span>
        </span>
        <button
          onClick={onNearMe}
          title="Find restaurants near me"
          aria-label="Find restaurants near me"
          style={{
            background: showNearby ? 'rgba(16,185,129,0.12)' : 'var(--bg-card)',
            border: `1px solid ${showNearby ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`,
            borderRadius: 20, padding: '6px 12px',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: showNearby ? 'var(--green)' : 'var(--text-secondary)',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
            minHeight: 36,
          }}
        >
          <Crosshair size={14} className={nearbyLoading ? 'spin' : undefined} />
          {nearbyLoading ? 'Locating…' : 'Near me'}
        </button>
        <button
          onClick={onSignOut}
          title="Sign out"
          aria-label="Sign out"
          style={{
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 8, padding: 7, cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            minWidth: 36, minHeight: 36, justifyContent: 'center',
          }}
        >
          <LogOut size={14} />
        </button>
        <button
          onClick={toggle}
          title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '6px 12px',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.2s', minHeight: 36,
          }}
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
          {dark ? 'Light' : 'Dark'}
        </button>
        <button
          onClick={onReset}
          title="Start over"
          aria-label="Start over"
          style={{
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 8, padding: 7, cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            minWidth: 36, minHeight: 36, justifyContent: 'center',
          }}
        >
          <RefreshCw size={14} />
        </button>
      </div>
    </header>
  );
}

export function Footer() {  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      padding: '16px 20px calc(16px + env(safe-area-inset-bottom))',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 12, color: 'var(--text-hint)', margin: '0 0 3px' }}>
        Developed by{' '}
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 13, color: 'var(--orange)', letterSpacing: '0.02em' }}>
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
