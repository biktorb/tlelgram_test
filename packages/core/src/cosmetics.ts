// Cosmetics and daily tasks. Nothing here changes a unit or a battle.

export interface Frame {
  id: string;
  name: string;
  price: number; // in fish
}

// Card frames: the player's cards wear the equipped one, opponents see it too.
export const FRAMES: Frame[] = [
  { id: 'gold', name: 'Золотая', price: 100 },
  { id: 'mint', name: 'Мятная', price: 100 },
  { id: 'neon', name: 'Неон', price: 200 },
  { id: 'rainbow', name: 'Радуга', price: 300 },
  { id: 'cosmos', name: 'Космос', price: 500 },
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
