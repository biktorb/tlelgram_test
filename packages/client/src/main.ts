import './style.css';
import { ActionError, def, levelOf, MAX_TEAM, RULES, Run, type Action } from '@otryad/core';
import { ApiError, chooseBackend, OfflineBackend, type Backend } from './backend.ts';
import { playBattle } from './battleView.ts';
import { card, h, levelPips, toast } from './ui.ts';
import { haptic, initTelegram, playerName, setBack } from './telegram.ts';

const app = document.getElementById('app')!;

type Selection = { kind: 'shop'; i: number } | { kind: 'team'; i: number } | null;

let backend: Backend;
let run: Run;
let selection: Selection = null;
let busy = false;

async function startNewRun(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    run = await backend.newRun();
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
    playBattle(app, res.out, { player: playerName(), enemy: res.enemy, round }, render);
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
      ? card(u, `${selected ? 'selected' : ''} ${isTarget ? 'target' : ''}`)
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
  app.replaceChildren(
    h(
      'div',
      { class: 'screen over' },
      h('h1', {}, won ? 'Забег пройден!' : 'Забег окончен'),
      h('p', { class: 'big' }, `${s.wins} ${plural(s.wins, 'победа', 'победы', 'побед')} за ${s.history.length} ${plural(s.history.length, 'раунд', 'раунда', 'раундов')}`),
      h('p', { class: 'pips', 'aria-label': 'История боёв' }, pips),
      h('div', { class: 'row team' }, ...s.team.map((u) => card(u))),
      h('button', { class: 'primary', type: 'button', onclick: () => void startNewRun() }, 'Новый забег'),
      h('p', { class: 'muted small' }, 'В Telegram-версии здесь будет кнопка «Побей мой отряд».'),
    ),
  );
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
  render();
}

void boot();
