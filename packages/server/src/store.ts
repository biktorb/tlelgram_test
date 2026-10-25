import type { BattleResult, RunState, Unit } from '@otryad/core';

export type GhostUnit = Omit<Unit, 'uid'>;

export interface StoredRun {
  id: string;
  userId: number;
  version: number;
  state: RunState;
  finished: boolean;
  duelCode: string | null; // set when the run answers a duel
}

export interface Ghost {
  name: string;
  team: GhostUnit[];
}

// A finished run shared by link. Friends play from the same seed and their
// final team fights this team.
export interface Duel {
  code: string;
  runId: string;
  challengerId: number;
  challengerName: string;
  seed: number;
  wins: number;
  team: GhostUnit[];
}

export interface DuelResult {
  duelCode: string;
  runId: string;
  userId: number;
  userName: string;
  wins: number;
  team: GhostUnit[];
  battleSeed: number;
  result: BattleResult; // the friend's result in battle(friend team, challenger team, battleSeed)
}

export interface DuelInboxItem {
  userName: string;
  wins: number;
  result: BattleResult; // the friend's result
  isNew: boolean;
}

export interface NewRunOptions {
  duelCode?: string | null; // the run answers this duel
  chatInstance?: string | null; // the chat the game was opened from
}

export interface ChatEntry {
  userId: number;
  name: string;
  bestWins: number;
  runs: number;
}

export interface UserStats {
  runs: number;
  bestWins: number;
  fullRuns: number; // runs that reached the win goal
}

export interface Store {
  upsertUser(id: number, firstName: string, username?: string): Promise<void>;
  activeRun(userId: number): Promise<StoredRun | null>;
  getRun(runId: string): Promise<StoredRun | null>;
  // Finishes the player's active run, if any, and starts a new one.
  createRun(userId: number, state: RunState, opts?: NewRunOptions): Promise<StoredRun>;
  // Saves only if the stored version still equals run.version; returns the
  // new version, or null when another request got there first.
  saveRun(run: StoredRun, state: RunState): Promise<number | null>;
  addGhost(round: number, wins: number, userId: number | null, name: string, team: GhostUnit[]): Promise<void>;
  // Bulk insert of bot teams (no owner) for the cold start.
  addGhosts(rows: { round: number; wins: number; name: string; team: GhostUnit[] }[]): Promise<void>;
  // A recent team from the same round with the closest win count, never the player's own.
  pickGhost(round: number, wins: number, excludeUserId: number, random: () => number): Promise<Ghost | null>;
  ghostCount(): Promise<number>;
  // Returns the existing duel when this run was already shared.
  createDuel(duel: Duel): Promise<Duel>;
  getDuel(code: string): Promise<Duel | null>;
  addDuelResult(result: DuelResult): Promise<void>;
  // The latest answers to the player's duels, newest first; marks them seen.
  takeDuelInbox(challengerId: number, limit: number): Promise<DuelInboxItem[]>;
  // Players of runs started from this chat since the given time, best result first.
  chatTop(chatInstance: string, since: Date, limit: number): Promise<ChatEntry[]>;
  stats(userId: number): Promise<UserStats>;
  close(): Promise<void>;
}

export const GHOST_CANDIDATES = 200;

export function closestGhost<T extends { wins: number }>(rows: T[], wins: number, random: () => number): T | null {
  if (rows.length === 0) return null;
  const best = Math.min(...rows.map((r) => Math.abs(r.wins - wins)));
  const pool = rows.filter((r) => Math.abs(r.wins - wins) <= best + 1);
  return pool[Math.floor(random() * pool.length)];
}

// In-memory store for tests and local development without a database.
export class MemoryStore implements Store {
  private users = new Map<number, { firstName: string; username?: string }>();
  private runs = new Map<string, StoredRun & { chatInstance: string | null; updatedAt: number }>();
  private ghosts: { round: number; wins: number; userId: number | null; name: string; team: GhostUnit[] }[] = [];
  private duels = new Map<string, Duel>();
  private duelResults: (DuelResult & { seen: boolean })[] = [];
  private seq = 0;

  async upsertUser(id: number, firstName: string, username?: string): Promise<void> {
    this.users.set(id, { firstName, username });
  }

  async activeRun(userId: number): Promise<StoredRun | null> {
    for (const r of this.runs.values()) if (r.userId === userId && !r.finished) return toStored(r);
    return null;
  }

  async getRun(runId: string): Promise<StoredRun | null> {
    const r = this.runs.get(runId);
    return r ? toStored(r) : null;
  }

  async createRun(userId: number, state: RunState, opts: NewRunOptions = {}): Promise<StoredRun> {
    for (const r of this.runs.values()) if (r.userId === userId) r.finished = true;
    const run: StoredRun = { id: `run-${++this.seq}`, userId, version: 1, state, finished: state.finished, duelCode: opts.duelCode ?? null };
    this.runs.set(run.id, { ...structuredClone(run), chatInstance: opts.chatInstance ?? null, updatedAt: Date.now() });
    return run;
  }

  async saveRun(run: StoredRun, state: RunState): Promise<number | null> {
    const cur = this.runs.get(run.id);
    if (!cur || cur.version !== run.version) return null;
    cur.version++;
    cur.updatedAt = Date.now();
    cur.state = structuredClone(state);
    cur.finished = state.finished;
    return cur.version;
  }

  async addGhost(round: number, wins: number, userId: number | null, name: string, team: GhostUnit[]): Promise<void> {
    this.ghosts.push({ round, wins, userId, name, team });
  }

  async addGhosts(rows: { round: number; wins: number; name: string; team: GhostUnit[] }[]): Promise<void> {
    for (const r of rows) this.ghosts.push({ ...r, userId: null });
  }

  async pickGhost(round: number, wins: number, excludeUserId: number, random: () => number): Promise<Ghost | null> {
    const rows = this.ghosts
      .filter((g) => g.round === round && g.userId !== excludeUserId)
      .slice(-GHOST_CANDIDATES);
    const g = closestGhost(rows, wins, random);
    return g ? { name: g.name, team: g.team } : null;
  }

  async ghostCount(): Promise<number> {
    return this.ghosts.length;
  }

  async createDuel(duel: Duel): Promise<Duel> {
    for (const d of this.duels.values()) if (d.runId === duel.runId) return structuredClone(d);
    this.duels.set(duel.code, structuredClone(duel));
    return duel;
  }

  async getDuel(code: string): Promise<Duel | null> {
    const d = this.duels.get(code);
    return d ? structuredClone(d) : null;
  }

  async addDuelResult(result: DuelResult): Promise<void> {
    if (this.duelResults.some((r) => r.runId === result.runId)) return;
    this.duelResults.push({ ...structuredClone(result), seen: false });
  }

  async takeDuelInbox(challengerId: number, limit: number): Promise<DuelInboxItem[]> {
    const mine = this.duelResults.filter((r) => this.duels.get(r.duelCode)?.challengerId === challengerId).slice(-limit).reverse();
    const items = mine.map((r) => ({ userName: r.userName, wins: r.wins, result: r.result, isNew: !r.seen }));
    for (const r of mine) r.seen = true;
    return items;
  }

  async chatTop(chatInstance: string, since: Date, limit: number): Promise<ChatEntry[]> {
    const byUser = new Map<number, ChatEntry>();
    for (const r of this.runs.values()) {
      if (r.chatInstance !== chatInstance || r.updatedAt < since.getTime()) continue;
      const e = byUser.get(r.userId) ?? { userId: r.userId, name: this.users.get(r.userId)?.firstName ?? 'Игрок', bestWins: 0, runs: 0 };
      e.bestWins = Math.max(e.bestWins, r.state.wins);
      e.runs++;
      byUser.set(r.userId, e);
    }
    return [...byUser.values()].sort((a, b) => b.bestWins - a.bestWins || b.runs - a.runs).slice(0, limit);
  }

  async stats(userId: number): Promise<UserStats> {
    const mine = [...this.runs.values()].filter((r) => r.userId === userId);
    return {
      runs: mine.length,
      bestWins: Math.max(0, ...mine.map((r) => r.state.wins)),
      fullRuns: mine.filter((r) => r.state.finished && r.state.lives > 0).length,
    };
  }

  async close(): Promise<void> {}
}

function toStored({ id, userId, version, state, finished, duelCode }: StoredRun): StoredRun {
  return structuredClone({ id, userId, version, state, finished, duelCode });
}
