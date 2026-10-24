// Headless balance check: bots play full runs against recorded ghost teams,
// exactly like real players will. Usage: node tools/balance.ts [runs]
import { def, levelOf, Rng, Run, RULES, SHOP_UNITS, type Unit } from '../packages/core/src/index.ts';
import { battle } from '../packages/core/src/battle.ts';

const RUNS = Number(process.argv[2] ?? 3000);
if (process.env.OTRYAD_LIVES) RULES.lives = Number(process.env.OTRYAD_LIVES);
const SECONDS_PER_SHOP = 40; // rough guess for a human shop phase
const SECONDS_PER_EXCHANGE = 0.9; // animation time per attack exchange

type Bot = (run: Run, rng: Rng) => void;

function value(u: { id: string; atk: number; hp: number }): number {
  return u.atk + u.hp + def(u.id).tier * 1.5;
}

function frontScore(u: Unit): number {
  const t = def(u.id).trigger;
  let s = u.hp * 2 + u.atk;
  if (t === 'faint' || t === 'hurt') s += 5;
  if (t === 'startBattle' || t === 'endTurn' || t === 'startTurn' || t === 'friendSummoned') s -= 6;
  return s;
}

function arrange(run: Run): void {
  const order = run.s.team.slice().sort((a, b) => frontScore(b) - frontScore(a));
  run.s.team = order;
}

function greedy(favorite?: string): Bot {
  return (run) => {
    let rerolls = 0;
    for (let step = 0; step < 40; step++) {
      const s = run.s;
      const shop = s.shop;
      const mergeIdx = shop.findIndex((x) => s.team.some((t) => t.id === x.id && t.xp < 5));
      if (s.gold >= 3 && mergeIdx >= 0) {
        const team = s.team.findIndex((t) => t.id === shop[mergeIdx].id && t.xp < 5);
        run.apply({ a: 'buyMerge', shop: mergeIdx, team });
        continue;
      }
      const ranked = shop
        .map((x, i) => ({ i, v: value(x) + (x.id === favorite ? 100 : 0) }))
        .sort((a, b) => b.v - a.v);
      const best = ranked[0];
      if (s.gold >= 3 && best && s.team.length < 5) {
        run.apply({ a: 'buy', shop: best.i, pos: s.team.length });
        continue;
      }
      if (s.gold >= 3 && best && s.team.length === 5) {
        const weakest = s.team
          .map((t, i) => ({ i, v: value(t) + levelOf(t.xp) * 3 + (t.id === favorite ? 100 : 0) }))
          .sort((a, b) => a.v - b.v)[0];
        if (best.v > weakest.v + 3) {
          run.apply({ a: 'sell', team: weakest.i });
          continue;
        }
      }
      if (s.gold >= 1 && rerolls < 4 && (s.gold >= 3 || s.team.length === 5)) {
        rerolls++;
        run.apply({ a: 'reroll' });
        continue;
      }
      break;
    }
    arrange(run);
  };
}

const randomBot: Bot = (run, rng) => {
  for (let step = 0; step < 20; step++) {
    const s = run.s;
    if (s.gold >= 3 && s.team.length < 5 && s.shop.length > 0) {
      run.apply({ a: 'buy', shop: rng.int(s.shop.length), pos: rng.int(s.team.length + 1) });
    } else break;
  }
};

interface RunStats {
  wins: number;
  rounds: number;
  exchanges: number;
  draws: number;
  team: Unit[];
}

const pool = new Map<number, Unit[][]>();

function ghost(round: number, rng: Rng): Unit[] {
  for (let r = round; r >= 1; r--) {
    const list = pool.get(r);
    if (list && list.length > 0) return list[rng.int(list.length)];
  }
  return [];
}

function record(round: number, team: Unit[]): void {
  const list = pool.get(round) ?? [];
  list.push(team);
  if (list.length > 400) list.shift();
  pool.set(round, list);
}

function playRun(bot: Bot, seed: number, recordGhosts: boolean): RunStats {
  const rng = new Rng(seed ^ 0x9e3779b9);
  const run = new Run(seed);
  let exchanges = 0;
  let draws = 0;
  while (!run.s.finished) {
    bot(run, rng);
    const team = run.endTurn();
    const round = run.s.round;
    const opp = ghost(round, rng);
    if (recordGhosts) record(round, team);
    const out = run.fight(opp, rng.int(1e9));
    exchanges += out.events.filter((e) => e.t === 'attack').length;
    if (out.result === 'draw') draws++;
    if (run.s.round > 40) break;
  }
  return { wins: run.s.wins, rounds: run.s.history.length, exchanges, draws, team: run.s.team };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
}

function pct(xs: number[], p: number): number {
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

// 1. Warm up the ghost pool with a mixed population (70% greedy, 30% random).
const warm = new Rng(1);
for (let i = 0; i < RUNS; i++) {
  const bot = warm.next() < 0.7 ? greedy() : randomBot;
  playRun(bot, warm.int(1e9), true);
}

// 2. Baseline greedy bot.
const base: RunStats[] = [];
for (let i = 0; i < RUNS; i++) base.push(playRun(greedy(), 1_000_000 + i, true));

const rounds = base.map((r) => r.rounds);
const minutes = base.map((r) => (r.rounds * SECONDS_PER_SHOP + r.exchanges * SECONDS_PER_EXCHANGE) / 60);
const battleSec = base.map((r) => (r.exchanges / Math.max(1, r.rounds)) * SECONDS_PER_EXCHANGE);
const baseWins = mean(base.map((r) => r.wins));

console.log(`Runs: ${RUNS} per group`);
console.log(`Greedy bot: avg wins ${baseWins.toFixed(2)}, 10-win runs ${(100 * mean(base.map((r) => (r.wins >= 10 ? 1 : 0)))).toFixed(1)}%`);
console.log(`Rounds per run: median ${pct(rounds, 0.5)}, p10 ${pct(rounds, 0.1)}, p90 ${pct(rounds, 0.9)}`);
console.log(`Run length, min (est.): median ${pct(minutes, 0.5).toFixed(1)}, p10 ${pct(minutes, 0.1).toFixed(1)}, p90 ${pct(minutes, 0.9).toFixed(1)}`);
console.log(`Battle length, s (est.): median ${pct(battleSec, 0.5).toFixed(1)}`);
console.log(`Draw rate: ${(100 * mean(base.map((r) => r.draws / Math.max(1, r.rounds)))).toFixed(1)}%`);

// 3. Unit strength: a bot that always prioritises one unit, vs baseline.
const rows: { id: string; tier: number; delta: number; wins: number }[] = [];
for (const u of SHOP_UNITS) {
  const res: number[] = [];
  const n = Math.max(200, Math.floor(RUNS / 4));
  for (let i = 0; i < n; i++) res.push(playRun(greedy(u.id), 2_000_000 + i, false).wins);
  const w = mean(res);
  rows.push({ id: u.id, tier: u.tier, wins: w, delta: w - baseWins });
}
rows.sort((a, b) => b.delta - a.delta);
console.log('\nUnit priority test (avg wins when a bot always prefers this unit, vs baseline):');
for (const r of rows) {
  const flag = r.delta > 0.6 ? '  <-- strong' : r.delta < -0.6 ? '  <-- weak' : '';
  console.log(`  T${r.tier} ${def(r.id).name.padEnd(12)} ${r.wins.toFixed(2)}  (${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)})${flag}`);
}
