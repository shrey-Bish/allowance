// Client-side view model for purchase rows (shared by the chat feed + approvals).
import type { PillKind } from "@/components/ui";
import type { CamScene, ShopIndex } from "@/components/stage/agent-cam";
import { SHOP_INDEX } from "@/components/stage/agent-cam";

export interface ActivityRow {
  id: string;
  time: string;
  store: string;
  storeSlug: string;
  items: string;
  itemCount: number;
  itemsLabel: string;
  category: string;
  amountCents: number;
  amount: string;
  status: string;
  result: string;
  safetyCheck: string;
  rulesSay: string;
  riskScore: number | null;
  reason: string;
  reasons: string[];
  aiReasons: string[];
  task: string;
  paypalStatus: string;
  paypalOrderId: string | null;
  paypalAuthorizationId: string | null;
  paypalCaptureId: string | null;
  expiresAt: string | null;
}

export interface ActivityResponse {
  activity: ActivityRow[];
  budget: { weeklyBudgetCents: number; spentThisWeekCents: number; heldCents: number; remainingCents: number };
  counts: { paid: number; waiting: number; blocked: number; released: number };
}

export async function fetchActivity(): Promise<ActivityResponse> {
  const r = await fetch("/api/activity", { cache: "no-store" });
  if (!r.ok) throw new Error("Couldn't load activity");
  return r.json();
}

export function pillOf(status: string): PillKind {
  switch (status) {
    case "COMPLETED": return "paid";
    case "PENDING_APPROVAL": return "hold";
    case "BLOCKED": return "blocked";
    case "FAILED": return "failed";
    case "APPROVED_AUTO": case "APPROVED_BY_USER": case "CAPTURING": return "paid";
    default: return "released"; // DENIED / EXPIRED / VOIDED
  }
}

/** One plain sentence for the card. */
export function sentenceOf(row: ActivityRow, viaUser?: "approved" | "denied"): string {
  const kind = pillOf(row.status);
  if (viaUser === "approved" || (kind === "paid" && row.paypalAuthorizationId)) return `You approved it, so PayPal paid ${row.store}.`;
  if (kind === "paid") return row.reason || "Within your rules.";
  if (kind === "hold") return `${row.reason.replace(/, so it needs your OK\.?$/, ".")} PayPal is holding ${row.amount} until you decide.`;
  if (kind === "blocked") return `${row.reason} You weren't charged.`;
  if (row.status === "EXPIRED") return "No answer in time, so the hold was released. You weren't charged.";
  if (kind === "released") return "Hold released, you weren't charged.";
  return "PayPal returned an error, so this didn't go through. Nothing was charged.";
}

/** Secondary line: what the safety check added (only when it tightened things). */
export function safetyLine(row: ActivityRow): string | null {
  const kind = pillOf(row.status);
  if (kind !== "blocked" && kind !== "hold") return null;
  const extra = row.reasons.filter((r) => r !== row.reason).slice(0, 2);
  if (!extra.length) return null;
  return `Safety check: ${kind === "blocked" ? "blocked" : "needs your OK"}. ${extra.join(" ")}`;
}

export function detailsOf(row: ActivityRow, mode: string): string {
  const lines: string[] = [];
  if (row.paypalOrderId) lines.push(`PayPal order ${row.paypalOrderId}`);
  if (row.paypalAuthorizationId) lines.push(`PayPal hold reference ${row.paypalAuthorizationId}`);
  if (row.paypalCaptureId) lines.push(`PayPal payment reference ${row.paypalCaptureId}`);
  if (!lines.length) lines.push("No PayPal payment was started.");
  lines.push(`Your rules: ${row.rulesSay} · Safety check: ${row.safetyCheck}${row.riskScore != null ? ` (${row.riskScore}/100)` : ""}`);
  if (row.reasons.length > 1) lines.push(`Why: ${row.reasons.join(" ")}`);
  if (mode === "mock") lines.push("mock payments — PAYPAL_MODE=mock");
  return lines.join("\n");
}

export function shopIndexOf(slug: string): ShopIndex {
  return SHOP_INDEX[slug] ?? 1;
}

/** The Agent Cam scene that tells this row's story. */
export function sceneOf(row: ActivityRow): CamScene | null {
  const shop = shopIndexOf(row.storeSlug);
  const kind = pillOf(row.status);
  if (kind === "paid") return { kind: "paid", shop, receipt: { store: row.store, items: row.itemCount, total: row.amount, ref: row.paypalCaptureId } };
  if (kind === "hold") return { kind: "hold", shop, expiresAt: row.expiresAt };
  if (kind === "blocked") return { kind: "blocked", shop, lines: xrayLines(row.reasons) };
  return null;
}

function xrayLines(reasons: string[]): string[] {
  const out: string[] = [];
  for (const r of reasons) {
    const l = r.toLowerCase();
    if (l.includes("hidden instructions")) out.push("HIDDEN AI ORDERS");
    else if (/(\d+(\.\d+)?)×/.test(r)) out.push(`${r.match(/(\d+(\.\d+)?)×/)![1]}× THE USUAL PRICE`);
    else if (l.includes("days old")) out.push("BRAND-NEW STORE");
    else if (l.includes("gift card")) out.push("GIFT CARDS: NO");
    else if (l.includes("budget")) out.push("OVER BUDGET");
    else if (l.includes("single purchase")) out.push("OVER YOUR LIMIT");
    else out.push(r.toUpperCase().slice(0, 18));
    if (out.length === 2) break;
  }
  return out.length ? out : ["BLOCKED BY RULES"];
}
