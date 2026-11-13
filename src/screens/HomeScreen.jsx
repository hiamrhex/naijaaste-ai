import { useRef, useState, useMemo, useEffect } from 'react';
import { memo } from 'react';
import { Send, Zap, Square, ChevronDown } from 'lucide-react';
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
    // Enter inside an IME composition (common on Android keyboards) must not
    // send the message.
    if (e.nativeEvent?.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); c.sendMsg(); }
  };

  // Let the composer grow with the message, then stop at 140px.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [c.inputVal]);

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
        <div className="home-column home-column--scroll">

          {/* ── HERO (fresh conversations only) ── */}
          {fresh && <HeroSection heroIdx={c.heroIdx} heroVisible={c.heroVisible} currentHero={currentHero} />}

          {/* ── STAGE BAR (only while the agent is actually working) ── */}
          {(c.loading || c.stageIdx > 0) && <StageBar stage={c.stage} stageIdx={c.stageIdx} />}

          {/* ── QUICK START (fresh conversations only) ── */}
          <QuickStart showQuickPrompts={c.showQuickPrompts} onSendMsg={c.sendMsg} />

          {/* ── THE CONVERSATION ── */}
          <ConversationStream 
            messages={c.messages} 
            loading={c.loading} 
            onRetry={c.sendMsg}
          />

          {/* ── AGENT THINKING (only once there is work to show) ── */}
          {(c.loading || lastTrace.length > 0 || c.messages.length > 1) && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', marginTop: 16 }}>
              <button
                type="button"
                onClick={() => c.setThinkOpen((v) => !v)}
                aria-expanded={c.thinkOpen}
                style={{ width: '100%', background: 'none', border: 'none', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Zap size={13} color="var(--orange)" aria-hidden="true" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    What the agent did
                  </span>
                </div>
                <ChevronDown size={16} color="var(--text-hint)" style={{ transform: c.thinkOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }} aria-hidden="true" />
              </button>
              {c.thinkOpen && <AgentThinking thinkOpen={c.thinkOpen} stage={c.stage} lastTrace={lastTrace} meta={c.meta} />}
            </div>
          )}

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

          <div className="home-foot">
            <Footer />
          </div>
        </div>
      </div>

      {/* ── THE COMPOSER: always on screen, like every modern AI chat ── */}
      <div className="composer-dock">
        <div className="home-column">
          <div className="composer-box">
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
                maxHeight: 140, minHeight: 44, padding: '4px 0',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingBottom: 2 }}>
              {c.inputVal.length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--text-hint)', alignSelf: 'flex-end', marginRight: 2 }} aria-hidden="true">
                  {c.inputVal.length}/500
                </span>
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
                  type="button"
                  className="send-btn"
                  data-stop="true"
                  onClick={() => c.stop()}
                  aria-label={t('stop')}
                  title={t('stop')}
                >
                  <Square size={13} fill="currentColor" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  className="send-btn"
                  data-ready={c.inputVal.trim() ? 'true' : 'false'}
                  onClick={() => c.sendMsg()}
                  disabled={!c.inputVal.trim()}
                  aria-label="Send message"
                >
                  <Send size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          {voiceError && (
            <p role="status" style={{ fontSize: 12, color: 'var(--amber)', margin: '6px 0 0', paddingLeft: 2 }}>
              {voiceError}
            </p>
          )}
          <p className="composer-hint">
            Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </div>

      {c.showReview && (
        <ReviewModal
          review={c.review}
          restaurant={c.reviewRestaurant}
          onClose={() => c.setShowReview(false)}
        />
      )}
    </div>
  );
});
