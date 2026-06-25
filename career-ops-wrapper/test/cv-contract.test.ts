import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CvDtoSchema,
  ErrorResponseDtoSchema,
  SaveCvRequestDtoSchema
} from "../src/contracts/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readJsonFixture<T>(relativePath: string): Promise<T> {
  const raw = await readFile(resolve(packageRoot, relativePath), "utf8");
  return JSON.parse(raw) as T;
}

describe("CV contract", () => {
  it("validates a checked-in CV response example", async () => {
    const example = await readJsonFixture<unknown>("contracts/examples/cv.valid.json");

    const cv = CvDtoSchema.parse(example);

    expect(cv.sizeBytes).toBe(Buffer.byteLength(cv.markdown, "utf8"));
    expect(cv.sourceRevision).not.toContain("/");
  });

  it("accepts Markdown save requests up to 512 KiB", () => {
    expect(() => SaveCvRequestDtoSchema.parse({ markdown: "# CV" })).not.toThrow();
    expect(() =>
      SaveCvRequestDtoSchema.parse({ markdown: "a".repeat(512 * 1024) })
    ).not.toThrow();
  });

  it("rejects blank and oversized Markdown save requests", () => {
    expect(() => SaveCvRequestDtoSchema.parse({ markdown: "   \n\t" })).toThrow();
    expect(() =>
      SaveCvRequestDtoSchema.parse({ markdown: "a".repeat(512 * 1024 + 1) })
    ).toThrow();
  });

  it.each([
    "contracts/examples/errors/validation.json",
    "contracts/examples/errors/payload-too-large.json",
    "contracts/examples/errors/cv-missing.json"
  ])("validates CV error example %s", async (fixturePath) => {
    const example = await readJsonFixture<unknown>(fixturePath);

    expect(() => ErrorResponseDtoSchema.parse(example)).not.toThrow();
  });
});
