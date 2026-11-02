import { describe, expect, it } from "vitest";
import { mostSevere, RiskVerdictSchema } from "./types";
import { centsToPayPalValue, dollarsToCents, formatUsd, priceRatio } from "./money";

describe("severity", () => {
  it("picks the stricter outcome", () => {
    expect(mostSevere("ALLOW", "REVIEW")).toBe("REVIEW");
    expect(mostSevere("REVIEW", "BLOCK")).toBe("BLOCK");
    expect(mostSevere("BLOCK", "ALLOW")).toBe("BLOCK");
    expect(mostSevere("ALLOW", "ALLOW")).toBe("ALLOW");
  });
});

describe("money", () => {
  it("formats cents", () => {
    expect(formatUsd(4780)).toBe("$47.80");
    expect(formatUsd(5)).toBe("$0.05");
    expect(formatUsd(123456)).toBe("$1,234.56");
    expect(centsToPayPalValue(12900)).toBe("129.00");
    expect(dollarsToCents("47.80")).toBe(4780);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
    expect(priceRatio(5400, 1900)).toBe(2.8);
  });
  it("rejects bad cents", () => {
    expect(() => centsToPayPalValue(12.5)).toThrow();
    expect(() => centsToPayPalValue(-1)).toThrow();
  });
});

describe("RiskVerdictSchema", () => {
  it("accepts a well-formed verdict and rejects a malformed one", () => {
    const ok = RiskVerdictSchema.safeParse({
      verdict: "block",
      risk_score: 92,
      reasons: ["Price is 2.8× the usual $19 for this charger."],
      signals: {
        intent_mismatch: false,
        price_anomaly: true,
        suspicious_merchant: true,
        prompt_injection_detected: true,
        possible_duplicate: false,
      },
    });
    expect(ok.success).toBe(true);
    expect(RiskVerdictSchema.safeParse({ verdict: "approve", risk_score: 10, reasons: [], signals: {} }).success).toBe(false);
    expect(RiskVerdictSchema.safeParse({ verdict: "ok", risk_score: 101, reasons: [], signals: {} }).success).toBe(false);
  });
});
