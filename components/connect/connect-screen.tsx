"use client";
// Welcome / Link PayPal. The official PayPal JS SDK (v5) button saves the
// sandbox buyer's wallet without a purchase: createVaultSetupToken → PayPal
// popup → onApprove(vaultSetupToken) → our server swaps it for a vault id.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Halftone } from "@/components/stage/halftone";
import { Sprite } from "@/components/stage/sprite";
import { Button, LinkButton } from "@/components/ui";
import { notifyRefresh, useBudget } from "@/components/shell/use-budget";

type Phase = "loading" | "ready" | "paypal-open" | "linking" | "linked" | "error";

declare global {
  interface Window {
    paypal?: {
      Buttons: (opts: Record<string, unknown>) => { render: (sel: string) => Promise<void>; close?: () => void };
    };
  }
}

export function ConnectScreen() {
  const { budget, reload } = useBudget();
  const [phase, setPhase] = useState<Phase>("loading");
  const [mode, setMode] = useState<"sandbox" | "mock">("sandbox");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const buttonsRendered = useRef(false);

  async function exchange(setupTokenId: string) {
    setPhase("linking");
    const r = await fetch("/api/paypal/vault/payment-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setup_token_id: setupTokenId }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(d.error ?? "PayPal didn't finish linking. Nothing was charged. Try again.");
      setPhase("error");
      return;
    }
    setEmail(d.payer_email ?? null);
    setPhase("linked");
    notifyRefresh();
    reload();
  }

  // Already linked? Returned from an approval page with a token in the URL?
  useEffect(() => {
    if (!budget) return;
    const params = new URLSearchParams(window.location.search);
    const returned = params.get("approval_token_id") ?? params.get("approval_session_id") ?? params.get("vault_setup_token");
    if (returned && params.get("paypal") === "return") {
      window.history.replaceState(null, "", "/connect");
      const id = setTimeout(() => exchange(returned), 0);
      return () => clearTimeout(id);
    }
    if (budget.paypalLinked) {
      const id = setTimeout(() => { setEmail(budget.paypalEmail); setPhase("linked"); }, 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setPhase((p) => (p === "loading" ? "ready" : p)), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget]);

  // Load the PayPal SDK with a fresh user id token and render the official button.
  useEffect(() => {
    if (phase !== "ready" || buttonsRendered.current) return;
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/paypal/vault/id-token", { cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as { id_token?: string | null; client_id?: string | null; mode?: "sandbox" | "mock"; error?: string };
      if (cancelled) return;
      setMode(d.mode ?? "sandbox");
      if (d.mode === "mock" || !d.id_token || !d.client_id) return; // mock button handles it
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(d.client_id!)}&components=buttons&vault=true&disable-funding=card,credit,paylater`;
        s.setAttribute("data-user-id-token", d.id_token!);
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("PayPal's button script didn't load."));
        document.head.appendChild(s);
      });
      if (cancelled || !window.paypal) return;
      buttonsRendered.current = true;
      await window.paypal
        .Buttons({
          style: { shape: "pill", color: "gold", label: "paypal", height: 48 },
          createVaultSetupToken: async () => {
            setError(null);
            setPhase("paypal-open");
            const res = await fetch("/api/paypal/vault/setup-token", { method: "POST" });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error ?? "Couldn't start linking.");
            return j.setup_token_id as string;
          },
          onApprove: async ({ vaultSetupToken }: { vaultSetupToken: string }) => { await exchange(vaultSetupToken); },
          onCancel: () => setPhase("ready"),
          onError: (err: unknown) => {
            setError(err instanceof Error ? err.message : "PayPal couldn't open. Nothing was charged. Try again.");
            setPhase("error");
          },
        })
        .render("#paypal-button");
    })().catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function mockLink() {
    setPhase("paypal-open");
    await new Promise((r) => setTimeout(r, 900)); // let Scout cover his eyes
    const res = await fetch("/api/paypal/vault/setup-token", { method: "POST" });
    const j = await res.json();
    await exchange(j.setup_token_id);
  }

  async function unlink() {
    await fetch("/api/paypal/vault/payment-token", { method: "DELETE" });
    buttonsRendered.current = false;
    setEmail(null);
    setPhase("ready");
    notifyRefresh();
  }

  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-6 py-10">
      <div className="grid w-full max-w-[1040px] items-center gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="order-2 flex justify-center md:order-1">
          <Halftone motif="dome" size={320} />
        </div>
        <div className="order-1 flex flex-col gap-6 md:order-2">
          <h1 className="font-display text-[48px] italic leading-[1.02] tracking-[-.01em] md:text-[60px] text-pretty">give your AI an allowance, not your wallet</h1>
          <p className="max-w-[460px] text-[18px] leading-[1.5] text-muted text-pretty">Link PayPal once and set simple rules. Scout buys the small stuff, waits for your OK on bigger things while PayPal holds the money, and gets blocked on anything sketchy.</p>

          {phase === "linked" ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5">
              <div className="flex items-center gap-3 text-[20px] font-semibold">PayPal linked <span className="text-paid">✓</span></div>
              <div className="text-[15px] text-muted">{email ? <>Linked: <span className="font-mono">{email}</span></> : "Linked: sandbox buyer"}{mode === "mock" || budget?.paypalMode === "mock" ? " · mock payments" : " · PayPal Sandbox, test money only"}</div>
              <div className="flex flex-wrap gap-3">
                <LinkButton href="/rules">Set your rules →</LinkButton>
                <Button variant="outline" onClick={unlink}>Unlink</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex min-h-[64px] flex-wrap items-center gap-5">
                <div className="min-w-[240px] max-w-[320px] flex-1">
                  {mode === "mock" ? (
                    <Button size="lg" className="w-full" disabled={phase === "paypal-open" || phase === "linking"} onClick={mockLink}>Link PayPal (mock)</Button>
                  ) : (
                    <div id="paypal-button" aria-busy={phase === "loading"} />
                  )}
                  {phase === "loading" && mode !== "mock" ? <div className="text-[14px] text-muted">loading PayPal…</div> : null}
                </div>
                {phase === "paypal-open" || phase === "linking" ? (
                  <div className="flex items-end gap-2">
                    <Sprite name="scout-eyes" scale={4} label="Scout covering his eyes" />
                    <div className="-mt-2 self-start whitespace-nowrap border-2 border-ink bg-card px-2 py-[3px] font-pixel text-[15px]">{phase === "linking" ? "almost…" : "not looking!"}</div>
                  </div>
                ) : null}
              </div>
              {phase === "error" && error ? (
                <div role="alert" className="flex items-start gap-[10px] rounded-xl bg-[#FBEAE7] px-[14px] py-3 text-[15px] leading-[1.45]"><span className="mt-[7px] h-2 w-2 flex-none rounded-full bg-blocked" /><span><strong className="font-semibold">That didn&apos;t go through.</strong> {error}</span></div>
              ) : null}
              <p className="text-[14px] text-muted">Sandbox only, test money only. Scout never sees your PayPal login. <Link href="/chat" className="underline underline-offset-[3px]">Skip for now</Link></p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
