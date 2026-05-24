/**
 * Integration tests for the per-user concurrency lock + lease-renewal
 * (heartbeat) in the reminder agent route (app/api/ai/agentic-reminder).
 *
 * The reminder agent runs a multi-step tool loop whose measured baseline
 * (~32s) exceeds nothing now that the lock TTL is 120s, but a long run still
 * relies on per-step renewal to stay alive. The route therefore:
 *
 *   - acquires a per-user lock (scope "reminder-ai") before parsing the body
 *   - returns 429 without releasing when the lock is already held
 *   - releases the lock exactly once across the AI SDK v6 terminal callbacks
 *     (onFinish / onAbort / onError), which can fire in any combination
 *   - releases the lock on any synchronous error before the stream starts
 *     (malformed body, or convertToModelMessages throwing)
 *   - renews the lease on every agent step via onStepFinish
 *
 * Mirrors tests/integration/notes-stream-lock-cleanup.test.js. The reminder
 * scope ("reminder-ai") is intentionally separate from notes ("notes-ai") so
 * reminder AI and notes AI can stream concurrently for the same user.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: "user-stream-test" } })),
}));

const acquireLockMock = vi.fn(async () => ({ _id: "reminder-ai:user-stream-test" }));
const releaseLockMock = vi.fn(async () => {});
const renewLockMock = vi.fn(async () => {});
vi.mock("@/lib/locks/acquireUserAILock.js", () => ({
  acquireUserAILock: (...args) => acquireLockMock(...args),
  releaseUserAILock: (...args) => releaseLockMock(...args),
  renewUserAILock: (...args) => renewLockMock(...args),
}));

const capturedStreamArgs = { value: null };
const fakeStreamResult = {
  toUIMessageStreamResponse: () =>
    new Response("stream-body", {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    }),
};

// Module-scope mocks so each test can switch behavior. streamText captures its
// args; convertToModelMessages passes messages through by default but can be
// made to reject to exercise the sync-error-before-stream branch.
const streamTextMock = vi.fn((args) => {
  capturedStreamArgs.value = args;
  return fakeStreamResult;
});
const convertMock = vi.fn(async (messages) => messages);

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    streamText: (...args) => streamTextMock(...args),
    convertToModelMessages: (...args) => convertMock(...args),
  };
});

vi.mock("@/lib/ai/provider.js", () => ({
  getModel: vi.fn(() => "mock-model"),
  getAgentModelId: vi.fn(() => "mock-agent-model"),
}));

vi.mock("@/lib/ai/tools.js", () => ({
  createTools: vi.fn(() => ({})),
}));

vi.mock("@/lib/ai/logAIEvent.js", () => ({
  logAIEvent: vi.fn(),
}));

// H10 — rate limit gate. The dedicated tests/integration/aiRateLimit.test.js
// exercises the real limiter; here we mock it to a pass so this suite can keep
// testing the lock contract in isolation.
vi.mock("@/lib/rateLimit/aiRateLimiter.js", () => ({
  consumeAILimit: vi.fn(async () => ({ ok: true })),
}));

const { POST: reminderPOST } = await import(
  "@/app/api/ai/agentic-reminder/route.js"
);

function jsonRequest(body) {
  return new Request("http://localhost/api/ai/agentic-reminder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = { messages: [{ role: "user", content: "remind me to call mom" }] };

beforeEach(() => {
  acquireLockMock.mockReset();
  acquireLockMock.mockResolvedValue({ _id: "reminder-ai:user-stream-test" });
  releaseLockMock.mockReset();
  releaseLockMock.mockResolvedValue(undefined);
  renewLockMock.mockReset();
  renewLockMock.mockResolvedValue(undefined);
  streamTextMock.mockClear();
  convertMock.mockReset();
  convertMock.mockImplementation(async (messages) => messages);
  capturedStreamArgs.value = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reminder agent stream lifecycle releases lock exactly once", () => {
  async function startStream() {
    const res = await reminderPOST(jsonRequest(validBody));
    expect(res.status).toBe(200);
    expect(capturedStreamArgs.value).toBeTruthy();
    return capturedStreamArgs.value;
  }

  it("acquires the lock once with scope reminder-ai when POST starts", async () => {
    await startStream();
    expect(acquireLockMock).toHaveBeenCalledTimes(1);
    expect(acquireLockMock).toHaveBeenCalledWith("user-stream-test", "reminder-ai");
    expect(releaseLockMock).not.toHaveBeenCalled();
  });

  it("releases the lock when onFinish fires", async () => {
    const args = await startStream();
    args.onFinish({ totalUsage: {}, steps: [] });
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
    expect(releaseLockMock).toHaveBeenCalledWith("user-stream-test", "reminder-ai");
  });

  it("releases the lock when onError fires", async () => {
    const args = await startStream();
    args.onError({ error: new Error("upstream boom") });
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
  });

  it("releases the lock when onAbort fires", async () => {
    const args = await startStream();
    args.onAbort();
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
  });

  it("releases the lock exactly once when multiple callbacks fire", async () => {
    const args = await startStream();
    args.onError({ error: new Error("boom") });
    args.onAbort();
    args.onFinish({ totalUsage: {}, steps: [] });
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
  });

  it("returns 429 without acquiring->releasing when already locked", async () => {
    acquireLockMock.mockResolvedValueOnce(null);
    const res = await reminderPOST(jsonRequest(validBody));
    expect(res.status).toBe(429);
    expect(releaseLockMock).not.toHaveBeenCalled();
  });

  it("releases the lock on synchronous error: malformed body fails schema", async () => {
    // messages must be a non-empty array; [] fails the schema -> 400 branch
    // which calls releaseOnce before returning the parse error.
    const res = await reminderPOST(jsonRequest({ messages: [] }));
    expect(res.status).toBe(400);
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
  });

  it("releases the lock on synchronous error: empty body fails schema", async () => {
    const res = await reminderPOST(jsonRequest({}));
    expect(res.status).toBe(400);
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
  });

  it("releases the lock when convertToModelMessages throws before streamText", async () => {
    // A throw between body-parse and streamText must hit the catch block,
    // release the lock, and rethrow so withAuth maps it to a 500.
    convertMock.mockRejectedValueOnce(new Error("bad UIMessage shape"));
    const res = await reminderPOST(jsonRequest(validBody));
    expect(res.status).toBe(500);
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("renews the lease (heartbeat) on each agent step via onStepFinish", async () => {
    const args = await startStream();
    args.onStepFinish({ usage: {}, toolResults: [] });
    expect(renewLockMock).toHaveBeenCalledWith("user-stream-test", "reminder-ai");
  });
});
