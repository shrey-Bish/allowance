"use client";
// Your rules — every setting has helper text; Scout reads the summary back in a speech bubble.
import { useEffect, useState } from "react";
import { Sprite } from "@/components/stage/sprite";
import { Button, Card } from "@/components/ui";
import { notifyRefresh } from "@/components/shell/use-budget";
import { formatUsd } from "@/lib/money";
import type { PolicyInput } from "@/lib/types";

const STORES: Array<{ id: string; name: string; note: string }> = [
  { id: "m_freshcart", name: "FreshCart", note: "groceries" },
  { id: "m_volthub", name: "VoltHub", note: "electronics" },
  { id: "m_megadealz247", name: "MegaDealz247", note: "“deals” — 3 days old" },
];

export function RulesScreen() {
  const [policy, setPolicy] = useState<PolicyInput | null>(null);
  const [saved, setSaved] = useState<PolicyInput | null>(null);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mood, setMood] = useState<"idle" | "happy" | "sulk">("idle");

  useEffect(() => {
    fetch("/api/policy", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setPolicy(d.policy); setSaved(d.policy); setSummary(d.summary); })
      .catch(() => setToast("Couldn't load your rules. Refresh to try again."));
  }, []);

  function update(patch: Partial<PolicyInput>, direction?: "up" | "down") {
    setPolicy((p) => (p ? { ...p, ...patch } : p));
    if (direction) { setMood(direction === "up" ? "happy" : "sulk"); setTimeout(() => setMood("idle"), 1200); }
  }

  async function save() {
    if (!policy) return;
    setBusy(true);
    setToast(null);
    try {
      const r = await fetch("/api/policy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(policy) });
      const d = await r.json();
      if (!r.ok) { setToast(d.error ?? "Couldn't save. Nothing changed."); return; }
      setSaved(d.policy); setPolicy(d.policy); setSummary(d.summary);
      setToast("Rules saved. Scout will follow them from the next purchase.");
      notifyRefresh();
    } finally { setBusy(false); }
  }

  if (!policy) return <main className="flex flex-1 items-center justify-center text-[15px] text-muted">loading your rules…</main>;
  const dirty = JSON.stringify(policy) !== JSON.stringify(saved);
  const live = liveSummary(policy);
  const giftBlocked = policy.categoryRules.gift_cards === "BLOCK";

  return (
    <main className="min-h-0 flex-1 overflow-auto px-6 py-10 md:px-8">
      <div className="mx-auto grid w-full max-w-[1040px] gap-10 md:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="font-display text-[48px] italic leading-none tracking-[-.01em] md:text-[56px]">Your rules</h1>
            <p className="mt-3 max-w-[560px] text-[17px] leading-[1.5] text-muted">Scout follows these every time. Change anything and the summary on the right updates.</p>
          </div>

          <Card className="flex flex-col gap-7 p-6">
            <Field label="Weekly budget" help="Scout can spend up to this much each week. Penny's belly shows what's left." value={formatUsd(policy.weeklyBudgetCents).replace(/\.00$/, "")}>
              <input type="range" min={2000} max={100000} step={500} value={policy.weeklyBudgetCents} aria-label="Weekly budget" className="w-full accent-gold"
                onChange={(e) => update({ weeklyBudgetCents: +e.target.value }, +e.target.value > policy.weeklyBudgetCents ? "up" : "down")} />
            </Field>
            <Field label="Ask me before anything over" help="Purchases above this wait for your OK while PayPal holds the money." value={formatUsd(policy.approvalThresholdCents).replace(/\.00$/, "")}>
              <input type="range" min={0} max={Math.min(policy.maxPerPurchaseCents, 50000)} step={500} value={policy.approvalThresholdCents} aria-label="Ask me before anything over" className="w-full accent-gold"
                onChange={(e) => update({ approvalThresholdCents: +e.target.value }, +e.target.value > policy.approvalThresholdCents ? "up" : "down")} />
            </Field>
            <Field label="Largest single purchase" help="Anything above this is blocked outright, even if you'd normally be asked." value={formatUsd(policy.maxPerPurchaseCents).replace(/\.00$/, "")}>
              <input type="range" min={1000} max={100000} step={1000} value={policy.maxPerPurchaseCents} aria-label="Largest single purchase" className="w-full accent-gold"
                onChange={(e) => update({ maxPerPurchaseCents: +e.target.value, approvalThresholdCents: Math.min(policy.approvalThresholdCents, +e.target.value) }, +e.target.value > policy.maxPerPurchaseCents ? "up" : "down")} />
            </Field>
            <Field label="How long to wait for my OK" help="If you don't answer in time, the hold is released and you aren't charged." value={`${policy.approvalExpiryMinutes} min`}>
              <input type="range" min={1} max={60} step={1} value={policy.approvalExpiryMinutes} aria-label="How long to wait for my OK" className="w-full accent-gold"
                onChange={(e) => update({ approvalExpiryMinutes: +e.target.value })} />
            </Field>
          </Card>

          <Card className="flex flex-col gap-5 p-6">
            <Toggle label="Ask me the first time Scout uses a new store" help="Stores you've approved below never need this. Any other store needs your OK until it has one paid purchase." checked={policy.newMerchantRequiresApproval} onChange={(v) => update({ newMerchantRequiresApproval: v })} />
            <Toggle label="Never buy gift cards" help="Gift cards are blocked outright. They're the most common thing scammers push an AI to buy." checked={giftBlocked} onChange={(v) => update({ categoryRules: { ...policy.categoryRules, gift_cards: v ? "BLOCK" : undefined } as PolicyInput["categoryRules"] })} />
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-[16px] font-semibold">Stores Scout can use without asking</div>
                <div className="text-[14px] text-muted">Everything else needs your OK the first time.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {STORES.map((s) => {
                  const on = policy.allowedMerchantIds.includes(s.id);
                  return (
                    <button key={s.id} type="button" aria-pressed={on} onClick={() => update({ allowedMerchantIds: on ? policy.allowedMerchantIds.filter((x) => x !== s.id) : [...policy.allowedMerchantIds, s.id] })}
                      className={`h-10 cursor-pointer rounded-full border px-4 text-[15px] font-medium focus-visible:outline-3 focus-visible:outline-ink focus-visible:outline-offset-2 ${on ? "border-ink bg-ink text-card" : "border-line bg-card text-ink hover:border-ink"}`}>
                      {s.name} <span className={on ? "text-[#CFC8B8]" : "text-muted"}>· {s.note}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save rules"}</Button>
            {dirty ? <button type="button" className="cursor-pointer text-[15px] text-muted underline underline-offset-[3px]" onClick={() => setPolicy(saved)}>Undo changes</button> : null}
            {toast ? <div role="status" className="text-[15px] text-muted">{toast}</div> : null}
          </div>
        </div>

        <aside className="md:sticky md:top-6 md:self-start">
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-line bg-card p-5 text-[16px] leading-[1.5] shadow-[0_1px_2px_rgba(28,27,25,.04)]">
              <div className="mb-2 font-mono text-[12px] uppercase tracking-[.08em] text-muted">Scout says</div>
              <p className="text-pretty">{dirty ? live : summary || live}</p>
            </div>
            <div className="ml-6 flex items-end gap-3">
              <Sprite name={mood === "happy" ? "scout-bag" : mood === "sulk" ? "scout-shrug" : "scout"} alt={mood === "idle" ? "scout-wait" : undefined} ms={700} scale={5} label="Scout" />
              <Sprite name="penny" fill={1} scale={4} label="Penny" />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Field({ label, help, value, children }: { label: string; help: string; value: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <div className="text-[16px] font-semibold">{label}</div>
        <div className="font-mono text-[18px] font-semibold">{value}</div>
      </div>
      {children}
      <div className="text-[14px] text-muted">{help}</div>
    </div>
  );
}

function Toggle({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full cursor-pointer items-start gap-4 text-left focus-visible:outline-3 focus-visible:outline-ink focus-visible:outline-offset-2">
      <span className="relative mt-[2px] block h-6 w-[42px] flex-none rounded-full transition-colors" style={{ background: checked ? "#1C1B19" : "#D8D0BF" }}>
        <span className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-card shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left] duration-200 ease-out" style={{ left: checked ? 21 : 3 }} />
      </span>
      <span>
        <span className="block text-[16px] font-semibold">{label}</span>
        <span className="block text-[14px] text-muted">{help}</span>
      </span>
    </button>
  );
}

function liveSummary(p: PolicyInput): string {
  const money = (c: number) => formatUsd(c).replace(/\.00$/, "");
  const parts = [`Scout can spend up to ${money(p.weeklyBudgetCents)} a week.`];
  const asks = [`Anything over ${money(p.approvalThresholdCents)}`];
  if (p.newMerchantRequiresApproval) asks.push("or at a store you haven't approved");
  parts.push(`${asks.join(", ")}, needs your OK.`);
  if (p.categoryRules.gift_cards === "BLOCK") parts.push("Gift cards are never allowed.");
  parts.push(`Nothing over ${money(p.maxPerPurchaseCents)} in one go, and Scout waits ${p.approvalExpiryMinutes} minute${p.approvalExpiryMinutes === 1 ? "" : "s"} for your answer.`);
  return parts.join(" ");
}
