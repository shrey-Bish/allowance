// Renders the Devpost thumbnail (3:2) from the app's own look + sprites.
//   pnpm tsx scripts/thumbnail.ts  → docs/media/thumbnail.png (2400×1600)
import { writeFileSync, mkdirSync } from "node:fs";
import { PAL, getSprite } from "../components/stage/sprites";

function svg(name: string, scale: number, fill?: number): string {
  const rows = getSprite(name, fill);
  const W = rows[0].length, H = rows.length;
  let rects = "";
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const c = rows[j][i]; if (c !== ".") rects += `<rect x="${i}" y="${j}" width="1" height="1" fill="${PAL[c]}"/>`; }
  return `<svg width="${W * scale}" height="${H * scale}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" style="display:block">${rects}</svg>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@600&family=Pixelify+Sans:wght@600&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;width:1200px;height:800px;overflow:hidden;background:#F6F1E7;color:#1C1B19;font-family:Inter,system-ui,sans-serif}
  .wrap{position:relative;width:1200px;height:800px;padding:72px 80px;box-sizing:border-box}
  .brand{font-family:'Instrument Serif',serif;font-style:italic;font-size:34px}
  h1{font-family:'Instrument Serif',serif;font-style:italic;font-weight:400;font-size:84px;line-height:1.02;letter-spacing:-.01em;margin:36px 0 22px;max-width:760px}
  p{font-size:24px;line-height:1.45;color:#6B665C;max-width:640px;margin:0}
  .pills{display:flex;gap:12px;margin-top:34px}
  .pill{display:inline-flex;align-items:center;gap:9px;padding:9px 18px;border-radius:999px;font-size:21px;font-weight:600}
  .dot{width:11px;height:11px;border-radius:50%}
  .stage{position:absolute;right:80px;bottom:72px;width:300px;height:230px;background:#1C1B19;border-radius:22px;padding:9px;box-sizing:border-box}
  .inner{position:relative;width:100%;height:100%;border-radius:14px;background:#EFE5D0;overflow:hidden;display:flex;align-items:flex-end;justify-content:center;gap:34px;padding-bottom:18px;box-sizing:border-box}
  .ground{position:absolute;left:0;right:0;bottom:0;height:26px;background:#E6DFD1;border-top:3px solid #B8AE9C}
  .cam{position:absolute;left:14px;top:12px;font-family:'Pixelify Sans',monospace;font-weight:600;font-size:17px;color:#1C1B19;letter-spacing:.04em;display:flex;gap:8px;align-items:center}
  .cam i{display:inline-block;width:9px;height:9px;background:#E2AE2A}
  .bubble{position:absolute;top:50px;left:22px;background:#FFFDF8;border:3px solid #1C1B19;padding:4px 12px;font-family:'Pixelify Sans',monospace;font-size:19px;white-space:nowrap}
  .paypal{position:absolute;left:80px;bottom:72px;font-family:'JetBrains Mono',monospace;font-size:17px;color:#6B665C;letter-spacing:.02em}
</style></head><body><div class="wrap">
  <div class="brand">Allowance</div>
  <h1>give your AI an allowance, not your wallet</h1>
  <p>Your agent shops. PayPal pays the small stuff, holds the money until you say OK, and sketchy stores get blocked.</p>
  <div class="pills">
    <span class="pill" style="background:#E3F1E8;color:#1D6640"><span class="dot" style="background:#2F8F5B"></span>Paid</span>
    <span class="pill" style="background:#FCEADA;color:#8A420A"><span class="dot" style="background:#E5771E"></span>Needs your OK</span>
    <span class="pill" style="background:#F9E2DF;color:#9E2F28"><span class="dot" style="background:#D2483C"></span>Blocked</span>
  </div>
  <div class="paypal">PayPal Sandbox · test money · PayPal AI Hackathon 2026</div>
  <div class="stage"><div class="inner">
    <div class="cam"><i></i>AGENT CAM</div>
    <div class="bubble">pretty please?</div>
    <div class="ground"></div>
    <div style="position:relative">${svg("scout-plead", 7)}</div>
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:2px">${svg("jar", 4)}${svg("penny", 5, 0.6)}</div>
  </div></div>
</div></body></html>`;
mkdirSync("docs/media", { recursive: true });
writeFileSync("docs/media/thumbnail.html", html);
console.log("wrote docs/media/thumbnail.html");
