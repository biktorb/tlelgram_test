import { cats } from '@otryad/core';
import { haptic, initTelegram, setBack } from '../telegram.ts';
import { Game, type RunRecord } from './game.ts';
import { loadSprites, sprite, type SpriteId } from './sprites.ts';
import './style.css';

const { RUN_SECONDS, TICK_RATE, UPGRADES } = cats;
type UpgradeId = cats.UpgradeId;
type CatRun = InstanceType<typeof cats.CatRun>;

initTelegram();

const cv = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui')!;
let game: Game | null = null;

// ---------- saved data (this device only until the server takes over) ----------
interface Saved {
  best?: { ticks: number; kills: number; won: boolean };
  last?: { seed: number; record: RunRecord; ticks: number; kills: number };
}
function load(): Saved {
  try {
    return JSON.parse(localStorage.getItem('cats') ?? '{}') as Saved;
  } catch {
    return {};
  }
}
function save(s: Saved): void {
  try {
    localStorage.setItem('cats', JSON.stringify(s));
  } catch {
    // Private mode: the run just is not remembered.
  }
}

// ---------- helpers ----------
const mmss = (ticks: number) => {
  const s = Math.floor(ticks / TICK_RATE);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}

function button(text: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = h('button', cls, text);
  b.onclick = () => {
    haptic.tap();
    onClick();
  };
  return b;
}

const ICONS: Record<UpgradeId, SpriteId | string> = {
  fish: 'fish',
  yarn: 'yarn',
  meow: '📣',
  laser: '🔴',
  speed: '👟',
  heart: '🍗',
  magnet: '🧲',
  power: '💪',
};

function icon(id: UpgradeId, px = 40): HTMLElement {
  const v = ICONS[id];
  if (v === 'fish' || v === 'yarn') {
    const img = sprite(v, px * 2);
    const c = h('canvas', 'ico');
    c.width = c.height = px * 2;
    c.getContext('2d')!.drawImage(img, 0, 0);
    c.style.width = c.style.height = `${px}px`;
    return c;
  }
  return h('span', 'ico emoji', v);
}

function catPicture(px: number): HTMLCanvasElement {
  const c = h('canvas', 'hero');
  c.width = c.height = px * 2;
  c.getContext('2d')!.drawImage(sprite('cat', px * 2), 0, 0);
  c.style.width = c.style.height = `${px}px`;
  return c;
}

function overlay(...children: HTMLElement[]): HTMLElement {
  const o = h('div', 'overlay');
  o.append(...children);
  return o;
}

// ---------- screens ----------
function menu(): void {
  game?.destroy();
  game = null;
  setBack(null);
  const s = load();
  const box = overlay(
    catPicture(120),
    h('h1', '', 'Коты против пылесосов'),
    h('p', '', 'Ведите кота пальцем, он атакует сам. Собирайте кристаллы, выбирайте улучшения и продержитесь 5 минут.'),
  );
  if (s.best) box.append(h('p', 'best', `Рекорд: ${s.best.won ? 'победа' : mmss(s.best.ticks)} · ${s.best.kills} врагов`));
  const buttons = h('div', 'buttons');
  buttons.append(button('Играть', 'btn', () => start()));
  if (s.last) {
    const last = s.last;
    buttons.append(button(`Переживи себя (${mmss(last.ticks)})`, 'btn ghost', () => start(last.seed, last.record)));
  }
  box.append(buttons);
  const credit = h('a', 'credit', 'Кот, пёс и мышь: Olga Bikmullina, CC-BY 3.0');
  credit.href = 'https://opengameart.org/content/animals-pack';
  credit.target = '_blank';
  credit.rel = 'noopener';
  box.append(credit);
  ui.replaceChildren(box);
}

function hud(): HTMLElement {
  const top = h('div', 'hud');
  top.innerHTML = `
    <div class="bars">
      <div class="bar hp"><i></i><b></b></div>
      <div class="bar xp"><i></i><b></b></div>
    </div>
    <div class="stats"><span class="time"></span><span class="ghostline"></span><span class="kills"></span></div>`;
  const pause = button('❚❚', 'pause', () => pauseMenu());
  top.append(pause);
  return top;
}

function updateHud(run: CatRun, ghost: CatRun | null): void {
  const el = ui.querySelector('.hud');
  if (!el) return;
  const p = run.player;
  (el.querySelector('.hp i') as HTMLElement).style.width = `${(100 * p.hp) / p.maxHp}%`;
  el.querySelector('.hp b')!.textContent = `${Math.ceil(p.hp)}`;
  (el.querySelector('.xp i') as HTMLElement).style.width = `${(100 * run.xp) / run.need}%`;
  el.querySelector('.xp b')!.textContent = `ур. ${run.level}`;
  el.querySelector('.time')!.textContent = `${mmss(run.tick)} / ${mmss(RUN_SECONDS * TICK_RATE)}`;
  el.querySelector('.kills')!.textContent = `💀 ${run.kills}`;
  el.querySelector('.ghostline')!.textContent = ghost ? (ghost.over ? `👻 ${ghost.won ? 'выстоял' : mmss(ghost.tick)}` : '👻 жив') : '';
}

function start(seed = (Math.random() * 2 ** 32) >>> 0, ghost?: RunRecord): void {
  game?.destroy();
  ui.replaceChildren(hud());
  setBack(() => pauseMenu());
  game = new Game(
    cv,
    seed,
    {
      onHud: updateHud,
      onLevelUp: levelUp,
      onEnd: (run, record) => finish(seed, run, record, !!ghost),
      onEvent: (e) => {
        if (e.t === 'hurt') haptic.hit();
        if (e.t === 'level') haptic.result('success');
      },
    },
    ghost,
  );
  // Handle for performance checks from the console: open with ?debug.
  if (location.search.includes('debug')) (window as unknown as { game: Game }).game = game;
}

function levelUp(cards: UpgradeId[], levels: number[], choose: (i: number) => void): void {
  const list = h('div', 'cards');
  cards.forEach((k, i) => {
    const u = UPGRADES[k];
    const b = button('', 'card', () => {
      box.remove();
      choose(i);
    });
    const text = h('div', 'text');
    text.append(h('b', '', u.name), h('span', '', u.desc(levels[i])));
    b.append(icon(k), text, h('span', 'lv', levels[i] ? `ур. ${levels[i] + 1}` : 'новое'));
    list.append(b);
  });
  const box = overlay(h('h1', '', 'Новый уровень!'), list);
  box.classList.add('level');
  ui.append(box);
}

function pauseMenu(): void {
  if (!game || game.run.over || ui.querySelector('.overlay')) return;
  game.setPaused(true);
  const box = overlay(
    h('h1', '', 'Пауза'),
    button('Продолжить', 'btn', () => {
      box.remove();
      game?.setPaused(false);
    }),
    button('Выйти в меню', 'btn secondary', () => menu()),
  );
  ui.append(box);
}

function finish(seed: number, run: CatRun, record: RunRecord, vsGhost: boolean): void {
  haptic.result(run.won ? 'success' : 'error');
  const s = load();
  const better = !s.best || Number(run.won) > Number(s.best.won) || (run.won === s.best.won && (run.tick > s.best.ticks || (run.tick === s.best.ticks && run.kills > s.best.kills)));
  if (better) s.best = { ticks: run.tick, kills: run.kills, won: run.won };
  s.last = { seed, record, ticks: run.tick, kills: run.kills };
  save(s);

  const ghost = game?.ghost?.run;
  let vs = '';
  if (vsGhost && ghost) {
    const ghostTicks = ghost.over ? ghost.tick : Infinity;
    vs = run.tick > ghostTicks || (run.won && !ghost.won) ? 'Ты пережил призрака!' : run.won && ghost.won ? 'Оба выстояли' : 'Призрак продержался дольше';
  }
  const ups = h('div', 'ups');
  for (const [k, l] of Object.entries(run.up) as [UpgradeId, number][]) {
    const u = h('span', 'up');
    u.append(icon(k, 26), h('b', '', String(l)));
    ups.append(u);
  }
  const box = overlay(
    run.won ? catPicture(110) : h('div', 'big', '😿'),
    h('h1', '', run.won ? 'Кот выстоял!' : 'Кота засосало'),
    h('p', 'result', `${mmss(run.tick)} · ${run.kills} врагов · уровень ${run.level}`),
  );
  if (vs) box.append(h('p', 'vs', vs));
  if (better) box.append(h('p', 'best', 'Новый рекорд!'));
  box.append(ups);
  const buttons = h('div', 'buttons');
  buttons.append(
    button('Ещё раз', 'btn', () => start()),
    button('Переживи этот забег', 'btn ghost', () => start(seed, record)),
    button('В меню', 'btn secondary', () => menu()),
  );
  box.append(buttons);
  ui.append(box);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseMenu();
});

void loadSprites().then(menu);
