import { cats, FRAMES } from '@otryad/core';
import { haptic, initTelegram, setBack, shareLink, startParam } from '../telegram.ts';
import { ApiError, connect, type Finished, type HeroInfo, type Profile, type Score, type Started } from './api.ts';
import { Game, type GameOptions, type RunRecord } from './game.ts';
import { heroSprite, sprite, type SpriteId } from './sprites.ts';
import './style.css';

const { RUN_SECONDS, TICK_RATE, cardName, cardText, isWeapon } = cats;
type CardId = cats.CardId;
type ItemId = cats.ItemId;
type HeroId = cats.HeroId;
type RoomId = cats.RoomId;
type CatRun = InstanceType<typeof cats.CatRun>;

initTelegram();

const cv = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui')!;
const api = connect();
let game: Game | null = null;
// The server's run being played, null for a run played only on this device.
let serverRun: Started['run'] | null = null;

// ---------- saved data (this device) ----------
interface Saved {
  best?: { ticks: number; kills: number; won: boolean };
  last?: { seed: number; record: RunRecord; ticks: number; kills: number; hero?: HeroId; room?: RoomId; powers?: cats.Powers };
  hero?: HeroId; // the hero picked for the next run
  room?: RoomId; // and the location
  found?: string[]; // items and evolutions met in runs, for the collection
  story?: RoomId[]; // locations whose tale has been told
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

const chosenHero = (): HeroId => {
  const id = load().hero;
  return id && cats.isHero(id) ? id : 'ryzhik';
};

const chosenRoom = (): RoomId => {
  const id = load().room;
  return id && cats.isRoom(id) ? id : 'flat';
};

// ---------- helpers ----------
const mmss = (ticks: number) => {
  const s = Math.floor(ticks / TICK_RATE);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const scoreText = (s: { won: boolean; ticks: number; kills: number }) => `${s.won ? 'выстоял' : mmss(s.ticks)} · ${s.kills} врагов`;

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

const ICONS: Record<CardId, SpriteId | string> = {
  claws: '🗡️',
  laser: 'feather',
  fish: 'arrow',
  yarn: 'charm',
  meow: '🪕',
  glass: '💧',
  pot: 'axe',
  spark: '⚡',
  belly: '🍞',
  box: '📖',
  paws: '🛡️',
  patience: '🧵',
  purr: '🍎',
  catnip: '🧲',
  bigpaws: '💪',
  pack: '🪞',
  food: '🥣',
  blackcat: '🧿',
  snack: '🍺',
  fishes: '🪙',
};

function icon(id: CardId, px = 40): HTMLElement {
  const v = ICONS[id];
  if (v === 'feather' || v === 'arrow' || v === 'charm' || v === 'axe') {
    const img = sprite(v, px * 2);
    const c = h('canvas', 'ico');
    c.width = c.height = px * 2;
    c.getContext('2d')!.drawImage(img, 0, 0);
    c.style.width = c.style.height = `${px}px`;
    return c;
  }
  return h('span', 'ico emoji', v);
}

function heroPicture(px: number, hero: HeroId = chosenHero()): HTMLCanvasElement {
  const c = h('canvas', 'hero');
  c.width = c.height = px * 2;
  c.getContext('2d')!.drawImage(heroSprite(hero, px * 2), 0, 0);
  c.style.width = c.style.height = `${px}px`;
  return c;
}

// Level squares under an icon, as in VS: one per level, filled up to `level`.
function pips(level: number, max: number): HTMLElement {
  const row = h('div', 'pips');
  for (let i = 0; i < max; i++) row.append(h('i', i < level ? 'on' : ''));
  return row;
}

// What the cat carries: a row of weapons and a row of passives, each slot
// with its level squares; empty slots show as frames.
function inventory(run: CatRun): HTMLElement {
  const box = h('div', 'inv frame');
  const row = (ids: ItemId[]) => {
    const r = h('div', 'row');
    for (let i = 0; i < cats.SLOTS; i++) {
      const k = ids[i];
      if (!k) {
        r.append(h('div', 'cell empty'));
        continue;
      }
      const evo = isWeapon(k) && run.evolved[k];
      const cell = h('div', evo ? 'cell evo' : 'cell');
      cell.append(icon(k, 30), pips(run.lvl(k), cats.itemMax(k)));
      r.append(cell);
    }
    return r;
  };
  box.append(row(run.weapons()), row(run.passives()));
  return box;
}

const pct = (x: number) => `${x > 0 ? '+' : '−'}${Math.round(Math.abs(x) * 1000) / 10}%`.replace('.', ',');

// Every stat of the cat, like the left panel of VS: a dash where nothing adds to it.
function statList(run: CatRun): HTMLElement {
  const st = run.stats;
  const list = h('div', 'statlist frame');
  const add = (name: string, value: string | null) => list.append(h('span', '', name), h('b', value ? '' : 'none', value ?? '–'));
  const gap = () => list.append(h('i', 'gap'));
  const rel = (x: number) => (Math.abs(x) > 1e-6 ? pct(x) : null);
  add('Макс. здоровье', String(Math.round(st.maxHp)));
  add('Регенерация', st.recovery.toFixed(2).replace('.', ','));
  add('Броня', st.armor ? `+${st.armor}` : null);
  add('Скорость движения', rel(st.move / cats.BASE_STATS.move - 1));
  gap();
  add('Сила', rel(st.might - 1));
  add('Скорость снарядов', rel(st.speed - 1));
  add('Продолжительность', rel(st.duration - 1));
  add('Область', rel(st.area - 1));
  gap();
  add('Перезарядка', rel(st.cooldown - 1));
  add('Боезапас', st.amount ? `+${st.amount}` : null);
  add('Девятая жизнь', run.revives ? String(run.revives) : null);
  add('Магнит', String(Math.round(st.magnet)));
  gap();
  add('Удача', rel(st.luck - 1));
  add('Рост опыта', rel(st.growth - 1));
  add('Реролл', run.rerolls ? String(run.rerolls) : null);
  return list;
}

function overlay(...children: HTMLElement[]): HTMLElement {
  const o = h('div', 'overlay');
  o.append(...children);
  return o;
}

// A sub-screen with a title, its content loaded from the server, and a way back.
function screen(title: string, fill: (box: HTMLElement) => Promise<void>): void {
  stopGame();
  setBack(() => menu());
  const body = h('div', 'panel');
  body.append(h('p', '', 'Загрузка…'));
  const box = overlay(h('h1', '', title), body, button('Назад', 'btn secondary', () => menu()));
  box.classList.add('page');
  ui.replaceChildren(box);
  fill(body).catch((e) => body.replaceChildren(h('p', 'error', errorText(e))));
}

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'Что-то пошло не так');

function table(rows: Score[] | { name: string; points: number; me: boolean }[], empty: string): HTMLElement {
  if (!rows.length) return h('p', '', empty);
  const list = h('ol', 'board');
  for (const r of rows) {
    const li = h('li', r.me ? 'me' : '');
    li.append(h('span', 'name', r.name), h('span', 'score', 'points' in r ? `${r.points} оч.` : scoreText(r)));
    list.append(li);
  }
  return list;
}

function stopGame(): void {
  game?.destroy();
  game = null;
}

function toast(text: string): void {
  const t = h('div', 'toast', text);
  ui.append(t);
  setTimeout(() => t.remove(), 3500);
}

// ---------- menu ----------
function menu(): void {
  stopGame();
  serverRun = null;
  setBack(null);
  const s = load();
  const box = overlay(
    heroPicture(110),
    h('h1', '', 'Богатыри против нечисти'),
    h('p', '', `Кощей наслал на Русь нечисть. Ведите богатыря пальцем, он бьётся сам. Собирайте самоцветы, выбирайте улучшения и продержитесь ${RUN_SECONDS / 60} минут.`),
  );
  if (s.best) box.append(h('p', 'best', `Рекорд: ${scoreText(s.best)}`));
  const hero = cats.HEROES[chosenHero()];
  const pick = h('div', 'picks');
  pick.append(
    button(`🛡️ ${hero.name}`, 'tile', () => heroScreen()),
    button(`🗺️ ${cats.ROOMS[chosenRoom()].name}`, 'tile', () => roomScreen()),
  );
  box.append(pick);
  const buttons = h('div', 'buttons');
  buttons.append(button('Начать', 'btn', () => startServer('free')));
  if (s.last) {
    const last = s.last;
    buttons.append(
      button(`Переживи себя (${mmss(last.ticks)})`, 'btn ghost', () => play(last.seed, { ghost: last.record, ghostHero: last.hero, ghostPowers: last.powers, hero: chosenHero(), room: last.room, powers: last.powers })),
    );
  }
  box.append(buttons);
  // The three of the VS title screen: collection, Power Ups, unlocks.
  const main = h('div', 'tiles three');
  main.append(button('Коллекция', 'tile', () => collectionScreen()));
  if (api) main.append(button('Усиление', 'tile green', () => powerScreen()));
  main.append(button('Открыто', 'tile', () => unlockScreen()));
  box.append(main);

  if (api) {
    const more = h('div', 'tiles');
    more.append(
      button('📅 Вызов дня', 'tile', () => dailyScreen()),
      button('🏆 Лига', 'tile', () => leagueScreen()),
      button('🪙 Злато', 'tile', () => profileScreen()),
      button('⚔️ Вызовы', 'tile', () => answersScreen()),
    );
    box.append(more);
    // Filled in when the server answers: the run to continue, the chat board.
    api.current().then((cur) => {
      if (!cur || serverRun || game) return;
      const resume = button(`Продолжить забег (${mmss(progressTicks(cur.run.progress))})`, 'btn', () => playServer(cur));
      buttons.prepend(resume);
      buttons.children[1].className = 'btn secondary';
      buttons.children[1].textContent = 'Новый забег';
    }, () => {});
    api.chat().then((top) => {
      if (top && !game) more.append(button('💬 Чат', 'tile', () => chatScreen()));
    }, () => {});
  }
  ui.replaceChildren(box);
}

const progressTicks = (rec: RunRecord | null) => (rec ? cats.decodeMoves(rec.moves).length : 0);

// ---------- the tale ----------
// Each location opens with a few frames of the tale, once; they can be
// read again from the location list. A won run ends with its epilogue.
const STORY: Record<RoomId, { title: string; frames: [string, string][]; won: string }> = {
  flat: {
    title: 'Дремучий лес',
    frames: [
      ['🏰', 'Кощей Бессмертный наслал на Русь нечисть. Опустели деревни, по дорогам стало страшно ходить.'],
      ['🛡️', 'Собрались богатыри на заставе и решили идти на Кощея, в его царство. Путь лежит через Дремучий лес.'],
      ['🧹', 'Лесную тропу стережёт Баба-Яга со своими слугами. Продержись двадцать минут, и лес тебя пропустит.'],
    ],
    won: 'Баба-Яга, побитая, указала дорогу: «Ступай на Муромскую дорогу, там Соловей-Разбойник путь стережёт». А из-за деревьев уже глядел сам Кощей.',
  },
  yard: {
    title: 'Муромская дорога',
    frames: [
      ['🛤️', 'Муромская дорога заросла травой: тридцать лет по ней никто не ездил.'],
      ['🌳', 'На девяти дубах свил гнездо Соловей-Разбойник. От его свиста гнутся деревья и падают кони, а в чаще прячется его шайка.'],
      ['⚔️', 'Пройди дорогу и заставь Соловья замолчать.'],
    ],
    won: 'Соловей связан и больше не свистит. Дорога свободна до огненной реки Смородины, а за Калиновым мостом начинается Кощеево царство.',
  },
  warehouse: {
    title: 'Кощеево царство',
    frames: [
      ['🔥', 'Через огненную реку Смородину перекинут Калинов мост. За мостом стоит чёрный замок Кощея.'],
      ['🐉', 'Мост стережёт Змей Горыныч о трёх головах, а в залах ходит костяное войско.'],
      ['🥚', 'Кощея не убить, пока его смерть спрятана: игла в яйце, яйцо в утке, утка в зайце. Но если выстоять, он отступит.'],
    ],
    won: 'Змей Горыныч повержен, замок Кощея дрогнул. Сам Кощей ушёл в тень, и смерть его ещё не найдена. Сказ на этом не кончается.',
  },
};

// Shows the tale of a location frame by frame, then goes on.
function tell(room: RoomId, then: () => void): void {
  const tale = STORY[room];
  const s = load();
  if (!s.story?.includes(room)) save({ ...s, story: [...(s.story ?? []), room] });
  let i = 0;
  const pic = h('div', 'big');
  const text = h('p', 'tale');
  const next = button('', 'btn', () => {
    i++;
    if (i < tale.frames.length) show();
    else then();
  });
  const box = overlay(h('h1', '', tale.title), pic, text, next, button('Пропустить', 'btn secondary', () => then()));
  const show = () => {
    pic.textContent = tale.frames[i][0];
    text.textContent = tale.frames[i][1];
    next.textContent = i < tale.frames.length - 1 ? 'Дальше' : 'В путь!';
  };
  show();
  ui.replaceChildren(box);
}

// The tale before the first run in a location.
function withTale(room: RoomId, go: () => void): void {
  if (load().story?.includes(room)) go();
  else tell(room, go);
}

// ---------- playing ----------
async function startServer(mode: 'free' | 'daily' | 'duel', duel?: string): Promise<void> {
  if (!api) {
    withTale(chosenRoom(), () => play((Math.random() * 2 ** 32) >>> 0, { hero: chosenHero(), room: chosenRoom() }));
    return;
  }
  try {
    playServer(await api.start(mode, chosenHero(), chosenRoom(), duel));
  } catch (e) {
    toast(errorText(e));
  }
}

function playServer(s: Started): void {
  if (!s.run.progress && !load().story?.includes(s.run.room)) {
    tell(s.run.room, () => playServer(s));
    return;
  }
  serverRun = s.run;
  play(s.run.seed, {
    ghost: s.ghost?.record,
    ghostHero: s.ghost?.hero,
    ghostPowers: s.ghost?.powers,
    progress: s.run.progress ?? undefined,
    ghostName: s.ghost?.name,
    hero: s.run.hero,
    room: s.run.room,
    powers: s.run.powers,
  });
}

function saveProgress(): void {
  if (!api || !serverRun || !game || game.run.over) return;
  api.progress(serverRun.id, game.rec.record()).catch(() => {});
}

function play(seed: number, opts: GameOptions & { ghostName?: string } = {}): void {
  stopGame();
  ui.replaceChildren(hud(opts.ghostName));
  setBack(() => pauseMenu());
  game = new Game(
    cv,
    seed,
    {
      onHud: updateHud,
      onLevelUp: levelUp,
      onEnd: (run, record) => void finish(seed, run, record, !!opts.ghost),
      onEvent: (e) => {
        if (e.t === 'hurt') haptic.hit();
        if (e.t === 'level' || e.t === 'revive') haptic.result('success');
        if (e.t === 'chest') chestScreen(e);
      },
      onCheckpoint: saveProgress,
    },
    opts,
  );
  // Handle for performance checks from the console: open with ?debug.
  if (location.search.includes('debug')) (window as unknown as { game: Game }).game = game;
}

function hud(ghostName?: string): HTMLElement {
  const top = h('div', 'hud');
  top.innerHTML = `
    <div class="bars">
      <div class="bar hp"><i></i><b></b></div>
      <div class="bar xp"><i></i><b></b></div>
    </div>
    <div class="stats"><span class="time"></span><span class="ghostline"></span><span class="kills"></span></div>
    <div class="slots"></div>`;
  if (ghostName) top.dataset.ghost = ghostName;
  top.append(button('❚❚', 'pause', () => pauseMenu()));
  return top;
}

function updateHud(run: CatRun, ghost: CatRun | null): void {
  const el = ui.querySelector<HTMLElement>('.hud');
  if (!el) return;
  const p = run.player;
  (el.querySelector('.hp i') as HTMLElement).style.width = `${(100 * p.hp) / p.maxHp}%`;
  el.querySelector('.hp b')!.textContent = `${Math.ceil(p.hp)}`;
  (el.querySelector('.xp i') as HTMLElement).style.width = `${(100 * run.xp) / run.need}%`;
  el.querySelector('.xp b')!.textContent = `ур. ${run.level}`;
  el.querySelector('.time')!.textContent = `${mmss(run.tick)} / ${mmss(RUN_SECONDS * TICK_RATE)}`;
  el.querySelector('.kills')!.textContent = `💀 ${run.kills}`;
  const who = el.dataset.ghost ?? 'призрак';
  // Owned weapons and passives with levels, redrawn only when they change.
  const slots = el.querySelector<HTMLElement>('.slots')!;
  const sig = JSON.stringify([run.items, run.evolved]);
  if (slots.dataset.sig !== sig) {
    slots.dataset.sig = sig;
    const row = (ids: ItemId[]) => {
      const r = h('div', 'row');
      for (const k of ids) {
        const evo = isWeapon(k) && run.evolved[k];
        const u = h('span', evo ? 'slot evo' : 'slot');
        u.append(icon(k, 18), h('b', '', evo ? '★' : String(run.lvl(k))));
        r.append(u);
      }
      return r;
    };
    slots.replaceChildren(row(run.weapons()), row(run.passives()));
  }
  el.querySelector('.ghostline')!.textContent = ghost ? (ghost.over ? `👻 ${who}: ${ghost.won ? 'выстоял' : mmss(ghost.tick)}` : `👻 ${who} жив`) : '';
}

function levelUp(cards: CardId[], levels: number[], choose: (i: number) => void, reroll: (() => void) | null): void {
  ui.querySelector('.overlay.level')?.remove();
  const list = h('div', 'cards');
  cards.forEach((k, i) => {
    const b = button('', 'card', () => {
      box.remove();
      choose(i);
    });
    const text = h('div', 'text');
    const head = h('div', 'head');
    const extra = k === 'snack' || k === 'fishes';
    head.append(h('b', '', cardName(k)), h('span', extra ? '' : levels[i] ? 'lv' : 'new-tag', extra ? '' : levels[i] ? `ур. ${levels[i] + 1}` : 'Новое!'));
    text.append(head, h('span', '', cardText(k, levels[i])));
    b.append(icon(k), text);
    list.append(b);
  });
  const box = overlay(h('h1', '', 'Новый уровень!'));
  if (game) box.append(inventory(game.run));
  box.append(list);
  if (cards.length < 4) box.append(h('p', 'luckhint', 'Увеличьте удачу ради шанса получить 4 варианта.'));
  if (reroll) box.append(button('🎲 Другие карточки', 'btn secondary reroll', () => reroll()));
  box.classList.add('level');
  ui.append(box);
}

// A chest opens on its own screen, as in VS: it shakes, bursts, and what it
// held comes out one item at a time. The run waits until it is closed.
function chestScreen(e: { evolved: cats.WeaponId[]; items: ItemId[] }): void {
  if (!game) return;
  const g = game;
  g.setPaused(true);
  const stage = h('div', 'stage');
  const chest = h('div', 'chest', '🧰');
  stage.append(chest);
  const loot = h('div', 'loot');
  const done = button('Готово', 'btn', () => {
    box.remove();
    if (game === g && !ui.querySelector('.overlay.pausebox')) g.setPaused(false);
  });
  done.style.visibility = 'hidden';
  const inner = h('div', 'chestbox frame');
  inner.append(h('h1', '', 'Сундук'), stage, loot, done);
  const box = overlay(inner);
  box.classList.add('chest');
  ui.append(box);
  const rows: HTMLElement[] = [];
  for (const w of e.evolved) {
    const r = h('div');
    r.append(icon(w, 30), h('b', '', `★ ${cats.EVOLUTIONS[w].name}`), h('span', 'lv', 'эволюция!'));
    rows.push(r);
  }
  for (const k of e.items) {
    const r = h('div');
    r.append(icon(k, 30), h('b', '', cardName(k)), h('span', 'lv', `ур. ${g.run.lvl(k)}`));
    rows.push(r);
  }
  if (!rows.length) rows.push(h('div', '', '+10 🪙'));
  setTimeout(() => {
    chest.classList.add('open');
    chest.textContent = '✨';
    stage.prepend(h('div', 'rays'));
    rows.forEach((r, i) => setTimeout(() => loot.append(r), 250 + i * 350));
    setTimeout(() => (done.style.visibility = 'visible'), 250 + rows.length * 350);
  }, 1000);
}

// Which weapons evolve with which passive, and how far each pair is.
function evolutionList(run: CatRun): HTMLElement {
  const list = h('div', 'evos frame');
  list.append(h('b', '', 'Эволюции'));
  for (const w of run.weapons()) {
    const evo = cats.EVOLUTIONS[w];
    const has = run.lvl(evo.passive) > 0;
    const status = run.evolved[w]
      ? '★ готово'
      : run.lvl(w) >= cats.WEAPON_MAX && has
        ? 'ждёт сундук'
        : `ур. ${run.lvl(w)}/8${has ? '' : `, нужна «${cats.PASSIVES[evo.passive].name}»`}`;
    list.append(h('span', run.evolved[w] ? 'done' : '', `${cats.WEAPONS[w].name} → ${evo.name}: ${status}`));
  }
  return list;
}

// What each weapon has done this run, like the VS pause screen: level,
// damage, how long the cat has had it and damage per second.
function damageTable(run: CatRun): HTMLElement {
  const table = h('div', 'dmg frame');
  table.append(h('b', 'head', 'Оружие'), h('b', 'head', 'ур.'), h('b', 'head', 'урон'), h('b', 'head', 'время'), h('b', 'head', 'в сек.'));
  const rows = run.weapons().sort((a, b) => (run.damage[b] ?? 0) - (run.damage[a] ?? 0));
  for (const w of rows) {
    const dmg = Math.round(run.damage[w] ?? 0);
    const held = Math.max(1, run.tick - (run.since[w] ?? 0));
    const name = h('span', 'name');
    name.append(icon(w, 20), h('span', '', run.evolved[w] ? cats.EVOLUTIONS[w].name : cats.WEAPONS[w].name));
    table.append(
      name,
      h('span', '', run.evolved[w] ? '★' : String(run.lvl(w))),
      h('span', '', dmg.toLocaleString('ru-RU')),
      h('span', '', mmss(held)),
      h('span', '', ((dmg * TICK_RATE) / held).toFixed(1)),
    );
  }
  return table;
}

// Remembers what this run met, so the collection can mark it.
function remember(run: CatRun): void {
  const s = load();
  const found = new Set(s.found ?? []);
  for (const k of Object.keys(run.items)) found.add(k);
  for (const w of Object.keys(run.evolved)) found.add(`evo:${w}`);
  s.found = [...found];
  save(s);
}

// Every weapon, evolution and passive, like the VS collection: a grid where
// what this device has not met yet is a question mark, and a panel about the
// one picked.
function collectionScreen(): void {
  stopGame();
  setBack(() => menu());
  const found = new Set(load().found ?? []);
  type Entry = { key: string; icon: () => HTMLElement; name: string; text: string; hint: string };
  const entries: Entry[] = [];
  for (const w of cats.WEAPON_IDS) {
    const def = cats.WEAPONS[w];
    const b = def.base;
    entries.push({ key: w, icon: () => icon(w, 30), name: def.name, text: def.desc[0], hint: `Урон ${b.dmg} · перезарядка ${b.cd} с · снарядов ${b.amount}` });
  }
  for (const w of cats.WEAPON_IDS) {
    const evo = cats.EVOLUTIONS[w];
    entries.push({ key: `evo:${w}`, icon: () => icon(w, 30), name: `★ ${evo.name}`, text: evo.desc, hint: `Нужно: ${cats.WEAPONS[w].name} ур. ${cats.WEAPON_MAX} + ${cats.PASSIVES[evo.passive].name}, сундук после ${Math.floor(cats.EVOLVE_TICK / cats.TICK_RATE / 60)}:00` });
  }
  for (const id of cats.PASSIVE_IDS) {
    const def = cats.PASSIVES[id];
    const evolves = cats.WEAPON_IDS.filter((w) => cats.EVOLUTIONS[w].passive === id);
    entries.push({ key: id, icon: () => icon(id, 30), name: def.name, text: `${def.desc}, до ${def.max} уровня`, hint: evolves.length ? `Нужна для: ${evolves.map((w) => cats.EVOLUTIONS[w].name).join(', ')}` : '' });
  }
  const got = entries.filter((e) => found.has(e.key)).length;
  const detail = h('div', 'detail frame');
  const show = (e: Entry) => {
    const text = h('div', 'text');
    if (found.has(e.key)) {
      text.append(h('b', '', e.name), h('span', '', e.text));
      if (e.hint) text.append(h('span', 'hint', e.hint));
      detail.replaceChildren(e.icon(), text);
    } else {
      text.append(h('b', '', '???'), h('span', '', 'Ещё не найдено. Возьмите это в забеге, и здесь появится описание.'));
      if (e.key.startsWith('evo:')) text.append(h('span', 'hint', e.hint));
      detail.replaceChildren(text);
    }
  };
  const grid = h('div', 'grid small');
  for (const e of entries) {
    const known = found.has(e.key);
    const cls = `cellbtn${known ? '' : ' unknown'}${e.key.startsWith('evo:') ? ' evo' : ''}`;
    const cell = button('', cls, () => {
      grid.querySelector('.on')?.classList.remove('on');
      cell.classList.add('on');
      show(e);
    });
    if (known) cell.append(e.icon());
    else cell.append(h('span', 'q', '?'));
    grid.append(cell);
  }
  const body = h('div', 'panel frame');
  body.style.padding = '10px';
  body.append(h('div', 'counter', `Собрано: ${got} из ${entries.length}`), grid);
  (grid.firstElementChild as HTMLButtonElement).click();
  const box = overlay(h('h1', '', 'Коллекция'), body, detail, button('Назад', 'btn secondary', () => menu()));
  box.classList.add('page');
  ui.replaceChildren(box);
}

function pauseMenu(): void {
  if (!game || game.run.over || ui.querySelector('.overlay.pausebox')) return;
  game.setPaused(true);
  saveProgress();
  const run = game.run;
  const buttons = h('div', 'buttons');
  buttons.append(
    button('Продолжить', 'btn', () => {
      box.remove();
      if (!ui.querySelector('.overlay.chest')) game?.setPaused(false);
    }),
    button('Выйти в меню', 'btn secondary', () => menu()),
  );
  const box = overlay(h('h1', '', 'Пауза'), inventory(run), statList(run), buttons);
  box.classList.add('pausebox', 'page');
  if (serverRun) box.append(h('p', '', 'Забег сохранён, его можно продолжить позже.'));
  box.append(damageTable(run), evolutionList(run));
  ui.append(box);
}

async function finish(seed: number, run: CatRun, record: RunRecord, vsGhost: boolean): Promise<void> {
  haptic.result(run.won ? 'success' : 'error');
  const s = load();
  const mine = { won: run.won, ticks: run.tick, kills: run.kills };
  const better = !s.best || cats.compareScores(mine, s.best) < 0;
  if (better) s.best = mine;
  s.last = { seed, record, ticks: run.tick, kills: run.kills, hero: run.hero, room: run.room, powers: run.powers };
  save(s);
  remember(run);

  const playedRun = serverRun;
  let server: Finished | null = null;
  let error = '';
  if (api && playedRun) {
    try {
      server = await api.finish(playedRun.id, record);
    } catch (e) {
      error = errorText(e);
    }
  }

  const ghost = game?.ghost?.run;
  let vs = '';
  if (server?.duel) {
    vs = server.duel.beat ? `Ты продержался лучше, чем ${server.duel.challengerName}!` : `${server.duel.challengerName} продержался лучше`;
  } else if (vsGhost && ghost) {
    const ghostTicks = ghost.over ? ghost.tick : Infinity;
    vs = run.tick > ghostTicks || (run.won && !ghost.won) ? 'Ты пережил призрака!' : run.won && ghost.won ? 'Оба выстояли' : 'Призрак продержался дольше';
  }
  const ups = h('div', 'ups');
  for (const k of run.passives()) {
    const l = run.lvl(k);
    const u = h('span', 'up');
    u.append(icon(k, 26), h('b', '', String(l)));
    ups.append(u);
  }
  const box = overlay(
    run.won ? heroPicture(100, run.hero) : h('div', 'big', '💀'),
    h('h1', '', run.won ? `${cats.HEROES[run.hero].name} выстоял!` : 'Нечисть одолела'),
    h('p', 'result', `${mmss(run.tick)} · ${run.kills} врагов · уровень ${run.level}`),
    ...(run.tick > RUN_SECONDS * TICK_RATE ? [h('p', 'best', `От Кощея ${Math.floor((run.tick - RUN_SECONDS * TICK_RATE) / TICK_RATE)} с`)] : []),
  );
  if (vs) box.append(h('p', 'vs', vs));
  if (run.won) box.append(h('p', 'tale', STORY[run.room].won));
  if (server) box.append(h('p', 'best', `+${server.result.points} очков лиги${server.result.fish ? ` · +${server.result.fish} 🪙` : ''}`));
  if (server?.daily?.rank) box.append(h('p', 'best', `Вызов дня: ${server.daily.rank} место`));
  else if (better) box.append(h('p', 'best', 'Новый рекорд!'));
  if (error) box.append(h('p', 'error', error));
  box.append(damageTable(run), ups);
  const buttons = h('div', 'buttons');
  if (server && playedRun && api) {
    buttons.append(
      button('Вызвать друга', 'btn ghost', async () => {
        try {
          const { link } = await api.share(playedRun.id);
          if (link) shareLink(link, `Я продержался ${scoreText(mine)} в «Богатырях против нечисти». Переживёшь меня?`);
          else toast('Ссылка для друзей пока не настроена');
        } catch (e) {
          toast(errorText(e));
        }
      }),
    );
  }
  buttons.append(
    button('Ещё раз', 'btn', () => startServer('free')),
    button('В меню', 'btn secondary', () => menu()),
  );
  box.append(buttons);
  ui.append(box);
}

// ---------- heroes ----------
// Every hero with its weapon, stats and bonus; the locked ones show how to open them.
function heroScreen(): void {
  screen('Богатыри', async (box) => {
    const render = (list: HeroInfo[], fish: number | null) => {
      box.replaceChildren(h('p', '', 'У каждого героя своё первое оружие и бонус, который растёт с уровнем. В дуэли каждый играет своим героем.'));
      if (fish !== null) box.append(h('p', 'best', `🪙 ${fish}`));
      const chosen = chosenHero();
      for (const info of list) {
        const def: cats.HeroDef = cats.HEROES[info.id];
        const card = h('div', `herocard${info.id === chosen ? ' on' : ''}`);
        const text = h('div', 'text');
        const hp = def.stats.maxHp ?? cats.BASE_STATS.maxHp;
        const speed = Math.round((100 * (def.stats.move ?? cats.BASE_STATS.move)) / cats.BASE_STATS.move);
        text.append(
          h('b', '', `${def.name}, ${def.title}`),
          h('span', '', `${cats.WEAPONS[def.weapon].name} · ❤ ${hp} · скорость ${speed}%`),
          h('span', '', def.bonus),
        );
        card.append(heroPicture(56, info.id), text);
        if (info.id === chosen) card.append(h('span', 'lv', 'выбран'));
        else if (info.owned) {
          card.append(
            button('Выбрать', 'btn small', () => {
              save({ ...load(), hero: info.id });
              render(list, fish);
            }),
          );
        } else {
          const u: cats.HeroDef['unlock'] = def.unlock;
          if (u && 'fish' in u) {
            const b = button(`${u.fish} 🪙`, 'btn small', async () => {
              try {
                const p = await api!.shop('buy', `hero:${info.id}`);
                save({ ...load(), hero: info.id });
                render(p.heroes, p.fish);
              } catch (e) {
                toast(errorText(e));
              }
            });
            b.disabled = !api || info.have < info.need;
            card.append(b);
          } else card.append(h('span', 'lv', `🔒 ${cats.unlockText(info.id)}: ${info.have}/${info.need}`));
        }
        box.append(card);
      }
    };
    if (!api) {
      // Without the server every hero can be tried on this device.
      render(cats.HERO_IDS.map((id) => ({ id, owned: true, have: 0, need: 0 })), null);
      return;
    }
    const p = await api.profile();
    render(p.heroes, p.fish);
  });
}

// ---------- Power Ups ----------
// Permanent bonuses for gold (fish in the code), as in VS: a grid of cells with their rank
// squares, a panel about the one picked with its price, and a reset that
// gives all the gold back. Every level bought makes the next ones dearer.
const POWER_ICONS: Record<cats.PowerId, string> = {
  might: '🥣',
  armor: '🛡️',
  maxHp: '🍞',
  recovery: '🍎',
  move: '👟',
  area: '💪',
  cooldown: '📖',
  magnet: '🧲',
  luck: '🍀',
  growth: '👑',
  greed: '🪙',
  reroll: '🎲',
  revive: '💨',
};

function powerScreen(): void {
  let picked: cats.PowerId = 'might';
  screen('Усиления', async (box) => {
    const render = (p: Profile) => {
      const reset = button(`Сброс усилений${p.powerSpent ? ` (+${p.powerSpent} 🪙)` : ''}`, 'btn', async () => {
        try {
          render(await api!.refund());
        } catch (e) {
          toast(errorText(e));
        }
      });
      reset.disabled = p.powerSpent <= 0;
      const grid = h('div', 'grid');
      const detail = h('div', 'detail frame');
      const show = (id: cats.PowerId) => {
        const def: cats.PowerDef = cats.POWERS[id];
        const lvl = p.powers[id] ?? 0;
        const text = h('div', 'text');
        text.append(h('b', '', def.name), h('span', '', `${def.desc} за ранг (макс. ${def.max}).`));
        const buy = h('div', 'buy');
        if (lvl >= def.max) buy.append(h('span', '', 'Максимум'));
        else {
          const price = cats.powerPrice(id, p.powers);
          const b = button('Купить', 'btn green small', async () => {
            try {
              render(await api!.shop('buy', `power:${id}`));
            } catch (e) {
              toast(errorText(e));
            }
          });
          b.disabled = p.fish < price;
          buy.append(h('span', '', `${price} 🪙`), b);
        }
        const ic = h('span', 'ico emoji', POWER_ICONS[id]);
        detail.replaceChildren(ic, text, buy);
      };
      for (const id of cats.POWER_IDS) {
        const def: cats.PowerDef = cats.POWERS[id];
        const cell = button('', `cellbtn${id === picked ? ' on' : ''}`, () => {
          picked = id;
          grid.querySelector('.on')?.classList.remove('on');
          cell.classList.add('on');
          show(id);
        });
        cell.append(h('span', 'name', def.name), h('span', 'ico emoji', POWER_ICONS[id]), pips(p.powers[id] ?? 0, def.max));
        grid.append(cell);
      }
      show(picked);
      const panel = h('div', 'panel frame');
      panel.style.padding = '10px';
      panel.append(h('div', 'counter', `🪙 ${p.fish}`), reset, grid);
      box.replaceChildren(panel, detail);
    };
    render(await api!.profile());
  });
}

// What opens what, like the VS «Открыто» list: every cat and room with the
// condition that opens it, ticked once it is open.
function unlockScreen(): void {
  screen('Открыто', async (box) => {
    const p = api ? await api.profile() : null;
    const rows: { done: boolean; what: string; icon: () => HTMLElement; detail: string }[] = [];
    for (const id of cats.HERO_IDS) {
      const def: cats.HeroDef = cats.HEROES[id];
      const info = p?.heroes.find((x) => x.id === id);
      const u: cats.HeroDef['unlock'] = def.unlock;
      if (!u) continue;
      const text = cats.unlockText(id);
      const cond = 'fish' in u ? `Купите за ${u.fish} 🪙` : `${text[0].toUpperCase()}${text.slice(1)}${info ? `: ${info.have}/${info.need}` : ''}`;
      rows.push({ done: !!info?.owned, what: cond, icon: () => heroPicture(28, id), detail: `Открывает героя: ${def.name}` });
    }
    for (const id of cats.ROOM_IDS) {
      const def = cats.ROOMS[id];
      if (!def.after) continue;
      const done = !!p?.rooms.find((r) => r.id === id)?.owned;
      rows.push({ done, what: `Продержитесь 20 минут: «${cats.ROOMS[def.after].name}»`, icon: () => h('span', 'ico emoji', '🗺️'), detail: `Открывает локацию: ${def.name}` });
    }
    const detail = h('div', 'detail frame');
    const list = h('ul', 'unlocks');
    for (const r of rows) {
      const li = h('li', r.done ? 'done' : '');
      li.append(h('span', 'box', r.done ? '✓' : ''), h('span', 'what', r.what), r.icon());
      li.onclick = () => {
        const text = h('div', 'text');
        text.append(h('b', '', r.what), h('span', 'hint', r.detail));
        detail.replaceChildren(r.icon(), text);
      };
      list.append(li);
    }
    const panel = h('div', 'panel frame');
    panel.style.padding = '10px';
    panel.append(h('div', 'counter', `Открыто: ${rows.filter((r) => r.done).length} из ${rows.length}`), list);
    box.replaceChildren(panel, detail);
    (list.firstElementChild as HTMLElement | null)?.click();
  });
}

// ---------- locations ----------
function roomScreen(): void {
  screen('Путь к Кощею', async (box) => {
    const render = (list: { id: RoomId; owned: boolean }[]) => {
      box.replaceChildren(h('p', '', 'Каждая следующая локация открывается, когда вы продержались 20 минут в предыдущей.'));
      const chosen = chosenRoom();
      for (const info of list) {
        const def = cats.ROOMS[info.id];
        const card = h('div', `herocard${info.id === chosen ? ' on' : ''}`);
        const text = h('div', 'text');
        const enemies = [...new Set(def.waves.flatMap((w) => w.kinds))].slice(0, 4);
        text.append(
          h('b', '', def.name),
          h('span', '', `Враги: ${enemies.map((k) => cats.ENEMIES[k].name).join(', ')}`),
          h('span', '', `Босс: ${cats.ENEMIES[def.boss].name}`),
        );
        const tale = h('a', 'tale-link', 'Сказ');
        tale.onclick = () => tell(info.id, () => roomScreen());
        text.append(tale);
        card.append(text);
        if (info.id === chosen) card.append(h('span', 'lv', 'выбрана'));
        else if (info.owned) {
          card.append(
            button('Выбрать', 'btn small', () => {
              save({ ...load(), room: info.id });
              render(list);
            }),
          );
        } else card.append(h('span', 'lv', `🔒 пройти «${cats.ROOMS[def.after!].name}»`));
        box.append(card);
      }
    };
    if (!api) {
      render(cats.ROOM_IDS.map((id) => ({ id, owned: true })));
      return;
    }
    render((await api.profile()).rooms);
  });
}

// ---------- server screens ----------
function dailyScreen(): void {
  screen('Вызов дня', async (box) => {
    const d = await api!.daily();
    box.replaceChildren(h('p', '', `Одна попытка в день, у всех одна и та же карта: сегодня «${cats.ROOMS[d.room].name}», даже если она у вас ещё закрыта. Вы играете против призрака лидера.`));
    if (d.rank) box.append(h('p', 'best', `Ваше место: ${d.rank}`));
    box.append(table(d.top, 'Сегодня ещё никто не сыграл. Будьте первым!'));
    if (d.status !== 'finished') box.append(button(d.status === 'active' ? 'Продолжить попытку' : 'Сыграть', 'btn', () => startServer('daily')));
  });
}

const LEAGUES = ['Бронзовая', 'Серебряная', 'Золотая', 'Алмазная'];

function leagueScreen(): void {
  screen('Лига недели', async (box) => {
    const l = await api!.league();
    const ends = new Date(l.endsAt).toLocaleDateString('ru-RU', { weekday: 'long' });
    box.replaceChildren(
      h('p', 'best', `${LEAGUES[l.league]} лига${l.moved > 0 ? ' ⬆️' : l.moved < 0 ? ' ⬇️' : ''}`),
      h('p', '', `${l.points} очков · место ${l.rank ?? '—'} из ${l.size}. Очки дают первые ${l.runsPerDay} забега в день (сегодня ${l.runsToday}). Неделя закончится в ${ends}: первые ${l.up} поднимутся${l.down ? `, последние ${l.down} опустятся` : ''}.`),
      table(l.top, 'В лиге пока никого нет.'),
    );
  });
}

function profileScreen(): void {
  api?.track('open_store');
  screen('Злато и ауры', async (box) => {
    const render = (p: Profile) => {
      box.replaceChildren(h('p', 'best', `🪙 ${p.fish}`));
      const tasks = h('ul', 'tasks');
      for (const t of p.tasks) {
        tasks.append(h('li', t.done ? 'done' : '', `${t.done ? '✅' : '▫️'} ${t.title}: ${t.progress}/${t.goal} · ${t.reward} 🪙`));
      }
      box.append(h('h2', '', 'Задания дня'), tasks);
      const s = p.season;
      box.append(h('h2', '', 'Сезон'), h('p', '', `Уровень ${s.level} из ${s.rewards.length}: ${s.points} очков, уровень каждые ${s.perLevel}. Последняя награда: аура «Корона сезона».`));
      box.append(h('h2', '', 'Ауры'), h('p', '', 'Цветное кольцо под героем. Друзья видят его у вашего призрака.'));
      const shop = h('div', 'shop');
      for (const f of FRAMES) {
        const owned = p.owned.includes(f.id);
        const worn = p.frame === f.id;
        const label = worn ? `${f.name}: снять` : owned ? `${f.name}: надеть` : f.exclusive ? `${f.name}: только в сезоне` : `${f.name}: ${f.price} 🪙`;
        const b = button(label, `item aura-${f.id}${worn ? ' on' : ''}`, async () => {
          try {
            render(await api!.shop(owned ? 'equip' : 'buy', worn ? null : f.id));
          } catch (e) {
            toast(errorText(e));
          }
        });
        b.disabled = !owned && !!f.exclusive;
        shop.append(b);
      }
      box.append(shop);
    };
    render(await api!.profile());
  });
}

function chatScreen(): void {
  screen('Рейтинг чата', async (box) => {
    const top = (await api!.chat()) ?? [];
    box.replaceChildren(h('p', '', 'Лучшие забеги недели среди игроков этого чата.'), table(top, 'Пока никто не сыграл.'));
  });
}

function answersScreen(): void {
  screen('Ваши вызовы', async (box) => {
    const list = await api!.answers();
    box.replaceChildren(h('p', '', 'После забега нажмите «Вызвать друга», и здесь появятся ответы.'));
    if (!list.length) return;
    const ul = h('ul', 'tasks');
    for (const a of list) {
      ul.append(h('li', a.isNew ? 'new' : '', `${a.beat ? '😤' : '💪'} ${a.userName}: ${scoreText(a)} · ${a.beat ? 'продержался лучше вас' : 'вы лучше'}`));
    }
    box.append(ul);
  });
}

function duelScreen(code: string): void {
  screen('Вызов', async (box) => {
    const d = await api!.duel(code);
    if (d.mine) {
      box.replaceChildren(h('p', '', 'Это ваш собственный вызов: отправьте ссылку друзьям.'));
      return;
    }
    box.replaceChildren(
      h('p', 'best', `${d.challengerName} бросил вам вызов`),
      h('p', '', `Результат: ${scoreText(d)}. Вы сыграете на той же карте рядом с его призраком.`),
      button('Принять вызов', 'btn', () => startServer('duel', code)),
    );
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseMenu();
});

{
  const param = startParam();
  if (api && param.startsWith('d_')) duelScreen(param.slice(2));
  else menu();
}
