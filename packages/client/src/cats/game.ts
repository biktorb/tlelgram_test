import { cats } from '@otryad/core';
import { HERO_SIZE, flashSprite, heroSprite, sprite, type SpriteId } from './sprites.ts';

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
  hero?: cats.HeroId; // the player's hero
  ghostHero?: cats.HeroId; // the hero the ghost played
  room?: cats.RoomId; // the ghost plays the same room
  powers?: cats.Powers; // the player's Power Ups
  ghostPowers?: cats.Powers;
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
  constructor(seed: number, rec: RunRecord, hero?: cats.HeroId, room?: cats.RoomId, powers?: cats.Powers) {
    this.run = new CatRun(seed, { events: false, hero, room, powers });
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

// The picture of each kind, and a colour over it for the stronger kinds that
// share a picture with a weaker one.
const ENEMY_SPRITE: Record<cats.EnemyKind, [SpriteId, string?]> = {
  mouse: ['bat'],
  redmouse: ['bat', '#e0303a'],
  dust: ['stump'],
  mite: ['kikimora'],
  moth: ['wisp'],
  robot: ['boar'],
  wetbot: ['bear'],
  rat: ['wolf', '#2a2a35'],
  brush: ['wolf'],
  bigvac: ['leshy'],
  bigrobot: ['hut'],
  mop: ['yaga'],
  pigeon: ['bird'],
  crow: ['bird', '#ffffff'],
  trimmer: ['robber'],
  goose: ['goose'],
  wasp: ['hornet'],
  mower: ['flail'],
  tractor: ['tur'],
  dog: ['wolf', '#5a2a1a'],
  hound: ['rider'],
  combine: ['ataman'],
  bulldog: ['son'],
  blower: ['solovey'],
  minibot: ['bones'],
  redbot: ['bones', '#ff6a1e'],
  hose: ['snake'],
  scrubber: ['guard'],
  drone: ['dragonling'],
  washer: ['sorcerer'],
  steamer: ['bonehorse'],
  roller: ['chudo'],
  cyclone: ['knight'],
  tank: ['idol'],
  industrial: ['likho'],
  king: ['gorynych'],
  wall: ['thistle'],
  cleaner: ['koschei'],
};
// The ground of each location: two checker colours and the line between tiles.
const FLOORS: Record<cats.RoomId, [string, string, string]> = {
  flat: ['#7fa860', '#77a058', 'rgba(40, 70, 30, .10)'],
  yard: ['#c9a874', '#c1a06b', 'rgba(110, 80, 40, .12)'],
  warehouse: ['#8f8896', '#857e8c', 'rgba(30, 24, 36, .25)'],
};
const BOSS_TEXT: Record<cats.RoomId, [string, string]> = {
  flat: ['Летит Баба-Яга!', 'Баба-Яга повержена!'],
  yard: ['Свистит Соловей-Разбойник!', 'Соловей связан!'],
  warehouse: ['Идёт Змей Горыныч!', 'Змей Горыныч повержен!'],
};
const PICKUP_ICON: Record<cats.PickupKind, string> = { food: '🥧', catnip: '🌪️', alarm: '🔔', plug: '🌿', coin: '💰', chest: '🎁' };
// Breakable things on the ground, one kind per location.
const PROP_ICON: Record<cats.RoomId, string> = { flat: '🧺', yard: '🛢️', warehouse: '⚱️' };
const PICKUP_TEXT: Record<cats.PickupKind, string> = { food: '+30 ❤', catnip: 'Вихрь!', alarm: 'Набат!', plug: 'Нечисть уснула!', coin: '+5 💰', chest: '' };
// Obstacles keep the furniture kinds of the sim: in the forest a sofa is a
// fallen log, a table a boulder, a wardrobe a fir; on the road a flowerbed
// is bushes, a bench a cart, a car a haystack; in the castle shelves are
// stone walls.
const FURNITURE_COLORS: Record<cats.FurnitureKind, [string, string, string]> = {
  sofa: ['#8a5f37', '#c49a6c', '#4f3420'],
  table: ['#8e939c', '#aab0b8', '#5a5f68'],
  wardrobe: ['#2f6a37', '#3f8a47', '#1f4a25'],
  flowerbed: ['#4f8a3a', '#6aa84f', '#2a5a1f'],
  bench: ['#9a6a3a', '#b8864f', '#5a3a1a'],
  car: ['#d9b45a', '#e8c873', '#8a6a20'],
  shelf: ['#6a6470', '#7c7682', '#3a3440'],
};

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
    const { hero, room, powers } = opts;
    this.rec = opts.progress ? resume(seed, opts.progress, { hero, room, powers }) : new Recorder(new CatRun(seed, { hero, room, powers }));
    this.ghost = opts.ghost ? new Ghost(seed, opts.ghost, opts.ghostHero, room, opts.ghostPowers) : null;
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
        // The ring stays where the finger went down; the direction is all that counts.
        x = dx / d;
        y = dy / d;
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
    // World units per screen pixel: the screen shows as much as the sim
    // counts as on screen (13.5 heroes across a phone) and no more, so enemies
    // always come from beyond its edge.
    this.zoom = Math.min((2 * cats.SCREEN_X) / this.W, (2 * cats.SCREEN_Y) / this.H);
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
      case 'kill': {
        const boss = e.kind === cats.ROOMS[this.run.room].boss;
        this.burst(e.x, e.y, boss ? 40 : e.elite ? 18 : 6, boss ? '#ffcf3f' : '#d8dcef');
        if (boss) {
          this.shake = 22;
          this.text(e.x, e.y - 50, BOSS_TEXT[this.run.room][1], '#ffcf3f', 24);
        }
        break;
      }
      case 'wind':
        this.text(this.run.player.x, this.run.player.y - 60, 'Ветер!', '#7fbf6a', 22);
        this.shake = Math.max(this.shake, 6);
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
        this.text(this.run.player.x, this.run.player.y - 70, BOSS_TEXT[this.run.room][0], '#ff6b6b', 30);
        this.shake = 12;
        break;
      case 'revive':
        this.text(this.run.player.x, this.run.player.y - 70, 'Девятая жизнь!', '#ffd166', 26, 2);
        this.burst(this.run.player.x, this.run.player.y, 30, '#ffd166');
        this.shake = 10;
        break;
      case 'cleaner':
        this.text(this.run.player.x, this.run.player.y - 70, '20:00! Пришёл Кощей Бессмертный, беги!', '#ff6b6b', 22, 2.5);
        this.shake = 16;
        break;
      case 'elite':
        this.text(this.run.player.x, this.run.player.y - 70, `${cats.ENEMIES[cats.ROOMS[this.run.room].elite].name}!`, '#ff9f43', 24);
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

  private blitHero(hero: cats.HeroId, x: number, y: number, size: number, flip: boolean): void {
    const px = (size / this.zoom) * this.dpr;
    this.ctx.drawImage(heroSprite(hero, px, flip), x - size / 2, y - size / 2, size, size);
  }

  private blit(id: SpriteId, x: number, y: number, size: number, flip = false, flash = false, tint?: string): void {
    const c = this.ctx;
    const px = (size / this.zoom) * this.dpr;
    const img = flash ? flashSprite(id, px, flip) : sprite(id, px, flip, tint);
    c.drawImage(img, x - size / 2, y - size / 2, size, size);
  }

  private furniture: cats.Furniture[] = [];

  private drawFurniture(f: cats.Furniture): void {
    const c = this.ctx;
    const [body, top, edge] = FURNITURE_COLORS[f.kind];
    c.fillStyle = 'rgba(30, 20, 10, .2)';
    c.fillRect(f.x + 6, f.y + 8, f.w, f.h);
    c.strokeStyle = edge;
    c.lineWidth = 3;
    const round = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
      c.fillStyle = fill;
      c.beginPath();
      c.roundRect(x, y, w, h, r);
      c.fill();
      c.stroke();
    };
    const dots = (step: number, r: number, fill: string, inset = r + 4) => {
      c.fillStyle = fill;
      for (let x = f.x + inset; x <= f.x + f.w - inset + 0.1; x += step) {
        for (let y = f.y + inset; y <= f.y + f.h - inset + 0.1; y += step) {
          c.beginPath();
          c.arc(x, y, r, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        }
      }
    };
    const along = f.w >= f.h;
    switch (f.kind) {
      case 'sofa': {
        // A log: bark with rings at both ends.
        round(f.x, f.y, f.w, f.h, Math.min(f.w, f.h) / 2, body);
        const r = Math.min(f.w, f.h) / 2 - 4;
        for (const [x, y] of along ? [[f.x + r + 4, f.y + f.h / 2], [f.x + f.w - r - 4, f.y + f.h / 2]] : [[f.x + f.w / 2, f.y + r + 4], [f.x + f.w / 2, f.y + f.h - r - 4]]) {
          c.fillStyle = top;
          c.beginPath();
          c.arc(x, y, r, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        }
        break;
      }
      case 'table':
        round(f.x, f.y, f.w, f.h, Math.min(f.w, f.h) * 0.4, body);
        c.fillStyle = top;
        c.beginPath();
        c.ellipse(f.x + f.w * 0.4, f.y + f.h * 0.35, f.w * 0.25, f.h * 0.18, 0, 0, Math.PI * 2);
        c.fill();
        break;
      case 'wardrobe':
      case 'flowerbed':
        // Tree crowns or bushes: overlapping round tufts.
        round(f.x, f.y, f.w, f.h, 16, body);
        dots(f.kind === 'wardrobe' ? 34 : 24, f.kind === 'wardrobe' ? 15 : 10, top);
        if (f.kind === 'flowerbed') dots(24, 3, '#e86f8f', 14);
        break;
      case 'bench': {
        // A cart: the box and two wheels.
        round(f.x, f.y, f.w, f.h, 6, body);
        c.fillStyle = top;
        c.fillRect(f.x + 8, f.y + 8, f.w - 16, f.h - 16);
        for (const k of [0.25, 0.75]) {
          const x = along ? f.x + f.w * k : f.x - 4;
          const y = along ? f.y - 4 : f.y + f.h * k;
          c.fillStyle = '#5a3a1a';
          c.beginPath();
          c.arc(x, y, 9, 0, Math.PI * 2);
          c.arc(along ? x : x + f.w + 8, along ? y + f.h + 8 : y, 9, 0, Math.PI * 2);
          c.fill();
        }
        break;
      }
      case 'car':
        // A haystack.
        round(f.x, f.y, f.w, f.h, Math.min(f.w, f.h) / 2, body);
        c.strokeStyle = '#b8923a';
        c.lineWidth = 2;
        for (let i = 1; i < 5; i++) {
          c.beginPath();
          if (along) {
            c.moveTo(f.x + (f.w * i) / 5, f.y + 6);
            c.lineTo(f.x + (f.w * i) / 5 - 6, f.y + f.h - 6);
          } else {
            c.moveTo(f.x + 6, f.y + (f.h * i) / 5);
            c.lineTo(f.x + f.w - 6, f.y + (f.h * i) / 5 - 6);
          }
          c.stroke();
        }
        break;
      default: {
        // Stone blocks in rows.
        c.fillStyle = body;
        c.fillRect(f.x, f.y, f.w, f.h);
        c.strokeRect(f.x, f.y, f.w, f.h);
        c.fillStyle = top;
        c.lineWidth = 2;
        const bh = Math.max(14, f.h / Math.max(1, Math.round(f.h / 22)));
        for (let y = f.y, row = 0; y < f.y + f.h - 1; y += bh, row++) {
          for (let x = f.x + (row % 2 ? -20 : 0); x < f.x + f.w; x += 40) {
            const x0 = Math.max(f.x, x + 2);
            const x1 = Math.min(f.x + f.w, x + 38);
            if (x1 > x0) {
              c.fillRect(x0, y + 2, x1 - x0, bh - 4);
              c.strokeRect(x0, y + 2, x1 - x0, bh - 4);
            }
          }
        }
      }
    }
  }

  // The road's fences, the castle walls and the streams of the fiery river\n  // (the warehouse's conveyor belts in the sim).
  private drawWalls(px: number, py: number, view: number, t: number): void {
    const c = this.ctx;
    const map = this.run.map;
    for (const b of map.belts) {
      if (b.y > py + view || b.y + b.h < py - view) continue;
      const x0 = Math.max(b.x, px - view);
      const x1 = Math.min(b.x + b.w, px + view);
      c.fillStyle = '#d9582b';
      c.fillRect(x0, b.y, x1 - x0, b.h);
      // Chevrons that run with the stream.
      c.strokeStyle = 'rgba(255, 220, 90, .55)';
      c.lineWidth = 4;
      const dir = Math.sign(b.vx);
      const shift = (((t * b.vx) % 60) + 60) % 60;
      c.beginPath();
      for (let x = Math.floor(x0 / 60) * 60 + shift; x < x1; x += 60) {
        c.moveTo(x - dir * 10, b.y + b.h * 0.25);
        c.lineTo(x + dir * 10, b.y + b.h * 0.5);
        c.lineTo(x - dir * 10, b.y + b.h * 0.75);
      }
      c.stroke();
    }
    const bd = map.bounds;
    if (!bd) return;
    c.fillStyle = map.shape === 'strip' ? '#3f6a33' : '#2a2530';
    const big = view * 2 + 200;
    // Everything beyond the walls is filled.
    if (bd.minY > py - view) c.fillRect(px - view, bd.minY - big, view * 2, big);
    if (bd.maxY < py + view) c.fillRect(px - view, bd.maxY, view * 2, big);
    if (bd.minX > px - view) c.fillRect(bd.minX - big, py - view, big, view * 2);
    if (bd.maxX < px + view) c.fillRect(bd.maxX, py - view, big, view * 2);
    if (map.shape === 'strip') {
      // The palisade.
      c.fillStyle = '#7a5530';
      for (let x = Math.floor((px - view) / 40) * 40; x < px + view; x += 40) {
        c.fillRect(x, bd.minY - 26, 10, 26);
        c.fillRect(x, bd.maxY, 10, 26);
      }
    }
  }

  private floorPattern(): CanvasPattern {
    if (this.floor) return this.floor;
    const t = document.createElement('canvas');
    t.width = t.height = 128;
    const c = t.getContext('2d')!;
    const [light, dark, line] = FLOORS[this.run.room];
    c.fillStyle = light;
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = dark;
    c.fillRect(0, 0, 64, 64);
    c.fillRect(64, 64, 64, 64);
    c.strokeStyle = line;
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

    const view = (Math.max(this.W, this.H) / 2) * z + 140;
    this.drawWalls(px, py, view, t);

    // Furniture: a shadow, the body and a lighter top.
    for (const f of run.map.near(px, py, view, this.furniture)) this.drawFurniture(f);

    // Poison left by sorcerers, and Solovey's leaves.
    for (const h of run.hazards) {
      if (h.kind === 'puddle') {
        c.globalAlpha = Math.min(1, h.life / 20) * 0.45;
        c.fillStyle = '#7bd14a';
        c.beginPath();
        c.ellipse(h.x, h.y, h.r, h.r * 0.75, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.globalAlpha = 1;

    // Puddles of living water, under everything.
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
    for (const pr of run.props) c.fillText(PROP_ICON[run.room], pr.x, pr.y);
    for (const it of run.pickups) {
      const y = it.y + Math.sin(t * 4 + it.id) * 2;
      if (it.kind !== 'coin') {
        c.fillText(PICKUP_ICON[it.kind], it.x, y);
        continue;
      }
      // A gold coin, drawn: the coin emoji is silver on iPhones.
      c.fillStyle = '#f2c230';
      c.strokeStyle = '#a8740f';
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(it.x, y, 9, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#ffe58a';
      c.beginPath();
      c.arc(it.x - 2.5, y - 2.5, 3.5, 0, Math.PI * 2);
      c.fill();
    }
    for (const h of run.hazards) if (h.kind === 'leaf') c.fillText('🍂', h.x, h.y);
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
      // Pictures face right: charging boars face where they run, the rest
      // face the hero.
      const flip = e.kind === 'robot' ? e.vx < 0 : x > px;
      const [id, tint] = ENEMY_SPRITE[e.kind];
      this.blit(id, x, y + wob, size, flip, run.tick - e.hitTick < 3, tint);
      if (e.hp < e.maxHp && (e.elite || e.kind === 'robot')) {
        const w = e.r * 2;
        c.fillStyle = 'rgba(0,0,0,.45)';
        c.fillRect(x - w / 2, y - e.r - 10, w, 5);
        c.fillStyle = '#ff5468';
        c.fillRect(x - w / 2, y - e.r - 10, w * Math.max(0, e.hp / e.maxHp), 5);
      }
    }

    // Sleep grass: everything goes blue while the enemies sleep.
    if (run.freeze > 0) {
      c.fillStyle = 'rgba(120, 180, 255, .25)';
      c.fillRect(px - (this.W / 2) * z, py - (this.H / 2) * z, this.W * z, this.H * z);
    }

    // Shots: fire feathers and arrows pointing where they fly, spinning axes.
    for (const s of run.shots) {
      const [x, y] = this.lerp(s.id, s.x, s.y, a);
      c.save();
      c.translate(x, y);
      if (s.kind === 'laser') {
        c.rotate(Math.atan2(s.vy, s.vx) + Math.PI / 2 + 0.6);
        this.blit('feather', 0, 0, Math.max(20, s.r * 3));
      } else if (s.kind === 'fish') {
        c.rotate(Math.atan2(s.vy, s.vx));
        this.blit('arrow', 0, 0, 30);
      } else {
        c.rotate(t * 10 + s.id);
        this.blit('axe', 0, 0, s.r * 2.2);
      }
      c.restore();
    }

    // Charms orbit the hero while they spin.
    if (run.lvl('yarn') && run.yarnLeft > 0) {
      const w = run.weaponStats('yarn');
      const R = 72 * w.area;
      for (let i = 0; i < w.amount; i++) {
        const ang = run.yarnAngle + (i * Math.PI * 2) / w.amount;
        this.blit('charm', px + Math.cos(ang) * R, py + Math.sin(ang) * R, 24 * w.area);
      }
    }

    // Sword strokes: three streaks across the hit box.
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

    // Lightning: a bolt from above and a flash.
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

    // Gusli: rings of sound.
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
      this.blitHero(this.ghost.run.hero, gx, gy, HERO_SIZE[this.ghost.run.hero] * 0.8, g.face < 0);
      c.globalAlpha = 1;
    }

    // The hero blinks while invulnerable and bobs while walking.
    const moving = this.stick.on || this.keys.size > 0;
    if (p.inv <= 0 || Math.floor(run.tick / 2) % 2) {
      // An orange ring under the hero so it stands out from the crowd.
      c.fillStyle = 'rgba(255, 138, 61, .35)';
      c.strokeStyle = 'rgba(255, 138, 61, .9)';
      c.lineWidth = 2.5;
      c.beginPath();
      c.ellipse(px, py + 16, 22, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      this.blitHero(run.hero, px, py + (moving ? Math.sin(t * 16) * 2 : 0), HERO_SIZE[run.hero], p.face < 0);
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

