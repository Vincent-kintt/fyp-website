/**
 * Unit tests for lib/ai/modelIds.js + lib/ai/provider.js model resolvers.
 *
 * Goal: centralized fallback chains. Each resolver must walk env vars in
 * the correct order, with the documented default at the end.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let modelIds;
let resolvers;

beforeEach(async () => {
  vi.resetModules();
  vi.unstubAllEnvs();
  // Clear vars resolvers read so each test starts from a known floor.
  vi.stubEnv("PARSE_TASK_MODEL", "");
  vi.stubEnv("NOTES_AGENT_MODEL", "");
  vi.stubEnv("LLM_MODEL", "");
  modelIds = await import("@/lib/ai/modelIds.js");
  resolvers = await import("@/lib/ai/provider.js");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("modelIds constants", () => {
  it("exports DEFAULT_PARSE_MODEL_ID", () => {
    expect(modelIds.DEFAULT_PARSE_MODEL_ID).toBe("x-ai/grok-4.1-fast");
  });

  it("exports DEFAULT_REMINDER_MODEL_ID (client-safe default for AIReminderModal)", () => {
    expect(modelIds.DEFAULT_REMINDER_MODEL_ID).toBe("x-ai/grok-4.1-fast");
  });

  it("exports DEFAULT_AGENT_MODEL_ID", () => {
    expect(typeof modelIds.DEFAULT_AGENT_MODEL_ID).toBe("string");
    expect(modelIds.DEFAULT_AGENT_MODEL_ID.length).toBeGreaterThan(0);
  });
});

describe("getParseModelId", () => {
  it("returns PARSE_TASK_MODEL env when set", () => {
    vi.stubEnv("PARSE_TASK_MODEL", "custom/parse-model");
    expect(resolvers.getParseModelId()).toBe("custom/parse-model");
  });

  it("falls back to DEFAULT_PARSE_MODEL_ID when env unset", () => {
    expect(resolvers.getParseModelId()).toBe(modelIds.DEFAULT_PARSE_MODEL_ID);
  });
});

describe("getNotesModelId", () => {
  it("prefers explicit argument over env", () => {
    vi.stubEnv("NOTES_AGENT_MODEL", "from-env");
    expect(resolvers.getNotesModelId("explicit")).toBe("explicit");
  });

  it("falls back to NOTES_AGENT_MODEL when no argument", () => {
    vi.stubEnv("NOTES_AGENT_MODEL", "notes-from-env");
    expect(resolvers.getNotesModelId()).toBe("notes-from-env");
  });

  it("falls back to LLM_MODEL when NOTES_AGENT_MODEL unset", () => {
    vi.stubEnv("LLM_MODEL", "general-agent");
    expect(resolvers.getNotesModelId()).toBe("general-agent");
  });

  it("falls back to DEFAULT_AGENT_MODEL_ID at end of chain", () => {
    expect(resolvers.getNotesModelId()).toBe(modelIds.DEFAULT_AGENT_MODEL_ID);
  });
});

describe("getAgentModelId", () => {
  it("prefers explicit argument over env", () => {
    vi.stubEnv("LLM_MODEL", "from-env");
    expect(resolvers.getAgentModelId("explicit")).toBe("explicit");
  });

  it("falls back to LLM_MODEL when no argument", () => {
    vi.stubEnv("LLM_MODEL", "main-agent");
    expect(resolvers.getAgentModelId()).toBe("main-agent");
  });

  it("falls back to DEFAULT_AGENT_MODEL_ID at end of chain", () => {
    expect(resolvers.getAgentModelId()).toBe(modelIds.DEFAULT_AGENT_MODEL_ID);
  });
});
