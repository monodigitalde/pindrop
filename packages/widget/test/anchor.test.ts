import { afterEach, describe, expect, it } from 'vitest';
import { buildAnchor, resolvePosition } from '../src/anchor';
import type { Comment } from '../src/types';

const base: Comment = {
  id: '1', url: 'u', x: 50, y: 50, selector: null, relX: null, relY: null,
  author: 'A', text: 't', created_at: new Date().toISOString(),
};

afterEach(() => {
  document.body.innerHTML = '';
  // @ts-expect-error reset optional API between tests
  delete document.elementFromPoint;
});

describe('resolvePosition', () => {
  it('falls back to document percentages without a selector', () => {
    const pos = resolvePosition(base, { w: 1000, h: 2000 });
    expect(pos).toEqual({ px: 500, py: 1000 });
  });

  it('uses the anchored element rect + fractional offset when available', () => {
    const el = document.createElement('div');
    el.id = 'target';
    document.body.appendChild(el);
    el.getBoundingClientRect = () =>
      ({ left: 100, top: 200, width: 400, height: 100 }) as DOMRect;

    const c = { ...base, selector: '#target', relX: 0.5, relY: 0.25 };
    const pos = resolvePosition(c, { w: 1000, h: 2000 });
    // left + relX*width = 100 + 200 = 300 ; top + relY*height = 200 + 25 = 225
    expect(pos).toEqual({ px: 300, py: 225 });
  });

  it('falls back when the selector no longer resolves', () => {
    const c = { ...base, selector: '#gone', relX: 0.5, relY: 0.5 };
    expect(resolvePosition(c, { w: 1000, h: 2000 })).toEqual({ px: 500, py: 1000 });
  });

  it('does not throw on an invalid selector', () => {
    const c = { ...base, selector: '>>bad' };
    expect(() => resolvePosition(c, { w: 100, h: 100 })).not.toThrow();
  });
});

describe('buildAnchor', () => {
  it('returns a percentage fallback when elementFromPoint is unavailable', () => {
    const a = buildAnchor(10, 20);
    expect(a.selector).toBeNull();
    expect(typeof a.x).toBe('number');
    expect(typeof a.y).toBe('number');
  });

  it('builds a selector + offset for the element under the point', () => {
    const el = document.createElement('section');
    el.id = 'hero';
    document.body.appendChild(el);
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;
    // @ts-expect-error stub the layout API jsdom lacks
    document.elementFromPoint = () => el;

    const a = buildAnchor(50, 25);
    expect(a.selector).toBe('#hero');
    expect(a.relX).toBeCloseTo(0.25);
    expect(a.relY).toBeCloseTo(0.25);
  });
});
