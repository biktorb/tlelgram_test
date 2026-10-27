import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { GameEvent } from './stats.ts';
import {
  type Activity,
  type BuyResult,
  type ChatEntry,
  DailyTakenError,
  type Duel,
  type RecentRun,
  type DuelInboxItem,
  type DuelResult,
  type DuelWithRun,
  type Ghost,
  ghostOf,
  type LeagueEntry,
  type LeagueRow,
  type NewRun,
  type RunOutcome,
  type RunRecord,
  type ScoreRow,
  type Store,
  type StoredRun,
  type UserStats,
  type Wallet,
} from './store.ts';

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

// The order of finished runs on every board, as in cats.compareScores; ties go to who finished first.
const SCORE_ORDER = 'won DESC, ticks DESC, kills DESC, finished_at ASC';

export class PgStore implements Store {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 10 });
  }

  // Applies migrations/*.sql in name order, each once, under an advisory lock
  // so several server instances can start at the same time.
  async migrate(): Promise<string[]> {
    const client = await this.pool.connect();
    const applied: string[] = [];
    try {
      await client.query('SELECT pg_advisory_lock(424242)');
      await client.query('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
      const done = new Set((await client.query<{ name: string }>('SELECT name FROM migrations')).rows.map((r) => r.name));
      const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        if (done.has(file)) continue;
        const sql = await readFile(MIGRATIONS_DIR + file, 'utf8');
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          applied.push(file);
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock(424242)').catch(() => {});
      client.release();
    }
    return applied;
  }

  async upsertUser(id: number, firstName: string, username?: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (id, first_name, username) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET first_name = $2, username = $3, last_seen = now()`,
      [id, firstName, username ?? null],
    );
  }

  async createRun(userId: number, n: NewRun): Promise<StoredRun> {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO cat_runs (user_id, seed, mode, daily, duel_code, chat_instance, aura, hero)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${RUN_COLUMNS}`,
        [userId, n.seed, n.mode, n.daily ?? null, n.duelCode ?? null, n.chatInstance ?? null, n.aura ?? null, n.hero ?? 'ryzhik'],
      );
      return toRun(rows[0]);
    } catch (e) {
      if ((e as { constraint?: string }).constraint === 'cat_runs_daily_once') throw new DailyTakenError();
      throw e;
    }
  }

  async recentRuns(limit: number): Promise<RecentRun[]> {
    const { rows } = await this.pool.query(
      `SELECT ${RUN_COLUMNS}, u.first_name AS name FROM cat_runs JOIN users u ON u.id = cat_runs.user_id
       WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({ ...toRun(r), name: r.name, finishedAt: r.finished_at.getTime() }));
  }

  async getRun(runId: string): Promise<StoredRun | null> {
    if (!UUID.test(runId)) return null;
    const { rows } = await this.pool.query(`SELECT ${RUN_COLUMNS} FROM cat_runs WHERE id = $1`, [runId]);
    return rows[0] ? toRun(rows[0]) : null;
  }

  async activeRun(userId: number): Promise<StoredRun | null> {
    const { rows } = await this.pool.query(`SELECT ${RUN_COLUMNS} FROM cat_runs WHERE user_id = $1 AND finished_at IS NULL`, [userId]);
    return rows[0] ? toRun(rows[0]) : null;
  }

  async saveProgress(runId: string, record: RunRecord): Promise<boolean> {
    if (!UUID.test(runId)) return false;
    const { rowCount } = await this.pool.query(
      'UPDATE cat_runs SET record = $2, saved_at = now() WHERE id = $1 AND finished_at IS NULL',
      [runId, record],
    );
    return rowCount === 1;
  }

  async finishRun(runId: string, o: RunOutcome, record: RunRecord): Promise<boolean> {
    if (!UUID.test(runId)) return false;
    const { rowCount } = await this.pool.query(
      `UPDATE cat_runs SET finished_at = clock_timestamp(), won = $2, ticks = $3, kills = $4, level = $5, points = $6, record = $7
       WHERE id = $1 AND finished_at IS NULL`,
      [runId, o.won, o.ticks, o.kills, o.level, o.points, record],
    );
    return rowCount === 1;
  }

  async dailyRun(userId: number, date: string): Promise<StoredRun | null> {
    const { rows } = await this.pool.query(`SELECT ${RUN_COLUMNS} FROM cat_runs WHERE user_id = $1 AND daily = $2`, [userId, date]);
    return rows[0] ? toRun(rows[0]) : null;
  }

  async dailyTop(date: string, limit: number): Promise<ScoreRow[]> {
    const { rows } = await this.pool.query<ScoreSqlRow>(
      `SELECT r.user_id, u.first_name AS name, r.won, r.ticks, r.kills
       FROM cat_runs r JOIN users u ON u.id = r.user_id
       WHERE r.daily = $1 AND r.finished_at IS NOT NULL
       ORDER BY ${SCORE_ORDER} LIMIT $2`,
      [date, limit],
    );
    return rows.map(toScore);
  }

  async dailyRank(userId: number, date: string): Promise<number | null> {
    const { rows } = await this.pool.query<{ rank: string }>(
      `WITH me AS (SELECT won, ticks, kills, finished_at FROM cat_runs WHERE user_id = $1 AND daily = $2 AND finished_at IS NOT NULL)
       SELECT 1 + count(*) FILTER (WHERE r.user_id IS NOT NULL) AS rank
       FROM me LEFT JOIN cat_runs r
         ON r.daily = $2 AND r.finished_at IS NOT NULL AND r.user_id <> $1
        AND (r.won, r.ticks, r.kills, me.finished_at) > (me.won, me.ticks, me.kills, r.finished_at)
       GROUP BY me.won`,
      [userId, date],
    );
    return rows[0] ? Number(rows[0].rank) : null;
  }

  async dailyGhost(date: string, excludeUserId: number): Promise<Ghost | null> {
    const { rows } = await this.pool.query(
      `SELECT ${RUN_COLUMNS}, u.first_name AS name FROM cat_runs JOIN users u ON u.id = cat_runs.user_id
       WHERE daily = $1 AND finished_at IS NOT NULL AND user_id <> $2
       ORDER BY ${SCORE_ORDER} LIMIT 1`,
      [date, excludeUserId],
    );
    return rows[0] ? ghostOf(toRun(rows[0]), rows[0].name) : null;
  }

  async createDuel(duel: Duel): Promise<Duel> {
    await this.pool.query(
      `INSERT INTO cat_duels (code, run_id, challenger_id, challenger_name) VALUES ($1, $2, $3, $4) ON CONFLICT (run_id) DO NOTHING`,
      [duel.code, duel.runId, duel.challengerId, duel.challengerName],
    );
    const { rows } = await this.pool.query('SELECT code, run_id, challenger_id, challenger_name FROM cat_duels WHERE run_id = $1', [duel.runId]);
    return toDuel(rows[0]);
  }

  async getDuel(code: string): Promise<DuelWithRun | null> {
    const { rows } = await this.pool.query('SELECT code, run_id, challenger_id, challenger_name FROM cat_duels WHERE code = $1', [code]);
    if (!rows[0]) return null;
    const run = await this.getRun(rows[0].run_id);
    return run ? { ...toDuel(rows[0]), run } : null;
  }

  async addDuelResult(r: DuelResult): Promise<void> {
    await this.pool.query(
      `INSERT INTO cat_duel_results (duel_code, run_id, user_id, user_name, won, ticks, kills, beat)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (run_id) DO NOTHING`,
      [r.duelCode, r.runId, r.userId, r.userName, r.won, r.ticks, r.kills, r.beat],
    );
  }

  async takeDuelInbox(challengerId: number, limit: number): Promise<DuelInboxItem[]> {
    const { rows } = await this.pool.query<{ id: string; user_name: string; won: boolean; ticks: number; kills: number; beat: boolean; seen: boolean }>(
      `SELECT r.id, r.user_name, r.won, r.ticks, r.kills, r.beat, r.seen FROM cat_duel_results r JOIN cat_duels d ON d.code = r.duel_code
       WHERE d.challenger_id = $1 ORDER BY r.id DESC LIMIT $2`,
      [challengerId, limit],
    );
    const unseen = rows.filter((r) => !r.seen).map((r) => r.id);
    if (unseen.length) await this.pool.query('UPDATE cat_duel_results SET seen = true WHERE id = ANY($1::bigint[])', [unseen]);
    return rows.map((r) => ({ userName: r.user_name, won: r.won, ticks: r.ticks, kills: r.kills, beat: r.beat, isNew: !r.seen }));
  }

  async leagueEntry(userId: number, week: string): Promise<LeagueEntry | null> {
    const { rows } = await this.pool.query(`SELECT ${LEAGUE_COLUMNS} FROM league_weeks WHERE user_id = $1 AND week = $2`, [userId, week]);
    return rows[0] ? toEntry(rows[0]) : null;
  }

  async lastLeagueEntry(userId: number, beforeWeek: string): Promise<LeagueEntry | null> {
    const { rows } = await this.pool.query(
      `SELECT ${LEAGUE_COLUMNS} FROM league_weeks WHERE user_id = $1 AND week < $2 ORDER BY week DESC LIMIT 1`,
      [userId, beforeWeek],
    );
    return rows[0] ? toEntry(rows[0]) : null;
  }

  async addLeagueRun(entry: Pick<LeagueEntry, 'userId' | 'week' | 'league' | 'moved'>, day: string, points: number, runsPerDay: number): Promise<LeagueEntry> {
    const { userId, week } = entry;
    await this.pool.query(
      'INSERT INTO league_weeks (user_id, week, league, moved) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [userId, week, entry.league, entry.moved],
    );
    await this.pool.query(
      `UPDATE league_weeks
       SET points = points + $4,
           day_runs = CASE WHEN day = $3 THEN day_runs + 1 ELSE 1 END,
           day = $3,
           updated_at = CASE WHEN $4 > 0 THEN now() ELSE updated_at END
       WHERE user_id = $1 AND week = $2 AND (day IS DISTINCT FROM $3 OR day_runs < $5)`,
      [userId, week, day, points, runsPerDay],
    );
    return (await this.leagueEntry(userId, week))!;
  }

  async leagueTop(week: string, league: number, limit: number): Promise<LeagueRow[]> {
    const { rows } = await this.pool.query<{ user_id: string; name: string; points: number }>(
      `SELECT l.user_id, u.first_name AS name, l.points
       FROM league_weeks l JOIN users u ON u.id = l.user_id
       WHERE l.week = $1 AND l.league = $2
       ORDER BY l.points DESC, l.updated_at ASC LIMIT $3`,
      [week, league, limit],
    );
    return rows.map((r) => ({ userId: Number(r.user_id), name: r.name, points: r.points }));
  }

  async leagueStanding(userId: number, week: string, league: number): Promise<{ rank: number | null; size: number }> {
    const { rows } = await this.pool.query<{ size: string; rank: string | null }>(
      `WITH me AS (SELECT points, updated_at FROM league_weeks WHERE user_id = $1 AND week = $2 AND league = $3)
       SELECT (SELECT count(*) FROM league_weeks WHERE week = $2 AND league = $3) AS size,
              (SELECT 1 + count(*) FROM league_weeks l, me
               WHERE l.week = $2 AND l.league = $3 AND l.user_id <> $1
                 AND (l.points, me.updated_at) > (me.points, l.updated_at)
               HAVING (SELECT count(*) FROM me) > 0) AS rank`,
      [userId, week, league],
    );
    return { rank: rows[0].rank === null ? null : Number(rows[0].rank), size: Number(rows[0].size) };
  }

  async chatTop(chatInstance: string, since: Date, limit: number): Promise<ChatEntry[]> {
    const { rows } = await this.pool.query<ScoreSqlRow & { runs: string }>(
      `SELECT * FROM (
         SELECT DISTINCT ON (r.user_id) r.user_id, u.first_name AS name, r.won, r.ticks, r.kills, r.finished_at,
                count(*) OVER (PARTITION BY r.user_id) AS runs
         FROM cat_runs r JOIN users u ON u.id = r.user_id
         WHERE r.chat_instance = $1 AND r.finished_at >= $2
         ORDER BY r.user_id, ${SCORE_ORDER}
       ) best ORDER BY ${SCORE_ORDER} LIMIT $3`,
      [chatInstance, since, limit],
    );
    return rows.map((r) => ({ ...toScore(r), runs: Number(r.runs) }));
  }

  async stats(userId: number): Promise<UserStats> {
    const { rows } = await this.pool.query<{ runs: string; wins: string }>(
      'SELECT count(*) AS runs, count(*) FILTER (WHERE won) AS wins FROM cat_runs WHERE user_id = $1 AND finished_at IS NOT NULL',
      [userId],
    );
    const best = await this.pool.query<{ won: boolean; ticks: number; kills: number }>(
      `SELECT won, ticks, kills FROM cat_runs WHERE user_id = $1 AND finished_at IS NOT NULL ORDER BY ${SCORE_ORDER} LIMIT 1`,
      [userId],
    );
    return { runs: Number(rows[0].runs), wins: Number(rows[0].wins), best: best.rows[0] ?? null };
  }

  async wallet(userId: number): Promise<Wallet> {
    const { rows } = await this.pool.query<{ fish: number; frame: string | null; owned: string[] }>(
      `SELECT u.fish, u.frame, coalesce(array_agg(i.item ORDER BY i.created_at) FILTER (WHERE i.item IS NOT NULL), '{}') AS owned
       FROM users u LEFT JOIN user_items i ON i.user_id = u.id
       WHERE u.id = $1 GROUP BY u.id`,
      [userId],
    );
    return rows[0] ?? { fish: 0, frame: null, owned: [] };
  }

  async activity(userId: number, since: Date): Promise<Activity> {
    const { rows } = await this.pool.query<{ runs: string; ticks: string | null; kills: string | null; points: string | null }>(
      'SELECT count(*) AS runs, sum(ticks) AS ticks, sum(kills) AS kills, sum(points) AS points FROM cat_runs WHERE user_id = $1 AND finished_at >= $2',
      [userId, since],
    );
    const r = rows[0];
    return { runs: Number(r.runs), ticks: Number(r.ticks ?? 0), kills: Number(r.kills ?? 0), points: Number(r.points ?? 0) };
  }

  async claimedTasks(userId: number, day: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ task: string }>('SELECT task FROM task_claims WHERE user_id = $1 AND day = $2', [userId, day]);
    return rows.map((r) => r.task);
  }

  async claimTask(userId: number, day: string, task: string, reward: number, item?: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `WITH claim AS (
         INSERT INTO task_claims (user_id, day, task, reward) VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING RETURNING reward
       ), granted AS (
         INSERT INTO user_items (user_id, item) SELECT $1, $5::text FROM claim WHERE $5::text IS NOT NULL
         ON CONFLICT DO NOTHING
       )
       UPDATE users SET fish = fish + claim.reward FROM claim WHERE users.id = $1`,
      [userId, day, task, reward, item ?? null],
    );
    return rowCount === 1;
  }

  async buyItem(userId: number, item: string, price: number): Promise<BuyResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const owned = await client.query('INSERT INTO user_items (user_id, item) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, item]);
      if (owned.rowCount === 0) {
        await client.query('ROLLBACK');
        return 'owned';
      }
      const paid = await client.query('UPDATE users SET fish = fish - $2 WHERE id = $1 AND fish >= $2', [userId, price]);
      await client.query(paid.rowCount === 1 ? 'COMMIT' : 'ROLLBACK');
      return paid.rowCount === 1 ? 'ok' : 'poor';
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async setFrame(userId: number, frame: string | null): Promise<void> {
    await this.pool.query('UPDATE users SET frame = $2 WHERE id = $1', [userId, frame]);
  }

  async addEvent(userId: number, name: string, data: Record<string, unknown> | null = null): Promise<void> {
    await this.pool.query('INSERT INTO events (user_id, name, data) VALUES ($1, $2, $3)', [userId, name, data]);
  }

  async eventsSince(since: Date): Promise<GameEvent[]> {
    const { rows } = await this.pool.query<{ user_id: string; name: string; data: Record<string, unknown> | null; at: Date }>(
      'SELECT user_id, name, data, at FROM events WHERE at >= $1 ORDER BY at',
      [since],
    );
    return rows.map((r) => ({ userId: Number(r.user_id), name: r.name, data: r.data, at: r.at.getTime() }));
  }

  // Test helper: empties all game tables.
  async reset(): Promise<void> {
    await this.pool.query(
      'TRUNCATE events, task_claims, user_items, league_weeks, cat_duel_results, cat_duels, cat_runs, duel_results, duels, ghosts, runs, users RESTART IDENTITY CASCADE',
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUN_COLUMNS =
  "cat_runs.id, cat_runs.user_id, seed, mode, to_char(daily, 'YYYY-MM-DD') AS daily, duel_code, aura, hero, started_at, finished_at, won, ticks, kills, level, points, record";
const LEAGUE_COLUMNS = "user_id, to_char(week, 'YYYY-MM-DD') AS week, league, moved, points, to_char(day, 'YYYY-MM-DD') AS day, day_runs";

interface ScoreSqlRow {
  user_id: string | number;
  name: string;
  won: boolean;
  ticks: number;
  kills: number;
}

const toScore = (r: ScoreSqlRow): ScoreRow => ({ userId: Number(r.user_id), name: r.name, won: r.won, ticks: r.ticks, kills: r.kills });

function toRun(row: {
  id: string;
  user_id: string | number;
  seed: string | number;
  mode: StoredRun['mode'];
  daily: string | null;
  duel_code: string | null;
  aura: string | null;
  hero: StoredRun['hero'];
  started_at: Date;
  finished_at: Date | null;
  won: boolean;
  ticks: number;
  kills: number;
  level: number;
  points: number;
  record: RunRecord | null;
}): StoredRun {
  return {
    id: row.id,
    userId: Number(row.user_id),
    seed: Number(row.seed),
    mode: row.mode,
    daily: row.daily,
    duelCode: row.duel_code,
    aura: row.aura,
    hero: row.hero,
    startedAt: row.started_at.getTime(),
    finished: row.finished_at !== null,
    won: row.won,
    ticks: row.ticks,
    kills: row.kills,
    level: row.level,
    points: row.points,
    record: row.record,
  };
}

function toDuel(row: { code: string; run_id: string; challenger_id: string | number; challenger_name: string }): Duel {
  return { code: row.code, runId: row.run_id, challengerId: Number(row.challenger_id), challengerName: row.challenger_name };
}

function toEntry(row: {
  user_id: string | number;
  week: string;
  league: number;
  moved: number;
  points: number;
  day: string | null;
  day_runs: number;
}): LeagueEntry {
  return { userId: Number(row.user_id), week: row.week, league: row.league, moved: row.moved, points: row.points, day: row.day, dayRuns: row.day_runs };
}
