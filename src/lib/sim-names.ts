/**
 * Default name pool used across simulations. Phases are free to import
 * a wider pool or pass their own list to `randomName`.
 */

import { randomChoice } from './sim-math';

/**
 * 60 short, friendly names. This is the union of the pools used in
 * Phase 1–3 and is intentionally generous so a new phase has plenty of
 * variety without curating.
 */
export const DEFAULT_NAMES: readonly string[] = [
  'Bloop', 'Zorp', 'Miki', 'Nubs', 'Pip', 'Glu', 'Fuzz', 'Tiki', 'Bop', 'Wink',
  'Snip', 'Doot', 'Fizz', 'Bonk', 'Wisp', 'Puff', 'Zap', 'Nori', 'Bub', 'Lux',
  'Momo', 'Kiki', 'Yip', 'Dot', 'Rex', 'Jojo', 'Cleo', 'Finn', 'Nova', 'Ziggy',
  'Sage', 'Bloom', 'Dart', 'Hana', 'Mend', 'Echo', 'Ivy', 'Reap', 'Barley', 'Dew',
  'Sprig', 'Basil', 'Fern', 'Clover', 'Moss', 'Hazel', 'Orion', 'Skye', 'Kite', 'Finch',
  'Wren', 'Rook', 'Juno', 'Tilly', 'Pax', 'Lumi', 'Nico', 'Ori', 'Mica', 'Tully',
];

/**
 * Pick a random name. Pass a custom pool when a phase wants thematic
 * names (e.g. mythological for a future civilization phase).
 */
export const randomName = (pool: readonly string[] = DEFAULT_NAMES): string =>
  randomChoice(pool);
