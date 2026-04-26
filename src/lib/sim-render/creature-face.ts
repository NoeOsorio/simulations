/**
 * Draws the face of a creature: two eyes that track and blink, plus a
 * mouth whose shape responds to mood. Layered on top of `drawCreatureBody`.
 */

export type CreatureMood =
  | 'neutral'
  /** Slight upward arc — happy / content. */
  | 'happy'
  /** Open circle — eating. */
  | 'eating'
  /** Inverted arc — tired / low energy. */
  | 'tired';

export interface CreatureFaceParams {
  /** World-space center of the creature body. */
  cx: number;
  cy: number;
  /** Body radius (same value used for `drawCreatureBody.size`). */
  size: number;
  /** Hue 0–360 — used by the mouth stroke for color cohesion with the body. */
  hue: number;
  /** Direction the pupils look, in radians. */
  eyeAngle: number;
  /** Blink countdown — values < 8 render closed eyes. */
  blinkTimer: number;
  mood?: CreatureMood;
}

export function drawCreatureFace(
  ctx: CanvasRenderingContext2D,
  p: CreatureFaceParams,
): void {
  const { size: r, hue, eyeAngle, blinkTimer, mood = 'neutral' } = p;
  const isBlink = blinkTimer < 8;

  ctx.save();
  ctx.translate(p.cx, p.cy);

  const eyeDist = r * 0.35;
  const eyeSize = r * 0.28;
  const lookX = Math.cos(eyeAngle) * eyeSize * 0.3;
  const lookY = Math.sin(eyeAngle) * eyeSize * 0.3;

  for (const side of [-1, 1]) {
    const ex = side * eyeDist;
    const ey = -r * 0.1;

    ctx.beginPath();
    ctx.ellipse(
      ex,
      ey,
      eyeSize,
      isBlink ? eyeSize * 0.1 : eyeSize,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    if (!isBlink) {
      // Pupil.
      ctx.beginPath();
      ctx.arc(ex + lookX, ey + lookY, eyeSize * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();
      // Specular highlight.
      ctx.beginPath();
      ctx.arc(
        ex + lookX - eyeSize * 0.15,
        ey + lookY - eyeSize * 0.15,
        eyeSize * 0.18,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fill();
    }
  }

  // Mouth — shape varies with mood.
  ctx.beginPath();
  if (mood === 'eating') {
    ctx.arc(0, r * 0.25, r * 0.2, 0, Math.PI);
  } else if (mood === 'tired') {
    ctx.arc(0, r * 0.35, r * 0.15, Math.PI, 0);
  } else if (mood === 'happy') {
    ctx.arc(0, r * 0.2, r * 0.18, 0, Math.PI);
  } else {
    ctx.arc(0, r * 0.2, r * 0.15, 0.1, Math.PI - 0.1);
  }
  ctx.strokeStyle = `hsla(${hue}, 40%, 25%, 0.7)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}
