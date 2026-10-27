import type { CardId, EnemyKind, ItemId, WeaponId } from './content.ts';
import { decodeMoves, type RunRecord } from './record.ts';
import { CatRun, TICK_RATE } from './sim.ts';

// What a player's run looked like, from its record: where the damage came
// from, how the minutes went and what was picked. The owner's admin page
// shows it to see how people actually play.
export interface RunInsight {
  won: boolean;
  seconds: number;
  kills: number;
  level: number;
  deathBy: EnemyKind | null; // who landed the last hit of a lost run
  firstHit: number | null; // seconds into the run
  moving: number; // share of the time the stick was held
  turns: number; // direction changes per minute while moving
  hurt: Partial<Record<EnemyKind, { hits: number; dmg: number }>>;
  minutes: MinuteInsight[];
  picks: { s: number; card: CardId; reroll: boolean }[];
  chests: number;
  evolved: WeaponId[];
  items: Partial<Record<ItemId, number>>;
}

// One minute of the run; the last one may be partial.
export interface MinuteInsight {
  hp: number; // at the end of the minute, % of max
  hits: number;
  dmg: number;
  kills: number;
  level: number;
  enemies: number; // on the field at the end of the minute
}

const MINUTE = 60 * TICK_RATE;

export function analyze(seed: number, rec: RunRecord): RunInsight {
  if (!/^[0-9r]*$/.test(rec.picks) || rec.picks.length > 400) throw new Error('bad picks');
  const dirs = decodeMoves(rec.moves);
  const run = new CatRun(seed, { events: true });
  const out: RunInsight = {
    won: false,
    seconds: 0,
    kills: 0,
    level: 1,
    deathBy: null,
    firstHit: null,
    moving: 0,
    turns: 0,
    hurt: {},
    minutes: [],
    picks: [],
    chests: 0,
    evolved: [],
    items: {},
  };
  let minute: MinuteInsight = { hp: 100, hits: 0, dmg: 0, kills: 0, level: 1, enemies: 0 };
  let lastKind: EnemyKind | null = null;
  let moving = 0;
  let turns = 0;
  let lastDir = 0;
  let reroll = false;
  let pick = 0;
  let i = 0;
  const close = () => {
    const p = run.player;
    minute.hp = Math.round((p.hp / p.maxHp) * 100);
    minute.level = run.level;
    minute.enemies = run.enemies.length;
    out.minutes.push(minute);
    minute = { hp: 0, hits: 0, dmg: 0, kills: 0, level: 0, enemies: 0 };
  };
  while (!run.over) {
    if (run.pending) {
      const c = rec.picks[pick++];
      if (c === 'r') {
        run.reroll();
        reroll = true;
        continue;
      }
      const k = run.pending[c ? Number(c) : 0] ?? run.pending[0];
      out.picks.push({ s: Math.round(run.tick / TICK_RATE), card: k, reroll });
      reroll = false;
      run.choose(c ? Number(c) : 0);
      continue;
    }
    const dir = i < dirs.length ? dirs[i] : 0;
    i++;
    if (dir) {
      moving++;
      if (lastDir && dir !== lastDir) turns++;
    }
    if (dir) lastDir = dir;
    run.step(dir);
    for (const e of run.events) {
      if (e.t === 'hurt') {
        const h = (out.hurt[e.kind] ??= { hits: 0, dmg: 0 });
        h.hits++;
        h.dmg += e.dmg;
        minute.hits++;
        minute.dmg += e.dmg;
        lastKind = e.kind;
        out.firstHit ??= Math.round((run.tick / TICK_RATE) * 10) / 10;
      } else if (e.t === 'kill') minute.kills++;
      else if (e.t === 'chest') out.chests++;
    }
    if (run.tick % MINUTE === 0 || run.over) close();
  }
  const r = run.result();
  out.won = r.won;
  out.seconds = Math.round(r.ticks / TICK_RATE);
  out.kills = r.kills;
  out.level = r.level;
  out.deathBy = r.won ? null : lastKind;
  out.moving = run.tick ? Math.round((moving / run.tick) * 100) / 100 : 0;
  out.turns = moving ? Math.round((turns / (moving / MINUTE)) * 10) / 10 : 0;
  out.evolved = Object.keys(r.evolved) as WeaponId[];
  out.items = r.items;
  return out;
}

// Totals over many runs: when players die, from what, and how fast it hurts.
export interface InsightSummary {
  runs: number;
  wins: number;
  medianSeconds: number;
  deathMinute: number[]; // lost runs by the minute they ended in
  deathBy: Partial<Record<EnemyKind, number>>;
  hurt: Partial<Record<EnemyKind, { hits: number; dmg: number }>>;
  // Average over runs still alive at the start of each minute.
  perMinute: { alive: number; hits: number; dmg: number; hp: number }[];
  medianFirstHit: number | null;
  picks: Partial<Record<CardId, number>>; // how often each card was taken
}

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export function summarize(list: RunInsight[]): InsightSummary {
  const sum: InsightSummary = {
    runs: list.length,
    wins: list.filter((r) => r.won).length,
    medianSeconds: median(list.map((r) => r.seconds)),
    deathMinute: [],
    deathBy: {},
    hurt: {},
    perMinute: [],
    medianFirstHit: null,
    picks: {},
  };
  const firsts = list.map((r) => r.firstHit).filter((s): s is number => s !== null);
  if (firsts.length) sum.medianFirstHit = median(firsts);
  for (const r of list) {
    if (!r.won) {
      const m = Math.floor(r.seconds / 60);
      while (sum.deathMinute.length <= m) sum.deathMinute.push(0);
      sum.deathMinute[m]++;
      if (r.deathBy) sum.deathBy[r.deathBy] = (sum.deathBy[r.deathBy] ?? 0) + 1;
    }
    for (const [k, h] of Object.entries(r.hurt) as [EnemyKind, { hits: number; dmg: number }][]) {
      const t = (sum.hurt[k] ??= { hits: 0, dmg: 0 });
      t.hits += h.hits;
      t.dmg += h.dmg;
    }
    r.minutes.forEach((m, i) => {
      const row = (sum.perMinute[i] ??= { alive: 0, hits: 0, dmg: 0, hp: 0 });
      row.alive++;
      row.hits += m.hits;
      row.dmg += m.dmg;
      row.hp += m.hp;
    });
    for (const p of r.picks) sum.picks[p.card] = (sum.picks[p.card] ?? 0) + 1;
  }
  for (const row of sum.perMinute) {
    row.hits = Math.round((row.hits / row.alive) * 10) / 10;
    row.dmg = Math.round(row.dmg / row.alive);
    row.hp = Math.round(row.hp / row.alive);
  }
  return sum;
}
