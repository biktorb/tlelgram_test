import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ActionError, Rng, Run, type Action, type RunState } from '@otryad/core';
import { buildApp } from '../src/app.ts';
import { signInitData, verifyInitData } from '../src/auth.ts';
import { loadConfig, type Config } from '../src/config.ts';
import { dailySeed, dayOf, leagueMove, seedGhosts, weekOf, type Notifier } from '../src/game.ts';
import { PgStore } from '../src/pgStore.ts';
import { MemoryStore, type Store } from '../src/store.ts';

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

const BOT_TEAMS = {
  1: [[{ id: 'recruit', atk: 2, hp: 2, xp: 0 }]],
  2: [[{ id: 'recruit', atk: 2, hp: 2, xp: 0 }, { id: 'scout', atk: 2, hp: 2, xp: 0 }]],
};

for (const [name, makeStore] of stores) {
  describe(`API with ${name} store`, () => {
    let store: Store;
    let app: Awaited<ReturnType<typeof buildApp>>;
    const notified: { challengerId: number; friend: string; result: string }[] = [];
    const notifier: Notifier = {
      duelAnswered: (duel, friend, result) => notified.push({ challengerId: duel.challengerId, friend, result }),
    };

    let clock = Date.now();

    before(async () => {
      store = await makeStore();
      await seedGhosts(store, BOT_TEAMS);
      app = await buildApp(config, store, { notifier, now: () => clock });
    });

    // Plays a run to the end buying the first shop unit each turn; returns the last turn's body.
    const playToEnd = async (userId: number, run: { id: string; version: number; state: RunState }) => {
      let cur = run;
      let body: any;
      while (!cur.state.finished) {
        const actions = cur.state.team.length < 5 && cur.state.shop.length ? [{ a: 'buy', shop: 0, pos: 0 }] : [];
        const res = await app.inject({ method: 'POST', url: `/api/runs/${cur.id}/turn`, headers: auth(userId), payload: { version: cur.version, actions } });
        assert.equal(res.statusCode, 200, res.body);
        body = res.json();
        cur = body.run;
      }
      return body;
    };
    after(async () => {
      await app.close();
      await store.close();
    });

    test('rejects requests without Telegram auth', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/runs' });
      assert.equal(res.statusCode, 401);
    });

    test('starts a run and plays a turn the server verifies', async () => {
      const start = await app.inject({ method: 'POST', url: '/api/runs', headers: auth(1) });
      assert.equal(start.statusCode, 200);
      const run = start.json().run as { id: string; version: number; state: RunState };
      assert.equal(run.state.round, 1);

      // The client simulates locally with the same core; the server must agree.
      const local = new Run(run.state.seed, run.state);
      local.apply({ a: 'buy', shop: 0, pos: 0 });

      const turn = await app.inject({
        method: 'POST',
        url: `/api/runs/${run.id}/turn`,
        headers: auth(1),
        payload: { version: run.version, actions: [{ a: 'buy', shop: 0, pos: 0 }] },
      });
      assert.equal(turn.statusCode, 200, turn.body);
      const body = turn.json();
      assert.equal(body.run.state.round, 2);
      assert.equal(body.run.version, run.version + 1);
      assert.equal(body.enemy.name.startsWith('Кот #'), true);
      assert.equal(body.battle.start.left[0].id, local.s.team[0].id);
      assert.ok(['win', 'loss', 'draw'].includes(body.battle.result));
    });

    test('resumes the current run', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/runs/current', headers: auth(1) });
      assert.equal(res.json().run.state.round, 2);
    });

    test('rejects a stale version (double submit)', async () => {
      const cur = (await app.inject({ method: 'GET', url: '/api/runs/current', headers: auth(1) })).json().run;
      const payload = { version: cur.version - 1, actions: [{ a: 'buy', shop: 0, pos: 0 }] };
      const res = await app.inject({ method: 'POST', url: `/api/runs/${cur.id}/turn`, headers: auth(1), payload });
      assert.equal(res.statusCode, 409);
    });

    test('rejects actions the rules do not allow', async () => {
      const cur = (await app.inject({ method: 'GET', url: '/api/runs/current', headers: auth(1) })).json().run;
      const tooMany = [0, 1, 2, 3].map(() => ({ a: 'buy', shop: 0, pos: 0 })); // 4 buys = 12 gold > 10
      const res = await app.inject({
        method: 'POST',
        url: `/api/runs/${cur.id}/turn`,
        headers: auth(1),
        payload: { version: cur.version, actions: tooMany },
      });
      assert.equal(res.statusCode, 422);
      // Nothing was saved.
      const after = (await app.inject({ method: 'GET', url: '/api/runs/current', headers: auth(1) })).json().run;
      assert.equal(after.version, cur.version);
    });

    test('rejects malformed actions', async () => {
      const cur = (await app.inject({ method: 'GET', url: '/api/runs/current', headers: auth(1) })).json().run;
      const res = await app.inject({
        method: 'POST',
        url: `/api/runs/${cur.id}/turn`,
        headers: auth(1),
        payload: { version: cur.version, actions: [{ a: 'win' }] },
      });
      assert.equal(res.statusCode, 400);
    });

    test("cannot play someone else's run", async () => {
      const cur = (await app.inject({ method: 'GET', url: '/api/runs/current', headers: auth(1) })).json().run;
      const res = await app.inject({
        method: 'POST',
        url: `/api/runs/${cur.id}/turn`,
        headers: auth(2),
        payload: { version: cur.version, actions: [] },
      });
      assert.equal(res.statusCode, 404);
    });

    test("a player's team becomes a ghost for others, never for themselves", async () => {
      // Player 3 reaches round 2; player 4 in round 2 may now meet player 3's team.
      const p3 = (await app.inject({ method: 'POST', url: '/api/runs', headers: auth(3) })).json().run;
      await app.inject({
        method: 'POST',
        url: `/api/runs/${p3.id}/turn`,
        headers: auth(3),
        payload: { version: p3.version, actions: [{ a: 'buy', shop: 0, pos: 0 }] },
      });
      const seen = new Set<string>();
      for (let i = 0; i < 20; i++) {
        seen.add((await store.pickGhost(1, 0, 4, () => i / 20))!.name);
        assert.notEqual((await store.pickGhost(1, 0, 3, () => i / 20))?.name, 'P3');
      }
      assert.ok(seen.has('P3'));
    });

    test('server agrees with the client on random shop play (no desync)', async () => {
      const rng = new Rng(99);
      const kinds = ['buy', 'buyMerge', 'merge', 'sell', 'move', 'reroll', 'freeze'] as const;
      let cur = (await app.inject({ method: 'POST', url: '/api/runs', headers: auth(50) })).json().run;
      for (let turn = 0; turn < 8 && !cur.state.finished; turn++) {
        const local = new Run(cur.state.seed, cur.state);
        const actions: Action[] = [];
        for (let i = 0; i < 25; i++) {
          const k = rng.pick(kinds);
          const n = () => rng.int(5);
          const action: Action =
            k === 'buy' ? { a: k, shop: n(), pos: n() }
            : k === 'buyMerge' ? { a: k, shop: n(), team: n() }
            : k === 'merge' || k === 'move' ? { a: k, from: n(), to: n() }
            : k === 'sell' ? { a: k, team: n() }
            : k === 'freeze' ? { a: k, shop: n() }
            : { a: 'reroll' };
          try {
            local.apply(action);
            actions.push(action); // only actions the client accepted are sent
          } catch (e) {
            if (!(e instanceof ActionError)) throw e;
          }
        }
        if (local.s.team.length === 0) break; // the server would refuse an empty team
        const res = await app.inject({
          method: 'POST',
          url: `/api/runs/${cur.id}/turn`,
          headers: auth(50),
          payload: { version: cur.version, actions },
        });
        assert.equal(res.statusCode, 200, res.body);
        const body = res.json();
        local.endTurn();
        const strip = (t: { id: string; atk: number; hp: number; xp: number }[]) => t.map(({ id, atk, hp, xp }) => ({ id, atk, hp, xp }));
        assert.deepEqual(strip(body.battle.start.left), strip(local.s.team));
        cur = body.run;
      }
    });

    test('duel: share a finished run, a friend answers it from the same seed', async () => {
      const a = (await app.inject({ method: 'POST', url: '/api/runs', headers: auth(60) })).json().run;
      const early = await app.inject({ method: 'POST', url: `/api/runs/${a.id}/duel`, headers: auth(60) });
      assert.equal(early.statusCode, 422, 'an unfinished run cannot be shared');
      const aLast = await playToEnd(60, a);
      const aState: RunState = aLast.run.state;

      const notMine = await app.inject({ method: 'POST', url: `/api/runs/${a.id}/duel`, headers: auth(61) });
      assert.equal(notMine.statusCode, 404);
      const shared = (await app.inject({ method: 'POST', url: `/api/runs/${a.id}/duel`, headers: auth(60) })).json();
      assert.match(shared.duel.code, /^[a-zA-Z0-9]{8}$/);
      assert.equal(shared.link, `https://t.me/otryad_bot/play?startapp=d_${shared.duel.code}`);
      assert.equal(shared.duel.wins, aState.wins);
      const again = (await app.inject({ method: 'POST', url: `/api/runs/${a.id}/duel`, headers: auth(60) })).json();
      assert.equal(again.duel.code, shared.duel.code, 'sharing twice gives the same duel');

      const code = shared.duel.code;
      const own = await app.inject({ method: 'POST', url: '/api/runs', headers: auth(60), payload: { duel: code } });
      assert.equal(own.statusCode, 422);
      const missing = await app.inject({ method: 'POST', url: '/api/runs', headers: auth(61), payload: { duel: 'zzzzzzzz' } });
      assert.equal(missing.statusCode, 404);

      const preview = (await app.inject({ method: 'GET', url: `/api/duels/${code}`, headers: auth(61) })).json().duel;
      assert.equal(preview.challengerName, 'P60');
      assert.equal(preview.mine, false);
      assert.equal(preview.challengerId, undefined, 'player ids are not exposed');
      const ownPreview = (await app.inject({ method: 'GET', url: `/api/duels/${code}`, headers: auth(60) })).json().duel;
      assert.equal(ownPreview.mine, true);
      assert.deepEqual(preview.team, aState.team.map(({ id, atk, hp, xp }) => ({ id, atk, hp, xp })));

      const b = (await app.inject({ method: 'POST', url: '/api/runs', headers: auth(61), payload: { duel: code } })).json().run;
      assert.equal(b.duel, code);
      assert.equal(b.state.seed, aState.seed);
      assert.deepEqual(b.state.shop, new Run(aState.seed).s.shop, 'same first shop as the challenger');

      const bLast = await playToEnd(61, b);
      assert.ok(bLast.duel, 'the last turn includes the duel battle');
      assert.equal(bLast.duel.challengerName, 'P60');
      const strip = (t: { id: string; atk: number; hp: number; xp: number }[]) => t.map(({ id, atk, hp, xp }) => ({ id, atk, hp, xp }));
      assert.deepEqual(strip(bLast.duel.battle.start.right), strip(aState.team));
      assert.deepEqual(strip(bLast.duel.battle.start.left), strip(bLast.run.state.team));
      assert.deepEqual(notified.at(-1), { challengerId: 60, friend: 'P61', result: bLast.duel.battle.result });

      const inbox = (await app.inject({ method: 'GET', url: '/api/duels', headers: auth(60) })).json().results;
      assert.deepEqual(inbox, [{ userName: 'P61', wins: bLast.run.state.wins, result: bLast.duel.battle.result, isNew: true }]);
      const seen = (await app.inject({ method: 'GET', url: '/api/duels', headers: auth(60) })).json().results;
      assert.equal(seen[0].isNew, false);
    });

    test('chat leaderboard counts runs started from that chat only', async () => {
      const outside = await app.inject({ method: 'GET', url: '/api/chat', headers: auth(70) });
      assert.deepEqual(outside.json(), { top: null });

      for (const [id, chat] of [[70, 'c1'], [71, 'c1'], [72, 'c2']] as const) {
        const r = (await app.inject({ method: 'POST', url: '/api/runs', headers: chatAuth(id, chat) })).json().run;
        await playToEnd(id, r);
      }
      // A run started outside the chat does not count there.
      await app.inject({ method: 'POST', url: '/api/runs', headers: auth(73) });

      const top = (await app.inject({ method: 'GET', url: '/api/chat', headers: chatAuth(70, 'c1') })).json().top;
      assert.deepEqual(top.map((e: { name: string }) => e.name).sort(), ['P70', 'P71']);
      assert.ok(top.every((e: { bestWins: number; runs: number }) => e.runs === 1 && e.bestWins >= 0));
      assert.ok(top.every((e: { bestWins: number }, i: number) => i === 0 || top[i - 1].bestWins >= e.bestWins), 'best first');
      assert.equal(top.find((e: { name: string }) => e.name === 'P70').me, true);
      assert.equal(top.find((e: { name: string }) => e.name === 'P71').me, false);
      assert.equal(top[0].userId, undefined, 'player ids are not exposed');
    });

    test('daily challenge: same seed for everyone, one attempt, ranked', async () => {
      const date = dayOf(clock);
      const daily = async (id: number) => (await app.inject({ method: 'GET', url: '/api/daily', headers: auth(id) })).json().daily;
      const startDaily = (id: number) => app.inject({ method: 'POST', url: '/api/runs', headers: auth(id), payload: { daily: true } });

      assert.deepEqual(await daily(90), { date, status: 'none', top: [], rank: null });
      const a = (await startDaily(90)).json().run;
      assert.equal(a.daily, date);
      assert.equal(a.state.seed, dailySeed(date));
      assert.equal((await startDaily(90)).json().run.id, a.id, 'an unfinished daily run is resumed');
      assert.equal((await daily(90)).status, 'active');

      const b = (await startDaily(91)).json().run;
      assert.deepEqual(b.state.shop, a.state.shop, 'everyone gets the same first shop');

      const aEnd = (await playToEnd(90, a)).run.state;
      const again = await startDaily(90);
      assert.equal(again.statusCode, 409, 'one attempt per day');
      const bEnd = (await playToEnd(91, b)).run.state;

      const aBetter = aEnd.wins > bEnd.wins || (aEnd.wins === bEnd.wins && aEnd.lives >= bEnd.lives);
      const da = await daily(90);
      assert.equal(da.status, 'finished');
      assert.equal(da.rank, aBetter ? 1 : 2);
      assert.equal((await daily(91)).rank, aBetter ? 2 : 1);
      assert.deepEqual(da.top.map((e: { name: string }) => e.name), aBetter ? ['P90', 'P91'] : ['P91', 'P90']);
      assert.equal(da.top.find((e: { name: string }) => e.name === 'P90').me, true);

      clock += 24 * 3600 * 1000;
      const next = await daily(90);
      assert.equal(next.status, 'none', 'a new day brings a new attempt');
      assert.notEqual(dailySeed(next.date), dailySeed(date));
      clock -= 24 * 3600 * 1000;
    });

    test('weekly league: first runs of a day earn points, the week settles', async () => {
      const saved = clock;
      clock = Date.parse('2030-01-08T12:00:00+03:00');
      const league = async (id: number) => (await app.inject({ method: 'GET', url: '/api/league', headers: auth(id) })).json().league;
      const play = async (id: number) => (await playToEnd(id, (await app.inject({ method: 'POST', url: '/api/runs', headers: auth(id) })).json().run)).run.state.wins as number;

      const fresh = await league(100);
      assert.equal(fresh.week, '2030-01-07');
      assert.equal(fresh.endsAt, '2030-01-13T21:00:00.000Z');
      assert.deepEqual([fresh.league, fresh.points, fresh.rank, fresh.size, fresh.runsToday], [0, 0, null, 0, 0]);

      const wins = [await play(100), await play(100), await play(100), await play(100)];
      const a = await league(100);
      assert.equal(a.points, wins[0] + wins[1] + wins[2], 'only three runs a day count');
      assert.equal(a.runsToday, 3);
      clock += 24 * 3600 * 1000;
      assert.equal((await league(100)).runsToday, 0, 'a new day counts again');
      const extra = await play(100);
      assert.equal((await league(100)).points, a.points + extra);

      const bWins = await play(101);
      const aPoints = a.points + extra;
      const b = await league(101);
      assert.equal(b.size, 2);
      const aFirst = aPoints >= bWins;
      assert.equal(b.rank, aFirst ? 2 : 1);
      assert.deepEqual(b.top.map((e: { name: string }) => e.name), aFirst ? ['P100', 'P101'] : ['P101', 'P100']);
      assert.equal(b.up, 1);
      assert.equal(b.down, 0, 'bronze has no way down');

      clock += 7 * 24 * 3600 * 1000;
      const next = await league(aFirst ? 100 : 101);
      const winnerPoints = aFirst ? aPoints : bWins;
      assert.equal(next.week, '2030-01-14');
      assert.equal(next.league, winnerPoints > 0 ? 1 : 0, 'the leader goes up');
      assert.equal(next.moved, winnerPoints > 0 ? 1 : 0);
      assert.equal(next.points, 0);
      const other = await league(aFirst ? 101 : 100);
      assert.deepEqual([other.league, other.moved], [0, 0]);
      await play(aFirst ? 100 : 101);
      assert.equal((await league(aFirst ? 100 : 101)).league, next.league, 'the placement sticks once the player plays');
      clock = saved;
    });

    test('ordinary runs have no duel battle', async () => {
      const r = (await app.inject({ method: 'POST', url: '/api/runs', headers: auth(62) })).json().run;
      assert.equal(r.duel, null);
      const last = await playToEnd(62, r);
      assert.equal(last.duel, undefined);
    });

    test('a new run replaces the active one and stats count both', async () => {
      await app.inject({ method: 'POST', url: '/api/runs', headers: auth(1) });
      const me = (await app.inject({ method: 'GET', url: '/api/me', headers: auth(1) })).json();
      assert.equal(me.stats.runs, 2);
      assert.equal(me.user.name, 'P1');
    });
  });
}
