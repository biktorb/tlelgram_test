// The floor of a room and what stands on it, placed from the run's seed so
// the server and every client see the same room. The cat and the enemies
// walk around furniture; shots fly over it.
//
// - The flat is endless: a few pieces in every square block.
// - The yard is a strip between two fences, endless to the left and right.
// - The warehouse is a closed hall with rows of shelves and conveyor belts.

export type FurnitureKind = 'sofa' | 'table' | 'wardrobe' | 'flowerbed' | 'bench' | 'car' | 'shelf';
export type MapShape = 'open' | 'strip' | 'hall';

export interface Furniture {
  kind: FurnitureKind;
  // Axis-aligned box: left, top, width, height.
  x: number;
  y: number;
  w: number;
  h: number;
}

// A strip of floor that carries the cat along.
export interface Belt {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const BLOCK = 420; // side of a floor block with its own furniture
const CLEAR = 260; // no furniture this close to where the cat starts
export const FENCE = 330; // the yard's fences are this far above and below the start
export const HALL = 1500; // the warehouse walls are this far from the start
const BELT_SPEED = 70;

const SIZES: Record<FurnitureKind, [number, number]> = {
  sofa: [130, 54],
  table: [84, 84],
  wardrobe: [64, 120],
  flowerbed: [120, 70],
  bench: [110, 32],
  car: [170, 80],
  shelf: [360, 44],
};
const KINDS: Record<'open' | 'strip', FurnitureKind[]> = {
  open: ['sofa', 'table', 'wardrobe'],
  strip: ['flowerbed', 'bench', 'car'],
};

// A small integer hash: the same on every engine (Math.imul and >>> are exact).
function hash(seed: number, bx: number, by: number, salt: number): number {
  let h = (seed ^ Math.imul(bx, 0x27d4eb2d) ^ Math.imul(by, 0x165667b1) ^ Math.imul(salt, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}

export class RoomMap {
  readonly shape: MapShape;
  readonly bounds: Bounds | null;
  readonly belts: Belt[] = [];
  private readonly seed: number;
  private readonly blocks = new Map<number, Furniture[]>();
  private readonly scratch: Furniture[] = [];
  private readonly hall: Furniture[] = [];

  constructor(seed: number, shape: MapShape = 'open') {
    this.seed = seed >>> 0;
    this.shape = shape;
    const far = 1e9;
    this.bounds =
      shape === 'strip'
        ? { minX: -far, maxX: far, minY: -FENCE, maxY: FENCE }
        : shape === 'hall'
          ? { minX: -HALL, maxX: HALL, minY: -HALL, maxY: HALL }
          : null;
    if (shape === 'hall') this.buildHall();
  }

  // Rows of shelves with gaps between them, and a belt along every other
  // aisle. The middle row stays open around the start.
  private buildHall(): void {
    const [w, h] = SIZES.shelf;
    const GAP = 150;
    const ROW = 300;
    let row = 0;
    for (let y = -HALL + 200; y < HALL - 100; y += ROW, row++) {
      // Each row is shifted so the gaps don't line up into one long corridor.
      const shift = hash(this.seed, row, 0, 7) % (w + GAP);
      for (let x = -HALL + 60 - shift; x < HALL - 60; x += w + GAP) {
        const x0 = Math.max(x, -HALL + 60);
        const x1 = Math.min(x + w, HALL - 60);
        if (x1 - x0 < 80) continue;
        if (Math.abs(y + h / 2) < CLEAR && x0 < CLEAR && x1 > -CLEAR) continue;
        this.hall.push({ kind: 'shelf', x: x0, y, w: x1 - x0, h });
      }
      if (row % 2 === 1) {
        const dir = hash(this.seed, row, 1, 9) & 1 ? 1 : -1;
        // A narrow belt down the middle of the aisle.
        this.belts.push({ x: -HALL, y: y + h + (ROW - h) / 2 - 35, w: HALL * 2, h: 70, vx: dir * BELT_SPEED });
      }
    }
  }

  // The furniture of one block, made on first use.
  block(bx: number, by: number): Furniture[] {
    if (this.shape === 'hall') return [];
    if (this.shape === 'strip' && by !== 0) return [];
    const key = bx * 1048576 + by; // blocks stay well within ±500000
    let list = this.blocks.get(key);
    if (list) return list;
    list = [];
    const kinds = KINDS[this.shape === 'strip' ? 'strip' : 'open'];
    const n = hash(this.seed, bx, by, 0) % 3; // 0..2 pieces
    for (let i = 0; i < n; i++) {
      const kind = kinds[hash(this.seed, bx, by, 1 + i * 3) % kinds.length];
      let [w, h] = SIZES[kind];
      if (this.shape === 'open' && hash(this.seed, bx, by, 2 + i * 3) & 1) [w, h] = [h, w]; // turned sideways
      const r = hash(this.seed, bx, by, 3 + i * 3);
      // Keep a margin so pieces of neighbouring blocks never touch.
      const x = bx * BLOCK + 30 + (r % (BLOCK - 60 - w));
      // In the yard, pieces stand between the fences with room to pass.
      const y = this.shape === 'strip' ? -FENCE + 70 + ((r >>> 12) % (FENCE * 2 - 140 - h)) : by * BLOCK + 30 + ((r >>> 12) % (BLOCK - 60 - h));
      if (Math.abs(x + w / 2) < CLEAR + w / 2 && Math.abs(y + h / 2) < CLEAR + h / 2) continue;
      if (list.some((f) => x < f.x + f.w + 30 && f.x < x + w + 30 && y < f.y + f.h + 30 && f.y < y + h + 30)) continue;
      list.push({ kind, x, y, w, h });
    }
    this.blocks.set(key, list);
    // Old blocks far behind are dropped; they come back the same if needed.
    if (this.blocks.size > 400) this.blocks.delete(this.blocks.keys().next().value!);
    return list;
  }

  // Furniture that may touch the box around (x, y) of half-size `reach`.
  near(x: number, y: number, reach: number, out: Furniture[] = []): Furniture[] {
    out.length = 0;
    if (this.shape === 'hall') {
      for (const f of this.hall) if (x + reach > f.x && x - reach < f.x + f.w && y + reach > f.y && y - reach < f.y + f.h) out.push(f);
      return out;
    }
    const x0 = Math.floor((x - reach) / BLOCK);
    const x1 = Math.floor((x + reach) / BLOCK);
    const y0 = Math.floor((y - reach) / BLOCK);
    const y1 = Math.floor((y + reach) / BLOCK);
    for (let bx = x0; bx <= x1; bx++) for (let by = y0; by <= y1; by++) for (const f of this.block(bx, by)) out.push(f);
    return out;
  }

  // Pushes a circle out of any furniture it overlaps and back inside the
  // walls. Returns the new centre.
  pushOut(x: number, y: number, r: number): [number, number] {
    for (const f of this.near(x, y, r, this.scratch)) {
      const cx = Math.max(f.x, Math.min(x, f.x + f.w));
      const cy = Math.max(f.y, Math.min(y, f.y + f.h));
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 0) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        // The centre is inside: leave by the nearest side.
        const left = x - f.x;
        const right = f.x + f.w - x;
        const top = y - f.y;
        const bottom = f.y + f.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = f.x - r;
        else if (m === right) x = f.x + f.w + r;
        else if (m === top) y = f.y - r;
        else y = f.y + f.h + r;
      }
    }
    return this.clamp(x, y, r);
  }

  clamp(x: number, y: number, r: number): [number, number] {
    const b = this.bounds;
    if (!b) return [x, y];
    return [Math.max(b.minX + r, Math.min(b.maxX - r, x)), Math.max(b.minY + r, Math.min(b.maxY - r, y))];
  }

  inside(x: number, y: number): boolean {
    const b = this.bounds;
    return !b || (x > b.minX && x < b.maxX && y > b.minY && y < b.maxY);
  }

  blocked(x: number, y: number, r: number): boolean {
    const [nx, ny] = this.pushOut(x, y, r);
    return nx !== x || ny !== y;
  }

  // How fast the floor under (x, y) carries the cat sideways.
  belt(x: number, y: number): number {
    for (const b of this.belts) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b.vx;
    return 0;
  }
}
