import type { Creature, Food, FoodType, LifeStage, Nest, Role } from './types';

export const CANVAS_W = 800;
export const CANVAS_H = 520;

export const MAX_POPULATION = 50;
export const INITIAL_CHILDREN = 5;
export const INITIAL_FOOD = 48;
export const MAX_FOOD = 170;

// Life stages measured in ticks at 60fps. Each creature scales these by its
// personal longevity (0.8–1.25) so lives vary.
export const CHILD_DURATION = 60 * 60;   // 60s
export const ADULT_DURATION = 60 * 180;  // 180s of prime adulthood
export const ELDER_DURATION = 60 * 60;   // 60s
// So, at longevity 1.0: adultAge=3600, elderAge=14400, maxAge=18000.

export const REPRODUCE_ENERGY = 62;
export const REPRODUCE_STAMINA = 32;
export const REPRODUCE_COST_ENERGY = 24;
export const REPRODUCE_COST_STAMINA = 18;
/** Minimum ticks between reproductions for the same creature. */
export const REPRODUCE_COOLDOWN = 600;
export const MATE_CONTACT_RADIUS = 60;
export const MATE_SEEK_RADIUS = 220;
export const REST_EXIT_STAMINA = 55;
export const LOW_ENERGY = 28;
export const LOW_STAMINA = 16;

export const STAMINA_DRAIN_WORK = 0.12;
export const STAMINA_RECOVER_REST = 0.55;
export const STAMINA_RECOVER_IDLE = 0.22;
export const ENERGY_DRAIN_BASE = 0.034;
export const ENERGY_DRAIN_WORK = 0.018;

// Children consume less and move slower. They don't work.
export const CHILD_SPEED_MULT = 0.7;
export const CHILD_DRAIN_MULT = 0.55;
export const CHILD_SIZE_MULT = 0.6;

// Elders are slower, produce less, consume less. They can't reproduce.
export const ELDER_SPEED_MULT = 0.6;
export const ELDER_DRAIN_MULT = 0.5;
export const ELDER_PRODUCTION_MULT = 0.5;
export const ELDER_SIZE_MULT = 0.92;

// Teacher mechanics
export const EDUCATION_PER_CLASS = 0.05;
export const EDUCATION_CAP = 1.0;
export const TEACHER_REACH = 100;
/**
 * A child needs at least this much education before the tribe is willing to
 * entrust them with a specialist role (healer, builder, teacher). Without it,
 * they can only become farmer or harvester.
 */
export const SPECIALIST_EDUCATION_THRESHOLD = 0.2;

/** Roles any uneducated adult can fall into — basic labor. */
export const GENERALIST_ROLES: Role[] = ['farmer', 'harvester'];
/** Roles that require education to take. */
export const SPECIALIST_ROLES: Role[] = ['healer', 'builder', 'teacher'];

/**
 * Range at which creatures can spot a nest when tired, or a healer when starving.
 * They'll walk toward the nearest service within this radius.
 */
export const SERVICE_SEEK_RADIUS = 320;

// Nests (builders)
export const NEST_RADIUS = 58;
export const MAX_NESTS = 3;
export const NEST_STAMINA_MULT = 2.0;
export const NEST_MATE_SEEK_MULT = 1.8;

export const ROLES: Role[] = ['farmer', 'harvester', 'healer', 'builder', 'teacher'];

export const ROLE_HUE: Record<Role, number> = {
  farmer: 125,    // green
  harvester: 28,  // orange
  healer: 190,    // cyan
  builder: 275,   // purple
  teacher: 320,   // magenta-pink
};

export const ROLE_LABEL: Record<Role, string> = {
  farmer: 'Farmer',
  harvester: 'Harvester',
  healer: 'Healer',
  builder: 'Builder',
  teacher: 'Teacher',
};

export const ROLE_ICON: Record<Role, string> = {
  farmer: '🌱',
  harvester: '🧺',
  healer: '💊',
  builder: '🛖',
  teacher: '📚',
};

export const ROLE_DESC: Record<Role, string> = {
  farmer: 'Plants herbs (for others — they can\'t eat their own).',
  harvester: 'Grows apples (for others — they can\'t eat their own).',
  healer: 'Heals others. Can\'t heal themselves.',
  builder: 'Builds nests. Can\'t use their own nest.',
  teacher: 'Teaches children. Educated kids become stronger adults.',
};

const ABILITY_BASE_COOLDOWN: Record<Role, number> = {
  farmer: 140,
  harvester: 210,
  healer: 150,
  builder: 500,
  teacher: 180,
};

export function abilityCooldownTicks(role: Role, abilityValue: number): number {
  return Math.max(50, Math.round(ABILITY_BASE_COOLDOWN[role] / abilityValue));
}

/** Children are all one neutral warm-cream color regardless of future role. */
export const CHILD_HUE = 45;

export const NAMES = [
  'Bloop', 'Zorp', 'Miki', 'Nubs', 'Pip', 'Glu', 'Fuzz', 'Tiki', 'Bop', 'Wink',
  'Snip', 'Doot', 'Fizz', 'Bonk', 'Wisp', 'Puff', 'Zap', 'Nori', 'Bub', 'Lux',
  'Momo', 'Kiki', 'Yip', 'Dot', 'Rex', 'Jojo', 'Cleo', 'Finn', 'Nova', 'Ziggy',
  'Sage', 'Bloom', 'Dart', 'Hana', 'Mend', 'Echo', 'Ivy', 'Reap', 'Barley', 'Dew',
  'Sprig', 'Basil', 'Fern', 'Clover', 'Moss', 'Hazel', 'Orion', 'Skye', 'Kite', 'Finch',
  'Wren', 'Rook', 'Juno', 'Tilly', 'Pax', 'Lumi', 'Nico', 'Ori', 'Mica', 'Tully',
];

export const randomName = (): string => NAMES[Math.floor(Math.random() * NAMES.length)];

const id9 = () => Math.random().toString(36).substring(2, 11);

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function hueToRgb(h: number, s = 0.75, l = 0.55): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r: number, g: number, b: number;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return `rgb(${Math.round((r + m) * 255)},${Math.round((g + m) * 255)},${Math.round((b + m) * 255)})`;
}

export function hueForRole(role: Role, abilityValue: number): number {
  return ROLE_HUE[role] + (abilityValue - 1) * 10;
}

export const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

export interface CreatureOpts {
  x?: number;
  y?: number;
  stage?: LifeStage;
  role?: Role | null;
  age?: number;
  longevity?: number;
  generation?: number;
  energy?: number;
  abilityValue?: number;
}

export function createCreature(opts: CreatureOpts = {}): Creature {
  const longevity = opts.longevity ?? 0.8 + Math.random() * 0.45;
  const adultAge = Math.round(CHILD_DURATION * longevity);
  const elderAge = adultAge + Math.round(ADULT_DURATION * longevity);
  const maxAge = elderAge + Math.round(ELDER_DURATION * longevity);

  const stage = opts.stage ?? 'child';
  const role = stage === 'child' ? null : (opts.role ?? null);
  const abilityValue = opts.abilityValue ?? (role ? clamp(0.8 + Math.random() * 0.6, 0.4, 3.0) : 1.0);
  // Vary the starting age within the stage so generations don't cohort-age in sync.
  const stageSpan = stage === 'adult'
    ? elderAge - adultAge
    : stage === 'elder'
      ? maxAge - elderAge
      : adultAge;
  const stageBase = stage === 'adult' ? adultAge : stage === 'elder' ? elderAge : 0;
  const age = opts.age ?? Math.floor(stageBase + Math.random() * stageSpan * 0.35);
  const hue = stage === 'child' ? CHILD_HUE : (role ? hueForRole(role, abilityValue) : CHILD_HUE);

  return {
    id: id9(),
    name: randomName(),
    x: opts.x ?? Math.random() * (CANVAS_W - 40) + 20,
    y: opts.y ?? Math.random() * (CANVAS_H - 40) + 20,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    energy: opts.energy ?? 65 + Math.random() * 20,
    maxEnergy: 100,
    stamina: 70 + Math.random() * 20,
    maxStamina: 100,
    size: 10 + Math.random() * 5,
    hue,
    role,
    stage,
    abilityValue,
    education: 0,
    age,
    adultAge,
    elderAge,
    maxAge,
    longevity,
    speed: 0.8 + Math.random() * 0.5,
    eyeAngle: 0,
    state: 'wander',
    blinkTimer: Math.random() * 200,
    pulsePhase: Math.random() * Math.PI * 2,
    abilityCooldown: role ? abilityCooldownTicks(role, abilityValue) : 0,
    lastReproduceTick: -Infinity,
    learnFlash: 0,
    children: 0,
    generation: opts.generation ?? 1,
  };
}

export function createFood(opts: { x?: number; y?: number; type?: FoodType } = {}): Food {
  const type = opts.type ?? 'herb';
  const energy =
    type === 'fruit' ? 26 + Math.random() * 10
      : 16 + Math.random() * 8;
  const size =
    type === 'fruit' ? 6 + Math.random() * 2
      : 4 + Math.random() * 2;
  return {
    id: id9(),
    x: opts.x ?? Math.random() * (CANVAS_W - 20) + 10,
    y: opts.y ?? Math.random() * (CANVAS_H - 20) + 10,
    energy,
    size,
    pulse: Math.random() * Math.PI * 2,
    type,
  };
}

export function createNest(builder: Creature, tick: number): Nest {
  return {
    id: id9(),
    x: builder.x,
    y: builder.y,
    radius: NEST_RADIUS,
    builtAtTick: tick,
    builderId: builder.id,
    pulse: Math.random() * Math.PI * 2,
  };
}

/**
 * Diet rule: producers can't eat their own crop.
 * Farmers can't eat herbs (their product); harvesters can't eat fruit (theirs).
 * Everyone else (healer, builder, teacher, children) eats anything.
 */
export function canEat(c: Creature, f: Food): boolean {
  if (c.role === 'farmer' && f.type === 'herb') return false;
  if (c.role === 'harvester' && f.type === 'fruit') return false;
  return true;
}

/** Builders can't benefit from nests they built themselves. */
export function creatureInsideNest(c: Creature, nests: Nest[]): Nest | null {
  for (const n of nests) {
    if (n.builderId === c.id) continue;
    if (dist(c, n) < n.radius) return n;
  }
  return null;
}

/**
 * Teachers and healers shouldn't waste a work shift (draining stamina) when
 * there's nobody to act on. This predicate lets them wander instead.
 * Farmers, harvesters, and builders always have productive work available.
 */
export function canDoUsefulWork(c: Creature, creatures: Creature[]): boolean {
  if (c.role === 'teacher') {
    for (const o of creatures) {
      if (o.id === c.id) continue;
      if (o.stage !== 'child') continue;
      if (dist(c, o) < 260) return true;
    }
    return false;
  }
  if (c.role === 'healer') {
    for (const o of creatures) {
      if (o.id === c.id) continue;
      if (o.energy >= 70) continue;
      if (dist(c, o) < 260) return true;
    }
    return false;
  }
  return true;
}

/**
 * Pick the rarest role for a child ascending into adulthood. Uneducated kids
 * can only qualify as farmer or harvester; only children who studied enough
 * can take a specialist role (healer, builder, teacher).
 */
export function chooseRoleForNewAdult(child: Creature, creatures: Creature[]): Role {
  const eligible: Role[] = child.education >= SPECIALIST_EDUCATION_THRESHOLD
    ? ROLES
    : GENERALIST_ROLES;

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
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Mutate a child into an adult. Education gates specialist roles. */
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
  c.size = 10 + Math.random() * 5;
  c.speed = 0.8 + Math.random() * 0.5;
  return { role, educated };
}

export function descendToElder(c: Creature): void {
  c.stage = 'elder';
  c.speed *= ELDER_SPEED_MULT;
}

export function createBaby(a: Creature, b: Creature): Creature {
  return createCreature({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    stage: 'child',
    generation: Math.max(a.generation, b.generation) + 1,
    energy: 45,
  });
}

export function buildInitialPopulation(): Creature[] {
  // Robust starting village: enough farmers + harvesters to keep the
  // cross-feeding flow going even if 1–2 die; 2 healers as a safety net;
  // 2 teachers so knowledge keeps flowing into the next generation.
  const adultPlan: Role[] = [
    'farmer', 'farmer', 'farmer',
    'harvester', 'harvester', 'harvester',
    'healer', 'healer',
    'builder',
    'teacher', 'teacher',
  ];
  const adults = adultPlan.map((role) => createCreature({ stage: 'adult', role }));
  const children: Creature[] = [];
  for (let i = 0; i < INITIAL_CHILDREN; i++) {
    children.push(createCreature({
      stage: 'child',
      age: Math.floor(Math.random() * CHILD_DURATION * 0.5),
    }));
  }
  return [...adults, ...children];
}
