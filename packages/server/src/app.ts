import { timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { cats } from '@otryad/core';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import type { Config } from './config.ts';
import { verifyInitData, type AuthResult } from './auth.ts';
import { Game, GameError, parseRecord, type Notifier } from './game.ts';
import { TelegramNotifier } from './notify.ts';
import { CLIENT_EVENTS, computeStats } from './stats.ts';
import { analyzeHere, type Analyzer, type Replayer } from './replay.ts';
import type { Store } from './store.ts';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthResult | null;
  }
}

export async function buildApp(
  config: Config,
  store: Store,
  opts: { logger?: boolean; notifier?: Notifier | null; now?: () => number; replay?: Replayer; analyze?: Analyzer } = {},
): Promise<FastifyInstance> {
  // A 20-minute run record is a few tens of kilobytes.
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 256 * 1024, trustProxy: true });
  const notifier =
    opts.notifier !== undefined
      ? opts.notifier
      : config.botToken
        ? new TelegramNotifier(config.botToken, config.telegramApi, config.appLink, (m) => app.log.warn(m))
        : null;
  const game = new Game(store, notifier, opts.now, opts.replay);
  const duelLink = (code: string) => (config.appLink ? `${config.appLink}?startapp=d_${code}` : null);

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
    await game.track(u.id, 'open');
    return { user: { id: u.id, name: u.first_name }, stats: await store.stats(u.id) };
  });

  // The unfinished run to continue, if any.
  app.get('/api/runs/current', async (req) => {
    const u = user(req);
    return { current: await game.current(u.id, u.first_name || 'Игрок') };
  });

  app.post<{ Body: { mode?: unknown; duel?: unknown; hero?: unknown; room?: unknown } | null }>('/api/runs', async (req) => {
    const u = user(req);
    const mode = req.body?.mode ?? 'free';
    if (mode !== 'free' && mode !== 'daily' && mode !== 'duel') throw new GameError(400, 'Неизвестный режим');
    const duel = req.body?.duel ?? null;
    if (duel !== null && typeof duel !== 'string') throw new GameError(400, 'Неверный код вызова');
    const hero = req.body?.hero ?? 'ryzhik';
    if (!cats.isHero(hero)) throw new GameError(400, 'Неизвестный кот');
    const room = req.body?.room ?? 'flat';
    if (!cats.isRoom(room)) throw new GameError(400, 'Неизвестная комната');
    await store.upsertUser(u.id, u.first_name, u.username);
    return game.start(u.id, u.first_name || 'Игрок', mode, duel, req.auth!.chatInstance ?? null, hero, room);
  });

  // Saves the input so far; the run can be continued later.
  app.post<{ Params: { id: string } }>('/api/runs/:id/progress', async (req, reply) => {
    const u = user(req);
    await game.save(u.id, req.params.id, parseRecord(req.body));
    return reply.status(204).send();
  });

  app.post<{ Params: { id: string } }>('/api/runs/:id/finish', async (req) => {
    const u = user(req);
    return game.finish(u.id, u.first_name || 'Игрок', req.params.id, parseRecord(req.body));
  });

  app.get('/api/daily', async (req) => {
    const u = user(req);
    return { daily: await game.daily(u.id) };
  });

  app.post<{ Body: { name?: unknown } | null }>('/api/events', async (req, reply) => {
    const u = user(req);
    const name = req.body?.name;
    if (typeof name !== 'string' || !CLIENT_EVENTS.has(name)) throw new GameError(400, 'Неизвестное событие');
    await game.track(u.id, name);
    return reply.status(204).send();
  });

  // Closed-test metrics for the owner; the key comes in the x-admin-key header
  // (the /admin.html page sends it) or as ?key= for a quick look.
  const admin = (req: { headers: Record<string, unknown>; query: { key?: string } }) => {
    const header = req.headers['x-admin-key'];
    const key = Buffer.from((typeof header === 'string' ? header : req.query.key) ?? '');
    const want = Buffer.from(config.adminKey ?? '');
    if (!config.adminKey || key.length !== want.length || !timingSafeEqual(key, want)) throw new GameError(404, 'Not found');
  };
  app.get<{ Querystring: { key?: string; days?: string } }>('/api/admin/stats', async (req) => {
    admin(req);
    const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 60);
    const now = (opts.now ?? Date.now)();
    // Retention needs players' first days, so look a week further back than the table.
    const events = await store.eventsSince(new Date(now - (days + 7) * 24 * 3600 * 1000));
    return computeStats(events, now, days);
  });

  // How the latest finished runs went, replayed from their records: deaths,
  // damage by enemy, minutes and picks. Finished runs never change, so their
  // analyses are kept.
  const analyze = opts.analyze ?? analyzeHere;
  const insights = new Map<string, Promise<cats.RunInsight | null>>();
  app.get<{ Querystring: { key?: string; limit?: string } }>('/api/admin/runs', async (req) => {
    admin(req);
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const runs = await store.recentRuns(limit);
    const list = await Promise.all(
      runs.map(async (r) => {
        let a = insights.get(r.id);
        if (!a) {
          // Only runs of this simulation replay as they were played.
          a = r.record && r.sim === cats.SIM_VERSION ? analyze(r.seed, r.record, { hero: r.hero, room: r.room, powers: r.powers }).catch(() => null) : Promise.resolve(null);
          insights.set(r.id, a);
          if (insights.size > 1000) insights.delete(insights.keys().next().value!);
        }
        const insight = await a;
        // What the server's replay stored when the run ended stays true for every version.
        const stored = { won: r.won, seconds: Math.round(r.ticks / cats.TICK_RATE), kills: r.kills, level: r.level, room: r.room, hero: r.hero };
        return { id: r.id, name: r.name, mode: r.mode, finishedAt: new Date(r.finishedAt).toISOString(), old: r.sim !== cats.SIM_VERSION, stored, insight };
      }),
    );
    const ok = list.flatMap((r) => (r.insight ? [r.insight] : []));
    const names = Object.fromEntries(Object.entries(cats.ENEMIES).map(([k, d]) => [k, d.name]));
    return { summary: cats.summarize(ok), names, total: { runs: list.length, wins: list.filter((r) => r.stored.won).length }, runs: list };
  });

  // Fish, auras and today's tasks; finished tasks are paid here.
  app.get('/api/profile', async (req) => {
    const u = user(req);
    await store.upsertUser(u.id, u.first_name, u.username);
    return { profile: await game.profile(u.id) };
  });

  app.post<{ Body: { item?: unknown } | null }>('/api/shop/buy', async (req) => {
    const u = user(req);
    if (typeof req.body?.item !== 'string') throw new GameError(400, 'Не указан товар');
    await store.upsertUser(u.id, u.first_name, u.username);
    return { profile: await game.buy(u.id, req.body.item) };
  });

  app.post('/api/shop/refund', async (req) => {
    const u = user(req);
    return { profile: await game.refundPowers(u.id) };
  });

  app.post<{ Body: { item?: unknown } | null }>('/api/shop/equip', async (req) => {
    const u = user(req);
    const item = req.body?.item ?? null;
    if (item !== null && typeof item !== 'string') throw new GameError(400, 'Неверная аура');
    return { profile: await game.equip(u.id, item) };
  });

  app.get('/api/league', async (req) => {
    const u = user(req);
    return { league: await game.league(u.id) };
  });

  // Leaderboard of the chat the game was opened from; null outside a chat.
  app.get('/api/chat', async (req) => {
    const u = user(req);
    const chat = req.auth!.chatInstance;
    return { top: chat ? await game.chatTop(u.id, chat) : null };
  });

  // Shares a finished run as a duel and returns the link for friends.
  app.post<{ Params: { id: string } }>('/api/runs/:id/duel', async (req) => {
    const u = user(req);
    const { challengerId: _, ...duel } = await game.share(u.id, u.first_name || 'Игрок', req.params.id);
    return { duel, link: duelLink(duel.code) };
  });

  app.get<{ Params: { code: string } }>('/api/duels/:code', async (req) => {
    const u = user(req);
    const { challengerId, ...duel } = await game.duelInfo(req.params.code);
    return { duel: { ...duel, mine: challengerId === u.id } };
  });

  // Friends' answers to the player's duels; new ones are marked seen.
  app.get('/api/duels', async (req) => {
    const u = user(req);
    return { results: await game.inbox(u.id) };
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
    // "dev <id>" or "dev <id>@<chat>" to act as if opened from a group chat.
    const [rawId, chat] = value.split('@');
    const id = Number(rawId);
    return Number.isSafeInteger(id) && id > 0 ? { user: { id, first_name: `Dev ${id}` }, chatInstance: chat || undefined } : null;
  }
  return null;
}
