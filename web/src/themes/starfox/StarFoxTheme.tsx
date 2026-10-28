"use client";
import styles from "./starfox.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useRef, useState } from "react";
import { Press_Start_2P } from "next/font/google";
import { WORD, SSH_COMMAND, SOCIALS, COPY_FEEDBACK_MS } from "../shared/content";
import { pixelWordMask, pixelWordWidth, PIXEL_GLYPH_H } from "../shared/pixelFont";
import { drawScene, fire, makeScene, type Scene } from "./scene";

// Corneria, 1993: a flat-shaded Arwing skims the green grid between grey
// towers, heading for giant voxel letters that spell the wordmark, and pulls
// up over them as they go by. Peppy keeps telling you to do a barrel roll, so
// do one: Z or R twice, a double-tap, or a tap on his comm window spins the
// whole page. The mouse (or the arrow keys) steers; click or space fires.

// Declared here rather than in the root layout so it's only downloaded when
// this design is the one rolled. Next preloads fonts for every module in the
// route, lazy ones included, so preloading is off.
const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-press-start",
  preload: false,
});

const ROLL_MS = 1000;
/** Two presses of Z/R (or two taps) closer together than this make a roll. */
const DOUBLE_MS = 400;
const LINE_MS = 5000;

const PEPPY_LINES = [
  "Do a barrel roll!",
  "Press Z or R twice!",
  "ssh in, I'll cover you.",
  "Never give up. Trust your instincts!",
];
const AFTER_ROLL = ["That's it!", "Again!", "Show-off.", "Now you're flying!"];

/** The wordmark as voxel grid coordinates (column, row from the top, letter). */
const GAP = 1;
const WORD_COLS = pixelWordWidth(GAP);
const VOXELS = (() => {
  const mask = pixelWordMask(WORD_COLS, 0, GAP);
  const colFilled = Array.from({ length: WORD_COLS }, (_, c) =>
    Array.from({ length: PIXEL_GLYPH_H }, (_, r) => mask.has(r * WORD_COLS + c)).some(Boolean)
  );
  // A fully empty column marks the gap to the next letter.
  const letterOfCol: number[] = [];
  let letter = -1;
  let inLetter = false;
  for (let c = 0; c < WORD_COLS; c++) {
    if (colFilled[c] && !inLetter) letter++;
    inLetter = colFilled[c];
    letterOfCol.push(Math.max(0, letter));
  }
  return [...mask].map((i) => {
    const c = i % WORD_COLS;
    return { c, r: Math.floor(i / WORD_COLS), letter: letterOfCol[c] };
  });
})();

function Peppy() {
  return (
    <svg viewBox="0 0 96 96" className={styles.face} aria-hidden="true">
      <rect width="96" height="96" fill="#0a2a5a" />
      <polygon points="30,8 38,4 42,40 32,42" fill="#c8c8d0" />
      <polygon points="58,4 66,8 64,42 54,40" fill="#a8a8b4" />
      <polygon points="33,10 37,8 39,38 35,38" fill="#e8a0b0" />
      <polygon points="59,8 63,10 61,38 57,38" fill="#d890a0" />
      <polygon points="22,46 48,34 74,46 70,74 48,86 26,74" fill="#d4d4dc" />
      <polygon points="48,34 74,46 70,74 48,86" fill="#b0b0bc" />
      <polygon points="34,52 42,50 42,58 34,58" fill="#112233" />
      <polygon points="54,50 62,52 62,58 54,58" fill="#112233" />
      <polygon points="44,64 52,64 48,70" fill="#e07090" />
      <polygon points="36,72 60,72 48,82" fill="#f0f0f4" />
      <polygon points="18,88 48,80 78,88 78,96 18,96" fill="#2a8a3a" />
    </svg>
  );
}

export default function StarFoxTheme() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const rollingRef = useRef(false);
  const lastPressRef = useRef(0);
  const lastTapRef = useRef(0);
  const copyResetRef = useRef<number | null>(null);
  const rollsRef = useRef(0);

  const [rolling, setRolling] = useState(false);
  const [rolls, setRolls] = useState(0);
  const [line, setLine] = useState(PEPPY_LINES[0]);
  const [copied, setCopied] = useState(false);

  const barrelRoll = useCallback(() => {
    if (rollingRef.current) return;
    rollingRef.current = true;
    setRolling(true);
    setLine(AFTER_ROLL[rollsRef.current % AFTER_ROLL.length]);
    rollsRef.current += 1;
    setRolls(rollsRef.current);
    window.setTimeout(() => {
      rollingRef.current = false;
      setRolling(false);
    }, ROLL_MS);
  }, []);

  // Peppy's chatter.
  useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % PEPPY_LINES.length;
      setLine(PEPPY_LINES[i]);
    }, LINE_MS);
    return () => window.clearInterval(id);
  }, []);

  // The flight: one canvas, redrawn every frame (or once, for reduced motion).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = makeScene(VOXELS, WORD_COLS);
    sceneRef.current = scene;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene.w = width;
      scene.h = height;
      if (still) drawScene(ctx, scene, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      drawScene(ctx, scene, dt);
      raf = requestAnimationFrame(frame);
    };
    if (!still) raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      sceneRef.current = null;
    };
  }, []);

  // Z or R twice rolls; the arrow keys steer.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const scene = sceneRef.current;
      if (k === "z" || k === "r") {
        const now = performance.now();
        if (now - lastPressRef.current < DOUBLE_MS) {
          lastPressRef.current = 0;
          barrelRoll();
        } else {
          lastPressRef.current = now;
        }
      } else if (scene && e.key === " " && e.target === document.body) {
        fire(scene);
        e.preventDefault();
      } else if (scene && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        scene.steer = e.key === "ArrowLeft" ? -1 : 1;
        scene.pointer = null;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      const scene = sceneRef.current;
      if (scene && (e.key === "ArrowLeft" || e.key === "ArrowRight")) scene.steer = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [barrelRoll]);

  const onPointerMove = (e: React.PointerEvent) => {
    const scene = sceneRef.current;
    if (!scene || e.pointerType !== "mouse") return;
    scene.pointer = e.clientX / window.innerWidth;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (sceneRef.current) fire(sceneRef.current);
    const now = performance.now();
    if (now - lastTapRef.current < DOUBLE_MS) {
      lastTapRef.current = 0;
      e.preventDefault();
      barrelRoll();
    } else {
      lastTapRef.current = now;
    }
  };

  const copySsh = () => {
    navigator.clipboard.writeText(SSH_COMMAND);
    setCopied(true);
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    copyResetRef.current = window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  return (
    <main className={`${styles.space} ${pressStart.variable}`}>
      <div
        className={`${styles.stage} ${rolling ? styles.rolling : ""}`}
        onPointerMove={onPointerMove}
      >
        <canvas ref={canvasRef} className={styles.canvas} onPointerDown={onPointerDown} />
        <h1 className={styles.srOnly}>{WORD}</h1>

        <div className={styles.shield} aria-hidden="true">
          SHIELD
          <div className={styles.bar}>
            <i />
          </div>
        </div>
        <div className={styles.score} aria-hidden="true">
          ROLLS <b>{String(rolls).padStart(3, "0")}</b>
          <br />
          BOMB <b>◆◆◆</b>
        </div>

        <button className={styles.comm} onClick={barrelRoll} aria-label="Do a barrel roll">
          <span className={styles.portrait}>
            <Peppy />
          </span>
          <span className={styles.speech}>
            <span className={styles.who}>PEPPY</span>
            <span className={styles.line} aria-live="polite">
              {line}
            </span>
            <span className={styles.keys} aria-hidden="true">
              <span className={styles.keyHint}>
                <kbd>Z</kbd>
                <kbd>R</kbd> or{" "}
              </span>
              double-tap
            </span>
          </span>
        </button>

        <div className={styles.links}>
          <button className={styles.ssh} onClick={copySsh} title="Copy to clipboard">
            <small>{copied ? "COPY THAT!" : "INCOMING TRANSMISSION"}</small>
            {SSH_COMMAND}
            <span className={styles.srOnly} aria-live="polite">
              {copied ? "copied to clipboard" : ""}
            </span>
          </button>
          <nav className={styles.rings} aria-label="Socials">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                className={styles.ring}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                title={s.label}
              >
                <FontAwesomeIcon icon={s.icon} className={styles.ringIcon} />
              </a>
            ))}
          </nav>
        </div>
      </div>
    </main>
  );
}
