import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, User } from 'lucide-react';
import { useAuth } from '../app/useAuth.js';

export function ScreenHead({ title, subtitle, backTo = '/' }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div style={{ padding: '18px 16px 12px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => navigate(backTo)}
          aria-label="Back to home"
          style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 9, padding: 8, cursor: 'pointer', color: 'var(--text-muted)',
            display: 'flex', minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, margin: 0, color: 'var(--text-primary)' }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{subtitle}</p>
          )}
        </div>
        <span style={{
          fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          padding: '5px 11px', borderRadius: 20, maxWidth: 140,
        }} title={user?.email}>
          <User size={12} color="var(--orange)" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name?.split(' ')[0] || 'Foodie'}
          </span>
        </span>
        <button
          onClick={signOut}
          title="Sign out"
          aria-label="Sign out"
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 8,
            padding: 7, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
            minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}
