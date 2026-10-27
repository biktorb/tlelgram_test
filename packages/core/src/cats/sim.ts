import { Rng } from '../rng.ts';
import {
  BASE_STATS,
  ENEMIES,
  EVOLUTIONS,
  HEROES,
  PASSIVES,
  PASSIVE_IDS,
  SLOTS,
  WEAPONS,
  WEAPON_IDS,
  isPassive,
  isWeapon,
  itemMax,
  xpToNext,
  type CardId,
  type EnemyKind,
  type HeroId,
  type ItemId,
  type PassiveId,
  type Stats,
  type WeaponId,
  type WeaponStats,
} from './content.ts';
import { RoomMap } from './map.ts';
import { dcos, dsin, len } from './math.ts';

// Fixed step: the same input on the same seed gives the same run everywhere.
export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;
export const RUN_SECONDS = 20 * 60;
export const RUN_TICKS = RUN_SECONDS * TICK_RATE;
const MINUTE_TICKS = 60 * TICK_RATE;
// At 20:00 the room is won and the Cleaner comes, one more every minute;
// the run goes on until she catches the cat, at most this long.
export const END_TICKS = RUN_TICKS + 10 * MINUTE_TICKS;
const MINUTE = 60 * TICK_RATE;
export const BOSS_TICK = 18 * MINUTE;
export const ELITE_TICKS = [5 * MINUTE, 10 * MINUTE, 15 * MINUTE];
// Smaller elites in between, like the minute bosses of Mad Forest: a giant
// dust bunny with a chest.
export const MINI_ELITE_TICKS = [1, 3, 7, 9, 12, 14, 16, 17].map((m) => m * MINUTE);
export const MAX_ENEMIES = 300; // more than this crawls on older phones
export const SPAWN_DISTANCE = 520; // just outside a phone screen
export const MAX_GEMS = 250; // further gems merge into one
const DESPAWN_DISTANCE = 1400;
const KNOCKBACK_DECAY = 0.8777435898906345; // 0.02 per second, per tick
const CELL = 40;
const SEPARATE_PAIRS = 6;
// Half the visible area around the cat, for weapons that strike "on screen".
const SCREEN_X = 360;
const SCREEN_Y = 460;

// Difficulty knobs, tuned with `npm run balance:cats`.
// Enemies hurt the cat only when they overlap it this deep, like the small
// hitboxes of VS: a mouse that just brushes the cat while it turns misses.
const CONTACT = 0.8;

export const BALANCE = {
  hpPerMin: 0.15, // enemy health grows by this share every minute
  hpPerMin2: 0.11, // and by this share every minute squared, to keep up with upgrades
  crowdScale: 1.3, // multiplies the fewest enemies of every minute (CROWD)
  burstEvery: 1.2, // seconds between extra spawns
  speedPerMin: 0.025, // enemies get this much faster every minute, up to 15
  meowPush: 90, // knockback of the meow aura
  xpPerMin: 0.15, // gems grow by this share every minute, as levels get dearer
};

// The fewest enemies around the cat in each minute, after Mad Forest.
const CROWD = [15, 30, 50, 45, 40, 40, 60, 80, 100, 90, 100, 160, 150, 160, 180, 200, 220, 240, 220, 260];

// The room's enemy mix by minute: weights of each kind.
const WAVES: { from: number; mix: Partial<Record<EnemyKind, number>> }[] = [
  { from: 0, mix: { mouse: 1 } },
  { from: 3, mix: { mouse: 0.7, dust: 0.3 } },
  { from: 6, mix: { mouse: 0.5, dust: 0.42, robot: 0.08 } },
  { from: 10, mix: { mouse: 0.4, dust: 0.45, robot: 0.15 } },
  { from: 15, mix: { mouse: 0.35, dust: 0.4, robot: 0.25 } },
];

// Joystick direction: 0 is "stand still", 1..16 point around the circle
// starting from the right and going clockwise on screen (y grows down).
export const DIRECTIONS = 16;
export const DIR_VECTORS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  ...Array.from({ length: DIRECTIONS }, (_, i) => {
    const a = (i * Math.PI * 2) / DIRECTIONS;
    return [dcos(a), dsin(a)] as const;
  }),
];

export interface Player {
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  face: 1 | -1;
  // Last direction moved, for weapons thrown "forward".
  dx: number;
  dy: number;
  inv: number; // ticks of invulnerability left
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  xp: number;
  kx: number;
  ky: number;
  // Charging enemies keep this heading.
  vx: number;
  vy: number;
  elite: boolean;
  dead: boolean;
  hitTick: number;
  yarnTick: number; // ticks until the yarn can hit it again
}

export type ShotKind = 'laser' | 'fish' | 'pot';

export interface Shot {
  id: number;
  kind: ShotKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  life: number; // ticks
  dmg: number;
  r: number;
  pierce: number;
  hits: number[]; // enemies already hit, so piercing shots hit each once
}

// A puddle from the glass: hurts whatever stands in it.
export interface Zone {
  id: number;
  x: number;
  y: number;
  r: number;
  life: number; // ticks
  dmg: number;
}

export interface Gem {
  id: number;
  x: number;
  y: number;
  v: number;
  pull: boolean;
  got: boolean;
}

// Things on the floor, as in Vampire Survivors: food heals, catnip pulls
// every gem, the alarm clock clears the screen, the unplugged plug stops
// every vacuum for a while, and fish is fish.
// Chests come only from elites and the boss.
export type PickupKind = 'food' | 'catnip' | 'alarm' | 'plug' | 'coin' | 'chest';
export const PICKUP_WEIGHTS: Record<PickupKind, number> = { food: 5, coin: 3, catnip: 1, plug: 1, alarm: 1, chest: 0 };
const PICKUP_CHANCE = 0.007; // per kill
const FREEZE_TICKS = 6 * TICK_RATE;

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  got: boolean;
}

// What happened during a tick, for effects and sounds. The server skips them.
export type SimEvent =
  | { t: 'hit'; x: number; y: number; dmg: number }
  | { t: 'kill'; x: number; y: number; kind: EnemyKind; elite: boolean }
  | { t: 'hurt'; dmg: number; kind: EnemyKind }
  | { t: 'level' }
  | { t: 'boss' }
  | { t: 'cleaner' }
  | { t: 'elite' }
  | { t: 'slash'; x: number; y: number; w: number; h: number; face: 1 | -1 }
  | { t: 'wave'; x: number; y: number; r: number }
  | { t: 'spark'; x: number; y: number; r: number }
  | { t: 'pickup'; kind: PickupKind }
  // A chest opened: evolved weapons, or items that gained a level.
  | { t: 'chest'; evolved: WeaponId[]; items: ItemId[] }
  | { t: 'end'; won: boolean };

export interface RunResult {
  won: boolean;
  ticks: number;
  kills: number;
  level: number;
  fish: number;
  items: Partial<Record<ItemId, number>>;
  evolved: Partial<Record<WeaponId, boolean>>;
}

// League and season points of a finished run: one per full 30 seconds
// survived, two more for a win.
export const runPoints = (ticks: number, won: boolean): number => Math.floor(ticks / (30 * TICK_RATE)) + (won ? 2 : 0);

export type Score = Pick<RunResult, 'won' | 'ticks' | 'kills'>;

// Negative when a ranks above b: a win first, then the longer run, then more kills.
export const compareScores = (a: Score, b: Score): number => Number(b.won) - Number(a.won) || b.ticks - a.ticks || b.kills - a.kills;

export interface RunOptions {
  events?: boolean;
  hero?: HeroId;
}

// Removes the items that fail `keep`, in place and in order.
function compact<T>(xs: T[], keep: (x: T) => boolean): void {
  let n = 0;
  for (let i = 0; i < xs.length; i++) if (keep(xs[i])) xs[n++] = xs[i];
  xs.length = n;
}

export class CatRun {
  readonly seed: number;
  readonly rng: Rng;
  readonly hero: HeroId;
  tick = 0;
  over = false;
  won = false;
  kills = 0;
  level = 1;
  xp = 0;
  need = xpToNext(1);
  fish = 0;
  rerolls = 1;
  evolved: Partial<Record<WeaponId, boolean>> = {};
  readonly map: RoomMap;
  // Tick when every slot was full and maxed, or -1.
  fullTick = -1;
  // Owned weapons and passives in the order they were taken, with levels.
  items: Partial<Record<ItemId, number>> = {};
  stats: Stats = { ...BASE_STATS };
  player: Player = { x: 0, y: 0, r: 14, hp: 100, maxHp: 100, face: 1, dx: 1, dy: 0, inv: 0 };
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  zones: Zone[] = [];
  gems: Gem[] = [];
  pickups: Pickup[] = [];
  freeze = 0; // ticks the vacuums stay unplugged
  // Yarn: the angle of the first ball, and ticks left while it spins.
  yarnAngle = 0;
  yarnLeft = 0;
  // Cards offered on level-up; the run waits until one is chosen.
  pending: CardId[] | null = null;
  events: SimEvent[] = [];
  private readonly trackEvents: boolean;
  private nextId = 1;
  private burstAcc = 0;
  private cd: Partial<Record<WeaponId, number>> = {};
  private sepKeys = new Float64Array(MAX_ENEMIES + 64);
  private sepHead = new Int32Array(1024);
  private sepNext = new Int32Array(MAX_ENEMIES + 64);

  constructor(seed: number, opts: RunOptions = {}) {
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed);
    this.trackEvents = opts.events ?? true;
    this.hero = opts.hero ?? 'ryzhik';
    this.map = new RoomMap(this.seed);
    this.items[HEROES[this.hero].weapon] = 1;
    this.recompute();
    this.player.hp = this.player.maxHp;
  }

  get time(): number {
    return this.tick / TICK_RATE;
  }

  lvl(k: ItemId): number {
    return this.items[k] ?? 0;
  }

  weapons(): WeaponId[] {
    return (Object.keys(this.items) as ItemId[]).filter(isWeapon);
  }

  passives(): PassiveId[] {
    return (Object.keys(this.items) as ItemId[]).filter(isPassive);
  }

  result(): RunResult {
    return { won: this.won, ticks: this.tick, kills: this.kills, level: this.level, fish: this.fish, items: { ...this.items }, evolved: { ...this.evolved } };
  }

  // A weapon's numbers at its level, scaled by the cat's stats.
  weaponStats(id: WeaponId): WeaponStats {
    const def = WEAPONS[id];
    const w = { ...def.base };
    for (let i = 0; i < this.lvl(id) - 1; i++) {
      const d = def.levels[i];
      w.dmg += d.dmg ?? 0;
      w.cd += d.cd ?? 0;
      w.amount += d.amount ?? 0;
      w.area += d.area ?? 0;
      w.speed += d.speed ?? 0;
      w.duration += d.duration ?? 0;
      w.pierce += d.pierce ?? 0;
    }
    const s = this.stats;
    w.dmg *= s.might;
    w.cd *= s.cooldown;
    w.amount += s.amount;
    w.area *= s.area;
    w.speed *= s.speed;
    w.duration *= s.duration;
    if (this.evolved[id]) {
      if (id === 'claws') {
        w.amount = Math.max(2, w.amount);
        w.area *= 1.3;
        w.dmg += 10;
      } else if (id === 'laser') w.cd = 0.2;
      else if (id === 'fish') w.cd = 0.15;
      else if (id === 'meow') w.area *= 1.4;
      else if (id === 'pot') w.amount += 6;
    }
    return w;
  }

  // Ticks until the weapon attacks again (0 or less: this tick).
  readyIn(id: WeaponId): number {
    return this.cd[id] ?? 0;
  }

  // Advances one tick. Does nothing while a card choice is pending.
  step(dir: number): void {
    if (this.over || this.pending) return;
    this.events.length = 0;
    this.tick++;
    const p = this.player;
    const [mx, my] = DIR_VECTORS[dir] ?? DIR_VECTORS[0];
    p.x += mx * this.stats.move * DT;
    p.y += my * this.stats.move * DT;
    [p.x, p.y] = this.map.pushOut(p.x, p.y, p.r);
    if (mx || my) {
      p.dx = mx;
      p.dy = my;
    }
    if (mx > 0.01) p.face = 1;
    else if (mx < -0.01) p.face = -1;
    if (p.inv > 0) p.inv--;
    if (this.stats.recovery) p.hp = Math.min(p.maxHp, p.hp + this.stats.recovery * DT);

    this.spawner();
    this.attack();
    this.moveEnemies();
    if (this.over) return;
    this.separate();
    this.moveShots();
    this.tickZones();
    this.collectGems();
    this.collectPickups();

    compact(this.enemies, (e) => !e.dead);
    compact(this.shots, (s) => s.life > 0);
    compact(this.zones, (z) => z.life > 0);
    compact(this.gems, (g) => !g.got);
    compact(this.pickups, (g) => !g.got);
    if (!this.over && this.tick >= END_TICKS) this.finish(true);
  }

  choose(index: number): void {
    if (!this.pending) return;
    const k = this.pending[index] ?? this.pending[0];
    this.pending = null;
    this.take(k);
    this.checkLevel();
  }

  // Swaps the offered cards for new ones, if a reroll is left.
  reroll(): void {
    if (!this.pending || this.rerolls <= 0) return;
    this.rerolls--;
    this.pending = this.offer();
  }

  private emit(e: SimEvent): void {
    if (this.trackEvents) this.events.push(e);
  }

  private finish(won: boolean): void {
    if (this.over) return;
    this.over = true;
    // Caught by the Cleaner after 20:00 is still a win.
    this.won = won || this.tick >= RUN_TICKS;
    this.pending = null;
    this.emit({ t: 'end', won: this.won });
  }

  // ---------- spawning ----------
  private spawn(kind: EnemyKind, elite = false): Enemy {
    const def = ENEMIES[kind];
    const a = this.rng.next() * Math.PI * 2;
    const m = this.time / 60;
    const scale = kind === 'mop' ? 1 : 1 + m * BALANCE.hpPerMin + m * m * BALANCE.hpPerMin2;
    const hp = def.hp * scale;
    const x = this.player.x + dcos(a) * SPAWN_DISTANCE;
    const y = this.player.y + dsin(a) * SPAWN_DISTANCE;
    const en: Enemy = {
      id: this.nextId++,
      kind,
      x,
      y,
      r: def.r,
      hp,
      maxHp: hp,
      // The first minutes are slow enough to turn, hit and run; later ones are not.
      speed: kind === 'cleaner' || kind === 'mop' ? def.speed : def.speed * (1 + Math.min(m, 15) * BALANCE.speedPerMin),
      dmg: def.dmg,
      xp: elite ? 60 * (1 + m) : def.xp * (1 + m * BALANCE.xpPerMin),
      kx: 0,
      ky: 0,
      vx: 0,
      vy: 0,
      elite,
      dead: false,
      hitTick: -100,
      yarnTick: 0,
    };
    [en.x, en.y] = this.map.pushOut(en.x, en.y, en.r);
    if (def.move === 'charge') this.aim(en);
    this.enemies.push(en);
    return en;
  }

  // A charging enemy picks the line through the cat and keeps it.
  private aim(en: Enemy): void {
    const dx = this.player.x - en.x;
    const dy = this.player.y - en.y;
    const d = len(dx, dy) || 1;
    en.vx = dx / d;
    en.vy = dy / d;
  }

  private pickKind(): EnemyKind {
    const minute = this.time / 60;
    let mix = WAVES[0].mix;
    for (const w of WAVES) if (minute >= w.from) mix = w.mix;
    let r = this.rng.next();
    const kinds = Object.keys(mix) as EnemyKind[];
    for (const k of kinds) {
      r -= mix[k]!;
      if (r < 0) return k;
    }
    return kinds[kinds.length - 1];
  }

  private spawner(): void {
    if (this.tick >= RUN_TICKS) {
      if (this.tick === RUN_TICKS) {
        // The room is cleared: every enemy goes, and the Cleaner comes.
        for (const en of this.enemies) en.dead = true;
        this.emit({ t: 'cleaner' });
      }
      if ((this.tick - RUN_TICKS) % MINUTE_TICKS === 0) this.spawn('cleaner', true);
      return;
    }
    // Keep a crowd around the cat, growing over the run.
    const crowd = Math.round(CROWD[Math.min(CROWD.length - 1, Math.floor(this.time / 60))] * BALANCE.crowdScale);
    let n = 0;
    while (this.enemies.length < Math.min(crowd, MAX_ENEMIES) && n++ < 6) this.spawn(this.pickKind());
    // And small bursts on top of it.
    this.burstAcc += DT;
    if (this.burstAcc >= BALANCE.burstEvery) {
      this.burstAcc -= BALANCE.burstEvery;
      const size = 1 + Math.floor((this.time / 60) * 0.4);
      const cap = Math.min(MAX_ENEMIES, crowd * 1.5);
      for (let i = 0; i < size && this.enemies.length < cap; i++) this.spawn(this.pickKind());
    }
    if (ELITE_TICKS.includes(this.tick)) {
      const e = this.spawn('bigrobot', true);
      e.hp = e.maxHp = ENEMIES.bigrobot.hp * this.level; // like VS bosses: health times the cat's level
      this.emit({ t: 'elite' });
    }
    if (MINI_ELITE_TICKS.includes(this.tick)) {
      const e = this.spawn('dust', true);
      e.r *= 1.8;
      e.hp = e.maxHp = 25 * this.level;
      e.dmg = 8;
    }
    if (this.tick === BOSS_TICK) {
      this.spawn('mop', true);
      this.emit({ t: 'boss' });
    }
    // The mop sweeps in dust around itself.
    if (this.tick > BOSS_TICK && this.tick % (3 * TICK_RATE) === 0) {
      const mop = this.enemies.find((e) => e.kind === 'mop');
      if (mop) {
        for (let i = 0; i < 6 && this.enemies.length < MAX_ENEMIES; i++) {
          const d = this.spawn('dust');
          const a = (i * Math.PI) / 3;
          d.x = mop.x + dcos(a) * 60;
          d.y = mop.y + dsin(a) * 60;
        }
      }
    }
  }

  // ---------- combat ----------
  // `heal` is health the cat gets back for the hit (evolved claws and meow).
  private hit(en: Enemy, dmg: number, kx: number, ky: number, heal = 0): void {
    if (en.dead || en.kind === 'cleaner') return;
    if (heal) this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
    en.hp -= dmg;
    en.hitTick = this.tick;
    // Big enemies are heavy: knockback shrinks with size.
    const mass = ENEMIES.mouse.r / en.r;
    en.kx += kx * mass;
    en.ky += ky * mass;
    this.emit({ t: 'hit', x: en.x, y: en.y - en.r, dmg });
    if (en.hp <= 0) {
      en.dead = true;
      this.kills++;
      this.emit({ t: 'kill', x: en.x, y: en.y, kind: en.kind, elite: en.elite });
      if (en.xp) this.dropGem(en.x, en.y, en.xp);
      if (en.elite) this.dropPickup(en.x, en.y, 'chest');
      else if (this.rng.next() < PICKUP_CHANCE) this.dropPickup(en.x, en.y);
    }
  }

  private dropPickup(x: number, y: number, kind?: PickupKind): void {
    if (!kind) {
      const kinds = Object.keys(PICKUP_WEIGHTS) as PickupKind[];
      let total = 0;
      for (const k of kinds) total += PICKUP_WEIGHTS[k];
      let r = this.rng.next() * total;
      kind = kinds[kinds.length - 1];
      for (const k of kinds) {
        r -= PICKUP_WEIGHTS[k];
        if (r < 0) {
          kind = k;
          break;
        }
      }
    }
    this.pickups.push({ id: this.nextId++, kind, x, y, got: false });
  }

  private dropGem(x: number, y: number, v: number): void {
    if (this.gems.length >= MAX_GEMS) {
      // Too many on the floor: the value goes to the farthest gem instead.
      let far = this.gems[0];
      let fd = -1;
      for (const g of this.gems) {
        const d = (g.x - this.player.x) ** 2 + (g.y - this.player.y) ** 2;
        if (d > fd && !g.pull) {
          fd = d;
          far = g;
        }
      }
      far.v += v;
      return;
    }
    this.gems.push({ id: this.nextId++, x, y, v, pull: false, got: false });
  }

  private nearest(x: number, y: number, maxD: number, skip?: Set<number>): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxD * maxD;
    for (const en of this.enemies) {
      if (en.dead || skip?.has(en.id)) continue;
      const d = (en.x - x) ** 2 + (en.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = en;
      }
    }
    return best;
  }

  private shoot(kind: ShotKind, ux: number, uy: number, speed: number, w: WeaponStats, life: number, r: number, gravity = 0): void {
    const p = this.player;
    this.shots.push({
      id: this.nextId++,
      kind,
      x: p.x,
      y: p.y,
      vx: ux * speed,
      vy: uy * speed,
      gravity,
      life: Math.round(life * TICK_RATE),
      dmg: w.dmg,
      r: r * w.area,
      pierce: w.pierce,
      hits: [],
    });
  }

  // Fires every weapon whose cooldown is over.
  private attack(): void {
    const p = this.player;
    for (const id of this.weapons()) {
      const w = this.weaponStats(id);
      if (id === 'yarn') {
        this.spinYarn(w);
        continue;
      }
      const left = (this.cd[id] ?? 0) - 1;
      this.cd[id] = left;
      if (left > 0) continue;
      this.cd[id] = Math.max(2, Math.round(w.cd * TICK_RATE));
      switch (id) {
        case 'claws': {
          // Like the VS whip: a long horizontal slash that starts a little
          // behind the cat; the second one goes the other way, a bit higher.
          const width = 150 * w.area;
          const back = 30 * w.area;
          const h = 40 * w.area;
          for (let i = 0; i < Math.min(w.amount, 2); i++) {
            const face = (i === 0 ? p.face : -p.face) as 1 | -1;
            const cx = p.x + face * (width / 2 - back);
            const cy = p.y - i * h * 0.5;
            this.emit({ t: 'slash', x: cx, y: cy, w: width, h, face });
            for (const en of this.enemies) {
              if (Math.abs(en.x - cx) < width / 2 + en.r && Math.abs(en.y - cy) < h / 2 + en.r) this.hit(en, w.dmg, face * 50, 0, this.evolved.claws ? 0.5 : 0);
            }
          }
          break;
        }
        case 'laser': {
          const used = new Set<number>();
          for (let i = 0; i < w.amount; i++) {
            const t = this.nearest(p.x, p.y, 500, used) ?? this.nearest(p.x, p.y, 500);
            if (!t) break;
            used.add(t.id);
            const d = len(t.x - p.x, t.y - p.y) || 1;
            this.shoot('laser', (t.x - p.x) / d, (t.y - p.y) / d, 420 * w.speed, w, 1.6, 7);
          }
          break;
        }
        case 'fish': {
          for (let i = 0; i < w.amount; i++) {
            const off = (i - (w.amount - 1) / 2) * 0.12;
            const c = dcos(off);
            const s = dsin(off);
            this.shoot('fish', p.dx * c - p.dy * s, p.dx * s + p.dy * c, 620 * w.speed, w, 0.9, 8);
          }
          break;
        }
        case 'pot': {
          if (this.evolved.pot) {
            // Cactus fall: pots fly out in a spiral and pierce everything.
            const turn = (this.tick % 90) / 90;
            for (let i = 0; i < w.amount; i++) {
              const a = (turn + i / w.amount) * Math.PI * 2;
              this.shoot('pot', dcos(a), dsin(a), 330 * w.speed, { ...w, pierce: 999 }, 1.4, 14);
            }
            break;
          }
          for (let i = 0; i < w.amount; i++) {
            const vx = (this.rng.next() - 0.5) * 2 * 160 + p.face * 40;
            this.shots.push({
              id: this.nextId++,
              kind: 'pot',
              x: p.x,
              y: p.y,
              vx: vx * w.speed,
              vy: -560 * w.speed,
              gravity: 1000 * w.speed * w.speed,
              life: Math.round(1.5 * TICK_RATE),
              dmg: w.dmg,
              r: 14 * w.area,
              pierce: w.pierce,
              hits: [],
            });
          }
          break;
        }
        case 'meow': {
          const R = 62 * w.area;
          this.emit({ t: 'wave', x: p.x, y: p.y, r: R });
          for (const en of this.enemies) {
            const dx = en.x - p.x;
            const dy = en.y - p.y;
            const d = len(dx, dy) || 1;
            if (d < R + en.r) this.hit(en, w.dmg, (dx / d) * BALANCE.meowPush, (dy / d) * BALANCE.meowPush, this.evolved.meow ? 0.3 : 0);
          }
          break;
        }
        case 'glass': {
          for (let i = 0; i < w.amount; i++) {
            const a = this.rng.next() * Math.PI * 2;
            const d = 60 + this.rng.next() * 140;
            this.zones.push({
              id: this.nextId++,
              x: p.x + dcos(a) * d,
              y: p.y + dsin(a) * d,
              r: 42 * w.area,
              life: Math.round(w.duration * TICK_RATE),
              dmg: w.dmg,
            });
          }
          break;
        }
        case 'spark': {
          const near = this.enemies.filter((en) => !en.dead && Math.abs(en.x - p.x) < SCREEN_X && Math.abs(en.y - p.y) < SCREEN_Y);
          const R = 26 * w.area;
          for (const t of this.rng.sample(near, w.amount)) {
            this.emit({ t: 'spark', x: t.x, y: t.y, r: R });
            const times = this.evolved.spark ? 2 : 1;
            for (const en of this.enemies) if ((en.x - t.x) ** 2 + (en.y - t.y) ** 2 < (R + en.r) ** 2) for (let k = 0; k < times; k++) this.hit(en, w.dmg, 0, 0);
          }
          break;
        }
      }
    }
  }

  // Yarn balls spin for a while, then rest.
  private spinYarn(w: WeaponStats): void {
    const p = this.player;
    if (this.yarnLeft <= 0) {
      const rest = (this.cd.yarn ?? 0) - 1;
      this.cd.yarn = rest;
      if (rest > 0) return;
      this.yarnLeft = Math.round(w.duration * TICK_RATE);
      this.cd.yarn = Math.round(w.cd * TICK_RATE);
    }
    if (!this.evolved.yarn) this.yarnLeft--;
    this.yarnAngle += DT * 3.2 * w.speed;
    const R = 72 * w.area;
    const r = 11 * w.area;
    for (let i = 0; i < w.amount; i++) {
      const a = this.yarnAngle + (i * Math.PI * 2) / w.amount;
      const c = dcos(a);
      const s = dsin(a);
      const x = p.x + c * R;
      const y = p.y + s * R;
      for (const en of this.enemies) {
        if (en.dead || en.yarnTick > this.tick) continue;
        if ((en.x - x) ** 2 + (en.y - y) ** 2 < (en.r + r) ** 2) {
          en.yarnTick = this.tick + Math.round(0.5 * TICK_RATE);
          this.hit(en, w.dmg, c * 60, s * 60);
        }
      }
    }
  }

  // Enemies walk to the cat (or charge along their line); touching it hurts.
  private moveEnemies(): void {
    const p = this.player;
    if (this.freeze > 0) {
      this.freeze--;
      return;
    }
    for (const en of this.enemies) {
      const dx = p.x - en.x;
      const dy = p.y - en.y;
      const d = len(dx, dy) || 1;
      if (d > DESPAWN_DISTANCE) {
        // Left far behind: it comes back from the other side of the screen.
        en.x = p.x + (dx / d) * SPAWN_DISTANCE;
        en.y = p.y + (dy / d) * SPAWN_DISTANCE;
        if (ENEMIES[en.kind].move === 'charge') this.aim(en);
        continue;
      }
      let ux = dx / d;
      let uy = dy / d;
      if (ENEMIES[en.kind].move === 'charge') {
        // Passed the cat and drove on: turn around.
        if (d > SPAWN_DISTANCE && en.vx * dx + en.vy * dy < 0) this.aim(en);
        ux = en.vx;
        uy = en.vy;
      }
      en.x += (ux * en.speed + en.kx) * DT;
      en.y += (uy * en.speed + en.ky) * DT;
      [en.x, en.y] = this.map.pushOut(en.x, en.y, en.r);
      en.kx *= KNOCKBACK_DECAY;
      en.ky *= KNOCKBACK_DECAY;
      if (d < (en.r + p.r) * CONTACT && p.inv <= 0 && !en.dead) {
        const dmg = Math.max(1, en.dmg - this.stats.armor);
        p.hp -= dmg;
        p.inv = Math.round(0.4 * TICK_RATE);
        this.emit({ t: 'hurt', dmg, kind: en.kind });
        if (p.hp <= 0) {
          p.hp = 0;
          this.finish(false);
          return;
        }
      }
    }
  }

  // Cheap separation: enemies in the same grid cell push each other apart.
  private separate(): void {
    // Enemies hashed by grid cell into linked lists, in list order.
    const list = this.enemies;
    const n = list.length;
    const keys = this.sepKeys;
    const head = this.sepHead.fill(-1);
    const next = this.sepNext;
    for (let i = n - 1; i >= 0; i--) {
      const k = Math.floor(list[i].x / CELL) * 65536 + Math.floor(list[i].y / CELL);
      const h = (k * 2654435761) >>> 22; // 10 bits
      keys[i] = k;
      next[i] = head[h];
      head[h] = i;
    }
    for (let i = 0; i < n; i++) {
      const a = list[i];
      const k = keys[i];
      // In a dense crowd each enemy pushes only a few neighbours per tick:
      // they still spread out over a few ticks, at a fraction of the cost.
      let left = SEPARATE_PAIRS;
      for (let j = next[i]; j >= 0 && left > 0; j = next[j]) {
        if (keys[j] !== k) continue;
        left--;
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01;
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
      }
    }
  }

  private moveShots(): void {
    for (const s of this.shots) {
      s.vy += s.gravity * DT;
      s.x += s.vx * DT;
      s.y += s.vy * DT;
      s.life--;
      for (const en of this.enemies) {
        if (en.dead || s.life <= 0) continue;
        if ((en.x - s.x) ** 2 + (en.y - s.y) ** 2 >= (en.r + s.r) ** 2 || s.hits.includes(en.id)) continue;
        s.hits.push(en.id);
        const v = len(s.vx, s.vy) || 1;
        this.hit(en, s.dmg, (s.vx / v) * 40, (s.vy / v) * 40);
        if (s.pierce-- <= 0) s.life = 0;
      }
    }
  }

  // Puddles hurt everything inside twice a second.
  private tickZones(): void {
    const flood = this.evolved.glass;
    for (const z of this.zones) {
      z.life--;
      if (flood) {
        // Flood: puddles grow and creep after the cat.
        const dx = this.player.x - z.x;
        const dy = this.player.y - z.y;
        const d = len(dx, dy) || 1;
        z.x += (dx / d) * 45 * DT;
        z.y += (dy / d) * 45 * DT;
        z.r += 6 * DT;
      }
      if (z.life % 15 !== 0) continue;
      for (const en of this.enemies) if ((en.x - z.x) ** 2 + (en.y - z.y) ** 2 < (z.r + en.r) ** 2) this.hit(en, z.dmg, 0, 0);
    }
  }

  // Gems fly to the cat inside the magnet radius.
  private collectGems(): void {
    const p = this.player;
    for (const g of this.gems) {
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const d = len(dx, dy) || 1;
      if (d < this.stats.magnet || g.pull) {
        g.pull = true;
        const step = Math.min(d, Math.max(400, d * 2) * DT);
        g.x += (dx / d) * step;
        g.y += (dy / d) * step;
      }
      if (d < p.r + 6 && !g.got) {
        g.got = true;
        this.xp += g.v * this.stats.growth;
      }
    }
    this.checkLevel();
  }

  private collectPickups(): void {
    const p = this.player;
    const reach = (p.r + 12) ** 2;
    for (const it of this.pickups) {
      if ((it.x - p.x) ** 2 + (it.y - p.y) ** 2 > reach) continue;
      it.got = true;
      this.emit({ t: 'pickup', kind: it.kind });
      switch (it.kind) {
        case 'food':
          p.hp = Math.min(p.maxHp, p.hp + 30);
          break;
        case 'coin':
          this.fish += 5;
          break;
        case 'catnip':
          for (const g of this.gems) g.pull = true;
          break;
        case 'plug':
          this.freeze = FREEZE_TICKS;
          break;
        case 'chest':
          this.openChest();
          break;
        case 'alarm':
          for (const en of this.enemies) {
            if (!en.elite && Math.abs(en.x - p.x) < SCREEN_X && Math.abs(en.y - p.y) < SCREEN_Y) this.hit(en, en.hp, 0, 0);
          }
          break;
      }
    }
  }

  // Weapons ready to evolve: level 8 and their passive owned.
  evolvable(): WeaponId[] {
    return this.weapons().filter((w) => !this.evolved[w] && this.lvl(w) >= itemMax(w) && this.lvl(EVOLUTIONS[w].passive) > 0);
  }

  // A chest evolves a ready weapon; otherwise it levels up 1 item, or with
  // luck 3 or 5.
  private openChest(): void {
    const evolved: WeaponId[] = [];
    const ready = this.evolvable();
    if (ready.length) {
      this.evolved[ready[0]] = true;
      evolved.push(ready[0]);
    }
    const items: ItemId[] = [];
    if (!evolved.length) {
      const r = this.rng.next();
      const count = r < 0.03 * this.stats.luck ? 5 : r < 0.12 * this.stats.luck ? 3 : 1;
      for (let i = 0; i < count; i++) {
        // Items on the cards waiting to be picked are left alone.
        const open = (Object.keys(this.items) as ItemId[]).filter((k) => this.lvl(k) < itemMax(k) && !this.pending?.includes(k));
        if (!open.length) {
          this.fish += 10;
          break;
        }
        const k = this.rng.pick(open);
        this.items[k] = this.lvl(k) + 1;
        items.push(k);
      }
      this.recompute();
    }
    this.emit({ t: 'chest', evolved, items });
  }

  // ---------- levels ----------
  private checkLevel(): void {
    if (this.pending || this.over || this.xp < this.need) return;
    this.xp -= this.need;
    this.level++;
    this.need = xpToNext(this.level);
    this.recompute(); // the cat's bonus grows with level
    this.pending = this.offer();
    this.emit({ t: 'level' });
  }

  // 3 cards, sometimes 4 with luck: new items while slots are free, or a
  // level more for what the cat has.
  offer(): CardId[] {
    const pool: ItemId[] = [];
    for (const id of [...WEAPON_IDS, ...PASSIVE_IDS]) {
      const l = this.lvl(id);
      if (l >= itemMax(id)) continue;
      if (l === 0 && (isWeapon(id) ? this.weapons().length : this.passives().length) >= SLOTS) continue;
      pool.push(id);
    }
    if (!pool.length) {
      if (this.fullTick < 0) this.fullTick = this.tick;
      return ['snack', 'fishes'];
    }
    const four = this.rng.next() < 1 - 1 / this.stats.luck;
    return this.rng.sample(pool, four ? 4 : 3);
  }

  private take(k: CardId): void {
    if (k === 'snack') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
      return;
    }
    if (k === 'fishes') {
      this.fish += 10;
      return;
    }
    // A card shown before a chest maxed the item gives fish instead.
    if (this.lvl(k) >= itemMax(k)) {
      this.fish += 10;
      return;
    }
    this.items[k] = this.lvl(k) + 1;
    this.recompute();
  }

  // Stats from the hero and the passives.
  private recompute(): void {
    const s: Stats = { ...BASE_STATS, ...HEROES[this.hero].stats };
    const baseHp = s.maxHp;
    for (const id of this.passives()) {
      const per = PASSIVES[id].per;
      const l = this.lvl(id);
      for (const key of Object.keys(per) as (keyof Stats)[]) {
        const v = per[key]! * l;
        if (key === 'maxHp') s.maxHp += baseHp * v;
        else s[key] += v;
      }
    }
    // The cat's own bonus grows with its level.
    const step = Math.min(3, 1 + Math.floor(this.level / 10));
    if (this.hero === 'ryzhik') s.armor += Math.min(5, Math.floor(this.level / 10));
    else if (this.hero === 'murka') s.growth += 0.1 * step;
    else if (this.hero === 'barsik') s.area += 0.1 * step;
    else if (this.hero === 'snezhok' && this.level >= 20) s.amount += 1;
    const p = this.player;
    if (s.maxHp > p.maxHp) p.hp += s.maxHp - p.maxHp;
    p.maxHp = s.maxHp;
    p.hp = Math.min(p.hp, p.maxHp);
    this.stats = s;
  }
}
