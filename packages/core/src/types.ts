export type Trigger =
  | 'startBattle'
  | 'faint'
  | 'hurt'
  | 'beforeAttack'
  | 'knockOut'
  | 'buy'
  | 'sell'
  | 'startTurn'
  | 'endTurn'
  | 'levelUp'
  | 'friendAheadFaints'
  | 'friendSummoned';

export type Target =
  | 'self'
  | 'source' // the unit that caused the trigger (e.g. the summoned friend)
  | 'randomFriend'
  | 'allFriends'
  | 'friendAhead'
  | 'friendsBehind'
  | 'adjacentFriends'
  | 'randomEnemy'
  | 'allEnemies'
  | 'everyone'
  | 'lowestHpEnemy'
  | 'highestAtkEnemy';

// Numeric values are per level: the actual value is value * level
// (for levelUp abilities the multiplier is level - 1).
export type Effect =
  | { kind: 'buff'; atk: number; hp: number; target: Target; count?: number }
  | { kind: 'damage'; amount: number; target: Target; count?: number }
  | { kind: 'summon'; token: string; atk: number; hp: number; count?: number }
  | { kind: 'gold'; amount: number };

export interface UnitDef {
  id: string;
  name: string;
  tier: number; // 0 = token, never in shop
  atk: number;
  hp: number;
  trigger?: Trigger;
  effect?: Effect;
  text: string;
}

export interface Unit {
  uid: number;
  id: string;
  atk: number;
  hp: number;
  xp: number; // 0..5, level 2 at 2, level 3 at 5
}

export const MAX_TEAM = 5;
export const MAX_STAT = 50;
