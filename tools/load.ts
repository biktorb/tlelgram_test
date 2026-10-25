// Load check for a running server started with DEV_AUTH=1:
//   node tools/load.ts http://localhost:3000 200 5
// Plays <players> runs in parallel, <turns> turns each, and reports latency.
import { Run } from '../packages/core/src/index.ts';

const [base = 'http://localhost:3000', playersArg = '200', turnsArg = '5'] = process.argv.slice(2);
const PLAYERS = Number(playersArg);
const TURNS = Number(turnsArg);
const latencies: number[] = [];
let errors = 0;

async function call(userId: number, method: string, path: string, body?: unknown) {
  const t = performance.now();
  const res = await fetch(base + path, {
    method,
    headers: { authorization: `dev ${userId}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  latencies.push(performance.now() - t);
  if (!res.ok) {
    errors++;
    throw new Error(`${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function player(userId: number) {
  let { run } = await call(userId, 'POST', '/api/runs');
  for (let t = 0; t < TURNS && !run.state.finished; t++) {
    const local = new Run(run.state.seed, run.state);
    const actions = [];
    while (local.s.gold >= 3 && local.s.team.length < 5 && local.s.shop.length > 0) {
      const action = { a: 'buy' as const, shop: 0, pos: local.s.team.length };
      local.apply(action);
      actions.push(action);
    }
    ({ run } = await call(userId, 'POST', `/api/runs/${run.id}/turn`, { version: run.version, actions }));
  }
}

const started = performance.now();
const results = await Promise.allSettled(Array.from({ length: PLAYERS }, (_, i) => player(900000 + i)));
const seconds = (performance.now() - started) / 1000;
const failed = results.filter((r) => r.status === 'rejected');
latencies.sort((a, b) => a - b);
const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))].toFixed(0);
console.log(`${PLAYERS} players x ${TURNS} turns: ${latencies.length} requests in ${seconds.toFixed(1)} s`);
console.log(`latency ms: p50 ${pct(0.5)}, p95 ${pct(0.95)}, max ${pct(1)}`);
console.log(`failed players: ${failed.length}, error responses: ${errors}`);
if (failed.length) console.log(String((failed[0] as PromiseRejectedResult).reason));
