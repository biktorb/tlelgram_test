// Content of «Богатыри против нечисти», modelled on Vampire Survivors: weapons
// level up to 8, passives up to 5, and passives change the hero's stats that
// every weapon reads. Internal ids are still those of the cat version (cats,
// rooms, vacuums), so saved runs replay the same; only the names changed. Numbers are tuned with `npm run balance:cats`.

export type EnemyKind =
  // Дремучий лес
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
  // Муромская дорога
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
  // Кощеево царство
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
  // Knockback taken, as the enemy's own in VS: a hit sends it back at its
  // own speed times this for 0.12 s. Heavy ones barely move.
  kb: number;
}

// Every room has the cast of Mad Forest in its own skin, with the numbers of
// the VS wiki: health and damage at 70%. Speed as in the game's code: an
// enemy walks 0.2541 px/s per point of its speed and the hero 90.75 px/s, so
// with the cat at 136 (our units are 1.5 VS pixels) a point of speed is 0.381.
// Bat 1 hp → mouse, red-eyed bat 5 → angry mouse, zombie 10, skeleton 15,
// ghost 10 (fast), gray mudman 70, green mudman 150, giant bat 270,
// werewolf 180, giant mummy 500. Damage 5 → 4, 10 → 7, 14 → 10, 20 → 14.
export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  mouse: { name: 'Нетопырь', r: 10, hp: 1, speed: 53, dmg: 4, xp: 1, kb: 1, move: 'chase' },
  redmouse: { name: 'Красный нетопырь', r: 11, hp: 4, speed: 53, dmg: 4, xp: 1, kb: 1, move: 'chase' },
  dust: { name: 'Лешачок', r: 13, hp: 7, speed: 38, dmg: 7, xp: 1, kb: 0.8, move: 'chase' },
  mite: { name: 'Кикимора', r: 13, hp: 10, speed: 38, dmg: 7, xp: 2, kb: 1, move: 'chase' },
  moth: { name: 'Блуждающий огонёк', r: 11, hp: 7, speed: 76, dmg: 4, xp: 1.5, kb: 0, move: 'chase', fly: true },
  robot: { name: 'Вепрь', r: 18, hp: 50, speed: 41, dmg: 7, xp: 2.5, kb: 0.3, move: 'charge' },
  wetbot: { name: 'Медведь-шатун', r: 20, hp: 105, speed: 38, dmg: 7, xp: 2.5, kb: 0.3, move: 'charge' },
  rat: { name: 'Волк-вожак', r: 16, hp: 189, speed: 53, dmg: 7, xp: 2.5, kb: 0.1, move: 'chase' },
  brush: { name: 'Серый волк', r: 20, hp: 125, speed: 50, dmg: 10, xp: 2, kb: 0.8, move: 'chase' },
  bigvac: { name: 'Леший', r: 28, hp: 350, speed: 30, dmg: 14, xp: 3, kb: 0, move: 'chase' },
  bigrobot: { name: 'Избушка на курьих ножках', r: 30, hp: 150, speed: 61, dmg: 14, xp: 0, kb: 0, move: 'chase' }, // hp per cat level
  mop: { name: 'Баба-Яга', r: 38, hp: 250, speed: 30, dmg: 14, xp: 0, kb: 0, move: 'chase' }, // hp per cat level

  pigeon: { name: 'Галка', r: 11, hp: 1, speed: 64, dmg: 4, xp: 1, kb: 1, move: 'flock', fly: true },
  crow: { name: 'Сорока-разбойница', r: 12, hp: 4, speed: 53, dmg: 4, xp: 1, kb: 1, move: 'chase' },
  trimmer: { name: 'Разбойник с дубиной', r: 15, hp: 7, speed: 38, dmg: 7, xp: 1, kb: 0.8, move: 'chase' },
  goose: { name: 'Гусь-лебедь', r: 16, hp: 10, speed: 38, dmg: 7, xp: 2, kb: 1, move: 'chase' },
  wasp: { name: 'Шершень', r: 9, hp: 7, speed: 76, dmg: 4, xp: 1.5, kb: 0, move: 'chase', fly: true },
  mower: { name: 'Разбойник с кистенём', r: 22, hp: 50, speed: 35, dmg: 7, xp: 2.5, kb: 0.3, move: 'chase' },
  tractor: { name: 'Тур', r: 26, hp: 105, speed: 32, dmg: 7, xp: 2.5, kb: 0.3, move: 'charge' },
  dog: { name: 'Волколак', r: 16, hp: 189, speed: 47, dmg: 7, xp: 2.5, kb: 0.1, move: 'dash' }, // lunges, so a little slower
  hound: { name: 'Разбойник на коне', r: 20, hp: 125, speed: 50, dmg: 10, xp: 2, kb: 0.8, move: 'dash' },
  combine: { name: 'Атаман', r: 30, hp: 350, speed: 30, dmg: 14, xp: 3, kb: 0, move: 'chase' },
  bulldog: { name: 'Сын Соловья', r: 30, hp: 150, speed: 61, dmg: 14, xp: 0, kb: 0, move: 'dash' }, // hp per cat level
  blower: { name: 'Соловей-Разбойник', r: 40, hp: 400, speed: 30, dmg: 14, xp: 0, kb: 0, move: 'chase' }, // hp per cat level

  minibot: { name: 'Костяшка', r: 8, hp: 1, speed: 56, dmg: 4, xp: 1, kb: 1, move: 'chase' },
  redbot: { name: 'Огненная костяшка', r: 9, hp: 4, speed: 56, dmg: 4, xp: 1, kb: 1, move: 'chase' },
  hose: { name: 'Полоз', r: 12, hp: 7, speed: 41, dmg: 4, xp: 1, kb: 0.8, move: 'follow' },
  scrubber: { name: 'Кощеев стражник', r: 16, hp: 10, speed: 38, dmg: 7, xp: 2, kb: 1, move: 'chase' },
  drone: { name: 'Змеёныш', r: 10, hp: 7, speed: 76, dmg: 4, xp: 1.5, kb: 0, move: 'chase', fly: true },
  washer: { name: 'Чародей', r: 20, hp: 50, speed: 35, dmg: 7, xp: 2.5, kb: 0.3, move: 'chase' },
  steamer: { name: 'Костяной конь', r: 24, hp: 105, speed: 32, dmg: 7, xp: 2.5, kb: 0.3, move: 'charge' }, // a chaser corners the cat in the hall
  roller: { name: 'Чудо-юдо', r: 16, hp: 189, speed: 53, dmg: 7, xp: 2.5, kb: 0.1, move: 'charge' },
  cyclone: { name: 'Чёрный латник', r: 20, hp: 125, speed: 50, dmg: 10, xp: 2, kb: 0.8, move: 'chase' },
  tank: { name: 'Идолище поганое', r: 30, hp: 350, speed: 30, dmg: 14, xp: 3, kb: 0, move: 'chase' },
  industrial: { name: 'Лихо Одноглазое', r: 34, hp: 150, speed: 61, dmg: 14, xp: 0, kb: 0, move: 'chase' }, // hp per cat level
  king: { name: 'Змей Горыныч', r: 44, hp: 700, speed: 30, dmg: 14, xp: 0, kb: 0, move: 'chase' }, // hp per cat level

  // The flower wall of Mad Forest: a ring that closes in on the cat. Health
  // per cat level; it barely hurts, it hems the cat in. It gives no gems and
  // goes away when its time is up.
  wall: { name: 'Чертополох', r: 16, hp: 21, speed: 8, dmg: 1, xp: 0, kb: 1, move: 'chase', fly: true },
  // The Reaper: comes at 20:00, cannot be hurt and kills with one touch.
  cleaner: { name: 'Кощей Бессмертный', r: 24, hp: 1, speed: 200, dmg: 99999, xp: 0, kb: 0, move: 'chase' },
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
  wallChance?: number; // if not always
}

// The parts of the Mad Forest cast; each room fills them with its own kinds.
type Part = 'bat' | 'redbat' | 'zombie' | 'skeleton' | 'ghost' | 'mud' | 'greenmud' | 'bigbat' | 'wolf' | 'mummy';

// Mad Forest, minutes 0–19 (from the game's own STAGE_DATA, v1.16), for our
// 20-minute room: the last minute is its 20:00, with its big swarm.
const MAD_FOREST: { kinds: Part[]; min: number; every: number; swarm?: Wave['swarm']; wall?: number; wallChance?: number }[] = [
  { kinds: ['redbat'], min: 15, every: 1 },
  { kinds: ['zombie', 'bat'], min: 30, every: 1 },
  { kinds: ['bat', 'redbat', 'redbat'], min: 50, every: 0.5, swarm: { at: 5, chance: 1, count: 3, gap: 5 } },
  { kinds: ['skeleton'], min: 40, every: 0.25, swarm: { at: 5, chance: 0.1, count: 2, gap: 5 } },
  { kinds: ['skeleton', 'ghost'], min: 30, every: 0.5, swarm: { at: 5, chance: 0.1, count: 2, gap: 5 } },
  { kinds: ['greenmud'], min: 10, every: 1, wall: 30 },
  { kinds: ['zombie', 'greenmud'], min: 20, every: 0.5, swarm: { at: 5, chance: 0.1, count: 2, gap: 5 } },
  { kinds: ['bat', 'redbat', 'redbat', 'mud'], min: 80, every: 0.5, swarm: { at: 5, chance: 0.8, count: 6, gap: 5 } },
  { kinds: ['zombie'], min: 100, every: 1.5, swarm: { at: 15, chance: 0.8, count: 3, gap: 15 } },
  { kinds: ['bigbat', 'zombie'], min: 30, every: 0.5, swarm: { at: 15, chance: 0.7, count: 3, gap: 15 } },
  { kinds: ['mud', 'greenmud'], min: 10, every: 0.5, wall: 60 },
  { kinds: ['skeleton'], min: 300, every: 0.1, swarm: { at: 5, chance: 0.1, count: 2, gap: 5 } },
  { kinds: ['wolf', 'ghost', 'skeleton'], min: 20, every: 0.25, swarm: { at: 5, chance: 0.1, count: 2, gap: 5 } },
  { kinds: ['wolf', 'ghost', 'ghost'], min: 150, every: 0.5, swarm: { at: 1, chance: 0.7, count: 20, gap: 1.2, ghost: true } },
  { kinds: ['bigbat', 'wolf'], min: 20, every: 0.1 },
  { kinds: ['wolf', 'bigbat', 'greenmud'], min: 100, every: 0.1, wall: 60, wallChance: 0.8 },
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
  // With a chest, as in Mad Forest: at 5:00 a big one of the room (500 health
  // in VS, not per level), at 10:00 the elite, at 15:00 a giant of the
  // room's strongest kind (the werewolf boss: 200 per level).
  brute: EnemyKind;
  elite: EnemyKind;
  beast: EnemyKind;
  miniElite: EnemyKind; // a giant one of these in between, also with a chest
  boss: EnemyKind; // at 18 minutes
  minion: EnemyKind; // what the boss calls in
  // Opened by surviving the room before it to 20:00.
  after: RoomId | null;
}

export const ROOMS: Record<RoomId, RoomDef> = {
  flat: {
    name: 'Дремучий лес',
    shape: 'open',
    crowd: 1,
    waves: madForest({ bat: 'mouse', redbat: 'redmouse', zombie: 'dust', skeleton: 'mite', ghost: 'moth', mud: 'robot', greenmud: 'wetbot', bigbat: 'rat', wolf: 'brush', mummy: 'bigvac' }),
    swarm: 'mouse',
    ghost: 'moth',
    brute: 'bigvac',
    elite: 'bigrobot',
    beast: 'brush',
    miniElite: 'rat',
    boss: 'mop',
    minion: 'dust',
    after: null,
  },
  yard: {
    name: 'Муромская дорога',
    shape: 'strip',
    crowd: 0.6,
    waves: madForest({ bat: 'pigeon', redbat: 'crow', zombie: 'trimmer', skeleton: 'goose', ghost: 'wasp', mud: 'mower', greenmud: 'tractor', bigbat: 'dog', wolf: 'hound', mummy: 'combine' }),
    swarm: 'pigeon',
    ghost: 'wasp',
    brute: 'combine',
    elite: 'bulldog',
    beast: 'hound',
    miniElite: 'goose', // not the dog: a giant lunging dog at 1:00 is unfair
    boss: 'blower',
    minion: 'pigeon',
    after: 'flat',
  },
  warehouse: {
    name: 'Кощеево царство',
    shape: 'hall',
    crowd: 1,
    waves: madForest({ bat: 'minibot', redbat: 'redbot', zombie: 'hose', skeleton: 'scrubber', ghost: 'drone', mud: 'washer', greenmud: 'steamer', bigbat: 'roller', wolf: 'cyclone', mummy: 'tank' }),
    swarm: 'minibot',
    ghost: 'drone',
    brute: 'tank',
    elite: 'industrial',
    beast: 'cyclone',
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
  move: 136, // VS: 90.75 px/s in Mad Forest, and our unit is 1.5 VS pixels
  might: 1,
  area: 1,
  speed: 1,
  duration: 1,
  amount: 0,
  cooldown: 1,
  magnet: 45, // VS: 30 px, plus the gem's own 10 (in the sim)
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
    'Меч',
    'Удар мечом в сторону, куда смотрит герой',
    { dmg: 10, cd: 1.35, amount: 1, area: 1, speed: 1, duration: 0, pierce: 0 },
    [{ amount: 1 }, { dmg: 5 }, { dmg: 5, area: 0.1 }, { dmg: 5 }, { dmg: 5, area: 0.1 }, { dmg: 5 }, { dmg: 5 }],
  ),
  // Magic wand: shots at the nearest enemy.
  laser: weapon(
    'Жар-перо',
    'Огненное перо летит в ближайшего врага',
    { dmg: 10, cd: 1.2, amount: 1, area: 1, speed: 1, duration: 0, pierce: 0 },
    [{ amount: 1 }, { cd: -0.2 }, { amount: 1 }, { dmg: 10 }, { amount: 1 }, { pierce: 1 }, { dmg: 10 }],
  ),
  // Knife: fast fish in the direction the cat moves.
  fish: weapon(
    'Лук со стрелами',
    'Быстрые стрелы летят туда, куда бежит герой',
    { dmg: 7, cd: 1, amount: 1, area: 1, speed: 1, duration: 0, pierce: 0 },
    [{ amount: 1 }, { amount: 1, dmg: 5 }, { amount: 1 }, { pierce: 1 }, { amount: 1 }, { amount: 1, dmg: 5 }, { pierce: 1 }],
  ),
  // King Bible: yarn balls circle the cat for a while.
  yarn: weapon(
    'Обереги',
    'Обереги кружат вокруг героя',
    { dmg: 10, cd: 3, amount: 1, area: 1, speed: 1, duration: 3, pierce: 0 },
    [{ amount: 1 }, { speed: 0.3, area: 0.25 }, { duration: 0.5, dmg: 10 }, { amount: 1 }, { speed: 0.3, area: 0.25 }, { duration: 0.5, dmg: 10 }, { amount: 1 }],
  ),
  // Garlic: an aura that hurts enemies around the cat.
  meow: weapon(
    'Гусли',
    'Звон гуслей ранит всех, кто подошёл к герою',
    { dmg: 5, cd: 1.3, amount: 1, area: 1, speed: 1, duration: 0, pierce: 0 },
    [{ area: 0.4, dmg: 2 }, { cd: -0.1, dmg: 1 }, { area: 0.2, dmg: 1 }, { cd: -0.1, dmg: 2 }, { area: 0.2, dmg: 1 }, { cd: -0.1, dmg: 1 }, { area: 0.2, dmg: 2 }],
  ),
  // Santa water: puddles that hurt whoever stands in them.
  glass: weapon(
    'Живая вода',
    'Лужа на земле ранит всех нечистых, кто в ней',
    { dmg: 10, cd: 4.5, amount: 1, area: 1, speed: 1, duration: 2, pierce: 0 },
    [{ amount: 1, area: 0.2 }, { dmg: 10, duration: 0.5 }, { amount: 1, area: 0.2 }, { dmg: 10, duration: 0.25 }, { amount: 1, area: 0.2 }, { dmg: 5, duration: 0.25 }, { dmg: 5, area: 0.2 }],
  ),
  // Axe: pots fly up and fall in an arc, through several enemies (3 at
  // first, as the VS pierce 3: it passes through 2).
  pot: weapon(
    'Топор',
    'Топоры летят вверх и падают по дуге',
    { dmg: 20, cd: 4, amount: 1, area: 1, speed: 1, duration: 0, pierce: 2 },
    [{ amount: 1 }, { dmg: 20 }, { pierce: 2 }, { amount: 1 }, { dmg: 20 }, { pierce: 2 }, { dmg: 20 }],
  ),
  // Lightning ring: sparks strike random enemies on screen.
  spark: weapon(
    'Молния',
    'Молнии бьют случайных врагов на экране',
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
  belly: { name: 'Каравай', max: 5, per: { maxHp: 0.2 }, desc: 'Здоровье +20%' },
  box: { name: 'Чародейская книга', max: 5, per: { cooldown: -0.08 }, desc: 'Перезарядка −8%' },
  paws: { name: 'Наручи', max: 5, per: { speed: 0.1 }, desc: 'Скорость снарядов +10%' },
  patience: { name: 'Веретено', max: 5, per: { duration: 0.1 }, desc: 'Атаки длятся дольше на 10%' },
  purr: { name: 'Молодильное яблоко', max: 5, per: { recovery: 0.2 }, desc: '+0,2 здоровья в секунду' },
  catnip: { name: 'Магнит', max: 5, per: {}, desc: 'Радиус сбора самоцветов: +50%, а на 5-м уровне ×4' }, // as Attractorb, in CatRun.recompute
  bigpaws: { name: 'Богатырский размах', max: 5, per: { area: 0.1 }, desc: 'Область атак +10%' },
  pack: { name: 'Зеркальце', max: 2, per: { amount: 1 }, desc: '+1 снаряд ко всему оружию' },
  food: { name: 'Каша', max: 5, per: { might: 0.1 }, desc: 'Урон +10%' },
  blackcat: { name: 'Подкова', max: 5, per: { luck: 0.1 }, desc: 'Удача +10%: чаще 4-я карточка' },
};

// How often a card comes up, the rarity of its VS item: King Bible and
// Lightning Ring 80, Garlic 70, Hollow Heart and Pummarola 90, Empty Tome and
// Duplicator 50, the rest 100.
export const RARITY: Record<ItemId, number> = {
  claws: 100,
  laser: 100,
  fish: 100,
  yarn: 80,
  meow: 70,
  glass: 100,
  pot: 100,
  spark: 80,
  belly: 90,
  box: 50,
  paws: 100,
  patience: 100,
  purr: 90,
  catnip: 100,
  bigpaws: 100,
  pack: 50,
  food: 100,
  blackcat: 100,
};

// A weapon at level 8 plus its passive becomes its evolution from the next
// chest, as in Vampire Survivors.
export interface EvolutionDef {
  name: string;
  passive: PassiveId;
  desc: string;
}

export const EVOLUTIONS: Record<WeaponId, EvolutionDef> = {
  claws: { name: 'Меч-кладенец', passive: 'belly', desc: 'Рубит в обе стороны, шире, и каждый удар лечит героя' },
  laser: { name: 'Жар-птица', passive: 'box', desc: 'Стреляет без паузы' },
  fish: { name: 'Град стрел', passive: 'paws', desc: 'Непрерывный поток стрел' },
  yarn: { name: 'Вечные обереги', passive: 'patience', desc: 'Обереги кружат не переставая' },
  meow: { name: 'Гусли-самогуды', passive: 'purr', desc: 'Аура больше и лечит за каждого задетого' },
  glass: { name: 'Окиян-море', passive: 'catnip', desc: 'Лужи растут и ползут за героем' },
  pot: { name: 'Топор-саморуб', passive: 'bigpaws', desc: 'Топоры разлетаются спиралью и пробивают всех' },
  spark: { name: 'Грозовая туча', passive: 'pack', desc: 'Каждая молния бьёт дважды' },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
export const PASSIVE_IDS = Object.keys(PASSIVES) as PassiveId[];
export const isWeapon = (id: CardId): id is WeaponId => id in WEAPONS;
export const isPassive = (id: CardId): id is PassiveId => id in PASSIVES;
export const itemMax = (id: ItemId): number => (isWeapon(id) ? WEAPON_MAX : PASSIVES[id].max);

export const EXTRAS: Record<ExtraId, { name: string; desc: string }> = {
  snack: { name: 'Кружка кваса', desc: 'Вылечить 30 здоровья' },
  fishes: { name: 'Кошель злата', desc: '+10 злата' },
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

// Experience to go from `level` to the next, as in Vampire Survivors: its
// code wants level² × 5 in all to finish a level, × 6.5 from level 20 and
// × 8 from 40, so the step is 10 more each level up to 20, then 13, then 16.
function xpTotal(level: number): number {
  return level * level * Math.min(8, 5 + 1.5 * Math.floor(level / 20));
}
export function xpToNext(level: number): number {
  return xpTotal(level) - xpTotal(level - 1);
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
    name: 'Илья Муромец',
    title: 'старший богатырь',
    weapon: 'claws',
    stats: { maxHp: 120, armor: 1 },
    bonus: '+1 броня каждые 10 уровней, до +5',
    unlock: null,
  },
  murka: {
    name: 'Василиса Премудрая',
    title: 'чародейка',
    weapon: 'laser',
    stats: {},
    bonus: '+10% опыта, +20% с 10 уровня, +30% с 20-го',
    unlock: { fish: 300 },
  },
  barsik: {
    name: 'Добрыня Никитич',
    title: 'могучий змееборец',
    weapon: 'yarn',
    stats: { maxHp: 160, move: 136 * 0.85 },
    bonus: '+10% области атак, +20% с 10 уровня, +30% с 20-го',
    unlock: { surviveMin: 10 },
  },
  snezhok: {
    name: 'Алёша Попович',
    title: 'ловкий стрелок',
    weapon: 'fish',
    stats: { maxHp: 80, move: 136 * 1.25 },
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
  if ('fish' in u) return `${u.fish} злата`;
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
  move: { name: 'Скорость', desc: '+5% скорости героя', max: 2, base: 50 },
  area: { name: 'Область', desc: '+5% области атак', max: 2, base: 60 },
  cooldown: { name: 'Перезарядка', desc: '−2,5% перезарядки', max: 2, base: 90 },
  magnet: { name: 'Магнит', desc: '+25% радиуса сбора', max: 2, base: 30 },
  luck: { name: 'Удача', desc: '+10% удачи', max: 3, base: 60 },
  growth: { name: 'Рост', desc: '+3% опыта', max: 5, base: 90 },
  greed: { name: 'Жадность', desc: '+10% злата за забег', max: 5, base: 30 },
  reroll: { name: 'Реролл', desc: '+1 реролл за забег', max: 3, base: 100 },
  revive: { name: 'Второе дыхание', desc: 'одно воскрешение с половиной здоровья', max: 1, base: 500 },
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
