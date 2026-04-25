/**
 * Badges and labels rendered above and below a creature: the state icon
 * (`!`, `♥`, `✦`) above the head, and the name string below the body.
 */

export interface CreatureBadgeParams {
  /** World-space center of the creature. */
  cx: number;
  cy: number;
  /** Body radius. */
  size: number;
  /** Glyph to render — single character works best. */
  text: string;
  /** CSS color (default red). */
  color?: string;
  /** Use bold weight (default true for `!`, false otherwise). */
  bold?: boolean;
}

export function drawCreatureBadge(
  ctx: CanvasRenderingContext2D,
  p: CreatureBadgeParams,
): void {
  const bold = p.bold ?? p.text === '!';
  ctx.save();
  ctx.fillStyle = p.color ?? '#ff4444';
  ctx.font = `${bold ? 'bold ' : ''}${Math.round(
    p.size * (bold ? 0.8 : 0.7),
  )}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(p.text, p.cx, p.cy - p.size - 6);
  ctx.restore();
}

export interface CreatureLabelParams {
  cx: number;
  cy: number;
  size: number;
  text: string;
  color?: string;
}

export function drawCreatureLabel(
  ctx: CanvasRenderingContext2D,
  p: CreatureLabelParams,
): void {
  ctx.save();
  ctx.fillStyle = p.color ?? 'rgba(255, 255, 255, 0.9)';
  ctx.font = "bold 10px 'Courier New', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(p.text, p.cx, p.cy + p.size + 18);
  ctx.restore();
}
