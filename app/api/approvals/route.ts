import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/db/json";
import { expireOverdueApprovals } from "@/lib/guard/service";
import { handle, ok } from "@/lib/api/http";
import { formatUsd } from "@/lib/money";
import { PurchaseItemSchema, StringArraySchema } from "@/lib/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Pending approvals for the inbox (expire-on-read). */
export async function GET(req: Request) {
  return handle(async () => {
    await expireOverdueApprovals();
    const status = new URL(req.url).searchParams.get("status") ?? "PENDING";
    const rows = await prisma.approval.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      include: { purchaseRequest: { include: { merchant: true, decision: true, payment: true } } },
    });
    const approvals = await Promise.all(
      rows.map(async (a) => {
        const r = a.purchaseRequest;
        const items = parseJson(r.items, z.array(PurchaseItemSchema), []);
        const policyReasons = r.decision?.policyOutcome === "REVIEW" ? parseJson(r.decision.policyReasons, StringArraySchema, []) : [];
        const aiReasons = r.decision?.aiVerdict === "review" ? parseJson(r.decision.aiReasons, StringArraySchema, []) : [];
        const reasons = [...policyReasons, ...aiReasons];
        const usual = await usualPrice(items);
        return {
          id: a.id,
          requestId: r.id,
          status: a.status,
          expiresAt: a.expiresAt,
          respondedAt: a.respondedAt,
          store: r.merchant.name,
          storeSlug: r.merchant.slug,
          items: items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: formatUsd(i.unitPriceCents), productId: i.productId })),
          amountCents: r.amountCents,
          amount: formatUsd(r.amountCents),
          usualAmount: usual != null ? formatUsd(usual) : null,
          reasons: Array.from(new Set(reasons)),
          riskScore: r.decision?.aiRiskScore ?? null,
          paypalAuthorizationId: r.payment?.paypalAuthorizationId ?? null,
          paypalOrderId: r.payment?.paypalOrderId ?? null,
        };
      }),
    );
    return ok({ approvals });
  });
}

async function usualPrice(items: Array<{ referenceKey?: string | null; quantity: number; unitPriceCents: number; productId: string }>): Promise<number | null> {
  let total = 0;
  let any = false;
  for (const it of items) {
    if (!it.referenceKey) {
      total += it.unitPriceCents * it.quantity;
      continue;
    }
    const others = await prisma.product.findMany({ where: { referenceKey: it.referenceKey, NOT: { id: it.productId } }, select: { priceCents: true } });
    if (!others.length) {
      total += it.unitPriceCents * it.quantity;
      continue;
    }
    const sorted = others.map((o) => o.priceCents).sort((a, b) => a - b);
    total += sorted[Math.floor((sorted.length - 1) / 2)] * it.quantity;
    any = true;
  }
  return any ? total : null;
}
