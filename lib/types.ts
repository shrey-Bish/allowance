// Shared, client-safe types and zod schemas. Nothing here may import server-only code.
import { z } from "zod";

export const OutcomeSchema = z.enum(["ALLOW", "REVIEW", "BLOCK"]);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const OUTCOME_SEVERITY: Record<Outcome, number> = { ALLOW: 0, REVIEW: 1, BLOCK: 2 };

export function mostSevere(a: Outcome, b: Outcome): Outcome {
  return OUTCOME_SEVERITY[a] >= OUTCOME_SEVERITY[b] ? a : b;
}

export const PurchaseItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  referenceKey: z.string().nullable().optional(),
});
export type PurchaseItem = z.infer<typeof PurchaseItemSchema>;

export const RequestStatusSchema = z.enum([
  "RECEIVED",
  "EVALUATING",
  "BLOCKED",
  "APPROVED_AUTO",
  "PENDING_APPROVAL",
  "APPROVED_BY_USER",
  "CAPTURING",
  "COMPLETED",
  "DENIED",
  "EXPIRED",
  "VOIDED",
  "FAILED",
]);
export type RequestStatus = z.infer<typeof RequestStatusSchema>;

export const ApprovalStatusSchema = z.enum(["PENDING", "APPROVED", "DENIED", "EXPIRED"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const PaymentStatusSchema = z.enum(["NONE", "AUTHORIZED", "CAPTURED", "VOIDED", "FAILED"]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const CategoryRuleSchema = z.enum(["REVIEW", "BLOCK"]);
export const CategoryRulesSchema = z.record(z.string(), CategoryRuleSchema);
export type CategoryRules = z.infer<typeof CategoryRulesSchema>;

export const StringArraySchema = z.array(z.string());

/** The user-facing shape of a policy (dollars as cents, JSON already parsed). */
export const PolicyInputSchema = z.object({
  maxPerPurchaseCents: z.number().int().positive(),
  approvalThresholdCents: z.number().int().nonnegative(),
  weeklyBudgetCents: z.number().int().positive(),
  allowedMerchantIds: StringArraySchema.default([]),
  blockedMerchantIds: StringArraySchema.default([]),
  newMerchantRequiresApproval: z.boolean().default(true),
  categoryRules: CategoryRulesSchema.default({}),
  maxQuantityPerItem: z.number().int().positive().default(5),
  duplicateWindowHours: z.number().int().nonnegative().default(24),
  approvalExpiryMinutes: z.number().int().positive().default(10),
});
export type PolicyInput = z.infer<typeof PolicyInputSchema>;

export const RiskSignalsSchema = z.object({
  intent_mismatch: z.boolean(),
  price_anomaly: z.boolean(),
  suspicious_merchant: z.boolean(),
  prompt_injection_detected: z.boolean(),
  possible_duplicate: z.boolean(),
});
export type RiskSignals = z.infer<typeof RiskSignalsSchema>;

export const RiskVerdictSchema = z.object({
  verdict: z.enum(["ok", "review", "block"]),
  risk_score: z.number().int().min(0).max(100),
  reasons: z.array(z.string().min(1)).max(6),
  signals: RiskSignalsSchema,
});
export type RiskVerdict = z.infer<typeof RiskVerdictSchema>;

export const EMPTY_SIGNALS: RiskSignals = {
  intent_mismatch: false,
  price_anomaly: false,
  suspicious_merchant: false,
  prompt_injection_detected: false,
  possible_duplicate: false,
};

/** What the agent gets back from request_purchase. */
export const AgentPurchaseResultSchema = z.object({
  request_id: z.string(),
  status: z.enum(["approved", "pending_approval", "blocked", "failed"]),
  reasons: z.array(z.string()),
  amount: z.string(),
  expires_at: z.string().nullable().optional(),
});
export type AgentPurchaseResult = z.infer<typeof AgentPurchaseResultSchema>;

/** Plain-English labels per spec §12C — the only words the UI may use. */
export const OUTCOME_LABEL: Record<Outcome, string> = {
  ALLOW: "looks fine",
  REVIEW: "needs your OK",
  BLOCK: "blocked",
};

export const STATUS_LABEL: Record<RequestStatus, string> = {
  RECEIVED: "checking",
  EVALUATING: "checking",
  BLOCKED: "blocked",
  APPROVED_AUTO: "paying",
  PENDING_APPROVAL: "needs your OK",
  APPROVED_BY_USER: "paying",
  CAPTURING: "paying",
  COMPLETED: "paid",
  DENIED: "hold released",
  EXPIRED: "hold released",
  VOIDED: "hold released",
  FAILED: "payment failed",
};
