/**
 * Layered creature rendering primitives.
 *
 * Compose them in this order for a faithful Phase 1–style creature:
 *
 *   drawSelectionRing(ctx, { cx, cy, size, tick }) // only when selected
 *   drawCreatureBody(ctx, { cx, cy, size, hue, pulsePhase })
 *   drawCreatureBadge(ctx, { cx, cy, size, text: '!' }) // optional
 *   drawCreatureFace(ctx, { cx, cy, size, hue, eyeAngle, blinkTimer, mood })
 *   drawCreatureBar(ctx, { cx, cy, size, ratio: energy/maxEnergy, color: 'energy' })
 *   drawCreatureBar(ctx, { cx, cy, size, ratio: stamina/maxStamina, color: 'stamina', yOffset: 11 })
 *   drawCreatureLabel(ctx, { cx, cy, size, text: name }) // only when selected
 */

export { buildBackground } from './background';
export type { BuildBackgroundOpts } from './background';

export { drawCreatureBody } from './creature-body';
export type { CreatureBodyParams } from './creature-body';

export { drawCreatureFace } from './creature-face';
export type { CreatureFaceParams, CreatureMood } from './creature-face';

export { drawCreatureBar } from './creature-bars';
export type { CreatureBarParams, BarColor } from './creature-bars';

export { drawCreatureBadge, drawCreatureLabel } from './creature-badges';
export type {
  CreatureBadgeParams,
  CreatureLabelParams,
} from './creature-badges';

export { drawSelectionRing } from './selection-ring';
export type { SelectionRingParams } from './selection-ring';
