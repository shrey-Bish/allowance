// Small helpers shared by every route handler.
import { ZodError, type ZodType } from "zod";
import { GuardError } from "@/lib/guard/service";

export function ok(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, { status: 200, ...init });
}

export function fail(message: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error: message, ...extra }, { status });
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown = {};
  try {
    const text = await req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new GuardError("Body must be JSON", 400);
  }
  return schema.parse(raw);
}

/** Wrap a handler so thrown GuardError / ZodError become clean JSON errors. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((err: unknown) => {
    if (err instanceof GuardError) return fail(err.message, err.status);
    if (err instanceof ZodError) return fail("Invalid input", 400, { issues: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
    console.error("[api]", err);
    return fail("Something went wrong on our side.", 500);
  });
}

/** Agent-facing endpoints require `Authorization: Bearer <AGENT_API_KEY>`. */
export function requireAgentKey(req: Request): Response | null {
  const expected = process.env.AGENT_API_KEY?.trim();
  if (!expected) return fail("AGENT_API_KEY is not configured on the server", 500);
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (got !== expected) return fail("Missing or invalid API key", 401);
  return null;
}
