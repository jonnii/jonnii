"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ThemeId } from "./registry";

// One lazily loaded chunk per design. Each design's code, CSS and fonts live in
// its own chunk, so a visit only downloads the design it rolled. Keyed by
// ThemeId so a theme added to the registry without a loader fails to compile.

// Shown while the rolled design's chunk downloads. The backdrop is already
// painted by the <head> script, so this just keeps the name in the DOM.
const Loading = () => <h1 className="stagePlaceholder">jonnii</h1>;

export const DESIGNS: Record<ThemeId, ComponentType> = {
  original: dynamic(() => import("./original/OriginalTheme"), { ssr: false, loading: Loading }),
  strokes: dynamic(() => import("./strokes/StrokesTheme"), { ssr: false, loading: Loading }),
  defrag: dynamic(() => import("./defrag/DefragTheme"), { ssr: false, loading: Loading }),
  solitaire: dynamic(() => import("./solitaire/SolitaireTheme"), { ssr: false, loading: Loading }),
  minesweeper: dynamic(() => import("./minesweeper/MinesweeperTheme"), {
    ssr: false,
    loading: Loading,
  }),
};
