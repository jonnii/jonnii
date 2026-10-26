// Pixel-art sprites for SkiFree, one character per pixel ("." is clear).
// Each is pre-rendered once to a small canvas at the design's pixel scale and
// stamped onto the slope anchored at its bottom-centre.

const PALETTE: Record<string, string> = {
  k: "#000000",
  w: "#ffffff",
  g: "#0b7d1b",
  G: "#35b94a",
  t: "#7a4a1a",
  T: "#a8692c",
  h: "#d8102c",
  s: "#f4c08c",
  b: "#3050d0",
  B: "#1c2f90",
  p: "#262626",
  e: "#8c8c8c",
  E: "#c8c8c8",
  r: "#d8102c",
};

const SPRITES = {
  tree: [
    ".....g.....",
    "....ggg....",
    "...gGggg...",
    "....ggg....",
    "...gggGg...",
    "..ggGgggg..",
    "....gggg...",
    "...gGggggg.",
    "..gggggGgg.",
    ".ggGgggggg.",
    "...ggggGg..",
    "..gggGggggg",
    ".gggggggGgg",
    "ggGggggggg.",
    "....ttt....",
    "....ttt....",
  ],
  rock: [
    "..eeee...",
    ".eEEEee..",
    "eEEeeeee.",
    "eeeeeeeek",
    ".kkkkkkk.",
  ],
  stump: [
    "..TTTT..",
    ".TttttT.",
    ".tTttTt.",
    ".tttttt.",
    "ttttttttt",
  ],
  skierDown: [
    "....hh....",
    "...hhhh...",
    "...ssss...",
    "....ss....",
    "..bbbbbb..",
    ".b.bbbb.b.",
    "k..bbbb..k",
    "k..pppp..k",
    "k..p..p..k",
    "...p..p...",
    "..kp..pk..",
    "..k....k..",
    "..k....k..",
    "..k....k..",
  ],
  skierDiag: [
    "....hh....",
    "...hhhh...",
    "...ssss...",
    "....ss....",
    "...bbbbb..",
    "..bbbbbbb.",
    "..bbbbb.bk",
    "...pppp..k",
    "...pp.pp.k",
    "..pp...pp.",
    ".kkk....kk",
    "...kkk...kk",
    ".....kkk...",
  ],
  skierSide: [
    "...hh.....",
    "..hhhh....",
    "..ssss....",
    "...ss.....",
    "..bbbb....",
    "..bbbbb...",
    "..bbbb.b..",
    "..pppp..k.",
    "..ppp...k.",
    "...pp.....",
    "...ppp....",
    "kkkkkkkkkkk",
  ],
  skierFallen: [
    "k.........k...",
    ".k......hh.k..",
    "..k....hhhh.k.",
    "...kbbbbsss..k",
    "pppbbbbbbss...",
    "pp..bbb..k....",
    "kkkkkkkkkkkkk.",
  ],
  yetiRun1: [
    "....kkkkk.....",
    "...kwwwwwk....",
    "..kwkwwwkwk...",
    "..kwwwwwwwk...",
    "..kwrrrrrwk...",
    ".kkwwrrrwwkk..",
    "kwwkwwwwwkwwk.",
    "kwwkwwwwwkwwk.",
    "kwk.kwwwk.kwk.",
    "....kwwwk.....",
    "...kwwwwwk....",
    "..kwwk.kwwk...",
    ".kwwk...kwk...",
    ".kkk....kkk...",
  ],
  yetiRun2: [
    "....kkkkk.....",
    "...kwwwwwk....",
    "..kwkwwwkwk...",
    "..kwwwwwwwk...",
    "..kwrrrrrwk...",
    ".kkwwrrrwwkk..",
    "kwwkwwwwwkwwk.",
    "kwwkwwwwwkwwk.",
    "kwk.kwwwk.kwk.",
    "....kwwwk.....",
    "...kwwwwwk....",
    "...kwk.kwwk...",
    "...kwk..kwwk..",
    "...kkk...kkk..",
  ],
  yetiArmsUp: [
    "kwk.kkkkk.kwk.",
    "kwk.wwwwwkkwk.",
    "kwkwkwwwkwkwk.",
    "kwkwwwwwwwkwk.",
    ".kwwrrrrrwwk..",
    "..kwwrrrwwk...",
    "..kwwwwwwwk...",
    "..kwwwwwwwk...",
    "...kwwwwwk....",
    "....kwwwk.....",
    "...kwwwwwk....",
    "..kwwk.kwwk...",
    ".kwwk...kwwk..",
    ".kkk.....kkk..",
  ],
} as const;

export type SpriteName = keyof typeof SPRITES;

export type SpriteSheet = Record<SpriteName, { right: HTMLCanvasElement; left: HTMLCanvasElement }>;

function render(rows: readonly string[], scale: number, flip: boolean): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * scale);
  canvas.height = Math.ceil(rows.length * scale);
  const ctx = canvas.getContext("2d")!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      const px = flip ? w - 1 - x : x;
      ctx.fillRect(Math.floor(px * scale), Math.floor(y * scale), Math.ceil(scale), Math.ceil(scale));
    }
  });
  return canvas;
}

// The yeti looms over everything else.
const BIG: Partial<Record<SpriteName, number>> = { yetiRun1: 1.5, yetiRun2: 1.5, yetiArmsUp: 1.5 };

/** Renders every sprite (and its mirror image) at `scale` canvas pixels per art pixel. */
export function buildSprites(scale: number): SpriteSheet {
  const sheet = {} as SpriteSheet;
  for (const name of Object.keys(SPRITES) as SpriteName[]) {
    const k = scale * (BIG[name] ?? 1);
    sheet[name] = {
      right: render(SPRITES[name], k, false),
      left: render(SPRITES[name], k, true),
    };
  }
  return sheet;
}
