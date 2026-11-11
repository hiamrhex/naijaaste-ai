import { memo } from 'react';

/**
 * The opening line of a Nigerian home: "have you eaten?"
 * The phrase rotates through Yoruba, Hausa, Igbo, Pidgin and English, but the
 * type does the talking — no gradient text, no badge, no decoration.
 */
export const HeroSection = memo(({ heroVisible, currentHero }) => {
  return (
    <section className="hero hero-center" aria-label="Welcome">
      <span className="hero-rule" aria-hidden="true" />
      <p className="hero-eyebrow">Your dining concierge for 60 kitchens across 8 cities</p>
      <div style={{ minHeight: 96, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h1
          className="hero-title"
          style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.35s ease, transform 0.35s ease',
          }}
        >
          {currentHero.text}
        </h1>
        <span
          className="hero-lang"
          style={{ opacity: heroVisible ? 0.75 : 0, transition: 'opacity 0.3s ease' }}
        >
          {currentHero.lang}
        </span>
      </div>
      <p className="hero-sub">
        Tell me your city, your budget and what you're craving — I'll bring back
        the shortlist, the reasons and the directions.
      </p>
    </section>
  );
});

HeroSection.displayName = 'HeroSection';
