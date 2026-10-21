import { useState, useEffect } from 'react';
import { Users, Heart, Star, Inbox, Check, Loader2 } from 'lucide-react';
import { authFetch } from '../lib/auth.js';
import { errorMessage, readJson } from '../lib/api.js';
import { ScreenHead } from '../components/ScreenHead.jsx';

const STATUSES = ['open', 'in_review', 'resolved'];

export default function AdminScreen() {
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authFetch('/admin/stats'),
      authFetch(`/admin/reports?status=${filter}`),
    ]).then(async ([s, r]) => {
      if (cancelled) return;
      const statsBody = await readJson(s, { fallbackMessage: 'Could not load stats.' });
      const inboxBody = await readJson(r, { fallbackMessage: 'Could not load inbox.' });
      setStats(statsBody.data);
      setReports(inboxBody.data || []);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(errorMessage(err, 'Could not load admin data.'));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [filter]);

  const triage = async (ticket, status) => {
    setActing(ticket + status);
    try {
      const res = await authFetch(`/admin/reports/${encodeURIComponent(ticket)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await readJson(res, { fallbackMessage: 'Triage failed — try again.' });
      setReports((prev) => prev.map((x) => (x.ticket === ticket ? { ...x, status } : x)));
      const s = await readJson(await authFetch('/admin/stats'), { fallbackMessage: 'Could not refresh stats.' });
      if (s?.data) setStats(s.data);
    } catch (err) {
      setError(errorMessage(err, 'Triage failed — try again.'));
    } finally {
      setActing(null);
    }
  };

  const timeFmt = (iso) => {
    try {
      return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div>
      <ScreenHead title="Admin" subtitle="Stats, inbox and triage — admins only" />
      <div style={{ padding: '0 16px 24px', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && !stats && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
            <Loader2 size={15} className="spin" /> Loading dashboard…
          </div>
        )}

        {error && (
          <div role="alert" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: '#F87171' }}>
            {error}
          </div>
        )}

        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {[
              { icon: Users, label: 'Users', value: stats.users },
              { icon: Heart, label: 'Favorites', value: stats.favorites },
              { icon: Star, label: 'Ratings', value: stats.ratings },
              { icon: Inbox, label: 'Open reports', value: stats.reports?.open ?? 0 },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                <Icon size={15} color="var(--orange)" style={{ marginBottom: 4 }} />
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22 }}>{value ?? '–'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-hint)', margin: 0 }}>
          Agent spend and error tracking are not instrumented — counts only. See roadmap.
        </p>

        <div style={{ display: 'flex', gap: 6 }} role="group" aria-label="Filter reports by status">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { setLoading(true); setError(''); setFilter(s); }}
              aria-pressed={filter === s}
              style={{
                flex: 1, border: `1px solid ${filter === s ? 'rgba(249,115,22,0.5)' : 'var(--border)'}`,
                background: filter === s ? 'rgba(249,115,22,0.1)' : 'var(--bg-card)',
                color: filter === s ? 'var(--orange)' : 'var(--text-muted)',
                borderRadius: 10, padding: '9px 0', fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', minHeight: 44,
              }}
            >
              {s.replace('_', ' ')} {stats?.reports?.[s] != null ? `(${stats.reports[s]})` : ''}
            </button>
          ))}
        </div>

        {reports.length === 0 && !loading && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No reports with this status.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reports.map((r) => (
            <div key={r.ticket} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 700, color: 'var(--orange)' }}>{r.ticket}</span>
                <span style={{ fontSize: 11, background: 'var(--bg-card-hover)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20, color: 'var(--text-muted)' }}>{r.type}</span>
                <span style={{ fontSize: 11, color: 'var(--text-hint)', marginLeft: 'auto' }}>{timeFmt(r.at)}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0', lineHeight: 1.55 }}>{r.message}</p>
              <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>
                {[r.screen, r.device, r.app_version, r.restaurant_id].filter(Boolean).join(' · ')}
                {r.request_id ? ` · req ${r.request_id.slice(0, 8)}` : ''}
                {r.has_screenshot ? ' · has screenshot' : ''}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                {STATUSES.filter((s) => s !== r.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => triage(r.ticket, s)}
                    disabled={acting === r.ticket + s}
                    style={{
                      border: '1px solid var(--border)', background: 'var(--bg-card-hover)',
                      color: 'var(--text-secondary)', borderRadius: 9, padding: '8px 14px',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      minHeight: 40, display: 'flex', alignItems: 'center', gap: 5,
                      opacity: acting === r.ticket + s ? 0.6 : 1,
                    }}
                  >
                    <Check size={12} /> Mark {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
