import { Rng } from '../rng.ts';
import { ENEMIES, UPGRADES, UPGRADE_IDS, type EnemyKind, type UpgradeId } from './content.ts';
import { dcos, dsin, len } from './math.ts';

// Fixed step: the same input on the same seed gives the same run everywhere.
export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;
export const RUN_SECONDS = 300;
export const RUN_TICKS = RUN_SECONDS * TICK_RATE;
export const BOSS_TICK = 270 * TICK_RATE;
export const ELITE_EVERY = 60 * TICK_RATE;
export const MAX_ENEMIES = 260; // more than this crawls on older phones
export const SPAWN_DISTANCE = 500; // just outside a phone screen
const DESPAWN_DISTANCE = 1500;
const KNOCKBACK_DECAY = 0.8777435898906345; // 0.02 per second, per tick
const CELL = 40;

// Difficulty knobs, tuned with `npm run balance:cats`.
export const BALANCE = {
  spawnBase: 2, // enemies per second at the start
  spawnGrowth: 0.08, // extra enemies per second for every second played
  hpGrowth: 0.012, // enemy health grows by this share every second
  hpGrowth2: 0.0002, // and by this share every second squared, to keep up with upgrades
  meowPush: 200, // knockback of the meow wave
  catSpeed: 150,
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
  speed: number;
  face: 1 | -1;
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
  elite: boolean;
  dead: boolean;
  hitTick: number;
  yarnTick: number;
}

export interface Shot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // ticks
  dmg: number;
  r: number;
  pierce: number;
}

export interface Gem {
  id: number;
  x: number;
  y: number;
  v: number;
  pull: boolean;
  got: boolean;
}

// What happened during a tick, for effects and sounds. The server skips them.
export type SimEvent =
  | { t: 'hit'; x: number; y: number; dmg: number }
  | { t: 'kill'; x: number; y: number; kind: EnemyKind; elite: boolean }
  | { t: 'hurt'; dmg: number }
  | { t: 'level' }
  | { t: 'boss' }
  | { t: 'wave'; x: number; y: number; r: number }
  | { t: 'beam'; x: number; y: number; dx: number; dy: number; len: number; w: number }
  | { t: 'end'; won: boolean };

export interface RunResult {
  won: boolean;
  ticks: number;
  kills: number;
  level: number;
  upgrades: Partial<Record<UpgradeId, number>>;
}

// League and season points of a finished run: one per full 30 seconds
// survived, two more for a win.
export const runPoints = (ticks: number, won: boolean): number => Math.floor(ticks / (30 * TICK_RATE)) + (won ? 2 : 0);

export type Score = Pick<RunResult, 'won' | 'ticks' | 'kills'>;

// Negative when a ranks above b: a win first, then the longer run, then more kills.
export const compareScores = (a: Score, b: Score): number => Number(b.won) - Number(a.won) || b.ticks - a.ticks || b.kills - a.kills;

export class CatRun {
  readonly seed: number;
  readonly rng: Rng;
  tick = 0;
  over = false;
  won = false;
  kills = 0;
  level = 1;
  xp = 0;
  need = 4;
  magnet = 70;
  power = 1;
  up: Partial<Record<UpgradeId, number>> = { fish: 1 };
  player: Player = { x: 0, y: 0, r: 14, hp: 100, maxHp: 100, speed: BALANCE.catSpeed, face: 1, inv: 0 };
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  gems: Gem[] = [];
  yarnAngle = 0;
  // Upgrades offered on level-up; the run waits until one is chosen.
  pending: UpgradeId[] | null = null;
  events: SimEvent[] = [];
  private readonly trackEvents: boolean;
  private nextId = 1;
  private spawnAcc = 0;
  private bossSpawned = false;
  private cd = { fish: 0, meow: TICK_RATE, laser: 1.5 * TICK_RATE };

  constructor(seed: number, opts: { events?: boolean } = {}) {
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed);
    this.trackEvents = opts.events ?? true;
  }

  get time(): number {
    return this.tick / TICK_RATE;
  }

  lvl(k: UpgradeId): number {
    return this.up[k] ?? 0;
  }

  result(): RunResult {
    return { won: this.won, ticks: this.tick, kills: this.kills, level: this.level, upgrades: { ...this.up } };
  }

  // Advances one tick. Does nothing while an upgrade choice is pending.
  step(dir: number): void {
    if (this.over || this.pending) return;
    this.events.length = 0;
    this.tick++;
    const p = this.player;
    const [mx, my] = DIR_VECTORS[dir] ?? DIR_VECTORS[0];
    p.x += mx * p.speed * DT;
    p.y += my * p.speed * DT;
    if (mx > 0.01) p.face = 1;
    else if (mx < -0.01) p.face = -1;
    if (p.inv > 0) p.inv--;
    const heart = this.lvl('heart');
    if (heart) p.hp = Math.min(p.maxHp, p.hp + DT * 0.4 * heart);

    this.spawner();
    this.weapons();
    this.moveEnemies();
    if (this.over) return;
    this.separate();
    this.moveShots();
    this.collectGems();

    this.enemies = this.enemies.filter((e) => !e.dead && len(e.x - p.x, e.y - p.y) < DESPAWN_DISTANCE);
    this.shots = this.shots.filter((s) => s.life > 0);
    this.gems = this.gems.filter((g) => !g.got);
    if (!this.over && this.tick >= RUN_TICKS) this.finish(true);
  }

  choose(index: number): void {
    if (!this.pending) return;
    const k = this.pending[index] ?? this.pending[0];
    this.pending = null;
    this.apply(k);
    this.checkLevel();
  }

  private emit(e: SimEvent): void {
    if (this.trackEvents) this.events.push(e);
  }

  private finish(won: boolean): void {
    if (this.over) return;
    this.over = true;
    this.won = won;
    this.pending = null;
    this.emit({ t: 'end', won });
  }

  // ---------- spawning ----------
  private spawn(kind: EnemyKind, elite = false): void {
    const def = ENEMIES[kind];
    const a = this.rng.next() * Math.PI * 2;
    const scale = kind === 'boss' ? 1 : 1 + this.time * BALANCE.hpGrowth + this.time * this.time * BALANCE.hpGrowth2; // enemies get tougher over time
    const hp = def.hp * scale * (elite ? 6 : 1);
    this.enemies.push({
      id: this.nextId++,
      kind,
      x: this.player.x + dcos(a) * SPAWN_DISTANCE,
      y: this.player.y + dsin(a) * SPAWN_DISTANCE,
      r: def.r * (elite ? 1.5 : 1),
      hp,
      maxHp: hp,
      speed: def.speed,
      dmg: def.dmg,
      xp: def.xp * (elite ? 8 : 1),
      kx: 0,
      ky: 0,
      elite,
      dead: false,
      hitTick: -100,
      yarnTick: 0,
    });
  }

  private spawner(): void {
    const t = this.time;
    this.spawnAcc += (BALANCE.spawnBase + t * BALANCE.spawnGrowth) * DT; // enemies per second
    while (this.spawnAcc >= 1 && this.enemies.length < MAX_ENEMIES) {
      this.spawnAcc--;
      const r = this.rng.next();
      this.spawn(t > 150 && r < 0.12 ? 'vacuum' : t > 45 && r < 0.35 ? 'dog' : 'mouse');
    }
    if (this.spawnAcc > 1) this.spawnAcc = 1;
    // An elite every minute, the boss at 4:30.
    if (this.tick % ELITE_EVERY === 0) this.spawn(t > 120 ? 'vacuum' : 'dog', true);
    if (this.tick >= BOSS_TICK && !this.bossSpawned) {
      this.bossSpawned = true;
      this.spawn('boss');
      this.emit({ t: 'boss' });
    }
  }

  // ---------- combat ----------
  private hit(en: Enemy, dmg: number, kx: number, ky: number): void {
    dmg *= this.power;
    en.hp -= dmg;
    en.hitTick = this.tick;
    // Big enemies are heavy: knockback shrinks with size.
    const mass = ENEMIES.mouse.r / en.r;
    en.kx += kx * mass;
    en.ky += ky * mass;
    this.emit({ t: 'hit', x: en.x, y: en.y - en.r, dmg });
    if (en.hp <= 0 && !en.dead) {
      en.dead = true;
      this.kills++;
      this.emit({ t: 'kill', x: en.x, y: en.y, kind: en.kind, elite: en.elite });
      if (en.xp) this.gems.push({ id: this.nextId++, x: en.x, y: en.y, v: en.xp, pull: false, got: false });
      if (en.kind === 'boss') this.finish(true);
    }
  }

  private nearest(x: number, y: number, maxD: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxD * maxD;
    for (const en of this.enemies) {
      if (en.dead) continue;
      const d = (en.x - x) ** 2 + (en.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = en;
      }
    }
    return best;
  }

  private weapons(): void {
    const p = this.player;
    // Fish thrower: nearest enemy, more fish per volley with level.
    const fl = this.lvl('fish');
    if (fl && --this.cd.fish <= 0) {
      const target = this.nearest(p.x, p.y, 420);
      if (target) {
        this.cd.fish = Math.round(Math.max(0.25, 0.6 - fl * 0.05) * TICK_RATE);
        const n = Math.ceil(fl / 2);
        const d = len(target.x - p.x, target.y - p.y) || 1;
        const ux = (target.x - p.x) / d;
        const uy = (target.y - p.y) / d;
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * 0.18;
          const c = dcos(off);
          const s = dsin(off);
          const vx = ux * c - uy * s;
          const vy = ux * s + uy * c;
          this.shots.push({
            id: this.nextId++,
            x: p.x,
            y: p.y,
            vx: vx * 420,
            vy: vy * 420,
            life: 1.2 * TICK_RATE,
            dmg: 12 * (1 + fl * 0.2),
            r: 9,
            pierce: fl >= 5 ? 2 : 0,
          });
        }
      }
    }
    // Yarn balls orbit the cat.
    const yl = this.lvl('yarn');
    if (yl) {
      this.yarnAngle += DT * (2.4 + yl * 0.4);
      const n = 1 + yl;
      const R = 62 + yl * 4;
      for (let i = 0; i < n; i++) {
        const a = this.yarnAngle + (i * Math.PI * 2) / n;
        const c = dcos(a);
        const s = dsin(a);
        const x = p.x + c * R;
        const y = p.y + s * R;
        for (const en of this.enemies) {
          if (en.dead || en.yarnTick > this.tick) continue;
          if ((en.x - x) ** 2 + (en.y - y) ** 2 < (en.r + 12) ** 2) {
            en.yarnTick = this.tick + Math.round(0.45 * TICK_RATE);
            this.hit(en, 9 + yl * 3, c * 60, s * 60);
          }
        }
      }
    }
    // Meow wave: area damage with knockback.
    const ml = this.lvl('meow');
    if (ml && --this.cd.meow <= 0) {
      this.cd.meow = Math.round((3 - ml * 0.3) * TICK_RATE);
      const R = 90 + ml * 18;
      this.emit({ t: 'wave', x: p.x, y: p.y, r: R });
      for (const en of this.enemies) {
        const dx = en.x - p.x;
        const dy = en.y - p.y;
        const d = len(dx, dy) || 1;
        if (d < R + en.r) this.hit(en, 12 + ml * 6, (dx / d) * BALANCE.meowPush, (dy / d) * BALANCE.meowPush);
      }
    }
    // Laser pointer: a beam through the nearest enemy.
    const ll = this.lvl('laser');
    if (ll && --this.cd.laser <= 0) {
      const target = this.nearest(p.x, p.y, 500);
      if (target) {
        this.cd.laser = Math.round((2.2 - ll * 0.2) * TICK_RATE);
        const d = len(target.x - p.x, target.y - p.y) || 1;
        const cx = (target.x - p.x) / d;
        const cy = (target.y - p.y) / d;
        const beam = 520;
        const w = 8 + ll * 3;
        this.emit({ t: 'beam', x: p.x, y: p.y, dx: cx, dy: cy, len: beam, w });
        for (const en of this.enemies) {
          const dx = en.x - p.x;
          const dy = en.y - p.y;
          const along = dx * cx + dy * cy;
          if (along < 0 || along > beam) continue;
          if (Math.abs(dx * cy - dy * cx) < w + en.r) this.hit(en, 20 + ll * 10, cx * 40, cy * 40);
        }
      }
    }
  }

  // Enemies walk to the cat; touching it hurts.
  private moveEnemies(): void {
    const p = this.player;
    for (const en of this.enemies) {
      const dx = p.x - en.x;
      const dy = p.y - en.y;
      const d = len(dx, dy) || 1;
      en.x += ((dx / d) * en.speed + en.kx) * DT;
      en.y += ((dy / d) * en.speed + en.ky) * DT;
      en.kx *= KNOCKBACK_DECAY;
      en.ky *= KNOCKBACK_DECAY;
      if (d < en.r + p.r && p.inv <= 0 && !en.dead) {
        p.hp -= en.dmg;
        p.inv = Math.round(0.5 * TICK_RATE);
        this.emit({ t: 'hurt', dmg: en.dmg });
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
    const grid = new Map<number, Enemy[]>();
    for (const en of this.enemies) {
      const k = Math.floor(en.x / CELL) * 65536 + Math.floor(en.y / CELL);
      const list = grid.get(k);
      if (list) list.push(en);
      else grid.set(k, [en]);
    }
    for (const list of grid.values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = len(dx, dy) || 0.01;
          const min = a.r + b.r;
          if (d < min) {
            const push = (min - d) / 2;
            a.x -= (dx / d) * push;
            a.y -= (dy / d) * push;
            b.x += (dx / d) * push;
            b.y += (dy / d) * push;
          }
        }
      }
    }
  }

  private moveShots(): void {
    for (const s of this.shots) {
      s.x += s.vx * DT;
      s.y += s.vy * DT;
      s.life--;
      for (const en of this.enemies) {
        if (en.dead || s.life <= 0) continue;
        if ((en.x - s.x) ** 2 + (en.y - s.y) ** 2 < (en.r + s.r) ** 2) {
          this.hit(en, s.dmg, s.vx * 0.15, s.vy * 0.15);
          if (s.pierce-- <= 0) s.life = 0;
        }
      }
    }
  }

  // Gems fly to the cat inside the magnet radius.
  private collectGems(): void {
    const p = this.player;
    for (const g of this.gems) {
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const d = len(dx, dy) || 1;
      if (d < this.magnet || g.pull) {
        g.pull = true;
        const step = Math.min(d, 380 * DT);
        g.x += (dx / d) * step;
        g.y += (dy / d) * step;
      }
      if (d < p.r + 6 && !g.got) {
        g.got = true;
        this.xp += g.v;
      }
    }
    this.checkLevel();
  }

  // ---------- levels ----------
  private checkLevel(): void {
    if (this.pending || this.over || this.xp < this.need) return;
    this.xp -= this.need;
    this.level++;
    this.need = Math.round(this.need * 1.1 + 2);
    const pool = UPGRADE_IDS.filter((k) => this.lvl(k) < UPGRADES[k].max);
    if (!pool.length) return;
    this.pending = this.rng.sample(pool, 3);
    this.emit({ t: 'level' });
  }

  private apply(k: UpgradeId): void {
    this.up[k] = this.lvl(k) + 1;
    const p = this.player;
    if (k === 'speed') p.speed *= 1.12;
    if (k === 'heart') {
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 40);
    }
    if (k === 'magnet') this.magnet += 60;
    if (k === 'power') this.power *= 1.15;
  }
}
