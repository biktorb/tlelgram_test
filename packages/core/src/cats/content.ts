// Content of «Коты против пылесосов», modelled on Vampire Survivors: weapons
// level up to 8, passives up to 5, and passives change the cat's stats that
// every weapon reads. Numbers are tuned with `npm run balance:cats`.

export type EnemyKind = 'mouse' | 'dust' | 'robot' | 'bigrobot' | 'mop';

export interface EnemyDef {
  name: string;
  r: number;
  hp: number; // at minute 0; grows with time (BALANCE.hp*)
  speed: number;
  dmg: number;
  xp: number;
  // How it moves: straight at the cat, or charging along a line it picked.
  move: 'chase' | 'charge';
}

// Modelled on Mad Forest at about 70% of its health and damage: mice are
// bats (weak, the fastest chasers), dust is zombies and skeletons, robots
// are mudmen that charge, the big robot is the Mantichana-type elite.
export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  mouse: { name: 'Мышь', r: 10, hp: 4, speed: 110, dmg: 4, xp: 1, move: 'chase' },
  dust: { name: 'Комок пыли', r: 13, hp: 10, speed: 80, dmg: 7, xp: 1.5, move: 'chase' },
  robot: { name: 'Робот-пылесос', r: 18, hp: 50, speed: 145, dmg: 7, xp: 2.5, move: 'charge' },
  bigrobot: { name: 'Большой робот', r: 30, hp: 60, speed: 85, dmg: 10, xp: 0, move: 'chase' }, // hp per cat level
  mop: { name: 'Швабра', r: 38, hp: 9000, speed: 95, dmg: 30, xp: 0, move: 'chase' },
};

// The cat's stats. Weapons read them, passives and the hero change them.
export interface Stats {
  maxHp: number;
  recovery: number; // health per second
  armor: number; // subtracted from every hit taken
  move: number; // movement speed, units per second
  might: number; // damage multiplier
  area: number; // size multiplier
  speed: number; // projectile speed multiplier
  duration: number; // effect duration multiplier
  amount: number; // extra projectiles
  cooldown: number; // cooldown multiplier, lower is faster
  magnet: number; // pickup radius
  luck: number; // 1 = normal; chance of a 4th card is 1 - 1/luck
  growth: number; // experience multiplier
}

export const BASE_STATS: Stats = {
  maxHp: 100,
  recovery: 0,
  armor: 0,
  move: 150,
  might: 1,
  area: 1,
  speed: 1,
  duration: 1,
  amount: 0,
  cooldown: 1,
  magnet: 80,
  luck: 1,
  growth: 1,
};

export type WeaponId = 'claws' | 'laser' | 'fish' | 'yarn' | 'meow' | 'glass' | 'pot' | 'spark';
export type PassiveId = 'belly' | 'box' | 'paws' | 'patience' | 'purr' | 'catnip' | 'bigpaws' | 'pack' | 'food' | 'blackcat';
export type ItemId = WeaponId | PassiveId;
// Cards offered when every slot is full and maxed.
export type ExtraId = 'snack' | 'fishes';
export type CardId = ItemId | ExtraId;

// A weapon's own numbers; the cat's stats scale them.
export interface WeaponStats {
  dmg: number;
  cd: number; // seconds between attacks
  amount: number; // projectiles per attack
  area: number; // size multiplier
  speed: number; // projectile speed multiplier
  duration: number; // seconds an effect lasts
  pierce: number; // enemies a projectile passes through
}

export interface WeaponDef {
  name: string;
  base: WeaponStats;
  // What levels 2..8 add, in order.
  levels: Partial<WeaponStats>[];
  desc: string[]; // card text for levels 1..8
}

const MAX_WEAPON = 8;
export const WEAPON_MAX = MAX_WEAPON;
export const PASSIVE_MAX = 5;
export const SLOTS = 6;

// Card text for a level-up from the numbers it adds.
function describe(d: Partial<WeaponStats>): string {
  const parts: string[] = [];
  if (d.amount) parts.push(`+${d.amount} снаряд`);
  if (d.dmg) parts.push(`урон +${d.dmg}`);
  if (d.area) parts.push(`область +${Math.round(d.area * 100)}%`);
  if (d.cd) parts.push(`перезарядка ${d.cd} с`);
  if (d.speed) parts.push(`скорость +${Math.round(d.speed * 100)}%`);
  if (d.duration) parts.push(`дольше на ${d.duration} с`);
  if (d.pierce) parts.push(`пробивает +${d.pierce}`);
  return parts.join(', ');
}

function weapon(name: string, first: string, base: WeaponStats, levels: Partial<WeaponStats>[]): WeaponDef {
  if (levels.length !== MAX_WEAPON - 1) throw new Error(`${name}: ${levels.length} levels`);
  return { name, base, levels, desc: [first, ...levels.map(describe)] };
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  // Whip: a slash to the side the cat faces, later behind it too.
  claws: weapon(
    'Когти',
    'Удар когтями в сторону, куда смотрит кот',
    { dmg: 10, cd: 1.35, amount: 1, area: 1, speed: 1, duration: 0, pierce: 0 },
    [{ amount: 1 }, { dmg: 5 }, { dmg: 5, area: 0.1 }, { dmg: 5 }, { dmg: 5, area: 0.1 }, { dmg: 5 }, { dmg: 5 }],
  ),
  // Magic wand: shots at the nearest enemy.
  laser: weapon(
    'Лазерная указка',
    'Точка летит в ближайшего врага',
    { dmg: 10, cd: 1.2, amount: 1, area: 1, speed: 1, duration: 0, pierce: 0 },
    [{ amount: 1 }, { cd: -0.2 }, { amount: 1 }, { dmg: 10 }, { amount: 1 }, { pierce: 1 }, { dmg: 10 }],
  ),
  // Knife: fast fish in the direction the cat moves.
  fish: weapon(
    'Метательная рыбка',
    'Быстрые рыбки летят туда, куда бежит кот',
    { dmg: 7, cd: 1, amount: 1, area: 1, speed: 1, duration: 0, pierce: 0 },
    [{ amount: 1 }, { amount: 1, dmg: 5 }, { amount: 1 }, { pierce: 1 }, { amount: 1 }, { amount: 1, dmg: 5 }, { pierce: 1 }],
  ),
  // King Bible: yarn balls circle the cat for a while.
  yarn: weapon(
    'Клубок',
    'Клубки кружат вокруг кота',
    { dmg: 10, cd: 3, amount: 1, area: 1, speed: 1, duration: 3, pierce: 0 },
    [{ amount: 1 }, { speed: 0.25, area: 0.25 }, { duration: 0.5, dmg: 10 }, { amount: 1 }, { speed: 0.25, area: 0.25 }, { duration: 0.5, dmg: 10 }, { amount: 1 }],
  ),
  // Garlic: an aura that hurts and pushes enemies around the cat.
  meow: weapon(
    'Мяу',
    'Громкое мяу ранит и отталкивает всех рядом',
    { dmg: 5, cd: 1.3, amount: 1, area: 1, speed: 1, duration: 0, pierce: 0 },
    [{ area: 0.4, dmg: 2 }, { cd: -0.1, dmg: 1 }, { area: 0.2, dmg: 1 }, { cd: -0.1, dmg: 2 }, { area: 0.2, dmg: 1 }, { cd: -0.1, dmg: 1 }, { area: 0.2, dmg: 1 }],
  ),
  // Santa water: puddles that hurt whoever stands in them.
  glass: weapon(
    'Опрокинутый стакан',
    'Лужа на полу ранит всех, кто в ней',
    { dmg: 10, cd: 4.5, amount: 1, area: 1, speed: 1, duration: 2, pierce: 0 },
    [{ amount: 1, area: 0.2 }, { dmg: 10, duration: 0.5 }, { amount: 1, area: 0.2 }, { dmg: 10, duration: 0.3 }, { amount: 1, area: 0.2 }, { dmg: 5, duration: 0.3 }, { dmg: 5, area: 0.2 }],
  ),
  // Axe: pots fly up and fall in an arc, through several enemies.
  pot: weapon(
    'Цветочный горшок',
    'Горшки летят вверх и падают по дуге',
    { dmg: 20, cd: 4, amount: 1, area: 1, speed: 1, duration: 0, pierce: 3 },
    [{ amount: 1 }, { dmg: 20 }, { pierce: 2 }, { amount: 1 }, { dmg: 20 }, { pierce: 2 }, { dmg: 20 }],
  ),
  // Lightning ring: sparks strike random enemies on screen.
  spark: weapon(
    'Статическая шерсть',
    'Искры бьют случайных врагов на экране',
    { dmg: 15, cd: 4.5, amount: 2, area: 1, speed: 1, duration: 0, pierce: 0 },
    [{ amount: 1 }, { area: 1, dmg: 10 }, { amount: 1 }, { area: 1, dmg: 20 }, { amount: 1 }, { area: 1, dmg: 20 }, { amount: 1 }],
  ),
};

export interface PassiveDef {
  name: string;
  max: number;
  per: Partial<Stats>; // added per level; maxHp is a share of the base
  desc: string;
}

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  belly: { name: 'Сытый живот', max: 5, per: { maxHp: 0.2 }, desc: 'Здоровье +20%' },
  box: { name: 'Пустая коробка', max: 5, per: { cooldown: -0.08 }, desc: 'Перезарядка −8%' },
  paws: { name: 'Ловкие лапы', max: 5, per: { speed: 0.1 }, desc: 'Скорость снарядов +10%' },
  patience: { name: 'Долгое мурчание', max: 5, per: { duration: 0.1 }, desc: 'Атаки длятся дольше на 10%' },
  purr: { name: 'Мурчалка', max: 5, per: { recovery: 0.2 }, desc: '+0,2 здоровья в секунду' },
  catnip: { name: 'Мята в кармане', max: 5, per: { magnet: 24 }, desc: 'Радиус сбора кристаллов +30%' },
  bigpaws: { name: 'Большие лапы', max: 5, per: { area: 0.1 }, desc: 'Область атак +10%' },
  pack: { name: 'Кошачья стая', max: 2, per: { amount: 1 }, desc: '+1 снаряд ко всему оружию' },
  food: { name: 'Премиальный корм', max: 5, per: { might: 0.1 }, desc: 'Урон +10%' },
  blackcat: { name: 'Чёрная кошка', max: 5, per: { luck: 0.1 }, desc: 'Удача +10%: чаще 4-я карточка' },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
export const PASSIVE_IDS = Object.keys(PASSIVES) as PassiveId[];
export const isWeapon = (id: CardId): id is WeaponId => id in WEAPONS;
export const isPassive = (id: CardId): id is PassiveId => id in PASSIVES;
export const itemMax = (id: ItemId): number => (isWeapon(id) ? WEAPON_MAX : PASSIVES[id].max);

export const EXTRAS: Record<ExtraId, { name: string; desc: string }> = {
  snack: { name: 'Перекус', desc: 'Вылечить 30 здоровья' },
  fishes: { name: 'Горсть рыбок', desc: '+10 рыбок' },
};

export function cardName(id: CardId): string {
  return isWeapon(id) ? WEAPONS[id].name : isPassive(id) ? PASSIVES[id].name : EXTRAS[id].name;
}

// Card text when the item is at `level` now (0 = not owned yet).
export function cardText(id: CardId, level: number): string {
  if (isWeapon(id)) return WEAPONS[id].desc[level] ?? '';
  if (isPassive(id)) return PASSIVES[id].desc;
  return EXTRAS[id].desc;
}

// Experience to go from `level` to the next, as in Vampire Survivors.
export function xpToNext(level: number): number {
  if (level < 20) return 5 + (level - 1) * 10;
  if (level < 40) return 195 + (level - 20) * 13;
  return 455 + (level - 40) * 16;
}

// The hero: for now only Рыжик (more come with the other cats).
export interface HeroDef {
  name: string;
  weapon: WeaponId;
  stats: Partial<Stats>;
}

export const HEROES = {
  ryzhik: { name: 'Рыжик', weapon: 'claws', stats: { maxHp: 120, armor: 1 } },
} satisfies Record<string, HeroDef>;
export type HeroId = keyof typeof HEROES;
