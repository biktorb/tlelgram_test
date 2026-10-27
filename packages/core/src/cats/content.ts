// Content of «Коты против пылесосов», modelled on Vampire Survivors: weapons
// level up to 8, passives up to 5, and passives change the cat's stats that
// every weapon reads. Numbers are tuned with `npm run balance:cats`.

export type EnemyKind =
  | 'mouse'
  | 'dust'
  | 'robot'
  | 'bigrobot'
  | 'mop'
  | 'pigeon'
  | 'dog'
  | 'mower'
  | 'bulldog'
  | 'blower'
  | 'hose'
  | 'washer'
  | 'minibot'
  | 'industrial'
  | 'king'
  | 'cleaner';

export interface EnemyDef {
  name: string;
  r: number;
  hp: number; // at minute 0; grows with time (BALANCE.hp*)
  speed: number;
  dmg: number;
  xp: number;
  // How it moves: straight at the cat; charging along a line it picked;
  // flying across the screen in a flock; dashing at the cat when close;
  // or following the segment ahead of it (the hose).
  move: 'chase' | 'charge' | 'flock' | 'dash' | 'follow';
}

// Health is about 40% of the design table (as in the flat: mice 4 for 10),
// elites and bosses are per cat level or fixed like the mop.
export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  // Квартира, modelled on Mad Forest at about 70% of its health and damage:
  // mice are bats (weak, the fastest chasers), dust is zombies and skeletons,
  // robots are mudmen that charge, the big robot is the Mantichana-type elite.
  mouse: { name: 'Мышь', r: 10, hp: 4, speed: 90, dmg: 4, xp: 1, move: 'chase' },
  dust: { name: 'Комок пыли', r: 13, hp: 10, speed: 65, dmg: 7, xp: 1.5, move: 'chase' },
  robot: { name: 'Робот-пылесос', r: 18, hp: 50, speed: 125, dmg: 7, xp: 2.5, move: 'charge' },
  bigrobot: { name: 'Большой робот', r: 30, hp: 60, speed: 75, dmg: 10, xp: 0, move: 'chase' }, // hp per cat level
  mop: { name: 'Швабра', r: 38, hp: 9000, speed: 95, dmg: 30, xp: 0, move: 'chase' },
  // Двор, like the Library: flocks sweep across, dogs lunge, mowers are tanks.
  pigeon: { name: 'Голубь', r: 11, hp: 5, speed: 120, dmg: 4, xp: 1, move: 'flock' },
  dog: { name: 'Пёс', r: 16, hp: 20, speed: 72, dmg: 6, xp: 2, move: 'dash' },
  mower: { name: 'Газонокосилка', r: 24, hp: 60, speed: 50, dmg: 12, xp: 4, move: 'chase' },
  bulldog: { name: 'Бульдог', r: 30, hp: 80, speed: 80, dmg: 10, xp: 0, move: 'dash' }, // hp per cat level
  blower: { name: 'Листодув', r: 40, hp: 18000, speed: 80, dmg: 35, xp: 0, move: 'chase' },
  // Склад пылесосов, like the Gallo Tower: a hose snakes, washers leave
  // slippery water, minibots come in swarms.
  hose: { name: 'Шланг', r: 12, hp: 12, speed: 80, dmg: 4, xp: 1.5, move: 'follow' },
  washer: { name: 'Моющий пылесос', r: 20, hp: 48, speed: 60, dmg: 7, xp: 3, move: 'chase' },
  minibot: { name: 'Мини-робот', r: 7, hp: 3, speed: 105, dmg: 3, xp: 1, move: 'chase' },
  industrial: { name: 'Промышленный пылесос', r: 34, hp: 120, speed: 60, dmg: 12, xp: 0, move: 'chase' }, // hp per cat level
  king: { name: 'Король пылесосов', r: 44, hp: 36000, speed: 70, dmg: 40, xp: 0, move: 'chase' },
  // The Reaper: comes at 20:00, cannot be hurt and kills with one touch.
  cleaner: { name: 'Уборщица', r: 24, hp: 1, speed: 230, dmg: 99999, xp: 0, move: 'chase' },
};

export type RoomId = 'flat' | 'yard' | 'warehouse';

// The three rooms, like the first maps of VS: own enemies, elite and boss,
// and a shape (endless, a strip between fences, a closed hall).
export interface RoomDef {
  name: string;
  shape: 'open' | 'strip' | 'hall';
  // Enemy mix by minute: weights of each kind.
  waves: { from: number; mix: Partial<Record<EnemyKind, number>> }[];
  elite: EnemyKind; // at 5, 10 and 15 minutes, with a chest
  miniElite: EnemyKind; // a giant one of these in between, also with a chest
  boss: EnemyKind; // at 18 minutes
  minion: EnemyKind; // what the boss calls in
  // Opened by surviving the room before it to 20:00.
  after: RoomId | null;
}

export const ROOMS: Record<RoomId, RoomDef> = {
  flat: {
    name: 'Квартира',
    shape: 'open',
    waves: [
      { from: 0, mix: { mouse: 1 } },
      { from: 3, mix: { mouse: 0.7, dust: 0.3 } },
      { from: 6, mix: { mouse: 0.5, dust: 0.42, robot: 0.08 } },
      { from: 10, mix: { mouse: 0.4, dust: 0.45, robot: 0.15 } },
      { from: 15, mix: { mouse: 0.35, dust: 0.4, robot: 0.25 } },
    ],
    elite: 'bigrobot',
    miniElite: 'dust',
    boss: 'mop',
    minion: 'dust',
    after: null,
  },
  yard: {
    name: 'Двор',
    shape: 'strip',
    waves: [
      { from: 0, mix: { pigeon: 1 } },
      { from: 3, mix: { pigeon: 0.6, dog: 0.4 } },
      { from: 6, mix: { pigeon: 0.45, dog: 0.45, mower: 0.1 } },
      { from: 10, mix: { pigeon: 0.4, dog: 0.4, mower: 0.2 } },
      // The last minutes bring the flat's enemies too.
      { from: 15, mix: { pigeon: 0.3, dog: 0.3, mower: 0.15, mouse: 0.1, dust: 0.1, robot: 0.05 } },
    ],
    elite: 'bulldog',
    miniElite: 'dog',
    boss: 'blower',
    minion: 'pigeon',
    after: 'flat',
  },
  warehouse: {
    name: 'Склад пылесосов',
    shape: 'hall',
    waves: [
      { from: 0, mix: { minibot: 1 } },
      { from: 3, mix: { minibot: 0.6, hose: 0.4 } },
      { from: 6, mix: { minibot: 0.45, hose: 0.4, washer: 0.15 } },
      { from: 10, mix: { minibot: 0.4, hose: 0.35, washer: 0.25 } },
      { from: 15, mix: { minibot: 0.3, hose: 0.25, washer: 0.2, dog: 0.1, mower: 0.05, robot: 0.1 } },
    ],
    elite: 'industrial',
    miniElite: 'washer',
    boss: 'king',
    minion: 'minibot',
    after: 'yard',
  },
};
export const ROOM_IDS = Object.keys(ROOMS) as RoomId[];
export const isRoom = (id: unknown): id is RoomId => typeof id === 'string' && Object.hasOwn(ROOMS, id);

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

// A weapon at level 8 plus its passive becomes its evolution from the next
// chest, as in Vampire Survivors.
export interface EvolutionDef {
  name: string;
  passive: PassiveId;
  desc: string;
}

export const EVOLUTIONS: Record<WeaponId, EvolutionDef> = {
  claws: { name: 'Когти тигра', passive: 'belly', desc: 'Бьют в обе стороны, шире, и каждый удар лечит кота' },
  laser: { name: 'Лазерное шоу', passive: 'box', desc: 'Стреляет без паузы' },
  fish: { name: 'Рыбный дождь', passive: 'paws', desc: 'Непрерывный поток рыбок' },
  yarn: { name: 'Вечный клубок', passive: 'patience', desc: 'Клубки кружат не переставая' },
  meow: { name: 'Оглушительное МЯУ', passive: 'purr', desc: 'Аура больше и лечит за каждого задетого' },
  glass: { name: 'Потоп', passive: 'catnip', desc: 'Лужи растут и ползут за котом' },
  pot: { name: 'Кактусопад', passive: 'bigpaws', desc: 'Горшки разлетаются спиралью и пробивают всех' },
  spark: { name: 'Грозовой кот', passive: 'pack', desc: 'Каждая искра бьёт дважды' },
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

// The cats, like the heroes of VS: own starting weapon and stats, and a
// bonus that grows with the cat's level (applied in CatRun.recompute).
export interface HeroDef {
  name: string;
  title: string;
  weapon: WeaponId;
  stats: Partial<Stats>;
  bonus: string;
  // How the cat is opened: for fish in the shop, or by an achievement.
  unlock: { fish: number } | { surviveMin: number } | { kills: number } | null;
}

export const HEROES = {
  ryzhik: {
    name: 'Рыжик',
    title: 'дворовый боец',
    weapon: 'claws',
    stats: { maxHp: 120, armor: 1 },
    bonus: '+1 броня каждые 10 уровней, до +5',
    unlock: null,
  },
  murka: {
    name: 'Мурка',
    title: 'сиамская умница',
    weapon: 'laser',
    stats: {},
    bonus: '+10% опыта, +20% с 10 уровня, +30% с 20-го',
    unlock: { fish: 300 },
  },
  barsik: {
    name: 'Барсик',
    title: 'пухлый мейн-кун',
    weapon: 'yarn',
    stats: { maxHp: 160, move: 150 * 0.85 },
    bonus: '+10% области атак, +20% с 10 уровня, +30% с 20-го',
    unlock: { surviveMin: 10 },
  },
  snezhok: {
    name: 'Снежок',
    title: 'шустрый сфинкс',
    weapon: 'fish',
    stats: { maxHp: 80, move: 150 * 1.25 },
    bonus: '+1 снаряд ко всему оружию с 20 уровня',
    unlock: { kills: 5000 },
  },
} satisfies Record<string, HeroDef>;
export type HeroId = keyof typeof HEROES;
export const HERO_IDS = Object.keys(HEROES) as HeroId[];
export const isHero = (id: unknown): id is HeroId => typeof id === 'string' && Object.hasOwn(HEROES, id);

// How the unlock reads in the cat list.
export function unlockText(id: HeroId): string {
  const u: HeroDef['unlock'] = HEROES[id].unlock;
  if (!u) return 'открыт сразу';
  if ('fish' in u) return `${u.fish} рыбок`;
  if ('surviveMin' in u) return `продержаться ${u.surviveMin} минут`;
  return `победить ${u.kills} врагов за все забеги`;
}

// Power Ups, as in VS: permanent bonuses bought with fish between runs. A run
// keeps the levels it started with, so replays use them too.
export interface PowerDef {
  name: string;
  desc: string; // per level
  max: number;
  base: number; // fish for level 1
}

export const POWERS = {
  might: { name: 'Сила', desc: '+5% урона', max: 5, base: 40 },
  armor: { name: 'Броня', desc: '−1 к полученному урону', max: 3, base: 60 },
  maxHp: { name: 'Здоровье', desc: '+10% здоровья', max: 3, base: 30 },
  recovery: { name: 'Регенерация', desc: '+0,1 здоровья в секунду', max: 5, base: 40 },
  move: { name: 'Скорость', desc: '+5% скорости кота', max: 2, base: 50 },
  area: { name: 'Область', desc: '+5% области атак', max: 2, base: 60 },
  cooldown: { name: 'Перезарядка', desc: '−2,5% перезарядки', max: 2, base: 90 },
  magnet: { name: 'Магнит', desc: '+25% радиуса сбора', max: 2, base: 30 },
  luck: { name: 'Удача', desc: '+10% удачи', max: 3, base: 60 },
  growth: { name: 'Рост', desc: '+3% опыта', max: 5, base: 90 },
  greed: { name: 'Жадность', desc: '+10% рыбок за забег', max: 5, base: 30 },
  reroll: { name: 'Реролл', desc: '+1 реролл за забег', max: 3, base: 100 },
  revive: { name: 'Девятая жизнь', desc: 'одно воскрешение с половиной здоровья', max: 1, base: 500 },
} satisfies Record<string, PowerDef>;
export type PowerId = keyof typeof POWERS;
export const POWER_IDS = Object.keys(POWERS) as PowerId[];
export const isPower = (id: unknown): id is PowerId => typeof id === 'string' && Object.hasOwn(POWERS, id);
export type Powers = Partial<Record<PowerId, number>>;

// The next level costs base × that level, plus 10% for every level of any
// Power Up bought before, as in VS.
export function powerPrice(id: PowerId, powers: Powers): number {
  const bought = POWER_IDS.reduce((n, p) => n + (powers[p] ?? 0), 0);
  return Math.round(POWERS[id].base * ((powers[id] ?? 0) + 1) * (1 + 0.1 * bought));
}

// Keeps only known Power Ups within their levels, for levels read from outside.
export function cleanPowers(x: unknown): Powers {
  const out: Powers = {};
  if (!x || typeof x !== 'object') return out;
  for (const [k, v] of Object.entries(x)) {
    if (isPower(k) && Number.isInteger(v) && (v as number) > 0) out[k] = Math.min(v as number, POWERS[k].max);
  }
  return out;
}

// Fish a run pays out, with the Greed bonus.
export const runFish = (fish: number, powers: Powers): number => Math.round(fish * (1 + 0.1 * (powers.greed ?? 0)));
