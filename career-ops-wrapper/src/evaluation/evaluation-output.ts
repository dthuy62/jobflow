import { EvaluationModelOutputSchema, type EvaluationModelOutput } from "../contracts/index.js";

export type ParsedCliOutput =
  | { readonly ok: true; readonly output: EvaluationModelOutput }
  | { readonly ok: false; readonly kind: "not-json" | "schema" }
  | { readonly ok: false; readonly kind: "is-error"; readonly resultText: string };

/**
 * Reads `claude -p --output-format json`. The answer may arrive as
 * `structured_output` (with `--json-schema`) or as JSON text in `result`;
 * either way it is validated here, whatever the CLI enforced.
 */
export function parseCliOutput(stdout: string): ParsedCliOutput {
  const envelope = parseJson(stdout.trim());
  if (typeof envelope !== "object" || envelope === null || Array.isArray(envelope)) {
    return { ok: false, kind: "not-json" };
  }
  const record = envelope as Record<string, unknown>;
  const resultText = typeof record.result === "string" ? record.result : "";

  if (record.is_error === true) {
    return { ok: false, kind: "is-error", resultText };
  }

  const candidate =
    typeof record.structured_output === "object" && record.structured_output !== null
      ? record.structured_output
      : parseJson(stripCodeFence(resultText));
  if (candidate === undefined) {
    return { ok: false, kind: "not-json" };
  }

  const parsed = EvaluationModelOutputSchema.safeParse(candidate);
  return parsed.success ? { ok: true, output: parsed.data } : { ok: false, kind: "schema" };
}

function stripCodeFence(text: string): string {
  const fenced = text.trim().match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/i);
  return (fenced?.[1] ?? text).trim();
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
