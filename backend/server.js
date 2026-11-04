'use strict';

const { loadConfig } = require('./config');
const { connectDatabase } = require('./database/connection');
const { createApp } = require('./app');

async function startServer() {
  const config = loadConfig();
  const { client, db } = await connectDatabase(config);
  const app = createApp({ db, sessionTtlSeconds: config.sessionTtlSeconds, corsOrigins: config.corsOrigins, ai: config.ai });
  let server;
  try {
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(config.port, () => resolve(listener));
      listener.once('error', reject);
    });
  } catch (error) {
    await client.close();
    throw error;
  }
  console.log(`FitLife API: http://localhost:${config.port}`);
  console.log(`MongoDB connected: ${config.databaseName}`);
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    server.closeIdleConnections();
    const timer = setTimeout(() => server.closeAllConnections(), 10000);
    timer.unref();
    await new Promise((resolve) => server.close(resolve));
    clearTimeout(timer);
    await client.close();
  }
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => { stop().catch(() => { process.exitCode = 1; }); });
  }
  return { app, server, client, db, stop };
}

if (require.main === module) {
  startServer().catch((error) => {
    // Never print the URI or raw driver errors at startup.
    console.error(`Cannot start FitLife API (${error.name || 'Error'}). Check MongoDB configuration, access and port.`);
    process.exitCode = 1;
  });
}

module.exports = { startServer };
