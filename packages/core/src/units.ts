import type { UnitDef } from './types.ts';

// Placeholder names: the setting is not chosen yet, ids stay stable.
export const UNITS: UnitDef[] = [
  // Tier 1
  { id: 'recruit', name: 'Новобранец', tier: 1, atk: 2, hp: 2, trigger: 'faint',
    effect: { kind: 'buff', atk: 1, hp: 1, target: 'randomFriend' },
    text: 'Погибая: случайному другу +1/+1.' },
  { id: 'scout', name: 'Разведчик', tier: 1, atk: 2, hp: 2, trigger: 'startBattle',
    effect: { kind: 'damage', amount: 1, target: 'randomEnemy' },
    text: 'Начало боя: 1 урона случайному врагу.' },
  { id: 'squire', name: 'Оруженосец', tier: 1, atk: 2, hp: 2, trigger: 'sell',
    effect: { kind: 'buff', atk: 0, hp: 1, target: 'randomFriend', count: 2 },
    text: 'При продаже: двум случайным друзьям +0/+1.' },
  { id: 'cook', name: 'Повар', tier: 1, atk: 2, hp: 3, trigger: 'buy',
    effect: { kind: 'buff', atk: 1, hp: 1, target: 'randomFriend' },
    text: 'При покупке: случайному другу +1/+1.' },
  { id: 'militia', name: 'Ополченец', tier: 1, atk: 1, hp: 2, trigger: 'faint',
    effect: { kind: 'summon', token: 'spirit', atk: 1, hp: 1 },
    text: 'Погибая: призывает Духа 1/1.' },
  { id: 'drummer', name: 'Барабанщик', tier: 1, atk: 2, hp: 3, trigger: 'levelUp',
    effect: { kind: 'buff', atk: 1, hp: 1, target: 'allFriends' },
    text: 'При повышении уровня: всем друзьям +1/+1.' },

  // Tier 2
  { id: 'archer', name: 'Лучник', tier: 2, atk: 2, hp: 3, trigger: 'hurt',
    effect: { kind: 'damage', amount: 2, target: 'randomEnemy' },
    text: 'Получив урон: 2 урона случайному врагу.' },
  { id: 'healer', name: 'Знахарь', tier: 2, atk: 1, hp: 3, trigger: 'endTurn',
    effect: { kind: 'buff', atk: 0, hp: 2, target: 'friendAhead' },
    text: 'Конец хода: другу впереди +0/+2.' },
  { id: 'banner', name: 'Знаменосец', tier: 2, atk: 2, hp: 2, trigger: 'friendSummoned',
    effect: { kind: 'buff', atk: 1, hp: 1, target: 'source' },
    text: 'Когда призван друг: ему +1/+1.' },
  { id: 'shield', name: 'Щитоносец', tier: 2, atk: 1, hp: 5, trigger: 'hurt',
    effect: { kind: 'buff', atk: 1, hp: 0, target: 'self' },
    text: 'Получив урон: себе +1 атаки.' },
  { id: 'merchant', name: 'Торговец', tier: 2, atk: 2, hp: 2, trigger: 'startTurn',
    effect: { kind: 'gold', amount: 1 },
    text: 'Начало хода: +1 монета.' },
  { id: 'avenger', name: 'Мститель', tier: 2, atk: 2, hp: 3, trigger: 'friendAheadFaints',
    effect: { kind: 'buff', atk: 2, hp: 1, target: 'self' },
    text: 'Когда гибнет друг впереди: себе +2/+1.' },

  // Tier 3
  { id: 'sniper', name: 'Снайпер', tier: 3, atk: 2, hp: 3, trigger: 'startBattle',
    effect: { kind: 'damage', amount: 3, target: 'lowestHpEnemy' },
    text: 'Начало боя: 3 урона самому слабому врагу.' },
  { id: 'giant', name: 'Великан', tier: 3, atk: 4, hp: 7,
    text: 'Без умения. Просто большой.' },
  { id: 'priest', name: 'Жрец', tier: 3, atk: 2, hp: 3, trigger: 'faint',
    effect: { kind: 'buff', atk: 1, hp: 1, target: 'friendsBehind', count: 2 },
    text: 'Погибая: двум друзьям позади +1/+1.' },
  { id: 'berserker', name: 'Берсерк', tier: 3, atk: 3, hp: 3, trigger: 'knockOut',
    effect: { kind: 'buff', atk: 2, hp: 2, target: 'self' },
    text: 'Убив врага: себе +2/+2.' },
  { id: 'bard', name: 'Бард', tier: 3, atk: 2, hp: 3, trigger: 'endTurn',
    effect: { kind: 'buff', atk: 1, hp: 1, target: 'randomFriend' },
    text: 'Конец хода: случайному другу +1/+1.' },
  { id: 'bomber', name: 'Подрывник', tier: 3, atk: 3, hp: 2, trigger: 'faint',
    effect: { kind: 'damage', amount: 2, target: 'everyone' },
    text: 'Погибая: 2 урона всем, и своим тоже.' },

  // Tier 4
  { id: 'knight', name: 'Рыцарь', tier: 4, atk: 4, hp: 5, trigger: 'startBattle',
    effect: { kind: 'buff', atk: 0, hp: 2, target: 'adjacentFriends' },
    text: 'Начало боя: соседям +0/+2.' },
  { id: 'mage', name: 'Маг', tier: 4, atk: 3, hp: 3, trigger: 'startBattle',
    effect: { kind: 'damage', amount: 2, target: 'randomEnemy', count: 2 },
    text: 'Начало боя: 2 урона двум случайным врагам.' },
  { id: 'champion', name: 'Чемпион', tier: 4, atk: 4, hp: 6, trigger: 'beforeAttack',
    effect: { kind: 'buff', atk: 1, hp: 0, target: 'self' },
    text: 'Перед атакой: себе +1 атаки.' },
  { id: 'summoner', name: 'Призыватель', tier: 4, atk: 2, hp: 3, trigger: 'faint',
    effect: { kind: 'summon', token: 'spirit', atk: 2, hp: 2, count: 2 },
    text: 'Погибая: призывает двух Духов 2/2.' },
  { id: 'warlord', name: 'Полководец', tier: 4, atk: 3, hp: 4, trigger: 'endTurn',
    effect: { kind: 'buff', atk: 1, hp: 1, target: 'randomFriend', count: 2 },
    text: 'Конец хода: двум случайным друзьям +1/+1.' },
  { id: 'assassin', name: 'Ассасин', tier: 4, atk: 5, hp: 2, trigger: 'startBattle',
    effect: { kind: 'damage', amount: 3, target: 'highestAtkEnemy' },
    text: 'Начало боя: 3 урона самому сильному врагу.' },

  // Tokens
  { id: 'spirit', name: 'Дух', tier: 0, atk: 1, hp: 1, text: 'Призванный союзник.' },
];

export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));

export function def(id: string): UnitDef {
  const d = UNIT_BY_ID[id];
  if (!d) throw new Error(`Unknown unit: ${id}`);
  return d;
}

export function levelOf(xp: number): number {
  return xp >= 5 ? 3 : xp >= 2 ? 2 : 1;
}

export const SHOP_UNITS = UNITS.filter((u) => u.tier > 0);
