import { memo } from 'react';
import { Zap, ChevronDown, Clock } from 'lucide-react';
import { STAGE_LABELS, STAGE_TIPS } from '../constants/index.js';

export const AgentThinking = memo(({ thinkOpen, stage, lastTrace, meta }) => {
  if (!thinkOpen) return null;

  return (
    <div style={{ padding: '0 16px 14px' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--orange)', background: 'var(--orange-light)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 20, padding: '3px 10px', fontWeight: 600, marginBottom: 8 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--orange)', animation: 'pulseDot 2s infinite', display: 'inline-block' }} />
        Stage: {STAGE_LABELS[stage]}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.55 }}>
        {STAGE_TIPS[stage]}
      </p>

      {lastTrace.length > 0 && (
        <ol style={{ margin: '0 0 10px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lastTrace.map((s, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{
                width: 18, height: 18, borderRadius: 9, flexShrink: 0,
                background: s.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${s.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: s.ok ? 'var(--green)' : '#F87171',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
              }}>{i + 1}</span>
              <span style={{ fontFamily: 'ui-monospace, "Cascadia Mono", monospace', fontSize: 11.5 }}>{s.tool}</span>
              {s.error && (
                <span style={{ fontSize: 11, color: '#F87171' }}>{String(s.error).slice(0, 60)}</span>
              )}
              {s.ms != null && (
                <span style={{ fontSize: 11, color: 'var(--text-hint)', marginLeft: 'auto' }}>{s.ms}ms</span>
              )}
            </li>
          ))}
        </ol>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-hint)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Zap size={11} />{lastTrace.length || meta?.steps || 0} agent steps
        </span>
        {meta?.latency_ms != null && (
          <span style={{ fontSize: 11, color: 'var(--text-hint)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Clock size={11} />{meta.latency_ms}ms
          </span>
        )}
      </div>
    </div>
  );
});

AgentThinking.displayName = 'AgentThinking';