// Load check for a running server started with DEV_AUTH=1:
//   node tools/load.ts http://localhost:3000 50
// <players> players start a run and finish it at the same time. A finish is
// the heavy request: the server replays the whole run to check it. The record
// is empty (the cat stands still), so the replay runs until the cat is caught.

const [base = 'http://localhost:3000', playersArg = '50'] = process.argv.slice(2);
const PLAYERS = Number(playersArg);
const latencies: Record<string, number[]> = { start: [], finish: [] };
let errors = 0;

async function call(kind: string, userId: number, method: string, path: string, body?: unknown) {
  const t = performance.now();
  const res = await fetch(base + path, {
    method,
    headers: { authorization: `dev ${userId}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  latencies[kind].push(performance.now() - t);
  if (!res.ok) {
    errors++;
    throw new Error(`${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function player(userId: number) {
  const { run } = await call('start', userId, 'POST', '/api/runs', { mode: 'free' });
  await call('finish', userId, 'POST', `/api/runs/${run.id}/finish`, { moves: '', picks: '' });
}

const started = performance.now();
const results = await Promise.allSettled(Array.from({ length: PLAYERS }, (_, i) => player(900000 + i)));
const seconds = (performance.now() - started) / 1000;
const failed = results.filter((r) => r.status === 'rejected');
console.log(`${PLAYERS} players in ${seconds.toFixed(1)} s`);
for (const [kind, list] of Object.entries(latencies)) {
  list.sort((a, b) => a - b);
  const pct = (p: number) => (list.length ? list[Math.min(list.length - 1, Math.floor(p * list.length))].toFixed(0) : '-');
  console.log(`${kind} latency ms: p50 ${pct(0.5)}, p95 ${pct(0.95)}, max ${pct(1)}`);
}
console.log(`failed players: ${failed.length}, error responses: ${errors}`);
if (failed.length) console.log(String((failed[0] as PromiseRejectedResult).reason));
