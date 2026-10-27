import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cats } from '../src/index.ts';

const { BOT_SKILLS, BOT_STYLES, CatRun, RUN_TICKS, Recorder, decodeMoves, dcos, dirFromVector, dsin, playBot, replay } = cats;

test('dsin and dcos match Math.sin and Math.cos', () => {
  for (let a = -50; a <= 50; a += 0.0137) {
    assert.ok(Math.abs(dsin(a) - Math.sin(a)) < 1e-8, `sin ${a}`);
    assert.ok(Math.abs(dcos(a) - Math.cos(a)) < 1e-8, `cos ${a}`);
  }
});

test('replaying a record gives exactly the same run', () => {
  const styles = Object.values(BOT_STYLES);
  for (let seed = 1; seed <= 6; seed++) {
    const rec = playBot(seed, styles[seed % styles.length], seed % 2 ? BOT_SKILLS.casual : BOT_SKILLS.slow);
    const again = replay(seed, rec.record());
    assert.deepEqual(again.result(), rec.run.result());
    assert.equal(again.player.x, rec.run.player.x);
    assert.equal(again.player.hp, rec.run.player.hp);
    assert.equal(again.rng.state, rec.run.rng.state);
  }
});

test('the same seed spawns the same enemies', () => {
  const a = new CatRun(7);
  const b = new CatRun(7);
  for (let i = 0; i < 300; i++) {
    a.step(0);
    b.step(0);
  }
  assert.deepEqual(
    a.enemies.map((e) => [e.kind, e.x, e.y]),
    b.enemies.map((e) => [e.kind, e.x, e.y]),
  );
  assert.ok(a.enemies.length > 0);
});

test('a cat that never moves does not survive', () => {
  const run = replay(3, { moves: '', picks: '' });
  assert.equal(run.over, true);
  assert.equal(run.won, false);
  assert.ok(run.tick < RUN_TICKS);
});

test('a cut-off record still ends the run', () => {
  const rec = playBot(5, BOT_STYLES.mixed, BOT_SKILLS.casual).record();
  const run = replay(5, { moves: rec.moves.slice(0, 20), picks: rec.picks.slice(0, 2) });
  assert.equal(run.over, true);
});

test('the run waits while an upgrade is offered', () => {
  const run = new CatRun(11);
  while (!run.pending && !run.over) run.step(0);
  assert.ok(run.pending);
  const tick = run.tick;
  run.step(1);
  assert.equal(run.tick, tick);
  const offered = run.pending[1] as cats.ItemId;
  const before = run.lvl(offered);
  run.choose(1);
  assert.equal(run.lvl(offered), before + 1);
  assert.equal(run.pending, null);
});

test('moves are run-length encoded and checked', () => {
  const rec = new Recorder(new CatRun(1));
  for (const d of [0, 0, 0, 5, 5, 16]) rec.step(d);
  assert.equal(rec.record().moves, 'a3f2q');
  assert.deepEqual(decodeMoves('a3f2q'), [0, 0, 0, 5, 5, 16]);
  assert.throws(() => decodeMoves('z'));
  assert.throws(() => decodeMoves('a0'));
  assert.throws(() => decodeMoves('3a'));
  assert.throws(() => decodeMoves(`a${cats.END_TICKS + 1}`));
  assert.throws(() => replay(1, { moves: 'a', picks: 'x' }));
});

test('joystick vectors map to the nearest direction', () => {
  assert.equal(dirFromVector(0, 0), 0);
  assert.equal(dirFromVector(1, 0), 1);
  assert.equal(dirFromVector(0, 1), 5); // down on screen
  assert.equal(dirFromVector(-1, 0), 9);
  assert.equal(dirFromVector(0, -1), 13);
});

test('a run stopped halfway continues to the same result', () => {
  const full = playBot(11, BOT_STYLES.mixed, BOT_SKILLS.casual);
  const rec = full.record();
  // The same input in two parts: stop after 2000 ticks, save, continue.
  const dirs = decodeMoves(rec.moves);
  const first = new Recorder(new CatRun(11));
  let i = 0;
  let pick = 0;
  const feed = (r: InstanceType<typeof Recorder>, until: number) => {
    while (!r.run.over && i < until) {
      if (r.run.pending) r.choose(Number(rec.picks[pick++]));
      else r.step(dirs[i++]);
    }
  };
  feed(first, 2000);
  const saved = first.record();
  const second = cats.resume(11, saved);
  assert.equal(second.run.tick, first.run.tick);
  feed(second, dirs.length);
  while (second.run.pending) second.choose(Number(rec.picks[pick++]));
  assert.deepEqual(second.run.result(), full.run.result());
  assert.deepEqual(replay(11, second.record()).result(), full.run.result(), 'the joined record replays the same');
});

test('a reroll swaps the cards once and replays the same', () => {
  const rec = new Recorder(new CatRun(11));
  while (!rec.run.pending) rec.step(0);
  rec.reroll();
  assert.equal(rec.run.rerolls, 0);
  const after = rec.run.pending!.slice();
  rec.reroll(); // none left: nothing changes
  assert.deepEqual(rec.run.pending, after);
  rec.choose(0);
  for (let i = 0; i < 100; i++) rec.step(3);
  const saved = rec.record();
  assert.match(saved.picks, /^r0/);
  const again = replay(11, saved);
  assert.ok(again.lvl(after[0] as cats.ItemId) >= 1);
  assert.deepEqual(cats.resume(11, saved).run.items, rec.run.items);
});

test('weapons go up to 8 and the slots hold 6 of each kind', () => {
  const run = new CatRun(4);
  for (let i = 0; i < 400 && !run.over; i++) {
    run.xp = run.need;
    run.step(0);
    if (run.pending) run.choose(0);
  }
  for (const w of run.weapons()) assert.ok(run.lvl(w) <= 8);
  for (const p of run.passives()) assert.ok(run.lvl(p) <= cats.itemMax(p));
  assert.ok(run.weapons().length <= 6 && run.passives().length <= 6);
});

test('a chest evolves a ready weapon, otherwise levels up items', () => {
  const run = new CatRun(21);
  run.items.claws = 8;
  run.items.box = 1; // not the claws' passive
  const elite = () => {
    // An elite drops its chest under the cat.
    const p = run.player;
    run.pickups.push({ id: 9999, kind: 'chest', x: p.x, y: p.y, got: false });
    run.step(0);
  };
  elite();
  assert.equal(run.evolved.claws, undefined);
  assert.ok(run.lvl('box') >= 2, 'the chest levelled up the only open item');
  run.items.belly = 1;
  assert.deepEqual(run.evolvable(), ['claws']);
  elite();
  assert.equal(run.evolved.claws, true);
  assert.deepEqual(run.evolvable(), []);
});

test('furniture is the same for a seed and the cat cannot walk through it', () => {
  const a = new cats.RoomMap(5);
  const b = new cats.RoomMap(5);
  assert.deepEqual(a.near(2000, -1500, 900), b.near(2000, -1500, 900));
  const all = a.near(0, 0, 3000).slice();
  assert.ok(all.length > 20);
  assert.ok(all.every((f) => Math.abs(f.x + f.w / 2) > 200 || Math.abs(f.y + f.h / 2) > 200), 'the start is clear');
  const f = all[0];
  const [x, y] = a.pushOut(f.x + f.w / 2, f.y + 1, 14);
  assert.ok(x <= f.x - 14 + 1e-9 || x >= f.x + f.w + 14 - 1e-9 || y <= f.y - 14 + 1e-9 || y >= f.y + f.h + 14 - 1e-9);
});

test('at 20:00 the room is won and the Cleaner ends the run', () => {
  const run = new CatRun(8, { events: false });
  while (!run.over && run.tick < cats.RUN_TICKS) {
    if (run.pending) run.choose(0);
    else {
      run.player.inv = 10; // untouchable until 20:00
      run.step(0);
    }
  }
  assert.equal(run.over, false);
  assert.ok(run.enemies.every((e) => e.kind === 'cleaner'));
  while (!run.over) {
    if (run.pending) run.choose(0);
    else run.step(0);
  }
  assert.equal(run.won, true);
  assert.ok(run.tick > cats.RUN_TICKS && run.tick < cats.END_TICKS, 'she catches a cat that stands still');
});

test('a run analysis matches its replay and counts every hit', () => {
  const bot = cats.playBot(5, cats.BOT_STYLES.mixed, cats.BOT_SKILLS.casual);
  const rec = bot.record();
  const r = cats.replay(5, rec).result();
  const a = cats.analyze(5, rec);
  assert.equal(a.won, r.won);
  assert.equal(a.kills, r.kills);
  assert.equal(a.minutes.reduce((n, m) => n + m.kills, 0), r.kills);
  assert.equal(a.minutes.length, Math.ceil(r.ticks / (60 * cats.TICK_RATE)));
  const hits = Object.values(a.hurt).reduce((n, h) => n + h!.hits, 0);
  assert.equal(a.minutes.reduce((n, m) => n + m.hits, 0), hits);
  assert.equal(a.picks.length, r.level - 1);
  if (!a.won) assert.ok(a.deathBy);
  const s = cats.summarize([a, a]);
  assert.equal(s.runs, 2);
  assert.equal(s.perMinute[0].alive, 2);
});

test('every cat starts with its weapon and stats, and its bonus grows', () => {
  for (const id of cats.HERO_IDS) {
    const run = new cats.CatRun(1, { hero: id });
    assert.deepEqual(run.weapons(), [cats.HEROES[id].weapon]);
  }
  const barsik = new cats.CatRun(1, { hero: 'barsik' });
  assert.equal(barsik.player.maxHp, 160);
  assert.ok(barsik.stats.move < cats.BASE_STATS.move);
  assert.equal(barsik.stats.area, 1.1);
  const murka = new cats.CatRun(1, { hero: 'murka' });
  assert.equal(murka.stats.growth, 1.1);
  const snezhok = playTo(new cats.CatRun(1, { hero: 'snezhok' }), 20);
  assert.equal(snezhok.stats.amount, 1 + snezhok.lvl('pack'));
  assert.ok(snezhok.stats.move > cats.BASE_STATS.move);
});

test('a record replays the same with the same cat', () => {
  const bot = cats.playBot(3, cats.BOT_STYLES.ranged, cats.BOT_SKILLS.casual, 'murka');
  const rec = bot.record();
  assert.deepEqual(cats.replay(3, rec, { hero: 'murka' }).result(), bot.run.result());
  assert.equal(cats.analyze(3, rec, 'murka').kills, bot.run.kills);
});

// Gives a run levels by feeding it experience and taking the first card.
function playTo(run: InstanceType<typeof cats.CatRun>, level: number) {
  while (run.level < level && !run.over) {
    run.xp = run.need;
    run.step(0);
    while (run.pending) run.choose(0);
  }
  return run;
}
