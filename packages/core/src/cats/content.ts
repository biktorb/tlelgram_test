// Content of «Коты против пылесосов», modelled on Vampire Survivors: weapons
// level up to 8, passives up to 5, and passives change the cat's stats that
// every weapon reads. Numbers are tuned with `npm run balance:cats`.

export type EnemyKind =
  // Квартира
  | 'mouse'
  | 'redmouse'
  | 'dust'
  | 'mite'
  | 'moth'
  | 'robot'
  | 'wetbot'
  | 'rat'
  | 'brush'
  | 'bigvac'
  | 'bigrobot'
  | 'mop'
  // Двор
  | 'pigeon'
  | 'crow'
  | 'dog'
  | 'trimmer'
  | 'wasp'
  | 'mower'
  | 'tractor'
  | 'goose'
  | 'hound'
  | 'combine'
  | 'bulldog'
  | 'blower'
  // Склад пылесосов
  | 'minibot'
  | 'redbot'
  | 'hose'
  | 'scrubber'
  | 'drone'
  | 'washer'
  | 'steamer'
  | 'roller'
  | 'cyclone'
  | 'tank'
  | 'industrial'
  | 'king'
  // Everywhere
  | 'wall'
  | 'cleaner';

export interface EnemyDef {
  name: string;
  r: number;
  hp: number; // the same all run, as in VS; elites, bosses and the wall: per cat level
  speed: number;
  dmg: number;
  xp: number;
  // How it moves: straight at the cat; charging along a line it picked;
  // flying across the screen in a flock; dashing at the cat when close;
  // or following the segment ahead of it (the hose).
  move: 'chase' | 'charge' | 'flock' | 'dash' | 'follow';
  fly?: boolean; // passes over furniture
}

// Every room has the cast of Mad Forest in its own skin, with the numbers of
// the VS wiki: health and damage at 70%, speed at 65% (our map is smaller).
// Bat 1 hp → mouse, red-eyed bat 5 → angry mouse, zombie 10, skeleton 15,
// ghost 10 (fast), gray mudman 70, green mudman 150, giant bat 50,
// werewolf 180, giant mummy 500. Damage 5 → 4, 10 → 7, 14 → 10, 20 → 14.
export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  mouse: { name: 'Мышь', r: 10, hp: 1, speed: 90, dmg: 4, xp: 1, move: 'chase' },
  redmouse: { name: 'Злая мышь', r: 11, hp: 4, speed: 90, dmg: 4, xp: 1, move: 'chase' },
  dust: { name: 'Комок пыли', r: 13, hp: 7, speed: 65, dmg: 7, xp: 1, move: 'chase' },
  mite: { name: 'Пылевой клещ', r: 13, hp: 10, speed: 65, dmg: 7, xp: 2, move: 'chase' },
  moth: { name: 'Моль', r: 11, hp: 7, speed: 130, dmg: 4, xp: 1.5, move: 'chase', fly: true },
  robot: { name: 'Робот-пылесос', r: 18, hp: 50, speed: 70, dmg: 7, xp: 2.5, move: 'charge' },
  wetbot: { name: 'Мокрый робот', r: 20, hp: 105, speed: 65, dmg: 7, xp: 2.5, move: 'charge' },
  rat: { name: 'Крыса', r: 16, hp: 35, speed: 90, dmg: 7, xp: 2, move: 'chase' },
  brush: { name: 'Турбощётка', r: 20, hp: 125, speed: 85, dmg: 10, xp: 2, move: 'chase' },
  bigvac: { name: 'Пылесос-гигант', r: 28, hp: 350, speed: 52, dmg: 14, xp: 3, move: 'chase' },
  bigrobot: { name: 'Большой робот', r: 30, hp: 150, speed: 75, dmg: 14, xp: 0, move: 'chase' }, // hp per cat level
  mop: { name: 'Швабра', r: 38, hp: 250, speed: 95, dmg: 30, xp: 0, move: 'chase' }, // hp per cat level

  pigeon: { name: 'Голубь', r: 11, hp: 1, speed: 110, dmg: 4, xp: 1, move: 'flock', fly: true },
  crow: { name: 'Ворона', r: 12, hp: 4, speed: 90, dmg: 4, xp: 1, move: 'chase' },
  trimmer: { name: 'Триммер', r: 15, hp: 7, speed: 65, dmg: 7, xp: 1, move: 'chase' },
  goose: { name: 'Гусь', r: 16, hp: 10, speed: 65, dmg: 7, xp: 2, move: 'chase' },
  wasp: { name: 'Оса', r: 9, hp: 7, speed: 130, dmg: 4, xp: 1.5, move: 'chase', fly: true },
  mower: { name: 'Газонокосилка', r: 22, hp: 50, speed: 60, dmg: 7, xp: 2.5, move: 'chase' },
  tractor: { name: 'Мини-трактор', r: 26, hp: 105, speed: 55, dmg: 7, xp: 2.5, move: 'charge' },
  dog: { name: 'Пёс', r: 16, hp: 35, speed: 80, dmg: 7, xp: 2, move: 'dash' }, // lunges, so a little slower
  hound: { name: 'Овчарка', r: 20, hp: 125, speed: 85, dmg: 10, xp: 2, move: 'dash' },
  combine: { name: 'Садовый комбайн', r: 30, hp: 350, speed: 52, dmg: 14, xp: 3, move: 'chase' },
  bulldog: { name: 'Бульдог', r: 30, hp: 150, speed: 80, dmg: 14, xp: 0, move: 'dash' }, // hp per cat level
  blower: { name: 'Листодув', r: 40, hp: 400, speed: 80, dmg: 35, xp: 0, move: 'chase' }, // hp per cat level

  minibot: { name: 'Мини-робот', r: 8, hp: 1, speed: 95, dmg: 4, xp: 1, move: 'chase' },
  redbot: { name: 'Злой мини-робот', r: 9, hp: 4, speed: 95, dmg: 4, xp: 1, move: 'chase' },
  hose: { name: 'Шланг', r: 12, hp: 7, speed: 70, dmg: 4, xp: 1, move: 'follow' },
  scrubber: { name: 'Поломойка', r: 16, hp: 10, speed: 65, dmg: 7, xp: 2, move: 'chase' },
  drone: { name: 'Дрон', r: 10, hp: 7, speed: 130, dmg: 4, xp: 1.5, move: 'chase', fly: true },
  washer: { name: 'Моющий пылесос', r: 20, hp: 50, speed: 60, dmg: 7, xp: 2.5, move: 'chase' },
  steamer: { name: 'Пароочиститель', r: 24, hp: 105, speed: 55, dmg: 7, xp: 2.5, move: 'charge' }, // a chaser corners the cat in the hall
  roller: { name: 'Робот-полотёр', r: 16, hp: 35, speed: 90, dmg: 7, xp: 2, move: 'charge' },
  cyclone: { name: 'Циклонный пылесос', r: 20, hp: 125, speed: 85, dmg: 10, xp: 2, move: 'chase' },
  tank: { name: 'Пылесос-бак', r: 30, hp: 350, speed: 52, dmg: 14, xp: 3, move: 'chase' },
  industrial: { name: 'Промышленный пылесос', r: 34, hp: 150, speed: 60, dmg: 14, xp: 0, move: 'chase' }, // hp per cat level
  king: { name: 'Король пылесосов', r: 44, hp: 700, speed: 70, dmg: 40, xp: 0, move: 'chase' }, // hp per cat level

  // The flower wall of Mad Forest: a ring that closes in on the cat. Health
  // per cat level; it gives no gems and goes away when its time is up.
  wall: { name: 'Стена пыли', r: 16, hp: 5, speed: 22, dmg: 7, xp: 0, move: 'chase', fly: true },
  // The Reaper: comes at 20:00, cannot be hurt and kills with one touch.
  cleaner: { name: 'Уборщица', r: 24, hp: 1, speed: 230, dmg: 99999, xp: 0, move: 'chase' },
};

export type RoomId = 'flat' | 'yard' | 'warehouse';

// One minute of the VS wave table. Every `every` seconds one of each listed
// kind comes (a kind listed twice comes twice), and while fewer than `min`
// enemies are about, more come at once.
export interface Wave {
  kinds: EnemyKind[];
  min: number;
  every: number; // seconds
  // A swarm flies straight across the screen at great speed: `count` times,
  // `gap` seconds apart, from `at` seconds into the minute, if it happens
  // (`chance`). `ghost` sends the room's fast kind instead of the small one.
  swarm?: { at: number; chance: number; count: number; gap: number; ghost?: boolean };
  wall?: number; // seconds the closing wall stays
}

// The parts of the Mad Forest cast; each room fills them with its own kinds.
type Part = 'bat' | 'redbat' | 'zombie' | 'skeleton' | 'ghost' | 'mud' | 'greenmud' | 'bigbat' | 'wolf' | 'mummy';

// Mad Forest, minutes 0–19 (from the VS wiki), for our 20-minute room: the
// last minute is the wiki's 20:00, with its big swarm.
const MAD_FOREST: { kinds: Part[]; min: number; every: number; swarm?: Wave['swarm']; wall?: number }[] = [
  { kinds: ['redbat'], min: 15, every: 1 },
  { kinds: ['zombie'], min: 30, every: 1 },
  { kinds: ['bat', 'redbat', 'redbat'], min: 50, every: 0.5, swarm: { at: 5, chance: 1, count: 3, gap: 5 } },
  { kinds: ['skeleton'], min: 40, every: 0.25, swarm: { at: 5, chance: 0.1, count: 2, gap: 5 } },
  { kinds: ['skeleton'], min: 30, every: 1, swarm: { at: 5, chance: 0.1, count: 2, gap: 5 } },
  { kinds: ['greenmud'], min: 10, every: 1, wall: 30 },
  { kinds: ['zombie', 'greenmud'], min: 20, every: 0.5, swarm: { at: 5, chance: 0.1, count: 2, gap: 5 } },
  { kinds: ['bat', 'redbat', 'redbat', 'mud'], min: 80, every: 0.5, swarm: { at: 5, chance: 0.8, count: 6, gap: 5 } },
  { kinds: ['zombie'], min: 100, every: 1.5, swarm: { at: 15, chance: 0.8, count: 3, gap: 15 } },
  { kinds: ['bigbat'], min: 30, every: 0.5, swarm: { at: 15, chance: 0.7, count: 3, gap: 15 } },
  { kinds: ['mud', 'greenmud'], min: 10, every: 0.5, wall: 60 },
  { kinds: ['skeleton'], min: 300, every: 0.1, swarm: { at: 5, chance: 0.1, count: 2, gap: 5 } },
  { kinds: ['wolf'], min: 20, every: 0.25, swarm: { at: 5, chance: 0.1, count: 2, gap: 5 } },
  { kinds: ['wolf', 'ghost', 'ghost'], min: 150, every: 0.5, swarm: { at: 1, chance: 0.7, count: 20, gap: 1.2, ghost: true } },
  { kinds: ['bigbat'], min: 20, every: 0.1 },
  { kinds: ['wolf', 'bigbat', 'greenmud'], min: 100, every: 0.1, wall: 60 },
  { kinds: ['mummy', 'mud', 'greenmud'], min: 100, every: 0.1 },
  { kinds: ['mummy'], min: 20, every: 1 },
  { kinds: ['mummy', 'mud'], min: 60, every: 0.5 },
  { kinds: ['mummy', 'greenmud', 'bigbat'], min: 100, every: 0.1, swarm: { at: 1, chance: 0.7, count: 20, gap: 1.2 } },
];

function madForest(cast: Record<Part, EnemyKind>): Wave[] {
  return MAD_FOREST.map((w) => ({ ...w, kinds: w.kinds.map((k) => cast[k]) }));
}

// The three rooms, like the first maps of VS: own enemies, elite and boss,
// and a shape (endless, a strip between fences, a closed hall).
export interface RoomDef {
  name: string;
  shape: 'open' | 'strip' | 'hall';
  waves: Wave[]; // one per minute
  crowd: number; // times the minute's least and its rate: the strip between fences fills up faster
  swarm: EnemyKind; // what flies in swarms
  ghost: EnemyKind; // the fast swarm
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
    crowd: 1,
    waves: madForest({ bat: 'mouse', redbat: 'redmouse', zombie: 'dust', skeleton: 'mite', ghost: 'moth', mud: 'robot', greenmud: 'wetbot', bigbat: 'rat', wolf: 'brush', mummy: 'bigvac' }),
    swarm: 'mouse',
    ghost: 'moth',
    elite: 'bigrobot',
    miniElite: 'rat',
    boss: 'mop',
    minion: 'dust',
    after: null,
  },
  yard: {
    name: 'Двор',
    shape: 'strip',
    crowd: 0.6,
    waves: madForest({ bat: 'pigeon', redbat: 'crow', zombie: 'trimmer', skeleton: 'goose', ghost: 'wasp', mud: 'mower', greenmud: 'tractor', bigbat: 'dog', wolf: 'hound', mummy: 'combine' }),
    swarm: 'pigeon',
    ghost: 'wasp',
    elite: 'bulldog',
    miniElite: 'goose', // not the dog: a giant lunging dog at 1:00 is unfair
    boss: 'blower',
    minion: 'pigeon',
    after: 'flat',
  },
  warehouse: {
    name: 'Склад пылесосов',
    shape: 'hall',
    crowd: 1,
    waves: madForest({ bat: 'minibot', redbat: 'redbot', zombie: 'hose', skeleton: 'scrubber', ghost: 'drone', mud: 'washer', greenmud: 'steamer', bigbat: 'roller', wolf: 'cyclone', mummy: 'tank' }),
    swarm: 'minibot',
    ghost: 'drone',
    elite: 'industrial',
    miniElite: 'roller',
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
    [{ amount: 1 }, { speed: 0.3, area: 0.25 }, { duration: 0.5, dmg: 10 }, { amount: 1 }, { speed: 0.3, area: 0.25 }, { duration: 0.5, dmg: 10 }, { amount: 1 }],
  ),
  // Garlic: an aura that hurts enemies around the cat.
  meow: weapon(
    'Мяу',
    'Мурчащая аура ранит всех, кто подошёл к коту',
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
  // Axe: pots fly up and fall in an arc, through several enemies (3 at
  // first, as the VS pierce 3: it passes through 2).
  pot: weapon(
    'Цветочный горшок',
    'Горшки летят вверх и падают по дуге',
    { dmg: 20, cd: 4, amount: 1, area: 1, speed: 1, duration: 0, pierce: 2 },
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
  if (level < 40) return 195 + (level - 20) * 13 + (level === 20 ? 600 : 0);
  return 455 + (level - 40) * 16 + (level === 40 ? 2400 : 0);
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
