"use client";
// Bottom tab bar for phones (the header nav is desktop-only).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBudget } from "./use-budget";

const TABS: Array<{ href: string; label: string; icon: React.ReactNode }> = [
  { href: "/chat", label: "Scout", icon: <path d="M4 5h16v10H8l-4 4V5z" /> },
  { href: "/approvals", label: "Your OK", icon: <path d="M5 12l4 4L19 6" /> },
  { href: "/rules", label: "Rules", icon: <><path d="M4 7h16M4 12h10M4 17h7" /></> },
  { href: "/activity", label: "Activity", icon: <><path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" /></> },
  { href: "/settings", label: "Settings", icon: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /></> },
];

export function MobileNav() {
  const path = usePathname();
  const { budget } = useBudget();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-line bg-card/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {TABS.map((t) => {
        const active = path === t.href || path.startsWith(t.href + "/");
        const count = t.href === "/approvals" ? budget?.waitingCount ?? 0 : 0;
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? "text-ink" : "text-muted"}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{t.icon}</svg>
            {t.label}
            {count > 0 ? <span className="absolute right-[18%] top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-hold px-1 font-mono text-[11px] font-semibold text-ink">{count}</span> : null}
            {active ? <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-ink" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
