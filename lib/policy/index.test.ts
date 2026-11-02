import { describe, expect, it } from "vitest";
import { evaluatePolicy, type HistoryEntry, type PolicyRequest } from "./index";
import type { PolicyInput, PurchaseItem } from "@/lib/types";

const NOW = new Date("2026-11-05T12:00:00Z");

const basePolicy: PolicyInput = {
  maxPerPurchaseCents: 30000,
  approvalThresholdCents: 5000,
  weeklyBudgetCents: 15000,
  allowedMerchantIds: [],
  blockedMerchantIds: [],
  newMerchantRequiresApproval: false,
  categoryRules: { gift_cards: "BLOCK" },
  maxQuantityPerItem: 5,
  duplicateWindowHours: 24,
  approvalExpiryMinutes: 10,
};

function item(over: Partial<PurchaseItem> = {}): PurchaseItem {
  return {
    productId: "p-charger",
    name: "USB-C charger",
    category: "electronics",
    quantity: 1,
    unitPriceCents: 1900,
    ...over,
  };
}

function req(over: Partial<PolicyRequest> = {}): PolicyRequest {
  const items = over.items ?? [item()];
  return {
    merchantId: "m-volthub",
    merchantName: "VoltHub",
    items,
    amountCents: items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0),
    ...over,
  };
}

function hist(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    merchantId: "m-volthub",
    productIds: ["p-other"],
    amountCents: 1000,
    spent: true,
    held: false,
    completed: true,
    createdAt: new Date(NOW.getTime() - 60 * 60 * 1000),
    ...over,
  };
}

describe("evaluatePolicy", () => {
  it("allows a small purchase within every rule", () => {
    const r = evaluatePolicy(req(), basePolicy, [], NOW);
    expect(r.outcome).toBe("ALLOW");
    expect(r.reasons).toEqual(["Within your rules."]);
    expect(r.rulesApplied).toEqual([]);
  });

  it("REVIEWs above the approval threshold", () => {
    const r = evaluatePolicy(req({ items: [item({ unitPriceCents: 12900, name: "headphones" })] }), basePolicy, [], NOW);
    expect(r.outcome).toBe("REVIEW");
    expect(r.rulesApplied).toContain("approvalThreshold");
    expect(r.reasons[0]).toMatch(/\$129\.00 is over your \$50\.00 limit/);
  });

  it("BLOCKs above max per purchase", () => {
    const r = evaluatePolicy(req({ items: [item({ unitPriceCents: 40000 })] }), basePolicy, [], NOW);
    expect(r.outcome).toBe("BLOCK");
    expect(r.rulesApplied).toContain("maxPerPurchase");
  });

  it("BLOCKs when the weekly budget would be exceeded, counting only spent entries from the last 7 days", () => {
    const history = [
      hist({ amountCents: 10000 }), // spent, recent → counts
      hist({ amountCents: 10000, spent: false }), // held/blocked → doesn't count
      hist({ amountCents: 10000, createdAt: new Date(NOW.getTime() - 8 * 24 * 3600 * 1000) }), // too old
    ];
    const r = evaluatePolicy(req({ items: [item({ unitPriceCents: 4900 })] }), basePolicy, history, NOW);
    expect(r.spentThisWeekCents).toBe(10000);
    expect(r.remainingBudgetCents).toBe(5000);
    expect(r.outcome).toBe("ALLOW");

    const over = evaluatePolicy(req({ items: [item({ unitPriceCents: 5100 })] }), basePolicy, history, NOW);
    expect(over.outcome).toBe("BLOCK");
    expect(over.rulesApplied).toContain("weeklyBudget");
    expect(over.reasons.join(" ")).toMatch(/\$50\.00 left/);
  });

  it("says the budget is used up when nothing remains", () => {
    const r = evaluatePolicy(req(), basePolicy, [hist({ amountCents: 15000 })], NOW);
    expect(r.outcome).toBe("BLOCK");
    expect(r.reasons[0]).toMatch(/weekly budget is used up/);
  });

  it("BLOCKs blocked merchants and REVIEWs merchants off the allowlist", () => {
    const blocked = evaluatePolicy(req(), { ...basePolicy, blockedMerchantIds: ["m-volthub"] }, [], NOW);
    expect(blocked.outcome).toBe("BLOCK");

    const notListed = evaluatePolicy(req(), { ...basePolicy, allowedMerchantIds: ["m-freshcart"] }, [], NOW);
    expect(notListed.outcome).toBe("REVIEW");
    expect(notListed.rulesApplied).toContain("allowedMerchants");

    const listed = evaluatePolicy(req(), { ...basePolicy, allowedMerchantIds: ["m-volthub"] }, [], NOW);
    expect(listed.outcome).toBe("ALLOW");
  });

  it("REVIEWs a new merchant only when no completed purchase exists", () => {
    const policy = { ...basePolicy, newMerchantRequiresApproval: true };
    const fresh = evaluatePolicy(req(), policy, [], NOW);
    expect(fresh.outcome).toBe("REVIEW");
    expect(fresh.rulesApplied).toContain("newMerchantRequiresApproval");

    const known = evaluatePolicy(req(), policy, [hist({ completed: true })], NOW);
    expect(known.outcome).toBe("ALLOW");

    const onlyBlockedBefore = evaluatePolicy(req(), policy, [hist({ completed: false, spent: false })], NOW);
    expect(onlyBlockedBefore.outcome).toBe("REVIEW");
  });

  it("applies category rules: gift cards BLOCK, electronics REVIEW", () => {
    const gift = evaluatePolicy(
      req({ items: [item({ productId: "p-gc", name: "$25 gift card", category: "gift_cards", unitPriceCents: 2500 })] }),
      basePolicy,
      [],
      NOW,
    );
    expect(gift.outcome).toBe("BLOCK");
    expect(gift.reasons[0]).toBe("Gift cards are never allowed by your rules.");

    const elec = evaluatePolicy(req(), { ...basePolicy, categoryRules: { electronics: "REVIEW" } }, [], NOW);
    expect(elec.outcome).toBe("REVIEW");
  });

  it("REVIEWs quantities above maxQuantityPerItem", () => {
    const r = evaluatePolicy(req({ items: [item({ quantity: 6, unitPriceCents: 500 })] }), basePolicy, [], NOW);
    expect(r.outcome).toBe("REVIEW");
    expect(r.rulesApplied).toContain("maxQuantityPerItem");
  });

  it("REVIEWs a duplicate of the same item at the same merchant inside the window", () => {
    const inWindow = hist({ productIds: ["p-charger"], createdAt: new Date(NOW.getTime() - 2 * 3600 * 1000) });
    const r = evaluatePolicy(req(), basePolicy, [inWindow], NOW);
    expect(r.outcome).toBe("REVIEW");
    expect(r.rulesApplied).toContain("duplicateWindow");

    const outside = hist({ productIds: ["p-charger"], createdAt: new Date(NOW.getTime() - 30 * 3600 * 1000) });
    expect(evaluatePolicy(req(), basePolicy, [outside], NOW).outcome).toBe("ALLOW");

    const otherMerchant = hist({ merchantId: "m-freshcart", productIds: ["p-charger"] });
    expect(evaluatePolicy(req(), basePolicy, [otherMerchant], NOW).outcome).toBe("ALLOW");

    const blockedAttempt = hist({ productIds: ["p-charger"], spent: false, completed: false });
    expect(evaluatePolicy(req(), basePolicy, [blockedAttempt], NOW).outcome).toBe("ALLOW");

    const heldAttempt = hist({ productIds: ["p-charger"], spent: false, held: true, completed: false });
    expect(evaluatePolicy(req(), basePolicy, [heldAttempt], NOW).outcome).toBe("REVIEW");

    expect(evaluatePolicy(req(), { ...basePolicy, duplicateWindowHours: 0 }, [inWindow], NOW).outcome).toBe("ALLOW");
  });

  it("keeps the most severe outcome and lists every reason", () => {
    const r = evaluatePolicy(
      req({ items: [item({ unitPriceCents: 12900 })] }),
      { ...basePolicy, newMerchantRequiresApproval: true, blockedMerchantIds: ["m-volthub"] },
      [],
      NOW,
    );
    expect(r.outcome).toBe("BLOCK");
    expect(r.rulesApplied).toEqual(
      expect.arrayContaining(["blockedMerchants", "approvalThreshold", "newMerchantRequiresApproval"]),
    );
    // only the BLOCK-level reason is shown; the review-level ones are noise once blocked
    expect(r.reasons).toEqual(["VoltHub is on your blocked list."]);
  });
});
