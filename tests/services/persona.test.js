import { describe, it, expect, vi, beforeEach } from 'vitest';

const llm = vi.hoisted(() => ({ callPersonaLLM: vi.fn() }));

vi.mock('../../src/services/llm.service.js', () => ({
  callPersonaLLM: llm.callPersonaLLM,
}));

const { extractPersona } = await import('../../src/services/persona.service.js');

const RAW = 'I am a 30 year old in Lagos who loves spicy food';

const validExtraction = {
  full_name: 'Amara',
  age: 30,
  city: 'Lagos',
  occupation: 'Teacher',
  income_level: 'middle',
  budget_level: 'mid_range',
  spice_tolerance: 'hot',
  ambience_preference: 'casual_dining',
  value_sensitivity: 'value_seeker',
  social_context: 'family_outing',
  preferred_cuisines: ['Yoruba'],
  dietary_flags: ['none'],
};

beforeEach(() => {
  llm.callPersonaLLM.mockReset();
  llm.callPersonaLLM.mockResolvedValue({ ...validExtraction });
});

describe('extractPersona input guard', () => {
  it('rejects missing, non-string and too-short input', async () => {
    await expect(extractPersona()).rejects.toThrow(/raw_text/);
    await expect(extractPersona(42)).rejects.toThrow(/raw_text/);
    await expect(extractPersona('   short   ')).rejects.toThrow(/raw_text/);
  });

  it('reports the real minimum length in the error', async () => {
    await expect(extractPersona('too short')).rejects.toThrow(/min 10 characters/);
  });
});

describe('extractPersona sanitisation', () => {
  it('defaults invalid enum values and reports why', async () => {
    llm.callPersonaLLM.mockResolvedValue({
      ...validExtraction,
      city: 'Atlantis',
      spice_tolerance: 'nuclear',
      social_context: 'rave',
    });

    const persona = await extractPersona(RAW);

    expect(persona.city).toBe('Lagos');
    expect(persona.spice_tolerance).toBe('medium');
    expect(persona.social_context).toBe('solo');
    expect(persona._meta.extraction_warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Invalid city'),
        expect.stringContaining('Invalid spice_tolerance'),
        expect.stringContaining('Invalid social_context'),
      ])
    );
  });

  it('keeps the valid cuisines and drops the rest', async () => {
    llm.callPersonaLLM.mockResolvedValue({
      ...validExtraction,
      preferred_cuisines: ['Yoruba', 'Klingon', 'Street Food'],
    });

    const persona = await extractPersona(RAW);

    expect(persona.preferred_cuisines).toEqual(['Yoruba', 'Street Food']);
  });

  it('falls back when every cuisine is invalid', async () => {
    llm.callPersonaLLM.mockResolvedValue({
      ...validExtraction,
      preferred_cuisines: ['Klingon'],
    });

    const persona = await extractPersona(RAW);

    expect(persona.preferred_cuisines).toEqual(['Street Food']);
    expect(persona._meta.extraction_warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('no valid values')])
    );
  });

  it('accepts a single cuisine returned as a string instead of dropping it', async () => {
    llm.callPersonaLLM.mockResolvedValue({
      ...validExtraction,
      preferred_cuisines: 'Yoruba',
    });

    const persona = await extractPersona(RAW);

    expect(persona.preferred_cuisines).toEqual(['Yoruba']);
  });

  it('defaults dietary flags when all entries are unknown', async () => {
    llm.callPersonaLLM.mockResolvedValue({
      ...validExtraction,
      dietary_flags: ['pescatarian-ish'],
    });

    const persona = await extractPersona(RAW);

    expect(persona.dietary_flags).toEqual(['none']);
  });

  it('corrects a premium budget that a low income cannot support', async () => {
    llm.callPersonaLLM.mockResolvedValue({
      ...validExtraction,
      income_level: 'low',
      budget_level: 'premium',
    });

    const persona = await extractPersona(RAW);

    expect(persona.budget_level).toBe('budget');
    expect(persona._meta.extraction_warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('income/budget mismatch')])
    );
  });
});

describe('extractPersona age handling', () => {
  it('replaces a non-numeric age instead of storing it', async () => {
    llm.callPersonaLLM.mockResolvedValue({ ...validExtraction, age: 'thirty' });

    const persona = await extractPersona(RAW);

    expect(persona.age).toBe(28);
  });

  it('replaces an out-of-bounds age', async () => {
    llm.callPersonaLLM.mockResolvedValue({ ...validExtraction, age: 12 });
    expect((await extractPersona(RAW)).age).toBe(28);

    llm.callPersonaLLM.mockResolvedValue({ ...validExtraction, age: 120 });
    expect((await extractPersona(RAW)).age).toBe(28);
  });

  it('coerces a numeric string to a number', async () => {
    llm.callPersonaLLM.mockResolvedValue({ ...validExtraction, age: '34' });

    const persona = await extractPersona(RAW);

    expect(persona.age).toBe(34);
  });
});

describe('extractPersona server-owned fields', () => {
  it('stamps its own id, history and timestamp even if the model supplies them', async () => {
    llm.callPersonaLLM.mockResolvedValue({
      ...validExtraction,
      persona_id: 'model-chosen-id',
      preference_history: [{ city: 'Kano' }],
      created_at: '1999-01-01T00:00:00.000Z',
    });

    const persona = await extractPersona(RAW);

    expect(persona.persona_id).not.toBe('model-chosen-id');
    expect(persona.preference_history).toEqual([]);
    expect(persona.created_at).not.toBe('1999-01-01T00:00:00.000Z');
    expect(Number.isNaN(Date.parse(persona.created_at))).toBe(false);
  });

  it('reports null warnings and a latency for a clean extraction', async () => {
    const persona = await extractPersona(RAW);

    expect(persona._meta.extraction_warnings).toBeNull();
    expect(typeof persona._meta.latency_ms).toBe('number');
  });
});
