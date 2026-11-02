"use client";
import { useCallback, useEffect, useState } from "react";

export interface Budget {
  weeklyBudgetCents: number;
  spentThisWeekCents: number;
  heldCents: number;
  remainingCents: number;
  label: string;
  paypalLinked: boolean;
  paypalEmail: string | null;
  waitingCount: number;
  paypalMode: "sandbox" | "mock";
}

const EVENT = "allowance:refresh";
/** Tell every listener (header budget bar, pages) that money state changed. */
export function notifyRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function useBudget(pollMs = 15000) {
  const [budget, setBudget] = useState<Budget | null>(null);
  const load = useCallback(() => {
    fetch("/api/budget", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setBudget(d); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const iv = setInterval(load, pollMs);
    window.addEventListener(EVENT, load);
    return () => { clearInterval(iv); window.removeEventListener(EVENT, load); };
  }, [load, pollMs]);
  return { budget, reload: load };
}
