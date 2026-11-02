"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { PAL, flip as flipRows, getSprite } from "./sprites";

export interface SpriteProps {
  name: string;
  /** alternate frame to flip to every `ms` (simple 2-frame animation) */
  alt?: string;
  ms?: number;
  fill?: number;
  flip?: boolean;
  scale?: number;
  label?: string;
  style?: CSSProperties;
}

/** A pixel sprite rendered as crisp SVG rects (used outside the Agent Cam). */
export function Sprite({ name, alt, ms = 450, fill, flip, scale = 4, label, style }: SpriteProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!alt) return;
    const iv = setInterval(() => setTick((v) => v + 1), ms);
    return () => clearInterval(iv);
  }, [alt, ms]);
  const which = alt && tick % 2 ? alt : name;
  let rows = getSprite(which, fill);
  if (flip) rows = flipRows(rows);
  const W = rows[0].length;
  const H = rows.length;
  const els: React.ReactNode[] = [];
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const c = rows[j][i];
      if (c !== ".") els.push(<rect key={`${i}-${j}`} x={i} y={j} width={1} height={1} fill={PAL[c]} />);
    }
  return (
    <svg width={W * scale} height={H * scale} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" role="img" aria-label={label ?? name} style={{ display: "block", ...style }}>
      {els}
    </svg>
  );
}
