import { prisma } from "@/lib/db";
import { toJson } from "@/lib/db/json";
import { getDemoUser } from "@/lib/user";
import { audit } from "@/lib/audit";
import { loadPolicy } from "@/lib/guard/service";
import { PolicyInputSchema } from "@/lib/types";
import { handle, ok, parseBody } from "@/lib/api/http";
import { formatUsd } from "@/lib/money";

export async function GET() {
  return handle(async () => {
    const user = await getDemoUser();
    const policy = await loadPolicy(user.id);
    return ok({ policy, summary: policySummary(policy) });
  });
}

export async function PUT(req: Request) {
  return handle(async () => {
    const user = await getDemoUser();
    const input = await parseBody(req, PolicyInputSchema);
    if (input.approvalThresholdCents > input.maxPerPurchaseCents) {
      input.approvalThresholdCents = input.maxPerPurchaseCents;
    }
    await prisma.policy.update({
      where: { userId: user.id },
      data: {
        maxPerPurchaseCents: input.maxPerPurchaseCents,
        approvalThresholdCents: input.approvalThresholdCents,
        weeklyBudgetCents: input.weeklyBudgetCents,
        allowedMerchantIds: toJson(input.allowedMerchantIds),
        blockedMerchantIds: toJson(input.blockedMerchantIds),
        newMerchantRequiresApproval: input.newMerchantRequiresApproval,
        categoryRules: toJson(input.categoryRules),
        maxQuantityPerItem: input.maxQuantityPerItem,
        duplicateWindowHours: input.duplicateWindowHours,
        approvalExpiryMinutes: input.approvalExpiryMinutes,
      },
    });
    await audit("policy_updated", "You updated your rules.", { data: input });
    return ok({ policy: input, summary: policySummary(input) });
  });
}

/** The plain-English summary shown in Scout's speech bubble (spec §12). */
export function policySummary(p: {
  weeklyBudgetCents: number;
  approvalThresholdCents: number;
  newMerchantRequiresApproval: boolean;
  categoryRules: Record<string, "REVIEW" | "BLOCK">;
  maxPerPurchaseCents: number;
  approvalExpiryMinutes: number;
}): string {
  const parts: string[] = [];
  parts.push(`Scout can spend up to ${formatUsd(p.weeklyBudgetCents)} a week.`);
  const asks: string[] = [`anything over ${formatUsd(p.approvalThresholdCents)}`];
  if (p.newMerchantRequiresApproval) asks.push("anything at a store you haven't approved");
  const reviewCats = Object.entries(p.categoryRules).filter(([, v]) => v === "REVIEW").map(([k]) => k.replace(/_/g, " "));
  if (reviewCats.length) asks.push(reviewCats.join(" and "));
  parts.push(`${asks.join(", or ").replace(/^./, (c) => c.toUpperCase())} needs your OK.`);
  const blocked = Object.entries(p.categoryRules).filter(([, v]) => v === "BLOCK").map(([k]) => k.replace(/_/g, " "));
  if (blocked.length) parts.push(`${blocked.join(" and ").replace(/^./, (c) => c.toUpperCase())} are never allowed.`);
  parts.push(`Nothing over ${formatUsd(p.maxPerPurchaseCents)} in one go, and Scout waits ${p.approvalExpiryMinutes} minutes for your answer.`);
  return parts.join(" ");
}
