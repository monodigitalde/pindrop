import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore, type CommentStore } from '../src/db.js';

let store: CommentStore;

beforeEach(() => {
  store = openStore(':memory:');
});
afterEach(() => store.close());

const sample = { url: 'https://x.test/a', x: 12.5, y: 80, author: 'Kim', text: 'fix this' };

describe('migration', () => {
  it('upgrades a pre-replies database and supports replies', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fw-mig-'));
    const path = join(dir, 'old.sqlite');
    try {
      // Simulate an older DB without the anchor/parent columns.
      const legacy = new Database(path);
      legacy.exec(`CREATE TABLE comments (
        id TEXT PRIMARY KEY, url TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL,
        author TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL
      );`);
      legacy
        .prepare('INSERT INTO comments VALUES (?,?,?,?,?,?,?)')
        .run('old1', sample.url, 1, 2, 'Kim', 'legacy comment', new Date().toISOString());
      legacy.close();

      const migrated = openStore(path);
      const list = migrated.listByUrl(sample.url);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ text: 'legacy comment', replies: [] });

      const reply = migrated.addReply('old1', 'Ann', 'works after migration');
      expect(reply).not.toBeNull();
      expect(migrated.listByUrl(sample.url)[0].replies[0].text).toBe('works after migration');
      migrated.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('CommentStore', () => {
  it('creates a comment with an id and timestamp', () => {
    const c = store.create(sample);
    expect(c.id).toMatch(/[0-9a-f-]{36}/);
    expect(c.created_at).toMatch(/\dT\d/);
    expect(c).toMatchObject(sample);
  });

  it('lists comments only for the matching url', () => {
    store.create(sample);
    store.create({ ...sample, text: 'second' });
    store.create({ ...sample, url: 'https://x.test/other', text: 'elsewhere' });

    const list = store.listByUrl('https://x.test/a');
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.text)).toEqual(['fix this', 'second']);
  });

  it('removes a comment and reports success', () => {
    const c = store.create(sample);
    expect(store.remove(c.id)).toBe(true);
    expect(store.listByUrl(sample.url)).toHaveLength(0);
  });

  it('returns false when removing an unknown id', () => {
    expect(store.remove('does-not-exist')).toBe(false);
  });

  it('nests replies under their parent comment', () => {
    const c = store.create(sample);
    store.addReply(c.id, 'Ann', 'first reply');
    store.addReply(c.id, 'Bob', 'second reply');

    const list = store.listByUrl(sample.url);
    expect(list).toHaveLength(1); // replies are not top-level
    expect(list[0].replies.map((r) => r.text)).toEqual(['first reply', 'second reply']);
  });

  it('returns null when replying to a missing comment', () => {
    expect(store.addReply('nope', 'Ann', 'x')).toBeNull();
  });

  it('does not allow replying to a reply', () => {
    const c = store.create(sample);
    const r = store.addReply(c.id, 'Ann', 'reply')!;
    expect(store.addReply(r.id, 'Bob', 'nested')).toBeNull();
  });

  it('deletes replies along with their parent comment', () => {
    const c = store.create(sample);
    store.addReply(c.id, 'Ann', 'reply');
    expect(store.remove(c.id)).toBe(true);
    expect(store.listByUrl(sample.url)).toHaveLength(0);
  });
});
