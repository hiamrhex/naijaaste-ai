import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flag, CheckCircle, Loader2 } from 'lucide-react';
import { postReport } from '../lib/auth.js';
import { useAuth } from '../app/useAuth.js';

const TYPES = [
  { value: 'bug', label: 'Bug — something broke' },
  { value: 'wrong-info', label: 'Wrong restaurant info' },
  { value: 'idea', label: 'Idea' },
  { value: 'other', label: 'Other' },
];
const APP_VERSION = '0.0.0';

export function FeedbackForm() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [type, setType] = useState(TYPES.some((t) => t.value === params.get('type')) ? params.get('type') : 'bug');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState(null);
  const prefillId = params.get('report') || '';

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const data = await postReport({
        type,
        message: message.trim(),
        screen: typeof globalThis.location !== 'undefined' ? globalThis.location.hash || globalThis.location.pathname : null,
        device: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
        app_version: APP_VERSION,
        restaurant_id: prefillId || undefined,
      });
      setTicket(data.ticket);
      setMessage('');
    } catch (err) {
      setError(err.message || 'Could not send report');
    } finally {
      setBusy(false);
    }
  };

  if (ticket) {
    return (
      <div role="status" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <CheckCircle size={16} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
            Thank you — we got it. Ticket {ticket}.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            Reported as {user?.email || 'you'} · diagnostics attached automatically.
          </div>
          <button
            onClick={() => setTicket(null)}
            style={{ marginTop: 8, background: 'none', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', minHeight: 40 }}
          >
            File another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
        <Flag size={14} color="var(--orange)" /> Report an issue
        {prefillId && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>· about {prefillId}</span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Report type">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            aria-pressed={type === t.value}
            style={{
              border: `1px solid ${type === t.value ? 'rgba(249,115,22,0.5)' : 'var(--border)'}`,
              background: type === t.value ? 'rgba(249,115,22,0.1)' : 'transparent',
              color: type === t.value ? 'var(--orange)' : 'var(--text-muted)',
              borderRadius: 20, padding: '8px 13px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', minHeight: 38,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <label htmlFor="feedback-message" className="sr-only">Describe the issue</label>
      <textarea
        id="feedback-message"
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
        placeholder="What happened? What did you expect?"
        rows={3}
        required
        minLength={3}
        style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 12px', fontSize: 13.5, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
      />
      {error && <div role="alert" style={{ fontSize: 12.5, color: '#F87171' }}>{error}</div>}
      <button
        type="submit"
        disabled={busy || message.trim().length < 3}
        style={{
          background: 'linear-gradient(120deg, #F97316, #FB923C)', border: 'none', borderRadius: 10,
          padding: '12px 14px', fontSize: 13.5, fontWeight: 700, color: '#fff',
          cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
          alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 48,
          opacity: busy || message.trim().length < 3 ? 0.6 : 1,
        }}
      >
        {busy ? <><Loader2 size={15} className="spin" /> Sending…</> : 'Send report'}
      </button>
      <p style={{ fontSize: 11, color: 'var(--text-hint)', margin: 0 }}>
        Screen, device, app version, your ID and the last request ID attach automatically.
      </p>
    </form>
  );
}
