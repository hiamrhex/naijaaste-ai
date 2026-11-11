import { useEffect, useRef } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { Tag } from './Tag';
import { StarBar } from './StarBar';

export function ReviewModal({ review, restaurant, onClose }) {
  const dialogRef = useRef(null);

  // Escape closes the dialog, and focus moves into it on open so keyboard
  // users are never stranded behind the overlay.
  useEffect(() => {
    if (!review) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [review, onClose]);

  if (!review) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}
    onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="slide-in-right"
        role="dialog"
        aria-modal="true"
        aria-label={`AI review of ${restaurant?.restaurant_name || 'this restaurant'}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--rim, var(--border))',
          borderRadius: 20, padding: 24, maxWidth: 780, width: '100%',
          maxHeight: '80vh', overflowY: 'auto',
          boxShadow: 'var(--shadow-card, 0 24px 60px rgba(0,0,0,0.4))',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              {restaurant?.restaurant_name}
            </div>
            <StarBar rating={review.star_rating || 4} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn"
            aria-label="Close review"
            style={{ width: 34, minHeight: 34 }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div style={{
          fontStyle: 'italic', fontSize: 14, lineHeight: 1.7,
          color: 'var(--text-secondary)',
          borderLeft: '3px solid var(--orange)', paddingLeft: 14, marginBottom: 16,
        }}>
          “{review.review_text}”
        </div>

        {review.highlight_tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {review.highlight_tags.map((t) => <Tag key={t} variant="orange">{t}</Tag>)}
          </div>
        )}

        {review.persona_match_score !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={13} color="var(--green)" aria-hidden="true" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {Math.round(review.persona_match_score * 100)}% matches your taste profile
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
