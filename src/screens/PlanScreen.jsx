import { useState } from 'react';
import { Users, Wallet, MapPin, Sparkles, Share2, Check } from 'lucide-react';
import { API } from '../constants/index.js';
import { RestaurantCard } from '../components/index.js';
import { ReviewModal } from '../components/ReviewModal.jsx';
import { ScreenHead } from '../components/ScreenHead.jsx';
import { useLanguage } from '../app/useLanguage.js';
import { readPlans, writePlans } from '../lib/plans.js';
import { recordCheckInEvent } from '../hooks/useCheckIn.js';
const BUDGETS = [
  { value: 'tight', label: 'Tight', budget_level: 'low' },
  { value: 'mid', label: 'Mid-range', budget_level: 'mid_range' },
  { value: 'premium', label: 'Premium', budget_level: 'premium' },
];
const OCCASIONS = ['date night', 'family outing', 'friends hangout', 'business meal', 'solo treat', 'celebration'];
const DIETARY = ['halal', 'vegetarian', 'no_pork', 'no_alcohol'];

export default function PlanScreen() {
  const { t } = useLanguage();
  const [groupSize, setGroupSize] = useState('2');
  const [budget, setBudget] = useState('mid');
  const [area, setArea] = useState('');
  const [occasion, setOccasion] = useState(OCCASIONS[2]);
  const [dietary, setDietary] = useState([]);
  const [status, setStatus] = useState('idle'); // idle|loading|ready|error
  const [error, setError] = useState('');
  const [recs, setRecs] = useState(null);
  const [shared, setShared] = useState(false);
  const [review, setReview] = useState(null);
  const [reviewRestaurant, setReviewRestaurant] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  const toggleDietary = (d) => {
    setDietary((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setShared(false);
    setStatus('loading');
    const size = Math.max(1, parseInt(groupSize, 10) || 1);
    const persona = {
      persona_id: `plan-${Date.now()}`,
      city: area.trim() || 'Lagos',
      budget_level: (BUDGETS.find((b) => b.value === budget) || BUDGETS[1]).budget_level,
      spice_tolerance: 'medium',
      ambience_preference: 'casual',
      social_context: size >= 5 ? 'group' : occasion,
      preferred_cuisines: ['Street Food'],
      dietary_flags: dietary.length ? dietary : ['none'],
      preference_history: [],
    };
    try {
      const res = await fetch(`${API}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data?.error?.message || t('genericError'));
      }
      const list = data.recommendations?.recommendations || data.recommendations || [];
      setRecs(list);
      setStatus('ready');
      try { globalThis.dispatchEvent(new Event('nt:good-moment')); } catch { /* noop */ }
      try { globalThis.dispatchEvent(new Event('nt:plan-done')); } catch { /* noop */ }
      if (list[0]?.restaurant_id) recordCheckInEvent(list[0].restaurant_id, 'planned');
      writePlans([{ id: `plan-${Date.now()}`, at: new Date().toISOString(), inputs: { groupSize: size, budget, area, occasion, dietary }, recs: list }, ...readPlans()]);
    } catch (err) {
      setError(err.message || t('genericError'));
      setStatus('error');
    }
  };

  const generateReview = async (restaurant) => {
    if (reviewLoading) return;
    setReviewLoading(true);
    setReviewRestaurant(restaurant);
    try {
      const res = await fetch(`${API}/generate-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: { persona_id: 'plan', city: area.trim() || 'Lagos', budget_level: 'mid_range', spice_tolerance: 'medium', preferred_cuisines: ['Street Food'], dietary_flags: dietary.length ? dietary : ['none'] },
          restaurant,
        }),
      });
      const data = await res.json();
      setReview(data);
      setShowReview(true);
    } catch { /* silent fail */
    } finally {
      setReviewLoading(false);
    }
  };

  const share = async () => {
    if (!recs?.length) return;
    const text = `Night-out shortlist (${occasion}, party of ${groupSize}):\n` +
      recs.slice(0, 5).map((r, i) => `${i + 1}. ${r.restaurant_name} — ${r.reasoning || ''}`.trim()).join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'NaijaTaste night-out plan', text });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setShared(true);
      if (recs[0]?.restaurant_id) recordCheckInEvent(recs[0].restaurant_id, 'shared');
    } catch {
      try { await navigator.clipboard.writeText(text); setShared(true); } catch { /* clipboard denied */ }
    }
  };

  const field = { display: 'block' };
  const label = { fontSize: 12, color: '#9CA3AF', fontWeight: 600, display: 'block', marginBottom: 6 };
  const control = {
    width: '100%', boxSizing: 'border-box', background: '#0A0B10',
    border: '1px solid #1C1D2A', borderRadius: 11, padding: '12px 14px',
    fontSize: 14, color: '#F9FAFB', fontFamily: 'inherit', outline: 'none', minHeight: 48,
  };

  return (
    <div>
      <ScreenHead title="Plan a night out" subtitle="Group size, budget, area, occasion, diet" />
      <div style={{ padding: '0 16px 24px', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <form
          onSubmit={submit}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={field}>
              <span style={label}><Users size={11} style={{ verticalAlign: -1 }} /> Group size</span>
              <input type="number" min="1" max="50" value={groupSize} onChange={(e) => setGroupSize(e.target.value)} style={control} inputMode="numeric" aria-label="Group size" />
            </label>
            <label style={field}>
              <span style={label}><Wallet size={11} style={{ verticalAlign: -1 }} /> Budget</span>
              <select value={budget} onChange={(e) => setBudget(e.target.value)} style={control} aria-label="Budget">
                {BUDGETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </label>
          </div>
          <label style={field}>
            <span style={label}><MapPin size={11} style={{ verticalAlign: -1 }} /> Area or city</span>
            <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Yaba, Lagos" style={control} autoComplete="address-level2" />
          </label>
          <div>
            <span style={label}>Occasion</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Occasion">
              {OCCASIONS.map((o) => (
                <button
                  key={o} type="button" onClick={() => setOccasion(o)}
                  aria-pressed={occasion === o}
                  style={{
                    border: `1px solid ${occasion === o ? 'rgba(249,115,22,0.5)' : 'var(--border)'}`,
                    background: occasion === o ? 'rgba(249,115,22,0.12)' : 'var(--bg-card)',
                    color: occasion === o ? 'var(--orange)' : 'var(--text-muted)',
                    borderRadius: 20, padding: '8px 14px', fontSize: 12.5, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', minHeight: 40,
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span style={label}>Dietary needs</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Dietary needs">
              {DIETARY.map((d) => (
                <button
                  key={d} type="button" onClick={() => toggleDietary(d)}
                  aria-pressed={dietary.includes(d)}
                  style={{
                    border: `1px solid ${dietary.includes(d) ? 'rgba(16,185,129,0.5)' : 'var(--border)'}`,
                    background: dietary.includes(d) ? 'rgba(16,185,129,0.1)' : 'var(--bg-card)',
                    color: dietary.includes(d) ? 'var(--green)' : 'var(--text-muted)',
                    borderRadius: 20, padding: '8px 14px', fontSize: 12.5, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', minHeight: 40,
                  }}
                >
                  {dietary.includes(d) ? <Check size={12} style={{ verticalAlign: -2 }} /> : null} {d.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div role="alert" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: '#F87171' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="pressable"
            style={{
              background: 'linear-gradient(120deg, #F97316, #FB923C)', border: 'none', borderRadius: 11,
              padding: '13px 14px', fontSize: 14.5, fontWeight: 700, color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48,
              opacity: status === 'loading' ? 0.7 : 1,
            }}
          >
            {status === 'loading' ? <><Sparkles size={15} className="spin" /> {t('loadingPlan')}</> : <><Sparkles size={15} /> Get my shortlist</>}
          </button>
        </form>

        {status === 'ready' && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, margin: 0 }}>{t('planReady')}</h2>
              <button
                onClick={share}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
                  padding: '8px 14px', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)',
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, minHeight: 44,
                }}
              >
                {shared ? <Check size={13} color="var(--green)" /> : <Share2 size={13} />} {shared ? 'Shared!' : t('sharePlan')}
              </button>
            </div>
            {recs.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('emptyResults')}</p>}
            {recs.map((r, i) => (
              <RestaurantCard key={r.restaurant_id || i} rec={r} index={i} onReview={generateReview} />
            ))}
          </div>
        )}

        {showReview && (
          <ReviewModal review={review} restaurant={reviewRestaurant} onClose={() => setShowReview(false)} isDark />
        )}
      </div>
    </div>
  );
}
