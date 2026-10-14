import { useRef, useState } from 'react';
import {
  Send, ChefHat, Utensils, Zap, Square,
  RefreshCw, ChevronDown, Globe, Clock, BarChart3, MessageSquare, ArrowRight, MapPin, Sparkles, CheckCircle, Flame,
} from 'lucide-react';
import { HERO_PHRASES, QUICK_PROMPTS, STAGES, STAGE_LABELS, STAGE_TIPS } from '../constants/index.js';
import { Tag, PersonaCard, RestaurantCard, ReviewModal, ThinkingDots } from '../components/index.js';
import { NearbyPanel } from '../components/NearbyPanel.jsx';
import { Header, Footer } from '../components/Shell.jsx';
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

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); c.sendMsg(); }
  };

  return (
    <div>
      <Header
        user={user}
        onSignOut={signOut}
        onNearMe={c.findNearby}
        nearbyLoading={c.nearbyLoading}
        showNearby={c.showNearby}
        onReset={c.reset}
      />

      {/* ── HERO ── */}
      <div style={{ textAlign: 'center', padding: '28px 20px 16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
          width: 400, height: 200,
          background: 'radial-gradient(ellipse, rgba(249,115,22,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 20, padding: '4px 12px', marginBottom: 14,
        }}>
          <Globe size={11} color="var(--green)" />
          <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, letterSpacing: '0.05em' }}>
            Powered by Nigerian Cultural Intelligence
          </span>
        </div>
        <div style={{ minHeight: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: 'clamp(26px, 5vw, 42px)', lineHeight: 1.1,
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
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          AI-powered recommendations · 60 Nigerian restaurants · 8 cities
        </p>
      </div>

      {/* ── STAGE BAR ── */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0, padding: '0 20px 20px', overflowX: 'auto' }} role="status" aria-label={`Stage: ${STAGE_LABELS[c.stage]}`}>
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

      {/* ── MAIN GRID ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)',
        gap: 24, padding: '0 16px 32px', maxWidth: 1440, margin: '0 auto',
      }} className="main-grid">

        {/* ─── LEFT: CHAT ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {c.showQuickPrompts && (
            <div className="fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
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

          {/* Messages */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '14px 14px 8px',
            minHeight: 280, maxHeight: 420, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 10,
          }} role="log" aria-label="Chat messages" aria-live="polite">
            {c.messages.map((m, i) => (
              <div key={i} className="bubble-in" style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', animationDelay: `${i * 30}ms` }}>
                {m.role === 'assistant' && (
                  <div style={{ maxWidth: '88%', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--orange-light)', border: '1px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ChefHat size={11} color="var(--orange)" />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--orange)', letterSpacing: '0.08em' }}>NAIJATASTE</span>
                    </div>
                    <div style={{
                      background: 'var(--chat-bot-bg)', borderRadius: '4px 14px 14px 14px',
                      padding: '10px 13px', fontSize: 13.5, lineHeight: 1.6,
                      color: m.error ? '#F87171' : 'var(--chat-bot-text)',
                      border: '1px solid var(--border)',
                    }}>
                      {m.content}
                    </div>
                    {m.trace && m.trace.some((s) => s.tool) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
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
                    borderRadius: '14px 4px 14px 14px', padding: '10px 13px',
                    fontSize: 13.5, lineHeight: 1.55,
                    color: 'var(--chat-user-text)', fontWeight: 500,
                  }}>
                    {m.content}
                  </div>
                )}
              </div>
            ))}
            {c.loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--orange-light)', border: '1px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ChefHat size={11} color="var(--orange)" />
                </div>
                <div style={{ background: 'var(--chat-bot-bg)', border: '1px solid var(--border)', borderRadius: '4px 14px 14px 14px' }}>
                  <ThinkingDots />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Agent thinking */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <button
              onClick={() => c.setThinkOpen((v) => !v)}
              aria-expanded={c.thinkOpen}
              style={{ width: '100%', background: 'none', border: 'none', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Zap size={13} color="var(--orange)" />
                How the agent is thinking
              </span>
              <ChevronDown size={14} color="var(--text-hint)" style={{ transform: c.thinkOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }} />
            </button>
            {c.thinkOpen && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px 12px' }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(249,115,22,0.1)', color: 'var(--orange)', border: '1px solid rgba(249,115,22,0.25)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--orange)', animation: 'pulseDot 2s infinite', display: 'inline-block' }} />
                    Stage: {STAGE_LABELS[c.stage]}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
                  {STAGE_TIPS[c.stage]}
                </p>
                {c.persona && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {c.persona.city && <Tag variant="orange"><MapPin size={10} />{c.persona.city}</Tag>}
                    {c.persona.budget_level && <Tag>{c.persona.budget_level}</Tag>}
                    {c.persona.spice_tolerance && <Tag variant="amber"><Flame size={10} />{c.persona.spice_tolerance}</Tag>}
                  </div>
                )}
                {c.meta && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {c.meta.after_hard_filter != null && (
                      <span style={{ fontSize: 11, color: 'var(--text-hint)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <BarChart3 size={11} />{c.meta.after_hard_filter} restaurants considered
                      </span>
                    )}
                    {c.meta.steps != null && (
                      <span style={{ fontSize: 11, color: 'var(--text-hint)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Zap size={11} />{c.meta.steps} agent steps
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-hint)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} />{c.meta.latency_ms}ms
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div>
            <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '10px 12px', transition: 'border-color 0.2s' }}>
              <label htmlFor="chat-input" className="sr-only">Describe yourself — city, budget, what you're craving</label>
              <textarea
                id="chat-input"
                ref={inputRef}
                value={c.inputVal}
                onChange={(e) => c.setInputVal(e.target.value.slice(0, 500))}
                onKeyDown={handleKey}
                placeholder="Describe yourself — city, budget, what you're craving..."
                rows={2}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 13.5, color: 'var(--text-primary)', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 10, color: 'var(--text-hint)' }} aria-hidden="true">{c.inputVal.length}/500</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
                        width: 36, height: 36, borderRadius: 10,
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Square size={14} color="#F87171" fill="#F87171" />
                    </button>
                  ) : (
                    <button
                      onClick={() => c.sendMsg()}
                      disabled={!c.inputVal.trim()}
                      aria-label="Send message"
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: c.inputVal.trim() ? 'var(--orange)' : 'var(--bg-card-hover)',
                        border: 'none', cursor: c.inputVal.trim() ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s, transform 0.1s',
                      }}
                    >
                      <Send size={15} color={c.inputVal.trim() ? '#ffffff' : 'var(--text-hint)'} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            {voiceError && (
              <p role="status" style={{ fontSize: 12, color: 'var(--amber)', margin: '6px 0 0', paddingLeft: 2 }}>
                {voiceError}
              </p>
            )}
            <p style={{ fontSize: 11, color: 'var(--text-hint)', margin: '6px 0 0', paddingLeft: 2 }}>
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* ─── RIGHT: RESULTS ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <button
              onClick={() => c.setResultsOpen((v) => !v)}
              aria-expanded={c.resultsOpen}
              style={{ width: '100%', background: 'none', border: 'none', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--orange-light)', border: '1px solid rgba(249,115,22,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Utensils size={16} color="var(--orange)" />
                </div>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                  {c.recs ? `${c.recs.length} Spots Found` : 'Your Results'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {c.recs && (
                  <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.12)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.25)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Ready</span>
                )}
                <ChevronDown size={16} color="var(--text-hint)" style={{ transform: c.resultsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }} />
              </div>
            </button>
            <div style={{ maxHeight: c.resultsOpen ? '2000px' : '0', overflow: 'hidden', transition: 'max-height 0.4s ease', borderTop: c.resultsOpen ? '1px solid var(--border)' : 'none' }}>
              {c.recs ? (
                <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                  {c.meta && (
                    <div style={{ marginTop: 4, padding: '10px 14px', background: 'var(--bg-card-hover)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
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
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s', minHeight: 44 }}
                  >
                    <RefreshCw size={13} /> Start a new search
                  </button>
                </div>
              ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--orange-light)', border: '1px solid rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <Utensils size={22} color="var(--orange)" />
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                    Chat with NaijaTaste AI on the left to get personalised restaurant picks across Nigeria.
                  </p>
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      [MapPin, '8 cities covered'],
                      [Utensils, '60 curated restaurants'],
                      [Sparkles, 'AI-ranked by taste match'],
                    ].map(([Icon, label]) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                        <Icon size={13} color="var(--orange)" />
                        <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />

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
