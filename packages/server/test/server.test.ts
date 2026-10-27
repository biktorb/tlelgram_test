import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cats, SEASON_PASS } from '@otryad/core';
import { buildApp } from '../src/app.ts';
import { signInitData, verifyInitData } from '../src/auth.ts';
import { loadConfig, type Config } from '../src/config.ts';
import { dailySeed, dayOf, leagueMove, weekOf, type Notifier } from '../src/game.ts';
import { PgStore } from '../src/pgStore.ts';
import { MemoryStore, type Store } from '../src/store.ts';
import { computeStats, type GameEvent } from '../src/stats.ts';

const TOKEN = '123456:TEST-token';

const config: Config = {
  port: 0,
  host: '127.0.0.1',
  databaseUrl: null,
  botToken: TOKEN,
  devAuth: false,
  corsOrigins: [],
  staticDir: null,
  initDataMaxAgeSec: 3600,
  appLink: 'https://t.me/otryad_bot/play',
  telegramApi: 'https://api.telegram.org',
  adminKey: 'test-admin-key-0123456789',
};

function initData(userId: number, name = 'Маша', authDate = Math.floor(Date.now() / 1000)): string {
  return signInitData(
    { auth_date: String(authDate), query_id: 'AAH', user: JSON.stringify({ id: userId, first_name: name }) },
    TOKEN,
  );
}

const auth = (userId: number) => ({ authorization: `tma ${initData(userId, `P${userId}`)}` });

// Launch data as Telegram sends it when the game is opened from a group chat link.
const chatAuth = (userId: number, chat: string) => ({
  authorization: `tma ${signInitData(
    {
      auth_date: String(Math.floor(Date.now() / 1000)),
      chat_instance: chat,
      chat_type: 'supergroup',
      user: JSON.stringify({ id: userId, first_name: `P${userId}` }),
    },
    TOKEN,
  )}`,
});

describe('initData validation', () => {
  test('accepts correctly signed data', () => {
    const r = verifyInitData(initData(7), TOKEN, 3600);
    assert.equal(r?.user.id, 7);
    assert.equal(r?.user.first_name, 'Маша');
  });

  test('rejects a tampered user', () => {
    const data = new URLSearchParams(initData(7));
    data.set('user', JSON.stringify({ id: 8, first_name: 'Маша' }));
    assert.equal(verifyInitData(data.toString(), TOKEN, 3600), null);
  });

  test('rejects another bot token', () => {
    assert.equal(verifyInitData(initData(7), '999:other', 3600), null);
  });

  test('rejects stale data', () => {
    const old = initData(7, 'Маша', Math.floor(Date.now() / 1000) - 7200);
    assert.equal(verifyInitData(old, TOKEN, 3600), null);
  });
});

describe('config', () => {
  const env = { DEV_AUTH: '1' };
  test('the Bot API base can point at a relay', () => {
    assert.equal(loadConfig(env).telegramApi, 'https://api.telegram.org');
    assert.equal(loadConfig({ ...env, TELEGRAM_API_BASE: 'https://tg.example.workers.dev/' }).telegramApi, 'https://tg.example.workers.dev');
    assert.equal(loadConfig({ ...env, TELEGRAM_API_BASE: 'http://insecure.example' }).telegramApi, 'https://api.telegram.org');
  });
});

describe('closed-test stats', () => {
  const day = (d: string, hm = '12:00') => Date.parse(`${d}T${hm}:00+03:00`);
  const ev = (userId: number, name: string, at: number, data: Record<string, unknown> | null = null): GameEvent => ({ userId, name, at, data });

  test('retention, minutes and share rate', () => {
    const events = [
      // Player 1 came on the 1st, back on the 2nd and on the 8th.
      ev(1, 'open', day('2030-03-01')),
      ev(1, 'run_start', day('2030-03-01', '12:01')),
      ev(1, 'run_end', day('2030-03-01', '12:09'), { seconds: 300, won: true, duel: false }),
      ev(1, 'duel_share', day('2030-03-01', '12:10')),
      ev(1, 'open', day('2030-03-02')),
      ev(1, 'open', day('2030-03-08')),
      // Player 2 came on the 1st only; a pause longer than a run does not count as play.
      ev(2, 'open', day('2030-03-01')),
      ev(2, 'run_start', day('2030-03-01', '12:02')),
      ev(2, 'run_end', day('2030-03-01', '18:00'), { seconds: 120, won: false, duel: false }),
      // Player 3 came on the 9th and answered a duel.
      ev(3, 'run_start', day('2030-03-09')),
      ev(3, 'run_end', day('2030-03-09', '12:06'), { seconds: 200, won: false, duel: true }),
    ];
    const s = computeStats(events, day('2030-03-10'), 10);
    assert.deepEqual(s.retention.d1, { of: 2, hit: 1, rate: 0.5 }, 'today is not over, so player 3 is not counted yet');
    assert.deepEqual(s.retention.d7, { of: 2, hit: 1, rate: 0.5 }, 'player 3 is too new for D7');
    assert.deepEqual(s.shareRate, { of: 3, hit: 2, rate: 0.667 });
    const first = s.days.find((d) => d.date === '2030-03-01')!;
    assert.deepEqual(first, { date: '2030-03-01', activeUsers: 2, newUsers: 2, runsStarted: 2, runsFinished: 2, shares: 1 });
    assert.equal(s.days[0].date, '2030-03-10');
    assert.equal(s.minutesPerActiveDay, 6, 'median of 10, 2 and 6 minutes on days with a run');
  });
});

describe('leagues', () => {
  test('weeks start on Monday, Moscow time', () => {
    assert.equal(weekOf(Date.parse('2030-01-07T00:30:00+03:00')), '2030-01-07');
    assert.equal(weekOf(Date.parse('2030-01-13T23:30:00+03:00')), '2030-01-07');
    assert.equal(weekOf(Date.parse('2030-01-13T21:30:00Z')), '2030-01-14', 'Monday 00:30 in Moscow');
  });

  test('the top fifth with points goes up, the bottom fifth down', () => {
    assert.equal(leagueMove(0, 1, 1, 5), 1, 'a lone player with points goes up');
    assert.equal(leagueMove(0, 1, 1, 0), 0, 'no points, no promotion');
    assert.equal(leagueMove(3, 1, 10, 30), 0, 'diamond is the top');
    assert.equal(leagueMove(1, 2, 10, 20), 1);
    assert.equal(leagueMove(1, 3, 10, 20), 0);
    assert.equal(leagueMove(1, 9, 10, 2), -1);
    assert.equal(leagueMove(1, 4, 4, 0), 0, 'small leagues demote nobody');
    assert.equal(leagueMove(0, 10, 10, 0), 0, 'bronze is the bottom');
  });
});

// The same API scenarios run against every available store.
const stores: [string, () => Promise<Store>][] = [['memory', async () => new MemoryStore()]];
if (process.env.TEST_DATABASE_URL) {
  stores.push([
    'postgres',
    async () => {
      const s = new PgStore(process.env.TEST_DATABASE_URL!);
      await s.migrate();
      await s.reset();
      return s;
    },
  ]);
}

// A cat that never moves and always takes the first card: the record is empty
// and the replay stands still until the run is over.
const AFK = { moves: '', picks: '' };

for (const [name, makeStore] of stores) {
  describe(`API with ${name} store`, () => {
    let store: Store;
    let app: Awaited<ReturnType<typeof buildApp>>;
    const notified: { challengerId: number; friend: string; beat: boolean }[] = [];
    const notifier: Notifier = {
      duelAnswered: (duel, friend, beat) => notified.push({ challengerId: duel.challengerId, friend, beat }),
    };

    // Real time plus an offset; a fixed time when set.
    let offset = 0;
    let fixed: number | null = null;
    const now = () => fixed ?? Date.now() + offset;

    before(async () => {
      store = await makeStore();
      app = await buildApp(config, store, { notifier, now });
    });
    after(async () => {
      await app.close();
      await store.close();
    });

    const post = (userId: number, url: string, payload?: object, headers = auth(userId)) => app.inject({ method: 'POST', url, headers, payload });
    const get = (userId: number, url: string, headers = auth(userId)) => app.inject({ method: 'GET', url, headers });
    const start = async (userId: number, payload: object = {}, headers = auth(userId)) => {
      const res = await post(userId, '/api/runs', payload, headers);
      assert.equal(res.statusCode, 200, res.body);
      return res.json() as { run: { id: string; seed: number; mode: string; daily: string | null; duel: string | null; progress: unknown }; ghost: any };
    };
    const finish = async (userId: number, runId: string, rec = AFK) => {
      const res = await post(userId, `/api/runs/${runId}/finish`, rec);
      assert.equal(res.statusCode, 200, res.body);
      return res.json();
    };
    // Starts a free run and finishes it standing still; returns its result.
    const play = async (userId: number, headers = auth(userId)) => {
      const { run } = await start(userId, {}, headers);
      return (await finish(userId, run.id)).result as { won: boolean; ticks: number; kills: number; points: number };
    };

    test('rejects requests without Telegram auth', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/runs' });
      assert.equal(res.statusCode, 401);
    });

    test('the server replays the record and agrees with the client', async () => {
      const { run, ghost } = await start(1);
      assert.equal(run.mode, 'free');
      assert.equal(ghost, null);
      const bot = cats.playBot(run.seed, cats.BOT_STYLES.mixed, cats.BOT_SKILLS.casual);
      const rec = bot.record();
      const local = bot.run.result();

      const early = await post(1, `/api/runs/${run.id}/finish`, rec);
      assert.equal(early.statusCode, 422, 'a run cannot end faster than it is played');

      offset = 3600 * 1000;
      const body = await finish(1, run.id, rec);
      offset = 0;
      assert.deepEqual(body.result, { won: local.won, ticks: local.ticks, kills: local.kills, level: local.level, points: cats.runPoints(local.ticks, local.won) });
      assert.equal((await post(1, `/api/runs/${run.id}/finish`, rec)).statusCode, 409, 'a run finishes once');
    });

    test('rejects malformed records and runs of other players', async () => {
      const { run } = await start(2);
      for (const bad of [{}, { moves: 'zz', picks: '' }, { moves: 'a', picks: 'x' }, { moves: `a${cats.RUN_TICKS + 1}`, picks: '' }]) {
        const res = await post(2, `/api/runs/${run.id}/finish`, bad);
        assert.equal(res.statusCode, 400, JSON.stringify(bad));
      }
      assert.equal((await post(3, `/api/runs/${run.id}/finish`, AFK)).statusCode, 404);
      assert.equal((await post(2, '/api/runs/run-999/finish', AFK)).statusCode, 404);
      assert.equal((await post(2, '/api/runs', { mode: 'arena' })).statusCode, 400);
    });

    test('a run can be stopped and continued later', async () => {
      const { run } = await start(10);
      assert.equal((await get(10, '/api/runs/current')).json().current.run.id, run.id);
      assert.equal((await post(10, `/api/runs/${run.id}/progress`, { moves: 'a3000', picks: '' })).statusCode, 422, 'not played that long yet');
      assert.equal((await post(10, `/api/runs/${run.id}/progress`, { moves: 'a10c5', picks: '0' })).statusCode, 204);
      const cur = (await get(10, '/api/runs/current')).json().current;
      assert.deepEqual(cur.run.progress, { moves: 'a10c5', picks: '0' });
      assert.equal(cur.run.seed, run.seed);

      // Starting another run closes this one with the progress it has.
      const next = await start(10);
      assert.notEqual(next.run.id, run.id);
      assert.equal((await post(10, `/api/runs/${run.id}/finish`, AFK)).statusCode, 409);
      assert.equal((await post(10, `/api/runs/${run.id}/progress`, AFK)).statusCode, 409);
      const me = (await get(10, '/api/me')).json();
      assert.equal(me.stats.runs, 1);
      await finish(10, next.run.id);
      assert.equal((await get(10, '/api/runs/current')).json().current, null);
    });

    test('duel: share a finished run, a friend races its ghost on the same seed', async () => {
      const a = (await start(60)).run;
      assert.equal((await post(60, `/api/runs/${a.id}/duel`)).statusCode, 422, 'an unfinished run cannot be shared');
      const aRes = (await finish(60, a.id)).result;

      assert.equal((await post(61, `/api/runs/${a.id}/duel`)).statusCode, 404);
      const shared = (await post(60, `/api/runs/${a.id}/duel`)).json();
      assert.match(shared.duel.code, /^[a-zA-Z0-9]{8}$/);
      assert.equal(shared.link, `https://t.me/otryad_bot/play?startapp=d_${shared.duel.code}`);
      assert.deepEqual([shared.duel.won, shared.duel.ticks, shared.duel.kills], [aRes.won, aRes.ticks, aRes.kills]);
      assert.equal((await post(60, `/api/runs/${a.id}/duel`)).json().duel.code, shared.duel.code, 'sharing twice gives the same duel');

      const code = shared.duel.code;
      assert.equal((await post(60, '/api/runs', { mode: 'duel', duel: code })).statusCode, 422);
      assert.equal((await post(61, '/api/runs', { mode: 'duel', duel: 'zzzzzzzz' })).statusCode, 404);

      const preview = (await get(61, `/api/duels/${code}`)).json().duel;
      assert.equal(preview.challengerName, 'P60');
      assert.equal(preview.mine, false);
      assert.equal(preview.challengerId, undefined, 'player ids are not exposed');
      assert.equal((await get(60, `/api/duels/${code}`)).json().duel.mine, true);

      const b = await start(61, { mode: 'duel', duel: code });
      assert.equal(b.run.duel, code);
      assert.equal(b.run.seed, a.seed);
      assert.deepEqual([b.ghost.name, b.ghost.seed, b.ghost.record], ['P60', a.seed, AFK]);

      // The friend plays a real game: it lasts longer than standing still.
      const bot = cats.playBot(b.run.seed, cats.BOT_STYLES.mixed, cats.BOT_SKILLS.casual);
      offset = 3600 * 1000;
      const bEnd = await finish(61, b.run.id, bot.record());
      offset = 0;
      const beat = cats.compareScores(bEnd.result, aRes) < 0;
      assert.deepEqual(bEnd.duel, { challengerName: 'P60', challenger: { won: aRes.won, ticks: aRes.ticks, kills: aRes.kills }, beat });
      assert.deepEqual(notified.at(-1), { challengerId: 60, friend: 'P61', beat });

      const inbox = (await get(60, '/api/duels')).json().results;
      assert.deepEqual(inbox, [{ userName: 'P61', won: bEnd.result.won, ticks: bEnd.result.ticks, kills: bEnd.result.kills, beat, isNew: true }]);
      assert.equal((await get(60, '/api/duels')).json().results[0].isNew, false);
    });

    test('chat leaderboard counts runs started from that chat only', async () => {
      assert.deepEqual((await get(70, '/api/chat')).json(), { top: null });
      for (const [id, chat] of [[70, 'c1'], [71, 'c1'], [71, 'c1'], [72, 'c2']] as const) await play(id, chatAuth(id, chat));
      await play(73);

      const top = (await get(70, '/api/chat', chatAuth(70, 'c1'))).json().top;
      assert.deepEqual(top.map((e: { name: string }) => e.name).sort(), ['P70', 'P71']);
      assert.equal(top.find((e: { name: string }) => e.name === 'P71').runs, 2);
      assert.ok(top.every((e: any, i: number) => i === 0 || cats.compareScores(top[i - 1], e) <= 0), 'best first');
      assert.equal(top.find((e: { name: string }) => e.name === 'P70').me, true);
      assert.equal(top[0].userId, undefined, 'player ids are not exposed');
    });

    test('daily challenge: same seed for everyone, one attempt, ranked, the leader is the ghost', async () => {
      const date = dayOf(now());
      const daily = async (id: number) => (await get(id, '/api/daily')).json().daily;

      assert.deepEqual(await daily(90), { date, status: 'none', top: [], rank: null });
      const a = await start(90, { mode: 'daily' });
      assert.equal(a.run.daily, date);
      assert.equal(a.run.seed, dailySeed(date));
      assert.equal(a.ghost, null, 'nobody has finished yet');
      assert.equal((await start(90, { mode: 'daily' })).run.id, a.run.id, 'an unfinished daily run is continued');
      assert.equal((await daily(90)).status, 'active');

      const aEnd = await finish(90, a.run.id);
      assert.deepEqual(aEnd.daily, { rank: 1 });
      assert.equal((await post(90, '/api/runs', { mode: 'daily' })).statusCode, 409, 'one attempt per day');

      const b = await start(91, { mode: 'daily' });
      assert.equal(b.run.seed, a.run.seed);
      assert.equal(b.ghost.name, 'P90');
      const bot = cats.playBot(b.run.seed, cats.BOT_STYLES.mixed, cats.BOT_SKILLS.casual);
      offset = 3600 * 1000;
      const bEnd = await finish(91, b.run.id, bot.record());
      offset = 0;
      const bFirst = cats.compareScores(bEnd.result, aEnd.result) < 0;
      assert.equal(bEnd.daily.rank, bFirst ? 1 : 2);
      const da = await daily(90);
      assert.equal(da.status, 'finished');
      assert.equal(da.rank, bFirst ? 2 : 1);
      assert.deepEqual(da.top.map((e: { name: string }) => e.name), bFirst ? ['P91', 'P90'] : ['P90', 'P91']);
      assert.equal(da.top.find((e: { name: string }) => e.name === 'P90').me, true);
      assert.equal((await start(92, { mode: 'daily' })).ghost.name, bFirst ? 'P91' : 'P90');

      offset = 24 * 3600 * 1000;
      const next = await daily(90);
      assert.equal(next.status, 'none', 'a new day brings a new attempt');
      assert.notEqual(dailySeed(next.date), dailySeed(date));
      offset = 0;
    });

    test('weekly league: first runs of a day earn points, the week settles', async () => {
      fixed = Date.parse('2030-01-08T12:00:00+03:00');
      const league = async (id: number) => (await get(id, '/api/league')).json().league;

      const fresh = await league(100);
      assert.equal(fresh.week, '2030-01-07');
      assert.equal(fresh.endsAt, '2030-01-13T21:00:00.000Z');
      assert.deepEqual([fresh.league, fresh.points, fresh.rank, fresh.size, fresh.runsToday], [0, 0, null, 0, 0]);

      const pts = [];
      for (let i = 0; i < 4; i++) pts.push((await play(100)).points);
      const a = await league(100);
      assert.equal(a.points, pts[0] + pts[1] + pts[2], 'only three runs a day count');
      assert.equal(a.runsToday, 3);
      fixed += 24 * 3600 * 1000;
      assert.equal((await league(100)).runsToday, 0, 'a new day counts again');
      const aPoints = a.points + (await play(100)).points;
      assert.equal((await league(100)).points, aPoints);

      const bPoints = (await play(101)).points;
      const b = await league(101);
      assert.equal(b.size, 2);
      const aFirst = aPoints >= bPoints;
      assert.equal(b.rank, aFirst ? 2 : 1);
      assert.equal(b.up, 1);
      assert.equal(b.down, 0, 'bronze has no way down');

      fixed += 7 * 24 * 3600 * 1000;
      const next = await league(aFirst ? 100 : 101);
      const winnerPoints = aFirst ? aPoints : bPoints;
      assert.equal(next.week, '2030-01-14');
      assert.equal(next.league, winnerPoints > 0 ? 1 : 0, 'the leader goes up');
      assert.equal(next.points, 0);
      const other = await league(aFirst ? 101 : 100);
      assert.deepEqual([other.league, other.moved], [0, 0]);
      fixed = null;
    });

    test('daily tasks pay fish once; fish buy auras that friends see on the ghost', async () => {
      const profile = async (id: number) => (await get(id, '/api/profile')).json().profile;
      const shop = (id: number, what: 'buy' | 'equip', item: string | null) => post(id, `/api/shop/${what}`, { item });

      const fresh = await profile(120);
      assert.deepEqual([fresh.fish, fresh.frame, fresh.owned], [0, null, []]);
      assert.deepEqual(fresh.tasks.map((t: { progress: number }) => t.progress), [0, 0, 0]);
      assert.equal((await shop(120, 'buy', 'gold')).statusCode, 422, 'no fish yet');

      await start(120); // abandoned: closed when the next run starts, and still counted
      const r1 = await play(120);
      const r2 = await play(120);
      const p = await profile(120);
      assert.deepEqual(p.tasks[0], { id: 'runs', title: 'Сыграйте 2 забега', goal: 2, reward: 20, progress: 2, done: true });
      // Minutes also count the abandoned run, which stood still until the end.
      assert.ok(p.tasks[1].progress >= Math.min(Math.floor((r1.ticks + r2.ticks) / (60 * cats.TICK_RATE)), 8));
      const passFish = (level: number) => SEASON_PASS.slice(0, level).reduce((n, r) => n + ('fish' in r ? r.fish : 0), 0);
      const paid = 20 + (p.tasks[1].done ? 30 : 0) + passFish(p.season.level);
      assert.equal(p.fish, paid);
      assert.equal((await profile(120)).fish, paid, 'a task pays once');
      assert.ok(p.season.points >= r1.points + r2.points);

      await store.claimTask(120, '2000-01-01', 'test', 200);
      const bought = await shop(120, 'buy', 'gold');
      assert.equal(bought.statusCode, 200, bought.body);
      assert.deepEqual([bought.json().profile.fish, bought.json().profile.frame, bought.json().profile.owned], [paid + 100, 'gold', ['gold']]);
      assert.equal((await shop(120, 'buy', 'gold')).json().profile.fish, paid + 100, 'buying twice is free');
      assert.equal((await shop(120, 'buy', 'hat')).statusCode, 404);
      assert.equal((await shop(120, 'equip', 'neon')).statusCode, 422, 'only owned auras');
      assert.equal((await shop(120, 'equip', null)).json().profile.frame, null);
      assert.equal((await shop(120, 'equip', 'gold')).json().profile.frame, 'gold');
      assert.equal((await shop(120, 'buy', 'crown')).statusCode, 422, 'season auras are not sold');

      const { run } = await start(120);
      await finish(120, run.id);
      const shared = (await post(120, `/api/runs/${run.id}/duel`)).json();
      assert.equal((await start(121, { mode: 'duel', duel: shared.duel.code })).ghost.aura, 'gold');
    });

    test('season pass: every level pays once, the last one an aura', async () => {
      const profile = async (id: number) => (await get(id, '/api/profile')).json().profile;
      assert.equal((await profile(130)).season.level, 0);
      await store.upsertUser(130, 'P130');
      const run = await store.createRun(130, { seed: 1, mode: 'free' });
      await store.finishRun(run.id, { won: true, ticks: cats.RUN_TICKS, kills: 900, level: 30, points: 200 }, AFK);
      const p = await profile(130);
      assert.equal(p.season.points, 200);
      assert.equal(p.season.level, 10);
      assert.ok(p.owned.includes('crown'));
      assert.ok(p.fish >= 20 + 30 + 40 + 50 + 60 + 70 + 80 + 90 + 100, `${p.fish} fish`);
      assert.equal((await profile(130)).fish, p.fish, 'levels pay once');
      assert.equal((await post(130, '/api/shop/equip', { item: 'crown' })).json().profile.frame, 'crown');
    });

    test('events are recorded and the stats page needs the admin key', async () => {
      assert.equal((await post(140, '/api/events', { name: 'share_story' })).statusCode, 204);
      assert.equal((await post(140, '/api/events', { name: 'drop_table' })).statusCode, 400);
      assert.equal((await app.inject({ method: 'GET', url: '/api/admin/stats' })).statusCode, 404);
      assert.equal((await app.inject({ method: 'GET', url: '/api/admin/stats?key=wrong' })).statusCode, 404);
      const res = await app.inject({ method: 'GET', url: '/api/admin/stats?days=3', headers: { 'x-admin-key': config.adminKey! } });
      assert.equal(res.statusCode, 200);
      const stats = res.json();
      assert.equal(stats.days.length, 3);
      assert.ok(stats.days[0].runsStarted > 0, 'runs from earlier tests are counted');
      assert.ok(stats.days[0].shares > 0);
    });

    test('profile stats: finished runs, wins and the best result', async () => {
      const r = await play(150);
      const me = (await get(150, '/api/me')).json();
      assert.equal(me.user.name, 'P150');
      assert.deepEqual(me.stats, { runs: 1, wins: Number(r.won), best: { won: r.won, ticks: r.ticks, kills: r.kills } });
    });
  });
}
