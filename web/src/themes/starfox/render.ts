// The Super FX look: a low-resolution canvas (scaled up with crisp pixels),
// flat-shaded polygons with a handful of shades per colour, dithered bands
// instead of smooth gradients, and painter's-algorithm sorting. Coordinates
// are camera-relative world units: x is across, y is up, z is into the screen.

export type Vec3 = [number, number, number];
export type Pt = [number, number];

export interface View {
  /** Focal length, in canvas pixels. */
  f: number;
  /** Screen centre x and horizon y, in canvas pixels. */
  cx: number;
  hy: number;
  camX: number;
  camY: number;
}

export interface Face {
  pts: Vec3[];
  colour: string;
}

/** Anything closer than this to the camera isn't drawn. */
export const NEAR = 6;

export const project = (v: View, x: number, y: number, z: number): Pt => [
  v.cx + (v.f * (x - v.camX)) / z,
  v.hy - (v.f * (y - v.camY)) / z,
];

export function fillPoly(ctx: CanvasRenderingContext2D, pts: Pt[], fill: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

const rgbCache = new Map<string, number[]>();
function hexRgb(hex: string): number[] {
  let rgb = rgbCache.get(hex);
  if (!rgb) {
    const n = parseInt(hex.slice(1), 16);
    rgb = [n >> 16, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, rgb);
  }
  return rgb;
}

/**
 * A colour lit by `k`, snapped to a few brightness steps and to the SNES's
 * 15-bit colour, so neighbouring faces read as distinct flat shades.
 */
export function shade(hex: string, k: number): string {
  const step = Math.round(k / 0.14) * 0.14;
  const [r, g, b] = hexRgb(hex).map((c) => Math.min(248, Math.round((c * step) / 8) * 8));
  return `rgb(${r},${g},${b})`;
}

// Light from up, left and behind the camera.
const LIGHT: Vec3 = (() => {
  const l: Vec3 = [-0.4, 0.8, -0.45];
  const n = Math.hypot(...l);
  return [l[0] / n, l[1] / n, l[2] / n];
})();

/**
 * Draws a mesh's faces back to front, each lit by its normal (turned to face
 * the camera, so thin wings and fins light the same from either side).
 */
export function drawMesh(ctx: CanvasRenderingContext2D, v: View, faces: Face[]) {
  const sorted = faces
    .filter((f) => f.pts.every((p) => p[2] > NEAR))
    .map((f) => ({ f, z: f.pts.reduce((s, p) => s + p[2], 0) / f.pts.length }))
    .sort((a, b) => b.z - a.z);
  for (const { f } of sorted) {
    const [a, b, c] = f.pts;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((c) => c / len);
    // Face the camera: the normal should point back toward it.
    const toCam = [v.camX - a[0], v.camY - a[1], -a[2]];
    if (n[0] * toCam[0] + n[1] * toCam[1] + n[2] * toCam[2] < 0) n = n.map((c) => -c);
    const lit = 0.5 + 0.65 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    fillPoly(
      ctx,
      f.pts.map((p) => project(v, p[0], p[1], p[2])),
      shade(f.colour, lit)
    );
  }
}

interface BoxFaces {
  left?: boolean;
  right?: boolean;
  top?: boolean;
  bottom?: boolean;
}

/** An axis-aligned box from (x0, y0, z0) to (x1, y1, z1); only the faces the camera can see. */
export function drawBox(
  ctx: CanvasRenderingContext2D,
  v: View,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  colour: string,
  skip: BoxFaces = {}
) {
  if (z0 <= NEAR) return;
  const p = (x: number, y: number, z: number) => project(v, x, y, z);
  if (!skip.left && v.camX < x0)
    fillPoly(ctx, [p(x0, y0, z0), p(x0, y1, z0), p(x0, y1, z1), p(x0, y0, z1)], shade(colour, 0.62));
  if (!skip.right && v.camX > x1)
    fillPoly(ctx, [p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)], shade(colour, 0.62));
  if (!skip.top && v.camY > y1)
    fillPoly(ctx, [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)], shade(colour, 1.1));
  if (!skip.bottom && v.camY < y0)
    fillPoly(ctx, [p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1)], shade(colour, 0.42));
  fillPoly(ctx, [p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0)], shade(colour, 0.86));
}

// ----- Dithered bands ------------------------------------------------------

const patterns = new Map<string, CanvasPattern | null>();

/** A one-pixel checkerboard of two colours: the in-between shade of a band edge. */
function checker(ctx: CanvasRenderingContext2D, a: string, b: string): CanvasPattern | string {
  const key = a + b;
  if (!patterns.has(key)) {
    const tile = document.createElement("canvas");
    tile.width = 2;
    tile.height = 2;
    const t = tile.getContext("2d");
    if (t) {
      t.fillStyle = a;
      t.fillRect(0, 0, 2, 2);
      t.fillStyle = b;
      t.fillRect(1, 0, 1, 1);
      t.fillRect(0, 1, 1, 1);
    }
    patterns.set(key, ctx.createPattern(tile, "repeat"));
  }
  return patterns.get(key) ?? a;
}

/**
 * Fills rows y0..y1 with `colours` as flat bands, each joined to the next by
 * a strip of checkerboard dither, the way 16-bit skies were painted.
 */
export function bands(
  ctx: CanvasRenderingContext2D,
  width: number,
  y0: number,
  y1: number,
  colours: string[]
) {
  const n = colours.length;
  const h = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const top = Math.round(y0 + i * h);
    const bottom = Math.round(y0 + (i + 1) * h);
    ctx.fillStyle = colours[i];
    ctx.fillRect(0, top, width, bottom - top);
    if (i < n - 1) {
      const d = Math.max(1, Math.round(h * 0.3));
      ctx.fillStyle = checker(ctx, colours[i], colours[i + 1]);
      ctx.fillRect(0, bottom - d, width, d);
    }
  }
}

// ----- Models --------------------------------------------------------------

/**
 * Scales a model point, rotates it about z (roll), then x (pitch, positive
 * dips the nose), then y (yaw), and moves it into place.
 */
export function place(p: Vec3, at: Vec3, roll: number, yaw = 0, scale = 1, pitch = 0): Vec3 {
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const x1 = (p[0] * cr - p[1] * sr) * scale;
  const y0 = (p[0] * sr + p[1] * cr) * scale;
  const z0 = p[2] * scale;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const y1 = y0 * cp - z0 * sp;
  const z1 = y0 * sp + z0 * cp;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  return [at[0] + x1 * cy + z1 * sy, at[1] + y1, at[2] - x1 * sy + z1 * cy];
}

type Model = { pts: Vec3[]; colour: string }[];

const mirror = (m: Model): Model =>
  m.map((f) => ({ ...f, pts: f.pts.map(([x, y, z]) => [-x, y, z] as Vec3).reverse() }));

const ARWING_WHITE = "#e8e8f0";
const ARWING_GREY = "#a8b0c0";
const ARWING_DARK = "#586078";
const ARWING_BLUE = "#2850e0";
const CANOPY = "#30a8e8";

// The Arwing, nose along +z, seen from behind: a pointed fuselage, swept
// wings with a little droop, and the blue fins standing up at the tips.
const ARWING_HALF: Model = [
  // Fuselage, left half.
  { pts: [[0, 1, 46], [-8, 2, -6], [0, 7, -2]], colour: ARWING_WHITE },
  { pts: [[0, 7, -2], [-8, 2, -6], [-7, 0, -20], [0, 5, -20]], colour: ARWING_GREY },
  { pts: [[0, 1, 46], [-6, -4, -8], [-8, 2, -6]], colour: ARWING_GREY },
  { pts: [[-8, 2, -6], [-6, -4, -8], [-7, 0, -20]], colour: ARWING_DARK },
  { pts: [[0, 1, 46], [0, -4, -20], [-6, -4, -8]], colour: ARWING_DARK },
  { pts: [[-6, -4, -8], [0, -4, -20], [-7, 0, -20]], colour: ARWING_DARK },
  // Wing.
  { pts: [[-6, 0, 10], [-7, 0, -16], [-42, -7, -22], [-40, -7, -12]], colour: ARWING_WHITE },
  { pts: [[-6, 0, 10], [-24, -4, -4], [-7, -1, -6]], colour: ARWING_GREY },
  // Fin: up and out from the wing tip, with a short spur below.
  { pts: [[-38, -7, -6], [-42, -7, -22], [-47, 9, -28], [-44, 9, -16]], colour: ARWING_BLUE },
  { pts: [[-38, -7, -6], [-40, -15, -16], [-42, -7, -22]], colour: ARWING_BLUE },
];
const ARWING_CANOPY: Model = [
  { pts: [[0, 4, 22], [-4, 3, 4], [0, 7, 2]], colour: CANOPY },
  { pts: [[0, 4, 22], [0, 7, 2], [4, 3, 4]], colour: CANOPY },
];
export const ARWING: Model = [...ARWING_HALF, ...mirror(ARWING_HALF), ...ARWING_CANOPY];
/** The engine nozzle, for the flame. */
export const ARWING_TAIL: Vec3 = [0, 1, -21];

const ENEMY_RED = "#c83830";
const ENEMY_DARK = "#683040";
const ENEMY_GLOW = "#f8c030";

// A Venom fighter, nose along -z (pointing at the player).
const ENEMY_HALF: Model = [
  { pts: [[0, 2, -24], [-9, 0, 10], [0, 7, 8]], colour: ENEMY_RED },
  { pts: [[0, 2, -24], [0, -5, 8], [-9, 0, 10]], colour: ENEMY_DARK },
  { pts: [[-6, 0, -2], [-34, -3, 16], [-30, 8, 18], [-9, 0, 10]], colour: ENEMY_RED },
  { pts: [[-30, 8, 18], [-34, -3, 16], [-33, 14, 26]], colour: ENEMY_DARK },
];
export const ENEMY: Model = [
  ...ENEMY_HALF,
  ...mirror(ENEMY_HALF),
  { pts: [[0, 4, -10], [-3, 3, 2], [3, 3, 2]], colour: ENEMY_GLOW },
];

/** Ten tumbling shards for an explosion, cut from the enemy's colours. */
export const SHARD_COLOURS = [ENEMY_RED, ENEMY_DARK, ENEMY_GLOW, "#a0a0b0"];
