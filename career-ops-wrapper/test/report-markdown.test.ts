import { describe, expect, it } from "vitest";
import { sanitizeReportMarkdown, type ReportMarkdownContext } from "../src/security/report-markdown.js";

const CV = "cv-jane-doe-acme-2026-06-20.pdf";
const CV_ID = "artifact_0123456789abcdef";
const CV_URL = `/api/v1/artifacts/${CV_ID}/download`;

const context: ReportMarkdownContext = {
  artifactIdByFileName: new Map([
    [CV, CV_ID],
    ["cv jane.pdf", "artifact_fedcba9876543210"]
  ]),
  localValues: ["/Users/jane", "/Users/jane/career-ops", "/private/var/jane/career-ops"],
  secrets: ["pairing-secret"]
};

function sanitize(markdown: string): string {
  return sanitizeReportMarkdown(markdown, context);
}

describe("report links", () => {
  it.each([
    [`[CV](../output/${CV})`, `[CV](${CV_URL})`],
    [`[CV](output/${CV})`, `[CV](${CV_URL})`],
    [`[CV](./../output/${CV}#page=2)`, `[CV](${CV_URL})`],
    [`[CV](<../output/${CV}> "Tailored CV")`, `[CV](${CV_URL} "Tailored CV")`],
    [`![preview](../output/${CV})`, `![preview](${CV_URL})`],
    ["[CV](../output/cv%20jane.pdf)", "[CV](/api/v1/artifacts/artifact_fedcba9876543210/download)"],
    [`[CV](../reports/../output/${CV})`, `[CV](${CV_URL})`]
  ])("rewrites a workspace link to a known artifact: %s", (input, expected) => {
    expect(sanitize(input)).toBe(expected);
  });

  it.each([
    ["[missing](../output/other.pdf)", "missing"],
    ["[tracker](../data/applications.md)", "tracker"],
    ["[Globex](002-globex-labs-2026-06-21.md)", "Globex"],
    [`[out](../../output/${CV})`, "out"],
    ["[secret](../../../etc/passwd)", "secret"],
    ["[abs](/Users/jane/career-ops/output/x.pdf)", "abs"],
    ["[home](~/Downloads/x.pdf)", "home"],
    ["[file](file:///Users/jane/x.pdf)", "file"],
    ["[win](C:/Users/jane/x.pdf)", "win"],
    ["[win](C:\\Users\\jane\\x.pdf)", "win"],
    ["[vscode](vscode://file/Users/jane/x)", "vscode"],
    ["![chart](../output/chart.png)", "chart"],
    ["[local](http://localhost:8080/Users/jane/career-ops/x.pdf)", "local"],
    ["[bad](../output/%zz.pdf)", "bad"]
  ])("reduces any other local link to its text: %s", (input, expected) => {
    expect(sanitize(input)).toBe(expected);
  });

  it.each([
    ["[posting](https://jobs.example.com/acme/senior-android)"],
    ["[mail](mailto:jobs@example.com)"],
    ["[below](#scores)"],
    ['[wiki](https://en.wikipedia.org/wiki/Kotlin_(programming_language) "Kotlin")']
  ])("keeps a web link: %s", (input) => {
    expect(sanitize(input)).toBe(input);
  });

  it("handles an image inside a link", () => {
    expect(sanitize(`[![thumb](../output/${CV})](../data/x.md)`)).toBe(`![thumb](${CV_URL})`);
  });

  it("rewrites or drops reference definitions", () => {
    expect(
      sanitize(
        [
          "See [the CV][cv], [tracker][t] and [posting][web].",
          "",
          `[cv]: ../output/${CV} "CV"`,
          "  [t]: /Users/jane/career-ops/data/applications.md",
          "[web]: https://jobs.example.com/a"
        ].join("\n")
      )
    ).toBe(
      [
        "See [the CV][cv], [tracker][t] and [posting][web].",
        "",
        `[cv]: ${CV_URL} "CV"`,
        "[web]: https://jobs.example.com/a"
      ].join("\n")
    );
  });

  it("does not rewrite links inside code, but still removes paths there", () => {
    const markdown = [
      "Use `[CV](../output/x.pdf)` or `cat /Users/bob/x`.",
      "```",
      "[CV](../output/x.pdf) /opt/secret/key",
      "```"
    ].join("\n");
    expect(sanitize(markdown)).toBe(
      [
        "Use `[CV](../output/x.pdf)` or `cat [local path]`.",
        "```",
        "[CV](../output/x.pdf) [local path]",
        "```"
      ].join("\n")
    );
  });

  it("removes paths from link text and titles", () => {
    expect(sanitize(`[/Users/bob/cv.pdf](../output/${CV} "from /opt/x")`)).toBe(
      `[[local path]](${CV_URL} "from [local path]")`
    );
  });

  it("removes a path from a link it could not parse", () => {
    expect(sanitize("[CV\n\nsplit](/Users/bob/cv.pdf)")).toBe("[CV\n\nsplit]([local path])");
  });

  it("ignores escaped brackets", () => {
    expect(sanitize("\\[x](../output/a.pdf)")).toBe("\\[x](../output/a.pdf)");
  });

  it("stays linear on pathological bracket input", () => {
    const markdown = `${"[".repeat(100_000)}${"](".repeat(100_000)}${'](x "'.repeat(50_000)}`;
    const started = performance.now();
    sanitize(markdown);
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe("local paths in report text", () => {
  // Finding C from PR #11 and the round-3 cases from PR #8, as report text.
  const leakCases: ReadonlyArray<readonly [string, string, readonly string[]]> = [
    ["sibling folder sharing the workspace prefix", "Saved /Users/jane/career-ops-old/cv.pdf.", ["career-ops", "-old", "jane", "cv.pdf"]],
    ["'..' after the workspace path", "Saved /Users/jane/career-ops/../secret/x.pdf.", ["career-ops", "secret", ".."]],
    ["'..' after the real workspace path", "at /private/var/jane/career-ops/../../x", ["private", "jane", ".."]],
    ["sibling of the home directory", "at /Users/janedoe/notes.txt", ["janedoe", "notes"]],
    ["climb-out after a space", "read /Users/jane/career-ops ../../etc/passwd", ["..", "passwd", "jane"]],
    ["climb-out after a comma", "read /Users/jane/career-ops,../../etc/passwd", ["..", "passwd", "jane"]],
    ["path with spaces", "in /Users/jane/Application Support/../../Users/bob/x", ["..", "bob", "jane"]],
    ["path with spaces, no climb", "in /Users/bob/Application Support/Caches/token.txt now", ["bob", "Caches", "token"]],
    ["percent-encoded climb-out", "read /Users/jane/career-ops/%2e%2e/%2e%2e/etc/passwd", ["%2e", "passwd", "jane"]],
    ["percent-encoded relative climb", "read %2e%2e%2f%2e%2e%2fetc%2fpasswd", ["%2e", "passwd"]],
    ["percent-encoded absolute path", "read %2FUsers%2Fbob%2Fx", ["Users", "bob"]],
    ["entity-encoded absolute path", "read &#47;Users&#47;bob&#47;x and &sol;opt&sol;y", ["Users", "bob", "opt"]],
    ["relative climb", "read ../../../Users/bob/x", ["..", "bob"]],
    ["path after '-'", "flag x-/Users/bob/secret", ["bob", "secret"]],
    ["path after '='", "--workspace=/Users/bob/career-ops", ["bob", "career-ops"]],
    ["path in parentheses", "(see /srv/data/x.pdf)", ["srv", "data"]],
    ["path in emphasis", "**/Users/bob/x** and _/opt/y_", ["bob", "opt"]],
    ["path in quotes", '"/Users/bob/x"', ["bob"]],
    ["path in HTML", '<a href="/Users/bob/x">x</a>', ["bob"]],
    ["path after an ellipsis", "see .../Users/bob/x", ["bob"]],
    ["home path", "read ~/secrets/token.txt", ["~", "secrets", "token.txt"]],
    ["other user's home", "read ~bob/secrets", ["bob", "secrets"]],
    ["$HOME path", "read $HOME/secrets and ${HOME}/x", ["secrets", "HOME"]],
    ["file URL", "load file:///opt/secret/x.js", ["file:", "opt", "secret"]],
    ["file URL without slashes", "load file:C:/x.js", ["file:", "x.js"]],
    ["Windows path", "missing C:\\Users\\jane\\x.txt", ["C:", "jane"]],
    ["Windows forward-slash path", "missing D:/work/x.txt", ["D:", "work"]],
    ["UNC path", "on \\\\server\\share\\x", ["server", "share"]],
    ["Windows home variable", "in %USERPROFILE%\\Documents", ["USERPROFILE", "Documents"]],
    ["workspace path inside a relative token", "see foo/Users/jane/career-ops/x", ["jane", "career-ops"]],
    ["workspace path inside a URL", "http://localhost:3000/Users/jane/career-ops/x", ["jane", "career-ops"]],
    ["home path in a different case", "see x/users/JANE/y", ["JANE", "users"]],
    ["path after an escape", "see \\/Users\\/bob", ["Users", "bob"]],
    ["other scheme", "open vscode://file/Users/bob/x", ["vscode", "bob"]],
    ["userinfo", "fetch https://jane:hunter2@jobs.example.com/a", ["hunter2", "jane", "@"]],
    ["userinfo after '-'", "fetch 401-https://jane:hunter2@jobs.example.com/a", ["hunter2", "jane", "@"]],
    ["userinfo after '+'", "fetch a+https://jane:hunter2@jobs.example.com/a", ["hunter2", "jane", "@"]],
    ["userinfo after '.'", "fetch a.https://jane:hunter2@jobs.example.com/a", ["hunter2", "jane", "@"]],
    ["userinfo after a digit", "fetch 1https://jane:hunter2@jobs.example.com/a", ["hunter2", "jane", "@"]],
    ["'?' in a password", "fetch https://jane:hunter2?x@jobs.example.com/a", ["hunter2", "jane", "@"]],
    ["'#' in a password", "fetch https://jane:hunter2#x@jobs.example.com/a", ["hunter2", "jane", "@"]],
    ["pairing token", "CAREER_OPS_PAIRING_TOKEN=abc and pairing-secret", ["abc", "pairing-secret"]]
  ];

  it.each(leakCases)("removes %s", (_label, text, markers) => {
    for (const markdown of [text, `# Report\n\n- ${text}\n`, `\`${text}\``, `\`\`\`\n${text}\n\`\`\``]) {
      const sanitized = sanitize(markdown);
      for (const marker of markers) {
        expect(sanitized, `${markdown} → ${sanitized}`).not.toContain(marker);
      }
    }
  });

  it.each([
    ["Saved /Users/jane/career-ops-old/cv.pdf.", "Saved [local path]."],
    ["Saved /Users/jane/career-ops/../secret.", "Saved [local path]."],
    ["(see /srv/data/x.pdf)", "(see [local path])"],
    ["path:/Users/bob/x", "path:[local path]"],
    ["in /Users/bob/Application Support/Caches/x now", "in [local path] [local path] now"],
    ["read /Users/bob/x\nCI/CD stays", "read [local path]\nCI/CD stays"],
    ["fetch https://jane:pw@jobs.example.com/a?x=1", "fetch https://jobs.example.com/a?x=1"],
    ["fetch https://jane:p?w#x@jobs.example.com/a", "fetch https://jobs.example.com/a"],
    ["CAREER_OPS_PAIRING_TOKEN=abc pairing-secret", "CAREER_OPS_PAIRING_TOKEN=[REDACTED] [REDACTED]"]
  ])("keeps the sentence readable: %s", (input, expected) => {
    expect(sanitize(input)).toBe(expected);
  });

  it.each([
    "**Score:** 4.2/5",
    "**URL:** https://jobs.example.com/acme-robotics/senior-android",
    `**PDF:** output/${CV}`,
    "CI/CD, iOS/Android, C++/Kotlin, C#/.NET, **Kotlin**/Java, +/- 10%, 24/7, N/A",
    "Read portals.yml... then retry...",
    "~5/10 fit, ~$120k, approx. ~4/5",
    "Escapes: \\* \\_ \\[x\\]",
    "| Role | Score |\n| --- | --- |\n| Android | 4/5 |",
    "Dates 2026/06/20 and 50%/50%",
    "https://example.com/a/../b",
    `Download: ${CV_URL}`,
    "(empty report)"
  ])("leaves ordinary report text alone: %s", (text) => {
    expect(sanitize(text)).toBe(text);
  });

  it("does not let the artifact path hide a climb", () => {
    expect(sanitize(`${CV_URL}/../../../etc/passwd`)).not.toContain("passwd");
  });
});
