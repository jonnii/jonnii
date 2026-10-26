"use client";
import { useEffect, useState } from "react";
import { THEME_IDS, DEFAULT_THEME_ID, type ThemeId } from "./registry";
import { DESIGNS } from "./designs";

/**
 * Picks one design at random per visit and mounts only that design. Designs
 * are code-split (see ./designs), so only the chosen one is downloaded.
 *
 * The blocking <head> script (see app/layout) has already rolled a theme and
 * set `data-theme` on <html> before first paint, so the correct backdrop is
 * painted instantly. We read that same value here so the mounted design always
 * matches the painted background — single source of truth, no wrong-theme flash.
 *
 * Server + first client render return the same sr-only placeholder (so there's
 * no hydration mismatch); the chosen design swaps in on mount and plays its own
 * entrance animation, turning the swap into an intentional reveal.
 */
export default function ThemeStage() {
  const [themeId, setThemeId] = useState<ThemeId | null>(null);

  useEffect(() => {
    const fromAttr = document.documentElement.dataset.theme;
    const chosen =
      fromAttr && THEME_IDS.includes(fromAttr)
        ? fromAttr
        : THEME_IDS[Math.floor(Math.random() * THEME_IDS.length)] ?? DEFAULT_THEME_ID;
    document.documentElement.dataset.theme = chosen;
    setThemeId(chosen as ThemeId);
  }, []);

  if (themeId === null) {
    // Keep the name in the DOM for crawlers / no-JS while the design resolves.
    return <h1 className="stagePlaceholder">jonnii</h1>;
  }

  const Design = DESIGNS[themeId] ?? DESIGNS[DEFAULT_THEME_ID];
  return <Design />;
}
