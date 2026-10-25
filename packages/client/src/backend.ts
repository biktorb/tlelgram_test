import { Run, type Action, type BattleOutcome, type RunState, type Unit } from '@otryad/core';
import ghostData from './ghosts.json';
import { initData } from './telegram.ts';

export interface TurnOutcome {
  out: BattleOutcome;
  enemy: string;
}

// Where runs live: in this browser (offline) or on the game server (online).
export interface Backend {
  readonly online: boolean;
  load(): Promise<Run>;
  newRun(): Promise<Run>;
  // Called after an action was applied to the local run.
  record(run: Run, action: Action): void;
  // Ends the shop phase and fights. Returns the run as it is after the battle.
  fight(run: Run): Promise<TurnOutcome & { run: Run }>;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

// ---------- Offline: localStorage + bundled bot teams ----------

type GhostTeam = Omit<Unit, 'uid'>[];
const GHOSTS = ghostData as unknown as Record<string, GhostTeam[]>;
const STORE_KEY = 'otryad.run.v1';

export class OfflineBackend implements Backend {
  readonly online = false;

  async load(): Promise<Run> {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const state = JSON.parse(raw) as RunState;
        return new Run(state.seed, state);
      }
    } catch {
      // Unreadable or unavailable storage: start fresh.
    }
    return this.newRun();
  }

  async newRun(): Promise<Run> {
    const run = new Run(newSeed());
    this.save(run);
    return run;
  }

  record(run: Run): void {
    this.save(run);
  }

  async fight(run: Run): Promise<TurnOutcome & { run: Run }> {
    const round = run.s.round;
    run.endTurn();
    const ghost = pickGhost(round).map((u, i) => ({ ...u, uid: i + 1 }));
    const out = run.fight(ghost, newSeed());
    this.save(run);
    return { out, enemy: `Кот #${1000 + Math.floor(Math.random() * 9000)}`, run };
  }

  private save(run: Run): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(run.snapshot()));
    } catch {
      // Storage can be unavailable (private mode); the run just won't survive a reload.
    }
  }
}

function pickGhost(round: number): GhostTeam {
  for (let r = Math.min(round, 20); r >= 1; r--) {
    const list = GHOSTS[r];
    if (list && list.length > 0) return list[Math.floor(Math.random() * list.length)];
  }
  return [];
}

// ---------- Online: the server owns the run ----------

interface RunView {
  id: string;
  version: number;
  state: RunState;
}

export class OnlineBackend implements Backend {
  readonly online = true;
  private base: string;
  private auth: string;
  private runId = '';
  private version = 0;
  private actions: Action[] = [];

  constructor(base: string, auth: string) {
    this.base = base.replace(/\/$/, '');
    this.auth = auth;
  }

  async load(): Promise<Run> {
    const { run } = await this.call<{ run: RunView | null }>('GET', '/api/runs/current');
    return run ? this.adopt(run) : this.newRun();
  }

  async newRun(): Promise<Run> {
    const { run } = await this.call<{ run: RunView }>('POST', '/api/runs');
    return this.adopt(run);
  }

  record(_run: Run, action: Action): void {
    this.actions.push(action);
  }

  async fight(): Promise<TurnOutcome & { run: Run }> {
    const res = await this.call<{ run: RunView; battle: BattleOutcome; enemy: { name: string } }>(
      'POST',
      `/api/runs/${this.runId}/turn`,
      { version: this.version, actions: this.actions },
    );
    return { out: res.battle, enemy: res.enemy.name, run: this.adopt(res.run) };
  }

  private adopt(view: RunView): Run {
    this.runId = view.id;
    this.version = view.version;
    this.actions = [];
    return new Run(view.state.seed, view.state);
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.base + path, {
        method,
        headers: { authorization: this.auth, ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'Нет связи с сервером');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error ?? `Ошибка сервера (${res.status})`);
    return data as T;
  }
}

// Online when the build knows a server and we can sign in: inside Telegram,
// or with ?dev=<id> against a server running with DEV_AUTH=1.
export function chooseBackend(): Backend {
  const base = import.meta.env.VITE_API_URL as string | undefined;
  if (!base) return new OfflineBackend();
  const tgData = initData();
  if (tgData) return new OnlineBackend(base, `tma ${tgData}`);
  const dev = new URLSearchParams(location.search).get('dev');
  if (dev) return new OnlineBackend(base, `dev ${dev}`);
  return new OfflineBackend();
}
