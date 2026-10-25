import './style.css';
import { ActionError, def, FRAMES, levelOf, MAX_TEAM, RULES, Run, type Action } from '@otryad/core';
import { ApiError, chooseBackend, hasDuels, OfflineBackend, type Backend, type ChatEntry, type DailyInfo, type DuelAnswer, type DuelInfo, type LeagueInfo, type Profile } from './backend.ts';
import { playBattle } from './battleView.ts';
import { card, h, levelPips, toast } from './ui.ts';
import { canShareStory, haptic, initTelegram, playerName, setBack, shareLink, shareStory, startParam } from './telegram.ts';

const app = document.getElementById('app')!;

type Selection = { kind: 'shop'; i: number } | { kind: 'team'; i: number } | null;

let backend: Backend;
let run: Run;
let selection: Selection = null;
let busy = false;
// Challenger of the duel the current run answers.
let duelName: string | null = null;
// Outcome of the duel at the end of the current run.
let duelOutcome: { result: 'win' | 'loss' | 'draw'; challengerName: string } | null = null;
// Friends' answers to this player's duels.
let answers: DuelAnswer[] = [];
// Leaderboard of the chat the game was opened from; null outside a chat.
let chatTop: ChatEntry[] | null = null;

// Today's challenge and its leaderboard; null offline.
let daily: DailyInfo | null = null;

async function loadDaily(): Promise<void> {
  if (hasDuels(backend)) daily = await backend.dailyInfo().catch(() => null);
}

// Fish, frames and daily tasks; null offline.
let profile: Profile | null = null;
const myFrame = () => (profile?.frame ? `frame-${profile.frame}` : '');

// Reloads the profile; tasks done since the last load pay out and are announced.
async function loadProfile(): Promise<void> {
  if (!hasDuels(backend)) return;
  const before = profile?.fish;
  profile = await backend.profile().catch(() => profile);
  const gained = before === undefined || !profile ? 0 : profile.fish - before;
  if (gained > 0) toast(`+${gained} 🐟 за задания дня`);
}

async function shopAction(what: 'buy' | 'equip', item: string | null): Promise<void> {
  if (busy || !hasDuels(backend)) return;
  busy = true;
  try {
    profile = await backend.shop(what, item);
    haptic.result('success');
  } catch (e) {
    showError(e);
  } finally {
    busy = false;
  }
  renderStore();
}

// The player's weekly league; null offline.
let league: LeagueInfo | null = null;
const LEAGUES = ['🥉 Бронза', '🥈 Серебро', '🥇 Золото', '💎 Алмаз'];

async function loadLeague(): Promise<void> {
  if (hasDuels(backend)) league = await backend.league().catch(() => null);
}

// Once a week, tells the player where last week's result took them.
function announceLeague(): void {
  if (!league?.moved) return;
  const key = `league-seen-${league.week}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
  } catch {
    // Storage may be unavailable; then the note shows on every launch this week.
  }
  toast(league.moved > 0 ? `Повышение! Ваша лига: ${LEAGUES[league.league]}` : `Лига понижена: ${LEAGUES[league.league]}`);
}

async function startDaily(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    run = await backend.newRun({ daily: true });
    duelName = null;
    duelOutcome = null;
    selection = null;
    await loadDaily();
  } catch (e) {
    showError(e);
  } finally {
    busy = false;
  }
  render();
}

async function loadChatTop(): Promise<void> {
  if (hasDuels(backend)) chatTop = await backend.chatTop().catch(() => null);
}

async function startNewRun(duel?: DuelInfo): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    run = await backend.newRun(duel ? { duel: duel.code } : {});
    duelName = duel ? duel.challengerName : null;
    duelOutcome = null;
    selection = null;
  } catch (e) {
    showError(e);
  } finally {
    busy = false;
  }
  render();
}

function act(action: Action): void {
  try {
    run.apply(action);
    backend.record(run, action);
    haptic.tap();
    selection = null;
  } catch (e) {
    if (e instanceof ActionError) {
      haptic.result('error');
      toast(e.message);
    } else throw e;
  }
  render();
}

async function fight(): Promise<void> {
  if (busy) return;
  if (run.s.team.length === 0) {
    toast('Купите хотя бы одного бойца');
    return;
  }
  busy = true;
  const round = run.s.round;
  selection = null;
  try {
    const res = await backend.fight(run);
    run = res.run;
    if (run.s.finished) await Promise.all([loadChatTop(), loadDaily(), loadLeague(), loadProfile()]);
    const duel = res.duel;
    // A duel run ends with one more battle: the final team against the challenger's.
    const next = duel
      ? () =>
          playBattle(app, duel.out, { player: playerName(), enemy: duel.challengerName, title: 'Дуэль', frames: [profile?.frame ?? null, null] }, () => {
            duelOutcome = { result: duel.out.result, challengerName: duel.challengerName };
            render();
          })
      : render;
    playBattle(app, res.out, { player: playerName(), enemy: res.enemy, title: `Раунд ${round}`, frames: [profile?.frame ?? null, res.enemyFrame ?? null] }, next);
  } catch (e) {
    showError(e);
    await resync();
    render();
  } finally {
    busy = false;
  }
}

// After a rejected turn the server's state wins.
async function resync(): Promise<void> {
  try {
    run = await backend.load();
  } catch (e) {
    showError(e);
  }
}

function showError(e: unknown): void {
  haptic.result('error');
  toast(e instanceof ApiError ? e.message : 'Что-то пошло не так');
  if (!(e instanceof ApiError)) console.error(e);
}

// ---------- Shop screen ----------

function onShop(i: number): void {
  haptic.tap();
  selection = selection?.kind === 'shop' && selection.i === i ? null : { kind: 'shop', i };
  render();
}

function onTeam(i: number): void {
  const team = run.s.team;
  const target = i < team.length ? team[i] : null;
  if (selection?.kind === 'shop') {
    const slot = run.s.shop[selection.i];
    if (!target) return act({ a: 'buy', shop: selection.i, pos: team.length });
    if (target.id === slot.id) return act({ a: 'buyMerge', shop: selection.i, team: i });
    toast('Место занято. Объединять можно только одинаковых бойцов');
    return;
  }
  if (selection?.kind === 'team') {
    const from = selection.i;
    if (!target) return act({ a: 'move', from, to: team.length - 1 });
    if (from === i) {
      selection = null;
      return render();
    }
    if (target.id === team[from].id) return act({ a: 'merge', from, to: i });
    return act({ a: 'move', from, to: i });
  }
  if (target) {
    haptic.tap();
    selection = { kind: 'team', i };
    render();
  }
}

function infoPanel(): HTMLElement {
  let u: { id: string; atk: number; hp: number; xp: number } | null = null;
  if (selection?.kind === 'shop') u = { ...run.s.shop[selection.i], xp: 0 };
  if (selection?.kind === 'team') u = run.s.team[selection.i];
  if (!u) {
    return h('div', { class: 'info hint' }, 'Нажмите на бойца в лавке, затем на место в отряде. Одинаковых бойцов можно объединять.');
  }
  const d = def(u.id);
  const lvl = levelOf(u.xp);
  return h(
    'div',
    { class: 'info' },
    h('div', { class: 'info-title' }, h('strong', {}, d.name), h('span', { class: 'muted' }, ` · уровень силы ${d.tier} · ${levelPips(u.xp)}`)),
    h('div', {}, d.text + (lvl > 1 && d.effect ? ` Сила умения ×${lvl}.` : '')),
  );
}

function renderShop(): void {
  setBack(
    selection
      ? () => {
          selection = null;
          render();
        }
      : null,
  );
  const s = run.s;
  const sel = selection;
  const shopSel = sel?.kind === 'shop' ? s.shop[sel.i] : null;

  // Team: front (index 0) is on the left, same as in battle.
  const slots: HTMLElement[] = [];
  for (let i = 0; i < MAX_TEAM; i++) {
    const u = s.team[i];
    const isTarget = shopSel ? !u || u.id === shopSel.id : sel?.kind === 'team' && sel.i !== i && (!u || u.id === s.team[sel.i].id);
    const selected = sel?.kind === 'team' && sel.i === i;
    const el = u
      ? card(u, `${selected ? 'selected' : ''} ${isTarget ? 'target' : ''} ${myFrame()}`)
      : h('div', { class: `slot ${isTarget ? 'target' : ''}` }, '+');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', u ? `${def(u.id).name}, место ${i + 1}` : `Пустое место ${i + 1}`);
    el.addEventListener('click', () => onTeam(i));
    slots.push(el);
  }

  const shopCards = s.shop.map((x, i) => {
    const el = card({ ...x, xp: 0 }, sel?.kind === 'shop' && sel.i === i ? 'selected' : '');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `${def(x.id).name} в лавке${x.frozen ? ', заморожен' : ''}`);
    el.addEventListener('click', () => onShop(i));
    return el;
  });

  const actions: HTMLElement[] = [
    h('button', { class: 'ghost', type: 'button', onclick: () => act({ a: 'reroll' }), disabled: s.gold < RULES.rerollCost }, `Обновить · ${RULES.rerollCost}🪙`),
  ];
  if (sel?.kind === 'shop') {
    const frozen = s.shop[sel.i].frozen;
    actions.push(h('button', { class: 'ghost', type: 'button', onclick: () => act({ a: 'freeze', shop: sel.i }) }, frozen ? 'Разморозить' : 'Заморозить'));
  }
  if (sel?.kind === 'team') {
    const refund = levelOf(s.team[sel.i].xp);
    actions.push(h('button', { class: 'ghost danger', type: 'button', onclick: () => act({ a: 'sell', team: sel.i }) }, `Продать · +${refund}🪙`));
  }
  actions.push(h('button', { class: 'primary', type: 'button', onclick: () => void fight() }, 'В бой'));

  app.replaceChildren(
    h(
      'div',
      { class: 'screen shop' },
      hud(),
      duelName ? h('div', { class: 'duel-note' }, `⚔️ Дуэль с ${duelName}: в конце забега ваш отряд сразится с отрядом соперника`) : null,
      backend.daily ? h('div', { class: 'duel-note' }, `🗓 Вызов дня: у всех сегодня одна стартовая лавка, попытка одна`) : null,
      dailyBanner(),
      profile && s.round === 1 && s.team.length === 0
        ? h('button', { class: 'ghost fish-btn', type: 'button', onclick: renderStore }, `🐟 ${profile.fish} · Задания и рамки`)
        : null,
      h('section', {}, h('div', { class: 'label' }, h('span', {}, 'Отряд'), h('span', { class: 'muted' }, 'фронт ← → тыл')), h('div', { class: 'row team' }, ...slots)),
      infoPanel(),
      h('section', {}, h('div', { class: 'label' }, h('span', {}, 'Лавка'), h('span', { class: 'muted' }, `боец ${RULES.buyCost}🪙`)), h('div', { class: 'row shoprow' }, ...(shopCards.length ? shopCards : [h('div', { class: 'empty muted' }, 'Лавка пуста. Обновите её или идите в бой.')]))),
      h('div', { class: 'actions' }, ...actions),
    ),
  );
}

function hud(): HTMLElement {
  const s = run.s;
  return h(
    'header',
    { class: 'hud' },
    h('span', { title: 'Жизни' }, `❤️ ${s.lives}`),
    h('span', { title: 'Победы' }, `🏆 ${s.wins}/${RULES.winsToFinish}`),
    h('span', { class: 'muted' }, `Раунд ${s.round}`),
    h('span', { class: 'gold', title: 'Монеты' }, `🪙 ${s.gold}`),
  );
}

// ---------- Run over ----------

function renderOver(): void {
  setBack(null);
  const s = run.s;
  const won = s.wins >= RULES.winsToFinish;
  const pips = s.history.map((r) => (r === 'win' ? '🟩' : r === 'loss' ? '🟥' : '⬜')).join('');
  const duelLine = duelOutcome
    ? h(
        'p',
        { class: `duel-result ${duelOutcome.result}` },
        `Дуэль с ${duelOutcome.challengerName}: ${duelOutcome.result === 'win' ? 'победа!' : duelOutcome.result === 'loss' ? 'поражение' : 'ничья'}`,
      )
    : null;
  app.replaceChildren(
    h(
      'div',
      { class: 'screen over' },
      h('h1', {}, won ? 'Забег пройден!' : 'Забег окончен'),
      h('p', { class: 'big' }, `${s.wins} ${plural(s.wins, 'победа', 'победы', 'побед')} за ${s.history.length} ${plural(s.history.length, 'раунд', 'раунда', 'раундов')}`),
      h('p', { class: 'pips', 'aria-label': 'История боёв' }, pips),
      h('div', { class: 'row team' }, ...s.team.map((u) => card(u, myFrame()))),
      duelLine,
      hasDuels(backend) ? h('button', { class: 'primary', type: 'button', onclick: () => void shareRun() }, '⚔️ Побей мой отряд') : null,
      daily?.status === 'none' ? h('button', { class: 'ghost', type: 'button', onclick: () => void startDaily() }, '🗓 Вызов дня') : null,
      hasDuels(backend) && canShareStory() ? h('button', { class: 'ghost', type: 'button', onclick: () => void shareRun('story') }, '📸 В историю') : null,
      h('button', { class: hasDuels(backend) ? 'ghost' : 'primary', type: 'button', onclick: () => void startNewRun() }, 'Новый забег'),
      profile ? h('button', { class: 'ghost fish-btn', type: 'button', onclick: renderStore }, `🐟 ${profile.fish} · Задания и рамки`) : null,
      leagueBoard(),
      dailyBoard(),
      chatBoard(),
      answersList(),
    ),
  );
}

// Sends friends a link: they play from the same seed and fight this team at the end.
// To a chat by default, or as a story with the link in the caption.
async function shareRun(to: 'chat' | 'story' = 'chat'): Promise<void> {
  if (busy || !hasDuels(backend)) return;
  busy = true;
  try {
    const { link } = await backend.share();
    if (!link) {
      toast('Ссылка на игру ещё не настроена на сервере');
      return;
    }
    const wins = run.s.wins;
    const boast = wins > 0 ? `Я набрал ${wins} ${plural(wins, 'победу', 'победы', 'побед')} в «Отряде»` : 'Я собрал отряд в «Отряде»';
    if (to === 'story') shareStory(new URL('story.jpg', location.href).href, `${boast} 🐱⚔️ Побей мой отряд: ${link}`);
    else shareLink(link, `${boast} 🐱⚔️ Сможешь победить моих котов?`);
  } catch (e) {
    showError(e);
  } finally {
    busy = false;
  }
}

// Offered in the shop until today's challenge is played; tapping it ends the current run.
function dailyBanner(): HTMLElement | null {
  if (daily?.status !== 'none' || backend.daily || duelName) return null;
  const note = run.s.round > 1 ? ' Текущий забег будет завершён.' : '';
  return h(
    'div',
    { class: 'daily-banner' },
    h('span', {}, `🗓 Вызов дня: одна попытка, общая лавка для всех.${note}`),
    h('button', { class: 'ghost', type: 'button', onclick: () => void startDaily() }, 'Играть'),
  );
}

function leagueBoard(): HTMLElement | null {
  if (!league) return null;
  const l = league;
  const days = Math.max(1, Math.ceil((Date.parse(l.endsAt) - Date.now()) / 86_400_000));
  const zone = (place: number) => (place <= l.up ? ' ⬆️' : place > l.size - l.down ? ' ⬇️' : '');
  const line = (e: LeagueInfo['top'][number], i: number) =>
    h('li', { class: e.me ? 'me' : '' }, `${i + 1}. ${e.name} — ${e.points} ${plural(e.points, 'очко', 'очка', 'очков')}${zone(i + 1)}`);
  const place = l.rank ? `место ${l.rank} из ${l.size}` : 'сыграйте забег, чтобы попасть в таблицу';
  return h(
    'section',
    { class: 'answers board' },
    h('div', { class: 'label' }, h('span', {}, `Лига недели: ${LEAGUES[l.league]}`), h('span', { class: 'muted' }, `ещё ${days} ${plural(days, 'день', 'дня', 'дней')}`)),
    h('p', { class: 'small' }, `${l.points} ${plural(l.points, 'очко', 'очка', 'очков')}, ${place}. Очки приносят победы в первых ${l.runsPerDay} забегах за день: сегодня ${Math.min(l.runsToday, l.runsPerDay)} из ${l.runsPerDay}.`),
    l.top.length ? h('ol', {}, ...l.top.map(line)) : null,
    l.rank && l.rank > l.top.length ? h('p', { class: 'muted small' }, `Ваше место: ${l.rank}${zone(l.rank)}`) : null,
    leagueRules(l),
  );
}

function leagueRules(l: LeagueInfo): HTMLElement | null {
  const rules = [l.up ? `${l.up === 1 ? 'первое место' : `первые ${l.up} мест${l.up < 5 ? 'а' : ''}`} ⬆️ уходят в лигу выше` : '', l.down ? `последние ${l.down} ⬇️ опускаются` : ''].filter(Boolean);
  return rules.length ? h('p', { class: 'muted small' }, `В конце недели ${rules.join(', ')}.`) : null;
}

function dailyBoard(): HTMLElement | null {
  if (!daily || daily.top.length === 0 || !backend.daily) return null;
  const line = (e: DailyInfo['top'][number], i: number) =>
    h('li', { class: e.me ? 'me' : '' }, `${i + 1}. ${e.name} — ${e.wins} ${plural(e.wins, 'победа', 'победы', 'побед')}, ❤️ ${e.lives}`);
  const mine = daily.rank && daily.rank > daily.top.length ? h('p', { class: 'muted small' }, `Ваше место: ${daily.rank}`) : null;
  return h('section', { class: 'answers board' }, h('div', { class: 'label' }, h('span', {}, 'Вызов дня: рейтинг')), h('ol', {}, ...daily.top.map(line)), mine);
}

function chatBoard(): HTMLElement | null {
  if (!chatTop || chatTop.length === 0) return null;
  const line = (e: ChatEntry, i: number) =>
    h('li', { class: e.me ? 'me' : '' }, `${i + 1}. ${e.name} — ${e.bestWins} ${plural(e.bestWins, 'победа', 'победы', 'побед')}`);
  return h('section', { class: 'answers board' }, h('div', { class: 'label' }, h('span', {}, 'Рейтинг чата за неделю')), h('ol', {}, ...chatTop.map(line)));
}

function answersList(): HTMLElement | null {
  if (answers.length === 0) return null;
  const line = (a: DuelAnswer) => {
    // a.result is the friend's result, so a friend's loss is the player's win.
    const text = a.result === 'loss' ? 'ваш отряд победил' : a.result === 'win' ? 'ваш отряд проиграл' : 'ничья';
    return h('li', { class: a.isNew ? 'new' : '' }, `${a.userName}: ${text}`);
  };
  return h('section', { class: 'answers' }, h('div', { class: 'label' }, h('span', {}, 'Ответы на ваши вызовы')), h('ul', {}, ...answers.slice(0, 5).map(line)));
}

// ---------- Tasks and frames ----------

function renderStore(): void {
  if (!profile) return render();
  const p = profile;
  setBack(render);
  const task = (t: Profile['tasks'][number]) =>
    h(
      'li',
      { class: t.done ? 'done' : '' },
      h('div', { class: 'top' }, h('span', {}, `${t.done ? '✅ ' : ''}${t.title}`), h('span', { class: 'muted' }, `${t.progress}/${t.goal} · +${t.reward} 🐟`)),
      h('div', { class: 'bar' }, h('i', { style: `width: ${(100 * t.progress) / t.goal}%` })),
    );
  const sample = { id: 'recruit', atk: 2, hp: 2 };
  const plain = h(
    'div',
    { class: 'item' },
    card(sample),
    h('span', {}, 'Обычная'),
    p.frame === null ? h('span', { class: 'muted' }, 'надета') : h('button', { class: 'ghost', type: 'button', onclick: () => void shopAction('equip', null) }, 'Надеть'),
  );
  const frames = FRAMES.map((f) => {
    const owned = p.owned.includes(f.id);
    const action =
      p.frame === f.id
        ? h('span', { class: 'muted' }, 'надета')
        : owned
          ? h('button', { class: 'ghost', type: 'button', onclick: () => void shopAction('equip', f.id) }, 'Надеть')
          : f.exclusive
            ? h('span', { class: 'muted' }, 'награда сезона')
            : h('button', { class: p.fish >= f.price ? 'primary' : 'ghost', type: 'button', disabled: p.fish < f.price, onclick: () => void shopAction('buy', f.id) }, `${f.price} 🐟`);
    return h('div', { class: 'item' }, card(sample, `frame-${f.id}`), h('span', {}, f.name), action);
  });
  app.replaceChildren(
    h(
      'div',
      { class: 'screen over store' },
      h('h1', {}, `🐟 ${p.fish}`),
      h('p', { class: 'muted small' }, 'Рыбки дают за задания дня. На них покупаются рамки для карточек: их видят и соперники. Сила отряда от рамки не меняется.'),
      h('section', { class: 'answers' }, h('div', { class: 'label' }, h('span', {}, 'Задания дня')), h('ul', { class: 'tasks' }, ...p.tasks.map(task))),
      seasonSection(p),
      h('section', { class: 'answers' }, h('div', { class: 'label' }, h('span', {}, 'Рамки')), h('div', { class: 'frames' }, plain, ...frames)),
      h('button', { class: 'ghost', type: 'button', onclick: render }, 'Назад'),
    ),
  );
}

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

function seasonSection(p: Profile): HTMLElement {
  const s = p.season;
  const total = s.rewards.length;
  const into = s.level >= total ? s.perLevel : s.points - s.level * s.perLevel;
  const days = Math.max(1, Math.ceil((Date.parse(s.endsAt) - Date.now()) / 86_400_000));
  const reward = (r: Profile['season']['rewards'][number], i: number) =>
    h(
      'span',
      { class: `pass-step ${i < s.level ? 'got' : ''}` },
      h('b', {}, String(i + 1)),
      'fish' in r ? `${r.fish}🐟` : '👑',
    );
  return h(
    'section',
    { class: 'answers' },
    h('div', { class: 'label' }, h('span', {}, `Сезон: ${MONTHS[Number(s.id.slice(5)) - 1]}`), h('span', { class: 'muted' }, `ещё ${days} ${plural(days, 'день', 'дня', 'дней')}`)),
    h(
      'p',
      { class: 'small' },
      s.level >= total
        ? 'Сезонный путь пройден! Корона сезона ваша.'
        : `Уровень ${s.level} из ${total}. До следующего: ${s.perLevel - into} ${plural(s.perLevel - into, 'победа', 'победы', 'побед')}. Очки сезона дают победы в любых забегах, сыгранных до конца.`,
    ),
    h('div', { class: 'bar' }, h('i', { style: `width: ${(100 * into) / s.perLevel}%` })),
    h('div', { class: 'pass' }, ...s.rewards.map(reward)),
  );
}

// ---------- Duel invitation ----------

function renderInvite(duel: DuelInfo): void {
  setBack(null);
  const inProgress = !run.s.finished && run.s.round > 1;
  app.replaceChildren(
    h(
      'div',
      { class: 'screen over invite' },
      h('h1', {}, `${duel.challengerName} вызывает на дуэль!`),
      h('p', { class: 'big' }, `Отряд соперника: ${duel.wins} ${plural(duel.wins, 'победа', 'победы', 'побед')}`),
      h('div', { class: 'row team' }, ...duel.team.map((u) => card(u))),
      h('p', {}, 'Пройдите забег с той же стартовой лавкой. В конце ваш отряд сразится с этим.'),
      inProgress ? h('p', { class: 'muted small' }, 'Текущий забег будет завершён.') : null,
      h('button', { class: 'primary', type: 'button', onclick: () => void startNewRun(duel) }, 'Принять вызов'),
      h('button', { class: 'ghost', type: 'button', onclick: render }, 'Не сейчас'),
    ),
  );
}

async function loadDuels(): Promise<DuelInfo | null> {
  if (!hasDuels(backend)) return null;
  const b = backend;
  const [invite] = await Promise.all([
    (async () => {
      const param = startParam();
      if (!param.startsWith('d_')) return null;
      const code = param.slice(2);
      if (b.duel === code) return null; // already answering it
      try {
        const duel = await b.duelInfo(code);
        if (!duel.mine) return duel;
        toast('Это ваш вызов: отправьте его друзьям');
        return null;
      } catch (e) {
        showError(e);
        return null;
      }
    })(),
    (async () => {
      if (b.duel) duelName = (await b.duelInfo(b.duel).catch(() => null))?.challengerName ?? 'другом';
    })(),
    loadChatTop(),
    loadDaily(),
    loadLeague().then(announceLeague),
    loadProfile(),
    (async () => {
      answers = await b.duelAnswers().catch(() => []);
      const fresh = answers.filter((a) => a.isNew);
      if (fresh.length === 1) toast(`${fresh[0].userName} принял ваш вызов`);
      else if (fresh.length > 1) toast(`Новых ответов на ваши вызовы: ${fresh.length}`);
    })(),
  ]);
  return invite;
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function render(): void {
  if (run.s.finished) renderOver();
  else renderShop();
}

async function boot(): Promise<void> {
  initTelegram();
  app.replaceChildren(h('div', { class: 'screen loading' }, h('p', { class: 'muted' }, 'Загрузка…')));
  backend = chooseBackend();
  try {
    run = await backend.load();
  } catch (e) {
    // Server unreachable or sign-in refused: keep the game playable offline.
    toast(e instanceof ApiError ? `${e.message}. Играем офлайн.` : 'Играем офлайн.');
    backend = new OfflineBackend();
    run = await backend.load();
  }
  const invite = await loadDuels();
  if (invite) renderInvite(invite);
  else render();
}

void boot();
