// Balance check for «Коты против пылесосов»: bots of three skill levels play
// full runs, and the table shows how long they last and when the build is full.
// Usage: node tools/cats-balance.ts [runs per cell] [cat|all] [room|all] [max]
// `max` gives the bots every Power Up at its top level.
import { cats } from '../packages/core/src/index.ts';

const { BOT_SKILLS, BOT_STYLES, HERO_IDS, POWERS, POWER_IDS, ROOM_IDS, TICK_RATE, isHero, isRoom, isWeapon, playBot } = cats;
const RUNS = Number(process.argv[2] ?? 8);
const arg = process.argv[3] ?? 'ryzhik';
const heroes = arg === 'all' ? HERO_IDS : isHero(arg) ? [arg] : [];
if (!heroes.length) throw new Error(`unknown cat: ${arg}`);
const roomArg = process.argv[4] ?? 'flat';
const rooms = roomArg === 'all' ? ROOM_IDS : isRoom(roomArg) ? [roomArg] : [];
if (!rooms.length) throw new Error(`unknown room: ${roomArg}`);
const powers = process.argv[5] === 'max' ? Object.fromEntries(POWER_IDS.map((id) => [id, POWERS[id].max])) : {};

function pct(xs: number[], p: number): number {
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}
const mmss = (sec: number) => (sec === Infinity ? '—' : `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`);

console.log(`| Комната | Кот | Бот | Стиль | Медиана | 10% худших | Побед | Уровень | Оружия на 8 | Эволюций | Полная сборка (медиана) |`);
console.log(`|---|---|---|---|---|---|---|---|---|---|---|`);
for (const room of rooms) for (const hero of heroes) {
  for (const [skillName, skill] of Object.entries(BOT_SKILLS)) {
    for (const [styleName, style] of Object.entries(BOT_STYLES)) {
      const times: number[] = [];
      const levels: number[] = [];
      const maxed: number[] = [];
      const full: number[] = [];
      const evos: number[] = [];
      let wins = 0;
      for (let i = 0; i < RUNS; i++) {
        const run = playBot(1000 + i, style, skill, { hero, room, powers }).run;
        times.push(run.tick / TICK_RATE);
        levels.push(run.level);
        maxed.push(run.weapons().filter((w) => isWeapon(w) && run.lvl(w) >= 8).length);
        evos.push(Object.keys(run.evolved).length);
        full.push(run.fullTick < 0 ? Infinity : run.fullTick / TICK_RATE);
        if (run.won) wins++;
      }
      console.log(
        `| ${cats.ROOMS[room].name} | ${cats.HEROES[hero].name} | ${skillName} | ${styleName} | ${mmss(pct(times, 0.5))} | ${mmss(pct(times, 0.1))} | ${Math.round((100 * wins) / RUNS)}% | ${pct(levels, 0.5)} | ${pct(maxed, 0.5)} | ${pct(evos, 0.5)} | ${mmss(pct(full, 0.5))} |`,
      );
    }
  }
}
