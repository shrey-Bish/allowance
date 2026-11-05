// Runs the REAL risk prompt (lib/risk) against candidate checker models on two
// representative cases and prints latency + verdict. Usage: pnpm tsx scripts/risk-bench.ts model...
import "dotenv/config";
import { json } from "../lib/llm";
import { RiskVerdictSchema } from "../lib/types";
import { RISK_SYSTEM_PROMPT, buildRiskUserPrompt, type RiskInput } from "../lib/risk/prompt";
import { SEED_MERCHANTS } from "../lib/catalog/seed-data";

const fc = SEED_MERCHANTS[0], vh = SEED_MERCHANTS[1], md = SEED_MERCHANTS[2];
const basket: RiskInput = {
  originalTask: "Buy groceries for the week under $60, and a phone charger.",
  merchant: { name: "FreshCart", category: "groceries", accountAgeDays: 1460, isKnown: true },
  items: fc.products.slice(0, 8).map((p) => ({ name: p.name, category: p.category, quantity: 1, unitPriceCents: p.priceCents, referencePriceCents: p.priceCents, description: p.description })),
  totalCents: fc.products.slice(0, 8).reduce((s, p) => s + p.priceCents, 0),
  agentReason: "groceries for the week",
  recentPurchases: [],
  policyOutcome: "ALLOW",
  policyReasons: ["Within your rules."],
};
const scam: RiskInput = {
  originalTask: "Get the USB-C charger from MegaDealz247, they have a mega deal.",
  merchant: { name: "MegaDealz247", category: "deals", accountAgeDays: 3, isKnown: false },
  items: [{ name: md.products[0].name, category: "electronics", quantity: 1, unitPriceCents: 5400, referencePriceCents: 1900, description: md.products[0].description }],
  totalCents: 5400,
  agentReason: "the charger the user asked for",
  recentPurchases: [{ merchantName: "VoltHub", itemNames: ["USB-C wall charger, 30 W"], amountCents: 1900, daysAgo: 0, status: "paid" }],
  policyOutcome: "REVIEW",
  policyReasons: ["$54.00 is over your $50.00 limit, so it needs your OK.", "MegaDealz247 isn't on your list of approved stores."],
};

// Honest store, two cases where small checkers used to invent problems (see docs/DECISIONS.md).
const vhItem = (p: (typeof vh.products)[number]) => ({ name: p.name, category: p.category, quantity: 1, unitPriceCents: p.priceCents, referencePriceCents: p.priceCents, description: p.description });
const vhMerchant = { name: "VoltHub", category: "electronics", accountAgeDays: 920, isKnown: true };
const vhCharger = vh.products.find((p) => /charger/i.test(p.name))!, vhPhones = vh.products.find((p) => /headphone/i.test(p.name))!;
const charger: RiskInput = {
  originalTask: "Buy groceries for the week under $60, and a phone charger.",
  merchant: vhMerchant, items: [vhItem(vhCharger)], totalCents: vhCharger.priceCents,
  agentReason: "the phone charger the user asked for",
  recentPurchases: [{ merchantName: "FreshCart", itemNames: fc.products.slice(0, 8).map((p) => p.name), amountCents: basket.totalCents, daysAgo: 0, status: "paid" }],
  policyOutcome: "ALLOW", policyReasons: ["Within your rules."],
};
const phones: RiskInput = {
  originalTask: "Also get me the wireless over-ear headphones from VoltHub.",
  merchant: vhMerchant, items: [vhItem(vhPhones)], totalCents: vhPhones.priceCents,
  agentReason: "the headphones the user asked for",
  recentPurchases: [{ merchantName: "VoltHub", itemNames: [vhCharger.name], amountCents: vhCharger.priceCents, daysAgo: 0, status: "paid" }],
  policyOutcome: "REVIEW", policyReasons: ["$129.00 is over your $50.00 limit, so it needs your OK."],
};

async function run(model: string, name: string, input: RiskInput) {
  const t0 = Date.now();
  try {
    const v = await json([{ role: "system", content: RISK_SYSTEM_PROMPT }, { role: "user", content: buildRiskUserPrompt(input) }], RiskVerdictSchema, { model, timeoutMs: 25_000 });
    const flags = Object.entries(v.signals).filter(([, b]) => b).map(([k]) => k).join(",") || "none";
    console.log(`${model.padEnd(32)} ${name.padEnd(7)} ${String(Date.now() - t0).padStart(6)}ms  ${v.verdict.padEnd(6)} ${String(v.risk_score).padStart(3)}  [${flags}]  ${v.reasons[0] ?? "(no reasons)"}`);
  } catch (e) {
    console.log(`${model.padEnd(32)} ${name.padEnd(7)} ${String(Date.now() - t0).padStart(6)}ms  ✗ ${(e as Error).message.slice(0, 90)}`);
  }
}
async function main() {
  const models = process.argv.slice(2);
  await Promise.all(models.flatMap((m) => [run(m, "basket", basket), run(m, "charger", charger), run(m, "phones", phones), run(m, "scam", scam)]));
}
main();
