// Small shell primitives matching the Claude Design screens (design/NOTES.md).
import Link from "next/link";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type PillKind = "paid" | "hold" | "blocked" | "released" | "failed";
const PILL: Record<PillKind, { bg: string; fg: string; dot: string; label: string }> = {
  paid: { bg: "#E3F1E8", fg: "#1D6640", dot: "#2F8F5B", label: "Paid" },
  hold: { bg: "#FCEADA", fg: "#8A420A", dot: "#E5771E", label: "Needs your OK" },
  blocked: { bg: "#F9E2DF", fg: "#9E2F28", dot: "#D2483C", label: "Blocked" },
  released: { bg: "#EDE6D8", fg: "#1C1B19", dot: "#6B665C", label: "Not bought" },
  failed: { bg: "#EDE6D8", fg: "#1C1B19", dot: "#6B665C", label: "Didn't go through" },
};
export function Pill({ kind, label }: { kind: PillKind; label?: string }) {
  const p = PILL[kind];
  return (
    <span className="inline-flex items-center gap-[7px] rounded-full px-[11px] py-1 text-[14px] font-semibold" style={{ background: p.bg, color: p.fg }}>
      <span className="h-2 w-2 rounded-full" style={{ background: p.dot }} />
      {label ?? p.label}
    </span>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "gold" | "outline" | "ink"; size?: "md" | "lg"; children: ReactNode };
export function Button({ variant = "gold", size = "md", className = "", children, ...rest }: BtnProps) {
  const base = "inline-flex items-center justify-center rounded-full font-semibold cursor-pointer transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-ink focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[.98]";
  const sz = size === "lg" ? "h-[52px] px-6 text-[17px]" : "h-11 px-[22px] text-[16px]";
  const v =
    variant === "gold" ? "bg-gold text-ink hover:bg-[#C8930F]"
    : variant === "ink" ? "bg-ink text-card hover:bg-[#33312D]"
    : "border border-ink bg-transparent text-ink hover:bg-paper";
  return (
    <button className={`${base} ${sz} ${v} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <article className={`rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(28,27,25,.04)] ${className}`} style={style}>{children}</article>;
}

export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono font-semibold ${className}`}>{children}</span>;
}

export function LinkButton({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`inline-flex h-12 items-center justify-center rounded-full bg-gold px-6 text-[16px] font-semibold text-ink hover:bg-[#C8930F] focus-visible:outline-3 focus-visible:outline-ink focus-visible:outline-offset-2 ${className}`}>
      {children}
    </Link>
  );
}

export function mmss(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function clockTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
