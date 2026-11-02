import Link from "next/link";

const NAV = [
  ["/", "Welcome"],
  ["/connect", "Link PayPal"],
  ["/rules", "Your rules"],
  ["/chat", "Shop with Scout"],
  ["/approvals", "Needs your OK"],
  ["/activity", "Activity"],
  ["/settings", "Settings"],
] as const;

/** Temporary shell until the Claude Design screens land (Phase 3). */
export function Placeholder({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <nav className="mb-10 flex flex-wrap gap-2 text-sm">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full border border-line bg-card px-4 py-1.5 hover:border-gold">
            {label}
          </Link>
        ))}
      </nav>
      <h1 className="font-display text-5xl italic">{title}</h1>
      <p className="mt-2 text-muted">screen coming in phase 3 — the API behind it already works.</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}
