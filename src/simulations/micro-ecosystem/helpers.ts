import type { Creature, Food } from './types';

export const CANVAS_W = 800;
export const CANVAS_H = 520;
export const FOOD_SPAWN_RATE = 0.03;
export const MAX_FOOD = 80;
export const REPRODUCE_ENERGY = 70;
export const INITIAL_CREATURES = 8;
export const INITIAL_FOOD = 25;

export const NAMES = [
  'Bloop', 'Zorp', 'Miki', 'Nubs', 'Pip', 'Glu', 'Fuzz', 'Tiki', 'Bop', 'Wink',
  'Snip', 'Doot', 'Fizz', 'Bonk', 'Wisp', 'Puff', 'Zap', 'Nori', 'Bub', 'Lux',
  'Momo', 'Kiki', 'Yip', 'Dot', 'Rex', 'Jojo', 'Cleo', 'Finn', 'Nova', 'Ziggy',
];

export const randomName = (): string => NAMES[Math.floor(Math.random() * NAMES.length)];

const id9 = () => Math.random().toString(36).substring(2, 11);

export function hueToRgb(h: number): string {
  const s = 0.75;
  const l = 0.55;
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

export function createCreature(x?: number, y?: number, hue?: number): Creature {
  return {
    id: id9(),
    name: randomName(),
    x: x ?? Math.random() * (CANVAS_W - 40) + 20,
    y: y ?? Math.random() * (CANVAS_H - 40) + 20,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    energy: 50 + Math.random() * 20,
    maxEnergy: 100,
    size: 10 + Math.random() * 6,
    hue: hue ?? Math.random() * 360,
    age: 0,
    speed: 0.8 + Math.random() * 1.2,
    eyeAngle: 0,
    state: 'wander',
    blinkTimer: Math.random() * 200,
    children: 0,
    generation: 1,
    pulsePhase: Math.random() * Math.PI * 2,
  };
}

export function createFood(): Food {
  return {
    id: id9(),
    x: Math.random() * (CANVAS_W - 20) + 10,
    y: Math.random() * (CANVAS_H - 20) + 10,
    energy: 15 + Math.random() * 15,
    size: 4 + Math.random() * 4,
    pulse: Math.random() * Math.PI * 2,
    type: Math.random() > 0.3 ? 'plant' : 'fruit',
  };
}

export const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
