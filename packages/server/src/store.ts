import type { RunState, Unit } from '@otryad/core';

export type GhostUnit = Omit<Unit, 'uid'>;

export interface StoredRun {
  id: string;
  userId: number;
  version: number;
  state: RunState;
  finished: boolean;
}

export interface Ghost {
  name: string;
  team: GhostUnit[];
}

export interface UserStats {
  runs: number;
  bestWins: number;
  fullRuns: number; // runs that reached the win goal
}

export interface Store {
  upsertUser(id: number, firstName: string, username?: string): Promise<void>;
  activeRun(userId: number): Promise<StoredRun | null>;
  createRun(userId: number, state: RunState): Promise<StoredRun>;
  // Saves only if the stored version still equals run.version; returns the
  // new version, or null when another request got there first.
  saveRun(run: StoredRun, state: RunState): Promise<number | null>;
  addGhost(round: number, wins: number, userId: number | null, name: string, team: GhostUnit[]): Promise<void>;
  // Bulk insert of bot teams (no owner) for the cold start.
  addGhosts(rows: { round: number; wins: number; name: string; team: GhostUnit[] }[]): Promise<void>;
  // A recent team from the same round with the closest win count, never the player's own.
  pickGhost(round: number, wins: number, excludeUserId: number, random: () => number): Promise<Ghost | null>;
  ghostCount(): Promise<number>;
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
  private runs = new Map<string, StoredRun>();
  private ghosts: { round: number; wins: number; userId: number | null; name: string; team: GhostUnit[] }[] = [];
  private seq = 0;

  async upsertUser(id: number, firstName: string, username?: string): Promise<void> {
    this.users.set(id, { firstName, username });
  }

  async activeRun(userId: number): Promise<StoredRun | null> {
    for (const r of this.runs.values()) if (r.userId === userId && !r.finished) return structuredClone(r);
    return null;
  }

  async createRun(userId: number, state: RunState): Promise<StoredRun> {
    for (const r of this.runs.values()) if (r.userId === userId) r.finished = true;
    const run: StoredRun = { id: `run-${++this.seq}`, userId, version: 1, state, finished: state.finished };
    this.runs.set(run.id, structuredClone(run));
    return run;
  }

  async saveRun(run: StoredRun, state: RunState): Promise<number | null> {
    const cur = this.runs.get(run.id);
    if (!cur || cur.version !== run.version) return null;
    cur.version++;
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
