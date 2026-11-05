import { useRef, useState, useMemo } from 'react';
import { memo } from 'react';
import { Send, Utensils, Zap, Square, MapPin, Sparkles, ChevronDown } from 'lucide-react';
import { Header, Footer } from '../components/SiteChrome.jsx';
import { useAuth } from '../app/useAuth.js';
import { useConcierge } from '../hooks/useConcierge.js';
import { VoiceButton } from '../components/VoiceButton.jsx';
import { useLanguage } from '../app/useLanguage.js';
import { HERO_PHRASES } from '../constants/index.js';
import { HeroSection } from './HeroSection.jsx';
import { StageBar } from './StageBar.jsx';
import { QuickStart } from './QuickStart.jsx';
import { ConversationStream } from './ConversationStream.jsx';
import { AgentThinking } from './AgentThinking.jsx';
import { ResultsSection } from './ResultsSection.jsx';
import { ReviewModal } from '../components/ReviewModal.jsx';

export default memo(function HomeScreen() {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const [voiceError, setVoiceError] = useState(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const c = useConcierge({ chatEndRef });
  const currentHero = useMemo(() => HERO_PHRASES[c.heroIdx], [c.heroIdx]);

  // The welcome furniture (hero + quick prompts) only shows while the
  // conversation is fresh - once the user has said something, the chat owns
  // the screen, the way it does in Claude or ChatGPT.
  const fresh = useMemo(() => c.messages.length <= 1, [c.messages.length]);

  // The trace of the most recent agent turn - what it actually did.
  const lastTrace = useMemo(() => [...c.messages].reverse().find((m) => m.trace?.length)?.trace || [], [c.messages]);

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
          {fresh && <HeroSection heroIdx={c.heroIdx} heroVisible={c.heroVisible} currentHero={currentHero} />}

          {/* ── STAGE BAR ── */}
          <StageBar stage={c.stage} stageIdx={c.stageIdx} />

          {/* ── QUICK START (fresh conversations only) ── */}
          <QuickStart showQuickPrompts={c.showQuickPrompts} onSendMsg={c.sendMsg} />

          {/* ── THE CONVERSATION ── */}
          <ConversationStream 
            messages={c.messages} 
            loading={c.loading} 
            generateReview={c.generateReview}
            stop={c.stop}
          />

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
            {c.thinkOpen && <AgentThinking thinkOpen={c.thinkOpen} stage={c.stage} lastTrace={lastTrace} meta={c.meta} />}
          </div>

          {/* ── THE FOOD: below the conversation, full width ── */}
          <ResultsSection
            recs={c.recs}
            persona={c.persona}
            showNearby={c.showNearby}
            nearbyLoading={c.nearbyLoading}
            nearbyError={c.nearbyError}
            nearby={c.nearby}
            findNearby={c.findNearby}
            setShowNearby={() => c.setShowNearby(false)}
            favorites={c.favorites}
            toggleFavorite={c.toggleFavorite}
            generateReview={c.generateReview}
            geoCache={c.geoCache}
            nearbyOrigin={c.nearby?.origin}
            reset={c.reset}
          />

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
});
