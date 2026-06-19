import type { Comment } from './types';

export interface Anchor {
  /** CSS selector path to the anchored element (best effort). */
  selector: string | null;
  /** Click offset within that element, as a fraction of its box (0-1). */
  relX: number | null;
  relY: number | null;
  /** Fallback position as % of the document (used when the selector fails). */
  x: number;
  y: number;
}

const HOST_ID = 'pindrop-root';

/** Largest of client/scroll dimensions so the pin layer covers all content. */
export function getDocSize(): { w: number; h: number } {
  const d = document.documentElement;
  const b = document.body;
  return {
    w: Math.max(d.scrollWidth, d.clientWidth, b?.scrollWidth ?? 0),
    h: Math.max(d.scrollHeight, d.clientHeight, b?.scrollHeight ?? 0),
  };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const finite = (n: number) => (Number.isFinite(n) ? n : 0);

/** CSS.escape with a fallback for environments that lack it (e.g. jsdom). */
function escapeId(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(id);
  return id.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

/**
 * Builds a stable CSS selector for an element: stops at the first ancestor with
 * an id, otherwise uses tag + :nth-of-type up the tree. Bounded in length.
 */
function cssPath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && node !== document.documentElement && parts.length < 6) {
    if (node.id) {
      parts.unshift(`#${escapeId(node.id)}`);
      break;
    }
    let sel = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      if (sameTag.length > 1) {
        sel += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }
    }
    parts.unshift(sel);
    node = node.parentElement;
  }
  return parts.join(' > ');
}

/**
 * Resolves the DOM element under a viewport point, ignoring the widget itself,
 * and derives an anchor: a selector + the click's fractional offset within the
 * element, plus a document-percentage fallback.
 */
export function buildAnchor(clientX: number, clientY: number): Anchor {
  const size = getDocSize();
  const fallback = {
    x: size.w > 0 ? +(((clientX + window.scrollX) / size.w) * 100).toFixed(3) : 0,
    y: size.h > 0 ? +(((clientY + window.scrollY) / size.h) * 100).toFixed(3) : 0,
  };

  if (typeof document.elementFromPoint !== 'function') {
    return { selector: null, relX: null, relY: null, ...fallback };
  }

  // Make our own overlay click-through so elementFromPoint hits the page.
  const host = document.getElementById(HOST_ID);
  const prev = host?.style.pointerEvents ?? '';
  if (host) host.style.pointerEvents = 'none';
  const el = document.elementFromPoint(clientX, clientY);
  if (host) host.style.pointerEvents = prev;

  if (!el || el === document.body || el === document.documentElement) {
    return { selector: null, relX: null, relY: null, ...fallback };
  }

  const rect = el.getBoundingClientRect();
  const relX = rect.width > 0 ? clamp01((clientX - rect.left) / rect.width) : 0.5;
  const relY = rect.height > 0 ? clamp01((clientY - rect.top) / rect.height) : 0.5;

  return { selector: cssPath(el), relX, relY, ...fallback };
}

/**
 * Computes the absolute document pixel position for a comment in the current
 * layout. Prefers the anchored element; falls back to document percentages.
 */
export function resolvePosition(c: Comment, size: { w: number; h: number }): { px: number; py: number } {
  if (c.selector) {
    try {
      const el = document.querySelector(c.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        return {
          px: finite(r.left + window.scrollX + (c.relX ?? 0.5) * r.width),
          py: finite(r.top + window.scrollY + (c.relY ?? 0.5) * r.height),
        };
      }
    } catch {
      /* invalid selector — fall through to percentage */
    }
  }
  return { px: finite((c.x / 100) * size.w), py: finite((c.y / 100) * size.h) };
}
