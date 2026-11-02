// The Guard (spec §3, §9): the ONLY path from an agent to money.
//   request → policy → AI check → decision → PayPal (capture / hold / nothing)
// Everything is persisted step by step so the activity log can tell the story.
import { prisma } from "@/lib/db";
import { parseJson, toJson } from "@/lib/db/json";
import { audit } from "@/lib/audit";
import { evaluatePolicy, type HistoryEntry } from "@/lib/policy";
import { checkRisk, verdictToOutcome } from "@/lib/risk";
import { getPayPal, PayPalError } from "@/lib/paypal";
import { assertTransition, SPENT_STATUSES } from "@/lib/guard/status";
import {
  CategoryRulesSchema,
  mostSevere,
  PurchaseItemSchema,
  StringArraySchema,
  type AgentPurchaseResult,
  type Outcome,
  type PolicyInput,
  type PurchaseItem,
  type RequestStatus,
} from "@/lib/types";
import { z } from "zod";
import { formatUsd } from "@/lib/money";

export const PurchaseRequestInputSchema = z.object({
  sessionId: z.string().min(1),
  merchantId: z.string().min(1),
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive().max(99) })).min(1).max(30),
  reason: z.string().max(500).default(""),
});
export type PurchaseRequestInput = z.infer<typeof PurchaseRequestInputSchema>;

export class GuardError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "GuardError";
  }
}

// ---- policy loading -------------------------------------------------------

export async function loadPolicy(userId: string): Promise<PolicyInput> {
  const row = await prisma.policy.findUnique({ where: { userId } });
  if (!row) throw new GuardError("No rules set for this user", 500);
  return {
    maxPerPurchaseCents: row.maxPerPurchaseCents,
    approvalThresholdCents: row.approvalThresholdCents,
    weeklyBudgetCents: row.weeklyBudgetCents,
    allowedMerchantIds: parseJson(row.allowedMerchantIds, StringArraySchema, []),
    blockedMerchantIds: parseJson(row.blockedMerchantIds, StringArraySchema, []),
    newMerchantRequiresApproval: row.newMerchantRequiresApproval,
    categoryRules: parseJson(row.categoryRules, CategoryRulesSchema, {}),
    maxQuantityPerItem: row.maxQuantityPerItem,
    duplicateWindowHours: row.duplicateWindowHours,
    approvalExpiryMinutes: row.approvalExpiryMinutes,
  };
}

const ItemsSchema = z.array(PurchaseItemSchema);

export type RichHistoryEntry = HistoryEntry & { merchantName: string; itemNames: string[] };

export async function loadHistory(userId: string, days = 7): Promise<RichHistoryEntry[]> {
  const since = new Date(Date.now() - days * 864e5);
  const rows = await prisma.purchaseRequest.findMany({
    where: { session: { userId }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    include: { merchant: { select: { name: true } } },
  });
  return rows.map((r) => {
    const items = parseJson(r.items, ItemsSchema, []);
    const status = r.status as RequestStatus;
    return {
      merchantId: r.merchantId,
      merchantName: r.merchant.name,
      productIds: items.map((i) => i.productId),
      itemNames: items.map((i) => i.name),
      amountCents: r.amountCents,
      spent: SPENT_STATUSES.includes(status),
      completed: status === "COMPLETED",
      createdAt: r.createdAt,
    };
  });
}

export async function budgetSnapshot(userId: string) {
  const policy = await loadPolicy(userId);
  const history = await loadHistory(userId);
  const spentThisWeekCents = history.filter((h) => h.spent).reduce((s, h) => s + h.amountCents, 0);
  const pending = await prisma.purchaseRequest.aggregate({
    where: { session: { userId }, status: "PENDING_APPROVAL" },
    _sum: { amountCents: true },
  });
  return {
    weeklyBudgetCents: policy.weeklyBudgetCents,
    spentThisWeekCents,
    heldCents: pending._sum.amountCents ?? 0,
    remainingCents: Math.max(0, policy.weeklyBudgetCents - spentThisWeekCents),
  };
}

// ---- the main entry point ---------------------------------------------------

export async function createPurchaseRequest(input: PurchaseRequestInput): Promise<AgentPurchaseResult> {
  const session = await prisma.agentSession.findUnique({ where: { id: input.sessionId }, include: { user: true } });
  if (!session) throw new GuardError("Unknown session", 404);
  const merchant = await prisma.merchant.findUnique({ where: { id: input.merchantId } });
  if (!merchant) throw new GuardError("Unknown store", 404);

  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, merchantId: merchant.id } });
  if (products.length !== new Set(productIds).size) {
    throw new GuardError("One or more items don't belong to this store", 400);
  }

  const items: PurchaseItem[] = input.items.map((i) => {
    const p = products.find((pp) => pp.id === i.productId)!;
    return { productId: p.id, name: p.name, category: p.category, quantity: i.quantity, unitPriceCents: p.priceCents, referenceKey: p.referenceKey };
  });
  const amountCents = items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);

  const request = await prisma.purchaseRequest.create({
    data: {
      sessionId: session.id,
      merchantId: merchant.id,
      items: toJson(items),
      amountCents,
      agentReason: input.reason,
      status: "RECEIVED",
    },
  });
  await audit("request_received", `Scout asked to pay ${formatUsd(amountCents)} at ${merchant.name}.`, {
    requestId: request.id,
    sessionId: session.id,
    data: { items, reason: input.reason },
  });
  await setStatus(request.id, "RECEIVED", "EVALUATING");

  // 1) deterministic rules
  const policy = await loadPolicy(session.userId);
  const history = await loadHistory(session.userId);
  const policyEval = evaluatePolicy({ merchantId: merchant.id, merchantName: merchant.name, items, amountCents }, policy, history);
  await audit("policy_evaluated", `Your rules say: ${policyEval.outcome.toLowerCase()}.`, {
    requestId: request.id,
    sessionId: session.id,
    data: { outcome: policyEval.outcome, reasons: policyEval.reasons, rulesApplied: policyEval.rulesApplied },
  });

  // 2) AI safety check (skipped when rules already BLOCK — it can only tighten)
  let aiVerdict: string | null = null;
  let aiRiskScore: number | null = null;
  let aiReasons: string[] = [];
  let aiSignals: unknown = {};
  let aiUnavailable = false;
  let finalOutcome: Outcome = policyEval.outcome;

  if (policyEval.outcome !== "BLOCK") {
    const refPrices = await referencePrices(items, merchant.id);
    const risk = await checkRisk({
      originalTask: session.originalTask,
      merchant: {
        name: merchant.name,
        category: merchant.category,
        accountAgeDays: merchant.accountAgeDays,
        isKnown: history.some((h) => h.completed && h.merchantId === merchant.id),
      },
      items: items.map((i) => {
        const p = products.find((pp) => pp.id === i.productId)!;
        return {
          name: i.name,
          category: i.category,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
          referencePriceCents: i.referenceKey ? (refPrices.get(i.referenceKey) ?? null) : null,
          description: p.description,
        };
      }),
      totalCents: amountCents,
      agentReason: input.reason,
      recentPurchases: history.slice(0, 10).map((h) => ({
        merchantName: h.merchantName,
        itemNames: h.itemNames,
        amountCents: h.amountCents,
        daysAgo: Math.floor((Date.now() - h.createdAt.getTime()) / 864e5),
      })),
      policyOutcome: policyEval.outcome,
      policyReasons: policyEval.reasons,
    });
    aiVerdict = risk.verdict.verdict;
    aiRiskScore = risk.verdict.risk_score;
    aiReasons = risk.verdict.reasons;
    aiSignals = risk.verdict.signals;
    aiUnavailable = risk.unavailable;
    finalOutcome = mostSevere(policyEval.outcome, verdictToOutcome(risk.verdict.verdict));
    await audit("risk_checked", `Safety check: ${labelVerdict(risk.verdict.verdict)}${risk.unavailable ? " (automatic check unavailable)" : ""}.`, {
      requestId: request.id,
      sessionId: session.id,
      data: { verdict: risk.verdict, unavailable: risk.unavailable, model: risk.model, latencyMs: risk.latencyMs, prompt: risk.prompt, error: risk.rawError },
    });
  } else {
    await audit("risk_checked", "Safety check skipped: already blocked by your rules.", { requestId: request.id, sessionId: session.id });
  }

  await prisma.decision.create({
    data: {
      purchaseRequestId: request.id,
      policyOutcome: policyEval.outcome,
      policyReasons: toJson(policyEval.reasons),
      aiVerdict,
      aiRiskScore,
      aiReasons: toJson(aiReasons),
      aiSignals: toJson(aiSignals),
      aiUnavailable,
      finalOutcome,
    },
  });
  const reasons = dedupe([...(policyEval.outcome === "ALLOW" && finalOutcome !== "ALLOW" ? [] : policyEval.reasons), ...aiReasons]).filter(
    (r) => !(finalOutcome !== "ALLOW" && r === "Within your rules."),
  );
  await audit("decision_made", `Decision: ${finalOutcome.toLowerCase()}.`, { requestId: request.id, sessionId: session.id, data: { finalOutcome, reasons } });

  // 3) act
  if (finalOutcome === "BLOCK") {
    await setStatus(request.id, "EVALUATING", "BLOCKED");
    return { request_id: request.id, status: "blocked", reasons, amount: formatUsd(amountCents) };
  }

  const vaultId = session.user.paypalVaultId;
  if (!vaultId) {
    await setStatus(request.id, "EVALUATING", "FAILED");
    await audit("paypal_failed", "PayPal isn't linked yet, so nothing was charged.", { requestId: request.id, sessionId: session.id });
    return { request_id: request.id, status: "failed", reasons: ["PayPal isn't linked yet. Link it on the Connect page first."], amount: formatUsd(amountCents) };
  }

  const paypal = getPayPal();
  const description = `${merchant.name}: ${items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}`;

  if (finalOutcome === "ALLOW") {
    await setStatus(request.id, "EVALUATING", "APPROVED_AUTO");
    await setStatus(request.id, "APPROVED_AUTO", "CAPTURING");
    try {
      const order = await paypal.createOrder({ intent: "CAPTURE", amountCents, description, referenceId: request.id, vaultId });
      await audit("paypal_order_created", `PayPal order ${order.orderId} created.`, { requestId: request.id, sessionId: session.id, data: { orderId: order.orderId, status: order.status, mode: paypal.mode } });
      const cap = order.captureId ? { captureId: order.captureId, status: order.status, raw: order.raw } : await paypal.captureOrder(order.orderId, request.id);
      await prisma.payment.create({
        data: { purchaseRequestId: request.id, paypalOrderId: order.orderId, paypalCaptureId: cap.captureId, status: "CAPTURED", amountCents, rawResponse: toJson({ order: order.raw, capture: cap.raw }) },
      });
      await setStatus(request.id, "CAPTURING", "COMPLETED");
      await audit("paypal_captured", `Paid ${formatUsd(amountCents)} to ${merchant.name}.`, { requestId: request.id, sessionId: session.id, data: { captureId: cap.captureId, mode: paypal.mode } });
      return { request_id: request.id, status: "approved", reasons, amount: formatUsd(amountCents) };
    } catch (err) {
      return await failPayment(request.id, session.id, "CAPTURING", amountCents, err, reasons);
    }
  }

  // REVIEW → hold the money, ask the user
  try {
    const order = await paypal.createOrder({ intent: "AUTHORIZE", amountCents, description, referenceId: request.id, vaultId });
    await audit("paypal_order_created", `PayPal order ${order.orderId} created (hold).`, { requestId: request.id, sessionId: session.id, data: { orderId: order.orderId, status: order.status, mode: paypal.mode } });
    const auth = order.authorizationId ? { authorizationId: order.authorizationId, status: order.status, raw: order.raw } : await paypal.authorizeOrder(order.orderId, request.id);
    await prisma.payment.create({
      data: { purchaseRequestId: request.id, paypalOrderId: order.orderId, paypalAuthorizationId: auth.authorizationId, status: "AUTHORIZED", amountCents, rawResponse: toJson({ order: order.raw, authorization: auth.raw }) },
    });
    const expiresAt = new Date(Date.now() + policy.approvalExpiryMinutes * 60_000);
    await prisma.approval.create({ data: { purchaseRequestId: request.id, status: "PENDING", expiresAt } });
    await setStatus(request.id, "EVALUATING", "PENDING_APPROVAL");
    await audit("paypal_authorized", `PayPal is holding ${formatUsd(amountCents)} until you decide.`, { requestId: request.id, sessionId: session.id, data: { authorizationId: auth.authorizationId, expiresAt, mode: paypal.mode } });
    await audit("approval_requested", `Waiting for your OK (expires in ${policy.approvalExpiryMinutes} min).`, { requestId: request.id, sessionId: session.id });
    return { request_id: request.id, status: "pending_approval", reasons, amount: formatUsd(amountCents), expires_at: expiresAt.toISOString() };
  } catch (err) {
    return await failPayment(request.id, session.id, "EVALUATING", amountCents, err, reasons);
  }
}

// ---- approvals ----------------------------------------------------------------

export async function approveRequest(requestId: string, via: "dashboard" | "voice" | "api" = "dashboard") {
  const req = await loadForApproval(requestId);
  if (req.status !== "PENDING_APPROVAL") throw new GuardError(`This request is no longer waiting (${req.status}).`, 409);
  if (req.approval!.expiresAt.getTime() < Date.now()) {
    await expireRequest(requestId);
    throw new GuardError("Too late — the hold already expired and was released.", 409);
  }
  await setStatus(requestId, "PENDING_APPROVAL", "APPROVED_BY_USER");
  await prisma.approval.update({ where: { purchaseRequestId: requestId }, data: { status: "APPROVED", respondedAt: new Date(), respondedVia: via } });
  await audit("approval_approved", `You approved ${formatUsd(req.amountCents)} at ${req.merchant.name}.`, { requestId, sessionId: req.sessionId, data: { via } });
  await setStatus(requestId, "APPROVED_BY_USER", "CAPTURING");
  try {
    const cap = await getPayPal().captureAuthorization(req.payment!.paypalAuthorizationId!, req.amountCents, requestId);
    await prisma.payment.update({ where: { purchaseRequestId: requestId }, data: { paypalCaptureId: cap.captureId, status: "CAPTURED", rawResponse: toJson({ capture: cap.raw }) } });
    await setStatus(requestId, "CAPTURING", "COMPLETED");
    await audit("paypal_captured", `Paid ${formatUsd(req.amountCents)} to ${req.merchant.name}.`, { requestId, sessionId: req.sessionId, data: { captureId: cap.captureId } });
    return { status: "COMPLETED" as const, captureId: cap.captureId };
  } catch (err) {
    await failPayment(requestId, req.sessionId, "CAPTURING", req.amountCents, err, []);
    throw new GuardError("PayPal couldn't complete the payment. Nothing more was charged.", 502);
  }
}

export async function denyRequest(requestId: string, via: "dashboard" | "voice" | "api" = "dashboard") {
  const req = await loadForApproval(requestId);
  if (req.status !== "PENDING_APPROVAL") throw new GuardError(`This request is no longer waiting (${req.status}).`, 409);
  await setStatus(requestId, "PENDING_APPROVAL", "DENIED");
  await prisma.approval.update({ where: { purchaseRequestId: requestId }, data: { status: "DENIED", respondedAt: new Date(), respondedVia: via } });
  await audit("approval_denied", `You said no to ${formatUsd(req.amountCents)} at ${req.merchant.name}.`, { requestId, sessionId: req.sessionId, data: { via } });
  await releaseHold(requestId, req.sessionId, req.payment!.paypalAuthorizationId!, "DENIED");
  return { status: "VOIDED" as const };
}

export async function expireRequest(requestId: string) {
  const req = await loadForApproval(requestId);
  if (req.status !== "PENDING_APPROVAL") return;
  await setStatus(requestId, "PENDING_APPROVAL", "EXPIRED");
  await prisma.approval.update({ where: { purchaseRequestId: requestId }, data: { status: "EXPIRED", respondedAt: new Date() } });
  await audit("approval_expired", `No answer in time, so the ${formatUsd(req.amountCents)} hold was released.`, { requestId, sessionId: req.sessionId });
  await releaseHold(requestId, req.sessionId, req.payment!.paypalAuthorizationId!, "EXPIRED");
}

/** Expire-on-read: call from any loader that shows approvals/activity. */
export async function expireOverdueApprovals(): Promise<number> {
  const overdue = await prisma.approval.findMany({ where: { status: "PENDING", expiresAt: { lt: new Date() } }, select: { purchaseRequestId: true } });
  for (const a of overdue) {
    try {
      await expireRequest(a.purchaseRequestId);
    } catch (err) {
      console.error("[guard] expire failed", a.purchaseRequestId, err);
    }
  }
  return overdue.length;
}

// ---- helpers ------------------------------------------------------------------

async function releaseHold(requestId: string, sessionId: string, authorizationId: string, from: "DENIED" | "EXPIRED") {
  try {
    const v = await getPayPal().voidAuthorization(authorizationId, requestId);
    await prisma.payment.update({ where: { purchaseRequestId: requestId }, data: { status: "VOIDED", rawResponse: toJson({ void: v.raw }) } });
    await setStatus(requestId, from, "VOIDED");
    await audit("paypal_voided", "Hold released — you weren't charged.", { requestId, sessionId, data: { authorizationId } });
  } catch (err) {
    await failPayment(requestId, sessionId, from, 0, err, []);
  }
}

async function failPayment(requestId: string, sessionId: string, from: RequestStatus, amountCents: number, err: unknown, reasons: string[]): Promise<AgentPurchaseResult> {
  const debugId = err instanceof PayPalError ? err.debugId : undefined;
  const message = err instanceof Error ? err.message : String(err);
  console.error("[guard] paypal failure", requestId, message);
  await prisma.payment.upsert({
    where: { purchaseRequestId: requestId },
    create: { purchaseRequestId: requestId, status: "FAILED", amountCents, paypalDebugId: debugId, rawResponse: toJson({ error: message }) },
    update: { status: "FAILED", paypalDebugId: debugId, rawResponse: toJson({ error: message }) },
  });
  await setStatus(requestId, from, "FAILED");
  await audit("paypal_failed", "PayPal returned an error, so this didn't go through.", { requestId, sessionId, data: { error: message, debugId } });
  return { request_id: requestId, status: "failed", reasons: [...reasons, "PayPal returned an error. Nothing was charged."], amount: formatUsd(amountCents) };
}

async function setStatus(requestId: string, from: RequestStatus, to: RequestStatus) {
  assertTransition(from, to);
  await prisma.purchaseRequest.update({ where: { id: requestId }, data: { status: to } });
}

async function loadForApproval(requestId: string) {
  const req = await prisma.purchaseRequest.findUnique({ where: { id: requestId }, include: { approval: true, payment: true, merchant: true } });
  if (!req) throw new GuardError("Unknown request", 404);
  if (!req.approval || !req.payment?.paypalAuthorizationId) throw new GuardError("This request has no hold to act on", 409);
  return req;
}

/** Median price per referenceKey across OTHER stores (falls back to all stores). */
async function referencePrices(items: PurchaseItem[], requestingMerchantId: string): Promise<Map<string, number>> {
  const keys = items.map((i) => i.referenceKey).filter((k): k is string => Boolean(k));
  if (!keys.length) return new Map();
  const rows = await prisma.product.findMany({ where: { referenceKey: { in: keys } }, select: { referenceKey: true, priceCents: true, merchantId: true } });
  const out = new Map<string, number>();
  for (const key of new Set(keys)) {
    const all = rows.filter((r) => r.referenceKey === key);
    const others = all.filter((r) => r.merchantId !== requestingMerchantId);
    const pool = (others.length ? others : all).map((r) => r.priceCents).sort((a, b) => a - b);
    if (pool.length) out.set(key, pool[Math.floor((pool.length - 1) / 2)]);
  }
  return out;
}

function dedupe(list: string[]): string[] {
  return Array.from(new Set(list));
}

function labelVerdict(v: string): string {
  return v === "ok" ? "looks fine" : v === "review" ? "needs your OK" : "blocked";
}
