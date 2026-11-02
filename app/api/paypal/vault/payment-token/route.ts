import { z } from "zod";
import { prisma } from "@/lib/db";
import { getPayPal } from "@/lib/paypal";
import { getDemoUser } from "@/lib/user";
import { audit } from "@/lib/audit";
import { handle, ok, parseBody } from "@/lib/api/http";

const Body = z.object({ setup_token_id: z.string().min(1) });

/** Step 2: exchange the approved setup token for a vault id and save it on the user. */
export async function POST(req: Request) {
  return handle(async () => {
    const { setup_token_id } = await parseBody(req, Body);
    const paypal = getPayPal();
    const token = await paypal.createPaymentToken(setup_token_id);
    const user = await getDemoUser();
    await prisma.user.update({ where: { id: user.id }, data: { paypalVaultId: token.vaultId, paypalPayerEmail: token.payerEmail ?? null } });
    await audit("paypal_linked", `PayPal linked${token.payerEmail ? ` (${token.payerEmail})` : ""}.`, { data: { mode: paypal.mode } });
    return ok({ linked: true, payer_email: token.payerEmail ?? null, mode: paypal.mode });
  });
}

/** Unlink (used by Settings / reset flows). */
export async function DELETE() {
  return handle(async () => {
    const user = await getDemoUser();
    await prisma.user.update({ where: { id: user.id }, data: { paypalVaultId: null, paypalPayerEmail: null } });
    return ok({ linked: false });
  });
}
