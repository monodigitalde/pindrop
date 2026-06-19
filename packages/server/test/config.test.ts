import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const env = (o: Record<string, string | undefined>) => loadConfig(o as NodeJS.ProcessEnv);

describe('loadConfig', () => {
  it('uses sensible defaults', () => {
    const c = env({});
    expect(c).toMatchObject({
      enabled: true,
      port: 4878,
      dbPath: '/data/db.sqlite',
      allowedOrigins: '*',
      basePath: '/pindrop',
    });
  });

  it('parses ENABLED truthy/falsy values', () => {
    expect(env({ ENABLED: 'false' }).enabled).toBe(false);
    expect(env({ ENABLED: '0' }).enabled).toBe(false);
    expect(env({ ENABLED: 'true' }).enabled).toBe(true);
    expect(env({ ENABLED: 'yes' }).enabled).toBe(true);
  });

  it('falls back to the default port for invalid PORT', () => {
    expect(env({ PORT: 'abc' }).port).toBe(4878);
    expect(env({ PORT: '' }).port).toBe(4878);
    expect(env({ PORT: '3000' }).port).toBe(3000);
  });

  it('normalizes BASE_PATH (strips slashes, adds leading slash)', () => {
    expect(env({ BASE_PATH: 'feedback' }).basePath).toBe('/feedback');
    expect(env({ BASE_PATH: '/widget/' }).basePath).toBe('/widget');
  });

  it('parses a comma-separated CORS allow-list', () => {
    expect(env({ ALLOWED_ORIGINS: 'https://a.test, https://b.test' }).allowedOrigins).toEqual([
      'https://a.test',
      'https://b.test',
    ]);
    expect(env({ ALLOWED_ORIGINS: '*' }).allowedOrigins).toBe('*');
  });
});
