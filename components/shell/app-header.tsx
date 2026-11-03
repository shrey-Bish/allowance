"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrefs } from "./prefs";
import { useBudget } from "./use-budget";
import { formatUsd } from "@/lib/money";

const NAV: Array<[string, string]> = [
  ["/chat", "Shop with Scout"],
  ["/approvals", "Needs your OK"],
  ["/rules", "Your rules"],
  ["/activity", "Activity"],
  ["/settings", "Settings"],
];

export function AppHeader() {
  const path = usePathname();
  const { plain, sound, setPlain, setSound, record } = usePrefs();
  const { budget } = useBudget();
  const isShop = path === "/chat";
  const spent = budget ? formatUsd(budget.spentThisWeekCents) : "—";
  const total = budget ? formatUsd(budget.weeklyBudgetCents).replace(/\.00$/, "") : "$150";
  const pctSpent = budget && budget.weeklyBudgetCents > 0 ? Math.min(100, (budget.spentThisWeekCents / budget.weeklyBudgetCents) * 100) : 0;

  return (
    <header className="flex h-[64px] flex-none items-center gap-5 border-b border-line px-5 md:h-[72px] md:gap-8 md:px-7">
      <Link href="/chat" className="font-display text-[26px] italic leading-none md:text-[30px]">Allowance</Link>
      <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
        {NAV.map(([href, label]) => {
          const active = path === href || (href !== "/" && path.startsWith(href + "/"));
          const count = href === "/approvals" ? budget?.waitingCount ?? 0 : 0;
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={`flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[16px] font-medium transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 ${active ? "bg-ink text-card focus-visible:outline-gold" : "text-ink hover:bg-[#EDE6D8] focus-visible:outline-ink"}`}>
              {label}
              {count > 0 ? <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-hold px-1.5 font-mono text-[13px] font-semibold text-ink">{count}</span> : null}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-3 md:gap-5">
        <div className="text-[14px] text-muted md:hidden"><span className="font-mono font-semibold text-ink">{spent}</span> of {total} this week</div>
        <div className="hidden flex-col items-end gap-[7px] md:flex">
          <div className="whitespace-nowrap text-[15px]"><span className="font-mono font-semibold">{spent}</span> of <span className="font-mono font-semibold">{total}</span> spent this week</div>
          <div className="h-2 w-[220px] overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-gold transition-[width] duration-300" style={{ width: `${pctSpent}%` }} /></div>
        </div>
        {isShop && !record ? (
          <button type="button" role="switch" aria-checked={plain} onClick={() => setPlain(!plain)}
            className="hidden h-10 cursor-pointer items-center gap-[10px] whitespace-nowrap rounded-full border border-line bg-card py-0 pl-[10px] pr-4 text-[15px] font-medium hover:border-[#B8AE9C] focus-visible:outline-3 focus-visible:outline-ink focus-visible:outline-offset-2 md:flex">
            <span className="relative block h-5 w-[34px] rounded-full transition-colors" style={{ background: plain ? "#1C1B19" : "#D8D0BF" }}>
              <span className="absolute top-[2px] h-4 w-4 rounded-full bg-card shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left] duration-200 ease-out" style={{ left: plain ? 16 : 2 }} />
            </span>
            Plain view
          </button>
        ) : null}
        {!record ? <SoundToggle sound={sound} onToggle={() => setSound(!sound)} className="hidden md:inline-flex" /> : null}
        {budget && budget.paypalMode === "mock" ? <span className="hidden whitespace-nowrap rounded-full border border-line px-3 py-1 font-mono text-[12px] text-muted min-[1600px]:inline" title="PAYPAL_MODE=mock — labelled fake payment ids, no PayPal calls">mock payments</span> : null}
      </div>
    </header>
  );
}

/** Sound on = filled dark pill with a speaker; off = outline pill with a crossed speaker. */
export function SoundToggle({ sound, onToggle, className = "" }: { sound: boolean; onToggle: () => void; className?: string }) {
  return (
    <button type="button" aria-pressed={sound} onClick={onToggle} title={sound ? "Sound is on — click to mute" : "Sound is off — click to turn on"}
      className={`h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[15px] font-medium transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 ${sound ? "border-ink bg-ink text-card focus-visible:outline-gold" : "border-line bg-card text-muted hover:border-[#B8AE9C] focus-visible:outline-ink"} ${className}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5L6 9H3v6h3l5 4V5z" />
        {sound ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></> : <path d="M16 9l5 6M21 9l-5 6" />}
      </svg>
      {sound ? "Sound on" : "Sound off"}
    </button>
  );
}
