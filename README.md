# Allowance

**Give your AI agent an allowance, not your wallet.**

Allowance is a safety layer between any AI shopping agent and your PayPal. You link PayPal once and set plain rules (a weekly budget, when to ask you first). Your agent can then buy things for you: small purchases go through, bigger ones wait for your OK while PayPal holds the money, and sketchy ones (inflated prices, brand-new stores, pages with hidden instructions for the AI) get blocked. Every decision and every PayPal payment lands in one activity log.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com) (Nov 2026). Sandbox only, test money only.

> **Status (2026-11-02):** backend + Guard API + demo agent + store catalog are in place and tested in mock-payment mode. PayPal sandbox spike, UI screens, pixel stage, hosting and video are in progress. See `docs/DECISIONS.md`.

## How it works

```
You ──(rules + PayPal link, once)──► Allowance
You ──("buy groceries under $60")──► Scout (LLM agent with tools)
Scout ──search / look──────────────► demo stores
Scout ──request_purchase()─────────► Allowance Guard
Guard: 1) your rules (deterministic)  2) AI safety check (can only tighten)
   ├─ looks fine   → PayPal pays now (order + capture)
   ├─ needs your OK→ PayPal holds the money (authorize) → you approve (capture) / say no (void) / time runs out (void)
   └─ blocked      → nothing charged; Scout is told why
Every step → activity log
```

Scout never sees PayPal. The Guard records what *you* asked for straight from the chat, so a hijacked agent can't rewrite it.

## Run it locally

Prerequisites: Node 20+, pnpm.

```bash
pnpm install            # also generates the Prisma client
cp .env.example .env    # fill in what you have (see below)
pnpm db:push && pnpm db:seed
pnpm dev                # http://localhost:3000
```

What you need in `.env`:

| Variable | Needed for | Without it |
|---|---|---|
| `LLM_BASE_URL`, `LLM_API_KEY`, `AGENT_MODEL`, `CHECKER_MODEL` | Scout (the agent) and the AI safety check | Scout can't run; the safety check fails safe to "needs your OK" |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | real sandbox payments | set `PAYPAL_MODE=mock` to run the whole flow with clearly-labelled mock payment ids |
| `AGENT_API_KEY` | external agents calling the Guard API | — |

The hosted demo uses ASU Research Computing's OpenAI-compatible LLM API. Self-hosters can point `LLM_BASE_URL` / `LLM_API_KEY` at any OpenAI-compatible provider that offers a model with function calling.

### Scripts

| Script | What it does |
|---|---|
| `pnpm test` | unit tests (policy engine, risk fail-safe, money) |
| `pnpm llm:smoke` | lists gateway models, proves one tool call + one JSON verdict |
| `pnpm paypal:smoke` | token → vault → authorize → capture / void against the sandbox |
| `pnpm db:reset` | wipe + reseed the local database |

## Guard API (for any agent)

All agent-facing calls take `Authorization: Bearer <AGENT_API_KEY>`.

```
POST /api/agent/sessions                  { "task": "buy groceries under $60" } → { session_id }
GET  /api/catalog/search?q=charger&maxPrice=25
GET  /api/catalog/products/:id
POST /api/agent/purchase-requests         { session_id, merchant_id, items:[{product_id, quantity}], reason }
                                          → { request_id, status: approved | pending_approval | blocked | failed, reasons[], amount }
GET  /api/agent/purchase-requests/:id
```

User-facing: `GET/PUT /api/policy`, `GET /api/approvals`, `POST /api/approvals/:id/approve|deny`, `GET /api/activity`, `POST /api/agent/chat` (SSE), `POST /api/demo/reset`.

## Repo layout

```
app/            Next.js App Router: screens + /api route handlers + /stores/[slug]
lib/policy      deterministic rules engine (pure, unit-tested)
lib/risk        AI safety check: prompt, zod-validated verdict, fail-safe
lib/guard       status machine + the Guard service (rules → AI → PayPal)
lib/agent       Scout: tool-using LLM loop, streams events
lib/paypal      typed sandbox client (+ labelled mock for local dev)
lib/llm         provider-agnostic OpenAI-compatible wrapper
lib/catalog     demo stores, products, seed
prisma/         schema + seed
docs/           DECISIONS.md (verified facts, choices, VERIFY list)
```

## License

MIT — see `LICENSE`.
