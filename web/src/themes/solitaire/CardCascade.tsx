"use client";
import { useEffect, useRef } from "react";
import styles from "./solitaire.module.css";

// The Windows Solitaire (Klondike) victory cascade. When you win, all 52 cards
// pour out of the four foundation piles in the top-right, fall under gravity and
// bounce off the floor — and because the canvas is *never cleared*, every drawn
// position is left behind, so each card paints a parabolic ribbon of overlapping
// copies that slowly buries the felt. The card art is the original 16-colour
// cards.dll bitmap (71x96, 4 suits across x 13 ranks down).

const SHEET_SRC = "/solitaire-cards.png";
const CARD_W = 71;
const CARD_H = 96;
const SUITS = 4; // sheet columns: hearts, clubs, diamonds, spades
const RANKS = 13; // sheet rows: A,2..10,J,Q,K
const DECK = SUITS * RANKS; // 52

// Physics runs on a fixed timestep so the trail copies are evenly spaced like
// the original, independent of the display refresh rate. Everything is in CSS
// pixels per step.
const STEP_MS = 22;
const GRAVITY = 0.85; // px/step^2 (scaled by card size)
const RESTITUTION = 0.82; // energy kept on each floor bounce
const SETTLE = GRAVITY * 3.2; // below this post-bounce speed the card lies flat
const WALL_RESTITUTION = 0.7; // energy kept bouncing off the window's side walls
const FRICTION = 0.94; // horizontal slowdown once a card lies on the floor
const REST_VX = 0.35; // below this a grounded card is at rest and retires
const STAGGER_MS = 360; // gap between successive card launches
const LAUNCH_TOP = 14; // y of the foundation row, just inside the felt body
const FLOOR_PAD = 14; // floor sits this far above the bottom of the felt body
const MAX_FRAME_MS = 120; // clamp dt after a background tab stall

interface Card {
  sx: number;
  sy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  dead: boolean;
}

export default function CardCascade({ onDeal }: { onDeal?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Keep the latest onDeal without re-running the heavy setup effect.
  const onDealRef = useRef(onDeal);
  onDealRef.current = onDeal;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // The cascade is confined to its host element (the window's felt body), so it
    // measures that, not the whole viewport.
    const host = canvas.parentElement;

    // Card draw size: native 71x96 in a large window, scaled down in small ones.
    let scale = 1;
    let drawW = CARD_W;
    let drawH = CARD_H;
    let cssW = 0;
    let cssH = 0;
    let floorY = 0;
    let slots: number[] = []; // x of the four foundation piles (top-right)
    let lastW = 0;
    let lastH = 0;

    const measure = () => {
      cssW = host ? host.clientWidth : window.innerWidth;
      cssH = host ? host.clientHeight : window.innerHeight;
      lastW = cssW;
      lastH = cssH;
      scale = Math.max(0.42, Math.min(1, cssW / 1000));
      drawW = Math.round(CARD_W * scale);
      drawH = Math.round(CARD_H * scale);
      floorY = cssH - FLOOR_PAD;
      const gap = Math.round(drawW * 0.28);
      const rightEdge = cssW - drawW - Math.round(drawW * 0.3);
      slots = [0, 1, 2, 3].map((i) => rightEdge - (3 - i) * (drawW + gap));
    };

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      measure();
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false; // keep the chunky 16-colour pixels crisp
    };

    const sheet = new Image();
    let ready = false;
    let rafId: number | null = null;

    // Run state
    let deck: Array<{ sx: number; sy: number }> = [];
    const live: Card[] = [];
    let sinceLaunch = 0;
    let acc = 0;
    let last = 0;

    const drawCard = (sx: number, sy: number, x: number, y: number) => {
      ctx.drawImage(sheet, sx, sy, CARD_W, CARD_H, Math.round(x), Math.round(y), drawW, drawH);
    };

    const drawFoundations = () => {
      // Four empty pile outlines the cards launch from — promptly buried.
      ctx.save();
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = 1;
      for (const sx of slots) {
        ctx.strokeRect(sx + 0.5, LAUNCH_TOP + 0.5, drawW - 1, drawH - 1);
      }
      ctx.restore();
    };

    const buildDeck = () => {
      const d: Array<{ sx: number; sy: number }> = [];
      for (let col = 0; col < SUITS; col++) {
        for (let row = 0; row < RANKS; row++) {
          d.push({ sx: col * CARD_W, sy: row * CARD_H });
        }
      }
      // Fisher-Yates — launch order is cosmetic but a shuffle keeps suits mixed.
      for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
      }
      return d;
    };

    const launch = () => {
      const card = deck.pop();
      if (!card) return;
      const slot = slots[(DECK - deck.length - 1) % slots.length];
      const hbase = cssW / 135;
      // Most cards spray left across the table; a minority drift right to fill
      // the corner under the foundations before exiting. No floor friction, so
      // horizontal speed is constant for the card's whole life.
      const goRight = Math.random() < 0.24;
      const mag = goRight
        ? (0.3 + Math.random() * 0.45) * hbase
        : (0.45 + Math.random() * 0.95) * hbase;
      live.push({
        sx: card.sx,
        sy: card.sy,
        x: slot,
        y: LAUNCH_TOP,
        vx: (goRight ? 1 : -1) * mag * scale,
        vy: Math.random() * 1.5 * scale,
        grounded: false,
        dead: false,
      });
    };

    const stepOnce = () => {
      const g = GRAVITY * scale;
      const settle = SETTLE * scale;

      sinceLaunch += STEP_MS;
      if (deck.length > 0 && sinceLaunch >= STAGGER_MS) {
        sinceLaunch = 0;
        launch();
      }

      const restVx = REST_VX * scale;
      for (let i = live.length - 1; i >= 0; i--) {
        const c = live[i];
        if (!c.grounded) {
          c.vy += g;
          c.y += c.vy;
        }
        c.x += c.vx;

        // Floor bounce.
        if (!c.grounded && c.y + drawH >= floorY) {
          c.y = floorY - drawH;
          c.vy = -c.vy * RESTITUTION;
          if (Math.abs(c.vy) < settle) {
            c.vy = 0;
            c.grounded = true;
          }
        }

        // Bounce off the window's side walls so the cards stay inside the felt.
        if (c.x <= 0) {
          c.x = 0;
          c.vx = -c.vx * WALL_RESTITUTION;
        } else if (c.x + drawW >= cssW) {
          c.x = cssW - drawW;
          c.vx = -c.vx * WALL_RESTITUTION;
        }

        // A card resting on the floor slowly loses its sideways speed.
        if (c.grounded) c.vx *= FRICTION;

        // Leave this position painted (the trail is just every past step).
        drawCard(c.sx, c.sy, c.x, c.y);

        // Retire the card once it has come to rest on the floor.
        if (c.grounded && Math.abs(c.vx) < restVx) {
          live.splice(i, 1);
        }
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(MAX_FRAME_MS, now - last);
      last = now;
      acc += dt;
      while (acc >= STEP_MS) {
        stepOnce();
        acc -= STEP_MS;
      }
      if (deck.length > 0 || live.length > 0) {
        rafId = requestAnimationFrame(frame);
      } else {
        rafId = null; // cascade complete — leave the finished pile on screen
      }
    };

    const startRun = () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      setupCanvas();
      ctx.clearRect(0, 0, cssW, cssH);
      deck = buildDeck();
      live.length = 0;
      sinceLaunch = STAGGER_MS; // launch the first card immediately
      acc = 0;

      drawFoundations();
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    };

    const onLoad = () => {
      ready = true;
      startRun();
    };
    sheet.onload = onLoad;
    sheet.src = SHEET_SRC;
    if (sheet.complete && sheet.naturalWidth > 0) onLoad();

    // Click on the felt (not the dialog or links) re-deals; the parent remounts
    // us via a changing key, giving a fresh, cleared canvas.
    const onPointerDown = (e: Event) => {
      if (e.target instanceof Element && e.target.closest("a, button, [data-no-deal]")) return;
      onDealRef.current?.();
    };
    const clickTarget: EventTarget = host ?? window;
    clickTarget.addEventListener("pointerdown", onPointerDown);

    // Restart the cascade when the play area actually changes size.
    const ro =
      host && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (!ready) return;
            if (
              Math.abs(host.clientWidth - lastW) < 2 &&
              Math.abs(host.clientHeight - lastH) < 2
            )
              return;
            startRun();
          })
        : null;
    if (ro && host) ro.observe(host);

    return () => {
      clickTarget.removeEventListener("pointerdown", onPointerDown);
      if (ro) ro.disconnect();
      if (rafId != null) cancelAnimationFrame(rafId);
      sheet.onload = null;
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.cascade} aria-hidden="true" />;
}
