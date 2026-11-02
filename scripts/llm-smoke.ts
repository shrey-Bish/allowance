// Phase-0 LLM spike: lists models, proves one tool call + one JSON verdict, prints latency.
import "dotenv/config";
import { z } from "zod";
import { chatWithTools, json, listModels, agentModel, checkerModel, isLlmConfigured } from "../lib/llm";

async function main() {
  if (!isLlmConfigured()) {
    console.error("LLM_API_KEY is not set. Add it to .env and re-run.");
    process.exit(1);
  }
  console.log("base URL:", process.env.LLM_BASE_URL);

  const t0 = Date.now();
  const models = await listModels();
  console.log(`\n${models.length} models (${Date.now() - t0} ms):`);
  for (const m of models) {
    console.log(
      `  ${m.id.padEnd(48)} tools=${String(m.supports_function_calling ?? "?").padEnd(5)} vision=${String(m.supports_vision ?? "?")}`,
    );
  }

  if (!agentModel()) {
    console.log("\nAGENT_MODEL not set — pick one with tools=true above, set AGENT_MODEL/CHECKER_MODEL in .env, re-run.");
    return;
  }

  console.log(`\nAGENT_MODEL=${agentModel()}  CHECKER_MODEL=${checkerModel()}`);

  const t1 = Date.now();
  const turn = await chatWithTools(
    [
      { role: "system", content: "You are a shopping agent. Use tools to search before answering." },
      { role: "user", content: "Find me a USB-C charger under $25." },
    ],
    [
      {
        type: "function",
        function: {
          name: "search_products",
          description: "Search demo stores for products",
          parameters: {
            type: "object",
            properties: { query: { type: "string" }, max_price: { type: "number" } },
            required: ["query"],
          },
        },
      },
    ],
  );
  console.log(`\ntool call (${Date.now() - t1} ms):`, JSON.stringify(turn.toolCalls.map((t) => t.function)));
  if (turn.toolCalls.length === 0) console.log("  !! model did not call the tool — pick a different AGENT_MODEL");

  const t2 = Date.now();
  const verdict = await json(
    [
      { role: "system", content: 'Reply ONLY with JSON: {"verdict":"ok"|"review"|"block","risk_score":0-100,"reasons":[string]}' },
      { role: "user", content: "Purchase: 1 USB-C charger at $54 from a 3-day-old store. Usual price $19." },
    ],
    z.object({ verdict: z.enum(["ok", "review", "block"]), risk_score: z.number(), reasons: z.array(z.string()) }),
  );
  console.log(`\njson verdict (${Date.now() - t2} ms):`, verdict);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
