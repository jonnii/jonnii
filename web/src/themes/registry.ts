// A theme is a *whole self-contained design*, not a palette. Each one renders
// the shared content (see ./shared/content) with its own layout, typography
// and motion. Adding a design is a folder, one entry in THEMES below and one
// loader in ./designs.
//
// This module is metadata only: it's imported by the root layout (to roll a
// theme before first paint) and by the shared taskbar (to list the themes), so
// it must never import a design. Designs are code-split in ./designs and only
// the rolled one is downloaded.

export interface ThemeDef {
  /** Stable id, used as the [data-theme] attribute value. */
  id: string;
  /** Human-facing name for the design. */
  label: string;
}

export const THEMES = [
  { id: "original", label: "Solarized Terminal" },
  { id: "strokes", label: "Future Present Past" },
  { id: "defrag", label: "Disk Defragmenter" },
  { id: "solitaire", label: "Solitaire (You Win)" },
  { id: "minesweeper", label: "Minesweeper" },
] as const satisfies readonly ThemeDef[];

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_IDS: string[] = THEMES.map((t) => t.id);

// Used if the rolled id is somehow unknown. Also the design that the bare
// :root tokens fall back to, so the page is never unstyled.
export const DEFAULT_THEME_ID: ThemeId = THEMES[0].id;
