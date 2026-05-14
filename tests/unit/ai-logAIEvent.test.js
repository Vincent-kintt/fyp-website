/**
 * Unit tests for lib/ai/logAIEvent.js.
 *
 * Tiny structured JSON logger shared by AI route lifecycle callbacks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logAIEvent } from "@/lib/ai/logAIEvent.js";

let consoleLog;
let consoleError;

beforeEach(() => {
  consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleLog.mockRestore();
  consoleError.mockRestore();
});

describe("logAIEvent", () => {
  it("emits a JSON line to console.log by default", () => {
    logAIEvent("agent_complete", { totalSteps: 3 });
    expect(consoleLog).toHaveBeenCalledTimes(1);
    const json = JSON.parse(consoleLog.mock.calls[0][0]);
    expect(json.event).toBe("agent_complete");
    expect(json.totalSteps).toBe(3);
    expect(typeof json.timestamp).toBe("string");
    expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);
  });

  it("routes to console.error when level is 'error'", () => {
    logAIEvent("agent_error", { message: "boom" }, "error");
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleLog).not.toHaveBeenCalled();
    const json = JSON.parse(consoleError.mock.calls[0][0]);
    expect(json.event).toBe("agent_error");
    expect(json.message).toBe("boom");
  });

  it("merges fields onto the event payload without mutating input", () => {
    const fields = { foo: 1 };
    logAIEvent("evt", fields);
    expect(fields).toEqual({ foo: 1 }); // unchanged
    const json = JSON.parse(consoleLog.mock.calls[0][0]);
    expect(json).toMatchObject({ event: "evt", foo: 1 });
  });

  it("handles empty/missing fields", () => {
    logAIEvent("bare");
    const json = JSON.parse(consoleLog.mock.calls[0][0]);
    expect(json.event).toBe("bare");
    expect(json.timestamp).toBeTruthy();
  });

  it("never lets caller fields override the event name", () => {
    logAIEvent("real_event", { event: "spoofed", value: 42 });
    const json = JSON.parse(consoleLog.mock.calls[0][0]);
    expect(json.event).toBe("real_event");
    expect(json.value).toBe(42);
  });
});
