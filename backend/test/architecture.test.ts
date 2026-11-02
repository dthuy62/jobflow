import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL("../src/", import.meta.url));

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : full.endsWith(".ts") ? [full] : [];
  });
}

function importsOf(source: string): string[] {
  return [...source.matchAll(/(?:from\s+|import\s*\(\s*|^import\s+)["']([^"']+)["']/gm)].map((match) => match[1] as string);
}

/** Imports of `source` in `file` that resolve outside `allowedDir` and are not listed. */
function forbiddenImports(file: string, source: string, allowedDir: string, allowedPackages: readonly string[]): string[] {
  return importsOf(source).filter((specifier) => {
    if (specifier.startsWith(".")) {
      const resolved = path.resolve(path.dirname(file), specifier);
      return !(resolved + path.sep).startsWith(allowedDir);
    }
    return !specifier.startsWith("node:") && !allowedPackages.includes(specifier);
  });
}

describe("the import check", () => {
  const core = path.join(srcDir, "core") + path.sep;
  const file = path.join(core, "x.ts");

  it("flags a sample source that imports pg", () => {
    expect(forbiddenImports(file, 'import pg from "pg";', core, ["zod"])).toEqual(["pg"]);
  });

  it("flags a relative import out of core, a dynamic import and a bare import", () => {
    const source = 'import { a } from "../adapters/a.js";\nconst b = await import("firebase-admin");\nimport "jose";\n';
    expect(forbiddenImports(file, source, core, ["zod"])).toEqual(["../adapters/a.js", "firebase-admin", "jose"]);
  });

  it("allows zod, node modules and files inside core", () => {
    const source = 'import { z } from "zod";\nimport path from "node:path";\nimport { a } from "./a.js";\n';
    expect(forbiddenImports(file, source, core, ["zod"])).toEqual([]);
  });
});

describe("the architecture", () => {
  it("backend/src/core imports nothing but core/, zod and node: modules", () => {
    const core = path.join(srcDir, "core") + path.sep;
    const files = sourceFiles(core);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(forbiddenImports(file, readFileSync(file, "utf8"), core, ["zod"]), file).toEqual([]);
    }
  });

  it("backend/src/http imports no file from backend/src/adapters", () => {
    const adapters = path.join(srcDir, "adapters") + path.sep;
    const files = sourceFiles(path.join(srcDir, "http"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const reached = importsOf(readFileSync(file, "utf8"))
        .filter((specifier) => specifier.startsWith("."))
        .filter((specifier) => (path.resolve(path.dirname(file), specifier) + path.sep).startsWith(adapters));
      expect(reached, file).toEqual([]);
    }
  });
});
