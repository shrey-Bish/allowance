// AI risk checker (spec §7) with a fail-safe: any error → "review".
import { json, isLlmConfigured, LlmError, checkerModel } from "@/lib/llm";
import { EMPTY_SIGNALS, RiskVerdictSchema, type RiskVerdict } from "@/lib/types";
import { RISK_SYSTEM_PROMPT, buildRiskUserPrompt, type RiskInput } from "./prompt";

export type { RiskInput } from "./prompt";

export interface RiskCheckResult {
  verdict: RiskVerdict;
  /** true when the AI could not be reached and the fail-safe verdict was used */
  unavailable: boolean;
  model: string;
  latencyMs: number;
  prompt: { system: string; user: string };
  rawError?: string;
}

export const RISK_TIMEOUT_MS = 8_000;

export const FAILSAFE_VERDICT: RiskVerdict = {
  verdict: "review",
  risk_score: 50,
  reasons: ["Automatic safety check unavailable — please review."],
  signals: EMPTY_SIGNALS,
};

export async function checkRisk(input: RiskInput): Promise<RiskCheckResult> {
  const prompt = { system: RISK_SYSTEM_PROMPT, user: buildRiskUserPrompt(input) };
  const started = Date.now();
  const model = checkerModel();

  if (!isLlmConfigured() || !model) {
    return { verdict: FAILSAFE_VERDICT, unavailable: true, model, latencyMs: 0, prompt, rawError: "LLM not configured" };
  }

  try {
    const verdict = await json(
      [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      RiskVerdictSchema,
      { model, timeoutMs: RISK_TIMEOUT_MS },
    );
    return { verdict: enforceInvariants(verdict), unavailable: false, model, latencyMs: Date.now() - started, prompt };
  } catch (err) {
    const message = err instanceof LlmError ? err.message : String(err);
    return { verdict: FAILSAFE_VERDICT, unavailable: true, model, latencyMs: Date.now() - started, prompt, rawError: message };
  }
}

/** Belt-and-braces: an injection signal is always a block; keep reasons short. */
export function enforceInvariants(v: RiskVerdict): RiskVerdict {
  const out: RiskVerdict = { ...v, reasons: v.reasons.map((r) => r.trim()).filter(Boolean).slice(0, 4) };
  if (out.signals.prompt_injection_detected && out.verdict !== "block") {
    out.verdict = "block";
    out.risk_score = Math.max(out.risk_score, 90);
  }
  return out;
}

export function verdictToOutcome(v: RiskVerdict["verdict"]): "ALLOW" | "REVIEW" | "BLOCK" {
  return v === "ok" ? "ALLOW" : v === "review" ? "REVIEW" : "BLOCK";
}
