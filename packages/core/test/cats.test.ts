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
  const elite = (evo: boolean) => {
    // An elite drops its chest under the cat; only one that came at 10:00
    // or later can evolve.
    const p = run.player;
    run.pickups.push({ id: 9999, kind: 'chest', x: p.x, y: p.y, got: false, evo });
    run.step(0);
  };
  elite(true);
  assert.equal(run.evolved.claws, undefined);
  assert.ok(run.lvl('box') >= 2, 'the chest levelled up the only open item');
  run.items.belly = 1;
  assert.deepEqual(run.evolvable(), ['claws']);
  elite(false);
  assert.equal(run.evolved.claws, undefined, 'an early chest does not evolve');
  elite(true);
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
  const bot = cats.playBot(3, cats.BOT_STYLES.ranged, cats.BOT_SKILLS.casual, { hero: 'murka' });
  const rec = bot.record();
  assert.deepEqual(cats.replay(3, rec, { hero: 'murka' }).result(), bot.run.result());
  assert.equal(cats.analyze(3, rec, { hero: 'murka' }).kills, bot.run.kills);
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

test('an item never goes past its last level, even when a chest maxed it while cards were shown', () => {
  const run = new cats.CatRun(1);
  run.items.pot = cats.WEAPON_MAX;
  run.pending = ['pot', 'snack', 'fishes'];
  const fish = run.fish;
  run.choose(0);
  assert.equal(run.lvl('pot'), cats.WEAPON_MAX);
  assert.equal(run.fish, fish + 10);
  run.step(0);
  assert.equal(run.over, false);
});

test('every room plays with its own enemies, walls and boss, and replays the same', () => {
  for (const room of cats.ROOM_IDS) {
    const bot = cats.playBot(7, cats.BOT_STYLES.mixed, cats.BOT_SKILLS.casual, { room });
    const run = bot.run;
    assert.equal(run.room, room);
    assert.deepEqual(cats.replay(7, bot.record(), { room }).result(), run.result(), room);
    const b = run.map.bounds;
    if (b) assert.ok(run.player.y >= b.minY && run.player.y <= b.maxY && run.player.x >= b.minX && run.player.x <= b.maxX, `${room}: the cat stays inside`);
  }
  // The yard's enemies come from its own waves.
  const yard = new cats.CatRun(3, { room: 'yard' });
  for (let i = 0; i < 90; i++) yard.step(0);
  assert.ok(yard.enemies.length > 0 && yard.enemies.every((e) => e.kind === 'crow'));
  // A hose comes as a chain of segments.
  const hall = new cats.CatRun(3, { room: 'warehouse' });
  for (let i = 0; i < 1.5 * 60 * 30 && !hall.over; i++) {
    hall.step(0);
    hall.player.hp = hall.player.maxHp;
    while (hall.pending) hall.choose(0);
  }
  assert.ok(hall.enemies.some((e) => e.kind === 'hose' && e.leader));
});

test('enemies keep their strength all run; swarms and the wall come by the wave table', () => {
  const run = new cats.CatRun(5, { room: 'flat' });
  const seen = new Set<string>();
  let swarm = 0;
  let wall = 0;
  for (let i = 0; i < 11 * 60 * 30 && !run.over; i++) {
    run.step(0);
    run.player.hp = run.player.maxHp;
    while (run.pending) run.choose(0);
    for (const e of run.enemies) {
      if (e.elite || e.kind === 'wall') continue;
      if (e.swarm) swarm++;
      else assert.equal(e.maxHp, cats.ENEMIES[e.kind].hp, e.kind);
      seen.add(e.kind);
    }
    if (run.enemies.some((e) => e.kind === 'wall')) wall++;
  }
  // Minute 2 always has a swarm of mice, minutes 5 and 10 a wall.
  assert.ok(swarm > 0, 'a swarm flew by');
  assert.ok(wall > 0, 'the wall closed in');
  for (const k of ['mouse', 'redmouse', 'dust', 'mite', 'wetbot', 'robot', 'rat']) assert.ok(seen.has(k), k);
});

test('a pot passes through as many enemies as the VS axe pierces', () => {
  for (const [lvl, hits] of [[1, 3], [8, 7]]) {
    const run = new CatRun(1, { events: false }) as any;
    run.items = { pot: lvl };
    run.enemies = [];
    for (let k = 0; k < 40; k++) {
      const e = run.spawn('bigvac');
      e.hp = e.maxHp = 1e9;
      e.r = 6;
      e.x = run.player.x;
      e.y = run.player.y - 10 - k * 4;
    }
    run.fire('pot', run.weaponStats('pot'), 0, 1, 0);
    const shot = run.shots[0];
    for (let t = 0; t < 60 && shot.life > 0; t++) run.moveShots();
    assert.equal(shot.hits.length, hits, `level ${lvl}`);
  }
});

test('things on the floor come from breakables, the rare ones from a cat level', () => {
  const run = new CatRun(3, { events: false });
  const got = new Set<string>();
  let props = 0;
  for (let i = 0; i < 8 * 60 * 30 && !run.over; i++) {
    run.step(0);
    run.player.hp = run.player.maxHp;
    while (run.pending) run.choose(0);
    props = Math.max(props, run.props.length);
    for (const it of run.pickups) if (it.kind !== 'chest') got.add(`${it.kind}@${run.level}`);
  }
  assert.ok(props > 0, 'a breakable turned up');
  for (const k of got) {
    const [kind, level] = k.split('@');
    assert.ok(Number(level) >= cats.PICKUP_TABLE[kind as keyof typeof cats.PICKUP_TABLE].level, k);
  }
});

test('the boss has health per cat level, like the elites', () => {
  const run = new CatRun(4, { events: false });
  run.level = 50;
  while (run.tick < cats.BOSS_TICK) {
    run.step(0);
    run.player.hp = run.player.maxHp;
    while (run.pending) run.choose(0);
    run.level = 50;
  }
  const boss = run.enemies.find((e) => e.kind === 'mop')!;
  assert.equal(boss.maxHp, cats.ENEMIES.mop.hp * 50);
});
