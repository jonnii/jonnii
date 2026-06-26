"use client";
import styles from "./defrag.module.css";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { WORD, SSH_COMMAND, SOCIALS, COPY_FEEDBACK_MS } from "../shared/content";
import { THEMES } from "../registry";

// This file *is* the defrag design, so the Start menu marks it as the current
// theme. Switching themes navigates to ?theme=<id>, which the blocking <head>
// script in app/layout reads to pin a design before first paint.
const THEME_ID = "defrag";

// Cluster map dimensions — a dense grid of "disk clusters", like the real
// Disk Defragmenter's drive map.
const COLS = 48;
const ROWS = 22;
const CELL_COUNT = COLS * ROWS;
const ACTIVE_BAND = 6;

// The Win95 progress bar fills in discrete blocks, not a smooth slide.
const PROGRESS_SEGMENTS = 24;

// Deterministic 0..1 hash so each cluster keeps a stable type and jitter across
// re-renders (the percent counter ticks often; we don't want the map to reshuffle).
function hash(n: number): number {
  let x = (n * 2654435761) >>> 0;
  x ^= x >>> 15;
  x = (x * 2246822519) >>> 0;
  x ^= x >>> 13;
  return (x >>> 0) / 4294967295;
}

// Easter egg: a 9-row bitmap font for the letters in the wordmark. The cells
// these glyphs cover are camouflaged as ordinary dark clusters while scattered,
// then settle into the cyan defragmented field as the head passes over them.
const GLYPH_H = 9;
const GLYPH_GAP = 1;
const WORD_TOP = 6; // top grid row of the glyph band (9 rows tall, centered in 22)
const GLYPHS: Record<string, string[]> = {
  j: ["..#", "...", "..#", "..#", "..#", "..#", "..#", "..#", "##."],
  o: ["....", "....", ".##.", "#..#", "#..#", "#..#", ".##.", "....", "...."],
  n: ["....", "....", "###.", "#..#", "#..#", "#..#", "#..#", "....", "...."],
  i: ["##", "..", "##", "##", "##", "##", "##", "..", ".."],
};

// Set of grid indices covered by the wordmark glyphs, centered horizontally.
function buildWordMask(): Set<number> {
  const letters = WORD.split("");
  const widths = letters.map((ch) => GLYPHS[ch]?.[0].length ?? 4);
  const totalW =
    widths.reduce((a, b) => a + b, 0) + GLYPH_GAP * (letters.length - 1);
  let col = Math.max(0, Math.floor((COLS - totalW) / 2));
  const mask = new Set<number>();
  letters.forEach((ch, li) => {
    const g = GLYPHS[ch];
    const w = widths[li];
    if (g) {
      for (let r = 0; r < GLYPH_H; r++) {
        for (let c = 0; c < w; c++) {
          if (g[r][c] === "#") mask.add((WORD_TOP + r) * COLS + (col + c));
        }
      }
    }
    col += w + GLYPH_GAP;
  });
  return mask;
}

type CellType = "darkA" | "darkB";

interface Cell {
  type: CellType;
  col: number;
  jitter: number;
  isWord: boolean;
}

function buildCells(): Cell[] {
  const mask = buildWordMask();
  const cells: Cell[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const type: CellType = hash(i * 7 + 1) < 0.78 ? "darkA" : "darkB";
    const isWord = mask.has(i);
    cells.push({ type, col: i % COLS, jitter: hash(i * 13 + 3) * 0.6, isWord });
  }
  return cells;
}

const cellClass: Record<CellType, string> = {
  darkA: `${styles.pending} ${styles.pendingA}`,
  darkB: `${styles.pending} ${styles.pendingB}`,
};

function trayGlyph(label: string): string {
  if (label === "LinkedIn") return "in";
  if (label === "GitHub") return "gh";
  if (label.startsWith("X")) return "x";
  return label.slice(0, 2).toLowerCase();
}

function statusFor(pct: number): string {
  if (pct >= 100) return "Defragmentation of Drive C is complete.";
  if (pct < 6) return "Reading drive information…";
  return `Defragmenting Drive C… ${pct}% complete`;
}

export default function DefragTheme() {
  const cells = useMemo(buildCells, []);
  const [pct, setPct] = useState(0);
  const [clock, setClock] = useState("");
  const [copied, setCopied] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const copyResetRef = useRef<number | null>(null);

  // Counter clamped to 100 for display; it runs past 100 to hold the finished
  // "optimized" state (so the assembled word is appreciable) before restarting.
  const shown = Math.min(pct, 100);
  // The defrag head advances through the grid in reading order (top-left ->
  // bottom-right). Cells behind it are defragmented cyan; cells under the head
  // are the active red band; cells ahead stay dark blue.
  const head = Math.floor((shown / 100) * CELL_COUNT);

  // The defrag "pass": ticks 0 -> 100 slowly, holds done briefly, then starts over.
  useEffect(() => {
    const HOLD_TICKS = 12;
    const id = window.setInterval(() => {
      setPct((p) => (p >= 100 + HOLD_TICKS ? 0 : p + 1));
    }, 320);
    return () => window.clearInterval(id);
  }, []);

  // Live taskbar clock — client-only mount, so no hydration mismatch.
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    };
  }, []);

  // Close the Start menu on Escape.
  useEffect(() => {
    if (!startOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStartOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(SSH_COMMAND);
    setCopied(true);
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    copyResetRef.current = window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  return (
    <main className={styles.desktop} style={{ ["--cols"]: COLS } as CSSProperties}>
      <section className={`${styles.window} ${styles.raised}`}>
        {/* Title bar */}
        <div className={styles.titlebar}>
          <span className={styles.titleIcon} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className={styles.titleText}>Disk Defragmenter</span>
          <span className={styles.titleButtons} aria-hidden="true">
            <span className={`${styles.titleBtn} ${styles.raised}`}>
              <span className={styles.titleGlyphMin}>_</span>
            </span>
            <span className={`${styles.titleBtn} ${styles.raised}`}>&#9633;</span>
            <span className={`${styles.titleBtn} ${styles.raised}`}>&#10005;</span>
          </span>
        </div>

        {/* Menu bar — first letter underlined, like the real one */}
        <nav className={styles.menubar} aria-hidden="true">
          {["File", "Disk", "View", "Options", "Help"].map((label) => (
            <span className={styles.menuItem} key={label}>
              <u>{label[0]}</u>
              {label.slice(1)}
            </span>
          ))}
        </nav>

        {/* Body */}
        <div className={styles.body}>
          {/* The wordmark now lives inside the cluster map; keep an accessible
              heading for crawlers and screen readers. */}
          <h1 className={styles.srOnly}>{WORD}</h1>

          <div className={styles.status}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span aria-live="polite">{statusFor(shown)}</span>
          </div>

          {/* Cluster map */}
          <div className={`${styles.mapWrap} ${styles.sunken}`}>
            <div
              className={styles.map}
              role="img"
              aria-label="Disk cluster map, defragmenting"
              style={{ ["--map-T"]: "7.5s" } as CSSProperties}
            >
              {cells.map((c, i) => {
                let state = "";
                if (i < head) {
                  state = c.isWord ? styles.wordBlock : styles.defragged;
                } else if (i < Math.min(head + ACTIVE_BAND, CELL_COUNT)) {
                  state = styles.inProgress;
                }
                // else: ahead of the head — keep the dark, not-yet-defragged look.
                return (
                  <span
                    key={i}
                    className={`${styles.cell} ${cellClass[c.type]} ${state}`}
                    style={
                      { ["--col"]: c.col, ["--j"]: c.jitter } as CSSProperties
                    }
                  />
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swatchPending}`} /> Not defragmented
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swatchProgress}`} /> In progress
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swatchDefragged}`} /> Defragmented
            </span>
          </div>

          {/* Progress — discrete blocks that click in one at a time */}
          <div className={styles.progressRow}>
            <div className={`${styles.progressTrack} ${styles.sunken}`}>
              {Array.from({ length: PROGRESS_SEGMENTS }, (_, s) => (
                <span
                  key={s}
                  className={`${styles.progressSeg} ${
                    s < Math.round((shown / 100) * PROGRESS_SEGMENTS)
                      ? styles.progressSegOn
                      : ""
                  }`}
                />
              ))}
            </div>
            <span className={styles.progressPct}>{shown}%</span>
          </div>

          {/* ssh path field + Copy */}
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

        {/* Window status bar */}
        <div className={styles.statusbar}>
          <span className={`${styles.statusCell} ${styles.statusCellGrow} ${styles.sunken}`}>
            {shown >= 100 ? "Complete" : "Defragmenting…"}
          </span>
          <span className={`${styles.statusCell} ${styles.sunken}`}>Drive C</span>
        </div>
      </section>

      {/* Taskbar */}
      <footer className={styles.taskbar}>
        <div className={styles.startWrap}>
          {startOpen && (
            <>
              {/* Click-away backdrop */}
              <div
                className={styles.startOverlay}
                onClick={() => setStartOpen(false)}
              />
              <div className={styles.startMenu} role="menu">
                <div className={styles.startBanner} aria-hidden="true">
                  <span>
                    jonnii<b>95</b>
                  </span>
                </div>
                <div className={styles.startList}>
                  <div className={styles.startSection}>Themes</div>
                  {THEMES.map((t) => (
                    <a
                      key={t.id}
                      href={`?theme=${t.id}`}
                      className={styles.startItem}
                      role="menuitem"
                      aria-current={t.id === THEME_ID ? "true" : undefined}
                    >
                      <span className={styles.startBullet} aria-hidden="true">
                        {t.id === THEME_ID ? "●" : "○"}
                      </span>
                      {t.label}
                    </a>
                  ))}

                  <div className={styles.startSep} />

                  <div className={styles.startSection}>Find me</div>
                  {SOCIALS.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.startItem}
                      role="menuitem"
                    >
                      <span className={styles.startItemIcon} aria-hidden="true">
                        {trayGlyph(social.label)}
                      </span>
                      {social.label}
                    </a>
                  ))}

                  <div className={styles.startSep} />

                  <a href="/" className={styles.startItem} role="menuitem">
                    <span
                      className={`${styles.startItemIcon} ${styles.startItemSymbol}`}
                      aria-hidden="true"
                    >
                      ⟳
                    </span>
                    Shuffle theme…
                  </a>
                </div>
              </div>
            </>
          )}
          <button
            type="button"
            className={`${styles.start} ${styles.raised} ${
              startOpen ? styles.startPressed : ""
            }`}
            onClick={() => setStartOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={startOpen}
          >
            <span className={styles.startFlag} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            Start
          </button>
        </div>
        <span className={`${styles.taskApp} ${styles.raised}`}>
          <span className={styles.titleIcon} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className={styles.taskAppText}>Disk Defragmenter</span>
        </span>

        <div className={`${styles.tray} ${styles.sunken}`}>
          <nav className={styles.trayLinks} aria-label="social links">
            {SOCIALS.map((social) => (
              <a
                key={social.label}
                className={styles.trayLink}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
              >
                <span className={styles.trayGlyph} aria-hidden="true">
                  {trayGlyph(social.label)}
                </span>
              </a>
            ))}
          </nav>
          <span className={styles.clock} suppressHydrationWarning>
            {clock}
          </span>
        </div>
      </footer>
    </main>
  );
}
