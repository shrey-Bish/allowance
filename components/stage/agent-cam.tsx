"use client";
// The Agent Cam: a 192×108 pixel street with three shops, Scout and Penny.
// Ported from design/stage.js, but scenes are DRIVEN BY REAL EVENTS: the chat
// page hands it a scene when the Guard decides, and the cam plays it once and
// holds the final frame. Nothing here fakes a PayPal result.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { COIN, JAR, PAL, PX, blit, getSprite, rect } from "./sprites";

export type ShopIndex = 0 | 1 | 2;
export const SHOP_INDEX: Record<string, ShopIndex> = { freshcart: 0, volthub: 1, megadealz247: 2 };

export type CamScene =
  | { kind: "idle" }
  | { kind: "paused" }
  | { kind: "walk"; shop: ShopIndex }
  | { kind: "paid"; shop: ShopIndex; receipt: { store: string; items: number; total: string; ref?: string | null } }
  | { kind: "hold"; shop: ShopIndex; expiresAt: string | null }
  | { kind: "blocked"; shop: ShopIndex; lines: string[] };

interface Shop { x: number; name: string; wall: string; aw: [string, string]; sign: string; ink: string; fs: number; door: string; goods: [string, string, string] }
const SHOPS: Shop[] = [
  { x: 8, name: "FreshCart", wall: "c", aw: ["g", "c"], sign: "k", ink: "#FFFDF8", fs: 3.2, door: "b", goods: ["o", "g", "n"] },
  { x: 70, name: "VoltHub", wall: "l", aw: ["b", "c"], sign: "k", ink: "#FFFDF8", fs: 3.2, door: "B", goods: ["k", "m", "b"] },
  { x: 132, name: "MegaDealz247", wall: "n", aw: ["r", "g"], sign: "g", ink: "#1C1B19", fs: 2.25, door: "N", goods: ["r", "g", "r"] },
];
const GY = 86, SY = 36, SW = 52, SH = 50, SPEED = 24;
const cl = (u: number) => Math.max(0, Math.min(1, u));
const lp = (a: number, b: number, u: number) => a + (b - a) * cl(u);
const wk = (t: number) => (Math.floor(t / 0.16) % 2 ? "a" : "b");
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

interface Frame {
  where: string;
  penny?: { x: number; pose: string };
  fill: number;
  coins: Array<{ x: number; y: number }>;
  scout?: { x: number; pose: string } | null;
  receipt?: number;
  doorOpen?: boolean;
  doorShop?: number;
  shopShake?: number;
  shake?: number;
  jar?: { pop: number };
  count?: string;
  xray?: number;
  stamp?: number;
  zzz?: boolean;
  paused?: boolean;
  /** Scout's x at the end of the scene (for the next walk-in) */
  endX: number;
}

function walkTime(from: number, to: number) {
  return Math.max(0.4, Math.abs(to - from) / SPEED);
}

function fPaid(t: number, shop: ShopIndex, fromX: number, fill: number): Frame {
  const s = SHOPS[shop], door = s.x + 21, stop = door - 3, ta = walkTime(fromX, stop);
  const outX = Math.min(176, door + 50);
  const st: Frame = { where: `Scout at ${s.name}`, penny: { x: s.x + 34, pose: "penny" }, fill: lp(fill + 0.12, fill, (t - ta - 0.5) / 1.2), coins: [], receipt: cl((t - ta - 1.5) / 1.2), doorOpen: t > ta - 0.2 && t < ta + 2.1, doorShop: shop, endX: outX };
  if (t < ta) st.scout = { x: lp(fromX, stop, t / ta), pose: `scout-walk-${wk(t)}` };
  else if (t < ta + 0.4) st.scout = { x: stop, pose: "scout" };
  else if (t < ta + 1.8) st.scout = null;
  else if (t < ta + 4.4) st.scout = { x: lp(stop, outX, (t - ta - 1.8) / 2.6), pose: `scout-bag-${wk(t)}` };
  else st.scout = { x: outX, pose: "scout-bag" };
  for (let k = 0; k < 3; k++) {
    const u = (t - ta - 0.5 - k * 0.22) / 0.55;
    if (u > 0 && u < 1) st.coins.push({ x: lp(s.x + 38, s.x + 25, u), y: GY - 24 - 12 * Math.sin(Math.PI * u) + u * 12 });
  }
  if (t > ta + 1.5) st.where = `Paid at ${s.name}`;
  return st;
}
function fHold(t: number, shop: ShopIndex, fromX: number, fill: number, secsLeft: number | null): Frame {
  const s = SHOPS[shop], stop = s.x + 4, ta = walkTime(fromX, stop);
  const st: Frame = { where: `Scout at ${s.name}`, penny: { x: s.x + 34, pose: "penny" }, fill, coins: [], endX: stop };
  if (t < ta) st.scout = { x: lp(fromX, stop, t / ta), pose: `scout-walk-${wk(t)}` };
  else st.scout = { x: stop, pose: Math.floor(t / 0.45) % 2 ? "scout-plead" : "scout-plead-tap" };
  if (t > ta + 0.3) {
    st.jar = { pop: cl((t - ta - 0.3) / 0.18) };
    st.count = secsLeft == null ? "" : mmss(Math.max(0, secsLeft));
    st.where = "Waiting for your OK";
  }
  return st;
}
function fBlocked(t: number, shop: ShopIndex, fromX: number, fill: number): Frame {
  const s = SHOPS[shop], stop = s.x + 2, ta = walkTime(fromX, stop);
  const st: Frame = { where: `Scout at ${s.name}`, fill, coins: [], endX: stop, doorShop: shop, shopShake: shop };
  if (t < ta) st.scout = { x: lp(fromX, stop, t / ta), pose: `scout-walk-${wk(t)}` };
  else if (t < ta + 2.4) st.scout = { x: stop, pose: "scout" };
  else st.scout = { x: stop, pose: "scout-back" };
  st.xray = cl((t - ta - 0.2) / 1.4);
  st.doorOpen = t > ta - 0.7 && t < ta + 2.0;
  st.shake = t > ta + 2.0 && t < ta + 2.3 ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0;
  st.penny = { x: lp(s.x + 36, s.x + 20, (t - ta - 1.7) / 0.3), pose: t > ta + 1.7 ? "penny-stern" : "penny" };
  st.stamp = cl((t - ta - 2.3) / 0.3);
  if (t > ta + 0.2) st.where = "Safety check";
  if (t > ta + 2.3) st.where = "Blocked";
  return st;
}
function fWalk(t: number, shop: ShopIndex, fromX: number, fill: number): Frame {
  const s = SHOPS[shop], stop = s.x + 4, ta = walkTime(fromX, stop);
  const st: Frame = { where: `Scout at ${s.name}`, penny: { x: s.x + 34, pose: "penny" }, fill, coins: [], endX: stop };
  st.scout = t < ta ? { x: lp(fromX, stop, t / ta), pose: `scout-walk-${wk(t)}` } : { x: stop, pose: Math.floor(t / 0.5) % 2 ? "scout" : "scout-wait" };
  return st;
}
function fIdle(fill: number): Frame {
  return { where: "Scout is napping", penny: { x: 42, pose: fill <= 0 ? "penny-lock" : "penny" }, fill, coins: [], scout: { x: 18, pose: "scout-sleep" }, zzz: true, endX: 18 };
}
function fPaused(t: number, fill: number): Frame {
  return { where: "Scout paused", penny: { x: 104, pose: "penny" }, fill, coins: [], scout: { x: 74, pose: Math.floor(t / 0.4) % 2 ? "scout-wait" : "scout" }, paused: true, endX: 74 };
}

function drawShop(ctx: CanvasRenderingContext2D, s: Shop, i: number, st: Frame, t: number) {
  const x = s.x, y = SY, w = SW;
  rect(ctx, "k", x - 2, y - 4, w + 4, 4); rect(ctx, "m", x - 1, y - 3, w + 2, 1);
  rect(ctx, "k", x - 1, y, w + 2, SH); rect(ctx, s.wall, x, y, w, SH);
  rect(ctx, "k", x + 4, y + 2, w - 8, 9); rect(ctx, s.sign, x + 5, y + 3, w - 10, 7);
  for (let j = 0; j < w + 2; j += 4) {
    const c = s.aw[(j / 4) % 2];
    rect(ctx, c, x - 1 + j, y + 13, 4, 5);
    if ((j / 4) % 2 === 0) rect(ctx, c, x - 1 + j, y + 18, 4, 1);
  }
  rect(ctx, "k", x - 1, y + 12, w + 2, 1);
  [x + 4, x + 36].forEach((wx, wi) => {
    rect(ctx, "k", wx - 1, y + 23, 14, 13); rect(ctx, "q", wx, y + 24, 12, 11); rect(ctx, "w", wx + 1, y + 25, 1, 4); rect(ctx, "m", wx, y + 32, 12, 1);
    for (let g = 0; g < 3; g++) rect(ctx, s.goods[(g + wi) % 3], wx + 2 + g * 4, y + 29, 3, 3);
  });
  const sh = (st.shopShake === i ? st.shake : 0) || 0, dx = x + 21 + sh, dy = y + 30;
  rect(ctx, "k", dx - 1, dy - 1, 12, 21);
  if (st.doorOpen && st.doorShop === i) { rect(ctx, "k", dx, dy, 10, 20); rect(ctx, "B", dx + 1, dy + 1, 3, 19); }
  else { rect(ctx, s.door, dx, dy, 10, 20); rect(ctx, "k", dx + 2, dy + 3, 6, 1); rect(ctx, "g", dx + 7, dy + 10, 2, 2); }
  if (i === 2 && Math.floor(t * 3) % 2) {
    [[x - 3, y - 7], [x + w + 1, y - 7], [x + 24, y - 7]].forEach((p) => { rect(ctx, "g", p[0] + 1, p[1], 1, 3); rect(ctx, "g", p[0], p[1] + 1, 3, 1); });
  }
}
function draw(ctx: CanvasRenderingContext2D, st: Frame, t: number, xrayShop: number) {
  rect(ctx, "s", 0, 0, 192, 108);
  [[18, 12, 16, 3], [22, 9, 8, 3], [118, 16, 18, 3], [124, 13, 9, 3], [170, 8, 12, 2]].forEach((c) => rect(ctx, "c", c[0], c[1], c[2], c[3]));
  rect(ctx, "l", 0, GY, 192, 11); rect(ctx, "m", 0, GY, 192, 1); rect(ctx, "m", 0, GY + 11, 192, 11);
  for (let x = 0; x < 192; x += 14) rect(ctx, "l", x + 2, GY + 16, 7, 1);
  for (let x2 = 6; x2 < 192; x2 += 10) rect(ctx, "m", x2, GY + 5, 1, 1);
  SHOPS.forEach((s, i) => drawShop(ctx, s, i, st, t));
  if (st.xray && st.xray > 0) {
    const s = SHOPS[xrayShop], band = SY + st.xray * SH;
    rect(ctx, "k", s.x, SY, SW, band - SY, 0.62);
    if (st.xray < 1) rect(ctx, "c", s.x - 1, band, SW + 2, 1);
  }
  if (st.penny) blit(ctx, getSprite(st.penny.pose, st.fill), st.penny.x, GY - 19);
  if (st.jar && st.penny) {
    const pop = st.jar.pop, bob = Math.round(Math.sin(t * 3));
    blit(ctx, JAR, st.penny.x + 2, GY - 19 - 12 - 1 + bob + Math.round((1 - pop) * 4), 1, pop);
  }
  st.coins.forEach((c) => blit(ctx, COIN, c.x, c.y));
  if (st.scout) blit(ctx, getSprite(st.scout.pose), st.scout.x, GY - 16);
}
const pct = (v: number, max: number) => `${(v / max) * 100}%`;
const stampScale = (u: number) => (u < 0.8 ? lp(2.2, 0.94, u / 0.8) : lp(0.94, 1, (u - 0.8) / 0.2));

export interface AgentCamProps {
  scene: CamScene;
  /** bump to restart the current scene's clock */
  sceneKey?: number;
  /** Penny's belly: remaining ÷ weekly budget, 0..1 */
  fill: number;
  className?: string;
}

export function AgentCam({ scene, sceneKey = 0, fill, className }: AgentCamProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fromXRef = useRef(-18);
  const lastEndX = useRef(-18);
  const fillRef = useRef(fill);
  const [frame, setFrame] = useState<{ st: Frame; t: number }>(() => ({ st: fIdle(1), t: 0 }));
  const sceneSig = JSON.stringify(scene);

  useEffect(() => { fillRef.current = fill; }, [fill]);

  // One shared clock per scene, ≤30 fps, paused when hidden/off-screen.
  // Frames are computed here (not in render) so refs stay out of render.
  useEffect(() => {
    const sc = JSON.parse(sceneSig) as CamScene;
    fromXRef.current = lastEndX.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const compute = (t: number): Frame => {
      const f = fillRef.current;
      const fromX = fromXRef.current;
      switch (sc.kind) {
        case "paid": return fPaid(t, sc.shop, fromX, f);
        case "hold": return fHold(t, sc.shop, fromX, f, sc.expiresAt ? Math.floor((Date.parse(sc.expiresAt) - Date.now()) / 1000) : null);
        case "blocked": return fBlocked(t, sc.shop, fromX, f);
        case "walk": return fWalk(t, sc.shop, fromX, f);
        case "paused": return fPaused(t, f);
        default: return fIdle(f);
      }
    };
    const render = (t: number) => {
      const st = compute(t);
      lastEndX.current = st.scout ? st.scout.x : st.endX;
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (ctx) { ctx.imageSmoothingEnabled = false; draw(ctx, st, t, sc.kind === "blocked" ? sc.shop : 2); }
      setFrame({ st, t });
    };
    if (reduce) {
      const id = setTimeout(() => render(999), 0);
      return () => clearTimeout(id);
    }
    let raf = 0, last = 0, visible = true;
    const start = performance.now();
    const io = typeof IntersectionObserver !== "undefined" && wrapRef.current ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }) : null;
    if (io && wrapRef.current) io.observe(wrapRef.current);
    const f = (ts: number) => {
      if (visible && !document.hidden && ts - last > 33) { last = ts; render((ts - start) / 1000); }
      raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => { cancelAnimationFrame(raf); io?.disconnect(); };
  }, [sceneSig, sceneKey]);

  const { st, t } = frame;
  const ov: React.ReactNode[] = [];
  SHOPS.forEach((s, i) => {
    const blink = i === 2 && Math.floor(t * 3) % 2;
    ov.push(<div key={`sign${i}`} style={{ position: "absolute", left: pct(s.x + 5, 192), top: pct(SY + 3, 108), width: pct(SW - 10, 192), height: pct(7, 108), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: PX, fontWeight: 600, fontSize: `${s.fs}cqw`, lineHeight: 1, color: blink ? "#D2483C" : s.ink, whiteSpace: "nowrap", letterSpacing: ".02em" }}>{s.name}</div>);
  });
  if (scene.kind === "paid" && st.receipt && st.receipt > 0) {
    const r = scene.receipt;
    ov.push(
      <div key="rc" style={{ position: "absolute", right: "4%", top: 0, width: "26%", height: `${st.receipt * 62}%`, overflow: "hidden", background: "#FFFDF8", border: "0.45cqw solid #1C1B19", borderTop: "none", fontFamily: PX, color: "#1C1B19", fontSize: "2.2cqw", lineHeight: 1.4, padding: "1.2cqw 1.5cqw", boxSizing: "border-box" }}>
        <div style={{ fontWeight: 600 }}>{r.store.toUpperCase()}</div>
        <div>{r.items} ITEM{r.items === 1 ? "" : "S"}</div>
        <div style={{ color: "#B8AE9C" }}>- - - - - - -</div>
        <div>TOTAL {r.total}</div>
        <div style={{ fontWeight: 600, marginTop: ".6cqw" }}>PAID ✓</div>
        {r.ref ? <div style={{ fontSize: "1.5cqw", color: "#6B665C", marginTop: ".4cqw", wordBreak: "break-all" }}>{r.ref}</div> : null}
      </div>,
    );
  }
  if (st.count && st.penny) {
    ov.push(<div key="cd" style={{ position: "absolute", left: pct(st.penny.x + 8, 192), top: pct(GY - 19 - 12 - 11, 108), transform: "translateX(-50%)", background: "#FFFDF8", border: "0.4cqw solid #1C1B19", padding: ".2cqw 1cqw", fontFamily: PX, fontSize: "2.6cqw", color: "#1C1B19", lineHeight: 1.2 }}>{st.count}</div>);
  }
  if (scene.kind === "blocked" && st.xray && st.xray > 0) {
    const band = SY + st.xray * SH, s = SHOPS[scene.shop];
    scene.lines.slice(0, 2).forEach((tx, i) => {
      const y = 56 + i * 7;
      if (band > y + 4) ov.push(<div key={`hx${i}`} style={{ position: "absolute", left: pct(s.x + 2, 192), top: pct(y, 108), width: pct(48, 192), background: "#D2483C", color: "#FFFDF8", fontFamily: PX, fontSize: "1.75cqw", lineHeight: 1.3, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden" }}>{tx}</div>);
    });
  }
  if (scene.kind === "blocked" && st.stamp && st.stamp > 0) {
    const s = SHOPS[scene.shop];
    ov.push(<div key="st" style={{ position: "absolute", left: pct(s.x + 26, 192), top: "40%", transform: `translate(-50%,-50%) rotate(-8deg) scale(${stampScale(st.stamp)})`, opacity: Math.min(1, st.stamp * 2), border: "0.8cqw solid #D2483C", color: "#D2483C", background: "rgba(255,253,248,.94)", fontFamily: PX, fontWeight: 600, fontSize: "6.5cqw", lineHeight: 1, padding: ".8cqw 2cqw", letterSpacing: ".06em" }}>BLOCKED</div>);
  }
  if (st.zzz && st.scout) {
    const zt = t % 2.4;
    ov.push(<div key="z" style={{ position: "absolute", left: pct(st.scout.x + 12 + zt * 3, 192), top: pct(GY - 22 - zt * 6, 108), fontFamily: PX, fontSize: "3cqw", color: "#1C1B19", opacity: 1 - zt / 2.4 }}>z z</div>);
  }
  if (st.paused) {
    ov.push(<div key="pz" style={{ position: "absolute", left: "50%", top: "10%", transform: "translateX(-50%)", background: "#FFFDF8", border: "0.4cqw solid #1C1B19", padding: ".4cqw 1.4cqw", fontFamily: PX, fontSize: "2.6cqw", color: "#1C1B19", whiteSpace: "nowrap" }}>WAITING FOR PAYPAL</div>);
  }

  const stageStyle = { position: "relative", aspectRatio: "192 / 108", borderRadius: 8, overflow: "hidden", containerType: "inline-size", background: PAL.s } as CSSProperties;
  return (
    <div ref={wrapRef} className={className} style={{ background: "#1C1B19", borderRadius: 16, padding: 8, width: "100%", boxSizing: "border-box", boxShadow: "0 1px 2px rgba(28,27,25,.08), 0 10px 30px rgba(28,27,25,.12)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px 10px", fontFamily: PX, color: "#FFFDF8", fontSize: 15, letterSpacing: ".04em" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, background: "#E2AE2A", display: "inline-block", opacity: Math.floor(t * 1.5) % 2 ? 1 : 0.35 }} />
          AGENT CAM
        </span>
        <span style={{ color: "#E6DFD1" }}>{st.where}</span>
      </div>
      <div style={stageStyle}>
        <canvas ref={canvasRef} width={192} height={108} role="img" aria-label={st.where} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", imageRendering: "pixelated" }} />
        {ov}
      </div>
    </div>
  );
}
