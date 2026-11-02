import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/db/json";
import { fail, handle, ok } from "@/lib/api/http";
import { z } from "zod";

/** Full story of one purchase for the side drawer. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const r = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: { merchant: true, decision: true, approval: true, payment: true, session: true, events: { orderBy: { createdAt: "asc" } } },
    });
    if (!r) return fail("Not found", 404);
    return ok({
      request: { ...r, items: parseJson(r.items, z.array(z.any()), []) },
      events: r.events.map((e) => ({ ...e, data: parseJson(e.data, z.any(), {}) })),
    });
  });
}
