import { describe, expect, it, vi } from "vitest";
import { logStartupError } from "../src/server.js";

describe("startup error logging", () => {
  it("redacts sensitive startup diagnostics before logging", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      logStartupError(
        new Error("Failed /Users/hy/career-ops with CAREER_OPS_PAIRING_TOKEN=secret"),
        "/Users/hy/career-ops"
      );

      const logged = String(consoleSpy.mock.calls[0]?.[0]);
      expect(logged).toContain("[WORKSPACE]");
      expect(logged).toContain("CAREER_OPS_PAIRING_TOKEN=[REDACTED]");
      expect(logged).not.toContain("/Users/hy/career-ops");
      expect(logged).not.toContain("secret");
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
