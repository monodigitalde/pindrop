import type { Comment, NewComment, Reply } from './types';

export interface Api {
  list(url: string): Promise<Comment[]>;
  create(input: NewComment): Promise<Comment>;
  reply(id: string, input: { author: string; text: string }): Promise<Reply>;
  remove(id: string): Promise<void>;
}

/**
 * Creates a thin fetch wrapper bound to the feedback API base URL
 * (e.g. "/pindrop/api"). All endpoints live under that prefix.
 */
export function createApi(base: string): Api {
  const root = base.replace(/\/$/, '');

  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${root}${path}`, {
      headers: { 'content-type': 'application/json' },
      ...init,
    });
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.json())?.error ?? '';
      } catch {
        /* ignore non-JSON bodies */
      }
      throw new Error(detail || `Request failed (${res.status})`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    list(url) {
      return req<Comment[]>(`/comments?url=${encodeURIComponent(url)}`);
    },
    create(input) {
      return req<Comment>('/comments', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    reply(id, input) {
      return req<Reply>(`/comments/${encodeURIComponent(id)}/replies`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    async remove(id) {
      await req<void>(`/comments/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  };
}
