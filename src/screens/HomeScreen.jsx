import { useRef, useState } from 'react';
import {
  Send, ChefHat, Utensils, Zap, Square,
  RefreshCw, ChevronDown, Globe, Clock, BarChart3, MessageSquare, ArrowRight, MapPin, Sparkles, CheckCircle,
} from 'lucide-react';
import { HERO_PHRASES, QUICK_PROMPTS, STAGES, STAGE_LABELS, STAGE_TIPS } from '../constants/index.js';
import { PersonaCard } from '../components/PersonaCard.jsx';
import { RestaurantCard } from '../components/RestaurantCard.jsx';
import { ReviewModal } from '../components/ReviewModal.jsx';
import { ThinkingDots } from '../components/ThinkingDots.jsx';
import { NearbyPanel } from '../components/NearbyPanel.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Header, Footer } from '../components/SiteChrome.jsx';
import { useAuth } from '../app/useAuth.js';
import { useConcierge } from '../hooks/useConcierge.js';
import { haversineKm } from '../utils/geo.js';
import { VoiceButton } from '../components/VoiceButton.jsx';
import { useLanguage } from '../app/useLanguage.js';

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const [voiceError, setVoiceError] = useState(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const c = useConcierge({ chatEndRef });
  const currentHero = HERO_PHRASES[c.heroIdx];

  // The welcome furniture (hero + quick prompts) only shows while the
  // conversation is fresh - once the user has said something, the chat owns
  // the screen, the way it does in Claude or ChatGPT.
  const fresh = c.messages.length <= 1;

  // The trace of the most recent agent turn - what it actually did.
  const lastTrace = [...c.messages].reverse().find((m) => m.trace?.length)?.trace || [];

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); c.sendMsg(); }
  };

  return (
    <div className="home-shell">
      <Header
        user={user}
        onSignOut={signOut}
        onNearMe={c.findNearby}
        nearbyLoading={c.nearbyLoading}
        showNearby={c.showNearby}
        onReset={c.reset}
      />

      {/* ── SCROLLING AREA: the conversation, then the food below it ── */}
      <div className="home-scroll">
        <div className="home-column">

          {/* ── HERO (fresh conversations only) ── */}
          {fresh && (
            <div style={{ textAlign: 'center', padding: '22px 20px 10px', position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
                width: 400, height: 200,
                background: 'radial-gradient(ellipse, rgba(249,115,22,0.06) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 20, padding: '4px 12px', marginBottom: 12,
              }}>
                <Globe size={11} color="var(--green)" />
                <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, letterSpacing: '0.05em' }}>
                  Powered by Nigerian Cultural Intelligence
                </span>
              </div>
              <div style={{ minHeight: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <h1 style={{
                  fontFamily: "'Syne', sans-serif", fontWeight: 800,
                  fontSize: 'clamp(24px, 4.4vw, 38px)', lineHeight: 1.1,
                  letterSpacing: '-1px', margin: '0 0 4px',
                  opacity: c.heroVisible ? 1 : 0,
                  transform: c.heroVisible ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.97)',
                  transition: 'opacity 0.4s ease, transform 0.4s ease',
                }}>
                  <span className={
                    c.heroIdx === 5 ? 'gradient-hero-english' :
                    c.heroIdx === 4 ? 'gradient-hero-pidgin2' :
                    'gradient-hero-main'
                  }>
                    {currentHero.text}
                  </span>
                </h1>
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)',
                  opacity: c.heroVisible ? 0.7 : 0, transition: 'opacity 0.35s ease',
                  marginBottom: 2,
                }}>
                  {currentHero.lang}
                </div>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                AI-powered recommendations · 60 Nigerian restaurants · 8 cities
              </p>
            </div>
          )}

          {/* ── STAGE BAR ── */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0, padding: fresh ? '0 20px 14px' : '10px 0 0', overflowX: 'auto' }} role="status" aria-label={`Stage: ${STAGE_LABELS[c.stage]}`}>
            {STAGES.map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 20,
                  background: s === c.stage ? 'var(--orange-light)' : 'transparent',
                  border: s === c.stage ? '1px solid rgba(249,115,22,0.35)' : '1px solid transparent',
                  color: s === c.stage ? 'var(--orange)' : i < c.stageIdx ? 'var(--text-muted)' : 'var(--text-hint)',
                  fontSize: 12, fontWeight: s === c.stage ? 600 : 400,
                  transition: 'all 0.3s', whiteSpace: 'nowrap',
                }}>
                  {i < c.stageIdx && <CheckCircle size={11} />}
                  {i === c.stageIdx && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--orange)', animation: 'pulseDot 2s infinite', display: 'inline-block' }} />
                  )}
                  {STAGE_LABELS[s]}
                </div>
                {i < STAGES.length - 1 && (
                  <div style={{ width: 20, height: 1, background: i < c.stageIdx ? 'var(--orange)' : 'var(--border)', margin: '0 -2px', transition: 'background 0.3s' }} />
                )}
              </div>
            ))}
          </div>

          {/* ── QUICK START (fresh conversations only) ── */}
          {fresh && c.showQuickPrompts && (
            <div className="fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-hint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                Quick Start
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => c.sendMsg(q)}
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
          )}

          {/* ── THE CONVERSATION ── */}
          <div
            className="chat-stream"
            role="log"
            aria-label="Chat messages"
            aria-live="polite"
          >
            {c.messages.map((m, i) => (
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
                    {/* Plain text on the page, not a box: the answer has to be
                        readable in one column, like every modern AI chat.
                        The model writes markdown, so it is rendered - the
                        raw **asterisks** are what made it look broken. */}
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
                        onClick={() => c.sendMsg(m.retryText)}
                        disabled={c.loading}
                        style={{
                          marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: 'var(--bg-card)', border: '1px solid var(--border)',
                          borderRadius: 9, padding: '6px 11px', fontSize: 12, fontWeight: 600,
                          color: 'var(--text-secondary)', cursor: c.loading ? 'default' : 'pointer',
                          fontFamily: 'inherit', minHeight: 36, opacity: c.loading ? 0.6 : 1,
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
            {c.loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--orange-light)', border: '1px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ChefHat size={10} color="var(--orange)" />
                </div>
                <div style={{ background: 'var(--chat-bot-bg)', border: '1px solid var(--border)', borderRadius: '4px 14px 14px 14px', padding: '8px 12px' }}>
                  <ThinkingDots />
                </div>
              </div>
            )}
          </div>

          {/* ── AGENT THINKING ── */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginTop: 16 }}>
            <button
              onClick={() => c.setThinkOpen((v) => !v)}
              aria-expanded={c.thinkOpen}
              style={{ width: '100%', background: 'none', border: 'none', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={13} color="var(--orange)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  How the agent is thinking
                </span>
              </div>
              <ChevronDown size={16} color="var(--text-hint)" style={{ transform: c.thinkOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }} />
            </button>
            {c.thinkOpen && (
              <div style={{ padding: '0 16px 14px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--orange)', background: 'var(--orange-light)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 20, padding: '3px 10px', fontWeight: 600, marginBottom: 8 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--orange)', animation: 'pulseDot 2s infinite', display: 'inline-block' }} />
                  Stage: {STAGE_LABELS[c.stage]}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.55 }}>
                  {STAGE_TIPS[c.stage]}
                </p>

                {/* What the agent actually did - the trace of the last turn,
                    not just a label. */}
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
                    <Zap size={11} />{lastTrace.length || c.meta?.steps || 0} agent steps
                  </span>
                  {c.meta?.latency_ms != null && (
                    <span style={{ fontSize: 11, color: 'var(--text-hint)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={11} />{c.meta.latency_ms}ms
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── THE FOOD: below the conversation, full width ── */}
          {(c.recs || c.persona || c.showNearby) && (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {c.showNearby && (
                <NearbyPanel
                  loading={c.nearbyLoading}
                  error={c.nearbyError}
                  nearby={c.nearby}
                  onRetry={c.findNearby}
                  onClose={() => c.setShowNearby(false)}
                  favorites={c.favorites}
                  onToggleFavorite={c.toggleFavorite}
                />
              )}

              {c.persona && <PersonaCard persona={c.persona} />}

              {c.recs && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Utensils size={15} color="var(--orange)" />
                      {c.recs.length} Spot{c.recs.length === 1 ? '' : 's'} Found
                    </h2>
                    <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.12)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.25)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                      Ready
                    </span>
                  </div>

                  {/* The food gets room to breathe: a grid, not a narrow rail. */}
                  <div className="results-grid">
                    {c.recs.map((r, i) => {
                      const geo = c.geoCache[r.restaurant_id];
                      const distanceKm = geo && c.nearby?.origin
                        ? Math.round(haversineKm(c.nearby.origin.lat, c.nearby.origin.lng, geo.lat, geo.lng) * 10) / 10
                        : undefined;
                      return (
                        <RestaurantCard
                          key={r.restaurant_id || i}
                          rec={r}
                          index={i}
                          onReview={c.generateReview}
                          persona={c.persona}
                          distanceKm={distanceKm}
                          directionsUrl={geo?.directions_url}
                          isFavorite={c.favorites.includes(r.restaurant_id)}
                          onToggleFavorite={c.toggleFavorite}
                        />
                      );
                    })}
                  </div>

                  {c.meta && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-card-hover)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {c.meta.after_hard_filter != null && (
                        <span style={{ fontSize: 11, color: 'var(--text-hint)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <BarChart3 size={11} />{c.meta.after_hard_filter} restaurants filtered
                        </span>
                      )}
                      {c.meta.candidates_sent_to_llm != null && (
                        <span style={{ fontSize: 11, color: 'var(--text-hint)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <MessageSquare size={11} />{c.meta.candidates_sent_to_llm} ranked by AI
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-hint)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Clock size={11} />{c.meta.latency_ms}ms
                      </span>
                    </div>
                  )}

                  <button
                    onClick={c.reset}
                    style={{ marginTop: 12, background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s', minHeight: 44, width: '100%' }}
                  >
                    <RefreshCw size={13} /> Start a new search
                  </button>
                </div>
              )}
            </div>
          )}

          {!c.recs && !c.persona && !c.showNearby && (
            <div style={{ marginTop: 20, padding: '26px 20px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--orange-light)', border: '1px solid rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Utensils size={21} color="var(--orange)" />
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 12px' }}>
                Tell me your city, budget and cravings, and the picks will land right below.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
                {[
                  [MapPin, '8 cities covered'],
                  [Utensils, '60 curated restaurants'],
                  [Sparkles, 'AI-ranked by taste match'],
                ].map(([Icon, label]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={13} color="var(--orange)" />
                    <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Footer />
        </div>
      </div>

      {/* ── THE COMPOSER: always on screen, like every modern AI chat ── */}
      <div className="composer-dock">
        <div className="home-column">
          <div style={{
            background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 22,
            display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 10px 8px 16px',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
          }}>
            <label htmlFor="chat-input" className="sr-only">Describe yourself — city, budget, what you're craving</label>
            <textarea
              id="chat-input"
              ref={inputRef}
              value={c.inputVal}
              onChange={(e) => c.setInputVal(e.target.value.slice(0, 500))}
              onKeyDown={handleKey}
              placeholder="Describe yourself — city, budget, what you're craving..."
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none',
                fontSize: 14, color: 'var(--text-primary)', fontFamily: 'inherit', lineHeight: 1.5,
                maxHeight: 140, minHeight: 30, padding: '5px 0',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingBottom: 2 }}>
              {c.loading && (
                <span style={{ fontSize: 10, color: 'var(--text-hint)', alignSelf: 'flex-end', marginRight: 2 }} aria-hidden="true">{c.inputVal.length}/500</span>
              )}
              <VoiceButton
                onTranscript={(text) => {
                  setVoiceError(null);
                  c.setInputVal((text || '').slice(0, 500));
                  inputRef.current?.focus();
                }}
                onError={() => setVoiceError(t('voiceFail'))}
              />
              {c.loading ? (
                <button
                  onClick={() => c.stop()}
                  aria-label={t('stop')}
                  title={t('stop')}
                  style={{
                    width: 34, height: 34, borderRadius: 17,
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Square size={13} color="#F87171" fill="#F87171" />
                </button>
              ) : (
                <button
                  onClick={() => c.sendMsg()}
                  disabled={!c.inputVal.trim()}
                  aria-label="Send message"
                  style={{
                    width: 34, height: 34, borderRadius: 17,
                    background: c.inputVal.trim() ? 'var(--orange)' : 'var(--bg-card-hover)',
                    border: 'none', cursor: c.inputVal.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s, transform 0.1s',
                  }}
                >
                  <Send size={14} color={c.inputVal.trim() ? '#ffffff' : 'var(--text-hint)'} />
                </button>
              )}
            </div>
          </div>
          {voiceError && (
            <p role="status" style={{ fontSize: 12, color: 'var(--amber)', margin: '6px 0 0', paddingLeft: 2 }}>
              {voiceError}
            </p>
          )}
          <p style={{ fontSize: 11, color: 'var(--text-hint)', margin: '6px 0 0', paddingLeft: 2, textAlign: 'center' }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {c.showReview && (
        <ReviewModal
          review={c.review}
          restaurant={c.reviewRestaurant}
          onClose={() => c.setShowReview(false)}
          isDark
        />
      )}
    </div>
  );
}
