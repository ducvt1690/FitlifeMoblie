'use strict';
// One small client for whichever AI key the team has. The provider is read from the key prefix unless AI_PROVIDER is set:
//   sk-ant-…  Anthropic (Claude)      AIza… / AQ.…  Google Gemini
//   sk-or-…   OpenRouter              gsk_…  Groq             xai-…  xAI
//   other sk-… OpenAI or any OpenAI-compatible API (set AI_BASE_URL)
const PROVIDERS = {
  anthropic: { fast: 'claude-haiku-4-5-20251001', smart: 'claude-sonnet-5' },
  gemini: { fast: 'gemini-3.5-flash-lite', smart: 'gemini-3.5-flash-lite' },
  openrouter: { base: 'https://openrouter.ai/api/v1', fast: 'openai/gpt-4o-mini', smart: 'openai/gpt-4o-mini' },
  groq: { base: 'https://api.groq.com/openai/v1', fast: 'llama-3.3-70b-versatile', smart: 'llama-3.3-70b-versatile' },
  xai: { base: 'https://api.x.ai/v1', fast: 'grok-3-mini', smart: 'grok-3-mini' },
  openai: { base: 'https://api.openai.com/v1', fast: 'gpt-4o-mini', smart: 'gpt-4o-mini' },
};

// Lowest thinking each Gemini family accepts (3.x Flash rejects 'minimal', only Lite allows it).
const geminiThinking = model => (/^gemini-2.5/.test(model) ? { thinkingBudget: 0 }
  : /^gemini-3/.test(model) ? { thinkingLevel: /lite/.test(model) ? 'minimal' : 'low' } : null);

function detectProvider(key) {
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('AIza') || key.startsWith('AQ.')) return 'gemini';
  if (key.startsWith('sk-or-')) return 'openrouter';
  if (key.startsWith('gsk_')) return 'groq';
  if (key.startsWith('xai-')) return 'xai';
  return 'openai';
}

function aiConfig(values) {
  const apiKey = (values.AI_API_KEY || values.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) return { apiKey: '' };
  const provider = PROVIDERS[values.AI_PROVIDER] ? values.AI_PROVIDER : detectProvider(apiKey);
  const preset = PROVIDERS[provider];
  const smart = values.AI_MODEL_SMART || values.AI_MODEL || preset.smart;
  return { apiKey, provider, baseUrl: (values.AI_BASE_URL || preset.base || '').replace(/\/+$/, ''),
    fast: values.AI_MODEL_FAST || values.AI_MODEL || preset.fast, smart, model: smart };
}

// One retry after a short pause when the provider is briefly overloaded (503) or busy (429).
async function post(url, headers, body, retry = true) {
  const response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  if (retry && (response.status === 503 || response.status === 429)) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return post(url, headers, body, false);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`AI HTTP ${response.status}: ${String(data.error?.message ?? data.error ?? '').slice(0, 200)}`);
  return data;
}

// messages: [{ role: 'user' | 'assistant', content }]. Returns plain text, or a parsed object when json is true.
async function complete(ai, { system, messages, json = false, smart = false, maxTokens = 800 }) {
  if (!ai?.apiKey) throw new Error('AI chưa được cấu hình.');
  const model = smart ? ai.smart : ai.fast;
  const sys = json ? `${system}\nChỉ trả về đúng một object JSON hợp lệ, không markdown, không giải thích.` : system;
  let text;
  if (ai.provider === 'anthropic') {
    const data = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': ai.apiKey, 'anthropic-version': '2023-06-01' },
      { model, max_tokens: maxTokens, system: sys, messages });
    text = data.content?.filter(p => p.type === 'text').map(p => p.text).join('\n');
  } else if (ai.provider === 'gemini') {
    const data = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { 'x-goog-api-key': ai.apiKey }, {
        systemInstruction: { parts: [{ text: sys }] },
        contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        // Gemini thinks by default and spends the output budget on it; these short tasks do not need it.
        generationConfig: { maxOutputTokens: maxTokens, ...(geminiThinking(model) ? { thinkingConfig: geminiThinking(model) } : {}), ...(json ? { responseMimeType: 'application/json' } : {}) },
      });
    text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('');
  } else {
    const data = await post(`${ai.baseUrl}/chat/completions`, { authorization: `Bearer ${ai.apiKey}` }, {
      model, max_tokens: maxTokens, messages: [{ role: 'system', content: sys }, ...messages],
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    });
    text = data.choices?.[0]?.message?.content;
  }
  text = (text ?? '').trim();
  if (!text) throw new Error('AI trả về rỗng.');
  if (!json) return text.slice(0, 32000);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return JSON.parse(text.slice(start, end + 1));
}

module.exports = { aiConfig, complete, detectProvider };
