import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ActionError, Rng, Run, type Action, type RunState } from '@otryad/core';
import { buildApp } from '../src/app.ts';
import { signInitData, verifyInitData } from '../src/auth.ts';
import type { Config } from '../src/config.ts';
import { seedGhosts, type Notifier } from '../src/game.ts';
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
};

function initData(userId: number, name = 'Маша', authDate = Math.floor(Date.now() / 1000)): string {
  return signInitData(
    { auth_date: String(authDate), query_id: 'AAH', user: JSON.stringify({ id: userId, first_name: name }) },
    TOKEN,
  );
}

const auth = (userId: number) => ({ authorization: `tma ${initData(userId, `P${userId}`)}` });

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

    before(async () => {
      store = await makeStore();
      await seedGhosts(store, BOT_TEAMS);
      app = await buildApp(config, store, { notifier });
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
