'use strict';
// Explicit diagnostics only: importing this module never calls a provider.
const { loadAiConfig } = require('../config');
const { complete } = require('../services/ai.client');

async function runAiCheck({ ai = loadAiConfig(), log = console.log, completeImpl = complete } = {}) {
  if (!ai.apiKey) {
    log('Chưa có key. Thêm AI_API_KEY vào backend/.env rồi chạy lại.');
    return 1;
  }
  log(`Nhà cung cấp: ${ai.provider} · model nhanh: ${ai.fast} · model chính: ${ai.smart}`);
  let status = 0;
  for (const smart of [false, true]) {
    const started = Date.now();
    try {
      const out = await completeImpl(ai, { smart, json: true, maxTokens: 100, system: 'Return the requested JSON connectivity probe.',
        messages: [{ role: 'user', content: 'Return {"ok": true}.' }] });
      if (out?.ok !== true) throw new Error('Invalid probe response');
      log(`OK ${smart ? ai.smart : ai.fast} (${Date.now() - started} ms)`);
    } catch {
      // Provider error text may echo credentials; do not include it.
      log(`LỖI ${smart ? ai.smart : ai.fast}: kiểm tra thất bại. Kiểm tra key, model và kết nối nhà cung cấp.`);
      status = 1;
    }
  }
  return status;
}
if (require.main === module) runAiCheck().then(status => { process.exitCode = status; }).catch(() => { console.error('AI check failed.'); process.exitCode = 1; });
module.exports = { runAiCheck };
