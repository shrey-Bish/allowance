// Deterministic policy engine (spec §6). A pure function — no I/O — so it is
// trivially unit-tested and can never be influenced by the agent or the AI.
import { mostSevere, type Outcome, type PolicyInput, type PurchaseItem } from "@/lib/types";
import { formatUsd } from "@/lib/money";

export interface PolicyRequest {
  merchantId: string;
  merchantName: string;
  items: PurchaseItem[];
  amountCents: number;
}

export interface HistoryEntry {
  merchantId: string;
  productIds: string[];
  amountCents: number;
  /** true when money was (or is being) spent — counts toward the budget */
  spent: boolean;
  /** true when PayPal is holding the money right now (pending the user's OK) */
  held: boolean;
  /** true when the purchase completed — counts as "known merchant" */
  completed: boolean;
  createdAt: Date;
}

export interface PolicyEvaluation {
  outcome: Outcome;
  reasons: string[];
  /** which rule ids fired, for the activity drawer ("which rules applied") */
  rulesApplied: string[];
  spentThisWeekCents: number;
  remainingBudgetCents: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function evaluatePolicy(
  request: PolicyRequest,
  policy: PolicyInput,
  history: HistoryEntry[],
  now: Date = new Date(),
): PolicyEvaluation {
  let outcome: Outcome = "ALLOW";
  const fired: Array<{ to: Outcome; reason: string }> = [];
  const rulesApplied: string[] = [];

  const escalate = (to: Outcome, ruleId: string, reason: string) => {
    outcome = mostSevere(outcome, to);
    rulesApplied.push(ruleId);
    fired.push({ to, reason });
  };

  const weekAgo = now.getTime() - WEEK_MS;
  const spentThisWeekCents = history
    .filter((h) => h.spent && h.createdAt.getTime() >= weekAgo)
    .reduce((sum, h) => sum + h.amountCents, 0);
  const remainingBudgetCents = Math.max(0, policy.weeklyBudgetCents - spentThisWeekCents);

  // --- hard blocks first -------------------------------------------------
  if (policy.blockedMerchantIds.includes(request.merchantId)) {
    escalate("BLOCK", "blockedMerchants", `${request.merchantName} is on your blocked list.`);
  }

  if (request.amountCents > policy.maxPerPurchaseCents) {
    escalate(
      "BLOCK",
      "maxPerPurchase",
      `${formatUsd(request.amountCents)} is more than your ${formatUsd(policy.maxPerPurchaseCents)} limit for a single purchase.`,
    );
  }

  if (request.amountCents > remainingBudgetCents) {
    const left = remainingBudgetCents;
    escalate(
      "BLOCK",
      "weeklyBudget",
      left === 0
        ? `Your ${formatUsd(policy.weeklyBudgetCents)} weekly budget is used up.`
        : `${formatUsd(request.amountCents)} is more than the ${formatUsd(left)} left in your weekly budget.`,
    );
  }

  for (const item of request.items) {
    const rule = policy.categoryRules[item.category];
    if (rule === "BLOCK") {
      escalate("BLOCK", `category:${item.category}`, `${categoryLabel(item.category)} are never allowed by your rules.`);
    } else if (rule === "REVIEW") {
      escalate("REVIEW", `category:${item.category}`, `${categoryLabel(item.category)} always need your OK.`);
    }
  }

  // --- reviews -------------------------------------------------------------
  if (request.amountCents > policy.approvalThresholdCents) {
    escalate(
      "REVIEW",
      "approvalThreshold",
      `${formatUsd(request.amountCents)} is over your ${formatUsd(policy.approvalThresholdCents)} limit, so it needs your OK.`,
    );
  }

  if (policy.allowedMerchantIds.length > 0 && !policy.allowedMerchantIds.includes(request.merchantId)) {
    escalate("REVIEW", "allowedMerchants", `${request.merchantName} isn't on your list of approved stores.`);
  }

  if (policy.newMerchantRequiresApproval) {
    const known = history.some((h) => h.completed && h.merchantId === request.merchantId);
    if (!known) {
      escalate("REVIEW", "newMerchantRequiresApproval", `This is the first time Scout is buying from ${request.merchantName}.`);
    }
  }

  for (const item of request.items) {
    if (item.quantity > policy.maxQuantityPerItem) {
      escalate(
        "REVIEW",
        "maxQuantityPerItem",
        `${item.quantity} × ${item.name} is more than the ${policy.maxQuantityPerItem} of one item you allow without asking.`,
      );
    }
  }

  if (policy.duplicateWindowHours > 0) {
    const windowStart = now.getTime() - policy.duplicateWindowHours * 60 * 60 * 1000;
    // only purchases where money moved or is on hold count as a duplicate — a
    // blocked attempt that is retried is not "buying twice"
    const recentSameMerchant = history.filter(
      (h) => (h.spent || h.held) && h.merchantId === request.merchantId && h.createdAt.getTime() >= windowStart,
    );
    const dup = request.items.find((item) =>
      recentSameMerchant.some((h) => h.productIds.includes(item.productId)),
    );
    if (dup) {
      escalate(
        "REVIEW",
        "duplicateWindow",
        `Scout already bought ${dup.name} from ${request.merchantName} in the last ${policy.duplicateWindowHours} hours.`,
      );
    }
  }

  // Only report the reasons at the final severity: a BLOCK doesn't also say
  // "needs your OK", and an ALLOW just says it's within the rules.
  const reasons = fired.filter((f) => f.to === outcome).map((f) => f.reason);
  if (reasons.length === 0) reasons.push("Within your rules.");

  return { outcome, reasons, rulesApplied, spentThisWeekCents, remainingBudgetCents };
}

function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    gift_cards: "Gift cards",
    electronics: "Electronics",
    groceries: "Groceries",
    alcohol: "Alcohol",
  };
  return map[category] ?? category.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
