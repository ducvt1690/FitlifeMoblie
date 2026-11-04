'use strict';
// Checks the AI key in backend/.env without printing it: npm run ai:check
const { loadConfig } = require('../config');
const { complete } = require('../services/ai.client');

(async () => {
  const { ai } = loadConfig();
  if (!ai.apiKey) {
    console.log('Chưa có key. Thêm AI_API_KEY=... vào backend/.env rồi chạy lại.');
    process.exit(1);
  }
  console.log(`Nhà cung cấp: ${ai.provider} · model nhanh: ${ai.fast} · model chính: ${ai.smart}`);
  for (const smart of [false, true]) {
    const started = Date.now();
    try {
      const out = await complete(ai, { smart, json: true, maxTokens: 200, system: 'Bạn là chuyên gia dinh dưỡng.',
        messages: [{ role: 'user', content: 'Trả {"kcal": số kcal trong 100g ức gà luộc}' }] });
      console.log(`OK ${smart ? ai.smart : ai.fast} (${Date.now() - started} ms):`, JSON.stringify(out));
    } catch (error) {
      console.log(`LỖI ${smart ? ai.smart : ai.fast}: ${error.message}`);
      process.exitCode = 1;
    }
  }
})();
