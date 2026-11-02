import { z } from "zod";
import { prisma } from "@/lib/db";
import { getDemoUser } from "@/lib/user";
import { audit } from "@/lib/audit";
import { runAgent, type AgentEvent } from "@/lib/agent";
import { budgetSnapshot, loadPolicy } from "@/lib/guard/service";
import { fail } from "@/lib/api/http";

const Body = z.object({ task: z.string().min(3).max(1000) });

export const dynamic = "force-dynamic";

/**
 * Runs the demo shopping agent and streams events as Server-Sent Events.
 * The ORIGINAL task is recorded on the session here, from the user's own
 * message — the agent can never rewrite it.
 */
export async function POST(req: Request) {
  let task: string;
  try {
    ({ task } = Body.parse(await req.json()));
  } catch {
    return fail("Tell Scout what to buy (3+ characters).", 400);
  }

  const user = await getDemoUser();
  const session = await prisma.agentSession.create({ data: { userId: user.id, originalTask: task } });
  await prisma.agentMessage.create({ data: { sessionId: session.id, role: "user", content: task } });
  await audit("session_started", `New task: "${task}"`, { sessionId: session.id, data: { source: "chat" } });

  const policy = await loadPolicy(user.id);
  const budget = await budgetSnapshot(user.id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AgentEvent) => controller.enqueue(encoder.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
      send({ type: "session", sessionId: session.id });
      const keepAlive = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15_000);
      try {
        await runAgent({
          sessionId: session.id,
          budget: { weeklyBudgetCents: budget.weeklyBudgetCents, remainingCents: budget.remainingCents, approvalThresholdCents: policy.approvalThresholdCents },
          onEvent: send,
        });
      } finally {
        clearInterval(keepAlive);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
