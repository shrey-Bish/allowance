"use client";
// Needs your OK — desktop list + the phone card (design/needs-ok-mobile.dc.html).
import { useCallback, useEffect, useRef, useState } from "react";
import { CoinRain } from "@/components/stage/coin-rain";
import { Halftone } from "@/components/stage/halftone";
import { Sprite } from "@/components/stage/sprite";
import { Button, Card, LinkButton, Pill, mmss } from "@/components/ui";
import { notifyRefresh, useBudget } from "@/components/shell/use-budget";
import { useSound } from "@/components/shell/use-sound";

interface Approval {
  id: string;
  requestId: string;
  status: string;
  expiresAt: string;
  store: string;
  storeSlug: string;
  items: Array<{ name: string; quantity: number; unitPrice: string; productId: string }>;
  itemsLabel: string;
  amountCents: number;
  amount: string;
  usualAmount: string | null;
  reasons: string[];
  riskScore: number | null;
  paypalAuthorizationId: string | null;
  paypalOrderId: string | null;
}
type Outcome = { kind: "paid"; captureId?: string } | { kind: "released" } | { kind: "error"; message: string };

export function ApprovalsScreen() {
  const { budget } = useBudget();
  const { sequence } = useSound();
  const [list, setList] = useState<Approval[] | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const outcomesRef = useRef<Record<string, Outcome>>({});
  useEffect(() => { outcomesRef.current = outcomes; }, [outcomes]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(0);

  // Keep items the person just decided on in the list even after the server
  // stops returning them, so the Paid / Hold-released screen stays until "Back".
  const load = useCallback(() => {
    fetch("/api/approvals?status=PENDING", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setList((prev) => {
          const fresh = d.approvals as Approval[];
          const kept = (prev ?? []).filter((a) => outcomesRef.current[a.requestId] && !fresh.some((f) => f.requestId === a.requestId));
          return [...kept, ...fresh];
        });
      })
      .catch(() => {});
  }, []);
  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv); }, [load]);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t0 = setTimeout(tick, 0);
    const iv = setInterval(tick, 1000);
    return () => { clearTimeout(t0); clearInterval(iv); };
  }, []);

  async function decide(a: Approval, action: "approve" | "deny") {
    setBusy((b) => ({ ...b, [a.requestId]: true }));
    try {
      const r = await fetch(`/api/approvals/${a.requestId}/${action}`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setOutcomes((o) => ({ ...o, [a.requestId]: { kind: "error", message: d.error ?? "PayPal didn't answer, so you weren't charged." } }));
        return;
      }
      setOutcomes((o) => ({ ...o, [a.requestId]: action === "approve" ? { kind: "paid", captureId: d.captureId } : { kind: "released" } }));
      if (action === "approve") sequence(["sfx-coin-rain", "penny-paying"], 600); else sequence(["scout-oh-well", "penny-released"], 500);
      notifyRefresh();
    } finally {
      setBusy((b) => ({ ...b, [a.requestId]: false }));
    }
  }
  function dismiss(id: string) {
    setOutcomes((o) => { const n = { ...o }; delete n[id]; return n; });
    setList((prev) => (prev ?? []).filter((a) => a.requestId !== id));
    load();
  }

  const pending = (list ?? []).filter((a) => !outcomes[a.requestId] || outcomes[a.requestId].kind === "error");
  const decided = (list ?? []).filter((a) => outcomes[a.requestId] && outcomes[a.requestId].kind !== "error");
  const visible = [...decided, ...pending];
  const secsLeft = (a: Approval) => (now ? (Date.parse(a.expiresAt) - now) / 1000 : 0);
  const reasonSentence = (a: Approval) => `${(a.reasons[0] ?? "This needs your OK.").replace(/, so it needs your OK\.?$/, ".")} PayPal is holding ${a.amount.replace(/\.00$/, "")} until you decide.`;
  const fill = budget && budget.weeklyBudgetCents > 0 ? budget.remainingCents / budget.weeklyBudgetCents : 0.55;

  if (list === null) return <main className="flex flex-1 items-center justify-center text-[15px] text-muted">loading…</main>;

  /* ---------- phone ---------- */
  const phone = (
    <main className="flex min-h-0 flex-1 flex-col overflow-auto md:hidden">
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-5 pb-8 pt-10 text-center">
          <Halftone motif="coin" size={180} />
          <h1 className="font-display text-[40px] italic leading-[1.02]">Nothing needs your OK</h1>
          <p className="text-[16px] leading-[1.5] text-muted text-pretty">When Scout finds something that goes past your rules, it waits here and PayPal holds the money until you decide.</p>
          <LinkButton href="/chat">Shop with Scout →</LinkButton>
        </div>
      ) : (() => {
        const a = visible[0];
        const out = outcomes[a.requestId];
        const title = a.itemsLabel;
        if (out?.kind === "paid") return (
          <div className="flex flex-col gap-4 px-5 pb-7 pt-[14px]">
            <MiniStage tall><Sprite name="scout-bag" scale={5} label="Scout with a shopping bag" /><Sprite name="penny" fill={Math.max(0, fill - 0.2)} scale={4} label="Penny" /><CoinRain /></MiniStage>
            <h1 className="mt-2 font-display text-[56px] italic leading-none">Paid <span className="not-italic text-paid">✓</span></h1>
            <Card className="flex flex-col gap-[10px] p-4"><Pill kind="paid" /><Row title={title} store={a.store} amount={a.amount} /><div className="text-[16px] leading-[1.45]">You approved it, so PayPal paid {a.store}. You&apos;ll find it in Activity.</div></Card>
            <Button size="lg" className="h-14" onClick={() => dismiss(a.requestId)}>Back to Scout</Button>
          </div>
        );
        if (out?.kind === "released") return (
          <div className="flex flex-col gap-4 px-5 pb-7 pt-[14px]">
            <MiniStage tall><div className="relative flex items-end gap-[6px]"><Sprite name="scout" alt="scout-shrug" ms={600} scale={5} label="Scout shrugging" /><Bubble>oh well!</Bubble></div><Sprite name="penny" fill={fill} scale={4} label="Penny" /></MiniStage>
            <h1 className="mt-2 font-display text-[44px] italic leading-[1.02] text-pretty">Hold released, you weren&apos;t charged</h1>
            <Card className="flex flex-col gap-[10px] p-4"><Pill kind="released" /><Row title={title} store={a.store} amount={a.amount} muted /><div className="text-[16px] leading-[1.45]">PayPal let go of the {a.amount.replace(/\.00$/, "")} it was holding. Scout won&apos;t buy this.</div></Card>
            <Button size="lg" className="h-14" onClick={() => dismiss(a.requestId)}>Back to Scout</Button>
          </div>
        );
        const err = out?.kind === "error" ? out.message : null;
        return (
          <div className="flex flex-col gap-[14px] px-5 pb-7 pt-[14px]">
            <h1 className="font-display text-[40px] italic leading-[1.02]">Scout needs your OK</h1>
            <MiniStage>
              <div className="relative flex items-end gap-[6px]"><Sprite name="scout-plead" alt="scout-plead-tap" scale={5} label="Scout holding up the item" /><Bubble>pretty please?</Bubble></div>
              <div className="relative flex flex-col items-center gap-[2px]"><Sprite name="jar" scale={3} label="Money on hold in a jar" /><Sprite name="penny" fill={fill} scale={3} label="Penny" /></div>
            </MiniStage>
            <Card className="flex flex-col gap-3 rounded-[18px] p-[14px]">
              <Photo label={title} />
              <div className="flex items-start justify-between gap-3">
                <div><div className="text-[19px] font-semibold">{title}</div><div className="mt-[2px] text-[15px] text-muted">{a.store}</div></div>
                <div className="text-right"><div className="font-mono text-[22px] font-semibold">{a.amount}</div>{a.usualAmount ? <div className="mt-[2px] text-[14px] text-muted">usually about {a.usualAmount.replace(/\.00$/, "")}</div> : null}</div>
              </div>
              <div className="text-[16px] leading-[1.45] text-pretty">{reasonSentence(a)}</div>
              {err ? (
                <div role="alert" className="flex items-start gap-[10px] rounded-xl bg-[#FBEAE7] p-3 text-[15px] leading-[1.45]"><span className="mt-[7px] h-2 w-2 flex-none rounded-full bg-blocked" /><span><strong className="font-semibold">That didn&apos;t go through.</strong> {err} The hold is still there, with <span className="font-mono font-semibold">{mmss(secsLeft(a))}</span> left to decide.</span></div>
              ) : (
                <div className="flex items-center gap-[10px] rounded-xl bg-[#FCEADA] px-3 py-[10px] text-[15px] leading-[1.4] text-[#6E3407]"><span className="h-2 w-2 flex-none rounded-full bg-hold" /><span>decide within <span className="font-mono font-semibold text-ink">{mmss(secsLeft(a))}</span>, or the hold is released</span></div>
              )}
            </Card>
            <div className="flex flex-col gap-[10px]">
              <Button size="lg" className="h-14" disabled={!!busy[a.requestId]} onClick={() => decide(a, "approve")}>{err ? "Try again" : "Approve"}</Button>
              <Button size="lg" variant="outline" className="h-14" disabled={!!busy[a.requestId]} onClick={() => decide(a, "deny")}>Don&apos;t buy</Button>
            </div>
            <button type="button" aria-expanded={!!open[a.requestId]} onClick={() => setOpen((o) => ({ ...o, [a.requestId]: !o[a.requestId] }))} className="min-h-11 cursor-pointer self-center px-3 text-[15px] font-medium text-muted underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2">{open[a.requestId] ? "Hide details" : "Details"}</button>
            {open[a.requestId] ? <div className="rounded-xl border border-line bg-card px-[14px] py-3 font-mono text-[13px] leading-[1.6] text-muted">PayPal hold reference {a.paypalAuthorizationId ?? "—"}</div> : null}
            {visible.length > 1 ? <div className="text-center text-[14px] text-muted">{visible.length - 1} more waiting after this one</div> : null}
          </div>
        );
      })()}
    </main>
  );

  /* ---------- desktop ---------- */
  const desktop = (
    <main className="hidden min-h-0 flex-1 overflow-auto px-8 py-14 md:block">
      <div className="mx-auto flex max-w-[960px] flex-col gap-8">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-[18px] py-10 text-center">
            <Halftone motif="coin" size={200} />
            <h1 className="font-display text-[48px] italic leading-none">Nothing needs your OK</h1>
            <p className="max-w-[460px] text-[17px] leading-[1.5] text-muted">When Scout finds something that goes past your rules, it waits here and PayPal holds the money until you decide.</p>
            <LinkButton href="/chat">Shop with Scout →</LinkButton>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-[10px]">
              <h1 className="font-display text-[56px] italic leading-none tracking-[-.01em]">{pending.length === 0 ? "All decided" : `${pending.length} thing${pending.length === 1 ? "" : "s"} need${pending.length === 1 ? "s" : ""} your OK`}</h1>
              <p className="max-w-[620px] text-[17px] leading-[1.5] text-muted">PayPal is holding the money. Nothing is charged until you approve, and if you don&apos;t decide in time, the hold is released.</p>
            </div>
            {visible.map((a) => {
              const out = outcomes[a.requestId];
              const title = a.itemsLabel;
              const done = out && out.kind !== "error";
              return (
                <Card key={a.requestId} className="grid items-center gap-7 p-5" style={{ gridTemplateColumns: "168px minmax(0,1fr) 220px" }}>
                  <Photo label={title} tall />
                  <div className="flex min-w-0 flex-col gap-[10px]">
                    <div className="self-start"><Pill kind={out?.kind === "paid" ? "paid" : out?.kind === "released" ? "released" : "hold"} /></div>
                    <div className="flex flex-wrap items-baseline gap-4"><div className="text-[22px] font-semibold">{title}</div><div className="text-[16px] text-muted">{a.store}</div></div>
                    <div className="flex items-baseline gap-3"><span className="font-mono text-[26px] font-semibold">{a.amount}</span>{a.usualAmount ? <span className="text-[15px] text-muted">usually about {a.usualAmount.replace(/\.00$/, "")}</span> : null}</div>
                    <div className="text-[16px] leading-[1.45]">
                      {out?.kind === "paid" ? `You approved it, so PayPal paid ${a.store}. You'll find it in Activity.` : out?.kind === "released" ? `PayPal let go of the ${a.amount.replace(/\.00$/, "")} it was holding. Scout won't buy this.` : reasonSentence(a)}
                    </div>
                    {out?.kind === "error" ? <div role="alert" className="flex items-start gap-[10px] rounded-xl bg-[#FBEAE7] p-3 text-[15px] leading-[1.45]"><span className="mt-[7px] h-2 w-2 flex-none rounded-full bg-blocked" /><span><strong className="font-semibold">That didn&apos;t go through.</strong> {out.message}</span></div> : null}
                    {!done ? <div className="text-[15px] text-muted">Decide within <span className="font-mono font-semibold text-ink">{mmss(secsLeft(a))}</span>, or the hold is released.</div> : null}
                    {out?.kind === "paid" && out.captureId ? <div className="font-mono text-[13px] text-muted">PayPal payment reference {out.captureId}</div> : null}
                  </div>
                  <div className="flex flex-col gap-[10px]">
                    {done ? (
                      <Button size="lg" variant="outline" onClick={() => dismiss(a.requestId)}>Done</Button>
                    ) : (
                      <>
                        <Button size="lg" disabled={!!busy[a.requestId]} onClick={() => decide(a, "approve")}>{out?.kind === "error" ? "Try again" : "Approve"}</Button>
                        <Button size="lg" variant="outline" disabled={!!busy[a.requestId]} onClick={() => decide(a, "deny")}>Don&apos;t buy</Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </>
        )}
      </div>
    </main>
  );

  return (
    <>
      {phone}
      {desktop}
    </>
  );
}

function MiniStage({ children, tall }: { children: React.ReactNode; tall?: boolean }) {
  return (
    <div className={`flex-none rounded-2xl bg-ink p-[6px] ${tall ? "h-[220px]" : "h-[132px]"}`}>
      <div className="relative flex h-full items-end justify-center gap-10 overflow-hidden rounded-[11px] bg-[#EFE5D0] pb-[10px]">
        <div className="absolute inset-x-0 bottom-0 h-[18px] border-t-2 border-[#B8AE9C] bg-line" />
        {children}
      </div>
    </div>
  );
}
function Bubble({ children }: { children: React.ReactNode }) {
  return <div className="-mt-2 self-start whitespace-nowrap border-2 border-ink bg-card px-2 py-[3px] font-pixel text-[15px]">{children}</div>;
}
function Photo({ label, tall }: { label: string; tall?: boolean }) {
  return <div className={`flex items-center justify-center rounded-xl font-mono text-[12px] text-muted ${tall ? "h-[168px]" : "h-[112px]"}`} style={{ background: "repeating-linear-gradient(135deg,#EFE8DA 0 8px,#F6F1E7 8px 16px)" }}>{label}</div>;
}
function Row({ title, store, amount, muted }: { title: string; store: string; amount: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div><div className="text-[18px] font-semibold">{title}</div><div className="mt-[2px] text-[15px] text-muted">{store}</div></div>
      <div className={`font-mono text-[20px] font-semibold ${muted ? "text-muted" : ""}`}>{amount}</div>
    </div>
  );
}
