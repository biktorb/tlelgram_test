// Generates the bundled ghost teams the prototype fights against until a
// server exists. Usage: node tools/ghosts.ts > packages/client/src/ghosts.json
import { Rng } from '../packages/core/src/index.ts';
import { greedy, playRun, pool, randomBot } from './bots.ts';

const PER_ROUND = 40;
const MAX_ROUND = 20;

const rng = new Rng(20261024);
for (let i = 0; i < 3000; i++) {
  playRun(rng.next() < 0.75 ? greedy() : randomBot, rng.int(1e9), true);
}

const out: Record<number, { id: string; atk: number; hp: number; xp: number }[][]> = {};
for (let round = 1; round <= MAX_ROUND; round++) {
  const teams = pool.get(round) ?? [];
  out[round] = rng
    .sample(teams.filter((t) => t.length > 0), PER_ROUND)
    .map((t) => t.map(({ id, atk, hp, xp }) => ({ id, atk, hp, xp })));
}
process.stdout.write(JSON.stringify(out) + '\n');
