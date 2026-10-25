import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { RunState } from '@otryad/core';
import { closestGhost, GHOST_CANDIDATES, type Ghost, type GhostUnit, type Store, type StoredRun, type UserStats } from './store.ts';

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
      'SELECT id, user_id, version, state, finished FROM runs WHERE user_id = $1 AND NOT finished',
      [userId],
    );
    return rows[0] ? toRun(rows[0]) : null;
  }

  async createRun(userId: number, state: RunState): Promise<StoredRun> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE runs SET finished = true, updated_at = now() WHERE user_id = $1 AND NOT finished', [userId]);
      const { rows } = await client.query(
        'INSERT INTO runs (user_id, state, finished, wins) VALUES ($1, $2, $3, $4) RETURNING id, user_id, version, state, finished',
        [userId, state, state.finished, state.wins],
      );
      await client.query('COMMIT');
      return toRun(rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
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
    await this.pool.query('TRUNCATE ghosts, runs, users RESTART IDENTITY CASCADE');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function toRun(row: { id: string; user_id: string | number; version: number; state: RunState; finished: boolean }): StoredRun {
  return { id: row.id, userId: Number(row.user_id), version: row.version, state: row.state, finished: row.finished };
}
