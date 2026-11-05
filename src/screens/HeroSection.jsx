import { memo } from 'react';
import { Globe } from 'lucide-react';

export const HeroSection = memo(({ heroIdx, heroVisible, currentHero }) => {
  return (
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
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.97)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}>
          <span className={
            heroIdx === 5 ? 'gradient-hero-english' :
            heroIdx === 4 ? 'gradient-hero-pidgin2' :
            'gradient-hero-main'
          }>
            {currentHero.text}
          </span>
        </h1>
        <div style={{
          fontSize: 11, color: 'var(--text-muted)',
          opacity: heroVisible ? 0.7 : 0, transition: 'opacity 0.35s ease',
          marginBottom: 2,
        }}>
          {currentHero.lang}
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
        AI-powered recommendations · 60 Nigerian restaurants · 8 cities
      </p>
    </div>
  );
});

HeroSection.displayName = 'HeroSection';