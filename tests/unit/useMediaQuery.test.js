import { describe, it, expect } from "vitest";

describe("useMediaQuery module", () => {
  it("exports a default function", async () => {
    const mod = await import("@/hooks/useMediaQuery");
    expect(typeof mod.default).toBe("function");
  });
});
