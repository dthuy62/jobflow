import { describe, expect, it } from "vitest";
import { redactSensitiveText } from "../src/security/redaction.js";

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
