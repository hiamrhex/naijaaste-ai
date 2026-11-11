import { memo } from 'react';
import { CheckCircle } from 'lucide-react';
import { STAGES, STAGE_LABELS } from '../constants/index.js';

/**
 * A compressed four-step tracker. It is only mounted while a turn is running
 * (or once the agent has moved past the first step), so a brand-new chat opens
 * with an editorial hero instead of a row of grey pills.
 */
export const StageBar = memo(({ stage, stageIdx }) => {
  return (
    <ol
      className="stage-bar"
      role="status"
      aria-label={`Agent stage: ${STAGE_LABELS[stage]}`}
    >
      {STAGES.map((s, i) => {
        const done = i < stageIdx;
        const current = i === stageIdx;
        return (
          <li key={s} className="stage-step" data-state={done ? 'done' : current ? 'current' : 'todo'}>
            {done && <CheckCircle size={11} aria-hidden="true" />}
            {current && <span className="stage-dot" aria-hidden="true" />}
            <span aria-current={current ? 'step' : undefined}>{STAGE_LABELS[s]}</span>
            {i < STAGES.length - 1 && <span className="stage-line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
});

StageBar.displayName = 'StageBar';
