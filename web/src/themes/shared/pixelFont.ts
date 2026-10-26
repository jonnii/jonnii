import { WORD } from "./content";

// A tiny 7-row bitmap font covering just the letters in the wordmark. Pixel-y
// designs (minesweeper, …) stamp the word onto their own grids with it.
export const PIXEL_GLYPH_H = 7;

const GLYPHS: Record<string, string[]> = {
  j: ["..#", "...", "..#", "..#", "..#", "#.#", ".#."],
  o: ["....", "....", ".##.", "#..#", "#..#", "#..#", ".##."],
  n: ["....", "....", "###.", "#..#", "#..#", "#..#", "#..#"],
  i: ["#", ".", "#", "#", "#", "#", "#"],
};

/** Width in cells of the wordmark when set with `gap` empty columns between letters. */
export function pixelWordWidth(gap = 1): number {
  const letters = WORD.split("");
  return (
    letters.reduce((w, ch) => w + (GLYPHS[ch]?.[0].length ?? 4), 0) +
    gap * (letters.length - 1)
  );
}

/**
 * Grid indices (row * cols + col) covered by the wordmark, centered
 * horizontally in a `cols`-wide grid with its top edge on row `top`.
 */
export function pixelWordMask(cols: number, top: number, gap = 1): Set<number> {
  const mask = new Set<number>();
  let col = Math.max(0, Math.floor((cols - pixelWordWidth(gap)) / 2));
  for (const ch of WORD.split("")) {
    const g = GLYPHS[ch];
    const w = g?.[0].length ?? 4;
    if (g) {
      for (let r = 0; r < PIXEL_GLYPH_H; r++) {
        for (let c = 0; c < w; c++) {
          if (g[r][c] === "#") mask.add((top + r) * cols + col + c);
        }
      }
    }
    col += w + gap;
  }
  return mask;
}
