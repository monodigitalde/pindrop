import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Locates the built widget.js bundle. Checks an explicit env override first,
 * then the in-repo build output, then a co-located copy (Docker layout).
 */
export function loadWidgetBundle(): string {
  const candidates = [
    process.env.WIDGET_JS_PATH,
    resolve(here, '../../widget/dist/widget.js'), // monorepo: server/dist -> widget/dist
    resolve(here, './widget.js'), // docker: copied next to server bundle
    resolve(here, '../widget/widget.js'),
  ].filter(Boolean) as string[];

  for (const path of candidates) {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      /* try next */
    }
  }
  console.warn(
    '[pindrop] widget.js bundle not found. Build packages/widget or set WIDGET_JS_PATH.',
  );
  return '/* pindrop: bundle not found */';
}

/** The no-op script served when the widget is disabled via ENABLED=false. */
export const DISABLED_BUNDLE = '/* pindrop disabled */';
