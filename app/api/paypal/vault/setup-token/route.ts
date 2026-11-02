import { getPayPal } from "@/lib/paypal";
import { handle, ok } from "@/lib/api/http";

/** Step 1 of linking PayPal: create a setup token the PayPal button approves. */
export async function POST() {
  return handle(async () => {
    const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
    const paypal = getPayPal();
    const setup = await paypal.createSetupToken(`${base}/connect?paypal=return`, `${base}/connect?paypal=cancel`);
    return ok({ setup_token_id: setup.setupTokenId, approve_url: setup.approveUrl ?? null, mode: paypal.mode });
  });
}
