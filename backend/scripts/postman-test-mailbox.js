'use strict';

// Test infrastructure only: never imported by app.js/server.js or used with Atlas.
// A separate, authenticated loopback listener exposes disposable test mail to Postman.
const http = require('node:http');
const { once } = require('node:events');
const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');

async function startTestMailbox() {
  const messages = new Map();
  const key = randomBytes(32).toString('base64url');
  const digest = value => createHash('sha256').update(value).digest();
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (!timingSafeEqual(digest(req.headers['x-test-mailbox-key'] || ''), digest(key))) {
      res.writeHead(401); res.end('{}'); return;
    }
    const url = new URL(req.url, 'http://127.0.0.1');
    const message = messages.get(url.searchParams.get('email'));
    if (req.method !== 'GET' || url.pathname !== '/messages' || !message || message.expires <= Date.now()) {
      res.writeHead(404); res.end('{}'); return;
    }
    res.end(JSON.stringify({ code: /\b(\d{6})\b/.exec(message.text)[1] }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${server.address().port}`, key,
    mailer: { configured: true, smtp: true, async send(message) {
      if (!message.to.endsWith('@fitlife.example')) throw new Error('Test mailbox accepts only fixture addresses.');
      for (const [email, row] of messages) if (row.expires <= Date.now()) messages.delete(email);
      if (messages.size >= 100) throw new Error('Test mailbox is full.');
      messages.set(message.to, { text: message.text, expires: Date.now() + 600000 });
    } },
    async close() { messages.clear(); await new Promise(resolve => server.close(resolve)); },
  };
}

module.exports = { startTestMailbox };
