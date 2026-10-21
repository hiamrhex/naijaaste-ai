// Gemini health probe — read-only.
//
// Answers the two questions that decide the model config:
//   1. Is the API key valid at all?
//   2. Which models answer, how fast, and do they return valid JSON?
//
// Prints model + status + latency only; the key is never printed.
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const key = process.env.GEMINI_API_KEY || '';
console.log(JSON.stringify({
  key_present: key.length > 0,
  key_length: key.length,
  key_prefix: key.slice(0, 4),
  configured_model: process.env.GEMINI_MODEL || null,
}));

const ai = new GoogleGenAI({ apiKey: key });

try {
  const pager = await ai.models.list({ config: { pageSize: 100 } });
  const names = [];
  for await (const m of pager) names.push(m.name.replace('models/', ''));
  console.log(JSON.stringify({ model_count: names.length, models: names }));
} catch (err) {
  console.log(JSON.stringify({
    list_ok: false,
    status: err?.status ?? null,
    message: String(err?.message || '').slice(0, 240),
  }));
}

const candidates = [
  process.env.GEMINI_MODEL,
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
].filter(Boolean);

for (const model of [...new Set(candidates)]) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await ai.models.generateContent({
      model,
      contents: 'Return JSON only: {"ok":true}',
      config: { maxOutputTokens: 1024, abortSignal: controller.signal },
    });
    const text = String(res.text || '');
    let jsonOk = false;
    try {
      JSON.parse(text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim());
      jsonOk = true;
    } catch { /* not JSON */ }
    console.log(JSON.stringify({
      model,
      ok: true,
      ms: Date.now() - started,
      json_ok: jsonOk,
      finish: res.candidates?.[0]?.finishReason ?? null,
      text: text.slice(0, 100),
    }));
  } catch (err) {
    console.log(JSON.stringify({
      model,
      ok: false,
      ms: Date.now() - started,
      status: err?.status ?? null,
      name: err?.name ?? null,
      message: String(err?.message || '').slice(0, 200),
    }));
  } finally {
    clearTimeout(timer);
  }
}
