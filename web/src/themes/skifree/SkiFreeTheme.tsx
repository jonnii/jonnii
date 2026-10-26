"use client";
import styles from "./skifree.module.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { WORD, SSH_COMMAND, SOCIALS, COPY_FEEDBACK_MS } from "../shared/content";
import { pixelWordMask, pixelWordWidth, PIXEL_GLYPH_H } from "../shared/pixelFont";
import Taskbar from "../shared/Taskbar";
import { buildSprites, type SpriteName, type SpriteSheet } from "./sprites";

// The trees *are* the wordmark: the top of the slope is a forest planted in
// the shape of "jonnii", with the socials as slalom flags just below it. On
// load the skier sets off on autopilot, threads the gap between the n's and
// carves on down the hill until the yeti shows up and eats him, and then it
// all starts again. Move the mouse over the slope (or press an arrow key) to
// take over: the skier heads for the pointer, F goes fast, F2 starts over.

type Mode = "attract" | "playing" | "eaten" | "over";
type Kind = "tree" | "rock" | "stump";

interface Obstacle {
  x: number;
  y: number;
  kind: Kind;
}

interface Layout {
  /** Slope size in CSS pixels. */
  w: number;
  h: number;
  /** CSS pixels per sprite pixel. */
  scale: number;
  /** Spacing of the trees that spell the word. */
  cell: number;
}

interface Yeti {
  x: number;
  y: number;
}

interface World {
  mode: Mode;
  /** Still on autopilot: nobody has touched the controls this run. */
  autopilot: boolean;
  /** Seconds since the current mode began. */
  modeT: number;
  x: number;
  y: number;
  /** Heading in degrees: 0 is straight downhill, ±90 is across the slope. */
  angle: number;
  speed: number;
  fast: boolean;
  /** Standing at the top, waiting for the first input. */
  waiting: boolean;
  /** Seconds left lying in the snow after hitting something. */
  crashT: number;
  /** Seconds of grace after getting up, so you can steer clear. */
  graceT: number;
  /** Pointer position on the slope, in CSS pixels, if the mouse has moved. */
  pointer: { x: number; y: number } | null;
  /** Heading picked with the arrow keys; cleared when the mouse moves. */
  keyAngle: number | null;
  yeti: Yeti | null;
  /** Distance (px) at which the yeti comes for you. */
  yetiAt: number;
  time: number;
  style: number;
  passed: Set<Obstacle>;
  tracks: { x: number; y: number }[];
}

const GAP = 1;
const WORD_COLS = pixelWordWidth(GAP);

// Tuning, in sprite pixels (multiplied by the layout scale).
const MAX_SPEED = 130;
const FAST_MULT = 1.65;
const ACCEL = 160;
const TURN_RATE = 320; // degrees per second
const WALK_SPEED = 18;
const SKIER_R = 3;
const OBSTACLE_R: Record<Kind, number> = { tree: 4, rock: 4, stump: 4 };
const PX_PER_M = 8;
const CHUNK = 160;

const ATTRACT_DELAY_S = 1.4;
const ATTRACT_YETI_M = 260;
const PLAY_YETI_M = 2000;
const CRASH_S = 1.1;
const GRACE_S = 0.7;
const EAT_S = 2.6;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rad = (deg: number) => (deg * Math.PI) / 180;

function computeLayout(w: number, h: number): Layout {
  const scale = w >= 600 ? 2 : w >= 440 ? 1.5 : 1;
  const cell = Math.min(14 * scale, (w - 24) / WORD_COLS);
  return { w, h, scale, cell };
}

/** Where the skier sits on screen: horizontally centred, a fifth of the way down. */
const skierScreenY = (l: Layout) => Math.round(l.h * 0.2);

// World coordinates: the skier starts at (0, 0) and y grows downhill.
const wordTop = (l: Layout) => 2.5 * l.cell;
const wordLeft = (l: Layout) => -(WORD_COLS * l.cell) / 2;
const wordBottom = (l: Layout) => wordTop(l) + PIXEL_GLYPH_H * l.cell;
const startZoneEnd = (l: Layout) => wordBottom(l) + 6 * l.cell;
/** The gap between the two n's: the autopilot's way through the forest. */
const gapX = (l: Layout) => wordLeft(l) + 13.5 * l.cell;

/** The hand-placed top of the slope: the forest that spells the word, plus a few strays. */
function startObstacles(l: Layout): Obstacle[] {
  const out: Obstacle[] = [];
  for (const i of pixelWordMask(WORD_COLS, 0, GAP)) {
    const r = Math.floor(i / WORD_COLS);
    const c = i % WORD_COLS;
    out.push({
      x: wordLeft(l) + (c + 0.5) * l.cell,
      y: wordTop(l) + (r + 1) * l.cell,
      kind: "tree",
    });
  }
  const strays: [number, number, Kind][] = [
    [-0.44, -1, "tree"],
    [0.46, 1.5, "tree"],
    [-0.3, -0.5, "rock"],
    [0.3, 0.2, "stump"],
    [-0.47, 6, "tree"],
    [0.47, 7, "tree"],
    [-0.36, 12, "tree"],
    [0.18, 13.5, "rock"],
    [0.4, 12.5, "tree"],
  ];
  for (const [fx, cy, kind] of strays) {
    out.push({ x: fx * l.w, y: wordTop(l) + cy * l.cell, kind });
  }
  return out;
}

/** Where the slalom flags (the socials) stand, in world coordinates. */
function flagSpots(l: Layout): { x: number; y: number }[] {
  // Flags hang above their anchor (cloth + 26px pole), so clear the forest by that much.
  const y = wordBottom(l) + 1.5 * l.cell + 44;
  const dx = Math.min(l.w * 0.3, 7 * l.cell);
  return [
    { x: -dx, y },
    { x: 0, y: y + 1.5 * l.cell },
    { x: dx, y },
  ];
}

// Deterministic per-chunk scatter, so the slope is the same every time you pass.
function chunkObstacles(l: Layout, ci: number, cj: number): Obstacle[] {
  const size = CHUNK * l.scale;
  let seed = (Math.imul(ci, 73856093) ^ Math.imul(cj, 19349663)) >>> 0 || 1;
  const rnd = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  const out: Obstacle[] = [];
  const count = 2 + Math.floor(rnd() * 3);
  for (let k = 0; k < count; k++) {
    const x = (ci + rnd()) * size;
    const y = (cj + rnd()) * size;
    const roll = rnd();
    if (y < startZoneEnd(l)) continue;
    out.push({ x, y, kind: roll < 0.7 ? "tree" : roll < 0.85 ? "rock" : "stump" });
  }
  return out;
}

function freshWorld(mode: Mode, l: Layout): World {
  return {
    mode,
    autopilot: mode === "attract",
    modeT: 0,
    x: 0,
    y: 0,
    angle: 0,
    speed: 0,
    fast: false,
    waiting: true,
    crashT: 0,
    graceT: 0,
    pointer: null,
    keyAngle: null,
    yeti: null,
    yetiAt: (mode === "attract" ? ATTRACT_YETI_M : PLAY_YETI_M) * PX_PER_M * l.scale,
    time: 0,
    style: 0,
    passed: new Set(),
    tracks: [],
  };
}

/** Hands the controls to a human. Returns true if they weren't theirs already. */
function takeOver(w: World, l: Layout | null): boolean {
  if (w.mode !== "attract") return false;
  w.mode = "playing";
  w.autopilot = false;
  w.yeti = null;
  w.yetiAt = w.y + PLAY_YETI_M * PX_PER_M * (l?.scale ?? 1);
  return true;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const clock = (s: number) => {
  const t = Math.floor(s);
  return `${Math.floor(t / 3600)}:${pad2(Math.floor(t / 60) % 60)}:${pad2(t % 60)}`;
};

export default function SkiFreeTheme() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flagsRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<{ time?: HTMLElement | null; dist?: HTMLElement | null; speed?: HTMLElement | null; style?: HTMLElement | null }>({});
  const layoutRef = useRef<Layout | null>(null);
  const worldRef = useRef<World | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [mode, setMode] = useState<Mode>("attract");
  const [copied, setCopied] = useState(false);
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const copyResetRef = useRef<number | null>(null);

  const restart = useCallback((next: Mode) => {
    const l = layoutRef.current;
    if (!l) return;
    worldRef.current = freshWorld(next, l);
    setMode(next);
  }, []);

  // Size the slope to its box, and re-lay it out on resize.
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const ro = new ResizeObserver(() => {
      const rect = field.getBoundingClientRect();
      const l = computeLayout(Math.round(rect.width), Math.round(rect.height));
      const prev = layoutRef.current;
      layoutRef.current = l;
      setLayout(l);
      if (!worldRef.current || !prev || prev.scale !== l.scale || prev.cell !== l.cell) {
        worldRef.current = freshWorld(worldRef.current?.mode === "playing" ? "playing" : "attract", l);
        setMode(worldRef.current.mode);
      }
    });
    ro.observe(field);
    return () => ro.disconnect();
  }, []);

  // The game loop.
  useEffect(() => {
    if (!layout) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const l = layout;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(l.w * dpr);
    canvas.height = Math.round(l.h * dpr);
    const sprites: SpriteSheet = buildSprites(l.scale * dpr);
    const fixed = startObstacles(l);
    const chunks = new Map<string, Obstacle[]>();
    const size = CHUNK * l.scale;
    const s = l.scale;
    const screenY = skierScreenY(l);

    const nearby = (x0: number, y0: number, x1: number, y1: number): Obstacle[] => {
      const out: Obstacle[] = [];
      for (const o of fixed) if (o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1) out.push(o);
      for (let cj = Math.floor(y0 / size); cj <= Math.floor(y1 / size); cj++) {
        for (let ci = Math.floor(x0 / size); ci <= Math.floor(x1 / size); ci++) {
          const key = `${ci},${cj}`;
          let list = chunks.get(key);
          if (!list) {
            list = chunkObstacles(l, ci, cj);
            chunks.set(key, list);
          }
          for (const o of list) if (o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1) out.push(o);
        }
      }
      return out;
    };

    // How far the skier can go on `heading` before running into something.
    const clearRun = (w: World, heading: number, reach: number, obstacles: Obstacle[]) => {
      const dx = Math.sin(rad(heading));
      const dy = Math.cos(rad(heading));
      let best = reach;
      for (const o of obstacles) {
        const ox = o.x - w.x;
        const oy = o.y - w.y;
        const t = ox * dx + oy * dy;
        if (t < 0 || t > reach) continue;
        const off = Math.abs(ox * dy - oy * dx);
        if (off < (OBSTACLE_R[o.kind] + SKIER_R + 3) * s) best = Math.min(best, t);
      }
      return best;
    };

    const autopilot = (w: World): number => {
      const target =
        w.y < wordBottom(l) + l.cell
          ? gapX(l)
          : Math.sin(w.y / (90 * s)) * 9 * l.cell + Math.sin(w.y / (37 * s)) * 3 * l.cell;
      const want = clamp((Math.atan2(target - w.x, 60 * s) * 180) / Math.PI, -65, 65);
      const reach = 7 * l.cell;
      const around = nearby(w.x - reach, w.y - l.cell, w.x + reach, w.y + reach);
      let best = want;
      let bestScore = Infinity;
      for (let a = -75; a <= 75; a += 7.5) {
        const run = clearRun(w, a, reach, around);
        const score = Math.abs(a - want) + (run < reach ? 400 + (reach - run) : 0);
        if (score < bestScore) {
          bestScore = score;
          best = a;
        }
      }
      return best;
    };

    const playerHeading = (w: World): number | null => {
      if (w.keyAngle !== null) return w.keyAngle;
      if (!w.pointer) return null;
      const dx = w.pointer.x - l.w / 2;
      const dy = w.pointer.y - screenY;
      if (Math.hypot(dx, dy) < 6 * s) return null;
      if (dy <= 0) return dx < 0 ? -90 : 90;
      return clamp((Math.atan2(dx, dy) * 180) / Math.PI, -90, 90);
    };

    const step = (w: World, dt: number) => {
      w.modeT += dt;
      if (w.mode === "over") return;

      if (w.mode === "eaten") {
        if (w.modeT > EAT_S) {
          if (worldRef.current === w) {
            // The attract loop starts over; a player gets the game-over box.
            if (w.autopilot) {
              worldRef.current = freshWorld("attract", l);
              setMode("attract");
            } else {
              w.mode = "over";
              setMode("over");
            }
          }
        }
        return;
      }

      if (w.mode === "attract" || !w.waiting) w.time += dt;

      // Steering.
      let heading: number | null = null;
      if (w.mode === "attract") {
        if (w.modeT > ATTRACT_DELAY_S) {
          w.waiting = false;
          heading = autopilot(w);
        }
      } else {
        heading = playerHeading(w);
        if (heading !== null) w.waiting = false;
      }

      if (w.crashT > 0) {
        w.crashT -= dt;
        w.speed = 0;
        if (w.crashT <= 0) w.graceT = GRACE_S;
      } else if (!w.waiting) {
        if (heading !== null) {
          const diff = heading - w.angle;
          w.angle += clamp(diff, -TURN_RATE * dt, TURN_RATE * dt);
        }
        const top = MAX_SPEED * s * (w.fast ? FAST_MULT : 1) * Math.cos(rad(w.angle));
        const rate = (w.speed < top ? ACCEL : ACCEL * 2.5) * s * dt;
        w.speed += clamp(top - w.speed, -rate, rate);
        if (Math.abs(w.angle) >= 80) {
          // Pointing across the hill you stop, then shuffle sideways.
          w.x += Math.sign(w.angle) * WALK_SPEED * s * dt;
        } else {
          w.x += Math.sin(rad(w.angle)) * w.speed * dt;
          w.y += Math.cos(rad(w.angle)) * w.speed * dt;
        }
        w.graceT = Math.max(0, w.graceT - dt);
      }

      // Tracks behind the skis.
      const last = w.tracks[w.tracks.length - 1];
      if (!last || Math.hypot(last.x - w.x, last.y - w.y) > 3 * s) {
        w.tracks.push({ x: w.x, y: w.y });
        if (w.tracks.length > 400) w.tracks.shift();
      }

      // Collisions and near misses.
      const reachR = 12 * s;
      for (const o of nearby(w.x - reachR, w.y - reachR, w.x + reachR, w.y + reachR)) {
        const d = Math.hypot(o.x - w.x, o.y - w.y);
        const hit = (OBSTACLE_R[o.kind] + SKIER_R) * s;
        if (d < hit && w.crashT <= 0 && w.graceT <= 0 && !w.waiting) {
          w.crashT = CRASH_S;
          w.speed = 0;
          w.style = Math.max(0, w.style - 8);
        } else if (d < hit * 1.9 && !w.passed.has(o) && w.crashT <= 0 && o.y < w.y) {
          w.passed.add(o);
          w.style += 3;
        }
      }

      // The yeti.
      if (!w.yeti && w.y > w.yetiAt) {
        w.yeti = { x: w.x - l.w * 0.6, y: w.y - screenY * 0.8 };
      }
      if (w.yeti) {
        const y = w.yeti;
        const dx = w.x - y.x;
        const dy = w.y - y.y;
        const d = Math.hypot(dx, dy);
        const pace = MAX_SPEED * s * 1.15;
        if (d > 3 * l.h) {
          // Outran it. It'll be back.
          w.yeti = null;
          w.yetiAt = w.y + 900 * PX_PER_M * s;
        } else if (d < 8 * s) {
          w.mode = "eaten";
          w.modeT = 0;
          w.speed = 0;
          y.x = w.x;
          y.y = w.y;
          setMode("eaten");
        } else {
          y.x += (dx / d) * pace * dt;
          y.y += (dy / d) * pace * dt;
        }
      }
    };

    const stamp = (name: SpriteName, x: number, y: number, flip = false) => {
      const img = flip ? sprites[name].left : sprites[name].right;
      const w = img.width / dpr;
      const h = img.height / dpr;
      ctx.drawImage(img, Math.round(x - w / 2), Math.round(y - h), w, h);
    };

    const skierSprite = (w: World): [SpriteName, boolean] => {
      if (w.crashT > 0) return ["skierFallen", w.angle < 0];
      const a = Math.abs(w.angle);
      const name: SpriteName = a <= 20 ? "skierDown" : a <= 55 ? "skierDiag" : "skierSide";
      return [name, w.angle < 0];
    };

    const draw = (w: World) => {
      const camX = w.x - l.w / 2;
      const camY = w.y - screenY;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, l.w, l.h);
      ctx.translate(-Math.round(camX), -Math.round(camY));

      // Ski tracks: two faint grey lines.
      if (w.tracks.length > 1) {
        ctx.strokeStyle = "#c8c8d0";
        ctx.lineWidth = Math.max(1, s / 2);
        for (const off of [-2 * s, 2 * s]) {
          ctx.beginPath();
          w.tracks.forEach((p, i) => (i ? ctx.lineTo(p.x + off, p.y) : ctx.moveTo(p.x + off, p.y)));
          ctx.stroke();
        }
      }

      type Drawable = { y: number; draw: () => void };
      const items: Drawable[] = [];
      const margin = 30 * s;
      for (const o of nearby(camX - margin, camY - margin, camX + l.w + margin, camY + l.h + margin * 2)) {
        items.push({ y: o.y, draw: () => stamp(o.kind, o.x, o.y + 2 * s) });
      }
      if (w.mode !== "eaten" && w.mode !== "over") {
        const [name, flip] = skierSprite(w);
        items.push({ y: w.y, draw: () => stamp(name, w.x, w.y + 3 * s, flip) });
      }
      if (w.yeti) {
        const y = w.yeti;
        if (w.mode === "eaten" || w.mode === "over") {
          const chomp = Math.floor(w.modeT * 6) % 2 === 0;
          const bob = chomp ? 0 : -3 * s;
          items.push({
            y: Infinity,
            draw: () => {
              stamp(chomp ? "yetiArmsUp" : "yetiRun1", y.x, y.y + bob);
              if (w.modeT < EAT_S * 0.5) stamp("skierFallen", y.x, y.y + bob - 19 * s);
            },
          });
        } else {
          const frame = Math.floor(w.time * 7) % 2 === 0 ? "yetiRun1" : "yetiRun2";
          items.push({ y: y.y, draw: () => stamp(frame, y.x, y.y + 2 * s, w.x < y.x) });
        }
      }
      items.sort((a, b) => a.y - b.y);
      for (const it of items) it.draw();

      // Flags are DOM links riding along with the slope.
      if (flagsRef.current) {
        flagsRef.current.style.transform = `translate(${-Math.round(camX)}px, ${-Math.round(camY)}px)`;
      }

      const hud = hudRef.current;
      const pxPerM = PX_PER_M * s;
      if (hud.time) hud.time.textContent = clock(w.time);
      if (hud.dist) hud.dist.textContent = `${Math.max(0, Math.round(w.y / pxPerM))}m`;
      if (hud.speed) hud.speed.textContent = `${Math.round(w.speed / pxPerM)}m/s`;
      if (hud.style) hud.style.textContent = String(w.style);
    };

    let raf = 0;
    let lastT = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const w = worldRef.current;
      if (w) {
        step(w, dt);
        draw(worldRef.current ?? w);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [layout]);

  // Keyboard: arrows steer, F goes fast, F2 starts over.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const w = worldRef.current;
      if (!w) return;
      if (e.key === "F2") {
        e.preventDefault();
        restart("playing");
        return;
      }
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [role=menu]")) return;
      const grab = () => {
        if (takeOver(w, layoutRef.current)) setMode("playing");
      };
      const current = w.keyAngle ?? w.angle;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        grab();
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        w.keyAngle = clamp(Math.round(current / 22.5) * 22.5 + dir * 22.5, -90, 90);
        w.pointer = null;
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        grab();
        w.keyAngle = 0;
        w.pointer = null;
      } else if (e.key === "f" || e.key === "F") {
        grab();
        w.fast = !w.fast;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [restart]);

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    };
  }, []);

  const pointAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const w = worldRef.current;
    const field = fieldRef.current;
    if (!w || !field) return;
    const rect = field.getBoundingClientRect();
    w.pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    w.keyAngle = null;
    if (takeOver(w, layoutRef.current)) setMode("playing");
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(SSH_COMMAND);
    setCopied(true);
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    copyResetRef.current = window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  const flags = layout ? flagSpots(layout) : [];

  return (
    <main className={styles.desktop}>
      <section className={`${styles.window} ${styles.raised}`}>
        <div className={styles.titlebar}>
          <span className={styles.titleIcon} aria-hidden="true" />
          <span className={styles.titleText}>SkiFree</span>
          <span className={styles.titleButtons} aria-hidden="true">
            <span className={`${styles.titleBtn} ${styles.raised}`}>
              <span className={styles.titleGlyphMin}>_</span>
            </span>
            <span className={`${styles.titleBtn} ${styles.raised}`}>&#9633;</span>
            <span className={`${styles.titleBtn} ${styles.raised}`}>&#10005;</span>
          </span>
        </div>

        <div
          ref={fieldRef}
          className={`${styles.slope} ${styles.sunken}`}
          onPointerMove={pointAt}
          onPointerDown={(e) => {
            if (mode === "over") {
              restart("playing");
              return;
            }
            pointAt(e);
          }}
        >
          <h1 className={styles.srOnly}>{WORD}</h1>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            role="img"
            aria-label="SkiFree. A forest of pine trees spells jonnii at the top of the slope."
          />

          <div ref={flagsRef} className={styles.flags}>
            {flags.map((spot, i) => {
              const social = SOCIALS[i];
              if (!social) return null;
              return (
                <a
                  key={social.label}
                  className={styles.flag}
                  style={{ left: spot.x, top: spot.y }}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-brand={social.label}
                >
                  <span className={styles.flagCloth}>{social.label}</span>
                  <span className={styles.flagPole} aria-hidden="true" />
                </a>
              );
            })}
          </div>

          <div className={styles.stats}>
            <div>
              Time: <span ref={(el) => void (hudRef.current.time = el)}>0:00:00</span>
            </div>
            <div>
              Dist: <span ref={(el) => void (hudRef.current.dist = el)}>0m</span>
            </div>
            <div>
              Speed: <span ref={(el) => void (hudRef.current.speed = el)}>0m/s</span>
            </div>
            <div>
              Style: <span ref={(el) => void (hudRef.current.style = el)}>0</span>
            </div>
            <button
              type="button"
              className={styles.ssh}
              onClick={handleCopy}
              onPointerDown={(e) => e.stopPropagation()}
              title="Copy to clipboard"
            >
              {copied ? "copied to clipboard" : SSH_COMMAND}
              <span className={styles.srOnly} aria-live="polite">
                {copied ? "copied to clipboard" : ""}
              </span>
            </button>
          </div>

          {mode === "attract" && (
            <div className={styles.hint} aria-hidden="true">
              {touch ? "drag on the slope to ski" : "move the mouse to ski · F to go fast"}
            </div>
          )}

          {mode === "over" && (
            <div className={`${styles.dialog} ${styles.raised}`} role="alert">
              <p>The yeti got you.</p>
              <p className={styles.dialogSmall}>Click the slope or press F2 to ski again.</p>
            </div>
          )}
        </div>
      </section>

      <Taskbar
        themeId="skifree"
        appLabel="SkiFree"
        iconVariant="tree"
        onAppClick={() => restart("attract")}
      />
    </main>
  );
}
