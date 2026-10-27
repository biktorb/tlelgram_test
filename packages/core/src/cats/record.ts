import { CatRun, DIRECTIONS, RUN_TICKS } from './sim.ts';

// A run is stored as its input only: the joystick direction of every tick
// and the upgrade picked on every level-up. Replaying it on the same seed
// gives the same run, so the server can check the result and a friend can
// watch it as a ghost.
//
// moves: one letter per direction ('a' is standing still, 'b'..'q' are the
// 16 directions), followed by a repeat count when it is above 1: "a12c3d".
// picks: one digit per level-up, the index of the chosen card.
export interface RunRecord {
  moves: string;
  picks: string;
}

const A = 97; // 'a'

export class Recorder {
  readonly run: CatRun;
  private moves: string[] = [];
  private last = -1;
  private count = 0;
  private picks = '';

  constructor(run: CatRun) {
    this.run = run;
  }

  step(dir: number): void {
    if (this.run.over || this.run.pending) return;
    const d = dir >= 0 && dir <= DIRECTIONS ? dir | 0 : 0;
    this.run.step(d);
    if (d === this.last) this.count++;
    else {
      this.flush();
      this.last = d;
      this.count = 1;
    }
  }

  choose(index: number): void {
    if (!this.run.pending) return;
    const i = index >= 0 && index < this.run.pending.length ? index | 0 : 0;
    this.picks += String(i);
    this.run.choose(i);
  }

  record(): RunRecord {
    this.flush();
    this.last = -1;
    this.count = 0;
    return { moves: this.moves.join(''), picks: this.picks };
  }

  private flush(): void {
    if (this.last < 0) return;
    this.moves.push(String.fromCharCode(A + this.last) + (this.count > 1 ? String(this.count) : ''));
    this.last = -1;
    this.count = 0;
  }
}

// Expands "a12c3d" to one direction per tick. Throws on malformed input.
export function decodeMoves(moves: string, maxTicks = RUN_TICKS): number[] {
  const out: number[] = [];
  const re = /([a-q])(\d*)/gy;
  let m: RegExpExecArray | null;
  while (re.lastIndex < moves.length) {
    m = re.exec(moves);
    if (!m) throw new Error('bad moves');
    const n = m[2] ? Number(m[2]) : 1;
    if (!Number.isSafeInteger(n) || n < 1 || out.length + n > maxTicks) throw new Error('bad moves');
    const dir = m[1].charCodeAt(0) - A;
    for (let i = 0; i < n; i++) out.push(dir);
  }
  return out;
}

// Replays a record. If the input ends before the run does (the app was
// closed, or another engine rounded differently), the cat stands still until
// the run is over, so every record has exactly one result.
export function replay(seed: number, rec: RunRecord, opts: { events?: boolean } = {}): CatRun {
  if (!/^[0-9]*$/.test(rec.picks) || rec.picks.length > 200) throw new Error('bad picks');
  const dirs = decodeMoves(rec.moves);
  const run = new CatRun(seed, { events: opts.events ?? false });
  let pick = 0;
  let i = 0;
  while (!run.over) {
    if (run.pending) {
      run.choose(pick < rec.picks.length ? Number(rec.picks[pick]) : 0);
      pick++;
      continue;
    }
    run.step(i < dirs.length ? dirs[i] : 0);
    i++;
  }
  return run;
}

// Joystick vector to a direction code. Dead zone below `dead` of full tilt.
export function dirFromVector(x: number, y: number, dead = 0.15): number {
  if (x * x + y * y < dead * dead) return 0;
  const a = Math.atan2(y, x);
  const i = Math.round((a / (Math.PI * 2)) * DIRECTIONS);
  return (((i % DIRECTIONS) + DIRECTIONS) % DIRECTIONS) + 1;
}
