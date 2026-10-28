import { cats } from '@otryad/core';
import type { GameEvent } from './stats.ts';

export type RunRecord = cats.RunRecord;
export type RunMode = 'free' | 'daily' | 'duel';

// What a finished run achieved, as the server's replay computed it.
export interface RunOutcome {
  won: boolean;
  ticks: number;
  kills: number;
  level: number;
  points: number;
  fish: number; // paid to the player, with the Greed bonus
}

export interface StoredRun extends RunOutcome {
  id: string;
  userId: number;
  seed: number;
  mode: RunMode;
  daily: string | null; // YYYY-MM-DD of the daily challenge this run plays
  duelCode: string | null; // the duel this run answers
  aura: string | null;
  hero: cats.HeroId;
  room: cats.RoomId;
  powers: cats.Powers;
  sim: number; // cats.SIM_VERSION it was played on
  startedAt: number; // ms
  finished: boolean;
  record: RunRecord | null; // the progress saved so far; the final input once finished
}

export interface RecentRun extends StoredRun {
  name: string;
  finishedAt: number; // ms
}

export interface NewRun {
  seed: number;
  mode: RunMode;
  daily?: string | null;
  duelCode?: string | null;
  chatInstance?: string | null;
  aura?: string | null;
  hero?: cats.HeroId;
  room?: cats.RoomId;
  powers?: cats.Powers;
}

// A finished run another player races against.
export interface Ghost {
  name: string;
  aura: string | null;
  hero: cats.HeroId;
  room: cats.RoomId;
  powers: cats.Powers;
  seed: number;
  record: RunRecord;
  won: boolean;
  ticks: number;
  kills: number;
}

export interface Wallet {
  fish: number;
  frame: string | null; // equipped aura, null for none
  owned: string[];
  powers: cats.Powers;
  powerSpent: number; // fish paid for the Power Ups, returned by a refund
}

export type BuyResult = 'ok' | 'owned' | 'poor';

// A finished run shared by link. Friends play its seed against its ghost.
export interface Duel {
  code: string;
  runId: string;
  challengerId: number;
  challengerName: string;
}

export interface DuelWithRun extends Duel {
  run: StoredRun;
}

export interface DuelResult {
  duelCode: string;
  runId: string;
  userId: number;
  userName: string;
  won: boolean;
  ticks: number;
  kills: number;
  beat: boolean; // the friend did better than the challenger
}

export interface DuelInboxItem {
  userName: string;
  won: boolean;
  ticks: number;
  kills: number;
  beat: boolean;
  isNew: boolean;
}

export interface ScoreRow {
  userId: number;
  name: string;
  won: boolean;
  ticks: number;
  kills: number;
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

export interface ChatEntry extends ScoreRow {
  runs: number;
}

export interface UserStats {
  runs: number; // finished runs
  wins: number;
  best: { won: boolean; ticks: number; kills: number } | null;
}

export interface Activity {
  runs: number; // finished runs
  ticks: number; // time survived in them
  kills: number;
  points: number;
}

export interface Store {
  upsertUser(id: number, firstName: string, username?: string): Promise<void>;
  // The caller finishes the player's unfinished run first: there is at most one.
  createRun(userId: number, run: NewRun): Promise<StoredRun>;
  getRun(runId: string): Promise<StoredRun | null>;
  activeRun(userId: number): Promise<StoredRun | null>;
  // Keeps an unfinished run's input so far, to continue it later; false once finished.
  saveProgress(runId: string, record: RunRecord): Promise<boolean>;
  // Saves the result once; false when the run was already finished.
  finishRun(runId: string, outcome: RunOutcome, record: RunRecord): Promise<boolean>;
  // Rooms the player has survived to 20:00 at least once.
  wonRooms(userId: number): Promise<cats.RoomId[]>;
  // The latest finished runs of everyone, newest first, for the admin page.
  recentRuns(limit: number): Promise<RecentRun[]>;
  dailyRun(userId: number, date: string): Promise<StoredRun | null>;
  // Finished runs of the day's challenge: a win, then the longest, then most kills, then who finished first.
  dailyTop(date: string, limit: number): Promise<ScoreRow[]>;
  // The player's place in that order, or null when their daily run is not finished.
  dailyRank(userId: number, date: string): Promise<number | null>;
  // The best finished run of the day by someone else, to race against.
  dailyGhost(date: string, excludeUserId: number): Promise<Ghost | null>;
  // Returns the existing duel when this run was already shared.
  createDuel(duel: Duel): Promise<Duel>;
  getDuel(code: string): Promise<DuelWithRun | null>;
  addDuelResult(result: DuelResult): Promise<void>;
  // The latest answers to the player's duels, newest first; marks them seen.
  takeDuelInbox(challengerId: number, limit: number): Promise<DuelInboxItem[]>;
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
  // Each player's best run finished since the given time among runs started from this chat.
  chatTop(chatInstance: string, since: Date, limit: number): Promise<ChatEntry[]>;
  stats(userId: number): Promise<UserStats>;
  wallet(userId: number): Promise<Wallet>;
  // The player's runs finished since the given time (abandoned ones don't count).
  activity(userId: number, since: Date): Promise<Activity>;
  claimedTasks(userId: number, day: string): Promise<string[]>;
  // Pays a task's reward (fish, and an item if given) at most once a day; false when it was already paid.
  claimTask(userId: number, day: string, task: string, reward: number, item?: string): Promise<boolean>;
  // Spends fish on an item unless the player owns it or is short of fish.
  buyItem(userId: number, item: string, price: number): Promise<BuyResult>;
  setFrame(userId: number, frame: string | null): Promise<void>;
  // Raises a Power Up from level `from` for `price` fish; 'owned' when its level is no longer `from`.
  buyPower(userId: number, id: cats.PowerId, from: number, price: number): Promise<BuyResult>;
  // Takes all Power Ups back and returns the fish paid for them.
  refundPowers(userId: number): Promise<void>;
  addEvent(userId: number, name: string, data?: Record<string, unknown> | null): Promise<void>;
  eventsSince(since: Date): Promise<GameEvent[]>;
  close(): Promise<void>;
}

type MemRun = StoredRun & { chatInstance: string | null; finishedAt: number };

// The order of finished runs on every board; ties go to who finished first.
const byScore = (a: MemRun, b: MemRun) => cats.compareScores(a, b) || a.finishedAt - b.finishedAt;

// In-memory store for tests and local development without a database.
export class MemoryStore implements Store {
  private users = new Map<number, { firstName: string; username?: string; fish: number; frame: string | null; items: Set<string>; powers: cats.Powers; powerSpent: number }>();
  private claims = new Map<string, number>(); // "user:day:task" -> reward
  private events: GameEvent[] = [];
  private runs = new Map<string, MemRun>();
  private duels = new Map<string, Duel>();
  private duelResults: (DuelResult & { seen: boolean })[] = [];
  private leagues = new Map<string, LeagueEntry & { updatedAt: number }>();
  private seq = 0;

  private name(userId: number): string {
    return this.users.get(userId)?.firstName ?? 'Игрок';
  }

  async upsertUser(id: number, firstName: string, username?: string): Promise<void> {
    const u = this.users.get(id);
    if (u) Object.assign(u, { firstName, username });
    else this.users.set(id, { firstName, username, fish: 0, frame: null, items: new Set(), powers: {}, powerSpent: 0 });
  }

  async createRun(userId: number, n: NewRun): Promise<StoredRun> {
    const daily = n.daily ?? null;
    if (daily && [...this.runs.values()].some((r) => r.userId === userId && r.daily === daily)) throw new DailyTakenError();
    if (await this.activeRun(userId)) throw new Error('the player already has an unfinished run');
    const run: MemRun = {
      id: `run-${++this.seq}`,
      userId,
      seed: n.seed,
      mode: n.mode,
      daily,
      duelCode: n.duelCode ?? null,
      aura: n.aura ?? null,
      hero: n.hero ?? 'ryzhik',
      room: n.room ?? 'flat',
      powers: { ...n.powers },
      sim: cats.SIM_VERSION,
      startedAt: Date.now(),
      finished: false,
      record: null,
      won: false,
      ticks: 0,
      kills: 0,
      level: 0,
      points: 0,
      fish: 0,
      chatInstance: n.chatInstance ?? null,
      finishedAt: 0,
    };
    this.runs.set(run.id, run);
    return toStored(run);
  }

  async getRun(runId: string): Promise<StoredRun | null> {
    const r = this.runs.get(runId);
    return r ? toStored(r) : null;
  }

  async activeRun(userId: number): Promise<StoredRun | null> {
    for (const r of this.runs.values()) if (r.userId === userId && !r.finished) return toStored(r);
    return null;
  }

  async saveProgress(runId: string, record: RunRecord): Promise<boolean> {
    const r = this.runs.get(runId);
    if (!r || r.finished) return false;
    r.record = { ...record };
    return true;
  }

  async finishRun(runId: string, outcome: RunOutcome, record: RunRecord): Promise<boolean> {
    const r = this.runs.get(runId);
    if (!r || r.finished) return false;
    Object.assign(r, outcome, { finished: true, record: { ...record }, finishedAt: Date.now() + ++this.seq / 1000 });
    const u = this.users.get(r.userId);
    if (u) u.fish += outcome.fish;
    return true;
  }

  async wonRooms(userId: number): Promise<cats.RoomId[]> {
    return [...new Set([...this.runs.values()].filter((r) => r.userId === userId && r.finished && r.won).map((r) => r.room))];
  }

  async recentRuns(limit: number): Promise<RecentRun[]> {
    return [...this.runs.values()]
      .filter((r) => r.finished)
      .sort((a, b) => b.finishedAt - a.finishedAt)
      .slice(0, limit)
      .map((r) => ({ ...toStored(r), name: this.name(r.userId), finishedAt: Math.floor(r.finishedAt) }));
  }

  async dailyRun(userId: number, date: string): Promise<StoredRun | null> {
    for (const r of this.runs.values()) if (r.userId === userId && r.daily === date) return toStored(r);
    return null;
  }

  private dailyOrder(date: string): MemRun[] {
    return [...this.runs.values()].filter((r) => r.daily === date && r.finished).sort(byScore);
  }

  async dailyTop(date: string, limit: number): Promise<ScoreRow[]> {
    return this.dailyOrder(date)
      .slice(0, limit)
      .map((r) => ({ userId: r.userId, name: this.name(r.userId), won: r.won, ticks: r.ticks, kills: r.kills }));
  }

  async dailyRank(userId: number, date: string): Promise<number | null> {
    const i = this.dailyOrder(date).findIndex((r) => r.userId === userId);
    return i < 0 ? null : i + 1;
  }

  async dailyGhost(date: string, excludeUserId: number): Promise<Ghost | null> {
    const r = this.dailyOrder(date).find((x) => x.userId !== excludeUserId);
    return r ? ghostOf(r, this.name(r.userId)) : null;
  }

  async createDuel(duel: Duel): Promise<Duel> {
    for (const d of this.duels.values()) if (d.runId === duel.runId) return { ...d };
    this.duels.set(duel.code, { ...duel });
    return duel;
  }

  async getDuel(code: string): Promise<DuelWithRun | null> {
    const d = this.duels.get(code);
    const run = d && this.runs.get(d.runId);
    return d && run ? { ...d, run: toStored(run) } : null;
  }

  async addDuelResult(result: DuelResult): Promise<void> {
    if (this.duelResults.some((r) => r.runId === result.runId)) return;
    this.duelResults.push({ ...result, seen: false });
  }

  async takeDuelInbox(challengerId: number, limit: number): Promise<DuelInboxItem[]> {
    const mine = this.duelResults.filter((r) => this.duels.get(r.duelCode)?.challengerId === challengerId).slice(-limit).reverse();
    const items = mine.map((r) => ({ userName: r.userName, won: r.won, ticks: r.ticks, kills: r.kills, beat: r.beat, isNew: !r.seen }));
    for (const r of mine) r.seen = true;
    return items;
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
      .map((e) => ({ userId: e.userId, name: this.name(e.userId), points: e.points }));
  }

  async leagueStanding(userId: number, week: string, league: number): Promise<{ rank: number | null; size: number }> {
    const order = this.leagueOrder(week, league);
    const i = order.findIndex((e) => e.userId === userId);
    return { rank: i < 0 ? null : i + 1, size: order.length };
  }

  async chatTop(chatInstance: string, since: Date, limit: number): Promise<ChatEntry[]> {
    const done = [...this.runs.values()].filter((r) => r.chatInstance === chatInstance && r.finished && r.finishedAt >= since.getTime()).sort(byScore);
    const byUser = new Map<number, ChatEntry>();
    for (const r of done) {
      const e = byUser.get(r.userId);
      if (e) e.runs++;
      else byUser.set(r.userId, { userId: r.userId, name: this.name(r.userId), won: r.won, ticks: r.ticks, kills: r.kills, runs: 1 });
    }
    return [...byUser.values()].slice(0, limit);
  }

  async stats(userId: number): Promise<UserStats> {
    const done = [...this.runs.values()].filter((r) => r.userId === userId && r.finished).sort(byScore);
    const best = done[0];
    return {
      runs: done.length,
      wins: done.filter((r) => r.won).length,
      best: best ? { won: best.won, ticks: best.ticks, kills: best.kills } : null,
    };
  }

  async wallet(userId: number): Promise<Wallet> {
    const u = this.users.get(userId);
    return { fish: u?.fish ?? 0, frame: u?.frame ?? null, owned: [...(u?.items ?? [])], powers: { ...u?.powers }, powerSpent: u?.powerSpent ?? 0 };
  }

  async activity(userId: number, since: Date): Promise<Activity> {
    const done = [...this.runs.values()].filter((r) => r.userId === userId && r.finished && r.finishedAt >= since.getTime());
    return {
      runs: done.length,
      ticks: done.reduce((n, r) => n + r.ticks, 0),
      kills: done.reduce((n, r) => n + r.kills, 0),
      points: done.reduce((n, r) => n + r.points, 0),
    };
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

  async buyPower(userId: number, id: cats.PowerId, from: number, price: number): Promise<BuyResult> {
    const u = this.users.get(userId);
    if (!u) return 'poor';
    if ((u.powers[id] ?? 0) !== from) return 'owned';
    if (u.fish < price) return 'poor';
    u.fish -= price;
    u.powerSpent += price;
    u.powers[id] = from + 1;
    return 'ok';
  }

  async refundPowers(userId: number): Promise<void> {
    const u = this.users.get(userId);
    if (!u) return;
    u.fish += u.powerSpent;
    u.powerSpent = 0;
    u.powers = {};
  }

  async addEvent(userId: number, name: string, data: Record<string, unknown> | null = null): Promise<void> {
    this.events.push({ userId, name, data, at: Date.now() });
  }

  async eventsSince(since: Date): Promise<GameEvent[]> {
    return this.events.filter((e) => e.at >= since.getTime());
  }

  async close(): Promise<void> {}
}

function toStored(r: MemRun): StoredRun {
  const { chatInstance: _c, finishedAt: _f, ...run } = r;
  return { ...run, record: run.record && { ...run.record } };
}

// A run from an older simulation would not play back as it went, so it races as no ghost.
export function ghostOf(r: StoredRun, name: string): Ghost | null {
  if (r.sim !== cats.SIM_VERSION) return null;
  return { name, aura: r.aura, hero: r.hero, room: r.room, powers: r.powers, seed: r.seed, record: r.record!, won: r.won, ticks: r.ticks, kills: r.kills };
}

function toEntry({ userId, week, league, moved, points, day, dayRuns }: LeagueEntry): LeagueEntry {
  return { userId, week, league, moved, points, day, dayRuns };
}
