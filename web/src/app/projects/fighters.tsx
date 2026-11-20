import type { ReactNode } from "react";

// Fighting-game flavour for each project, keyed by the slug in
// themes/shared/content. The name, blurb and link come from there.

export interface Fighter {
  /** Accent colour for the band. */
  color: string;
  /** The project's "special move" and its button input. */
  move: string;
  input: string;
  /** Stamp icon, drawn in currentColor. */
  icon: ReactNode;
}

const KANJI = ["壱", "弐", "参", "肆", "伍", "陸", "漆", "捌", "玖", "拾"];
export const kanjiNumeral = (i: number) => KANJI[i] ?? String(i + 1);

export const FIGHTERS: Record<string, Fighter> = {
  goodgrieves: {
    color: "#2fbf71",
    move: "Assessment Breaker",
    input: "↓↘→ + P",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M8 30 32 10l24 20" />
        <path d="M15 26v28h34V26" />
        <path d="M32 30v16m-8-8 8 8 8-8" />
      </svg>
    ),
  },
  figgle: {
    color: "#ff9f1c",
    move: "Daily Ten Combo",
    input: "→↓↘ + K",
    icon: (
      <svg viewBox="0 0 64 64" fill="currentColor">
        <path d="M10 18h12a6 6 0 1 1 12 0h12v12a6 6 0 1 1 0 12v12H34a6 6 0 1 0-12 0H10V42a6 6 0 1 0 0-12z" />
      </svg>
    ),
  },
  spoobird: {
    color: "#3aa7ff",
    move: "Nest Dive",
    input: "↓↓ + P",
    icon: (
      <svg viewBox="0 0 64 64" fill="currentColor">
        <path d="M14 38c0-12 9-22 21-22 7 0 12 4 14 9l9 3-9 3c-1 12-10 19-21 19-6 0-11-2-14-6z" />
        <path d="M14 38 4 30l3 14z" />
      </svg>
    ),
  },
  stackit: {
    color: "#b45cff",
    move: "Rebase Cascade",
    input: "←↙↓↘→ + P",
    icon: (
      <svg viewBox="0 0 64 64" fill="currentColor">
        <rect x="10" y="42" width="44" height="11" rx="3" />
        <rect x="16" y="27" width="38" height="11" rx="3" opacity=".8" />
        <rect x="22" y="12" width="32" height="11" rx="3" opacity=".6" />
      </svg>
    ),
  },
  platekit: {
    color: "#ff4d6d",
    move: "Fifty-One Plate Rush",
    input: "→→ + K",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="5">
        <rect x="5" y="16" width="54" height="32" rx="6" />
        <path d="M15 26v12m8-12h6m-6 6h5m-5 6h6m6-12h6l-6 12h6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
};

/** For a project added to content.ts before it gets its own fighter. */
export const FALLBACK_FIGHTER: Fighter = {
  color: "#f4ecdc",
  move: "Mystery Move",
  input: "↑↑↓↓ + P",
  icon: (
    <svg viewBox="0 0 64 64" fill="currentColor">
      <circle cx="32" cy="32" r="18" />
    </svg>
  ),
};
