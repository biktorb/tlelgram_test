import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { RunState } from '@otryad/core';
import {
  closestGhost,
  GHOST_CANDIDATES,
  type Duel,
  type DuelInboxItem,
  type DuelResult,
  type ChatEntry,
  type DailyEntry,
  DailyTakenError,
  type Ghost,
  type GhostUnit,
  type NewRunOptions,
  type Store,
  type StoredRun,
  type UserStats,
} from './store.ts';

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

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

  async activeRun(userId: number): Promise<StoredRun | null> {
    const { rows } = await this.pool.query(
      `SELECT ${RUN_COLUMNS} FROM runs WHERE user_id = $1 AND NOT finished`,
      [userId],
    );
    return rows[0] ? toRun(rows[0]) : null;
  }

  async getRun(runId: string): Promise<StoredRun | null> {
    if (!UUID.test(runId)) return null;
    const { rows } = await this.pool.query(`SELECT ${RUN_COLUMNS} FROM runs WHERE id = $1`, [runId]);
    return rows[0] ? toRun(rows[0]) : null;
  }

  async createRun(userId: number, state: RunState, opts: NewRunOptions = {}): Promise<StoredRun> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE runs SET finished = true, updated_at = now() WHERE user_id = $1 AND NOT finished', [userId]);
      const { rows } = await client.query(
        `INSERT INTO runs (user_id, state, finished, wins, duel_code, chat_instance, daily)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${RUN_COLUMNS}`,
        [userId, state, state.finished, state.wins, opts.duelCode ?? null, opts.chatInstance ?? null, opts.daily ?? null],
      );
      await client.query('COMMIT');
      return toRun(rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      if ((e as { constraint?: string }).constraint === 'runs_daily_once') throw new DailyTakenError();
      throw e;
    } finally {
      client.release();
    }
  }

  async saveRun(run: StoredRun, state: RunState): Promise<number | null> {
    const { rows } = await this.pool.query(
      `UPDATE runs SET state = $3, finished = $4, wins = $5, version = version + 1, updated_at = now()
       WHERE id = $1 AND version = $2 RETURNING version`,
      [run.id, run.version, state, state.finished, state.wins],
    );
    return rows[0]?.version ?? null;
  }

  async addGhost(round: number, wins: number, userId: number | null, name: string, team: GhostUnit[]): Promise<void> {
    await this.pool.query('INSERT INTO ghosts (round, wins, user_id, name, team) VALUES ($1, $2, $3, $4, $5)', [
      round,
      wins,
      userId,
      name,
      JSON.stringify(team),
    ]);
  }

  async addGhosts(rows: { round: number; wins: number; name: string; team: GhostUnit[] }[]): Promise<void> {
    if (rows.length === 0) return;
    await this.pool.query(
      `INSERT INTO ghosts (round, wins, user_id, name, team)
       SELECT * FROM jsonb_to_recordset($1::jsonb) AS t(round int, wins int, user_id bigint, name text, team jsonb)`,
      [JSON.stringify(rows.map((r) => ({ ...r, user_id: null })))],
    );
  }

  async pickGhost(round: number, wins: number, excludeUserId: number, random: () => number): Promise<Ghost | null> {
    const { rows } = await this.pool.query<{ wins: number; name: string; team: GhostUnit[] }>(
      `SELECT wins, name, team FROM ghosts
       WHERE round = $1 AND user_id IS DISTINCT FROM $2
       ORDER BY id DESC LIMIT ${GHOST_CANDIDATES}`,
      [round, excludeUserId],
    );
    const g = closestGhost(rows, wins, random);
    return g ? { name: g.name, team: g.team } : null;
  }

  async ghostCount(): Promise<number> {
    const { rows } = await this.pool.query<{ n: string }>('SELECT count(*) AS n FROM ghosts');
    return Number(rows[0].n);
  }

  async createDuel(duel: Duel): Promise<Duel> {
    await this.pool.query(
      `INSERT INTO duels (code, run_id, challenger_id, challenger_name, seed, wins, team)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (run_id) DO NOTHING`,
      [duel.code, duel.runId, duel.challengerId, duel.challengerName, duel.seed, duel.wins, JSON.stringify(duel.team)],
    );
    const { rows } = await this.pool.query(`SELECT ${DUEL_COLUMNS} FROM duels WHERE run_id = $1`, [duel.runId]);
    return toDuel(rows[0]);
  }

  async getDuel(code: string): Promise<Duel | null> {
    const { rows } = await this.pool.query(`SELECT ${DUEL_COLUMNS} FROM duels WHERE code = $1`, [code]);
    return rows[0] ? toDuel(rows[0]) : null;
  }

  async addDuelResult(r: DuelResult): Promise<void> {
    await this.pool.query(
      `INSERT INTO duel_results (duel_code, run_id, user_id, user_name, wins, team, battle_seed, result)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (run_id) DO NOTHING`,
      [r.duelCode, r.runId, r.userId, r.userName, r.wins, JSON.stringify(r.team), r.battleSeed, r.result],
    );
  }

  async takeDuelInbox(challengerId: number, limit: number): Promise<DuelInboxItem[]> {
    const { rows } = await this.pool.query<{ id: string; user_name: string; wins: number; result: DuelInboxItem['result']; seen: boolean }>(
      `SELECT r.id, r.user_name, r.wins, r.result, r.seen FROM duel_results r JOIN duels d ON d.code = r.duel_code
       WHERE d.challenger_id = $1 ORDER BY r.id DESC LIMIT $2`,
      [challengerId, limit],
    );
    const unseen = rows.filter((r) => !r.seen).map((r) => r.id);
    if (unseen.length) await this.pool.query('UPDATE duel_results SET seen = true WHERE id = ANY($1::bigint[])', [unseen]);
    return rows.map((r) => ({ userName: r.user_name, wins: r.wins, result: r.result, isNew: !r.seen }));
  }

  async dailyRun(userId: number, date: string): Promise<StoredRun | null> {
    const { rows } = await this.pool.query(`SELECT ${RUN_COLUMNS} FROM runs WHERE user_id = $1 AND daily = $2`, [userId, date]);
    return rows[0] ? toRun(rows[0]) : null;
  }

  async dailyTop(date: string, limit: number): Promise<DailyEntry[]> {
    const { rows } = await this.pool.query<{ user_id: string; name: string; wins: number; lives: number }>(
      `SELECT r.user_id, u.first_name AS name, r.wins, (r.state->>'lives')::int AS lives
       FROM runs r JOIN users u ON u.id = r.user_id
       WHERE r.daily = $1 AND r.finished
       ORDER BY r.wins DESC, lives DESC, r.updated_at ASC LIMIT $2`,
      [date, limit],
    );
    return rows.map((r) => ({ userId: Number(r.user_id), name: r.name, wins: r.wins, lives: r.lives }));
  }

  async dailyRank(userId: number, date: string): Promise<number | null> {
    const { rows } = await this.pool.query<{ rank: string }>(
      `WITH me AS (SELECT wins, (state->>'lives')::int AS lives, updated_at FROM runs WHERE user_id = $1 AND daily = $2 AND finished)
       SELECT 1 + count(*) AS rank FROM runs r, me
       WHERE r.daily = $2 AND r.finished AND r.user_id <> $1
         AND (r.wins, (r.state->>'lives')::int, me.updated_at) > (me.wins, me.lives, r.updated_at)
       HAVING (SELECT count(*) FROM me) > 0`,
      [userId, date],
    );
    return rows[0] ? Number(rows[0].rank) : null;
  }

  async chatTop(chatInstance: string, since: Date, limit: number): Promise<ChatEntry[]> {
    const { rows } = await this.pool.query<{ user_id: string; name: string; best: number; runs: string }>(
      `SELECT r.user_id, u.first_name AS name, max(r.wins) AS best, count(*) AS runs
       FROM runs r JOIN users u ON u.id = r.user_id
       WHERE r.chat_instance = $1 AND r.updated_at >= $2
       GROUP BY r.user_id, u.first_name
       ORDER BY best DESC, runs DESC LIMIT $3`,
      [chatInstance, since, limit],
    );
    return rows.map((r) => ({ userId: Number(r.user_id), name: r.name, bestWins: r.best, runs: Number(r.runs) }));
  }

  async stats(userId: number): Promise<UserStats> {
    const { rows } = await this.pool.query<{ runs: string; best: number | null; full: string }>(
      `SELECT count(*) AS runs, max(wins) AS best,
              count(*) FILTER (WHERE finished AND (state->>'lives')::int > 0) AS full
       FROM runs WHERE user_id = $1`,
      [userId],
    );
    return { runs: Number(rows[0].runs), bestWins: rows[0].best ?? 0, fullRuns: Number(rows[0].full) };
  }

  // Test helper: empties all game tables.
  async reset(): Promise<void> {
    await this.pool.query('TRUNCATE duel_results, duels, ghosts, runs, users RESTART IDENTITY CASCADE');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUN_COLUMNS = "id, user_id, version, state, finished, duel_code, to_char(daily, 'YYYY-MM-DD') AS daily";
const DUEL_COLUMNS = 'code, run_id, challenger_id, challenger_name, seed, wins, team';

function toRun(row: {
  id: string;
  user_id: string | number;
  version: number;
  state: RunState;
  finished: boolean;
  duel_code: string | null;
  daily: string | null;
}): StoredRun {
  return {
    id: row.id,
    userId: Number(row.user_id),
    version: row.version,
    state: row.state,
    finished: row.finished,
    duelCode: row.duel_code,
    daily: row.daily,
  };
}

function toDuel(row: {
  code: string;
  run_id: string;
  challenger_id: string | number;
  challenger_name: string;
  seed: string | number;
  wins: number;
  team: GhostUnit[];
}): Duel {
  return {
    code: row.code,
    runId: row.run_id,
    challengerId: Number(row.challenger_id),
    challengerName: row.challenger_name,
    seed: Number(row.seed),
    wins: row.wins,
    team: row.team,
  };
}
