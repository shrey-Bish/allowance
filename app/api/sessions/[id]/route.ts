import { prisma } from "@/lib/db";
import { fail, handle, ok } from "@/lib/api/http";

/** Reload a chat session (messages + decisions) for the chat screen. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const s = await prisma.agentSession.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
    if (!s) return fail("Not found", 404);
    return ok({ id: s.id, task: s.originalTask, status: s.status, isReplay: s.isReplay, messages: s.messages });
  });
}
