import type { Creature, Food, FoodType, Nest, Role } from './types';

export const CANVAS_W = 800;
export const CANVAS_H = 520;

export const INITIAL_FOOD = 32;
export const MAX_FOOD = 160;

export const REPRODUCE_ENERGY = 58;
export const REPRODUCE_STAMINA = 28;
export const REPRODUCE_COST_ENERGY = 24;
export const REPRODUCE_COST_STAMINA = 16;
export const MATURE_AGE = 300;
/** Radius for actually mating (touching distance). */
export const MATE_CONTACT_RADIUS = 60;
/** Radius for spotting another ready mate and moving toward them. */
export const MATE_SEEK_RADIUS = 220;

export const LOW_ENERGY = 28;
export const LOW_STAMINA = 16;
/** Creatures exit rest only after climbing back above this stamina. */
export const REST_EXIT_STAMINA = 55;

export const STAMINA_DRAIN_WORK = 0.12;
export const STAMINA_RECOVER_REST = 0.55;
export const STAMINA_RECOVER_IDLE = 0.22;
export const ENERGY_DRAIN_BASE = 0.034;
export const ENERGY_DRAIN_WORK = 0.018;

export const ROLES: Role[] = ['farmer', 'harvester', 'healer', 'builder'];

export const ROLE_HUE: Record<Role, number> = {
  farmer: 125,
  harvester: 28,
  healer: 190,
  builder: 275,
};

export const ROLE_LABEL: Record<Role, string> = {
  farmer: 'Farmer',
  harvester: 'Harvester',
  healer: 'Healer',
  builder: 'Builder',
};

export const ROLE_ICON: Record<Role, string> = {
  farmer: '🌱',
  harvester: '🧺',
  healer: '💊',
  builder: '🛖',
};

export const ROLE_DESC: Record<Role, string> = {
  farmer: 'Plants many low-energy herbs, fast.',
  harvester: 'Grows fewer apples — high energy each.',
  healer: 'Donates energy to weak allies nearby.',
  builder: 'Builds nests — rest faster, mate easier.',
};

const ABILITY_BASE_COOLDOWN: Record<Role, number> = {
  farmer: 140,
  harvester: 280,
  healer: 180,
  builder: 500,
};

export const NEST_RADIUS = 58;
export const MAX_NESTS = 3;
/** Multiplier applied to stamina recovery while a creature is inside a nest. */
export const NEST_STAMINA_MULT = 2.0;
/** Multiplier applied to the mate-seek radius while inside a nest. */
export const NEST_MATE_SEEK_MULT = 1.8;

export function abilityCooldownTicks(role: Role, abilityValue: number): number {
  return Math.max(50, Math.round(ABILITY_BASE_COOLDOWN[role] / abilityValue));
}

export const NAMES = [
  'Bloop', 'Zorp', 'Miki', 'Nubs', 'Pip', 'Glu', 'Fuzz', 'Tiki', 'Bop', 'Wink',
  'Snip', 'Doot', 'Fizz', 'Bonk', 'Wisp', 'Puff', 'Zap', 'Nori', 'Bub', 'Lux',
  'Momo', 'Kiki', 'Yip', 'Dot', 'Rex', 'Jojo', 'Cleo', 'Finn', 'Nova', 'Ziggy',
  'Sage', 'Bloom', 'Dart', 'Hana', 'Mend', 'Echo', 'Ivy', 'Reap', 'Barley', 'Dew',
  'Sprig', 'Basil', 'Fern', 'Clover', 'Moss', 'Hazel', 'Orion', 'Skye', 'Kite', 'Finch',
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

export interface CreatureOpts {
  x?: number;
  y?: number;
  role?: Role;
  abilityValue?: number;
  generation?: number;
  energy?: number;
}

export function createCreature(opts: CreatureOpts = {}): Creature {
  const role = opts.role ?? ROLES[Math.floor(Math.random() * ROLES.length)];
  const abilityValue = clamp(opts.abilityValue ?? 0.6 + Math.random() * 1.0, 0.4, 3.0);
  const hue = hueForRole(role, abilityValue);
  const baseSpeed = 0.8;
  return {
    id: id9(),
    name: randomName(),
    x: opts.x ?? Math.random() * (CANVAS_W - 40) + 20,
    y: opts.y ?? Math.random() * (CANVAS_H - 40) + 20,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    energy: opts.energy ?? 50 + Math.random() * 20,
    maxEnergy: 100,
    stamina: 70 + Math.random() * 20,
    maxStamina: 100,
    size: 10 + Math.random() * 5,
    hue,
    role,
    abilityValue,
    age: 0,
    speed: baseSpeed + Math.random() * 0.5,
    eyeAngle: 0,
    state: 'wander',
    blinkTimer: Math.random() * 200,
    pulsePhase: Math.random() * Math.PI * 2,
    abilityCooldown: abilityCooldownTicks(role, abilityValue),
    children: 0,
    generation: opts.generation ?? 1,
  };
}

export function createFood(opts: { x?: number; y?: number; type?: FoodType } = {}): Food {
  const type = opts.type ?? 'leaf';
  const energy =
    type === 'rare' ? 50 + Math.random() * 14
      : type === 'fruit' ? 26 + Math.random() * 10
      : 16 + Math.random() * 8;
  const size =
    type === 'rare' ? 7 + Math.random() * 2
      : type === 'fruit' ? 6 + Math.random() * 2
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

/**
 * Child inherits role from exactly one parent (50/50).
 * Their abilityValue comes from the same parent who donated the role,
 * with a small mutation so lineages can drift over time.
 */
export function createChild(a: Creature, b: Creature): Creature {
  const donor = Math.random() < 0.5 ? a : b;
  const mutation = (Math.random() - 0.5) * 0.3;
  return createCreature({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    role: donor.role,
    abilityValue: clamp(donor.abilityValue + mutation, 0.4, 3.0),
    generation: Math.max(a.generation, b.generation) + 1,
    energy: 45,
  });
}

export const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

/** Build the default starting population: a rough mix biased toward farmers. */
export function buildInitialPopulation(): Creature[] {
  const plan: Role[] = [
    'farmer', 'farmer', 'farmer', 'farmer',
    'harvester', 'harvester', 'harvester',
    'healer', 'healer', 'healer',
    'builder', 'builder',
  ];
  return plan.map((role) => createCreature({ role }));
}

export function createNest(builder: Creature, tick: number): Nest {
  return {
    id: Math.random().toString(36).substring(2, 11),
    x: builder.x,
    y: builder.y,
    radius: NEST_RADIUS,
    builtAtTick: tick,
    builderId: builder.id,
    pulse: Math.random() * Math.PI * 2,
  };
}

export function creatureInsideNest(c: Creature, nests: Nest[]): Nest | null {
  for (const n of nests) {
    if (dist(c, n) < n.radius) return n;
  }
  return null;
}
