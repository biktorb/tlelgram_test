// mulberry32: small, fast and fully deterministic. The state is a plain
// number so it can be stored with a run and replayed on the server.
export class Rng {
  state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)];
  }

  // Picks up to `count` distinct items.
  sample<T>(items: readonly T[], count: number): T[] {
    const pool = items.slice();
    const out: T[] = [];
    while (out.length < count && pool.length > 0) {
      out.push(pool.splice(this.int(pool.length), 1)[0]);
    }
    return out;
  }

  // Picks up to `count` distinct items, each as likely as its weight.
  weighted<T>(items: readonly T[], count: number, weight: (item: T) => number): T[] {
    const pool = items.slice();
    const out: T[] = [];
    while (out.length < count && pool.length > 0) {
      let r = this.next() * pool.reduce((sum, it) => sum + weight(it), 0);
      let i = 0;
      while (i < pool.length - 1 && (r -= weight(pool[i])) >= 0) i++;
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
