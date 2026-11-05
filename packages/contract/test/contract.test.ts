import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  CV_IMPORT_RETENTION_HOURS,
  CV_UPLOAD_MAX_BYTES,
  CompanyCreateRequestSchema,
  DEVICE_MAX_PER_USER,
  CvUpdateRequestSchema,
  DeviceUpdateRequestSchema,
  ErrorDtoSchema,
  ERROR_STATUS,
  ErrorCodeSchema,
  ErrorResponseDtoSchema,
  EvaluationDtoSchema,
  HealthDtoSchema,
  JobDtoSchema,
  LogoutRequestSchema,
  MeDtoSchema,
  PreferencesDtoSchema,
  PurchaseRequestSchema,
  SsoRequestSchema,
  SsoResponseDtoSchema,
  operations,
  type Operation
} from "../src/index.js";
import { buildOpenApiDocument, loadExample, serializeOpenApiDocument } from "../src/openapi.js";

const contractsDir = fileURLToPath(new URL("../../../contracts/", import.meta.url));
const examplesDir = path.join(contractsDir, "examples");
const operationName = ({ method, path: route }: Operation) => `${method} ${route}`;

function find(name: string): Operation {
  const operation = operations.find((candidate) => operationName(candidate) === name);
  if (!operation) throw new Error(`No operation ${name}`);
  return operation;
}

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
        "POST /api/v1/auth/guest",
        "POST /api/v1/auth/sso",
        "POST /api/v1/auth/logout",
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

  it("documents the rate limit on the public route too, because limits apply before auth", () => {
    for (const operation of operations) {
      expect(operation.responses[429]?.examples, operationName(operation)).toContain("errors/rate-limited");
    }
  });

  it("refuses anonymous users and enforces a cap when adding to the shared job index", () => {
    const addCompany = find("POST /api/v1/companies");
    expect(addCompany.responses[403]?.examples).toEqual(["errors/sign-in-required"]);
    expect(addCompany.responses[429]?.examples).toEqual(expect.arrayContaining(["errors/quota-exceeded", "errors/rate-limited"]));
  });

  it("documents the rules that cost money", () => {
    const evaluate = find("POST /api/v1/jobs/{jobId}/evaluations");
    expect(evaluate.headers).toEqual([expect.objectContaining({ name: "X-Integrity-Token", required: true })]);
    expect(evaluate.headers?.[0]?.description).toContain("INTEGRITY_FAILED");
    expect(evaluate.responses[403]?.examples).toEqual(
      expect.arrayContaining(["errors/sign-in-required", "errors/entitlement-required", "errors/integrity-failed"])
    );
    expect(evaluate.responses[429]?.examples).toEqual(expect.arrayContaining(["errors/quota-exceeded", "errors/rate-limited"]));

    const importCv = find("POST /api/v1/me/cv/import");
    expect(importCv.headers).toEqual([expect.objectContaining({ name: "X-Integrity-Token", required: false })]);
    expect(importCv.responses[403]?.examples).toEqual(
      expect.arrayContaining(["errors/sign-in-required", "errors/entitlement-required", "errors/integrity-failed"])
    );
    expect(importCv.responses[429]?.examples).toEqual(expect.arrayContaining(["errors/quota-exceeded", "errors/rate-limited"]));
    expect(Object.keys(importCv.responses)).toEqual(expect.arrayContaining(["413", "415", "422"]));
    expect(CV_UPLOAD_MAX_BYTES).toBe(5 * 1024 * 1024);
  });

  it("documents that text too long to return is a 413, not a server error", () => {
    const importCv = find("POST /api/v1/me/cv/import");
    expect(importCv.responses[413]?.description).toMatch(/extracted/i);
    expect(importCv.summary).toMatch(/extracted text/i);
  });

  it("says how long a pending CV import is held, and that deleting the account removes it", () => {
    const importCv = find("POST /api/v1/me/cv/import");
    expect(importCv.summary).not.toMatch(/nothing is stored/i);
    expect(importCv.summary).toMatch(/encrypted/i);
    expect(CV_IMPORT_RETENTION_HOURS).toBe(24);
    expect(importCv.summary).toContain("24 hours");
    expect(importCv.summary).toMatch(/replaces/i);
    expect(find("DELETE /api/v1/me").summary).toMatch(/pending CV import/i);
  });

  it("declares every path parameter", () => {
    for (const operation of operations) {
      const inPath = [...operation.path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
      expect(operation.pathParams ?? [], operationName(operation)).toEqual(inPath);
      if (inPath.length > 0) expect(operation.responses[400], `${operationName(operation)} 400`).toBeDefined();
    }
  });

  it("documents 404 where a path id looks up a resource", () => {
    for (const name of [
      "GET /api/v1/jobs/{jobId}",
      "PUT /api/v1/jobs/{jobId}/tracker",
      "DELETE /api/v1/jobs/{jobId}/tracker",
      "POST /api/v1/jobs/{jobId}/evaluations",
      "GET /api/v1/evaluations/{evaluationId}"
    ]) {
      expect(find(name).responses[404], name).toBeDefined();
    }
  });

  it("scopes devices to the user: another user's installation id changes nothing of theirs", () => {
    for (const name of ["PUT /api/v1/me/devices/{installationId}", "DELETE /api/v1/me/devices/{installationId}"]) {
      expect(find(name).responses[404], name).toBeUndefined();
      expect(find(name).responses[204], name).toBeDefined();
    }
    const { summary } = find("PUT /api/v1/me/devices/{installationId}");
    expect(summary).not.toMatch(/takes over/i);
    expect(summary).toMatch(/same FCM token/i);
    expect(DEVICE_MAX_PER_USER).toBe(10);
    expect(summary).toContain("10");
  });

  it("keeps wrong-kind tokens away from 401, which would make the app sign out", () => {
    expect(find("POST /api/v1/auth/guest").responses[409]?.examples).toEqual(["errors/conflict"]);
    expect(find("POST /api/v1/auth/sso").responses[403]?.examples).toEqual(["errors/sign-in-required"]);
  });

  it("answers a logout with no body and no 404, like DELETE on a device", () => {
    const logout = find("POST /api/v1/auth/logout");
    expect(logout.responses[204]?.schema).toBeNull();
    expect(logout.responses[404]).toBeUndefined();
  });

  it("gives one answer for an import that is expired, used or another user's", () => {
    const putCv = find("PUT /api/v1/me/cv");
    expect(putCv.responses[409]?.description).toMatch(/not this user's/i);
    expect(putCv.responses[404]).toBeUndefined();
    expect(putCv.summary).toMatch(/random/i);
  });

  it("documents a limit on pending imports that anonymous accounts cannot avoid", () => {
    const importCv = find("POST /api/v1/me/cv/import");
    expect(importCv.responses[429]?.description).toMatch(/address/i);
    expect(importCv.summary).toMatch(/per address/i);
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
  it("reject unknown fields everywhere, so a response cannot carry extra data unnoticed", () => {
    const objects: { readonly type?: unknown; readonly additionalProperties?: unknown }[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (node !== null && typeof node === "object") {
        if ((node as { type?: unknown }).type === "object") objects.push(node);
        Object.values(node).forEach(walk);
      }
    };
    walk(buildOpenApiDocument(examplesDir).components.schemas);
    expect(objects.length).toBeGreaterThan(20);
    for (const object of objects) expect(object.additionalProperties, JSON.stringify(object).slice(0, 80)).toBe(false);
  });

  it("reject unknown fields in a sample of schemas", () => {
    expect(() => MeDtoSchema.parse({ userId: "user_1", isAnonymous: true, createdAt: "2026-11-02T00:00:00.000Z", email: "a@example.com" })).toThrow(z.ZodError);
    expect(() => CvUpdateRequestSchema.parse({ markdown: "# CV", extra: 1 })).toThrow(z.ZodError);
  });

  it("take the account only from the token: a sign-in body cannot name one", () => {
    expect(() => SsoRequestSchema.parse({ userId: "user_2" })).toThrow(z.ZodError);
    expect(SsoRequestSchema.parse({})).toEqual({});
  });

  it("let a guest token that is malformed reach the verifier, so it cannot fail the sign-in", () => {
    for (const guestToken of ["", "not a token", "a\nb"]) expect(SsoRequestSchema.parse({ guestToken })).toEqual({ guestToken });
    expect(SsoRequestSchema.safeParse({ guestToken: "x".repeat(4097) }).success).toBe(false);
    expect(SsoRequestSchema.safeParse({ guestToken: 1 }).success).toBe(false);
  });

  it("say whether a merge happened", () => {
    const account = loadExample(examplesDir, "me.valid");
    expect(SsoResponseDtoSchema.safeParse({ account }).success).toBe(false);
    expect(SsoResponseDtoSchema.parse(loadExample(examplesDir, "auth-sso.merged")).guestMerged).toBe(true);
    expect(SsoResponseDtoSchema.parse(loadExample(examplesDir, "auth-sso.not-merged")).guestMerged).toBe(false);
  });

  it("hold an installation id to the opaque id pattern", () => {
    expect(LogoutRequestSchema.parse({ installationId: "fid_1-a.b" }).installationId).toBe("fid_1-a.b");
    for (const installationId of ["", "../x", "a b", "x".repeat(201)]) expect(LogoutRequestSchema.safeParse({ installationId }).success).toBe(false);
    expect(LogoutRequestSchema.safeParse({}).success).toBe(false);
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
  });

  it("pin the limits that protect the server", () => {
    const job = loadExample(examplesDir, "job.valid") as Record<string, unknown>;
    const evaluation = loadExample(examplesDir, "evaluation.done") as { result: Record<string, unknown> };
    const rejected: readonly (readonly [string, z.ZodType, unknown])[] = [
      ["a description over the cap", JobDtoSchema, { ...job, descriptionText: "x".repeat(100_001) }],
      ["a job URL over the cap", JobDtoSchema, { ...job, url: `https://jobs.example.com/${"x".repeat(2048)}` }],
      ["too many accepted countries", JobDtoSchema, { ...job, acceptedCountries: Array.from({ length: 251 }, () => "VN") }],
      ["too many accepted time zones", JobDtoSchema, { ...job, acceptedTimezones: Array.from({ length: 51 }, () => "UTC") }],
      ["an absurd salary", JobDtoSchema, { ...job, salary: { min: 1e308, max: null, currency: null, period: null } }],
      ["an absurd minimum salary", PreferencesDtoSchema, { ...(loadExample(examplesDir, "preferences.valid") as object), minimumSalary: { amount: 1e308, currency: "USD", period: "year" } }],
      ["an impossible date", JobDtoSchema, { ...job, firstSeenAt: "2026-02-30T00:00:00.000Z" }],
      ["an id over the cap", MeDtoSchema, { userId: "x".repeat(201), isAnonymous: true, createdAt: "2026-11-02T00:00:00.000Z" }],
      ["CV text over the cap", CvUpdateRequestSchema, { markdown: "x".repeat(200_001) }],
      ["a purchase token over the cap", PurchaseRequestSchema, { productId: "plan", purchaseToken: "x".repeat(4097) }],
      ["a purchase token with spaces", PurchaseRequestSchema, { productId: "plan", purchaseToken: "a b" }],
      ["an FCM token over the cap", DeviceUpdateRequestSchema, { fcmToken: "x".repeat(4097) }],
      ["an FCM token with a newline", DeviceUpdateRequestSchema, { fcmToken: "a\nb" }],
      ["a score over 100", EvaluationDtoSchema, { ...evaluation, result: { ...evaluation.result, score: 101 } }],
      ["a negative retry time", ErrorDtoSchema, { code: "RATE_LIMITED", message: "Slow down.", details: { retryAfterSeconds: -1 } }]
    ];
    for (const [name, schema, value] of rejected) {
      expect(schema.safeParse(value).success, name).toBe(false);
    }
  });

  it("reject NUL in text, which PostgreSQL cannot store", () => {
    const preferences = loadExample(examplesDir, "preferences.valid") as Record<string, unknown>;
    expect(PreferencesDtoSchema.safeParse({ ...preferences, roles: ["a\u0000b"] }).success).toBe(false);
    expect(PreferencesDtoSchema.safeParse({ ...preferences, aim: "a\u0000b" }).success).toBe(false);
    expect(DeviceUpdateRequestSchema.safeParse({ fcmToken: "a\u0000b" }).success).toBe(false);
    expect(CvUpdateRequestSchema.safeParse({ markdown: "a\u0000b" }).success).toBe(false);
    expect(PreferencesDtoSchema.safeParse({ ...preferences, aim: "two\nlines" }).success).toBe(true);

    const job = loadExample(examplesDir, "job.valid") as Record<string, unknown>;
    expect(JobDtoSchema.safeParse({ ...job, descriptionText: "a\u0000b" }).success).toBe(false);
    const done = loadExample(examplesDir, "evaluation.done") as { result: Record<string, unknown> };
    expect(EvaluationDtoSchema.safeParse({ ...done, result: { ...done.result, summary: "a\u0000b" } }).success).toBe(false);
    expect(EvaluationDtoSchema.safeParse({ ...done, result: { ...done.result, reportMarkdown: "a\u0000b" } }).success).toBe(false);
    const failed = loadExample(examplesDir, "evaluation.failed") as Record<string, unknown>;
    expect(EvaluationDtoSchema.safeParse({ ...failed, failureMessage: "a\u0000b" }).success).toBe(false);
  });

  it("accept only web URLs for a job", () => {
    const job = loadExample(examplesDir, "job.valid") as Record<string, unknown>;
    expect(() => JobDtoSchema.parse(job)).not.toThrow();
    expect(() => JobDtoSchema.parse({ ...job, url: "file:///etc/passwd" })).toThrow(z.ZodError);
    expect(() => JobDtoSchema.parse({ ...job, url: "javascript:alert(1)" })).toThrow(z.ZodError);
  });

  it.each([
    "https://jobs.example.com@evil.example/login",
    "http://user:s3cret@careers.example.com/",
    "https://a\\@b.example/",
    "gopher://x.example/",
    "ftp://x.example/",
    "https:///jobs.example.com@evil.example/login",
    "https://\\/jobs.example.com@evil.example/login",
    "https://\t/jobs.example.com@evil.example/login",
    "http:////user:s3cret@careers.example.com/",
    "https://evil.example\\.jobs.example.com/",
    "https://a.example/\u0000",
    "https://a.example/\u0001\u001b[31mFAKE",
    "https://a.example/\u007f"
  ])("reject %s, which is not a plain web URL", (careersUrl) => {
    expect(() => CompanyCreateRequestSchema.parse({ careersUrl })).toThrow(z.ZodError);
  });

  it.each(["https://careers.example.com", "HTTP://careers.example.com/jobs?a=1#b", "https://careers.example.com/@team", "https://careers.example.com:8443/x?who=a@b.example"])(
    "accept %s",
    (careersUrl) => {
      expect(CompanyCreateRequestSchema.parse({ careersUrl }).careersUrl).toBeDefined();
    }
  );

  it.each([
    ["no stack traces", { stack: "Error at /srv/app/x.js:1" }],
    ["no connection strings", { connection: "postgres://u:p@db/x" }]
  ])("limit error details to known fields: %s", (_name, details) => {
    expect(() => ErrorDtoSchema.parse({ code: "UNEXPECTED_ERROR", message: "Something went wrong.", details })).toThrow(z.ZodError);
  });

  it("accept the error details clients use", () => {
    expect(() => ErrorDtoSchema.parse({ code: "VALIDATION_ERROR", message: "Bad.", details: { fields: ["roles"] } })).not.toThrow();
    expect(() => ErrorDtoSchema.parse({ code: "RATE_LIMITED", message: "Slow down.", details: { retryAfterSeconds: 30 } })).not.toThrow();
  });

  it.each(["../u2/original.pdf", "a/b", "a\nINFO forged log line", "%2e%2e%2f", ".hidden", ""])("reject the id %j", (importId) => {
    expect(() => CvUpdateRequestSchema.parse({ importId, markdown: "# CV" })).toThrow(z.ZodError);
  });

  it("hold what postings state about pay: decimals, a missing currency or period, day and week rates", () => {
    const job = loadExample(examplesDir, "job.valid") as Record<string, unknown>;
    for (const salary of [
      { min: 22.5, max: 28.75, currency: "USD", period: "hour" },
      { min: 120000, max: 150000, currency: null, period: null },
      { min: 800, max: null, currency: "EUR", period: "day" },
      { min: null, max: 2000, currency: "GBP", period: "week" }
    ]) {
      expect(() => JobDtoSchema.parse({ ...job, salary })).not.toThrow();
    }
  });

  it("accept an hourly minimum with decimals", () => {
    const preferences = loadExample(examplesDir, "preferences.valid") as Record<string, unknown>;
    expect(() => PreferencesDtoSchema.parse({ ...preferences, minimumSalary: { amount: 18.5, currency: "USD", period: "hour" } })).not.toThrow();
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

  it("publishes the web URL rule, so clients built from it see it too", () => {
    const { pattern } = document.components.schemas.CompanyCreateRequest.properties.careersUrl;
    const rule = new RegExp(pattern);
    expect(rule.test("https://careers.example.com/jobs")).toBe(true);
    expect(rule.test("gopher://x.example/")).toBe(false);
    expect(rule.test("https://jobs.example.com@evil.example/")).toBe(false);
  });

  it("publishes the id rule on path parameters", () => {
    const [parameter] = document.paths["/api/v1/jobs/{jobId}"].get.parameters;
    expect(new RegExp(parameter.schema.pattern).test("job_01")).toBe(true);
    expect(new RegExp(parameter.schema.pattern).test("../x")).toBe(false);
  });

  it("publishes the rules that protect the server", () => {
    const parameter = (route: string, method: string, name: string) =>
      document.paths[route][method].parameters.find((candidate: { name: string }) => candidate.name === name);
    expect(parameter("/api/v1/jobs/{jobId}/evaluations", "post", "X-Integrity-Token").required).toBe(true);
    expect(parameter("/api/v1/me/cv/import", "post", "X-Integrity-Token").required).toBe(false);
    expect(document.paths["/api/v1/me/cv/import"].post.requestBody.content["multipart/form-data"].schema.required).toEqual(["file"]);
    expect(parameter("/api/v1/feed", "get", "limit").schema.maximum).toBe(100);
    expect(new RegExp(parameter("/api/v1/feed", "get", "cursor").schema.pattern).test("../x")).toBe(false);
  });

  it("says what restructure does before phase 3", () => {
    const { restructure } = document.paths["/api/v1/me/cv/import"].post.requestBody.content["multipart/form-data"].schema.properties;
    expect(restructure.description).toContain("phase 3");
    expect(restructure.description).toContain("ENTITLEMENT_REQUIRED");
  });

  it("resolves every schema reference", () => {
    const refs = [...JSON.stringify(document).matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)].map((match) => match[1] as string);
    expect(refs.length).toBeGreaterThan(0);
    for (const name of refs) expect(document.components.schemas[name], name).toBeDefined();
  });
});
