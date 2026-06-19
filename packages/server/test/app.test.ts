import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openStore, type CommentStore } from '../src/db.js';
import type { Hono } from 'hono';

let store: CommentStore;
let app: Hono;

function buildApp(env: Record<string, string> = {}) {
  const config = loadConfig({ DB_PATH: ':memory:', ...env } as NodeJS.ProcessEnv);
  store = openStore(':memory:');
  return createApp({ config, store, widgetBundle: 'console.log("widget")' });
}

beforeEach(() => {
  app = buildApp();
});
afterEach(() => store.close());

const post = (body: unknown) =>
  app.request('/pindrop/api/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const valid = { url: 'https://x.test/p', x: 10, y: 20, author: 'Kim', text: 'hi' };

describe('GET /pindrop/api/comments', () => {
  it('requires a url query param', async () => {
    const res = await app.request('/pindrop/api/comments');
    expect(res.status).toBe(400);
  });

  it('returns comments for a url', async () => {
    await post(valid);
    const res = await app.request(`/pindrop/api/comments?url=${encodeURIComponent(valid.url)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ author: 'Kim', text: 'hi' });
  });
});

describe('POST /pindrop/api/comments', () => {
  it('creates a comment and returns 201', async () => {
    const res = await post(valid);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
  });

  it('rejects missing fields', async () => {
    expect((await post({ url: 'u', x: 1, y: 2, author: '', text: 'x' })).status).toBe(400);
    expect((await post({ url: 'u', x: 1, y: 2, author: 'A', text: '' })).status).toBe(400);
    expect((await post({ x: 1, y: 2, author: 'A', text: 'x' })).status).toBe(400);
  });

  it('clamps out-of-range coordinates', async () => {
    const res = await post({ ...valid, x: 150, y: -10 });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.x).toBe(100);
    expect(body.y).toBe(0);
  });

  it('round-trips the element anchor (selector + relX/relY)', async () => {
    const res = await post({ ...valid, selector: '#hero > h1', relX: 0.5, relY: 0.25 });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toMatchObject({ selector: '#hero > h1', relX: 0.5, relY: 0.25 });

    const list = await (
      await app.request(`/pindrop/api/comments?url=${encodeURIComponent(valid.url)}`)
    ).json();
    expect(list[0]).toMatchObject({ selector: '#hero > h1', relX: 0.5, relY: 0.25 });
  });

  it('clamps relX/relY to 0-1 and nulls a missing anchor', async () => {
    const created = await (await post({ ...valid, relX: 5, relY: -2 })).json();
    expect(created.relX).toBe(1);
    expect(created.relY).toBe(0);
    expect(created.selector).toBeNull();
  });

  it('rejects invalid JSON', async () => {
    const res = await app.request('/pindrop/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /pindrop/api/comments/:id/replies', () => {
  it('adds a reply and nests it under the comment', async () => {
    const created = await (await post(valid)).json();
    const res = await app.request(`/pindrop/api/comments/${created.id}/replies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ author: 'Ann', text: 'good catch' }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ author: 'Ann', text: 'good catch' });

    const list = await (
      await app.request(`/pindrop/api/comments?url=${encodeURIComponent(valid.url)}`)
    ).json();
    expect(list[0].replies).toHaveLength(1);
    expect(list[0].replies[0]).toMatchObject({ author: 'Ann', text: 'good catch' });
  });

  it('rejects an empty reply', async () => {
    const created = await (await post(valid)).json();
    const res = await app.request(`/pindrop/api/comments/${created.id}/replies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ author: 'Ann', text: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 replying to an unknown comment', async () => {
    const res = await app.request('/pindrop/api/comments/nope/replies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ author: 'Ann', text: 'hi' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /pindrop/api/comments/:id', () => {
  it('deletes an existing comment', async () => {
    const created = await (await post(valid)).json();
    const res = await app.request(`/pindrop/api/comments/${created.id}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await app.request('/pindrop/api/comments/nope', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

describe('widget bundle serving', () => {
  it('serves the bundle with a JS content-type', async () => {
    const res = await app.request('/pindrop/widget.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
    expect(await res.text()).toContain('widget');
  });

  it('serves an empty bundle when disabled', async () => {
    const disabled = buildApp({ ENABLED: 'false' });
    const res = await disabled.request('/pindrop/widget.js');
    expect(await res.text()).toContain('disabled');
  });
});

describe('health', () => {
  it('responds at the base health endpoint', async () => {
    const res = await app.request('/pindrop/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });
});
