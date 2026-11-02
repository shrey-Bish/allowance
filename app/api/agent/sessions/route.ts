import { z } from "zod";
import { prisma } from "@/lib/db";
import { getDemoUser } from "@/lib/user";
import { audit } from "@/lib/audit";
import { handle, ok, parseBody, requireAgentKey } from "@/lib/api/http";

const Body = z.object({ task: z.string().min(3).max(1000) });

/** External agents (MCP, scripts) start a session by recording the user's task. */
export async function POST(req: Request) {
  const denied = requireAgentKey(req);
  if (denied) return denied;
  return handle(async () => {
    const { task } = await parseBody(req, Body);
    const user = await getDemoUser();
    const session = await prisma.agentSession.create({ data: { userId: user.id, originalTask: task } });
    await audit("session_started", `New task: "${task}"`, { sessionId: session.id, data: { source: "api" } });
    return ok({ session_id: session.id, task });
  });
}
