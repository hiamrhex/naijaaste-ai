import { memo } from 'react';
import { ChefHat, RefreshCw, Zap } from 'lucide-react';
import { Markdown } from '../components/Markdown.jsx';
import { ThinkingDots } from '../components/ThinkingDots.jsx';

export const ConversationStream = memo(({ messages, loading, onRetry }) => {
  return (
    <div
      className="chat-stream"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {messages.map((m, i) => (
        <div
          key={i}
          className="bubble-in"
          style={{
            display: 'flex',
            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            animationDelay: `${i * 30}ms`,
          }}
        >
          {m.role === 'assistant' && (
            <div style={{ maxWidth: '100%', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--orange-light)', border: '1px solid var(--orange-30)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ChefHat size={11} color="var(--orange)" aria-hidden="true" />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--orange)', letterSpacing: '0.09em' }}>NAIJATASTE</span>
              </div>
              <div
                style={{
                  fontSize: 14.5, lineHeight: 1.7,
                  color: m.error ? 'var(--red)' : 'var(--text-primary)',
                }}
              >
                <Markdown text={m.content} />
              </div>
              {m.error && m.retryText && (
                <button
                  onClick={() => onRetry(m.retryText)}
                  disabled={loading}
                  style={{
                    marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 9, padding: '6px 11px', fontSize: 12, fontWeight: 600,
                    color: 'var(--text-secondary)', cursor: loading ? 'default' : 'pointer',
                    fontFamily: 'inherit', minHeight: 36, opacity: loading ? 0.6 : 1,
                  }}
                >
                  <RefreshCw size={11} /> Try again
                </button>
              )}
              {m.trace && m.trace.some((s) => s.tool) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {m.trace.filter((s) => s.tool).map((s, ti) => (
                    <span key={ti} className="trace-chip" data-ok={String(!!s.ok)}>
                      <Zap size={9} aria-hidden="true" />{s.tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {m.role === 'user' && (
            <div style={{
              maxWidth: '82%', background: 'var(--chat-user-bg)',
              borderRadius: '16px 16px 4px 16px', padding: '10px 14px',
              fontSize: 14, lineHeight: 1.55,
              color: 'var(--chat-user-text)', fontWeight: 500,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {m.content}
            </div>
          )}
        </div>
      ))}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--orange-light)', border: '1px solid var(--orange-30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChefHat size={11} color="var(--orange)" aria-hidden="true" />
          </div>
          <div style={{ background: 'var(--chat-bot-bg)', border: '1px solid var(--border)', borderRadius: '4px 14px 14px 14px', padding: '9px 13px' }}>
            <ThinkingDots />
          </div>
        </div>
      )}
    </div>
  );
});

ConversationStream.displayName = 'ConversationStream';