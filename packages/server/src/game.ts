import { randomInt } from 'node:crypto';
import { cats, DAILY_TASKS, frameById, hashSeed, SEASON_PASS, SEASON_POINTS_PER_LEVEL } from '@otryad/core';
import { DailyTakenError, ghostOf, type Duel, type Ghost, type LeagueEntry, type DuelInboxItem, type RunMode, type RunOutcome, type RunRecord, type Store, type StoredRun } from './store.ts';

const { TICK_RATE } = cats;

export class GameError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// What the client needs to play or continue a run.
export interface RunView {
  id: string;
  seed: number;
  mode: RunMode;
  daily: string | null; // date of the daily challenge this run plays
  duel: string | null; // code of the duel this run answers
  progress: RunRecord | null; // input saved so far, to continue the run
}

export interface StartResult {
  run: RunView;
  ghost: Ghost | null; // the run to race against, if any
}

export interface FinishResult {
  result: RunOutcome;
  daily?: { rank: number | null };
  duel?: { challengerName: string; challenger: { won: boolean; ticks: number; kills: number }; beat: boolean };
}

export interface Profile {
  fish: number;
  frame: string | null;
  owned: string[];
  tasks: { id: string; title: string; goal: number; reward: number; progress: number; done: boolean }[];
  season: {
    id: string; // YYYY-MM
    endsAt: string;
    points: number;
    perLevel: number;
    level: number; // levels reached, 0..rewards.length
    rewards: ({ fish: number } | { frame: string })[];
  };
}

type Score = { name: string; won: boolean; ticks: number; kills: number; me: boolean };

export interface DailyInfo {
  date: string;
  status: 'none' | 'active' | 'finished'; // the player's attempt today
  top: Score[];
  rank: number | null; // the player's place once their attempt is finished
}

// Days change at midnight Moscow time, when most players are.
const DAY_OFFSET_MS = 3 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;
export const dayOf = (now: number) => new Date(now + DAY_OFFSET_MS).toISOString().slice(0, 10);
export const dailySeed = (date: string) => hashSeed(`daily:${date}`);
// Weeks start on Monday; a week is named by its Monday.
export const weekOf = (now: number) => {
  const d = new Date(now + DAY_OFFSET_MS);
  return dayOf(now - ((d.getUTCDay() + 6) % 7) * DAY_MS);
};

export const LEAGUE_COUNT = 4; // bronze, silver, gold, diamond
export const LEAGUE_RUNS_PER_DAY = 3; // only the first runs of a day earn points
const LEAGUE_ZONE = 0.2; // share of a league that moves up or down each week
const MIN_LEAGUE_TO_DEMOTE = 5; // nobody drops out of a league smaller than this

const zoneSize = (size: number) => Math.max(1, Math.floor(size * LEAGUE_ZONE));

// Where a player goes after a week: the top fifth with points goes up, the bottom fifth down.
export function leagueMove(league: number, rank: number, size: number, points: number): -1 | 0 | 1 {
  const zone = zoneSize(size);
  if (rank <= zone && points > 0 && league < LEAGUE_COUNT - 1) return 1;
  if (size >= MIN_LEAGUE_TO_DEMOTE && rank > size - zone && league > 0) return -1;
  return 0;
}

export interface LeagueInfo {
  week: string;
  endsAt: string; // ISO time of the next week's start
  league: number;
  moved: number; // -1, 0 or 1 against the last week played
  points: number;
  runsToday: number; // runs counted today, out of runsPerDay
  runsPerDay: number;
  rank: number | null; // null until the player finishes a run this week
  size: number;
  up: number; // places that move up at the end of the week
  down: number; // places that move down
  top: { name: string; points: number; me: boolean }[];
}

export interface DuelInfo {
  code: string;
  challengerId: number;
  challengerName: string;
  won: boolean;
  ticks: number;
  kills: number;
}

// Told when a friend finishes a run that answers the player's duel.
export interface Notifier {
  duelAnswered(duel: Duel, friendName: string, beat: boolean): void;
}

// A record may claim at most this much play per second of real time: the
// game runs at 1x, the margin covers clock and network jitter.
const SPEED_MARGIN = 0.95;
const SLACK_MS = 3000;

const view = (r: StoredRun): RunView => ({ id: r.id, seed: r.seed, mode: r.mode, daily: r.daily, duel: r.duelCode, progress: r.record });

const CODE_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const DUEL_CODE = /^[a-zA-Z0-9]{8}$/;
const newCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join('');

export class Game {
  private store: Store;
  private notifier: Notifier | null;
  private now: () => number;

  constructor(store: Store, notifier: Notifier | null = null, now: () => number = Date.now) {
    this.store = store;
    this.notifier = notifier;
    this.now = now;
  }

  // Analytics must never break the game.
  async track(userId: number, name: string, data: Record<string, unknown> | null = null): Promise<void> {
    try {
      await this.store.addEvent(userId, name, data);
    } catch {
      // ignored
    }
  }

  // Starts a run. A daily run that is not finished yet is continued instead;
  // any other unfinished run is closed with the progress it has.
  async start(userId: number, playerName: string, mode: RunMode, duelCode: string | null = null, chatInstance: string | null = null): Promise<StartResult> {
    let seed = randomInt(0, 2 ** 31);
    let daily: string | null = null;
    let ghost: Ghost | null = null;
    if (mode === 'daily') {
      daily = dayOf(this.now());
      const existing = await this.store.dailyRun(userId, daily);
      if (existing && !existing.finished) return { run: view(existing), ghost: await this.store.dailyGhost(daily, userId) };
      if (existing) throw new GameError(409, 'Вызов дня уже сыгран, новый будет завтра');
      seed = dailySeed(daily);
      ghost = await this.store.dailyGhost(daily, userId);
    }
    if (mode === 'duel') {
      const duel = await this.duel(duelCode ?? '');
      if (duel.challengerId === userId) throw new GameError(422, 'Это ваш собственный вызов');
      seed = duel.run.seed;
      ghost = ghostOf(duel.run, duel.challengerName);
      duelCode = duel.code;
    } else duelCode = null;

    const active = await this.store.activeRun(userId);
    if (active) await this.settle(active, playerName, active.record ?? { moves: '', picks: '' });
    try {
      const { frame } = await this.store.wallet(userId);
      const run = await this.store.createRun(userId, { seed, mode, daily, duelCode, chatInstance, aura: frame });
      await this.track(userId, 'run_start', { mode });
      return { run: view(run), ghost };
    } catch (e) {
      if (e instanceof DailyTakenError) throw new GameError(409, 'Вызов дня уже начат в другом окне');
      throw e;
    }
  }

  // The unfinished run to continue, with its ghost.
  async current(userId: number): Promise<StartResult | null> {
    const run = await this.store.activeRun(userId);
    if (!run) return null;
    let ghost: Ghost | null = null;
    if (run.daily) ghost = await this.store.dailyGhost(run.daily, userId);
    if (run.duelCode) {
      const duel = await this.store.getDuel(run.duelCode);
      if (duel) ghost = ghostOf(duel.run, duel.challengerName);
    }
    return { run: view(run), ghost };
  }

  private async ownActive(userId: number, runId: string): Promise<StoredRun> {
    const run = await this.store.getRun(runId);
    if (!run || run.userId !== userId) throw new GameError(404, 'Забег не найден');
    if (run.finished) throw new GameError(409, 'Забег уже окончен');
    return run;
  }

  // Checks that the record parses and was not played faster than real time.
  private check(run: StoredRun, rec: RunRecord): void {
    let ticks: number;
    try {
      ticks = cats.decodeMoves(rec.moves).length;
      if (!/^[0-9]*$/.test(rec.picks) || rec.picks.length > 200) throw new Error('bad picks');
    } catch {
      throw new GameError(400, 'Неверная запись забега');
    }
    const minMs = (ticks / TICK_RATE) * 1000 * SPEED_MARGIN - SLACK_MS;
    if (this.now() - run.startedAt < minMs) throw new GameError(422, 'Запись забега длиннее, чем прошло времени');
  }

  // Keeps the input so far, so the run can be continued later or on another device.
  async save(userId: number, runId: string, rec: RunRecord): Promise<void> {
    const run = await this.ownActive(userId, runId);
    this.check(run, rec);
    if (!(await this.store.saveProgress(run.id, rec))) throw new GameError(409, 'Забег уже окончен');
  }

  // Replays the player's input on the run's seed: the client's own result is never trusted.
  async finish(userId: number, playerName: string, runId: string, rec: RunRecord): Promise<FinishResult> {
    const run = await this.ownActive(userId, runId);
    this.check(run, rec);
    const out = await this.settle(run, playerName, rec);
    if (!out) throw new GameError(409, 'Забег уже окончен');
    return out;
  }

  private async settle(run: StoredRun, playerName: string, rec: RunRecord): Promise<FinishResult | null> {
    let sim;
    try {
      sim = cats.replay(run.seed, rec);
    } catch {
      throw new GameError(400, 'Неверная запись забега');
    }
    const r = sim.result();
    const result: RunOutcome = { won: r.won, ticks: r.ticks, kills: r.kills, level: r.level, points: cats.runPoints(r.ticks, r.won) };
    if (!(await this.store.finishRun(run.id, result, rec))) return null;

    await this.countLeagueRun(run.userId, result.points);
    await this.track(run.userId, 'run_end', { seconds: Math.round(r.ticks / TICK_RATE), won: r.won, mode: run.mode, duel: run.mode === 'duel' });
    const out: FinishResult = { result };
    if (run.daily) out.daily = { rank: await this.store.dailyRank(run.userId, run.daily) };
    if (run.duelCode) {
      const duel = await this.store.getDuel(run.duelCode);
      if (duel) {
        const beat = cats.compareScores(result, duel.run) < 0;
        await this.store.addDuelResult({ duelCode: duel.code, runId: run.id, userId: run.userId, userName: playerName, won: r.won, ticks: r.ticks, kills: r.kills, beat });
        this.notifier?.duelAnswered(duel, playerName, beat);
        const { won, ticks, kills } = duel.run;
        out.duel = { challengerName: duel.challengerName, challenger: { won, ticks, kills }, beat };
      }
    }
    return out;
  }

  async daily(userId: number): Promise<DailyInfo> {
    const date = dayOf(this.now());
    const [mine, top, rank] = await Promise.all([
      this.store.dailyRun(userId, date),
      this.store.dailyTop(date, 10),
      this.store.dailyRank(userId, date),
    ]);
    return {
      date,
      status: !mine ? 'none' : mine.finished ? 'finished' : 'active',
      top: top.map(({ userId: id, name, won, ticks, kills }) => ({ name, won, ticks, kills, me: id === userId })),
      rank,
    };
  }

  // The player's league this week. Last week's result is settled lazily: it is
  // final once the week is over, so it can be computed when first needed.
  private async placement(userId: number, week: string): Promise<Pick<LeagueEntry, 'league' | 'moved'>> {
    const entry = await this.store.leagueEntry(userId, week);
    if (entry) return entry;
    const last = await this.store.lastLeagueEntry(userId, week);
    if (!last) return { league: 0, moved: 0 };
    const { rank, size } = await this.store.leagueStanding(userId, last.week, last.league);
    const moved = leagueMove(last.league, rank ?? size, size, last.points);
    return { league: last.league + moved, moved };
  }

  async league(userId: number): Promise<LeagueInfo> {
    const now = this.now();
    const week = weekOf(now);
    const [entry, { league, moved }] = await Promise.all([this.store.leagueEntry(userId, week), this.placement(userId, week)]);
    const [{ rank, size }, top] = await Promise.all([
      this.store.leagueStanding(userId, week, league),
      this.store.leagueTop(week, league, 10),
    ]);
    const zone = zoneSize(size);
    return {
      week,
      endsAt: new Date(Date.parse(week) + 7 * DAY_MS - DAY_OFFSET_MS).toISOString(),
      league,
      moved,
      points: entry?.points ?? 0,
      runsToday: entry?.day === dayOf(now) ? entry.dayRuns : 0,
      runsPerDay: LEAGUE_RUNS_PER_DAY,
      rank,
      size,
      up: league < LEAGUE_COUNT - 1 ? zone : 0,
      down: league > 0 && size >= MIN_LEAGUE_TO_DEMOTE ? zone : 0,
      top: top.map(({ userId: id, name, points }) => ({ name, points, me: id === userId })),
    };
  }

  private async countLeagueRun(userId: number, points: number): Promise<void> {
    const now = this.now();
    const week = weekOf(now);
    const place = await this.placement(userId, week);
    await this.store.addLeagueRun({ userId, week, ...place }, dayOf(now), points, LEAGUE_RUNS_PER_DAY);
  }

  // Daily tasks pay out as soon as they are done; checking again never pays twice.
  async profile(userId: number): Promise<Profile> {
    const now = this.now();
    const day = dayOf(now);
    const [activity, daily, claimed] = await Promise.all([
      this.store.activity(userId, new Date(Date.parse(day) - DAY_OFFSET_MS)),
      this.store.dailyRun(userId, day),
      this.store.claimedTasks(userId, day),
    ]);
    const progress: Record<string, number> = {
      runs: activity.runs,
      minutes: Math.floor(activity.ticks / (60 * TICK_RATE)),
      daily: daily?.finished ? 1 : 0,
    };
    const tasks = DAILY_TASKS.map((t) => {
      const p = Math.min(progress[t.id] ?? 0, t.goal);
      return { ...t, progress: p, done: p >= t.goal };
    });
    for (const t of tasks) if (t.done && !claimed.includes(t.id)) await this.store.claimTask(userId, day, t.id, t.reward);
    const season = await this.season(userId, day);
    return { ...(await this.store.wallet(userId)), tasks, season };
  }

  // The month's pass: finished runs earn their points, every level reached pays once.
  private async season(userId: number, day: string): Promise<Profile['season']> {
    const id = day.slice(0, 7);
    const start = `${id}-01`;
    const next = new Date(Date.parse(start));
    next.setUTCMonth(next.getUTCMonth() + 1);
    const [{ points }, claimed] = await Promise.all([
      this.store.activity(userId, new Date(Date.parse(start) - DAY_OFFSET_MS)),
      this.store.claimedTasks(userId, start),
    ]);
    const level = Math.min(Math.floor(points / SEASON_POINTS_PER_LEVEL), SEASON_PASS.length);
    for (let i = 0; i < level; i++) {
      if (claimed.includes(`pass${i + 1}`)) continue;
      const r = SEASON_PASS[i];
      await this.store.claimTask(userId, start, `pass${i + 1}`, 'fish' in r ? r.fish : 0, 'frame' in r ? r.frame : undefined);
    }
    return {
      id,
      endsAt: new Date(next.getTime() - DAY_OFFSET_MS).toISOString(),
      points,
      perLevel: SEASON_POINTS_PER_LEVEL,
      level,
      rewards: SEASON_PASS,
    };
  }

  async buy(userId: number, item: string): Promise<Profile> {
    const frame = frameById(item);
    if (!frame) throw new GameError(404, 'Такого товара нет');
    if (frame.exclusive) throw new GameError(422, 'Эту ауру можно только заработать в сезоне');
    const res = await this.store.buyItem(userId, frame.id, frame.price);
    if (res === 'poor') throw new GameError(422, 'Не хватает рыбок');
    if (res === 'ok') {
      await this.store.setFrame(userId, frame.id);
      await this.track(userId, 'shop_buy', { item: frame.id, price: frame.price });
    }
    return this.profile(userId);
  }

  // null takes the aura off.
  async equip(userId: number, item: string | null): Promise<Profile> {
    if (item !== null && !(await this.store.wallet(userId)).owned.includes(item)) throw new GameError(422, 'Эта аура ещё не куплена');
    await this.store.setFrame(userId, item);
    return this.profile(userId);
  }

  // Each player's best result this week among runs started from the chat the game was opened from.
  async chatTop(userId: number, chatInstance: string) {
    const since = new Date(this.now() - 7 * DAY_MS);
    const top = await this.store.chatTop(chatInstance, since, 10);
    return top.map(({ userId: id, name, won, ticks, kills, runs }) => ({ name, won, ticks, kills, runs, me: id === userId }));
  }

  // Shares a finished run as a duel; sharing the same run again returns the same code.
  async share(userId: number, playerName: string, runId: string): Promise<DuelInfo> {
    const run = await this.store.getRun(runId);
    if (!run || run.userId !== userId) throw new GameError(404, 'Забег не найден');
    if (!run.finished) throw new GameError(422, 'Забег ещё не окончен');
    const code = newCode();
    const duel = await this.store.createDuel({ code, runId, challengerId: userId, challengerName: playerName });
    if (duel.code === code) await this.track(userId, 'duel_share');
    return { ...duel, won: run.won, ticks: run.ticks, kills: run.kills };
  }

  async duelInfo(code: string): Promise<DuelInfo> {
    const d = await this.duel(code);
    return { code: d.code, challengerId: d.challengerId, challengerName: d.challengerName, won: d.run.won, ticks: d.run.ticks, kills: d.run.kills };
  }

  inbox(userId: number): Promise<DuelInboxItem[]> {
    return this.store.takeDuelInbox(userId, 10);
  }

  private async duel(code: string) {
    const duel = DUEL_CODE.test(code) ? await this.store.getDuel(code) : null;
    if (!duel) throw new GameError(404, 'Вызов не найден');
    return duel;
  }
}

// Validates the untrusted request body shape; the replay checks the rest.
export function parseRecord(body: unknown): RunRecord {
  const b = body as { moves?: unknown; picks?: unknown } | null;
  if (typeof b?.moves !== 'string' || typeof b.picks !== 'string') throw new GameError(400, 'Нет записи забега');
  return { moves: b.moves, picks: b.picks };
}
