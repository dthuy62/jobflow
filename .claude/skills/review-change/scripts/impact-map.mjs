#!/usr/bin/env node
// Deterministic impact map for a JobFlow change: what changed, who references
// it, which risk areas it touches, and which gates and reviewers are mandatory.
// Usage: node impact-map.mjs --base <rev> [--head <rev>] [--json]
// Reads git only (git diff, git show, git grep); never writes. TypeScript and
// JavaScript symbols come from the TypeScript compiler that career-ops-wrapper
// installs (`npm ci` there); Kotlin symbols are still matched by line.

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const args = parseArgs(process.argv.slice(2));
if (!args?.base) {
  console.error("usage: node impact-map.mjs --base <rev> [--head <rev>] [--json]");
  process.exit(2);
}
const head = args.head ?? "HEAD";
process.chdir(git(["rev-parse", "--show-toplevel"]).trim());

/** Path rules: each match flags a risk area. */
const PATH_RISKS = [
  { area: "security", pattern: /^career-ops-wrapper\/src\/security\// },
  { area: "contracts", pattern: /^career-ops-wrapper\/(src\/contracts|contracts)\// },
  { area: "openapi", pattern: /^career-ops-wrapper\/src\/openapi\// },
  { area: "process-spawn", pattern: /^career-ops-wrapper\/src\/career-ops-engine\// },
  { area: "workspace-io", pattern: /^career-ops-wrapper\/src\/workspace\// },
  { area: "routes", pattern: /^career-ops-wrapper\/src\/api\// },
  { area: "untrusted-input", pattern: /^career-ops-wrapper\/src\/(parsers|services|workspace)\// },
  { area: "config", pattern: /^career-ops-wrapper\/src\/config\// },
  { area: "android-remote", pattern: /^android\/app\/src\/main\/kotlin\/.*\/data\/remote\// },
  { area: "ci", pattern: /^\.github\// }
];

/** Content rules on added or removed lines. */
const CONTENT_RISKS = [
  { area: "process-spawn", pattern: /child_process|\bspawn\(|\bexecFile\(|\bexec\(|\bfork\(/ },
  { area: "workspace-write", pattern: /\b(writeFile|appendFile|rename|unlink|rm|rmdir|mkdir|copyFile|createWriteStream|truncate)\s*\(/ },
  { area: "auth-token", pattern: /pairing|token|authorization|x-career-ops-token/i },
  { area: "env", pattern: /process\.env/ },
  { area: "redaction", pattern: /redact|sanitiz/i },
  { area: "schema-parse", pattern: /Schema\.(parse|safeParse)\(/ }
];

/** Risk area → reviewer that must run. */
const MANDATORY_REVIEWER = {
  security: "security",
  "process-spawn": "security",
  "workspace-io": "security",
  "workspace-write": "security",
  "auth-token": "security",
  routes: "security",
  env: "security",
  redaction: "security",
  config: "security"
};

/** Risk area → the question its reviewer must answer for this change. */
const RISK_CHECKS = {
  security: "Do path containment, redaction and token checks still hold for every caller?",
  contracts: "Is every field change mirrored in contract examples, OpenAPI and the Android DTO, and is it backward compatible?",
  openapi: "Does the OpenAPI document match the routes, status codes and security of the code?",
  "process-spawn": "Is argv allowlisted, no shell, env stripped, output bounded and redacted, timeout and kill enforced?",
  "workspace-io": "Can any read or write escape the workspace (symlink, .., swap between check and open) or read unbounded data?",
  "workspace-write": "Is the write atomic, backed up, contained in the workspace and limited to the files the feature owns?",
  routes: "Is each new route behind the pairing-token guard, validated by Zod, and free of path or stack leakage in errors?",
  "untrusted-input": "Can a malformed or hand-edited workspace value make an endpoint throw (500) instead of degrading with a warning? Trace parsed values to the response schema.",
  "schema-parse": "Can the value passed to Schema.parse fail at runtime on real data, and what does the client get then?",
  config: "Do new options have safe defaults, validation, and no secret leakage in logs?",
  env: "Does any environment variable or secret reach a child process, log, or response?",
  "auth-token": "Can the pairing token be bypassed, logged, compared in variable time, or leaked?",
  redaction: "Does every outbound string still pass redaction for workspace paths, home paths and tokens?",
  "android-remote": "Do DTOs, Retrofit paths and error mapping match the wrapper contract examples?",
  ci: "Does the workflow change weaken a required check or expose secrets?"
};

const ROUTE_PATTERN = /\.(get|post|put|patch|delete)\s*(?:<[^>]*>)?\(\s*["'`]([^"'`]+)["'`]/;
const RETROFIT_PATTERN = /@(GET|POST|PUT|PATCH|DELETE)\(\s*"([^"]+)"/;
const KT_DECL = /^(?:(?:public|internal|private|data|sealed|enum|abstract|open|suspend)\s+)*(?:class|interface|object|fun|val)\s+([A-Za-z_][\w]*)/;
const WORKSPACE_PATH_LITERAL = /["'`]((?:data|reports|output|config|modes|batch|jds|templates)\/[^"'`\s]*|[\w.-]+\.(?:md|tsv|yml|yaml|mjs|pdf))["'`]/g;
const SEARCH_EXCLUDES = [":(exclude)**/node_modules/**", ":(exclude)**/dist/**", ":(exclude)**/build/**", ":(exclude)_bmad-output/**"];

const files = changedFiles();
const fileReports = files.map(analyzeFile);
const report = buildReport(fileReports);

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderMarkdown(report));
}

function analyzeFile(file) {
  const lines = file.status === "D" ? { added: [], removed: [], addedLineNumbers: [] } : diffLines(file.path);
  const baseContent = file.status === "A" ? null : show(args.base, file.oldPath ?? file.path);
  if (file.status === "D") {
    lines.removed = (baseContent ?? "").split("\n").map((text, index) => ({ text, line: index + 1 }));
  }
  const touched = [...lines.added, ...lines.removed];
  const headContent = file.status === "D" ? null : show(head, file.path);
  const risks = new Set();
  for (const rule of PATH_RISKS) if (rule.pattern.test(file.path)) risks.add(rule.area);
  const isTest = /\.test\.|\/test\/|\/src\/test\//.test(file.path);
  const isCode = /\.(ts|mts|mjs|js|kt)$/.test(file.path);
  if (isCode && !isTest) {
    for (const rule of CONTENT_RISKS) if (touched.some(({ text }) => rule.pattern.test(text))) risks.add(rule.area);
  }

  let symbols = [];
  if (file.path.endsWith(".kt")) {
    symbols = kotlinSymbols(touched, headContent, lines.addedLineNumbers);
  } else if (/\.(ts|mts|mjs|js)$/.test(file.path)) {
    // Added lines are placed in the head tree and removed lines in the base tree,
    // so a deletion is charged to the declaration that held it.
    symbols = [
      ...(headContent === null ? [] : tsSymbols(file.path, headContent, lines.added.map(({ line }) => line))),
      ...(baseContent === null ? [] : tsSymbols(file.oldPath ?? file.path, baseContent, lines.removed.map(({ line }) => line)))
    ];
  }

  const routes = [];
  for (const { text, side } of touched.map((entry) => ({ ...entry, side: lines.added.includes(entry) ? "+" : "-" }))) {
    const route = text.match(ROUTE_PATTERN) ?? text.match(RETROFIT_PATTERN);
    if (route) routes.push({ method: route[1].toUpperCase(), path: route[2], side });
  }

  const workspacePaths = new Set();
  for (const { text } of touched) {
    for (const match of text.matchAll(WORKSPACE_PATH_LITERAL)) workspacePaths.add(match[1]);
  }

  return {
    ...file,
    isTest,
    risks: [...risks].sort(),
    symbols,
    routes,
    workspacePaths: [...workspacePaths].sort()
  };
}

function buildReport(fileReports) {
  const components = new Set();
  for (const { path } of fileReports) {
    if (isDocumentation(path)) components.add("docs");
    else if (path.startsWith("career-ops-wrapper/contracts/")) components.add("contracts");
    else if (path.startsWith("career-ops-wrapper/")) components.add("wrapper");
    else if (path.startsWith("android/")) components.add("android");
    else components.add("other");
  }

  const docsOnly = fileReports.length > 0 && fileReports.every(({ path, oldPath }) => isDocumentation(path) && (!oldPath || isDocumentation(oldPath)));

  const gates = [];
  if (fileReports.some(({ path }) => path.startsWith(".claude/skills/review-change/scripts/"))) {
    gates.push("node --test '.claude/skills/review-change/scripts/*.test.mjs'");
  }
  if (components.has("wrapper") || components.has("contracts")) gates.push("cd career-ops-wrapper && npm test && npm run build");
  if (components.has("android") || components.has("contracts")) {
    gates.push("cd android && ./gradlew testDevDebugUnitTest lintDevDebug detekt ktlintCheck");
  }

  const source = fileReports.filter((file) => !file.isTest && !file.path.includes("/fixtures/"));
  const symbols = new Map();
  for (const file of source) {
    for (const { name, exported, part } of file.symbols) {
      addSymbol(symbols, name, file.path, `${exported ? "" : "file-local "}${part} changed`);
    }
  }
  const symbolImpact = [...symbols.values()].map((symbol) => ({
    ...symbol,
    // File-local JS/TS symbols cannot be imported, so a repo-wide grep only finds namesakes.
    references:
      symbol.name.length < 4 || (!symbol.file.endsWith(".kt") && symbol.reasons.every((reason) => reason.startsWith("file-local")))
        ? []
        : references(symbol.name, symbol.file)
  }));

  const schemas = symbolImpact
    .filter(({ name }) => /Schema$/.test(name))
    .map(({ name }) => {
      const androidDto = name.replace(/Schema$/, "");
      return { name, androidDto, androidRefs: grep(["-E", `(class|typealias) ${androidDto}([^A-Za-z0-9_]|$)`], ["android/"]) };
    });

  const examples = fileReports
    .filter(({ path }) => path.startsWith("career-ops-wrapper/contracts/"))
    .map(({ path, status }) => {
      const base = path.split("/").pop();
      return { path, status, references: grep(["-F", base], ["android/", "career-ops-wrapper/test/", "career-ops-wrapper/src/"]) };
    });

  const workspacePaths = [...new Set(fileReports.filter((file) => !file.isTest).flatMap((file) => file.workspacePaths))].sort()
    .map((literal) => ({ literal, references: grep(["-F", literal], ["career-ops-wrapper/src/"]) }));

  const routes = fileReports.flatMap((file) => file.routes.map((route) => ({ ...route, file: file.path })));
  const risks = new Map();
  for (const file of fileReports) {
    for (const area of file.risks) {
      if (!risks.has(area)) risks.set(area, []);
      risks.get(area).push(file.path);
    }
  }

  const reviewers = new Set(docsOnly ? ["spec"] : ["spec", "impact", "tests"]);
  for (const area of risks.keys()) if (MANDATORY_REVIEWER[area]) reviewers.add(MANDATORY_REVIEWER[area]);
  if (routes.some((route) => route.side === "+")) reviewers.add("security");

  const androidChecklist = components.has("android") ? "android/.claude/skills/android-agentic-starter/references/review-checklist.md" : null;

  return {
    range: { base: args.base, head, baseSha: git(["rev-parse", args.base]).trim(), headSha: git(["rev-parse", head]).trim() },
    mode: docsOnly ? "docs-only" : "full",
    components: [...components].sort(),
    gates,
    reviewers: [...reviewers],
    androidChecklist,
    risks: Object.fromEntries([...risks.entries()].sort()),
    riskChecks: Object.fromEntries([...risks.keys()].sort().map((area) => [area, RISK_CHECKS[area] ?? null])),
    files: fileReports.map(({ path, status, isTest, risks: fileRisks }) => ({ path, status, isTest, risks: fileRisks })),
    routes,
    symbols: symbolImpact,
    schemas,
    contractExamples: examples,
    workspacePaths
  };
}

function renderMarkdown(report) {
  const out = [];
  out.push(`# Impact map ${report.range.baseSha.slice(0, 7)}..${report.range.headSha.slice(0, 7)}`, "");
  out.push(`Mode: ${report.mode === "docs-only" ? "docs-only (Layer 0 + Spec reviewer)" : "full"}`);
  out.push(`Components: ${report.components.join(", ") || "none"}`);
  out.push(`Mandatory reviewers: ${report.reviewers.join(", ")}`);
  if (report.androidChecklist) out.push(`Android checklist: ${report.androidChecklist}`);
  out.push("", "## Layer 0 gates", ...report.gates.map((gate) => `- \`${gate}\``));
  out.push("", "## Risk areas");
  for (const [area, paths] of Object.entries(report.risks)) {
    out.push(`- **${area}**${MANDATORY_REVIEWER[area] ? ` (→ ${MANDATORY_REVIEWER[area]} reviewer)` : ""}: ${RISK_CHECKS[area] ?? ""}`);
    out.push(`  - ${paths.join(", ")}`);
  }
  out.push("", "## Changed files");
  for (const file of report.files) out.push(`- ${file.status} ${file.path}${file.isTest ? " (test)" : ""}`);
  if (report.routes.length) {
    out.push("", "## HTTP routes (+ added, - removed)");
    for (const route of report.routes) out.push(`- ${route.side} ${route.method} ${route.path} (${route.file})`);
  }
  out.push("", "## Changed symbols and references");
  const fileLocal = new Map();
  for (const symbol of report.symbols) {
    if (symbol.references.length === 0 && symbol.reasons.every((reason) => reason.startsWith("file-local"))) {
      if (!fileLocal.has(symbol.file)) fileLocal.set(symbol.file, []);
      fileLocal.get(symbol.file).push(symbol.name);
      continue;
    }
    out.push(`- \`${symbol.name}\` in ${symbol.file} (${symbol.reasons.join("; ")}): ${symbol.references.length} reference(s) elsewhere`);
    for (const ref of symbol.references.slice(0, 15)) out.push(`  - ${ref}`);
    if (symbol.references.length > 15) out.push(`  - … ${symbol.references.length - 15} more`);
  }
  for (const [file, names] of fileLocal) out.push(`- file-local in ${file}: ${names.map((name) => `\`${name}\``).join(", ")}`);
  if (report.schemas.length) {
    out.push("", "## Zod schemas → Android DTOs");
    for (const schema of report.schemas) {
      out.push(`- \`${schema.name}\` → \`${schema.androidDto}\`: ${schema.androidRefs.length ? schema.androidRefs.join(", ") : "no Android DTO found"}`);
    }
  }
  if (report.contractExamples.length) {
    out.push("", "## Contract examples");
    for (const example of report.contractExamples) {
      out.push(`- ${example.status} ${example.path}: ${example.references.length ? example.references.join(", ") : "no references"}`);
    }
  }
  if (report.workspacePaths.length) {
    out.push("", "## Workspace path literals");
    for (const entry of report.workspacePaths) out.push(`- \`${entry.literal}\`: ${entry.references.length} reference(s) in wrapper src`);
  }
  return out.join("\n");
}

function changedFiles() {
  // -z prints paths raw; without it git quotes non-ASCII paths and every path rule misses them.
  const fields = git(["diff", "--name-status", "-z", "-M", `${args.base}..${head}`]).split("\0").filter(Boolean);
  const files = [];
  for (let index = 0; index < fields.length; ) {
    const status = fields[index++];
    if (status.startsWith("R") || status.startsWith("C")) {
      files.push({ status: status[0], oldPath: fields[index++], path: fields[index++] });
    } else {
      files.push({ status: status[0], path: fields[index++] });
    }
  }
  return files;
}

function diffLines(path) {
  const output = git(["diff", "-U0", "--no-color", `${args.base}..${head}`, "--", path]);
  const added = [];
  const removed = [];
  const addedLineNumbers = [];
  let newLine = 0;
  let oldLine = 0;
  let inHunk = false;
  for (const line of output.split("\n")) {
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      inHunk = true;
      continue;
    }
    // Inside a hunk, `---i` is a removed `--i`, not a file header.
    if (!inHunk) continue;
    if (line.startsWith("+")) {
      added.push({ text: line.slice(1), line: newLine });
      addedLineNumbers.push(newLine);
      newLine += 1;
    } else if (line.startsWith("-")) {
      removed.push({ text: line.slice(1), line: oldLine });
      // Removed lines come first in a -U0 hunk, so newLine is the first
      // replacement line, or for a pure deletion (`+N,0`) the line before it;
      // walking up from there finds the declaration that held the deletion.
      addedLineNumbers.push(Math.max(newLine, 1));
      oldLine += 1;
    }
  }
  return { added, removed, addedLineNumbers };
}

/**
 * Markdown or `docs/**` that ships nothing and steers no agent or CI run:
 * agent instructions (`AGENTS.md`, `CLAUDE.md`, any `.claude/` directory),
 * workflows and templates (`.github/`) and files under any `src/`,
 * `contracts/` or `fixtures/` directory are not documentation.
 */
function isDocumentation(path) {
  if (/(^|\/)\.(claude|github)\//.test(path) || /(^|\/)(src|contracts|fixtures)\//.test(path)) return false;
  if (/(^|\/)(AGENTS|CLAUDE)\.md$/i.test(path)) return false;
  return path.startsWith("docs/") || /\.md$/i.test(path);
}

/**
 * Top-level TypeScript/JavaScript declarations that own the given lines. A
 * statement owns its whole span plus the comments above it (JSDoc, `//` lines,
 * blank-line-separated notes), so a comment is never charged to the
 * declaration before it. Lines in statements that declare nothing (calls,
 * imports) belong to no symbol.
 */
function tsSymbols(path, content, lineNumbers) {
  if (lineNumbers.length === 0) return [];
  const ts = typescript();
  const kind = /\.m?ts$/.test(path) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, kind);
  const lineOf = (pos) => source.getLineAndCharacterOfPosition(pos).line + 1;

  // `function x() {}` followed by `export { x }` or `export default x` is exported too.
  const exportedLater = new Set();
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) exportedLater.add((element.propertyName ?? element.name).text);
    } else if (ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression)) {
      exportedLater.add(statement.expression.text);
    }
  }

  const statements = source.statements.map((statement) => {
    // Leading comments exclude a trailing comment on the previous statement's last line.
    const comments = ts.getLeadingCommentRanges(content, statement.getFullStart()) ?? [];
    const first = lineOf(comments.length ? comments[0].pos : statement.getStart(source));
    const exported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    const names = declaredNames(ts, statement).map(({ node, span }) => ({
      name: node.text,
      nameLine: lineOf(node.getStart(source)),
      first: lineOf(span.getStart(source)),
      last: lineOf(span.getEnd()),
      exported: exported || ts.isExportDeclaration(statement) || exportedLater.has(node.text)
    }));
    return { first, last: lineOf(statement.getEnd()), names };
  });

  const found = new Map();
  for (const line of lineNumbers) {
    const statement = statements.find(({ first, last }) => line >= first && line <= last);
    if (!statement) continue;
    // `const a = 1, b = 2;` charges only the declarator on the line; comments and keywords charge all.
    const inDeclarator = statement.names.filter(({ first, last }) => line >= first && line <= last);
    for (const entry of inDeclarator.length ? inDeclarator : statement.names) {
      const part = line === entry.nameLine ? "declaration" : "body";
      const key = `${entry.name}#${part}`;
      if (!found.has(key)) found.set(key, { name: entry.name, exported: entry.exported, part });
    }
  }
  return [...found.values()];
}

/** Identifiers a top-level statement declares, each with the node whose span it owns. */
function declaredNames(ts, statement) {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) => bindingIdentifiers(ts, declaration.name).map((node) => ({ node, span: declaration })));
  }
  if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
    // Callers import the exported name (`pub` in `export { local as pub }`).
    return statement.exportClause.elements.map((element) => ({ node: element.name, span: element }));
  }
  const isNamed =
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isModuleDeclaration(statement);
  return isNamed && statement.name && ts.isIdentifier(statement.name) ? [{ node: statement.name, span: statement }] : [];
}

function bindingIdentifiers(ts, name) {
  if (ts.isIdentifier(name)) return [name];
  return name.elements.flatMap((element) => (ts.isOmittedExpression(element) ? [] : bindingIdentifiers(ts, element.name)));
}

/** The wrapper's pinned compiler, loaded once and only when a TS/JS file changed. */
function typescript() {
  if (!typescript.module) {
    const wrapperPackage = new URL("../../../../career-ops-wrapper/package.json", import.meta.url);
    try {
      typescript.module = createRequire(wrapperPackage)("typescript");
    } catch {
      console.error("impact-map: cannot load typescript from career-ops-wrapper; run `npm ci` in career-ops-wrapper first");
      process.exit(2);
    }
  }
  return typescript.module;
}

/** Kotlin: declarations on changed lines, plus top-level declarations whose bodies contain them. */
function kotlinSymbols(touched, content, lineNumbers) {
  const found = new Map();
  for (const { text } of touched) {
    const name = text.trim().match(KT_DECL)?.[1];
    if (name) found.set(`${name}#declaration`, { name, exported: true, part: "declaration" });
  }
  if (!content) return [...found.values()];
  const lines = content.split("\n");
  const add = (text) => {
    const name = text.match(KT_DECL)?.[1];
    if (!name) return false;
    if (!found.has(`${name}#body`)) found.set(`${name}#body`, { name, exported: true, part: "body" });
    return true;
  };
  for (const lineNumber of lineNumbers) {
    const start = Math.min(lineNumber, lines.length) - 1;
    if (isTopLevelDocComment(lines[start])) {
      // A top-level doc comment belongs to the declaration below it.
      let index = start + 1;
      while (index < lines.length && (isTopLevelDocComment(lines[index]) || /^@/.test(lines[index]))) index += 1;
      if (index < lines.length && add(lines[index])) continue;
    }
    for (let index = start; index >= 0; index -= 1) {
      const text = lines[index];
      if (/^\s/.test(text) || text.trim() === "" || isTopLevelDocComment(text) || /^\/\//.test(text)) continue;
      if (add(text)) break;
      // Closing lines of the declaration above (`}`, `});`) keep the walk going;
      // any other top-level statement means the change is outside a declaration.
      if (!/^[})\]]/.test(text)) break;
    }
  }
  return [...found.values()];
}

/** `/**`, ` * …` and ` *\/` at column 0 or 1; indented ones belong to a body. */
function isTopLevelDocComment(text) {
  return /^ ?(\/\*\*|\*\/|\*(\s|$))/.test(text ?? "");
}

function addSymbol(symbols, name, file, reason) {
  const key = `${file}#${name}`;
  if (!symbols.has(key)) symbols.set(key, { name, file, reasons: [] });
  const symbol = symbols.get(key);
  if (!symbol.reasons.includes(reason)) symbol.reasons.push(reason);
}

function references(name, ownFile) {
  return grep(["-w", "-F", name], ["career-ops-wrapper/src/", "career-ops-wrapper/test/", "android/app/src/", "docs/"])
    .filter((entry) => !entry.startsWith(`${ownFile}:`));
}

/** `git grep` over the head tree: portable (no PCRE, no ripgrep) and deterministic. */
function grep(patternArgs, paths) {
  try {
    const output = git(["grep", "-n", ...patternArgs, head, "--", ...paths, ...SEARCH_EXCLUDES]);
    return output.split("\n").filter(Boolean).map((line) => line.replace(`${head}:`, "").replace(/^(.*?:\d+):\s*/, "$1: ").slice(0, 160));
  } catch {
    return [];
  }
}

function show(rev, path) {
  try {
    return git(["show", `${rev}:${path}`]);
  } catch {
    return null;
  }
}

function git(gitArgs) {
  return execFileSync("git", gitArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

/** Returns null on an unknown flag or a flag whose value is missing or another flag. */
function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") parsed.json = true;
    else if (arg === "--base" || arg === "--head") {
      const value = argv[++index];
      if (value === undefined || value.startsWith("-")) return null;
      parsed[arg.slice(2)] = value;
    } else return null;
  }
  return parsed;
}
