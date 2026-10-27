import { cats, FRAMES } from '@otryad/core';
import { haptic, initTelegram, setBack, shareLink, startParam } from '../telegram.ts';
import { ApiError, connect, type Finished, type HeroInfo, type Profile, type Score, type Started } from './api.ts';
import { Game, type GameOptions, type RunRecord } from './game.ts';
import { catSprite, loadSprites, sprite, type SpriteId } from './sprites.ts';
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
  hero?: HeroId; // the cat picked for the next run
  room?: RoomId; // and the room
  found?: string[]; // items and evolutions met in runs, for the collection
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
  claws: '🐾',
  laser: '🔴',
  fish: 'fish',
  yarn: 'yarn',
  meow: '📣',
  glass: '🥛',
  pot: '🪴',
  spark: '⚡',
  belly: '🍗',
  box: '📦',
  paws: '🧤',
  patience: '⏳',
  purr: '💤',
  catnip: '🌿',
  bigpaws: '🦶',
  pack: '🐈',
  food: '🥫',
  blackcat: '🐈‍⬛',
  snack: '🥪',
  fishes: '🐟',
};

function icon(id: CardId, px = 40): HTMLElement {
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

function catPicture(px: number, hero: HeroId = chosenHero()): HTMLCanvasElement {
  const c = h('canvas', 'hero');
  c.width = c.height = px * 2;
  c.getContext('2d')!.drawImage(catSprite(hero, px * 2), 0, 0);
  c.style.width = c.style.height = `${px}px`;
  return c;
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
    catPicture(110),
    h('h1', '', 'Коты против пылесосов'),
    h('p', '', `Ведите кота пальцем, он атакует сам. Собирайте кристаллы, выбирайте улучшения и продержитесь ${RUN_SECONDS / 60} минут.`),
  );
  if (s.best) box.append(h('p', 'best', `Рекорд: ${scoreText(s.best)}`));
  const hero = cats.HEROES[chosenHero()];
  const pick = h('div', 'picks');
  pick.append(
    button(`🐱 ${hero.name}`, 'btn secondary small', () => heroScreen()),
    button(`🏠 ${cats.ROOMS[chosenRoom()].name}`, 'btn secondary small', () => roomScreen()),
    button('📖 Коллекция', 'btn secondary small', () => collectionScreen()),
  );
  box.append(pick);
  const buttons = h('div', 'buttons');
  buttons.append(button('Играть', 'btn', () => startServer('free')));
  if (s.last) {
    const last = s.last;
    buttons.append(
      button(`Переживи себя (${mmss(last.ticks)})`, 'btn ghost', () => play(last.seed, { ghost: last.record, ghostHero: last.hero, ghostPowers: last.powers, hero: chosenHero(), room: last.room, powers: last.powers })),
    );
  }
  box.append(buttons);

  if (api) {
    const more = h('div', 'tiles');
    more.append(
      button('📅 Вызов дня', 'tile', () => dailyScreen()),
      button('🏆 Лига', 'tile', () => leagueScreen()),
      button('🐟 Рыба', 'tile', () => profileScreen()),
      button('⚡ Прокачка', 'tile', () => powerScreen()),
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

  const credit = h('a', 'credit', 'Кот, пёс и мышь: Olga Bikmullina, CC-BY 3.0');
  credit.href = 'https://opengameart.org/content/animals-pack';
  credit.target = '_blank';
  credit.rel = 'noopener';
  box.append(credit);
  ui.replaceChildren(box);
}

const progressTicks = (rec: RunRecord | null) => (rec ? cats.decodeMoves(rec.moves).length : 0);

// ---------- playing ----------
async function startServer(mode: 'free' | 'daily' | 'duel', duel?: string): Promise<void> {
  if (!api) {
    play((Math.random() * 2 ** 32) >>> 0, { hero: chosenHero(), room: chosenRoom() });
    return;
  }
  try {
    playServer(await api.start(mode, chosenHero(), chosenRoom(), duel));
  } catch (e) {
    toast(errorText(e));
  }
}

function playServer(s: Started): void {
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
    text.append(h('b', '', cardName(k)), h('span', '', cardText(k, levels[i])));
    const kind = isWeapon(k) ? 'оружие' : k === 'snack' || k === 'fishes' ? '' : 'пассивка';
    b.append(icon(k), text, h('span', 'lv', kind && levels[i] ? `ур. ${levels[i] + 1}` : kind ? `новое ${kind}` : ''));
    list.append(b);
  });
  const box = overlay(h('h1', '', 'Новый уровень!'), list);
  if (reroll) box.append(button('🎲 Другие карточки (1 раз)', 'btn secondary reroll', () => reroll()));
  box.classList.add('level');
  ui.append(box);
}

// Which weapons evolve with which passive, and how far each pair is.
function evolutionList(run: CatRun): HTMLElement {
  const list = h('div', 'evos');
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
  const table = h('div', 'dmg');
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

// Every weapon and passive and what they evolve into, like the VS collection.
function collectionScreen(): void {
  stopGame();
  setBack(() => menu());
  const found = new Set(load().found ?? []);
  const body = h('div', 'panel');
  body.append(
    h('p', '', `Оружие растёт до ${cats.WEAPON_MAX} уровня. Оружие ${cats.WEAPON_MAX} уровня вместе с нужной пассивкой превращается в эволюцию из сундука элиты или босса.`),
    h('h2', '', 'Оружие и эволюции'),
  );
  for (const w of cats.WEAPON_IDS) {
    const def = cats.WEAPONS[w];
    const evo = cats.EVOLUTIONS[w];
    const card = h('div', `herocard coll${found.has(w) ? '' : ' new'}`);
    const text = h('div', 'text');
    const b = def.base;
    text.append(
      h('b', '', def.name),
      h('span', '', def.desc[0]),
      h('span', 'nums', `Урон ${b.dmg} · перезарядка ${b.cd} с · снарядов ${b.amount}`),
    );
    const recipe = h('div', 'recipe');
    recipe.append(icon(w, 22), h('span', '', '+'), icon(evo.passive, 22), h('span', '', '→'), h('b', found.has(`evo:${w}`) ? 'got' : '', `★ ${evo.name}`));
    text.append(recipe, h('span', '', evo.desc));
    card.append(icon(w), text);
    body.append(card);
  }
  body.append(h('h2', '', 'Пассивки'));
  for (const id of cats.PASSIVE_IDS) {
    const def = cats.PASSIVES[id];
    const card = h('div', `herocard coll${found.has(id) ? '' : ' new'}`);
    const text = h('div', 'text');
    const evolves = cats.WEAPON_IDS.filter((w) => cats.EVOLUTIONS[w].passive === id);
    text.append(h('b', '', def.name), h('span', '', `${def.desc}, до ${def.max} уровня`));
    if (evolves.length) text.append(h('span', 'nums', `Нужна для: ${evolves.map((w) => cats.EVOLUTIONS[w].name).join(', ')}`));
    card.append(icon(id), text);
    body.append(card);
  }
  const box = overlay(h('h1', '', 'Коллекция'), body, button('Назад', 'btn secondary', () => menu()));
  box.classList.add('page');
  ui.replaceChildren(box);
}

function pauseMenu(): void {
  if (!game || game.run.over || ui.querySelector('.overlay:not(.level)')) return;
  game.setPaused(true);
  saveProgress();
  const box = overlay(
    h('h1', '', 'Пауза'),
    button('Продолжить', 'btn', () => {
      box.remove();
      game?.setPaused(false);
    }),
    button('Выйти в меню', 'btn secondary', () => menu()),
  );
  if (serverRun) box.append(h('p', '', 'Забег сохранён, его можно продолжить позже.'));
  box.append(damageTable(game.run), evolutionList(game.run));
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
    run.won ? catPicture(100, run.hero) : h('div', 'big', '😿'),
    h('h1', '', run.won ? 'Кот выстоял!' : 'Кота засосало'),
    h('p', 'result', `${mmss(run.tick)} · ${run.kills} врагов · уровень ${run.level}`),
    ...(run.tick > RUN_SECONDS * TICK_RATE ? [h('p', 'best', `От Уборщицы ${Math.floor((run.tick - RUN_SECONDS * TICK_RATE) / TICK_RATE)} с`)] : []),
  );
  if (vs) box.append(h('p', 'vs', vs));
  if (server) box.append(h('p', 'best', `+${server.result.points} очков лиги${server.result.fish ? ` · +${server.result.fish} 🐟` : ''}`));
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
          if (link) shareLink(link, `Я продержался ${scoreText(mine)} в «Котах против пылесосов». Переживёшь меня?`);
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

// ---------- cats ----------
// Every cat with its weapon, stats and bonus; the locked ones show how to open them.
function heroScreen(): void {
  screen('Коты', async (box) => {
    const render = (list: HeroInfo[], fish: number | null) => {
      box.replaceChildren(h('p', '', 'У каждого кота своё первое оружие и бонус, который растёт с уровнем. В дуэли каждый играет своим котом.'));
      if (fish !== null) box.append(h('p', 'best', `🐟 ${fish}`));
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
        card.append(catPicture(56, info.id), text);
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
            const b = button(`${u.fish} 🐟`, 'btn small', async () => {
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
      // Without the server every cat can be tried on this device.
      render(cats.HERO_IDS.map((id) => ({ id, owned: true, have: 0, need: 0 })), null);
      return;
    }
    const p = await api.profile();
    render(p.heroes, p.fish);
  });
}

// ---------- Power Ups ----------
// Permanent bonuses for fish, as in VS; every level bought makes the next ones dearer.
function powerScreen(): void {
  screen('Прокачка', async (box) => {
    const render = (p: Profile) => {
      box.replaceChildren(
        h('p', '', 'Бонусы навсегда, для всех котов. Каждая покупка дорожает следующие на 10%. Рыбу можно вернуть и купить в другом порядке.'),
        h('p', 'best', `🐟 ${p.fish}`),
      );
      for (const id of cats.POWER_IDS) {
        const def: cats.PowerDef = cats.POWERS[id];
        const lvl = p.powers[id] ?? 0;
        const card = h('div', `herocard${lvl ? ' on' : ''}`);
        const text = h('div', 'text');
        text.append(h('b', '', `${def.name} ${'●'.repeat(lvl)}${'○'.repeat(def.max - lvl)}`), h('span', '', `${def.desc} за уровень`));
        card.append(text);
        if (lvl >= def.max) card.append(h('span', 'lv', 'максимум'));
        else {
          const price = cats.powerPrice(id, p.powers);
          const b = button(`${price} 🐟`, 'btn small', async () => {
            try {
              render(await api!.shop('buy', `power:${id}`));
            } catch (e) {
              toast(errorText(e));
            }
          });
          b.disabled = p.fish < price;
          card.append(b);
        }
        box.append(card);
      }
      if (p.powerSpent > 0) {
        box.append(
          button(`Вернуть всё (${p.powerSpent} 🐟)`, 'btn secondary', async () => {
            try {
              render(await api!.refund());
            } catch (e) {
              toast(errorText(e));
            }
          }),
        );
      }
    };
    render(await api!.profile());
  });
}

// ---------- rooms ----------
function roomScreen(): void {
  screen('Комнаты', async (box) => {
    const render = (list: { id: RoomId; owned: boolean }[]) => {
      box.replaceChildren(h('p', '', 'Каждая следующая комната открывается, когда вы продержались 20 минут в предыдущей.'));
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
  screen('Рыба и ауры', async (box) => {
    const render = (p: Profile) => {
      box.replaceChildren(h('p', 'best', `🐟 ${p.fish}`));
      const tasks = h('ul', 'tasks');
      for (const t of p.tasks) {
        tasks.append(h('li', t.done ? 'done' : '', `${t.done ? '✅' : '▫️'} ${t.title}: ${t.progress}/${t.goal} · ${t.reward} 🐟`));
      }
      box.append(h('h2', '', 'Задания дня'), tasks);
      const s = p.season;
      box.append(h('h2', '', 'Сезон'), h('p', '', `Уровень ${s.level} из ${s.rewards.length}: ${s.points} очков, уровень каждые ${s.perLevel}. Последняя награда: аура «Корона сезона».`));
      box.append(h('h2', '', 'Ауры'), h('p', '', 'Цветное кольцо под котом. Друзья видят его у вашего призрака.'));
      const shop = h('div', 'shop');
      for (const f of FRAMES) {
        const owned = p.owned.includes(f.id);
        const worn = p.frame === f.id;
        const label = worn ? `${f.name}: снять` : owned ? `${f.name}: надеть` : f.exclusive ? `${f.name}: только в сезоне` : `${f.name}: ${f.price} 🐟`;
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
      ul.append(h('li', a.isNew ? 'new' : '', `${a.beat ? '😾' : '😼'} ${a.userName}: ${scoreText(a)} · ${a.beat ? 'продержался лучше вас' : 'вы лучше'}`));
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

void loadSprites().then(() => {
  const param = startParam();
  if (api && param.startsWith('d_')) duelScreen(param.slice(2));
  else menu();
});
