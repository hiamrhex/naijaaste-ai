import { memo } from 'react';
import { CheckCircle } from 'lucide-react';
import { STAGES, STAGE_LABELS } from '../constants/index.js';

export const StageBar = memo(({ stage, stageIdx }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0, padding: '10px 0 0', overflowX: 'auto' }} role="status" aria-label={`Stage: ${STAGE_LABELS[stage]}`}>
      {STAGES.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 20,
            background: s === stage ? 'var(--orange-light)' : 'transparent',
            border: s === stage ? '1px solid rgba(249,115,22,0.35)' : '1px solid transparent',
            color: s === stage ? 'var(--orange)' : i < stageIdx ? 'var(--text-muted)' : 'var(--text-hint)',
            fontSize: 12, fontWeight: s === stage ? 600 : 400,
            transition: 'all 0.3s', whiteSpace: 'nowrap',
          }}>
            {i < stageIdx && <CheckCircle size={11} />}
            {i === stageIdx && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--orange)', animation: 'pulseDot 2s infinite', display: 'inline-block' }} />
            )}
            {STAGE_LABELS[s]}
          </div>
          {i < STAGES.length - 1 && (
            <div style={{ width: 20, height: 1, background: i < stageIdx ? 'var(--orange)' : 'var(--border)', margin: '0 -2px', transition: 'background 0.3s' }} />
          )}
        </div>
      ))}
    </div>
  );
});

StageBar.displayName = 'StageBar';