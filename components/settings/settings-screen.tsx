"use client";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { usePrefs } from "@/components/shell/prefs";
import { notifyRefresh, useBudget } from "@/components/shell/use-budget";

export function SettingsScreen() {
  const { sound, setSound } = usePrefs();
  const { budget } = useBudget();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    try {
      const r = await fetch("/api/demo/reset", { method: "POST" });
      const d = await r.json();
      setMsg(r.ok ? `Demo reset. ${d.voided} hold${d.voided === 1 ? "" : "s"} released, activity cleared, rules back to the defaults.` : d.error ?? "Reset didn't go through.");
      setConfirm(false);
      try { localStorage.removeItem("allowance:session"); } catch {}
      notifyRefresh();
    } finally { setBusy(false); }
  }
  async function unlink() {
    await fetch("/api/paypal/vault/payment-token", { method: "DELETE" });
    setMsg("PayPal unlinked. Link it again from the Connect page.");
    notifyRefresh();
  }

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
        <h1 className="font-display text-[44px] italic leading-none tracking-[-.01em] md:text-[56px]">Settings</h1>

        <Card className="flex flex-col gap-3 p-6">
          <div className="text-[18px] font-semibold">Linked PayPal</div>
          {budget?.paypalLinked ? (
            <>
              <div className="text-[16px]">Linked: <span className="font-mono">{budget.paypalEmail ?? "sandbox buyer"}</span></div>
              <div className="text-[14px] text-muted">{budget.paypalMode === "mock" ? "Mock payments: labelled fake ids, no PayPal calls." : "PayPal Sandbox, test money only. Scout never sees this login."}</div>
              <div><Button variant="outline" onClick={unlink}>Unlink PayPal</Button></div>
            </>
          ) : (
            <>
              <div className="text-[16px] text-muted">Not linked yet.</div>
              <div><a href="/connect" className="inline-flex h-11 items-center rounded-full bg-gold px-[22px] text-[16px] font-semibold text-ink hover:bg-[#C8930F]">Link PayPal</a></div>
            </>
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-6">
          <div className="text-[18px] font-semibold">Sound</div>
          <div className="text-[14px] text-muted">Coins, the door, the stamp, and Scout and Penny&apos;s voices. Off by default.</div>
          <div><Button variant="outline" aria-pressed={sound} onClick={() => setSound(!sound)}>{sound ? "Sound on" : "Sound off"}</Button></div>
        </Card>

        <Card className="flex flex-col gap-3 p-6">
          <div className="text-[18px] font-semibold">Reset the demo</div>
          <div className="text-[14px] text-muted">Releases any money on hold, clears every purchase and chat, and puts the rules back to the defaults. Your PayPal link stays.</div>
          {confirm ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button className="bg-blocked text-card hover:bg-[#B93C31]" disabled={busy} onClick={reset}>{busy ? "Resetting…" : "Yes, reset everything"}</Button>
              <Button variant="outline" onClick={() => setConfirm(false)}>Keep it</Button>
            </div>
          ) : (
            <div><Button variant="outline" onClick={() => setConfirm(true)}>Reset the demo</Button></div>
          )}
          {msg ? <div role="status" className="text-[15px] text-muted">{msg}</div> : null}
        </Card>

        <Card className="flex flex-col gap-2 p-6">
          <div className="text-[18px] font-semibold">About this demo</div>
          <p className="text-[15px] leading-[1.5] text-muted text-pretty">Test money only. Every payment goes through the PayPal Sandbox with fictional stores. Scout is an AI agent that can only ask Allowance to pay; it never holds your PayPal login. The safety check is an AI reviewer that can make a decision stricter, never looser.</p>
          <p className="text-[14px] text-muted">Other agents can shop through the same guard with the Guard API and an API key. See the README.</p>
        </Card>
      </div>
    </main>
  );
}
