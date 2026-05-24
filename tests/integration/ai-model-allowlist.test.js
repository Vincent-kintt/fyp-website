/**
 * Integration tests for H9 — AI endpoint model allowlist enforcement.
 *
 * Bug: route schemas declared `model: z.string().optional()` so any model id
 *      (e.g. anthropic/claude-3-opus) passed through to the provider, even
 *      though the UI only exposed a small set. A buggy or malicious client
 *      could request a 10× cost model.
 *
 * Contract under test:
 *   - Request with an unknown `model` returns 400 BEFORE any provider call.
 *   - Request with a `model` from the canonical allowlist starts streaming.
 *   - Request that omits `model` falls back to the server default and streams.
 *
 * Covers POST /api/ai/agentic-reminder and POST /api/ai/notes-agent — the two
 * endpoints whose request body accepts a client-controlled `model` field.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  capturedAgenticArgs,
  capturedNotesArgs,
  fakeUIStreamResult,
  fakeTextStreamResult,
} = vi.hoisted(() => {
  const capturedAgentic = { value: null };
  const capturedNotes = { value: null };
  return {
    authMock: vi.fn(() =>
      Promise.resolve({ user: { id: "user-allowlist-test" } }),
    ),
    capturedAgenticArgs: capturedAgentic,
    capturedNotesArgs: capturedNotes,
    fakeUIStreamResult: {
      toUIMessageStreamResponse: () =>
        new Response("ui-stream-body", {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
    },
    fakeTextStreamResult: {
      toTextStreamResponse: () =>
        new Response("text-stream-body", {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
    },
  };
});

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    streamText: (args) => {
      // Endpoints differ in how they call streamText; we can tell them apart
      // by which fields they pass (agentic-reminder sets `tools`).
      if (args.tools) {
        capturedAgenticArgs.value = args;
        return fakeUIStreamResult;
      }
      capturedNotesArgs.value = args;
      return fakeTextStreamResult;
    },
    convertToModelMessages: (msgs) => msgs,
  };
});

vi.mock("@/lib/ai/provider.js", () => ({
  getModel: vi.fn((id) => ({ __mockedModelFor: id })),
  getAgentModelId: vi.fn((explicit) => explicit || "default-agent-model"),
  getNotesModelId: vi.fn((explicit) => explicit || "default-notes-model"),
}));

vi.mock("@/lib/ai/tools.js", () => ({
  createTools: vi.fn(() => ({})),
}));

vi.mock("@/lib/ai/prompt.js", () => ({
  getSystemPrompt: vi.fn(() => "mocked system prompt"),
}));

vi.mock("@/lib/ai/logAIEvent.js", () => ({
  logAIEvent: vi.fn(),
}));

// H10 — every AI route now consults the per-user MongoDB rate limiter.
// Tests that exercise non-rate-limit concerns mock the gate to a pass.
// The dedicated tests/integration/aiRateLimit.test.js exercises the
// real limiter end-to-end against mongodb-memory-server.
vi.mock("@/lib/rateLimit/aiRateLimiter.js", () => ({
  consumeAILimit: vi.fn(async () => ({ ok: true })),
}));

// agentic-reminder now acquires a per-user concurrency lock before parsing the
// body (matching notes-agentic/notes-rss). This suite exercises the model
// allowlist, not the lock, so mock the lock to a successful acquire + no-op
// release/renew. The dedicated tests/integration/reminder-stream-lock-cleanup.test.js
// and userAILock.test.js cover the lock contract.
vi.mock("@/lib/locks/acquireUserAILock.js", () => ({
  acquireUserAILock: vi.fn(async () => ({ _id: "reminder-ai:user-allowlist-test" })),
  releaseUserAILock: vi.fn(async () => {}),
  renewUserAILock: vi.fn(async () => {}),
}));

const { POST: agenticReminderPOST } = await import(
  "@/app/api/ai/agentic-reminder/route.js"
);
const { POST: notesAgentPOST } = await import(
  "@/app/api/ai/notes-agent/route.js"
);
const { ALLOWED_AGENT_MODELS } = await import("@/lib/ai/allowedModels.js");

function jsonRequest(url, body) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  capturedAgenticArgs.value = null;
  capturedNotesArgs.value = null;
  authMock.mockReset();
  authMock.mockResolvedValue({ user: { id: "user-allowlist-test" } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("allowedModels module — canonical source of truth", () => {
  it("exports a non-empty allowlist of model ids", () => {
    expect(Array.isArray(ALLOWED_AGENT_MODELS)).toBe(true);
    expect(ALLOWED_AGENT_MODELS.length).toBeGreaterThan(0);
  });

  it("includes the reminder-modal UI default", () => {
    expect(ALLOWED_AGENT_MODELS).toContain("deepseek/deepseek-v3.2");
  });

  it("does not include the deprecated Grok 4.1 Fast id", () => {
    expect(ALLOWED_AGENT_MODELS).not.toContain("x-ai/grok-4.1-fast");
  });
});

describe("POST /api/ai/agentic-reminder — model allowlist enforcement", () => {
  it("rejects an off-allowlist model with 400 BEFORE provider call", async () => {
    const res = await agenticReminderPOST(
      jsonRequest("http://localhost/api/ai/agentic-reminder", {
        messages: [{ role: "user", content: "hi" }],
        model: "anthropic/claude-3-opus",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    // streamText must not have been invoked
    expect(capturedAgenticArgs.value).toBeNull();
  });

  it("accepts a model id from the allowlist and starts streaming", async () => {
    const res = await agenticReminderPOST(
      jsonRequest("http://localhost/api/ai/agentic-reminder", {
        messages: [{ role: "user", content: "hi" }],
        model: ALLOWED_AGENT_MODELS[0],
      }),
    );
    expect(res.status).toBe(200);
    expect(capturedAgenticArgs.value).not.toBeNull();
  });

  it("accepts request without `model` (falls back to server default)", async () => {
    const res = await agenticReminderPOST(
      jsonRequest("http://localhost/api/ai/agentic-reminder", {
        messages: [{ role: "user", content: "hi" }],
      }),
    );
    expect(res.status).toBe(200);
    expect(capturedAgenticArgs.value).not.toBeNull();
  });

  it("rejects empty string model", async () => {
    const res = await agenticReminderPOST(
      jsonRequest("http://localhost/api/ai/agentic-reminder", {
        messages: [{ role: "user", content: "hi" }],
        model: "",
      }),
    );
    expect(res.status).toBe(400);
    expect(capturedAgenticArgs.value).toBeNull();
  });
});

describe("POST /api/ai/notes-agent — model allowlist enforcement", () => {
  it("rejects an off-allowlist model with 400 BEFORE provider call", async () => {
    const res = await notesAgentPOST(
      jsonRequest("http://localhost/api/ai/notes-agent", {
        command: "ask",
        input: "hi",
        model: "anthropic/claude-3-opus",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(capturedNotesArgs.value).toBeNull();
  });

  it("accepts a model id from the allowlist and starts streaming", async () => {
    const res = await notesAgentPOST(
      jsonRequest("http://localhost/api/ai/notes-agent", {
        command: "ask",
        input: "hi",
        model: ALLOWED_AGENT_MODELS[0],
      }),
    );
    expect(res.status).toBe(200);
    expect(capturedNotesArgs.value).not.toBeNull();
  });

  it("accepts request without `model` (falls back to server default)", async () => {
    const res = await notesAgentPOST(
      jsonRequest("http://localhost/api/ai/notes-agent", {
        command: "ask",
        input: "hi",
      }),
    );
    expect(res.status).toBe(200);
    expect(capturedNotesArgs.value).not.toBeNull();
  });

  it("rejects empty string model", async () => {
    const res = await notesAgentPOST(
      jsonRequest("http://localhost/api/ai/notes-agent", {
        command: "ask",
        input: "hi",
        model: "",
      }),
    );
    expect(res.status).toBe(400);
    expect(capturedNotesArgs.value).toBeNull();
  });
});

describe("UI modelOptions must reference the allowlist (no drift)", () => {
  it("every modelOptions.value is in ALLOWED_AGENT_MODELS", async () => {
    const { modelOptions } = await import(
      "@/components/reminders/ai-modal/modelOptions.js"
    );
    for (const opt of modelOptions) {
      expect(ALLOWED_AGENT_MODELS).toContain(opt.value);
    }
  });
});
