import { memo } from 'react';
import { ArrowRight } from 'lucide-react';
import { QUICK_PROMPTS } from '../constants/index.js';

export const QuickStart = memo(({ showQuickPrompts, onSendMsg }) => {
  if (!showQuickPrompts) return null;

  return (
    <div className="fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-hint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
        Quick Start
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            onClick={() => onSendMsg(q)}
            style={{
              background: 'var(--bg-card-hover)', border: '1px solid var(--border)',
              borderRadius: 9, padding: '8px 12px', textAlign: 'left',
              fontSize: 12.5, color: 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4,
              transition: 'all 0.15s', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 8, minHeight: 44,
            }}
          >
            <span>{q}</span>
            <ArrowRight size={12} style={{ flexShrink: 0, opacity: 0.4 }} />
          </button>
        ))}
      </div>
    </div>
  );
});

QuickStart.displayName = 'QuickStart';