import {
  ARWING,
  ARWING_TAIL,
  ENEMY,
  NEAR,
  SHARD_COLOURS,
  bands,
  drawBox,
  drawMesh,
  fillPoly,
  place,
  project,
  shade,
  type Face,
  type Vec3,
  type View,
} from "./render";

// One sortie over Corneria. The Arwing skims the ground between towers and
// arches while Venom fighters come at it; they shoot back, and a barrel roll
// bats their shots away. The wordmark hangs ahead as a giant voxel arch, and
// flying under it ends the mission. Everything is in camera-relative world
// units: x is across, y is up, z is into the screen.

interface Voxel {
  c: number;
  r: number;
  letter: number;
}

interface Enemy {
  x: number;
  y: number;
  z: number;
  /** Phase of its weave. */
  phase: number;
  /** Sideways speed once it breaks off. */
  vx: number;
  fired: boolean;
  willFire: boolean;
}

interface Projectile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

interface Shot extends Projectile {
  deflected: boolean;
}

interface Shard extends Projectile {
  spin: number;
  age: number;
  colour: string;
}

interface Flash {
  x: number;
  y: number;
  z: number;
  age: number;
}

export type GameEventKind = "hit" | "deflect" | "damage" | "badly" | "complete";

export interface GameEvent {
  kind: GameEventKind;
  /** Where it happened, as fractions of the canvas. */
  x: number;
  y: number;
}

export type Phase = "flight" | "complete";

export interface Scene {
  /** Render size in (big) pixels. */
  rw: number;
  rh: number;
  time: number;
  /** Distance flown, for scrolling the ground and the scenery. */
  travel: number;
  /** Distance to the wordmark; negative once it's behind us. */
  wordZ: number;
  camX: number;
  /** How far the Arwing is leaning into its turn, in radians. */
  bank: number;
  /** Arrow-key steering: -1, 0 or 1. */
  steer: number;
  /** Pointer x as a fraction of the window, if the pointer is steering. */
  pointer: number | null;
  /** Seconds since the player last touched anything: past a few, the autopilot flies. */
  idle: number;
  phase: Phase;
  /** Seconds since the wordmark went overhead. */
  outro: number;
  shield: number;
  hits: number;
  rolls: number;
  /** Seconds into the current barrel roll, or -1. */
  rollT: number;
  hurtT: number;
  spawnT: number;
  autoFireT: number;
  enemies: Enemy[];
  bolts: Projectile[];
  shots: Shot[];
  shards: Shard[];
  flashes: Flash[];
  events: GameEvent[];
  voxels: Voxel[];
  /** Filled cells, as "c,r", for skipping faces between neighbours. */
  filled: Set<string>;
  cols: number;
}

const SPEED = 110;
const FAR = 2200;
const WORD_START = 1100;
/** The wordmark drifts in slowly while there's fighting to do, then rushes past. */
const WORD_SLOW = 0.45;
const WORD_RUSH_Z = 500;
const VOXEL = 18;
const WORD_DEPTH = VOXEL * 1.6;
const OUTRO_S = 1.2;

const SHIP_Z = 170;
const SHIP_SCALE = 0.72;
/** The nose tips up a little, turning the top of the ship toward the camera. */
const SHIP_PITCH = -0.3;
const ENEMY_SCALE = 1.5;
const SHIP_Y = 12;
const STEER_RANGE = 160;
const STEER_SPEED = 240;
const AUTOPILOT_S = 3;
const ROLL_S = 0.6;

const BOLT_SPEED = 1300;
const AIM_CONE = 90;
const ENEMY_SPEED = 190;
const SHOT_SPEED = 380;
const MAX_ENEMIES = 3;
const ENEMY_HIT_R = 34;
const SHIP_HIT_X = 36;
const SHIP_HIT_Y = 24;
const DAMAGE = 14;
const REGEN = 3;

const SHARD_S = 0.9;
const FLASH_S = 0.35;

const SKY = ["#1838a0", "#2048b8", "#2858c8", "#3068d8", "#4880e0", "#6098e8", "#80b0f0", "#a0c8f8"];
const GROUND = ["#185818", "#206820", "#287828", "#308830", "#389838"];
const MARKER = "#145014";
const SHADOW = "#104010";
const MOUNTAINS_FAR = "#5070c0";
const MOUNTAINS_NEAR = "#3858a8";
const TOWER = "#a8b0c8";
const ARCH = "#c8c8d8";
const LETTERS = ["#f8d038", "#f88838", "#f858a0", "#7888f8", "#38d0f8", "#78f078"];
const BOLT = "#60f860";
const BOLT_CORE = "#e8ffe8";
const SHOT = "#f83838";
const SHOT_DEFLECTED = "#f8a0c8";
const FLAME = ["#ffffff", "#a8e0ff", "#4890f8"];
const FLASH_COLOURS = ["#ffffff", "#f8f088", "#f8a038", "#d04020"];

// Scenery from a fixed seed, so every visit flies the same Corneria.
const seeded = (seed: number) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

const TOWER_SPACING = 170;
const TOWERS = (() => {
  const rnd = seeded(1993);
  return Array.from({ length: 14 }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const w = 34 + rnd() * 30;
    return {
      x: side * (300 + rnd() * 320) - (side < 0 ? w : 0),
      z: i * TOWER_SPACING + rnd() * 60,
      w,
      h: 90 + rnd() * 200,
    };
  });
})();
const TOWER_SPAN = TOWERS.length * TOWER_SPACING;

const ARCH_SPAN = 2600;
const ARCH_OFFSET = 1500;

const MARKER_ROW = 90;
const MARKER_COL = 180;

const MOUNTAINS = (() => {
  const rnd = seeded(64);
  return Array.from({ length: 24 }, () => [rnd(), rnd()]);
})();

const rand = Math.random;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const wrap = (v: number, span: number) => ((v % span) + span) % span;

export function makeScene(voxels: Voxel[], cols: number): Scene {
  const s: Scene = {
    rw: 0,
    rh: 0,
    time: 0,
    travel: 0,
    wordZ: WORD_START,
    camX: 0,
    bank: 0,
    steer: 0,
    pointer: null,
    idle: AUTOPILOT_S,
    phase: "flight",
    outro: 0,
    shield: 100,
    hits: 0,
    rolls: 0,
    rollT: -1,
    hurtT: 0,
    spawnT: 0,
    autoFireT: 0,
    enemies: [],
    bolts: [],
    shots: [],
    shards: [],
    flashes: [],
    events: [],
    voxels,
    filled: new Set(voxels.map((v) => `${v.c},${v.r}`)),
    cols,
  };
  resetScene(s);
  return s;
}

/** Back to the start of the sortie, with a couple of fighters already inbound. */
export function resetScene(s: Scene) {
  s.wordZ = WORD_START;
  s.phase = "flight";
  s.outro = 0;
  s.shield = 100;
  s.hits = 0;
  s.rolls = 0;
  s.rollT = -1;
  s.hurtT = 0;
  s.spawnT = 2;
  s.bolts = [];
  s.shots = [];
  s.shards = [];
  s.flashes = [];
  s.events = [];
  s.enemies = [spawnEnemy(s, s.camX - 110, 760), spawnEnemy(s, s.camX + 140, 1050)];
}

function spawnEnemy(s: Scene, x: number, z: number): Enemy {
  return {
    x,
    y: camY(s) - 20 + rand() * 60,
    z,
    phase: rand() * Math.PI * 2,
    vx: 0,
    fired: false,
    willFire: rand() < 0.75,
  };
}

/** Marks the player as present, which hands the controls back from the autopilot. */
export function touch(s: Scene) {
  s.idle = 0;
}

/** Fires a pair of lasers from the wing guns, aimed at whatever's in front. */
export function fire(s: Scene) {
  if (s.phase !== "flight") return;
  const target = s.enemies
    .filter((e) => Math.abs(e.x - s.camX) < AIM_CONE && e.z > SHIP_Z + 60 && e.z < 1400)
    .sort((a, b) => a.z - b.z)[0];
  for (const side of [-1, 1]) {
    const x = s.camX + side * 16;
    let tx = s.camX;
    let ty = camY(s) + 10;
    let tz = SHIP_Z + 1000;
    if (target) {
      // Lead the target by the time the bolt takes to get there.
      const t = (target.z - SHIP_Z) / (BOLT_SPEED + ENEMY_SPEED);
      tx = target.x + Math.sin(s.time * 1.6 + target.phase) * 50 * t + target.vx * t;
      ty = target.y;
      tz = target.z - ENEMY_SPEED * t;
    }
    const dx = tx - x;
    const dy = ty - SHIP_Y;
    const dz = tz - SHIP_Z;
    const len = Math.hypot(dx, dy, dz);
    s.bolts.push({
      x,
      y: SHIP_Y,
      z: SHIP_Z + 20,
      vx: (dx / len) * BOLT_SPEED,
      vy: (dy / len) * BOLT_SPEED,
      vz: (dz / len) * BOLT_SPEED,
    });
  }
}

/** Starts a barrel roll, unless one is already under way. */
export function roll(s: Scene): boolean {
  if (s.rollT >= 0) return false;
  s.rollT = 0;
  s.rolls++;
  return true;
}

// ----- Layout ----------------------------------------------------------------

/** Where the Arwing sits on screen, as a fraction of the height. */
const shipScreenY = (s: Scene) => (s.rh > s.rw ? 0.6 : 0.72);

function view(s: Scene): View {
  const portrait = s.rh > s.rw;
  const f = Math.max(s.rw * 0.85, s.rh * 0.5);
  const hy = s.rh * (portrait ? 0.4 : 0.44);
  return { f, cx: s.rw / 2, hy, camX: s.camX, camY: camY(s) };
}

/** The camera height that puts the Arwing (always at SHIP_Y) where the layout wants it. */
function camY(s: Scene): number {
  if (!s.rh) return 47;
  const portrait = s.rh > s.rw;
  const f = Math.max(s.rw * 0.85, s.rh * 0.5);
  const hy = s.rh * (portrait ? 0.4 : 0.44);
  return SHIP_Y + ((shipScreenY(s) * s.rh - hy) * SHIP_Z) / f;
}

/** The wordmark always clears the camera, so the Arwing flies under it. */
const wordFloor = (s: Scene) => camY(s) + 15;

function emit(s: Scene, kind: GameEventKind, x: number, y: number, z: number) {
  const v = view(s);
  const [px, py] = z > NEAR ? project(v, x, y, z) : [v.cx, v.hy];
  s.events.push({ kind, x: clamp(px / s.rw, 0.05, 0.95), y: clamp(py / s.rh, 0.08, 0.9) });
}

// ----- Simulation ------------------------------------------------------------

export function stepScene(s: Scene, dt: number) {
  s.time += dt;
  s.travel += SPEED * dt;
  s.idle += dt;
  s.hurtT = Math.max(0, s.hurtT - dt);
  s.shield = Math.min(100, s.shield + REGEN * dt);
  if (s.rollT >= 0) {
    s.rollT += dt;
    if (s.rollT > ROLL_S) s.rollT = -1;
  }

  // The wordmark, and the end of the mission once it's overhead.
  if (s.wordZ > 0) {
    s.wordZ -= (s.wordZ > WORD_RUSH_Z ? SPEED * WORD_SLOW : SPEED) * dt;
    if (s.wordZ <= NEAR) s.wordZ = -1;
  } else if (s.phase === "flight") {
    s.outro += dt;
    if (s.outro > OUTRO_S) {
      s.phase = "complete";
      s.events.push({ kind: "complete", x: 0.5, y: 0.5 });
    }
  }

  // Steering: the pointer, the arrow keys, or else the autopilot hunting the nearest fighter.
  const autopilot = s.idle > AUTOPILOT_S;
  const prey = s.enemies.filter((e) => e.z > SHIP_Z + 80 && e.z < 1100).sort((a, b) => a.z - b.z)[0];
  let target: number;
  if (!autopilot && s.pointer !== null) target = (s.pointer - 0.5) * 2 * STEER_RANGE;
  else if (!autopilot) target = s.camX + s.steer * STEER_RANGE;
  else target = prey ? prey.x : Math.sin(s.time * 0.4) * 60;
  target = clamp(target, -STEER_RANGE, STEER_RANGE);
  const move = clamp(target - s.camX, -STEER_SPEED * dt, STEER_SPEED * dt);
  s.camX += move;
  const lean = dt > 0 ? (-move / (STEER_SPEED * dt)) * 0.5 : 0;
  s.bank += (lean - s.bank) * Math.min(1, dt * 8);

  if (autopilot && s.phase === "flight") {
    s.autoFireT -= dt;
    if (prey && Math.abs(prey.x - s.camX) < 45 && s.autoFireT <= 0) {
      fire(s);
      s.autoFireT = 0.45;
    }
  }

  // Fighters: weave in, maybe take a shot, then break off to the side.
  if (s.phase === "flight" && s.wordZ > WORD_RUSH_Z) {
    s.spawnT -= dt;
    if (s.spawnT <= 0 && s.enemies.length < MAX_ENEMIES) {
      s.enemies.push(spawnEnemy(s, s.camX + (rand() - 0.5) * 500, 1500));
      s.spawnT = 1.4 + rand() * 1.4;
    }
  }
  for (const e of s.enemies) {
    e.z -= ENEMY_SPEED * dt;
    e.x += (Math.sin(s.time * 1.6 + e.phase) * 50 + e.vx) * dt;
    if (e.z < 480) e.vx += Math.sign(e.x - s.camX || 1) * 260 * dt;
    if (e.willFire && !e.fired && e.z < 900) {
      e.fired = true;
      const dx = s.camX - e.x;
      const dy = SHIP_Y - e.y;
      const dz = SHIP_Z - e.z;
      const len = Math.hypot(dx, dy, dz);
      s.shots.push({
        x: e.x,
        y: e.y,
        z: e.z - 20,
        vx: (dx / len) * SHOT_SPEED,
        vy: (dy / len) * SHOT_SPEED,
        vz: (dz / len) * SHOT_SPEED,
        deflected: false,
      });
    }
  }
  s.enemies = s.enemies.filter((e) => e.z > 30);

  // Lasers, checked in two half-steps so a fast bolt can't skip past a fighter.
  for (const b of s.bolts) {
    for (let k = 0; k < 2; k++) {
      b.x += (b.vx * dt) / 2;
      b.y += (b.vy * dt) / 2;
      b.z += (b.vz * dt) / 2;
      const hit = s.enemies.find(
        (e) =>
          Math.abs(e.x - b.x) < ENEMY_HIT_R &&
          Math.abs(e.y - b.y) < ENEMY_HIT_R &&
          Math.abs(e.z - b.z) < 40
      );
      if (hit) {
        explode(s, hit);
        s.enemies = s.enemies.filter((e) => e !== hit);
        b.z = FAR * 2;
        break;
      }
    }
  }
  s.bolts = s.bolts.filter((b) => b.z < FAR && b.z > NEAR);

  // Enemy fire: a barrel roll deflects it, otherwise it costs shield.
  for (const sh of s.shots) {
    const before = sh.z;
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
    sh.z += sh.vz * dt;
    if (!sh.deflected && before >= SHIP_Z && sh.z < SHIP_Z) {
      const near = Math.abs(sh.x - s.camX) < SHIP_HIT_X && Math.abs(sh.y - SHIP_Y) < SHIP_HIT_Y;
      if (near && s.rollT >= 0) {
        sh.deflected = true;
        sh.vz = SHOT_SPEED * 1.4;
        sh.vx = (rand() - 0.5) * 600;
        sh.vy = 150 + rand() * 200;
        emit(s, "deflect", sh.x, sh.y, SHIP_Z);
      } else if (near) {
        sh.z = -1;
        s.hurtT = 0.2;
        s.shield -= DAMAGE;
        if (s.shield <= 0) {
          s.shield = 100;
          emit(s, "badly", s.camX, SHIP_Y, SHIP_Z);
        } else {
          emit(s, "damage", s.camX, SHIP_Y, SHIP_Z);
        }
      }
    }
  }
  s.shots = s.shots.filter((sh) => sh.z > NEAR && sh.z < FAR);

  for (const p of s.shards) {
    p.age += dt;
    p.vy -= 120 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += (p.vz - SPEED) * dt;
  }
  s.shards = s.shards.filter((p) => p.age < SHARD_S && p.z > NEAR);
  for (const fl of s.flashes) {
    fl.age += dt;
    fl.z -= SPEED * dt;
  }
  s.flashes = s.flashes.filter((fl) => fl.age < FLASH_S && fl.z > NEAR);
}

function explode(s: Scene, e: Enemy) {
  s.hits++;
  s.flashes.push({ x: e.x, y: e.y, z: e.z, age: 0 });
  for (let i = 0; i < 10; i++) {
    const a = rand() * Math.PI * 2;
    const sp = 60 + rand() * 140;
    s.shards.push({
      x: e.x,
      y: e.y,
      z: e.z,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp + 40,
      vz: (rand() - 0.5) * 160 - ENEMY_SPEED * 0.5,
      spin: (rand() - 0.5) * 16,
      age: 0,
      colour: SHARD_COLOURS[i % SHARD_COLOURS.length],
    });
  }
  emit(s, "hit", e.x, e.y + 30, e.z);
}

// ----- Drawing ---------------------------------------------------------------

export function drawScene(ctx: CanvasRenderingContext2D, s: Scene) {
  const { rw, rh } = s;
  if (!rw || !rh) return;
  const v = view(s);

  // Sky, mountains and ground, in dithered bands.
  bands(ctx, rw, 0, v.hy, SKY);
  for (const [layer, colour, rise, drift] of [
    [0, MOUNTAINS_FAR, 0.11, 0.08],
    [1, MOUNTAINS_NEAR, 0.07, 0.16],
  ] as const) {
    const step = rw / 9;
    const shift = wrap(-s.camX * drift, step * MOUNTAINS.length);
    const pts: [number, number][] = [[0, v.hy]];
    for (let i = -1; i <= 11; i++) {
      const m = MOUNTAINS[wrap(i - Math.floor(shift / step) + layer * 7, MOUNTAINS.length)];
      pts.push([i * step + (shift % step) + m[0] * step * 0.5, v.hy - rh * (rise * 0.4 + m[1] * rise)]);
    }
    pts.push([rw, v.hy]);
    fillPoly(ctx, pts, colour);
  }
  bands(ctx, rw, v.hy, rh, GROUND);

  // Ground markers, scrolling past to show the speed.
  for (let z = MARKER_ROW - wrap(s.travel, MARKER_ROW); z < FAR * 0.6; z += MARKER_ROW) {
    if (z < NEAR + 4) continue;
    const row = Math.round((z + s.travel) / MARKER_ROW);
    const offset = ((row * 97) % 5) * 36;
    for (let x = Math.floor((s.camX - 1400) / MARKER_COL) * MARKER_COL; x < s.camX + 1400; x += MARKER_COL) {
      const x0 = x + offset;
      fillPoly(
        ctx,
        [project(v, x0, 0, z), project(v, x0 + 40, 0, z), project(v, x0 + 40, 0, z + 30), project(v, x0, 0, z + 30)],
        MARKER
      );
    }
  }

  // The Arwing's shadow.
  fillPoly(
    ctx,
    Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return project(v, s.camX + Math.cos(a) * 18, 0, SHIP_Z + 10 + Math.sin(a) * 9);
    }),
    SHADOW
  );

  // Everything with depth, back to front.
  const items: { z: number; dx: number; draw: () => void }[] = [];
  const add = (z: number, x: number, draw: () => void) =>
    items.push({ z, dx: Math.abs(x - s.camX), draw });

  for (const t of TOWERS) {
    const z = wrap(t.z - s.travel, TOWER_SPAN) + 10;
    if (z < FAR) add(z, t.x + t.w / 2, () => drawBox(ctx, v, t.x, 0, z, t.x + t.w, t.h, z + t.w, TOWER));
  }

  const az = wrap(ARCH_OFFSET - s.travel, ARCH_SPAN) + 10;
  if (az < FAR) {
    const top = camY(s) + 120;
    add(az, -260, () => drawBox(ctx, v, -275, 0, az, -235, top, az + 40, ARCH));
    add(az, 260, () => drawBox(ctx, v, 235, 0, az, 275, top, az + 40, ARCH));
    add(az + 1, 0, () => drawBox(ctx, v, -275, top, az, 275, top + 30, az + 40, ARCH));
  }

  const wz = s.wordZ;
  if (wz > NEAR) {
    const left = (-s.cols * VOXEL) / 2;
    const floor = wordFloor(s);
    for (const vx of s.voxels) {
      const x = left + vx.c * VOXEL;
      const y = floor + (6 - vx.r) * VOXEL;
      const skip = {
        left: s.filled.has(`${vx.c - 1},${vx.r}`),
        right: s.filled.has(`${vx.c + 1},${vx.r}`),
        top: s.filled.has(`${vx.c},${vx.r - 1}`),
        bottom: s.filled.has(`${vx.c},${vx.r + 1}`),
      };
      const colour = LETTERS[vx.letter % LETTERS.length];
      add(wz, x + VOXEL / 2, () => drawBox(ctx, v, x, y, wz, x + VOXEL, y + VOXEL, wz + WORD_DEPTH, colour, skip));
    }
  }

  for (const e of s.enemies) {
    const bank = Math.cos(s.time * 1.6 + e.phase) * 0.5 + e.vx * 0.002;
    const faces: Face[] = ENEMY.map((f) => ({
      colour: f.colour,
      pts: f.pts.map((p) => place(p, [e.x, e.y, e.z], bank, 0, ENEMY_SCALE)),
    }));
    add(e.z, e.x, () => drawMesh(ctx, v, faces));
  }

  for (const p of s.shards) {
    const a = p.age * p.spin;
    const faces: Face[] = [
      {
        colour: p.colour,
        pts: ([[0, 7, 0], [-6, -4, 2], [6, -4, -2]] as Vec3[]).map((q) =>
          place(q, [p.x, p.y, p.z], a, a * 0.7)
        ),
      },
    ];
    add(p.z, p.x, () => drawMesh(ctx, v, faces));
  }

  for (const fl of s.flashes) {
    add(fl.z, fl.x, () => {
      const [x, y] = project(v, fl.x, fl.y, fl.z);
      const t = fl.age / FLASH_S;
      const r = ((v.f * 26) / fl.z) * (0.6 + t * 1.6);
      const colour = FLASH_COLOURS[Math.min(FLASH_COLOURS.length - 1, Math.floor(t * FLASH_COLOURS.length))];
      fillPoly(
        ctx,
        Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2 + fl.age * 3;
          const q = i % 2 ? r * 0.45 : r;
          return [x + Math.cos(a) * q, y + Math.sin(a) * q] as [number, number];
        }),
        colour
      );
    });
  }

  for (const b of s.bolts) {
    add(b.z, b.x, () => {
      const tail = 0.04;
      const a = project(v, b.x, b.y, b.z);
      const c = project(v, b.x - b.vx * tail, b.y - b.vy * tail, Math.max(NEAR + 1, b.z - b.vz * tail));
      const width = Math.max(1, (v.f * 4) / b.z);
      ctx.lineCap = "round";
      ctx.strokeStyle = BOLT;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.stroke();
      ctx.strokeStyle = BOLT_CORE;
      ctx.lineWidth = Math.max(1, width * 0.4);
      ctx.stroke();
    });
  }

  for (const sh of s.shots) {
    add(sh.z, sh.x, () => {
      const [x, y] = project(v, sh.x, sh.y, sh.z);
      const r = Math.max(1.5, (v.f * 6) / sh.z);
      fillPoly(
        ctx,
        [
          [x, y - r],
          [x + r * 0.6, y],
          [x, y + r],
          [x - r * 0.6, y],
        ],
        sh.deflected ? SHOT_DEFLECTED : SHOT
      );
    });
  }

  items.sort((a, b) => b.z - a.z || b.dx - a.dx);
  for (const it of items) it.draw();

  drawArwing(ctx, s, v);

  // Taking a hit: half the screen goes red, in a checkerboard.
  if (s.hurtT > 0) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = shade("#f02020", 1);
    ctx.fillRect(0, 0, rw, rh);
    ctx.globalAlpha = 1;
  }
}

function drawArwing(ctx: CanvasRenderingContext2D, s: Scene, v: View) {
  // Bank into turns and bob a little; a barrel roll is one full turn about the nose.
  const bank = s.bank + Math.sin(s.time * 1.3) * 0.05;
  const t = s.rollT >= 0 ? s.rollT / ROLL_S : 0;
  const spin = t > 0 ? -(t * t * (3 - 2 * t)) * Math.PI * 2 : 0;
  const at: Vec3 = [s.camX, SHIP_Y + Math.sin(s.time * 2.2) * 1.5, SHIP_Z];
  const faces: Face[] = ARWING.map((f) => ({
    colour: f.colour,
    pts: f.pts.map((p) => place(p, at, bank + spin, s.bank * 0.3, SHIP_SCALE, SHIP_PITCH)),
  }));
  drawMesh(ctx, v, faces);

  // The engine flame, flickering.
  const [tx, ty] = project(v, ...place(ARWING_TAIL, at, bank + spin, s.bank * 0.3, SHIP_SCALE, SHIP_PITCH));
  const flicker = 0.75 + 0.25 * Math.sin(s.time * 47);
  FLAME.slice()
    .reverse()
    .forEach((colour, i) => {
      const r = ((v.f * (5 - i * 1.4)) / SHIP_Z) * flicker;
      fillPoly(
        ctx,
        [
          [tx, ty - r],
          [tx + r, ty],
          [tx, ty + r],
          [tx - r, ty],
        ],
        colour
      );
    });

  // A barrel roll leaves a ring of light around the ship.
  if (s.rollT >= 0) {
    const [cx, cy] = project(v, s.camX, SHIP_Y, SHIP_Z);
    const r = (v.f * 44) / SHIP_Z;
    ctx.strokeStyle = shade("#88d8ff", 1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.12, r * 0.52, 0, spin, spin + Math.PI * 0.8);
    ctx.stroke();
  }
}
