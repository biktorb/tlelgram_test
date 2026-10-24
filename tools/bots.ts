// Bots and the ghost pool, shared by the balance check and the ghost generator.
import { def, levelOf, Rng, Run, type Unit } from '../packages/core/src/index.ts';

export type Bot = (run: Run, rng: Rng) => void;

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

export function greedy(favorite?: string): Bot {
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

export const randomBot: Bot = (run, rng) => {
  for (let step = 0; step < 20; step++) {
    const s = run.s;
    if (s.gold >= 3 && s.team.length < 5 && s.shop.length > 0) {
      run.apply({ a: 'buy', shop: rng.int(s.shop.length), pos: rng.int(s.team.length + 1) });
    } else break;
  }
};

export interface RunStats {
  wins: number;
  rounds: number;
  exchanges: number;
  draws: number;
  team: Unit[];
}

export const pool = new Map<number, Unit[][]>();

export function ghost(round: number, rng: Rng): Unit[] {
  for (let r = round; r >= 1; r--) {
    const list = pool.get(r);
    if (list && list.length > 0) return list[rng.int(list.length)];
  }
  return [];
}

export function record(round: number, team: Unit[]): void {
  const list = pool.get(round) ?? [];
  list.push(team);
  if (list.length > 400) list.shift();
  pool.set(round, list);
}

export function playRun(bot: Bot, seed: number, recordGhosts: boolean): RunStats {
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

