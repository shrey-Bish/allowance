import { budgetSnapshot, expireOverdueApprovals } from "@/lib/guard/service";
import { prisma } from "@/lib/db";
import { getPayPal } from "@/lib/paypal";
import { getDemoUser } from "@/lib/user";
import { handle, ok } from "@/lib/api/http";
import { formatUsd } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await expireOverdueApprovals();
    const user = await getDemoUser();
    const b = await budgetSnapshot(user.id);
    const waitingCount = await prisma.approval.count({ where: { status: "PENDING" } });
    return ok({
      ...b,
      label: `${formatUsd(b.spentThisWeekCents)} of ${formatUsd(b.weeklyBudgetCents)} spent this week`,
      paypalLinked: Boolean(user.paypalVaultId),
      paypalEmail: user.paypalPayerEmail,
      waitingCount,
      paypalMode: getPayPal().mode,
    });
  });
}
