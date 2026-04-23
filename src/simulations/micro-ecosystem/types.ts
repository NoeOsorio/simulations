export type CreatureState = 'wander' | 'seek' | 'eat' | 'reproduce';
export type FoodType = 'plant' | 'fruit';

export interface Creature {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  maxEnergy: number;
  size: number;
  hue: number;
  age: number;
  speed: number;
  eyeAngle: number;
  state: CreatureState;
  blinkTimer: number;
  children: number;
  generation: number;
  pulsePhase: number;
}

export interface Food {
  id: string;
  x: number;
  y: number;
  energy: number;
  size: number;
  pulse: number;
  type: FoodType;
}

export interface SimStats {
  alive: number;
  food: number;
  born: number;
  died: number;
  totalEaten: number;
}

export interface LogEntry {
  t: number;
  msg: string;
}

export interface SavedState {
  version: 1;
  savedAt: string;
  tick: number;
  stats: { born: number; died: number; totalEaten: number };
  creatures: Creature[];
  food: Food[];
}
