export interface Config {
  port: number;
  host: string;
  databaseUrl: string | null; // null = in-memory store (development only)
  botToken: string | null;
  devAuth: boolean; // accept "dev <id>" auth instead of Telegram initData
  corsOrigins: string[];
  staticDir: string | null; // serve the built client from here
  initDataMaxAgeSec: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const config: Config = {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    databaseUrl: env.DATABASE_URL || null,
    botToken: env.TELEGRAM_BOT_TOKEN || null,
    devAuth: env.DEV_AUTH === '1',
    corsOrigins: (env.CORS_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    staticDir: env.STATIC_DIR || null,
    initDataMaxAgeSec: Number(env.INIT_DATA_MAX_AGE ?? 86400),
  };
  if (!config.botToken && !config.devAuth) {
    throw new Error('TELEGRAM_BOT_TOKEN is required (or DEV_AUTH=1 for local development)');
  }
  return config;
}
