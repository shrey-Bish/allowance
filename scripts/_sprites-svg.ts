import { writeFileSync, mkdirSync } from "node:fs";
import { PAL, getSprite } from "../components/stage/sprites";
const OUT = "/Users/shrey/Downloads/paypalai/video/allowance-demo/assets/img";
mkdirSync(OUT, { recursive: true });
const want: Array<[string, string, number | undefined]> = [["scout", "scout", undefined], ["scout-walk-a", "scout-walk-a", undefined], ["scout-bag", "scout-bag", undefined], ["scout-plead", "scout-plead", undefined], ["scout-back", "scout-back", undefined], ["scout-eyes", "scout-eyes", undefined], ["penny", "penny", 0.7], ["penny-full", "penny", 1], ["penny-stern", "penny-stern", 0.55], ["penny-lock", "penny-lock", 0], ["jar", "jar", undefined], ["coin", "coin", undefined]];
for (const [file, name, fill] of want) {
  const rows = getSprite(name, fill); const W = rows[0].length, H = rows.length;
  let r = "";
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const c = rows[j][i]; if (c !== ".") r += `<rect x="${i}" y="${j}" width="1" height="1" fill="${PAL[c]}"/>`; }
  writeFileSync(`${OUT}/${file}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${r}</svg>`);
}
console.log("sprites:", want.length);
