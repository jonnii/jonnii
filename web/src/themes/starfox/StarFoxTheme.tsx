"use client";
import styles from "./starfox.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useRef, useState } from "react";
import { Press_Start_2P } from "next/font/google";
import { WORD, SSH_COMMAND, SOCIALS, COPY_FEEDBACK_MS } from "../shared/content";
import { pixelWordMask, pixelWordWidth, PIXEL_GLYPH_H } from "../shared/pixelFont";
import {
  drawScene,
  fire,
  makeScene,
  resetScene,
  roll,
  stepScene,
  touch,
  type GameEvent,
  type Scene,
} from "./scene";

// Corneria, 1993, drawn the Super FX way: chunky pixels, flat-shaded
// polygons and dithered skies. The Arwing flies a short sortie toward giant
// voxel letters that spell the wordmark while Venom fighters attack. Click or
// space fires; the mouse, a drag or the arrow keys steer; leave it alone and
// the autopilot flies. Their shots hurt unless you do a barrel roll (Z or R
// twice, or a double-tap), which bats them away. Peppy's comm window does the
// other barrel roll: the whole page. Fly under the letters and the mission
// ends with a tally, the ssh command and the links.

// Declared here rather than in the root layout so it's only downloaded when
// this design is the one rolled. Next preloads fonts for every module in the
// route, lazy ones included, so preloading is off.
const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-press-start",
  preload: false,
});

/** The Super FX chip managed a lot less than 60fps; 30 keeps some of the chop. */
const FRAME_S = 1 / 30;
/** Each big pixel is this many CSS pixels, give or take, on the short side. */
const PIXELS_ON_SHORT_SIDE = 240;
const PAGE_ROLL_MS = 1000;
/** Two presses of Z/R (or two taps) closer together than this make a roll. */
const DOUBLE_MS = 400;
const LINE_MS = 5000;
const POP_MS = 800;

type Pilot = "PEPPY" | "FALCO" | "SLIPPY";
type Line = [Pilot, string];

const IDLE_LINES: Line[] = [
  ["PEPPY", "Do a barrel roll!"],
  ["PEPPY", "Roll to deflect their shots!"],
  ["PEPPY", "ssh in, I'll cover you."],
  ["PEPPY", "Never give up. Trust your instincts!"],
];
const EVENT_LINES: Partial<Record<GameEvent["kind"], Line[]>> = {
  damage: [
    ["PEPPY", "Do a barrel roll!"],
    ["PEPPY", "Use the barrel roll to deflect their shots!"],
    ["SLIPPY", "Fox, watch out!"],
  ],
  badly: [["PEPPY", "Fox, you're hit badly! Shield restored."]],
  deflect: [
    ["PEPPY", "That's it!"],
    ["FALCO", "Show-off."],
    ["SLIPPY", "Wow! Nice roll, Fox!"],
  ],
  hit: [
    ["SLIPPY", "Nice shot, Fox!"],
    ["FALCO", "Not bad."],
    ["FALCO", "I could've done that."],
  ],
};
const POPS: Partial<Record<GameEvent["kind"], [string, string]>> = {
  hit: ["+1 HIT", "gold"],
  deflect: ["DEFLECTED!", "cyan"],
  damage: ["-SHIELD", "red"],
  badly: ["HIT BADLY!", "red"],
};

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

function rank(hits: number): string {
  if (hits >= 12) return "GREAT!";
  if (hits >= 6) return "GOOD";
  return "OK";
}

// The squad's comm portraits: flat-shaded polygon heads.
function Portrait({ pilot }: { pilot: Pilot }) {
  if (pilot === "FALCO") {
    return (
      <svg viewBox="0 0 96 96" className={styles.face} aria-hidden="true">
        <rect width="96" height="96" fill="#0a2a5a" />
        <polygon points="36,30 48,10 50,30" fill="#d03030" />
        <polygon points="20,44 48,26 76,44 72,72 48,84 24,72" fill="#3a5ad0" />
        <polygon points="48,26 76,44 72,72 48,84" fill="#2a40a0" />
        <polygon points="32,50 42,48 42,56 32,56" fill="#112211" />
        <polygon points="54,48 64,50 64,56 54,56" fill="#112211" />
        <polygon points="36,60 60,60 48,80" fill="#f0c030" />
        <polygon points="48,60 60,60 48,80" fill="#c09020" />
        <polygon points="16,90 48,82 80,90 80,96 16,96" fill="#2a3a8a" />
      </svg>
    );
  }
  if (pilot === "SLIPPY") {
    return (
      <svg viewBox="0 0 96 96" className={styles.face} aria-hidden="true">
        <rect width="96" height="96" fill="#0a2a5a" />
        <polygon points="20,44 48,26 76,44 72,72 48,84 24,72" fill="#6ac06a" />
        <polygon points="48,26 76,44 72,72 48,84" fill="#4a9a4a" />
        <polygon points="30,46 42,42 42,56 30,56" fill="#f0f0e0" />
        <polygon points="54,42 66,46 66,56 54,56" fill="#d8d8c8" />
        <polygon points="34,50 40,48 40,54 34,54" fill="#112211" />
        <polygon points="56,48 62,50 62,54 56,54" fill="#112211" />
        <polygon points="30,64 66,64 48,74" fill="#e8f0d0" />
        <polygon points="16,90 48,82 80,90 80,96 16,96" fill="#8a6a2a" />
      </svg>
    );
  }
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

interface Pop {
  id: number;
  text: string;
  tone: string;
  x: number;
  y: number;
}

interface Tally {
  hits: number;
  rolls: number;
  shield: number;
}

export default function StarFoxTheme() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const pageRollingRef = useRef(false);
  const lastPressRef = useRef(0);
  const lastTapRef = useRef(0);
  const copyResetRef = useRef<number | null>(null);
  const lineHeldUntilRef = useRef(0);
  const popIdRef = useRef(0);

  const [pageRolling, setPageRolling] = useState(false);
  const [shield, setShield] = useState(100);
  const [hits, setHits] = useState(0);
  const [line, setLine] = useState<Line>(IDLE_LINES[0]);
  const [pops, setPops] = useState<Pop[]>([]);
  const [tally, setTally] = useState<Tally | null>(null);
  const [copied, setCopied] = useState(false);

  const say = useCallback((next: Line) => {
    setLine(next);
    lineHeldUntilRef.current = performance.now() + LINE_MS;
  }, []);

  const shipRoll = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    touch(scene);
    roll(scene);
  }, []);

  // Peppy's comm window: the ship rolls, and so does the whole page.
  const pageRoll = useCallback(() => {
    shipRoll();
    if (pageRollingRef.current) return;
    pageRollingRef.current = true;
    setPageRolling(true);
    window.setTimeout(() => {
      pageRollingRef.current = false;
      setPageRolling(false);
    }, PAGE_ROLL_MS);
  }, [shipRoll]);

  const flyAgain = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    resetScene(scene);
    touch(scene);
    setTally(null);
    setHits(0);
    setShield(100);
    say(IDLE_LINES[0]);
  }, [say]);

  // Peppy's chatter, between the things worth shouting about.
  useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      if (performance.now() < lineHeldUntilRef.current) return;
      i = (i + 1) % IDLE_LINES.length;
      setLine(IDLE_LINES[i]);
    }, LINE_MS);
    return () => window.clearInterval(id);
  }, []);

  // The flight: a low-resolution canvas, stepped at a steady 30fps (or drawn
  // once, for reduced motion). The scene reports what happened as events.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = makeScene(VOXELS, WORD_COLS);
    sceneRef.current = scene;
    let hitCount = 0;

    const handle = (e: GameEvent) => {
      if (e.kind === "complete") {
        setTally({ hits: scene.hits, rolls: scene.rolls, shield: Math.round(scene.shield) });
        return;
      }
      const lines = EVENT_LINES[e.kind];
      if (e.kind === "hit") hitCount++;
      // Not every kill gets a comment.
      if (lines && (e.kind !== "hit" || hitCount % 2 === 1)) {
        say(lines[Math.floor(Math.random() * lines.length)]);
      }
      const pop = POPS[e.kind];
      if (pop) {
        const id = ++popIdRef.current;
        setPops((ps) => [...ps, { id, text: pop[0], tone: pop[1], x: e.x, y: e.y }]);
        window.setTimeout(() => setPops((ps) => ps.filter((p) => p.id !== id)), POP_MS);
      }
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const px = Math.max(2, Math.round(Math.min(width, height) / PIXELS_ON_SHORT_SIDE));
      scene.rw = Math.max(1, Math.round(width / px));
      scene.rh = Math.max(1, Math.round(height / px));
      canvas.width = scene.rw;
      canvas.height = scene.rh;
      if (still) drawScene(ctx, scene);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = performance.now();
    let pending = 0;
    let shownShield = 100;
    let shownHits = 0;
    const frame = (now: number) => {
      pending = Math.min(pending + (now - last) / 1000, FRAME_S * 4);
      last = now;
      if (pending >= FRAME_S) {
        while (pending >= FRAME_S) {
          stepScene(scene, FRAME_S);
          pending -= FRAME_S;
        }
        drawScene(ctx, scene);
        for (const e of scene.events.splice(0)) handle(e);
        const sh = Math.round(scene.shield);
        if (sh !== shownShield) setShield((shownShield = sh));
        if (scene.hits !== shownHits) setHits((shownHits = scene.hits));
      }
      raf = requestAnimationFrame(frame);
    };
    if (!still) raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      sceneRef.current = null;
    };
  }, [say]);

  // Z or R twice rolls, space fires, the arrows steer, Enter flies again.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const scene = sceneRef.current;
      if (!scene) return;
      const k = e.key.toLowerCase();
      if (k === "z" || k === "r") {
        touch(scene);
        const now = performance.now();
        if (now - lastPressRef.current < DOUBLE_MS) {
          lastPressRef.current = 0;
          shipRoll();
        } else {
          lastPressRef.current = now;
        }
      } else if (e.key === " " && e.target === document.body) {
        touch(scene);
        fire(scene);
        e.preventDefault();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        touch(scene);
        scene.steer = e.key === "ArrowLeft" ? -1 : 1;
        scene.pointer = null;
        e.preventDefault();
      } else if (e.key === "Enter" && scene.phase === "complete") {
        flyAgain();
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
  }, [shipRoll, flyAgain]);

  const onPointerMove = (e: React.PointerEvent) => {
    const scene = sceneRef.current;
    if (!scene) return;
    // The mouse steers by hovering; a finger steers by dragging.
    if (e.pointerType !== "mouse" && !e.buttons) return;
    touch(scene);
    scene.pointer = e.clientX / window.innerWidth;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const scene = sceneRef.current;
    if (!scene) return;
    touch(scene);
    fire(scene);
    const now = performance.now();
    if (now - lastTapRef.current < DOUBLE_MS) {
      lastTapRef.current = 0;
      e.preventDefault();
      shipRoll();
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

  const sshButton = (
    <button className={styles.ssh} onClick={copySsh} title="Copy to clipboard">
      <small>{copied ? "COPY THAT!" : tally ? "NEXT MISSION" : "INCOMING TRANSMISSION"}</small>
      {SSH_COMMAND}
      <span className={styles.srOnly} aria-live="polite">
        {copied ? "copied to clipboard" : ""}
      </span>
    </button>
  );

  const rings = (
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
  );

  const pad = (n: number) => String(n).padStart(3, "0");

  return (
    <main className={`${styles.space} ${pressStart.variable}`}>
      <div
        className={`${styles.stage} ${pageRolling ? styles.rolling : ""}`}
        onPointerMove={onPointerMove}
      >
        <canvas ref={canvasRef} className={styles.canvas} onPointerDown={onPointerDown} />
        <h1 className={styles.srOnly}>{WORD}</h1>

        <div className={styles.shield} aria-hidden="true">
          SHIELD
          <div className={styles.bar}>
            <i style={{ width: `${shield}%` }} />
          </div>
        </div>
        <div className={styles.score} aria-hidden="true">
          HITS <b>{pad(hits)}</b>
        </div>

        {pops.map((p) => (
          <span
            key={p.id}
            className={`${styles.pop} ${styles[p.tone]}`}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            aria-hidden="true"
          >
            {p.text}
          </span>
        ))}

        {!tally && (
          <>
            <button className={styles.comm} onClick={pageRoll} aria-label="Do a barrel roll">
              <span className={styles.portrait}>
                <Portrait pilot={line[0]} />
              </span>
              <span className={styles.speech}>
                <span className={styles.who}>{line[0]}</span>
                <span className={styles.line} aria-live="polite">
                  {line[1]}
                </span>
                <span className={styles.keys} aria-hidden="true">
                  <span className={styles.keyHint}>
                    <kbd>Z</kbd>
                    <kbd>R</kbd> or{" "}
                  </span>
                  double-tap to roll
                </span>
              </span>
            </button>

            <div className={styles.links}>
              {sshButton}
              {rings}
            </div>
          </>
        )}

        {tally && (
          <section className={styles.complete} aria-label="Mission complete">
            <h2 className={styles.title}>
              MISSION
              <br />
              COMPLETE
            </h2>
            <p className={styles.course}>CORNERIA · COURSE 1</p>
            <dl className={styles.tally}>
              <dt>ENEMY DESTROYED</dt>
              <dd>{pad(tally.hits)}</dd>
              <dt>BARREL ROLLS</dt>
              <dd>{pad(tally.rolls)}</dd>
              <dt>SHIELD</dt>
              <dd>{tally.shield}%</dd>
              <dt>RANK</dt>
              <dd className={styles.rank}>{rank(tally.hits)}</dd>
            </dl>
            {sshButton}
            {rings}
            <button className={styles.again} onClick={flyAgain}>
              FLY AGAIN
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
