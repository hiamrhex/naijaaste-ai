import { memo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { QUICK_PROMPTS } from '../constants/index.js';

export const QuickStart = memo(({ showQuickPrompts, onSendMsg }) => {
  if (!showQuickPrompts) return null;

  return (
    <section className="quick-menu fade-in" aria-labelledby="quick-menu-title">
      <div className="quick-menu-head">
        <span className="quick-menu-title" id="quick-menu-title">Start with a craving</span>
        <span className="quick-menu-note">Tap one, then edit it</span>
      </div>
      <div className="quick-menu-list">
        {QUICK_PROMPTS.map((q) => (
          <button key={q} type="button" className="quick-item" onClick={() => onSendMsg(q)}>
            <span>{q}</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
});

QuickStart.displayName = 'QuickStart';
