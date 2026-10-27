import { cats } from '@otryad/core';
import { flashSprite, sprite, type SpriteId } from './sprites.ts';

const { CatRun, DT, Recorder, decodeMoves, dirFromVector, resume } = cats;
type CatRun = InstanceType<typeof cats.CatRun>;
type SimEvent = cats.SimEvent;
type CardId = cats.CardId;
export type RunRecord = cats.RunRecord;

export interface GameHooks {
  // A card choice is pending; call `choose` with the card index, or
  // `reroll` (null when none is left) to be offered new cards.
  onLevelUp(cards: CardId[], levels: number[], choose: (i: number) => void, reroll: (() => void) | null): void;
  onEnd(run: CatRun, record: RunRecord): void;
  onHud(run: CatRun, ghost: CatRun | null): void;
  onEvent?(e: SimEvent): void;
  // Every half a minute of play, to save the progress.
  onCheckpoint?(): void;
}

export interface GameOptions {
  ghost?: RunRecord; // a run to race against, from the same seed
  progress?: RunRecord; // input of an unfinished run, to continue it
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  color: string;
  size: number;
}
interface FloatText {
  x: number;
  y: number;
  s: string;
  color: string;
  size: number;
  t: number;
  life: number;
}
interface Ring {
  x: number;
  y: number;
  r: number;
  t: number;
}
interface Slash {
  x: number;
  y: number;
  w: number;
  h: number;
  face: 1 | -1;
  t: number;
}
interface Spark {
  x: number;
  y: number;
  r: number;
  t: number;
}

// Plays the ghost's record step by step next to the live run.
class Ghost {
  readonly run: CatRun;
  private dirs: number[];
  private picks: string;
  private i = 0;
  private pick = 0;
  constructor(seed: number, rec: RunRecord) {
    this.run = new CatRun(seed, { events: false });
    this.dirs = decodeMoves(rec.moves);
    this.picks = rec.picks;
  }
  step(): void {
    const r = this.run;
    if (r.over) return;
    while (r.pending) {
      const c = this.picks[this.pick++];
      if (c === 'r') r.reroll();
      else r.choose(Number(c ?? 0));
    }
    r.step(this.dirs[this.i++] ?? 0);
  }
}

const ENEMY_SPRITE: Record<cats.EnemyKind, SpriteId> = { mouse: 'mouse', dust: 'dust', robot: 'vacuum', bigrobot: 'vacuum', mop: 'boss', cleaner: 'cleaner' };
const PICKUP_ICON: Record<cats.PickupKind, string> = { food: '🍗', catnip: '🌿', alarm: '⏰', plug: '🔌', coin: '🐟', chest: '🎁' };
const PICKUP_TEXT: Record<cats.PickupKind, string> = { food: '+30 ❤', catnip: 'Мята!', alarm: 'Будильник!', plug: 'Пылесосы выключены!', coin: '+5 🐟', chest: '' };
const FURNITURE_COLORS: Record<cats.FurnitureKind, [string, string, string]> = {
  sofa: ['#6f8fc9', '#8eaadb', '#46639a'],
  table: ['#b07a4a', '#c99563', '#7d5230'],
  wardrobe: ['#8a5a3b', '#a2714f', '#5e3a22'],
};
const VIEW_RADIUS = 470; // world units from the cat to the nearest screen edge, at most

export class Game {
  readonly rec: InstanceType<typeof cats.Recorder>;
  readonly ghost: Ghost | null;
  private readonly cv: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hooks: GameHooks;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private zoom = 1;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private paused = false;
  private waiting = false;
  private ended = false;
  private hudAt = 0;
  // Slow phones get a lower resolution instead of a choppy game.
  private maxDpr = 2;
  private slowFrames = 0;
  // Positions before the last tick, to draw smoothly between ticks.
  private prev = new Map<number, [number, number]>();
  private prevPlayer: [number, number] = [0, 0];
  private prevGhost: [number, number] = [0, 0];
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private rings: Ring[] = [];
  private slashes: Slash[] = [];
  private sparks: Spark[] = [];
  private shake = 0;
  private hurt = 0;
  private floor: CanvasPattern | null = null;
  // Joystick: where the finger went down and where it is now.
  private stick = { on: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  private keys = new Set<string>();
  private cleanup: (() => void)[] = [];

  constructor(cv: HTMLCanvasElement, seed: number, hooks: GameHooks, opts: GameOptions = {}) {
    this.cv = cv;
    this.ctx = cv.getContext('2d')!;
    this.hooks = hooks;
    this.rec = opts.progress ? resume(seed, opts.progress) : new Recorder(new CatRun(seed));
    this.ghost = opts.ghost ? new Ghost(seed, opts.ghost) : null;
    // The ghost catches up with a continued run: one ghost step per tick played.
    for (let i = 0; i < this.run.tick; i++) this.ghost?.step();
    this.prevPlayer = [this.run.player.x, this.run.player.y];
    this.bind();
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    if (this.run.pending) this.offer();
  }

  get run(): CatRun {
    return this.rec.run;
  }

  setPaused(p: boolean): void {
    this.paused = p;
    this.last = performance.now();
    this.acc = 0;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    for (const off of this.cleanup) off();
  }

  // ---------- input ----------
  private bind(): void {
    const on = <K extends keyof WindowEventMap>(t: EventTarget, type: K, fn: (e: WindowEventMap[K]) => void) => {
      t.addEventListener(type, fn as EventListener, { passive: false });
      this.cleanup.push(() => t.removeEventListener(type, fn as EventListener));
    };
    on(this.cv, 'pointerdown', (e) => {
      if (this.stick.on) return;
      this.stick = { on: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      this.cv.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    on(this.cv, 'pointermove', (e) => {
      if (this.stick.on && e.pointerId === this.stick.id) {
        this.stick.x = e.clientX;
        this.stick.y = e.clientY;
      }
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId === this.stick.id) this.stick.on = false;
    };
    on(this.cv, 'pointerup', up);
    on(this.cv, 'pointercancel', up);
    on(window, 'keydown', (e) => this.keys.add(e.key.toLowerCase()));
    on(window, 'keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    on(window, 'resize', () => this.resize());
  }

  private stickVector(): [number, number] {
    let x = 0;
    let y = 0;
    const s = this.stick;
    if (s.on) {
      const dx = s.x - s.ox;
      const dy = s.y - s.oy;
      const d = Math.hypot(dx, dy);
      if (d > 8) {
        x = dx / d;
        y = dy / d;
        // The ring follows a finger that drags too far, so turning back is instant.
        if (d > 60) {
          s.ox = s.x - x * 60;
          s.oy = s.y - y * 60;
        }
      }
    }
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft') || k.has('ф')) x -= 1;
    if (k.has('d') || k.has('arrowright') || k.has('в')) x += 1;
    if (k.has('w') || k.has('arrowup') || k.has('ц')) y -= 1;
    if (k.has('s') || k.has('arrowdown') || k.has('ы')) y += 1;
    return [x, y];
  }

  private resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.cv.width = Math.round(this.W * this.dpr);
    this.cv.height = Math.round(this.H * this.dpr);
    // Enemies appear 500 units away, so the screen must not show further than that.
    this.zoom = Math.max(this.W, this.H) / 2 > VIEW_RADIUS ? Math.max(this.W, this.H) / 2 / VIEW_RADIUS : 1;
    this.floor = null;
  }

  // ---------- loop ----------
  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused && !this.waiting && !this.ended && this.maxDpr > 1) {
      this.slowFrames = dt > 0.024 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
      if (this.slowFrames > 90) {
        this.maxDpr = this.maxDpr > 1.5 ? 1.5 : 1;
        this.slowFrames = 0;
        this.resize();
      }
    }
    if (!this.paused && !this.waiting && !this.ended) {
      this.acc += dt;
      while (this.acc >= DT && !this.waiting && !this.ended) {
        this.acc -= DT;
        this.tick();
      }
    }
    this.updateEffects(this.paused || this.waiting ? 0 : dt);
    this.render(this.waiting || this.ended ? 1 : Math.min(1, this.acc / DT));
    if (now - this.hudAt > 100) {
      this.hudAt = now;
      this.hooks.onHud(this.run, this.ghost?.run ?? null);
    }
  };

  private tick(): void {
    const run = this.run;
    this.prev.clear();
    for (const e of run.enemies) this.prev.set(e.id, [e.x, e.y]);
    for (const s of run.shots) this.prev.set(s.id, [s.x, s.y]);
    for (const g of run.gems) this.prev.set(g.id, [g.x, g.y]);
    for (const z of run.zones) this.prev.set(z.id, [z.x, z.y]);
    this.prevPlayer = [run.player.x, run.player.y];
    const [x, y] = this.stickVector();
    this.rec.step(dirFromVector(x, y, 0.3));
    if (this.ghost) {
      this.prevGhost = [this.ghost.run.player.x, this.ghost.run.player.y];
      const wasOver = this.ghost.run.over;
      this.ghost.step();
      if (!wasOver && this.ghost.run.over && !this.ghost.run.won) {
        this.text(this.ghost.run.player.x, this.ghost.run.player.y - 30, 'Призрак выбыл!', '#c9b8ff', 18);
      }
    }
    for (const e of run.events) this.effect(e);
    if (run.tick % (30 * cats.TICK_RATE) === 0) this.hooks.onCheckpoint?.();
    if (run.over) {
      this.ended = true;
      this.hooks.onEnd(run, this.rec.record());
    } else if (run.pending) {
      this.offer();
    }
  }

  // Shows the pending cards. A choice can level up again right away.
  private offer(): void {
    const run = this.run;
    this.waiting = true;
    const cards = run.pending!.slice();
    this.hooks.onLevelUp(
      cards,
      cards.map((k) => (k === 'snack' || k === 'fishes' ? 0 : run.lvl(k))),
      (i) => {
        this.rec.choose(i);
        if (run.pending) this.offer();
        else {
          this.waiting = false;
          this.last = performance.now();
          this.acc = 0;
        }
      },
      run.rerolls > 0
        ? () => {
            this.rec.reroll();
            this.offer();
          }
        : null,
    );
  }

  // ---------- effects ----------
  private effect(e: SimEvent): void {
    this.hooks.onEvent?.(e);
    switch (e.t) {
      case 'hit':
        this.text(e.x, e.y, String(Math.round(e.dmg)), '#ffffff', 13);
        break;
      case 'kill':
        this.burst(e.x, e.y, e.kind === 'mop' ? 40 : e.elite ? 18 : 6, e.kind === 'mop' ? '#ffcf3f' : '#d8dcef');
        if (e.kind === 'mop') {
          this.shake = 22;
          this.text(e.x, e.y - 50, 'Швабра сломана!', '#ffcf3f', 24);
        }
        break;
      case 'hurt':
        this.hurt = 0.25;
        this.shake = Math.max(this.shake, 8);
        this.text(this.run.player.x, this.run.player.y - 24, `-${e.dmg}`, '#ff6b6b', 17);
        break;
      case 'level':
        this.burst(this.run.player.x, this.run.player.y, 18, '#8e7bff');
        break;
      case 'boss':
        this.text(this.run.player.x, this.run.player.y - 70, 'Идёт Швабра!', '#ff6b6b', 30);
        this.shake = 12;
        break;
      case 'cleaner':
        this.text(this.run.player.x, this.run.player.y - 70, '20:00! Пришла Уборщица, беги!', '#ff6b6b', 22, 2.5);
        this.shake = 16;
        break;
      case 'elite':
        this.text(this.run.player.x, this.run.player.y - 70, 'Большой робот!', '#ff9f43', 24);
        break;
      case 'pickup':
        this.text(this.run.player.x, this.run.player.y - 40, PICKUP_TEXT[e.kind], '#ffe08a', 18);
        if (e.kind === 'alarm') this.shake = 14;
        break;
      case 'chest': {
        const p = this.run.player;
        const lines = e.evolved.length ? e.evolved.map((w) => `✨ ${cats.EVOLUTIONS[w].name}!`) : e.items.map((k) => `${cats.cardName(k)} +1`);
        lines.forEach((s, i) => this.text(p.x, p.y - 50 - i * 22, s, e.evolved.length ? '#ffcf3f' : '#ffe08a', e.evolved.length ? 24 : 17, 1.6));
        this.burst(p.x, p.y, 30, '#ffcf3f');
        break;
      }
      case 'slash':
        this.slashes.push({ ...e, t: 0 });
        break;
      case 'spark':
        this.sparks.push({ ...e, t: 0 });
        break;
      case 'wave':
        this.rings.push({ x: e.x, y: e.y, r: e.r, t: 0 });
        break;
    }
  }

  private burst(x: number, y: number, n: number, color: string): void {
    if (this.particles.length > 400) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 170;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.45 + Math.random() * 0.3, color, size: 2 + Math.random() * 3 });
    }
  }

  private text(x: number, y: number, s: string, color: string, size: number, life = 0.6): void {
    if (this.texts.length > 60 && life <= 0.6) return;
    this.texts.push({ x: x + (Math.random() - 0.5) * 12, y, s, color, size, t: 0, life });
  }

  private updateEffects(dt: number): void {
    const damp = Math.pow(0.0005, dt);
    for (const p of this.particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= damp;
      p.vy *= damp;
    }
    for (const t of this.texts) {
      t.t += dt;
      t.y -= 32 * dt;
    }
    for (const r of this.rings) r.t += dt;
    for (const b of this.slashes) b.t += dt;
    for (const b of this.sparks) b.t += dt;
    this.particles = this.particles.filter((p) => p.t < p.life);
    this.texts = this.texts.filter((t) => t.t < t.life);
    this.rings = this.rings.filter((r) => r.t < 0.35);
    this.slashes = this.slashes.filter((b) => b.t < 0.18);
    this.sparks = this.sparks.filter((b) => b.t < 0.3);
    this.shake *= Math.pow(0.002, dt);
    this.hurt = Math.max(0, this.hurt - dt);
  }

  // ---------- render ----------
  private lerp(id: number, x: number, y: number, a: number): [number, number] {
    const p = this.prev.get(id);
    return p ? [p[0] + (x - p[0]) * a, p[1] + (y - p[1]) * a] : [x, y];
  }

  private blit(id: SpriteId, x: number, y: number, size: number, flip = false, flash = false): void {
    const c = this.ctx;
    const px = size * this.zoom * this.dpr;
    const img = flash ? flashSprite(id, px, flip) : sprite(id, px, flip);
    c.drawImage(img, x - size / 2, y - size / 2, size, size);
  }

  private furniture: cats.Furniture[] = [];

  private drawFurniture(f: cats.Furniture): void {
    const c = this.ctx;
    const [body, top, edge] = FURNITURE_COLORS[f.kind];
    c.fillStyle = 'rgba(60, 40, 20, .2)';
    c.fillRect(f.x + 6, f.y + 8, f.w, f.h);
    c.fillStyle = body;
    c.strokeStyle = edge;
    c.lineWidth = 3;
    c.beginPath();
    c.roundRect(f.x, f.y, f.w, f.h, 8);
    c.fill();
    c.stroke();
    c.fillStyle = top;
    if (f.kind === 'sofa') {
      // Cushions along the long side.
      const n = 3;
      const along = f.w >= f.h;
      for (let i = 0; i < n; i++) {
        c.beginPath();
        if (along) c.roundRect(f.x + 8 + (i * (f.w - 16)) / n, f.y + 10, (f.w - 16) / n - 4, f.h - 18, 6);
        else c.roundRect(f.x + 10, f.y + 8 + (i * (f.h - 16)) / n, f.w - 18, (f.h - 16) / n - 4, 6);
        c.fill();
      }
    } else if (f.kind === 'table') {
      c.beginPath();
      c.roundRect(f.x + 8, f.y + 8, f.w - 16, f.h - 16, 6);
      c.fill();
    } else {
      // Wardrobe doors.
      c.fillRect(f.x + 6, f.y + 6, f.w - 12, f.h - 12);
      c.strokeStyle = edge;
      c.lineWidth = 2;
      c.beginPath();
      if (f.w < f.h) {
        c.moveTo(f.x + f.w / 2, f.y + 6);
        c.lineTo(f.x + f.w / 2, f.y + f.h - 6);
      } else {
        c.moveTo(f.x + 6, f.y + f.h / 2);
        c.lineTo(f.x + f.w - 6, f.y + f.h / 2);
      }
      c.stroke();
    }
  }

  private floorPattern(): CanvasPattern {
    if (this.floor) return this.floor;
    const t = document.createElement('canvas');
    t.width = t.height = 128;
    const c = t.getContext('2d')!;
    c.fillStyle = '#e9dcc6';
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#dfcfb4';
    c.fillRect(0, 0, 64, 64);
    c.fillRect(64, 64, 64, 64);
    c.strokeStyle = 'rgba(120, 90, 60, .18)';
    c.lineWidth = 2;
    c.strokeRect(0, 0, 64, 64);
    c.strokeRect(64, 64, 64, 64);
    this.floor = this.ctx.createPattern(t, 'repeat')!;
    return this.floor;
  }

  private render(a: number): void {
    const c = this.ctx;
    const run = this.run;
    const p = run.player;
    const px = this.prevPlayer[0] + (p.x - this.prevPlayer[0]) * a;
    const py = this.prevPlayer[1] + (p.y - this.prevPlayer[1]) * a;
    const z = this.zoom;
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    const t = run.tick / 30;

    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.save();
    c.translate(this.W / 2 + sx, this.H / 2 + sy);
    c.scale(1 / z, 1 / z);
    c.translate(-px, -py);
    // Floor: the pattern scrolls with the world.
    c.fillStyle = this.floorPattern();
    c.fillRect(px - (this.W / 2) * z - 40, py - (this.H / 2) * z - 40, this.W * z + 80, this.H * z + 80);

    // Gems.
    for (const g of run.gems) {
      const [x, y] = this.lerp(g.id, g.x, g.y, a);
      c.fillStyle = g.v >= 8 ? '#ffb300' : g.v >= 3 ? '#8e5bff' : '#29a8e0';
      c.beginPath();
      c.moveTo(x, y - 7);
      c.lineTo(x + 5.5, y);
      c.lineTo(x, y + 7);
      c.lineTo(x - 5.5, y);
      c.fill();
      c.strokeStyle = '#ffffffb0';
      c.lineWidth = 1.5;
      c.stroke();
    }

    // Furniture: a shadow, the body and a lighter top.
    for (const f of run.map.near(px, py, (Math.max(this.W, this.H) / 2) * z + 140, this.furniture)) this.drawFurniture(f);

    // Puddles from the glass, under everything.
    for (const zn of run.zones) {
      c.globalAlpha = Math.min(1, zn.life / 15) * 0.55;
      c.fillStyle = '#5fb7f0';
      c.beginPath();
      c.ellipse(zn.x, zn.y, zn.r, zn.r * 0.7, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // Things on the floor.
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '22px system-ui, sans-serif';
    for (const it of run.pickups) c.fillText(PICKUP_ICON[it.kind], it.x, it.y + Math.sin(t * 4 + it.id) * 2);
    c.textBaseline = 'alphabetic';

    // Shadows first, then bodies, so crowds read clearly.
    c.fillStyle = 'rgba(60, 40, 20, .18)';
    c.beginPath();
    for (const e of run.enemies) {
      const [x, y] = this.lerp(e.id, e.x, e.y, a);
      c.moveTo(x + e.r * 0.9, y + e.r * 0.8);
      c.ellipse(x, y + e.r * 0.8, e.r * 0.9, e.r * 0.35, 0, 0, Math.PI * 2);
    }
    c.fill();
    for (const e of run.enemies) {
      const [x, y] = this.lerp(e.id, e.x, e.y, a);
      if (e.elite) {
        c.fillStyle = 'rgba(255, 70, 90, .22)';
        c.beginPath();
        c.arc(x, y, e.r + 8, 0, Math.PI * 2);
        c.fill();
      }
      const wob = run.freeze > 0 || e.kind === 'robot' || e.kind === 'bigrobot' ? 0 : Math.sin(t * 12 + e.id) * 1.5;
      const size = e.r * 2.3;
      // Charging robots face where they drive.
      const flip = e.kind === 'robot' ? e.vx > 0 : x > px;
      this.blit(ENEMY_SPRITE[e.kind], x, y + wob, size, flip, run.tick - e.hitTick < 3);
      if (e.hp < e.maxHp && (e.elite || e.kind === 'robot')) {
        const w = e.r * 2;
        c.fillStyle = 'rgba(0,0,0,.45)';
        c.fillRect(x - w / 2, y - e.r - 10, w, 5);
        c.fillStyle = '#ff5468';
        c.fillRect(x - w / 2, y - e.r - 10, w * Math.max(0, e.hp / e.maxHp), 5);
      }
    }

    // Unplugged vacuums go blue.
    if (run.freeze > 0) {
      c.fillStyle = 'rgba(120, 180, 255, .25)';
      c.fillRect(px - (this.W / 2) * z, py - (this.H / 2) * z, this.W * z, this.H * z);
    }

    // Shots: laser dots, fish pointing where they fly, spinning pots.
    for (const s of run.shots) {
      const [x, y] = this.lerp(s.id, s.x, s.y, a);
      if (s.kind === 'laser') {
        c.fillStyle = '#ff2d45';
        c.beginPath();
        c.arc(x, y, s.r, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(x, y, s.r * 0.4, 0, Math.PI * 2);
        c.fill();
      } else if (s.kind === 'fish') {
        c.save();
        c.translate(x, y);
        c.rotate(Math.atan2(s.vy, s.vx) + Math.PI);
        this.blit('fish', 0, 0, 24);
        c.restore();
      } else {
        c.save();
        c.translate(x, y);
        c.rotate(t * 10 + s.id);
        c.font = `${Math.round(s.r * 2)}px system-ui, sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('🪴', 0, 0);
        c.restore();
        c.textBaseline = 'alphabetic';
      }
    }

    // Yarn balls orbit the cat while they spin.
    if (run.lvl('yarn') && run.yarnLeft > 0) {
      const w = run.weaponStats('yarn');
      const R = 72 * w.area;
      for (let i = 0; i < w.amount; i++) {
        const ang = run.yarnAngle + (i * Math.PI * 2) / w.amount;
        this.blit('yarn', px + Math.cos(ang) * R, py + Math.sin(ang) * R, 24 * w.area);
      }
    }

    // Claw slashes: three scratches across the hit box.
    for (const sl of this.slashes) {
      const k = sl.t / 0.18;
      c.globalAlpha = 1 - k;
      c.strokeStyle = '#ffffff';
      c.lineWidth = 4;
      for (let i = -1; i <= 1; i++) {
        c.beginPath();
        c.moveTo(sl.x - (sl.face * sl.w) / 2, sl.y + i * sl.h * 0.3 - sl.h * 0.2);
        c.lineTo(sl.x - (sl.face * sl.w) / 2 + sl.face * sl.w * Math.min(1, k * 3), sl.y + i * sl.h * 0.3 + sl.h * 0.2);
        c.stroke();
      }
    }
    c.globalAlpha = 1;

    // Static sparks: a bolt from above and a flash.
    for (const sp of this.sparks) {
      const k = sp.t / 0.3;
      c.globalAlpha = 1 - k;
      c.strokeStyle = '#fff36b';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(sp.x + 10, sp.y - 120);
      c.lineTo(sp.x - 8, sp.y - 70);
      c.lineTo(sp.x + 6, sp.y - 40);
      c.lineTo(sp.x, sp.y);
      c.stroke();
      c.fillStyle = 'rgba(255, 243, 107, .35)';
      c.beginPath();
      c.arc(sp.x, sp.y, sp.r * (0.6 + k * 0.4), 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // Meow waves.
    for (const r of this.rings) {
      const k = r.t / 0.35;
      c.strokeStyle = `rgba(255, 190, 40, ${1 - k})`;
      c.lineWidth = 7 * (1 - k) + 1;
      c.beginPath();
      c.arc(r.x, r.y, 10 + (r.r - 10) * k, 0, Math.PI * 2);
      c.stroke();
    }

    // The friend's ghost.
    if (this.ghost && !this.ghost.run.over) {
      const g = this.ghost.run.player;
      const gx = this.prevGhost[0] + (g.x - this.prevGhost[0]) * a;
      const gy = this.prevGhost[1] + (g.y - this.prevGhost[1]) * a;
      c.globalAlpha = 0.45;
      this.blit('cat', gx, gy, 36, g.face < 0);
      c.globalAlpha = 1;
    }

    // The cat blinks while invulnerable and bobs while walking.
    const moving = this.stick.on || this.keys.size > 0;
    if (p.inv <= 0 || Math.floor(run.tick / 2) % 2) {
      // An orange ring under the cat so it stands out from the crowd.
      c.fillStyle = 'rgba(255, 138, 61, .35)';
      c.strokeStyle = 'rgba(255, 138, 61, .9)';
      c.lineWidth = 2.5;
      c.beginPath();
      c.ellipse(px, py + 16, 22, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      this.blit('cat', px, py + (moving ? Math.sin(t * 16) * 2 : 0), 46, p.face < 0);
    }

    // Particles and floating numbers on top.
    for (const q of this.particles) {
      c.globalAlpha = 1 - q.t / q.life;
      c.fillStyle = q.color;
      c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    c.textAlign = 'center';
    c.lineJoin = 'round';
    for (const tx of this.texts) {
      c.globalAlpha = Math.min(1, 2 * (1 - tx.t / tx.life));
      c.font = `800 ${tx.size}px system-ui, sans-serif`;
      c.lineWidth = 3.5;
      c.strokeStyle = 'rgba(30, 20, 40, .85)';
      c.strokeText(tx.s, tx.x, tx.y);
      c.fillStyle = tx.color;
      c.fillText(tx.s, tx.x, tx.y);
    }
    c.globalAlpha = 1;
    c.restore();

    if (this.hurt > 0) {
      c.fillStyle = `rgba(255, 30, 60, ${this.hurt * 0.8})`;
      c.fillRect(0, 0, this.W, this.H);
    }
    // Joystick ring under the finger.
    const s = this.stick;
    if (s.on) {
      const [vx, vy] = this.stickVector();
      c.strokeStyle = 'rgba(40, 30, 50, .3)';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(s.ox, s.oy, 52, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = 'rgba(40, 30, 50, .3)';
      c.beginPath();
      c.arc(s.ox + vx * 52, s.oy + vy * 52, 22, 0, Math.PI * 2);
      c.fill();
    }
  }
}

