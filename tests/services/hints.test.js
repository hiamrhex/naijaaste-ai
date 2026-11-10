import { describe, it, expect } from 'vitest';
import {
  extractHints,
  buildFallbackPersona,
  searchTerms,
  DEFAULTS,
} from '../../src/services/hints.service.js';

describe('extractHints', () => {
  it('returns no hints for an empty message', () => {
    expect(extractHints()).toEqual({});
    expect(extractHints('')).toEqual({});
  });

  it('pulls city, budget and context out of one sentence', () => {
    expect(extractHints('My budget is tight and my kids are coming in Abuja')).toEqual({
      city: 'Abuja',
      budget_level: 'budget',
      social_context: 'family_outing',
    });
  });

  it('does not read a spice hint out of "hotel"', () => {
    expect(extractHints('I want a hotel in Lagos')).toEqual({ city: 'Lagos' });
  });

  it('does not read a budget hint out of "slow"', () => {
    expect(extractHints('the service was slow')).toEqual({});
  });

  it('does not read a date-night hint out of "update"', () => {
    expect(extractHints('any update on my order?')).toEqual({});
  });

  it('does not read a business hint out of "network"', () => {
    expect(extractHints('the network here is bad')).toEqual({});
  });

  it('prefers the more specific spice phrase', () => {
    expect(extractHints('something very spicy please').spice_tolerance).toBe('extra_hot');
    expect(extractHints('make it extra hot').spice_tolerance).toBe('extra_hot');
    expect(extractHints('nothing spicy').spice_tolerance).toBe('hot');
  });

  it('handles the no-spice phrase before the single-word hints', () => {
    expect(extractHints('no spice for me').spice_tolerance).toBe('mild');
  });

  it('matches multi-word cities', () => {
    expect(extractHints('I am in Port Harcourt').city).toBe('Port Harcourt');
    expect(extractHints('I am in Benin City').city).toBe('Benin City');
  });

  it('accepts plural forms of a hint', () => {
    expect(extractHints('we want romantic dates').social_context).toBe('date_night');
  });
});

describe('buildFallbackPersona', () => {
  it('fills every field when it has nothing to work with', () => {
    const persona = buildFallbackPersona(null, '');

    expect(persona.city).toBe('Lagos');
    expect(persona.city_known).toBe(false);
    expect(persona.budget_level).toBe(DEFAULTS.budget_level);
    expect(persona.spice_tolerance).toBe(DEFAULTS.spice_tolerance);
    expect(persona.social_context).toBe(DEFAULTS.social_context);
  });

  it('lets the current message override what the session already knew', () => {
    const session = { extracted_persona: { city: 'Abuja', budget_level: 'premium' } };

    const persona = buildFallbackPersona(session, 'actually something cheap in Kano');

    expect(persona.city).toBe('Kano');
    expect(persona.city_known).toBe(true);
    expect(persona.budget_level).toBe('budget');
  });

  it('keeps session values for fields the message does not mention', () => {
    const session = {
      extracted_persona: {
        full_name: 'Amara',
        city: 'Enugu',
        spice_tolerance: 'extra_hot',
        preferred_cuisines: ['Igbo'],
      },
    };

    const persona = buildFallbackPersona(session, 'somewhere nice');

    expect(persona.full_name).toBe('Amara');
    expect(persona.city).toBe('Enugu');
    expect(persona.spice_tolerance).toBe('extra_hot');
    expect(persona.preferred_cuisines).toEqual(['Igbo']);
  });

  it('always returns a complete, serialisable persona', () => {
    const persona = buildFallbackPersona(null, 'cheap suya in Kano');

    for (const key of [
      'persona_id', 'full_name', 'age', 'city', 'occupation', 'income_level',
      'budget_level', 'spice_tolerance', 'ambience_preference', 'value_sensitivity',
      'social_context', 'preferred_cuisines', 'dietary_flags',
      'preference_history', 'created_at',
    ]) {
      expect(persona).toHaveProperty(key);
    }
    expect(() => JSON.stringify(persona)).not.toThrow();
  });
});

describe('searchTerms', () => {
  it('finds the dishes named in the message', () => {
    expect(searchTerms('I want jollof and suya')).toEqual(['jollof', 'suya']);
  });

  it('is case-insensitive and returns nothing for an unknown dish', () => {
    expect(searchTerms('JOLLOF')).toEqual(['jollof']);
    expect(searchTerms('a bowl of sadness')).toEqual([]);
  });
});
