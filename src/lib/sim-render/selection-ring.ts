/**
 * Marching-ants ring used to highlight a selected creature. Pass the
 * current simulation tick so the dashes appear to crawl over time.
 */

export interface SelectionRingParams {
  cx: number;
  cy: number;
  /** Body radius — ring is drawn ~8px outside this. */
  size: number;
  /** Current tick (or any monotonically increasing number) for animation. */
  tick: number;
  /** CSS color for the ring (default warm yellow). */
  color?: string;
}

export function drawSelectionRing(
  ctx: CanvasRenderingContext2D,
  p: SelectionRingParams,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, p.size + 8, 0, Math.PI * 2);
  ctx.strokeStyle = p.color ?? 'rgba(255, 255, 100, 0.7)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.lineDashOffset = -p.tick * 0.1;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
