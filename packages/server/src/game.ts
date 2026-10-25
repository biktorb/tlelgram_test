import { randomInt } from 'node:crypto';
import { ActionError, Run, type Action, type BattleOutcome, type RunState } from '@otryad/core';
import type { GhostUnit, Store, StoredRun } from './store.ts';

export const MAX_ACTIONS_PER_TURN = 200;

export class GameError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface RunView {
  id: string;
  version: number;
  state: RunState;
}

export interface TurnResult {
  run: RunView;
  battle: Pick<BattleOutcome, 'result' | 'start' | 'events' | 'left' | 'right'>;
  enemy: { name: string };
}

const view = (r: StoredRun): RunView => ({ id: r.id, version: r.version, state: r.state });

const random = () => randomInt(0, 2 ** 31) / 2 ** 31;

export class Game {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  async current(userId: number): Promise<RunView | null> {
    const run = await this.store.activeRun(userId);
    return run ? view(run) : null;
  }

  async start(userId: number): Promise<RunView> {
    const run = new Run(randomInt(0, 2 ** 31));
    return view(await this.store.createRun(userId, run.snapshot()));
  }

  // Replays the player's shop actions on the stored state, then fights a ghost.
  // The client's own simulation is never trusted.
  async turn(userId: number, playerName: string, runId: string, version: number, actions: Action[]): Promise<TurnResult> {
    const stored = await this.store.activeRun(userId);
    if (!stored || stored.id !== runId) throw new GameError(404, 'Забег не найден');
    if (stored.version !== version) throw new GameError(409, 'Забег изменился в другом окне');

    const run = new Run(stored.state.seed, stored.state);
    for (const action of actions) {
      try {
        run.apply(action);
      } catch (e) {
        if (e instanceof ActionError) throw new GameError(422, e.message);
        throw e;
      }
    }
    const round = run.s.round;
    const winsBefore = run.s.wins;
    const team = run.endTurn();
    if (team.length === 0) throw new GameError(422, 'Купите хотя бы одного бойца');

    const ghost = await this.store.pickGhost(round, winsBefore, userId, random);
    const opponent = (ghost?.team ?? []).map((u, i) => ({ ...u, uid: i + 1 }));
    const out = run.fight(opponent, randomInt(0, 2 ** 31));

    const newVersion = await this.store.saveRun(stored, run.snapshot());
    if (newVersion === null) throw new GameError(409, 'Забег изменился в другом окне');
    await this.store.addGhost(round, winsBefore, userId, playerName, team.map(stripUid));

    return {
      run: { id: stored.id, version: newVersion, state: run.snapshot() },
      battle: { result: out.result, start: out.start, events: out.events, left: out.left, right: out.right },
      enemy: { name: ghost?.name ?? 'Пустая арена' },
    };
  }
}

function stripUid({ id, atk, hp, xp }: GhostUnit & { uid?: number }): GhostUnit {
  return { id, atk, hp, xp };
}

// Validates the untrusted request body shape; game rules are checked by Run.apply.
export function parseActions(input: unknown): Action[] {
  if (!Array.isArray(input) || input.length > MAX_ACTIONS_PER_TURN) throw new GameError(400, 'Неверный список действий');
  const idx = (v: unknown) => {
    if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 20) throw new GameError(400, 'Неверный номер');
    return v as number;
  };
  return input.map((raw): Action => {
    const a = raw as Record<string, unknown>;
    switch (a?.a) {
      case 'buy': return { a: 'buy', shop: idx(a.shop), pos: idx(a.pos) };
      case 'buyMerge': return { a: 'buyMerge', shop: idx(a.shop), team: idx(a.team) };
      case 'merge': return { a: 'merge', from: idx(a.from), to: idx(a.to) };
      case 'sell': return { a: 'sell', team: idx(a.team) };
      case 'move': return { a: 'move', from: idx(a.from), to: idx(a.to) };
      case 'reroll': return { a: 'reroll' };
      case 'freeze': return { a: 'freeze', shop: idx(a.shop) };
      default: throw new GameError(400, 'Неизвестное действие');
    }
  });
}

// Cold start: bot teams so the first players have someone to fight.
export async function seedGhosts(store: Store, teamsByRound: Record<string, GhostUnit[][]>): Promise<number> {
  if ((await store.ghostCount()) > 0) return 0;
  const rows = Object.entries(teamsByRound).flatMap(([round, teams]) =>
    teams.map((team) => ({
      round: Number(round),
      wins: Math.floor((Number(round) - 1) / 2),
      name: `Кот #${1000 + randomInt(0, 9000)}`,
      team,
    })),
  );
  await store.addGhosts(rows);
  return rows.length;
}
