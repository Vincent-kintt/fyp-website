import { describe, it, expect } from "vitest";
import { getStatusConfig, REMINDER_STATUSES } from "@/lib/utils";

describe("STATUS_CONFIG dotColorVar", () => {
  it("every valid reminder status exposes a CSS var() dotColorVar", () => {
    for (const status of REMINDER_STATUSES) {
      const config = getStatusConfig(status);
      expect(typeof config.dotColorVar).toBe("string");
      expect(config.dotColorVar).toMatch(/^var\(--[a-z-]+\)$/);
    }
  });

  it("maps each status to the expected design-system CSS variable", () => {
    expect(getStatusConfig("pending").dotColorVar).toBe("var(--warning)");
    expect(getStatusConfig("in_progress").dotColorVar).toBe("var(--primary)");
    expect(getStatusConfig("completed").dotColorVar).toBe("var(--success)");
    expect(getStatusConfig("snoozed").dotColorVar).toBe("var(--accent)");
  });

  it("falls back to the pending config (with its dotColorVar) for an unknown status", () => {
    const unknown = getStatusConfig("not-a-real-status");
    const pending = getStatusConfig("pending");
    expect(unknown.dotColorVar).toBe(pending.dotColorVar);
    expect(unknown.dotColorVar).toBe("var(--warning)");
  });
});
