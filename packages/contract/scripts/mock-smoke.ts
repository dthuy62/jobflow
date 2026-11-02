// Proves the mock serves the contract: every documented status and example of every
// operation. Start the mock first: docker compose --profile mock up -d mock
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { operations, type Operation } from "../src/index.js";
import { exampleKey, loadExample } from "../src/openapi.js";

const examplesDir = fileURLToPath(new URL("../../../contracts/examples", import.meta.url));
const baseUrl = process.env.MOCK_URL ?? "http://127.0.0.1:4010";
const READY_TIMEOUT_MS = 60_000;

function requestInit(operation: Operation, prefer?: string, authorized = true): RequestInit {
  const headers: Record<string, string> = {};
  if (authorized && !operation.public) headers.Authorization = "Bearer synthetic-token";
  if (prefer) headers.Prefer = prefer;
  for (const header of operation.headers ?? []) headers[header.name] = "synthetic-integrity-token";

  const { request } = operation;
  if (request?.kind === "json") {
    headers["Content-Type"] = "application/json";
    return { method: operation.method, headers, body: JSON.stringify(loadExample(examplesDir, request.example)) };
  }
  if (request?.kind === "cv-upload") {
    const form = new FormData();
    form.set("file", new Blob(["synthetic file"], { type: "application/pdf" }), "cv.pdf");
    return { method: operation.method, headers, body: form };
  }
  return { method: operation.method, headers };
}

const url = (operation: Operation) => `${baseUrl}${operation.path.replace(/\{\w+\}/g, "id_01")}`;

async function waitForMock(): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    try {
      await fetch(`${baseUrl}/api/v1/health`);
      return;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

await waitForMock();
const failures: string[] = [];
let checked = 0;

for (const operation of operations) {
  const name = `${operation.method} ${operation.path}`;

  if (!operation.public) {
    checked += 1;
    const response = await fetch(url(operation), requestInit(operation, undefined, false));
    if (response.status !== 401) failures.push(`${name} with no token: expected 401, got ${response.status}`);
  }

  for (const [status, spec] of Object.entries(operation.responses)) {
    const examples = spec.examples.length > 0 ? spec.examples : [null];
    for (const example of examples) {
      checked += 1;
      const prefer = example === null ? `code=${status}` : `code=${status}, example=${exampleKey(example)}`;
      const response = await fetch(url(operation), requestInit(operation, prefer));
      const text = await response.text();
      if (String(response.status) !== status) {
        failures.push(`${name} ${example ?? status}: expected ${status}, got ${response.status}: ${text.slice(0, 200)}`);
      } else if (example !== null && !isDeepStrictEqual(JSON.parse(text), loadExample(examplesDir, example))) {
        failures.push(`${name} ${example}: the body is not the example`);
      }
    }
  }
}

for (const failure of failures) console.error(failure);
console.log(`Checked ${checked} responses; ${failures.length} failed.`);
process.exitCode = failures.length === 0 ? 0 : 1;
