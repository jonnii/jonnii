"use client";
import styles from "./defrag.module.css";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { WORD, SSH_COMMAND, COPY_FEEDBACK_MS } from "../shared/content";
import Taskbar from "../shared/Taskbar";

// Cluster map dimensions — a dense grid of "disk clusters", like the real
// Disk Defragmenter's drive map.
const COLS = 48;
const ROWS = 22;
const CELL_COUNT = COLS * ROWS;
const ACTIVE_BAND = 6;
const EMPTY_PCT = 0.18;
const SYSTEM_PCT = 0.015;

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

type CellType = "empty" | "regular" | "system";

interface Cell {
  type: CellType;
  isWord: boolean;
}

function buildCells(): Cell[] {
  const mask = buildWordMask();
  const cells: Cell[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const r = hash(i * 7 + 1);
    let type: CellType = "regular";
    if (r < SYSTEM_PCT) type = "system";
    else if (r < SYSTEM_PCT + EMPTY_PCT) type = "empty";
    const isWord = mask.has(i);
    if (isWord) type = "regular";
    cells.push({ type, isWord });
  }
  return cells;
}

const cellClass: Record<CellType, string> = {
  empty: styles.empty,
  regular: styles.regular,
  system: styles.system,
};

function statusFor(pct: number): string {
  if (pct >= 100) return "Defragmentation of Drive C is complete.";
  if (pct < 6) return "Reading drive information…";
  return `Defragmenting Drive C… ${pct}% complete`;
}

export default function DefragTheme() {
  const cells = useMemo(buildCells, []);
  const [pct, setPct] = useState(0);
  const [copied, setCopied] = useState(false);
  const copyResetRef = useRef<number | null>(null);

  // Counter clamped to 100 for display; it runs past 100 to hold the finished
  // "optimized" state (so the assembled word is appreciable) before restarting.
  const shown = Math.min(pct, 100);
  // The defrag head scans for empty holes from the front of the disk. Behind it,
  // movable data has been relocated into those holes (blue). Ahead of it, regular
  // data remains cyan; selected source blocks flash green while partial writes
  // fill the current hole in red. System blocks stay fixed.
  const head = Math.floor((shown / 100) * CELL_COUNT);
  const sourceStart =
    head < CELL_COUNT - ACTIVE_BAND
      ? head +
        ACTIVE_BAND +
        Math.floor(hash(pct + 9) * Math.max(1, CELL_COUNT - head - ACTIVE_BAND))
      : CELL_COUNT;

  // The defrag "pass": ticks 0 -> 100 slowly, holds done briefly, then starts over.
  useEffect(() => {
    const HOLD_TICKS = 12;
    const id = window.setInterval(() => {
      setPct((p) => (p >= 100 + HOLD_TICKS ? 0 : p + 1));
    }, 320);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    };
  }, []);

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
            >
              {cells.map((c, i) => {
                let state = "";
                if (c.type !== "system") {
                  if (i < head) {
                    state = c.isWord ? styles.wordBlock : styles.moved;
                  } else if (i < Math.min(head + ACTIVE_BAND, CELL_COUNT)) {
                    state = styles.partial;
                  } else if (i >= sourceStart && i < Math.min(sourceStart + ACTIVE_BAND, CELL_COUNT)) {
                    state = styles.selected;
                  }
                }
                // else: ahead of the head — keep the original disk composition.
                return (
                  <span
                    key={i}
                    className={`${styles.cell} ${cellClass[c.type]} ${state}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swatchRegular}`} /> Regular
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swatchMoved}`} /> Moved
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swatchSelected}`} /> Selected
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swatchPartial}`} /> Partial
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swatchSystem}`} /> System
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

      {/* Shared Win95 taskbar + Start menu */}
      <Taskbar themeId="defrag" appLabel="Disk Defragmenter" iconVariant="grid" />
    </main>
  );
}
