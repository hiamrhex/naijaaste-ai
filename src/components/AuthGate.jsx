import { useState } from 'react';
import { ChefHat, ArrowRight, Loader2, Eye, EyeOff, Shield } from 'lucide-react';
import GithubIcon from './GithubIcon.jsx';
import { signin, signup } from '../lib/auth.js';

const S = {
  wrap: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#080810', padding: '24px 16px', position: 'relative', overflow: 'hidden',
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
  },
  glow: {
    position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
    width: 700, height: 400, pointerEvents: 'none',
    background: 'radial-gradient(ellipse, rgba(249,115,22,0.10) 0%, transparent 70%)',
  },
  card: {
    width: '100%', maxWidth: 420, background: '#111827', border: '1px solid #1F2937',
    borderRadius: 20, padding: '32px 28px', position: 'relative', zIndex: 1,
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
  },
};

const input = (focused) => ({
  width: '100%', boxSizing: 'border-box', background: '#0D0D1A',
  border: `1px solid ${focused ? 'rgba(249,115,22,0.5)' : '#1F2937'}`,
  borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#F9FAFB',
  fontFamily: 'inherit', outline: 'none', transition: 'border 0.2s',
});

const btn = {
  width: '100%', background: '#F97316', border: 'none', borderRadius: 10,
  padding: '12px 14px', fontSize: 14.5, fontWeight: 700, color: '#fff',
  cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
  alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s',
};

export default function AuthGate({ onAuth }) {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const user = mode === 'signin'
        ? await signin({ email, password })
        : await signup({ name, email, password });
      onAuth(user);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={S.wrap}>
      <div style={S.glow} />
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, background: 'rgba(249,115,22,0.1)',
            border: '1px solid rgba(249,115,22,0.3)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <ChefHat size={20} color="#F97316" />
          </div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 19, color: '#F9FAFB', letterSpacing: '-0.3px' }}>
              NaijaTaste <span style={{ color: '#F97316' }}>AI</span>
            </div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>Your elite dining concierge</div>
          </div>
        </div>

        <div style={{
          display: 'flex', gap: 4, background: '#0D0D1A', border: '1px solid #1F2937',
          borderRadius: 10, padding: 4, margin: '20px 0 18px',
        }}>
          {['signin', 'signup'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1, border: 'none', borderRadius: 8, padding: '9px 0',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: mode === m ? '#F97316' : 'transparent',
                color: mode === m ? '#fff' : '#9CA3AF', transition: 'all 0.2s',
              }}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <label style={{ display: 'block' }}>
              <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, display: 'block', marginBottom: 6 }}>Full name</span>
              <input
                style={input(focus === 'name')}
                value={name} onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocus('name')} onBlur={() => setFocus('')}
                placeholder="Ada Obi" autoComplete="name" required minLength={2}
              />
            </label>
          )}
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, display: 'block', marginBottom: 6 }}>Email</span>
            <input
              style={input(focus === 'email')}
              value={email} onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocus('email')} onBlur={() => setFocus('')}
              placeholder="you@example.com" type="email" autoComplete="email" required
            />
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, display: 'block', marginBottom: 6 }}>Password</span>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...input(focus === 'pw'), paddingRight: 44 }}
                value={password} onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocus('pw')} onBlur={() => setFocus('')}
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                type={showPw ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required minLength={mode === 'signup' ? 8 : 1}
              />
              <button
                type="button" onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer',
                  padding: 6, display: 'flex',
                }}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 9, padding: '9px 12px', fontSize: 12.5, color: '#F87171',
            }} role="alert">
              {error}
            </div>
          )}

          <button type="submit" style={{ ...btn, opacity: busy ? 0.7 : 1 }} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : null}
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            {!busy && <ArrowRight size={15} />}
          </button>
        </form>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          marginTop: 16, fontSize: 11, color: '#6B7280',
        }}>
          <Shield size={12} color="#10B981" />
          JWT auth · bcrypt hashing · rate-limited · httpOnly cookies
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <a
            href="https://github.com/hiamrhex/naijaaste-ai"
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
              color: '#9CA3AF', textDecoration: 'none',
            }}
          >
            <GithubIcon size={14} /> View source on GitHub
          </a>
        </div>
      </div>

      <p style={{ position: 'absolute', bottom: 18, fontSize: 11, color: '#4B5563', zIndex: 1, margin: 0 }}>
        Developed by Team PRiME · DSN × BCT LLM Agent Challenge 3.0 · 2026
      </p>
    </div>
  );
}
