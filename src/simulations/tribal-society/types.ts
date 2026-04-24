export type Role = 'farmer' | 'harvester' | 'healer' | 'builder' | 'teacher';

export type LifeStage = 'child' | 'adult' | 'elder';

export type CreatureState =
  | 'wander'
  | 'work'
  | 'seek'
  | 'eat'
  | 'rest'
  | 'reproduce';

export type FoodType = 'herb' | 'fruit';

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
  role: Role | null; // null while stage === 'child'
  stage: LifeStage;
  /** Production multiplier (0.4 – 3.0). Fixed when the child becomes adult. */
  abilityValue: number;
  /** Education points received from teachers while a child. Consumed at adulthood. */
  education: number;
  age: number; // ticks
  /** Tick at which this creature becomes an adult (varies by longevity). */
  adultAge: number;
  /** Tick at which this creature becomes an elder. */
  elderAge: number;
  /** Tick at which this creature dies of old age. */
  maxAge: number;
  /** Personal longevity multiplier (0.8 – 1.25). */
  longevity: number;
  speed: number;
  eyeAngle: number;
  state: CreatureState;
  blinkTimer: number;
  pulsePhase: number;
  abilityCooldown: number;
  /** Tick of last reproduction — enforces a cooldown so adults don't breed every cycle. */
  lastReproduceTick: number;
  /** Ticks remaining to show a learning sparkle over a child's head. */
  learnFlash: number;
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

export interface Nest {
  id: string;
  x: number;
  y: number;
  radius: number;
  builtAtTick: number;
  builderId: string;
  pulse: number;
}

export interface SimStats {
  alive: number;
  children: number;
  adults: number;
  elders: number;
  farmers: number;
  harvesters: number;
  healers: number;
  builders: number;
  teachers: number;
  food: number;
  nests: number;
  born: number;
  died: number;
  totalEaten: number;
  foodProduced: number;
  classesGiven: number;
  nestsBuilt: number;
}

export interface LogEntry {
  t: number;
  msg: string;
}

export interface SavedState {
  version: 1;
  savedAt: string;
  tick: number;
  stats: {
    born: number;
    died: number;
    totalEaten: number;
    foodProduced: number;
    classesGiven: number;
    nestsBuilt: number;
  };
  creatures: Creature[];
  food: Food[];
  nests: Nest[];
}
