"use client";
import { useEffect, useRef } from "react";
import { COIN, blit } from "./sprites";

/** Coin rain over its parent (parent must be position:relative). */
export function CoinRain() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const W = Math.max(40, Math.round(c.offsetWidth / 3));
    const H = Math.max(40, Math.round(c.offsetHeight / 3));
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const coins = Array.from({ length: 22 }, () => ({ x: Math.random() * (W - 5), d: Math.random() * 1.2, v: 50 + Math.random() * 40 }));
    if (reduce) {
      coins.forEach((k, i) => blit(ctx, COIN, k.x, (i * 7) % H));
      return;
    }
    let raf = 0;
    const start = performance.now();
    const f = (now: number) => {
      const t = ((now - start) / 1000) % 3.6;
      ctx.clearRect(0, 0, W, H);
      coins.forEach((k) => {
        const tt = t - k.d;
        if (tt < 0) return;
        const y = -6 + tt * k.v;
        if (y > H) return;
        blit(ctx, COIN, k.x, y);
      });
      raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", imageRendering: "pixelated", pointerEvents: "none" }} />;
}
