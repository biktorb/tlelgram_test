// Furniture of the endless apartment: a few pieces in every square block of
// the floor, placed from the run's seed so the server and every client see
// the same room. The cat and the enemies walk around it; shots fly over it.

export type FurnitureKind = 'sofa' | 'table' | 'wardrobe';

export interface Furniture {
  kind: FurnitureKind;
  // Axis-aligned box: left, top, width, height.
  x: number;
  y: number;
  w: number;
  h: number;
}

export const BLOCK = 420; // side of a floor block with its own furniture
const CLEAR = 260; // no furniture this close to where the cat starts

const SIZES: Record<FurnitureKind, [number, number]> = {
  sofa: [130, 54],
  table: [84, 84],
  wardrobe: [64, 120],
};
const KINDS: FurnitureKind[] = ['sofa', 'table', 'wardrobe'];

// A small integer hash: the same on every engine (Math.imul and >>> are exact).
function hash(seed: number, bx: number, by: number, salt: number): number {
  let h = (seed ^ Math.imul(bx, 0x27d4eb2d) ^ Math.imul(by, 0x165667b1) ^ Math.imul(salt, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}

export class RoomMap {
  private readonly seed: number;
  private readonly blocks = new Map<number, Furniture[]>();
  private readonly scratch: Furniture[] = [];

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  // The furniture of one block, made on first use.
  block(bx: number, by: number): Furniture[] {
    const key = bx * 1048576 + by; // blocks stay well within ±500000
    let list = this.blocks.get(key);
    if (list) return list;
    list = [];
    const n = hash(this.seed, bx, by, 0) % 3; // 0..2 pieces
    for (let i = 0; i < n; i++) {
      const kind = KINDS[hash(this.seed, bx, by, 1 + i * 3) % KINDS.length];
      let [w, h] = SIZES[kind];
      if (hash(this.seed, bx, by, 2 + i * 3) & 1) [w, h] = [h, w]; // turned sideways
      const r = hash(this.seed, bx, by, 3 + i * 3);
      // Keep a margin so pieces of neighbouring blocks never touch.
      const x = bx * BLOCK + 30 + (r % (BLOCK - 60 - w));
      const y = by * BLOCK + 30 + ((r >>> 12) % (BLOCK - 60 - h));
      if (Math.abs(x + w / 2) < CLEAR + w / 2 && Math.abs(y + h / 2) < CLEAR + h / 2) continue;
      if (list.some((f) => x < f.x + f.w + 30 && f.x < x + w + 30 && y < f.y + f.h + 30 && f.y < y + h + 30)) continue;
      list.push({ kind, x, y, w, h });
    }
    this.blocks.set(key, list);
    // Old blocks far behind are dropped; they come back the same if needed.
    if (this.blocks.size > 400) this.blocks.delete(this.blocks.keys().next().value!);
    return list;
  }

  // Furniture whose blocks touch the box around (x, y) of half-size `reach`.
  near(x: number, y: number, reach: number, out: Furniture[] = []): Furniture[] {
    out.length = 0;
    const x0 = Math.floor((x - reach) / BLOCK);
    const x1 = Math.floor((x + reach) / BLOCK);
    const y0 = Math.floor((y - reach) / BLOCK);
    const y1 = Math.floor((y + reach) / BLOCK);
    for (let bx = x0; bx <= x1; bx++) for (let by = y0; by <= y1; by++) for (const f of this.block(bx, by)) out.push(f);
    return out;
  }

  // Pushes a circle out of any furniture it overlaps. Returns the new centre.
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
    return [x, y];
  }

  blocked(x: number, y: number, r: number): boolean {
    const [nx, ny] = this.pushOut(x, y, r);
    return nx !== x || ny !== y;
  }
}
