export type EnemyKind = 'mouse' | 'dog' | 'vacuum' | 'boss';

export interface EnemyDef {
  name: string;
  r: number;
  hp: number;
  speed: number;
  dmg: number;
  xp: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  mouse: { name: 'Мышь', r: 11, hp: 10, speed: 70, dmg: 5, xp: 1 },
  dog: { name: 'Пёс', r: 15, hp: 34, speed: 52, dmg: 10, xp: 3 },
  vacuum: { name: 'Пылесос', r: 20, hp: 110, speed: 38, dmg: 16, xp: 8 },
  boss: { name: 'Швабра', r: 34, hp: 2600, speed: 46, dmg: 30, xp: 0 },
};

export type UpgradeId = 'fish' | 'yarn' | 'meow' | 'laser' | 'speed' | 'heart' | 'magnet' | 'power';

export interface UpgradeDef {
  name: string;
  max: number;
  weapon: boolean;
  // Text for the card; `level` is the level before picking.
  desc(level: number): string;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  fish: { name: 'Рыбомёт', max: 6, weapon: true, desc: (l) => (l === 0 ? 'Кидает рыбу в ближайшего врага' : '+1 рыба, урон +20%') },
  yarn: { name: 'Клубки', max: 5, weapon: true, desc: (l) => (l === 0 ? 'Клубки кружат вокруг кота' : '+1 клубок, быстрее') },
  meow: { name: 'Мяу-волна', max: 5, weapon: true, desc: (l) => (l === 0 ? 'Волна отбрасывает и ранит всех рядом' : 'Шире и чаще') },
  laser: { name: 'Лазерная указка', max: 5, weapon: true, desc: (l) => (l === 0 ? 'Луч прожигает врагов в линию' : 'Толще и сильнее') },
  speed: { name: 'Быстрые лапы', max: 5, weapon: false, desc: () => 'Скорость +12%' },
  heart: { name: 'Сытый кот', max: 5, weapon: false, desc: () => 'Здоровье +25 и лечение' },
  magnet: { name: 'Магнит', max: 4, weapon: false, desc: () => 'Кристаллы летят издалека' },
  power: { name: 'Сила', max: 5, weapon: false, desc: () => 'Весь урон +15%' },
};

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
