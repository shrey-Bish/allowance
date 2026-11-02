import { prisma } from "@/lib/db";
import { clearDemoActivity, seedDatabase } from "@/lib/catalog/seed";
import { getPayPal } from "@/lib/paypal";
import { audit } from "@/lib/audit";
import { handle, ok } from "@/lib/api/http";

/** Reset the demo: void any open holds, wipe activity, reseed catalog + rules. Keeps the PayPal link. */
export async function POST() {
  return handle(async () => {
    const open = await prisma.payment.findMany({ where: { status: "AUTHORIZED", paypalAuthorizationId: { not: null } } });
    const paypal = getPayPal();
    let voided = 0;
    for (const p of open) {
      try {
        await paypal.voidAuthorization(p.paypalAuthorizationId!, `reset-${p.purchaseRequestId}`);
        voided += 1;
      } catch (err) {
        console.error("[reset] void failed", p.paypalAuthorizationId, err);
      }
    }
    await clearDemoActivity(prisma);
    const summary = await seedDatabase(prisma);
    await audit("demo_reset", `Demo reset. ${voided} hold(s) released.`, { data: { voided, ...summary } });
    return ok({ ok: true, voided, ...summary });
  });
}
