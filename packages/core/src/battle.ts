import type { Unit } from './types.ts';
import { def } from './units.ts';
import { Engine, type EngineEvent } from './engine.ts';
import { Rng } from './rng.ts';

export type BattleResult = 'win' | 'loss' | 'draw';

export interface BattleOutcome {
  result: BattleResult; // from the left side's point of view
  events: EngineEvent[];
  left: Unit[]; // survivors
  right: Unit[];
}

const MAX_EXCHANGES = 100;

function cloneTeam(team: readonly Unit[], offset: number): Unit[] {
  return team.map((u, i) => ({ ...u, uid: offset + i + 1 }));
}

// Fully deterministic for a given (left, right, seed). The server re-runs it
// to verify the client's result.
export function battle(leftTeam: readonly Unit[], rightTeam: readonly Unit[], seed: number): BattleOutcome {
  const left = cloneTeam(leftTeam, 0);
  const right = cloneTeam(rightTeam, 100);
  let uid = 1000;
  const eng = new Engine([left, right], new Rng(seed), () => ++uid);

  // Start of battle: strongest attack goes first, left wins ties.
  const starters: [number, Unit][] = [];
  [left, right].forEach((line, side) => {
    for (const u of line) if (def(u.id).trigger === 'startBattle') starters.push([side, u]);
  });
  starters.sort((a, b) => b[1].atk - a[1].atk || a[0] - b[0]);
  for (const [side, u] of starters) eng.fire(side, u, 'startBattle');
  eng.run();

  for (let n = 0; n < MAX_EXCHANGES && left.length > 0 && right.length > 0; n++) {
    eng.fire(0, left[0], 'beforeAttack');
    eng.fire(1, right[0], 'beforeAttack');
    eng.run();
    if (left.length === 0 || right.length === 0) break;

    const a = left[0];
    const b = right[0];
    eng.events.push({ t: 'attack', left: a.uid, right: b.uid });
    const toA = b.atk;
    const toB = a.atk;
    eng.damage(0, a, toA);
    eng.damage(1, b, toB);
    if (b.hp <= 0 && a.hp > 0) eng.fire(0, a, 'knockOut');
    if (a.hp <= 0 && b.hp > 0) eng.fire(1, b, 'knockOut');
    eng.run();
  }

  const result: BattleResult =
    left.length > 0 && right.length === 0 ? 'win' : right.length > 0 && left.length === 0 ? 'loss' : 'draw';
  return { result, events: eng.events, left, right };
}
