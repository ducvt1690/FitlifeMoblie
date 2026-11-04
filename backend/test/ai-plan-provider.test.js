'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { generatePlan, generateWithProvider } = require('../services/ai-plan.provider');
const { PROMPTS, SCHEMAS } = require('../services/ai-prompts');
const { preferencesOf } = require('../services/ai-plan.validation');

const context = {
  input: { gender: 'female', age: 26, height: 160, weight: 52, activity_level: 'light',
    goal: 'maintain', target_calories: 1690, target_water: 1820, bmi: 20.31 },
  preferences: preferencesOf(), exercises: [],
};
const fallback = { calories: 1690, protein_g: 100, carbs_g: 232.5, fat_g: 40, water_ml: 1820,
  tips: ['Ăn đủ bữa.', 'Chia đạm đều.', 'Ăn rau xanh.', 'Uống đủ nước.', 'Theo dõi khẩu phần.'], avoid: [] };
const args = provider => ({ provider, system: PROMPTS.nutrition,
  prompt: { metrics: context.input, preferences: context.preferences }, schema: SCHEMAS.nutrition,
  signal: new AbortController().signal });

test('Gemini request uses backend header credentials and a structured JSON response schema', async t => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent = { url, ...options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [
      { thought: true, text: 'internal reasoning must not be parsed' }, { text: JSON.stringify(fallback) },
    ] } }] }) };
  });
  const result = await generateWithProvider({ geminiKey: 'test-gemini-not-a-real-key', model: 'gemini-2.5-flash' }, args('gemini'));
  assert.deepEqual(JSON.parse(result), fallback);
  assert.equal(sent.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
  assert.ok(!sent.url.includes('key='));
  assert.equal(sent.headers['x-goog-api-key'], 'test-gemini-not-a-real-key');
  assert.equal(sent.method, 'POST');
  assert.deepEqual(JSON.parse(sent.body.contents[0].parts[0].text), args('gemini').prompt);
  assert.equal(sent.body.systemInstruction.parts[0].text, PROMPTS.nutrition);
  assert.equal(sent.body.generationConfig.maxOutputTokens, 2000);
  assert.equal(sent.body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(sent.body.generationConfig.responseJsonSchema, SCHEMAS.nutrition);
  assert.ok(!JSON.stringify(sent.body).includes('test-gemini-not-a-real-key'));
});

test('Groq request uses strict JSON schema with the specified backup model', async t => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent = { url, ...options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(fallback) } }] }) };
  });
  assert.deepEqual(JSON.parse(await generateWithProvider({ groqKey: 'test-groq-not-a-real-key' }, args('groq'))), fallback);
  assert.equal(sent.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(sent.headers.Authorization, 'Bearer test-groq-not-a-real-key');
  assert.equal(sent.body.model, 'openai/gpt-oss-120b');
  assert.equal(sent.body.max_completion_tokens, 2000);
  assert.equal(sent.body.response_format.type, 'json_schema');
  assert.equal(sent.body.response_format.json_schema.strict, true);
  assert.deepEqual(sent.body.response_format.json_schema.schema, SCHEMAS.nutrition);
  assert.deepEqual(JSON.parse(sent.body.messages[1].content), args('groq').prompt);
  assert.ok(!JSON.stringify(sent.body).includes('test-groq-not-a-real-key'));
});

test('Gemini defaults to the verified Flash model and omits obsolete thinkingBudget for newer models', async t => {
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP',
      content: { parts: [{ text: JSON.stringify(fallback) }] } }] }) };
  });
  await generateWithProvider({ geminiKey: 'test-key' }, args('gemini'));
  assert.equal(sent[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(sent[0].body.generationConfig.thinkingConfig, undefined);
  await generateWithProvider({ geminiKey: 'test-key', model: 'gemini-2.5-flash' }, args('gemini'));
  assert.deepEqual(sent[1].body.generationConfig.thinkingConfig, { thinkingBudget: 0 });
  assert.equal(sent[0].body.generationConfig.maxOutputTokens, 2000);
  assert.deepEqual(sent[0].body.generationConfig.responseJsonSchema, SCHEMAS.nutrition);
});

test('provider HTTP errors and truncated responses are rejected without exposing credentials or raw error bodies', async t => {
  let response;
  t.mock.method(globalThis, 'fetch', async () => response);
  response = { ok: false, status: 429, json: async () => ({ error: 'secret-provider-detail' }) };
  await assert.rejects(generateWithProvider({ geminiKey: 'test-key' }, args('gemini')), error =>
    !/test-key|secret-provider-detail/.test(error.message));
  response = { ok: true, json: async () => ({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }] }) };
  await assert.rejects(generateWithProvider({}, args('gemini')), /incomplete/);
  response = { ok: true, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }) };
  await assert.rejects(generateWithProvider({}, args('groq')), /incomplete/);
});

test('even an uncooperative generator times out within the shared budget and all pending attempts are aborted', async t => {
  const now = Date.now();
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now });
  const calls = [];
  const result = generatePlan({ groqKey: 'test-groq-not-a-real-key', generate: async request => {
    calls.push(request);
    return new Promise(() => {});
  } }, 'nutrition', context, fallback);
  // setImmediate only flushes promise continuations; no wall-clock wait or network is involved.
  await new Promise(setImmediate);
  for (let i = 0; i < 4; i++) {
    t.mock.timers.tick(12500);
    await new Promise(setImmediate);
  }
  assert.deepEqual(await result, { result: fallback, source: 'fitlife-rules' });
  assert.deepEqual(calls.map(call => call.provider), ['gemini', 'gemini', 'groq', 'groq']);
  assert.ok(calls.every(call => call.signal.aborted));
  assert.equal(Date.now() - now, 50000);
});
