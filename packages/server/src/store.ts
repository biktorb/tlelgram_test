import type { BattleResult, RunState, Unit } from '@otryad/core';

export type GhostUnit = Omit<Unit, 'uid'>;

export interface StoredRun {
  id: string;
  userId: number;
  version: number;
  state: RunState;
  finished: boolean;
  duelCode: string | null; // set when the run answers a duel
  daily: string | null; // YYYY-MM-DD of the daily challenge this run plays
}

export interface Ghost {
  name: string;
  team: GhostUnit[];
  frame: string | null; // the frame its player wore
}

export interface Wallet {
  fish: number;
  frame: string | null; // equipped frame, null for the plain one
  owned: string[];
}

export type BuyResult = 'ok' | 'owned' | 'poor';

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
  daily?: string | null; // YYYY-MM-DD of the daily challenge
}

export interface DailyEntry {
  userId: number;
  name: string;
  wins: number;
  lives: number;
}

// Thrown by createRun when the player already has a run for that daily challenge.
export class DailyTakenError extends Error {}

export interface LeagueEntry {
  userId: number;
  week: string; // YYYY-MM-DD of the week's Monday
  league: number; // 0 bronze .. 3 diamond
  moved: number; // -1, 0 or 1 against the last week played
  points: number;
  day: string | null; // day of the last counted run
  dayRuns: number; // runs counted on that day
}

export interface LeagueRow {
  userId: number;
  name: string;
  points: number;
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
  addGhost(round: number, wins: number, userId: number | null, name: string, team: GhostUnit[], frame?: string | null): Promise<void>;
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
  dailyRun(userId: number, date: string): Promise<StoredRun | null>;
  // Finished runs of the day's challenge: most wins, then most lives left, then who finished first.
  dailyTop(date: string, limit: number): Promise<DailyEntry[]>;
  // The player's place in that order, or null when their daily run is not finished.
  dailyRank(userId: number, date: string): Promise<number | null>;
  leagueEntry(userId: number, week: string): Promise<LeagueEntry | null>;
  // The player's entry for their most recent week before the given one.
  lastLeagueEntry(userId: number, beforeWeek: string): Promise<LeagueEntry | null>;
  // Creates the player's entry for the week if missing, then adds a finished
  // run's points unless runsPerDay runs were already counted that day.
  addLeagueRun(entry: Pick<LeagueEntry, 'userId' | 'week' | 'league' | 'moved'>, day: string, points: number, runsPerDay: number): Promise<LeagueEntry>;
  // A league's players for the week: most points, then who got there first.
  leagueTop(week: string, league: number, limit: number): Promise<LeagueRow[]>;
  // The player's place in that order (null when not in it) and the number of players.
  leagueStanding(userId: number, week: string, league: number): Promise<{ rank: number | null; size: number }>;
  // Players of runs started from this chat since the given time, best result first.
  chatTop(chatInstance: string, since: Date, limit: number): Promise<ChatEntry[]>;
  stats(userId: number): Promise<UserStats>;
  wallet(userId: number): Promise<Wallet>;
  // The player's runs played to the end since the given time (abandoned ones
  // don't count) and their wins.
  dayActivity(userId: number, since: Date): Promise<{ runs: number; wins: number }>;
  claimedTasks(userId: number, day: string): Promise<string[]>;
  // Pays a task's reward (fish, and an item if given) at most once a day; false when it was already paid.
  claimTask(userId: number, day: string, task: string, reward: number, item?: string): Promise<boolean>;
  // Spends fish on an item unless the player owns it or is short of fish.
  buyItem(userId: number, item: string, price: number): Promise<BuyResult>;
  setFrame(userId: number, frame: string | null): Promise<void>;
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
  private users = new Map<number, { firstName: string; username?: string; fish: number; frame: string | null; items: Set<string> }>();
  private claims = new Map<string, number>(); // "user:day:task" -> reward
  private runs = new Map<string, StoredRun & { chatInstance: string | null; updatedAt: number }>();
  private ghosts: { round: number; wins: number; userId: number | null; name: string; team: GhostUnit[]; frame: string | null }[] = [];
  private duels = new Map<string, Duel>();
  private duelResults: (DuelResult & { seen: boolean })[] = [];
  private leagues = new Map<string, LeagueEntry & { updatedAt: number }>();
  private seq = 0;

  async upsertUser(id: number, firstName: string, username?: string): Promise<void> {
    const u = this.users.get(id);
    if (u) Object.assign(u, { firstName, username });
    else this.users.set(id, { firstName, username, fish: 0, frame: null, items: new Set() });
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
    const daily = opts.daily ?? null;
    if (daily && [...this.runs.values()].some((r) => r.userId === userId && r.daily === daily)) throw new DailyTakenError();
    for (const r of this.runs.values()) if (r.userId === userId) r.finished = true;
    const run: StoredRun = { id: `run-${++this.seq}`, userId, version: 1, state, finished: state.finished, duelCode: opts.duelCode ?? null, daily };
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

  async addGhost(round: number, wins: number, userId: number | null, name: string, team: GhostUnit[], frame: string | null = null): Promise<void> {
    this.ghosts.push({ round, wins, userId, name, team, frame });
  }

  async addGhosts(rows: { round: number; wins: number; name: string; team: GhostUnit[] }[]): Promise<void> {
    for (const r of rows) this.ghosts.push({ ...r, userId: null, frame: null });
  }

  async pickGhost(round: number, wins: number, excludeUserId: number, random: () => number): Promise<Ghost | null> {
    const rows = this.ghosts
      .filter((g) => g.round === round && g.userId !== excludeUserId)
      .slice(-GHOST_CANDIDATES);
    const g = closestGhost(rows, wins, random);
    return g ? { name: g.name, team: g.team, frame: g.frame } : null;
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

  async dailyRun(userId: number, date: string): Promise<StoredRun | null> {
    for (const r of this.runs.values()) if (r.userId === userId && r.daily === date) return toStored(r);
    return null;
  }

  private dailyOrder(date: string) {
    return [...this.runs.values()]
      .filter((r) => r.daily === date && r.finished)
      .sort((a, b) => b.state.wins - a.state.wins || b.state.lives - a.state.lives || a.updatedAt - b.updatedAt);
  }

  async dailyTop(date: string, limit: number): Promise<DailyEntry[]> {
    return this.dailyOrder(date)
      .slice(0, limit)
      .map((r) => ({ userId: r.userId, name: this.users.get(r.userId)?.firstName ?? 'Игрок', wins: r.state.wins, lives: r.state.lives }));
  }

  async dailyRank(userId: number, date: string): Promise<number | null> {
    const i = this.dailyOrder(date).findIndex((r) => r.userId === userId);
    return i < 0 ? null : i + 1;
  }

  async leagueEntry(userId: number, week: string): Promise<LeagueEntry | null> {
    const e = this.leagues.get(`${userId}:${week}`);
    return e ? toEntry(e) : null;
  }

  async lastLeagueEntry(userId: number, beforeWeek: string): Promise<LeagueEntry | null> {
    const mine = [...this.leagues.values()].filter((e) => e.userId === userId && e.week < beforeWeek);
    mine.sort((a, b) => (a.week < b.week ? 1 : -1));
    return mine[0] ? toEntry(mine[0]) : null;
  }

  async addLeagueRun(entry: Pick<LeagueEntry, 'userId' | 'week' | 'league' | 'moved'>, day: string, points: number, runsPerDay: number): Promise<LeagueEntry> {
    const key = `${entry.userId}:${entry.week}`;
    const e = this.leagues.get(key) ?? { ...entry, points: 0, day: null, dayRuns: 0, updatedAt: ++this.seq };
    this.leagues.set(key, e);
    if (e.day !== day || e.dayRuns < runsPerDay) {
      e.dayRuns = e.day === day ? e.dayRuns + 1 : 1;
      e.day = day;
      e.points += points;
      if (points > 0) e.updatedAt = ++this.seq;
    }
    return toEntry(e);
  }

  private leagueOrder(week: string, league: number) {
    return [...this.leagues.values()]
      .filter((e) => e.week === week && e.league === league)
      .sort((a, b) => b.points - a.points || a.updatedAt - b.updatedAt);
  }

  async leagueTop(week: string, league: number, limit: number): Promise<LeagueRow[]> {
    return this.leagueOrder(week, league)
      .slice(0, limit)
      .map((e) => ({ userId: e.userId, name: this.users.get(e.userId)?.firstName ?? 'Игрок', points: e.points }));
  }

  async leagueStanding(userId: number, week: string, league: number): Promise<{ rank: number | null; size: number }> {
    const order = this.leagueOrder(week, league);
    const i = order.findIndex((e) => e.userId === userId);
    return { rank: i < 0 ? null : i + 1, size: order.length };
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

  async wallet(userId: number): Promise<Wallet> {
    const u = this.users.get(userId);
    return { fish: u?.fish ?? 0, frame: u?.frame ?? null, owned: [...(u?.items ?? [])] };
  }

  async dayActivity(userId: number, since: Date): Promise<{ runs: number; wins: number }> {
    const done = [...this.runs.values()].filter((r) => r.userId === userId && r.state.finished && r.updatedAt >= since.getTime());
    return { runs: done.length, wins: done.reduce((n, r) => n + r.state.wins, 0) };
  }

  async claimedTasks(userId: number, day: string): Promise<string[]> {
    const prefix = `${userId}:${day}:`;
    return [...this.claims.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
  }

  async claimTask(userId: number, day: string, task: string, reward: number, item?: string): Promise<boolean> {
    const key = `${userId}:${day}:${task}`;
    const u = this.users.get(userId);
    if (!u || this.claims.has(key)) return false;
    this.claims.set(key, reward);
    u.fish += reward;
    if (item) u.items.add(item);
    return true;
  }

  async buyItem(userId: number, item: string, price: number): Promise<BuyResult> {
    const u = this.users.get(userId);
    if (!u) return 'poor';
    if (u.items.has(item)) return 'owned';
    if (u.fish < price) return 'poor';
    u.fish -= price;
    u.items.add(item);
    return 'ok';
  }

  async setFrame(userId: number, frame: string | null): Promise<void> {
    const u = this.users.get(userId);
    if (u) u.frame = frame;
  }

  async close(): Promise<void> {}
}

function toStored({ id, userId, version, state, finished, duelCode, daily }: StoredRun): StoredRun {
  return structuredClone({ id, userId, version, state, finished, duelCode, daily });
}

function toEntry({ userId, week, league, moved, points, day, dayRuns }: LeagueEntry): LeagueEntry {
  return { userId, week, league, moved, points, day, dayRuns };
}
