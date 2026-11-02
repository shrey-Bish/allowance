// Audit trail: every notable step becomes an AuditEvent row (spec §3).
import { prisma } from "@/lib/db";
import { toJson } from "@/lib/db/json";

export type AuditType =
  | "session_started"
  | "agent_step"
  | "request_received"
  | "policy_evaluated"
  | "risk_checked"
  | "decision_made"
  | "paypal_order_created"
  | "paypal_authorized"
  | "paypal_captured"
  | "paypal_voided"
  | "paypal_failed"
  | "approval_requested"
  | "approval_approved"
  | "approval_denied"
  | "approval_expired"
  | "paypal_webhook"
  | "demo_reset"
  | "policy_updated"
  | "paypal_linked";

export async function audit(
  type: AuditType,
  message: string,
  opts: { requestId?: string | null; sessionId?: string | null; data?: unknown } = {},
): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        type,
        message,
        purchaseRequestId: opts.requestId ?? null,
        sessionId: opts.sessionId ?? null,
        data: toJson(stripSecrets(opts.data ?? {})),
      },
    });
  } catch (err) {
    console.error("[audit] failed to write event", type, err);
  }
}

const SECRET_KEYS = /secret|token|authorization|api[_-]?key|password/i;

export function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // keep PayPal ids like authorizationId / vault id, drop real secrets
      if (SECRET_KEYS.test(k) && !/id$/i.test(k)) continue;
      out[k] = stripSecrets(v);
    }
    return out;
  }
  return value;
}
