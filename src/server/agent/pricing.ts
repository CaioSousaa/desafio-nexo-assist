import type { DecisionUsage } from "../decisions/repo";

/** Preços pagos da API do Google, em US$ por milhão de tokens (2026-10-26). No free tier o cobrado é zero. */
export const PRICES: Record<string, { input: number; output: number; cachedInput: number }> = {
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5, cachedInput: 0.03 },
  "gemini-3.8-flash": { input: 0.75, output: 3.75, cachedInput: 0.075 },
};

export interface RawUsage {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
}

export function costUsd(usage: RawUsage, model: string): number {
  const price = PRICES[model.replace(/^google\//, "")];
  if (!price) return 0;
  const input = usage.inputTokens ?? 0;
  const cached = Math.min(usage.cachedInputTokens ?? 0, input);
  const output = usage.outputTokens ?? 0;
  return ((input - cached) * price.input + cached * price.cachedInput + output * price.output) / 1_000_000;
}

export function toDecisionUsage(usage: RawUsage | undefined, model: string): DecisionUsage {
  const safe = {
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cachedInputTokens: usage?.cachedInputTokens ?? 0,
  };
  return { ...safe, costUsd: Number(costUsd(safe, model).toFixed(6)) };
}
