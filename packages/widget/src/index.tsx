import { render } from 'preact';
import { createApi } from './api';
import { styles } from './styles';
import { Widget } from './Widget';

const HOST_ID = 'pindrop-root';
const MOUNT_FLAG = '__pindropMounted';

declare global {
  interface Window {
    [MOUNT_FLAG]?: boolean;
    PINDROP_CONFIG?: { apiBase?: string };
  }
}

/**
 * Derives the API base from this script's own URL. The bundle is served at
 * `<prefix>/widget.js`, so the API lives at `<prefix>/api`. Falls back to a
 * relative "/pindrop/api" and honours an explicit window config override.
 */
function resolveApiBase(): string {
  const override = window.PINDROP_CONFIG?.apiBase;
  if (override) return override;

  const current =
    (document.currentScript as HTMLScriptElement | null)?.src ||
    [...document.querySelectorAll('script[src]')]
      .map((s) => (s as HTMLScriptElement).src)
      .find((src) => /\/widget\.js(\?|$)/.test(src));

  if (current) {
    try {
      const u = new URL(current);
      const prefix = u.pathname.replace(/\/widget\.js.*$/, '');
      return `${u.origin}${prefix}/api`;
    } catch {
      /* fall through */
    }
  }
  return '/pindrop/api';
}

function mount() {
  if (window[MOUNT_FLAG] || document.getElementById(HOST_ID)) return;
  if (!document.body) {
    window.addEventListener('DOMContentLoaded', mount, { once: true });
    return;
  }
  window[MOUNT_FLAG] = true;

  const host = document.createElement('div');
  host.id = HOST_ID;
  // Anchored to the document top-left so the absolute pin layer scrolls with content.
  host.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483000;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = styles;
  shadow.appendChild(style);

  const app = document.createElement('div');
  shadow.appendChild(app);

  render(<Widget api={createApi(resolveApiBase())} />, app);
}

mount();
