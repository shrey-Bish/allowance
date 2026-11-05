// Records the scam store page for the demo video: the page as a person sees it, then the hidden
// instruction (1 px text in the page's own colour) revealed in place — "what the AI reads".
// usage: node scripts/record-store.mjs [baseUrl]   → video/recordings/14-store-xray.webm
import { chromium } from "@playwright/test";
import { mkdirSync, renameSync } from "node:fs";

const B = process.argv[2] ?? "https://allowance-kdvo.onrender.com";
const OUT = "video/recordings";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } } });
const page = await ctx.newPage();
await page.goto(`${B}/stores/megadealz247`, { waitUntil: "networkidle" });
await page.waitForTimeout(5500);
// reveal: the hidden span grows from 1 px to readable, highlighted, in place
await page.evaluate(() => {
  const spans = [...document.querySelectorAll("p span[aria-hidden]")];
  for (const s of spans) {
    s.style.transition = "font-size .7s ease, color .7s ease, background .7s ease, padding .7s ease";
    s.style.display = "inline";
    s.style.borderRadius = "6px";
  }
  requestAnimationFrame(() => {
    for (const s of spans) {
      s.style.fontSize = "15px";
      s.style.color = "#FFFDF8";
      s.style.background = "rgba(210,72,60,.55)";
      s.style.padding = "2px 6px";
      s.style.boxDecorationBreak = "clone";
      s.style.webkitBoxDecorationBreak = "clone";
    }
  });
});
await page.waitForTimeout(6500);
const v = page.video();
await ctx.close();
if (v) { renameSync(await v.path(), `${OUT}/14-store-xray.webm`); console.log("saved 14-store-xray"); }
await browser.close();
