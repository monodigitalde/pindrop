/** Normalizes a page URL to a stable key: origin + pathname, no query/hash. */
export function pageKey(loc: Location = window.location): string {
  return `${loc.origin}${loc.pathname}`.replace(/\/$/, '') || loc.origin;
}

/** Human-friendly relative time. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const sec = Math.round(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Deterministic accent color for an author name (for pin/avatar tinting). */
export function colorFor(name: string): string {
  // Muted, professional tones that still read distinctly per author — no violet.
  const palette = [
    '#475569', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444',
    '#10b981', '#3b82f6', '#64748b', '#0891b2', '#d97706',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

/** Initials for an avatar, max two characters. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
