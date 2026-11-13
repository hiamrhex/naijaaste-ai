import { useState, useEffect, useRef } from 'react';
import { ChefHat, ArrowRight, Loader2, Eye, EyeOff, Shield, KeyRound, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import GithubIcon from './GithubIcon.jsx';
import { signin, signup, forgotPassword, resetPassword, googleSignIn } from '../lib/auth.js';
import { API, GITHUB_REPO_URL } from '../constants/index.js';
import { readJson } from '../lib/api.js';
import { useTheme } from '../app/useTheme.js';

const S = {
  wrap: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-primary)', color: 'var(--text-primary)',
    padding: '32px 16px', position: 'relative',
    fontFamily: 'var(--font-body)',
  },
  card: {
    width: '100%', maxWidth: 430, background: 'var(--bg-card)',
    border: '1px solid var(--rim, var(--border))',
    borderRadius: 20, padding: '32px 28px',
    position: 'relative', zIndex: 1,
    boxShadow: 'var(--shadow-card, 0 18px 50px rgba(0,0,0,0.25))',
    animation: 'rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
  },
};

const input = (focused) => ({
  width: '100%', boxSizing: 'border-box',
  background: focused ? 'var(--bg-secondary)' : 'var(--bg-input)',
  border: `1px solid ${focused ? 'var(--orange-50)' : 'var(--border)'}`,
  borderRadius: 11, padding: '12px 14px', fontSize: 14,
  color: 'var(--text-primary)',
  fontFamily: 'inherit', outline: 'none',
  transition: 'border 0.18s, box-shadow 0.18s, background 0.18s',
  boxShadow: focused ? '0 0 0 3px var(--orange-10)' : 'none',
});

const btn = {
  width: '100%', border: '1px solid var(--orange)', borderRadius: 11,
  padding: '13px 14px', fontSize: 14, fontWeight: 700, color: '#FFF8F1',
  cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
  alignItems: 'center', justifyContent: 'center', gap: 8,
  background: 'var(--orange)',
  transition: 'background 0.16s, transform 0.12s, opacity 0.16s',
};

const ghostBtn = {
  width: '100%', background: 'transparent', border: '1px solid var(--border)', borderRadius: 11,
  padding: '11px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
  cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
  alignItems: 'center', justifyContent: 'center', gap: 8,
  transition: 'border 0.2s, color 0.2s',
};

const KEYFRAMES = `
@keyframes rise {
  from { opacity: 0; transform: translateY(14px) scale(0.99); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes fadeSlide {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-3px); }
  40%, 60% { transform: translateX(3px); }
}
@keyframes pulseDot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }
.fade-slide { animation: fadeSlide 0.3s ease both; }
.err-shake { animation: shake 0.4s ease; }
@media (prefers-reduced-motion: reduce) {
  .fade-slide, .err-shake { animation: none; }
}
`;

const AUTH_MODES = ['signin', 'signup', 'forgot', 'reset'];

export default function AuthGate({ onAuth, initialMode = 'signin' }) {
  const { dark } = useTheme();
  const [mode, setMode] = useState(AUTH_MODES.includes(initialMode) ? initialMode : 'signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleOn, setGoogleOn] = useState(false);
  const [focus, setFocus] = useState('');
  const googleBtnRef = useRef(null);

  const isCredsMode = mode === 'signin' || mode === 'signup';

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const load = () => {
      if (cancelled) return;
      fetch(`${API}/health`)
        .then((r) => readJson(r))
        .then((h) => {
          if (cancelled) return;
          if (!h?.features?.google_auth) return;
          setGoogleOn(true);
          const start = () => {
            if (cancelled || !window.google?.accounts?.id || !googleBtnRef.current) return;
            window.google.accounts.id.initialize({
              client_id: h.google_client_id || undefined,
              callback: async (resp) => {
                setGoogleBusy(true);
                setError('');
                try {
                  const user = await googleSignIn(resp.credential);
                  onAuth(user);
                } catch (err) {
                  setError(err.message || 'Google sign-in failed');
                } finally {
                  setGoogleBusy(false);
                }
              },
            });
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              theme: dark ? 'filled_black' : 'outline', size: 'large', width: 360, text: 'continue_with',
              shape: 'rectangular', logo_alignment: 'left',
            });
          };
          if (window.google?.accounts?.id) { start(); return; }
          const s = document.createElement('script');
          s.src = 'https://accounts.google.com/gsi/client';
          s.async = true;
          s.onload = () => { tries = 0; start(); };
          s.onerror = () => { if (++tries < 3) setTimeout(load, 800); };
          document.head.appendChild(s);
        })
        .catch(() => { /* health unreachable — hide button */ });
    };
    load();
    return () => { cancelled = true; };
  }, [onAuth, dark]);

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setNotice('');
    setDevOtp('');
    setShowPw(false);
  };

  const submitCreds = async (e) => {
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

  const submitForgot = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const data = await forgotPassword({ email });
      setNotice('If that account exists, a 6-digit reset code is on its way.');
      if (data.dev_otp) setDevOtp(data.dev_otp);
      setMode('reset');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await resetPassword({ email, otp, newPassword });
      setNotice('Password updated — sign in with your new password.');
      setOtp('');
      setNewPassword('');
      setPassword('');
      setMode('signin');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const labelStyle = {
    fontSize: 12, color: 'var(--text-muted)', fontWeight: 600,
    display: 'block', marginBottom: 6,
  };

  return (
    <div style={S.wrap}>
      <style>{KEYFRAMES}</style>

      <div style={S.card} data-testid="auth-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div className="brand-mark" aria-hidden="true">
            <ChefHat size={18} color="var(--orange)" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, letterSpacing: '-0.035em', color: 'var(--text-primary)' }}>
              NaijaTaste <em style={{ fontStyle: 'normal', color: 'var(--orange)' }}>AI</em>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
              The right Nigerian table, in one message.
            </div>
          </div>
        </div>

        {isCredsMode && (
          <div className="auth-tabs" role="tablist" aria-label="Account access">
            {['signin', 'signup'].map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className="auth-tab"
                data-active={mode === m}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
        )}

        {!isCredsMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 18px' }}>
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="icon-btn"
              style={{ width: 34, minHeight: 34 }}
              aria-label="Back to sign in"
            >
              <ArrowLeft size={15} aria-hidden="true" />
            </button>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
                {mode === 'forgot' ? <Mail size={15} color="var(--orange)" aria-hidden="true" /> : <KeyRound size={15} color="var(--orange)" aria-hidden="true" />}
                {mode === 'forgot' ? 'Forgot password' : 'Enter reset code'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {mode === 'forgot' ? 'We will email you a 6-digit code' : `Code sent to ${email}`}
              </div>
            </div>
          </div>
        )}

        {notice && (
          <div className="fade-slide" style={{
            background: 'var(--green-08)', border: '1px solid var(--green-25)',
            borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: 'var(--green)',
            display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12,
          }} role="status">
            <CheckCircle size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
            {notice}
          </div>
        )}

        {devOtp && (
          <div className="fade-slide" data-testid="dev-otp" style={{
            background: 'var(--orange-08)', border: '1px dashed var(--orange-40)',
            borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: 'var(--orange)',
            marginBottom: 12, textAlign: 'center',
          }} role="status">
            Dev mode (no SMTP configured) — your code:{' '}
            <strong style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, letterSpacing: 3 }}>{devOtp}</strong>
          </div>
        )}

        <form
          onSubmit={mode === 'signin' || mode === 'signup' ? submitCreds : mode === 'forgot' ? submitForgot : submitReset}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {mode === 'signup' && (
            <label style={{ display: 'block' }}>
              <span style={labelStyle}>Full name</span>
              <input
                style={input(focus === 'name')}
                value={name} onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocus('name')} onBlur={() => setFocus('')}
                placeholder="Ada Obi" autoComplete="name" required minLength={2}
              />
            </label>
          )}

          {(mode === 'signin' || mode === 'signup' || mode === 'forgot') && (
            <label style={{ display: 'block' }}>
              <span style={labelStyle}>Email</span>
              <input
                style={input(focus === 'email')}
                value={email} onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocus('email')} onBlur={() => setFocus('')}
                placeholder="you@example.com" type="email" autoComplete="email" required
              />
            </label>
          )}

          {mode === 'reset' && (
            <label style={{ display: 'block' }}>
              <span style={labelStyle}>6-digit code</span>
              <input
                style={{ ...input(focus === 'otp'), textAlign: 'center', fontSize: 20, letterSpacing: 10, fontFamily: 'ui-monospace, monospace' }}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onFocus={() => setFocus('otp')} onBlur={() => setFocus('')}
                placeholder="000000" inputMode="numeric" autoComplete="one-time-code" required
              />
            </label>
          )}

          {(mode === 'signin' || mode === 'signup' || mode === 'reset') && (
            <label style={{ display: 'block' }}>
              <span style={labelStyle}>
                {mode === 'reset' ? 'New password' : 'Password'}
              </span>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...input(focus === 'pw'), paddingRight: 44 }}
                  value={mode === 'reset' ? newPassword : password}
                  onChange={(e) => mode === 'reset' ? setNewPassword(e.target.value) : setPassword(e.target.value)}
                  onFocus={() => setFocus('pw')} onBlur={() => setFocus('')}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : mode === 'reset' ? 'At least 8 characters' : '••••••••'}
                  type={showPw ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required minLength={mode === 'signin' ? 1 : 8}
                />
                <button
                  type="button" onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    padding: 8, display: 'flex',
                  }}
                >
                  {showPw ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
            </label>
          )}

          {mode === 'signin' && (
            <div style={{ textAlign: 'right', marginTop: -4 }}>
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                style={{
                  background: 'none', border: 'none', color: 'var(--orange)', fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontWeight: 600,
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && (
            <div className="err-shake" style={{
              background: 'var(--red-08)', border: '1px solid var(--red-25)',
              borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: 'var(--red)',
            }} role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            style={{ ...btn, opacity: busy ? 0.7 : 1 }}
            disabled={busy}
          >
            {busy ? <Loader2 size={16} className="spin" aria-hidden="true" /> : null}
            {busy
              ? 'Please wait…'
              : mode === 'signin' ? 'Sign in'
              : mode === 'signup' ? 'Create account'
              : mode === 'forgot' ? 'Send reset code'
              : 'Reset password'}
            {!busy && <ArrowRight size={15} aria-hidden="true" />}
          </button>

          {mode === 'reset' && (
            <button type="button" style={ghostBtn} onClick={() => switchMode('forgot')} disabled={busy}>
              Send a new code
            </button>
          )}
        </form>

        {googleOn && isCredsMode && (
          <div className="fade-slide" style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, letterSpacing: 0.5 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{
              borderRadius: 11, overflow: 'hidden', position: 'relative',
              border: '1px solid var(--border)',
              opacity: googleBusy ? 0.6 : 1,
            }}>
              <div
                ref={googleBtnRef}
                style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}
              />
              {googleBusy && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)',
                  opacity: 0.7,
                }}>
                  <Loader2 size={18} className="spin" color="var(--text-primary)" />
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          marginTop: 20, fontSize: 11, color: 'var(--text-hint)',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--green)',
            animation: 'pulseDot 2.2s ease-in-out infinite',
          }} />
          <Shield size={12} color="var(--green)" aria-hidden="true" />
          JWT · bcrypt · rate-limited · httpOnly cookies
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <a
            href={GITHUB_REPO_URL}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
              color: 'var(--text-muted)', textDecoration: 'none',
            }}
          >
            <GithubIcon size={14} /> View source on GitHub
          </a>
        </div>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-hint)', margin: '18px 0 0', zIndex: 1, textAlign: 'center' }}>
        Developed by Team PRiME · DSN × BCT LLM Agent Challenge 3.0 · 2026
      </p>
    </div>
  );
}
