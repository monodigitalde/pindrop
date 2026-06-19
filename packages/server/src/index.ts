import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openStore } from './db.js';

const config = loadConfig();
const store = openStore(config.dbPath);
const app = createApp({ config, store });

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(
    `[pindrop] listening on :${info.port}` +
      `  base=${config.basePath}  enabled=${config.enabled}  db=${config.dbPath}`,
  );
});

function shutdown(signal: string) {
  console.log(`[pindrop] ${signal} received, shutting down`);
  server.close(() => {
    store.close();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
