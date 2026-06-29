"use client";
import { useEffect, useRef } from "react";
import styles from "./strokes.module.css";

// The "effects DNA" of the original (ripple / rays / confetti) reimagined for
// the Future Present Past poster: clicking flings out a handful of rounded
// lozenge capsules in the cover palette — the same shape language as the bars.

const PALETTE_VARS = ["--s-red", "--s-orange", "--s-yellow", "--s-green", "--s-blue"];
const BURST_COUNT = 14;
const GRAVITY = 900;
const LIFETIME = 1100; // ms
const AMBIENT_INTERVAL = 9000;
const TWO_PI = Math.PI * 2;

interface Capsule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  thick: number;
  angle: number;
  spin: number;
  color: string;
  born: number;
}

export default function CapsuleBurst() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const computed = getComputedStyle(document.documentElement);
    const palette = PALETTE_VARS.map((v) => computed.getPropertyValue(v).trim()).filter(Boolean);
    if (palette.length === 0) palette.push("#e3402f");

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const capsules: Capsule[] = [];
    let rafId: number | null = null;

    const drawCapsule = (c: Capsule, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      ctx.fillStyle = c.color;
      const r = c.thick / 2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-c.len / 2, -r, c.len, c.thick, r);
      } else {
        // Manual lozenge fallback
        ctx.moveTo(-c.len / 2 + r, -r);
        ctx.arc(-c.len / 2 + r, 0, r, -Math.PI / 2, Math.PI / 2, true);
        ctx.lineTo(c.len / 2 - r, r);
        ctx.arc(c.len / 2 - r, 0, r, Math.PI / 2, -Math.PI / 2, true);
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
    };

    const frame = (now: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = capsules.length - 1; i >= 0; i--) {
        const c = capsules[i];
        const t = Math.max(0, now - c.born) / 1000;
        const life = (now - c.born) / LIFETIME;
        if (life >= 1) {
          capsules.splice(i, 1);
          continue;
        }
        const px = c.x + c.vx * t;
        const py = c.y + c.vy * t + 0.5 * GRAVITY * t * t;
        drawCapsule(
          { ...c, x: px, y: py, angle: c.angle + c.spin * t },
          Math.pow(1 - life, 1.4)
        );
      }
      rafId = capsules.length > 0 ? requestAnimationFrame(frame) : null;
    };

    const emit = (x: number, y: number, count: number, spread: number) => {
      const now = performance.now();
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * TWO_PI;
        const speed = 160 + Math.random() * 300;
        capsules.push({
          x,
          y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - spread,
          len: 16 + Math.random() * 26,
          thick: 6 + Math.random() * 6,
          angle: ang,
          spin: (Math.random() - 0.5) * 10,
          color: palette[Math.floor(Math.random() * palette.length)],
          born: now,
        });
      }
      if (rafId == null) rafId = requestAnimationFrame(frame);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest("a, button")) return;
      emit(e.clientX, e.clientY, BURST_COUNT, 160);
    };
    window.addEventListener("pointerdown", handlePointerDown);

    // Ambient: a quiet drift of capsules rising from the lower edge
    const ambientId = window.setInterval(() => {
      if (document.hidden) return;
      const x = 40 + Math.random() * Math.max(0, window.innerWidth - 80);
      emit(x, window.innerHeight + 20, 6, 520);
    }, AMBIENT_INTERVAL);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.clearInterval(ambientId);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.burstCanvas} aria-hidden="true" />;
}
