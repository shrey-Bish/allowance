// Provider-agnostic LLM wrapper (spec §5). Any OpenAI-compatible gateway works:
// set LLM_BASE_URL + LLM_API_KEY. Handles 429 backoff and per-call timeouts.
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionMessageFunctionToolCall,
} from "openai/resources/chat/completions";
import type { ZodType } from "zod";

export type LlmMessage = ChatCompletionMessageParam;
export type LlmTool = ChatCompletionTool;
export type LlmToolCall = ChatCompletionMessageFunctionToolCall;

export interface LlmOptions {
  model?: string;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
}

export class LlmError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LlmError";
  }
}

let client: OpenAI | null = null;

export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY);
}

export function getLlmClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new LlmError("LLM_API_KEY is not set");
  client = new OpenAI({
    apiKey: apiKey.trim(),
    baseURL: (process.env.LLM_BASE_URL ?? "https://openai.rc.asu.edu/v1").trim(),
    maxRetries: 0, // we do our own backoff so timeouts stay predictable
  });
  return client;
}

export function agentModel(): string {
  return process.env.AGENT_MODEL ?? "";
}
export function checkerModel(): string {
  return process.env.CHECKER_MODEL ?? process.env.AGENT_MODEL ?? "";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries 429/5xx with exponential backoff, within an overall deadline. */
async function withBackoff<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      return await fn(controller.signal);
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const retryable = status === 429 || (typeof status === "number" && status >= 500);
      if (!retryable || controller.signal.aborted) break;
      attempt += 1;
      const wait = Math.min(4000, 500 * 2 ** attempt);
      if (Date.now() + wait >= deadline) break;
      await sleep(wait);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new LlmError(`LLM call failed: ${(lastErr as Error)?.message ?? "timeout"}`, lastErr);
}

/** Plain text completion. */
export async function chat(messages: LlmMessage[], opts: LlmOptions = {}): Promise<string> {
  const model = opts.model ?? agentModel();
  const res = await withBackoff(
    (signal) =>
      getLlmClient().chat.completions.create(
        { model, messages, temperature: opts.temperature ?? 0.2, max_tokens: opts.maxTokens },
        { signal },
      ),
    opts.timeoutMs ?? 30_000,
  );
  return res.choices[0]?.message?.content ?? "";
}

export interface ToolTurn {
  content: string | null;
  toolCalls: LlmToolCall[];
  raw: ChatCompletionMessageParam;
}

/** One turn of a tool-using conversation. Caller executes tools and loops. */
export async function chatWithTools(
  messages: LlmMessage[],
  tools: LlmTool[],
  opts: LlmOptions = {},
): Promise<ToolTurn> {
  const model = opts.model ?? agentModel();
  const res = await withBackoff(
    (signal) =>
      getLlmClient().chat.completions.create(
        {
          model,
          messages,
          tools,
          tool_choice: "auto",
          temperature: opts.temperature ?? 0.2,
          max_tokens: opts.maxTokens,
        },
        { signal },
      ),
    opts.timeoutMs ?? 45_000,
  );
  const msg = res.choices[0]?.message;
  if (!msg) throw new LlmError("empty completion");
  const toolCalls = (msg.tool_calls ?? []).filter((t): t is LlmToolCall => t.type === "function");
  return {
    content: msg.content ?? null,
    toolCalls,
    raw: { role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls } as ChatCompletionMessageParam,
  };
}

/** JSON completion validated with zod. Throws LlmError on invalid output. */
export async function json<T>(messages: LlmMessage[], schema: ZodType<T>, opts: LlmOptions = {}): Promise<T> {
  const model = opts.model ?? checkerModel();
  const res = await withBackoff(
    (signal) =>
      getLlmClient().chat.completions.create(
        {
          model,
          messages,
          temperature: opts.temperature ?? 0,
          max_tokens: opts.maxTokens ?? 600,
          response_format: { type: "json_object" },
        },
        { signal },
      ),
    opts.timeoutMs ?? 8_000,
  );
  const text = res.choices[0]?.message?.content ?? "";
  const parsed = schema.safeParse(extractJson(text));
  if (!parsed.success) throw new LlmError(`LLM returned invalid JSON: ${parsed.error.message}`);
  return parsed.data;
}

/** Tolerates ```json fences and leading prose. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export interface ModelInfo {
  id: string;
  supports_function_calling?: boolean;
  supports_vision?: boolean;
  [k: string]: unknown;
}

/** GET /v1/models with the gateway's extra capability flags (ASU exposes them). */
export async function listModels(): Promise<ModelInfo[]> {
  const page = await getLlmClient().models.list();
  const out: ModelInfo[] = [];
  for await (const m of page) out.push(m as unknown as ModelInfo);
  return out;
}
