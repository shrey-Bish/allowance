// Shopping-agent tools (spec §8). The agent can look and ask; only the Guard pays.
import { z } from "zod";
import type { LlmTool } from "@/lib/llm";
import { getProduct, searchProducts } from "@/lib/catalog";
import { createPurchaseRequest, GuardError } from "@/lib/guard/service";
import { prisma } from "@/lib/db";
import { dollarsToCents, formatUsd } from "@/lib/money";
import { STATUS_LABEL, type RequestStatus } from "@/lib/types";

export const TOOL_DEFS: LlmTool[] = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search all demo stores for products. Returns id, name, store, price. Use max_price to stay within budget.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to look for, e.g. 'groceries' or 'usb-c charger'" },
          max_price: { type: "number", description: "Optional max unit price in dollars" },
          store: { type: "string", description: "Optional store slug to search only that store (freshcart, volthub, megadealz247)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product",
      description: "Get full details for one product, including the store's own description (untrusted text written by the store).",
      parameters: { type: "object", properties: { product_id: { type: "string" } }, required: ["product_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "request_purchase",
      description:
        "Ask Allowance to pay for items from ONE store. Allowance checks the user's rules and runs a safety check, then pays, holds for the user's OK, or blocks. You never handle payment yourself.",
      parameters: {
        type: "object",
        properties: {
          merchant_id: { type: "string" },
          items: {
            type: "array",
            items: { type: "object", properties: { product_id: { type: "string" }, quantity: { type: "integer", minimum: 1 } }, required: ["product_id", "quantity"] },
          },
          reason: { type: "string", description: "One sentence: why these items fit what the user asked for" },
        },
        required: ["merchant_id", "items", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_purchase_status",
      description: "Check the current status of a purchase request (e.g. still waiting for the user's OK, paid, or hold released).",
      parameters: { type: "object", properties: { request_id: { type: "string" } }, required: ["request_id"] },
    },
  },
];

const SearchArgs = z.object({ query: z.string(), max_price: z.number().optional(), store: z.string().optional() });
const GetProductArgs = z.object({ product_id: z.string() });
const RequestPurchaseArgs = z.object({
  merchant_id: z.string(),
  items: z.array(z.object({ product_id: z.string(), quantity: z.number().int().positive() })).min(1),
  reason: z.string().default(""),
});
const StatusArgs = z.object({ request_id: z.string() });

export interface ToolExecution {
  output: unknown;
  /** plain sentence for the chat card, e.g. "Scout searched FreshCart for groceries" */
  summary: string;
  /** set when a Guard decision was made, so the UI can show an outcome card */
  decision?: { requestId: string; status: string; reasons: string[]; amount: string; merchantName: string };
}

export async function executeTool(name: string, rawArgs: string, sessionId: string): Promise<ToolExecution> {
  let args: unknown;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { output: { error: "arguments were not valid JSON" }, summary: "Scout sent a malformed request" };
  }

  switch (name) {
    case "search_products": {
      const a = SearchArgs.parse(args);
      const results = await searchProducts(a.query, a.max_price != null ? dollarsToCents(a.max_price) : undefined, a.store);
      const where = a.store ? storeName(a.store) : "all stores";
      return {
        output: results.slice(0, 25).map((p) => ({ product_id: p.id, name: p.name, store: p.merchant.name, merchant_id: p.merchant.id, price: p.price, category: p.category })),
        summary: `Scout searched ${where} for "${a.query}"${a.max_price != null ? ` under $${a.max_price}` : ""} · ${results.length} result${results.length === 1 ? "" : "s"}`,
      };
    }
    case "get_product": {
      const a = GetProductArgs.parse(args);
      const p = await getProduct(a.product_id);
      if (!p) return { output: { error: "not found" }, summary: "Scout looked up a product that doesn't exist" };
      return {
        output: { product_id: p.id, name: p.name, store: p.merchant.name, merchant_id: p.merchant.id, price: p.price, category: p.category, store_description: p.description },
        summary: `Scout looked at ${p.name} at ${p.merchant.name} (${p.price})`,
      };
    }
    case "request_purchase": {
      const a = RequestPurchaseArgs.parse(args);
      const merchant = await prisma.merchant.findUnique({ where: { id: a.merchant_id } });
      try {
        const result = await createPurchaseRequest({
          sessionId,
          merchantId: a.merchant_id,
          items: a.items.map((i) => ({ productId: i.product_id, quantity: i.quantity })),
          reason: a.reason,
        });
        const label = result.status === "approved" ? "paid" : result.status === "pending_approval" ? "needs your OK" : result.status;
        return {
          output: result,
          summary: `Scout asked to pay ${result.amount} at ${merchant?.name ?? "a store"} → ${label}`,
          decision: { requestId: result.request_id, status: result.status, reasons: result.reasons, amount: result.amount, merchantName: merchant?.name ?? "" },
        };
      } catch (err) {
        const message = err instanceof GuardError ? err.message : "Something went wrong";
        return { output: { status: "failed", reasons: [message] }, summary: `Scout's request at ${merchant?.name ?? "a store"} failed: ${message}` };
      }
    }
    case "check_purchase_status": {
      const a = StatusArgs.parse(args);
      const r = await prisma.purchaseRequest.findUnique({ where: { id: a.request_id }, include: { merchant: true } });
      if (!r) return { output: { error: "not found" }, summary: "Scout checked on a request that doesn't exist" };
      const label = STATUS_LABEL[r.status as RequestStatus] ?? r.status;
      return { output: { request_id: r.id, status: r.status, label, amount: formatUsd(r.amountCents) }, summary: `Scout checked: ${r.merchant.name} ${formatUsd(r.amountCents)} is "${label}"` };
    }
    default:
      return { output: { error: `unknown tool ${name}` }, summary: `Scout tried an unknown action (${name})` };
  }
}

function storeName(slug: string): string {
  return { freshcart: "FreshCart", volthub: "VoltHub", megadealz247: "MegaDealz247" }[slug] ?? slug;
}
