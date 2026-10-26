"use client";
import styles from "./minesweeper.module.css";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { WORD, SSH_COMMAND, COPY_FEEDBACK_MS } from "../shared/content";
import { pixelWordMask } from "../shared/pixelFont";
import Taskbar from "../shared/Taskbar";

// The mines *are* the wordmark: every mine on the board is a pixel of "jonnii".
// On load the board plays itself, sweeping every safe square and then planting
// flags on the mines one by one, so the word spells itself out in red flags.
// Click a square to take over; hit a mine and the whole word blows up.
const COLS = 26;
const ROWS = 11;
const WORD_TOP = 2;
const CELL_COUNT = COLS * ROWS;

const AUTO_TICK_MS = 28;
const REVEALS_PER_TICK = 3;

type Mark = "hidden" | "open" | "flag";
type Status = "auto" | "playing" | "won" | "lost";

function neighbours(i: number): number[] {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) out.push(nr * COLS + nc);
    }
  }
  return out;
}

const MINES = pixelWordMask(COLS, WORD_TOP);
const COUNTS = Array.from({ length: CELL_COUNT }, (_, i) =>
  neighbours(i).filter((n) => MINES.has(n)).length
);
const SAFE_TOTAL = CELL_COUNT - MINES.size;

// The auto-player sweeps outward from the top-left corner like a flood.
const SWEEP_ORDER: number[] = (() => {
  const seen = new Set<number>([0]);
  const order: number[] = [];
  const queue = [0];
  while (queue.length) {
    const i = queue.shift()!;
    order.push(i);
    for (const n of neighbours(i)) {
      if (!seen.has(n) && !MINES.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  for (let i = 0; i < CELL_COUNT; i++) if (!MINES.has(i) && !seen.has(i)) order.push(i);
  return order;
})();

// Flags go down in reading order, column by column, so the word writes itself.
const FLAG_ORDER = [...MINES].sort((a, b) => (a % COLS) - (b % COLS) || a - b);

const freshBoard = (): Mark[] => Array<Mark>(CELL_COUNT).fill("hidden");

// Classic Minesweeper digit colours.
const DIGIT_CLASS = [
  "",
  styles.n1,
  styles.n2,
  styles.n3,
  styles.n4,
  styles.n5,
  styles.n6,
  styles.n7,
  styles.n8,
];

const FACE: Record<Status, string> = {
  auto: "🙂",
  playing: "🙂",
  won: "😎",
  lost: "😵",
};

const led = (n: number) => String(Math.max(-99, Math.min(999, n))).padStart(3, "0");

export default function MinesweeperTheme() {
  const [board, setBoard] = useState<Mark[]>(freshBoard);
  const [status, setStatus] = useState<Status>("auto");
  const [exploded, setExploded] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [pressing, setPressing] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyResetRef = useRef<number | null>(null);
  const stepRef = useRef(0);

  const flags = board.filter((m) => m === "flag").length;
  const opened = board.filter((m) => m === "open").length;

  // Auto-play: sweep safe squares, then plant flags on the word.
  useEffect(() => {
    if (status !== "auto") return;
    const id = window.setInterval(() => {
      const step = stepRef.current;
      if (step < SWEEP_ORDER.length) {
        const batch = SWEEP_ORDER.slice(step, step + REVEALS_PER_TICK);
        stepRef.current = step + batch.length;
        setBoard((b) => {
          const next = b.slice();
          for (const i of batch) if (next[i] === "hidden") next[i] = "open";
          return next;
        });
        return;
      }
      const f = step - SWEEP_ORDER.length;
      if (f < FLAG_ORDER.length) {
        stepRef.current = step + 1;
        setBoard((b) => {
          const next = b.slice();
          next[FLAG_ORDER[f]] = "flag";
          return next;
        });
        return;
      }
      setStatus("won");
    }, AUTO_TICK_MS);
    return () => window.clearInterval(id);
  }, [status]);

  // The red LED timer, frozen once the game is decided.
  useEffect(() => {
    if (status === "won" || status === "lost") return;
    const id = window.setInterval(() => setSeconds((s) => Math.min(999, s + 1)), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // A human finishing the board by hand also wins; flag the rest for them.
  useEffect(() => {
    if (status === "playing" && opened === SAFE_TOTAL) {
      setBoard((b) => b.map((m, i) => (MINES.has(i) ? "flag" : m)));
      setStatus("won");
    }
  }, [status, opened]);

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    stepRef.current = 0;
    setBoard(freshBoard());
    setExploded(null);
    setSeconds(0);
    setStatus("auto");
  }, []);

  const reveal = (i: number) => {
    if (status === "won" || status === "lost" || board[i] !== "hidden") return;
    if (status === "auto") setStatus("playing");
    if (MINES.has(i)) {
      setExploded(i);
      setStatus("lost");
      return;
    }
    // Standard flood fill: opening a zero opens everything around it.
    setBoard((b) => {
      const next = b.slice();
      const stack = [i];
      while (stack.length) {
        const j = stack.pop()!;
        if (next[j] !== "hidden") continue;
        next[j] = "open";
        if (COUNTS[j] === 0) for (const n of neighbours(j)) if (!MINES.has(n)) stack.push(n);
      }
      return next;
    });
  };

  const toggleFlag = (i: number) => {
    if (status === "won" || status === "lost" || board[i] === "open") return;
    if (status === "auto") setStatus("playing");
    setBoard((b) => {
      const next = b.slice();
      next[i] = next[i] === "flag" ? "hidden" : "flag";
      return next;
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(SSH_COMMAND);
    setCopied(true);
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    copyResetRef.current = window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  const face = pressing && (status === "auto" || status === "playing") ? "😮" : FACE[status];

  return (
    <main className={styles.desktop} style={{ ["--cols"]: COLS } as CSSProperties}>
      <section className={`${styles.window} ${styles.raised}`}>
        <div className={styles.titlebar}>
          <span className={styles.titleIcon} aria-hidden="true" />
          <span className={styles.titleText}>Minesweeper</span>
          <span className={styles.titleButtons} aria-hidden="true">
            <span className={`${styles.titleBtn} ${styles.raised}`}>
              <span className={styles.titleGlyphMin}>_</span>
            </span>
            <span className={`${styles.titleBtn} ${styles.raised}`}>&#10005;</span>
          </span>
        </div>

        <nav className={styles.menubar} aria-hidden="true">
          {["Game", "Help"].map((label) => (
            <span className={styles.menuItem} key={label}>
              <u>{label[0]}</u>
              {label.slice(1)}
            </span>
          ))}
        </nav>

        <div className={styles.body}>
          <h1 className={styles.srOnly}>{WORD}</h1>

          {/* Mine counter · smiley · timer */}
          <div className={`${styles.header} ${styles.sunkenThin}`}>
            <span className={styles.led} aria-label="mines left">
              {led(MINES.size - flags)}
            </span>
            <button
              type="button"
              className={`${styles.face} ${styles.raised}`}
              onClick={reset}
              aria-label="New game"
              title="New game"
            >
              {face}
            </button>
            <span className={styles.led} aria-label="seconds elapsed">
              {led(seconds)}
            </span>
          </div>

          {/* The minefield */}
          <div
            className={`${styles.field} ${styles.sunkenThick} ${status === "won" ? styles.won : ""}`}
            role="grid"
            aria-label="Minefield. The mines spell jonnii."
            onMouseDown={() => setPressing(true)}
            onMouseUp={() => setPressing(false)}
            onMouseLeave={() => setPressing(false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            {board.map((mark, i) => {
              const mine = MINES.has(i);
              const showMine = status === "lost" && mine && mark !== "flag";
              const wrongFlag = status === "lost" && mark === "flag" && !mine;
              let cls = styles.cell;
              let content: ReactNode = null;
              if (mark === "open") {
                cls += ` ${styles.open} ${DIGIT_CLASS[COUNTS[i]]}`;
                content = COUNTS[i] || null;
              } else if (showMine) {
                cls += ` ${styles.open} ${i === exploded ? styles.boom : ""}`;
                content = <span className={styles.mine} />;
              } else if (wrongFlag) {
                cls += ` ${styles.open}`;
                content = <span className={`${styles.mine} ${styles.crossed}`} />;
              } else {
                cls += ` ${styles.hidden}`;
                if (mark === "flag") content = <span className={styles.flag} />;
              }
              return (
                <span
                  key={i}
                  role="gridcell"
                  className={cls}
                  onClick={() => reveal(i)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggleFlag(i);
                  }}
                >
                  {content}
                </span>
              );
            })}
          </div>

          <div className={styles.sshRow}>
            <label className={styles.sshLabel} htmlFor="ssh-path">
              Connect:
            </label>
            <div className={`${styles.sshField} ${styles.sunken}`} id="ssh-path">
              {SSH_COMMAND}
            </div>
            <button
              type="button"
              className={`${styles.btn} ${styles.raised}`}
              onClick={handleCopy}
              title="Copy to clipboard"
            >
              {copied ? "Copied" : "Copy"}
              <span className={styles.srOnly} aria-live="polite">
                {copied ? "copied to clipboard" : ""}
              </span>
            </button>
          </div>
        </div>
      </section>

      <Taskbar
        themeId="minesweeper"
        appLabel="Minesweeper"
        iconVariant="mine"
        onAppClick={reset}
      />
    </main>
  );
}
