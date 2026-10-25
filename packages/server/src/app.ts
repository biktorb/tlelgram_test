import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import type { Config } from './config.ts';
import { verifyInitData, type AuthResult } from './auth.ts';
import { Game, GameError, parseActions } from './game.ts';
import type { Store } from './store.ts';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthResult | null;
  }
}

export async function buildApp(config: Config, store: Store, opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 64 * 1024, trustProxy: true });
  const game = new Game(store);

  await app.register(cors, { origin: config.corsOrigins.length ? config.corsOrigins : false });

  app.decorateRequest('auth', null);
  app.addHook('onRequest', async (req) => {
    req.auth = authenticate(req, config);
  });

  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    keyGenerator: (req) => (req.auth ? `u${req.auth.user.id}` : req.ip),
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof GameError) return reply.status(err.status).send({ error: err.message });
    if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: err.message });
    app.log.error(err);
    return reply.status(500).send({ error: 'Ошибка сервера' });
  });

  const user = (req: FastifyRequest) => {
    if (!req.auth) throw new GameError(401, 'Нужен вход через Telegram');
    return req.auth.user;
  };

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/me', async (req) => {
    const u = user(req);
    await store.upsertUser(u.id, u.first_name, u.username);
    return { user: { id: u.id, name: u.first_name }, stats: await store.stats(u.id) };
  });

  app.get('/api/runs/current', async (req) => {
    const u = user(req);
    return { run: await game.current(u.id) };
  });

  app.post('/api/runs', async (req) => {
    const u = user(req);
    await store.upsertUser(u.id, u.first_name, u.username);
    return { run: await game.start(u.id) };
  });

  app.post<{ Params: { id: string }; Body: { version?: unknown; actions?: unknown } }>('/api/runs/:id/turn', async (req) => {
    const u = user(req);
    const body = req.body ?? {};
    if (!Number.isInteger(body.version)) throw new GameError(400, 'Нет версии забега');
    return game.turn(u.id, u.first_name || 'Игрок', req.params.id, body.version as number, parseActions(body.actions));
  });

  if (config.staticDir) {
    await app.register(fastifyStatic, { root: config.staticDir, prefix: '/' });
  }

  return app;
}

function authenticate(req: FastifyRequest, config: Config): AuthResult | null {
  const header = req.headers.authorization ?? '';
  const [scheme, ...rest] = header.split(' ');
  const value = rest.join(' ');
  if (scheme === 'tma' && config.botToken) return verifyInitData(value, config.botToken, config.initDataMaxAgeSec);
  if (scheme === 'dev' && config.devAuth) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? { user: { id, first_name: `Dev ${id}` } } : null;
  }
  return null;
}
