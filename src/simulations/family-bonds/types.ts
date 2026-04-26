import type { CreatureBase, LogEntry, SavedState } from '../../lib/sim-types';

export type Role = 'farmer' | 'cocinero' | 'healer' | 'builder' | 'teacher';
export type LifeStage = 'child' | 'adult' | 'elder';

export type CreatureState =
  | 'wander'
  | 'work'
  | 'forage'      // adult roaming the map looking for food
  | 'return'      // adult walking back to deposit / eat at home
  | 'eat'
  | 'rest'
  | 'bond'        // mutual proximity to a potential mate, building bond
  | 'court'       // proposing
  | 'reproduce'
  | 'school'      // teacher teaching, child learning
  | 'home'        // child idling at home
  | 'barter';     // adult walking to a cocinero family to trade raw for cooked

export type FoodType = 'herb' | 'fruit';

export type PersonalityTrait = 'carisma' | 'empatia' | 'ingenio';

export interface Personality {
  carisma: number;   // 1–100 — courtship speed and acceptance pull
  empatia: number;   // 1–100 — caregiving + acceptance pull
  ingenio: number;   // 1–100 — learning rate + selectivity filter
}

export interface Creature extends CreatureBase<CreatureState> {
  // From P3-style life-stage model
  role: Role | null;
  stage: LifeStage;
  longevity: number;      // 0.85 – 1.25 multiplier on stage durations
  adultAge: number;       // tick at which becomes adult
  elderAge: number;
  maxAge: number;

  // Stamina
  stamina: number;
  maxStamina: number;

  // Skills
  abilityValue: number;   // 0.4 – 3.0
  abilityCooldown: number;

  // Education tracked while child; consumed at adulthood
  education: number;
  learnFlash: number;

  // Phase 4 — personality (inheritable)
  personality: Personality;

  // Phase 4 — family graph
  parentIds: [string | null, string | null];
  partnerId: string | null;
  houseId: string | null;

  // Phase 4 — courtship state
  /** Map from candidate creature id → bond strength (0–100). */
  bonds: Record<string, number>;
  /** Tick at which the last courtship event happened (cooldown). */
  lastCourtTick: number;

  // Phase 4 — carrying food back home
  /** Number of raw food units currently being carried by this adult. */
  carrying: number;

  // Reproduction
  lastReproduceTick: number;
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

export interface House {
  id: string;
  x: number;
  y: number;
  radius: number;
  builtAtTick: number;
  builderId: string;
  pulse: number;

  // Inventory shared by all residents
  raw: number;
  cooked: number;

  /** Creature ids of current residents (couple + their kids, or a single + their kids). */
  residentIds: string[];

  /** Ticks since the last living resident was here. After a threshold, the house is reusable. */
  vacancyTimer: number;
}

export interface School {
  id: string;
  x: number;
  y: number;
  radius: number;
  builtAtTick: number;
  builderId: string;
  pulse: number;

  /** Teacher creature ids currently inside (cap 1 in the default config). */
  teacherIds: string[];
  /** Student creature ids currently inside (cap 4). */
  studentIds: string[];
}

export interface SimStats {
  alive: number;
  children: number;
  adults: number;
  elders: number;
  farmers: number;
  cocineros: number;
  healers: number;
  builders: number;
  teachers: number;
  food: number;
  houses: number;
  schools: number;
  partnered: number;
  singles: number;
  born: number;
  died: number;
  proposalsAccepted: number;
  proposalsRejected: number;
  housesBuilt: number;
  schoolsBuilt: number;
  totalCooked: number;
  totalBartered: number;
  classesGiven: number;
}

export type { LogEntry };

export type FamilyBondsSavedState = SavedState<SimStats, Creature, Food> & {
  version: 1;
  houses: House[];
  schools: School[];
};
