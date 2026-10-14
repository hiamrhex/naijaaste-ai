import { useState, useEffect, useRef } from 'react';
import { ChefHat, ArrowRight, Loader2, Eye, EyeOff, Shield, KeyRound, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import GithubIcon from './GithubIcon.jsx';
import { signin, signup, forgotPassword, resetPassword, googleSignIn } from '../lib/auth.js';
import { API } from '../constants/index.js';

const S = {
  wrap: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#050508', padding: '24px 16px', position: 'relative', overflow: 'hidden',
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
  },
  orb: (size, top, left, color, delay) => ({
    position: 'absolute', width: size, height: size, borderRadius: '50%',
    background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
    filter: 'blur(70px)', pointerEvents: 'none', top, left,
    animation: `aurora ${18 + delay}s ease-in-out ${delay}s infinite alternate`,
  }),
  card: {
    width: '100%', maxWidth: 430, background: 'rgba(14,15,22,0.72)',
    border: '1px solid transparent',
    backgroundImage:
      'linear-gradient(rgba(16,17,24,0.88), rgba(12,13,19,0.92)), '
      + 'linear-gradient(135deg, rgba(249,115,22,0.35), rgba(168,85,247,0.18), rgba(249,115,22,0.35))',
    backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box',
    borderRadius: 22, padding: '34px 30px', position: 'relative', zIndex: 1,
    boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
    backdropFilter: 'blur(18px)',
    animation: 'rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
  },
};

const input = (focused) => ({
  width: '100%', boxSizing: 'border-box',
  background: focused ? 'rgba(249,115,22,0.04)' : '#0A0B10',
  border: `1px solid ${focused ? 'rgba(249,115,22,0.6)' : '#1C1D2A'}`,
  borderRadius: 11, padding: '12px 14px', fontSize: 14, color: '#F9FAFB',
  fontFamily: 'inherit', outline: 'none',
  transition: 'border 0.25s, box-shadow 0.25s, background 0.25s',
  boxShadow: focused ? '0 0 0 3px rgba(249,115,22,0.12)' : 'none',
});

const btn = {
  width: '100%', border: 'none', borderRadius: 11,
  padding: '13px 14px', fontSize: 14.5, fontWeight: 700, color: '#fff',
  cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
  alignItems: 'center', justifyContent: 'center', gap: 8,
  background: 'linear-gradient(120deg, #F97316, #FB923C, #F97316)',
  backgroundSize: '200% 100%',
  transition: 'transform 0.15s, box-shadow 0.2s, opacity 0.15s',
  boxShadow: '0 8px 24px rgba(249,115,22,0.28)',
};

const ghostBtn = {
  width: '100%', background: 'transparent', border: '1px solid #23243A', borderRadius: 11,
  padding: '11px 14px', fontSize: 13.5, fontWeight: 600, color: '#9CA3AF',
  cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
  alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s',
};

const KEYFRAMES = `
@keyframes aurora {
  0%   { transform: translate(0, 0) scale(1); }
  100% { transform: translate(40px, -30px) scale(1.15); }
}
@keyframes rise {
  from { opacity: 0; transform: translateY(18px) scale(0.985); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes fadeSlide {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sheen {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
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
`;

const AUTH_MODES = ['signin', 'signup', 'forgot', 'reset'];

export default function AuthGate({ onAuth, initialMode = 'signin' }) {
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
        .then((r) => r.json())
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
              theme: 'filled_black', size: 'large', width: 360, text: 'continue_with',
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
  }, [onAuth]);

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

  return (
    <div style={S.wrap}>
      <style>{KEYFRAMES}</style>
      <div style={S.orb(520, '-12%', '12%', 'rgba(249,115,22,0.13)', 0)} />
      <div style={S.orb(430, '58%', '68%', 'rgba(168,85,247,0.10)', 3)} />
      <div style={S.orb(300, '72%', '8%', 'rgba(236,72,153,0.07)', 6)} />

      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13,
            background: 'linear-gradient(135deg, rgba(249,115,22,0.22), rgba(249,115,22,0.05))',
            border: '1px solid rgba(249,115,22,0.35)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(249,115,22,0.15)',
          }}>
            <ChefHat size={21} color="#F97316" />
          </div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 19, color: '#F9FAFB', letterSpacing: '-0.3px' }}>
              NaijaTaste <span style={{
                background: 'linear-gradient(90deg, #F97316, #FBBF24)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>AI</span>
            </div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>Your elite dining concierge</div>
          </div>
        </div>

        {isCredsMode && (
          <div style={{
            display: 'flex', gap: 4, background: '#0A0B10', border: '1px solid #1C1D2A',
            borderRadius: 12, padding: 4, margin: '20px 0 18px', position: 'relative',
          }}>
            {['signin', 'signup'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                style={{
                  flex: 1, border: 'none', borderRadius: 9, padding: '9px 0',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  background: mode === m
                    ? 'linear-gradient(120deg, #F97316, #FB923C)'
                    : 'transparent',
                  color: mode === m ? '#fff' : '#9CA3AF',
                  transition: 'background 0.3s, color 0.3s, box-shadow 0.3s',
                  boxShadow: mode === m ? '0 4px 14px rgba(249,115,22,0.3)' : 'none',
                }}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
        )}

        {!isCredsMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 18px' }}>
            <button
              type="button"
              onClick={() => switchMode('signin')}
              style={{
                background: 'none', border: '1px solid #23243A', borderRadius: 9,
                padding: 7, cursor: 'pointer', color: '#9CA3AF', display: 'flex',
                transition: 'border 0.2s, color 0.2s',
              }}
              aria-label="Back to sign in"
            >
              <ArrowLeft size={15} />
            </button>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: '#F9FAFB', display: 'flex', alignItems: 'center', gap: 7 }}>
                {mode === 'forgot' ? <Mail size={15} color="#F97316" /> : <KeyRound size={15} color="#F97316" />}
                {mode === 'forgot' ? 'Forgot password' : 'Enter reset code'}
              </div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                {mode === 'forgot' ? 'We will email you a 6-digit code' : `Code sent to ${email}`}
              </div>
            </div>
          </div>
        )}

        {notice && (
          <div className="fade-slide" style={{
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: '#10B981',
            display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12,
          }} role="status">
            <CheckCircle size={14} style={{ flexShrink: 0 }} />
            {notice}
          </div>
        )}

        {devOtp && (
          <div className="fade-slide" style={{
            background: 'rgba(249,115,22,0.07)', border: '1px dashed rgba(249,115,22,0.45)',
            borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: '#F97316',
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
              <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, display: 'block', marginBottom: 6 }}>Full name</span>
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
              <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, display: 'block', marginBottom: 6 }}>Email</span>
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
              <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, display: 'block', marginBottom: 6 }}>6-digit code</span>
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
              <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, display: 'block', marginBottom: 6 }}>
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
                    background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer',
                    padding: 6, display: 'flex',
                  }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
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
                  background: 'none', border: 'none', color: '#F97316', fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontWeight: 600,
                  transition: 'opacity 0.2s',
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && (
            <div className="err-shake" style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: '#F87171',
            }} role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              ...btn,
              opacity: busy ? 0.7 : 1,
              animation: busy ? 'none' : 'sheen 3.2s linear infinite',
              transform: 'translateY(0)',
            }}
            disabled={busy}
            onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(249,115,22,0.38)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(249,115,22,0.28)'; }}
          >
            {busy ? <Loader2 size={16} className="spin" /> : null}
            {busy
              ? 'Please wait…'
              : mode === 'signin' ? 'Sign in'
              : mode === 'signup' ? 'Create account'
              : mode === 'forgot' ? 'Send reset code'
              : 'Reset password'}
            {!busy && <ArrowRight size={15} />}
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
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #23243A, transparent)' }} />
              <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, letterSpacing: 0.5 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #23243A, transparent)' }} />
            </div>
            <div style={{
              borderRadius: 11, overflow: 'hidden', position: 'relative',
              border: '1px solid #23243A', transition: 'border 0.25s, box-shadow 0.25s',
              opacity: googleBusy ? 0.6 : 1,
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.45)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#23243A'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div
                ref={googleBtnRef}
                style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}
              />
              {googleBusy && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', background: 'rgba(10,11,16,0.6)',
                }}>
                  <Loader2 size={18} className="spin" color="#F9FAFB" />
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          marginTop: 18, fontSize: 11, color: '#6B7280',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#10B981',
            animation: 'pulseDot 2.2s ease-in-out infinite',
          }} />
          <Shield size={12} color="#10B981" />
          JWT · bcrypt · rate-limited · httpOnly cookies
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <a
            href="https://github.com/hiamrhex/naijaaste-ai"
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
              color: '#9CA3AF', textDecoration: 'none', transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F97316'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; }}
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
