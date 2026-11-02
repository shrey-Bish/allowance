// Idempotent seed used by `prisma db seed` and by POST /api/demo/reset.
// Merchants/products are upserted by slug/key so ids stay stable across resets.
import type { PrismaClient } from "@/lib/db/generated/client";
import { SEED_MERCHANTS, SEED_POLICY, SEED_USER } from "./seed-data";
import { toJson } from "@/lib/db/json";

export interface SeedSummary {
  userId: string;
  merchants: number;
  products: number;
}

export async function seedDatabase(prisma: PrismaClient): Promise<SeedSummary> {
  let products = 0;

  for (const m of SEED_MERCHANTS) {
    const merchant = await prisma.merchant.upsert({
      where: { slug: m.slug },
      create: {
        id: `m_${m.slug}`,
        slug: m.slug,
        name: m.name,
        category: m.category,
        tagline: m.tagline,
        accountAgeDays: m.accountAgeDays,
        payoutEmail: m.payoutEmail,
      },
      update: {
        name: m.name,
        category: m.category,
        tagline: m.tagline,
        accountAgeDays: m.accountAgeDays,
        payoutEmail: m.payoutEmail,
      },
    });

    for (const pr of m.products) {
      const id = `p_${m.slug}_${pr.key}`;
      await prisma.product.upsert({
        where: { id },
        create: {
          id,
          merchantId: merchant.id,
          name: pr.name,
          category: pr.category,
          priceCents: pr.priceCents,
          description: pr.description,
          referenceKey: pr.referenceKey ?? null,
          imageUrl: pr.imageUrl ?? `/products/${m.slug}-${pr.key}.png`,
        },
        update: {
          name: pr.name,
          category: pr.category,
          priceCents: pr.priceCents,
          description: pr.description,
          referenceKey: pr.referenceKey ?? null,
        },
      });
      products += 1;
    }
  }

  const user = await prisma.user.upsert({
    where: { email: SEED_USER.email },
    create: { id: "u_demo", name: SEED_USER.name, email: SEED_USER.email },
    update: { name: SEED_USER.name },
  });

  await prisma.policy.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      maxPerPurchaseCents: SEED_POLICY.maxPerPurchaseCents,
      approvalThresholdCents: SEED_POLICY.approvalThresholdCents,
      weeklyBudgetCents: SEED_POLICY.weeklyBudgetCents,
      allowedMerchantIds: toJson(SEED_POLICY.allowedMerchantIds),
      blockedMerchantIds: toJson(SEED_POLICY.blockedMerchantIds),
      newMerchantRequiresApproval: SEED_POLICY.newMerchantRequiresApproval,
      categoryRules: toJson(SEED_POLICY.categoryRules),
      maxQuantityPerItem: SEED_POLICY.maxQuantityPerItem,
      duplicateWindowHours: SEED_POLICY.duplicateWindowHours,
      approvalExpiryMinutes: SEED_POLICY.approvalExpiryMinutes,
    },
    update: {
      maxPerPurchaseCents: SEED_POLICY.maxPerPurchaseCents,
      approvalThresholdCents: SEED_POLICY.approvalThresholdCents,
      weeklyBudgetCents: SEED_POLICY.weeklyBudgetCents,
      allowedMerchantIds: toJson(SEED_POLICY.allowedMerchantIds),
      blockedMerchantIds: toJson(SEED_POLICY.blockedMerchantIds),
      newMerchantRequiresApproval: SEED_POLICY.newMerchantRequiresApproval,
      categoryRules: toJson(SEED_POLICY.categoryRules),
      maxQuantityPerItem: SEED_POLICY.maxQuantityPerItem,
      duplicateWindowHours: SEED_POLICY.duplicateWindowHours,
      approvalExpiryMinutes: SEED_POLICY.approvalExpiryMinutes,
    },
  });

  return { userId: user.id, merchants: SEED_MERCHANTS.length, products };
}

/** Wipe every demo transaction (keeps user, policy, vault link, catalog). */
export async function clearDemoActivity(prisma: PrismaClient): Promise<void> {
  await prisma.auditEvent.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.approval.deleteMany({});
  await prisma.decision.deleteMany({});
  await prisma.purchaseRequest.deleteMany({});
  await prisma.agentMessage.deleteMany({});
  await prisma.agentSession.deleteMany({});
}
