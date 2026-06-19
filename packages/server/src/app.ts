import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Config } from './config.js';
import type { CommentStore } from './db.js';
import { commentsRoute } from './routes/comments.js';
import { DISABLED_BUNDLE, loadWidgetBundle } from './widget-asset.js';

export interface AppDeps {
  config: Config;
  store: CommentStore;
  /** Override for tests; defaults to the on-disk bundle. */
  widgetBundle?: string;
}

export function createApp({ config, store, widgetBundle }: AppDeps): Hono {
  const app = new Hono();
  const bundle = config.enabled ? (widgetBundle ?? loadWidgetBundle()) : DISABLED_BUNDLE;

  app.use(
    '*',
    cors({
      origin: config.allowedOrigins === '*' ? '*' : config.allowedOrigins,
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    }),
  );

  // Make the store available to route handlers.
  app.use('*', async (c, next) => {
    c.set('store', store);
    await next();
  });

  const base = new Hono();

  // Health check.
  base.get('/health', (c) => c.json({ ok: true, enabled: config.enabled }));

  // The self-mounting widget bundle.
  base.get('/widget.js', (c) => {
    c.header('Content-Type', 'application/javascript; charset=utf-8');
    c.header('Cache-Control', 'public, max-age=300');
    return c.body(bundle);
  });

  // JSON API.
  base.route('/api', commentsRoute());

  // Staging-style demo with two subpages, to verify per-page pins end-to-end.
  base.get('/demo', (c) => {
    c.header('Content-Type', 'text/html; charset=utf-8');
    return c.body(demoPage(config.basePath, 'home'));
  });
  base.get('/demo/about', (c) => {
    c.header('Content-Type', 'text/html; charset=utf-8');
    return c.body(demoPage(config.basePath, 'about'));
  });

  // Mount everything under the configured prefix (default: /feedback).
  app.route(config.basePath, base);

  // Root health for orchestrators that probe "/".
  app.get('/', (c) => c.json({ service: 'pindrop', enabled: config.enabled }));

  return app;
}

function demoPage(base: string, page: 'home' | 'about'): string {
  const nav = `
    <nav class="nav">
      <span class="brand">Acme</span>
      <div class="links">
        <a href="${base}/demo" class="${page === 'home' ? 'active' : ''}">Home</a>
        <a href="${base}/demo/about" class="${page === 'about' ? 'active' : ''}">About</a>
      </div>
    </nav>`;

  const home = `
    <header class="hero">
      <h1>Acme Staging</h1>
      <p>Click the feedback button on the right edge and leave a note anywhere on the page.</p>
    </header>
    <main class="wrap">
      <section class="card">
        <h2>Our Services</h2>
        <div class="grid">
          <div class="tile">Design</div>
          <div class="tile">Development</div>
          <div class="tile">Strategy</div>
        </div>
      </section>
      <section class="card">
        <h2>Test the per-page pins</h2>
        <p class="muted">Drop a pin here, then switch to <a href="${base}/demo/about">About</a> — that page keeps its own, separate set of pins. Come back and yours are still here.</p>
      </section>
    </main>`;

  const about = `
    <header class="hero">
      <h1>About Acme</h1>
      <p>A different subpage — its pins are tracked independently from Home.</p>
    </header>
    <main class="wrap">
      <section class="card">
        <h2>Our Team</h2>
        <div class="grid">
          <div class="tile alt">Ada</div>
          <div class="tile alt">Grace</div>
          <div class="tile alt">Alan</div>
        </div>
      </section>
      <section class="card">
        <h2>Different content, different pins</h2>
        <p class="muted">Pins you add here belong to <code>/demo/about</code>. Switch back to <a href="${base}/demo">Home</a> to confirm they don't leak across pages.</p>
      </section>
    </main>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pindrop · Demo · ${page === 'home' ? 'Home' : 'About'}</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; background: #fafafa; }
    .nav { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: 14px 24px; background: rgba(255,255,255,.85); backdrop-filter: blur(10px); border-bottom: 1px solid #eee; }
    .nav .brand { font-weight: 700; letter-spacing: -0.01em; }
    .nav .links { display: flex; gap: 8px; }
    .nav a { padding: 7px 14px; border-radius: 9px; text-decoration: none; color: #475569; font-weight: 500; font-size: 14px; transition: background .15s; }
    .nav a:hover { background: #f1f5f9; }
    .nav a.active { background: #0f172a; color: #fff; }
    .hero { padding: 72px 24px 56px; text-align: center; background: radial-gradient(1200px 500px at 50% -10%, #f1f5f9, transparent), #fff; border-bottom: 1px solid #eee; }
    .hero h1 { font-size: clamp(32px, 6vw, 52px); margin: 0 0 12px; letter-spacing: -0.02em; }
    .hero p { font-size: 18px; color: #64748b; max-width: 560px; margin: 0 auto; }
    .wrap { max-width: 880px; margin: 0 auto; padding: 56px 24px; }
    .card { background: #fff; border: 1px solid #eee; border-radius: 20px; padding: 32px; margin-bottom: 24px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
    .card h2 { margin-top: 0; letter-spacing: -0.01em; }
    .muted { color: #475569; line-height: 1.7; }
    .muted a { color: #0f172a; font-weight: 600; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 6px; font-size: 0.9em; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .tile { aspect-ratio: 4/3; border-radius: 16px; background: linear-gradient(135deg, #64748b, #334155); display: grid; place-items: center; color: #fff; font-weight: 600; }
    .tile:nth-child(2) { background: linear-gradient(135deg, #94a3b8, #475569); }
    .tile:nth-child(3) { background: linear-gradient(135deg, #475569, #1e293b); }
    .tile.alt { background: linear-gradient(135deg, #0ea5e9, #0369a1); }
    .tile.alt:nth-child(2) { background: linear-gradient(135deg, #14b8a6, #0f766e); }
    .tile.alt:nth-child(3) { background: linear-gradient(135deg, #f59e0b, #b45309); }
    footer { text-align: center; padding: 40px; color: #94a3b8; font-size: 14px; }
  </style>
</head>
<body>
  ${nav}
  ${page === 'home' ? home : about}
  <footer>Powered by Pindrop · ${base}${page === 'home' ? '/demo' : '/demo/about'}</footer>
  <script src="${base}/widget.js"></script>
</body>
</html>`;
}
