'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadAiConfig, loadConfig } = require('../config');
const { runAiCheck } = require('../scripts/ai-check');

const isolated = { AI_API_KEY: 'test-only-not-a-real-key', ANTHROPIC_API_KEY: '', AI_PROVIDER: 'openai',
  AI_BASE_URL: 'http://127.0.0.1:9901', AI_MODEL: '', AI_MODEL_FAST: 'test-fast', AI_MODEL_SMART: 'test-smart',
  MONGODB_URI: '', MONGODB_DB_NAME: 'invalid', SMTP_PORT: 'invalid', CORS_ORIGINS: 'invalid' };

test('AI configuration loads without a database or unrelated server settings', () => {
  const ai = loadAiConfig(isolated);
  assert.equal(ai.apiKey, isolated.AI_API_KEY);
  assert.equal(ai.provider, 'openai');
  assert.equal(ai.fast, 'test-fast');
  assert.equal(ai.smart, 'test-smart');
  assert.equal(Object.hasOwn(ai, 'uri'), false);
  assert.throws(() => loadConfig(isolated), /MONGODB_URI/);
});

test('explicit environment overrides file AI settings and preserves the legacy key alias', () => {
  const ai = loadAiConfig({ ...isolated, AI_API_KEY: '', ANTHROPIC_API_KEY: 'sk-ant-test-only',
    AI_PROVIDER: 'anthropic', AI_MODEL_FAST: 'fixture-fast', AI_MODEL_SMART: 'fixture-smart' });
  assert.equal(ai.apiKey, 'sk-ant-test-only');
  assert.equal(ai.provider, 'anthropic');
  assert.equal(loadAiConfig({ ...isolated, AI_API_KEY: '', ANTHROPIC_API_KEY: '' }).apiKey, '');
});

test('missing AI credentials return a clear nonzero diagnostic without contacting a provider', async () => {
  const lines = [];
  const status = await runAiCheck({ ai: { apiKey: '' }, log: line => lines.push(line),
    completeImpl: async () => { assert.fail('Provider must not be called without credentials.'); } });
  assert.equal(status, 1);
  assert.match(lines.join('\n'), /AI_API_KEY/);
  assert.doesNotMatch(lines.join('\n'), /MONGODB_URI/);
});

test('diagnostic probes both configured models and reports success', async () => {
  const calls = [], lines = [];
  const status = await runAiCheck({ ai: loadAiConfig(isolated), log: line => lines.push(line),
    completeImpl: async (ai, request) => { calls.push(request); return { ok: true }; } });
  assert.equal(status, 0);
  assert.deepEqual(calls.map(c => c.smart), [false, true]);
  assert.ok(calls.every(c => c.json && c.messages.length === 1));
  assert.equal(lines.filter(line => line.startsWith('OK ')).length, 2);
  assert.equal(lines.join('\n').includes(isolated.AI_API_KEY), false);
});

test('provider failures and invalid probes fail without exposing credentials', async () => {
  const lines = [];
  const ai = loadAiConfig(isolated);
  const status = await runAiCheck({ ai, log: line => lines.push(line),
    completeImpl: async (config, request) => {
      if (!request.smart) throw new Error(`Provider refused key ${ai.apiKey}`);
      return { wrong: true };
    } });
  assert.equal(status, 1);
  assert.equal(lines.filter(line => line.startsWith('LỖI ')).length, 2);
  assert.equal(lines.join('\n').includes(ai.apiKey), false);
});
