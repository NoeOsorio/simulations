/**
 * Draws a creature's body: ground shadow, outer glow, and the colored sphere.
 * Visually identical to Phase 1's hand-rolled drawCreature body section.
 *
 * Use this as the first layer when composing a creature visual; eyes/face,
 * bars, and badges go on top.
 */

export interface CreatureBodyParams {
  /** World-space center. */
  cx: number;
  cy: number;
  /** Base radius in canvas units. */
  size: number;
  /** Hue 0–360. */
  hue: number;
  /**
   * Optional breathing pulse phase. When provided, the rendered radius
   * oscillates ±2px on top of `size` to convey life. Pass the creature's
   * stored phase so different individuals breathe out of sync.
   */
  pulsePhase?: number;
}

export function drawCreatureBody(
  ctx: CanvasRenderingContext2D,
  p: CreatureBodyParams,
): void {
  const pulse = p.pulsePhase !== undefined ? Math.sin(p.pulsePhase) * 2 : 0;
  const r = p.size + pulse;

  ctx.save();
  ctx.translate(p.cx, p.cy);

  // Ground shadow — flat ellipse below the body.
  ctx.beginPath();
  ctx.ellipse(0, r * 0.6, r * 0.8, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fill();

  // Outer glow — soft hue-tinted halo.
  const glow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.8);
  glow.addColorStop(0, `hsla(${p.hue}, 70%, 60%, 0.3)`);
  glow.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // Body — radial gradient from highlight to mid to shadow side.
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
  grad.addColorStop(0, `hsla(${p.hue}, 80%, 75%, 1)`);
  grad.addColorStop(0.6, `hsla(${p.hue}, 75%, 55%, 1)`);
  grad.addColorStop(1, `hsla(${p.hue}, 60%, 35%, 1)`);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = `hsla(${p.hue}, 50%, 30%, 0.5)`;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}
