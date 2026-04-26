import {
  clamp, dist, hueToRgb,
  randomChoice, randomId, randomInt, randomRange,
} from '../../lib/sim-math';
import { randomName } from '../../lib/sim-names';
import type {
  Creature, Food, FoodType, House, LifeStage,
  Personality, Role, School,
} from './types';

// ── World ─────────────────────────────────────────────────────────────────
export const CANVAS_W = 800;
export const CANVAS_H = 520;

// ── Lifetime (ticks at 60fps; total ~7.5 min) ─────────────────────────────
export const CHILD_DURATION = 60 * 60;       // 60s
export const ADULT_DURATION = 60 * 300;      // 300s = 5 min adult prime
export const ELDER_DURATION = 60 * 90;       // 90s

// ── Population ────────────────────────────────────────────────────────────
export const INITIAL_FAMILIES = 4;
export const INITIAL_POPULATION = 12;        // 4 couples + 4 children
export const MAX_POPULATION = 50;

// ── Food ──────────────────────────────────────────────────────────────────
export const INITIAL_FOOD = 36;
export const MAX_FOOD = 150;
export const FOOD_SPAWN_RATE = 0.05;
export const FOOD_BASE_ENERGY = 20;          // raw food in inventory; world food is similar
export const FOOD_FRUIT_ENERGY = 26;
export const COOKED_FOOD_ENERGY = 30;

// ── Energy / stamina ──────────────────────────────────────────────────────
export const ENERGY_DRAIN_BASE = 0.030;
export const ENERGY_DRAIN_WORK = 0.018;
export const STAMINA_DRAIN_WORK = 0.12;
export const STAMINA_RECOVER_REST = 0.55;
export const STAMINA_RECOVER_IDLE = 0.22;

// ── Children ──────────────────────────────────────────────────────────────
export const CHILD_DRAIN_MULT = 0.55;
export const CHILD_SIZE_MULT = 0.6;
export const CHILD_SPEED_MULT = 0.7;
/** Children stay within this radius of their home house. */
export const CHILD_HOME_RADIUS = 180;

// ── Elders ────────────────────────────────────────────────────────────────
export const ELDER_DRAIN_MULT = 0.55;
export const ELDER_SPEED_MULT = 0.6;
export const ELDER_PRODUCTION_MULT = 0.5;
export const ELDER_SIZE_MULT = 0.92;

// ── Reproduction ──────────────────────────────────────────────────────────
export const REPRODUCE_ENERGY = 62;
export const REPRODUCE_STAMINA = 30;
export const REPRODUCE_COST_ENERGY = 24;
export const REPRODUCE_COST_STAMINA = 18;
export const REPRODUCE_COOLDOWN = 600;
export const MATE_CONTACT_RADIUS = 60;

// ── Bond / courtship ──────────────────────────────────────────────────────
export const MATE_SEEK_RADIUS = 220;
export const BOND_GROWTH_BASE = 0.08;
export const BOND_PROPOSE_THRESHOLD = 60;
export const BOND_REJECTION_PENALTY = 0.20;
/** Ticks of courtship cooldown after a rejection. */
export const COURT_COOLDOWN = 240;

// ── Houses ────────────────────────────────────────────────────────────────
export const HOUSE_RADIUS = 70;
export const HOUSE_RAW_CAP = 6;
export const HOUSE_COOKED_CAP = 4;
/** After a house has been empty for this many ticks, it becomes reusable. */
export const HOUSE_VACANCY_TIMEOUT = 60 * 30;

// ── Cooking & barter ──────────────────────────────────────────────────────
export const COOK_RAW_PER_COOKED = 2;
/** Ticks between cocinero "cook" actions while at home. */
export const COOK_INTERVAL_TICKS = 120;

// ── Foraging / carrying ───────────────────────────────────────────────────
export const CARRY_CAPACITY = 3;
/** Adult triggers food run when their family raw is below this. */
export const FORAGE_TRIGGER_RAW = 4;
/** Energy threshold below which the adult walks home to eat. */
export const HUNGER_THRESHOLD = 38;

// ── Schools ───────────────────────────────────────────────────────────────
export const SCHOOL_RADIUS = 60;
export const SCHOOL_TEACHER_CAP = 1;
export const SCHOOL_STUDENT_CAP = 4;
export const INITIAL_SCHOOLS = 2;

// ── Education ─────────────────────────────────────────────────────────────
export const EDUCATION_PER_CLASS = 0.05;
export const EDUCATION_CAP = 1.0;
export const SPECIALIST_EDUCATION_THRESHOLD = 0.2;

// ── Roles ─────────────────────────────────────────────────────────────────
export const ROLES: Role[] = ['farmer', 'cocinero', 'healer', 'builder', 'teacher'];
export const GENERALIST_ROLES: Role[] = ['farmer', 'cocinero'];
export const SPECIALIST_ROLES: Role[] = ['healer', 'builder', 'teacher'];

export const ROLE_HUE: Record<Role, number> = {
  farmer: 125,
  cocinero: 28,
  healer: 190,
  builder: 275,
  teacher: 320,
};

export const ROLE_LABEL: Record<Role, string> = {
  farmer: 'Farmer',
  cocinero: 'Cocinero',
  healer: 'Healer',
  builder: 'Builder',
  teacher: 'Teacher',
};

export const ROLE_DESC: Record<Role, string> = {
  farmer: 'Plants herbs across the map; family fills its raw pantry from anything anyone brings home.',
  cocinero: 'Turns raw into cooked at home (2:1, +50% energy). Other families trade raw for cooked here.',
  healer: 'Restores energy to weak family and partners.',
  builder: 'Builds new houses and schools as the population grows.',
  teacher: 'Teaches children at schools; educated kids ascend into specialist roles.',
};

export const ROLE_ICON: Record<Role, string> = {
  farmer: '🌱',
  cocinero: '🍞',
  healer: '💊',
  builder: '🛖',
  teacher: '📚',
};

const ABILITY_BASE_COOLDOWN: Record<Role, number> = {
  farmer: 140,
  cocinero: 120,
  healer: 150,
  builder: 500,
  teacher: 180,
};

export const CHILD_HUE = 45;

export function abilityCooldownTicks(role: Role, abilityValue: number): number {
  return Math.max(50, Math.round(ABILITY_BASE_COOLDOWN[role] / abilityValue));
}

export function hueForRole(role: Role, abilityValue: number): number {
  return ROLE_HUE[role] + (abilityValue - 1) * 10;
}

// ── Personality ───────────────────────────────────────────────────────────

export function randomPersonality(): Personality {
  return {
    carisma: randomInt(20, 80),
    empatia: randomInt(20, 80),
    ingenio: randomInt(20, 80),
  };
}

/**
 * Inheritance per the user's spec:
 *   child = 0.5 × averageOfParents + 0.5 × random(1..100)
 * Each trait inherits independently.
 */
export function inheritPersonality(a: Personality, b: Personality): Personality {
  const blend = (pa: number, pb: number) =>
    clamp(Math.round(0.5 * ((pa + pb) / 2) + 0.5 * randomInt(1, 100)), 1, 100);
  return {
    carisma: blend(a.carisma, b.carisma),
    empatia: blend(a.empatia, b.empatia),
    ingenio: blend(a.ingenio, b.ingenio),
  };
}

// ── Family graph ──────────────────────────────────────────────────────────

/** True if `a` and `b` are parent/child or share at least one parent. */
export function isBloodRelated(a: Creature, b: Creature): boolean {
  if (a.parentIds.includes(b.id)) return true;
  if (b.parentIds.includes(a.id)) return true;
  const aParents = a.parentIds.filter((p): p is string => p !== null);
  const bParents = b.parentIds.filter((p): p is string => p !== null);
  for (const p of aParents) if (bParents.includes(p)) return true;
  return false;
}

export function findHouse(houseId: string | null, houses: House[]): House | null {
  if (!houseId) return null;
  return houses.find((h) => h.id === houseId) ?? null;
}

export function findCreature(id: string | null, creatures: Creature[]): Creature | null {
  if (!id) return null;
  return creatures.find((c) => c.id === id) ?? null;
}

// ── Acceptance probability for courtship ─────────────────────────────────

/**
 * The proposed creature accepts with this probability.
 * Built around a base of 0.4 with each trait nudging:
 *   + carisma of proposer (most weighted — they are doing the wooing)
 *   + empatía of proposed (open-hearted creatures accept more)
 *   − ingenio of proposed when proposer is low-charisma (smart filter)
 */
export function acceptanceProb(proposer: Creature, proposed: Creature): number {
  let p = 0.40;
  p += (proposer.personality.carisma - 50) * 0.005;
  p += (proposed.personality.empatia - 50) * 0.003;
  if (proposer.personality.carisma < 50) {
    p -= (proposed.personality.ingenio - 50) * 0.004;
  }
  return clamp(p, 0.10, 0.92);
}

// ── Factories ─────────────────────────────────────────────────────────────

export interface CreatureOpts {
  x?: number;
  y?: number;
  stage?: LifeStage;
  role?: Role | null;
  age?: number;
  longevity?: number;
  generation?: number;
  energy?: number;
  parentIds?: [string | null, string | null];
  personality?: Personality;
  houseId?: string | null;
  abilityValue?: number;
}

export function createCreature(opts: CreatureOpts = {}): Creature {
  const longevity = opts.longevity ?? randomRange(0.85, 1.25);
  const adultAge = Math.round(CHILD_DURATION * longevity);
  const elderAge = adultAge + Math.round(ADULT_DURATION * longevity);
  const maxAge = elderAge + Math.round(ELDER_DURATION * longevity);

  const stage = opts.stage ?? 'child';
  const role = stage === 'child' ? null : (opts.role ?? null);
  const abilityValue = opts.abilityValue ?? (role ? clamp(0.8 + Math.random() * 0.6, 0.4, 3.0) : 1.0);

  const stageSpan = stage === 'adult' ? elderAge - adultAge
    : stage === 'elder' ? maxAge - elderAge
    : adultAge;
  const stageBase = stage === 'adult' ? adultAge : stage === 'elder' ? elderAge : 0;
  const age = opts.age ?? Math.floor(stageBase + Math.random() * stageSpan * 0.35);

  const baseSize = randomRange(10, 15);
  const size = stage === 'child' ? baseSize * CHILD_SIZE_MULT
    : stage === 'elder' ? baseSize * ELDER_SIZE_MULT
    : baseSize;
  const speed = (stage === 'child' ? randomRange(0.7, 1.0)
    : stage === 'elder' ? randomRange(0.5, 0.8)
    : randomRange(0.8, 1.3));

  const hue = stage === 'child' ? CHILD_HUE
    : (role ? hueForRole(role, abilityValue) : CHILD_HUE);

  return {
    id: randomId(),
    name: randomName(),
    x: opts.x ?? randomRange(20, CANVAS_W - 20),
    y: opts.y ?? randomRange(20, CANVAS_H - 20),
    vx: randomRange(-1, 1),
    vy: randomRange(-1, 1),
    energy: opts.energy ?? randomRange(60, 80),
    maxEnergy: 100,
    size,
    hue,
    age,
    speed,
    eyeAngle: 0,
    state: 'wander',
    blinkTimer: randomRange(0, 200),
    pulsePhase: randomRange(0, Math.PI * 2),
    children: 0,
    generation: opts.generation ?? 1,

    role,
    stage,
    longevity,
    adultAge,
    elderAge,
    maxAge,
    stamina: randomRange(70, 90),
    maxStamina: 100,
    abilityValue,
    abilityCooldown: role ? abilityCooldownTicks(role, abilityValue) : 0,
    education: 0,
    learnFlash: 0,

    personality: opts.personality ?? randomPersonality(),
    parentIds: opts.parentIds ?? [null, null],
    partnerId: null,
    houseId: opts.houseId ?? null,
    bonds: {},
    lastCourtTick: -Infinity,
    carrying: 0,
    lastReproduceTick: -Infinity,
  };
}

export function createFood(opts: { x?: number; y?: number; type?: FoodType } = {}): Food {
  const type = opts.type ?? (Math.random() > 0.5 ? 'herb' : 'fruit');
  return {
    id: randomId(),
    x: opts.x ?? randomRange(10, CANVAS_W - 10),
    y: opts.y ?? randomRange(10, CANVAS_H - 10),
    energy: type === 'fruit' ? FOOD_FRUIT_ENERGY : FOOD_BASE_ENERGY,
    size: type === 'fruit' ? randomRange(6, 8) : randomRange(4, 6),
    pulse: randomRange(0, Math.PI * 2),
    type,
  };
}

export function createHouse(builderId: string, x: number, y: number, tick: number, seed = false): House {
  return {
    id: randomId(),
    x, y,
    radius: HOUSE_RADIUS,
    builtAtTick: tick,
    builderId,
    pulse: randomRange(0, Math.PI * 2),
    raw: seed ? 4 : 0,
    cooked: seed ? 1 : 0,
    residentIds: [],
    vacancyTimer: 0,
  };
}

export function createSchool(builderId: string, x: number, y: number, tick: number): School {
  return {
    id: randomId(),
    x, y,
    radius: SCHOOL_RADIUS,
    builtAtTick: tick,
    builderId,
    pulse: randomRange(0, Math.PI * 2),
    teacherIds: [],
    studentIds: [],
  };
}

export function createBaby(a: Creature, b: Creature): Creature {
  return createCreature({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    stage: 'child',
    age: 0,
    parentIds: [a.id, b.id],
    personality: inheritPersonality(a.personality, b.personality),
    generation: Math.max(a.generation, b.generation) + 1,
    energy: 60,
    houseId: a.houseId ?? b.houseId,
  });
}

// ── Initial population: 4 families spread across the map ──────────────────

export function buildInitialWorld(): {
  creatures: Creature[];
  houses: House[];
  schools: School[];
} {
  const creatures: Creature[] = [];
  const houses: House[] = [];
  const schools: School[] = [];

  const corners = [
    { x: 180, y: 130 },
    { x: 620, y: 130 },
    { x: 180, y: 390 },
    { x: 620, y: 390 },
  ];

  // 8 adult roles spread across the 4 families. Each row = a couple.
  const couples: [Role, Role][] = [
    ['farmer', 'cocinero'],
    ['farmer', 'builder'],
    ['cocinero', 'teacher'],
    ['healer', 'builder'],
  ];

  for (let f = 0; f < INITIAL_FAMILIES; f++) {
    const corner = corners[f]!;
    const [roleA, roleB] = couples[f]!;

    const house = createHouse('initial', corner.x, corner.y, 0, true);

    const adultA = createCreature({
      x: corner.x + randomRange(-25, 25),
      y: corner.y + randomRange(-25, 25),
      stage: 'adult',
      role: roleA,
      age: Math.round(CHILD_DURATION * 1.1 + Math.random() * 1500),
      houseId: house.id,
      energy: 80,
    });
    const adultB = createCreature({
      x: corner.x + randomRange(-25, 25),
      y: corner.y + randomRange(-25, 25),
      stage: 'adult',
      role: roleB,
      age: Math.round(CHILD_DURATION * 1.1 + Math.random() * 1500),
      houseId: house.id,
      energy: 80,
    });
    adultA.partnerId = adultB.id;
    adultB.partnerId = adultA.id;
    house.residentIds.push(adultA.id, adultB.id);

    const child = createCreature({
      x: corner.x + randomRange(-30, 30),
      y: corner.y + randomRange(-30, 30),
      stage: 'child',
      age: Math.round(Math.random() * CHILD_DURATION * 0.5),
      parentIds: [adultA.id, adultB.id],
      personality: inheritPersonality(adultA.personality, adultB.personality),
      houseId: house.id,
      generation: 2,
      energy: 70,
    });
    house.residentIds.push(child.id);

    creatures.push(adultA, adultB, child);
    houses.push(house);
  }

  schools.push(createSchool('initial', 280, 260, 0));
  schools.push(createSchool('initial', 520, 260, 0));

  return { creatures, houses, schools };
}

// ── Role assignment for kids ascending ────────────────────────────────────

export function chooseRoleForNewAdult(child: Creature, creatures: Creature[]): Role {
  const eligible = child.education >= SPECIALIST_EDUCATION_THRESHOLD ? ROLES : GENERALIST_ROLES;

  const counts: Partial<Record<Role, number>> = {};
  for (const r of eligible) counts[r] = 0;
  for (const o of creatures) {
    if (o.stage === 'child') continue;
    if (!o.role) continue;
    if (eligible.includes(o.role)) {
      counts[o.role] = (counts[o.role] ?? 0) + 1;
    }
  }

  let minCount = Infinity;
  for (const r of eligible) {
    const c = counts[r] ?? 0;
    if (c < minCount) minCount = c;
  }
  const candidates = eligible.filter((r) => (counts[r] ?? 0) === minCount);
  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

export function ascendToAdult(c: Creature, allCreatures: Creature[]): { role: Role; educated: boolean } {
  const role = chooseRoleForNewAdult(c, allCreatures);
  const educated = c.education >= SPECIALIST_EDUCATION_THRESHOLD;
  const base = 0.8 + Math.random() * 0.4;
  const bonus = Math.min(EDUCATION_CAP, c.education);
  const abilityValue = clamp(base + bonus, 0.4, 3.0);

  c.stage = 'adult';
  c.role = role;
  c.abilityValue = abilityValue;
  c.education = 0;
  c.hue = hueForRole(role, abilityValue);
  c.abilityCooldown = abilityCooldownTicks(role, abilityValue);
  c.size = clamp(c.size / CHILD_SIZE_MULT, 9, 16);
  c.speed = randomRange(0.8, 1.3);

  return { role, educated };
}

export function descendToElder(c: Creature): void {
  c.stage = 'elder';
  c.speed *= ELDER_SPEED_MULT;
  c.size *= ELDER_SIZE_MULT;
}

// Re-export commonly used math
export { clamp, dist, hueToRgb, randomChoice };
