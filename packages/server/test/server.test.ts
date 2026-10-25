import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ActionError, Rng, Run, type Action, type RunState } from '@otryad/core';
import { buildApp } from '../src/app.ts';
import { signInitData, verifyInitData } from '../src/auth.ts';
import type { Config } from '../src/config.ts';
import { seedGhosts } from '../src/game.ts';
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

    before(async () => {
      store = await makeStore();
      await seedGhosts(store, BOT_TEAMS);
      app = await buildApp(config, store);
    });
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

    test('a new run replaces the active one and stats count both', async () => {
      await app.inject({ method: 'POST', url: '/api/runs', headers: auth(1) });
      const me = (await app.inject({ method: 'GET', url: '/api/me', headers: auth(1) })).json();
      assert.equal(me.stats.runs, 2);
      assert.equal(me.user.name, 'P1');
    });
  });
}
