import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApi } from '../src/api';

function mockFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(impl);
  vi.stubGlobal('fetch', spy);
  return spy;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('createApi', () => {
  it('lists comments with an encoded url query', async () => {
    const fetchSpy = mockFetch(() => json([{ id: '1' }]));
    const api = createApi('/pindrop/api');
    const out = await api.list('https://x.test/page?a=b');
    expect(out).toEqual([{ id: '1' }]);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/pindrop/api/comments?url=https%3A%2F%2Fx.test%2Fpage%3Fa%3Db',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('strips a trailing slash from the base', async () => {
    const fetchSpy = mockFetch(() => json([]));
    await createApi('/pindrop/api/').list('u');
    expect(fetchSpy.mock.calls[0][0]).toBe('/pindrop/api/comments?url=u');
  });

  it('posts a new comment as JSON', async () => {
    const fetchSpy = mockFetch(() => json({ id: 'new' }, 201));
    const api = createApi('/pindrop/api');
    const created = await api.create({ url: 'u', x: 10, y: 20, author: 'A', text: 'hi' });
    expect(created).toEqual({ id: 'new' });
    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toMatchObject({ author: 'A', text: 'hi' });
  });

  it('issues a DELETE and tolerates 204', async () => {
    const fetchSpy = mockFetch(() => new Response(null, { status: 204 }));
    await createApi('/pindrop/api').remove('abc');
    expect(fetchSpy.mock.calls[0][0]).toBe('/pindrop/api/comments/abc');
    expect(fetchSpy.mock.calls[0][1]?.method).toBe('DELETE');
  });

  it('throws with the server error message on failure', async () => {
    mockFetch(() => json({ error: 'nope' }, 400));
    await expect(createApi('/pindrop/api').list('u')).rejects.toThrow('nope');
  });
});
