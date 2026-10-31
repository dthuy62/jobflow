import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ErrorCode } from "../src/contracts/index.js";
import { errorStatusByCode } from "../src/errors/error-mapper.js";
import { buildOpenApiDocument } from "../src/openapi/openapi-document.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface CoveredOperation {
  readonly method: "get" | "post";
  readonly path: string;
  readonly successStatus: string;
  /** Route module plus the service it calls; routes import services as types only. */
  readonly sources: readonly string[];
  /**
   * Error codes thrown somewhere in `sources`' import graph that this operation
   * cannot return, each with the reason. The test fails if one stops being
   * reachable, so this list cannot go stale.
   */
  readonly unreachable?: Partial<Record<ErrorCode, string>>;
}

const scanRunReads: Partial<Record<ErrorCode, string>> = {
  VALIDATION_ERROR: "Only startScan parses a request; readiness input errors become checklist entries.",
  PATH_OUTSIDE_WORKSPACE: "Readiness input errors become checklist entries.",
  PAYLOAD_TOO_LARGE: "Readiness input errors become checklist entries.",
  SCAN_ALREADY_RUNNING: "Only startScan checks for an active run.",
  WORKSPACE_UNHEALTHY: "Only startScan runs the readiness gate."
};

const toleratedSources = "readCareerOpsData is called with tolerateUnreadableSources; file listings skip bad entries.";

const operations: readonly CoveredOperation[] = [
  {
    method: "post",
    path: "/api/v1/scan-runs",
    successStatus: "202",
    sources: ["src/api/scan-run-routes.ts", "src/services/scan-run-service.ts"],
    unreachable: {
      NOT_FOUND: "Only scan-run reads look runs up.",
      PATH_OUTSIDE_WORKSPACE: "Readiness input errors become checklist entries."
    }
  },
  {
    method: "get",
    path: "/api/v1/scan-runs/latest",
    successStatus: "200",
    sources: ["src/api/scan-run-routes.ts", "src/services/scan-run-service.ts"],
    unreachable: scanRunReads
  },
  {
    method: "get",
    path: "/api/v1/scan-runs/{id}",
    successStatus: "200",
    sources: ["src/api/scan-run-routes.ts", "src/services/scan-run-service.ts"],
    unreachable: scanRunReads
  },
  {
    method: "get",
    path: "/api/v1/offers",
    successStatus: "200",
    sources: ["src/api/offer-routes.ts", "src/services/offer-service.ts"],
    unreachable: { NOT_FOUND: "Only the detail route looks an offer up." }
  },
  {
    method: "get",
    path: "/api/v1/offers/{id}",
    successStatus: "200",
    sources: ["src/api/offer-routes.ts", "src/services/offer-service.ts"]
  },
  {
    method: "get",
    path: "/api/v1/reports",
    successStatus: "200",
    sources: ["src/api/report-routes.ts", "src/services/report-service.ts"],
    unreachable: {
      NOT_FOUND: "Only the detail route looks a report up.",
      PATH_OUTSIDE_WORKSPACE: toleratedSources,
      PAYLOAD_TOO_LARGE: "Tolerated sources; an oversized report is listed without its Markdown."
    }
  },
  {
    method: "get",
    path: "/api/v1/reports/{id}",
    successStatus: "200",
    sources: ["src/api/report-routes.ts", "src/services/report-service.ts"],
    unreachable: { PATH_OUTSIDE_WORKSPACE: toleratedSources }
  },
  {
    method: "get",
    path: "/api/v1/artifacts",
    successStatus: "200",
    sources: ["src/api/artifact-routes.ts", "src/services/artifact-service.ts"],
    unreachable: {
      NOT_FOUND: "Only the download route looks an artifact up.",
      PATH_OUTSIDE_WORKSPACE: toleratedSources,
      PAYLOAD_TOO_LARGE: toleratedSources
    }
  },
  {
    method: "get",
    path: "/api/v1/artifacts/{id}/download",
    successStatus: "200",
    sources: ["src/api/artifact-routes.ts", "src/services/artifact-service.ts"],
    unreachable: {
      PATH_OUTSIDE_WORKSPACE: "openArtifactForDownload maps open and real-path failures to NOT_FOUND.",
      PAYLOAD_TOO_LARGE: "Downloads stream the file; only readCareerOpsData (list only) enforces size limits."
    }
  }
];

/** Every `ApiError("CODE"` in the modules reachable through value imports from `sources`. */
function reachableErrorCodes(sources: readonly string[]): Set<ErrorCode> {
  const seen = new Set<string>();
  const pending = sources.map((source) => resolve(packageRoot, source));
  const codes = new Set<ErrorCode>();

  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);
    const text = readFileSync(file, "utf8");

    for (const match of text.matchAll(/ApiError\(\s*"([A-Z_]+)"/g)) {
      codes.add(match[1] as ErrorCode);
    }
    for (const match of text.matchAll(/^import\s+(?!type\s)[^;]*?from\s+"(\.[^"]+)\.js";/gm)) {
      const target = resolve(dirname(file), `${match[1]}.ts`);
      if (existsSync(target)) {
        pending.push(target);
      } else {
        throw new Error(`Cannot resolve ${match[1]} from ${relative(packageRoot, file)}`);
      }
    }
  }

  return codes;
}

/** Statuses an operation can return, derived from its code paths and the shared request pipeline. */
function derivedStatuses(operation: CoveredOperation, hasRequestBody: boolean): string[] {
  const codes = reachableErrorCodes(operation.sources);
  for (const code of Object.keys(operation.unreachable ?? {})) {
    codes.delete(code as ErrorCode);
  }
  // The pairing-token guard covers every /api/v1 route except GET /health, and
  // the error mapper turns any unknown failure into UNEXPECTED_ERROR.
  codes.add("UNAUTHORIZED");
  codes.add("UNEXPECTED_ERROR");
  if (hasRequestBody) {
    // Fastify body parsing: malformed JSON and the body size limit.
    codes.add("VALIDATION_ERROR");
    codes.add("PAYLOAD_TOO_LARGE");
  }
  if (operation.path.includes("{id}")) {
    // The /api/v1 not-found handler answers an ID too long for the router.
    codes.add("NOT_FOUND");
  }

  return [operation.successStatus, ...[...codes].map((code) => String(errorStatusByCode[code]))].sort();
}

describe("OpenAPI status coverage", () => {
  const document = buildOpenApiDocument();

  it("covers every {id} route", () => {
    const idPaths = Object.keys(document.paths).filter((path) => path.includes("{id}"));
    const covered = operations.map((operation) => operation.path);

    expect(covered).toEqual(expect.arrayContaining(idPaths));
  });

  it.each(operations)("documents every status $method $path can return", (operation) => {
    const documented = document.paths[operation.path]?.[operation.method];
    expect(documented, `${operation.method} ${operation.path} is not documented`).toBeDefined();

    const expected = derivedStatuses(operation, documented?.requestBody !== undefined);
    expect(Object.keys(documented?.responses ?? {}).sort()).toEqual(expected);
  });

  it.each(operations.filter((operation) => operation.unreachable))(
    "keeps the unreachable codes for $method $path in its import graph",
    (operation) => {
      const reachable = reachableErrorCodes(operation.sources);
      for (const code of Object.keys(operation.unreachable ?? {})) {
        expect(reachable.has(code as ErrorCode), `${code} is no longer thrown; drop it from unreachable`).toBe(true);
      }
    }
  );
});
