import { test } from 'node:test';
import assert from 'node:assert/strict';
import { battle, Run, RULES, type Unit } from '../src/index.ts';

let uid = 0;
const u = (id: string, atk: number, hp: number, xp = 0): Unit => ({ uid: ++uid, id, atk, hp, xp });

test('front units trade hits until one side is empty', () => {
  const out = battle([u('giant', 4, 7)], [u('giant', 4, 3)], 1);
  assert.equal(out.result, 'win');
  assert.equal(out.left[0].hp, 3);
});

test('equal teams draw', () => {
  const out = battle([u('giant', 4, 7)], [u('giant', 4, 7)], 1);
  assert.equal(out.result, 'draw');
});

test('battle is deterministic for the same seed', () => {
  const a = [u('scout', 2, 2), u('mage', 3, 3), u('archer', 2, 3)];
  const b = [u('bomber', 3, 2), u('summoner', 2, 3), u('banner', 2, 2)];
  assert.deepEqual(battle(a, b, 42), battle(a, b, 42));
});

test('battle does not mutate the input teams', () => {
  const a = [u('shield', 1, 5)];
  const b = [u('giant', 4, 7)];
  battle(a, b, 3);
  assert.equal(a[0].hp, 5);
  assert.equal(b[0].hp, 7);
});

test('faint summon appears in the dead unit slot and fights on', () => {
  const out = battle([u('militia', 1, 1)], [u('giant', 1, 2)], 1);
  // militia dies, spirit 1/1 takes the hit back: giant 1/2 -> 0
  assert.ok(out.events.some((e) => e.t === 'summon'));
  assert.equal(out.result, 'draw');
});

test('start of battle sniper hits the weakest enemy', () => {
  const out = battle([u('sniper', 2, 3)], [u('giant', 4, 7), u('scout', 2, 2)], 1);
  const dmg = out.events.find((e) => e.t === 'damage');
  assert.ok(dmg && dmg.t === 'damage' && dmg.amount === 3);
});

test('bomber hurts its own team too', () => {
  const out = battle([u('bomber', 3, 1), u('spirit', 1, 2)], [u('giant', 1, 9)], 1);
  const hitsOnOwn = out.events.filter((e) => e.t === 'damage' && e.side === 0 && e.amount === 2);
  assert.ok(hitsOnOwn.length >= 1);
});

test('a run starts with full gold and a 3-unit shop', () => {
  const run = new Run(7);
  assert.equal(run.s.gold, RULES.goldPerTurn);
  assert.equal(run.s.shop.length, 3);
  assert.ok(run.s.shop.every((s) => s.id && s.atk > 0));
});

test('buying costs gold and rejects a full team', () => {
  const run = new Run(7);
  run.apply({ a: 'buy', shop: 0, pos: 0 });
  assert.equal(run.s.gold, RULES.goldPerTurn - RULES.buyCost);
  assert.equal(run.s.team.length, 1);
  run.s.team = [1, 2, 3, 4, 5].map(() => u('giant', 4, 7));
  assert.throws(() => run.apply({ a: 'buy', shop: 0, pos: 0 }), /полон/);
});

test('merging three copies reaches level 2 and fires levelUp', () => {
  const run = new Run(1);
  // 1 xp (two copies) + one more copy = 2 xp = level 2
  run.s.team = [u('drummer', 2, 3, 1), u('drummer', 2, 3), u('recruit', 2, 2)];
  run.apply({ a: 'merge', from: 1, to: 0 });
  const drummer = run.s.team.find((x) => x.id === 'drummer')!;
  assert.equal(drummer.xp, 2);
  assert.equal(drummer.atk, 3);
  // levelUp: all friends +1/+1 at level 2
  const recruit = run.s.team.find((x) => x.id === 'recruit')!;
  assert.equal(recruit.atk, 3);
});

test('selling refunds gold by level and fires sell ability', () => {
  const run = new Run(1);
  run.s.team = [u('squire', 2, 2), u('giant', 4, 7)];
  const gold = run.s.gold;
  run.apply({ a: 'sell', team: 0 });
  assert.equal(run.s.gold, gold + 1);
  assert.equal(run.s.team[0].hp, 8);
});

test('frozen shop units survive a reroll', () => {
  const run = new Run(3);
  const frozen = run.s.shop[1].id;
  run.apply({ a: 'freeze', shop: 1 });
  run.apply({ a: 'reroll' });
  assert.equal(run.s.shop[0].id, frozen);
  assert.ok(run.s.shop[0].frozen);
});

test('merchant adds gold at start of turn', () => {
  const run = new Run(5);
  run.s.team = [u('merchant', 2, 2)];
  run.endTurn();
  run.fight([], 1);
  assert.equal(run.s.gold, RULES.goldPerTurn + 1);
});

test('losing all lives ends the run', () => {
  const run = new Run(9);
  for (let i = 0; i < RULES.lives; i++) run.fight([u('giant', 50, 50)], i);
  assert.ok(run.s.finished);
  assert.throws(() => run.apply({ a: 'reroll' }));
});

test('a run can be restored from a snapshot and continues identically', () => {
  const a = new Run(11);
  a.apply({ a: 'buy', shop: 0, pos: 0 });
  const snap = a.snapshot();
  const b = new Run(11, snap);
  a.apply({ a: 'reroll' });
  b.apply({ a: 'reroll' });
  assert.deepEqual(a.s.shop, b.s.shop);
});
