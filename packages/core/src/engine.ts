import type { Effect, Target, Trigger, Unit } from './types.ts';
import { MAX_STAT, MAX_TEAM } from './types.ts';
import { def, levelOf } from './units.ts';
import type { Rng } from './rng.ts';

export type EngineEvent =
  | { t: 'ability'; side: number; uid: number; trigger: Trigger }
  | { t: 'buff'; side: number; uid: number; atk: number; hp: number }
  | { t: 'damage'; side: number; uid: number; amount: number }
  | { t: 'attack'; left: number; right: number }
  | { t: 'faint'; side: number; uid: number }
  | { t: 'summon'; side: number; uid: number; id: string; atk: number; hp: number; pos: number }
  | { t: 'gold'; amount: number };

interface Pending {
  side: number;
  unit: Unit; // may already be removed from the board (faint)
  trigger: Trigger;
  pos: number; // position at trigger time
  source?: Unit;
}

const MAX_STEPS = 2000;

// Resolves abilities on one or two lines of units. The shop uses side 0 only,
// battles use both. Index 0 of a line is the front.
export class Engine {
  sides: Unit[][];
  rng: Rng;
  events: EngineEvent[] = [];
  gold = 0;
  private queue: Pending[] = [];
  private nextUid: () => number;
  private steps = 0;

  constructor(sides: Unit[][], rng: Rng, nextUid: () => number) {
    this.sides = sides;
    this.rng = rng;
    this.nextUid = nextUid;
  }

  fire(side: number, unit: Unit, trigger: Trigger, source?: Unit): void {
    const d = def(unit.id);
    if (d.trigger !== trigger || !d.effect) return;
    this.queue.push({ side, unit, trigger, pos: this.sides[side].indexOf(unit), source });
  }

  // Fires `trigger` for every unit in a line, front to back.
  fireAll(side: number, trigger: Trigger): void {
    for (const u of this.sides[side].slice()) this.fire(side, u, trigger);
  }

  run(): void {
    this.reap();
    while (this.queue.length > 0) {
      if (++this.steps > MAX_STEPS) {
        this.queue.length = 0;
        return;
      }
      const p = this.queue.shift()!;
      this.resolve(p);
      this.reap();
    }
  }

  damage(side: number, unit: Unit, amount: number): void {
    if (amount <= 0 || unit.hp <= 0) return;
    unit.hp -= amount;
    this.events.push({ t: 'damage', side, uid: unit.uid, amount });
    if (unit.hp > 0) this.fire(side, unit, 'hurt');
  }

  buff(side: number, unit: Unit, atk: number, hp: number): void {
    if (unit.hp <= 0) return;
    unit.atk = Math.min(MAX_STAT, unit.atk + atk);
    unit.hp = Math.min(MAX_STAT, unit.hp + hp);
    this.events.push({ t: 'buff', side, uid: unit.uid, atk, hp });
  }

  summon(side: number, id: string, atk: number, hp: number, pos: number): Unit | null {
    const line = this.sides[side];
    if (line.length >= MAX_TEAM) return null;
    const unit: Unit = { uid: this.nextUid(), id, atk, hp, xp: 0 };
    const at = Math.max(0, Math.min(pos, line.length));
    line.splice(at, 0, unit);
    this.events.push({ t: 'summon', side, uid: unit.uid, id, atk, hp, pos: at });
    for (const friend of line) if (friend !== unit) this.fire(side, friend, 'friendSummoned', unit);
    return unit;
  }

  // Removes dead units and queues their faint abilities.
  reap(): void {
    for (let side = 0; side < this.sides.length; side++) {
      const line = this.sides[side];
      for (let i = 0; i < line.length; i++) {
        const u = line[i];
        if (u.hp > 0) continue;
        line.splice(i, 1);
        this.events.push({ t: 'faint', side, uid: u.uid });
        const d = def(u.id);
        if (d.trigger === 'faint' && d.effect) this.queue.push({ side, unit: u, trigger: 'faint', pos: i });
        const behind = line[i];
        if (behind) this.fire(side, behind, 'friendAheadFaints', u);
        i--;
      }
    }
  }

  private resolve(p: Pending): void {
    const d = def(p.unit.id);
    const effect = d.effect!;
    const alive = this.sides[p.side].includes(p.unit);
    if (!alive && p.trigger !== 'faint' && p.trigger !== 'sell') return;
    const pos = alive ? this.sides[p.side].indexOf(p.unit) : p.pos;
    const level = levelOf(p.unit.xp);
    const mult = p.trigger === 'levelUp' ? level - 1 : level;
    this.events.push({ t: 'ability', side: p.side, uid: p.unit.uid, trigger: p.trigger });
    this.apply(p, effect, mult, alive, pos);
  }

  private apply(p: Pending, e: Effect, mult: number, alive: boolean, pos: number): void {
    switch (e.kind) {
      case 'buff':
        for (const [side, u] of this.targets(p, e.target, e.count ?? 1, alive, pos)) {
          this.buff(side, u, e.atk * mult, e.hp * mult);
        }
        return;
      case 'damage':
        for (const [side, u] of this.targets(p, e.target, e.count ?? 1, alive, pos)) {
          this.damage(side, u, e.amount * mult);
        }
        return;
      case 'summon':
        for (let i = 0; i < (e.count ?? 1); i++) {
          this.summon(p.side, e.token, e.atk * mult, e.hp * mult, pos);
        }
        return;
      case 'gold':
        this.gold += e.amount * mult;
        this.events.push({ t: 'gold', amount: e.amount * mult });
        return;
    }
  }

  private targets(p: Pending, target: Target, count: number, alive: boolean, pos: number): [number, Unit][] {
    const own = this.sides[p.side];
    const enemySide = 1 - p.side;
    const enemies = this.sides[enemySide] ?? [];
    const friends = own.filter((u) => u !== p.unit);
    const mine = (list: Unit[]): [number, Unit][] => list.map((u) => [p.side, u]);
    const theirs = (list: Unit[]): [number, Unit][] => list.map((u) => [enemySide, u]);
    const behindStart = alive ? pos + 1 : pos;
    switch (target) {
      case 'self':
        return alive ? mine([p.unit]) : [];
      case 'source':
        return p.source && own.includes(p.source) ? mine([p.source]) : [];
      case 'randomFriend':
        return mine(this.rng.sample(friends, count));
      case 'allFriends':
        return mine(friends);
      case 'friendAhead':
        return pos > 0 && own[pos - 1] ? mine([own[pos - 1]]) : [];
      case 'friendsBehind':
        return mine(own.slice(behindStart, behindStart + count));
      case 'adjacentFriends': {
        const out: Unit[] = [];
        if (pos > 0 && own[pos - 1]) out.push(own[pos - 1]);
        if (own[behindStart]) out.push(own[behindStart]);
        return mine(out);
      }
      case 'randomEnemy':
        return theirs(this.rng.sample(enemies, count));
      case 'allEnemies':
        return theirs(enemies);
      case 'everyone':
        return [...mine(friends), ...theirs(enemies)];
      case 'lowestHpEnemy':
        return theirs(pickBy(enemies, count, (a, b) => a.hp - b.hp));
      case 'highestAtkEnemy':
        return theirs(pickBy(enemies, count, (a, b) => b.atk - a.atk));
    }
  }
}

function pickBy(list: Unit[], count: number, cmp: (a: Unit, b: Unit) => number): Unit[] {
  return list
    .map((u, i) => ({ u, i }))
    .sort((a, b) => cmp(a.u, b.u) || a.i - b.i)
    .slice(0, count)
    .map((x) => x.u);
}
