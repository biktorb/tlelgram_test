// Cosmetics and daily tasks. Nothing here changes a unit or a battle.

export interface Frame {
  id: string;
  name: string;
  price: number; // in fish
  exclusive?: boolean; // not sold: a season pass reward
}

// Card frames: the player's cards wear the equipped one, opponents see it too.
export const FRAMES: Frame[] = [
  { id: 'gold', name: 'Золотая', price: 100 },
  { id: 'mint', name: 'Мятная', price: 100 },
  { id: 'neon', name: 'Неон', price: 200 },
  { id: 'rainbow', name: 'Радуга', price: 300 },
  { id: 'cosmos', name: 'Космос', price: 500 },
  { id: 'crown', name: 'Корона сезона', price: 0, exclusive: true },
];

export const frameById = (id: string): Frame | undefined => FRAMES.find((f) => f.id === id);

export interface TaskDef {
  id: string;
  title: string;
  goal: number;
  reward: number; // fish
}

// The same three tasks every day; progress counts runs finished that day (Moscow time).
export const DAILY_TASKS: TaskDef[] = [
  { id: 'runs', title: 'Сыграйте 2 забега', goal: 2, reward: 20 },
  { id: 'wins', title: 'Одержите 6 побед', goal: 6, reward: 30 },
  { id: 'daily', title: 'Сыграйте вызов дня', goal: 1, reward: 20 },
];

// Season pass: a season is a calendar month (Moscow time). Every win in a run
// played to the end earns a point; each level pays its reward once.
export const SEASON_POINTS_PER_LEVEL = 15;

export type PassReward = { fish: number } | { frame: string };

export const SEASON_PASS: PassReward[] = [
  { fish: 20 },
  { fish: 30 },
  { fish: 40 },
  { fish: 50 },
  { fish: 60 },
  { fish: 70 },
  { fish: 80 },
  { fish: 90 },
  { fish: 100 },
  { frame: 'crown' },
];
