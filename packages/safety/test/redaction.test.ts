import { describe, expect, it } from "vitest";
import { LOG_TEXT_MAX_CHARS, redactLogText, redactSensitiveText } from "../src/redaction.js";

describe("sensitive text redaction", () => {
  it("redacts local pairing token values", () => {
    expect(
      redactSensitiveText(
        "X-Career-Ops-Token: local-secret CAREER_OPS_PAIRING_TOKEN=another-secret"
      )
    ).toBe(
      "X-Career-Ops-Token: [REDACTED] CAREER_OPS_PAIRING_TOKEN=[REDACTED]"
    );
  });

  it("redacts dotenv, header, and object-like token diagnostics without swallowing the full line", () => {
    expect(
      redactSensitiveText(
        'CAREER_OPS_PAIRING_TOKEN=secret CAREER_OPS_PORT=3000 X-Career-Ops-Token: other {"CAREER_OPS_PAIRING_TOKEN":"json-secret"}'
      )
    ).toBe(
      'CAREER_OPS_PAIRING_TOKEN=[REDACTED] CAREER_OPS_PORT=3000 X-Career-Ops-Token: [REDACTED] {"CAREER_OPS_PAIRING_TOKEN":"[REDACTED]"}'
    );
  });

  it("redacts configured workspace paths", () => {
    expect(
      redactSensitiveText("Failed under /Users/hy/career-ops/profile.yml", {
        workspacePath: "/Users/hy/career-ops"
      })
    ).toBe("Failed under [WORKSPACE]/profile.yml");
  });
});

describe("redactSensitiveText keeps report text intact", () => {
  it.each([
    "[db](postgres://app:s3cret@db:5432/x)",
    "[apply](https://user:pw@jobs.example/x) tail",
    "`Authorization: Bearer <token>` is needed",
    "Use Authorization: Bearer tokens for all calls."
  ])("leaves %s to the report sanitizer", (text) => {
    expect(redactSensitiveText(text)).toBe(text);
  });
});

describe("redactLogText", () => {
  it("applies the wrapper's redaction too", () => {
    expect(redactLogText("X-Career-Ops-Token: abc")).toBe("X-Career-Ops-Token: [REDACTED]");
  });

  it.each([
    ["Authorization: Bearer abc.def.ghi", "Authorization: Bearer [REDACTED]"],
    ['{"authorization":"Bearer abc.def.ghi"}', '{"authorization":"Bearer [REDACTED]"}'],
    ['{"authorization":["Bearer abc.def"]}', '{"authorization":["Bearer [REDACTED]"]}'],
    ['["authorization","Bearer abc.def"]', '["authorization","Bearer [REDACTED]"]'],
    ['{\\"authorization\\":\\"Bearer abc.def\\"}', '{\\"authorization\\":\\"Bearer [REDACTED]\\"}'],
    ["Authorization: Basic dXNlcjpwYXNz", "Authorization: Basic [REDACTED]"],
    ["Authorization: Token abc", "Authorization: Token [REDACTED]"],
    ["Authorization: abc", "Authorization: [REDACTED]"],
    ["proxy-authorization: Bearer abc", "proxy-authorization: Bearer [REDACTED]"],
    ["sent Bearer abc.def.ghi upstream", "sent Bearer [REDACTED] upstream"]
  ])("redacts the credential in %s", (input, expected) => {
    expect(redactLogText(input)).toBe(expected);
  });

  it("leaves the ordinary word bearer alone", () => {
    expect(redactLogText("the bearer of this role leads the team")).toBe("the bearer of this role leads the team");
  });

  it.each(["postgres", "postgresql", "mysql", "mariadb", "redis", "rediss", "mongodb", "mongodb+srv", "amqp", "amqps", "http", "https"])(
    "redacts the password in a %s URL",
    (scheme) => {
      expect(redactLogText(`${scheme}://app:s3cret@db:5432/x failed`)).toBe(`${scheme}://app:[REDACTED]@db:5432/x failed`);
    }
  );

  it.each([
    ["postgresql://app:p@ss@db/x", "postgresql://app:[REDACTED]@db/x"],
    ["redis://:s3cret@cache:6379/0", "redis://:[REDACTED]@cache:6379/0"],
    ["postgres://app@srv:s3cret@db/x", "postgres://app@srv:[REDACTED]@db/x"],
    ["postgres://app:ab+c/d==@db/x", "postgres://app:[REDACTED]@db/x"],
    [`postgres://app:${"x".repeat(600)}@db/x`, "postgres://app:[REDACTED]@db/x"],
    ["postgres://app@db/x?password=s3cret&a=1", "postgres://app@db/x?password=[REDACTED]&a=1"],
    ["host=db password=s3cret user=app", "host=db password=[REDACTED] user=app"],
    ["GET /x?access_token=abc&y=1", "GET /x?access_token=[REDACTED]&y=1"]
  ])("redacts the secret in %s", (input, expected) => {
    expect(redactLogText(input)).toBe(expected);
  });

  it("leaves a URL with no password alone", () => {
    for (const url of ["https://example.com:8443/jobs", "https://medium.com/@someone", "https://example.com:8443/@someone", "postgres://db:5432/jobflow"]) {
      expect(redactLogText(url)).toBe(url);
    }
  });

  it("caps very long text and stays fast on hostile input", () => {
    const started = performance.now();
    for (const text of ["postgres://a:".repeat(50_000), "https://a:".repeat(50_000), "a.".repeat(200_000), "Authorization: ".repeat(50_000)]) {
      expect(redactLogText(text).length).toBeLessThanOrEqual(LOG_TEXT_MAX_CHARS + 20);
    }
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
