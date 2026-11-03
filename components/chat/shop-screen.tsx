"use client";
// Shop with Scout — three columns: chat · Agent Cam · What happened.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentCam, type CamScene, SHOP_INDEX } from "@/components/stage/agent-cam";
import { Halftone } from "@/components/stage/halftone";
import { Button, Card, Pill, clockTime, mmss } from "@/components/ui";
import { usePrefs } from "@/components/shell/prefs";
import { notifyRefresh, useBudget } from "@/components/shell/use-budget";
import { useSound } from "@/components/shell/use-sound";
import { detailsOf, fetchActivity, pillOf, safetyLine, sceneOf, sentenceOf, type ActivityRow } from "@/lib/client/activity";

type Msg =
  | { id: string; kind: "you"; text: string; time: string }
  | { id: string; kind: "step"; text: string; pending?: boolean }
  | { id: string; kind: "scout"; text: string }
  | { id: string; kind: "err"; title: string; text: string };

const SUGGESTION = "buy groceries for the week under $60, and a phone charger";
const uid = () => Math.random().toString(36).slice(2, 9);

export function ShopScreen() {
  const { plain, record } = usePrefs();
  const { budget } = useBudget();
  const { play, sequence } = useSound();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [userAction, setUserAction] = useState<Record<string, "approved" | "denied">>({});
  const [failBanner, setFailBanner] = useState(false);
  const [cam, setCam] = useState<{ scene: CamScene; key: number }>({ scene: { kind: "idle" }, key: 0 });
  const [now, setNow] = useState(0);
  const [liveIds, setLiveIds] = useState<string[]>([]);
  const chatEnd = useRef<HTMLDivElement>(null);

  const playScene = useCallback((scene: CamScene) => setCam((c) => ({ scene, key: c.key + 1 })), []);

  const reloadRows = useCallback((): Promise<ActivityRow[]> => {
    return fetchActivity()
      .then((d) => { setRows(d.activity); return d.activity; })
      .catch(() => [] as ActivityRow[]);
  }, []);

  // initial load: feed + last session's chat
  useEffect(() => {
    reloadRows();
    const last = localStorage.getItem("allowance:session");
    if (!last) return;
    fetch(`/api/sessions/${last}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!s) return;
        const restored: Msg[] = [];
        for (const m of s.messages as Array<{ id: string; role: string; content: string; createdAt: string }>) {
          if (m.role === "user") restored.push({ id: m.id, kind: "you", text: m.content, time: clockTime(m.createdAt) });
          else if (m.role === "tool_result") restored.push({ id: m.id, kind: "step", text: m.content });
          else if (m.role === "assistant") restored.push({ id: m.id, kind: "scout", text: m.content });
          else if (m.role === "error") restored.push({ id: m.id, kind: "err", title: "Scout stopped.", text: m.content });
        }
        setMsgs(restored);
      })
      .catch(() => {});
  }, [reloadRows]);

  // countdown clock (state, so render stays pure)
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t0 = setTimeout(tick, 0);
    const iv = setInterval(tick, 1000);
    return () => { clearTimeout(t0); clearInterval(iv); };
  }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length]);

  const push = (m: Msg) => setMsgs((prev) => [...prev, m]);

  async function send(text: string) {
    const task = text.trim();
    if (!task || running) return;
    setDraft("");
    setRunning(true);
    setFailBanner(false);
    push({ id: uid(), kind: "you", text: task, time: clockTime(new Date(now)) });
    play("scout-on-it", 0.7);
    try {
      const res = await fetch("/api/agent/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task }) });
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({ error: "Something went wrong." }));
        push({ id: uid(), kind: "err", title: "Scout couldn't start.", text: e.error ?? "Something went wrong." });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const data = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!data) continue;
          await handleEvent(JSON.parse(data.slice(6)));
        }
      }
    } catch (err) {
      push({ id: uid(), kind: "err", title: "Lost the connection to Scout.", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setRunning(false);
      notifyRefresh();
    }
  }

  async function handleEvent(e: Record<string, unknown>) {
    switch (e.type) {
      case "session":
        localStorage.setItem("allowance:session", String(e.sessionId));
        playScene({ kind: "walk", shop: 0 });
        break;
      case "tool_call": {
        const input = (e.input ?? {}) as Record<string, unknown>;
        const slug = typeof input.store === "string" ? input.store : typeof input.merchant_id === "string" ? String(input.merchant_id).replace(/^m_/, "") : null;
        if (slug && SHOP_INDEX[slug] != null) { playScene({ kind: "walk", shop: SHOP_INDEX[slug] }); play("sfx-footsteps", 0.5); }
        push({ id: String(e.id), kind: "step", text: String(e.summary), pending: true });
        break;
      }
      case "tool_result":
        setMsgs((prev) => prev.map((m) => (m.id === e.id && m.kind === "step" ? { ...m, text: String(e.summary), pending: false } : m)));
        break;
      case "decision": {
        const fresh = await reloadRows();
        const row = fresh.find((r) => r.id === e.requestId);
        if (row) {
          setLiveIds((ids) => [...ids, row.id]);
          const scene = sceneOf(row);
          if (scene) playScene(scene);
          if (scene?.kind === "paid") sequence(["sfx-coin", "penny-paying", "sfx-receipt"], 500);
          else if (scene?.kind === "hold") sequence(["sfx-jar", "penny-hold"], 400);
          else if (scene?.kind === "blocked") sequence(row.reasons.some((r) => /hidden instructions/i.test(r)) ? ["sfx-glitch", "penny-xray", "sfx-door-slam", "sfx-stamp"] : ["sfx-door-slam", "sfx-stamp", "penny-block"], 700);
          if (row.status === "FAILED") setFailBanner(true);
        }
        notifyRefresh();
        break;
      }
      case "assistant":
        push({ id: uid(), kind: "scout", text: String(e.text) });
        break;
      case "error":
        push({ id: uid(), kind: "err", title: "Scout stopped.", text: String(e.message) });
        break;
      default:
        break;
    }
  }

  async function decide(row: ActivityRow, action: "approve" | "deny") {
    setBusy((b) => ({ ...b, [row.id]: true }));
    try {
      const r = await fetch(`/api/approvals/${row.id}/${action}`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFailBanner(true);
        push({ id: uid(), kind: "err", title: "That didn't go through.", text: d.error ?? "PayPal didn't answer, so you weren't charged." });
        return;
      }
      setUserAction((u) => ({ ...u, [row.id]: action === "approve" ? "approved" : "denied" }));
      if (action === "approve") sequence(["sfx-coin-rain", "penny-paying"], 600); else sequence(["scout-oh-well", "penny-released"], 500);
      const fresh = await reloadRows();
      const updated = fresh.find((x) => x.id === row.id);
      if (action === "approve" && updated) playScene({ kind: "paid", shop: sceneOf(updated)?.kind === "paid" ? (sceneOf(updated) as { shop: 0 | 1 | 2 }).shop : 1, receipt: { store: updated.store, items: updated.itemCount, total: updated.amount, ref: updated.paypalCaptureId } });
      if (action === "deny") playScene({ kind: "idle" });
      notifyRefresh();
    } finally {
      setBusy((b) => ({ ...b, [row.id]: false }));
    }
  }

  const fill = budget && budget.weeklyBudgetCents > 0 ? budget.remainingCents / budget.weeklyBudgetCents : 1;
  const left = budget ? `$${(budget.remainingCents / 100).toFixed(2)}` : "—";
  const isEmpty = msgs.length === 0;
  const paypalUnlinked = budget ? !budget.paypalLinked : false;
  const showCam = !plain;
  const cols = showCam ? "minmax(300px,360px) minmax(0,1fr) minmax(320px,400px)" : "minmax(0,1fr) minmax(0,1fr)";
  const mode = budget?.paypalMode ?? "sandbox";

  return (
    <>
      {paypalUnlinked ? (
        <Banner title="PayPal isn't linked yet." text="Scout can look around, but nothing can be bought until you link PayPal once." cta={<Link href="/connect" className="inline-flex h-11 items-center rounded-full bg-gold px-[22px] text-[16px] font-semibold text-ink hover:bg-[#C8930F]">Link PayPal</Link>} />
      ) : failBanner ? (
        <Banner title="We can't reach PayPal right now." text="Scout has paused, and nothing new was charged. Reconnect PayPal to keep going." cta={<Link href="/connect" className="inline-flex h-11 items-center rounded-full bg-gold px-[22px] text-[16px] font-semibold text-ink hover:bg-[#C8930F]">Reconnect PayPal</Link>} />
      ) : null}

      <main className="grid min-h-0 flex-1 gap-5 overflow-auto p-5 lg:overflow-hidden lg:px-6 lg:pb-6" style={{ gridTemplateColumns: cols }}>
        {/* ---- chat ---- */}
        <section className="flex min-h-0 min-w-0 flex-col rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(28,27,25,.04)]">
          <div className="border-b border-line px-[22px] pb-4 pt-5">
            <div className="text-[18px] font-semibold">Chat with Scout</div>
            <div className="mt-1 text-[15px] text-muted">Tell Scout what to buy. It follows your rules.</div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-[10px] overflow-auto p-[18px]">
            {isEmpty ? (
              <>
                <ScoutBubble text="hi! tell me what to buy, and I'll stick to your rules." />
                <div className="mt-2 flex flex-col gap-2">
                  <div className="text-[14px] text-muted">Try this</div>
                  <button type="button" onClick={() => setDraft(SUGGESTION)} className="cursor-pointer rounded-[14px] border border-line bg-card px-[14px] py-3 text-left text-[15px] leading-[1.4] hover:border-ink focus-visible:outline-3 focus-visible:outline-ink focus-visible:outline-offset-2">{SUGGESTION}</button>
                </div>
              </>
            ) : null}
            {msgs.map((m) =>
              m.kind === "you" ? (
                <div key={m.id} className="mb-[6px] flex max-w-[88%] flex-col items-end gap-1 self-end">
                  <div className="rounded-[18px_18px_4px_18px] bg-ink px-4 py-3 text-[16px] leading-[1.45] text-card text-pretty">{m.text}</div>
                  <div className="font-mono text-[12px] text-muted">you · {m.time}</div>
                </div>
              ) : m.kind === "step" ? (
                <div key={m.id} className="flex items-start gap-[10px] rounded-xl bg-paper px-3 py-[10px] text-[15px] leading-[1.45]">
                  <span className={`mt-2 h-[6px] w-[6px] flex-none rounded-full ${m.pending ? "animate-pulse bg-gold" : "bg-ink"}`} />
                  <span className="text-pretty">{m.text}</span>
                </div>
              ) : m.kind === "scout" ? (
                <ScoutBubble key={m.id} text={m.text} />
              ) : (
                <div key={m.id} className="flex items-start gap-[10px] rounded-xl bg-[#FBEAE7] px-[14px] py-3 text-[15px] leading-[1.45]">
                  <span className="mt-[7px] h-2 w-2 flex-none rounded-full bg-blocked" />
                  <span><strong className="font-semibold">{m.title}</strong> {m.text}</span>
                </div>
              ),
            )}
            {running ? <div className="font-mono text-[12px] text-muted">Scout is working…</div> : null}
            <div ref={chatEnd} />
          </div>
          <form className="flex items-end gap-[10px] border-t border-line p-[14px]" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }} placeholder="Tell Scout what to buy" rows={2} aria-label="Tell Scout what to buy" disabled={running}
              className="min-w-0 flex-1 resize-none rounded-[14px] border border-line bg-paper px-[14px] py-3 text-[16px] leading-[1.4] text-ink outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(217,162,27,.35)] disabled:opacity-60" />
            <Button type="submit" disabled={running || !draft.trim()} className="h-12 flex-none">Send</Button>
          </form>
        </section>

        {/* ---- agent cam ---- */}
        {showCam ? (
          <section className="flex min-h-0 min-w-0 flex-col justify-center gap-4">
            <div>
              <div className="text-[18px] font-semibold">Agent Cam</div>
              <div className="mt-1 text-[15px] text-muted">Watch Scout shop. Penny pays only when your rules say yes.</div>
            </div>
            <AgentCam scene={failBanner ? { kind: "paused" } : cam.scene} sceneKey={cam.key} fill={fill} />
            <div className="text-[15px] text-muted">Penny&apos;s belly shows what&apos;s left this week: <span className="font-mono font-semibold text-ink">{left}</span></div>
          </section>
        ) : null}

        {/* ---- feed ---- */}
        <section className="flex min-h-0 min-w-0 flex-col gap-[14px]">
          <div>
            <div className="text-[18px] font-semibold">What happened</div>
            <div className="mt-1 text-[15px] text-muted">Every purchase, with the reason.</div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pb-1">
            {rows.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-[14px] rounded-2xl border border-line bg-card px-7 py-8 text-center">
                <Halftone motif="dome" size={200} />
                <div className="max-w-[280px] text-[17px] leading-[1.5] text-pretty">nothing yet. ask Scout to buy something and it&apos;ll show up here.</div>
              </div>
            ) : (
              rows.map((row) => {
                const kind = pillOf(row.status);
                const secs = row.expiresAt && now ? (Date.parse(row.expiresAt) - now) / 1000 : 0;
                const isOpen = !!open[row.id];
                const extra = safetyLine(row);
                return (
                  <Card key={row.id} className={`flex flex-col gap-[10px] px-[18px] py-4 ${liveIds.includes(row.id) ? "rise-in" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <Pill kind={kind} />
                      <span className="font-mono text-[13px] text-muted">{clockTime(row.time)}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[17px] font-semibold">{row.itemsLabel}</div>
                        <div className="mt-[2px] text-[15px] text-muted">{row.store}</div>
                      </div>
                      <div className={`whitespace-nowrap font-mono text-[18px] font-semibold ${kind === "blocked" || kind === "released" ? "text-muted" : ""}`}>{row.amount}</div>
                    </div>
                    <div className="text-[16px] leading-[1.45] text-pretty">{sentenceOf(row, userAction[row.id])}</div>
                    {extra ? <div className="text-[15px] leading-[1.45] text-muted text-pretty">{extra}</div> : null}
                    {kind === "hold" ? (
                      <div className="flex flex-col gap-[10px]">
                        <div className="text-[14px] text-muted">Decide within <span className="font-mono font-semibold text-ink">{mmss(secs)}</span>, or the hold is released.</div>
                        <div className="flex gap-2">
                          <Button className="flex-1" disabled={!!busy[row.id]} onClick={() => decide(row, "approve")}>Approve</Button>
                          <Button variant="outline" className="flex-1" disabled={!!busy[row.id]} onClick={() => decide(row, "deny")}>Don&apos;t buy</Button>
                        </div>
                      </div>
                    ) : null}
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [row.id]: !o[row.id] }))} className="cursor-pointer self-start border-0 bg-transparent px-0 py-[2px] text-[14px] font-medium text-muted underline underline-offset-[3px] hover:text-ink focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2">{isOpen ? "Hide details" : "Details"}</button>
                    {isOpen ? <pre className="whitespace-pre-wrap rounded-[10px] bg-paper px-3 py-[10px] font-mono text-[13px] leading-[1.6] text-muted">{detailsOf(row, mode)}</pre> : null}
                  </Card>
                );
              })
            )}
          </div>
        </section>
      </main>
      {record ? <style>{`body{overflow:hidden}`}</style> : null}
    </>
  );
}

function ScoutBubble({ text }: { text: string }) {
  return (
    <div className="mt-[6px] flex max-w-[92%] flex-col gap-1 self-start">
      <div className="rounded-[18px_18px_18px_4px] border border-line bg-card px-4 py-3 text-[16px] leading-[1.45] text-pretty">{text}</div>
      <div className="font-mono text-[12px] text-muted">Scout</div>
    </div>
  );
}

function Banner({ title, text, cta }: { title: string; text: string; cta: React.ReactNode }) {
  return (
    <div className="mx-6 mt-4 flex flex-none items-center gap-4 rounded-[14px] border border-line bg-card py-[14px] pl-5 pr-4 shadow-[0_1px_2px_rgba(28,27,25,.04)]">
      <span className="h-[10px] w-[10px] flex-none rounded-full bg-blocked" />
      <div className="flex flex-1 flex-col gap-[2px]">
        <div className="text-[16px] font-semibold">{title}</div>
        <div className="text-[15px] text-muted">{text}</div>
      </div>
      {cta}
    </div>
  );
}
