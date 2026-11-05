import { describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import { LOG_TEXT_MAX_CHARS, createWorkerLogger, describeFailure, describeJobFailure, redactLogText, serializeError } from "../src/logging.js";
import { asUser, createTestServer } from "./support/server.js";

describe("request logs", () => {
  it("a request's Authorization header, query and body are not logged", async () => {
    const { server, logs } = await createTestServer({
      registerTestRoutes: (scope) => scope.post("/test/echo", async () => ({ ok: true }))
    });
    await server.inject({
      method: "POST",
      url: "/api/v1/test/echo?token=s3cret-query",
      headers: { authorization: "Bearer test-s3cret-token", "content-type": "application/json" },
      payload: JSON.stringify({ cv: "s3cret-cv-text" })
    });
    expect(logs()).not.toContain("s3cret");
    await server.close();
  });

  it("a log line has request id, route, status and duration, and nothing about the caller", async () => {
    const { server, logLines } = await createTestServer();
    await server.inject({ url: "/api/v1/health?x=1" });
    const line = logLines().find((candidate) => candidate.route === "/api/v1/health");
    expect(line).toMatchObject({ method: "GET", status: 200, route: "/api/v1/health" });
    expect(line?.reqId).toEqual(expect.any(String));
    expect(line?.durationMs).toEqual(expect.any(Number));
    expect(line).not.toHaveProperty("url");
    expect(line).not.toHaveProperty("hostname");
    expect(line).not.toHaveProperty("remoteAddress");
    await server.close();
  });

  it("logging a request object by accident keeps to the allowlist", async () => {
    const { server, logs } = await createTestServer({
      registerTestRoutes: (scope) =>
        scope.get("/test/careless", async (request, reply) => {
          request.log.info({ req: request, res: reply }, "careless");
          return { ok: true };
        })
    });
    await server.inject({ url: "/api/v1/test/careless?token=s3cret-query", headers: { authorization: "Bearer test-s3cret-token" } });
    expect(logs()).toContain("careless");
    expect(logs()).not.toContain("s3cret");
    expect(logs()).not.toContain("remoteAddress");
    await server.close();
  });

  it("an unmatched path logs no path, which could hold anything", async () => {
    const { server, logs, logLines } = await createTestServer();
    await server.inject({ url: "/s3cret-path" });
    expect(logs()).not.toContain("s3cret");
    expect(logLines().some((line) => line.route === "unmatched" && line.status === 404)).toBe(true);
    await server.close();
  });

  it("an unexpected error is logged with its name and scrubbed message, and client errors are not logged as errors", async () => {
    const { server, logLines } = await createTestServer({
      registerTestRoutes: (scope) => {
        scope.get("/test/boom", async () => {
          const error = new TypeError("failed on postgres://app:s3cret@db/x") as Error & { detail?: string; code?: string };
          error.detail = "s3cret-detail from a driver";
          error.code = "E_TEST";
          throw error;
        });
        scope.post("/test/echo", async (request) => request.body);
      }
    });
    await server.inject({ url: "/api/v1/test/boom", headers: asUser() });
    await server.inject({ method: "POST", url: "/api/v1/test/echo", headers: { ...asUser(), "content-type": "application/json" }, payload: "{bad" });

    const errors = logLines().filter((line) => typeof line.err === "object");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.err).toMatchObject({ type: "TypeError", code: "E_TEST" });
    expect(JSON.stringify(errors[0])).toContain("failed on postgres://app:[REDACTED]@db/x");
    expect(JSON.stringify(logLines())).not.toContain("s3cret");
    await server.close();
  });
});

describe("redactLogText", () => {
  it.each([
    ["postgres://app:s3cret@db:5432/x failed", "postgres://app:[REDACTED]@db:5432/x failed"],
    ["postgresql://app:p@ss@db/x", "postgresql://app:[REDACTED]@db/x"],
    ["redis://:s3cret@cache:6379/0", "redis://:[REDACTED]@cache:6379/0"],
    ["postgres://app:ab+c/d==@db/x", "postgres://app:[REDACTED]@db/x"],
    ["https://user:s3cret@example.com/a", "https://user:[REDACTED]@example.com/a"],
    ["Authorization: Bearer abc.def.ghi", "Authorization: [REDACTED]"],
    ["authorization: Basic dXNlcjpwYXNz", "authorization: [REDACTED]"],
    ["Authorization: ApiKey s3cret value", "Authorization: [REDACTED]"],
    ['Authorization: Digest username="u", response="abc"', "Authorization: [REDACTED]"],
    ['{"authorization":"Bearer abc def"}', '{"authorization": [REDACTED]'],
    ['{"authorization":"Digest username=\\"u\\", response=\\"abc\\""}', '{"authorization": [REDACTED]'],
    ['["authorization","Bearer abc"]', '["authorization", [REDACTED]'],
    ["authorization: [ 'Bearer abc' ]", "authorization: [REDACTED]"],
    ["authorization: [abc]", "authorization: [REDACTED]"],
    ["authorization:\n  Basic dXNlcjpwYXNz", "authorization: [REDACTED]"],
    ["HTTP_AUTHORIZATION: Basic dXNlcjpwYXNz", "HTTP_AUTHORIZATION: [REDACTED]"],
    ["Authorization: Bearer abc\nnext line stays", "Authorization: [REDACTED]\nnext line stays"]
  ])("redacts %s", (input, expected) => {
    expect(redactLogText(input)).toBe(expected);
  });

  it.each(["connect ECONNREFUSED 127.0.0.1:5432", "https://example.com:8443/jobs", "authorization failed", "authorization, retrying", "the bearer of this role"])(
    "leaves %s alone",
    (text) => {
      expect(redactLogText(text)).toBe(text);
    }
  );

  it("does not log part of a secret that crosses the length cap", () => {
    const secret = "postgres://app:s3cretpassword@db/x";
    for (let offset = 0; offset <= secret.length; offset += 1) {
      const output = redactLogText(`${" ".repeat(LOG_TEXT_MAX_CHARS - offset)}${secret} tail`);
      expect(output, `offset ${offset}`).not.toContain("s3cret");
    }
  });

  it("does not log part of a secret when no space comes before the cap", () => {
    const secret = "postgres://app:s3cretpassword@db/x?opts=";
    for (const start of [LOG_TEXT_MAX_CHARS - 2_100, LOG_TEXT_MAX_CHARS - 2_048, LOG_TEXT_MAX_CHARS - 20]) {
      const output = redactLogText(`${"a".repeat(start - 1)} ${secret}${"z".repeat(LOG_TEXT_MAX_CHARS)}`);
      expect(output, `start ${start}`).not.toContain("s3cret");
    }
  });

  it("does not log part of a secret cut at the working slice when earlier redaction shrinks the text", () => {
    const lead = `Authorization: Bearer ${"t".repeat(5_000)}\n`;
    const secret = "postgres://app:s3cretpassword@db/x";
    for (let padding = 13_000; padding < 16_000; padding += 7) {
      const output = redactLogText(`${lead}${" ".repeat(padding)}${secret} tail ${"y".repeat(5_000)}`);
      expect(output, `padding ${padding}`).not.toContain("s3cret");
    }
  });

  it("does not throw away a long message with no spaces", () => {
    const output = redactLogText("x".repeat(LOG_TEXT_MAX_CHARS * 5));
    expect(output.length).toBeGreaterThan(LOG_TEXT_MAX_CHARS / 2);
    expect(output.length).toBeLessThanOrEqual(LOG_TEXT_MAX_CHARS + 20);
    expect(output.endsWith("[truncated]")).toBe(true);
  });

  it.each([
    ["repeated URLs", "postgres://a:".repeat(50_000)],
    ["repeated headers", "Authorization: ".repeat(50_000)],
    ["a header and spaces", `authorization:${" ".repeat(16_370)}`],
    ["a quoted header and spaces", `authorization:${" ".repeat(16_369)}"`],
    ["a long token and a space past the cap", `${"a".repeat(16_382)} b${"c".repeat(100)}`],
    ["repeated schemes", "x://a:".repeat(5_000)]
  ])("stays fast on %s", (_name, text) => {
    const started = performance.now();
    redactLogText(text);
    expect(performance.now() - started).toBeLessThan(100);
  });
});

describe("serializeError", () => {
  it("survives an error with an odd message and stack", () => {
    const error = Object.assign(new Error("x"), { message: { reason: "odd" }, stack: 42 });
    expect(serializeError(error)).toMatchObject({ type: "Error", stack: "" });
  });

  it("drops a driver's other fields", () => {
    const error = Object.assign(new Error("failed"), { code: "23505", detail: "s3cret row", table: "users" });
    expect(JSON.stringify(serializeError(error))).not.toContain("s3cret");
    expect(serializeError(error).code).toBe("23505");
  });
});

describe("describeFailure", () => {
  it("scrubs the message", () => {
    expect(describeFailure(new Error("failed for postgres://a:s3cret@db/x"))).toBe("failed for postgres://a:[REDACTED]@db/x");
  });

  it("falls back to the code when several addresses failed and the message is empty", () => {
    expect(describeFailure(Object.assign(new AggregateError([]), { code: "ECONNREFUSED" }))).toBe("ECONNREFUSED");
  });

  it("always says something", () => {
    expect(describeFailure(null)).toBe("unknown error");
  });
});

describe("describeJobFailure", () => {
  function failure() {
    return Object.assign(new TypeError("line one s3cret\nline two s3cret"), { code: "E_PARSE", detail: "s3cret" });
  }

  it("keeps the type, code and stack frames, and no text from the error", () => {
    const description = describeJobFailure(failure());
    expect(description).toMatchObject({ type: "TypeError", code: "E_PARSE" });
    expect(description.frames).toContain("logging.test.ts");
    expect(JSON.stringify(description)).not.toContain("s3cret");
  });

  it("says something for a thrown value that is not an error", () => {
    expect(describeJobFailure("s3cret")).toEqual({ type: "NonError", frames: "" });
  });

  it("drops error text that looks like a stack frame", () => {
    const text = "\n  at Acme Corp since 2019, s3cret-name, phone 0912345678\n    at Hanoi (s3cret:1:1)";
    const { frames } = describeJobFailure(new SyntaxError(`Unexpected token in:${text}`));
    expect(frames).not.toContain("s3cret");
    expect(frames).not.toContain("Acme");
    expect(frames).toContain("logging.test.ts");
  });

  it("drops such text when the stack's header differs from the error's name, as Node's coded errors do", () => {
    const error = new Error("bad token:\n  at Hanoi (s3cret:1:1)\n  at 0912345678:1:1");
    error.stack = `AssertionError [ERR_ASSERTION]: ${error.message}\n    at real (file.ts:1:1)`;
    expect(describeJobFailure(error).frames).toBe("    at real (file.ts:1:1)");
  });

  it("stays fast on a hostile line, which cannot freeze the worker", () => {
    const error = new Error("x");
    error.stack = `   at ${"(:1".repeat(100_000)}`;
    const started = performance.now();
    describeJobFailure(error);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it("logs a non-string code as nothing, because it could hold input", () => {
    expect(describeJobFailure(Object.assign(new Error("x"), { code: { text: "s3cret" } }))).not.toHaveProperty("code");
  });

  it("drops a stack line that is not a frame", () => {
    const error = new Error("x");
    error.stack = "s3cret first line\n    at real (file.ts:1:1)\ns3cret in the middle";
    expect(describeJobFailure(error).frames).toBe("    at real (file.ts:1:1)");
  });
});

describe("createWorkerLogger", () => {
  it("logs an error's type and scrubbed message, with no base fields", () => {
    const chunks: string[] = [];
    const logger = createWorkerLogger(
      new Writable({
        write(chunk, _encoding, done) {
          chunks.push(String(chunk));
          done();
        }
      })
    );
    logger.error({ err: new TypeError("failed on postgres://a:s3cret@db/x") }, "queue error");
    const line = JSON.parse(chunks.join(""));
    expect(line.err).toMatchObject({ type: "TypeError", message: "failed on postgres://a:[REDACTED]@db/x" });
    expect(line).not.toHaveProperty("hostname");
    expect(line).not.toHaveProperty("pid");
  });
});
