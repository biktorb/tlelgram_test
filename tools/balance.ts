// Headless balance check: bots play full runs against recorded ghost teams,
// exactly like real players will. Usage: node tools/balance.ts [runs]
import { def, Rng, RULES, SHOP_UNITS } from '../packages/core/src/index.ts';
import { greedy, playRun, randomBot, type RunStats } from './bots.ts';

const RUNS = Number(process.argv[2] ?? 3000);
if (process.env.OTRYAD_LIVES) RULES.lives = Number(process.env.OTRYAD_LIVES);
const SECONDS_PER_SHOP = 40; // rough guess for a human shop phase
const SECONDS_PER_EXCHANGE = 0.9; // animation time per attack exchange

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
