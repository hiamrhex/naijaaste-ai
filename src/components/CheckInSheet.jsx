import { useState } from 'react';
import { Star, X } from 'lucide-react';
import { useCheckIn } from '../hooks/useCheckIn.js';
import { useLanguage } from '../app/useLanguage.js';
import { postReport } from '../lib/auth.js';

export function CheckInSheet() {
  const { candidate, dismiss, answer, closeAfterWrong } = useCheckIn();
  const { t } = useLanguage();
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wrongOpen, setWrongOpen] = useState(false);
  const [wrongText, setWrongText] = useState('');
  const [wrongDone, setWrongDone] = useState(false);

  if (!candidate) return null;

  const submit = async () => {
    if (stars < 1) return;
    setBusy(true);
    setError('');
    try {
      const { low } = await answer({ stars, note: note.trim() || undefined });
      setNote('');
      setStars(0);
      if (low) {
        setWrongOpen(true);
        setWrongDone(false);
        setWrongText('');
      }
    } catch (err) {
      setError(err.message || t('genericError'));
    } finally {
      setBusy(false);
    }
  };

  const submitWrong = async () => {
    if (!wrongText.trim()) return;
    setBusy(true);
    setError('');
    try {
      await postReport({
        type: 'other',
        message: `Check-in ${stars} star(s) for ${candidate.restaurant_id}: ${wrongText.trim().slice(0, 1500)}`,
        screen: 'check-in',
        restaurant_id: candidate.restaurant_id,
      });
      setWrongDone(true);
    } catch (err) {
      setError(err.message || t('genericError'));
    } finally {
      setBusy(false);
    }
  };

  const closeWrong = () => {
    setWrongOpen(false);
    closeAfterWrong();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={t('checkinTitle')} style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 500, padding: '0 16px calc(16px + env(safe-area-inset-bottom))' }}>
      <div className="fade-in" style={{ maxWidth: 520, margin: '0 auto', background: 'var(--bg-card)', border: '1px solid rgba(249,115,22,0.4)', borderRadius: 16, padding: '18px', boxShadow: '0 24px 60px rgba(0,0,0,0.55)' }}>
        {!wrongOpen ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{t('checkinTitle')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{candidate.restaurant_id}</div>
              </div>
              <button onClick={dismiss} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: 'var(--text-hint)', cursor: 'pointer', padding: 8, minWidth: 40, minHeight: 40 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, margin: '14px 0 12px' }} role="radiogroup" aria-label="Stars from 1 to 5">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  role="radio"
                  aria-checked={stars === s}
                  aria-label={`${s} star${s > 1 ? 's' : ''}`}
                  onClick={() => setStars(s)}
                  style={{ flex: 1, background: s <= stars ? 'rgba(249,115,22,0.14)' : 'var(--bg-card-hover)', border: `1px solid ${s <= stars ? 'rgba(249,115,22,0.5)' : 'var(--border)'}`, borderRadius: 10, padding: 10, cursor: 'pointer', minHeight: 48 }}
                >
                  <Star size={18} color={s <= stars ? 'var(--orange)' : 'var(--text-hint)'} fill={s <= stars ? 'var(--orange)' : 'none'} />
                </button>
              ))}
            </div>
            <label htmlFor="checkin-note" className="sr-only">Optional note</label>
            <input
              id="checkin-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder="Optional note…"
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 12px', fontSize: 13.5, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', minHeight: 46 }}
            />
            {error && <div role="alert" style={{ fontSize: 12.5, color: '#F87171', marginTop: 8 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={dismiss} style={{ flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', minHeight: 48 }}>
                {t('checkinSkip')}
              </button>
              <button onClick={submit} disabled={stars < 1 || busy} style={{ flex: 2, background: 'linear-gradient(120deg, #F97316, #FB923C)', border: 'none', borderRadius: 10, padding: '12px', fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', minHeight: 48, opacity: stars < 1 || busy ? 0.6 : 1 }}>
                {busy ? 'Sending…' : 'Send rating'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{wrongDone ? 'Thank you.' : t('checkinWrong')}</div>
            {!wrongDone ? (
              <>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '6px 0 10px' }}>
                  Tell us briefly — it goes to the team as a report.
                </p>
                <label htmlFor="checkin-wrong" className="sr-only">What went wrong</label>
                <textarea
                  id="checkin-wrong"
                  value={wrongText}
                  onChange={(e) => setWrongText(e.target.value.slice(0, 1500))}
                  rows={3}
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 12px', fontSize: 13.5, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
                />
                {error && <div role="alert" style={{ fontSize: 12.5, color: '#F87171', marginTop: 8 }}>{error}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={closeWrong} style={{ flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', minHeight: 48 }}>
                    Skip
                  </button>
                  <button onClick={submitWrong} disabled={!wrongText.trim() || busy} style={{ flex: 2, background: 'linear-gradient(120deg, #F97316, #FB923C)', border: 'none', borderRadius: 10, padding: '12px', fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', minHeight: 48, opacity: !wrongText.trim() || busy ? 0.6 : 1 }}>
                    {busy ? 'Sending…' : 'Send feedback'}
                  </button>
                </div>
              </>
            ) : (
              <button onClick={closeWrong} style={{ width: '100%', marginTop: 12, background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', minHeight: 48 }}>
                Done
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
