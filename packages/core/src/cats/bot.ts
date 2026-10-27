import type { CardId } from './content.ts';
import { dirFromVector, Recorder } from './record.ts';
import { CatRun, DIR_VECTORS } from './sim.ts';

// A simple player for balance checks and tests: runs from nearby enemies,
// picks up gems when it is safe, and takes upgrades by a fixed preference.
export interface BotStyle {
  fear: number; // how far away enemies start to matter
  prefer: readonly CardId[];
}

// Weapons first, then the passives that help them most.
export const BOT_STYLES: Record<string, BotStyle> = {
  ranged: {
    fear: 160,
    prefer: ['laser', 'fish', 'claws', 'pot', 'spark', 'yarn', 'pack', 'box', 'food', 'belly', 'paws', 'catnip', 'bigpaws', 'patience', 'purr', 'blackcat', 'meow', 'glass', 'snack', 'fishes'],
  },
  melee: {
    fear: 150,
    prefer: ['claws', 'meow', 'yarn', 'glass', 'laser', 'pot', 'bigpaws', 'belly', 'food', 'box', 'patience', 'purr', 'pack', 'catnip', 'paws', 'blackcat', 'fish', 'spark', 'snack', 'fishes'],
  },
  mixed: {
    fear: 160,
    prefer: ['claws', 'laser', 'yarn', 'meow', 'spark', 'pot', 'fish', 'glass', 'box', 'pack', 'food', 'bigpaws', 'belly', 'patience', 'catnip', 'purr', 'paws', 'blackcat', 'snack', 'fishes'],
  },
};

// Looks a moment ahead in every direction and takes the one that keeps
// enemies just outside `fear` (close enough for short weapons to reach them)
// and leads to gems.
const LOOK = 0.35; // seconds ahead

export function botMove(run: CatRun, style: BotStyle): number {
  const p = run.player;
  let bestDir = 0;
  let bestScore = -Infinity;
  // The nearest gem or thing on the floor, worth walking to. Things count
  // as twice nearer, and food only when hurt.
  let gem: { x: number; y: number } | null = null;
  let gd = 700 * 700;
  for (const g of run.gems) {
    const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
    if (d2 < gd) {
      gd = d2;
      gem = g;
    }
  }
  for (const it of run.pickups) {
    if (it.kind === 'food' && p.hp > p.maxHp * 0.7) continue;
    const d2 = ((it.x - p.x) ** 2 + (it.y - p.y) ** 2) / 4;
    if (d2 < gd) {
      gd = d2;
      gem = it;
    }
  }
  const step = run.stats.move * LOOK;
  // A hurt cat plays safer.
  const care = 1 + 3 * (1 - p.hp / p.maxHp);
  for (let dir = 0; dir < DIR_VECTORS.length; dir++) {
    const [mx, my] = DIR_VECTORS[dir];
    const qx = p.x + mx * step;
    const qy = p.y + my * step;
    let score = 0;
    let close = Infinity;
    // The claws hit the side the cat faces: turning to the swarm pays.
    const face = mx > 0.01 ? 1 : mx < -0.01 ? -1 : p.face;
    // Worth a lot just before the claws strike, little otherwise.
    const clawsValue = run.lvl('claws') > 0 ? (run.readyIn('claws') <= LOOK * 30 ? 6 : 0.5) : 0;
    for (const en of run.enemies) {
      let dx = qx - en.x;
      let dy = qy - en.y;
      let d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > 400) continue;
      // Where the enemy will be by then.
      const move = Math.min(d, en.speed * LOOK);
      const charge = en.vx !== 0 || en.vy !== 0;
      const ex = en.x + (charge ? en.vx * en.speed * LOOK : (dx / d) * move);
      const ey = en.y + (charge ? en.vy * en.speed * LOOK : (dy / d) * move);
      dx = qx - ex;
      dy = qy - ey;
      d = Math.sqrt(dx * dx + dy * dy);
      const reach = style.fear + en.r + p.r;
      if (d < reach) score -= en.dmg * care * (1 + ((reach - d) / reach) * 4);
      if (d < close) close = d;
      if (clawsValue && Math.abs(ex - (qx + face * 45)) < 75 + en.r && Math.abs(ey - qy) < 20 + en.r) score += clawsValue;
    }
    // Stay near the swarm rather than run off.
    if (close < Infinity && close > style.fear * 2) score -= (close - style.fear * 2) * 0.02;
    if (gem) score -= Math.sqrt((gem.x - qx) ** 2 + (gem.y - qy) ** 2) * 0.25;
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }
  return bestDir;
}

export function botPick(run: CatRun, style: BotStyle): number {
  const offer = run.pending ?? [];
  let best = 0;
  let rank = Infinity;
  offer.forEach((k, i) => {
    const r = style.prefer.indexOf(k);
    if (r >= 0 && r < rank) {
      rank = r;
      best = i;
    }
  });
  return best;
}

// How quickly the bot reacts, as a stand-in for players of different skill.
export interface BotSkill {
  react: number; // ticks between joystick changes
  fear: number;
}

export const BOT_SKILLS: Record<'sharp' | 'casual' | 'slow', BotSkill> = {
  sharp: { react: 3, fear: 25 },
  casual: { react: 8, fear: 25 },
  slow: { react: 12, fear: 25 },
};

// Plays a whole run and returns its record.
export function playBot(seed: number, style: BotStyle, skill: BotSkill): Recorder {
  const s = { ...style, fear: skill.fear };
  const rec = new Recorder(new CatRun(seed, { events: false }));
  let dir = 0;
  while (!rec.run.over) {
    if (rec.run.pending) rec.choose(botPick(rec.run, s));
    else {
      if (rec.run.tick % skill.react === 0) dir = botMove(rec.run, s);
      rec.step(dir);
    }
  }
  return rec;
}
