// Pixel stage data — ported 1:1 from design/stage.js (Claude Design, 2026-11-02).
// Every sprite is a string grid; letters index PAL. '.' is transparent.

export const PAL: Record<string, string> = {
  k: "#1C1B19", c: "#FFFDF8", p: "#F6F1E7", l: "#E6DFD1", m: "#B8AE9C", o: "#D0702C", O: "#A5521C", w: "#FFF4E2",
  g: "#E2AE2A", G: "#A97B0F", n: "#F2ADA7", N: "#D27E79", b: "#4C6A66", B: "#2F4542", r: "#D2483C", s: "#EFE5D0", q: "#E4ECE6",
};
export const PX = "var(--font-pixel), 'Pixelify Sans', monospace";

const SCOUT = [
  "................",
  ".kk......kk.....",
  ".kok....kok.....",
  ".kookkkkook.....",
  ".kooooooook.....",
  ".kokooookok.....",
  ".kwwoooowwk.....",
  "..kwwkkwwk......",
  "...kwwwwk.......",
  ".kbkoowok..kk...",
  "kbbkowwok.kook..",
  "kbbkowwokkoook..",
  "kbbkoooooooowk..",
  ".kkkoooooookkk..",
  "...kok..kok.....",
  "...kk...kk......",
];
const PENNY = [
  "..kk........kk..",
  ".knnk......knnk.",
  ".knnkkkkkkkknnk.",
  "knnnnnnkknnnnnnk",
  "knnnnnnnnnnnnnnk",
  "knnknnnnnnnnknnk",
  "knnnnNNNNNNnnnnk",
  "knnnnNkNNkNnnnnk",
  "knnnnNNNNNNnnnnk",
  "knnnnnnnnnnnnnnk",
  "kggnkkkkkkkknnnk",
  "kGGnkzzzzzzknnnk",
  "knnnkzzzzzzknnnk",
  "knnnkzzzzzzknnnk",
  "knnnkzzzzzzknnnk",
  "knnnkkkkkkkknnnk",
  ".knnnnnnnnnnnnk.",
  "..kNNk....kNNk..",
  "..kkkk....kkkk..",
];
export const COIN = [".kkk.", "kgggk", "kgGgk", "kgggk", ".kkk."];
const PHONES = [".kkkkk.", "k.....k", "k.....k", "kgk.kgk", "kgk.kgk", "kkk.kkk"];
const BAG = [".kkk.", ".k.k.", "kgggk", "kgggk", "kkkkk"];
const PACK = ["kkkkkk", "kbbbbk", "kbggbk", "kbbbbk", "kkkkkk"];
export const JAR = [".kkkkkkkkkk.", ".kmmmmmmmmk.", "..kkkkkkkk..", ".kqqqqqqqqk.", "kqwqqqqqqqqk", "kqwqqqqqqqqk", "kqqqqggqqqqk", "kqqqgGGgqqqk", "kqggqggqggqk", "kgGGgGGgGGgk", ".kkkkkkkkkk."];

type Rows = string[];
function setR(rows: Rows, m: Record<number, string>): Rows {
  const r = rows.slice();
  for (const k in m) r[+k] = m[k];
  return r;
}
function over(rows: Rows, spr: Rows, x: number, y: number): Rows {
  const r = rows.map((s) => s.split(""));
  spr.forEach((line, j) => {
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c !== "." && r[y + j] && x + i < r[y + j].length) r[y + j][x + i] = c;
    }
  });
  return r.map((a) => a.join(""));
}
export function flip(rows: Rows): Rows {
  return rows.map((s) => s.split("").reverse().join(""));
}
/** Penny's belly is the budget meter: fill 0..1 of the 24 belly cells. */
export function belly(rows: Rows, f: number): Rows {
  if (!Number.isFinite(f)) f = 0.7;
  const n = Math.round(Math.max(0, Math.min(1, f)) * 24);
  let idx = 0;
  const r = rows.map((s) => s.split(""));
  for (let y = 14; y >= 11; y--)
    for (let x = 5; x <= 10; x++) {
      r[y][x] = idx < n ? ((x + y) % 3 === 0 ? "G" : "g") : "w";
      idx++;
    }
  return r.map((a) => a.join(""));
}
const WA = { 14: "..kok....kok....", 15: "..kk......kk...." };
const WB = { 14: "....kok.kok.....", 15: "....kk..kk......" };
const PLEAD = { 4: ".kowoooowok....." };
const TAP = { 15: "...kk....kk....." };
const BACKH = { 4: ".kooooooook.....", 5: ".kooooooook.....", 6: ".kooooooook.....", 7: "..kooooook......", 8: "...kkkkkk......." };

export const SPRITES: Record<string, Rows> = {
  scout: SCOUT,
  "scout-walk-a": setR(SCOUT, WA),
  "scout-walk-b": setR(SCOUT, WB),
  "scout-bag": over(SCOUT, BAG, 10, 10),
  "scout-bag-a": over(setR(SCOUT, WA), BAG, 10, 10),
  "scout-bag-b": over(setR(SCOUT, WB), BAG, 10, 10),
  "scout-back": flip(over(setR(SCOUT, BACKH), PACK, 2, 9)),
  "scout-plead": over(setR(SCOUT, PLEAD), PHONES, 3, 9),
  "scout-plead-tap": over(setR(SCOUT, { ...PLEAD, ...TAP }), PHONES, 3, 9),
  "scout-sleep": setR(SCOUT, { 5: ".kOOooooOOk....." }),
  "scout-wait": setR(SCOUT, TAP),
  "scout-shrug": over(over(setR(SCOUT, { 5: ".kOkooookOk....." }), ["ko", "kk"], 0, 6), ["ok", "kk"], 10, 6),
  "scout-eyes": over(SCOUT, [".kkkk.kkkk.", "kooookooook", ".kkkk.kkkk."], 0, 4),
  penny: PENNY,
  "penny-stern": setR(PENNY, { 4: "knkknnnnnnnnkknk" }),
  "penny-lock": over(PENNY, [".kkk.", "k...k", "kkkkk", "kkgkk", "kkkkk"], 5, 10),
  coin: COIN,
  jar: JAR,
  bag: BAG,
  phones: PHONES,
};
export type SpriteName = keyof typeof SPRITES;

export function getSprite(name: string, fill?: number): Rows {
  let r = SPRITES[name] ?? SCOUT;
  if (name.startsWith("penny")) r = belly(r, fill == null ? 0.7 : fill);
  return r;
}

export function blit(ctx: CanvasRenderingContext2D, rows: Rows, x: number, y: number, s = 1, a?: number) {
  x = Math.round(x);
  y = Math.round(y);
  if (a != null) ctx.globalAlpha = a;
  for (let j = 0; j < rows.length; j++) {
    const line = rows[j];
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === ".") continue;
      ctx.fillStyle = PAL[c];
      ctx.fillRect(x + i * s, y + j * s, s, s);
    }
  }
  ctx.globalAlpha = 1;
}
export function rect(ctx: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number, a?: number) {
  ctx.fillStyle = PAL[c] ?? c;
  if (a != null) ctx.globalAlpha = a;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
  ctx.globalAlpha = 1;
}
