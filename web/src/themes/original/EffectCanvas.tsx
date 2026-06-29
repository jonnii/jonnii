"use client";
import { useEffect, useRef } from "react";
import styles from "./EffectCanvas.module.css";

const PALETTE_VARS = ["--red", "--orange", "--yellow", "--green", "--blue", "--violet"];

const GRID_SIZE = 16;
const ANIMATED_DOT_RADIUS = 1.9;
const BAND_THICKNESS = 24;
const FLASH_DURATION = 200;
const AUTO_TRIGGER_INTERVAL = 10000;
const TWO_PI = Math.PI * 2;

type EffectKind = "ripple" | "rays" | "confetti" | "quake";

const DURATIONS: Record<EffectKind, number> = {
  ripple: 1600,
  rays: 900,
  confetti: 1500,
  quake: 1400,
};

const ALL_KINDS = Object.keys(DURATIONS) as EffectKind[];
// Ambient triggers skip confetti — falling debris from nowhere looks odd
const AMBIENT_KINDS = ALL_KINDS.filter((k) => k !== "confetti");

const RAY_COUNT = 12;
const CONFETTI_COUNT = 32;
const CONFETTI_GRAVITY = 700;
const QUAKE_BAND = 130;
const QUAKE_PUSH = 18;

interface Ray {
  angle: number;
  length: number;
  colorIdx: number;
}

interface Particle {
  vx: number;
  vy: number;
  size: number;
  colorIdx: number;
  spin: number;
  phase: number;
}

interface Effect {
  kind: EffectKind;
  x: number;
  y: number;
  startTime: number;
  duration: number;
  colorIndex: number;
  seed: number;
  maxRadius: number;
  rays?: Ray[];
  particles?: Particle[];
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function EffectCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const computed = getComputedStyle(document.documentElement);
    const palette = PALETTE_VARS.map((v) => computed.getPropertyValue(v).trim()).filter(Boolean);
    if (palette.length === 0) palette.push("#268bd2");
    // Resolved (not var()-referencing) background color, used to hide grid dots in flight
    const bgColor = getComputedStyle(document.body).backgroundColor || "#fdf6e3";

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const effects: Effect[] = [];
    let rafId: number | null = null;
    let colorCycle = 0;
    let lastKind: EffectKind | null = null;

    const seededColor = (fx: Effect, x: number, y: number) =>
      palette[Math.abs((x * 2654435761) ^ (y * 1597334677) ^ (fx.seed * 1013904223)) % palette.length];

    // Expanding outline ring with a band of grid dots riding the same wavefront
    const drawRipple = (fx: Effect, p: number, width: number, height: number) => {
      const radius = easeOutCubic(p) * fx.maxRadius;
      ctx.globalAlpha = 0.65 * (1 - p);
      ctx.strokeStyle = palette[fx.colorIndex % palette.length];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, radius, 0, TWO_PI);
      ctx.stroke();

      const x0 = Math.max(0, Math.floor((fx.x - radius - BAND_THICKNESS) / GRID_SIZE) * GRID_SIZE);
      const y0 = Math.max(0, Math.floor((fx.y - radius - BAND_THICKNESS) / GRID_SIZE) * GRID_SIZE);
      const x1 = Math.min(width, Math.ceil((fx.x + radius + BAND_THICKNESS) / GRID_SIZE) * GRID_SIZE);
      const y1 = Math.min(height, Math.ceil((fx.y + radius + BAND_THICKNESS) / GRID_SIZE) * GRID_SIZE);

      for (let y = y0; y <= y1; y += GRID_SIZE) {
        for (let x = x0; x <= x1; x += GRID_SIZE) {
          if (Math.abs(Math.hypot(x - fx.x, y - fx.y) - radius) <= BAND_THICKNESS / 2) {
            ctx.fillStyle = seededColor(fx, x, y);
            ctx.beginPath();
            ctx.arc(x, y, ANIMATED_DOT_RADIUS, 0, TWO_PI);
            ctx.fill();
          }
        }
      }
    };

    // Starburst of dotted streaks shooting radially outward
    const drawRays = (fx: Effect, p: number) => {
      if (!fx.rays) return;
      const head = easeOutCubic(p);
      ctx.globalAlpha = 0.9 * (1 - p);
      for (const ray of fx.rays) {
        const headR = head * ray.length;
        const tailR = Math.max(0, headR - ray.length * 0.45);
        ctx.fillStyle = palette[ray.colorIdx];
        for (let r = tailR; r <= headR; r += 9) {
          ctx.beginPath();
          ctx.arc(fx.x + Math.cos(ray.angle) * r, fx.y + Math.sin(ray.angle) * r, 2, 0, TWO_PI);
          ctx.fill();
        }
      }
    };

    // Spinning squares ejected with velocity and pulled down by gravity
    const drawConfetti = (fx: Effect, p: number, elapsed: number) => {
      if (!fx.particles) return;
      const t = elapsed / 1000;
      ctx.globalAlpha = 1 - p;
      for (const pt of fx.particles) {
        const px = fx.x + pt.vx * t;
        const py = fx.y + pt.vy * t + 0.5 * CONFETTI_GRAVITY * t * t;
        ctx.fillStyle = palette[pt.colorIdx];
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(pt.phase + pt.spin * t);
        ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size);
        ctx.restore();
      }
    };

    // Shockwave that physically displaces the background grid dots as it passes,
    // travelling all the way across the screen
    const drawQuake = (fx: Effect, p: number, width: number, height: number) => {
      // Wave travels linearly so the band fully clears the radius by p=1,
      // leaving every dot back in place with no fade needed
      const reach = fx.maxRadius;
      const waveR = p * (reach + QUAKE_BAND);

      const x0 = Math.max(0, Math.floor((fx.x - waveR) / GRID_SIZE) * GRID_SIZE);
      const y0 = Math.max(0, Math.floor((fx.y - waveR) / GRID_SIZE) * GRID_SIZE);
      const x1 = Math.min(width, Math.ceil((fx.x + waveR) / GRID_SIZE) * GRID_SIZE);
      const y1 = Math.min(height, Math.ceil((fx.y + waveR) / GRID_SIZE) * GRID_SIZE);

      for (let y = y0; y <= y1; y += GRID_SIZE) {
        for (let x = x0; x <= x1; x += GRID_SIZE) {
          const d = Math.hypot(x - fx.x, y - fx.y);
          const local = (waveR - d) / QUAKE_BAND;
          if (local <= 0 || local >= 1) continue;

          const kick = Math.sin(local * Math.PI);
          const disp = kick * QUAKE_PUSH;
          const ang = Math.atan2(y - fx.y, x - fx.x);

          // Hide the static grid dot underneath while its stand-in is in flight
          ctx.globalAlpha = 1;
          ctx.fillStyle = bgColor;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, TWO_PI);
          ctx.fill();

          ctx.globalAlpha = 0.4 + 0.6 * kick;
          ctx.fillStyle = seededColor(fx, x, y);
          ctx.beginPath();
          ctx.arc(x + Math.cos(ang) * disp, y + Math.sin(ang) * disp, ANIMATED_DOT_RADIUS, 0, TWO_PI);
          ctx.fill();
        }
      }
    };

    const frame = (now: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      ctx.clearRect(0, 0, width, height);

      for (let i = effects.length - 1; i >= 0; i--) {
        const fx = effects[i];
        // rAF timestamps mark the start of the frame and can predate the
        // performance.now() captured in trigger(); clamp to avoid negative time
        const elapsed = Math.max(0, now - fx.startTime);
        if (elapsed >= fx.duration) {
          effects.splice(i, 1);
          continue;
        }
        const p = elapsed / fx.duration;

        // Shared impact flash: a bright filled dot at the origin that decays fast
        if (elapsed < FLASH_DURATION) {
          const t = elapsed / FLASH_DURATION;
          ctx.globalAlpha = Math.pow(1 - t, 1.5);
          ctx.fillStyle = palette[fx.colorIndex % palette.length];
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, easeOutCubic(t) * 18, 0, TWO_PI);
          ctx.fill();
        }

        switch (fx.kind) {
          case "ripple":
            drawRipple(fx, p, width, height);
            break;
          case "rays":
            drawRays(fx, p);
            break;
          case "confetti":
            drawConfetti(fx, p, elapsed);
            break;
          case "quake":
            drawQuake(fx, p, width, height);
            break;
        }
      }

      ctx.globalAlpha = 1;
      if (effects.length > 0) {
        rafId = requestAnimationFrame(frame);
      } else {
        // Idle: stop the loop until the next trigger
        ctx.clearRect(0, 0, width, height);
        rafId = null;
      }
    };

    const trigger = (x: number, y: number, kindPool: EffectKind[]) => {
      // Never repeat the previous effect, so consecutive clicks always differ
      const candidates = kindPool.filter((k) => k !== lastKind);
      const kind = candidates[Math.floor(Math.random() * candidates.length)] ?? kindPool[0];
      lastKind = kind;

      const fx: Effect = {
        kind,
        x,
        y,
        startTime: performance.now(),
        duration: DURATIONS[kind],
        colorIndex: colorCycle++,
        seed: Math.floor(Math.random() * 0xffffffff),
        maxRadius: Math.max(
          Math.hypot(x, y),
          Math.hypot(window.innerWidth - x, y),
          Math.hypot(x, window.innerHeight - y),
          Math.hypot(window.innerWidth - x, window.innerHeight - y)
        ),
      };

      if (kind === "rays") {
        fx.rays = Array.from({ length: RAY_COUNT }, (_, i) => ({
          angle: (i / RAY_COUNT) * TWO_PI + (Math.random() - 0.5) * 0.2,
          length: 160 + Math.random() * 140,
          colorIdx: (fx.colorIndex + i) % palette.length,
        }));
      }

      if (kind === "confetti") {
        fx.particles = Array.from({ length: CONFETTI_COUNT }, () => {
          const ang = Math.random() * TWO_PI;
          const speed = 140 + Math.random() * 300;
          return {
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed - 140,
            size: 2.5 + Math.random() * 2.5,
            colorIdx: Math.floor(Math.random() * palette.length),
            spin: (Math.random() - 0.5) * 12,
            phase: Math.random() * TWO_PI,
          };
        });
      }

      effects.push(fx);
      if (rafId == null) rafId = requestAnimationFrame(frame);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest("a, button")) return;
      document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
      document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);
      trigger(e.clientX, e.clientY, ALL_KINDS);
    };
    window.addEventListener("pointerdown", handlePointerDown);

    const autoId = window.setInterval(() => {
      if (document.hidden) return;
      const padding = 24;
      trigger(
        padding + Math.random() * Math.max(0, window.innerWidth - padding * 2),
        padding + Math.random() * Math.max(0, window.innerHeight - padding * 2),
        AMBIENT_KINDS
      );
    }, AUTO_TRIGGER_INTERVAL);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.clearInterval(autoId);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
