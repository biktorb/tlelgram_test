export interface Config {
  port: number;
  host: string;
  databaseUrl: string | null; // null = in-memory store (development only)
  botToken: string | null;
  devAuth: boolean; // accept "dev <id>" auth instead of Telegram initData
  corsOrigins: string[];
  staticDir: string | null; // serve the built client from here
  initDataMaxAgeSec: number;
  appLink: string | null; // the Mini App's t.me link, for duel invitations
  telegramApi: string; // Bot API base URL; a relay when the server's network blocks Telegram
}

const TELEGRAM_API = 'https://api.telegram.org';

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
    appLink: env.TELEGRAM_APP_LINK?.replace(/\/$/, '') || null,
    telegramApi: env.TELEGRAM_API_BASE?.replace(/\/$/, '') || TELEGRAM_API,
  };
  if (!/^https:\/\/[^/\s]+$/.test(config.telegramApi)) {
    console.warn('TELEGRAM_API_BASE must look like https://<host>; using api.telegram.org');
    config.telegramApi = TELEGRAM_API;
  }
  if (config.appLink && !/^https:\/\/t\.me\/\w+\/\w+$/.test(config.appLink)) {
    // A typo here should not take the game down: duels just can't be shared.
    console.warn('TELEGRAM_APP_LINK must look like https://t.me/<bot>/<app>; duel links are off');
    config.appLink = null;
  }
  if (config.botToken && !/^\d+:[\w-]{30,}$/.test(config.botToken)) {
    console.warn('TELEGRAM_BOT_TOKEN does not look like a bot token: every Telegram sign-in will be refused');
  }
  if (!config.botToken && !config.devAuth) {
    throw new Error('TELEGRAM_BOT_TOKEN is required (or DEV_AUTH=1 for local development)');
  }
  return config;
}
