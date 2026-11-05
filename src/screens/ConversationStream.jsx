import { memo } from 'react';
import { ChefHat, RefreshCw, Square, Zap } from 'lucide-react';
import { Markdown } from '../components/Markdown.jsx';
import { ThinkingDots } from '../components/ThinkingDots.jsx';

export const ConversationStream = memo(({ messages, loading, generateReview, stop }) => {
  return (
    <div
      className="chat-stream"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--orange-light)', border: '1px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ChefHat size={10} color="var(--orange)" />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--orange)', letterSpacing: '0.08em' }}>NAIJATASTE</span>
              </div>
              <div
                style={{
                  fontSize: 14, lineHeight: 1.65,
                  color: m.error ? '#F87171' : 'var(--text-primary)',
                }}
              >
                <Markdown text={m.content} />
              </div>
              {m.error && m.retryText && (
                <button
                  onClick={() => generateReview(m.retryText)}
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {m.trace.filter((s) => s.tool).map((s, ti) => (
                    <span key={ti} style={{
                      fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: s.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${s.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      color: s.ok ? 'var(--green)' : '#F87171',
                      padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                    }}>
                      <Zap size={9} />{s.tool}
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
          <div style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--orange-light)', border: '1px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChefHat size={10} color="var(--orange)" />
          </div>
          <div style={{ background: 'var(--chat-bot-bg)', border: '1px solid var(--border)', borderRadius: '4px 14px 14px 14px', padding: '8px 12px' }}>
            <ThinkingDots />
          </div>
          {stop && (
            <button
              type="button"
              onClick={() => stop()}
              aria-label="Stop generating"
              title="Stop generating"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 20, padding: '3px 10px', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
                fontFamily: 'inherit', minHeight: 44, marginTop: 4,
              }}
            >
              <Square size={9} fill="currentColor" aria-hidden="true" />
              Stop
            </button>
          )}
        </div>
      )}
    </div>
  );
});

ConversationStream.displayName = 'ConversationStream';