import { Rng } from '../rng.ts';
import {
  BASE_STATS,
  ENEMIES,
  EVOLUTIONS,
  HEROES,
  PASSIVES,
  PASSIVE_IDS,
  ROOMS,
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
  type Powers,
  type RoomId,
  type Stats,
  type WeaponId,
  type WeaponStats,
} from './content.ts';
import { RoomMap } from './map.ts';
import { dcos, dsin, len } from './math.ts';

// Fixed step: the same input on the same seed gives the same run everywhere.
// Raise it with every change that makes the same input play differently
// (weapons, enemies, waves): runs saved under an older version can no
// longer be replayed to what really happened, only their stored results
// stay true. 1: before PR #32, 2: VS weapons (#32), 3: VS enemies (#33),
// 4: floor things from breakables, evolutions from 10:00, boss per level.
export const SIM_VERSION = 4;
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
// As in VS, only a chest from an enemy that came at 10:00 or later can
// evolve a weapon; earlier chests only level items up.
export const EVOLVE_TICK = 10 * MINUTE;
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
// Half the visible area around the cat, for weapons that strike "on screen":
// about what a phone held upright shows.
const SCREEN_X = 210;
const SCREEN_Y = 440;

// Difficulty knobs, tuned with `npm run balance:cats`.
// Enemies hurt the cat only when they overlap it this deep, like the small
// hitboxes of VS: a mouse that just brushes the cat while it turns misses.
const CONTACT = 0.8;

// Enemies keep their strength all run, as in VS: what gets harder is which
// kinds come and how many (the wave table in content.ts).
export const BALANCE = {
  crowd: 1, // multiplies the fewest enemies of every minute
};

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
  yarnTick: number; // tick when the yarn can hit it again
  meowTick: number; // and the meow aura
  timer: number; // dogs: ticks of the dash left (> 0) or until the next (< 0)
  leader: number; // a hose segment follows this enemy; 0 for the head
  swarm: boolean; // flies straight across in a swarm
  life: number; // ticks until it goes away by itself (the wall); 0 is never
  born: number; // tick it came
}

// Things enemies leave behind: slippery water from washers slows the cat,
// leaves from the blower hurt it.
export interface Hazard {
  id: number;
  kind: 'puddle' | 'leaf';
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number; // ticks
}

const FLOCK = 5; // pigeons in a flock
const SWARM = 8; // in one group of a swarm
const SWARM_SPEED = 450; // 700 in VS
const WALL = 36; // enemies in the closing ring
const WALL_RADIUS = 430;
const HOSE = 6; // segments in a hose
const PUDDLE_SLOW = 0.55;
const LEAF_DMG = 10;

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
// What a broken thing drops, like the light sources of VS: the weight, and
// the cat level from which it can drop at all. Luck makes the rare ones
// (those with a level) likelier.
export const PICKUP_TABLE: Record<Exclude<PickupKind, 'chest'>, { weight: number; level: number }> = {
  food: { weight: 12, level: 0 },
  coin: { weight: 10, level: 0 },
  plug: { weight: 2, level: 4 },
  alarm: { weight: 1, level: 8 },
  catnip: { weight: 2, level: 12 },
};
const FREEZE_TICKS = 10 * TICK_RATE;
// Breakable things (a vase, a flowerpot, a box) turn up near the cat: once a
// second with this chance times luck, while there are fewer than PROP_MAX.
const PROP_CHANCE = 0.035;
const PROP_MAX = 3;
export const PROP_R = 12;
// Ticks between the projectiles of one attack, from VS.
const VOLLEY_GAP: Record<WeaponId, number> = { claws: 3, laser: 3, fish: 3, yarn: 0, meow: 0, glass: 9, pot: 6, spark: 1 };

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  got: boolean;
  evo?: boolean; // a chest that can evolve a weapon
}

// A breakable thing on the floor; any weapon breaks it.
export interface Prop {
  id: number;
  x: number;
  y: number;
  broken: boolean;
}

// What happened during a tick, for effects and sounds. The server skips them.
export type SimEvent =
  | { t: 'hit'; x: number; y: number; dmg: number }
  | { t: 'kill'; x: number; y: number; kind: EnemyKind; elite: boolean }
  | { t: 'hurt'; dmg: number; kind: EnemyKind }
  | { t: 'wind'; x: number; y: number }
  | { t: 'level' }
  | { t: 'revive' }
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
  room?: RoomId;
  powers?: Powers; // Power Up levels bought with fish
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
  readonly room: RoomId;
  readonly powers: Powers;
  tick = 0;
  over = false;
  won = false;
  kills = 0;
  level = 1;
  xp = 0;
  need = xpToNext(1);
  fish = 0;
  rerolls = 1;
  revives = 0; // Девятая жизнь left
  evolved: Partial<Record<WeaponId, boolean>> = {};
  // Damage dealt by each weapon, and the tick it was picked up, for the
  // stats on the pause and end screens (as in VS).
  damage: Partial<Record<WeaponId, number>> = {};
  since: Partial<Record<WeaponId, number>> = {};
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
  hazards: Hazard[] = [];
  wind = 0; // ticks the blower keeps blowing
  pickups: Pickup[] = [];
  props: Prop[] = [];
  freeze = 0; // ticks the vacuums stay unplugged
  // Yarn: the angle of the first ball, and ticks left while it spins.
  yarnAngle = 0;
  yarnLeft = 0;
  // Cards offered on level-up; the run waits until one is chosen.
  pending: CardId[] | null = null;
  events: SimEvent[] = [];
  private readonly trackEvents: boolean;
  private nextId = 1;
  // Projectiles of attacks still to leave.
  private volleys: { id: WeaponId; i: number; n: number; at: number; a: number }[] = [];
  private swarmLeft = 0;
  private swarmNext = 0;
  private swarmGhost = false;
  private cd: Partial<Record<WeaponId, number>> = {};
  private sepKeys = new Float64Array(MAX_ENEMIES + 64);
  private sepHead = new Int32Array(1024);
  private sepNext = new Int32Array(MAX_ENEMIES + 64);

  constructor(seed: number, opts: RunOptions = {}) {
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed);
    this.trackEvents = opts.events ?? true;
    this.hero = opts.hero ?? 'ryzhik';
    this.room = opts.room ?? 'flat';
    this.powers = { ...opts.powers };
    this.rerolls += this.powers.reroll ?? 0;
    this.revives = this.powers.revive ?? 0;
    this.map = new RoomMap(this.seed, ROOMS[this.room].shape);
    this.items[HEROES[this.hero].weapon] = 1;
    this.since[HEROES[this.hero].weapon] = 0;
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
    // Water slows the cat; belts, wind and the king's pull carry it.
    const slow = this.hazards.length && this.inPuddle() ? PUDDLE_SLOW : 1;
    const [fx, fy] = this.floorPush();
    p.x += (mx * this.stats.move * slow + fx) * DT;
    p.y += (my * this.stats.move * slow + fy) * DT;
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
    this.spawnProps();
    this.attack();
    this.moveEnemies();
    if (this.over) return;
    this.separate();
    this.moveShots();
    this.tickZones();
    this.tickHazards();
    if (this.over) return;
    this.bossActs();
    this.collectGems();
    this.collectPickups();

    compact(this.enemies, (e) => !e.dead);
    compact(this.shots, (s) => s.life > 0);
    compact(this.zones, (z) => z.life > 0);
    compact(this.hazards, (z) => z.life > 0);
    compact(this.gems, (g) => !g.got);
    compact(this.pickups, (g) => !g.got);
    compact(this.props, (pr) => !pr.broken);
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
    let a = this.rng.next() * Math.PI * 2;
    // Between fences or walls, look for a side of the cat with floor.
    for (let i = 0; i < 8 && !this.map.inside(this.player.x + dcos(a) * SPAWN_DISTANCE, this.player.y + dsin(a) * SPAWN_DISTANCE); i++) {
      a = this.rng.next() * Math.PI * 2;
    }
    const hp = def.hp;
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
      speed: def.speed,
      dmg: def.dmg,
      xp: elite ? 60 * (1 + this.time / 60) : def.xp,
      kx: 0,
      ky: 0,
      vx: 0,
      vy: 0,
      elite,
      dead: false,
      hitTick: -100,
      yarnTick: 0,
      meowTick: 0,
      timer: 0,
      leader: 0,
      swarm: false,
      life: 0,
      born: this.tick,
    };
    [en.x, en.y] = this.map.pushOut(en.x, en.y, en.r);
    if (def.move === 'charge' || def.move === 'flock') this.aim(en);
    this.enemies.push(en);
    return en;
  }

  // Puts an enemy inside the walls; in the open flat it may stand anywhere
  // for a tick, its next move pushes it out of furniture.
  private place(x: number, y: number, r: number): [number, number] {
    return this.map.bounds ? this.map.pushOut(x, y, r) : [x, y];
  }

  // One enemy, or the group it comes in: pigeons fly in a flock side by
  // side, a hose comes as a chain of segments. Returns how many came.
  private spawnGroup(kind: EnemyKind): number {
    const head = this.spawn(kind);
    const move = ENEMIES[kind].move;
    if (move === 'flock') {
      // Abreast, across the line of flight.
      for (let i = 1; i < FLOCK && this.enemies.length < MAX_ENEMIES; i++) {
        const e = this.spawn(kind);
        const side = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 26;
        [e.x, e.y] = this.map.pushOut(head.x - head.vy * side - head.vx * (i % 3) * 14, head.y + head.vx * side - head.vy * (i % 3) * 14, e.r);
        e.vx = head.vx;
        e.vy = head.vy;
      }
      return FLOCK;
    }
    if (move === 'follow') {
      let prev = head;
      for (let i = 1; i < HOSE && this.enemies.length < MAX_ENEMIES; i++) {
        const e = this.spawn(kind);
        [e.x, e.y] = this.map.pushOut(prev.x + (prev.x - this.player.x) * 0.05, prev.y + (prev.y - this.player.y) * 0.05, e.r);
        e.leader = prev.id;
        prev = e;
      }
      return HOSE;
    }
    return 1;
  }

  // A charging enemy picks the line through the cat and keeps it.
  private aim(en: Enemy): void {
    const dx = this.player.x - en.x;
    const dy = this.player.y - en.y;
    const d = len(dx, dy) || 1;
    en.vx = dx / d;
    en.vy = dy / d;
  }

  // One of each kind of the wave; returns how many came.
  private batch(kinds: EnemyKind[]): number {
    let n = 0;
    for (const k of kinds) if (this.enemies.length < MAX_ENEMIES) n += this.spawnGroup(k);
    return n;
  }

  // A swarm group: comes from one side of the screen and flies straight
  // through where the cat is, too fast to outrun, then is gone.
  private spawnSwarm(ghost: boolean): void {
    const room = ROOMS[this.room];
    const kind = ghost ? room.ghost : room.swarm;
    const a = this.rng.next() * Math.PI * 2;
    const ux = dcos(a);
    const uy = dsin(a);
    const off = (this.rng.next() - 0.5) * 300;
    const cx = this.player.x - ux * SPAWN_DISTANCE - uy * off;
    const cy = this.player.y - uy * SPAWN_DISTANCE + ux * off;
    const n = ghost ? 5 : SWARM;
    for (let i = 0; i < n && this.enemies.length < MAX_ENEMIES; i++) {
      const e = this.spawn(kind);
      e.x = cx + (this.rng.next() - 0.5) * 90;
      e.y = cy + (this.rng.next() - 0.5) * 90;
      e.vx = ux;
      e.vy = uy;
      e.swarm = true;
      e.speed = SWARM_SPEED;
      if (!ghost) {
        // The swarm bats of VS: 1 health, 1 damage.
        e.hp = e.maxHp = 1;
        e.dmg = 1;
      }
    }
  }

  // The flower wall of Mad Forest: a ring around the cat that closes in.
  private spawnWall(seconds: number): void {
    for (let i = 0; i < WALL && this.enemies.length < MAX_ENEMIES; i++) {
      const e = this.spawn('wall');
      const a = (i / WALL) * Math.PI * 2;
      [e.x, e.y] = this.place(this.player.x + dcos(a) * WALL_RADIUS, this.player.y + dsin(a) * WALL_RADIUS, e.r);
      e.hp = e.maxHp = ENEMIES.wall.hp * this.level;
      e.life = Math.round(seconds * TICK_RATE);
    }
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
    const room = ROOMS[this.room];
    const minute = Math.floor(this.tick / MINUTE_TICKS);
    const wave = room.waves[Math.min(room.waves.length - 1, minute)];
    const at = this.tick % MINUTE_TICKS;
    if (at === 0) {
      // A new minute: its swarms and wall, if it has them.
      this.swarmLeft = 0;
      if (wave.swarm && this.rng.next() < wave.swarm.chance) {
        this.swarmLeft = wave.swarm.count;
        this.swarmNext = this.tick + Math.round(wave.swarm.at * TICK_RATE);
        this.swarmGhost = !!wave.swarm.ghost;
      }
      if (wave.wall) this.spawnWall(wave.wall);
    }
    if (this.swarmLeft > 0 && this.tick >= this.swarmNext) {
      this.swarmLeft--;
      this.swarmNext = this.tick + Math.round(wave.swarm!.gap * TICK_RATE);
      this.spawnSwarm(this.swarmGhost);
    }
    // One of each kind every few seconds, and more at once while there are
    // fewer than the minute's least.
    if (at % Math.max(1, Math.round((wave.every / room.crowd) * TICK_RATE)) === 0) this.batch(wave.kinds);
    const min = Math.min(MAX_ENEMIES, Math.round(wave.min * room.crowd * BALANCE.crowd));
    for (let n = 0; this.enemies.length < min && n < 6; ) {
      const got = this.batch(wave.kinds);
      if (!got) break;
      n += got;
    }
    if (ELITE_TICKS.includes(this.tick)) {
      const e = this.spawn(room.elite, true);
      e.hp = e.maxHp = ENEMIES[room.elite].hp * this.level; // like VS bosses: health times the cat's level
      this.emit({ t: 'elite' });
    }
    if (MINI_ELITE_TICKS.includes(this.tick)) {
      // The Glowing Bat of VS: 50 health per cat level.
      const e = this.spawn(room.miniElite, true);
      e.r *= 1.8;
      e.hp = e.maxHp = 50 * this.level;
      e.dmg = Math.max(8, e.dmg + 1);
    }
    if (this.tick === BOSS_TICK) {
      const b = this.spawn(room.boss, true);
      b.hp = b.maxHp = ENEMIES[room.boss].hp * this.level; // like the elites
      this.emit({ t: 'boss' });
    }
    // The boss calls in its helpers around itself.
    if (this.tick > BOSS_TICK && this.tick % (3 * TICK_RATE) === 0) {
      const boss = this.enemies.find((e) => e.kind === room.boss);
      if (boss) {
        if (ENEMIES[room.minion].move === 'flock') this.spawnGroup(room.minion);
        else {
          for (let i = 0; i < 6 && this.enemies.length < MAX_ENEMIES; i++) {
            const d = this.spawn(room.minion);
            const a = (i * Math.PI) / 3;
            [d.x, d.y] = this.place(boss.x + dcos(a) * 60, boss.y + dsin(a) * 60, d.r);
          }
        }
      }
    }
  }

  // ---------- combat ----------
  // `heal` is health the cat gets back for the hit (evolved claws and meow).
  private hit(en: Enemy, dmg: number, kx: number, ky: number, src: WeaponId | null, heal = 0): void {
    if (en.dead || en.kind === 'cleaner') return;
    if (heal) this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
    if (src) this.damage[src] = (this.damage[src] ?? 0) + Math.min(dmg, Math.max(0, en.hp));
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
      if (en.elite) this.dropPickup(en.x, en.y, 'chest', en.born >= EVOLVE_TICK);
    }
  }

  private dropPickup(x: number, y: number, kind?: PickupKind, evo = false): void {
    if (!kind) {
      const kinds = (Object.keys(PICKUP_TABLE) as (keyof typeof PICKUP_TABLE)[]).filter((k) => this.level >= PICKUP_TABLE[k].level);
      const weight = (k: keyof typeof PICKUP_TABLE) => PICKUP_TABLE[k].weight * (PICKUP_TABLE[k].level ? this.stats.luck : 1);
      let total = 0;
      for (const k of kinds) total += weight(k);
      let r = this.rng.next() * total;
      kind = kinds[kinds.length - 1];
      for (const k of kinds) {
        r -= weight(k);
        if (r < 0) {
          kind = k;
          break;
        }
      }
    }
    this.pickups.push({ id: this.nextId++, kind, x, y, got: false, evo });
  }

  // Now and then a breakable thing turns up near the cat; things left far
  // behind are gone.
  private spawnProps(): void {
    const p = this.player;
    compact(this.props, (pr) => (pr.x - p.x) ** 2 + (pr.y - p.y) ** 2 < DESPAWN_DISTANCE ** 2);
    if (this.tick % TICK_RATE || this.tick >= RUN_TICKS || this.props.length >= PROP_MAX) return;
    if (this.rng.next() >= PROP_CHANCE * this.stats.luck) return;
    for (let i = 0; i < 8; i++) {
      const a = this.rng.next() * Math.PI * 2;
      const d = 150 + this.rng.next() * 250;
      const x = p.x + dcos(a) * d;
      const y = p.y + dsin(a) * d;
      if (!this.map.inside(x, y) || this.map.blocked(x, y, PROP_R)) continue;
      this.props.push({ id: this.nextId++, x, y, broken: false });
      return;
    }
  }

  // Breaks the things a weapon touched: `inside` says whether a point is in the hit.
  private smash(inside: (x: number, y: number) => boolean): void {
    for (const pr of this.props) {
      if (pr.broken || !inside(pr.x, pr.y)) continue;
      pr.broken = true;
      this.dropPickup(pr.x, pr.y);
    }
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

  // Fires every weapon whose cooldown is over. As in VS, the projectiles of
  // one attack leave one after another, a short gap apart.
  private attack(): void {
    for (const id of this.weapons()) {
      const w = this.weaponStats(id);
      if (id === 'yarn') {
        this.spinYarn(w);
        continue;
      }
      if (id === 'meow') {
        this.meowAura(w);
        continue;
      }
      const left = (this.cd[id] ?? 0) - 1;
      this.cd[id] = left;
      if (left > 0) continue;
      this.cd[id] = Math.max(2, Math.round(w.cd * TICK_RATE));
      if (id === 'pot' && this.evolved.pot) {
        // Death spiral: every pot at once, out in a ring.
        const turn = (this.tick % 90) / 90;
        for (let i = 0; i < w.amount; i++) {
          const a = (turn + i / w.amount) * Math.PI * 2;
          this.shoot('pot', dcos(a), dsin(a), 330 * w.speed, { ...w, pierce: 999 }, 1.4, 14);
        }
        continue;
      }
      // Santa water starts its circle where the first flask can't aim.
      const a = this.rng.next() * Math.PI * 2;
      for (let i = 0; i < w.amount; i++) this.volleys.push({ id, i, n: w.amount, at: this.tick + i * VOLLEY_GAP[id], a });
    }
    if (!this.volleys.length) return;
    for (const v of this.volleys) if (v.at <= this.tick) this.fire(v.id, this.weaponStats(v.id), v.i, v.n, v.a);
    compact(this.volleys, (v) => v.at > this.tick);
  }

  // One projectile of an attack: the i-th of n.
  private fire(id: WeaponId, w: WeaponStats, i: number, n: number, a: number): void {
    const p = this.player;
    switch (id) {
      case 'claws': {
        // The VS whip: a long slash that starts a little behind the cat;
        // the next goes the other way, each one a bit higher.
        const width = 150 * w.area;
        const back = 30 * w.area;
        const h = 40 * w.area;
        const face = (i % 2 === 0 ? p.face : -p.face) as 1 | -1;
        const cx = p.x + face * (width / 2 - back);
        const cy = p.y - i * h * 0.5;
        this.emit({ t: 'slash', x: cx, y: cy, w: width, h, face });
        for (const en of this.enemies) {
          if (Math.abs(en.x - cx) < width / 2 + en.r && Math.abs(en.y - cy) < h / 2 + en.r) this.hit(en, w.dmg, face * 50, 0, 'claws', this.evolved.claws ? 0.5 : 0);
        }
        if (this.props.length) this.smash((x, y) => Math.abs(x - cx) < width / 2 + PROP_R && Math.abs(y - cy) < h / 2 + PROP_R);
        break;
      }
      case 'laser': {
        // Every shot at the nearest enemy on screen.
        const t = this.nearestOnScreen();
        if (!t) break;
        const d = len(t.x - p.x, t.y - p.y) || 1;
        this.shoot('laser', (t.x - p.x) / d, (t.y - p.y) / d, 420 * w.speed, w, 1.6, 7);
        break;
      }
      case 'fish': {
        // Thrown where the cat looks, a little scattered.
        const off = (this.rng.next() - 0.5) * 0.2;
        const c = dcos(off);
        const s = dsin(off);
        this.shoot('fish', p.dx * c - p.dy * s, p.dx * s + p.dy * c, 620 * w.speed, w, 0.9, 8);
        break;
      }
      case 'pot': {
        // The first pot goes straight up, the next ones forward in wider arcs.
        const vx = i === 0 ? 0 : p.face * (60 + 70 * i);
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
        break;
      }
      case 'glass': {
        // The first glass at the nearest enemy, the rest round the cat clockwise.
        const t = i === 0 && n < 4 ? this.nearestOnScreen() : null;
        const ang = a + (i * Math.PI * 2) / n;
        const d = 120;
        this.zones.push({
          id: this.nextId++,
          x: t ? t.x : p.x + dcos(ang) * d,
          y: t ? t.y : p.y + dsin(ang) * d,
          r: 42 * w.area,
          life: Math.round(w.duration * TICK_RATE),
          dmg: w.dmg,
        });
        break;
      }
      case 'spark': {
        const near = this.enemies.filter((en) => !en.dead && Math.abs(en.x - p.x) < SCREEN_X && Math.abs(en.y - p.y) < SCREEN_Y);
        if (!near.length) break;
        const t = near[this.rng.int(near.length)];
        const R = 26 * w.area;
        this.emit({ t: 'spark', x: t.x, y: t.y, r: R });
        const times = this.evolved.spark ? 2 : 1;
        for (const en of this.enemies) if ((en.x - t.x) ** 2 + (en.y - t.y) ** 2 < (R + en.r) ** 2) for (let k = 0; k < times; k++) this.hit(en, w.dmg, 0, 0, 'spark');
        if (this.props.length) this.smash((x, y) => (x - t.x) ** 2 + (y - t.y) ** 2 < (R + PROP_R) ** 2);
        break;
      }
    }
  }

  private nearestOnScreen(): Enemy | null {
    const p = this.player;
    const t = this.nearest(p.x, p.y, SCREEN_Y);
    return t && Math.abs(t.x - p.x) < SCREEN_X ? t : null;
  }

  // Garlic: always on. An enemy is hurt as it comes in, then again once the
  // cooldown has passed for it. It pushes nobody.
  private meowAura(w: WeaponStats): void {
    const p = this.player;
    const R = 62 * w.area;
    const every = Math.max(2, Math.round(w.cd * TICK_RATE));
    if (this.tick % every === 0) this.emit({ t: 'wave', x: p.x, y: p.y, r: R });
    if (this.props.length) this.smash((x, y) => (x - p.x) ** 2 + (y - p.y) ** 2 < (R + PROP_R) ** 2);
    for (const en of this.enemies) {
      if (en.dead || en.meowTick > this.tick) continue;
      if ((en.x - p.x) ** 2 + (en.y - p.y) ** 2 < (R + en.r) ** 2) {
        en.meowTick = this.tick + every;
        this.hit(en, w.dmg, 0, 0, 'meow', this.evolved.meow ? 0.3 : 0);
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
      if (this.props.length) this.smash((px, py) => (px - x) ** 2 + (py - y) ** 2 < (r + PROP_R) ** 2);
      for (const en of this.enemies) {
        if (en.dead || en.yarnTick > this.tick) continue;
        if ((en.x - x) ** 2 + (en.y - y) ** 2 < (en.r + r) ** 2) {
          en.yarnTick = this.tick + Math.round(1.7 * TICK_RATE); // the VS hitbox delay
          this.hit(en, w.dmg, c * 60, s * 60, 'yarn');
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
    let byId: Map<number, Enemy> | null = null;
    for (const en of this.enemies) {
      const dx = p.x - en.x;
      const dy = p.y - en.y;
      const d = len(dx, dy) || 1;
      const def = ENEMIES[en.kind];
      const move = en.swarm ? 'flock' : def.move;
      if (en.life > 0 && --en.life === 0) {
        en.dead = true;
        continue;
      }
      if (d > DESPAWN_DISTANCE) {
        // A flock that flew past is gone.
        if (move === 'flock') {
          en.dead = true;
          continue;
        }
        // Left far behind: it comes back from the other side of the screen.
        [en.x, en.y] = this.place(p.x + (dx / d) * SPAWN_DISTANCE, p.y + (dy / d) * SPAWN_DISTANCE, en.r);
        if (move === 'charge') this.aim(en);
        continue;
      }
      let ux = dx / d;
      let uy = dy / d;
      let speed = en.speed;
      if (move === 'charge') {
        // Passed the cat and drove on: turn around.
        if (d > SPAWN_DISTANCE && en.vx * dx + en.vy * dy < 0) this.aim(en);
        ux = en.vx;
        uy = en.vy;
      } else if (move === 'flock') {
        ux = en.vx;
        uy = en.vy;
      } else if (move === 'dash') {
        // Walks up, then lunges along a line; rests a little after.
        if (en.timer > 0) {
          en.timer--;
          ux = en.vx;
          uy = en.vy;
          speed *= 2.2;
          if (en.timer === 0) en.timer = -Math.round(2.5 * TICK_RATE);
        } else if (en.timer < 0) en.timer++;
        else if (d < (en.elite ? 280 : 150)) {
          this.aim(en);
          en.timer = Math.round((en.elite ? 0.7 : 0.4) * TICK_RATE);
        }
      } else if (move === 'follow' && en.leader) {
        // A hose segment keeps close behind the one ahead.
        byId ??= new Map(this.enemies.map((e) => [e.id, e]));
        const l = byId.get(en.leader);
        if (!l || l.dead) en.leader = 0;
        else {
          const lx = l.x - en.x;
          const ly = l.y - en.y;
          const ld = len(lx, ly) || 1;
          ux = lx / ld;
          uy = ly / ld;
          speed = ld < en.r * 1.6 ? 0 : Math.min(speed * 1.6, (ld - en.r * 1.6) * TICK_RATE);
        }
      }
      const ox = en.x;
      const oy = en.y;
      en.x += (ux * speed + en.kx) * DT;
      en.y += (uy * speed + en.ky) * DT;
      // Washers leave slippery water behind.
      if (en.kind === 'washer' && (this.tick + en.id) % (TICK_RATE * 1.2) === 0) {
        this.hazards.push({ id: this.nextId++, kind: 'puddle', x: en.x, y: en.y, vx: 0, vy: 0, r: 30 + en.r, life: 6 * TICK_RATE });
      }
      // Pigeons, moths and swarms fly over furniture and fences.
      const fly = move === 'flock' || def.fly;
      if (!fly) [en.x, en.y] = this.map.pushOut(en.x, en.y, en.r);
      else if (move !== 'flock') [en.x, en.y] = this.map.clamp(en.x, en.y, en.r); // but not out of the hall
      // Pressed flat against furniture: walk along it to get round instead of
      // standing there.
      const step = speed * DT;
      if (step > 0 && !fly && (en.x - ox) ** 2 + (en.y - oy) ** 2 < (step * 0.3) ** 2) {
        const way = this.map.detour(en.x, en.y, en.r, p.x, p.y);
        if (way) [en.x, en.y] = this.map.pushOut(en.x + way[0] * step, en.y + way[1] * step, en.r);
      }
      en.kx *= KNOCKBACK_DECAY;
      en.ky *= KNOCKBACK_DECAY;
      if (d < (en.r + p.r) * CONTACT && p.inv <= 0 && !en.dead) {
        if (this.hurt(en.dmg, en.kind)) return;
      }
    }
  }

  // A hit on the cat; true when it ended the run. Девятая жизнь brings the
  // cat back once with half its health and pushes the vacuums away.
  private hurt(raw: number, kind: EnemyKind): boolean {
    const p = this.player;
    const dmg = Math.max(1, raw - this.stats.armor);
    p.hp -= dmg;
    p.inv = Math.round(0.24 * TICK_RATE); // as in VS
    this.emit({ t: 'hurt', dmg, kind });
    if (p.hp > 0) return false;
    if (this.revives > 0) {
      this.revives--;
      p.hp = p.maxHp / 2;
      p.inv = 2 * TICK_RATE;
      for (const en of this.enemies) {
        const d = len(en.x - p.x, en.y - p.y) || 1;
        if (d < 300) {
          en.kx += ((en.x - p.x) / d) * 600;
          en.ky += ((en.y - p.y) / d) * 600;
        }
      }
      this.emit({ t: 'revive' });
      return false;
    }
    p.hp = 0;
    this.finish(false);
    return true;
  }

  // The boss of the room: the blower blows the cat away and throws leaves,
  // the king pulls it in. Industrial vacuums suck gems off the floor.
  private bossActs(): void {
    if (this.wind > 0) this.wind--;
    if (this.room === 'yard' && this.tick > BOSS_TICK && this.tick % (4 * TICK_RATE) === 0) {
      const b = this.enemies.find((e) => e.kind === 'blower' && !e.dead);
      if (b) {
        this.wind = Math.round(1.5 * TICK_RATE);
        this.emit({ t: 'wind', x: b.x, y: b.y });
        const base = Math.atan2(this.player.y - b.y, this.player.x - b.x);
        for (let i = -2; i <= 2; i++) {
          const a = base + i * 0.22;
          this.hazards.push({ id: this.nextId++, kind: 'leaf', x: b.x, y: b.y, vx: dcos(a) * 230, vy: dsin(a) * 230, r: 9, life: 3 * TICK_RATE });
        }
      }
    }
    if (this.room !== 'warehouse') return;
    for (const en of this.enemies) {
      if (en.kind !== 'industrial' || en.dead) continue;
      for (const g of this.gems) {
        if (g.pull || g.got) continue;
        const dx = en.x - g.x;
        const dy = en.y - g.y;
        const d = len(dx, dy) || 1;
        if (d > 260) continue;
        if (d < en.r) {
          // Eaten: it comes back when the vacuum is beaten.
          g.got = true;
          en.xp += g.v;
          continue;
        }
        const step = Math.min(d, 120 * DT);
        g.x += (dx / d) * step;
        g.y += (dy / d) * step;
      }
    }
  }

  // What moves the cat besides its paws: belts, the blower's wind, the king's pull.
  private floorPush(): [number, number] {
    const p = this.player;
    let fx = this.map.belts.length ? this.map.belt(p.x, p.y) : 0;
    let fy = 0;
    if (this.tick > BOSS_TICK && (this.wind > 0 || this.room === 'warehouse')) {
      const kind = this.room === 'warehouse' ? 'king' : 'blower';
      const b = this.enemies.find((e) => e.kind === kind && !e.dead);
      if (b) {
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const d = len(dx, dy) || 1;
        // Away from the blower, towards the king.
        const f = kind === 'blower' ? 110 : d < 900 ? -45 : 0;
        fx += (dx / d) * f;
        fy += (dy / d) * f;
      }
    }
    return [fx, fy];
  }

  private inPuddle(): boolean {
    const p = this.player;
    for (const z of this.hazards) if (z.kind === 'puddle' && (z.x - p.x) ** 2 + (z.y - p.y) ** 2 < z.r * z.r) return true;
    return false;
  }

  // Leaves fly and hurt; puddles dry up.
  private tickHazards(): void {
    if (!this.hazards.length) return;
    const p = this.player;
    for (const z of this.hazards) {
      z.life--;
      if (z.kind !== 'leaf') continue;
      z.x += z.vx * DT;
      z.y += z.vy * DT;
      if (p.inv <= 0 && (z.x - p.x) ** 2 + (z.y - p.y) ** 2 < (z.r + p.r * CONTACT) ** 2) {
        z.life = 0;
        if (this.hurt(LEAF_DMG, 'blower')) return;
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
      if (this.props.length) this.smash((x, y) => (x - s.x) ** 2 + (y - s.y) ** 2 < (s.r + PROP_R) ** 2);
      for (const en of this.enemies) {
        if (en.dead || s.life <= 0) continue;
        if ((en.x - s.x) ** 2 + (en.y - s.y) ** 2 >= (en.r + s.r) ** 2 || s.hits.includes(en.id)) continue;
        s.hits.push(en.id);
        const v = len(s.vx, s.vy) || 1;
        this.hit(en, s.dmg, (s.vx / v) * 40, (s.vy / v) * 40, s.kind);
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
      if (this.props.length) this.smash((x, y) => (x - z.x) ** 2 + (y - z.y) ** 2 < (z.r + PROP_R) ** 2);
      for (const en of this.enemies) if ((en.x - z.x) ** 2 + (en.y - z.y) ** 2 < (z.r + en.r) ** 2) this.hit(en, z.dmg, 0, 0, 'glass');
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
        // At levels 20 and 40 the next level costs much more, and gems count double, as in VS.
        this.xp += g.v * this.stats.growth * (this.level === 20 || this.level === 40 ? 2 : 1);
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
          this.openChest(!!it.evo);
          break;
        case 'alarm':
          for (const en of this.enemies) {
            if (!en.elite && Math.abs(en.x - p.x) < SCREEN_X && Math.abs(en.y - p.y) < SCREEN_Y) this.hit(en, en.hp, 0, 0, null);
          }
          break;
      }
    }
  }

  // Weapons ready to evolve: level 8 and their passive owned.
  evolvable(): WeaponId[] {
    return this.weapons().filter((w) => !this.evolved[w] && this.lvl(w) >= itemMax(w) && this.lvl(EVOLUTIONS[w].passive) > 0);
  }

  // A chest evolves a ready weapon (if it may: `evo`); otherwise it levels
  // up 1 item, or with luck 3 or 5.
  private openChest(evo: boolean): void {
    const evolved: WeaponId[] = [];
    const ready = evo ? this.evolvable() : [];
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
    const count = this.rng.next() < 1 - 1 / this.stats.luck ? 4 : 3;
    const cards: ItemId[] = [];
    // As in VS: while slots are free, the cat is first offered what it has,
    // twice with a chance that is higher on even levels.
    if (this.weapons().length < SLOTS || this.passives().length < SLOTS) {
      const chance = 1 + 0.3 * (this.level % 2 === 0 ? 2 : 1) - 1 / this.stats.luck;
      for (let k = 0; k < 2; k++) {
        const owned = pool.filter((id) => this.lvl(id) > 0 && !cards.includes(id));
        if (owned.length && this.rng.next() < chance) cards.push(this.rng.pick(owned));
      }
    }
    const rest = pool.filter((id) => !cards.includes(id));
    return [...cards, ...this.rng.sample(rest, count - cards.length)];
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
    if (isWeapon(k) && !this.lvl(k)) this.since[k] = this.tick;
    this.items[k] = this.lvl(k) + 1;
    this.recompute();
  }

  // Stats from the hero and the passives.
  private recompute(): void {
    const s: Stats = { ...BASE_STATS, ...HEROES[this.hero].stats };
    const baseHp = s.maxHp;
    // Power Ups bought with fish.
    const pw = this.powers;
    s.might += 0.05 * (pw.might ?? 0);
    s.armor += pw.armor ?? 0;
    s.maxHp += baseHp * 0.1 * (pw.maxHp ?? 0);
    s.recovery += 0.1 * (pw.recovery ?? 0);
    s.move *= 1 + 0.05 * (pw.move ?? 0);
    s.area += 0.05 * (pw.area ?? 0);
    s.cooldown -= 0.025 * (pw.cooldown ?? 0);
    s.magnet *= 1 + 0.25 * (pw.magnet ?? 0);
    s.luck += 0.1 * (pw.luck ?? 0);
    s.growth += 0.03 * (pw.growth ?? 0);
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
