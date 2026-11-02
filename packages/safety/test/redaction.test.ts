import { describe, expect, it } from "vitest";
import { redactSensitiveText } from "../src/redaction.js";

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

describe("redactSensitiveText for the hosted backend", () => {
  it("redacts a bearer token in an Authorization header", () => {
    expect(redactSensitiveText("Authorization: Bearer abc.def.ghi")).toBe("Authorization: Bearer [REDACTED]");
    expect(redactSensitiveText('{"authorization":"Bearer abc.def.ghi"}')).toBe('{"authorization":"Bearer [REDACTED]"}');
  });

  it("leaves the ordinary word bearer alone", () => {
    expect(redactSensitiveText("the bearer of this role leads the team")).toBe("the bearer of this role leads the team");
  });

  it("redacts the password in a connection string", () => {
    expect(redactSensitiveText("postgres://app:s3cret@db:5432/jobflow failed")).toBe("postgres://app:[REDACTED]@db:5432/jobflow failed");
    expect(redactSensitiveText("postgresql://app:p@ss@db/x")).toBe("postgresql://app:[REDACTED]@db/x");
    expect(redactSensitiveText("https://user:pw@example.com/a")).toBe("https://user:[REDACTED]@example.com/a");
  });

  it("leaves a URL with no password alone", () => {
    for (const url of ["https://example.com:8443/jobs", "https://medium.com/@someone", "postgres://db:5432/jobflow"]) {
      expect(redactSensitiveText(url)).toBe(url);
    }
  });

  it("stays fast on hostile input", () => {
    const started = performance.now();
    redactSensitiveText("https://a:".repeat(50_000));
    redactSensitiveText("a.".repeat(200_000));
    redactSensitiveText("Authorization: ".repeat(50_000));
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
