import { describe, expect, it } from 'vitest';
import { colorFor, initials, pageKey, timeAgo } from '../src/utils';

describe('pageKey', () => {
  it('strips query and hash, keeps origin + pathname', () => {
    const loc = { origin: 'https://x.test', pathname: '/staging/home' } as Location;
    expect(pageKey(loc)).toBe('https://x.test/staging/home');
  });

  it('drops a trailing slash', () => {
    const loc = { origin: 'https://x.test', pathname: '/page/' } as Location;
    expect(pageKey(loc)).toBe('https://x.test/page');
  });

  it('keeps the origin when pathname is root', () => {
    const loc = { origin: 'https://x.test', pathname: '/' } as Location;
    expect(pageKey(loc)).toBe('https://x.test');
  });
});

describe('timeAgo', () => {
  it('reports recent timestamps as "just now"', () => {
    expect(timeAgo(new Date().toISOString())).toBe('just now');
  });

  it('reports minutes', () => {
    const t = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(timeAgo(t)).toBe('5 min ago');
  });

  it('reports hours', () => {
    const t = new Date(Date.now() - 3 * 3_600_000).toISOString();
    expect(timeAgo(t)).toBe('3 hr ago');
  });

  it('returns empty string for invalid input', () => {
    expect(timeAgo('not-a-date')).toBe('');
  });
});

describe('initials', () => {
  it('uses two name parts', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
  });
  it('falls back to first two chars of a single name', () => {
    expect(initials('Ada')).toBe('AD');
  });
  it('handles empty input', () => {
    expect(initials('  ')).toBe('?');
  });
});

describe('colorFor', () => {
  it('is deterministic for the same name', () => {
    expect(colorFor('Ada')).toBe(colorFor('Ada'));
  });
  it('returns a hex color', () => {
    expect(colorFor('Grace')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
