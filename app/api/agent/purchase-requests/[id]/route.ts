import { prisma } from "@/lib/db";
import { handle, ok, fail, requireAgentKey } from "@/lib/api/http";
import { formatUsd } from "@/lib/money";
import { STATUS_LABEL, type RequestStatus } from "@/lib/types";
import { expireOverdueApprovals } from "@/lib/guard/service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAgentKey(req);
  if (denied) return denied;
  return handle(async () => {
    await expireOverdueApprovals();
    const { id } = await params;
    const r = await prisma.purchaseRequest.findUnique({ where: { id }, include: { merchant: true, decision: true, approval: true } });
    if (!r) return fail("Unknown request", 404);
    return ok({
      request_id: r.id,
      status: r.status,
      label: STATUS_LABEL[r.status as RequestStatus] ?? r.status,
      amount: formatUsd(r.amountCents),
      store: r.merchant.name,
      expires_at: r.approval?.expiresAt ?? null,
    });
  });
}
