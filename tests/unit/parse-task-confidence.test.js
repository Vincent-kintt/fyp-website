import { describe, it, expect } from "vitest";
import { computeOverallConfidence } from "@/app/api/ai/parse-task/confidence";

describe("computeOverallConfidence", () => {
  it("computes weighted average with all fields", () => {
    const result = computeOverallConfidence({
      title: 0.9,
      dateTime: 0.95,
      tags: 0.8,
      priority: 0.7,
    });
    // (0.9*0.4) + (0.95*0.3) + (0.8*0.15) + (0.7*0.15) = 0.87
    expect(result).toBe(0.87);
  });

  it("uses 0.5 fallback when dateTime is missing", () => {
    const result = computeOverallConfidence({
      title: 0.9,
      tags: 0.8,
      priority: 0.7,
    });
    // (0.9*0.4) + (0.5*0.3) + (0.8*0.15) + (0.7*0.15) = 0.735 → 0.74
    expect(result).toBe(0.74);
  });

  it("rounds to 2 decimal places", () => {
    const result = computeOverallConfidence({
      title: 0.33,
      dateTime: 0.66,
      tags: 0.99,
      priority: 0.11,
    });
    expect(typeof result).toBe("number");
    expect(String(result).split(".")[1]?.length || 0).toBeLessThanOrEqual(2);
  });
});
