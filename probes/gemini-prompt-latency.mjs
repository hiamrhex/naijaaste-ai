// Times the REAL app prompts (chat, recommend, review) against each candidate
// model, so the chain order is based on measured latency, not guesses.
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { buildChatSystemPrompt, buildChatUserPrompt } from '../src/prompts/chat.prompt.js';
import { buildColdStartRecommendPrompt } from '../src/prompts/recommend.prompt.js';
import { buildReviewPrompt } from '../src/prompts/review.prompt.js';
import { getCatalogueByCity } from '../src/db/catalogue.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash'];

const persona = {
  persona_id: 'probe', city: 'Lagos', budget_level: 'budget', spice_tolerance: 'hot',
  ambience_preference: 'casual_dining', social_context: 'solo', income_level: 'low',
  preferred_cuisines: ['Street Food'], dietary_flags: ['none'], preference_history: [],
  full_name: 'Student', age: 22, occupation: 'Student', value_sensitivity: 'price_conscious',
};

const city = await getCatalogueByCity('Lagos');
const candidates = city.slice(0, 15).map(({ _source, ...r }) => r);
const restaurant = city[0];

const PROMPTS = [
  { name: 'chat', tokens: 1500, text: `${buildChatSystemPrompt()}\n\n${buildChatUserPrompt('Student in Lagos, tight budget, love pepper soup', [], { preference_history: [] })}` },
  { name: 'recommend', tokens: 2500, text: buildColdStartRecommendPrompt(persona, candidates) },
  { name: 'review', tokens: 1200, text: buildReviewPrompt(persona, restaurant) },
];

for (const p of PROMPTS) {
  for (const model of MODELS) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await ai.models.generateContent({
        model,
        contents: p.text,
        config: {
          maxOutputTokens: p.tokens,
          abortSignal: controller.signal,
          systemInstruction: 'You are an elite AI assistant. You ALWAYS return valid JSON only. No markdown. No explanation. No preamble. Raw JSON only.',
        },
      });
      let jsonOk = true;
      try { JSON.parse(String(res.text || '').replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()); } catch { jsonOk = false; }
      console.log(JSON.stringify({ prompt: p.name, model, ok: true, ms: Date.now() - started, json_ok: jsonOk }));
    } catch (err) {
      console.log(JSON.stringify({ prompt: p.name, model, ok: false, ms: Date.now() - started, status: err?.status ?? null, name: err?.name ?? null }));
    } finally {
      clearTimeout(timer);
    }
  }
}

const { closePool } = await import('../src/db/pool.js');
await closePool();
