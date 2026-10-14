import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Trash2, LogOut, Globe, Moon, Sun, ShieldCheck, ChevronRight } from 'lucide-react';
import { useAuth } from '../app/useAuth.js';
import { useTheme } from '../app/useTheme.js';
import { useLanguage } from '../app/useLanguage.js';
import { authFetch, deleteAccount, getFavorites } from '../lib/auth.js';
import { ScreenHead } from '../components/ScreenHead.jsx';
import { readHistory } from '../hooks/useConcierge.js';
import { readPlans } from '../lib/plans.js';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { dark, toggle } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ favorites: 0, ratings: 0, history: 0, plans: 0 });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const favs = await getFavorites();
        let ratings = 0;
        try {
          const res = await authFetch('/ratings');
          if (res.ok) ratings = ((await res.json()).data || []).length;
        } catch { /* offline */ }
        if (!cancelled) {
          setCounts({
            favorites: favs.length,
            ratings,
            history: readHistory().length,
            plans: readPlans().length,
          });
        }
      } catch { /* offline */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const exportData = async () => {
    let ratings = [];
    try {
      const res = await authFetch('/ratings');
      if (res.ok) ratings = (await res.json()).data || [];
    } catch { /* offline */ }
    const bundle = {
      exported_at: new Date().toISOString(),
      profile: { name: user?.name, email: user?.email, role: user?.role },
      preferences: { language: lang, theme: dark ? 'dark' : 'light' },
      favorites: await getFavorites().catch(() => []),
      ratings,
      chat_history: readHistory(),
      plans: readPlans(),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'naijataste-data.json';
    a.click();
    URL.revokeObjectURL(url);
    setNotice('Your data is downloading.');
  };

  const clearLocal = () => {
    try {
      for (const k of ['nt.history.v1', 'nt.plans.v1']) localStorage.removeItem(k);
    } catch { /* noop */ }
    setCounts((c) => ({ ...c, history: 0, plans: 0 }));
    setNotice('This device’s chats and plans are cleared.');
  };

  const doDelete = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteAccount();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message || t('genericError'));
    } finally {
      setBusy(false);
    }
  };

  const row = {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '12px 14px', width: '100%', boxSizing: 'border-box',
    color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'left',
  };

  return (
    <div>
      <ScreenHead title="Settings" subtitle={user?.email || ''} />
      <div style={{ padding: '0 16px 24px', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notice && (
          <div role="status" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: '#10B981' }}>
            {notice}
          </div>
        )}
        {error && (
          <div role="alert" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: '#F87171' }}>
            {error}
          </div>
        )}

        <div style={row}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            background: 'linear-gradient(135deg, #F97316, #FB923C)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#fff',
          }}>
            {user?.picture
              ? <img src={user.picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (user?.name?.[0] || 'F')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{user?.name || 'Foodie'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
          </div>
          {user?.role === 'admin' && (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', padding: '3px 9px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={11} /> admin
            </span>
          )}
        </div>

        <div style={row}>
          <Globe size={16} color="var(--orange)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Language</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>English or Pidgin across the app</div>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--input-bg)', borderRadius: 9, padding: 3 }}>
            {['en', 'pg'].map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                style={{
                  border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12.5, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', minHeight: 36,
                  background: lang === l ? 'var(--orange)' : 'transparent',
                  color: lang === l ? '#fff' : 'var(--text-muted)',
                }}
              >
                {l === 'en' ? 'English' : 'Pidgin'}
              </button>
            ))}
          </div>
        </div>

        <button onClick={toggle} style={{ ...row, cursor: 'pointer' }} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>
          {dark ? <Sun size={16} color="var(--orange)" /> : <Moon size={16} color="var(--orange)" />}
          <div style={{ flex: 1, fontWeight: 600, fontSize: 13.5, textAlign: 'left' }}>Theme</div>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{dark ? 'Dark' : 'Light'}</span>
          <ChevronRight size={14} color="var(--text-hint)" />
        </button>

        <div style={{ ...row, cursor: 'default' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t('remembersTitle')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.7 }}>
              {counts.favorites} saved spots · {counts.ratings} ratings · {counts.history} chats · {counts.plans} plans
              <br />Taste signals live in your chat sessions; nothing sensitive is stored without your chats.
            </div>
          </div>
        </div>

        <button onClick={exportData} style={{ ...row, cursor: 'pointer' }}>
          <Download size={16} color="var(--green)" />
          <div style={{ flex: 1, fontWeight: 600, fontSize: 13.5, textAlign: 'left' }}>{t('exportData')}</div>
          <ChevronRight size={14} color="var(--text-hint)" />
        </button>

        <button onClick={clearLocal} style={{ ...row, cursor: 'pointer' }}>
          <Trash2 size={16} color="var(--amber)" />
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Clear this device</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Removes local chats and plans only</div>
          </div>
        </button>

        <button onClick={signOut} style={{ ...row, cursor: 'pointer' }}>
          <LogOut size={16} color="var(--text-muted)" />
          <div style={{ flex: 1, fontWeight: 600, fontSize: 13.5, textAlign: 'left' }}>Sign out</div>
        </button>

        <div style={{ border: '1px solid rgba(239,68,68,0.35)', borderRadius: 12, padding: 14, background: 'rgba(239,68,68,0.04)' }}>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ background: 'none', border: 'none', color: '#F87171', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 8, minHeight: 44 }}
            >
              {t('deleteAccount')}
            </button>
          ) : (
            <div>
              <p style={{ fontSize: 12.5, color: '#F87171', margin: '0 0 10px', lineHeight: 1.6 }}>{t('deleteAccountConfirm')}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={doDelete}
                  disabled={busy}
                  style={{ flex: 1, background: '#DC2626', border: 'none', borderRadius: 10, padding: '11px 14px', fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', minHeight: 46, opacity: busy ? 0.7 : 1 }}
                >
                  {busy ? 'Deleting…' : 'Yes, erase everything'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                  style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', minHeight: 46 }}
                >
                  Keep my account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
