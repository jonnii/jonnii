// The flight, drawn Super FX style: flat-shaded boxes in a perspective
// projection, sorted back to front. Everything is in camera-relative world
// units: x is across, y is up, z is into the screen.

interface Voxel {
  c: number;
  r: number;
  letter: number;
}

interface Bolt {
  /** Seconds since it was fired. */
  age: number;
  side: -1 | 1;
}

export interface Scene {
  /** Canvas size in CSS pixels. */
  w: number;
  h: number;
  time: number;
  /** Distance flown, for scrolling the ground and the towers. */
  travel: number;
  /** Distance to the voxel wordmark. */
  wordZ: number;
  camX: number;
  /** Arrow-key steering: -1, 0 or 1. */
  steer: number;
  /** Mouse x as a fraction of the window, if the mouse is steering. */
  pointer: number | null;
  bolts: Bolt[];
  voxels: Voxel[];
  /** Filled cells, as "c,r", for culling faces between neighbours. */
  filled: Set<string>;
  cols: number;
}

const SPEED = 110;
const FAR = 2200;
const WORD_START = 1100;
const WORD_RESPAWN = 1900;
/** Voxel size, and the height of the wordmark's underside: it's an arch you fly under. */
const VOXEL = 18;
const WORD_FLOOR = 55;
const WORD_DEPTH = VOXEL * 1.6;
const CAM_Y = 40;
const STEER_RANGE = 140;
const STEER_SPEED = 220;
const BOLT_S = 0.45;
const GRID = 60;
const TOWER_SPACING = 170;
const TOWER_COUNT = 14;

const SKY_TOP = "#2b4fbf";
const SKY_MID = "#7fb3ff";
const HAZE = "#d8ecff";
const HILLS = "#6a8fd0";
const GROUND_FAR = "#2f7a3a";
const GROUND_NEAR = "#5cc05a";
const GRID_LINE = "rgba(20, 60, 25, 0.55)";
const TOWER = "#8a96b0";
const LETTERS = ["#ffd23a", "#ff8a3a", "#ff5aa0", "#7a8aff", "#3ad0ff", "#7af07a"];

// Towers along both sides of the corridor, from a fixed seed so every visit
// flies the same Corneria.
const TOWERS = (() => {
  let s = 1993;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: TOWER_COUNT }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const w = 34 + rnd() * 30;
    return {
      x: side * (250 + rnd() * 320) - (side < 0 ? w : 0),
      z: i * TOWER_SPACING + rnd() * 60,
      w,
      h: 90 + rnd() * 200,
    };
  });
})();
const TOWER_SPAN = TOWER_COUNT * TOWER_SPACING;

export function makeScene(voxels: Voxel[], cols: number): Scene {
  return {
    w: 0,
    h: 0,
    time: 0,
    travel: 0,
    wordZ: WORD_START,
    camX: 0,
    steer: 0,
    pointer: null,
    bolts: [],
    voxels,
    filled: new Set(voxels.map((v) => `${v.c},${v.r}`)),
    cols,
  };
}

export function fire(scene: Scene) {
  scene.bolts.push({ age: 0, side: -1 }, { age: 0, side: 1 });
}

interface View {
  f: number;
  cx: number;
  hy: number;
  camX: number;
}

type Pt = [number, number];

const project = (v: View, x: number, y: number, z: number): Pt => [
  v.cx + (v.f * (x - v.camX)) / z,
  v.hy - (v.f * (y - CAM_Y)) / z,
];

function fillPoly(ctx: CanvasRenderingContext2D, pts: Pt[], fill: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

const hexRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const HAZE_RGB = hexRgb(HAZE);

/** A face colour: base colour lit by `k`, fading into the haze with distance. */
function tint(hex: string, k: number, z: number): string {
  const fog = Math.max(0, Math.min(0.8, (z - 1100) / (FAR - 1100)));
  const rgb = hexRgb(hex).map((c, i) => {
    const lit = Math.min(255, c * k);
    return Math.round(lit + (HAZE_RGB[i] - lit) * fog);
  });
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

interface Faces {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

/** An axis-aligned box from (x0, y0, z0) to (x1, y1, z1), front face at z0. */
function box(
  ctx: CanvasRenderingContext2D,
  v: View,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  colour: string,
  faces: Faces = { left: true, right: true, top: true, bottom: true }
) {
  const p = (x: number, y: number, z: number) => project(v, x, y, z);
  if (faces.left && v.camX < x0)
    fillPoly(ctx, [p(x0, y0, z0), p(x0, y1, z0), p(x0, y1, z1), p(x0, y0, z1)], tint(colour, 0.62, z0));
  if (faces.right && v.camX > x1)
    fillPoly(ctx, [p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)], tint(colour, 0.62, z0));
  if (faces.top && CAM_Y > y1)
    fillPoly(ctx, [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)], tint(colour, 1.18, z0));
  if (faces.bottom && CAM_Y < y0)
    fillPoly(ctx, [p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1)], tint(colour, 0.45, z0));
  fillPoly(ctx, [p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0)], tint(colour, 0.88, z0));
}

function drawArwing(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, bank: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bank);
  ctx.scale(s, s);
  const glow = ctx.createRadialGradient(0, 6, 0, 0, 6, 22);
  glow.addColorStop(0, "#fff");
  glow.addColorStop(0.3, "#8cf");
  glow.addColorStop(1, "rgba(60,120,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 6, 22, 0, Math.PI * 2);
  ctx.fill();
  // Wings, then the blue wing blades, then the fuselage and the cockpit.
  fillPoly(ctx, [[-8, 0], [-92, 34], [-86, 40], [-6, 14]], "#c9ced8");
  fillPoly(ctx, [[8, 0], [92, 34], [86, 40], [6, 14]], "#9aa1b0");
  fillPoly(ctx, [[-8, 0], [-50, 16], [-46, 22], [-6, 14]], "#e8ecf2");
  fillPoly(ctx, [[8, 0], [50, 16], [46, 22], [6, 14]], "#b9c0cc");
  fillPoly(ctx, [[-70, 26], [-96, -26], [-90, -28], [-62, 24]], "#2a5ad8");
  fillPoly(ctx, [[-70, 26], [-96, -26], [-80, 26]], "#4a7af0");
  fillPoly(ctx, [[70, 26], [96, -26], [90, -28], [62, 24]], "#1a3aa0");
  fillPoly(ctx, [[70, 26], [96, -26], [80, 26]], "#2a5ad8");
  fillPoly(ctx, [[0, -46], [-14, 4], [0, 18]], "#f2f4f8");
  fillPoly(ctx, [[0, -46], [14, 4], [0, 18]], "#b8bfcc");
  fillPoly(ctx, [[0, -26], [-7, -4], [0, 0]], "#33aadd");
  fillPoly(ctx, [[0, -26], [7, -4], [0, 0]], "#1177aa");
  fillPoly(ctx, [[-14, 4], [0, 18], [14, 4], [0, 10]], "#7a8294");
  ctx.restore();
}

export function drawScene(ctx: CanvasRenderingContext2D, s: Scene, dt: number) {
  const { w, h } = s;
  if (!w || !h) return;

  // ----- Fly -----
  s.time += dt;
  s.travel += SPEED * dt;
  s.wordZ -= SPEED * dt;
  if (s.wordZ < 8) s.wordZ = WORD_RESPAWN;
  const target =
    s.pointer !== null
      ? (s.pointer - 0.5) * 2 * STEER_RANGE
      : Math.max(-STEER_RANGE, Math.min(STEER_RANGE, s.camX + s.steer * STEER_RANGE));
  const prevX = s.camX;
  s.camX += Math.max(-STEER_SPEED * dt, Math.min(STEER_SPEED * dt, target - s.camX));
  const drift = dt > 0 ? (s.camX - prevX) / dt / STEER_SPEED : 0;
  s.bolts = s.bolts.filter((b) => (b.age += dt) < BOLT_S);

  const portrait = h > w;
  const v: View = {
    f: Math.max(w * 0.85, h * 0.5),
    cx: w / 2,
    hy: h * (portrait ? 0.4 : 0.44),
    camX: s.camX,
  };

  // ----- Sky, hills and ground -----
  const sky = ctx.createLinearGradient(0, 0, 0, v.hy);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(0.7, SKY_MID);
  sky.addColorStop(1, HAZE);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, v.hy);

  // Far hills drift a little against the steering.
  ctx.fillStyle = HILLS;
  ctx.beginPath();
  ctx.moveTo(0, v.hy);
  const hillStep = w / 14;
  const shift = (-s.camX * 0.3) % hillStep;
  for (let i = -1; i <= 15; i++) {
    const n = i - Math.floor((-s.camX * 0.3) / hillStep);
    ctx.lineTo(i * hillStep + shift, v.hy - 18 - ((((n * 37) % 50) + 50) % 50));
  }
  ctx.lineTo(w, v.hy);
  ctx.fill();

  const ground = ctx.createLinearGradient(0, v.hy, 0, h);
  ground.addColorStop(0, GROUND_FAR);
  ground.addColorStop(1, GROUND_NEAR);
  ctx.fillStyle = ground;
  ctx.fillRect(0, v.hy, w, h - v.hy);

  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const gx0 = Math.floor((s.camX - 3000) / GRID) * GRID;
  for (let x = gx0; x <= s.camX + 3000; x += GRID) {
    const a = project(v, x, 0, 6);
    const b = project(v, x, 0, FAR);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  for (let z = GRID - (s.travel % GRID); z < FAR; z += GRID) {
    if (z < 6) continue;
    const y = project(v, 0, 0, z)[1];
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  // ----- Towers and the wordmark, back to front -----
  const items: { z: number; dx: number; draw: () => void }[] = [];
  for (const t of TOWERS) {
    const z = ((((t.z - s.travel) % TOWER_SPAN) + TOWER_SPAN) % TOWER_SPAN) + 10;
    if (z > FAR) continue;
    items.push({
      z,
      dx: Math.abs(t.x + t.w / 2 - s.camX),
      draw: () => box(ctx, v, t.x, 0, z, t.x + t.w, t.h, z + t.w, TOWER),
    });
  }
  const wz = s.wordZ;
  if (wz > 10) {
    const left = (-s.cols * VOXEL) / 2;
    for (const vx of s.voxels) {
      const x = left + vx.c * VOXEL;
      const y = WORD_FLOOR + (6 - vx.r) * VOXEL;
      const faces = {
        left: !s.filled.has(`${vx.c - 1},${vx.r}`),
        right: !s.filled.has(`${vx.c + 1},${vx.r}`),
        top: !s.filled.has(`${vx.c},${vx.r - 1}`),
        bottom: !s.filled.has(`${vx.c},${vx.r + 1}`),
      };
      items.push({
        z: wz,
        dx: Math.abs(x + VOXEL / 2 - s.camX),
        draw: () =>
          box(ctx, v, x, y, wz, x + VOXEL, y + VOXEL, wz + WORD_DEPTH, LETTERS[vx.letter % LETTERS.length], faces),
      });
    }
  }
  items.sort((a, b) => b.z - a.z || b.dx - a.dx);
  for (const it of items) it.draw();

  // ----- The Arwing, its shadow and its lasers -----
  const scale = Math.max(0.9, Math.min(1.6, Math.min(w / 850, h / 530)));
  const ax = w / 2 + drift * 30 * scale;
  const ay = h * (portrait ? 0.6 : 0.72) + Math.sin(s.time * 2.2) * 4;
  const bank = -drift * 0.45 + Math.sin(s.time * 1.3) * 0.03;

  ctx.fillStyle = "rgba(0, 30, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(ax, ay + (h - ay) * 0.7, 60 * scale, 7 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#77ff77";
  ctx.lineWidth = 3 * scale;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const b of s.bolts) {
    // From the wing roots toward the vanishing point, shrinking as they go.
    const p = b.age / BOLT_S;
    const sx = ax + b.side * 40 * scale;
    const sy = ay - 20 * scale;
    const ex = v.cx;
    const ey = v.hy;
    const at = (q: number): Pt => [sx + (ex - sx) * q, sy + (ey - sy) * q];
    const a = at(Math.pow(p, 0.6));
    const c = at(Math.min(1, Math.pow(p, 0.6) + 0.18 * (1 - p)));
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(c[0], c[1]);
  }
  ctx.stroke();

  drawArwing(ctx, ax, ay, scale, bank);
}
