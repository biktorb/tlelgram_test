import type { BattleOutcome, Unit } from '@otryad/core';
import { card, float, h, reducedMotion, setStats } from './ui.ts';

export interface BattleNames {
  player: string;
  enemy: string;
  round: number;
}

const BASE_MS = {
  ability: 260,
  buff: 220,
  damage: 260,
  attack: 380,
  faint: 240,
  summon: 260,
};

// Plays the battle event log. Side 0 (player) is the bottom row, side 1 the
// top row; in both rows the front unit is on the left.
export function playBattle(root: HTMLElement, out: BattleOutcome, names: BattleNames, onDone: () => void): void {
  let speed = 1;
  let skipped = false;

  const units = new Map<number, { unit: Unit; el: HTMLElement; side: number }>();
  const rows = [h('div', { class: 'row player' }), h('div', { class: 'row enemy' })];

  const add = (side: number, u: Unit, pos?: number) => {
    const el = card(u);
    units.set(u.uid, { unit: { ...u }, el, side });
    const row = rows[side];
    const at = pos === undefined ? null : row.children[pos] ?? null;
    row.insertBefore(el, at);
    return el;
  };
  out.start.left.forEach((u) => add(0, u));
  out.start.right.forEach((u) => add(1, u));

  const speedBtn = h('button', { class: 'ghost', type: 'button' }, 'x1');
  speedBtn.addEventListener('click', () => {
    speed = speed === 1 ? 2 : 1;
    speedBtn.textContent = `x${speed}`;
  });
  const skipBtn = h('button', { class: 'ghost', type: 'button', onclick: () => (skipped = true) }, 'Пропустить');

  root.replaceChildren(
    h(
      'div',
      { class: 'screen battle' },
      h('div', { class: 'battle-head' }, h('span', {}, `Раунд ${names.round}`), h('div', { class: 'battle-ctl' }, speedBtn, skipBtn)),
      h('div', { class: 'side-name' }, names.enemy),
      rows[1],
      h('div', { class: 'clash', 'aria-hidden': 'true' }, '⚔'),
      rows[0],
      h('div', { class: 'side-name' }, names.player),
    ),
  );

  const wait = (ms: number) =>
    new Promise<void>((r) => window.setTimeout(r, skipped ? 0 : (reducedMotion ? ms / 2 : ms) / speed));

  const finish = () => {
    if (skipped) {
      for (const side of [0, 1]) {
        const survivors = side === 0 ? out.left : out.right;
        rows[side].replaceChildren(...survivors.map((u) => card(u)));
      }
    }
    const text = out.result === 'win' ? 'Победа' : out.result === 'loss' ? 'Поражение' : 'Ничья';
    root.querySelector('.screen')!.append(
      h(
        'div',
        { class: `result ${out.result}` },
        h('strong', {}, text),
        h('button', { class: 'primary', type: 'button', onclick: onDone }, 'Дальше'),
      ),
    );
  };

  const anim = (el: HTMLElement, frames: Keyframe[], ms: number) => {
    if (skipped || reducedMotion) return;
    el.animate(frames, { duration: ms / speed, easing: 'ease-out' });
  };

  (async () => {
    await wait(400);
    for (const e of out.events) {
      if (skipped) break;
      switch (e.t) {
        case 'ability': {
          const x = units.get(e.uid);
          if (x) anim(x.el, [{ boxShadow: '0 0 0 0 var(--accent)' }, { boxShadow: '0 0 0 6px var(--accent)' }, { boxShadow: '0 0 0 0 var(--accent)' }], BASE_MS.ability);
          await wait(BASE_MS.ability);
          break;
        }
        case 'buff': {
          const x = units.get(e.uid);
          if (!x) break;
          x.unit.atk += e.atk;
          x.unit.hp += e.hp;
          setStats(x.el, x.unit.atk, x.unit.hp);
          float(x.el, `+${e.atk}/+${e.hp}`, 'buff');
          await wait(BASE_MS.buff);
          break;
        }
        case 'damage': {
          const x = units.get(e.uid);
          if (!x) break;
          x.unit.hp -= e.amount;
          setStats(x.el, x.unit.atk, x.unit.hp);
          float(x.el, `−${e.amount}`, 'dmg');
          anim(x.el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], BASE_MS.damage);
          await wait(BASE_MS.damage / 2);
          break;
        }
        case 'attack': {
          const a = units.get(e.left);
          const b = units.get(e.right);
          if (a) anim(a.el, [{ transform: 'translateY(0)' }, { transform: 'translateY(-22px)' }, { transform: 'translateY(0)' }], BASE_MS.attack);
          if (b) anim(b.el, [{ transform: 'translateY(0)' }, { transform: 'translateY(22px)' }, { transform: 'translateY(0)' }], BASE_MS.attack);
          await wait(BASE_MS.attack * 0.6);
          break;
        }
        case 'faint': {
          const x = units.get(e.uid);
          if (!x) break;
          x.el.classList.add('dead');
          await wait(BASE_MS.faint);
          x.el.remove();
          units.delete(e.uid);
          break;
        }
        case 'summon': {
          const el = add(e.side, { uid: e.uid, id: e.id, atk: e.atk, hp: e.hp, xp: 0 }, e.pos);
          anim(el, [{ transform: 'scale(0.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], BASE_MS.summon);
          await wait(BASE_MS.summon);
          break;
        }
        case 'gold':
          break;
      }
    }
    await wait(300);
    finish();
  })();
}
