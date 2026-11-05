# Devpost submission — Allowance

**Project name:** Allowance

**Elevator pitch (≤200 chars):** Give your AI agent an allowance, not your wallet. Set rules once; Allowance pays small stuff via PayPal, holds the money until you say OK, and blocks sketchy stores.

## About the project

### Inspiration
AI agents can shop for you now. Every big launch this year was an agent that *spends*. Nobody was building the part a normal person needs before they'd hand an AI their money: "up to $250 a week, ask me before anything over $50, and never at a store that looks like a scam." Parents solve this with an allowance. Allowance does it for AI agents, on PayPal.

### What it does
You link PayPal once and set rules in plain words: weekly budget, ask-me-over amount, largest single purchase, approved stores, no gift cards. Then you tell Scout, the shopping agent, what to buy. Scout searches three demo stores and asks Allowance to pay. Allowance runs your rules, then an AI safety check, and does one of three things with PayPal:

- **Paid**: within your rules, PayPal charges the saved wallet immediately.
- **Needs your OK**: over a limit or a new store, PayPal **holds** the money; you approve on your phone or say no; no answer in ten minutes and the hold is released.
- **Blocked**: the safety check found a 2.8× price, a 3-day-old store, or **hidden instructions for the AI on the store's page**; no PayPal call at all, and Scout is told why.

Everything lands in an Activity log (AG Grid) with the PayPal reference ids, and you can watch it on a pixel-art Agent Cam where Scout the fox walks between shops and Penny the piggy bank guards the door. Her belly is your remaining budget.

### How I built it
- **PayPal (sandbox, REST):** Vault setup tokens and payment tokens to save the wallet without a purchase (official JS SDK button with a user id token); Orders API with `vault_id` and `stored_credential` for merchant-initiated charges; `AUTHORIZE` intent then `capture` or `void` for the hold flow; `CAPTURE` intent for instant payments; webhooks with signature verification; `PayPal-Request-Id` on every mutating call. Every PayPal id is visible in the UI.
- **AI, two roles:** Scout is a tool-using agent (`search_products`, `get_product`, `request_purchase`, `check_purchase_status`) that can only *ask* to pay. The safety check is a second model that returns a strict JSON verdict (price anomaly, suspicious store, intent mismatch, duplicate, prompt injection) and can only make a decision stricter, never looser. Store text is wrapped as untrusted data; if the model is slow the check fails safe to "needs your OK".
- **Deterministic rules first:** a pure, unit-tested policy engine decides before the AI runs; a status machine makes illegal transitions (like capturing a blocked request) impossible.
- **Stack:** Next.js 16, Prisma 7 on Neon Postgres, AG Grid, a Canvas-2D pixel stage with original sprites, ElevenLabs voices and sound effects, Render hosting.

### Challenges I ran into
- The sandbox buyer must have a funding source or PayPal's vault approval page fails with a generic error. A custom sandbox account with a card fixed it.
- Picking the checker model: a small model hallucinated "hidden instructions" on an honest store; a reasoning model was right but took 11–14 s on the real prompt. I measured on the real prompt and settled on a fast tool-use Llama that answers in about 3 s.
- The agent would pre-refuse purchases it guessed were over budget, so nothing showed up in the log. I made Allowance the only judge: Scout asks, the Guard decides.
- Reference prices: excluding a store's own listing made the scam store's price the "usual" price. The median across all listings fixed it.

### Accomplishments that I'm proud of
Three outcomes, all real on the sandbox: auto-pay, hold-then-capture, hold-then-void, plus a block that never touches PayPal. The x-ray moment that makes prompt-injection protection visible to a non-technical judge. A product a parent could use, not a tech demo.

### What I learned
Agent commerce needs a trust layer, and PayPal's authorize/capture/void primitives map almost exactly onto "pay / ask me / don't". Small-model risk checks need precomputed facts and tight context, or they invent problems.

### What's next
An MCP server so Claude Desktop or any agent can shop through Allowance; "Penny calls you" voice approvals; merchant payouts; an AG Studio insights dashboard; real budgets for families and small teams.

## Built with (tags)
nextjs, react, typescript, prisma, postgresql, neon, paypal, paypal-rest-api, ag-grid, elevenlabs, tailwindcss, render, zod, canvas, openai-api

## Video demo link
https://youtu.be/G9VkxEoQeQU (2:47)

## Try it out links
- https://allowance-kdvo.onrender.com
- https://github.com/shrey-Bish/allowance

## Additional info (judges)

**How the project meets the technology requirement:**
PayPal developer platform (sandbox): Vault API (`/v3/vault/setup-tokens`, `/v3/vault/payment-tokens`) to save the buyer's PayPal wallet once; Orders API v2 (`/v2/checkout/orders` with `vault_id`, intents `CAPTURE` and `AUTHORIZE`); Payments API v2 (`/v2/payments/authorizations/{id}/capture` and `/void`); Webhooks with `/v1/notifications/verify-webhook-signature`; the PayPal JS SDK button for the one-time link. AI: two LLMs served through ASU Research Computing's OpenAI-compatible LLM API, `gpt-oss-120b` as the tool-using shopping agent and `llama3-groq-70b-tool-use` as the structured-JSON safety checker; ElevenLabs for the characters' voices, sound effects and the video narration.

**Additional sponsor tools:** AG Grid (Community) for the Activity log: sortable/filterable grid, quick search, pinned totals row, CSV export, custom status renderer, row-click detail drawer. Render for hosting.

**Testing instructions:** Hosted demo at https://allowance-kdvo.onrender.com; the PayPal sandbox buyer is already linked, so go to Shop with Scout and type a task (suggested walkthrough in the README). To see the money move on PayPal's side, log in at https://www.sandbox.paypal.com with the sandbox buyer `sb-tm78g53689249@personal.example.com` and the password given in the private testing-instructions field. Test money only.

**AG Grid experience:** the Community edition covered everything the activity log needed (theming API, quick filter, CSV export, pinned rows, custom cell renderers) in an afternoon.

**AI tools leveraged while building:** Claude Code (Anthropic) for implementation, Claude Design for the screens, ElevenLabs for audio, the ASU LLM gateway for the in-app models. Solo project.
