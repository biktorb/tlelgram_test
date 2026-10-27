// Closed-test metrics computed from raw events. The test is small, so the
// last few weeks of events fit in memory and one implementation serves every store.

export interface GameEvent {
  userId: number;
  name: string;
  data: Record<string, unknown> | null;
  at: number; // ms
}

// Events the client may report; everything else is recorded by the server itself.
export const CLIENT_EVENTS = new Set(['share_chat', 'share_story', 'open_store']);

const DAY_MS = 24 * 3600 * 1000;
const OFFSET_MS = 3 * 3600 * 1000; // Moscow days, like the rest of the game
const SESSION_GAP_MS = 25 * 60 * 1000; // a longer pause starts a new session; a run lasts up to 20 minutes

const dayOf = (at: number) => new Date(at + OFFSET_MS).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);

export interface DayStats {
  date: string;
  activeUsers: number;
  newUsers: number;
  runsStarted: number;
  runsFinished: number;
  shares: number; // duel links made plus story shares
}

export interface Stats {
  days: DayStats[]; // newest first
  // Of players who first came on a given day, the share who came back exactly N days later,
  // over every cohort old enough to tell.
  retention: { d1: Rate; d7: Rate };
  minutesPerActiveDay: number; // median over player-days with a run started
  shareRate: Rate; // finished runs followed by a share or played as a duel answer
}

export interface Rate {
  of: number;
  hit: number;
  rate: number | null;
}

const rate = (hit: number, of: number): Rate => ({ of, hit, rate: of ? Math.round((1000 * hit) / of) / 1000 : null });

export function computeStats(events: GameEvent[], now: number, days = 14): Stats {
  const sorted = [...events].sort((a, b) => a.at - b.at);
  const today = dayOf(now);
  const firstDay = new Map<number, string>();
  const activeDays = new Map<number, Set<string>>();
  for (const e of sorted) {
    const d = dayOf(e.at);
    if (!firstDay.has(e.userId)) firstDay.set(e.userId, d);
    (activeDays.get(e.userId) ?? activeDays.set(e.userId, new Set()).get(e.userId)!).add(d);
  }

  const byDay = new Map<string, DayStats>();
  for (let i = 0; i < days; i++) {
    const date = addDays(today, -i);
    byDay.set(date, { date, activeUsers: 0, newUsers: 0, runsStarted: 0, runsFinished: 0, shares: 0 });
  }
  for (const [user, set] of activeDays) {
    for (const d of set) {
      const row = byDay.get(d);
      if (!row) continue;
      row.activeUsers++;
      if (firstDay.get(user) === d) row.newUsers++;
    }
  }
  let finished = 0;
  let shared = 0;
  for (const e of sorted) {
    const row = byDay.get(dayOf(e.at));
    if (e.name === 'run_end') {
      finished++;
      if (e.data?.duel) shared++;
    }
    if (e.name === 'duel_share' || e.name === 'share_story') shared++;
    if (!row) continue;
    if (e.name === 'run_start') row.runsStarted++;
    if (e.name === 'run_end') row.runsFinished++;
    if (e.name === 'duel_share' || e.name === 'share_story') row.shares++;
  }

  const retained = (n: number): Rate => {
    let of = 0;
    let hit = 0;
    for (const [user, first] of firstDay) {
      if (addDays(first, n) >= today) continue; // that day is not over yet
      of++;
      if (activeDays.get(user)!.has(addDays(first, n))) hit++;
    }
    return rate(hit, of);
  };

  // Time between consecutive events of a player, without the long pauses.
  const minutes = new Map<string, number>();
  const last = new Map<number, number>();
  for (const e of sorted) {
    const prev = last.get(e.userId);
    last.set(e.userId, e.at);
    const key = `${e.userId}:${dayOf(e.at)}`;
    const gap = prev === undefined ? 0 : e.at - prev;
    minutes.set(key, (minutes.get(key) ?? 0) + (gap < SESSION_GAP_MS ? gap / 60000 : 0));
  }
  const played = new Set(sorted.filter((e) => e.name === 'run_start').map((e) => `${e.userId}:${dayOf(e.at)}`));
  const m = [...minutes].filter(([key]) => played.has(key)).map(([, v]) => v).sort((a, b) => a - b);
  const median = m.length ? m[Math.floor(m.length / 2)] : 0;

  return {
    days: [...byDay.values()],
    retention: { d1: retained(1), d7: retained(7) },
    minutesPerActiveDay: Math.round(median * 10) / 10,
    shareRate: rate(Math.min(shared, finished), finished),
  };
}
