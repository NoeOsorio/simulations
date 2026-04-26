/**
 * Generic stat bars rendered below a creature's body. The same primitive
 * powers energy, stamina, education, or any other 0–1 ratio.
 *
 * Stack multiple bars by passing increasing `yOffset` values.
 */

export type BarColor = 'energy' | 'stamina' | 'education';

export interface CreatureBarParams {
  /** World-space center of the creature. */
  cx: number;
  cy: number;
  /** Body radius. The bar width is computed from this. */
  size: number;
  /** Fill ratio 0–1. Clamped internally. */
  ratio: number;
  /**
   * Vertical offset added below the body (default 6px). Pass values like
   * 6, 11, 16 to stack multiple bars.
   */
  yOffset?: number;
  /** Either a preset name or any CSS color string. */
  color?: BarColor | string;
  /** Bar width as a multiplier of `size` (default 2). */
  widthMult?: number;
  /** Bar height in px (default 3). */
  height?: number;
}

const PRESET_COLORS: Record<BarColor, (ratio: number) => string> = {
  energy: (r) => `hsl(${120 * r}, ${r > 0.5 ? 80 : 90}%, 45%)`,
  stamina: () => '#00e5ff',
  education: () => '#ffb020',
};

function isPresetColor(c: string | undefined): c is BarColor {
  return c === 'energy' || c === 'stamina' || c === 'education';
}

export function drawCreatureBar(
  ctx: CanvasRenderingContext2D,
  p: CreatureBarParams,
): void {
  const ratio = Math.max(0, Math.min(1, p.ratio));
  const widthMult = p.widthMult ?? 2;
  const h = p.height ?? 3;
  const yOffset = p.yOffset ?? 6;

  const barW = p.size * widthMult;
  const barX = p.cx - barW / 2;
  const barY = p.cy + p.size + yOffset;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(barX, barY, barW, h);

  const fillColor = isPresetColor(p.color)
    ? PRESET_COLORS[p.color](ratio)
    : (p.color ?? PRESET_COLORS.energy(ratio));
  ctx.fillStyle = fillColor;
  ctx.fillRect(barX, barY, barW * ratio, h);
}
