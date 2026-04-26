/**
 * Universal math helpers for simulations. Pure, side-effect free.
 *
 * Every shipped phase has a private copy of these — when a new phase is
 * authored from Phase 4 onward, import from here instead of duplicating.
 */

export interface Point {
  x: number;
  y: number;
}

export const dist = (a: Point, b: Point): number =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

export const distSquared = (a: Point, b: Point): number =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

/**
 * HSL → RGB string. Defaults match the existing simulations
 * (saturation 0.75, lightness 0.55) so visuals stay consistent.
 */
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

/** 9-character base36 random id. Cheap and good enough for entity ids. */
export const randomId = (): string =>
  Math.random().toString(36).substring(2, 11);

/** Inclusive integer in [lo, hi]. */
export const randomInt = (lo: number, hi: number): number =>
  lo + Math.floor(Math.random() * (hi - lo + 1));

/** Float in [lo, hi). */
export const randomRange = (lo: number, hi: number): number =>
  lo + Math.random() * (hi - lo);

/** Pick a random element from a non-empty array. */
export const randomChoice = <T>(arr: readonly T[]): T => {
  if (arr.length === 0) {
    throw new Error('randomChoice: array is empty');
  }
  return arr[Math.floor(Math.random() * arr.length)] as T;
};
