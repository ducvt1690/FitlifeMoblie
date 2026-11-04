'use strict';

const { PROMPTS, SCHEMAS } = require('./ai-prompts');
const { validateResult } = require('./ai-plan.validation');
const MAX_OUTPUT_TOKENS = 2000;
const GENERATION_BUDGET_MS = 50000;

// Keys enter only through config.js -> createApp. Never put a key in a URL or error.
async function generateWithProvider(config, { provider, system, prompt, schema, signal }) {
  const gemini = provider === 'gemini';
  const model = config.model || 'gemini-3.5-flash-lite';
  const url = gemini
    ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    : 'https://api.groq.com/openai/v1/chat/completions';
  const body = gemini ? {
    systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify(prompt) }] }],
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, maxOutputTokens: MAX_OUTPUT_TOKENS,
      ...(/^gemini-2\.5-/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
  } : {
    model: 'openai/gpt-oss-120b', messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(prompt) }],
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    response_format: { type: 'json_schema', json_schema: { name: 'fitlife_plan', strict: true, schema } },
  };
  const response = await fetch(url, { method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', ...(gemini ? { 'x-goog-api-key': config.geminiKey }
      : { Authorization: `Bearer ${config.groqKey}` }) }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error('AI provider unavailable');
  const data = await response.json();
  if (gemini) {
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') throw new Error('AI output incomplete');
    return candidate.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('');
  }
  if (data.choices?.[0]?.finish_reason !== 'stop') throw new Error('AI output incomplete');
  return data.choices[0].message?.content;
}

async function generatePlan(config, kind, context, fallback) {
  const providers = [];
  // A generator supplied by tests works without real credentials and never calls the network.
  if (config.geminiKey || config.generate) providers.push('gemini');
  if (config.groqKey) providers.push('groq');
  const generate = config.generate || (args => generateWithProvider(config, args));
  const deadline = Date.now() + GENERATION_BUDGET_MS;
  let attemptsLeft = providers.length * 2;
  const prompt = { metrics: context.input, preferences: context.preferences,
    ...(kind === 'workout_week' ? { exercises: context.exercises.map(e => ({
      exercise_id: e.exercise_id, name_vi: e.name_vi || e.name, body_parts: e.body_parts,
    })) } : {}) };
  for (const provider of providers) {
    for (let attempt = 0; attempt < 2; attempt++) {
      // Share a 50s budget across retries/providers; every individual call is <=25s.
      const timeoutMs = Math.min(25000, Math.floor((deadline - Date.now()) / attemptsLeft--));
      if (timeoutMs <= 0) return { result: fallback, source: 'fitlife-rules' };
      const controller = new AbortController();
      let timer;
      try {
        const timeout = new Promise((_, reject) => { timer = setTimeout(() => {
          controller.abort(); reject(new Error('AI timeout'));
        }, timeoutMs); });
        const raw = await Promise.race([Promise.resolve().then(() => generate({ provider, kind, system: PROMPTS[kind],
          prompt, schema: SCHEMAS[kind], maxOutputTokens: MAX_OUTPUT_TOKENS, signal: controller.signal })), timeout]);
        return { result: validateResult(kind, raw, context), source: provider };
      } catch {
        // Malformed JSON, provider errors and timeouts all follow the same bounded fallback path.
      } finally { clearTimeout(timer); }
    }
  }
  return { result: fallback, source: 'fitlife-rules' };
}

module.exports = { generatePlan, generateWithProvider };
