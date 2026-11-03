"use client";
// Activity — the AG Grid log of every purchase, with a side drawer telling each one's story.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type GridApi, type ICellRendererParams, type RowClickedEvent } from "ag-grid-community";
import { Halftone } from "@/components/stage/halftone";
import { Button, Pill, clockTime } from "@/components/ui";
import { useBudget } from "@/components/shell/use-budget";
import { fetchActivity, pillOf, sentenceOf, type ActivityRow } from "@/lib/client/activity";
import { formatUsd } from "@/lib/money";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
  fontSize: 15,
  backgroundColor: "#FFFDF8",
  foregroundColor: "#1C1B19",
  headerBackgroundColor: "#F6F1E7",
  headerTextColor: "#6B665C",
  headerFontWeight: 600,
  borderColor: "#E6DFD1",
  rowHoverColor: "#F6F1E7",
  selectedRowBackgroundColor: "#FCEADA",
  accentColor: "#D9A21B",
  rowHeight: 52,
  headerHeight: 44,
  wrapperBorderRadius: 16,
  cellHorizontalPadding: 14,
});

const RESULT_LABEL: Record<ReturnType<typeof pillOf>, string> = { paid: "Paid", hold: "Needs your OK", blocked: "Blocked", released: "Not bought", failed: "Didn't go through" };

function ResultCell(p: ICellRendererParams<ActivityRow>) {
  if (!p.data || p.node.rowPinned) return <span className="text-muted">{p.value}</span>;
  return <div className="flex h-full items-center leading-none"><Pill kind={pillOf(p.data.status)} /></div>;
}

export function ActivityScreen() {
  const { budget } = useBudget();
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [counts, setCounts] = useState({ paid: 0, waiting: 0, blocked: 0, released: 0 });
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("all");
  const [store, setStore] = useState("all");
  const [selected, setSelected] = useState<ActivityRow | null>(null);
  const apiRef = useRef<GridApi<ActivityRow> | null>(null);

  const load = useCallback(() => {
    fetchActivity().then((d) => { setRows(d.activity); setCounts(d.counts); }).catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, [load]);

  const filtered = useMemo(() => (rows ?? []).filter((r) => (result === "all" || pillOf(r.status) === result) && (store === "all" || r.storeSlug === store)), [rows, result, store]);
  const stores = useMemo(() => Array.from(new Map((rows ?? []).map((r) => [r.storeSlug, r.store])).entries()), [rows]);

  const columns = useMemo<ColDef<ActivityRow>[]>(() => [
    { field: "time", headerName: "Time", width: 110, sort: "desc", valueFormatter: (p) => (p.value ? clockTime(p.value) : ""), cellClass: "font-mono text-[14px]" },
    { field: "store", headerName: "Store", width: 140 },
    { field: "itemsLabel", headerName: "Items", width: 200, tooltipField: "items" },
    { field: "amount", headerName: "Amount", width: 110, type: "rightAligned", cellClass: "font-mono font-semibold", comparator: (a, b, na, nb) => (na.data?.amountCents ?? 0) - (nb.data?.amountCents ?? 0) },
    { field: "status", headerName: "Result", width: 170, cellRenderer: ResultCell, valueFormatter: (p) => (p.data ? RESULT_LABEL[pillOf(p.data.status)] : p.value) },
    { field: "safetyCheck", headerName: "Safety check", width: 150 },
    { field: "reason", headerName: "Reason", flex: 1, minWidth: 260, tooltipField: "reason" },
  ], []);

  const totalsRow = useMemo(() => {
    if (!budget) return [];
    return [{ id: "__totals", time: "", store: "This week", itemsLabel: `${counts.paid} paid · ${counts.waiting} waiting · ${counts.blocked} blocked`, amount: formatUsd(budget.spentThisWeekCents), status: `of ${formatUsd(budget.weeklyBudgetCents).replace(/\.00$/, "")}`, safetyCheck: "", reason: "", amountCents: budget.spentThisWeekCents } as unknown as ActivityRow];
  }, [budget, counts]);

  const summary = budget ? `${formatUsd(budget.spentThisWeekCents)} of ${formatUsd(budget.weeklyBudgetCents).replace(/\.00$/, "")} spent this week · ${counts.paid} paid · ${counts.waiting} waiting · ${counts.blocked} blocked` : "";

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-6 lg:gap-5 lg:overflow-hidden lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[40px] italic leading-none tracking-[-.01em] md:text-[52px]">Activity</h1>
          <p className="mt-2 text-[16px] text-muted">{summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search activity" className="h-10 w-full sm:w-[200px] rounded-full border border-line bg-card px-4 text-[15px] outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(217,162,27,.35)]" />
          <select value={result} onChange={(e) => setResult(e.target.value)} aria-label="Filter by result" className="h-10 rounded-full border border-line bg-card px-4 text-[15px]">
            <option value="all">All results</option><option value="paid">Paid</option><option value="hold">Needs your OK</option><option value="blocked">Blocked</option><option value="released">Not bought</option>
          </select>
          <select value={store} onChange={(e) => setStore(e.target.value)} aria-label="Filter by store" className="h-10 rounded-full border border-line bg-card px-4 text-[15px]">
            <option value="all">All stores</option>
            {stores.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
          </select>
          <Button variant="outline" className="h-10" onClick={() => apiRef.current?.exportDataAsCsv({ fileName: "allowance-activity.csv", columnKeys: ["time", "store", "itemsLabel", "amount", "status", "safetyCheck", "reason"] })}>Download CSV</Button>
        </div>
      </div>

      {rows && rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-line bg-card p-10 text-center">
          <Halftone motif="dome" size={200} />
          <div className="max-w-[320px] text-[17px] leading-[1.5] text-pretty">nothing yet. ask Scout to buy something and it&apos;ll show up here.</div>
        </div>
      ) : (
        <div className="min-h-[60dvh] flex-1 lg:min-h-0">
          <AgGridReact<ActivityRow>
            theme={theme}
            rowData={filtered}
            columnDefs={columns}
            defaultColDef={{ sortable: true, resizable: true, filter: true, suppressHeaderMenuButton: false }}
            quickFilterText={search}
            pinnedBottomRowData={totalsRow}
            getRowId={(p) => p.data.id}
            onGridReady={(e) => { apiRef.current = e.api; }}
            onRowClicked={(e: RowClickedEvent<ActivityRow>) => { if (e.data && e.data.id !== "__totals") setSelected(e.data); }}
            rowClass="cursor-pointer"
            suppressCellFocus
            animateRows
            loading={rows === null}
          />
        </div>
      )}

      {selected ? <StoryDrawer key={selected.id} row={selected} mode={budget?.paypalMode ?? "sandbox"} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}

// ---- drawer ---------------------------------------------------------------

interface AuditEvent { id: string; type: string; message: string; createdAt: string; data: Record<string, unknown> }

function StoryDrawer({ row, mode, onClose }: { row: ActivityRow; mode: string; onClose: () => void }) {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetch(`/api/activity/${row.id}`).then((r) => r.json()).then((d) => setEvents(d.events ?? [])).catch(() => setEvents([]));
  }, [row.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const steps = events ? storySteps(row, events) : [];
  const kind = pillOf(row.status);
  const ids = [row.paypalOrderId && `PayPal order ${row.paypalOrderId}`, row.paypalAuthorizationId && `PayPal hold reference ${row.paypalAuthorizationId}`, row.paypalCaptureId && `PayPal payment reference ${row.paypalCaptureId}`].filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={`${row.itemsLabel} at ${row.store}`}>
      <button type="button" aria-label="Close" className="flex-1 bg-ink/20" onClick={onClose} />
      <aside className="flex h-full w-full max-w-[480px] flex-col gap-5 overflow-auto border-l border-line bg-paper p-6 shadow-[0_0_40px_rgba(28,27,25,.15)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Pill kind={kind} />
            <div className="text-[22px] font-semibold leading-tight">{row.itemsLabel}</div>
            <div className="text-[15px] text-muted">{row.store} · {clockTime(row.time)}</div>
          </div>
          <div className="font-mono text-[24px] font-semibold">{row.amount}</div>
        </div>
        <p className="text-[16px] leading-[1.5]">{sentenceOf(row)}</p>
        {kind === "hold" ? <p className="text-[14px] text-muted">Approve or decline it on the <a href="/approvals" className="underline underline-offset-[3px]">Needs your OK</a> page before the hold runs out.</p> : null}

        <ol className="flex flex-col gap-3">
          {events === null ? <li className="text-[14px] text-muted">loading the story…</li> : steps.map((s, i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-line bg-card p-4">
              <span className="mt-[7px] h-2 w-2 flex-none rounded-full" style={{ background: s.dot }} />
              <div className="flex flex-col gap-1">
                <div className="font-mono text-[12px] uppercase tracking-[.08em] text-muted">{s.label}</div>
                <div className="text-[15px] leading-[1.5] text-pretty">{s.text}</div>
                {s.sub?.map((x, j) => <div key={j} className="text-[14px] leading-[1.5] text-muted">{x}</div>)}
              </div>
            </li>
          ))}
        </ol>

        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="cursor-pointer self-start text-[14px] font-medium text-muted underline underline-offset-[3px] hover:text-ink">{open ? "Hide details" : "Details"}</button>
        {open ? (
          <pre className="whitespace-pre-wrap rounded-xl border border-line bg-card p-4 font-mono text-[13px] leading-[1.6] text-muted">{[...(ids.length ? ids : ["No PayPal payment was started."]), `Your rules: ${row.rulesSay} · Safety check: ${row.safetyCheck}${row.riskScore != null ? ` (${row.riskScore}/100)` : ""}`, `Request id ${row.id}`, mode === "mock" ? "mock payments — PAYPAL_MODE=mock" : "PayPal Sandbox · test money"].join("\n")}</pre>
        ) : null}
        <div className="mt-auto"><Button variant="outline" onClick={onClose}>Close</Button></div>
      </aside>
    </div>
  );
}

interface Step { label: string; text: string; sub?: string[]; dot: string }
const INK = "#1C1B19", GOLD = "#D9A21B", PAID = "#2F8F5B", HOLD = "#E5771E", BLOCKED = "#D2483C", MUTED = "#6B665C";

function storySteps(row: ActivityRow, events: AuditEvent[]): Step[] {
  const steps: Step[] = [];
  steps.push({ label: "What you asked for", text: `“${row.task}”`, dot: INK });
  const req = events.find((e) => e.type === "request_received");
  if (req) steps.push({ label: "What Scout asked", text: `Scout asked to pay ${row.amount} at ${row.store} for ${row.items}.`, sub: typeof req.data.reason === "string" && req.data.reason ? [`Scout's reason: “${req.data.reason}”`] : undefined, dot: INK });
  const pol = events.find((e) => e.type === "policy_evaluated");
  if (pol) {
    const d = pol.data as { outcome?: string; reasons?: string[]; rulesApplied?: string[] };
    steps.push({ label: "Your rules", text: d.outcome === "ALLOW" ? "Within your rules." : d.outcome === "REVIEW" ? "Your rules said to ask you first." : "Your rules blocked it.", sub: d.reasons?.filter((r) => r !== "Within your rules."), dot: d.outcome === "ALLOW" ? PAID : d.outcome === "REVIEW" ? HOLD : BLOCKED });
  }
  const risk = events.find((e) => e.type === "risk_checked");
  if (risk) {
    const d = risk.data as { verdict?: { verdict: string; risk_score: number; reasons: string[] }; unavailable?: boolean };
    if (!d.verdict) steps.push({ label: "Safety check", text: "Skipped: your rules had already blocked it.", dot: MUTED });
    else if (d.unavailable) steps.push({ label: "Safety check", text: "The automatic check wasn't available, so this needed your OK.", dot: HOLD });
    else steps.push({ label: "Safety check", text: d.verdict.verdict === "ok" ? "Looks fine." : d.verdict.verdict === "review" ? "Needs your OK." : "Blocked.", sub: d.verdict.reasons, dot: d.verdict.verdict === "ok" ? PAID : d.verdict.verdict === "review" ? HOLD : BLOCKED });
  }
  for (const e of events) {
    if (e.type.startsWith("paypal_") && e.type !== "paypal_webhook") steps.push({ label: "PayPal", text: e.message, dot: e.type === "paypal_failed" ? BLOCKED : e.type === "paypal_voided" ? MUTED : e.type === "paypal_captured" ? PAID : GOLD });
    if (e.type.startsWith("approval_")) steps.push({ label: "You", text: e.message, dot: e.type === "approval_approved" ? PAID : e.type === "approval_denied" ? MUTED : HOLD });
  }
  if (row.status === "BLOCKED") steps.push({ label: "PayPal", text: "No PayPal payment was started. You weren't charged.", dot: MUTED });
  return steps;
}
