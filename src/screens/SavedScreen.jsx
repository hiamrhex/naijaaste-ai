import { useEffect, useMemo, useState, useTransition } from 'react';
import { Heart, Plus, Trash2 } from 'lucide-react';
import { getSavedPlaces, addSavedPlace, deleteSavedPlace } from '../lib/auth.js';
import { rankSaved } from '../lib/rankSaved.js';
import { ScreenHead } from '../components/ScreenHead.jsx';

// Memory-first Saved screen (minimal, elite-leaning):
// typography-first hierarchy, restrained color, every microstate designed
// (loading skeleton matches layout, empty invites action, errors direct).
// No map, no catalogue lookup, names render as React text only (no HTML).
export default function SavedScreen() {
  const [places, setPlaces] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    getSavedPlaces()
      .then((list) => {
        if (!live) return;
        setPlaces(list);
        setState('ready');
      })
      .catch((e) => {
        if (!live) return;
        setError(e.message || 'Could not load saved spots');
        setState('error');
      });
    return () => { live = false; };
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean || saving) return;
    setSaving(true);
    setError('');
    try {
      const place = await addSavedPlace(clean);
      startTransition(() => {
        setPlaces((prev) => [...prev, place]);
        setName('');
      });
    } catch (err) {
      setError(err.message || 'Could not save spot');
    } finally {
      setSaving(false);
    }
  };

  const constraints = useMemo(() => ({
    area: area.trim() || undefined,
    maxPricePerHead: maxPrice.trim() === '' ? undefined : Number(maxPrice),
  }), [area, maxPrice]);

  const { fits, might } = useMemo(
    () => rankSaved(places, constraints),
    [places, constraints]
  );

  const [removing, setRemoving] = useState('');
  const removeSpot = async (id, name) => {
    if (removing) return;
    // Confirmation keeps a stray tap from deleting a Friday plan.
    if (!window.confirm(`Remove "${name}" from Saved?`)) return;
    setRemoving(id);
    try {
      await deleteSavedPlace(id);
      startTransition(() => {
        setPlaces((prev) => prev.filter((p) => p.id !== id));
      });
    } catch (err) {
      setError(err.message || 'Could not delete spot');
      setState('error');
    } finally {
      setRemoving('');
    }
  };

  const card = {
    border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px',
    background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: 10,
    contentVisibility: 'auto', containIntrinsicSize: 'auto 64px',
  };

  const spotCard = (p, hot) => (
    <div key={p.id} style={card}>
      <Heart size={13} color={hot ? 'var(--orange)' : 'var(--text-hint)'} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
        {hot ? (
          <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>{p.status}</div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>
            Needs check: {(p.unknowns || []).join(', ')}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => removeSpot(p.id, p.name)}
        disabled={removing === p.id}
        aria-label={`Remove ${p.name} from saved spots`}
        style={{
          border: 'none', background: 'transparent', cursor: removing === p.id ? 'wait' : 'pointer',
          padding: 6, borderRadius: 8, color: 'var(--text-hint)', display: 'flex',
        }}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <div>
      <ScreenHead title="Saved" subtitle="Want-to-try spots for Friday night" />
      <div style={{ padding: '0 16px 24px', maxWidth: 900, margin: '0 auto' }}>
        <form onSubmit={save} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <label htmlFor="saved-name" className="sr-only">Spot name</label>
          <input
            id="saved-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Save a spot — name or paste"
            maxLength={100}
            style={{
              flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)',
              borderRadius: 11, padding: '12px 14px', fontSize: 14,
              color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', minHeight: 48,
            }}
          />
          <button
            type="submit"
            disabled={saving || !name.trim()}
            aria-label="Save spot"
            style={{
              ...card, cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
              opacity: saving || !name.trim() ? 0.5 : 1, fontWeight: 700, fontSize: 13,
              color: 'var(--text-primary)',
            }}
          >
            <Plus size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </form>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <label htmlFor="saved-area" className="sr-only">Area</label>
          <input
            id="saved-area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Area — e.g. Yaba"
            maxLength={80}
            style={{
              flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)',
              borderRadius: 11, padding: '10px 12px', fontSize: 13,
              color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
            }}
          />
          <label htmlFor="saved-max" className="sr-only">Max per head in naira</label>
          <input
            id="saved-max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))}
            placeholder="₦ max/head"
            inputMode="numeric"
            style={{
              width: 130, background: 'var(--input-bg)', border: '1px solid var(--border)',
              borderRadius: 11, padding: '10px 12px', fontSize: 13,
              color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>

        {state === 'loading' && (
          <div role="status" aria-label="Loading saved spots" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ ...card, color: 'var(--text-hint)', fontSize: 13 }}>Loading…</div>
            ))}
          </div>
        )}

        {state === 'error' && (
          <p role="alert" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            {error} — check connection and retry.
          </p>
        )}

        {state === 'ready' && places.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No saved spots yet. Save the first one above — it stays yours until Friday.
          </p>
        )}

        {state === 'ready' && places.length > 0 && (
          <>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0' }}>
              Fits ({fits.length})
            </h2>
            {fits.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing fits all filters yet.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fits.map((p) => spotCard(p, true))}
            </div>

            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '16px 0 8px' }}>
              Might fit — check ({might.length})
            </h2>
            {might.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing on the “might” list yet.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {might.map((p) => spotCard(p, false))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
