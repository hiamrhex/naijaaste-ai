import { useState, useEffect, useMemo } from 'react';
import { Search, Trash2, MessageSquare, ClipboardList, Heart } from 'lucide-react';
import { readHistory } from '../hooks/useConcierge.js';
import { readPlans, deletePlan } from '../lib/plans.js';
import { getFavorites, removeFavorite } from '../lib/auth.js';
import { ScreenHead } from '../components/ScreenHead.jsx';
import { useLanguage } from '../app/useLanguage.js';

const timeFmt = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

export default function HistoryScreen() {
  const { t } = useLanguage();
  const [q, setQ] = useState('');
  const [chats, setChats] = useState(readHistory);
  const [plans, setPlans] = useState(readPlans);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    getFavorites()
      .then((ids) => setFavorites(ids.map((id) => ({ restaurant_id: id }))))
      .catch(() => {});
  }, []);

  const clearChats = () => {
    try { localStorage.removeItem('nt.history.v1'); } catch { /* noop */ }
    setChats([]);
  };

  const removePlan = (id) => {
    deletePlan(id);
    setPlans(readPlans());
  };

  const removeFav = async (id) => {
    try {
      const next = await removeFavorite(id);
      setFavorites(next.map((x) => ({ restaurant_id: x })));
    } catch { /* keep local state on failure */ }
  };

  const needle = q.trim().toLowerCase();
  const chatsF = useMemo(() => chats.filter((c) => !needle || (c.preview || '').toLowerCase().includes(needle)), [chats, needle]);
  const plansF = useMemo(() => plans.filter((p) => !needle || JSON.stringify(p.inputs).toLowerCase().includes(needle)), [plans, needle]);
  const favsF = useMemo(() => favorites.filter((f) => !needle || f.restaurant_id.toLowerCase().includes(needle)), [favorites, needle]);

  const rowBtn = {
    background: 'none', border: '1px solid var(--border)', borderRadius: 8,
    padding: 7, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
    minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };

  const sectionTitle = {
    fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14,
    color: 'var(--text-primary)', margin: '18px 0 8px', display: 'flex', alignItems: 'center', gap: 7,
  };

  const empty = { fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' };

  return (
    <div>
      <ScreenHead title="History" subtitle="Chats, plans and saved spots" />
      <div style={{ padding: '0 16px 24px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-hint)' }} />
          <label htmlFor="history-search" className="sr-only">Search history</label>
          <input
            id="history-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats, plans, saved…"
            style={{
              width: '100%', boxSizing: 'border-box', background: 'var(--input-bg)',
              border: '1px solid var(--border)', borderRadius: 11, padding: '12px 14px 12px 38px',
              fontSize: 14, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', minHeight: 48,
            }}
          />
        </div>

        <h2 style={sectionTitle}><MessageSquare size={14} color="var(--orange)" /> Past chats {chats.length > 0 && (
          <button onClick={clearChats} style={{ ...rowBtn, marginLeft: 'auto', fontSize: 11, padding: '6px 10px', gap: 5 }}>
            <Trash2 size={12} /> Clear all
          </button>
        )}</h2>
        {chatsF.length === 0 && <p style={empty}>{t('emptyHistory')}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {chatsF.map((c, i) => (
            <div key={c.session_id || i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', background: 'var(--bg-card)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{c.preview || 'Chat'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>
                {timeFmt(c.at)}{c.recs ? ` · ${c.recs} picks` : ''}
              </div>
            </div>
          ))}
        </div>

        <h2 style={sectionTitle}><ClipboardList size={14} color="var(--orange)" /> Plans</h2>
        {plansF.length === 0 && <p style={empty}>{t('emptyPlans')}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plansF.map((p) => (
            <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                  Party of {p.inputs?.groupSize} · {p.inputs?.occasion} · {p.inputs?.budget}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>
                  {timeFmt(p.at)} · {(p.recs || []).length} spots
                </div>
              </div>
              <button onClick={() => removePlan(p.id)} aria-label="Delete plan" style={rowBtn}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <h2 style={sectionTitle}><Heart size={14} color="var(--orange)" /> Saved spots</h2>
        {favsF.length === 0 && <p style={empty}>{t('emptyFavorites')}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {favsF.map((f) => (
            <div key={f.restaurant_id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{f.restaurant_id}</div>
              <button onClick={() => removeFav(f.restaurant_id)} aria-label={`Remove ${f.restaurant_id} from saved`} style={rowBtn}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
