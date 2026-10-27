import { cats, FRAMES } from '@otryad/core';
import { haptic, initTelegram, setBack, shareLink, startParam } from '../telegram.ts';
import { ApiError, connect, type Finished, type Profile, type Score, type Started } from './api.ts';
import { Game, type RunRecord } from './game.ts';
import { loadSprites, sprite, type SpriteId } from './sprites.ts';
import './style.css';

const { RUN_SECONDS, TICK_RATE, cardName, cardText, isWeapon } = cats;
type CardId = cats.CardId;
type ItemId = cats.ItemId;
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
  const buttons = h('div', 'buttons');
  buttons.append(button('Играть', 'btn', () => startServer('free')));
  if (s.last) {
    const last = s.last;
    buttons.append(button(`Переживи себя (${mmss(last.ticks)})`, 'btn ghost', () => play(last.seed, { ghost: last.record })));
  }
  box.append(buttons);

  if (api) {
    const more = h('div', 'tiles');
    more.append(
      button('📅 Вызов дня', 'tile', () => dailyScreen()),
      button('🏆 Лига', 'tile', () => leagueScreen()),
      button('🐟 Рыба', 'tile', () => profileScreen()),
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
    play((Math.random() * 2 ** 32) >>> 0);
    return;
  }
  try {
    playServer(await api.start(mode, duel));
  } catch (e) {
    toast(errorText(e));
  }
}

function playServer(s: Started): void {
  serverRun = s.run;
  play(s.run.seed, { ghost: s.ghost?.record, progress: s.run.progress ?? undefined, ghostName: s.ghost?.name });
}

function saveProgress(): void {
  if (!api || !serverRun || !game || game.run.over) return;
  api.progress(serverRun.id, game.rec.record()).catch(() => {});
}

function play(seed: number, opts: { ghost?: RunRecord; progress?: RunRecord; ghostName?: string } = {}): void {
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
        if (e.t === 'level') haptic.result('success');
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
  box.append(evolutionList(game.run));
  ui.append(box);
}

async function finish(seed: number, run: CatRun, record: RunRecord, vsGhost: boolean): Promise<void> {
  haptic.result(run.won ? 'success' : 'error');
  const s = load();
  const mine = { won: run.won, ticks: run.tick, kills: run.kills };
  const better = !s.best || cats.compareScores(mine, s.best) < 0;
  if (better) s.best = mine;
  s.last = { seed, record, ticks: run.tick, kills: run.kills };
  save(s);

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
  for (const [k, l] of Object.entries(run.items) as [ItemId, number][]) {
    const u = h('span', 'up');
    u.append(icon(k, 26), h('b', '', String(l)));
    ups.append(u);
  }
  const box = overlay(
    run.won ? catPicture(100) : h('div', 'big', '😿'),
    h('h1', '', run.won ? 'Кот выстоял!' : 'Кота засосало'),
    h('p', 'result', `${mmss(run.tick)} · ${run.kills} врагов · уровень ${run.level}`),
  );
  if (vs) box.append(h('p', 'vs', vs));
  if (server) box.append(h('p', 'best', `+${server.result.points} очков лиги`));
  if (server?.daily?.rank) box.append(h('p', 'best', `Вызов дня: ${server.daily.rank} место`));
  else if (better) box.append(h('p', 'best', 'Новый рекорд!'));
  if (error) box.append(h('p', 'error', error));
  box.append(ups);
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

// ---------- server screens ----------
function dailyScreen(): void {
  screen('Вызов дня', async (box) => {
    const d = await api!.daily();
    box.replaceChildren(h('p', '', 'Одна попытка в день, у всех одна и та же карта. Вы играете против призрака лидера.'));
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
