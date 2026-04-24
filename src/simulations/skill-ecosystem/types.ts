export type Role = 'farmer' | 'harvester' | 'healer' | 'builder';

export type CreatureState =
  | 'wander'
  | 'work'
  | 'seek'
  | 'eat'
  | 'rest'
  | 'reproduce';

export type FoodType = 'leaf' | 'fruit' | 'rare';

export interface Creature {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  maxEnergy: number;
  stamina: number;
  maxStamina: number;
  size: number;
  hue: number;
  role: Role;
  /** Production rate multiplier for this creature's ability (0.4 – 3.0). */
  abilityValue: number;
  age: number;
  speed: number;
  eyeAngle: number;
  state: CreatureState;
  blinkTimer: number;
  pulsePhase: number;
  /** Ticks remaining before the next ability fires while working. */
  abilityCooldown: number;
  children: number;
  generation: number;
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
  farmers: number;
  harvesters: number;
  healers: number;
  builders: number;
  nests: number;
  born: number;
  died: number;
  totalEaten: number;
  foodProduced: number;
  nestsBuilt: number;
}

export interface Nest {
  id: string;
  x: number;
  y: number;
  radius: number;
  builtAtTick: number;
  builderId: string;
  pulse: number;
}

export interface LogEntry {
  t: number;
  msg: string;
}

export interface SavedState {
  version: 2;
  savedAt: string;
  tick: number;
  stats: {
    born: number;
    died: number;
    totalEaten: number;
    foodProduced: number;
    nestsBuilt: number;
  };
  creatures: Creature[];
  food: Food[];
  nests: Nest[];
}
