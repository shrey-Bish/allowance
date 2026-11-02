import { prisma } from "@/lib/db";
import { denyRequest } from "@/lib/guard/service";
import { fail, handle, ok } from "@/lib/api/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const approval = await prisma.approval.findFirst({ where: { OR: [{ id }, { purchaseRequestId: id }] } });
    if (!approval) return fail("Unknown approval", 404);
    const via = (req.headers.get("x-allowance-via") as "dashboard" | "voice" | "api" | null) ?? "dashboard";
    const result = await denyRequest(approval.purchaseRequestId, via);
    return ok({ ...result, message: "Hold released, you weren't charged." });
  });
}
