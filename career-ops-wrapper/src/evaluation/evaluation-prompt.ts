import { randomBytes } from "node:crypto";
import { ApiError } from "../errors/api-error.js";
import { readOptionalWorkspaceText } from "../workspace/workspace-reader.js";

// Builds the stdin body for the AI CLI. Workspace files are the candidate's
// own and trusted like the rest of the workspace; the posting and the scan
// metadata come from the internet. Every block is fenced with one random
// nonce, and closing-tag text is removed from its content, so no block can
// close itself early and pretend to be wrapper text.

export const REQUIRED_INPUT_MAX_BYTES = 256 * 1024;
export const OPTIONAL_INPUT_MAX_BYTES = 64 * 1024;

export interface EvaluationInputs {
  readonly sharedRubric: string;
  readonly offerRubric: string;
  readonly cv: string;
  /** `modes/_profile.md` and `config/profile.yml`, joined; empty when neither exists. */
  readonly profile: string;
  /** `article-digest.md`; empty when absent. */
  readonly proofPoints: string;
}

export interface ReadEvaluationInputsResult {
  readonly inputs?: EvaluationInputs;
  /** Readiness keys for required files that are missing or too large. */
  readonly missingRequirements: string[];
  readonly warnings: string[];
}

export interface PromptOffer {
  readonly company: string;
  readonly title: string;
  readonly location: string | null;
  readonly url: string;
}

const REQUIRED_FILES = [
  { key: "cv", path: "cv.md", missing: "cv.missing", tooLarge: "cv.too-large" },
  { key: "sharedRubric", path: "modes/_shared.md", missing: "modes.shared-missing", tooLarge: "modes.too-large" },
  { key: "offerRubric", path: "modes/oferta.md", missing: "modes.offer-missing", tooLarge: "modes.too-large" }
] as const;

const OPTIONAL_PROFILE_FILES = ["modes/_profile.md", "config/profile.yml"] as const;
const OPTIONAL_PROOF_FILE = "article-digest.md";
const OPTIONAL_TOO_LARGE_WARNING = "An optional profile file was too large and was left out.";

type ReadOutcome = { kind: "ok"; content: string } | { kind: "missing" } | { kind: "too-large" };

export async function readEvaluationInputs(workspace: string): Promise<ReadEvaluationInputsResult> {
  const missingRequirements: string[] = [];
  const warnings: string[] = [];
  const required: Partial<Record<(typeof REQUIRED_FILES)[number]["key"], string>> = {};

  for (const file of REQUIRED_FILES) {
    const outcome = await readInput(workspace, file.path, REQUIRED_INPUT_MAX_BYTES);
    if (outcome.kind === "ok" && outcome.content.trim() !== "") {
      required[file.key] = outcome.content;
    } else {
      const key = outcome.kind === "too-large" ? file.tooLarge : file.missing;
      if (!missingRequirements.includes(key)) {
        missingRequirements.push(key);
      }
    }
  }

  const optional = async (relativePath: string): Promise<string> => {
    const outcome = await readInput(workspace, relativePath, OPTIONAL_INPUT_MAX_BYTES);
    if (outcome.kind === "too-large" && !warnings.includes(OPTIONAL_TOO_LARGE_WARNING)) {
      warnings.push(OPTIONAL_TOO_LARGE_WARNING);
    }
    return outcome.kind === "ok" ? outcome.content : "";
  };
  const profile = (await Promise.all(OPTIONAL_PROFILE_FILES.map(optional))).filter((text) => text.trim() !== "");
  const proofPoints = await optional(OPTIONAL_PROOF_FILE);

  if (required.cv === undefined || required.sharedRubric === undefined || required.offerRubric === undefined) {
    return { missingRequirements, warnings };
  }
  return {
    inputs: {
      cv: required.cv,
      sharedRubric: required.sharedRubric,
      offerRubric: required.offerRubric,
      profile: profile.join("\n\n"),
      proofPoints
    },
    missingRequirements,
    warnings
  };
}

export function buildEvaluationPrompt(
  inputs: EvaluationInputs,
  offer: PromptOffer,
  posting: string,
  nonce: string = randomBytes(8).toString("hex")
): string {
  const metadata = [
    `Company: ${offer.company}`,
    `Title: ${offer.title}`,
    `Location: ${offer.location ?? "unknown"}`,
    `URL: ${offer.url}`
  ].join("\n");

  return [
    block("rubric_shared", inputs.sharedRubric, nonce),
    block("rubric_offer", inputs.offerRubric, nonce),
    block("candidate_cv", inputs.cv, nonce),
    block("candidate_profile", inputs.profile, nonce),
    block("proof_points", inputs.proofPoints, nonce),
    block("offer_metadata", metadata, nonce),
    block("job_posting", posting, nonce)
  ].join("\n\n");
}

function block(name: string, content: string, nonce: string): string {
  const closing = new RegExp(`</\\s*${name}`, "gi");
  // Repeat until nothing changes: one pass could join the leftover pieces of
  // a nested tag (`</</job_postingjob_posting>`) into a new closing tag.
  let fenced = content;
  for (let previous = ""; previous !== fenced; ) {
    previous = fenced;
    fenced = fenced.replace(closing, "");
  }
  return `<${name} nonce="${nonce}">\n${fenced}\n</${name} nonce="${nonce}">`;
}

async function readInput(workspace: string, relativePath: string, maxBytes: number): Promise<ReadOutcome> {
  try {
    const file = await readOptionalWorkspaceText(workspace, relativePath, maxBytes);
    return file ? { kind: "ok", content: file.content } : { kind: "missing" };
  } catch (error) {
    if (error instanceof ApiError && error.code === "PAYLOAD_TOO_LARGE") {
      return { kind: "too-large" };
    }
    return { kind: "missing" };
  }
}
