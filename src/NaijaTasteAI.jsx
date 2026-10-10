import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Sun, Moon, ChefHat, Utensils, Zap,
  RefreshCw, ChevronDown, Globe, Clock, BarChart3, MessageSquare, ArrowRight, MapPin, Sparkles, CheckCircle, Flame,
  LogOut, User,
} from 'lucide-react';

import './styles/global.css';
import { API, HERO_PHRASES, QUICK_PROMPTS, STAGES, STAGE_LABELS, STAGE_TIPS } from './constants/index';
import {
  Tag, PersonaCard, RestaurantCard, ReviewModal, ThinkingDots
} from './components';
import GithubIcon from './components/GithubIcon.jsx';
import AuthGate from './components/AuthGate.jsx';
import { getAuth, authFetch, signout } from './lib/auth.js';

/* ── MAIN APP ─────────────────────────────────────────────────── */
function ConciergeApp({ user, onSignOut }) {
  const [dark, setDark] = useState(true);
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroVisible, setHeroVisible] = useState(true);
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Welcome! I'm NaijaTaste AI — your personal guide to the best restaurants across Nigeria. Tell me about yourself — your city, your budget, what you're craving — and I'll find the perfect spot for you.",
  }]);
  const [sessionId, setSessionId] = useState(null);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("gather");
  const [persona, setPersona] = useState(null);
  const [recs, setRecs] = useState(null);
  const [meta, setMeta] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [review, setReview] = useState(null);
  const [reviewRestaurant, setReviewRestaurant] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [thinkOpen, setThinkOpen] = useState(true);
  const [resultsOpen, setResultsOpen] = useState(true);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  /* Hero phrase rotation */
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroVisible(false);
      setTimeout(() => {
        setHeroIdx((i) => (i + 1) % HERO_PHRASES.length);
        setHeroVisible(true);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  /* Auto-scroll */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* Theme tokens */
  const t = dark ? {
    "--bg-primary": "#080810",
    "--bg-secondary": "#0D0D1A",
    "--bg-card": "#111827",
    "--bg-card-hover": "#1A2332",
    "--border": "#1F2937",
    "--orange": "#F97316",
    "--orange-light": "rgba(249,115,22,0.1)",
    "--green": "#10B981",
    "--amber": "#F59E0B",
    "--text-primary": "#F9FAFB",
    "--text-secondary": "#D1D5DB",
    "--text-muted": "#9CA3AF",
    "--text-hint": "#6B7280",
    "--chat-user-bg": "#F97316",
    "--chat-user-text": "#ffffff",
    "--chat-bot-bg": "#1A2332",
    "--chat-bot-text": "#D1D5DB",
    "--input-bg": "#111827",
    "--header-bg": "rgba(8,8,16,0.92)",
  } : {
    "--bg-primary": "#FAFAF5",
    "--bg-secondary": "#F2EFE8",
    "--bg-card": "#FFFFFF",
    "--bg-card-hover": "#F8F5F0",
    "--border": "#E5E0D8",
    "--orange": "#EA6C14",
    "--orange-light": "rgba(234,108,20,0.08)",
    "--green": "#059669",
    "--amber": "#D97706",
    "--text-primary": "#111827",
    "--text-secondary": "#374151",
    "--text-muted": "#6B7280",
    "--text-hint": "#9CA3AF",
    "--chat-user-bg": "#EA6C14",
    "--chat-user-text": "#ffffff",
    "--chat-bot-bg": "#F0EDE6",
    "--chat-bot-text": "#374151",
    "--input-bg": "#FFFFFF",
    "--header-bg": "rgba(250,250,245,0.92)",
  };

  /* Send message */
  const sendMsg = useCallback(async (text) => {
    const txt = (text || inputVal).trim();
    if (!txt || loading) return;
    setInputVal("");
    setShowQuickPrompts(false);
    setMessages((prev) => [...prev, { role: "user", content: txt }]);
    setLoading(true);
    try {
      const res = await authFetch('/agent', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: txt, session_id: sessionId || undefined }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || "Agent request failed");
      }
      if (data.session_id) setSessionId(data.session_id);
      if (data.stage) setStage(data.stage);
      if (data.extracted_persona) setPersona(data.extracted_persona);

      if (data.recommendations?.recommendations) {
        setRecs(data.recommendations.recommendations);
        setResultsOpen(true);
      }
      if (data.meta) setMeta(data.meta);

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.message || "No response received.",
        trace: data.trace || null,
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: err.message || "Connection issue — please try again.",
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  }, [inputVal, loading, sessionId]);

  /* Generate review */
  const generateReview = useCallback(async (restaurant) => {
    if (!persona || reviewLoading) return;
    setReviewLoading(true);
    setReviewRestaurant(restaurant);
    try {
      const res = await fetch(`${API}/generate-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona, restaurant }),
      });
      const data = await res.json();
      setReview(data);
      setShowReview(true);
    } catch {
      /* silent fail */
    } finally {
      setReviewLoading(false);
    }
  }, [persona, reviewLoading]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  const reset = () => {
    setMessages([{
      role: "assistant",
      content: "Welcome! I'm NaijaTaste AI — your personal guide to the best restaurants across Nigeria. Tell me about yourself — your city, your budget, what you're craving — and I'll find the perfect spot for you.",
    }]);
    setSessionId(null);
    setStage("gather");
    setPersona(null);
    setRecs(null);
    setMeta(null);
    setInputVal("");
    setShowQuickPrompts(true);
    setResultsOpen(true);
  };

  const stageIdx = STAGES.indexOf(stage);
  const currentHero = HERO_PHRASES[heroIdx];

  return (
    <div style={{
      ...t,
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      background: "var(--bg-primary)",
      minHeight: "100vh",
      color: "var(--text-primary)",
      transition: "background 0.3s, color 0.3s",
      width: '100%',
    }}>

      {/* ── HEADER ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "var(--header-bg)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 20px", height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "var(--orange-light)",
            border: "1px solid rgba(249,115,22,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ChefHat size={17} color="var(--orange)" />
          </div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: "-0.3px", color: "var(--text-primary)" }}>
            NaijaTaste <span style={{ color: "var(--orange)" }}>AI</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11, color: "var(--text-muted)",
            background: "var(--bg-card)", border: "1px solid var(--border)",
            padding: "4px 10px", borderRadius: 20,
            display: "none",
          }} className="badge-desktop">
            DSN × BCT Challenge 3.0
          </span>
          <a
            href="https://github.com/hiamrhex/naijaaste-ai"
            target="_blank"
            rel="noopener noreferrer"
            title="View on GitHub"
            style={{
              background: "none", border: "1px solid var(--border)",
              borderRadius: 8, padding: 7, cursor: "pointer",
              color: "var(--text-muted)", display: "flex", alignItems: "center",
              textDecoration: "none", transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(249,115,22,0.4)"; e.currentTarget.style.color = "var(--orange)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <GithubIcon size={15} />
          </a>
          <span style={{
            fontSize: 12, color: "var(--text-secondary)",
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--bg-card)", border: "1px solid var(--border)",
            padding: "5px 11px", borderRadius: 20, maxWidth: 160,
          }} title={user?.email}>
            <User size={12} color="var(--orange)" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.name?.split(" ")[0] || "Foodie"}
            </span>
          </span>
          <button
            onClick={onSignOut}
            title="Sign out"
            style={{
              background: "none", border: "1px solid var(--border)",
              borderRadius: 8, padding: 7, cursor: "pointer",
              color: "var(--text-muted)", display: "flex", alignItems: "center",
            }}
          >
            <LogOut size={14} />
          </button>
          <button
            onClick={() => setDark((d) => !d)}
            style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 20, padding: "6px 12px",
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, color: "var(--text-secondary)", cursor: "pointer",
              fontFamily: "inherit", transition: "all 0.2s",
            }}
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
            {dark ? "Light" : "Dark"}
          </button>
          <button
            onClick={reset}
            title="Start over"
            style={{
              background: "none", border: "1px solid var(--border)",
              borderRadius: 8, padding: 7, cursor: "pointer",
              color: "var(--text-muted)", display: "flex", alignItems: "center",
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {/* ── HERO ── */}
      <div style={{
        textAlign: "center",
        padding: "28px 20px 16px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Subtle bg glow */}
        <div style={{
          position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
          width: 400, height: 200,
          background: "radial-gradient(ellipse, rgba(249,115,22,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: 20, padding: "4px 12px", marginBottom: 14,
        }}>
          <Globe size={11} color="var(--green)" />
          <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 600, letterSpacing: "0.05em" }}>
            Powered by Nigerian Cultural Intelligence
          </span>
        </div>

        <div style={{ minHeight: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <h1 style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: "clamp(26px, 5vw, 42px)",
            lineHeight: 1.1,
            letterSpacing: "-1px",
            margin: "0 0 4px",
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.97)",
            transition: "opacity 0.4s ease, transform 0.4s ease",
          }}>
            <span className={
              heroIdx === 5 ? "gradient-hero-english" :
              heroIdx === 4 ? "gradient-hero-pidgin2" :
              "gradient-hero-main"
            }>
              {currentHero.text}
            </span>
          </h1>
          <div style={{
            fontSize: 11, color: "var(--text-muted)",
            opacity: heroVisible ? 0.7 : 0, transition: "opacity 0.35s ease",
            marginBottom: 2,
          }}>
            {currentHero.lang}
          </div>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>
          AI-powered recommendations · 63 Nigerian restaurants · 8 cities
        </p>
      </div>

      {/* ── STAGE BAR ── */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: 0, padding: "0 20px 20px", overflowX: "auto",
      }}>
        {STAGES.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 12px", borderRadius: 20,
              background: s === stage ? "var(--orange-light)" : "transparent",
              border: s === stage ? "1px solid rgba(249,115,22,0.35)" : "1px solid transparent",
              color: s === stage ? "var(--orange)" : i < stageIdx ? "var(--text-muted)" : "var(--text-hint)",
              fontSize: 12, fontWeight: s === stage ? 600 : 400,
              transition: "all 0.3s",
              whiteSpace: "nowrap",
            }}>
              {i < stageIdx && <CheckCircle size={11} />}
              {i === stageIdx && (
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--orange)",
                  animation: "pulseDot 2s infinite",
                  display: "inline-block",
                }} />
              )}
              {STAGE_LABELS[s]}
            </div>
            {i < STAGES.length - 1 && (
              <div style={{ width: 20, height: 1, background: i < stageIdx ? "var(--orange)" : "var(--border)", margin: "0 -2px", transition: "background 0.3s" }} />
            )}
          </div>
        ))}
      </div>

      {/* ── MAIN GRID ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1.1fr) minmax(0,0.9fr)",
        gap: 24,
        padding: "0 16px 32px",
        maxWidth: 1440,
        margin: "0 auto",
      }}
      className="main-grid"
      >

        {/* ─── LEFT: CHAT ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Quick prompts */}
          {showQuickPrompts && (
            <div className="fade-in" style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 14, padding: "14px 16px",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-hint)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                Quick Start
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMsg(q)}
                    style={{
                      background: "var(--bg-card-hover)", border: "1px solid var(--border)",
                      borderRadius: 9, padding: "8px 12px",
                      textAlign: "left", fontSize: 12.5, color: "var(--text-secondary)",
                      cursor: "pointer", fontFamily: "inherit", lineHeight: 1.4,
                      transition: "all 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(249,115,22,0.3)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
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
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 14, padding: "14px 14px 8px",
            minHeight: 280, maxHeight: 420, overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {messages.map((m, i) => (
              <div
                key={i}
                className="bubble-in"
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  animationDelay: `${i * 30}ms`,
                }}
              >
                {m.role === "assistant" && (
                  <div style={{ maxWidth: "88%", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 7,
                        background: "var(--orange-light)", border: "1px solid rgba(249,115,22,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <ChefHat size={11} color="var(--orange)" />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--orange)", letterSpacing: "0.08em" }}>NAIJATASTE</span>
                    </div>
                    <div style={{
                      background: "var(--chat-bot-bg)",
                      borderRadius: "4px 14px 14px 14px",
                      padding: "10px 13px",
                      fontSize: 13.5, lineHeight: 1.6,
                      color: m.error ? "#F87171" : "var(--chat-bot-text)",
                      border: "1px solid var(--border)",
                    }}>
                      {m.content}
                    </div>
                    {m.trace && m.trace.some((s) => s.tool) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                        {m.trace.filter((s) => s.tool).map((s, ti) => (
                          <span key={ti} style={{
                            fontSize: 10, display: "inline-flex", alignItems: "center", gap: 4,
                            background: s.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                            border: `1px solid ${s.ok ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                            color: s.ok ? "var(--green)" : "#F87171",
                            padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                          }}>
                            <Zap size={9} />{s.tool}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {m.role === "user" && (
                  <div style={{
                    maxWidth: "82%",
                    background: "var(--chat-user-bg)",
                    borderRadius: "14px 4px 14px 14px",
                    padding: "10px 13px",
                    fontSize: 13.5, lineHeight: 1.55,
                    color: "var(--chat-user-text)",
                    fontWeight: 500,
                  }}>
                    {m.content}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 7,
                  background: "var(--orange-light)", border: "1px solid rgba(249,115,22,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <ChefHat size={11} color="var(--orange)" />
                </div>
                <div style={{ background: "var(--chat-bot-bg)", border: "1px solid var(--border)", borderRadius: "4px 14px 14px 14px" }}>
                  <ThinkingDots />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Agent thinking */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <button
              onClick={() => setThinkOpen((v) => !v)}
              style={{
                width: "100%", background: "none", border: "none",
                padding: "10px 14px", display: "flex", alignItems: "center",
                justifyContent: "space-between", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 7 }}>
                <Zap size={13} color="var(--orange)" />
                How the agent is thinking
              </span>
              <ChevronDown size={14} color="var(--text-hint)" style={{
                transform: thinkOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.25s",
              }} />
            </button>
            {thinkOpen && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "10px 14px 12px" }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: "rgba(249,115,22,0.1)", color: "var(--orange)",
                    border: "1px solid rgba(249,115,22,0.25)",
                    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: "var(--orange)",
                      animation: "pulseDot 2s infinite",
                      display: "inline-block",
                    }} />
                    Stage: {STAGE_LABELS[stage]}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.55 }}>
                  {STAGE_TIPS[stage]}
                </p>
                {persona && (
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {persona.city && <Tag variant="orange"><MapPin size={10} />{persona.city}</Tag>}
                    {persona.budget_level && <Tag>{persona.budget_level}</Tag>}
                    {persona.spice_tolerance && <Tag variant="amber"><Flame size={10} />{persona.spice_tolerance}</Tag>}
                  </div>
                )}
                {meta && (
                  <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {meta.after_hard_filter != null && (
                      <span style={{ fontSize: 11, color: "var(--text-hint)", display: "flex", alignItems: "center", gap: 4 }}>
                        <BarChart3 size={11} />{meta.after_hard_filter} restaurants considered
                      </span>
                    )}
                    {meta.steps != null && (
                      <span style={{ fontSize: 11, color: "var(--text-hint)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Zap size={11} />{meta.steps} agent steps
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "var(--text-hint)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={11} />{meta.latency_ms}ms
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            background: "var(--input-bg)", border: "1px solid var(--border)",
            borderRadius: 14, display: "flex", alignItems: "flex-end", gap: 8,
            padding: "10px 12px", transition: "border-color 0.2s",
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = "rgba(249,115,22,0.4)"}
          onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
          >
            <textarea
              ref={inputRef}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value.slice(0, 500))}
              onKeyDown={handleKey}
              placeholder="Describe yourself — city, budget, what you're craving..."
              rows={2}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                resize: "none", fontSize: 13.5, color: "var(--text-primary)",
                fontFamily: "inherit", lineHeight: 1.5,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: "var(--text-hint)" }}>{inputVal.length}/500</span>
              <button
                onClick={() => sendMsg()}
                disabled={!inputVal.trim() || loading}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: inputVal.trim() && !loading ? "var(--orange)" : "var(--bg-card-hover)",
                  border: "none", cursor: inputVal.trim() && !loading ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s, transform 0.1s",
                }}
                onMouseDown={(e) => { if (inputVal.trim()) e.currentTarget.style.transform = "scale(0.92)"; }}
                onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                <Send size={15} color={inputVal.trim() && !loading ? "#ffffff" : "var(--text-hint)"} />
              </button>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-hint)", margin: "-6px 0 0", paddingLeft: 2 }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>

        {/* ─── RIGHT: RESULTS ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Persona card */}
          {persona && <PersonaCard persona={persona} />}

          {/* Results panel */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <button
              onClick={() => setResultsOpen((v) => !v)}
              style={{
                width: "100%", background: "none", border: "none",
                padding: "14px 16px", display: "flex",
                alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: "var(--orange-light)", border: "1px solid rgba(249,115,22,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Utensils size={16} color="var(--orange)" />
                </div>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                  {recs ? `${recs.length} Spots Found` : "Your Results"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {recs && (
                  <span style={{
                    fontSize: 11, background: "rgba(16,185,129,0.12)",
                    color: "var(--green)", border: "1px solid rgba(16,185,129,0.25)",
                    padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                  }}>Ready</span>
                )}
                <ChevronDown size={16} color="var(--text-hint)" style={{
                  transform: resultsOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.25s",
                }} />
              </div>
            </button>

            <div style={{
              maxHeight: resultsOpen ? "2000px" : "0",
              overflow: "hidden",
              transition: "max-height 0.4s ease",
              borderTop: resultsOpen ? "1px solid var(--border)" : "none",
            }}>
              {recs ? (
                <div style={{ padding: "12px 12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {recs.map((r, i) => (
                    <RestaurantCard
                      key={r.restaurant_id || i}
                      rec={r}
                      index={i}
                      onReview={generateReview}
                      persona={persona}
                    />
                  ))}
                  {meta && (
                    <div style={{
                      marginTop: 4, padding: "10px 14px",
                      background: "var(--bg-card-hover)", borderRadius: 10,
                      display: "flex", flexWrap: "wrap", gap: 12,
                    }}>
                      {meta.after_hard_filter != null && (
                        <span style={{ fontSize: 11, color: "var(--text-hint)", display: "flex", alignItems: "center", gap: 5 }}>
                          <BarChart3 size={11} />{meta.after_hard_filter} restaurants filtered
                        </span>
                      )}
                      {meta.candidates_sent_to_llm != null && (
                        <span style={{ fontSize: 11, color: "var(--text-hint)", display: "flex", alignItems: "center", gap: 5 }}>
                          <MessageSquare size={11} />{meta.candidates_sent_to_llm} ranked by AI
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: "var(--text-hint)", display: "flex", alignItems: "center", gap: 5 }}>
                        <Clock size={11} />{meta.latency_ms}ms
                      </span>
                    </div>
                  )}
                  <button
                    onClick={reset}
                    style={{
                      background: "none", border: "1px solid var(--border)",
                      borderRadius: 10, padding: "8px 14px",
                      fontSize: 12, color: "var(--text-muted)",
                      cursor: "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(249,115,22,0.3)"; e.currentTarget.style.color = "var(--orange)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                  >
                    <RefreshCw size={13} /> Start a new search
                  </button>
                </div>
              ) : (
                <div style={{ padding: "40px 20px", textAlign: "center" }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: "var(--orange-light)", border: "1px solid rgba(249,115,22,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 14px",
                  }}>
                    <Utensils size={22} color="var(--orange)" />
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
                    Chat with NaijaTaste AI on the left to get personalised restaurant picks across Nigeria.
                  </p>
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      [MapPin, "8 cities covered"],
                      [Utensils, "63 curated restaurants"],
                      [Sparkles, "AI-ranked by taste match"],
                    ].map(([Icon, label]) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                        <Icon size={13} color="var(--orange)" />
                        <span style={{ fontSize: 12, color: "var(--text-hint)" }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: "1px solid var(--border)",
        padding: "16px 20px",
        textAlign: "center",
      }}>
        <p style={{ fontSize: 12, color: "var(--text-hint)", margin: "0 0 3px" }}>
          Developed by{" "}
          <span style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 13,
            color: "var(--orange)",
            letterSpacing: "0.02em",
          }}>
            Team PRiME
          </span>
          {" "}·{" "}
          <span style={{ color: "var(--text-hint)" }}>DSN × BCT LLM Agent Challenge 3.0 · 2026</span>
          {" "}·{" "}
          <a
            href="https://github.com/hiamrhex/naijaaste-ai"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--text-muted)", display: "inline-flex", alignItems: "center",
              gap: 4, verticalAlign: "middle", textDecoration: "none",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--orange)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <GithubIcon size={12} /> Source
          </a>
        </p>
        <p style={{ fontSize: 11, color: "var(--text-hint)", margin: 0, opacity: 0.6 }}>
          Powered by Gemini API (gemini-3.8-flash) · Autonomous agent · 63 Nigerian Restaurants across 8 Cities
        </p>
      </footer>

      {/* ── REVIEW MODAL ── */}
      {showReview && (
        <ReviewModal
          review={review}
          restaurant={reviewRestaurant}
          onClose={() => setShowReview(false)}
          isDark={dark}
        />
      )}
    </div>
  );
}

/* ── AUTHENTICATED SHELL ─────────────────────────────────────── */
export default function NaijaTasteAI() {
  const [user, setUser] = useState(() => getAuth()?.user || null);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const handleSignOut = async () => {
    await signout();
    setUser(null);
  };

  if (!user) return <AuthGate onAuth={(u) => setUser(u)} />;
  return <ConciergeApp user={user} onSignOut={handleSignOut} />;
}
