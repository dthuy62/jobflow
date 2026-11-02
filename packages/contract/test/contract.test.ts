import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  CV_UPLOAD_MAX_BYTES,
  CvUpdateRequestSchema,
  ERROR_STATUS,
  ErrorCodeSchema,
  ErrorResponseDtoSchema,
  EvaluationDtoSchema,
  HealthDtoSchema,
  JobDtoSchema,
  MeDtoSchema,
  PreferencesDtoSchema,
  operations,
  type Operation
} from "../src/index.js";
import { buildOpenApiDocument, loadExample, serializeOpenApiDocument } from "../src/openapi.js";

const contractsDir = fileURLToPath(new URL("../../../contracts/", import.meta.url));
const examplesDir = path.join(contractsDir, "examples");
const operationName = ({ method, path: route }: Operation) => `${method} ${route}`;

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

const responses = operations.flatMap((operation) =>
  Object.entries(operation.responses).map(([status, response]) => ({ operation, status: Number(status), response }))
);

describe("operations", () => {
  it("has one entry per method and path", () => {
    const names = operations.map(operationName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("covers the first release's endpoints", () => {
    expect(operations.map(operationName).sort()).toEqual(
      [
        "GET /api/v1/health",
        "GET /api/v1/me",
        "DELETE /api/v1/me",
        "GET /api/v1/me/preferences",
        "PUT /api/v1/me/preferences",
        "POST /api/v1/me/cv/import",
        "GET /api/v1/me/cv",
        "PUT /api/v1/me/cv",
        "GET /api/v1/feed",
        "GET /api/v1/jobs/{jobId}",
        "PUT /api/v1/jobs/{jobId}/tracker",
        "DELETE /api/v1/jobs/{jobId}/tracker",
        "GET /api/v1/tracker",
        "POST /api/v1/companies",
        "PUT /api/v1/me/devices/{installationId}",
        "DELETE /api/v1/me/devices/{installationId}",
        "POST /api/v1/jobs/{jobId}/evaluations",
        "GET /api/v1/evaluations/{evaluationId}",
        "GET /api/v1/me/entitlement",
        "POST /api/v1/me/purchases"
      ].sort()
    );
  });

  it("requires bearer auth on every operation except GET /health", () => {
    const open = operations.filter((operation) => operation.public).map(operationName);
    expect(open).toEqual(["GET /api/v1/health"]);
  });

  it("documents auth, rate limit and outage errors on every authenticated operation", () => {
    for (const operation of operations.filter((candidate) => !candidate.public)) {
      for (const status of [401, 429, 500, 503]) {
        expect(operation.responses[status], `${operationName(operation)} ${status}`).toBeDefined();
      }
    }
  });

  it("documents the rules that cost money", () => {
    const evaluate = operations.find((operation) => operationName(operation) === "POST /api/v1/jobs/{jobId}/evaluations");
    expect(evaluate?.headers).toEqual([expect.objectContaining({ name: "X-Integrity-Token", required: true })]);
    expect(evaluate?.responses[403]?.examples).toEqual(
      expect.arrayContaining(["errors/sign-in-required", "errors/entitlement-required", "errors/integrity-failed"])
    );
    expect(evaluate?.responses[429]?.examples).toEqual(expect.arrayContaining(["errors/quota-exceeded", "errors/rate-limited"]));

    const importCv = operations.find((operation) => operationName(operation) === "POST /api/v1/me/cv/import");
    expect(importCv?.headers).toEqual([expect.objectContaining({ name: "X-Integrity-Token", required: false })]);
    expect(importCv?.responses[403]?.examples).toEqual(
      expect.arrayContaining(["errors/sign-in-required", "errors/entitlement-required", "errors/integrity-failed"])
    );
    expect(Object.keys(importCv?.responses ?? {})).toEqual(expect.arrayContaining(["413", "415", "422"]));
    expect(CV_UPLOAD_MAX_BYTES).toBe(5 * 1024 * 1024);
  });

  it("declares every path parameter", () => {
    for (const operation of operations) {
      const inPath = [...operation.path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
      expect(operation.pathParams ?? [], operationName(operation)).toEqual(inPath);
      if (inPath.length > 0) expect(operation.responses[404], operationName(operation)).toBeDefined();
    }
  });
});

describe("examples", () => {
  it.each(responses.map((entry) => [`${operationName(entry.operation)} ${entry.status}`, entry] as const))(
    "%s has examples that parse with its schema",
    (_name, { status, response }) => {
      if (response.schema === null) {
        expect(status).toBeOneOf([202, 204]);
        expect(response.examples).toEqual([]);
        return;
      }
      expect(response.examples.length, "documented status has no example").toBeGreaterThan(0);
      for (const example of response.examples) {
        response.schema.parse(loadExample(examplesDir, example));
      }
    }
  );

  it.each(operations.filter((operation) => operation.request?.kind === "json").map((operation) => [operationName(operation), operation] as const))(
    "%s has a request example that parses with its schema",
    (_name, operation) => {
      const request = operation.request;
      if (request?.kind !== "json") throw new Error("expected a JSON request");
      request.schema.parse(loadExample(examplesDir, request.example));
    }
  );

  it("lists each error example under the status of its code", () => {
    for (const { status, response } of responses.filter((entry) => entry.response.schema === ErrorResponseDtoSchema)) {
      for (const example of response.examples) {
        const { error } = ErrorResponseDtoSchema.parse(loadExample(examplesDir, example));
        expect(ERROR_STATUS[error.code], example).toBe(status);
      }
    }
  });

  it("has a file for every error code, and contracts/error-codes.json lists the same codes", () => {
    const listed = JSON.parse(readFileSync(path.join(contractsDir, "error-codes.json"), "utf8"));
    expect(listed).toEqual([...ErrorCodeSchema.options].sort());
    const inFiles = readdirSync(path.join(examplesDir, "errors"))
      .map((name) => ErrorResponseDtoSchema.parse(JSON.parse(readFileSync(path.join(examplesDir, "errors", name), "utf8"))).error.code)
      .sort();
    expect(inFiles).toEqual([...ErrorCodeSchema.options].sort());
  });

  it("uses every example file", () => {
    const used = new Set(
      operations.flatMap((operation) => [
        ...Object.values(operation.responses).flatMap((response) => response.examples),
        ...(operation.request?.kind === "json" ? [operation.request.example] : [])
      ])
    );
    const files = listFiles(examplesDir).map((file) => path.relative(examplesDir, file).replace(/\.json$/, ""));
    expect(files.filter((file) => !used.has(file))).toEqual([]);
  });

  it("holds only synthetic data", () => {
    const forbidden = [/career-ops/i, /career ops/i, /\/Users\//, /\/home\//, /[A-Za-z]:\\/];
    const texts = [...listFiles(examplesDir), path.join(contractsDir, "openapi.json")].map((file) => [file, readFileSync(file, "utf8")] as const);
    for (const [file, text] of texts) {
      for (const pattern of forbidden) expect(text, `${file} matches ${pattern}`).not.toMatch(pattern);
      for (const [email] of text.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) {
        expect(email.endsWith("@example.com"), `${file} has ${email}`).toBe(true);
      }
    }
  });
});

describe("schemas", () => {
  it("reject unknown fields, so a response cannot carry extra data unnoticed", () => {
    expect(() => MeDtoSchema.parse({ userId: "user_1", isAnonymous: true, createdAt: "2026-11-02T00:00:00.000Z", email: "a@example.com" })).toThrow(z.ZodError);
    expect(() => CvUpdateRequestSchema.parse({ markdown: "# CV", extra: 1 })).toThrow(z.ZodError);
  });

  it("tie health status to its checks", () => {
    expect(() => HealthDtoSchema.parse({ status: "ok", checks: { database: "failed" } })).toThrow(z.ZodError);
    expect(() => HealthDtoSchema.parse({ status: "degraded", checks: { database: "ok" } })).toThrow(z.ZodError);
  });

  it("require a result only on a finished evaluation, and label it as AI output", () => {
    const base = { evaluationId: "evaluation_1", jobId: "job_1", createdAt: "2026-11-02T00:00:00.000Z", updatedAt: "2026-11-02T00:00:00.000Z" };
    const result = { score: 80, summary: "Fits.", reportMarkdown: "# Report", aiGenerated: true };
    expect(() => EvaluationDtoSchema.parse({ ...base, stage: "done", result: null, failureMessage: null })).toThrow(z.ZodError);
    expect(() => EvaluationDtoSchema.parse({ ...base, stage: "queued", result, failureMessage: null })).toThrow(z.ZodError);
    expect(() => EvaluationDtoSchema.parse({ ...base, stage: "failed", result: null, failureMessage: null })).toThrow(z.ZodError);
    expect(() => EvaluationDtoSchema.parse({ ...base, stage: "done", result: { ...result, aiGenerated: false }, failureMessage: null })).toThrow(z.ZodError);
    expect(EvaluationDtoSchema.parse({ ...base, stage: "done", result, failureMessage: null }).stage).toBe("done");
  });

  it("limit preferences and job text to sane sizes", () => {
    const preferences = {
      roles: [],
      keywordsInclude: [],
      keywordsExclude: [],
      locations: [],
      remotePolicies: [],
      countries: [],
      minimumSalary: null,
      seniority: [],
      aim: null
    };
    expect(PreferencesDtoSchema.parse(preferences)).toEqual(preferences);
    expect(() => PreferencesDtoSchema.parse({ ...preferences, roles: Array.from({ length: 51 }, () => "x") })).toThrow(z.ZodError);
    expect(() => PreferencesDtoSchema.parse({ ...preferences, roles: ["x".repeat(201)] })).toThrow(z.ZodError);
    expect(() => PreferencesDtoSchema.parse({ ...preferences, countries: ["Vietnam"] })).toThrow(z.ZodError);
    expect(() => PreferencesDtoSchema.parse({ ...preferences, aim: "x".repeat(1001) })).toThrow(z.ZodError);
    expect(JobDtoSchema).toBeDefined();
  });

  it("accept only web URLs for a job", () => {
    const job = loadExample(examplesDir, "job.valid") as Record<string, unknown>;
    expect(() => JobDtoSchema.parse(job)).not.toThrow();
    expect(() => JobDtoSchema.parse({ ...job, url: "file:///etc/passwd" })).toThrow(z.ZodError);
    expect(() => JobDtoSchema.parse({ ...job, url: "javascript:alert(1)" })).toThrow(z.ZodError);
  });
});

describe("OpenAPI document", () => {
  const document = buildOpenApiDocument(examplesDir);

  it("matches contracts/openapi.json", () => {
    expect(readFileSync(path.join(contractsDir, "openapi.json"), "utf8")).toBe(serializeOpenApiDocument(document));
  });

  it("is OpenAPI 3.1, with every operation and bearer security except health", () => {
    expect(document.openapi).toBe("3.1.0");
    for (const operation of operations) {
      const entry = document.paths[operation.path]?.[operation.method.toLowerCase()];
      expect(entry, operationName(operation)).toBeDefined();
      expect(entry.security, operationName(operation)).toEqual(operation.public ? [] : [{ bearerAuth: [] }]);
    }
    expect(document.components.securitySchemes.bearerAuth).toEqual({ type: "http", scheme: "bearer", bearerFormat: "JWT" });
  });

  it("embeds each response example under a key that Prefer: example= can name", () => {
    const entry = document.paths["/api/v1/health"]?.get;
    expect(Object.keys(entry.responses["503"].content["application/json"].examples)).toEqual(["health.degraded"]);
    expect(entry.responses["503"].content["application/json"].examples["health.degraded"].value).toEqual(loadExample(examplesDir, "health.degraded"));
  });

  it("resolves every schema reference", () => {
    const refs = [...JSON.stringify(document).matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)].map((match) => match[1] as string);
    expect(refs.length).toBeGreaterThan(0);
    for (const name of refs) expect(document.components.schemas[name], name).toBeDefined();
  });
});
