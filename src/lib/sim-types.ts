/**
 * Types shared across simulation phases.
 *
 * Existing phases (P1–P3) have their own local copies and stay frozen.
 * New phases starting with P4 should `extends CreatureBase` and reuse
 * `LogEntry` / `SavedState` directly.
 */

/** A single line in an event log. Identical across every phase. */
export interface LogEntry {
  /** Wall-clock ms (Date.now()) so logs survive replay/import. */
  t: number;
  msg: string;
}

/**
 * On-disk save payload. Generic over the stats shape (each phase tracks
 * different counters) so phases can keep precise types without rewriting
 * the wrapper.
 *
 * Phases that need extra collections (e.g. nests) extend this:
 *
 *   interface MySavedState extends SavedState<MyStats, MyCreature, MyFood> {
 *     nests: MyNest[];
 *   }
 *
 * `version` is a number (not a literal) so each phase can pick its own
 * version without fighting the type checker.
 */
export interface SavedState<
  TStats = Record<string, number>,
  TCreature = unknown,
  TFood = unknown,
> {
  version: number;
  /** ISO timestamp produced at save time. */
  savedAt: string;
  tick: number;
  stats: TStats;
  creatures: TCreature[];
  food: TFood[];
}

/**
 * Fields every creature in every phase has had so far.
 *
 * `state` is left as a generic string type union so each phase can constrain
 * it to its own state machine (e.g. `'wander' | 'seek' | 'eat'` for P1, plus
 * `'work' | 'rest'` for P2+). Default to the loosest form so callers don't
 * have to bother with generics if they don't care.
 */
export interface CreatureBase<TState extends string = string> {
  id: string;
  name: string;

  /** World position. */
  x: number;
  y: number;
  /** Per-tick velocity. */
  vx: number;
  vy: number;

  /** Energy budget — reaches 0 → death. */
  energy: number;
  maxEnergy: number;

  /** Visual size (radius in canvas units). */
  size: number;
  /** Hue 0–360. Used by the renderer for body color. */
  hue: number;

  /** Ticks since birth. */
  age: number;
  /** Movement speed multiplier. */
  speed: number;

  /** Eye look direction in radians. */
  eyeAngle: number;
  /** Frames remaining until next blink. */
  blinkTimer: number;
  /** Drives the breathing pulse on body size. */
  pulsePhase: number;

  /** Behavioral state — phase-specific, but the field is universal. */
  state: TState;

  children: number;
  generation: number;
}
