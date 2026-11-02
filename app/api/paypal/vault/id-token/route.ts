import { getUserIdToken, isPayPalConfigured } from "@/lib/paypal/client";
import { getDemoUser } from "@/lib/user";
import { handle, ok } from "@/lib/api/http";

export const dynamic = "force-dynamic";

/** The Connect page loads the PayPal JS SDK with data-user-id-token=<this>. */
export async function GET() {
  return handle(async () => {
    if (process.env.PAYPAL_MODE === "mock" || !isPayPalConfigured()) {
      return ok({ id_token: null, mode: "mock", client_id: null });
    }
    const user = await getDemoUser();
    const id_token = await getUserIdToken(user.paypalCustomerId ?? undefined);
    return ok({ id_token, mode: "sandbox", client_id: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? process.env.PAYPAL_CLIENT_ID ?? null });
  });
}
