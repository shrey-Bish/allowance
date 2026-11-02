import { z } from "zod";
import { createPurchaseRequest } from "@/lib/guard/service";
import { handle, ok, parseBody, requireAgentKey } from "@/lib/api/http";

const Body = z.object({
  session_id: z.string().min(1),
  merchant_id: z.string().min(1),
  items: z.array(z.object({ product_id: z.string().min(1), quantity: z.number().int().positive().max(99) })).min(1),
  reason: z.string().max(500).default(""),
});

/** The Guard API: evaluates + acts, returns the decision (spec §11). */
export async function POST(req: Request) {
  const denied = requireAgentKey(req);
  if (denied) return denied;
  return handle(async () => {
    const b = await parseBody(req, Body);
    const result = await createPurchaseRequest({
      sessionId: b.session_id,
      merchantId: b.merchant_id,
      items: b.items.map((i) => ({ productId: i.product_id, quantity: i.quantity })),
      reason: b.reason,
    });
    return ok(result);
  });
}
