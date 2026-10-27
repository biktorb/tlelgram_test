import type { cats } from '@otryad/core';
import { initData } from '../telegram.ts';

export type RunRecord = cats.RunRecord;
export type RunMode = 'free' | 'daily' | 'duel';

export interface RunView {
  id: string;
  seed: number;
  mode: RunMode;
  daily: string | null;
  duel: string | null;
  hero: cats.HeroId;
  room: cats.RoomId;
  progress: RunRecord | null; // input saved so far
}

export interface Ghost {
  name: string;
  aura: string | null;
  hero: cats.HeroId;
  room: cats.RoomId;
  seed: number;
  record: RunRecord;
  won: boolean;
  ticks: number;
  kills: number;
}

export interface Started {
  run: RunView;
  ghost: Ghost | null;
}

export interface Outcome {
  won: boolean;
  ticks: number;
  kills: number;
  level: number;
  points: number;
}

export interface Finished {
  result: Outcome;
  daily?: { rank: number | null };
  duel?: { challengerName: string; challenger: { won: boolean; ticks: number; kills: number }; beat: boolean };
}

export interface Score {
  name: string;
  won: boolean;
  ticks: number;
  kills: number;
  me: boolean;
}

export interface DailyInfo {
  date: string;
  room: cats.RoomId;
  status: 'none' | 'active' | 'finished';
  top: Score[];
  rank: number | null;
}

export interface LeagueInfo {
  week: string;
  endsAt: string;
  league: number; // 0 bronze .. 3 diamond
  moved: number; // -1, 0 or 1 against the last week played
  points: number;
  runsToday: number;
  runsPerDay: number;
  rank: number | null;
  size: number;
  up: number;
  down: number;
  top: { name: string; points: number; me: boolean }[];
}

export interface HeroInfo {
  id: cats.HeroId;
  owned: boolean;
  have: number; // fish, minutes or kills so far
  need: number;
}

export interface Profile {
  fish: number;
  heroes: HeroInfo[];
  rooms: { id: cats.RoomId; owned: boolean }[];
  frame: string | null; // equipped aura
  owned: string[];
  tasks: { id: string; title: string; goal: number; reward: number; progress: number; done: boolean }[];
  season: { id: string; endsAt: string; points: number; perLevel: number; level: number; rewards: ({ fish: number } | { frame: string })[] };
}

export interface DuelInfo {
  code: string;
  challengerName: string;
  won: boolean;
  ticks: number;
  kills: number;
  mine?: boolean;
}

export interface DuelAnswer {
  userName: string;
  won: boolean;
  ticks: number;
  kills: number;
  beat: boolean; // the friend did better
  isNew: boolean;
}

export interface Me {
  user: { id: number; name: string };
  stats: { runs: number; wins: number; best: { won: boolean; ticks: number; kills: number } | null };
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// The game server. Without it (a plain browser build) the game still plays,
// only without the daily challenge, duels, leagues and fish.
export class Api {
  private base: string;
  private auth: string;

  constructor(base: string, auth: string) {
    this.base = base.replace(/\/$/, '');
    this.auth = auth;
  }

  me = () => this.call<Me>('GET', '/api/me');
  current = async () => (await this.call<{ current: Started | null }>('GET', '/api/runs/current')).current;
  start = (mode: RunMode, hero: cats.HeroId, room: cats.RoomId, duel?: string) => this.call<Started>('POST', '/api/runs', { mode, duel, hero, room });
  progress = (runId: string, rec: RunRecord) => this.call<void>('POST', `/api/runs/${runId}/progress`, rec);
  finish = (runId: string, rec: RunRecord) => this.call<Finished>('POST', `/api/runs/${runId}/finish`, rec);
  daily = async () => (await this.call<{ daily: DailyInfo }>('GET', '/api/daily')).daily;
  league = async () => (await this.call<{ league: LeagueInfo }>('GET', '/api/league')).league;
  profile = async () => (await this.call<{ profile: Profile }>('GET', '/api/profile')).profile;
  shop = async (what: 'buy' | 'equip', item: string | null) => (await this.call<{ profile: Profile }>('POST', `/api/shop/${what}`, { item })).profile;
  chat = async () => (await this.call<{ top: (Score & { runs: number })[] | null }>('GET', '/api/chat')).top;
  share = (runId: string) => this.call<{ duel: DuelInfo; link: string | null }>('POST', `/api/runs/${runId}/duel`);
  duel = async (code: string) => (await this.call<{ duel: DuelInfo }>('GET', `/api/duels/${encodeURIComponent(code)}`)).duel;
  answers = async () => (await this.call<{ results: DuelAnswer[] }>('GET', '/api/duels')).results;

  // Reports a product event; failures are ignored.
  track(name: 'share_chat' | 'share_story' | 'open_store'): void {
    this.call('POST', '/api/events', { name }).catch(() => {});
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
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error ?? `Ошибка сервера (${res.status})`);
    return data as T;
  }
}

// Online when the build knows a server and we can sign in: inside Telegram,
// or with ?dev=<id> against a server running with DEV_AUTH=1.
export function connect(): Api | null {
  const base = import.meta.env.VITE_API_URL as string | undefined;
  if (!base) return null;
  const tg = initData();
  if (tg) return new Api(base, `tma ${tg}`);
  const dev = new URLSearchParams(location.search).get('dev');
  return dev ? new Api(base, `dev ${dev}`) : null;
}
