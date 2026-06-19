export interface Config {
  enabled: boolean;
  port: number;
  dbPath: string;
  allowedOrigins: string[] | '*';
  /** Public path prefix the widget + API are mounted under. */
  basePath: string;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const originsRaw = (env.ALLOWED_ORIGINS ?? '*').trim();
  const allowedOrigins =
    originsRaw === '*' || originsRaw === ''
      ? '*'
      : originsRaw.split(',').map((o) => o.trim()).filter(Boolean);

  const basePath = '/' + (env.BASE_PATH ?? 'pindrop').replace(/^\/+|\/+$/g, '');

  return {
    enabled: parseBool(env.ENABLED, true),
    port: Number(env.PORT) || 4878,
    dbPath: env.DB_PATH ?? '/data/db.sqlite',
    allowedOrigins,
    basePath,
  };
}
