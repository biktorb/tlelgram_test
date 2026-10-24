import type { Trigger, Unit } from './types.ts';
import { MAX_TEAM } from './types.ts';
import { def, levelOf, SHOP_UNITS } from './units.ts';
import { Engine, type EngineEvent } from './engine.ts';
import { Rng } from './rng.ts';
import { battle, type BattleOutcome, type BattleResult } from './battle.ts';

export const RULES = {
  lives: 5,
  winsToFinish: 10,
  goldPerTurn: 10,
  buyCost: 3,
  rerollCost: 1,
};

export function shopSize(round: number): number {
  return round <= 4 ? 3 : round <= 8 ? 4 : 5;
}

export function maxTier(round: number): number {
  return Math.min(4, Math.ceil(round / 2));
}

export interface ShopSlot {
  id: string;
  atk: number;
  hp: number;
  frozen: boolean;
}

export type Action =
  | { a: 'buy'; shop: number; pos: number }
  | { a: 'buyMerge'; shop: number; team: number }
  | { a: 'merge'; from: number; to: number }
  | { a: 'sell'; team: number }
  | { a: 'move'; from: number; to: number }
  | { a: 'reroll' }
  | { a: 'freeze'; shop: number };

export interface RunState {
  seed: number;
  rng: number;
  uid: number;
  round: number;
  gold: number;
  lives: number;
  wins: number;
  team: Unit[];
  shop: ShopSlot[];
  history: BattleResult[];
  finished: boolean;
}

export class ActionError extends Error {}

export class Run {
  s: RunState;
  private rng: Rng;
  lastEvents: EngineEvent[] = [];

  constructor(seed: number, state?: RunState) {
    this.rng = new Rng(seed);
    if (state) {
      this.s = structuredClone(state);
      this.rng.state = state.rng;
      return;
    }
    this.s = {
      seed, rng: 0, uid: 0, round: 1, gold: 0, lives: RULES.lives, wins: 0,
      team: [], shop: [], history: [], finished: false,
    };
    this.startTurn();
  }

  snapshot(): RunState {
    this.s.rng = this.rng.state;
    return structuredClone(this.s);
  }

  // Team as stored for other players to fight against.
  teamSnapshot(): Unit[] {
    return structuredClone(this.s.team);
  }

  apply(action: Action): void {
    if (this.s.finished) throw new ActionError('Забег окончен');
    switch (action.a) {
      case 'buy': return this.buy(action.shop, action.pos);
      case 'buyMerge': return this.buyMerge(action.shop, action.team);
      case 'merge': return this.mergeTeam(action.from, action.to);
      case 'sell': return this.sell(action.team);
      case 'move': return this.move(action.from, action.to);
      case 'reroll': return this.reroll();
      case 'freeze': return this.freeze(action.shop);
    }
  }

  // Ends the shop phase: end-of-turn abilities, then the team is locked in.
  endTurn(): Unit[] {
    this.withEngine((eng) => eng.fireAll(0, 'endTurn'));
    return this.teamSnapshot();
  }

  // Fights the given opponent and moves to the next round.
  fight(opponent: readonly Unit[], battleSeed: number): BattleOutcome {
    const out = battle(this.s.team, opponent, battleSeed);
    this.s.history.push(out.result);
    if (out.result === 'win') this.s.wins++;
    if (out.result === 'loss') this.s.lives--;
    if (this.s.wins >= RULES.winsToFinish || this.s.lives <= 0) {
      this.s.finished = true;
    } else {
      this.s.round++;
      this.startTurn();
    }
    return out;
  }

  private startTurn(): void {
    this.s.gold = RULES.goldPerTurn;
    this.withEngine((eng) => eng.fireAll(0, 'startTurn'));
    this.roll();
  }

  private roll(): void {
    const tier = maxTier(this.s.round);
    const pool = SHOP_UNITS.filter((u) => u.tier <= tier);
    const kept = this.s.shop.filter((x) => x.frozen);
    const size = Math.max(shopSize(this.s.round), kept.length);
    while (kept.length < size) {
      const d = this.rng.pick(pool);
      kept.push({ id: d.id, atk: d.atk, hp: d.hp, frozen: false });
    }
    this.s.shop = kept;
  }

  private spend(cost: number): void {
    if (this.s.gold < cost) throw new ActionError('Не хватает монет');
    this.s.gold -= cost;
  }

  private takeShop(i: number): ShopSlot {
    const slot = this.s.shop[i];
    if (!slot) throw new ActionError('Нет такого бойца в лавке');
    this.spend(RULES.buyCost);
    this.s.shop.splice(i, 1);
    return slot;
  }

  private teamUnit(i: number): Unit {
    const u = this.s.team[i];
    if (!u) throw new ActionError('Нет такого бойца в отряде');
    return u;
  }

  private buy(shopIdx: number, pos: number): void {
    if (this.s.team.length >= MAX_TEAM) throw new ActionError('Отряд полон');
    const slot = this.takeShop(shopIdx);
    const unit: Unit = { uid: ++this.s.uid, id: slot.id, atk: slot.atk, hp: slot.hp, xp: 0 };
    this.s.team.splice(Math.max(0, Math.min(pos, this.s.team.length)), 0, unit);
    this.withEngine((eng) => eng.fire(0, unit, 'buy'));
  }

  private buyMerge(shopIdx: number, teamIdx: number): void {
    const target = this.teamUnit(teamIdx);
    const slot = this.s.shop[shopIdx];
    if (!slot || slot.id !== target.id) throw new ActionError('Объединять можно только одинаковых бойцов');
    if (target.xp >= 5) throw new ActionError('Боец уже максимального уровня');
    this.takeShop(shopIdx);
    this.combine(target, { uid: 0, id: slot.id, atk: slot.atk, hp: slot.hp, xp: 0 }, 'buy');
  }

  private mergeTeam(from: number, to: number): void {
    if (from === to) throw new ActionError('Нельзя объединить бойца с самим собой');
    const src = this.teamUnit(from);
    const target = this.teamUnit(to);
    if (src.id !== target.id) throw new ActionError('Объединять можно только одинаковых бойцов');
    if (target.xp >= 5) throw new ActionError('Боец уже максимального уровня');
    this.s.team.splice(from, 1);
    this.combine(target, src);
  }

  // Merge rule: the best stats of both plus 1, experience adds up.
  private combine(target: Unit, src: Unit, extra?: Trigger): void {
    const before = levelOf(target.xp);
    target.atk = Math.max(target.atk, src.atk) + 1;
    target.hp = Math.max(target.hp, src.hp) + 1;
    target.xp = Math.min(5, target.xp + src.xp + 1);
    this.withEngine((eng) => {
      if (extra) eng.fire(0, target, extra);
      if (levelOf(target.xp) > before) eng.fire(0, target, 'levelUp');
    });
  }

  private sell(teamIdx: number): void {
    const unit = this.teamUnit(teamIdx);
    this.s.gold += levelOf(unit.xp);
    this.withEngine((eng) => {
      eng.fire(0, unit, 'sell');
      this.s.team.splice(teamIdx, 1);
    });
  }

  private move(from: number, to: number): void {
    const unit = this.teamUnit(from);
    this.s.team.splice(from, 1);
    this.s.team.splice(Math.max(0, Math.min(to, this.s.team.length)), 0, unit);
  }

  private reroll(): void {
    this.spend(RULES.rerollCost);
    this.roll();
  }

  private freeze(shopIdx: number): void {
    const slot = this.s.shop[shopIdx];
    if (!slot) throw new ActionError('Нет такого бойца в лавке');
    slot.frozen = !slot.frozen;
  }

  private withEngine(fn: (eng: Engine) => void): void {
    const eng = new Engine([this.s.team], this.rng, () => ++this.s.uid);
    fn(eng);
    eng.run();
    this.s.gold += eng.gold;
    this.lastEvents = eng.events;
  }
}

export function describe(unit: Unit): string {
  const d = def(unit.id);
  return `${d.name} ${unit.atk}/${unit.hp} ур.${levelOf(unit.xp)}`;
}
