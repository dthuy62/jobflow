import { access, appendFile, readFile, readdir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { RuntimeConfig } from "../src/config/runtime-config.js";
import { EvaluationDtoSchema, ErrorResponseDtoSchema, OfferDtoSchema, type EvaluationDto } from "../src/contracts/index.js";
import type { PostingResult } from "../src/evaluation/posting-fetcher.js";
import { createServer } from "../src/server.js";
import { createFakeClaude, type FakeClaude, type FakeClaudeBehaviour } from "./support/fake-claude.js";
import { copyProjectionFixture, removeWorkspaces } from "./support/fixture-workspace.js";

const OFFER_ID = "offer_5d9b8e7eb781eeca";
const OFFER_URL = "https://jobs.example.com/vandelay/ios-engineer";
const EVALUATED_OFFER_ID = "offer_a1461f4e3225f9ea";
const TOKEN = "pairing-token-for-tests";
const POSTING = "Vandelay Industries is hiring an iOS engineer. ".repeat(20);

const VALID_OUTPUT = {
  score: 3.84,
  legitimacy: "High Confidence",
  note: "Solid mobile match.",
  reportMarkdown: `## A) Role Summary\n\nGood role.\n\n## Keywords extracted\n\n${"swift ".repeat(60)}`
};

const workspaces: string[] = [];
const servers: FastifyInstance[] = [];
const fakes: FakeClaude[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await removeWorkspaces(workspaces);
  await Promise.all(fakes.splice(0).map((fake) => fake.remove()));
});

interface Setup {
  readonly server: FastifyInstance;
  readonly workspace: string;
  readonly fake: FakeClaude;
  readonly postingUrls: string[];
}

async function setup(
  options: {
    behaviour?: FakeClaudeBehaviour;
    host?: string;
    timeoutMs?: number;
    posting?: (url: string, signal?: AbortSignal) => Promise<PostingResult>;
    provider?: boolean;
  } = {}
): Promise<Setup> {
  const workspace = await copyProjectionFixture();
  workspaces.push(workspace);
  const fake = await createFakeClaude({
    auth: { loggedIn: true },
    run: { stdout: { type: "result", is_error: false, result: "", structured_output: VALID_OUTPUT } },
    ...options.behaviour
  });
  fakes.push(fake);
  const config: RuntimeConfig = {
    host: options.host ?? "127.0.0.1",
    port: 3000,
    workspace,
    pairingToken: TOKEN,
    ...(options.provider === false
      ? {}
      : { evaluation: { provider: "claude", timeoutMs: options.timeoutMs ?? 60_000, cliPath: fake.cliPath } })
  };
  const postingUrls: string[] = [];
  const server = await createServer({
    config,
    evaluationFetchPosting: async (url, fetchOptions) => {
      postingUrls.push(url);
      return options.posting ? options.posting(url, fetchOptions.signal) : { ok: true, text: POSTING, truncated: false };
    }
  });
  servers.push(server);
  return { server, workspace, fake, postingUrls };
}

const headers = { "x-career-ops-token": TOKEN };

async function start(server: FastifyInstance, offerId = OFFER_ID) {
  return server.inject({ method: "POST", url: "/api/v1/evaluations", headers, payload: { offerId } });
}

async function pollUntilDone(server: FastifyInstance, id: string): Promise<EvaluationDto> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const response = await server.inject({ method: "GET", url: `/api/v1/evaluations/${id}`, headers });
    expect(response.statusCode).toBe(200);
    const run = EvaluationDtoSchema.parse(response.json());
    if (!run.active) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("evaluation did not finish");
}

async function reportFiles(workspace: string): Promise<string[]> {
  return (await readdir(path.join(workspace, "reports"))).sort();
}

describe("evaluation routes", () => {
  it("evaluates an offer end to end and shows it through the offers projection", async () => {
    const { server, workspace, fake, postingUrls } = await setup();

    const response = await start(server);
    expect(response.statusCode).toBe(202);
    const started = EvaluationDtoSchema.parse(response.json());
    expect(started).toMatchObject({ offerId: OFFER_ID, status: "running", stage: "fetching-posting", active: true });
    expect(started.id).toMatch(/^eval_\d{14}_[a-f0-9]{6}$/);

    const finished = await pollUntilDone(server, started.id);
    expect(finished).toMatchObject({ status: "succeeded", stage: "completed", failure: null, warnings: [] });
    expect(finished.result).toEqual({ reportId: expect.any(String), score: 76, artifactIds: [] });
    expect(postingUrls).toEqual([OFFER_URL]);

    const offer = OfferDtoSchema.parse(
      (await server.inject({ method: "GET", url: `/api/v1/offers/${OFFER_ID}`, headers })).json()
    );
    expect(offer).toMatchObject({ evaluationStatus: "evaluated", score: 76, status: "tracked" });
    expect(offer.reportId).toBe(finished.result?.reportId);
    expect((await reportFiles(workspace)).filter((name) => name.includes("RESERVED"))).toEqual([]);

    const latest = await server.inject({ method: "GET", url: "/api/v1/evaluations/latest", headers });
    expect(latest.json()).toEqual(finished);

    const [call] = await fake.calls();
    expect(call?.stdin).toContain(POSTING.trim());
    expect(call?.stdin).toContain("Synthetic CV");
  });

  it("runs the CLI with the fixed argv, an empty temporary cwd and only allowlisted env", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-should-not-leak";
    process.env.CAREER_OPS_PAIRING_TOKEN = TOKEN;
    try {
      const { server, workspace, fake } = await setup();
      await pollUntilDone(server, EvaluationDtoSchema.parse((await start(server)).json()).id);

      const [call] = await fake.calls();
      const { CLAUDE_EVALUATION_ARGV } = await import("../src/evaluation/claude-command.js");
      expect(call?.argv).toEqual([...CLAUDE_EVALUATION_ARGV]);
      for (const arg of call?.argv ?? []) {
        expect(arg).not.toContain(OFFER_ID);
        expect(arg).not.toContain(OFFER_URL);
        expect(arg).not.toContain(workspace);
        expect(arg).not.toContain("Vandelay");
      }
      expect(call?.envKeys.every((key) => ["HOME", "USER", "LOGNAME", "PATH", "SHELL", "TMPDIR", "LANG", "LC_ALL", "LC_CTYPE", "TERM", "NO_COLOR", "__CF_USER_TEXT_ENCODING"].includes(key))).toBe(true);
      expect(JSON.stringify(call?.env)).not.toContain("sk-ant-should-not-leak");
      expect(JSON.stringify(call?.env)).not.toContain(TOKEN);
      expect(path.basename(call?.cwd ?? "")).toMatch(/^jobflow-eval-/);
      expect(call?.cwd.startsWith(await realpath(workspace))).toBe(false);
      await expect(access(call?.cwd ?? "")).rejects.toThrow();
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.CAREER_OPS_PAIRING_TOKEN;
    }
  });

  it("requires the pairing token on a LAN host for every evaluation route", async () => {
    const { server } = await setup({ host: "0.0.0.0" });
    const routes = [
      { method: "POST" as const, url: "/api/v1/evaluations", payload: { offerId: OFFER_ID } },
      { method: "GET" as const, url: "/api/v1/evaluations/latest" },
      { method: "GET" as const, url: "/api/v1/evaluations/eval_20261031093000_a1b2c3" },
      { method: "POST" as const, url: "/api/v1/evaluations/eval_20261031093000_a1b2c3/cancel" }
    ];

    for (const route of routes) {
      for (const tokenHeaders of [{}, { "x-career-ops-token": "wrong" }]) {
        const response = await server.inject({ ...route, headers: tokenHeaders });
        expect(response.statusCode, `${route.method} ${route.url}`).toBe(401);
      }
    }
  });

  it("works without a token on localhost", async () => {
    const { server } = await setup();

    const response = await server.inject({ method: "POST", url: "/api/v1/evaluations", payload: { offerId: OFFER_ID } });

    expect(response.statusCode).toBe(202);
    await pollUntilDone(server, response.json().id);
  });

  it.each([
    { offerId: OFFER_ID, provider: "gemini" },
    { offerId: OFFER_ID, model: "opus" },
    { offerId: OFFER_ID, prompt: "x" },
    { offerId: OFFER_ID, url: "http://10.0.0.1" },
    { offerId: OFFER_ID, args: ["--dangerously-skip-permissions"] },
    { offerId: "../../etc/passwd" },
    { offerId: "--tools" },
    { offerId: "offer_5d9b8e7eb781eecaXX" },
    {}
  ])("rejects the request body %j without starting anything", async (payload) => {
    const { server, fake, postingUrls } = await setup();

    const response = await server.inject({ method: "POST", url: "/api/v1/evaluations", headers, payload });

    expect(response.statusCode).toBe(400);
    expect(ErrorResponseDtoSchema.parse(response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(await fake.calls()).toEqual([]);
    expect(postingUrls).toEqual([]);
  });

  it("answers 404 for unknown and malformed evaluation ids", async () => {
    const { server } = await setup();

    for (const url of [
      "/api/v1/evaluations/latest",
      "/api/v1/evaluations/eval_20261031093000_a1b2c3",
      "/api/v1/evaluations/scan_20261031093000_a1b2c3",
      "/api/v1/evaluations/..%2F..%2Fetc"
    ]) {
      expect((await server.inject({ method: "GET", url, headers })).statusCode, url).toBe(404);
    }
    expect(
      (await server.inject({ method: "POST", url: "/api/v1/evaluations/nope/cancel", headers })).statusCode
    ).toBe(404);
  });

  it("refuses a second evaluation while one runs, also when both arrive at once", async () => {
    const { server } = await setup({ behaviour: { run: { hang: true } } });

    const [first, second] = await Promise.all([start(server), start(server)]);
    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toEqual([202, 409]);
    const running = [first, second].find((response) => response.statusCode === 202)?.json() as EvaluationDto;
    const busy = [first, second].find((response) => response.statusCode === 409);
    expect(busy?.json()).toEqual({
      error: {
        code: "EVALUATION_ALREADY_RUNNING",
        message: "An evaluation is already running.",
        details: { activeEvaluationId: running.id }
      }
    });

    await server.inject({ method: "POST", url: `/api/v1/evaluations/${running.id}/cancel`, headers });
    expect((await pollUntilDone(server, running.id)).status).toBe("cancelled");
    expect((await start(server)).statusCode).toBe(202);
  });

  it("refuses when evaluation is not ready", async () => {
    const disabled = await setup({ provider: false });
    const notConfigured = await start(disabled.server);
    expect(notConfigured.statusCode).toBe(503);
    expect(notConfigured.json().error).toMatchObject({
      code: "WORKSPACE_UNHEALTHY",
      details: { reason: "evaluation-not-ready", missingRequirements: ["evaluation.provider-not-configured"] }
    });

    const loggedOut = await setup({ behaviour: { auth: { loggedIn: false } } });
    const response = await start(loggedOut.server);
    expect(response.statusCode).toBe(503);
    expect(response.json().error.details.missingRequirements).toEqual(["evaluation.cli-logged-out"]);
    expect(await loggedOut.fake.calls()).toEqual([]);
  });

  it("re-checks the login on POST even when health cached it", async () => {
    const { server, fake } = await setup();
    await server.inject({ method: "GET", url: "/api/v1/health" });
    await fake.setBehaviour({ auth: { loggedIn: false } });

    expect((await start(server)).statusCode).toBe(503);
  });

  it("refuses unknown, already evaluated and URL-less offers", async () => {
    const { server, workspace } = await setup();
    await appendFile(
      path.join(workspace, "data/applications.md"),
      "| 4 | 2026-10-01 | NoUrl Co | Mobile Engineer | | Evaluated | ❌ | | |\n"
    );
    const offers = (await server.inject({ method: "GET", url: "/api/v1/offers", headers })).json().items as Array<{
      id: string;
      company: string;
    }>;
    const noUrl = offers.find((offer) => offer.company === "NoUrl Co");

    expect((await start(server, "offer_0000000000000000")).statusCode).toBe(404);
    const evaluated = await start(server, EVALUATED_OFFER_ID);
    expect(evaluated.statusCode).toBe(400);
    expect(evaluated.json().error.details).toEqual({ reason: "offer-already-evaluated" });
    const missingUrl = await start(server, noUrl?.id);
    expect(missingUrl.statusCode).toBe(400);
    expect(missingUrl.json().error.details).toEqual({ reason: "offer-has-no-url" });
  });

  it("leaves a tracker row the owner added by hand alone, even when it is not linked to the offer", async () => {
    const { server, workspace } = await setup();
    await appendFile(
      path.join(workspace, "data/applications.md"),
      "| 4 | 2026-06-27 | Vandelay Industries | iOS Engineer | | Applied | ❌ | | hand-added |\n"
    );
    const trackerBefore = await readFile(path.join(workspace, "data/applications.md"), "utf8");

    const finished = await pollUntilDone(server, (await start(server)).json().id);

    expect(finished.status).toBe("succeeded");
    expect(finished.warnings).toEqual(["The offer is already in the tracker; it was not changed."]);
    expect(await readFile(path.join(workspace, "data/applications.md"), "utf8")).toBe(trackerBefore);
  });

  it("kills a CLI that runs past the timeout and writes nothing", async () => {
    const { server, workspace } = await setup({ behaviour: { run: { hang: true } }, timeoutMs: 300 });
    const before = await reportFiles(workspace);
    const trackerBefore = await readFile(path.join(workspace, "data/applications.md"), "utf8");

    const finished = await pollUntilDone(server, (await start(server)).json().id);

    expect(finished).toMatchObject({
      status: "failed",
      failure: { code: "COMMAND_TIMEOUT", message: "AI evaluation exceeded the 0-second timeout." }
    });
    expect(await reportFiles(workspace)).toEqual(before);
    expect(await readFile(path.join(workspace, "data/applications.md"), "utf8")).toBe(trackerBefore);
  });

  it("cancels while the posting is fetched or the CLI runs, and cancelling twice is harmless", async () => {
    const slowPosting = await setup({
      posting: (_url, signal) =>
        new Promise((resolve) => signal?.addEventListener("abort", () => resolve({ ok: false, reason: "timeout" })))
    });
    const fetching = (await start(slowPosting.server)).json() as EvaluationDto;
    await slowPosting.server.inject({ method: "POST", url: `/api/v1/evaluations/${fetching.id}/cancel`, headers });
    await slowPosting.server.inject({ method: "POST", url: `/api/v1/evaluations/${fetching.id}/cancel`, headers });
    expect(await pollUntilDone(slowPosting.server, fetching.id)).toMatchObject({
      status: "cancelled",
      stage: "cancelled",
      failure: { code: "CANCELLED", message: "AI evaluation was cancelled." }
    });
    expect(await slowPosting.fake.calls()).toEqual([]);

    const { server, workspace } = await setup({ behaviour: { run: { hang: true } } });
    const before = await reportFiles(workspace);
    const running = (await start(server)).json() as EvaluationDto;
    await new Promise((resolve) => setTimeout(resolve, 300));
    const cancel = await server.inject({ method: "POST", url: `/api/v1/evaluations/${running.id}/cancel`, headers });
    expect(cancel.statusCode).toBe(200);
    const finished = await pollUntilDone(server, running.id);
    expect(finished.status).toBe("cancelled");
    expect(await reportFiles(workspace)).toEqual(before);

    const again = await server.inject({ method: "POST", url: `/api/v1/evaluations/${running.id}/cancel`, headers });
    expect(again.json()).toEqual(finished);
  });

  it("never returns CLI output, paths or the token", async () => {
    const workspaceMarker = "WORKSPACE_MARKER";
    const { server, workspace } = await setup({
      behaviour: {
        run: {
          exitCode: 1,
          stderr: `token ${TOKEN} home ${homedir()} ${workspaceMarker}`,
          stdout: { type: "result", is_error: true, result: `Error at ${homedir()}/x with ${TOKEN}` }
        }
      }
    });

    const finished = await pollUntilDone(server, (await start(server)).json().id);
    const serialized = JSON.stringify(finished);

    expect(finished.failure).toEqual({ code: "COMMAND_FAILED", message: "AI evaluation exited with code 1." });
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toContain(homedir());
    expect(serialized).not.toContain(workspace);
    expect(serialized).not.toContain(workspaceMarker);
  });

  it("maps a logged-out CLI, invalid output and oversized output", async () => {
    const loggedOut = await setup({
      behaviour: {
        run: {
          exitCode: 1,
          stdout: { type: "result", is_error: true, result: "Failed to authenticate: OAuth session expired and could not be refreshed" }
        }
      }
    });
    expect((await pollUntilDone(loggedOut.server, (await start(loggedOut.server)).json().id)).failure?.code).toBe(
      "CLI_NOT_LOGGED_IN"
    );

    const invalid = await setup({
      behaviour: { run: { stdout: { type: "result", is_error: false, structured_output: { ...VALID_OUTPUT, score: 9 } } } }
    });
    expect((await pollUntilDone(invalid.server, (await start(invalid.server)).json().id)).failure?.code).toBe(
      "OUTPUT_INVALID"
    );

    const huge = await setup({ behaviour: { run: { stdoutRepeat: { text: "x".repeat(1024), times: 2048 } } } });
    expect((await pollUntilDone(huge.server, (await start(huge.server)).json().id)).failure?.code).toBe("OUTPUT_INVALID");

    const large = await setup({
      behaviour: {
        run: {
          stdout: {
            type: "result",
            is_error: false,
            result: "",
            structured_output: { ...VALID_OUTPUT, reportMarkdown: `## A) Role Summary\n${"y".repeat(119_000)}` },
            padding: "z".repeat(700 * 1024)
          }
        }
      }
    });
    expect((await pollUntilDone(large.server, (await start(large.server)).json().id)).status).toBe("succeeded");
  });

  it("maps an unreadable posting without starting the CLI", async () => {
    const { server, fake } = await setup({ posting: async () => ({ ok: false, reason: "blocked-address" }) });

    const finished = await pollUntilDone(server, (await start(server)).json().id);

    expect(finished.failure).toEqual({
      code: "POSTING_UNAVAILABLE",
      message: "The job posting could not be read from its URL. The URL points to a private or local network address."
    });
    expect(await fake.calls()).toEqual([]);
  });

  it("kills the CLI and writes nothing when the server shuts down", async () => {
    const { server, workspace } = await setup({ behaviour: { run: { hang: true } } });
    const before = await reportFiles(workspace);
    await start(server);
    await new Promise((resolve) => setTimeout(resolve, 300));

    await server.close();
    servers.splice(servers.indexOf(server), 1);

    expect(await reportFiles(workspace)).toEqual(before);
  });
});
