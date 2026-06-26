import type { ComponentType } from "react";
import OriginalTheme from "./original/OriginalTheme";
import StrokesTheme from "./strokes/StrokesTheme";
import DefragTheme from "./defrag/DefragTheme";
import SolitaireTheme from "./solitaire/SolitaireTheme";

// A theme is a *whole self-contained design*, not a palette. Each one renders
// the shared content (see ./shared/content) with its own layout, typography
// and motion. Adding a design is a folder + one entry in THEMES below.

export interface ThemeDef {
  /** Stable id, used as the [data-theme] attribute value. */
  id: string;
  /** Human-facing name for the design. */
  label: string;
  /** The component that renders the entire page in this design. */
  Component: ComponentType;
}

export const THEMES: ThemeDef[] = [
  { id: "original", label: "Solarized Terminal", Component: OriginalTheme },
  { id: "strokes", label: "Future Present Past", Component: StrokesTheme },
  { id: "defrag", label: "Disk Defragmenter", Component: DefragTheme },
  { id: "solitaire", label: "Solitaire (You Win)", Component: SolitaireTheme },
];

export const THEME_IDS: string[] = THEMES.map((t) => t.id);

// Used if the rolled id is somehow unknown. Also the design that the bare
// :root tokens fall back to, so the page is never unstyled.
export const DEFAULT_THEME_ID = THEMES[0].id;
