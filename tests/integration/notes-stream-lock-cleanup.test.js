/**
 * Integration tests for the releaseOnce pattern in stream routes
 * (notes-agentic, notes-rss).
 *
 * The route holds a per-user concurrency lock during streaming. Because
 * AI SDK v6 stream lifecycle has three independent terminal callbacks
 * (onFinish, onAbort, onError) and any of them — or none — can fire,
 * each route wires releaseOnce() to all three. These tests capture the
 * callbacks passed to streamText() and prove:
 *
 *   - onFinish releases the lock
 *   - onAbort releases the lock
 *   - onError releases the lock
 *   - Calling any combination of callbacks releases the lock exactly once
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: "user-stream-test" } })),
}));

const acquireLockMock = vi.fn(() => true);
const releaseLockMock = vi.fn();
vi.mock("@/lib/ai/notesConcurrency.js", () => ({
  acquireNoteAILock: (...args) => acquireLockMock(...args),
  releaseNoteAILock: (...args) => releaseLockMock(...args),
}));

const capturedStreamArgs = { value: null };
const fakeStreamResult = {
  toUIMessageStreamResponse: () =>
    new Response("stream-body", {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    }),
};

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    streamText: (args) => {
      capturedStreamArgs.value = args;
      return fakeStreamResult;
    },
  };
});

vi.mock("@/lib/ai/provider.js", () => ({
  getModel: vi.fn(() => "mock-model"),
  getNotesModelId: vi.fn(() => "mock-notes-model"),
}));

vi.mock("@/lib/ai/tools.js", () => ({
  createTools: vi.fn(() => ({})),
}));

vi.mock("@/lib/ai/noteTools.js", () => ({
  createNoteTools: vi.fn(() => ({})),
}));

vi.mock("@/lib/ai/rssTools.js", () => ({
  createRssTools: vi.fn(() => ({})),
}));

vi.mock("@/lib/ai/logAIEvent.js", () => ({
  logAIEvent: vi.fn(),
}));

const { POST: agenticPOST } = await import(
  "@/app/api/ai/notes-agentic/route.js"
);
const { POST: rssPOST } = await import("@/app/api/ai/notes-rss/route.js");

function jsonRequest(body) {
  return new Request("http://localhost/api/ai/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  acquireLockMock.mockReset();
  acquireLockMock.mockReturnValue(true);
  releaseLockMock.mockReset();
  capturedStreamArgs.value = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("notes-agentic stream lifecycle releases lock exactly once", () => {
  async function startStream() {
    const res = await agenticPOST(jsonRequest({ input: "hello world" }));
    expect(res.status).toBe(200);
    expect(capturedStreamArgs.value).toBeTruthy();
    return capturedStreamArgs.value;
  }

  it("acquires the lock once when POST starts", async () => {
    await startStream();
    expect(acquireLockMock).toHaveBeenCalledTimes(1);
    expect(releaseLockMock).not.toHaveBeenCalled();
  });

  it("releases the lock when onFinish fires", async () => {
    const args = await startStream();
    args.onFinish({ totalUsage: {}, steps: [] });
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
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

  it("returns 429 without acquiring the lock when already locked", async () => {
    acquireLockMock.mockReturnValueOnce(false);
    const res = await agenticPOST(jsonRequest({ input: "hello" }));
    expect(res.status).toBe(429);
    expect(releaseLockMock).not.toHaveBeenCalled();
  });

  it("releases the lock on synchronous error before streamText runs", async () => {
    // Empty input triggers the validation branch which calls releaseOnce + returns apiError(400)
    const res = await agenticPOST(jsonRequest({ input: "   " }));
    expect(res.status).toBe(400);
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
  });
});

describe("notes-rss stream lifecycle releases lock exactly once", () => {
  async function startStream() {
    const res = await rssPOST(jsonRequest({ language: "zh" }));
    expect(res.status).toBe(200);
    expect(capturedStreamArgs.value).toBeTruthy();
    return capturedStreamArgs.value;
  }

  it("releases the lock when onFinish fires", async () => {
    const args = await startStream();
    args.onFinish({ totalUsage: {}, steps: [] });
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
  });

  it("releases the lock when onAbort fires", async () => {
    const args = await startStream();
    args.onAbort();
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
  });

  it("releases the lock when onError fires", async () => {
    const args = await startStream();
    args.onError({ error: new Error("rss boom") });
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
  });

  it("releases the lock exactly once across all three callbacks", async () => {
    const args = await startStream();
    args.onAbort();
    args.onFinish({ totalUsage: {}, steps: [] });
    args.onError({ error: new Error("late error") });
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
  });

  it("returns 429 without acquiring the lock when already locked", async () => {
    acquireLockMock.mockReturnValueOnce(false);
    const res = await rssPOST(jsonRequest({ language: "zh" }));
    expect(res.status).toBe(429);
    expect(releaseLockMock).not.toHaveBeenCalled();
  });
});
