import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/db/json";
import { budgetSnapshot, expireOverdueApprovals } from "@/lib/guard/service";
import { getDemoUser } from "@/lib/user";
import { handle, ok } from "@/lib/api/http";
import { formatUsd } from "@/lib/money";
import { OUTCOME_LABEL, PurchaseItemSchema, STATUS_LABEL, StringArraySchema, type Outcome, type RequestStatus } from "@/lib/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Rows for the AG Grid activity log + the summary line (spec §12.5). */
export async function GET() {
  return handle(async () => {
    await expireOverdueApprovals();
    const user = await getDemoUser();
    const rows = await prisma.purchaseRequest.findMany({
      where: { session: { userId: user.id } },
      orderBy: { createdAt: "desc" },
      include: { merchant: true, decision: true, approval: true, payment: true, session: { select: { originalTask: true } } },
      take: 500,
    });
    const activity = rows.map((r) => {
      const items = parseJson(r.items, z.array(PurchaseItemSchema), []);
      const policyReasons = parseJson(r.decision?.policyReasons, StringArraySchema, []);
      const aiReasons = parseJson(r.decision?.aiReasons, StringArraySchema, []);
      const final = (r.decision?.finalOutcome ?? "REVIEW") as Outcome;
      return {
        id: r.id,
        time: r.createdAt,
        store: r.merchant.name,
        storeSlug: r.merchant.slug,
        items: items.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ""}${i.name}`).join(", "),
        itemCount: items.reduce((s, i) => s + i.quantity, 0),
        amountCents: r.amountCents,
        amount: formatUsd(r.amountCents),
        status: r.status,
        result: STATUS_LABEL[r.status as RequestStatus] ?? r.status,
        safetyCheck: r.decision?.aiVerdict ? OUTCOME_LABEL[final] : r.decision ? "skipped (rules already blocked it)" : "—",
        riskScore: r.decision?.aiRiskScore ?? null,
        reason: Array.from(new Set([...policyReasons, ...aiReasons])).filter((x) => !(final !== "ALLOW" && x === "Within your rules."))[0] ?? "",
        reasons: Array.from(new Set([...policyReasons, ...aiReasons])),
        task: r.session.originalTask,
        paypalStatus: r.payment?.status ?? "NONE",
        paypalOrderId: r.payment?.paypalOrderId ?? null,
        paypalAuthorizationId: r.payment?.paypalAuthorizationId ?? null,
        paypalCaptureId: r.payment?.paypalCaptureId ?? null,
        expiresAt: r.approval?.expiresAt ?? null,
      };
    });
    const budget = await budgetSnapshot(user.id);
    const counts = {
      paid: rows.filter((r) => r.status === "COMPLETED").length,
      waiting: rows.filter((r) => r.status === "PENDING_APPROVAL").length,
      blocked: rows.filter((r) => r.status === "BLOCKED").length,
      released: rows.filter((r) => r.status === "VOIDED").length,
    };
    return ok({ activity, budget, counts });
  });
}
