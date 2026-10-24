import { def, levelOf } from '@otryad/core';
import { icon } from './art.ts';

type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;

export function h(tag: string, attrs: Attrs = {}, ...children: (Node | string | null | false)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, '').toLowerCase(), v);
    else if (k === 'class') el.className = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== false) el.append(c);
  return el;
}

export interface CardData {
  id: string;
  atk: number;
  hp: number;
  xp?: number;
  frozen?: boolean;
}

export function card(u: CardData, extraClass = ''): HTMLElement {
  const d = def(u.id);
  const xp = u.xp ?? 0;
  const level = levelOf(xp);
  return h(
    'div',
    { class: `card tier${d.tier} ${u.frozen ? 'frozen' : ''} ${extraClass}`.trim() },
    h('div', { class: 'ico', 'aria-hidden': 'true' }, icon(u.id)),
    h('div', { class: 'lvl', title: `Уровень ${level}` }, levelPips(xp)),
    h(
      'div',
      { class: 'stats' },
      h('span', { class: 'atk', 'aria-label': `атака ${u.atk}` }, String(u.atk)),
      h('span', { class: 'hp', 'aria-label': `здоровье ${u.hp}` }, String(u.hp)),
    ),
  );
}

// Level 1: 0/2 xp, level 2: 0/3 xp, level 3: max.
export function levelPips(xp: number): string {
  const level = levelOf(xp);
  if (level === 3) return 'ур.3';
  const into = level === 1 ? xp : xp - 2;
  const need = level === 1 ? 2 : 3;
  return `ур.${level} ${'●'.repeat(into)}${'○'.repeat(need - into)}`;
}

export function setStats(el: HTMLElement, atk: number, hp: number): void {
  el.querySelector('.atk')!.textContent = String(atk);
  el.querySelector('.hp')!.textContent = String(Math.max(0, hp));
}

let toastTimer = 0;
export function toast(text: string): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), 2200);
}

export function float(target: HTMLElement, text: string, kind: 'dmg' | 'buff'): void {
  const f = h('span', { class: `float ${kind}` }, text);
  target.append(f);
  window.setTimeout(() => f.remove(), 900);
}

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
