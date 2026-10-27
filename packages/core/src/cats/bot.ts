import type { UpgradeId } from './content.ts';
import { dirFromVector, Recorder } from './record.ts';
import { CatRun } from './sim.ts';

// A simple player for balance checks and tests: runs from nearby enemies,
// picks up gems when it is safe, and takes upgrades by a fixed preference.
export interface BotStyle {
  fear: number; // how far away enemies start to matter
  prefer: readonly UpgradeId[];
}

export const BOT_STYLES: Record<string, BotStyle> = {
  fish: { fear: 160, prefer: ['fish', 'power', 'speed', 'heart', 'magnet', 'meow', 'yarn', 'laser'] },
  yarn: { fear: 150, prefer: ['yarn', 'heart', 'meow', 'speed', 'power', 'fish', 'magnet', 'laser'] },
  laser: { fear: 170, prefer: ['laser', 'meow', 'power', 'speed', 'fish', 'heart', 'yarn', 'magnet'] },
  mixed: { fear: 160, prefer: ['meow', 'yarn', 'fish', 'laser', 'speed', 'heart', 'power', 'magnet'] },
};

export function botMove(run: CatRun, style: BotStyle): number {
  const p = run.player;
  let fx = 0;
  let fy = 0;
  let danger = 0;
  for (const en of run.enemies) {
    const dx = p.x - en.x;
    const dy = p.y - en.y;
    const d2 = dx * dx + dy * dy;
    const reach = style.fear + en.r;
    if (d2 > reach * reach) continue;
    const d = Math.sqrt(d2) || 1;
    const w = (en.dmg / 5) * (1 - d / reach) ** 2;
    fx += (dx / d) * w;
    fy += (dy / d) * w;
    danger += w;
  }
  // Gems pull harder when nothing is close.
  let best = Infinity;
  let gx = 0;
  let gy = 0;
  for (const g of run.gems) {
    const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
    if (d2 < best) {
      best = d2;
      gx = g.x - p.x;
      gy = g.y - p.y;
    }
  }
  if (best < 300 * 300) {
    const d = Math.sqrt(best) || 1;
    const w = 0.4 / (1 + danger * 4);
    fx += (gx / d) * w;
    fy += (gy / d) * w;
  }
  // Nothing near and nothing to pick up: wait for the swarm.
  if (danger === 0 && best >= 300 * 300) return 0;
  return dirFromVector(fx, fy, 0.01);
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
  sharp: { react: 1, fear: 160 },
  casual: { react: 10, fear: 100 },
  slow: { react: 30, fear: 100 },
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
