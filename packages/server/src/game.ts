import { randomInt } from 'node:crypto';
import { ActionError, battle, Run, type Action, type BattleOutcome, type BattleResult, type RunState } from '@otryad/core';
import type { Duel, DuelInboxItem, GhostUnit, Store, StoredRun } from './store.ts';

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
  duel: string | null; // code of the duel this run answers
}

type BattleView = Pick<BattleOutcome, 'result' | 'start' | 'events' | 'left' | 'right'>;

export interface DuelInfo {
  code: string;
  challengerId: number;
  challengerName: string;
  wins: number;
  team: GhostUnit[];
}

export interface TurnResult {
  run: RunView;
  battle: BattleView;
  enemy: { name: string };
  // On the last turn of a run that answers a duel: the final team against the challenger's.
  duel?: { battle: BattleView; challengerName: string };
}

// Told when a friend finishes a run that answers the player's duel.
export interface Notifier {
  duelAnswered(duel: Duel, friendName: string, friendResult: BattleResult): void;
}

const view = (r: StoredRun): RunView => ({ id: r.id, version: r.version, state: r.state, duel: r.duelCode });
const battleView = (o: BattleOutcome): BattleView => ({ result: o.result, start: o.start, events: o.events, left: o.left, right: o.right });
const withUids = (team: GhostUnit[]) => team.map((u, i) => ({ ...u, uid: i + 1 }));

const CODE_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const DUEL_CODE = /^[a-zA-Z0-9]{8}$/;
const newCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join('');

const random = () => randomInt(0, 2 ** 31) / 2 ** 31;

export class Game {
  private store: Store;
  private notifier: Notifier | null;

  constructor(store: Store, notifier: Notifier | null = null) {
    this.store = store;
    this.notifier = notifier;
  }

  async current(userId: number): Promise<RunView | null> {
    const run = await this.store.activeRun(userId);
    return run ? view(run) : null;
  }

  // A duel run starts from the challenger's seed, so the first shop is the same.
  async start(userId: number, duelCode: string | null = null): Promise<RunView> {
    if (duelCode === null) {
      const run = new Run(randomInt(0, 2 ** 31));
      return view(await this.store.createRun(userId, run.snapshot()));
    }
    const duel = await this.duel(duelCode);
    if (duel.challengerId === userId) throw new GameError(422, 'Это ваш собственный вызов');
    return view(await this.store.createRun(userId, new Run(duel.seed).snapshot(), duel.code));
  }

  // Shares a finished run as a duel; sharing the same run again returns the same code.
  async share(userId: number, playerName: string, runId: string): Promise<DuelInfo> {
    const stored = await this.store.getRun(runId);
    if (!stored || stored.userId !== userId) throw new GameError(404, 'Забег не найден');
    if (!stored.state.finished) throw new GameError(422, 'Забег ещё не окончен');
    const duel = await this.store.createDuel({
      code: newCode(),
      runId,
      challengerId: userId,
      challengerName: playerName,
      seed: stored.state.seed,
      wins: stored.state.wins,
      team: stored.state.team.map(stripUid),
    });
    return info(duel);
  }

  async duelInfo(code: string): Promise<DuelInfo> {
    return info(await this.duel(code));
  }

  inbox(userId: number): Promise<DuelInboxItem[]> {
    return this.store.takeDuelInbox(userId, 10);
  }

  private async duel(code: string): Promise<Duel> {
    const duel = DUEL_CODE.test(code) ? await this.store.getDuel(code) : null;
    if (!duel) throw new GameError(404, 'Вызов не найден');
    return duel;
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
    const out = run.fight(withUids(ghost?.team ?? []), randomInt(0, 2 ** 31));

    const newVersion = await this.store.saveRun(stored, run.snapshot());
    if (newVersion === null) throw new GameError(409, 'Забег изменился в другом окне');
    await this.store.addGhost(round, winsBefore, userId, playerName, team.map(stripUid));

    const result: TurnResult = {
      run: { id: stored.id, version: newVersion, state: run.snapshot(), duel: stored.duelCode },
      battle: battleView(out),
      enemy: { name: ghost?.name ?? 'Пустая арена' },
    };
    if (run.s.finished && stored.duelCode) {
      result.duel = await this.finishDuel(stored, userId, playerName, run.s.wins, team.map(stripUid));
    }
    return result;
  }

  private async finishDuel(stored: StoredRun, userId: number, playerName: string, wins: number, team: GhostUnit[]) {
    const duel = await this.store.getDuel(stored.duelCode!);
    if (!duel) return undefined;
    const battleSeed = randomInt(0, 2 ** 31);
    const out = battle(withUids(team), withUids(duel.team), battleSeed);
    await this.store.addDuelResult({ duelCode: duel.code, runId: stored.id, userId, userName: playerName, wins, team, battleSeed, result: out.result });
    this.notifier?.duelAnswered(duel, playerName, out.result);
    return { battle: battleView(out), challengerName: duel.challengerName };
  }
}

function info(d: Duel): DuelInfo {
  return { code: d.code, challengerId: d.challengerId, challengerName: d.challengerName, wins: d.wins, team: d.team };
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
