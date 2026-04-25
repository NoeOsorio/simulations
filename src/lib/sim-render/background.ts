/**
 * Pre-render the static viewport backdrop (radial gradient + HUD grid)
 * to an offscreen canvas so the live render loop only needs a single
 * `drawImage()` per frame instead of redrawing hundreds of grid lines.
 *
 * Every existing phase reimplements this same kernel — Phase 4 should
 * call this once during effect setup and reuse the returned canvas.
 */

export interface BuildBackgroundOpts {
  width: number;
  height: number;
  /** Fine grid spacing in px. */
  gridSizeFine?: number;
  /** Major grid spacing in px (drawn brighter). */
  gridSizeMajor?: number;
  /** Color at the center of the radial fill. */
  centerColor?: string;
  /** Color at the edges of the radial fill. */
  edgeColor?: string;
  /** Color of the fine grid lines. */
  fineLineColor?: string;
  /** Color of the major grid lines. */
  majorLineColor?: string;
}

const DEFAULTS = {
  gridSizeFine: 40,
  gridSizeMajor: 200,
  centerColor: '#0c1420',
  edgeColor: '#05070a',
  fineLineColor: 'rgba(0, 229, 255, 0.06)',
  majorLineColor: 'rgba(0, 229, 255, 0.18)',
} as const;

/**
 * Build an offscreen canvas containing the static viewport background.
 * Call once per simulation mount; cache the returned canvas; pass it to
 * `ctx.drawImage(bg, 0, 0)` each frame.
 */
export function buildBackground(opts: BuildBackgroundOpts): HTMLCanvasElement {
  const {
    width,
    height,
    gridSizeFine = DEFAULTS.gridSizeFine,
    gridSizeMajor = DEFAULTS.gridSizeMajor,
    centerColor = DEFAULTS.centerColor,
    edgeColor = DEFAULTS.edgeColor,
    fineLineColor = DEFAULTS.fineLineColor,
    majorLineColor = DEFAULTS.majorLineColor,
  } = opts;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const grad = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, Math.max(width, height) * 0.8,
  );
  grad.addColorStop(0, centerColor);
  grad.addColorStop(1, edgeColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = fineLineColor;
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += gridSizeFine) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += gridSizeFine) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = majorLineColor;
  for (let x = 0; x <= width; x += gridSizeMajor) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += gridSizeMajor) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  return canvas;
}
