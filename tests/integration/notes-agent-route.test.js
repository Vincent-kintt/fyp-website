/**
 * Integration tests for POST /api/ai/notes-agent.
 *
 * Locks in the public contract of the raw-text-stream endpoint before
 * PR2 extracts the stream parsers and PR4 extracts the executor hook:
 *
 *   - command validation (400 on missing/unknown)
 *   - command-to-userMessage mapping (ask / summarize / digest)
 *   - language + note metadata propagation into the system prompt
 *   - auth gate (401 from withAuth when session is missing)
 *
 * Sibling tests/integration/notes-stream-lock-cleanup.test.js covers
 * notes-agentic + notes-rss; this file covers the third stream protocol.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, capturedStreamArgs, fakeStreamResult } = vi.hoisted(() => {
  const captured = { value: null };
  return {
    authMock: vi.fn(() =>
      Promise.resolve({ user: { id: "user-agent-test" } }),
    ),
    capturedStreamArgs: captured,
    fakeStreamResult: {
      toTextStreamResponse: () =>
        new Response("stream-body", {
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
      capturedStreamArgs.value = args;
      return fakeStreamResult;
    },
  };
});

vi.mock("@/lib/ai/provider.js", () => ({
  getModel: vi.fn(() => "mock-model"),
  getNotesModelId: vi.fn(() => "mock-notes-model"),
}));

vi.mock("@/lib/ai/logAIEvent.js", () => ({
  logAIEvent: vi.fn(),
}));

const { POST } = await import("@/app/api/ai/notes-agent/route.js");

function jsonRequest(body) {
  return new Request("http://localhost/api/ai/notes-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  capturedStreamArgs.value = null;
  authMock.mockReset();
  authMock.mockResolvedValue({ user: { id: "user-agent-test" } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/ai/notes-agent — command validation", () => {
  it("returns 400 when command is missing", async () => {
    const res = await POST(jsonRequest({ input: "hello" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/Command is required/i);
    expect(capturedStreamArgs.value).toBeNull();
  });

  it("returns 400 when command is unknown", async () => {
    const res = await POST(
      jsonRequest({ command: "rewrite", input: "hello" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown command: rewrite/);
    expect(capturedStreamArgs.value).toBeNull();
  });
});

describe("POST /api/ai/notes-agent — command-to-userMessage mapping", () => {
  it("ask with input → user message equals input", async () => {
    const res = await POST(
      jsonRequest({ command: "ask", input: "What is X?" }),
    );
    expect(res.status).toBe(200);
    expect(capturedStreamArgs.value.messages).toEqual([
      { role: "user", content: "What is X?" },
    ]);
  });

  it("ask without input → user message is fallback prompt", async () => {
    const res = await POST(jsonRequest({ command: "ask" }));
    expect(res.status).toBe(200);
    expect(capturedStreamArgs.value.messages[0].content).toBe(
      "Please help me.",
    );
  });

  it("summarize with input → user message wraps with summarize prefix", async () => {
    const res = await POST(
      jsonRequest({ command: "summarize", input: "Foo bar baz" }),
    );
    expect(res.status).toBe(200);
    const content = capturedStreamArgs.value.messages[0].content;
    expect(content).toMatch(/^Summarize the following:/);
    expect(content).toContain("Foo bar baz");
  });

  it("summarize without input → user message asks to summarize the note", async () => {
    const res = await POST(jsonRequest({ command: "summarize" }));
    expect(res.status).toBe(200);
    expect(capturedStreamArgs.value.messages[0].content).toBe(
      "Summarize the entire note content.",
    );
  });

  it("digest → user message asks for structured digest", async () => {
    const res = await POST(jsonRequest({ command: "digest" }));
    expect(res.status).toBe(200);
    expect(capturedStreamArgs.value.messages[0].content).toBe(
      "Generate a structured digest of this note's content.",
    );
  });
});

describe("POST /api/ai/notes-agent — system prompt context propagation", () => {
  it("language=zh → system prompt declares 繁體中文", async () => {
    await POST(
      jsonRequest({ command: "ask", input: "x", language: "zh" }),
    );
    expect(capturedStreamArgs.value.system).toContain("繁體中文");
  });

  it("language=en → system prompt declares English", async () => {
    await POST(
      jsonRequest({ command: "ask", input: "x", language: "en" }),
    );
    expect(capturedStreamArgs.value.system).toContain("English");
  });

  it("language defaults to zh when omitted", async () => {
    await POST(jsonRequest({ command: "ask", input: "x" }));
    expect(capturedStreamArgs.value.system).toContain("繁體中文");
  });

  it("noteTitle and noteContext are embedded in system prompt", async () => {
    await POST(
      jsonRequest({
        command: "ask",
        input: "x",
        noteTitle: "Project plan",
        noteContext: "Step 1: do thing.",
      }),
    );
    const sys = capturedStreamArgs.value.system;
    expect(sys).toContain('"Project plan"');
    expect(sys).toContain("Step 1: do thing.");
  });

  it('empty noteTitle falls back to "Untitled"', async () => {
    await POST(jsonRequest({ command: "ask", input: "x" }));
    expect(capturedStreamArgs.value.system).toContain('"Untitled"');
  });
});

describe("POST /api/ai/notes-agent — stream response shape", () => {
  it("returns 200 with a streamable Response body on the happy path", async () => {
    const res = await POST(
      jsonRequest({ command: "ask", input: "hello" }),
    );
    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
    expect(typeof res.body.getReader).toBe("function");
  });

  it("forwards model and maxRetries to streamText", async () => {
    await POST(jsonRequest({ command: "ask", input: "x" }));
    expect(capturedStreamArgs.value.model).toBe("mock-model");
    expect(capturedStreamArgs.value.maxRetries).toBe(2);
  });
});

describe("POST /api/ai/notes-agent — auth gate", () => {
  it("returns 401 when session is missing", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await POST(
      jsonRequest({ command: "ask", input: "hello" }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Unauthorized/i);
    expect(capturedStreamArgs.value).toBeNull();
  });

  it("returns 401 when session has no user", async () => {
    authMock.mockResolvedValueOnce({});
    const res = await POST(
      jsonRequest({ command: "ask", input: "hello" }),
    );
    expect(res.status).toBe(401);
    expect(capturedStreamArgs.value).toBeNull();
  });
});
