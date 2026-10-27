// Balance check for «Коты против пылесосов»: bots of three skill levels play
// full runs, and the table shows how long they last and when the build is full.
// Usage: node tools/cats-balance.ts [runs per cell]
import { cats } from '../packages/core/src/index.ts';

const { BOT_SKILLS, BOT_STYLES, TICK_RATE, isWeapon, playBot } = cats;
const RUNS = Number(process.argv[2] ?? 8);

function pct(xs: number[], p: number): number {
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}
const mmss = (sec: number) => (sec === Infinity ? '—' : `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`);

console.log(`| Бот | Стиль | Медиана | 10% худших | Побед | Уровень | Оружия на 8 | Эволюций | Полная сборка (медиана) |`);
console.log(`|---|---|---|---|---|---|---|---|---|`);
for (const [skillName, skill] of Object.entries(BOT_SKILLS)) {
  for (const [styleName, style] of Object.entries(BOT_STYLES)) {
    const times: number[] = [];
    const levels: number[] = [];
    const maxed: number[] = [];
    const full: number[] = [];
    const evos: number[] = [];
    let wins = 0;
    for (let i = 0; i < RUNS; i++) {
      const run = playBot(1000 + i, style, skill).run;
      times.push(run.tick / TICK_RATE);
      levels.push(run.level);
      maxed.push(run.weapons().filter((w) => isWeapon(w) && run.lvl(w) >= 8).length);
      evos.push(Object.keys(run.evolved).length);
      full.push(run.fullTick < 0 ? Infinity : run.fullTick / TICK_RATE);
      if (run.won) wins++;
    }
    console.log(
      `| ${skillName} | ${styleName} | ${mmss(pct(times, 0.5))} | ${mmss(pct(times, 0.1))} | ${Math.round((100 * wins) / RUNS)}% | ${pct(levels, 0.5)} | ${pct(maxed, 0.5)} | ${pct(evos, 0.5)} | ${mmss(pct(full, 0.5))} |`,
    );
  }
}
