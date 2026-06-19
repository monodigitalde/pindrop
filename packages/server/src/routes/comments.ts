import { Hono } from 'hono';
import type { CommentStore, NewComment } from '../db.js';

interface Env {
  Variables: { store: CommentStore };
}

function clamp(n: unknown, max: number): number | null {
  if (typeof n !== 'number' || Number.isNaN(n) || !Number.isFinite(n)) return null;
  return Math.min(max, Math.max(0, n));
}

function validate(body: unknown): { value: NewComment } | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Invalid JSON body' };
  const b = body as Record<string, unknown>;

  const url = typeof b.url === 'string' ? b.url.trim() : '';
  if (!url || url.length > 2048) return { error: 'Field "url" is required' };

  const x = clamp(b.x, 100);
  const y = clamp(b.y, 100);
  if (x === null || y === null) return { error: 'Fields "x" and "y" must be numbers (0-100)' };

  const author = typeof b.author === 'string' ? b.author.trim() : '';
  if (!author) return { error: 'Field "author" is required' };
  if (author.length > 80) return { error: 'Field "author" is too long (max 80)' };

  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (!text) return { error: 'Field "text" is required' };
  if (text.length > 2000) return { error: 'Field "text" is too long (max 2000)' };

  // Optional element anchor for responsive-stable positioning.
  const selector =
    typeof b.selector === 'string' && b.selector.length <= 1024 ? b.selector : null;
  const relX = clamp(b.relX, 1);
  const relY = clamp(b.relY, 1);

  return { value: { url, x, y, selector, relX, relY, author, text } };
}

export function commentsRoute() {
  const route = new Hono<Env>();

  // GET /comments?url=<encoded-url>
  route.get('/comments', (c) => {
    const url = c.req.query('url');
    if (!url) return c.json({ error: 'Query param "url" is required' }, 400);
    return c.json(c.get('store').listByUrl(url));
  });

  // POST /comments
  route.post('/comments', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    const result = validate(body);
    if ('error' in result) return c.json({ error: result.error }, 400);
    return c.json(c.get('store').create(result.value), 201);
  });

  // POST /comments/:id/replies
  route.post('/comments/:id/replies', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    const b = (typeof body === 'object' && body ? body : {}) as Record<string, unknown>;
    const author = typeof b.author === 'string' ? b.author.trim() : '';
    if (!author) return c.json({ error: 'Field "author" is required' }, 400);
    if (author.length > 80) return c.json({ error: 'Field "author" is too long (max 80)' }, 400);
    const text = typeof b.text === 'string' ? b.text.trim() : '';
    if (!text) return c.json({ error: 'Field "text" is required' }, 400);
    if (text.length > 2000) return c.json({ error: 'Field "text" is too long (max 2000)' }, 400);

    const reply = c.get('store').addReply(c.req.param('id'), author, text);
    if (!reply) return c.json({ error: 'Not found' }, 404);
    return c.json(reply, 201);
  });

  // DELETE /comments/:id
  route.delete('/comments/:id', (c) => {
    const ok = c.get('store').remove(c.req.param('id'));
    if (!ok) return c.json({ error: 'Not found' }, 404);
    return c.body(null, 204);
  });

  return route;
}
