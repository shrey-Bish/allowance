"use client";
import { useEffect, useRef } from "react";

type Pt = [number, number];
function tri(u: number, v: number, a: Pt, b: Pt, c: Pt) {
  const s = (p1: Pt, p2: Pt, p3: Pt) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const P: Pt = [u, v];
  const d1 = s(P, a, b), d2 = s(P, b, c), d3 = s(P, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
/** Density field for "a piggy bank under a glass dome". */
function dDome(u: number, v: number) {
  let d = 0;
  const sx = (u - 0.5) / 0.44, sy = (v - 0.915) / 0.025;
  if (sx * sx + sy * sy < 1) d = 0.28 * (1 - sx * sx - sy * sy);
  if (v > 0.8 && v < 0.845 && u > 0.15 && u < 0.85) d = 0.35 + (u - 0.15) * 0.5;
  if (v >= 0.845 && v < 0.885 && u > 0.11 && u < 0.89) d = Math.max(d, 0.82);
  if (v > 0.72 && v < 0.8 && ((u > 0.4 && u < 0.45) || (u > 0.59 && u < 0.64))) d = Math.max(d, 0.78);
  if (tri(u, v, [0.44, 0.52], [0.47, 0.44], [0.52, 0.51]) || tri(u, v, [0.55, 0.51], [0.6, 0.44], [0.63, 0.53])) d = Math.max(d, 0.72);
  const px = (u - 0.52) / 0.21, py = (v - 0.635) / 0.135, r2 = px * px + py * py;
  if (r2 < 1) {
    const nz = Math.sqrt(1 - r2), lit = -0.55 * px - 0.6 * py + 0.58 * nz;
    d = Math.max(d, Math.min(0.9, Math.max(0.05, 0.72 - 0.78 * lit)));
  }
  const rr = Math.sqrt(r2);
  if (rr > 0.96 && rr < 1.05) d = Math.max(d, 0.85);
  const nx = (u - 0.325) / 0.045, ny = (v - 0.63) / 0.055, n2 = nx * nx + ny * ny;
  if (n2 < 1) d = n2 > 0.55 ? 0.9 : 0.3;
  if (Math.pow((u - 0.315) / 0.012, 2) + Math.pow((v - 0.63) / 0.02, 2) < 1 || Math.pow((u - 0.338) / 0.012, 2) + Math.pow((v - 0.63) / 0.02, 2) < 1) d = 1;
  if ((u - 0.41) * (u - 0.41) + (v - 0.58) * (v - 0.58) < 0.00018) d = 1;
  if (v > 0.502 && v < 0.52 && u > 0.49 && u < 0.58) d = 1;
  const tx = u - 0.755, ty = v - 0.6, tr = Math.sqrt(tx * tx + ty * ty);
  if (Math.abs(tr - 0.022) < 0.007 && tx > -0.01) d = Math.max(d, 0.8);
  const dx = u - 0.5, dy = v - 0.46, dr = Math.sqrt(dx * dx + dy * dy);
  if (v < 0.46 && Math.abs(dr - 0.335) < 0.011) d = Math.max(d, 0.8);
  if (v >= 0.46 && v < 0.8 && (Math.abs(u - 0.165) < 0.011 || Math.abs(u - 0.835) < 0.011)) d = Math.max(d, 0.8);
  if (dx < -0.06 && dy < 0.12 && Math.abs(dr - 0.29) < 0.012 && dy > -0.3) d = Math.max(d, 0.3);
  if (dx * dx + (v - 0.11) * (v - 0.11) < 0.0006) d = Math.max(d, 0.9);
  return d;
}
/** Density field for "a single coin". */
function dCoin(u: number, v: number) {
  let d = 0;
  const sx = (u - 0.53) / 0.3, sy = (v - 0.87) / 0.03;
  if (sx * sx + sy * sy < 1) d = 0.3 * (1 - sx * sx - sy * sy);
  const ex = (u - 0.54) / 0.27, ey = (v - 0.48) / 0.34, e2 = ex * ex + ey * ey;
  const fx = (u - 0.5) / 0.27, fy = (v - 0.48) / 0.34, f2 = fx * fx + fy * fy;
  if (e2 < 1 && f2 >= 1) d = Math.max(d, 0.88);
  if (f2 < 1) {
    const r = Math.sqrt(f2), lit = -0.6 * fx - 0.5 * fy;
    d = Math.max(d, r > 0.86 ? 0.7 - 0.3 * lit : 0.28 - 0.22 * lit);
    if (Math.abs(r - 0.7) < 0.035) d = Math.max(d, 0.75);
    if (Math.abs(fx) + Math.abs(fy) * 0.8 < 0.24) d = Math.max(d, 0.55 + 0.35 * (fx + fy));
  }
  return Math.max(0, Math.min(1, d));
}

export interface HalftoneProps {
  motif?: "dome" | "coin";
  size?: number;
  spacing?: number;
  label?: string;
  className?: string;
}

/** Halftone/engraving-style illustration, drawn as rotated dot grid on canvas. */
export function Halftone({ motif = "dome", size = 220, spacing = 5, label, className }: HalftoneProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#1C1B19";
    const f = motif === "coin" ? dCoin : dDome;
    const ca = Math.SQRT1_2, sa = Math.SQRT1_2;
    for (let i = -size; i < size; i += spacing)
      for (let j = -size; j < size; j += spacing) {
        const x = size / 2 + i * ca - j * sa;
        const y = size / 2 + i * sa + j * ca;
        if (x < 0 || y < 0 || x > size || y > size) continue;
        const d = f(x / size, y / size);
        if (d < 0.04) continue;
        ctx.beginPath();
        ctx.arc(x, y, spacing * 0.6 * Math.sqrt(d), 0, 6.2832);
        ctx.fill();
      }
  }, [size, motif, spacing]);
  return <canvas ref={ref} role="img" aria-label={label ?? (motif === "coin" ? "A single coin" : "A piggy bank under a glass dome")} className={className} style={{ width: size, height: size, display: "block" }} />;
}
